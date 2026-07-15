#!/usr/bin/env node
/**
 * Approve high-confidence canonical equipment products.
 *
 * Dry-run by default. Pass --apply to write approvals.
 *
 * Usage:
 *   node scripts/approve-high-confidence-equipment-products.mjs --brand "Life Fitness" --min-score 90
 *   node scripts/approve-high-confidence-equipment-products.mjs --brand "Life Fitness" --min-score 90 --apply
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  buildHighConfidenceApprovalEvaluation,
  summarizeSkippedReasons,
} from '../src/lib/intelligenceCanonicalProducts.js'

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
  'review_notes',
  'original_base_price',
  'original_price_source',
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
  const args = {
    brand: null,
    minScore: 90,
    apply: false,
  }

  for (let index = 2; index < argv.length; index += 1) {
    const token = argv[index]
    if (token === '--apply') args.apply = true
    else if (token === '--dry-run') args.apply = false
    else if (token === '--brand') {
      args.brand = argv[index + 1] ?? null
      index += 1
    } else if (token === '--min-score') {
      args.minScore = Number(argv[index + 1] ?? 90)
      index += 1
    }
  }

  return args
}

async function fetchProducts(supabase, brandFilter) {
  let query = supabase
    .from('equipment_products')
    .select(PRODUCT_FIELDS)
    .order('canonical_product_name')

  if (brandFilter) {
    query = query.ilike('brand', brandFilter)
  }

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

function printSummary(evaluation, { brand, minScore, apply }) {
  console.log(`Brand filter: ${brand ?? 'all'}`)
  console.log(`Min grouping score: ${minScore}`)
  console.log(`Mode: ${apply ? 'APPLY' : 'DRY-RUN'}`)
  console.log('')
  console.log(`Eligible to approve: ${evaluation.summary.eligibleCount}`)
  console.log(`  pending: ${evaluation.summary.pendingCount}`)
  console.log(`  needs_review: ${evaluation.summary.needsReviewCount}`)
  console.log(`Skipped: ${evaluation.summary.skippedCount}`)

  const skippedReasons = summarizeSkippedReasons(evaluation.summary.skippedByReason)
  if (skippedReasons.length) {
    console.log('\nSkipped reasons:')
    for (const entry of skippedReasons) {
      console.log(`  ${entry.label}: ${entry.count}`)
    }
  }

  if (evaluation.eligible.length) {
    console.log('\nSample eligible products:')
    for (const product of evaluation.eligible.slice(0, 8)) {
      console.log(`  ${product.canonical_product_name} [${product.status}, score ${product.groupingScore}]`)
    }
  }

  if (!apply) {
    console.log('\nDry-run only — no database changes made.')
    console.log('Re-run with --apply to approve eligible products.')
    console.log('equipment_intelligence rows are not modified; only equipment_products.status is set to approved.')
  }
}

async function main() {
  const args = parseArgs(process.argv)
  const env = loadEnv()
  const supabase = createClient(
    env.VITE_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
  )

  const products = await fetchProducts(supabase, args.brand)
  const intelligenceIds = [
    ...new Set(products.flatMap((product) => product.source_intelligence_row_ids ?? [])),
  ]
  const intelligenceRows = await fetchIntelligenceRows(supabase, intelligenceIds)
  const intelligenceRowsById = new Map(intelligenceRows.map((row) => [row.id, row]))

  const evaluation = buildHighConfidenceApprovalEvaluation(
    products,
    intelligenceRowsById,
    { minScore: args.minScore },
  )

  printSummary(evaluation, args)

  if (!args.apply || evaluation.eligibleIds.length === 0) {
    return
  }

  let approved = 0
  for (const productId of evaluation.eligibleIds) {
    const { error } = await supabase
      .from('equipment_products')
      .update({ status: 'approved' })
      .eq('id', productId)
      .in('status', ['pending', 'needs_review'])
    if (error) throw error
    approved += 1
  }

  console.log(`\nApproved ${approved} high-confidence product(s).`)
  console.log(`Skipped ${evaluation.skipped.length} product(s) during evaluation.`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
