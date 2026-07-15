/**
 * Apply provisional Technogym baseline years from earliest trade-in matrix year.
 *
 * Usage:
 *   npx deno run --allow-env --allow-net --allow-read scripts/apply-technogym-provisional-baselines.ts
 *   npx deno run --allow-env --allow-net --allow-read scripts/apply-technogym-provisional-baselines.ts --apply
 */

import { getSupabaseAdmin } from '../supabase/functions/_shared/supabase-admin.ts'
import {
  BASELINE_MANUFACTURE_YEAR_SOURCE,
  PROVISIONAL_BASELINE_CONFIDENCE,
  buildBaselineManufactureYearPatch,
  buildTechnogymProvisionalBaselinePlan,
  shouldApplyBaselineManufactureYearUpdate,
} from '../src/lib/baselineManufactureYear.js'

function loadEnvLocal() {
  try {
    const text = Deno.readTextFileSync('.env.local')
    for (const line of text.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const index = trimmed.indexOf('=')
      if (index === -1) continue
      const key = trimmed.slice(0, index).trim()
      const value = trimmed.slice(index + 1).trim().replace(/^['"]|['"]$/g, '')
      if (!Deno.env.get(key)) Deno.env.set(key, value)
    }
    if (!Deno.env.get('SUPABASE_URL') && Deno.env.get('VITE_SUPABASE_URL')) {
      Deno.env.set('SUPABASE_URL', Deno.env.get('VITE_SUPABASE_URL')!)
    }
  } catch {
    // optional
  }
}

async function fetchTechnogymRows() {
  const admin = getSupabaseAdmin()
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
        manufacture_year,
        baseline_manufacture_year,
        baseline_manufacture_year_confidence,
        baseline_manufacture_year_source
      `)
      .ilike('brand', 'Technogym')
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

loadEnvLocal()

const applyChanges = Deno.args.includes('--apply')
const rows = await fetchTechnogymRows()
const plan = buildTechnogymProvisionalBaselinePlan(rows)

console.log('Technogym provisional baseline plan')
console.log(`Total Technogym rows: ${rows.length}`)
console.log(`Model families with earliest trade-in year: ${plan.familiesWithEarliestYear.length}`)
console.log(`Rows eligible for provisional baseline: ${plan.applications.length}`)
console.log(`Rows that could inherit canonical baseline later: ${plan.inheritanceCandidates.length}`)
console.log(`Mode: ${applyChanges ? 'APPLY' : 'DRY RUN'}`)
console.log('')

if (plan.applications.length > 0) {
  console.log('Sample provisional applications:')
  for (const entry of plan.applications.slice(0, 10)) {
    console.log(`- ${entry.row.model} (${entry.row.slug}) → ${entry.earliestImportYear} [family ${entry.familyKey}]`)
  }
  if (plan.applications.length > 10) {
    console.log(`… and ${plan.applications.length - 10} more`)
  }
}

if (plan.inheritanceCandidates.length > 0) {
  console.log('\nSample canonical inheritance candidates:')
  for (const entry of plan.inheritanceCandidates.slice(0, 5)) {
    console.log(`- ${entry.row.slug} ← ${entry.inheritFrom.slug} (${entry.inheritFrom.baseline_manufacture_year})`)
  }
}

if (!applyChanges) {
  console.log('\nDry run complete. Pass --apply to write provisional baselines.')
  Deno.exit(0)
}

const admin = getSupabaseAdmin()
let applied = 0
let skipped = 0

for (const entry of plan.applications) {
  const patch = buildBaselineManufactureYearPatch({
    year: entry.proposed.year,
    confidence: PROVISIONAL_BASELINE_CONFIDENCE,
    source: BASELINE_MANUFACTURE_YEAR_SOURCE.TECHNOGYM_TRADE_IN_MATRIX,
  })

  const current = {
    year: entry.row.baseline_manufacture_year,
    confidence: entry.row.baseline_manufacture_year_confidence,
    source: entry.row.baseline_manufacture_year_source,
  }

  if (!shouldApplyBaselineManufactureYearUpdate(current, entry.proposed)) {
    skipped += 1
    continue
  }

  const { error } = await admin
    .from('equipment_intelligence')
    .update(patch)
    .eq('id', entry.row.id)

  if (error) throw new Error(error.message)
  applied += 1
}

console.log(`\nApplied provisional baselines: ${applied}`)
console.log(`Skipped (higher-confidence existing baseline): ${skipped}`)
