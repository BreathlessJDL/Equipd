/**
 * Report baseline manufacture year coverage across equipment_intelligence.
 *
 * Usage:
 *   npx deno run --allow-env --allow-net --allow-read scripts/audit-baseline-manufacture-year.ts
 *   npx deno run --allow-env --allow-net --allow-read scripts/audit-baseline-manufacture-year.ts Technogym
 */

import { getSupabaseAdmin } from '../supabase/functions/_shared/supabase-admin.ts'
import {
  BASELINE_MANUFACTURE_YEAR_SOURCE,
  buildTechnogymProvisionalBaselinePlan,
  deriveBaselineManufactureYearStatus,
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

async function fetchRows(brand: string | null) {
  const admin = getSupabaseAdmin()
  const rows = []
  let from = 0

  while (true) {
    let query = admin
      .from('equipment_intelligence')
      .select(`
        id,
        brand,
        model,
        slug,
        manufacture_year,
        baseline_manufacture_year,
        baseline_manufacture_year_confidence,
        baseline_manufacture_year_source
      `)
      .order('brand', { ascending: true })
      .order('slug', { ascending: true })
      .range(from, from + 999)

    if (brand) query = query.ilike('brand', brand)

    const { data, error } = await query
    if (error) throw new Error(error.message)
    const page = data ?? []
    rows.push(...page)
    if (page.length < 1000) break
    from += 1000
  }

  return rows
}

function summarize(rows: Array<Record<string, unknown>>) {
  const counts = {
    total: rows.length,
    withBaseline: 0,
    verified: 0,
    estimated: 0,
    missing: 0,
    bySource: new Map<string, number>(),
  }

  for (const row of rows) {
    const status = deriveBaselineManufactureYearStatus(row)
    if (status === 'verified') counts.verified += 1
    else if (status === 'estimated') counts.estimated += 1
    else counts.missing += 1

    if (row.baseline_manufacture_year != null) {
      counts.withBaseline += 1
      const source = String(row.baseline_manufacture_year_source ?? 'unknown')
      counts.bySource.set(source, (counts.bySource.get(source) ?? 0) + 1)
    }
  }

  return counts
}

loadEnvLocal()

const brandFilter = Deno.args[0]?.trim() || null
const rows = await fetchRows(brandFilter)
const summary = summarize(rows)

console.log('Baseline manufacture year audit')
console.log(brandFilter ? `Brand filter: ${brandFilter}` : 'All manufacturers')
console.log('')
console.log(`Total rows: ${summary.total}`)
console.log(`With baseline year: ${summary.withBaseline}`)
console.log(`Verified: ${summary.verified}`)
console.log(`Estimated (provisional): ${summary.estimated}`)
console.log(`Missing: ${summary.missing}`)
console.log('')
console.log('By source:')
for (const [source, count] of [...summary.bySource.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`- ${source}: ${count}`)
}

const technogymRows = brandFilter?.toLowerCase() === 'technogym'
  ? rows
  : rows.filter((row) => String(row.brand).toLowerCase() === 'technogym')

if (technogymRows.length > 0) {
  const plan = buildTechnogymProvisionalBaselinePlan(technogymRows)
  const familiesNeedingProvisional = plan.familiesWithEarliestYear.filter((family) => (
    family.rows.some((row) => row.baseline_manufacture_year == null)
  ))

  console.log('')
  console.log('Technogym provisional baseline opportunity')
  console.log(`Model families with trade-in matrix years: ${plan.familiesWithEarliestYear.length}`)
  console.log(`Families where earliest year can still fill missing baselines: ${familiesNeedingProvisional.length}`)
  console.log(`Rows eligible for provisional apply: ${plan.applications.length}`)
  console.log(`Matrix rows awaiting canonical inheritance: ${plan.inheritanceCandidates.length}`)
  console.log(`Provisional source key: ${BASELINE_MANUFACTURE_YEAR_SOURCE.TECHNOGYM_TRADE_IN_MATRIX}`)
}

console.log('')
console.log('Depreciation engine should use equipment_intelligence.baseline_manufacture_year by default.')
