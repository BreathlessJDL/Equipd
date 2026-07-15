#!/usr/bin/env node
/**
 * Read-only audit of console images for consoles linked via product_console_compat.
 *
 * Schema (confirmed from migrations + public page code):
 * - Master: equipment_consoles (image_url, image_storage_path, image_status:
 *   none | pending | approved | rejected)
 * - Compat: product_console_compat.console_id → equipment_consoles.id
 * - Public page (buildProductConsoleImageMap) currently uses image_url only.
 * - Static convention: /equipment-console-images/{brand-slug}/normalized/...
 *
 * Usage:
 *   node scripts/audit-linked-console-images.mjs
 *   node scripts/audit-linked-console-images.mjs --brand "Matrix Fitness"
 *   node scripts/audit-linked-console-images.mjs --console-id "<uuid>"
 *   node scripts/audit-linked-console-images.mjs --verify-storage
 */

import { createClient } from '@supabase/supabase-js'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { PRODUCT_STATUS } from '../src/lib/intelligenceCanonicalProducts.js'

const REPORTS_DIR = join(process.cwd(), 'reports')
const JSON_PATH = join(REPORTS_DIR, 'linked-console-image-audit.json')
const CSV_PATH = join(REPORTS_DIR, 'linked-console-image-audit.csv')
const MANIFEST_PATH = join(REPORTS_DIR, 'missing-linked-console-images-manifest.csv')
const HUMAN_PATH = join(REPORTS_DIR, 'missing-linked-console-images-human.txt')

const PUBLIC_PRODUCT_STATUSES = new Set([PRODUCT_STATUS.APPROVED])

const CONSOLE_IMAGE_STATUSES = {
  NONE: 'none',
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
}

const PLACEHOLDER_PATTERN = /(?:logo|icon|favicon|placeholder|avatar|badge|sprite|no-image|noimage|coming-soon|blank|1x1|pixel)/i
const PRODUCT_HERO_PATTERN = /equipment-product-images\//i
const LOGO_TITLE_PATTERN = /(?:brand\s*logo|\blogo\b)/i

const MATRIX_EXPECTED_KEYS = [
  'led',
  'premium_led',
  'xr',
  'xer',
  'xir',
  'xur',
  'touch',
  'touch_xl',
  'onyx_22',
  'onyx_32',
]

function loadEnv() {
  const text = readFileSync(join(process.cwd(), '.env.local'), 'utf8')
  const env = {}
  for (const line of text.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const idx = trimmed.indexOf('=')
    if (idx === -1) continue
    let value = trimmed.slice(idx + 1)
    if (
      (value.startsWith('"') && value.endsWith('"'))
      || (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    env[trimmed.slice(0, idx)] = value
  }
  return env
}

function parseArgs(argv) {
  const args = {
    brand: null,
    consoleId: null,
    verifyStorage: false,
  }
  for (let index = 2; index < argv.length; index += 1) {
    const token = argv[index]
    if (token === '--verify-storage') args.verifyStorage = true
    else if (token === '--brand') {
      args.brand = argv[index + 1] ?? null
      index += 1
    } else if (token === '--console-id') {
      args.consoleId = argv[index + 1] ?? null
      index += 1
    }
  }
  return args
}

function normalizeWhitespace(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim()
}

function brandSlug(brand) {
  return normalizeWhitespace(brand)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'unknown-brand'
}

function consoleKeySlug(consoleKey) {
  return normalizeWhitespace(consoleKey)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'unknown-console'
}

function normalizeAliasKey(value) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
}

function csvEscape(value) {
  const text = value == null ? '' : String(value)
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`
  return text
}

function writeCsv(path, headers, rows) {
  const lines = [headers.join(',')]
  for (const row of rows) {
    lines.push(headers.map((header) => csvEscape(row[header])).join(','))
  }
  writeFileSync(path, `${lines.join('\n')}\n`)
}

function countBy(items, keyFn) {
  const out = {}
  for (const item of items) {
    const key = keyFn(item) || '(none)'
    out[key] = (out[key] ?? 0) + 1
  }
  return Object.fromEntries(
    Object.entries(out).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])),
  )
}

async function fetchAll(supabase, table, select, {
  brand = null,
  brandColumn = 'brand',
  id = null,
  idColumn = 'id',
  orderBy = null,
} = {}) {
  const pageSize = 1000
  const rows = []
  for (let from = 0; ; from += pageSize) {
    let query = supabase.from(table).select(select).range(from, from + pageSize - 1)
    if (brand) query = query.ilike(brandColumn, brand)
    if (id) query = query.eq(idColumn, id)
    if (orderBy) query = query.order(orderBy)
    const { data, error } = await query
    if (error) throw error
    const batch = data ?? []
    rows.push(...batch)
    if (batch.length < pageSize) break
  }
  return rows
}

function isHttpUrl(value) {
  try {
    const url = new URL(String(value ?? ''))
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

function isStaticPublicConsolePath(value) {
  const text = String(value ?? '').trim()
  return text.startsWith('/equipment-console-images/')
    || text.startsWith('equipment-console-images/')
}

function resolveLocalStaticPath(imageUrl) {
  const text = String(imageUrl ?? '').trim()
  if (!text) return null
  let relative = text
  if (text.startsWith('http://') || text.startsWith('https://')) {
    try {
      const pathname = new URL(text).pathname
      if (!pathname.includes('/equipment-console-images/')) return null
      relative = pathname.slice(pathname.indexOf('/equipment-console-images/') + 1)
    } catch {
      return null
    }
  } else if (text.startsWith('/equipment-console-images/')) {
    relative = text.slice(1)
  } else if (!text.startsWith('equipment-console-images/')) {
    return null
  }
  // Decode %20 etc so approved URLs still resolve to real public/ files.
  try {
    relative = decodeURIComponent(relative)
  } catch {
    // keep raw relative if malformed encoding
  }
  return join(process.cwd(), 'public', relative)
}

function hasAssetFields(consoleRow) {
  return Boolean(
    normalizeWhitespace(consoleRow?.image_url)
    || normalizeWhitespace(consoleRow?.image_storage_path),
  )
}

/**
 * Public page currently maps image_url only, but owned storage paths are also
 * considered usable for this audit (per requirements). Rejected/disabled are not.
 *
 * image_status=approved alone is NOT usable if the referenced static file is missing.
 */
function classifyConsoleImage(consoleRow, { verifyStorage = false, storageExists = null } = {}) {
  const imageUrl = normalizeWhitespace(consoleRow?.image_url) || null
  const storagePath = normalizeWhitespace(consoleRow?.image_storage_path) || null
  const status = normalizeWhitespace(consoleRow?.image_status || CONSOLE_IMAGE_STATUSES.NONE).toLowerCase()
  const haystack = [imageUrl, storagePath, consoleRow?.console_name].filter(Boolean).join(' ')

  if (status === CONSOLE_IMAGE_STATUSES.REJECTED) {
    return { hasUsableImage: false, reason: 'image_status_rejected' }
  }
  if (!imageUrl && !storagePath) {
    return { hasUsableImage: false, reason: 'no_image_url_or_storage_path' }
  }
  if (status === 'failed' || status === 'disabled' || status === 'missing') {
    return { hasUsableImage: false, reason: `image_status_${status}` }
  }
  if (PLACEHOLDER_PATTERN.test(haystack) || LOGO_TITLE_PATTERN.test(haystack)) {
    return { hasUsableImage: false, reason: 'placeholder_or_logo_signal' }
  }
  if (PRODUCT_HERO_PATTERN.test(haystack)) {
    return { hasUsableImage: false, reason: 'points_to_product_hero_image' }
  }
  if (imageUrl && !isHttpUrl(imageUrl) && !isStaticPublicConsolePath(imageUrl) && !storagePath) {
    return { hasUsableImage: false, reason: 'invalid_image_url_format' }
  }

  // Always verify static public files when image_url points at /equipment-console-images/.
  if (imageUrl && isStaticPublicConsolePath(imageUrl)) {
    const localPath = resolveLocalStaticPath(imageUrl)
    if (localPath && !existsSync(localPath)) {
      return {
        hasUsableImage: false,
        reason: status === CONSOLE_IMAGE_STATUSES.APPROVED
          ? 'approved_but_static_public_file_missing'
          : 'static_public_file_missing',
      }
    }
  }

  if (verifyStorage) {
    if (storageExists === false) {
      return { hasUsableImage: false, reason: 'storage_object_missing' }
    }
  }

  // Public UI currently requires image_url; flag storage-only separately but still usable per audit rules.
  if (!imageUrl && storagePath) {
    return { hasUsableImage: true, reason: null, note: 'storage_path_only_public_page_uses_image_url' }
  }

  return { hasUsableImage: true, reason: null }
}

function suggestedFilename(consoleRow) {
  const key = consoleKeySlug(consoleRow.console_key)
  const brand = brandSlug(consoleRow.brand)
  // Prefer existing static convention under public/equipment-console-images
  return `${brand}-${key}.jpg`
}

function suggestedStoragePath(consoleRow) {
  const brand = brandSlug(consoleRow.brand)
  const key = consoleKeySlug(consoleRow.console_key)
  return `equipment-console-images/${brand}/${key}.jpg`
}

function primaryCompatType(links = []) {
  const counts = countBy(links, (link) => link.compatibility_type)
  return Object.keys(counts)[0] ?? null
}

function classifyCompatFamily(links = []) {
  const types = new Set(links.map((link) => link.compatibility_type).filter(Boolean))
  if (types.has('fixed') && types.size === 1) return 'fixed'
  if (types.has('retrofit') && !types.has('factory') && !types.has('optional') && !types.has('fixed')) {
    return 'retrofit'
  }
  if (types.has('fixed') && (types.has('factory') || types.has('optional'))) return 'mixed_fixed_modular'
  if (types.has('retrofit') && (types.has('factory') || types.has('optional'))) return 'mixed_retrofit_modular'
  if (types.has('factory') || types.has('optional')) return 'modular'
  if (types.has('fixed')) return 'fixed'
  if (types.has('retrofit')) return 'retrofit'
  return 'unknown'
}

function detectAliasGroups(consoles = []) {
  const byBrandAlias = new Map()
  for (const row of consoles) {
    const alias = normalizeAliasKey(row.console_key) || normalizeAliasKey(row.console_name)
    if (!alias) continue
    const brandKey = normalizeWhitespace(row.brand).toLowerCase()
    const mapKey = `${brandKey}::${alias}`
    if (!byBrandAlias.has(mapKey)) byBrandAlias.set(mapKey, [])
    byBrandAlias.get(mapKey).push(row)
  }

  // Also group near-aliases: strip leading count prefixes like 3x / 5x
  const nearGroups = new Map()
  for (const row of consoles) {
    const raw = normalizeAliasKey(row.console_key) || normalizeAliasKey(row.console_name)
    if (!raw) continue
    const stripped = raw.replace(/^\d+x/, '').replace(/^\d+inch/, '').replace(/^inch/, '')
    const brandKey = normalizeWhitespace(row.brand).toLowerCase()
    const mapKey = `${brandKey}::near::${stripped}`
    if (!nearGroups.has(mapKey)) nearGroups.set(mapKey, [])
    nearGroups.get(mapKey).push(row)
  }

  const groups = []
  const seen = new Set()

  for (const [key, members] of byBrandAlias.entries()) {
    if (members.length < 2) continue
    const ids = members.map((m) => m.id).sort().join(',')
    if (seen.has(ids)) continue
    seen.add(ids)
    groups.push({
      kind: 'exact_normalized_key_or_name',
      brand: members[0].brand,
      alias_key: key.split('::')[1],
      console_ids: members.map((m) => m.id),
      consoles: members.map((m) => ({
        id: m.id,
        console_key: m.console_key,
        console_name: m.console_name,
        image_url: m.image_url,
        image_status: m.image_status,
      })),
    })
  }

  for (const [key, members] of nearGroups.entries()) {
    const uniqueIds = [...new Set(members.map((m) => m.id))]
    if (uniqueIds.length < 2) continue
    const ids = uniqueIds.sort().join(',')
    if (seen.has(ids)) continue
    // Only flag if keys/names actually differ
    const labels = new Set(members.map((m) => `${m.console_key}|${m.console_name}`))
    if (labels.size < 2) continue
    seen.add(ids)
    groups.push({
      kind: 'near_alias_spacing_prefix_or_case',
      brand: members[0].brand,
      alias_key: key.split('::')[2],
      console_ids: uniqueIds,
      consoles: members.map((m) => ({
        id: m.id,
        console_key: m.console_key,
        console_name: m.console_name,
        image_url: m.image_url,
        image_status: m.image_status,
      })),
    })
  }

  return groups
}

function yearsLabel(consoleRow, links = []) {
  const fromCandidates = [
    consoleRow.start_year,
    ...links.map((link) => link.available_from_year),
  ].filter((value) => Number.isFinite(Number(value))).map(Number)
  const toCandidates = [
    consoleRow.end_year,
    ...links.map((link) => link.available_to_year),
  ].filter((value) => value != null && Number.isFinite(Number(value))).map(Number)

  const earliest = fromCandidates.length ? Math.min(...fromCandidates) : null
  const latest = toCandidates.length ? Math.max(...toCandidates) : null
  if (earliest == null && latest == null) return 'unknown'
  if (latest == null) return `${earliest}+`
  return `${earliest}–${latest}`
}

function buildHumanList(missingConsoles) {
  const blocks = []
  for (const row of missingConsoles) {
    const examples = (row.linked_products ?? [])
      .slice(0, 5)
      .map((product) => product.canonical_product_name)
      .join('; ')
    blocks.push([
      `Brand: ${row.brand}`,
      `Console display name: ${row.public_display_name}`,
      `Internal console ID/key: ${row.console_id} / ${row.console_key}`,
      `Console years: ${row.console_years}`,
      `Number of linked products: ${row.linked_product_count}`,
      `Example linked products: ${examples || '(none)'}`,
      `Recommended filename: ${row.recommended_filename}`,
      `Recommended storage path: ${row.recommended_storage_path}`,
      `Missing reason: ${row.missing_image_reason}`,
      '---',
    ].join('\n'))
  }
  return `${blocks.join('\n')}\n`
}

async function verifyStorageObject(supabase, storagePath) {
  const path = normalizeWhitespace(storagePath)
  if (!path) return null
  // Console images are primarily static public files; storage_path may point at a bucket
  // if used. Probe common bucket names without writing.
  const buckets = ['equipment-consoles', 'equipment-console-images', 'equipment-product-images']
  for (const bucket of buckets) {
    const { data, error } = await supabase.storage.from(bucket).list(
      path.includes('/') ? path.split('/').slice(0, -1).join('/') : '',
      { search: path.split('/').pop(), limit: 5 },
    )
    if (!error && Array.isArray(data) && data.some((entry) => entry.name === path.split('/').pop())) {
      return { exists: true, bucket }
    }
  }
  return { exists: false, bucket: null }
}

async function main() {
  const args = parseArgs(process.argv)
  const env = loadEnv()
  const supabaseUrl = env.VITE_SUPABASE_URL ?? env.SUPABASE_URL
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing VITE_SUPABASE_URL/SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  mkdirSync(REPORTS_DIR, { recursive: true })

  const consoleSelect = [
    'id',
    'brand',
    'console_key',
    'console_name',
    'alternative_names',
    'start_year',
    'end_year',
    'is_current',
    'image_url',
    'image_storage_path',
    'image_status',
    'display_order',
    'active',
    'source_url',
    'notes',
    'confidence',
  ].join(', ')

  const consoles = await fetchAll(supabase, 'equipment_consoles', consoleSelect, {
    brand: args.brand,
    id: args.consoleId,
    orderBy: 'brand',
  })

  // Always load full product + compat sets so link classification is accurate.
  const products = await fetchAll(
    supabase,
    'equipment_products',
    'id, brand, product_family, model, equipment_type, canonical_product_name, status',
  )
  const productsById = new Map(products.map((product) => [product.id, product]))

  const allConsolesForInvalidCheck = (!args.brand && !args.consoleId)
    ? consoles
    : await fetchAll(supabase, 'equipment_consoles', 'id')
  const allConsoleIds = new Set(allConsolesForInvalidCheck.map((row) => row.id))

  const compatRows = await fetchAll(
    supabase,
    'product_console_compat',
    [
      'id',
      'product_id',
      'console_id',
      'available_from_year',
      'available_to_year',
      'compatibility_type',
      'is_default',
      'is_active',
      'confidence',
    ].join(', '),
  )

  const invalidCompat = []
  const linksByConsoleId = new Map()
  const consolesById = new Map(consoles.map((row) => [row.id, row]))

  for (const row of compatRows) {
    if (!allConsoleIds.has(row.console_id)) {
      invalidCompat.push({
        compat_id: row.id,
        console_id: row.console_id,
        product_id: row.product_id,
        reason: 'missing_console_record',
      })
      continue
    }

    if (args.consoleId && row.console_id !== args.consoleId) continue
    if (!consolesById.has(row.console_id)) continue

    if (!linksByConsoleId.has(row.console_id)) linksByConsoleId.set(row.console_id, [])
    linksByConsoleId.get(row.console_id).push(row)
  }

  const linkedConsoleReports = []
  const missingLinked = []
  const linkedOnlyNonPublic = []
  const unlinkedConsoles = []

  for (const consoleRow of consoles) {
    const allLinks = linksByConsoleId.get(consoleRow.id) ?? []
    const activeLinks = allLinks.filter((link) => link.is_active !== false)
    const linkedProducts = []
    const nonPublicProducts = []

    for (const link of activeLinks) {
      const product = productsById.get(link.product_id)
      if (!product) {
        nonPublicProducts.push({
          product_id: link.product_id,
          reason: 'product_missing',
          link,
        })
        continue
      }
      const entry = {
        product_id: product.id,
        canonical_product_name: product.canonical_product_name,
        brand: product.brand,
        series: product.product_family,
        model: product.model,
        equipment_type: product.equipment_type,
        product_status: product.status,
        compatibility_start_year: link.available_from_year,
        compatibility_end_year: link.available_to_year,
        compatibility_type: link.compatibility_type,
      }
      if (PUBLIC_PRODUCT_STATUSES.has(product.status)) {
        linkedProducts.push(entry)
      } else {
        nonPublicProducts.push({ ...entry, reason: `product_status_${product.status}` })
      }
    }

    let storageExists = null
    if (args.verifyStorage && consoleRow.image_storage_path) {
      const probe = await verifyStorageObject(supabase, consoleRow.image_storage_path)
      storageExists = probe?.exists ?? false
    }

    const imageClass = classifyConsoleImage(consoleRow, {
      verifyStorage: args.verifyStorage,
      storageExists,
    })

    const compatFamily = classifyCompatFamily(activeLinks)
    const report = {
      console_id: consoleRow.id,
      brand: consoleRow.brand,
      console_key: consoleRow.console_key,
      public_display_name: consoleRow.console_name,
      console_generation_or_family: Array.isArray(consoleRow.alternative_names)
        ? consoleRow.alternative_names.join(', ')
        : null,
      alternative_names: consoleRow.alternative_names ?? [],
      start_year: consoleRow.start_year,
      end_year: consoleRow.end_year,
      is_current: consoleRow.is_current,
      active: consoleRow.active,
      image_url: consoleRow.image_url,
      image_storage_path: consoleRow.image_storage_path,
      image_status: consoleRow.image_status,
      has_usable_image: imageClass.hasUsableImage,
      missing_image_reason: imageClass.hasUsableImage ? null : imageClass.reason,
      image_note: imageClass.note ?? null,
      linked_product_count: linkedProducts.length,
      linked_compat_row_count: activeLinks.length,
      earliest_compatibility_year: linkedProducts.length
        ? Math.min(...linkedProducts.map((product) => Number(product.compatibility_start_year)).filter(Number.isFinite))
        : null,
      latest_compatibility_year: (() => {
        const ends = linkedProducts
          .map((product) => product.compatibility_end_year)
          .filter((value) => value != null && Number.isFinite(Number(value)))
          .map(Number)
        return ends.length ? Math.max(...ends) : null
      })(),
      compatibility_types: [...new Set(activeLinks.map((link) => link.compatibility_type))],
      primary_compatibility_type: primaryCompatType(activeLinks),
      modular_fixed_retrofit: compatFamily,
      used_by_active_public_product: linkedProducts.length > 0,
      console_years: yearsLabel(consoleRow, activeLinks),
      recommended_filename: suggestedFilename(consoleRow),
      recommended_storage_path: suggestedStoragePath(consoleRow),
      linked_products: linkedProducts,
      non_public_linked_products: nonPublicProducts,
    }

    if (linkedProducts.length > 0) {
      linkedConsoleReports.push(report)
      if (!report.has_usable_image) missingLinked.push(report)
    } else if (allLinks.length > 0 || nonPublicProducts.length > 0) {
      linkedOnlyNonPublic.push(report)
    } else {
      // Unlinked ≠ invalid. Report separately; see reports/unlinked-console-classification.*
      unlinkedConsoles.push({
        console_id: consoleRow.id,
        brand: consoleRow.brand,
        console_key: consoleRow.console_key,
        console_name: consoleRow.console_name,
        active: consoleRow.active,
        image_status: consoleRow.image_status,
        image_url: consoleRow.image_url,
        has_usable_image: imageClass.hasUsableImage,
        missing_image_reason: imageClass.hasUsableImage ? null : imageClass.reason,
        note: 'Valid master may be unlinked pending future catalogue, historic products, or intentional retrofit-only use. See unlinked-console-classification reports.',
      })
    }
  }

  const aliasConcerns = detectAliasGroups(consoles)

  // Matrix-specific checklist
  const matrixConsoles = consoles.filter((row) => /matrix/i.test(row.brand))
  const matrixByKey = new Map(matrixConsoles.map((row) => [normalizeWhitespace(row.console_key).toLowerCase(), row]))
  const matrixChecklist = MATRIX_EXPECTED_KEYS.map((key) => {
    const row = matrixByKey.get(key) ?? null
    const report = row
      ? linkedConsoleReports.find((entry) => entry.console_id === row.id)
        || linkedOnlyNonPublic.find((entry) => entry.console_id === row.id)
        || null
      : null
    return {
      expected_key: key,
      present_in_master: Boolean(row),
      console_id: row?.id ?? null,
      console_name: row?.console_name ?? null,
      linked_to_public_product: Boolean(report?.used_by_active_public_product),
      has_usable_image: report ? report.has_usable_image : (row ? classifyConsoleImage(row).hasUsableImage : false),
      image_url: row?.image_url ?? null,
      image_status: row?.image_status ?? null,
      representation: key.startsWith('onyx_')
        ? (row
          ? (report?.modular_fixed_retrofit === 'fixed'
            ? 'console_record_fixed_compat'
            : 'console_record_present')
          : 'neither_in_master')
        : (row ? 'console_record' : 'missing_from_master'),
    }
  })

  const withImages = linkedConsoleReports.filter((row) => row.has_usable_image)
  const coveragePercent = linkedConsoleReports.length
    ? Math.round((withImages.length / linkedConsoleReports.length) * 1000) / 10
    : 0

  const summary = {
    total_console_records: consoles.length,
    total_consoles_linked_to_public_product: linkedConsoleReports.length,
    linked_consoles_with_usable_images: withImages.length,
    linked_consoles_missing_images: missingLinked.length,
    coverage_percent: coveragePercent,
    missing_by_brand: countBy(missingLinked, (row) => row.brand),
    missing_by_modular_fixed_retrofit: countBy(missingLinked, (row) => row.modular_fixed_retrofit),
    unlinked_consoles: unlinkedConsoles.length,
    unlinked_consoles_without_usable_image: unlinkedConsoles.filter((row) => !row.has_usable_image).length,
    consoles_linked_only_to_non_public_products: linkedOnlyNonPublic.length,
    invalid_compat_rows: invalidCompat.length,
    duplicate_or_alias_groups: aliasConcerns.length,
    note_unlinked:
      'Unlinked consoles are not treated as invalid or obsolete. Classify via scripts/repair-console-aliases-and-links.mjs.',
  }

  const schemaFindings = {
    console_master_table: 'equipment_consoles',
    compatibility_table: 'product_console_compat',
    foreign_keys: {
      product_console_compat_product_id: 'equipment_products.id',
      product_console_compat_console_id: 'equipment_consoles.id',
    },
    image_columns_on_equipment_consoles: [
      'image_url',
      'image_storage_path',
      'image_status',
    ],
    separate_console_image_table: false,
    image_status_values: ['none', 'pending', 'approved', 'rejected'],
    public_page_usable_rule:
      'buildProductConsoleImageMap uses equipment_consoles.image_url (via compat join). image_storage_path and image_status are not currently checked by the public UI.',
    storage_and_url_both_supported_in_schema: true,
    static_public_convention: '/equipment-console-images/{brand-slug}/[normalized/]{filename}',
    fixed_integrated_displays:
      'Represented as equipment_consoles rows with product_console_compat.compatibility_type = fixed (e.g. Matrix onyx_22 / onyx_32).',
  }

  const audit = {
    generated_at: new Date().toISOString(),
    read_only: true,
    args,
    schema_findings: schemaFindings,
    summary,
    matrix_checklist: matrixChecklist,
    missing_linked_consoles: missingLinked,
    linked_consoles_with_images: withImages.map((row) => ({
      console_id: row.console_id,
      brand: row.brand,
      console_key: row.console_key,
      public_display_name: row.public_display_name,
      image_url: row.image_url,
      image_storage_path: row.image_storage_path,
      image_status: row.image_status,
      linked_product_count: row.linked_product_count,
      modular_fixed_retrofit: row.modular_fixed_retrofit,
    })),
    unlinked_consoles: unlinkedConsoles,
    unlinked_classification_report: 'reports/unlinked-console-classification.json',
    alias_migration_plan: 'reports/console-alias-migration-plan.json',
    compatibility_gaps_report: 'reports/console-compatibility-gaps.json',
    consoles_linked_only_to_non_public_products: linkedOnlyNonPublic.map((row) => ({
      console_id: row.console_id,
      brand: row.brand,
      console_key: row.console_key,
      console_name: row.public_display_name,
      image_status: row.image_status,
      has_usable_image: row.has_usable_image,
      non_public_linked_count: row.non_public_linked_products.length,
    })),
    invalid_compatibility_rows: invalidCompat,
    duplicate_or_alias_concerns: aliasConcerns,
    all_linked_console_rows: linkedConsoleReports,
  }

  writeFileSync(JSON_PATH, `${JSON.stringify(audit, null, 2)}\n`)

  writeCsv(
    CSV_PATH,
    [
      'console_id',
      'brand',
      'console_key',
      'public_display_name',
      'console_generation_or_family',
      'image_url',
      'image_storage_path',
      'image_status',
      'has_usable_image',
      'missing_image_reason',
      'linked_product_count',
      'earliest_compatibility_year',
      'latest_compatibility_year',
      'compatibility_types',
      'modular_fixed_retrofit',
      'used_by_active_public_product',
      'example_products',
      'recommended_filename',
      'recommended_storage_path',
    ],
    linkedConsoleReports.map((row) => ({
      ...row,
      compatibility_types: (row.compatibility_types ?? []).join('|'),
      example_products: (row.linked_products ?? [])
        .slice(0, 5)
        .map((product) => product.canonical_product_name)
        .join('; '),
    })),
  )

  writeCsv(
    MANIFEST_PATH,
    [
      'console_id',
      'brand',
      'console_key',
      'display_name',
      'linked_product_count',
      'example_products',
      'suggested_filename',
      'suggested_storage_path',
      'local_file_path',
      'source_url',
      'notes',
    ],
    missingLinked.map((row) => ({
      console_id: row.console_id,
      brand: row.brand,
      console_key: row.console_key,
      display_name: row.public_display_name,
      linked_product_count: row.linked_product_count,
      example_products: (row.linked_products ?? [])
        .slice(0, 5)
        .map((product) => product.canonical_product_name)
        .join('; '),
      suggested_filename: row.recommended_filename,
      suggested_storage_path: row.recommended_storage_path,
      local_file_path: '',
      source_url: '',
      notes: row.missing_image_reason ?? '',
    })),
  )

  writeFileSync(HUMAN_PATH, buildHumanList(missingLinked))

  console.log('Schema:', schemaFindings.console_master_table, '+', schemaFindings.compatibility_table)
  console.log('Summary:', summary)
  console.log('Missing by brand:', summary.missing_by_brand)
  console.log('Matrix checklist:')
  for (const entry of matrixChecklist) {
    console.log([
      entry.expected_key,
      entry.present_in_master ? 'in_master' : 'MISSING_MASTER',
      entry.linked_to_public_product ? `linked(${entry.has_usable_image ? 'has_image' : 'NO_IMAGE'})` : 'unlinked',
      entry.representation,
    ].join(' | '))
  }
  console.log(`Wrote ${JSON_PATH}`)
  console.log(`Wrote ${CSV_PATH}`)
  console.log(`Wrote ${MANIFEST_PATH}`)
  console.log(`Wrote ${HUMAN_PATH}`)
  console.log('No database changes were made.')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
