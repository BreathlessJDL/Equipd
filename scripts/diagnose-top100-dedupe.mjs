#!/usr/bin/env node
/**
 * Live Top 100 dedupe diagnostic against Supabase.
 *
 * Usage:
 *   node scripts/diagnose-top100-dedupe.mjs
 *   node scripts/diagnose-top100-dedupe.mjs --name "Technogym Excite Top 700"
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  analyzeCanonicalProductDedupe,
} from '../src/lib/canonicalProductDedupe.js'
import { buildCanonicalProductDisplayGroups } from '../src/lib/equipmentResearchQueue.js'
import { PRODUCT_STATUS } from '../src/lib/intelligenceCanonicalProducts.js'

const WATCH_NAMES = [
  'Technogym Excite Top 700',
  'Technogym Excite Jog',
  'Technogym Excite New Bike 700',
  'Technogym Excite New Recline 700',
]

const PRODUCT_FIELDS = [
  'id',
  'brand',
  'canonical_product_name',
  'canonical_product_key',
  'status',
  'source_intelligence_row_ids',
].join(', ')

const INTELLIGENCE_FIELDS = [
  'id',
  'brand',
  'model',
  'core_product_key',
  'core_product_group_status',
  'is_base_product',
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
  const args = { name: null }
  for (let index = 2; index < argv.length; index += 1) {
    if (argv[index] === '--name') {
      args.name = argv[index + 1] ?? null
      index += 1
    }
  }
  return args
}

function canonicalKeyDedupe(products) {
  const seen = new Set()
  const unique = []
  for (const product of products) {
    const key = String(product.canonical_product_key ?? '').trim()
    if (!key || seen.has(key)) continue
    seen.add(key)
    unique.push(product)
  }
  return unique
}

function countByName(products, name) {
  const needle = name.toLowerCase()
  return products.filter(
    (product) => String(product.canonical_product_name ?? '').toLowerCase() === needle,
  )
}

function summarizeWatchNames(products, label) {
  console.log(`\n--- ${label} ---`)
  for (const name of WATCH_NAMES) {
    const matches = countByName(products, name)
    console.log(`${name}: ${matches.length}`)
    for (const product of matches) {
      console.log(`  - id=${product.id} key=${product.canonical_product_key} sources=${(product.source_intelligence_row_ids ?? []).length}`)
    }
  }
}

async function fetchAllProducts(supabase) {
  const pageSize = 1000
  let from = 0
  const products = []
  while (true) {
    const { data, error } = await supabase
      .from('equipment_products')
      .select(PRODUCT_FIELDS)
      .order('canonical_product_name')
      .range(from, from + pageSize - 1)
    if (error) throw error
    if (!data?.length) break
    products.push(...data)
    if (data.length < pageSize) break
    from += pageSize
  }
  return products
}

async function fetchIntelligenceByIds(supabase, ids) {
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

async function fetchApprovedIntelligenceGroups(supabase) {
  const pageSize = 1000
  let from = 0
  const rows = []
  while (true) {
    const { data, error } = await supabase
      .from('equipment_intelligence')
      .select(INTELLIGENCE_FIELDS)
      .eq('core_product_group_status', 'approved')
      .not('core_product_key', 'is', null)
      .range(from, from + pageSize - 1)
    if (error) throw error
    if (!data?.length) break
    rows.push(...data)
    if (data.length < pageSize) break
    from += pageSize
  }
  return rows
}

function inspectDuplicates(products, intelligenceRowsById, watchName = null) {
  const names = watchName ? [watchName] : WATCH_NAMES
  for (const name of names) {
    const matches = countByName(products, name)
    if (!matches.length) continue
    console.log(`\n=== Inspect: ${name} (${matches.length} products) ===`)
    for (const product of matches) {
      const sourceIds = product.source_intelligence_row_ids ?? []
      console.log(`Product ${product.id}`)
      console.log(`  canonical_product_key: ${product.canonical_product_key}`)
      console.log(`  source_intelligence_row_ids: ${sourceIds.join(', ') || '(none)'}`)
      for (const sourceId of sourceIds) {
        const row = intelligenceRowsById.get(sourceId)
        if (!row) {
          console.log(`  - intelligence ${sourceId}: NOT LOADED`)
          continue
        }
        console.log(`  - intelligence ${sourceId}: core_key=${row.core_product_key} status=${row.core_product_group_status} base=${row.is_base_product} variant=${row.variant_name ?? '—'}`)
      }
    }
  }
}

const env = loadEnv()
const args = parseArgs(process.argv)
const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY)

const allProducts = await fetchAllProducts(supabase)
const approved = allProducts.filter((product) => product.status === PRODUCT_STATUS.APPROVED)

const linkedIds = [...new Set(approved.flatMap((product) => product.source_intelligence_row_ids ?? []))]
const linkedIntelligence = await fetchIntelligenceByIds(supabase, linkedIds)
const linkedIntelligenceById = new Map(linkedIntelligence.map((row) => [row.id, row]))

const allApprovedIntelligence = await fetchApprovedIntelligenceGroups(supabase)
const approvedGroupKeys = new Map()
for (const row of allApprovedIntelligence) {
  const key = row.core_product_key
  if (!approvedGroupKeys.has(key)) approvedGroupKeys.set(key, [])
  approvedGroupKeys.get(key).push(row)
}
const multiMemberApprovedGroups = [...approvedGroupKeys.entries()]
  .filter(([, members]) => members.length >= 2)

console.log('Top 100 dedupe diagnostic')
console.log('========================')
console.log(`Raw equipment_products: ${allProducts.length}`)
console.log(`Approved equipment_products: ${approved.length}`)
console.log(`Approved with source_intelligence_row_ids: ${approved.filter((p) => (p.source_intelligence_row_ids ?? []).length > 0).length}`)
console.log(`Approved without source_intelligence_row_ids: ${approved.filter((p) => !(p.source_intelligence_row_ids ?? []).length).length}`)
console.log(`Linked intelligence rows loaded: ${linkedIntelligence.length}`)
console.log(`All approved intelligence rows (DB): ${allApprovedIntelligence.length}`)
console.log(`Approved multi-member core_product_key groups (DB): ${multiMemberApprovedGroups.length}`)

summarizeWatchNames(approved, 'Approved products (raw)')

const afterCanonicalKey = canonicalKeyDedupe(approved)
console.log(`\nAfter canonical_product_key dedupe: ${afterCanonicalKey.length}`)
summarizeWatchNames(afterCanonicalKey, 'After canonical key dedupe')

const analysis = analyzeCanonicalProductDedupe(approved, linkedIntelligenceById)
const afterWorkflow = analysis.products

console.log(`\nWorkflow dedupe stages:`)
console.log(`  raw approved: ${analysis.rawApproved}`)
console.log(`  after core groups: ${analysis.afterCoreGroups}`)
console.log(`  after display identity: ${analysis.afterDisplayIdentity}`)
console.log(`  after workflow: ${analysis.afterWorkflow}`)

summarizeWatchNames(afterWorkflow, 'After full workflow dedupe')

const top100Raw = buildCanonicalProductDisplayGroups(approved, { limit: 100 })
const top100Workflow = buildCanonicalProductDisplayGroups(afterWorkflow, { limit: 100 })

console.log(`\nTop 100 slice (no dedupe): ${top100Raw.length}`)
console.log(`Top 100 slice (workflow dedupe first): ${top100Workflow.length}`)

for (const name of WATCH_NAMES) {
  const raw = top100Raw.filter((g) => g.primary_keyword === name).length
  const workflow = top100Workflow.filter((g) => g.primary_keyword === name).length
  console.log(`${name} in Top100: raw=${raw} workflow=${workflow}`)
}

inspectDuplicates(approved, linkedIntelligenceById, args.name)

// Fail if watch names still duplicated after best dedupe
let failed = false
for (const name of WATCH_NAMES) {
  const count = countByName(afterWorkflow, name).length
  if (count > 1) {
    console.error(`\nFAIL: "${name}" still has ${count} rows after workflow dedupe`)
    failed = true
  }
}

if (failed) process.exit(1)
console.log('\nDiagnostic complete.')
