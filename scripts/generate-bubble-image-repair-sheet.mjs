#!/usr/bin/env node
/**
 * Build a repair spreadsheet from the Bubble export with Supabase image status.
 *
 * Usage:
 *   node scripts/generate-bubble-image-repair-sheet.mjs
 *
 * Outputs:
 *   public/design-reference/export_All-Equipment-image-repair.csv
 *   public/design-reference/export_All-Equipment-image-repair.xlsx  (row highlighting)
 */

import { createClient } from '@supabase/supabase-js'
import ExcelJS from 'exceljs'
import { existsSync, readFileSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import {
  classifyImageUrl,
  collectImageUrls,
  DEFAULT_CSV_PATH,
  evaluateRow,
  urlHash,
} from './lib/bubble-import.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

const INPUT_CSV = DEFAULT_CSV_PATH
const OUTPUT_CSV = join(ROOT, 'public/design-reference/export_All-Equipment-image-repair.csv')
const OUTPUT_XLSX = join(ROOT, 'public/design-reference/export_All-Equipment-image-repair.xlsx')

const REPAIR_COLUMNS = [
  'repair_images',
  'current_supabase_images',
  'image_status',
  'expected_image_count',
  'imported_image_count',
  'notes',
]

const FILL_ZERO = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FFFFCDD2' },
}

const FILL_PARTIAL = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FFFFF9C4' },
}

function loadEnvFile(relativePath) {
  const path = join(ROOT, relativePath)
  if (!existsSync(path)) return
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const index = trimmed.indexOf('=')
    if (index === -1) continue
    const key = trimmed.slice(0, index).trim()
    const value = trimmed.slice(index + 1).trim().replace(/^['"]|['"]$/g, '')
    if (!process.env[key]) process.env[key] = value
  }
}

/** Parse CSV into raw rows (values only; preserves field text including newlines). */
function parseCsvRows(content) {
  const rows = []
  let row = []
  let field = ''
  let inQuotes = false

  for (let i = 0; i < content.length; i += 1) {
    const char = content[i]
    const next = content[i + 1]

    if (inQuotes) {
      if (char === '"' && next === '"') {
        field += '"'
        i += 1
      } else if (char === '"') {
        inQuotes = false
      } else {
        field += char
      }
      continue
    }

    if (char === '"') {
      inQuotes = true
    } else if (char === ',') {
      row.push(field)
      field = ''
    } else if (char === '\n') {
      row.push(field)
      field = ''
      if (row.length > 1 || row[0] !== '') {
        rows.push(row)
      }
      row = []
    } else if (char !== '\r') {
      field += char
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field)
    rows.push(row)
  }

  return rows
}

function escapeCsvField(value) {
  const text = value ?? ''
  return `"${text.replace(/"/g, '""')}"`
}

function serializeCsvRow(values) {
  return values.map(escapeCsvField).join(',')
}

function rowToRecord(headers, values) {
  const record = {}
  headers.forEach((header, index) => {
    record[header] = values[index] ?? ''
  })
  return record
}

function extractStorageHashes(storagePaths) {
  return new Set(
    storagePaths
      .map((path) => path.match(/bubble-([a-f0-9]{10})/)?.[1])
      .filter(Boolean),
  )
}

function resolveImportSlug(record) {
  return (record.URL_Slug ?? '').trim().replace(/^-+/, '').replace(/-+$/g, '') || null
}

function buildNotes({
  evaluation,
  expected,
  imported,
  current,
  sourceUrls,
  inDatabase,
}) {
  const parts = []

  if (evaluation.skip) {
    parts.push(`Importer skip: ${evaluation.reasons.join('; ')}`)
  }

  if (expected === 0) {
    parts.push('No image URLs in export')
    return parts.join('; ')
  }

  if (!inDatabase && !evaluation.skip) {
    parts.push('Listing slug not found in Supabase import set')
  }

  const patterns = sourceUrls.map((url) => classifyImageUrl(url))
  const fileuploadCount = patterns.filter((p) => p.includes('fileupload')).length
  const cdnCount = patterns.filter((p) => p === 'cdn.bubble.io').length

  if (imported > 0) {
    parts.push(`${imported} Bubble image(s) imported`)
  }

  const missing = expected - imported
  if (missing > 0) {
    if (fileuploadCount === sourceUrls.length) {
      parts.push('All fileupload URLs failed (private CDN / expired equipd.co.uk SSL)')
    } else if (fileuploadCount > 0) {
      parts.push(`${fileuploadCount} fileupload URL(s) need signed CDN access`)
    }
    if (cdnCount > 0 && imported < expected) {
      const cdnMissing = Math.min(missing, cdnCount)
      if (cdnMissing > 0) {
        parts.push(`HTTP 403 on ${cdnMissing} remaining CDN image(s)`)
      }
    }
    if (missing > 0 && !parts.some((p) => p.includes('403') || p.includes('fileupload'))) {
      parts.push(`${missing} image(s) not imported`)
    }
  }

  if (current === 0 && expected > 0 && !evaluation.skip) {
    parts.push('Zero images in Supabase')
  } else if (current > 0 && current < expected) {
    parts.push(`${expected - current} image(s) still missing in Supabase`)
  }

  return parts.join('; ')
}

function computeImageStatus({ expected, current, evaluation }) {
  if (expected === 0) return 'OK'
  if (evaluation.skip) return 'OK'
  if (current === 0) return 'ZERO_IMAGES'
  if (current < expected) return 'PARTIAL'
  return 'OK'
}

async function fetchCategoryMap(supabase) {
  const { data, error } = await supabase.from('categories').select('id, slug, name')
  if (error) throw error
  return Object.fromEntries((data ?? []).map((row) => [row.slug, row]))
}

async function fetchListingImageMap(supabase) {
  const { data, error } = await supabase
    .from('listings')
    .select('slug, listing_images(storage_path)')
    .eq('source', 'import')
    .eq('status', 'active')

  if (error) throw error

  const map = new Map()
  for (const listing of data ?? []) {
    const paths = (listing.listing_images ?? []).map((img) => img.storage_path)
    map.set(listing.slug, {
      currentCount: paths.length,
      hashes: extractStorageHashes(paths),
    })
  }
  return map
}

async function writeXlsx(headers, dataRows, repairValues) {
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet('Image repair')

  sheet.addRow(headers)
  for (let i = 0; i < dataRows.length; i += 1) {
    const rowValues = [...dataRows[i], ...repairValues[i]]
    const excelRow = sheet.addRow(rowValues)
    const status = repairValues[i][2]

    if (status === 'ZERO_IMAGES') {
      excelRow.eachCell((cell) => {
        cell.fill = FILL_ZERO
      })
    } else if (status === 'PARTIAL') {
      excelRow.eachCell((cell) => {
        cell.fill = FILL_PARTIAL
      })
    }
  }

  sheet.views = [{ state: 'frozen', ySplit: 1 }]
  await workbook.xlsx.writeFile(OUTPUT_XLSX)
}

async function main() {
  loadEnvFile('.env.local')
  loadEnvFile('.env')

  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  if (!url || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Missing SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.')
  }

  const supabase = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const categoryMap = await fetchCategoryMap(supabase)
  const listingMap = await fetchListingImageMap(supabase)

  const raw = readFileSync(INPUT_CSV, 'utf8')
  const allRows = parseCsvRows(raw)
  if (!allRows.length) throw new Error('Input CSV is empty.')

  const originalHeaders = allRows[0]
  const dataRows = allRows.slice(1)
  const outputHeaders = [...originalHeaders, ...REPAIR_COLUMNS]

  const repairValues = []
  const statusCounts = { OK: 0, PARTIAL: 0, ZERO_IMAGES: 0 }

  for (let index = 0; index < dataRows.length; index += 1) {
    const values = dataRows[index]
    const record = rowToRecord(originalHeaders, values)
    const evaluation = evaluateRow(record, index + 2, categoryMap)
    const slug = resolveImportSlug(record)
    const sourceUrls = collectImageUrls(record)
    const expected = sourceUrls.length

    const listing = slug ? listingMap.get(slug) : null
    const current = listing?.currentCount ?? 0
    const imported = sourceUrls.filter((sourceUrl) =>
      listing?.hashes.has(urlHash(sourceUrl)),
    ).length

    const imageStatus = computeImageStatus({
      expected,
      current,
      evaluation,
    })
    statusCounts[imageStatus] += 1

    const notes = buildNotes({
      evaluation,
      expected,
      imported,
      current,
      sourceUrls,
      inDatabase: Boolean(listing),
    })

    repairValues.push([
      '',
      String(current),
      imageStatus,
      String(expected),
      String(imported),
      notes,
    ])
  }

  const outputLines = [serializeCsvRow(outputHeaders)]
  for (let i = 0; i < dataRows.length; i += 1) {
    outputLines.push(serializeCsvRow([...dataRows[i], ...repairValues[i]]))
  }

  writeFileSync(OUTPUT_CSV, `${outputLines.join('\n')}\n`, 'utf8')
  await writeXlsx(outputHeaders, dataRows, repairValues)

  console.log('=== Bubble image repair spreadsheet ===\n')
  console.log(`Input:  ${INPUT_CSV}`)
  console.log(`CSV:    ${OUTPUT_CSV}`)
  console.log(`XLSX:   ${OUTPUT_XLSX} (row highlighting)`)
  console.log(`\nRows: ${dataRows.length}`)
  console.log(`Status: OK=${statusCounts.OK}, PARTIAL=${statusCounts.PARTIAL}, ZERO_IMAGES=${statusCounts.ZERO_IMAGES}`)
  console.log(`\nNew columns: ${REPAIR_COLUMNS.join(', ')}`)
}

main().catch((error) => {
  console.error(error.message || error)
  process.exit(1)
})
