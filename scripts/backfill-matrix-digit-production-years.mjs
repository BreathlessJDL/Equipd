#!/usr/bin/env node
/**
 * Backfill Matrix digit-base production_start/end from the approved timeline.
 * Does not invent years from console fallback alone — uses buildMatrixBaseProductIdentity.
 *
 * Usage:
 *   node scripts/backfill-matrix-digit-production-years.mjs
 *   node scripts/backfill-matrix-digit-production-years.mjs --apply
 */

import { createClient } from '@supabase/supabase-js'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  buildMatrixBaseConsolidationPlan,
  parseMatrixDigitIdentity,
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
  const args = { dryRun: true }
  for (let index = 2; index < argv.length; index += 1) {
    if (argv[index] === '--apply') args.dryRun = false
  }
  return args
}

async function main() {
  const args = parseArgs(process.argv)
  const env = loadEnv()
  const supabase = createClient(
    env.VITE_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY || env.VITE_SUPABASE_ANON_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )

  const { data: products, error } = await supabase
    .from('equipment_products')
    .select('id, canonical_product_key, canonical_product_name, product_family, model, status, baseline_manufacture_year, production_start_year, production_end_year')
    .ilike('brand', '%matrix%')
    .eq('status', 'approved')
  if (error) throw error

  const plan = buildMatrixBaseConsolidationPlan(products ?? [])
  const updates = []

  for (const group of plan.groups) {
    const product = (products ?? []).find((row) => row.id === group.keeper.id)
      || (products ?? []).find((row) => row.canonical_product_key === group.target.canonical_product_key)
    if (!product) continue

    const identity = parseMatrixDigitIdentity({
      product_family: group.target.product_family,
      canonical_product_name: group.target.canonical_product_name,
    })
    if (!identity) continue

    const patch = {}
    const end = group.target.timeline_end_year
    if (product.production_end_year !== end) {
      patch.production_end_year = end
    }

    const baseline = product.baseline_manufacture_year == null || product.baseline_manufacture_year === ''
      ? null
      : Number(product.baseline_manufacture_year)
    const existingStart = product.production_start_year == null || product.production_start_year === ''
      ? null
      : Number(product.production_start_year)
    if (existingStart == null && Number.isFinite(baseline)) {
      patch.production_start_year = baseline
    }

    if (!Object.keys(patch).length) continue
    updates.push({
      id: product.id,
      key: group.target.canonical_product_key,
      name: group.target.canonical_product_name,
      before: {
        production_start_year: product.production_start_year,
        production_end_year: product.production_end_year,
        baseline_manufacture_year: product.baseline_manufacture_year,
      },
      patch,
    })
  }

  console.log(`Matrix digit production-year backfill (${args.dryRun ? 'dry-run' : 'APPLY'})`)
  console.log(`Updates: ${updates.length}`)
  for (const row of updates) {
    console.log(
      `${row.name}: start ${row.before.production_start_year ?? '—'}→${row.patch.production_start_year ?? row.before.production_start_year ?? '—'}; `
      + `end ${row.before.production_end_year ?? '—'}→${row.patch.production_end_year ?? row.before.production_end_year ?? '—'}`,
    )
  }

  mkdirSync('reports', { recursive: true })
  const reportPath = join('reports', 'matrix-digit-production-years-backfill.json')
  writeFileSync(reportPath, JSON.stringify({
    generated_at: new Date().toISOString(),
    mode: args.dryRun ? 'dry-run' : 'apply',
    updates,
  }, null, 2))
  console.log(`Wrote ${reportPath}`)

  if (args.dryRun) {
    console.log('\nDry-run only. Re-run with --apply to write.')
    return
  }

  for (const row of updates) {
    const { error: updateError } = await supabase
      .from('equipment_products')
      .update({
        ...row.patch,
        updated_at: new Date().toISOString(),
      })
      .eq('id', row.id)
    if (updateError) throw updateError
  }

  console.log('Apply complete.')
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
