#!/usr/bin/env node
/**
 * Audit / repair Technogym Element+ near-duplicates and -ifi twins.
 *
 * Dry-run (default):
 *   node scripts/audit-plus-canonical-duplicates.mjs
 *   node scripts/audit-plus-canonical-duplicates.mjs --brand Technogym
 *
 * Apply safe merges only (--apply). Safe classes:
 *   - exact Element+/Excite+ twins that differ only by a trailing `-ifi` key
 *   - same display model where one row is a clear incomplete twin of Element+
 *
 * Element vs Element+ (different families) are reported but NOT auto-merged
 * unless --merge-element-family is passed.
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

function loadEnv() {
  const text = readFileSync(join(process.cwd(), '.env.local'), 'utf8')
  const env = {}
  for (const line of text.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const idx = trimmed.indexOf('=')
    if (idx === -1) continue
    env[trimmed.slice(0, idx)] = trimmed.slice(idx + 1).replace(/^["']|["']$/g, '')
  }
  return env
}

function parseArgs(argv) {
  const args = {
    brand: 'Technogym',
    apply: false,
    mergeElementFamily: false,
  }
  for (let i = 2; i < argv.length; i += 1) {
    const token = argv[i]
    if (token === '--apply') args.apply = true
    else if (token === '--dry-run') args.apply = false
    else if (token === '--merge-element-family') args.mergeElementFamily = true
    else if (token === '--brand') {
      args.brand = argv[i + 1] ?? args.brand
      i += 1
    }
  }
  return args
}

function normalizeModelToken(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/\+/g, ' plus ')
    .replace(/\b(technogym|series)\b/g, ' ')
    .replace(/\b(element|excite)\s*(plus)?\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function stripIfi(key) {
  return String(key || '').replace(/-ifi$/i, '')
}

function scoreSurvivor(product, contentById, consoleCountById) {
  let score = 0
  const content = contentById[product.id]
  if (product.status === 'approved') score += 40
  if (product.status === 'needs_review') score += 10
  if (product.original_base_price != null) score += 20
  if (product.baseline_manufacture_year != null) score += 10
  if (product.image_storage_path || product.image_url) score += 15
  if (content?.generation_status === 'approved') score += 25
  if (content?.generation_status === 'draft') score += 8
  score += (product.source_intelligence_row_ids?.length || 0) * 2
  score += (consoleCountById[product.id] || 0) * 3
  if (!/-ifi$/i.test(product.canonical_product_key || '')) score += 12
  if (/\+|plus/i.test(product.product_family || '') || /\+|plus/i.test(product.canonical_product_name || '')) {
    score += 8
  }
  if (product.equipment_type) score += 5
  return score
}

function classifyPair(left, right) {
  const leftKey = stripIfi(left.canonical_product_key)
  const rightKey = stripIfi(right.canonical_product_key)
  if (leftKey && leftKey === rightKey && left.canonical_product_key !== right.canonical_product_key) {
    return 'ifi_twin'
  }

  const leftFamily = String(left.product_family || '').toLowerCase()
  const rightFamily = String(right.product_family || '').toLowerCase()
  const leftPlus = /\+|plus/.test(leftFamily) || /\+|plus/.test(left.canonical_product_name || '')
  const rightPlus = /\+|plus/.test(rightFamily) || /\+|plus/.test(right.canonical_product_name || '')
  const leftModel = normalizeModelToken(left.canonical_product_name)
  const rightModel = normalizeModelToken(right.canonical_product_name)
  if (leftModel && leftModel === rightModel && leftPlus !== rightPlus) {
    return 'element_vs_element_plus'
  }
  if (leftModel && leftModel === rightModel && leftPlus && rightPlus) {
    return 'same_plus_near_duplicate'
  }
  return null
}

const args = parseArgs(process.argv)
const env = loadEnv()
const sb = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const { data: products, error } = await sb
  .from('equipment_products')
  .select('id,brand,product_family,model,equipment_type,canonical_product_name,canonical_product_key,status,original_base_price,baseline_manufacture_year,source_intelligence_row_ids,image_url,image_storage_path,review_notes')
  .ilike('brand', args.brand)
  .neq('status', 'excluded')
  .order('canonical_product_name')

if (error) throw error

const candidates = (products || []).filter((product) => {
  const hay = [product.canonical_product_name, product.product_family, product.model, product.canonical_product_key].join(' ')
  return /\b(element|excite)\b/i.test(hay)
})

const productIds = candidates.map((p) => p.id)
const contentById = {}
const consoleCountById = {}

for (let i = 0; i < productIds.length; i += 80) {
  const chunk = productIds.slice(i, i + 80)
  const { data: contentRows } = await sb
    .from('equipment_product_content')
    .select('equipment_product_id,generation_status')
    .in('equipment_product_id', chunk)
  for (const row of contentRows || []) contentById[row.equipment_product_id] = row

  const { data: consoleRows } = await sb
    .from('product_console_options')
    .select('product_id')
    .in('product_id', chunk)
  for (const row of consoleRows || []) {
    consoleCountById[row.product_id] = (consoleCountById[row.product_id] || 0) + 1
  }
}

const groups = new Map()

// Cluster 1: -ifi twins
for (const product of candidates) {
  const base = stripIfi(product.canonical_product_key)
  if (!base || base === product.canonical_product_key) continue
  const twin = candidates.find((other) => other.id !== product.id && other.canonical_product_key === base)
  if (!twin) continue
  const clusterKey = `ifi:${base}`
  if (!groups.has(clusterKey)) groups.set(clusterKey, { class: 'ifi_twin', products: [] })
  const bucket = groups.get(clusterKey).products
  if (!bucket.some((row) => row.id === product.id)) bucket.push(product)
  if (!bucket.some((row) => row.id === twin.id)) bucket.push(twin)
}

// Cluster 2: model-normalised near duplicates within Element/Excite
const byModel = new Map()
for (const product of candidates) {
  const model = normalizeModelToken(product.canonical_product_name)
  if (!model) continue
  if (!byModel.has(model)) byModel.set(model, [])
  byModel.get(model).push(product)
}

for (const [model, group] of byModel.entries()) {
  if (group.length < 2) continue
  const classHint = classifyPair(group[0], group[1])
  if (!classHint) continue
  const clusterKey = `${classHint}:${model}`
  if (groups.has(clusterKey)) continue
  groups.set(clusterKey, { class: classHint, products: group })
}

function pickSurvivor(group) {
  return [...group].sort((left, right) => {
    const diff = scoreSurvivor(right, contentById, consoleCountById)
      - scoreSurvivor(left, contentById, consoleCountById)
    if (diff !== 0) return diff
    return String(left.canonical_product_key).localeCompare(String(right.canonical_product_key))
  })[0]
}

const reportGroups = []
const merges = []

for (const [clusterKey, entry] of groups.entries()) {
  if (entry.products.length < 2) continue
  const survivor = pickSurvivor(entry.products)
  const losers = entry.products.filter((product) => product.id !== survivor.id)
  const autoMerge = entry.class === 'ifi_twin'

  const row = {
    brand: survivor.brand,
    cluster_key: clusterKey,
    class: entry.class,
    auto_merge_eligible: autoMerge,
    survivor: {
      id: survivor.id,
      name: survivor.canonical_product_name,
      key: survivor.canonical_product_key,
      status: survivor.status,
      price: survivor.original_base_price,
      year: survivor.baseline_manufacture_year,
      sources: survivor.source_intelligence_row_ids?.length || 0,
      content: contentById[survivor.id]?.generation_status || 'missing',
      image: Boolean(survivor.image_storage_path || survivor.image_url),
      consoles: consoleCountById[survivor.id] || 0,
      score: scoreSurvivor(survivor, contentById, consoleCountById),
    },
    duplicates: losers.map((product) => ({
      id: product.id,
      name: product.canonical_product_name,
      key: product.canonical_product_key,
      status: product.status,
      price: product.original_base_price,
      year: product.baseline_manufacture_year,
      sources: product.source_intelligence_row_ids?.length || 0,
      content: contentById[product.id]?.generation_status || 'missing',
      image: Boolean(product.image_storage_path || product.image_url),
      consoles: consoleCountById[product.id] || 0,
      score: scoreSurvivor(product, contentById, consoleCountById),
      recommended_action: autoMerge
        ? 'merge_into_survivor_then_exclude'
        : 'manual_review_element_vs_element_plus',
      url_plan: autoMerge
        ? 'exclude loser; keep loser key noted in review_notes for optional redirect/alias'
        : 'do not auto-merge; Element and Element+ may be adjacent generations',
    })),
  }
  reportGroups.push(row)
  if (autoMerge) merges.push({ survivor, losers, class: entry.class })
}

const report = {
  mode: args.apply ? 'apply' : 'dry-run',
  brand_filter: args.brand,
  merge_element_family: args.mergeElementFamily,
  candidate_count: candidates.length,
  duplicate_group_count: reportGroups.length,
  auto_merge_group_count: merges.length,
  groups: reportGroups,
}

console.log(JSON.stringify(report, null, 2))

if (!args.apply) {
  console.error('\nDry-run only. Pass --apply to merge eligible groups. Element vs Element+ requires --merge-element-family.')
  process.exit(0)
}

const applied = []
for (const { survivor, losers, class: mergeClass } of merges) {
  const mergedSourceIds = new Set(survivor.source_intelligence_row_ids || [])
  for (const loser of losers) {
    for (const id of loser.source_intelligence_row_ids || []) mergedSourceIds.add(id)
  }

  const survivorPatch = {
    source_intelligence_row_ids: [...mergedSourceIds],
    updated_at: new Date().toISOString(),
  }
  if (survivor.original_base_price == null) {
    const priced = losers.find((row) => row.original_base_price != null)
    if (priced) survivorPatch.original_base_price = priced.original_base_price
  }
  if (!survivor.image_storage_path && !survivor.image_url) {
    const imaged = losers.find((row) => row.image_storage_path || row.image_url)
    if (imaged?.image_storage_path) survivorPatch.image_storage_path = imaged.image_storage_path
    if (imaged?.image_url) survivorPatch.image_url = imaged.image_url
  }

  const { error: survivorError } = await sb
    .from('equipment_products')
    .update(survivorPatch)
    .eq('id', survivor.id)
  if (survivorError) throw survivorError

  for (const loser of losers) {
    const survivorContent = contentById[survivor.id]
    const loserContent = contentById[loser.id]
    if ((!survivorContent || survivorContent.generation_status === 'failed') && loserContent) {
      const { error: moveContentError } = await sb
        .from('equipment_product_content')
        .update({
          equipment_product_id: survivor.id,
          updated_at: new Date().toISOString(),
        })
        .eq('equipment_product_id', loser.id)
      if (moveContentError && !/duplicate|unique/i.test(moveContentError.message)) {
        throw moveContentError
      }
    }

    const { error: consoleMoveError } = await sb
      .from('product_console_options')
      .update({ product_id: survivor.id })
      .eq('product_id', loser.id)
    if (consoleMoveError && !/duplicate|unique/i.test(consoleMoveError.message)) {
      throw consoleMoveError
    }

    const note = [
      `[duplicate_merge ${new Date().toISOString().slice(0, 10)}] class=${mergeClass}`,
      `merged into survivor ${survivor.id} (${survivor.canonical_product_key}).`,
      `legacy_key=${loser.canonical_product_key}`,
      loser.review_notes || '',
    ].filter(Boolean).join(' ')

    const { error: excludeError } = await sb
      .from('equipment_products')
      .update({
        status: 'excluded',
        review_notes: note,
        updated_at: new Date().toISOString(),
      })
      .eq('id', loser.id)
    if (excludeError) throw excludeError

    applied.push({
      class: mergeClass,
      survivor_id: survivor.id,
      excluded_id: loser.id,
      legacy_key: loser.canonical_product_key,
      survivor_key: survivor.canonical_product_key,
    })
  }
}

console.error(JSON.stringify({ applied_merges: applied.length, applied }, null, 2))
