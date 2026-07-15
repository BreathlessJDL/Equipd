#!/usr/bin/env node
/**
 * Fix Wattbike (and any) product names where product_family repeats the model.
 * e.g. "Wattbike Atom Atom" → "Wattbike Atom"
 *
 * Usage:
 *   node scripts/fix-repeated-product-family-names.mjs --dry-run
 *   node scripts/fix-repeated-product-family-names.mjs --apply
 *   node scripts/fix-repeated-product-family-names.mjs --apply --brand Wattbike
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { buildCoreProductName } from '../src/lib/intelligenceCoreProductGrouping.js'

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

function parseArgs(argv) {
  const args = { dryRun: true, apply: false, brand: null }
  for (let i = 2; i < argv.length; i += 1) {
    if (argv[i] === '--apply') {
      args.apply = true
      args.dryRun = false
    } else if (argv[i] === '--dry-run') {
      args.dryRun = true
      args.apply = false
    } else if (argv[i] === '--brand') {
      args.brand = argv[i + 1] ?? null
      i += 1
    }
  }
  return args
}

async function fetchAll(supabase, brand) {
  const pageSize = 1000
  const rows = []
  for (let from = 0; ; from += pageSize) {
    let query = supabase
      .from('equipment_products')
      .select('id, brand, canonical_product_name, product_family, model')
      .range(from, from + pageSize - 1)
    if (brand) query = query.ilike('brand', brand)
    const { data, error } = await query
    if (error) throw error
    rows.push(...(data ?? []))
    if ((data ?? []).length < pageSize) break
  }
  return rows
}

async function main() {
  const args = parseArgs(process.argv)
  const env = loadEnv()
  const supabase = createClient(
    env.VITE_SUPABASE_URL || env.SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )

  const products = await fetchAll(supabase, args.brand)
  const changes = []
  for (const product of products) {
    const nextName = buildCoreProductName(
      product.brand,
      product.product_family,
      product.model,
    )
    if (!nextName || nextName === product.canonical_product_name) continue
    changes.push({
      id: product.id,
      brand: product.brand,
      before: product.canonical_product_name,
      after: nextName,
      product_family: product.product_family,
      model: product.model,
    })
  }

  mkdirSync(join(process.cwd(), 'reports'), { recursive: true })
  writeFileSync(
    join(process.cwd(), 'reports', 'fix-repeated-product-family-names.json'),
    `${JSON.stringify({ mode: args.dryRun ? 'dry-run' : 'apply', count: changes.length, changes }, null, 2)}\n`,
  )

  console.log(`Mode: ${args.dryRun ? 'dry-run' : 'apply'}`)
  console.log(`Changes: ${changes.length}`)
  for (const row of changes) {
    console.log(`  ${row.before}  →  ${row.after}`)
  }

  if (args.dryRun) {
    console.log('Dry-run only. Pass --apply to write.')
    return
  }

  for (const row of changes) {
    const { error } = await supabase
      .from('equipment_products')
      .update({
        canonical_product_name: row.after,
        updated_at: new Date().toISOString(),
      })
      .eq('id', row.id)
    if (error) throw error
  }
  console.log(`Updated ${changes.length} products.`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
