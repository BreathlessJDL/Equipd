#!/usr/bin/env node
/**
 * Fix Life Fitness cardio canonical products: merge Discover Series duplicates into
 * Elevation Series, standardise series labels, and apply series baseline years.
 *
 * Usage:
 *   node scripts/fix-life-fitness-cardio-series.mjs --dry-run
 *   node scripts/fix-life-fitness-cardio-series.mjs --apply
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  buildLifeFitnessCardioSeriesFixPlan,
  ELEVATION_SERIES_BASELINE_YEAR,
  ELEVATION_SERIES_LABEL,
  INTEGRITY_SERIES_BASELINE_YEAR,
  INTEGRITY_SERIES_LABEL,
} from '../src/lib/lifeFitnessCardioSeriesFix.js'

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
  'original_price_source',
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
  'image_failure_reason',
  'image_updated_at',
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

function printProductLine(product) {
  return [
    product.canonical_product_name,
    `key=${product.canonical_product_key}`,
    `family=${product.product_family ?? '—'}`,
    `baseline=${product.baseline_manufacture_year ?? '—'}`,
    `status=${product.status}`,
    `image=${product.image_status ?? '—'}`,
  ].join(' | ')
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

async function assertUniqueKey(supabase, canonicalProductKey, excludeId = null) {
  let query = supabase
    .from('equipment_products')
    .select('id, canonical_product_name, status')
    .eq('canonical_product_key', canonicalProductKey)

  const { data, error } = await query
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
  const supabaseUrl = env.VITE_SUPABASE_URL ?? env.SUPABASE_URL
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing VITE_SUPABASE_URL/SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const products = await fetchLifeFitnessProducts(supabase)
  const plan = buildLifeFitnessCardioSeriesFixPlan(products)

  console.log(`Mode: ${args.dryRun ? 'DRY-RUN' : 'APPLY'}`)
  console.log(`Life Fitness products scanned: ${products.length}`)
  console.log('')

  console.log('Discover Series cardio rows found:')
  if (!plan.discoverRowsFound.length) {
    console.log('  (none)')
  } else {
    for (const product of plan.discoverRowsFound) {
      console.log(`  - ${printProductLine(product)}`)
    }
  }
  console.log('')

  console.log('Matching Elevation Series cardio rows found:')
  if (!plan.elevationRowsFound.length) {
    console.log('  (none)')
  } else {
    for (const product of plan.elevationRowsFound) {
      console.log(`  - ${printProductLine(product)}`)
    }
  }
  console.log('')

  console.log('Rows to merge:')
  if (!plan.merges.length) {
    console.log('  (none)')
  } else {
    for (const merge of plan.merges) {
      console.log(`  - ${merge.duplicate.canonical_product_name} -> ${merge.keeper.canonical_product_name}`)
      if (merge.duplicates?.length > 1) {
        for (const duplicate of merge.duplicates.slice(1)) {
          console.log(`    also: ${duplicate.canonical_product_name}`)
        }
      }
    }
  }
  console.log('')

  console.log('Rows to rename to Elevation Series:')
  if (!plan.renames.length) {
    console.log('  (none)')
  } else {
    for (const rename of plan.renames) {
      console.log(`  - ${rename.product.canonical_product_name}`)
      console.log(`    -> ${rename.target.canonical_product_name}`)
      console.log(`    key: ${rename.product.canonical_product_key} -> ${rename.target.canonical_product_key}`)
    }
  }
  console.log('')

  console.log('Rows to delete/archive:')
  if (!plan.archives.length) {
    console.log('  (none)')
  } else {
    for (const archive of plan.archives) {
      const target = archive.targetName ? ` -> ${archive.targetName}` : ''
      console.log(`  - [${archive.reason}] ${archive.product.canonical_product_name}${target}`)
    }
  }
  console.log('')

  console.log('Image fields that will be preserved:')
  if (!plan.imagePreservations.length) {
    console.log('  (none)')
  } else {
    for (const transfer of plan.imagePreservations) {
      console.log(`  - ${transfer.fromName} -> ${transfer.toName}: ${transfer.fields.join(', ')}`)
    }
  }
  console.log('')

  console.log('Series standardisations (Elevation -> Elevation Series):')
  if (!plan.standardizations.length) {
    console.log('  (none)')
  } else {
    for (const entry of plan.standardizations) {
      console.log(`  - ${entry.product.canonical_product_name}`)
      console.log(`    -> ${entry.update.canonical_product_name}`)
    }
  }
  console.log('')

  console.log('Baseline year updates:')
  if (!plan.baselineUpdates.length) {
    console.log('  (none)')
  } else {
    for (const entry of plan.baselineUpdates) {
      console.log(
        `  - ${entry.product.canonical_product_name} | ${entry.seriesLabel} | ${entry.currentBaseline ?? '—'} -> ${entry.proposedBaseline}`,
      )
    }
  }
  console.log('')

  console.log('Summary:')
  console.log(`  Discover rows:           ${plan.summary.discoverCount}`)
  console.log(`  Elevation rows:          ${plan.summary.elevationCount}`)
  console.log(`  Integrity rows:          ${plan.summary.integrityCount}`)
  console.log(`  merges:                  ${plan.summary.mergeCount}`)
  console.log(`  renames:                 ${plan.summary.renameCount}`)
  console.log(`  archives:                ${plan.summary.archiveCount}`)
  console.log(`  standardisations:        ${plan.summary.standardizationCount}`)
  console.log(`  baseline updates:        ${plan.summary.baselineUpdateCount}`)
  console.log(`  image transfers:         ${plan.summary.imagePreservationCount}`)
  console.log(`  Elevation baseline:      ${ELEVATION_SERIES_LABEL} = ${ELEVATION_SERIES_BASELINE_YEAR}`)
  console.log(`  Integrity baseline:      ${INTEGRITY_SERIES_LABEL} = ${INTEGRITY_SERIES_BASELINE_YEAR}`)

  if (args.dryRun) {
    console.log('\nDry-run only — no database changes made.')
    console.log('Re-run with --apply to update canonical products.')
    return
  }

  const touchedIds = new Set()

  for (const merge of plan.merges) {
    const { error: keeperError } = await supabase
      .from('equipment_products')
      .update({
        ...merge.keeperUpdate,
        updated_at: new Date().toISOString(),
      })
      .eq('id', merge.keeper.id)

    if (keeperError) throw keeperError
    touchedIds.add(merge.keeper.id)

    const duplicateIds = merge.duplicates?.map((product) => product.id) ?? [merge.duplicate.id]
    for (const duplicateId of duplicateIds) {
      const duplicate = plan.archives.find((archive) => archive.product.id === duplicateId)?.product
        ?? merge.duplicate
      const { error: duplicateError } = await supabase
        .from('equipment_products')
        .update({
          ...merge.duplicateUpdate,
          review_notes: merge.duplicateUpdate.review_notes,
          updated_at: new Date().toISOString(),
        })
        .eq('id', duplicateId)

      if (duplicateError) throw duplicateError
      touchedIds.add(duplicateId)
    }
  }

  for (const rename of plan.renames) {
    await assertUniqueKey(supabase, rename.target.canonical_product_key, rename.product.id)

    const { error } = await supabase
      .from('equipment_products')
      .update({
        ...rename.update,
        updated_at: new Date().toISOString(),
      })
      .eq('id', rename.product.id)

    if (error) throw error
    touchedIds.add(rename.product.id)
  }

  for (const entry of plan.standardizations) {
    if (touchedIds.has(entry.product.id)) continue

    const { error } = await supabase
      .from('equipment_products')
      .update({
        ...entry.update,
        updated_at: new Date().toISOString(),
      })
      .eq('id', entry.product.id)

    if (error) throw error
    touchedIds.add(entry.product.id)
  }

  for (const archive of plan.archives) {
    if (touchedIds.has(archive.product.id)) continue
    if (archive.product.status === 'excluded') continue

    const { error } = await supabase
      .from('equipment_products')
      .update({
        status: 'excluded',
        review_notes: archive.targetName
          ? `Archived (${archive.reason}) — see ${archive.targetName} (${archive.targetId}).`
          : `Archived (${archive.reason}).`,
        updated_at: new Date().toISOString(),
      })
      .eq('id', archive.product.id)

    if (error) throw error
    touchedIds.add(archive.product.id)
  }

  for (const entry of plan.baselineUpdates) {
    const { error } = await supabase
      .from('equipment_products')
      .update({
        ...entry.update,
        updated_at: new Date().toISOString(),
      })
      .eq('id', entry.product.id)

    if (error) throw error
  }

  console.log('\nApplied Life Fitness cardio series fix.')
  console.log(`  merges:           ${plan.merges.length}`)
  console.log(`  renames:          ${plan.renames.length}`)
  console.log(`  standardisations: ${plan.standardizations.length}`)
  console.log(`  archives:         ${plan.archives.length}`)
  console.log(`  baseline updates: ${plan.baselineUpdates.length}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
