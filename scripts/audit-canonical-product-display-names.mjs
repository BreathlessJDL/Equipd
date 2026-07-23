/**
 * Audit / optionally repair duplicated wording in equipment_products.canonical_product_name.
 *
 * Usage:
 *   node scripts/audit-canonical-product-display-names.mjs --dry-run
 *   node scripts/audit-canonical-product-display-names.mjs --dry-run --brand "ProForm"
 *   node scripts/audit-canonical-product-display-names.mjs --apply-safe
 *   node scripts/audit-canonical-product-display-names.mjs --apply-safe --brand "Sole"
 *
 * Default mode is --dry-run (no writes).
 * Never changes canonical_product_key / slugs.
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import {
  evaluateCanonicalProductDisplayName,
  normalizeDisplayNameText,
} from '../src/lib/canonicalProductDisplayName.js'

function loadEnvLocal() {
  try {
    const raw = readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    const env = {}
    for (const line of raw.split(/\r?\n/)) {
      if (!line || line.startsWith('#')) continue
      const index = line.indexOf('=')
      if (index < 0) continue
      const key = line.slice(0, index).trim()
      let value = line.slice(index + 1).trim()
      if (
        (value.startsWith('"') && value.endsWith('"'))
        || (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1)
      }
      env[key] = value
    }
    return env
  } catch {
    return {}
  }
}

function parseArgs(argv) {
  const options = {
    dryRun: true,
    applySafe: false,
    brand: null,
  }
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--dry-run') options.dryRun = true
    if (arg === '--apply-safe') {
      options.applySafe = true
      options.dryRun = false
    }
    if (arg === '--brand') {
      options.brand = argv[i + 1] ?? null
      i += 1
    }
  }
  return options
}

async function fetchProducts(supabase, brandFilter) {
  const pageSize = 1000
  let from = 0
  const products = []
  while (true) {
    let query = supabase
      .from('equipment_products')
      .select('id, brand, product_family, model, canonical_product_name, canonical_product_key, status')
      .order('brand', { ascending: true })
      .range(from, from + pageSize - 1)
    if (brandFilter) {
      query = query.ilike('brand', brandFilter)
    }
    const { data, error } = await query
    if (error) throw error
    const batch = data || []
    products.push(...batch)
    if (batch.length < pageSize) break
    from += pageSize
  }
  return products
}

const options = parseArgs(process.argv.slice(2))
const env = { ...process.env, ...loadEnvLocal() }
const url = env.VITE_SUPABASE_URL || env.SUPABASE_URL
const key = env.SUPABASE_SERVICE_ROLE_KEY
  || env.VITE_SUPABASE_SERVICE_ROLE_KEY
  || env.VITE_SUPABASE_ANON_KEY
  || env.SUPABASE_ANON_KEY

if (!url || !key) {
  console.error('Missing Supabase URL/key in env (.env.local).')
  process.exit(1)
}

const supabase = createClient(url, key)
const products = await fetchProducts(supabase, options.brand)
const findings = []

for (const product of products) {
  const evaluation = evaluateCanonicalProductDisplayName(product)
  if (!evaluation.changed) continue
  findings.push({
    id: product.id,
    brand: product.brand,
    series: product.product_family,
    model: product.model,
    current_name: evaluation.current,
    proposed_name: evaluation.proposed,
    reason: evaluation.reasons.join('|') || 'differs_from_rebuilt_name',
    safe_to_update: evaluation.safeToUpdate,
    canonical_product_key: product.canonical_product_key,
  })
}

const safe = findings.filter((row) => row.safe_to_update)
const ambiguous = findings.filter((row) => !row.safe_to_update)

console.log(JSON.stringify({
  mode: options.applySafe ? 'apply-safe' : 'dry-run',
  brand_filter: options.brand,
  scanned: products.length,
  affected: findings.length,
  safe_update_count: safe.length,
  ambiguous_count: ambiguous.length,
  examples: findings.slice(0, 25),
}, null, 2))

if (options.applySafe) {
  if (!env.SUPABASE_SERVICE_ROLE_KEY && !env.VITE_SUPABASE_SERVICE_ROLE_KEY) {
    console.error('--apply-safe requires SUPABASE_SERVICE_ROLE_KEY (admin write).')
    process.exit(1)
  }

  let updated = 0
  const failures = []
  for (const row of safe) {
    const { error } = await supabase
      .from('equipment_products')
      .update({
        canonical_product_name: row.proposed_name,
        updated_at: new Date().toISOString(),
      })
      .eq('id', row.id)
      .eq('canonical_product_key', row.canonical_product_key)

    if (error) {
      failures.push({ id: row.id, error: error.message })
      continue
    }
    updated += 1
  }

  console.log(JSON.stringify({
    applied: updated,
    failed: failures.length,
    failures: failures.slice(0, 20),
    note: 'canonical_product_key / slugs were not modified',
  }, null, 2))
} else {
  console.log(`dry-run complete — ${safe.length} safe, ${ambiguous.length} ambiguous (no writes)`)
}

// Keep normalize helper referenced for future CSV exports of reasons.
void normalizeDisplayNameText
