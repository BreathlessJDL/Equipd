#!/usr/bin/env node
/**
 * Deferred Element vs Element+ review report (no merges).
 * Also lists applied -ifi exclusions for URL follow-up.
 */
import { createClient } from '@supabase/supabase-js'
import { writeFileSync, readFileSync } from 'node:fs'
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

const env = loadEnv()
const sb = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const { data: products, error } = await sb
  .from('equipment_products')
  .select('id,status,canonical_product_name,canonical_product_key,product_family,model,equipment_type,original_base_price,baseline_manufacture_year,image_storage_path,image_url,source_intelligence_row_ids,review_notes')
  .ilike('brand', 'Technogym')
  .or('product_family.ilike.%element%,canonical_product_name.ilike.%element%')
  .order('canonical_product_name')

if (error) throw error

const rows = products || []
const active = rows.filter((p) => p.status !== 'excluded')
const byModel = new Map()
for (const product of active) {
  const model = normalizeModelToken(product.canonical_product_name)
  if (!model) continue
  if (!byModel.has(model)) byModel.set(model, [])
  byModel.get(model).push(product)
}

const deferred = []
for (const [model, group] of byModel.entries()) {
  if (group.length < 2) continue
  const element = group.filter((p) => /\belement\b/i.test(p.product_family || '') && !/\+|plus/i.test(p.product_family || ''))
  const elementPlus = group.filter((p) => /\belement\b/i.test(p.product_family || '') && /\+|plus/i.test(p.product_family || ''))
  if (!element.length || !elementPlus.length) continue

  const ids = group.map((p) => p.id)
  const { data: contentRows } = await sb
    .from('equipment_product_content')
    .select('equipment_product_id,generation_status')
    .in('equipment_product_id', ids)
  const contentById = Object.fromEntries((contentRows || []).map((r) => [r.equipment_product_id, r]))

  deferred.push({
    model_token: model,
    element: element.map((p) => ({
      id: p.id,
      name: p.canonical_product_name,
      key: p.canonical_product_key,
      status: p.status,
      year: p.baseline_manufacture_year,
      rrp: p.original_base_price,
      content: contentById[p.id]?.generation_status || 'missing',
      image: Boolean(p.image_storage_path || p.image_url),
      sources: p.source_intelligence_row_ids?.length || 0,
    })),
    element_plus: elementPlus.map((p) => ({
      id: p.id,
      name: p.canonical_product_name,
      key: p.canonical_product_key,
      status: p.status,
      year: p.baseline_manufacture_year,
      rrp: p.original_base_price,
      content: contentById[p.id]?.generation_status || 'missing',
      image: Boolean(p.image_storage_path || p.image_url),
      sources: p.source_intelligence_row_ids?.length || 0,
    })),
    recommendation: 'defer_manual_review_do_not_auto_merge',
  })
}

const { data: ifiExcluded } = await sb
  .from('equipment_products')
  .select('id,status,canonical_product_name,canonical_product_key,review_notes')
  .ilike('brand', 'Technogym')
  .eq('status', 'excluded')
  .ilike('review_notes', '%class=ifi_twin%')

const ifiMappings = (ifiExcluded || []).map((row) => {
  const survivorMatch = String(row.review_notes || '').match(/merged into survivor ([0-9a-f-]+) \(([^)]+)\)/)
  return {
    loser_id: row.id,
    loser_name: row.canonical_product_name,
    loser_key: row.canonical_product_key,
    loser_path: `/equipment/${row.canonical_product_key}`,
    survivor_id: survivorMatch?.[1] || null,
    survivor_key: survivorMatch?.[2] || null,
    survivor_path: survivorMatch?.[2] ? `/equipment/${survivorMatch[2]}` : null,
  }
})

const report = {
  generated_at: new Date().toISOString(),
  deferred_element_vs_element_plus_count: deferred.length,
  deferred_groups: deferred,
  applied_ifi_exclusions: ifiMappings,
  safety_confirmation: {
    merge_element_family_not_run: true,
    catalogue_rebuild_not_run: true,
    additional_exclusions_this_step: 0,
  },
}

const outPath = join(process.cwd(), 'reports', 'technogym-element-vs-element-plus-deferred.json')
writeFileSync(outPath, JSON.stringify(report, null, 2))
console.log(JSON.stringify({
  wrote: outPath,
  deferred_count: deferred.length,
  ifi_exclusion_count: ifiMappings.length,
}, null, 2))
