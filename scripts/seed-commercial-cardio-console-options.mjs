#!/usr/bin/env node
/**
 * Seed per-product commercial cardio console compatibility options.
 *
 * Usage:
 *   node scripts/seed-commercial-cardio-console-options.mjs
 *   node scripts/seed-commercial-cardio-console-options.mjs --apply
 */

import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  COMMERCIAL_CARDIO_CONSOLE_GROUPS,
  buildProductConsoleOptionRows,
  classifyCommercialCardioConsoleGroup,
  isCommercialCardioBrand,
} from '../src/lib/commercialCardioConsoleCompat.js'
import { isCardioEquipmentProduct, isSpinBikeIndoorCycleProduct } from '../src/lib/equipmentCardio.js'
import { isWellnessTvConsoleOption } from '../src/lib/productConsoleOptions.js'

const PRODUCT_FIELDS = [
  'id',
  'brand',
  'product_family',
  'model',
  'equipment_type',
  'canonical_product_name',
  'canonical_product_key',
  'baseline_manufacture_year',
  'status',
].join(', ')

const OPTION_FIELDS = [
  'id',
  'product_id',
  'console_key',
  'console_name',
  'release_year',
  'retired_year',
  'tier',
  'modifier_percent',
  'image_url',
  'sort_order',
  'is_active',
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
    env[trimmed.slice(0, idx)] = trimmed.slice(idx + 1)
  }
  return env
}

function parseArgs(argv) {
  const args = { dryRun: true, apply: false }
  for (let index = 2; index < argv.length; index += 1) {
    const token = argv[index]
    if (token === '--dry-run') args.dryRun = true
    else if (token === '--apply') {
      args.apply = true
      args.dryRun = false
    }
  }
  return args
}

function normalizeComparableRow(row) {
  return {
    product_id: row.product_id,
    console_key: row.console_key,
    console_name: row.console_name,
    release_year: Number(row.release_year),
    retired_year: row.retired_year == null ? null : Number(row.retired_year),
    tier: row.tier,
    modifier_percent: Number(row.modifier_percent ?? 0),
    image_url: row.image_url ?? null,
    sort_order: Number(row.sort_order ?? 0),
    is_active: row.is_active !== false,
  }
}

function rowsEqual(left, right) {
  const a = normalizeComparableRow(left)
  const b = normalizeComparableRow(right)
  return JSON.stringify(a) === JSON.stringify(b)
}

function printProductSummary(product, groupKey) {
  return [
    product.canonical_product_name,
    `[${product.canonical_product_key}]`,
    groupKey ? `-> ${COMMERCIAL_CARDIO_CONSOLE_GROUPS[groupKey]}` : '-> skipped',
  ].join(' ')
}

async function fetchProducts(supabase) {
  const { data, error } = await supabase
    .from('equipment_products')
    .select(PRODUCT_FIELDS)
    .in('brand', ['Life Fitness', 'Technogym', 'Matrix', 'Matrix Fitness'])
    .eq('status', 'approved')
    .order('brand')
    .order('canonical_product_name')

  if (error) throw error
  return data ?? []
}

async function fetchExistingOptions(supabase, productIds) {
  if (!productIds.length) return []

  const rows = []
  const chunkSize = 100
  for (let index = 0; index < productIds.length; index += chunkSize) {
    const chunk = productIds.slice(index, index + chunkSize)
    const { data, error } = await supabase
      .from('product_console_options')
      .select(OPTION_FIELDS)
      .in('product_id', chunk)

    if (error) throw error
    rows.push(...(data ?? []))
  }

  return rows
}

function buildPlan(products, existingRows) {
  const existingByKey = new Map(
    existingRows.map((row) => [`${row.product_id}:${row.console_key}`, row]),
  )
  const existingByProduct = new Map()
  for (const row of existingRows) {
    if (!existingByProduct.has(row.product_id)) {
      existingByProduct.set(row.product_id, [])
    }
    existingByProduct.get(row.product_id).push(row)
  }

  const audit = {
    productsMatched: 0,
    productsSkipped: 0,
    consoleRowsInserted: 0,
    consoleRowsUpdated: 0,
    consoleRowsUnchanged: 0,
    consoleRowsDeactivated: 0,
    wellnessTvDeactivated: 0,
    skippedProducts: [],
    examplesByGroup: {},
    upsertRows: [],
  }
  const desiredKeysByProduct = new Map()

  for (const product of products) {
    if (isSpinBikeIndoorCycleProduct(product)) {
      audit.productsSkipped += 1
      audit.skippedProducts.push({
        product,
        reason: 'spin bike / indoor cycle (no console options)',
      })
      desiredKeysByProduct.set(product.id, new Set())
      continue
    }

    const groupKey = classifyCommercialCardioConsoleGroup(product)
    if (!groupKey) {
      audit.productsSkipped += 1
      audit.skippedProducts.push({
        product,
        reason: !isCommercialCardioBrand(product.brand)
          ? 'unsupported brand'
          : !isCardioEquipmentProduct(product)
            ? 'not commercial cardio'
            : 'no console group match',
      })
      desiredKeysByProduct.set(product.id, new Set())
      continue
    }

    audit.productsMatched += 1
    if (!audit.examplesByGroup[groupKey]) {
      audit.examplesByGroup[groupKey] = []
    }
    if (audit.examplesByGroup[groupKey].length < 3) {
      audit.examplesByGroup[groupKey].push(printProductSummary(product, groupKey))
    }

    const desiredRows = buildProductConsoleOptionRows(product)
    desiredKeysByProduct.set(
      product.id,
      new Set(desiredRows.map((row) => row.console_key)),
    )

    for (const desired of desiredRows) {
      const key = `${desired.product_id}:${desired.console_key}`
      const existing = existingByKey.get(key)

      if (!existing) {
        audit.consoleRowsInserted += 1
        audit.upsertRows.push(desired)
        continue
      }

      if (rowsEqual(existing, desired)) {
        audit.consoleRowsUnchanged += 1
        continue
      }

      audit.consoleRowsUpdated += 1
      audit.upsertRows.push({
        ...desired,
        id: existing.id,
      })
    }
  }

  for (const [productId, rows] of existingByProduct) {
    const desiredKeys = desiredKeysByProduct.get(productId) ?? new Set()
    for (const existing of rows) {
      if (desiredKeys.has(existing.console_key)) continue
      if (existing.is_active === false) continue

      audit.consoleRowsDeactivated += 1
      audit.upsertRows.push({
        ...normalizeComparableRow(existing),
        id: existing.id,
        is_active: false,
      })
    }
  }

  const deactivatedIds = new Set(
    audit.upsertRows.filter((row) => row.is_active === false).map((row) => row.id).filter(Boolean),
  )

  for (const existing of existingRows) {
    if (!isWellnessTvConsoleOption(existing)) continue
    if (existing.is_active === false) continue
    if (existing.id && deactivatedIds.has(existing.id)) continue

    audit.consoleRowsDeactivated += 1
    audit.wellnessTvDeactivated += 1
    audit.upsertRows.push({
      ...normalizeComparableRow(existing),
      id: existing.id,
      is_active: false,
    })
    if (existing.id) deactivatedIds.add(existing.id)
  }

  return audit
}

function printAudit(audit, { dryRun }) {
  console.log(dryRun ? 'DRY RUN — no database changes' : 'APPLY — writing product_console_options')
  console.log('')
  console.log(`Products matched: ${audit.productsMatched}`)
  console.log(`Products skipped: ${audit.productsSkipped}`)
  console.log(`Console rows to insert: ${audit.consoleRowsInserted}`)
  console.log(`Console rows to update: ${audit.consoleRowsUpdated}`)
  console.log(`Console rows unchanged: ${audit.consoleRowsUnchanged}`)
  console.log(`Console rows to deactivate: ${audit.consoleRowsDeactivated}`)
  console.log(`Wellness TV rows to deactivate: ${audit.wellnessTvDeactivated}`)
  console.log('')

  console.log('Examples per brand/series:')
  for (const [groupKey, examples] of Object.entries(audit.examplesByGroup)) {
    console.log(`  ${COMMERCIAL_CARDIO_CONSOLE_GROUPS[groupKey]}`)
    for (const example of examples) {
      console.log(`    - ${example}`)
    }
  }
  console.log('')

  if (audit.skippedProducts.length) {
    console.log('Skipped products (first 10):')
    for (const entry of audit.skippedProducts.slice(0, 10)) {
      console.log(`  - ${printProductSummary(entry.product, null)} (${entry.reason})`)
    }
    if (audit.skippedProducts.length > 10) {
      console.log(`  ... and ${audit.skippedProducts.length - 10} more`)
    }
    console.log('')
  }
}

async function applyUpserts(supabase, rows) {
  if (!rows.length) return

  const deduped = new Map()
  for (const row of rows) {
    const key = `${row.product_id}:${row.console_key}`
    const existing = deduped.get(key)
    if (!existing || (row.id && !existing.id)) {
      deduped.set(key, row)
    }
  }

  const uniqueRows = [...deduped.values()]
  const chunkSize = 100
  for (let index = 0; index < uniqueRows.length; index += chunkSize) {
    const chunk = uniqueRows.slice(index, index + chunkSize).map((row) => {
      const payload = normalizeComparableRow(row)
      payload.id = row.id || randomUUID()
      return payload
    })

    const { error } = await supabase
      .from('product_console_options')
      .upsert(chunk, { onConflict: 'product_id,console_key' })

    if (error) throw error
  }
}

async function main() {
  const args = parseArgs(process.argv)
  const env = loadEnv()
  const supabaseUrl = env.VITE_SUPABASE_URL || env.SUPABASE_URL
  const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY || env.VITE_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials in .env.local')
    process.exit(1)
  }

  const supabase = createClient(supabaseUrl, supabaseKey)
  const products = await fetchProducts(supabase)
  const existingRows = await fetchExistingOptions(
    supabase,
    products.map((product) => product.id),
  )

  const audit = buildPlan(products, existingRows)
  printAudit(audit, { dryRun: args.dryRun })

  if (args.dryRun) {
    console.log('Re-run with --apply to upsert console options.')
    return
  }

  await applyUpserts(supabase, audit.upsertRows)
  console.log(`Applied ${audit.upsertRows.length} console option row(s), including ${audit.consoleRowsDeactivated} deactivation(s).`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
