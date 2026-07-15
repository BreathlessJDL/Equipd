#!/usr/bin/env node
/**
 * Approve single-source equipment_products in needs_review when only low grouping confidence blocks them.
 *
 * Dry-run by default. Pass --apply to write approvals.
 *
 * Usage:
 *   node scripts/approve-single-source-needs-review-products.mjs --brand "Life Fitness"
 *   node scripts/approve-single-source-needs-review-products.mjs --brand "Life Fitness" --apply
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  buildProductReviewMetadata,
  buildSingleSourceNeedsReviewCandidateIds,
  evaluateSingleSourceApproval,
  formatProductReviewReasons,
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
    else if (token === '--dry-run') args.apply = false
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

async function main() {
  const args = parseArgs(process.argv)
  const env = loadEnv()
  const supabase = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

  const products = await fetchProducts(supabase, args.brand)
  const needsReview = products.filter((product) => product.status === 'needs_review')
  const intelligenceIds = [
    ...new Set(needsReview.flatMap((product) => product.source_intelligence_row_ids ?? [])),
  ]
  const intelligenceRows = await fetchIntelligenceRows(supabase, intelligenceIds)
  const intelligenceRowsById = new Map(intelligenceRows.map((row) => [row.id, row]))

  const eligibleIds = buildSingleSourceNeedsReviewCandidateIds(products, intelligenceRowsById)
  const reviewMetadata = buildProductReviewMetadata(products, intelligenceRowsById)
  const eligibleProducts = products.filter((product) => eligibleIds.includes(product.id))
  const skippedNeedsReview = needsReview.filter((product) => !eligibleIds.includes(product.id))

  console.log(`Brand filter: ${args.brand ?? 'all'}`)
  console.log(`Needs review products: ${needsReview.length}`)
  console.log(`Eligible single-source approvals: ${eligibleProducts.length}`)
  console.log(`Skipped needs review: ${skippedNeedsReview.length}`)
  console.log(`Mode: ${args.apply ? 'APPLY' : 'DRY-RUN'}`)
  console.log('')

  if (eligibleProducts.length) {
    console.log('Eligible products:')
    for (const product of eligibleProducts.slice(0, 12)) {
      const meta = reviewMetadata[product.id]
      console.log(`  ${product.canonical_product_name} [${formatProductReviewReasons(meta?.reviewReasons ?? []).join(', ')}]`)
    }
    if (eligibleProducts.length > 12) {
      console.log(`  ...and ${eligibleProducts.length - 12} more`)
    }
    console.log('')
  }

  if (skippedNeedsReview.length) {
    console.log('Skipped examples:')
    for (const product of skippedNeedsReview.slice(0, 8)) {
      const sourceRows = (product.source_intelligence_row_ids ?? [])
        .map((id) => intelligenceRowsById.get(id))
        .filter(Boolean)
      const evaluation = evaluateSingleSourceApproval(product, sourceRows)
      console.log(`  ${product.canonical_product_name} -> ${evaluation.blockers.join(', ') || 'unknown'}`)
    }
    console.log('')
  }

  if (!args.apply) {
    console.log('Dry-run only — no database changes made.')
    console.log('Re-run with --apply to approve eligible single-source needs_review products.')
    return
  }

  let approved = 0
  for (const productId of eligibleIds) {
    const { error } = await supabase
      .from('equipment_products')
      .update({ status: 'approved' })
      .eq('id', productId)
      .eq('status', 'needs_review')
    if (error) throw error
    approved += 1
  }

  console.log(`Approved ${approved} single-source needs_review product(s).`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
