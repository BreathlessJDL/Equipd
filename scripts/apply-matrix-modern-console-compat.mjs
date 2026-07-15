#!/usr/bin/env node
/**
 * Approve Matrix Onyx products and apply modern modular + Onyx fixed console mappings.
 *
 * Scope: Lifestyle / Endurance / Performance / Performance Plus / Onyx only.
 * Does not clear or rewrite historic digit-series product_console_compat rows.
 *
 * Usage:
 *   node scripts/apply-matrix-modern-console-compat.mjs
 *   node scripts/apply-matrix-modern-console-compat.mjs --apply
 */

import { createClient } from '@supabase/supabase-js'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  MATRIX_BRAND,
  MATRIX_CONSOLE_DEFS,
  buildMatrixCompatByProductKey,
  isMatrixModernModularProduct,
  isMatrixOnyxProduct,
} from '../src/lib/matrixConsoleCompat.js'

const ONYX_REVIEW_NOTES = [
  'Identity verified high confidence (OEM Onyx Collection launch 2024; five-machine lineup).',
  'Baseline manufacture year 2024.',
  'RRP provisional catalogue estimate (low confidence) — preserve current GBP values.',
  'Fixed Onyx immersive console — not modular LED/Premium LED/Touch/Touch XL.',
  'Do not merge Onyx into Lifestyle/Endurance/Performance.',
].join(' ')

const ONYX_PRICE_CONFIDENCE = 25

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

function isModernBatchProduct(product) {
  return isMatrixOnyxProduct(product) || isMatrixModernModularProduct(product)
}

async function main() {
  const args = parseArgs(process.argv)
  const env = loadEnv()
  const supabase = createClient(
    env.VITE_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY || env.VITE_SUPABASE_ANON_KEY,
  )

  console.log(`Matrix modern console apply (${args.dryRun ? 'dry-run' : 'APPLY'})`)

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
    console.log(`Upserted ${consoleRows.length} Matrix console masters (incl. Onyx 32/22)`)
  } else {
    console.log(
      'Would upsert consoles:',
      consoleRows.filter((row) => ['onyx_32', 'onyx_22', 'led', 'premium_led', 'touch', 'touch_xl'].includes(row.console_key))
        .map((row) => row.console_key)
        .join(', '),
    )
  }

  const { data: consoles, error: consolesError } = await supabase
    .from('equipment_consoles')
    .select('id, console_key, console_name')
    .eq('brand', MATRIX_BRAND)
  if (consolesError) throw consolesError
  const consoleIdByKey = new Map((consoles ?? []).map((row) => [row.console_key, row.id]))
  if (args.dryRun) {
    for (const def of MATRIX_CONSOLE_DEFS) {
      if (!consoleIdByKey.has(def.console_key)) {
        consoleIdByKey.set(def.console_key, `dry-run:${def.console_key}`)
      }
    }
  }

  const { data: products, error: productsError } = await supabase
    .from('equipment_products')
    .select(
      'id, canonical_product_key, canonical_product_name, product_family, model, equipment_type, status, baseline_manufacture_year, original_base_price, original_base_price_currency, original_price_confidence, review_notes, source_intelligence_row_ids',
    )
    .eq('brand', MATRIX_BRAND)
    .neq('status', 'excluded')
  if (productsError) throw productsError

  const modernProducts = (products ?? []).filter(isModernBatchProduct)
  const onyxProducts = modernProducts.filter(isMatrixOnyxProduct)
  const modularProducts = modernProducts.filter(isMatrixModernModularProduct)

  console.log(`Modern batch products: ${modernProducts.length} (modular ${modularProducts.length}, onyx ${onyxProducts.length})`)

  if (modularProducts.length !== 19) {
    console.warn(`Expected 19 modular products, found ${modularProducts.length}`)
  }
  if (onyxProducts.length !== 5) {
    console.warn(`Expected 5 Onyx products, found ${onyxProducts.length}`)
  }

  const onyxApprovals = onyxProducts.map((product) => ({
    id: product.id,
    canonical_product_name: product.canonical_product_name,
    previous_status: product.status,
    previous_review_notes: product.review_notes,
    previous_price_confidence: product.original_price_confidence,
    original_base_price: product.original_base_price,
    baseline_manufacture_year: product.baseline_manufacture_year ?? 2024,
    patch: {
      status: 'approved',
      baseline_manufacture_year: product.baseline_manufacture_year ?? 2024,
      original_price_confidence: ONYX_PRICE_CONFIDENCE,
      review_notes: ONYX_REVIEW_NOTES,
    },
  }))

  if (!args.dryRun) {
    for (const entry of onyxApprovals) {
      const { error } = await supabase
        .from('equipment_products')
        .update(entry.patch)
        .eq('id', entry.id)
      if (error) throw error
      console.log(`Approved Onyx: ${entry.canonical_product_name}`)
    }
  } else {
    for (const entry of onyxApprovals) {
      console.log(`Would approve Onyx: ${entry.canonical_product_name} (rrp ${entry.original_base_price})`)
    }
  }

  // Re-read after approval so status filter for mapping uses approved Onyx.
  const productsForMapping = modernProducts.map((product) => {
    if (!isMatrixOnyxProduct(product)) return product
    return {
      ...product,
      status: 'approved',
      baseline_manufacture_year: product.baseline_manufacture_year ?? 2024,
      review_notes: ONYX_REVIEW_NOTES,
      original_price_confidence: ONYX_PRICE_CONFIDENCE,
    }
  })

  const compatByKey = buildMatrixCompatByProductKey(productsForMapping)
  const productByKey = new Map(productsForMapping.map((row) => [row.canonical_product_key, row]))
  const productIds = productsForMapping.map((row) => row.id)

  const compatRows = []
  const mappingPreview = []
  for (const [productKey, mappings] of Object.entries(compatByKey)) {
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
        family: product.product_family,
        equipment_type: product.equipment_type,
        console_key: mapping.console_key,
        compatibility_type: mapping.compatibility_type,
        available_from_year: mapping.available_from_year,
        available_to_year: mapping.available_to_year ?? null,
        is_default: Boolean(mapping.is_default),
        display_order: mapping.display_order ?? 0,
        confidence: mapping.confidence,
      })
      console.log(
        `${args.dryRun ? 'Would map' : 'Map'} ${product.canonical_product_name} → ${mapping.console_key} `
        + `[${mapping.compatibility_type}] (${mapping.confidence})`,
      )
    }
  }

  const unmapped = productsForMapping.filter((product) => !compatByKey[product.canonical_product_key]?.length)
  if (unmapped.length) {
    console.warn('Unmapped modern products:', unmapped.map((row) => row.canonical_product_name).join(', '))
  }

  if (!args.dryRun) {
    if (productIds.length) {
      const { error: deleteCompatError } = await supabase
        .from('product_console_compat')
        .delete()
        .in('product_id', productIds)
      if (deleteCompatError) throw deleteCompatError

      const { error: deleteOptionsError } = await supabase
        .from('product_console_options')
        .delete()
        .in('product_id', productIds)
      if (deleteOptionsError) throw deleteOptionsError
    }

    if (compatRows.length) {
      const { error: insertError } = await supabase.from('product_console_compat').insert(compatRows)
      if (insertError) throw insertError
    }
  } else {
    console.log(`Would replace compat for ${productIds.length} modern products (${compatRows.length} rows)`)
  }

  const report = {
    generated_at: new Date().toISOString(),
    mode: args.dryRun ? 'dry-run' : 'apply',
    onyx_approvals: onyxApprovals,
    modular_product_count: modularProducts.length,
    onyx_product_count: onyxProducts.length,
    compat_row_count: compatRows.length,
    mappings: mappingPreview,
    unmapped: unmapped.map((row) => row.canonical_product_name),
  }

  mkdirSync(join(process.cwd(), 'reports'), { recursive: true })
  const outPath = join(
    process.cwd(),
    'reports',
    args.dryRun
      ? 'matrix-modern-console-compat-dry-run.json'
      : 'matrix-modern-console-compat-apply.json',
  )
  writeFileSync(outPath, JSON.stringify(report, null, 2))
  console.log(`Wrote ${outPath}`)
  console.log(args.dryRun ? 'Dry-run complete. Re-run with --apply to write.' : 'Apply complete.')
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
