#!/usr/bin/env node
/**
 * Before/after list for Precor Discovery Series → Discovery display rename.
 * Display-layer only; keys/URLs unchanged.
 *
 *   node scripts/audit-precor-discovery-rename.mjs
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  formatPublicCanonicalProductDisplayName,
  normalizePublicSeriesDisplayLabel,
  getBrandPagePath,
} from '../src/lib/brandCatalogueCore.js'

function buildEquipmentProductPagePath(canonicalProductKey) {
  const key = String(canonicalProductKey || '').trim()
  return key ? `/equipment/${key}` : null
}

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

const env = loadEnv()
const sb = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const { data: products, error } = await sb
  .from('equipment_products')
  .select('id,brand,product_family,model,canonical_product_name,canonical_product_key,status,equipment_type')
  .ilike('brand', 'Precor')
  .or('product_family.ilike.%discovery%,canonical_product_name.ilike.%discovery%,canonical_product_key.ilike.%discovery%')
  .order('canonical_product_name')

if (error) throw error

const affected = (products || []).filter((product) => {
  const hay = [product.product_family, product.canonical_product_name, product.canonical_product_key].join(' ')
  return /discovery/i.test(hay)
})

const rows = affected.map((product) => {
  const beforeName = product.canonical_product_name
  const afterName = formatPublicCanonicalProductDisplayName(product)
  const beforeSeries = product.product_family
  const afterSeries = normalizePublicSeriesDisplayLabel(product.brand, product.product_family)
  return {
    id: product.id,
    status: product.status,
    before: {
      canonical_product_name: beforeName,
      product_family: beforeSeries,
      canonical_product_key: product.canonical_product_key,
      public_path: buildEquipmentProductPagePath(product.canonical_product_key),
    },
    after_display: {
      canonical_product_name: afterName,
      product_family: afterSeries,
      canonical_product_key: product.canonical_product_key,
      public_path: buildEquipmentProductPagePath(product.canonical_product_key),
      note: 'URLs/keys unchanged; display label only',
    },
    name_changed: beforeName !== afterName,
    series_changed: beforeSeries !== afterSeries,
  }
})

console.log(JSON.stringify({
  brand_page: getBrandPagePath('Precor'),
  affected_count: rows.length,
  display_name_changes: rows.filter((row) => row.name_changed).length,
  series_label_changes: rows.filter((row) => row.series_changed).length,
  url_strategy: 'Keep existing discovery / discovery-series keys and paths stable; no redirects required for display rename.',
  products: rows,
}, null, 2))
