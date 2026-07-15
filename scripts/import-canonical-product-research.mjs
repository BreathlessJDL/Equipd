#!/usr/bin/env node
/**
 * Import researched canonical product data from spreadsheet into equipment_products.
 *
 * Does not import into equipment_intelligence directly from spreadsheet rows.
 * Linked intelligence rows are updated only via safe propagation after product updates.
 *
 * Usage:
 *   node scripts/import-canonical-product-research.mjs --file top100.xlsx
 *   node scripts/import-canonical-product-research.mjs --file top100.xlsx --apply
 *   node scripts/import-canonical-product-research.mjs --file top100.csv --apply --force
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { join, basename } from 'node:path'
import {
  applyCanonicalProductImportPlan,
  buildImportPlanWithIntelligence,
  formatImportPlanRowLine,
  normalizeImportHeaderMap,
  parseResearchImportFile,
} from '../src/lib/canonicalProductResearchImport.js'

const PRODUCT_FIELDS = [
  'id',
  'brand',
  'canonical_product_name',
  'canonical_product_key',
  'original_base_price',
  'original_base_price_currency',
  'original_price_source',
  'original_price_source_url',
  'original_price_confidence',
  'baseline_manufacture_year',
  'baseline_source',
  'production_start_year',
  'production_end_year',
  'lifecycle_confidence',
  'source_intelligence_row_ids',
  'review_notes',
].join(', ')

const INTELLIGENCE_FIELDS = [
  'id',
  'best_original_price',
  'best_original_price_currency',
  'best_original_price_confidence',
  'best_original_price_source_id',
  'baseline_manufacture_year',
  'baseline_manufacture_year_confidence',
  'baseline_manufacture_year_source',
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
    file: null,
    dryRun: true,
    apply: false,
    force: false,
  }

  for (let index = 2; index < argv.length; index += 1) {
    const token = argv[index]
    if (token === '--dry-run') args.dryRun = true
    else if (token === '--apply') {
      args.apply = true
      args.dryRun = false
    } else if (token === '--force') args.force = true
    else if (token === '--file') {
      args.file = argv[index + 1] ?? null
      index += 1
    }
  }

  return args
}

async function fetchProducts(supabase) {
  const { data, error } = await supabase
    .from('equipment_products')
    .select(PRODUCT_FIELDS)
    .order('canonical_product_name')

  if (error) throw error
  return data ?? []
}

async function fetchIntelligenceRows(supabase, ids) {
  const rows = []
  const chunkSize = 200

  for (let index = 0; index < ids.length; index += chunkSize) {
    const chunk = ids.slice(index, index + chunkSize)
    const { data, error } = await supabase
      .from('equipment_intelligence')
      .select(INTELLIGENCE_FIELDS)
      .in('id', chunk)

    if (error) throw error
    rows.push(...(data ?? []))
  }

  return rows
}

function printSummary(summary) {
  console.log('Summary:')
  console.log(`  Rows read:    ${summary.rowsRead}`)
  console.log(`  Matched:      ${summary.matched}`)
  console.log(`  Updated:      ${summary.updated}`)
  console.log(`  Skipped:      ${summary.skipped}`)
  console.log(`  Conflicts:    ${summary.conflicts}`)
  console.log(`  No matches:   ${summary.noMatches}`)
}

async function main() {
  const args = parseArgs(process.argv)
  if (!args.file) {
    throw new Error('Specify --file path/to/spreadsheet.xlsx')
  }

  const env = loadEnv()
  const supabaseUrl = env.VITE_SUPABASE_URL ?? env.SUPABASE_URL
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing VITE_SUPABASE_URL/SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const filename = basename(args.file)
  const parsed = await parseResearchImportFile(args.file, { filename })
  const headerMap = normalizeImportHeaderMap(parsed.headers)
  const products = await fetchProducts(supabase)

  const intelligenceIds = [
    ...new Set(products.flatMap((product) => product.source_intelligence_row_ids ?? [])),
  ]
  const intelligenceRows = await fetchIntelligenceRows(supabase, intelligenceIds)
  const intelligenceRowsById = new Map(intelligenceRows.map((row) => [row.id, row]))

  const plan = buildImportPlanWithIntelligence(
    products,
    parsed.rows,
    headerMap,
    intelligenceRowsById,
    { force: args.force },
  )

  console.log(`Mode: ${args.dryRun ? 'DRY-RUN' : 'APPLY'}`)
  console.log(`File: ${args.file}`)
  console.log(`Force overwrite: ${args.force}`)
  console.log('')

  for (const result of plan.results) {
    console.log(formatImportPlanRowLine(result))
  }

  console.log('')
  printSummary(plan.summary)

  if (args.dryRun) {
    console.log('\nDry-run only — no database changes made.')
    console.log('Re-run with --apply to import researched canonical product data.')
    return
  }

  const applyResult = await applyCanonicalProductImportPlan(plan, {
    applyProductUpdate: async (productId, update, snapshot) => {
      const { error } = await supabase
        .from('equipment_products')
        .update({ ...update, updated_at: new Date().toISOString() })
        .eq('id', productId)

      if (error) {
        return { error }
      }

      return {
        error: null,
        rollback: snapshot
          ? async () => {
            await supabase
              .from('equipment_products')
              .update({ ...snapshot, updated_at: new Date().toISOString() })
              .eq('id', productId)
          }
          : null,
      }
    },
    applyIntelligenceUpdate: async (rowId, patch) => {
      const { id, ...fields } = patch
      const { error } = await supabase
        .from('equipment_intelligence')
        .update(fields)
        .eq('id', rowId)
      return { error }
    },
    onFailure: (failure) => {
      console.error(`FAILED ${failure.productName ?? failure.productId}: ${failure.stage} — ${failure.error?.message ?? failure.error}`)
    },
  })

  console.log('')
  console.log(`Applied product updates:      ${applyResult.appliedProducts}`)
  console.log(`Applied intelligence rows:    ${applyResult.appliedIntelligenceRows}`)
  console.log(`Failures:                   ${applyResult.failures.length}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
