#!/usr/bin/env node
/**
 * Populate missing Life Fitness baseline_manufacture_year values from trusted series defaults.
 *
 * Usage:
 *   node scripts/apply-life-fitness-series-baselines.mjs --dry-run
 *   node scripts/apply-life-fitness-series-baselines.mjs --apply
 *   node scripts/apply-life-fitness-series-baselines.mjs --dry-run --family "Integrity Series"
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  buildLifeFitnessSeriesBaselinePlan,
  formatSeriesBaselineSkipReason,
} from '../src/lib/lifeFitnessSeriesBaselines.js'

const PRODUCT_FIELDS = [
  'id',
  'brand',
  'product_family',
  'model',
  'canonical_product_name',
  'canonical_product_key',
  'baseline_manufacture_year',
  'lifecycle_confidence',
  'source_intelligence_row_ids',
  'status',
  'review_notes',
].join(', ')

const INTELLIGENCE_FIELDS = [
  'id',
  'brand',
  'baseline_manufacture_year',
  'baseline_manufacture_year_confidence',
  'baseline_manufacture_year_source',
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
    dryRun: true,
    apply: false,
    family: null,
  }

  for (let index = 2; index < argv.length; index += 1) {
    const token = argv[index]
    if (token === '--dry-run') args.dryRun = true
    else if (token === '--apply') {
      args.apply = true
      args.dryRun = false
    } else if (token === '--family') {
      args.family = argv[index + 1] ?? null
      index += 1
    }
  }

  return args
}

async function fetchLifeFitnessProducts(supabase) {
  const { data, error } = await supabase
    .from('equipment_products')
    .select(PRODUCT_FIELDS)
    .ilike('brand', 'Life Fitness')
    .order('canonical_product_name')

  if (error) throw error
  return data ?? []
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

function printApplicationRow({
  productName,
  currentBaseline,
  proposedBaseline,
  matchedFamily,
  skipReason,
}) {
  console.log([
    productName,
    `current=${currentBaseline ?? '—'}`,
    proposedBaseline != null ? `proposed=${proposedBaseline}` : 'proposed=—',
    matchedFamily ? `family=${matchedFamily}` : '',
    skipReason ? `skipped=${formatSeriesBaselineSkipReason(skipReason)}` : '',
  ].filter(Boolean).join(' | '))
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

  const products = await fetchLifeFitnessProducts(supabase)
  const intelligenceIds = [
    ...new Set(products.flatMap((product) => product.source_intelligence_row_ids ?? [])),
  ]
  const intelligenceRows = await fetchIntelligenceRows(supabase, intelligenceIds)
  const intelligenceRowsById = new Map(intelligenceRows.map((row) => [row.id, row]))

  const plan = buildLifeFitnessSeriesBaselinePlan(products, intelligenceRowsById, {
    familyFilter: args.family,
  })

  console.log(`Mode: ${args.dryRun ? 'DRY-RUN' : 'APPLY'}`)
  console.log(`Family filter: ${args.family ?? 'all'}`)
  console.log(`Life Fitness products scanned: ${products.length}`)
  console.log('')

  if (plan.productApplications.length) {
    console.log('Product updates:')
    for (const application of plan.productApplications) {
      printApplicationRow(application)
    }
    console.log('')
  }

  if (plan.skipped.length) {
    console.log('Skipped products:')
    for (const entry of plan.skipped.slice(0, 40)) {
      printApplicationRow(entry)
    }
    if (plan.skipped.length > 40) {
      console.log(`...and ${plan.skipped.length - 40} more skipped`)
    }
    console.log('')
  }

  if (plan.intelligenceApplications.length) {
    console.log(`Linked intelligence rows to update: ${plan.intelligenceApplications.length}`)
    for (const application of plan.intelligenceApplications.slice(0, 10)) {
      console.log([
        application.productName,
        `row=${application.rowId}`,
        `current=${application.currentBaseline ?? '—'}`,
        `proposed=${application.proposedBaseline}`,
        `family=${application.matchedFamily}`,
      ].join(' | '))
    }
    if (plan.intelligenceApplications.length > 10) {
      console.log(`...and ${plan.intelligenceApplications.length - 10} more intelligence rows`)
    }
    console.log('')
  }

  console.log('Summary:')
  console.log(`  products to update:      ${plan.summary.productsEligible}`)
  console.log(`  intelligence rows:       ${plan.summary.intelligenceRowsEligible}`)
  console.log(`  skipped products:        ${plan.summary.skipped}`)

  if (args.dryRun) {
    console.log('\nDry-run only — no database changes made.')
    console.log('Re-run with --apply to write series baseline defaults.')
    return
  }

  for (const application of plan.productApplications) {
    const { error } = await supabase
      .from('equipment_products')
      .update({
        ...application.update,
        updated_at: new Date().toISOString(),
      })
      .eq('id', application.product.id)
      .is('baseline_manufacture_year', null)

    if (error) throw error
  }

  for (const application of plan.intelligenceApplications) {
    const { error } = await supabase
      .from('equipment_intelligence')
      .update(application.patch)
      .eq('id', application.rowId)

    if (error) throw error
  }

  console.log(`\nApplied ${plan.productApplications.length} product update(s).`)
  console.log(`Applied ${plan.intelligenceApplications.length} intelligence row update(s).`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
