#!/usr/bin/env node
/**
 * Seed Concept2 console master + product_console_compat mappings.
 *
 * Usage:
 *   node scripts/seed-concept2-console-compat.mjs
 *   node scripts/seed-concept2-console-compat.mjs --apply
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  CONCEPT2_BRAND,
  CONCEPT2_COMPAT_BY_PRODUCT_KEY,
  CONCEPT2_CONSOLE_DEFS,
  CONCEPT2_UNRESOLVED_PRODUCTS,
} from '../src/lib/concept2ConsoleCompat.js'

function loadEnv() {
  const path = join(process.cwd(), '.env.local')
  const text = readFileSync(path, 'utf8')
  const env = {}
  for (const line of text.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const idx = trimmed.indexOf('=')
    if (idx === -1) continue
    env[trimmed.slice(0, idx)] = trimmed.slice(idx + 1)
  }
  return env
}

function parseArgs(argv) {
  const args = { dryRun: true, apply: false }
  for (let index = 2; index < argv.length; index += 1) {
    const token = argv[index]
    if (token === '--apply') {
      args.apply = true
      args.dryRun = false
    }
  }
  return args
}

async function main() {
  const args = parseArgs(process.argv)
  const env = loadEnv()
  const url = env.VITE_SUPABASE_URL
  const key = env.SUPABASE_SERVICE_ROLE_KEY || env.VITE_SUPABASE_ANON_KEY
  if (!url || !key) {
    throw new Error('Missing VITE_SUPABASE_URL or service/anon key in .env.local')
  }

  const supabase = createClient(url, key)
  const productKeys = Object.keys(CONCEPT2_COMPAT_BY_PRODUCT_KEY)

  console.log(`Concept2 console seed (${args.dryRun ? 'dry-run' : 'APPLY'})`)
  console.log(`Consoles: ${CONCEPT2_CONSOLE_DEFS.length}`)
  console.log(`Mapped product keys: ${productKeys.length}`)
  console.log('Unresolved:', CONCEPT2_UNRESOLVED_PRODUCTS.map((entry) => entry.name).join(', '))

  const consoleRows = CONCEPT2_CONSOLE_DEFS.map((def) => ({
    brand: CONCEPT2_BRAND,
    console_key: def.console_key,
    console_name: def.console_name,
    alternative_names: def.alternative_names ?? [],
    start_year: def.start_year ?? null,
    end_year: def.end_year ?? null,
    start_year_approximate: Boolean(def.start_year_approximate),
    end_year_approximate: Boolean(def.end_year_approximate),
    is_current: Boolean(def.is_current),
    display_order: def.display_order ?? 0,
    active: true,
    source_url: def.source_url ?? null,
    notes: def.notes ?? null,
    confidence: def.confidence ?? 'medium',
  }))

  if (!args.dryRun) {
    const { error } = await supabase
      .from('equipment_consoles')
      .upsert(consoleRows, { onConflict: 'brand,console_key' })
    if (error) throw error
  } else {
    console.log('Would upsert consoles:', consoleRows.map((row) => row.console_key).join(', '))
  }

  const { data: consoles, error: consolesError } = await supabase
    .from('equipment_consoles')
    .select('id, console_key, console_name')
    .eq('brand', CONCEPT2_BRAND)
  if (consolesError) throw consolesError

  const consoleIdByKey = new Map((consoles ?? []).map((row) => [row.console_key, row.id]))

  const { data: products, error: productsError } = await supabase
    .from('equipment_products')
    .select('id, canonical_product_key, canonical_product_name, status, baseline_manufacture_year, production_start_year, production_end_year')
    .eq('brand', CONCEPT2_BRAND)
    .eq('status', 'approved')
  if (productsError) throw productsError

  const productByKey = new Map((products ?? []).map((row) => [row.canonical_product_key, row]))
  const missingKeys = productKeys.filter((key) => !productByKey.has(key))
  const unmappedProducts = (products ?? []).filter((row) => !CONCEPT2_COMPAT_BY_PRODUCT_KEY[row.canonical_product_key])

  if (missingKeys.length) {
    console.warn('Mapped keys not found in DB:', missingKeys.join(', '))
  }
  if (unmappedProducts.length) {
    console.warn('Approved Concept2 products without mapping defs:', unmappedProducts.map((row) => row.canonical_product_key).join(', '))
  }

  const compatRows = []
  for (const [productKey, mappings] of Object.entries(CONCEPT2_COMPAT_BY_PRODUCT_KEY)) {
    const product = productByKey.get(productKey)
    if (!product) continue

    for (const mapping of mappings) {
      const consoleId = consoleIdByKey.get(mapping.console_key)
      if (!consoleId) {
        console.warn(`Missing console ${mapping.console_key} for ${productKey}`)
        continue
      }
      compatRows.push({
        product_id: product.id,
        console_id: consoleId,
        available_from_year: mapping.available_from_year,
        available_to_year: mapping.available_to_year ?? null,
        from_year_approximate: Boolean(mapping.from_year_approximate),
        to_year_approximate: Boolean(mapping.to_year_approximate),
        compatibility_type: mapping.compatibility_type,
        is_default: Boolean(mapping.is_default),
        display_order: mapping.display_order ?? 0,
        tier: mapping.tier ?? 'base',
        modifier_percent: Number(mapping.modifier_percent ?? 0),
        source_url: mapping.source_url ?? null,
        notes: mapping.notes ?? null,
        confidence: mapping.confidence ?? 'medium',
        is_active: true,
      })
      console.log(
        `${args.dryRun ? 'Would map' : 'Map'} ${product.canonical_product_name} → ${mapping.console_key} `
        + `[${mapping.compatibility_type}] ${mapping.available_from_year}–${mapping.available_to_year ?? 'open'} `
        + `(${mapping.confidence})`,
      )
    }
  }

  if (!args.dryRun && compatRows.length) {
    // Replace Concept2 compat for these products to keep seed idempotent
    const productIds = [...new Set(compatRows.map((row) => row.product_id))]
    const { error: deleteError } = await supabase
      .from('product_console_compat')
      .delete()
      .in('product_id', productIds)
    if (deleteError) throw deleteError

    const { error: insertError } = await supabase
      .from('product_console_compat')
      .insert(compatRows)
    if (insertError) throw insertError
  }

  console.log(`Compat rows: ${compatRows.length}`)
  console.log(args.dryRun ? 'Dry-run complete. Re-run with --apply to write.' : 'Apply complete.')
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
