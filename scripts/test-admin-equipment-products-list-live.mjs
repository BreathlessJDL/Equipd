#!/usr/bin/env node
/**
 * Live integration checks for admin_list_equipment_products pagination.
 * Requires admin session env:
 *   VITE_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY (or admin user JWT via SUPABASE_ACCESS_TOKEN)
 *
 * Skips cleanly when credentials are unavailable.
 */

import { createClient } from '@supabase/supabase-js'
import { existsSync, readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

function loadEnvFile(relativePath) {
  const path = join(ROOT, relativePath)
  if (!existsSync(path)) return
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const index = trimmed.indexOf('=')
    if (index === -1) continue
    const key = trimmed.slice(0, index).trim()
    const value = trimmed.slice(index + 1).trim().replace(/^['"]|['"]$/g, '')
    if (!process.env[key]) process.env[key] = value
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

async function listPage(client, args) {
  const { data, error } = await client.rpc('admin_list_equipment_products', args)
  if (error) throw error
  return data
}

async function main() {
  loadEnvFile('.env.local')
  loadEnvFile('.env')

  const url = process.env.VITE_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY
  const accessToken = process.env.SUPABASE_ACCESS_TOKEN

  if (!url || !(serviceKey || (anonKey && accessToken))) {
    console.log('SKIP: admin list RPC live test (no Supabase admin credentials)')
    return
  }

  const client = createClient(url, serviceKey || anonKey, {
    global: accessToken && !serviceKey
      ? { headers: { Authorization: `Bearer ${accessToken}` } }
      : undefined,
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const started = Date.now()
  const first = await listPage(client, {
    p_page: 1,
    p_page_size: 50,
    p_sort: 'canonical_product_name',
    p_sort_dir: 'asc',
  })
  const firstMs = Date.now() - started

  assert(Array.isArray(first.rows), 'first page rows missing')
  assert(first.rows.length <= 50, 'first page returned more than page size')
  assert(typeof first.total_count === 'number', 'total_count missing')
  assert(first.page_size === 50, 'page_size mismatch')

  const total = first.total_count
  const lastPage = Math.max(1, Math.ceil(total / 50))
  const middlePage = Math.max(1, Math.floor(lastPage / 2))

  const middle = await listPage(client, {
    p_page: middlePage,
    p_page_size: 50,
  })
  const last = await listPage(client, {
    p_page: lastPage,
    p_page_size: 50,
  })
  const beyond = await listPage(client, {
    p_page: lastPage + 5,
    p_page_size: 50,
  })

  assert(middle.rows.length <= 50, 'middle page oversized')
  assert(last.rows.length <= 50, 'last page oversized')
  assert(beyond.rows.length === 0, 'out-of-range page should be empty')
  assert(beyond.total_count === total, 'out-of-range must preserve total')

  const oversized = await listPage(client, {
    p_page: 1,
    p_page_size: 500,
  })
  assert(oversized.page_size === 100, 'max page size must clamp to 100')
  assert(oversized.rows.length <= 100, 'oversized request returned too many rows')

  const peloton = await listPage(client, {
    p_page: 1,
    p_page_size: 50,
    p_brand: 'Peloton',
  })
  assert(peloton.total_count >= 1, 'Peloton brand filter should return products')
  assert(peloton.rows.every((row) => row.brand === 'Peloton'), 'Peloton filter leaked other brands')

  const nordic = await listPage(client, {
    p_page: 1,
    p_page_size: 50,
    p_search: 'NordicTrack',
  })
  assert(nordic.total_count >= 1, 'NordicTrack search should return products')

  const bowflex = await listPage(client, {
    p_page: 1,
    p_page_size: 50,
    p_brand: 'BowFlex',
  })
  assert(bowflex.total_count >= 1, 'BowFlex brand filter should return products')

  const missingPrice = await listPage(client, {
    p_page: 1,
    p_page_size: 25,
    p_completion: 'missing_price',
  })
  assert(
    missingPrice.rows.every((row) => row.completion_status === 'missing_price'),
    'completion filter mismatch',
  )

  const sample = first.rows[0]
  assert(sample?.id, 'sample row missing id')
  assert(!('faq_json' in sample), 'list payload must not include faq_json')
  assert(!('overview_text' in sample), 'list payload must not include overview_text')
  assert('content_generation_status' in sample, 'list payload missing content status')
  assert('source_row_count' in sample, 'list payload missing source_row_count')
  assert('image_reviewed_at' in sample, 'list payload missing image_reviewed_at')
  assert('approved_image_candidate_id' in sample, 'list payload missing approved_image_candidate_id')
  assert('latest_image_candidate_score' in sample, 'list payload missing latest image candidate score')

  const metaStarted = Date.now()
  const { data: meta, error: metaError } = await client.rpc('admin_equipment_products_dashboard_meta')
  if (metaError) throw metaError
  const metaMs = Date.now() - metaStarted
  assert(meta?.summary?.total === total || meta?.summary?.total >= total - 5, 'meta total roughly matches list')
  assert(Array.isArray(meta?.filterOptions?.brands), 'filter brands missing')
  assert(meta.filterOptions.brands.includes('Peloton'), 'Peloton missing from brand options')

  console.log(JSON.stringify({
    total,
    firstPageRows: first.rows.length,
    middlePage,
    middleRows: middle.rows.length,
    lastPage,
    lastRows: last.rows.length,
    firstPageMs: firstMs,
    metaMs,
    peloton: peloton.total_count,
    nordicTrackSearch: nordic.total_count,
    bowflex: bowflex.total_count,
  }, null, 2))
  console.log('PASS: admin_list_equipment_products live checks')
}

main().catch((error) => {
  console.error(error.message || error)
  process.exitCode = 1
})
