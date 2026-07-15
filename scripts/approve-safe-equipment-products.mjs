#!/usr/bin/env node
/**
 * Approve safe canonical equipment product candidates.
 *
 * Usage:
 *   node scripts/approve-safe-equipment-products.mjs --brand "Life Fitness"
 *   node scripts/approve-safe-equipment-products.mjs --brand "Life Fitness" --dry-run
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  buildSafeApprovalCandidateIds,
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
].join(', ')

const INTELLIGENCE_FIELDS = [
  'id',
  'brand',
  'series',
  'model',
  'equipment_type',
  'product_family',
  'variant_name',
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
  const args = { brand: null, dryRun: false }
  for (let index = 2; index < argv.length; index += 1) {
    const token = argv[index]
    if (token === '--dry-run') args.dryRun = true
    else if (token === '--brand') {
      args.brand = argv[index + 1] ?? null
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

async function main() {
  const args = parseArgs(process.argv)
  const env = loadEnv()
  const supabase = createClient(
    env.VITE_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
  )

  const products = await fetchProducts(supabase, args.brand)
  const pendingMultiIds = [
    ...new Set(
      products
        .filter((product) => product.status === 'pending'
          && (product.source_intelligence_row_ids?.length ?? 0) > 1)
        .flatMap((product) => product.source_intelligence_row_ids ?? []),
    ),
  ]

  const intelligenceRows = await fetchIntelligenceRows(supabase, pendingMultiIds)
  const intelligenceRowsById = new Map(intelligenceRows.map((row) => [row.id, row]))
  const safeIds = buildSafeApprovalCandidateIds(products, intelligenceRowsById)

  const safeProducts = products.filter((product) => safeIds.includes(product.id))

  console.log(`Brand filter: ${args.brand ?? 'all'}`)
  console.log(`Products scanned: ${products.length}`)
  console.log(`Safe approval candidates: ${safeProducts.length}`)
  console.log(`Needs review (not approved): ${products.filter((p) => p.status === 'needs_review').length}`)

  if (args.dryRun) {
    console.log('\nDry-run — no changes made.')
    console.log('Sample safe candidates:')
    for (const product of safeProducts.slice(0, 8)) {
      console.log(`  ${product.canonical_product_name} (${product.source_intelligence_row_ids?.length ?? 0} sources)`)
    }
    return
  }

  let approved = 0
  for (const productId of safeIds) {
    const { error } = await supabase
      .from('equipment_products')
      .update({ status: 'approved' })
      .eq('id', productId)
      .eq('status', 'pending')
    if (error) throw error
    approved += 1
  }

  console.log(`\nApproved ${approved} safe candidate(s).`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
