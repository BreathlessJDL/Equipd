#!/usr/bin/env node
/**
 * Apply approved Matrix digit-base console timeline:
 * - Consolidate suffix SKUs (T1x+T1xe → Matrix T1, …); hold *5xe
 * - Seed year-filtered factory console mappings (no modern modular on digit bases)
 *
 * Usage:
 *   node scripts/apply-matrix-base-console-timeline.mjs
 *   node scripts/apply-matrix-base-console-timeline.mjs --apply
 */

import { createClient } from '@supabase/supabase-js'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  MATRIX_BRAND,
  MATRIX_CONSOLE_DEFS,
  MATRIX_UNRESOLVED_PRODUCTS,
  buildMatrixBaseConsolidationPlan,
  listMatrixHeldForReview,
} from '../src/lib/matrixConsoleCompat.js'

const PRODUCT_FIELDS = [
  'id',
  'brand',
  'product_family',
  'model',
  'equipment_type',
  'canonical_product_name',
  'canonical_product_key',
  'baseline_manufacture_year',
  'production_start_year',
  'production_end_year',
  'original_base_price',
  'original_base_price_currency',
  'original_price_confidence',
  'lifecycle_confidence',
  'source_intelligence_row_ids',
  'status',
  'review_notes',
  'image_url',
  'image_storage_path',
  'image_source_url',
  'image_source_domain',
  'image_confidence',
  'image_status',
].join(', ')

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

async function assertUniqueKey(supabase, canonicalProductKey, excludeId = null) {
  const { data, error } = await supabase
    .from('equipment_products')
    .select('id, canonical_product_name, status')
    .eq('canonical_product_key', canonicalProductKey)
  if (error) throw error
  const conflicts = (data ?? []).filter((row) => row.id !== excludeId && row.status !== 'excluded')
  if (conflicts.length) {
    throw new Error(
      `Canonical key collision for ${canonicalProductKey}: ${conflicts.map((row) => row.canonical_product_name).join(', ')}`,
    )
  }
}

async function main() {
  const args = parseArgs(process.argv)
  const env = loadEnv()
  const supabase = createClient(
    env.VITE_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY || env.VITE_SUPABASE_ANON_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )

  console.log(`Matrix base console timeline (${args.dryRun ? 'dry-run' : 'APPLY'})`)

  const { data: products, error: productsError } = await supabase
    .from('equipment_products')
    .select(PRODUCT_FIELDS)
    .ilike('brand', '%matrix%')
    .order('canonical_product_key')
  if (productsError) throw productsError

  const approved = (products ?? []).filter((row) => row.status === 'approved')
  const plan = buildMatrixBaseConsolidationPlan(approved)

  console.log(`Approved products: ${approved.length}`)
  console.log(`Base groups: ${plan.summary.base_count}`)
  console.log(`Duplicates to exclude: ${plan.summary.merge_duplicate_count}`)
  console.log(`Held *5xe: ${plan.summary.held_5xe_count}`)
  console.log(`Compat mapping rows: ${plan.summary.mapping_row_count}`)
  console.log(`Unresolved: ${MATRIX_UNRESOLVED_PRODUCTS.map((entry) => entry.name).join('; ')}`)
  console.log('')

  for (const group of plan.groups) {
    console.log(
      `${group.base}: keeper ${group.keeper.canonical_product_key} → ${group.target.canonical_product_key} `
      + `(${group.target.canonical_product_name}); fold ${group.duplicates.length}; `
      + `consoles=${group.console_mappings.map((row) => row.console_key).join(',')}`,
    )
    for (const duplicate of group.duplicates) {
      console.log(`  exclude ${duplicate.canonical_product_key}`)
    }
  }
  console.log('')
  for (const entry of plan.held) {
    console.log(`HOLD ${entry.product.canonical_product_key} (${entry.reason})`)
  }

  mkdirSync('reports', { recursive: true })
  const reportPath = join('reports', 'matrix-base-console-timeline-apply.json')
  writeFileSync(reportPath, JSON.stringify({
    generated_at: new Date().toISOString(),
    mode: args.dryRun ? 'dry-run' : 'apply',
    summary: plan.summary,
    groups: plan.groups.map((group) => ({
      base: group.base,
      target: group.target,
      keeper_id: group.keeper.id,
      keeper_key: group.keeper.canonical_product_key,
      duplicate_keys: group.duplicates.map((row) => row.canonical_product_key),
      aliases: group.aliases,
      consoles: group.console_mappings,
    })),
    held: plan.held.map((entry) => ({
      key: entry.product.canonical_product_key,
      reason: entry.reason,
    })),
  }, null, 2))
  console.log(`Wrote ${reportPath}`)

  if (args.dryRun) {
    console.log('\nDry-run only. Re-run with --apply to write.')
    return
  }

  // 1) Upsert console masters (historic + modular master-only + home)
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
  const { error: consoleUpsertError } = await supabase
    .from('equipment_consoles')
    .upsert(consoleRows, { onConflict: 'brand,console_key' })
  if (consoleUpsertError) throw consoleUpsertError

  const { data: consoles, error: consolesError } = await supabase
    .from('equipment_consoles')
    .select('id, console_key')
    .eq('brand', MATRIX_BRAND)
  if (consolesError) throw consolesError
  const consoleIdByKey = new Map((consoles ?? []).map((row) => [row.console_key, row.id]))

  // 2) Consolidate products
  for (const group of plan.groups) {
    await assertUniqueKey(supabase, group.target.canonical_product_key, group.keeper.id)

    const keeperUpdate = {
      product_family: group.target.product_family,
      canonical_product_name: group.target.canonical_product_name,
      canonical_product_key: group.target.canonical_product_key,
      source_intelligence_row_ids: group.aggregated_source_intelligence_row_ids,
      production_end_year: group.target.timeline_end_year,
      review_notes: [
        group.keeper.review_notes,
        `Matrix digit-base consolidation ${new Date().toISOString().slice(0, 10)}: folded ${group.aliases.join(', ')} into ${group.target.canonical_product_name}.`,
      ].filter(Boolean).join('\n'),
      updated_at: new Date().toISOString(),
    }
    if (group.target.equipment_type) {
      keeperUpdate.equipment_type = group.target.equipment_type
    }
    const baseline = group.keeper.baseline_manufacture_year == null || group.keeper.baseline_manufacture_year === ''
      ? null
      : Number(group.keeper.baseline_manufacture_year)
    const existingStart = group.keeper.production_start_year == null || group.keeper.production_start_year === ''
      ? null
      : Number(group.keeper.production_start_year)
    if (existingStart == null && Number.isFinite(baseline)) {
      keeperUpdate.production_start_year = baseline
    }

    const { error: keeperError } = await supabase
      .from('equipment_products')
      .update(keeperUpdate)
      .eq('id', group.keeper.id)
    if (keeperError) throw keeperError

    for (const duplicate of group.duplicates) {
      const { error: duplicateError } = await supabase
        .from('equipment_products')
        .update({
          status: 'excluded',
          review_notes: [
            duplicate.review_notes,
            `Merged into ${group.keeper.id} (${group.target.canonical_product_key}) — Matrix digit-base console timeline.`,
          ].filter(Boolean).join('\n'),
          updated_at: new Date().toISOString(),
        })
        .eq('id', duplicate.id)
      if (duplicateError) throw duplicateError
    }
  }

  // 3) Reseed compat for all Matrix products (clear then insert base mappings only)
  const { data: refreshed, error: refreshError } = await supabase
    .from('equipment_products')
    .select('id, canonical_product_key, canonical_product_name, product_family, status')
    .ilike('brand', '%matrix%')
  if (refreshError) throw refreshError

  const allIds = (refreshed ?? []).map((row) => row.id)
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
  }

  const approvedAfter = (refreshed ?? []).filter((row) => row.status === 'approved')
  const planAfter = buildMatrixBaseConsolidationPlan(approvedAfter)
  const productByKey = new Map(approvedAfter.map((row) => [row.canonical_product_key, row]))

  const compatRows = []
  for (const group of planAfter.groups) {
    const product = productByKey.get(group.target.canonical_product_key)
      || approvedAfter.find((row) => row.id === group.keeper.id)
    if (!product) {
      console.warn(`Missing product for base ${group.base}`)
      continue
    }
    for (const mapping of group.console_mappings) {
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
        confidence: mapping.confidence ?? 'high',
        is_active: true,
      })
    }
  }

  if (compatRows.length) {
    const { error: insertError } = await supabase.from('product_console_compat').insert(compatRows)
    if (insertError) throw insertError
  }

  const heldAfter = listMatrixHeldForReview(approvedAfter)
  console.log(`\nInserted compat rows: ${compatRows.length}`)
  console.log(`Held *5xe remaining approved: ${heldAfter.length}`)
  console.log('Apply complete.')
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
