#!/usr/bin/env node
/**
 * Dry-run and apply canonical brand onboarding for Concept2, Hammer Strength, etc.
 *
 * Usage:
 *   node scripts/onboard-canonical-brands.mjs --dry-run
 *   node scripts/onboard-canonical-brands.mjs --brand "Concept2" --dry-run
 *   node scripts/onboard-canonical-brands.mjs --brand "Hammer Strength" --dry-run --out reports/hammer-strength-onboard.json
 *   node scripts/onboard-canonical-brands.mjs --apply --import-intelligence --repair-intelligence-types
 *   node scripts/onboard-canonical-brands.mjs --brand "Matrix Fitness" --created-since 2026-07-10T16:42:00Z --created-until 2026-07-10T16:43:00Z --dry-run
 *   node scripts/onboard-canonical-brands.mjs --brand "Matrix Fitness" --created-since 2026-07-10T16:42:00Z --created-until 2026-07-10T16:43:00Z --apply --approve-safe
 *
 * Phases when --apply:
 *   1. --import-intelligence   Import planned catalogue rows (Concept2) + skip existing slugs
 *   2. --repair-intelligence-types  Fix obvious equipment_type mistakes on intelligence rows
 *   3. Canonical upsert via apply-canonical-products-by-brand logic
 *   4. --approve-safe          Approve safe + single-source candidates
 *   5. --repair                Merge console duplicate products (usually N/A for these brands)
 */

import { createClient } from '@supabase/supabase-js'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import {
  buildBrandOnboardReport,
  DEFAULT_ONBOARD_BRANDS,
  loadPlannedIntelligenceCatalogue,
  printBrandOnboardReport,
  proposeIntelligenceEquipmentTypeRepairs,
} from '../src/lib/canonicalBrandOnboard.js'
import {
  buildCanonicalProductAuditReport,
  PRODUCT_STATUS,
} from '../src/lib/intelligenceCanonicalProducts.js'
import { buildActiveBrandNameSet } from '../src/lib/equipmentResearchQueue.js'

const INTELLIGENCE_SELECT = [
  'id',
  'brand',
  'series',
  'model',
  'equipment_type',
  'slug',
  'product_family',
  'original_rrp',
  'currency',
  'confidence',
  'manufacture_year',
  'best_original_price',
  'best_original_price_confidence',
  'best_original_price_currency',
  'baseline_manufacture_year',
  'manufacture_start_year',
  'manufacture_end_year',
  'variant_name',
  'core_product_group_status',
  'core_product_group_confidence',
  'created_at',
  'updated_at',
].join(', ')

const APPROVED_PRODUCT_FIELDS = [
  'id',
  'brand',
  'product_family',
  'model',
  'equipment_type',
  'canonical_product_name',
  'canonical_product_key',
  'baseline_manufacture_year',
  'production_start_year',
  'production_end_year',
  'original_base_price',
  'original_base_price_currency',
  'original_price_confidence',
  'source_intelligence_row_ids',
  'status',
  'image_url',
  'image_storage_path',
  'image_status',
].join(', ')

function loadEnv() {
  const path = join(process.cwd(), '.env.local')
  const text = readFileSync(path, 'utf8')
  const env = {}
  for (const line of text.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const idx = trimmed.indexOf('=')
    if (idx === -1) continue
    env[trimmed.slice(0, idx)] = trimmed.slice(idx + 1)
  }
  return env
}

function parseArgs(argv) {
  const args = {
    brands: [...DEFAULT_ONBOARD_BRANDS],
    brandsFromCli: false,
    dryRun: true,
    apply: false,
    importIntelligence: false,
    repairIntelligenceTypes: false,
    approveSafe: false,
    repair: false,
    createdSince: null,
    createdUntil: null,
    out: null,
  }

  for (let index = 2; index < argv.length; index += 1) {
    const token = argv[index]
    if (token === '--dry-run') args.dryRun = true
    else if (token === '--apply') {
      args.apply = true
      args.dryRun = false
    } else if (token === '--import-intelligence') args.importIntelligence = true
    else if (token === '--repair-intelligence-types') args.repairIntelligenceTypes = true
    else if (token === '--approve-safe') args.approveSafe = true
    else if (token === '--repair') args.repair = true
    else if (token === '--created-since') {
      args.createdSince = argv[index + 1] ?? null
      index += 1
    } else if (token === '--created-until') {
      args.createdUntil = argv[index + 1] ?? null
      index += 1
    } else if (token === '--brand') {
      const brand = argv[index + 1] ?? null
      index += 1
      if (!brand) continue
      if (!args.brandsFromCli) {
        args.brands = []
        args.brandsFromCli = true
      }
      args.brands.push(brand)
    } else if (token === '--out') {
      args.out = argv[index + 1] ?? null
      index += 1
    }
  }

  return args
}

async function fetchIntelligenceRows(supabase, brand, { createdSince = null, createdUntil = null } = {}) {
  const pageSize = 1000
  let from = 0
  const rows = []

  while (true) {
    let query = supabase
      .from('equipment_intelligence')
      .select(INTELLIGENCE_SELECT)
      .ilike('brand', brand)
      .order('model')
      .range(from, from + pageSize - 1)

    if (createdSince) query = query.gte('created_at', createdSince)
    if (createdUntil) query = query.lte('created_at', createdUntil)

    const { data, error } = await query

    if (error) throw error
    if (!data?.length) break
    rows.push(...data)
    if (data.length < pageSize) break
    from += pageSize
  }

  return rows
}

async function fetchProducts(supabase, brand) {
  const { data, error } = await supabase
    .from('equipment_products')
    .select('id, brand, canonical_product_name, canonical_product_key, status, original_base_price, baseline_manufacture_year, image_url, image_storage_path, image_status, source_intelligence_row_ids')
    .ilike('brand', brand)
    .order('canonical_product_name')

  if (error) throw error
  return data ?? []
}

async function fetchAllApprovedProducts(supabase) {
  const pageSize = 1000
  let from = 0
  const products = []

  while (true) {
    const { data, error } = await supabase
      .from('equipment_products')
      .select(APPROVED_PRODUCT_FIELDS)
      .eq('status', PRODUCT_STATUS.APPROVED)
      .order('brand')
      .order('canonical_product_name')
      .range(from, from + pageSize - 1)

    if (error) throw error
    if (!data?.length) break
    products.push(...data)
    if (data.length < pageSize) break
    from += pageSize
  }

  return products
}

async function fetchBrandNames(supabase) {
  const { data, error } = await supabase.from('brands').select('name').order('name')
  if (error) throw error
  return data ?? []
}

async function fetchExistingSlugs(supabase, slugs) {
  if (!slugs.length) return new Set()

  const existing = new Set()
  const chunkSize = 100
  for (let index = 0; index < slugs.length; index += chunkSize) {
    const chunk = slugs.slice(index, index + chunkSize)
    const { data, error } = await supabase
      .from('equipment_intelligence')
      .select('slug')
      .in('slug', chunk)

    if (error) throw error
    for (const row of data ?? []) {
      if (row.slug) existing.add(row.slug)
    }
  }

  return existing
}

async function importPlannedCatalogue(supabase, brand) {
  const catalogue = loadPlannedIntelligenceCatalogue(brand)
  if (!catalogue.rows.length) {
    return { inserted: 0, skipped: 0, source: null }
  }

  const slugs = catalogue.rows.map((row) => row.slug).filter(Boolean)
  const existingSlugs = await fetchExistingSlugs(supabase, slugs)
  const toInsert = catalogue.rows.filter((row) => !existingSlugs.has(row.slug))

  if (!toInsert.length) {
    return { inserted: 0, skipped: catalogue.rows.length, source: catalogue.source }
  }

  const payload = toInsert.map((row) => ({
    brand: row.brand,
    series: row.series,
    model: row.model,
    category: row.category,
    equipment_type: row.equipment_type,
    manufacture_year: row.baseline_manufacture_year,
    original_rrp: row.original_rrp,
    baseline_manufacture_year: row.baseline_manufacture_year,
    manufacture_start_year: row.manufacture_start_year,
    currency: row.currency ?? 'GBP',
    confidence: 'High',
    slug: row.slug,
    best_original_price: row.best_original_price,
    best_original_price_confidence: row.best_original_price_confidence,
    best_original_price_currency: row.currency ?? 'GBP',
  }))

  const { error } = await supabase
    .from('equipment_intelligence')
    .insert(payload)

  if (error) throw error

  return {
    inserted: payload.length,
    skipped: catalogue.rows.length - payload.length,
    source: catalogue.source,
  }
}

async function repairIntelligenceEquipmentTypes(supabase, brand, rows) {
  const repairs = proposeIntelligenceEquipmentTypeRepairs(rows)
  let updated = 0

  for (const repair of repairs) {
    const { error } = await supabase
      .from('equipment_intelligence')
      .update({ equipment_type: repair.after })
      .eq('id', repair.id)

    if (error) throw error
    updated += 1
  }

  return { updated, repairs }
}

async function applyCanonicalProducts(supabase, brand, intelligenceRows) {
  const audit = buildCanonicalProductAuditReport(intelligenceRows, { brandFilter: brand })
  let upserted = 0

  for (const product of audit.products) {
    const { data: existing, error: existingError } = await supabase
      .from('equipment_products')
      .select('id, status, source_intelligence_row_ids, original_base_price, original_price_confidence, baseline_manufacture_year, review_notes')
      .eq('canonical_product_key', product.canonical_product_key)
      .maybeSingle()

    if (existingError) throw existingError

    const mergedIds = [
      ...new Set([
        ...(existing?.source_intelligence_row_ids ?? []),
        ...(product.source_intelligence_row_ids ?? []),
      ]),
    ]

    const reviewNotes = product.review_reasons?.length
      ? product.review_reasons.join('; ')
      : null

    const row = {
      brand: product.brand,
      product_family: product.product_family || null,
      model: product.model,
      equipment_type: product.equipment_type || null,
      canonical_product_name: product.canonical_product_name,
      canonical_product_key: product.canonical_product_key,
      baseline_manufacture_year: product.baseline_manufacture_year ?? null,
      production_start_year: product.production_start_year ?? null,
      production_end_year: product.production_end_year ?? null,
      original_base_price: product.original_base_price ?? null,
      original_base_price_currency: product.original_base_price_currency ?? 'GBP',
      original_price_confidence: product.original_price_confidence ?? null,
      lifecycle_confidence: null,
      source_intelligence_row_ids: mergedIds,
      status: existing?.status === PRODUCT_STATUS.EXCLUDED
        ? PRODUCT_STATUS.EXCLUDED
        : (product.status ?? PRODUCT_STATUS.PENDING),
      review_notes: reviewNotes,
    }

    if (existing?.id) {
      const { error } = await supabase
        .from('equipment_products')
        .update({
          ...row,
          status: existing.status === PRODUCT_STATUS.EXCLUDED ? PRODUCT_STATUS.EXCLUDED : row.status,
          review_notes: reviewNotes ?? existing.review_notes,
          baseline_manufacture_year: existing.baseline_manufacture_year ?? row.baseline_manufacture_year,
          production_start_year: existing.production_start_year ?? row.production_start_year,
          production_end_year: existing.production_end_year ?? row.production_end_year,
          original_base_price: existing.original_base_price ?? row.original_base_price,
          original_price_confidence: existing.original_price_confidence ?? row.original_price_confidence,
          equipment_type: row.equipment_type ?? existing.equipment_type,
        })
        .eq('id', existing.id)
      if (error) throw error
    } else {
      const { error } = await supabase.from('equipment_products').insert(row)
      if (error) throw error
    }

    upserted += 1
  }

  return upserted
}

async function processBrand(supabase, brand, args) {
  let intelligenceRows = await fetchIntelligenceRows(supabase, brand, {
    createdSince: args.createdSince,
    createdUntil: args.createdUntil,
  })
  if (args.createdSince || args.createdUntil) {
    console.log(
      `[${brand}] Filtered intelligence rows by created_at`
      + `${args.createdSince ? ` >= ${args.createdSince}` : ''}`
      + `${args.createdUntil ? ` <= ${args.createdUntil}` : ''}`
      + ` → ${intelligenceRows.length} row(s)`,
    )
  }
  const equipmentProducts = await fetchProducts(supabase, brand)
  const [allApprovedProducts, brandNames] = await Promise.all([
    fetchAllApprovedProducts(supabase),
    fetchBrandNames(supabase),
  ])
  const activeBrands = buildActiveBrandNameSet({
    brands: brandNames,
    products: allApprovedProducts,
  })

  let plannedImport = false
  let catalogueSource = null

  if (!intelligenceRows.length) {
    try {
      const catalogue = loadPlannedIntelligenceCatalogue(brand)
      if (catalogue.rows.length) {
        intelligenceRows = catalogue.rows
        plannedImport = true
        catalogueSource = catalogue.source
      }
    } catch (error) {
      if (!String(error.message ?? '').includes('catalogue')) throw error
    }
  }

  if (args.apply && args.importIntelligence) {
    const imported = await importPlannedCatalogue(supabase, brand)
    console.log(`\n[${brand}] Imported ${imported.inserted} intelligence row(s), skipped ${imported.skipped}.`)
    intelligenceRows = await fetchIntelligenceRows(supabase, brand, {
      createdSince: args.createdSince,
      createdUntil: args.createdUntil,
    })
    plannedImport = false
    catalogueSource = imported.source
  }

  if (args.apply && args.repairIntelligenceTypes) {
    const repair = await repairIntelligenceEquipmentTypes(supabase, brand, intelligenceRows)
    console.log(`[${brand}] Repaired ${repair.updated} intelligence equipment_type value(s).`)
    intelligenceRows = await fetchIntelligenceRows(supabase, brand, {
      createdSince: args.createdSince,
      createdUntil: args.createdUntil,
    })
  }

  const report = buildBrandOnboardReport({
    brand,
    intelligenceRows,
    equipmentProducts: args.apply ? await fetchProducts(supabase, brand) : equipmentProducts,
    catalogueSource,
    plannedImport,
    existingApprovedProducts: allApprovedProducts,
    activeBrands,
  })

  printBrandOnboardReport(report)

  if (args.apply) {
    const upserted = await applyCanonicalProducts(supabase, brand, intelligenceRows)
    console.log(`[${brand}] Upserted ${upserted} canonical equipment_product row(s).`)
  }

  if (args.apply && (args.approveSafe || args.repair)) {
    const { spawnSync } = await import('node:child_process')
    // Canonical upsert already ran above. Do not pass --apply here — that would
    // reprocess the full brand intelligence set and can rewrite unrelated products.
    const flags = ['--brand', brand]
    if (args.approveSafe) flags.push('--approve-safe')
    if (args.repair) flags.push('--repair')
    const child = spawnSync(process.execPath, ['scripts/apply-canonical-products-by-brand.mjs', ...flags], {
      cwd: process.cwd(),
      stdio: 'inherit',
      env: process.env,
    })
    if (child.status !== 0) {
      throw new Error(`apply-canonical-products-by-brand failed for ${brand}`)
    }
  }

  return report
}

async function main() {
  const args = parseArgs(process.argv)
  const env = loadEnv()
  const supabaseUrl = env.VITE_SUPABASE_URL ?? env.SUPABASE_URL
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required in .env.local')
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  console.log(args.dryRun ? 'DRY RUN — canonical brand onboarding report' : 'APPLY — canonical brand onboarding')
  console.log(`Brands: ${args.brands.join(', ')}`)

  const reports = []
  for (const brand of args.brands) {
    reports.push(await processBrand(supabase, brand, args))
  }

  const stamp = new Date().toISOString().slice(0, 10)
  const outPath = args.out ?? `reports/canonical-onboard-${stamp}.json`
  mkdirSync(dirname(join(process.cwd(), outPath)), { recursive: true })
  writeFileSync(join(process.cwd(), outPath), `${JSON.stringify({ generated_at: new Date().toISOString(), mode: args.dryRun ? 'dry-run' : 'apply', brands: reports }, null, 2)}\n`)
  console.log(`\nReport written to ${outPath}`)

  if (args.dryRun) {
    console.log('\nDry-run complete — no database changes made.')
    console.log('After approval, apply with:')
    console.log('  node scripts/onboard-canonical-brands.mjs --apply --import-intelligence --repair-intelligence-types --approve-safe')
    console.log('Then run image backfill:')
    console.log('  node scripts/backfill-equipment-product-images.mjs --brand "Concept2" --complete-only --apply')
    console.log('  node scripts/backfill-equipment-product-images.mjs --brand "Hammer Strength" --missing-only --apply')
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
