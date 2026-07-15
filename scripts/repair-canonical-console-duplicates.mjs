#!/usr/bin/env node
/**
 * Repair duplicate canonical equipment_products that differ only by console descriptors.
 *
 * Dry-run by default. Pass --apply to merge duplicates.
 *
 * Usage:
 *   node scripts/repair-canonical-console-duplicates.mjs --brand "Life Fitness"
 *   node scripts/repair-canonical-console-duplicates.mjs --brand "Life Fitness" --apply
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { buildConsoleDuplicateRepairPlan, coalesceMergedCanonicalProductFields } from '../src/lib/intelligenceCanonicalProducts.js'

const PRODUCT_FIELDS = [
  'id',
  'brand',
  'product_family',
  'model',
  'equipment_type',
  'canonical_product_name',
  'canonical_product_key',
  'source_intelligence_row_ids',
  'status',
  'original_base_price',
  'original_base_price_currency',
  'original_price_confidence',
  'original_price_source',
  'baseline_manufacture_year',
  'production_start_year',
  'production_end_year',
  'review_notes',
].join(', ')

const INTELLIGENCE_FIELDS = [
  'id',
  'brand',
  'series',
  'model',
  'equipment_type',
  'product_family',
  'variant_name',
  'core_product_group_status',
  'core_product_group_confidence',
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
  const args = { brand: null, apply: false }
  for (let index = 2; index < argv.length; index += 1) {
    const token = argv[index]
    if (token === '--apply') args.apply = true
    else if (token === '--brand') {
      args.brand = argv[index + 1] ?? null
      index += 1
    }
  }
  return args
}

async function fetchProducts(supabase, brandFilter) {
  let query = supabase.from('equipment_products').select(PRODUCT_FIELDS)
  if (brandFilter) query = query.ilike('brand', brandFilter)
  const { data, error } = await query
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

function coalesceKeeperFields(keeper, duplicates, idealProduct = null) {
  return coalesceMergedCanonicalProductFields(keeper, duplicates, idealProduct)
}

async function main() {
  const args = parseArgs(process.argv)
  const env = loadEnv()
  const supabase = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

  const products = await fetchProducts(supabase, args.brand)
  const intelligenceIds = [
    ...new Set(products.flatMap((product) => product.source_intelligence_row_ids ?? [])),
  ]
  const intelligenceRows = await fetchIntelligenceRows(supabase, intelligenceIds)
  const plan = buildConsoleDuplicateRepairPlan(products, intelligenceRows)

  console.log(`Brand filter: ${args.brand ?? 'all'}`)
  console.log(`Products scanned: ${products.length}`)
  console.log(`Merge clusters: ${plan.merges.length}`)
  console.log(`Ambiguous products: ${plan.ambiguous.length}`)
  console.log(`Mode: ${args.apply ? 'APPLY' : 'DRY-RUN'}`)
  console.log('')

  for (const merge of plan.merges) {
    const hasDateSuffix = [merge.keeper, ...merge.duplicates].some((product) => (
      /\(\s*\d{2,4}/.test(product.canonical_product_name ?? '')
    ))
    console.log(`Merge into: ${merge.idealProductName}${hasDateSuffix ? ' [date-suffix duplicate]' : ''}`)
    console.log(`  Keeper: ${merge.keeper.canonical_product_name} (${merge.keeper.source_intelligence_row_ids?.length ?? 0} sources)`)
    for (const duplicate of merge.duplicates) {
      console.log(`  Duplicate: ${duplicate.canonical_product_name} (${duplicate.source_intelligence_row_ids?.length ?? 0} sources)`)
    }
    console.log(`  Combined sources: ${merge.mergedSourceIds.length}`)
    console.log('')
  }

  if (!args.apply) {
    console.log('Dry-run only — no database changes made.')
    console.log('Re-run with --apply to merge duplicates and exclude duplicate canonical products.')
    console.log('equipment_intelligence rows are not modified.')
    return
  }

  let merged = 0
  let excluded = 0

  for (const merge of plan.merges) {
    const keeperFields = coalesceKeeperFields(
      merge.keeper,
      merge.duplicates,
      merge.idealProduct,
    )

    const { error: keeperError } = await supabase
      .from('equipment_products')
      .update({
        ...keeperFields,
        source_intelligence_row_ids: merge.mergedSourceIds,
        status: merge.keeper.status === 'excluded' ? 'approved' : merge.keeper.status,
      })
      .eq('id', merge.keeper.id)

    if (keeperError) throw keeperError
    merged += 1

    for (const duplicate of merge.duplicates) {
      const { error: duplicateError } = await supabase
        .from('equipment_products')
        .update({
          status: 'excluded',
          review_notes: `Merged into ${merge.keeper.id} (${merge.idealProductName})`,
        })
        .eq('id', duplicate.id)

      if (duplicateError) throw duplicateError
      excluded += 1
    }
  }

  console.log(`Merged ${merged} canonical product cluster(s).`)
  console.log(`Excluded ${excluded} duplicate canonical product row(s).`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
