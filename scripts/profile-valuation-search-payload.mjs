/**
 * Profile full vs compact valuation search payloads.
 */
import { writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { getSupabaseEnv, loadLocalEnv } from './lib/loadLocalEnv.mjs'

const FULL_FIELDS = [
  'id', 'brand', 'product_family', 'model', 'equipment_type',
  'canonical_product_name', 'canonical_product_key',
  'baseline_manufacture_year', 'production_start_year', 'production_end_year',
  'original_base_price', 'original_base_price_currency',
  'original_price_source', 'original_price_source_url', 'baseline_source',
  'original_price_confidence', 'lifecycle_confidence',
  'source_intelligence_row_ids', 'status', 'review_notes',
  'image_url', 'image_storage_path', 'image_source_url', 'image_source_domain',
  'image_confidence', 'image_status', 'image_failure_reason',
  'image_updated_at', 'image_reviewed_at', 'image_reviewed_by',
  'approved_image_candidate_id', 'created_at', 'updated_at',
].join(',')

const COMPACT_FIELDS = [
  'id', 'brand', 'product_family', 'model', 'equipment_type',
  'canonical_product_name', 'canonical_product_key',
  'baseline_manufacture_year', 'production_start_year', 'production_end_year',
  'original_base_price', 'original_base_price_currency',
  'image_url', 'image_storage_path', 'image_status',
].join(',')

async function fetchAll(supabase, fields) {
  const rows = []
  const pageSize = 1000
  let from = 0
  const t0 = performance.now()
  while (true) {
    const { data, error } = await supabase
      .from('equipment_products')
      .select(fields)
      .eq('status', 'approved')
      .order('brand')
      .range(from, from + pageSize - 1)
    if (error) throw error
    if (!data?.length) break
    rows.push(...data)
    if (data.length < pageSize) break
    from += pageSize
  }
  return { rows, ms: Math.round(performance.now() - t0) }
}

function toCompact(row) {
  return {
    id: row.id,
    brand: row.brand,
    product_family: row.product_family,
    model: row.model,
    equipment_type: row.equipment_type,
    canonical_product_name: row.canonical_product_name,
    canonical_product_key: row.canonical_product_key,
    baseline_manufacture_year: row.baseline_manufacture_year,
    production_start_year: row.production_start_year,
    production_end_year: row.production_end_year,
    original_base_price: row.original_base_price,
    original_base_price_currency: row.original_base_price_currency,
    image_url: row.image_url,
    image_storage_path: row.image_storage_path,
    image_status: row.image_status,
  }
}

async function main() {
  loadLocalEnv()
  const { url, key } = getSupabaseEnv()
  const supabase = createClient(url, key, { auth: { persistSession: false } })

  const full = await fetchAll(supabase, FULL_FIELDS)
  const compactOnly = await fetchAll(supabase, COMPACT_FIELDS)

  const fullJson = JSON.stringify(full.rows)
  const compactPayload = {
    version: 1,
    generatedAt: new Date().toISOString(),
    count: compactOnly.rows.length,
    products: compactOnly.rows.map(toCompact),
  }
  const compactJson = JSON.stringify(compactPayload)

  const report = {
    count: full.rows.length,
    fullFetchMs: full.ms,
    compactFetchMs: compactOnly.ms,
    fullBytes: fullJson.length,
    fullKB: Math.round(fullJson.length / 1024),
    compactBytes: compactJson.length,
    compactKB: Math.round(compactJson.length / 1024),
    ratio: Number((compactJson.length / fullJson.length).toFixed(3)),
  }

  mkdirSync(join(process.cwd(), 'reports'), { recursive: true })
  writeFileSync(
    join(process.cwd(), 'reports', 'valuation-search-index-profile.json'),
    JSON.stringify(report, null, 2),
  )
  console.log(JSON.stringify(report, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
