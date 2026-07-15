#!/usr/bin/env node
/**
 * Debug Top 100 canonical product eligibility for a brand.
 *
 * Usage:
 *   node scripts/debug-top-100-product-eligibility.mjs --brand "Woodway"
 *   node scripts/debug-top-100-product-eligibility.mjs --brand "Wattbike"
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { dedupeCanonicalProductsForWorkflow } from '../src/lib/canonicalProductDedupe.js'
import {
  buildActiveBrandNameSet,
  buildCanonicalProductDisplayGroups,
  buildCanonicalProductResearchQueue,
  evaluateCanonicalProductTop100Eligibility,
  filterCanonicalProductsForTop100Queue,
} from '../src/lib/equipmentResearchQueue.js'

const PRODUCT_FIELDS = [
  'id',
  'brand',
  'canonical_product_name',
  'canonical_product_key',
  'status',
  'equipment_type',
  'original_base_price',
  'baseline_manufacture_year',
  'source_intelligence_row_ids',
  'image_status',
  'image_url',
  'image_storage_path',
].join(', ')

const INTELLIGENCE_FIELDS = [
  'id',
  'brand',
  'model',
  'core_product_key',
  'is_base_product',
  'core_product_group_status',
  'equipment_type',
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
  const args = { brand: null }
  for (let index = 2; index < argv.length; index += 1) {
    if (argv[index] === '--brand') {
      args.brand = argv[index + 1] ?? null
      index += 1
    }
  }
  if (!args.brand) {
    throw new Error('Usage: node scripts/debug-top-100-product-eligibility.mjs --brand "Brand Name"')
  }
  return args
}

function yesNo(value) {
  return value ? 'yes' : 'no'
}

function presentMissing(value) {
  return value ? 'present' : 'missing'
}

async function fetchBrandProducts(supabase, brand) {
  const { data, error } = await supabase
    .from('equipment_products')
    .select(PRODUCT_FIELDS)
    .ilike('brand', brand)
    .order('canonical_product_name')

  if (error) throw error
  return data ?? []
}

async function fetchIntelligenceByIds(supabase, ids) {
  if (!ids.length) return []
  const rows = []
  const chunkSize = 200
  for (let index = 0; index < ids.length; index += chunkSize) {
    const chunk = ids.slice(index, index + chunkSize)
    const { data, error } = await supabase
      .from('equipment_intelligence')
      .select(INTELLIGENCE_FIELDS)
      .in('id', chunk)
    if (error) throw new Error(error.message || `equipment_intelligence fetch failed (${error.code ?? 'unknown'})`)
    rows.push(...(data ?? []))
  }
  return rows
}

async function fetchBrands(supabase) {
  const { data, error } = await supabase.from('brands').select('name')
  if (error) throw new Error(error.message || 'brands fetch failed')
  return data ?? []
}

async function fetchAllApprovedProducts(supabase) {
  const pageSize = 1000
  let from = 0
  const products = []
  while (true) {
    const { data, error } = await supabase
      .from('equipment_products')
      .select(PRODUCT_FIELDS)
      .eq('status', 'approved')
      .order('canonical_product_name')
      .range(from, from + pageSize - 1)
    if (error) throw new Error(error.message || 'equipment_products fetch failed')
    if (!data?.length) break
    products.push(...data)
    if (data.length < pageSize) break
    from += pageSize
  }
  return products
}

function printProductReport(product, eligibility, { top100Rank, researchQueued }) {
  const intel = product._intelligence ?? []
  const baseFlags = intel.map((row) => row.is_base_product)
  const groupStatuses = [...new Set(intel.map((row) => row.core_product_group_status).filter(Boolean))]

  console.log(`\n${product.canonical_product_name}`)
  console.log(`  id:                    ${product.id}`)
  console.log(`  exists:                yes`)
  console.log(`  approved status:       ${product.status}`)
  console.log(`  canonical_product_key: ${product.canonical_product_key ?? '—'}`)
  console.log(`  equipment_type:        ${product.equipment_type ?? '—'}`)
  console.log(`  is_base_product:       ${baseFlags.length ? baseFlags.join(', ') : '—'}`)
  console.log(`  core_product_group_status: ${groupStatuses.length ? groupStatuses.join(', ') : '—'}`)
  console.log(`  RRP:                   ${presentMissing(eligibility.checks.rrpPresent)}`)
  console.log(`  baseline year:         ${presentMissing(eligibility.checks.baselinePresent)}`)
  console.log(`  image:                 ${product.image_status ?? 'missing'} (${presentMissing(eligibility.checks.imageApproved)} approved image)`)
  console.log(`  active brand:          ${yesNo(eligibility.checks.activeBrand)}`)
  console.log(`  intelligence proxy:    ${yesNo(eligibility.checks.hasIntelligenceProxy)}`)
  console.log(`  Top 100 eligible:      ${yesNo(eligibility.included)}`)
  console.log(`  Top 100 reason:        ${eligibility.reason}`)
  console.log(`  Top 100 display rank:  ${top100Rank ?? '—'}`)
  console.log(`  batch research queued: ${researchQueued ? 'yes' : 'no'}`)
}

const env = loadEnv()
const args = parseArgs(process.argv)

async function main() {
  const supabase = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

  const rawProducts = await fetchBrandProducts(supabase, args.brand)
  const brands = await fetchBrands(supabase)
  const intelligenceIds = [...new Set(rawProducts.flatMap((product) => product.source_intelligence_row_ids ?? []))]
  const intelligenceRows = await fetchIntelligenceByIds(supabase, intelligenceIds)
  const intelligenceRowsById = new Map(intelligenceRows.map((row) => [row.id, row]))

  for (const product of rawProducts) {
    const sourceIds = product.source_intelligence_row_ids ?? []
    product._intelligence = sourceIds.map((id) => intelligenceRowsById.get(id)).filter(Boolean)
  }

  const approvedProducts = rawProducts.filter((product) => product.status === 'approved')
  const allApprovedFull = await fetchAllApprovedProducts(supabase)

  const activeBrands = buildActiveBrandNameSet({
    brands,
    products: allApprovedFull,
  })

  const allIntelIds = [...new Set(allApprovedFull.flatMap((product) => product.source_intelligence_row_ids ?? []))]
  const allIntelRows = await fetchIntelligenceByIds(supabase, allIntelIds)
  const allIntelById = new Map(allIntelRows.map((row) => [row.id, row]))
  const dedupedProducts = dedupeCanonicalProductsForWorkflow(allApprovedFull, allIntelById)

  const top100Groups = buildCanonicalProductDisplayGroups(dedupedProducts, { limit: 100, activeBrands })
  const top100RankById = new Map(top100Groups.map((group) => [group.productId, group.rank]))
  const { queue } = buildCanonicalProductResearchQueue(dedupedProducts, { targetCount: 100, skipCompleted: true })
  const queuedIds = new Set(queue.map((entry) => entry.productId))

  console.log(`Top 100 eligibility debug — ${args.brand}`)
  console.log('='.repeat(60))
  console.log(`Raw equipment_products rows:     ${rawProducts.length}`)
  console.log(`Approved rows:                   ${approvedProducts.length}`)
  console.log(`Active brands (catalog + approved): ${activeBrands.size}`)
  console.log(`Brand in active set:             ${yesNo(activeBrands.has(args.brand))}`)
  console.log(`Top 100 incomplete candidates:   ${filterCanonicalProductsForTop100Queue(dedupedProducts, { activeBrands }).length}`)
  console.log(`Top 100 display rows:            ${top100Groups.length}`)

  if (!rawProducts.length) {
    console.log('\nNo equipment_products rows found for this brand.')
    return
  }

  for (const product of rawProducts) {
    const eligibility = evaluateCanonicalProductTop100Eligibility(product, {
      activeBrands,
      intelligenceRowsById,
    })
    printProductReport(product, eligibility, {
      top100Rank: top100RankById.get(product.id) ?? null,
      researchQueued: queuedIds.has(product.id),
    })
  }

  const includedCount = rawProducts.filter((product) => (
    evaluateCanonicalProductTop100Eligibility(product, { activeBrands, intelligenceRowsById }).included
  )).length

  console.log(`\nSummary: ${includedCount}/${rawProducts.length} ${args.brand} product(s) eligible for Top 100 incomplete queue.`)
}

main().catch((error) => {
  console.error(error?.stack || error?.message || error)
  process.exit(1)
})
