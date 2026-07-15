#!/usr/bin/env node
/**
 * Import manual console images from design-reference into equipment_consoles
 * using the missing-linked-console-images manifest (console_id matching).
 *
 * Usage:
 *   node scripts/import-console-images-from-manifest.mjs --dry-run
 *   node scripts/import-console-images-from-manifest.mjs --apply
 */

import { createClient } from '@supabase/supabase-js'
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs'
import { basename, extname, join } from 'node:path'
import sharp from 'sharp'

const REPORTS_DIR = join(process.cwd(), 'reports')
const MANIFEST_PATH = join(REPORTS_DIR, 'missing-linked-console-images-manifest.csv')
const SOURCE_DIR = join(process.cwd(), 'public', 'design-reference')
const PUBLIC_CONSOLE_ROOT = join(process.cwd(), 'public', 'equipment-console-images')

const CANVAS_WIDTH = 400
const CANVAS_HEIGHT = 260
const MAX_CONTENT_WIDTH = 360
const MAX_CONTENT_HEIGHT = 220
const TRIM_THRESHOLD = 12

/**
 * High-confidence filename → console_id mappings.
 * console_id values come from reports/missing-linked-console-images-manifest.csv.
 */
const FILENAME_TO_CONSOLE_ID = {
  'pm2.webp': '78f633cd-1a40-4bf4-9e6b-de3a14f01302',
  'pm2+.webp': '13c3d724-89d5-4ae0-ada8-3c06e6f60857',
  'Pm3.webp': '845009ba-0d6e-4b0c-be32-ca24b3c187b5',
  'pm4.webp': '5a5b103d-cb5e-4894-b6d0-dcba266f805a',
  'pm5.webp': 'c1cc7131-a65b-46ad-b3fb-e9289ea69152',
  'cybex go.png': 'f03ea1c4-9eab-434b-913a-1f8cb4f9d14c',
  'cybex e3 view.png': 'ae1d3df1-4a67-499a-b93e-3eca2e5f72ea',
  'Cybex LED.png': '942ae9bd-ed1c-4d3d-bcb9-a54c8280c6ee',
  'matrix onyx 22.jpg': '99a87a2e-52c9-4284-9cf9-e02209c44d7f',
  'matrix onyx 32.jpg': '02c1232e-6762-494b-9c85-11267e0db430',
  'wattbike A monitor.webp': '24041e92-ea45-4cdb-8c53-e244dff0bec8',
  'wattbike B monitor.jpg': '09288729-5895-4c6a-9416-03c3189bf14a',
  'wattbike performance touch .jpg': '770375b8-fd88-4dc9-abfe-231f842ab03c',
  'woodway led.jpg': '6a146faa-873c-4ea2-9dd1-78b75fe49883',
  'woodway personal trainer.webp': '4698a2e8-9544-4596-a976-684acce353db',
  'woodway pro smart.webp': '69b61c43-1ba7-4672-87ff-bdd22eb9c5e0',
  'woodway quickset.webp': '16339d6f-3d60-43ca-8e28-cc8dc846e29e',
  // Filename explicitly identifies FTG screen; maps to Curve FTG Standard Display.
  'ww-ftg-screen-front.jpg': 'e587ba09-df73-464e-8695-9cbd47ed995a',
  'LF Achieve.jpg': '6858b9b0-dd4e-4cb7-a852-8942488b6976',
  'LF Engage.jpg': 'b79d8659-38c1-4bff-a1b2-3f8540176f63',
  'LF Inspire.jpg': '3b41bc1d-cab4-4db6-9c75-2a9867ab8b49',
}

/** Known design-reference console-ish files intentionally not imported this run. */
const INTENTIONALLY_UNMATCHED = {
  'woodway pro mart touchscreen.webp':
    'Ambiguous filename (likely typo of ProSmart). Prefer woodway pro smart.webp. Not imported.',
  'Matrix LED.webp': 'Already has approved console image; not in this missing-import batch.',
  'Matrix Touch.png': 'Already has approved console image; not in this missing-import batch.',
  'Matrix Touch XL.png': 'Already has approved console image; not in this missing-import batch.',
}

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
  const args = { dryRun: true, apply: false }
  for (const token of argv.slice(2)) {
    if (token === '--apply') {
      args.apply = true
      args.dryRun = false
    } else if (token === '--dry-run') {
      args.dryRun = true
      args.apply = false
    }
  }
  return args
}

function parseManifestCsv(text) {
  const lines = text.trim().split(/\r?\n/)
  const headers = lines[0].split(',')
  const rows = []
  for (const line of lines.slice(1)) {
    if (!line.trim()) continue
    const cells = []
    let current = ''
    let inQuotes = false
    for (let i = 0; i < line.length; i += 1) {
      const ch = line[i]
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"'
          i += 1
        } else {
          inQuotes = !inQuotes
        }
      } else if (ch === ',' && !inQuotes) {
        cells.push(current)
        current = ''
      } else {
        current += ch
      }
    }
    cells.push(current)
    const row = {}
    headers.forEach((header, index) => {
      row[header] = cells[index] ?? ''
    })
    rows.push(row)
  }
  return rows
}

function brandSlug(brand) {
  return String(brand ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'unknown-brand'
}

function consoleKeySlug(consoleKey) {
  return String(consoleKey ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'unknown-console'
}

function resolveStaticPath(imageUrl) {
  const text = String(imageUrl ?? '').trim()
  if (!text) return null
  let relative = text
  if (/^https?:\/\//i.test(text)) {
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
  try {
    relative = decodeURIComponent(relative)
  } catch {
    // keep raw
  }
  return join(process.cwd(), 'public', relative)
}

function hasUsableApprovedImage(consoleRow) {
  if (String(consoleRow.image_status || '').toLowerCase() !== 'approved') return false
  const url = String(consoleRow.image_url || '').trim()
  const storage = String(consoleRow.image_storage_path || '').trim()
  if (!url && !storage) return false
  if (url) {
    const local = resolveStaticPath(url)
    if (local && existsSync(local)) return true
    if (local && !existsSync(local)) return false
    // Non-static URL — treat as usable if present
    if (/^https?:\/\//i.test(url)) return true
  }
  return Boolean(storage)
}

async function normalizeToFile(sourcePath, outputPath) {
  const extension = extname(sourcePath).toLowerCase()
  const trimmed = await sharp(sourcePath, { failOn: 'none' })
    .trim({ threshold: TRIM_THRESHOLD })
    .toBuffer({ resolveWithObject: true })

  const resized = await sharp(trimmed.data, { failOn: 'none' })
    .resize(MAX_CONTENT_WIDTH, MAX_CONTENT_HEIGHT, {
      fit: 'inside',
      withoutEnlargement: false,
    })
    .toBuffer({ resolveWithObject: true })

  const left = Math.max(0, Math.round((CANVAS_WIDTH - resized.info.width) / 2))
  const top = Math.max(0, Math.round((CANVAS_HEIGHT - resized.info.height) / 2))

  let pipeline = sharp({
    create: {
      width: CANVAS_WIDTH,
      height: CANVAS_HEIGHT,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 0 },
    },
  }).composite([{ input: resized.data, left, top }])

  if (extension === '.png') pipeline = pipeline.png()
  else if (extension === '.webp') pipeline = pipeline.webp({ quality: 90 })
  else pipeline = pipeline.jpeg({ quality: 92 })

  await pipeline.toFile(outputPath)
}

async function main() {
  const args = parseArgs(process.argv)
  const env = loadEnv()
  const supabase = createClient(
    env.VITE_SUPABASE_URL || env.SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )

  mkdirSync(REPORTS_DIR, { recursive: true })

  const manifest = parseManifestCsv(readFileSync(MANIFEST_PATH, 'utf8'))
  const manifestById = new Map(manifest.map((row) => [row.console_id, row]))

  const consoleIds = [...new Set(Object.values(FILENAME_TO_CONSOLE_ID))]
  const { data: consoles, error } = await supabase
    .from('equipment_consoles')
    .select('id, brand, console_key, console_name, image_url, image_storage_path, image_status, active')
    .in('id', consoleIds)
  if (error) throw error
  const consolesById = new Map((consoles ?? []).map((row) => [row.id, row]))

  const mappings = []
  const unmatched = []
  const skipped = []

  for (const [filename, consoleId] of Object.entries(FILENAME_TO_CONSOLE_ID)) {
    const sourcePath = join(SOURCE_DIR, filename)
    const consoleRow = consolesById.get(consoleId)
    const manifestRow = manifestById.get(consoleId)

    if (!existsSync(sourcePath)) {
      unmatched.push({ filename, reason: 'source_file_missing', console_id: consoleId })
      continue
    }
    if (!consoleRow) {
      unmatched.push({ filename, reason: 'console_id_not_found_in_db', console_id: consoleId })
      continue
    }

    const brand = brandSlug(consoleRow.brand)
    const key = consoleKeySlug(consoleRow.console_key)
    const ext = extname(filename).toLowerCase() || '.jpg'
    const destFilename = `${key}${ext}`
    const brandDir = join(PUBLIC_CONSOLE_ROOT, brand)
    const normalizedDir = join(brandDir, 'normalized')
    const rawDest = join(brandDir, destFilename)
    const normalizedDest = join(normalizedDir, destFilename)
    const imageUrl = `/equipment-console-images/${brand}/normalized/${destFilename}`
    const imageStoragePath = `equipment-console-images/${brand}/normalized/${destFilename}`

    const usableApproved = hasUsableApprovedImage(consoleRow)
    if (usableApproved) {
      skipped.push({
        filename,
        console_id: consoleId,
        brand: consoleRow.brand,
        console_key: consoleRow.console_key,
        console_name: consoleRow.console_name,
        reason: 'existing_approved_usable_image',
        existing_image_url: consoleRow.image_url,
      })
      continue
    }

    mappings.push({
      filename,
      source_path: sourcePath,
      console_id: consoleId,
      brand: consoleRow.brand,
      console_key: consoleRow.console_key,
      console_name: consoleRow.console_name,
      manifest_display_name: manifestRow?.display_name || null,
      image_url: imageUrl,
      image_storage_path: imageStoragePath,
      raw_dest: rawDest,
      normalized_dest: normalizedDest,
      previous_image_status: consoleRow.image_status,
      previous_image_url: consoleRow.image_url,
      action: 'import_and_approve',
    })
  }

  for (const [filename, reason] of Object.entries(INTENTIONALLY_UNMATCHED)) {
    const sourcePath = join(SOURCE_DIR, filename)
    if (existsSync(sourcePath)) {
      unmatched.push({ filename, reason, console_id: null })
    }
  }

  async function fetchAll(table, select) {
    const pageSize = 1000
    const rows = []
    for (let from = 0; ; from += pageSize) {
      const { data, error: pageError } = await supabase
        .from(table)
        .select(select)
        .range(from, from + pageSize - 1)
      if (pageError) throw pageError
      rows.push(...(data ?? []))
      if ((data ?? []).length < pageSize) break
    }
    return rows
  }

  // Coverage snapshot before
  const allConsoles = await fetchAll(
    'equipment_consoles',
    'id, brand, console_key, console_name, image_url, image_storage_path, image_status, active',
  )
  const compat = await fetchAll('product_console_compat', 'console_id, product_id, is_active')
  const products = await fetchAll('equipment_products', 'id, status')
  const approvedProductIds = new Set(
    products.filter((row) => row.status === 'approved').map((row) => row.id),
  )
  const linkedConsoleIds = new Set(
    compat
      .filter((row) => row.is_active !== false && approvedProductIds.has(row.product_id))
      .map((row) => row.console_id),
  )

  function linkedMissingCount(consoleList) {
    let linked = 0
    let missing = 0
    for (const row of consoleList) {
      if (!linkedConsoleIds.has(row.id)) continue
      linked += 1
      if (!hasUsableApprovedImage(row)) missing += 1
    }
    return { linked, missing, with_image: linked - missing }
  }

  const beforeCoverage = linkedMissingCount(allConsoles)

  const plan = {
    generated_at: new Date().toISOString(),
    mode: args.dryRun ? 'dry-run' : 'apply',
    mapping_table: mappings.map((row) => ({
      filename: row.filename,
      console_record: `${row.brand} / ${row.console_name} (${row.console_key})`,
      console_id: row.console_id,
      image_url: row.image_url,
    })),
    will_import: mappings,
    skipped,
    unmatched,
    coverage_before: beforeCoverage,
  }

  writeFileSync(
    join(REPORTS_DIR, 'import-console-images-plan.json'),
    `${JSON.stringify(plan, null, 2)}\n`,
  )

  console.log(`Mode: ${args.dryRun ? 'dry-run' : 'apply'}`)
  console.log('\nFilename → Console record → Console ID')
  console.log('----------------------------------------')
  for (const row of plan.mapping_table) {
    console.log(`${row.filename}`)
    console.log(`  → ${row.console_record}`)
    console.log(`  → ${row.console_id}`)
    console.log(`  → ${row.image_url}`)
  }
  console.log(`\nWill import: ${mappings.length}`)
  console.log(`Skipped: ${skipped.length}`)
  console.log(`Unmatched / not imported: ${unmatched.length}`)
  for (const row of unmatched) {
    console.log(`  - ${row.filename}: ${row.reason}`)
  }
  console.log('Coverage before (linked public):', beforeCoverage)
  console.log(`Wrote reports/import-console-images-plan.json`)

  if (args.dryRun) {
    console.log('\nDry-run only. Re-run with --apply to copy files and update equipment_consoles.')
    return
  }

  const updated = []
  for (const row of mappings) {
    mkdirSync(join(row.raw_dest, '..'), { recursive: true })
    mkdirSync(join(row.normalized_dest, '..'), { recursive: true })
    copyFileSync(row.source_path, row.raw_dest)
    await normalizeToFile(row.source_path, row.normalized_dest)

    const { error: updateError } = await supabase
      .from('equipment_consoles')
      .update({
        image_url: row.image_url,
        image_storage_path: row.image_storage_path,
        image_status: 'approved',
        updated_at: new Date().toISOString(),
      })
      .eq('id', row.console_id)
    if (updateError) throw updateError
    updated.push(row)
  }

  const afterConsoles = await fetchAll(
    'equipment_consoles',
    'id, brand, console_key, console_name, image_url, image_storage_path, image_status, active',
  )
  const afterCoverage = linkedMissingCount(afterConsoles)

  const applyReport = {
    generated_at: new Date().toISOString(),
    updated: updated.map((row) => ({
      filename: row.filename,
      console_id: row.console_id,
      brand: row.brand,
      console_key: row.console_key,
      console_name: row.console_name,
      image_url: row.image_url,
      image_storage_path: row.image_storage_path,
    })),
    skipped,
    unmatched,
    coverage_before: beforeCoverage,
    coverage_after: afterCoverage,
  }
  writeFileSync(
    join(REPORTS_DIR, 'import-console-images-apply.json'),
    `${JSON.stringify(applyReport, null, 2)}\n`,
  )
  console.log(`\nUpdated ${updated.length} consoles.`)
  console.log('Coverage after (linked public):', afterCoverage)
  console.log('Wrote reports/import-console-images-apply.json')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
