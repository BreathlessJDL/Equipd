/**
 * Generate a compact public valuation search index for autocomplete.
 * Written to public/data so Vite copies it into dist/ without bundling into JS.
 *
 * Usage:
 *   node scripts/generate-valuation-search-index.mjs
 */

import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { gzipSync } from 'node:zlib'
import { createClient } from '@supabase/supabase-js'
import { isPublicBrandCatalogueProduct } from '../src/lib/brandCatalogueCore.js'
import {
  VALUATION_SEARCH_INDEX_FIELDS,
  VALUATION_SEARCH_INDEX_PATH,
  VALUATION_SEARCH_INDEX_VERSION,
  toValuationSearchIndexRow,
} from '../src/lib/valuationSearchIndex.js'
import { getSupabaseEnv, loadLocalEnv } from './lib/loadLocalEnv.mjs'

async function fetchApprovedSearchRows(supabase) {
  const rows = []
  const pageSize = 1000
  // Include status for the public-catalogue filter; stripped from the emitted index.
  const selectFields = [...VALUATION_SEARCH_INDEX_FIELDS, 'status'].join(',')
  let from = 0
  while (true) {
    const { data, error } = await supabase
      .from('equipment_products')
      .select(selectFields)
      .eq('status', 'approved')
      .order('brand')
      .order('canonical_product_name')
      .range(from, from + pageSize - 1)
    if (error) throw error
    if (!data?.length) break
    rows.push(...data)
    if (data.length < pageSize) break
    from += pageSize
  }
  return rows
}

async function main() {
  loadLocalEnv()
  const { url, key } = getSupabaseEnv()
  if (!url || !key) {
    throw new Error('Missing Supabase env for valuation search index generation.')
  }

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const started = performance.now()
  const rows = await fetchApprovedSearchRows(supabase)
  const products = rows
    .filter(isPublicBrandCatalogueProduct)
    .map(toValuationSearchIndexRow)

  const payload = {
    version: VALUATION_SEARCH_INDEX_VERSION,
    generatedAt: new Date().toISOString(),
    count: products.length,
    products,
  }

  const json = `${JSON.stringify(payload)}\n`
  const outDir = join(process.cwd(), 'public', 'data')
  mkdirSync(outDir, { recursive: true })
  const outPath = join(process.cwd(), 'public', VALUATION_SEARCH_INDEX_PATH.replace(/^\//, ''))
  writeFileSync(outPath, json)

  const gzipBytes = gzipSync(json).length
  const elapsedMs = Math.round(performance.now() - started)
  console.log(
    `Wrote ${outPath} with ${products.length} products `
    + `(${Math.round(json.length / 1024)} KB raw, ${Math.round(gzipBytes / 1024)} KB gzip, ${elapsedMs} ms)`,
  )
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
