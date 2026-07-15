#!/usr/bin/env node
/**
 * Seed Matrix Fitness console master + product_console_compat mappings.
 *
 * Prefer scripts/apply-matrix-base-console-timeline.mjs for the approved
 * digit-base consolidation + year-filtered factory mappings (2026-07-10).
 * This script remains for master upsert / legacy reseed only.
 *
 * Does not map home XR–XUR onto commercial products.
 * Does not auto-approve medium/low mappings (*5xe held for review).
 * Does not attach modern modular consoles to digit-series products.
 *
 * Usage:
 *   node scripts/seed-matrix-console-compat.mjs
 *   node scripts/seed-matrix-console-compat.mjs --apply
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  MATRIX_BRAND,
  MATRIX_CONSOLE_DEFS,
  MATRIX_UNRESOLVED_PRODUCTS,
  buildMatrixCompatByProductKey,
  listMatrixHeldForReview,
  parseMatrixHistoricConsoleTier,
} from '../src/lib/matrixConsoleCompat.js'
import {
  isCardioEquipmentProduct,
  isSpinBikeIndoorCycleProduct,
  isStrengthEquipmentProduct,
} from '../src/lib/equipmentCardio.js'

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

function isMatrixCardioCandidate(product) {
  if (isStrengthEquipmentProduct(product)) return false
  if (isCardioEquipmentProduct(product)) return true
  // Named historic SKUs with missing equipment_type (e.g. Ascent) still count.
  return Boolean(parseMatrixHistoricConsoleTier(product))
}

async function main() {
  const args = parseArgs(process.argv)
  const env = loadEnv()
  const supabase = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY || env.VITE_SUPABASE_ANON_KEY)

  console.log(`Matrix Fitness console seed (${args.dryRun ? 'dry-run' : 'APPLY'})`)
  console.log(`Consoles: ${MATRIX_CONSOLE_DEFS.length}`)

  const consoleRows = MATRIX_CONSOLE_DEFS.map((def) => ({
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
  } else {
    console.log('Would upsert consoles:', consoleRows.map((row) => row.console_key).join(', '))
  }

  const { data: consoles, error: consolesError } = await supabase
    .from('equipment_consoles')
    .select('id, console_key')
    .eq('brand', MATRIX_BRAND)
  if (consolesError) throw consolesError
  const consoleIdByKey = new Map((consoles ?? []).map((row) => [row.console_key, row.id]))

  // After dry-run upsert skip, console IDs may miss new keys — use defs for dry-run logging only.
  if (args.dryRun) {
    for (const def of MATRIX_CONSOLE_DEFS) {
      if (!consoleIdByKey.has(def.console_key)) {
        consoleIdByKey.set(def.console_key, `dry-run:${def.console_key}`)
      }
    }
  }

  const { data: products, error: productsError } = await supabase
    .from('equipment_products')
    .select('id, canonical_product_key, canonical_product_name, equipment_type, model, product_family, status')
    .eq('brand', MATRIX_BRAND)
    .eq('status', 'approved')
  if (productsError) throw productsError

  const cardio = (products ?? []).filter((product) => isMatrixCardioCandidate(product))
  const strength = (products ?? []).filter((product) => isStrengthEquipmentProduct(product))
  const compatByKey = buildMatrixCompatByProductKey(cardio)
  const held = listMatrixHeldForReview(cardio)
  const productByKey = new Map((products ?? []).map((row) => [row.canonical_product_key, row]))
  const productKeys = Object.keys(compatByKey)

  console.log(`Approved products: ${(products ?? []).length}`)
  console.log(`Cardio candidates: ${cardio.length}`)
  console.log(`Strength (must stay unmapped): ${strength.length}`)
  console.log(`High-confidence mapped keys: ${productKeys.length}`)
  console.log(`Held for review (*5xe): ${held.length}`)
  console.log('Static unresolved:', MATRIX_UNRESOLVED_PRODUCTS.map((entry) => entry.name).join('; '))

  const unmappedCardio = cardio.filter((row) => {
    if (compatByKey[row.canonical_product_key]) return false
    if (held.some((entry) => entry.key === row.canonical_product_key)) return false
    if (MATRIX_UNRESOLVED_PRODUCTS.some((entry) => entry.key === row.canonical_product_key)) return false
    if (isSpinBikeIndoorCycleProduct(row)) return false
    return true
  })
  if (unmappedCardio.length) {
    console.warn(
      'Other unmapped cardio:',
      unmappedCardio.map((row) => row.canonical_product_key).join(', ') || '(none)',
    )
  }

  const compatRows = []
  for (const [productKey, mappings] of Object.entries(compatByKey)) {
    const product = productByKey.get(productKey)
    if (!product) {
      console.warn(`Mapped key not in DB: ${productKey}`)
      continue
    }
    if (isStrengthEquipmentProduct(product)) {
      console.warn(`Refusing to map strength product: ${productKey}`)
      continue
    }
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
        + `[${mapping.compatibility_type}] (${mapping.confidence})`,
      )
    }
  }

  for (const entry of held) {
    console.log(`HOLD ${entry.name} → suggested ${entry.suggested_console_key} (${entry.confidence})`)
  }

  const allMatrixProductIds = (products ?? []).map((row) => row.id)

  if (!args.dryRun) {
    // Clear ALL Matrix Fitness compat so inherited wrong rows cannot linger on unmapped SKUs.
    if (allMatrixProductIds.length) {
      const { error: deleteCompatError } = await supabase
        .from('product_console_compat')
        .delete()
        .in('product_id', allMatrixProductIds)
      if (deleteCompatError) throw deleteCompatError
    }

    if (compatRows.length) {
      const { error: insertError } = await supabase.from('product_console_compat').insert(compatRows)
      if (insertError) throw insertError
    }

    // Remove legacy product_console_options so public fetch cannot fall back to LED+Touch+Touch XL.
    if (allMatrixProductIds.length) {
      const { error: deleteOptionsError } = await supabase
        .from('product_console_options')
        .delete()
        .in('product_id', allMatrixProductIds)
      if (deleteOptionsError) throw deleteOptionsError
      console.log(`Cleared legacy product_console_options for ${allMatrixProductIds.length} Matrix products`)
    }
  } else {
    console.log(`Would clear product_console_compat + product_console_options for ${allMatrixProductIds.length} products`)
  }

  console.log(`Compat rows: ${compatRows.length}`)
  console.log(args.dryRun ? 'Dry-run complete. Re-run with --apply to write.' : 'Apply complete.')
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
