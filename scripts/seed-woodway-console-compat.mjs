#!/usr/bin/env node
/**
 * Seed Woodway console master + product_console_compat mappings.
 *
 * Usage:
 *   node scripts/seed-woodway-console-compat.mjs
 *   node scripts/seed-woodway-console-compat.mjs --apply
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  WOODWAY_BRAND,
  WOODWAY_COMPAT_BY_PRODUCT_KEY,
  WOODWAY_CONSOLE_DEFS,
  WOODWAY_UNRESOLVED_PRODUCTS,
} from '../src/lib/woodwayConsoleCompat.js'

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
    if (argv[index] === '--apply') {
      args.apply = true
      args.dryRun = false
    }
  }
  return args
}

async function main() {
  const args = parseArgs(process.argv)
  const env = loadEnv()
  const supabase = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY || env.VITE_SUPABASE_ANON_KEY)
  const productKeys = Object.keys(WOODWAY_COMPAT_BY_PRODUCT_KEY)

  console.log(`Woodway console seed (${args.dryRun ? 'dry-run' : 'APPLY'})`)
  console.log(`Consoles: ${WOODWAY_CONSOLE_DEFS.length}`)
  console.log(`Mapped product keys: ${productKeys.length}`)
  console.log('Unresolved:', WOODWAY_UNRESOLVED_PRODUCTS.map((entry) => entry.name).join('; '))

  const consoleRows = WOODWAY_CONSOLE_DEFS.map((def) => ({
    brand: WOODWAY_BRAND,
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
    .select('id, console_key')
    .eq('brand', WOODWAY_BRAND)
  if (consolesError) throw consolesError
  const consoleIdByKey = new Map((consoles ?? []).map((row) => [row.console_key, row.id]))

  const { data: products, error: productsError } = await supabase
    .from('equipment_products')
    .select('id, canonical_product_key, canonical_product_name, status')
    .eq('brand', WOODWAY_BRAND)
    .eq('status', 'approved')
  if (productsError) throw productsError

  const productByKey = new Map((products ?? []).map((row) => [row.canonical_product_key, row]))
  const missingKeys = productKeys.filter((key) => !productByKey.has(key))
  const unmapped = (products ?? []).filter((row) => !WOODWAY_COMPAT_BY_PRODUCT_KEY[row.canonical_product_key])

  if (missingKeys.length) console.warn('Mapped keys not in DB:', missingKeys.join(', '))
  if (unmapped.length) {
    console.warn('Approved Woodway products without mappings:', unmapped.map((row) => row.canonical_product_key).join(', '))
  }

  const compatRows = []
  for (const [productKey, mappings] of Object.entries(WOODWAY_COMPAT_BY_PRODUCT_KEY)) {
    const product = productByKey.get(productKey)
    if (!product) continue
    for (const mapping of mappings) {
      const consoleId = consoleIdByKey.get(mapping.console_key)
      if (!consoleId) {
        console.warn(`Missing console ${mapping.console_key}`)
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
    const productIds = [...new Set(compatRows.map((row) => row.product_id))]
    const { error: deleteError } = await supabase
      .from('product_console_compat')
      .delete()
      .in('product_id', productIds)
    if (deleteError) throw deleteError
    const { error: insertError } = await supabase.from('product_console_compat').insert(compatRows)
    if (insertError) throw insertError
  }

  console.log(`Compat rows: ${compatRows.length}`)
  console.log(args.dryRun ? 'Dry-run complete. Re-run with --apply to write.' : 'Apply complete.')
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
