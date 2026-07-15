#!/usr/bin/env node
/**
 * Audit canonical equipment products from equipment_intelligence rows.
 *
 * Usage:
 *   node scripts/audit-canonical-equipment-products.mjs
 *   node scripts/audit-canonical-equipment-products.mjs --brand "Life Fitness"
 *   node scripts/audit-canonical-equipment-products.mjs --json --out canonical-audit.json
 *   node scripts/audit-canonical-equipment-products.mjs --apply
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  buildCanonicalProductAuditReport,
} from '../src/lib/intelligenceCanonicalProducts.js'

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

const SELECT_FIELDS = [
  'id',
  'brand',
  'series',
  'model',
  'equipment_type',
  'slug',
  'product_family',
  'original_rrp',
  'currency',
  'best_original_price',
  'best_original_price_confidence',
  'best_original_price_currency',
  'baseline_manufacture_year',
  'manufacture_start_year',
  'manufacture_end_year',
].join(', ')

async function fetchRows(supabase, brandFilter) {
  const pageSize = 1000
  let from = 0
  const rows = []

  while (true) {
    let query = supabase
      .from('equipment_intelligence')
      .select(SELECT_FIELDS)
      .order('brand')
      .order('model')
      .range(from, from + pageSize - 1)

    if (brandFilter) {
      query = query.ilike('brand', brandFilter)
    }

    const { data, error } = await query
    if (error) throw error
    if (!data?.length) break

    rows.push(...data)
    if (data.length < pageSize) break
    from += pageSize
  }

  return rows
}

function printReport(audit) {
  console.log('Canonical equipment products audit (dry-run)')
  console.log('==========================================')
  console.log(`Total intelligence rows:     ${audit.total_intelligence_rows}`)
  console.log(`Suggested canonical products: ${audit.suggested_canonical_products}`)
  console.log(`Duplicate rows collapsed:    ${audit.duplicate_rows_collapsed}`)
  console.log(`Products needing review:     ${audit.products_needing_review}`)
  console.log('')

  for (const [brand, examples] of Object.entries(audit.examples_by_brand)) {
    console.log(`${brand} examples:`)
    for (const example of examples) {
      console.log(`  ${example.canonical_product_name} (${example.source_row_count} rows, consoles: ${example.detected_consoles.join(', ') || 'base'})`)
      console.log(`    models: ${example.source_models.join(' · ')}`)
    }
    console.log('')
  }
}

async function applyProducts(supabase, products) {
  let upserted = 0

  for (const product of products) {
    const { data: existing, error: existingError } = await supabase
      .from('equipment_products')
      .select('id, status, source_intelligence_row_ids, original_base_price, original_price_confidence, baseline_manufacture_year')
      .eq('canonical_product_key', product.canonical_product_key)
      .maybeSingle()

    if (existingError) throw existingError

    const mergedIds = [
      ...new Set([
        ...(existing?.source_intelligence_row_ids ?? []),
        ...(product.source_intelligence_row_ids ?? []),
      ]),
    ]

    if (existing?.status === 'approved') {
      const { error } = await supabase
        .from('equipment_products')
        .update({ source_intelligence_row_ids: mergedIds })
        .eq('id', existing.id)
      if (error) throw error
      upserted += 1
      continue
    }

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
      status: existing?.status === 'excluded' ? 'excluded' : (product.status ?? 'pending'),
      review_notes: reviewNotes,
    }

    if (existing?.id) {
      const { error } = await supabase
        .from('equipment_products')
        .update({
          source_intelligence_row_ids: mergedIds,
          status: existing.status === 'excluded' ? 'excluded' : row.status,
          review_notes: reviewNotes ?? existing.review_notes,
          baseline_manufacture_year: existing.baseline_manufacture_year ?? row.baseline_manufacture_year,
          production_start_year: existing.production_start_year ?? row.production_start_year,
          production_end_year: existing.production_end_year ?? row.production_end_year,
          original_base_price: existing.original_base_price ?? row.original_base_price,
          original_price_confidence: existing.original_price_confidence ?? row.original_price_confidence,
        })
        .eq('id', existing.id)
      if (error) throw error
    } else {
      const { error } = await supabase
        .from('equipment_products')
        .insert(row)
      if (error) throw error
    }

    upserted += 1
  }

  return upserted
}

async function main() {
  const args = parseArgs(process.argv)
  const env = loadEnv()
  const supabase = createClient(
    env.VITE_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY || env.VITE_SUPABASE_ANON_KEY,
  )

  const rows = await fetchRows(supabase, args.brand)
  const audit = buildCanonicalProductAuditReport(rows, {
    brandFilter: args.brand,
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
    const upserted = await applyProducts(supabase, audit.products)
    console.log(`\nUpserted ${upserted} canonical products into equipment_products.`)
    console.log('Approved products were not overwritten. Review in Admin → Intelligence → Products.')
  } else {
    console.log('\nDry-run only — no database changes made.')
    console.log('Use --apply to upsert suggested products into equipment_products.')
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
