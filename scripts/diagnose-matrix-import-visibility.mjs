#!/usr/bin/env node
/**
 * Read-only investigation: Matrix rows in intelligence vs products.
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
    let value = trimmed.slice(idx + 1)
    if (
      (value.startsWith('"') && value.endsWith('"'))
      || (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    env[trimmed.slice(0, idx)] = value
  }
  return env
}

async function fetchAll(supabase, table, select, apply = (q) => q) {
  const pageSize = 1000
  let from = 0
  const rows = []
  while (true) {
    let query = supabase.from(table).select(select).range(from, from + pageSize - 1)
    query = apply(query)
    const { data, error } = await query
    if (error) throw error
    rows.push(...(data ?? []))
    if (!data?.length || data.length < pageSize) break
    from += pageSize
  }
  return rows
}

function countBy(rows, keyFn) {
  const map = new Map()
  for (const row of rows) {
    const key = keyFn(row)
    map.set(key, (map.get(key) ?? 0) + 1)
  }
  return Object.fromEntries([...map.entries()].sort((a, b) => String(a[0]).localeCompare(String(b[0]))))
}

async function main() {
  const env = loadEnv()
  const supabase = createClient(
    env.VITE_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY || env.VITE_SUPABASE_ANON_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )

  const intel = await fetchAll(
    supabase,
    'equipment_intelligence',
    'id, brand, series, model, slug, equipment_type, category, confidence, manufacture_year, original_rrp, created_at, updated_at, core_product_key, core_product_group_status, is_base_product, market_sync_status',
    (q) => q.ilike('brand', '%matrix%').order('updated_at', { ascending: false }),
  )

  const products = await fetchAll(
    supabase,
    'equipment_products',
    'id, brand, canonical_product_name, canonical_product_key, status, product_family, model, equipment_type, created_at, updated_at, source_intelligence_row_ids, review_notes',
    (q) => q.ilike('brand', '%matrix%').order('updated_at', { ascending: false }),
  )

  const brandVariants = countBy(intel, (row) => row.brand ?? '(null)')
  const productBrandVariants = countBy(products, (row) => row.brand ?? '(null)')
  const productStatus = countBy(products, (row) => row.status ?? '(null)')
  const intelConfidence = countBy(intel, (row) => row.confidence ?? '(null)')
  const coreStatus = countBy(intel, (row) => row.core_product_group_status ?? '(null)')

  const recentIntel = intel
    .filter((row) => row.created_at || row.updated_at)
    .slice(0, 15)
    .map((row) => ({
      brand: row.brand,
      model: row.model,
      slug: row.slug,
      created_at: row.created_at,
      updated_at: row.updated_at,
      confidence: row.confidence,
      core_product_group_status: row.core_product_group_status,
    }))

  const recentProducts = products.slice(0, 15).map((row) => ({
    brand: row.brand,
    name: row.canonical_product_name,
    status: row.status,
    key: row.canonical_product_key,
    updated_at: row.updated_at,
    created_at: row.created_at,
  }))

  // Newest created intel rows (possible import batch)
  const byCreated = [...intel].sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
  const newestDay = byCreated[0]?.created_at?.slice(0, 10) ?? null
  const createdToday = newestDay
    ? byCreated.filter((row) => String(row.created_at).startsWith(newestDay))
    : []
  const updatedToday = newestDay
    ? intel.filter((row) => String(row.updated_at).startsWith(newestDay))
    : []

  // Group created_at by day for last 14 days of activity
  const createdByDay = countBy(intel, (row) => String(row.created_at ?? '').slice(0, 10) || '(null)')
  const updatedByDay = countBy(intel, (row) => String(row.updated_at ?? '').slice(0, 10) || '(null)')

  // Products created recently
  const productsCreatedByDay = countBy(products, (row) => String(row.created_at ?? '').slice(0, 10) || '(null)')

  // Lifestyle / Endurance / Performance naming (modern Matrix families)
  const modernIntel = intel.filter((row) =>
    /lifestyle|endurance|performance|premium led|touch xl/i.test(
      [row.series, row.model, row.slug].join(' '),
    ),
  )
  const modernProducts = products.filter((row) =>
    /lifestyle|endurance|performance/i.test(
      [row.product_family, row.canonical_product_name, row.model].join(' '),
    ),
  )

  // Check brands table for Matrix
  const { data: brands } = await supabase
    .from('brands')
    .select('id, name, active, slug')
    .ilike('name', '%matrix%')

  const todaysIntel = intel.filter((row) => String(row.created_at).startsWith('2026-07-10'))
  const todaysIds = new Set(todaysIntel.map((row) => row.id))
  const linkedProducts = products.filter((product) =>
    (product.source_intelligence_row_ids ?? []).some((id) => todaysIds.has(id)),
  )
  const productKeys = new Set(products.map((row) => row.canonical_product_key))
  const slugMatchesProduct = todaysIntel.filter((row) => productKeys.has(row.slug))

  console.log(JSON.stringify({
    equipment_intelligence: {
      total_matrix_like: intel.length,
      brand_values: brandVariants,
      confidence: intelConfidence,
      core_product_group_status: coreStatus,
      created_by_day: createdByDay,
      updated_by_day: updatedByDay,
      newest_created_day: newestDay,
      created_on_newest_day: createdToday.length,
      updated_on_newest_day: updatedToday.length,
      modern_family_matches: modernIntel.length,
      sample_recent: recentIntel,
      sample_modern: modernIntel.slice(0, 20).map((row) => ({
        brand: row.brand,
        series: row.series,
        model: row.model,
        slug: row.slug,
        created_at: row.created_at,
      })),
    },
    todays_import_batch: {
      count: todaysIntel.length,
      all_created_equals_updated: todaysIntel.every((row) => row.created_at === row.updated_at),
      rows: todaysIntel
        .slice()
        .sort((a, b) => String(a.series).localeCompare(String(b.series)) || String(a.model).localeCompare(String(b.model)))
        .map((row) => ({
          series: row.series,
          model: row.model,
          slug: row.slug,
          confidence: row.confidence,
          equipment_type: row.equipment_type,
          category: row.category,
          manufacture_year: row.manufacture_year,
          original_rrp: row.original_rrp,
          core_product_group_status: row.core_product_group_status,
        })),
      slug_matches_existing_product_key: slugMatchesProduct.map((row) => row.slug),
      products_linked_via_source_ids: linkedProducts.map((row) => ({
        name: row.canonical_product_name,
        status: row.status,
        key: row.canonical_product_key,
      })),
    },
    equipment_products: {
      total_matrix_like: products.length,
      brand_values: productBrandVariants,
      status: productStatus,
      created_by_day: productsCreatedByDay,
      modern_family_matches: modernProducts.length,
      sample_recent: recentProducts,
      sample_modern: modernProducts.slice(0, 20).map((row) => ({
        brand: row.brand,
        name: row.canonical_product_name,
        status: row.status,
        key: row.canonical_product_key,
      })),
      excluded_count: products.filter((row) => row.status === 'excluded').length,
      approved_count: products.filter((row) => row.status === 'approved').length,
      needs_review_count: products.filter((row) => row.status === 'needs_review').length,
    },
    brands_table: brands ?? [],
    root_cause: {
      csv_target_table: 'equipment_intelligence',
      products_admin_table: 'equipment_products',
      todays_rows_in_intelligence: todaysIntel.length,
      todays_rows_in_products: linkedProducts.length + slugMatchesProduct.length,
      explanation: 'CSV import upserts equipment_intelligence by slug only. Admin Products page lists equipment_products. No canonical products were generated for the new Lifestyle/Endurance/Performance/Onyx rows.',
    },
  }, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
