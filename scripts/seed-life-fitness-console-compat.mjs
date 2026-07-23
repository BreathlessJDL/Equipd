#!/usr/bin/env node
/**
 * Seed curated Life Fitness console master + product_console_compat.
 * Replaces template backfill. Clears legacy product_console_options for the brand.
 *
 * Includes commercial Elevation / Integrity / Silver Line and home GO/TRACK timeline.
 *
 * Usage:
 *   node scripts/seed-life-fitness-console-compat.mjs
 *   node scripts/seed-life-fitness-console-compat.mjs --apply
 */

import { createClient } from '@supabase/supabase-js'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  LIFE_FITNESS_BRAND,
  LIFE_FITNESS_COMPAT_BY_PRODUCT_KEY,
  LIFE_FITNESS_CONSOLE_DEFS,
  LIFE_FITNESS_EXPLICITLY_UNMAPPED,
  LIFE_FITNESS_UNRESOLVED_PRODUCTS,
  buildLifeFitnessHomeConsolePlan,
} from '../src/lib/lifeFitnessConsoleCompat.js'
import { isCardioEquipmentProduct, isStrengthEquipmentProduct } from '../src/lib/equipmentCardio.js'

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

  console.log(`Life Fitness console seed (${args.dryRun ? 'dry-run' : 'APPLY'})`)
  console.log(`Consoles: ${LIFE_FITNESS_CONSOLE_DEFS.length}`)
  console.log('Explicitly unmapped:', LIFE_FITNESS_EXPLICITLY_UNMAPPED.map((entry) => entry.key).join(', '))
  console.log('Unresolved notes:', LIFE_FITNESS_UNRESOLVED_PRODUCTS.map((entry) => entry.name).join('; '))

  const consoleRows = LIFE_FITNESS_CONSOLE_DEFS.map((def) => ({
    brand: LIFE_FITNESS_BRAND,
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
    image_url: def.image_url ?? null,
    image_status: def.image_url ? 'approved' : 'none',
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
    .eq('brand', LIFE_FITNESS_BRAND)
  if (consolesError) throw consolesError
  const consoleIdByKey = new Map((consoles ?? []).map((row) => [row.console_key, row.id]))
  if (args.dryRun) {
    for (const def of LIFE_FITNESS_CONSOLE_DEFS) {
      if (!consoleIdByKey.has(def.console_key)) {
        consoleIdByKey.set(def.console_key, `dry-run:${def.console_key}`)
      }
    }
  }

  const { data: products, error: productsError } = await supabase
    .from('equipment_products')
    .select('id, canonical_product_key, canonical_product_name, equipment_type, model, product_family, status')
    .eq('brand', LIFE_FITNESS_BRAND)
    .eq('status', 'approved')
  if (productsError) throw productsError

  const homePlan = buildLifeFitnessHomeConsolePlan(products ?? [])
  const compatByKey = {
    ...LIFE_FITNESS_COMPAT_BY_PRODUCT_KEY,
    ...homePlan.byKey,
  }
  const productKeys = Object.keys(compatByKey)

  console.log(`Commercial + static mapped keys: ${Object.keys(LIFE_FITNESS_COMPAT_BY_PRODUCT_KEY).length}`)
  console.log(`Home interchangeable mapped: ${homePlan.summary.mapped_product_count}`)
  console.log(`Home skipped (fixed/no-console/legacy): ${homePlan.summary.skipped_product_count}`)

  const productByKey = new Map((products ?? []).map((row) => [row.canonical_product_key, row]))
  const allIds = (products ?? []).map((row) => row.id)
  const missingKeys = productKeys.filter((key) => !productByKey.has(key))
  if (missingKeys.length) console.warn('Mapped keys not in DB:', missingKeys.join(', '))

  const compatRows = []
  const mappingPreview = []
  for (const [productKey, mappings] of Object.entries(compatByKey)) {
    const product = productByKey.get(productKey)
    if (!product) continue
    if (isStrengthEquipmentProduct(product)) {
      console.warn(`Refusing strength map: ${productKey}`)
      continue
    }
    if (!isCardioEquipmentProduct(product)) {
      console.warn(`Refusing non-cardio map: ${productKey}`)
      continue
    }
    for (const mapping of mappings) {
      const consoleId = consoleIdByKey.get(mapping.console_key)
      if (!consoleId) {
        console.warn(`Missing console ${mapping.console_key}`)
        continue
      }
      if (!mapping.source_url) {
        console.warn(`Missing source on ${productKey} → ${mapping.console_key}`)
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
      mappingPreview.push({
        product: product.canonical_product_name,
        key: productKey,
        console_key: mapping.console_key,
        compatibility_type: mapping.compatibility_type,
        available_from_year: mapping.available_from_year,
        available_to_year: mapping.available_to_year ?? null,
        modifier_percent: Number(mapping.modifier_percent ?? 0),
        is_default: Boolean(mapping.is_default),
      })
      console.log(
        `${args.dryRun ? 'Would map' : 'Map'} ${product.canonical_product_name} → ${mapping.console_key} `
        + `[${mapping.compatibility_type}] ${mapping.available_from_year}–${mapping.available_to_year ?? 'open'} `
        + `(${mapping.confidence})`,
      )
    }
  }

  if (!args.dryRun) {
    if (allIds.length) {
      const { error: deleteCompatError } = await supabase
        .from('product_console_compat')
        .delete()
        .in('product_id', allIds)
      if (deleteCompatError) throw deleteCompatError
      const { error: deleteOptionsError } = await supabase
        .from('product_console_options')
        .delete()
        .in('product_id', allIds)
      if (deleteOptionsError) throw deleteOptionsError
      console.log(`Cleared compat + legacy options for ${allIds.length} Life Fitness products`)
    }
    if (compatRows.length) {
      const { error: insertError } = await supabase.from('product_console_compat').insert(compatRows)
      if (insertError) throw insertError
    }
  } else {
    console.log(`Would clear compat + options for ${allIds.length} products; insert ${compatRows.length} rows`)
  }

  const report = {
    generated_at: new Date().toISOString(),
    mode: args.dryRun ? 'dry-run' : 'apply',
    brand: LIFE_FITNESS_BRAND,
    console_keys: consoleRows.map((row) => row.console_key),
    home: homePlan.summary,
    home_mapped: homePlan.mapped,
    home_skipped: homePlan.skipped,
    compat_row_count: compatRows.length,
    mappings: mappingPreview,
    missing_keys: missingKeys,
  }

  mkdirSync(join(process.cwd(), 'reports'), { recursive: true })
  const outPath = join(
    process.cwd(),
    'reports',
    args.dryRun ? 'life-fitness-console-compat-dry-run.json' : 'life-fitness-console-compat-apply.json',
  )
  writeFileSync(outPath, JSON.stringify(report, null, 2))
  console.log(`Wrote ${outPath}`)
  console.log(`Compat rows: ${compatRows.length}`)
  console.log(args.dryRun ? 'Dry-run complete. Re-run with --apply to write.' : 'Apply complete.')
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
