#!/usr/bin/env node
/**
 * One-off audit/fix for USD original_rrp rows where the raw USD amount was
 * copied into best_original_price as if it were GBP.
 *
 * Usage:
 *   node scripts/fix-usd-gbp-conversion-rows.mjs
 *   node scripts/fix-usd-gbp-conversion-rows.mjs --apply
 */

import { createClient } from '@supabase/supabase-js'
import { existsSync, readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath, pathToFileURL } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

export const USD_TO_GBP_RESEARCH_EXCHANGE_RATE = 0.75
export const CONVERTED_FROM_USD_FIX_REASON = 'converted_from_usd_fix'

function loadEnvFile(relativePath) {
  const path = join(ROOT, relativePath)
  if (!existsSync(path)) return
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const index = trimmed.indexOf('=')
    if (index === -1) continue
    const key = trimmed.slice(0, index).trim()
    const value = trimmed.slice(index + 1).trim().replace(/^['"]|['"]$/g, '')
    if (!process.env[key]) process.env[key] = value
  }
}

export function convertUsdToGbpResearch(usd, exchangeRate = USD_TO_GBP_RESEARCH_EXCHANGE_RATE) {
  return Math.round(Number(usd) * exchangeRate)
}

export function isApproximatelyEqual(left, right, tolerance = 1) {
  return Math.abs(Number(left) - Number(right)) <= tolerance
}

/**
 * Detect rows where USD original_rrp was copied verbatim into GBP best_original_price.
 */
export function assessUsdGbpMisconversionRow(
  row,
  exchangeRate = USD_TO_GBP_RESEARCH_EXCHANGE_RATE,
) {
  const currency = String(row?.currency ?? '').toUpperCase()
  const bestCurrency = String(row?.best_original_price_currency ?? '').toUpperCase()
  const originalRrp = Number(row?.original_rrp)
  const bestPrice = Number(row?.best_original_price)

  if (currency !== 'USD') {
    return { affected: false, reason: 'original_rrp_not_usd' }
  }
  if (bestCurrency !== 'GBP') {
    return { affected: false, reason: 'best_original_price_not_gbp' }
  }
  if (!Number.isFinite(originalRrp) || originalRrp <= 0) {
    return { affected: false, reason: 'missing_original_rrp' }
  }
  if (!Number.isFinite(bestPrice) || bestPrice <= 0) {
    return { affected: false, reason: 'missing_best_original_price' }
  }

  const expectedConverted = convertUsdToGbpResearch(originalRrp, exchangeRate)
  if (isApproximatelyEqual(bestPrice, expectedConverted)) {
    return {
      affected: false,
      reason: 'already_converted',
      expectedConverted,
    }
  }

  const copiedUsdIntoGbp = isApproximatelyEqual(bestPrice, originalRrp, Math.max(1, originalRrp * 0.01))
  if (!copiedUsdIntoGbp) {
    return {
      affected: false,
      reason: 'best_price_neither_usd_copy_nor_expected_conversion',
      expectedConverted,
    }
  }

  return {
    affected: true,
    reason: 'usd_amount_copied_as_gbp',
    originalRrp,
    currentBestPrice: bestPrice,
    expectedConverted,
    exchangeRate,
  }
}

export function buildUsdGbpFixPatch(assessment, now = new Date().toISOString()) {
  if (!assessment.affected) {
    throw new Error('Cannot build fix patch for unaffected row.')
  }

  return {
    best_original_price: assessment.expectedConverted,
    best_original_price_currency: 'GBP',
    best_original_price_updated_at: now,
    updated_at: now,
  }
}

async function fetchCandidateRows(admin) {
  const rows = []
  let from = 0

  while (true) {
    const { data, error } = await admin
      .from('equipment_intelligence')
      .select(`
        id,
        brand,
        series,
        model,
        slug,
        original_rrp,
        currency,
        best_original_price,
        best_original_price_currency,
        best_original_price_confidence,
        best_original_price_source_id,
        best_original_price_updated_at
      `)
      .eq('currency', 'USD')
      .eq('best_original_price_currency', 'GBP')
      .order('slug', { ascending: true })
      .range(from, from + 999)

    if (error) throw new Error(error.message)
    const page = data ?? []
    rows.push(...page)
    if (page.length < 1000) break
    from += 1000
  }

  return rows
}

async function main() {
  loadEnvFile('.env.local')
  loadEnvFile('.env')

  const applyChanges = process.argv.includes('--apply')
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceRoleKey) {
    throw new Error('Missing SUPABASE_URL/VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  }

  const admin = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const candidates = await fetchCandidateRows(admin)
  const assessments = candidates.map((row) => ({
    row,
    assessment: assessUsdGbpMisconversionRow(row),
  }))

  const affected = assessments.filter((entry) => entry.assessment.affected)
  const skipped = assessments.filter((entry) => !entry.assessment.affected)

  console.log('USD → GBP misconversion audit')
  console.log(`Mode: ${applyChanges ? 'APPLY' : 'DRY RUN'}`)
  console.log(`USD/GBP candidate rows: ${candidates.length}`)
  console.log(`Affected (USD copied as GBP): ${affected.length}`)
  console.log(`Skipped (already converted or unrelated): ${skipped.length}`)
  console.log('')

  if (affected.length > 0) {
    console.log('Affected rows:')
    for (const { row, assessment } of affected) {
      console.log(
        `- ${row.slug}: original_rrp=$${assessment.originalRrp} USD`
        + ` → best_original_price £${assessment.currentBestPrice}`
        + ` should be £${assessment.expectedConverted}`
        + ` @ ${assessment.exchangeRate}`,
      )
    }
  } else {
    console.log('No misconverted rows found.')
  }

  if (!applyChanges) {
    console.log('\nDry run complete. Pass --apply to write fixes.')
    return
  }

  let applied = 0
  const now = new Date().toISOString()

  for (const { row, assessment } of affected) {
    const patch = buildUsdGbpFixPatch(assessment, now)
    const { error } = await admin
      .from('equipment_intelligence')
      .update(patch)
      .eq('id', row.id)

    if (error) throw new Error(`${row.slug}: ${error.message}`)

    if (row.best_original_price_source_id) {
      const { error: sourceError } = await admin
        .from('equipment_price_sources')
        .update({
          price: assessment.expectedConverted,
          currency: 'GBP',
          notes: CONVERTED_FROM_USD_FIX_REASON,
          updated_at: now,
        })
        .eq('id', row.best_original_price_source_id)

      if (sourceError) {
        console.warn(`Warning: could not update linked price source for ${row.slug}: ${sourceError.message}`)
      }
    }

    applied += 1
  }

  console.log(`\nApplied fixes: ${applied}`)
  console.log(`Marked reason: ${CONVERTED_FROM_USD_FIX_REASON}`)
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error.message || error)
    process.exit(1)
  })
}