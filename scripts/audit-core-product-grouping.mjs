#!/usr/bin/env node
/**
 * Dry-run audit for core product / variant grouping across equipment_intelligence.
 *
 * Usage:
 *   node scripts/audit-core-product-grouping.mjs
 *   node scripts/audit-core-product-grouping.mjs --brand "Life Fitness"
 *   node scripts/audit-core-product-grouping.mjs --json
 *   node scripts/audit-core-product-grouping.mjs --apply   # writes suggested grouping to rows missing core_product_key
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  buildCoreProductAuditReport,
  buildCoreProductGroupingPayload,
  deriveCoreProductFields,
} from '../src/lib/intelligenceCoreProductGrouping.js'
import { isEquipmentResearchComplete } from '../src/lib/equipmentResearchQueue.js'

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
    brand: null,
    json: false,
    apply: false,
    out: null,
  }

  for (let index = 2; index < argv.length; index += 1) {
    const token = argv[index]
    if (token === '--json') args.json = true
    else if (token === '--apply') args.apply = true
    else if (token === '--brand') {
      args.brand = argv[index + 1] ?? null
      index += 1
    } else if (token === '--out') {
      args.out = argv[index + 1] ?? null
      index += 1
    }
  }

  return args
}

const SELECT_FIELDS_MINIMAL = [
  'id',
  'brand',
  'series',
  'model',
  'equipment_type',
  'slug',
  'best_original_price',
  'best_original_price_confidence',
  'best_original_price_currency',
  'baseline_manufacture_year',
  'baseline_manufacture_year_source',
].join(', ')

const SELECT_FIELDS_WITH_CORE = `${SELECT_FIELDS_MINIMAL}, core_product_name, core_product_key, variant_type, variant_name, is_base_product, core_product_group_status, core_product_group_confidence`

async function fetchRows(supabase, brandFilter) {
  const pageSize = 1000
  let from = 0
  const rows = []
  let selectFields = SELECT_FIELDS_WITH_CORE

  while (true) {
    let query = supabase
      .from('equipment_intelligence')
      .select(selectFields)
      .order('brand')
      .order('model')
      .range(from, from + pageSize - 1)

    if (brandFilter) {
      query = query.ilike('brand', brandFilter)
    }

    let { data, error } = await query

    if (error?.message?.includes('core_product')) {
      if (selectFields !== SELECT_FIELDS_MINIMAL) {
        selectFields = SELECT_FIELDS_MINIMAL
        from = 0
        rows.length = 0
        continue
      }
      throw error
    }

    if (error) throw error
    if (!data?.length) break

    rows.push(...data)
    if (data.length < pageSize) break
    from += pageSize
  }

  return rows
}

function printReport(audit) {
  console.log('Core product grouping audit (dry-run)')
  console.log('===================================')
  console.log(`Total rows:              ${audit.total_rows}`)
  console.log(`Unique core products:    ${audit.unique_core_products}`)
  console.log(`Duplicate groups (>1):   ${audit.duplicate_group_count}`)
  console.log(`High-confidence dupes: ${audit.high_confidence_duplicate_group_count ?? 0}`)
  console.log(`Possible related sets: ${audit.possible_related_cluster_count ?? 0}`)
  console.log(`Rows with variant label: ${audit.variant_row_count}`)
  console.log('')
  console.log('Estimated research calls:')
  console.log(`  Before (per row):      ${audit.estimated_research_calls.before}`)
  console.log(`  After (core products): ${audit.estimated_research_calls.after}`)
  console.log(`  Reduction:             ${audit.estimated_research_calls.reduction} (${audit.estimated_research_calls.reduction_percent}%)`)
  console.log('')

  if (audit.examples.length > 0) {
    console.log('')
    console.log('Example — related model-word cluster:')
    for (const example of audit.examples) {
      console.log(`  ${example.distinct_core_products} separate core product candidates`)
      for (const candidate of example.candidates ?? []) {
        console.log(`    - ${candidate.core_product_name}${candidate.variant_name ? ` (${candidate.variant_name})` : ''}`)
      }
    }
    console.log('')
  }

  if (audit.possible_related_clusters?.length > 0) {
    console.log('')
    console.log('Possible related clusters (manual review — not auto-merged):')
    for (const cluster of audit.possible_related_clusters.slice(0, 10)) {
      console.log(`  ${cluster.distinct_core_products} candidates · ${cluster.brand} ${cluster.core_model}`)
      for (const candidate of cluster.candidates.slice(0, 6)) {
        console.log(`    - ${candidate.core_product_name}${candidate.variant_name ? ` (${candidate.variant_name})` : ''}`)
      }
    }
  }

  console.log('')
  console.log('Largest high-confidence duplicate groups:')
  for (const group of audit.largest_duplicate_groups.slice(0, 15)) {
    console.log(`  ${group.member_count}x  ${group.core_product_name}`)
    for (const member of group.members) {
      console.log(`       ${member.model}${member.variant_name ? ` (${member.variant_name})` : ''}`)
    }
  }
}

async function applySuggestions(supabase, rows) {
  const toUpdate = rows.filter((row) => !row.core_product_key)
  if (toUpdate.length === 0) {
    console.log('No rows missing core_product_key — nothing to apply.')
    return 0
  }

  let updated = 0
  for (const row of toUpdate) {
    const payload = buildCoreProductGroupingPayload(row)
    const { error } = await supabase
      .from('equipment_intelligence')
      .update(payload)
      .eq('id', row.id)

    if (error) throw error
    updated += 1
  }

  return updated
}

async function main() {
  const args = parseArgs(process.argv)
  const env = loadEnv()
  const supabase = createClient(
    env.VITE_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY || env.VITE_SUPABASE_ANON_KEY,
  )

  const rows = await fetchRows(supabase, args.brand)
  const audit = buildCoreProductAuditReport(rows, {
    incompleteRowFilter: (row) => !isEquipmentResearchComplete(row),
  })

  if (args.json) {
    const output = JSON.stringify(audit, null, 2)
    if (args.out) {
      writeFileSync(args.out, output)
      console.log(`Wrote audit report to ${args.out}`)
    } else {
      console.log(output)
    }
  } else {
    printReport(audit)
    if (args.out) {
      writeFileSync(args.out, JSON.stringify(audit, null, 2))
      console.log(`\nWrote JSON audit to ${args.out}`)
    }
  }

  if (args.apply) {
    const updated = await applySuggestions(supabase, rows)
    console.log(`\nApplied suggested grouping to ${updated} rows (status=auto).`)
    console.log('Review groups in Admin → Intelligence → Core products before approving.')
  } else {
    console.log('\nDry-run only — no database changes made.')
    console.log('Use --apply to persist suggested grouping to rows missing core_product_key.')
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
