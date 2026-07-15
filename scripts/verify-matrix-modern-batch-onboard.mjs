#!/usr/bin/env node
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
    let value = trimmed.slice(idx + 1)
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    env[trimmed.slice(0, idx)] = value
  }
  return env
}

async function main() {
  const env = loadEnv()
  const sb = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

  const { count: intelCount } = await sb
    .from('equipment_intelligence')
    .select('*', { count: 'exact', head: true })
    .ilike('brand', 'Matrix Fitness')

  const { data: batch } = await sb
    .from('equipment_intelligence')
    .select('id, series, model, slug, original_rrp, manufacture_year, confidence')
    .ilike('brand', 'Matrix Fitness')
    .gte('created_at', '2026-07-10T16:42:00Z')
    .lte('created_at', '2026-07-10T16:43:00Z')

  const batchIds = new Set((batch ?? []).map((row) => row.id))

  const { data: products } = await sb
    .from('equipment_products')
    .select('id, canonical_product_name, canonical_product_key, status, product_family, model, equipment_type, original_base_price, baseline_manufacture_year, production_start_year, source_intelligence_row_ids, review_notes')
    .ilike('brand', 'Matrix Fitness')
    .order('canonical_product_name')

  const modernAll = (products ?? []).filter((product) =>
    (product.source_intelligence_row_ids ?? []).some((id) => batchIds.has(id)),
  )
  const modern = modernAll.filter((product) => product.status !== 'excluded')

  const byStatus = {}
  for (const product of modernAll) {
    byStatus[product.status] = (byStatus[product.status] ?? 0) + 1
  }

  const rrpOk = modern.filter((p) => p.original_base_price != null).length
  const yearOk = modern.filter((p) => p.baseline_manufacture_year != null).length
  const historicCollision = modern.filter((p) => /t[1357]/i.test(p.canonical_product_key ?? ''))

  console.log(JSON.stringify({
    intelligence_total: intelCount,
    batch_source_rows: batch?.length ?? 0,
    modern_products_active: modern.length,
    modern_products_all_including_excluded: modernAll.length,
    by_status: byStatus,
    rrp_preserved: modern.filter((p) => p.original_base_price != null).length,
    year_preserved: modern.filter((p) => p.baseline_manufacture_year != null).length,
    historic_key_collisions: historicCollision.map((p) => p.canonical_product_key),
    products: modern.map((p) => ({
      name: p.canonical_product_name,
      key: p.canonical_product_key,
      status: p.status,
      family: p.product_family,
      model: p.model,
      type: p.equipment_type,
      rrp: p.original_base_price,
      year: p.baseline_manufacture_year,
      start: p.production_start_year,
      sources: p.source_intelligence_row_ids?.length ?? 0,
      notes: p.review_notes,
    })),
  }, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
