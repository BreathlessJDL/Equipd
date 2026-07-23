#!/usr/bin/env node
/**
 * Apply Matrix Home XR / XER / XIR console timeline mappings.
 *
 * Scope: Matrix home catalogue products only (T30/T50/…, skips fixed/strength).
 * Does not clear or rewrite commercial digit / modern modular / Onyx compat rows.
 *
 * Usage:
 *   node scripts/apply-matrix-home-console-compat.mjs
 *   node scripts/apply-matrix-home-console-compat.mjs --apply
 */

import { createClient } from '@supabase/supabase-js'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  MATRIX_BRAND,
  MATRIX_CONSOLE_DEFS,
  buildMatrixHomeConsolePlan,
  parseMatrixHomeIdentity,
} from '../src/lib/matrixConsoleCompat.js'

function loadEnv() {
  const path = join(process.cwd(), '.env.local')
  const text = readFileSync(path, 'utf8')
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
  const supabase = createClient(
    env.VITE_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY || env.VITE_SUPABASE_ANON_KEY,
  )

  console.log(`Matrix home console apply (${args.dryRun ? 'dry-run' : 'APPLY'})`)

  const homeConsoleDefs = MATRIX_CONSOLE_DEFS.filter((def) => def.family === 'home')
  const consoleRows = homeConsoleDefs.map((def) => ({
    brand: MATRIX_BRAND,
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
    console.log(`Upserted home consoles: ${consoleRows.map((row) => row.console_key).join(', ')}`)
  } else {
    console.log('Would upsert home consoles:', consoleRows.map((row) => row.console_key).join(', '))
  }

  const { data: consoles, error: consolesError } = await supabase
    .from('equipment_consoles')
    .select('id, console_key')
    .eq('brand', MATRIX_BRAND)
  if (consolesError) throw consolesError
  const consoleIdByKey = new Map((consoles ?? []).map((row) => [row.console_key, row.id]))
  if (args.dryRun) {
    for (const def of homeConsoleDefs) {
      if (!consoleIdByKey.has(def.console_key)) {
        consoleIdByKey.set(def.console_key, `dry-run:${def.console_key}`)
      }
    }
  }

  const { data: products, error: productsError } = await supabase
    .from('equipment_products')
    .select(
      'id, brand, canonical_product_key, canonical_product_name, product_family, model, equipment_type, status',
    )
    .or('brand.eq.Matrix,brand.eq.Matrix Fitness')
    .eq('status', 'approved')
  if (productsError) throw productsError

  const homeProducts = (products ?? []).filter((product) => Boolean(parseMatrixHomeIdentity(product)))
  const homePlan = buildMatrixHomeConsolePlan(homeProducts)

  console.log(`Home products found: ${homeProducts.length}`)
  console.log(`Mapped (interchangeable): ${homePlan.summary.mapped_product_count}`)
  console.log(`Skipped (fixed/no-console/strength): ${homePlan.summary.skipped_product_count}`)

  const productByKey = new Map(homeProducts.map((row) => [row.canonical_product_key, row]))
  // Only clear/rewrite products that are in the home range (mapped + skipped).
  const homeProductIds = homeProducts.map((row) => row.id)

  const compatRows = []
  const mappingPreview = []
  for (const [productKey, mappings] of Object.entries(homePlan.byKey)) {
    const product = productByKey.get(productKey)
    if (!product) continue
    for (const mapping of mappings) {
      const consoleId = consoleIdByKey.get(mapping.console_key)
      if (!consoleId) {
        throw new Error(`Missing console master: ${mapping.console_key}`)
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
        base: homePlan.mapped.find((entry) => entry.key === productKey)?.base ?? null,
        console_key: mapping.console_key,
        compatibility_type: mapping.compatibility_type,
        available_from_year: mapping.available_from_year,
        available_to_year: mapping.available_to_year ?? null,
        modifier_percent: Number(mapping.modifier_percent ?? 0),
        is_default: Boolean(mapping.is_default),
      })
      console.log(
        `${args.dryRun ? 'Would map' : 'Map'} ${product.canonical_product_name} → ${mapping.console_key} `
        + `[${mapping.compatibility_type}] ${mapping.available_from_year}–${mapping.available_to_year ?? 'open'}`,
      )
    }
  }

  for (const skip of homePlan.skipped) {
    console.log(`Skip ${skip.name} [${skip.kind}]: ${skip.reason}`)
  }

  if (!args.dryRun) {
    if (homeProductIds.length) {
      const { error: deleteCompatError } = await supabase
        .from('product_console_compat')
        .delete()
        .in('product_id', homeProductIds)
      if (deleteCompatError) throw deleteCompatError

      const { error: deleteOptionsError } = await supabase
        .from('product_console_options')
        .delete()
        .in('product_id', homeProductIds)
      if (deleteOptionsError) throw deleteOptionsError

      console.log(`Cleared compat for ${homeProductIds.length} home products only`)
    }

    if (compatRows.length) {
      const { error: insertError } = await supabase.from('product_console_compat').insert(compatRows)
      if (insertError) throw insertError
    }
  } else {
    console.log(
      `Would replace compat for ${homeProductIds.length} home products (${compatRows.length} rows); `
      + 'commercial digit/modern/Onyx untouched',
    )
  }

  const report = {
    generated_at: new Date().toISOString(),
    mode: args.dryRun ? 'dry-run' : 'apply',
    brand: MATRIX_BRAND,
    home_console_keys: consoleRows.map((row) => row.console_key),
    summary: homePlan.summary,
    mapped: homePlan.mapped,
    skipped: homePlan.skipped,
    compat_row_count: compatRows.length,
    mappings: mappingPreview,
  }

  mkdirSync(join(process.cwd(), 'reports'), { recursive: true })
  const outPath = join(
    process.cwd(),
    'reports',
    args.dryRun
      ? 'matrix-home-console-compat-dry-run.json'
      : 'matrix-home-console-compat-apply.json',
  )
  writeFileSync(outPath, JSON.stringify(report, null, 2))
  console.log(`Wrote ${outPath}`)
  console.log(args.dryRun ? 'Dry-run complete. Re-run with --apply to write.' : 'Apply complete.')
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
