#!/usr/bin/env node
/**
 * Repair obvious equipment_type mistakes on equipment_products.
 *
 * Usage:
 *   node scripts/repair-equipment-types.mjs --dry-run
 *   node scripts/repair-equipment-types.mjs --brand "Precor" --dry-run
 *   node scripts/repair-equipment-types.mjs --brand "Precor" --apply
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  auditEquipmentTypeRepairs,
  buildEquipmentTypeRepairRow,
} from '../src/lib/equipmentTypeRepair.js'

const PRODUCT_FIELDS = [
  'id',
  'brand',
  'canonical_product_name',
  'canonical_product_key',
  'product_family',
  'model',
  'equipment_type',
  'status',
  'source_intelligence_row_ids',
  'original_base_price',
  'baseline_manufacture_year',
  'image_url',
  'image_storage_path',
].join(', ')

const INTELLIGENCE_FIELDS = [
  'id',
  'brand',
  'model',
  'equipment_type',
  'original_rrp',
  'baseline_manufacture_year',
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
  const args = {
    brand: null,
    dryRun: true,
  }

  for (let index = 2; index < argv.length; index += 1) {
    const token = argv[index]
    if (token === '--apply') args.dryRun = false
    else if (token === '--dry-run') args.dryRun = true
    else if (token === '--brand') {
      args.brand = argv[index + 1] ?? null
      index += 1
    }
  }

  return args
}

async function fetchProducts(supabase, brandFilter) {
  const pageSize = 1000
  let from = 0
  const products = []

  while (true) {
    let query = supabase
      .from('equipment_products')
      .select(PRODUCT_FIELDS)
      .order('brand')
      .order('canonical_product_name')
      .range(from, from + pageSize - 1)

    if (brandFilter) {
      query = query.ilike('brand', brandFilter)
    }

    const { data, error } = await query
    if (error) throw error
    const batch = data ?? []
    products.push(...batch)
    if (batch.length < pageSize) break
    from += pageSize
  }

  return products
}

async function fetchIntelligenceRows(supabase, ids) {
  const rows = []
  const chunkSize = 200

  for (let index = 0; index < ids.length; index += chunkSize) {
    const chunk = ids.slice(index, index + chunkSize)
    const { data, error } = await supabase
      .from('equipment_intelligence')
      .select(INTELLIGENCE_FIELDS)
      .in('id', chunk)
    if (error) throw error
    rows.push(...(data ?? []))
  }

  return rows
}

async function updateProductEquipmentType(supabase, product, proposal) {
  const snapshot = {
    original_base_price: product.original_base_price,
    baseline_manufacture_year: product.baseline_manufacture_year,
    image_url: product.image_url,
    image_storage_path: product.image_storage_path,
    canonical_product_name: product.canonical_product_name,
    status: product.status,
  }

  const { error } = await supabase
    .from('equipment_products')
    .update({
      equipment_type: proposal.proposedType,
      updated_at: new Date().toISOString(),
    })
    .eq('id', product.id)

  if (error) throw error

  const { data, error: verifyError } = await supabase
    .from('equipment_products')
    .select('equipment_type,original_base_price,baseline_manufacture_year,image_url,image_storage_path,canonical_product_name,status')
    .eq('id', product.id)
    .single()

  if (verifyError) throw verifyError

  if (
    data.original_base_price !== snapshot.original_base_price
    || data.baseline_manufacture_year !== snapshot.baseline_manufacture_year
    || data.image_url !== snapshot.image_url
    || data.image_storage_path !== snapshot.image_storage_path
    || data.canonical_product_name !== snapshot.canonical_product_name
    || data.status !== snapshot.status
  ) {
    throw new Error('non-equipment_type product fields changed unexpectedly')
  }

  return data.equipment_type
}

async function propagateIntelligenceType(supabase, {
  intelligenceRows,
  sourceIds,
  wrongType,
  proposedType,
}) {
  const linkedRows = intelligenceRows.filter((row) => sourceIds.includes(row.id))
  let updated = 0

  for (const row of linkedRows) {
    if (row.equipment_type !== wrongType) continue

    const snapshot = {
      original_rrp: row.original_rrp,
      baseline_manufacture_year: row.baseline_manufacture_year,
    }

    const { error } = await supabase
      .from('equipment_intelligence')
      .update({
        equipment_type: proposedType,
        updated_at: new Date().toISOString(),
      })
      .eq('id', row.id)

    if (error) throw error

    const { data, error: verifyError } = await supabase
      .from('equipment_intelligence')
      .select('equipment_type,original_rrp,baseline_manufacture_year')
      .eq('id', row.id)
      .single()

    if (verifyError) throw verifyError

    if (
      data.original_rrp !== snapshot.original_rrp
      || data.baseline_manufacture_year !== snapshot.baseline_manufacture_year
    ) {
      throw new Error('non-equipment_type intelligence fields changed unexpectedly')
    }

    updated += 1
  }

  return updated
}

async function main() {
  const args = parseArgs(process.argv)
  const env = loadEnv()
  const supabaseUrl = env.VITE_SUPABASE_URL ?? env.SUPABASE_URL
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing VITE_SUPABASE_URL/SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const products = await fetchProducts(supabase, args.brand)
  const report = auditEquipmentTypeRepairs(products)
  const intelligenceIds = [
    ...new Set(
      report.updates.flatMap((proposal) => proposal.product.source_intelligence_row_ids ?? []),
    ),
  ]
  const intelligenceRows = intelligenceIds.length
    ? await fetchIntelligenceRows(supabase, intelligenceIds)
    : []

  console.log(`Mode: ${args.dryRun ? 'dry-run' : 'apply'}`)
  if (args.brand) console.log(`Brand filter: ${args.brand}`)
  console.log(`Products checked: ${report.summary.productsChecked}`)
  console.log(`Repair proposals: ${report.summary.proposals}`)
  console.log(`High-confidence updates: ${report.summary.highConfidenceUpdates}`)
  console.log('')
  console.log([
    'product name',
    'current equipment_type',
    'proposed equipment_type',
    'reason',
    'confidence',
    'will update',
  ].join(' | '))

  for (const proposal of report.actionable) {
    const row = buildEquipmentTypeRepairRow(proposal)
    console.log([
      row.productName,
      row.currentType,
      row.proposedType,
      row.reason,
      row.confidence,
      row.willUpdate,
    ].join(' | '))
  }

  if (args.dryRun) return

  const summary = {
    productsUpdated: 0,
    intelligenceUpdated: 0,
    failed: 0,
  }

  for (const proposal of report.updates) {
    try {
      const wrongType = proposal.currentType
      await updateProductEquipmentType(supabase, proposal.product, proposal)
      summary.productsUpdated += 1

      const propagated = await propagateIntelligenceType(supabase, {
        intelligenceRows,
        sourceIds: proposal.product.source_intelligence_row_ids ?? [],
        wrongType,
        proposedType: proposal.proposedType,
      })
      summary.intelligenceUpdated += propagated
    } catch (error) {
      summary.failed += 1
      console.error(`FAILED ${proposal.product.canonical_product_name}: ${error.message}`)
    }
  }

  console.log('')
  console.log('Apply summary:')
  console.log(`Products updated: ${summary.productsUpdated}`)
  console.log(`Intelligence rows updated: ${summary.intelligenceUpdated}`)
  console.log(`Failed: ${summary.failed}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
