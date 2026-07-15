/**
 * Audit imported catalogue manufacture year vs equipment_intelligence lifecycle fields.
 * Read-only — does not modify data.
 *
 * Usage:
 *   npx deno run --allow-env --allow-net scripts/audit-catalogue-lifecycle.ts
 *   npx deno run --allow-env --allow-net scripts/audit-catalogue-lifecycle.ts Technogym
 *   npx deno run --allow-env --allow-net scripts/audit-catalogue-lifecycle.ts --all
 */

import { getSupabaseAdmin } from '../supabase/functions/_shared/supabase-admin.ts'

type EquipmentRow = {
  id: string
  brand: string
  series: string | null
  model: string
  slug: string
  equipment_type: string | null
  manufacture_year: number | null
  manufacture_start_year: number | null
  manufacture_end_year: number | null
  manufacture_year_confidence: number | null
  manufacture_year_source_id: string | null
  lifecycle_updated_at: string | null
}

type LifecycleSourceRow = {
  equipment_id: string
  manufacture_start_year: number | null
  manufacture_end_year: number | null
  source_type: string
  confidence: number
  source_name: string | null
}

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

function slugBaseWithoutYear(slug: string) {
  return slug.replace(/-\d{4}$/, '')
}

function label(row: EquipmentRow) {
  return [row.brand, row.series, row.model].filter(Boolean).join(' ')
}

function hasImportedYear(row: EquipmentRow) {
  return row.manufacture_year != null
}

function hasResearchedLifecycle(row: EquipmentRow) {
  return row.manufacture_start_year != null
    || row.manufacture_end_year != null
    || row.manufacture_year_source_id != null
    || row.lifecycle_updated_at != null
}

function yearsConflict(row: EquipmentRow) {
  if (!hasImportedYear(row) || row.manufacture_start_year == null) return false
  return row.manufacture_year !== row.manufacture_start_year
}

async function fetchEquipmentForBrand(brand: string): Promise<EquipmentRow[]> {
  const admin = getSupabaseAdmin()
  const rows: EquipmentRow[] = []
  let from = 0
  const pageSize = 1000

  while (true) {
    const { data, error } = await admin
      .from('equipment_intelligence')
      .select(`
        id,
        brand,
        series,
        model,
        slug,
        equipment_type,
        manufacture_year,
        manufacture_start_year,
        manufacture_end_year,
        manufacture_year_confidence,
        manufacture_year_source_id,
        lifecycle_updated_at
      `)
      .ilike('brand', brand)
      .order('model', { ascending: true })
      .range(from, from + pageSize - 1)

    if (error) throw new Error(error.message)
    const page = (data ?? []) as EquipmentRow[]
    rows.push(...page)
    if (page.length < pageSize) break
    from += pageSize
  }

  return rows
}

async function fetchAllBrands(): Promise<string[]> {
  const admin = getSupabaseAdmin()
  const brands = new Set<string>()
  let from = 0
  const pageSize = 1000

  while (true) {
    const { data, error } = await admin
      .from('equipment_intelligence')
      .select('brand')
      .order('brand', { ascending: true })
      .range(from, from + pageSize - 1)

    if (error) throw new Error(error.message)
    const page = data ?? []
    for (const row of page) {
      if (row.brand) brands.add(row.brand)
    }
    if (page.length < pageSize) break
    from += pageSize
  }

  return [...brands].sort((a, b) => a.localeCompare(b))
}

async function fetchLifecycleSources(equipmentIds: string[]): Promise<Map<string, LifecycleSourceRow[]>> {
  const admin = getSupabaseAdmin()
  const byEquipment = new Map<string, LifecycleSourceRow[]>()
  const chunkSize = 200

  for (let index = 0; index < equipmentIds.length; index += chunkSize) {
    const chunk = equipmentIds.slice(index, index + chunkSize)
    const { data, error } = await admin
      .from('equipment_lifecycle_sources')
      .select('equipment_id, manufacture_start_year, manufacture_end_year, source_type, confidence, source_name')
      .in('equipment_id', chunk)

    if (error) throw new Error(error.message)

    for (const source of (data ?? []) as LifecycleSourceRow[]) {
      const list = byEquipment.get(source.equipment_id) ?? []
      list.push(source)
      byEquipment.set(source.equipment_id, list)
    }
  }

  return byEquipment
}

type AuditBuckets = {
  total: number
  importHasYear: number
  researchedHasStart: number
  researchedHasAnyLifecycle: number
  alreadyAligned: EquipmentRow[]
  importAvailableUnpopulated: EquipmentRow[]
  missingCompletely: EquipmentRow[]
  wouldOverwriteResearch: Array<{
    row: EquipmentRow
    reason: string
    lifecycleSources: LifecycleSourceRow[]
  }>
  researchOnlyNoImport: EquipmentRow[]
}

function auditRows(
  rows: EquipmentRow[],
  lifecycleByEquipment: Map<string, LifecycleSourceRow[]>,
): AuditBuckets {
  const buckets: AuditBuckets = {
    total: rows.length,
    importHasYear: 0,
    researchedHasStart: 0,
    researchedHasAnyLifecycle: 0,
    alreadyAligned: [],
    importAvailableUnpopulated: [],
    missingCompletely: [],
    wouldOverwriteResearch: [],
    researchOnlyNoImport: [],
  }

  for (const row of rows) {
    const lifecycleSources = lifecycleByEquipment.get(row.id) ?? []
    const imported = hasImportedYear(row)
    const researched = hasResearchedLifecycle(row)

    if (imported) buckets.importHasYear += 1
    if (row.manufacture_start_year != null) buckets.researchedHasStart += 1
    if (researched || lifecycleSources.length > 0) buckets.researchedHasAnyLifecycle += 1

    if (imported && row.manufacture_start_year != null && row.manufacture_year === row.manufacture_start_year) {
      buckets.alreadyAligned.push(row)
    }

    if (imported && row.manufacture_start_year == null && row.manufacture_end_year == null) {
      buckets.importAvailableUnpopulated.push(row)
    }

    if (!imported && !researched && lifecycleSources.length === 0) {
      buckets.missingCompletely.push(row)
    }

    if ((researched || lifecycleSources.length > 0) && !imported) {
      buckets.researchOnlyNoImport.push(row)
    }

    if (imported && (researched || lifecycleSources.length > 0)) {
      const conflict = yearsConflict(row)
      const onlyEndYear = row.manufacture_start_year == null && row.manufacture_end_year != null

      if (conflict || onlyEndYear) {
        const parts: string[] = []
        if (conflict) {
          parts.push(`import manufacture_year=${row.manufacture_year} vs researched start=${row.manufacture_start_year}`)
        }
        if (onlyEndYear) {
          parts.push(`import single year vs researched end-only period (${row.manufacture_end_year})`)
        }
        if (row.manufacture_year_confidence != null) {
          parts.push(`research confidence ${row.manufacture_year_confidence}%`)
        }
        if (lifecycleSources.length > 0) {
          const top = [...lifecycleSources].sort((a, b) => b.confidence - a.confidence)[0]
          parts.push(`lifecycle source: ${top.source_type} (${top.confidence}%)`)
        }

        buckets.wouldOverwriteResearch.push({
          row,
          reason: parts.join(' · '),
          lifecycleSources,
        })
      }
    }
  }

  return buckets
}

function printRowList(
  title: string,
  items: EquipmentRow[],
  extra?: (row: EquipmentRow) => string,
) {
  console.log(`\n### ${title} (${items.length})`)
  if (items.length === 0) {
    console.log('—')
    return
  }

  const limit = 40
  for (const row of items.slice(0, limit)) {
    const imported = row.manufacture_year ?? '—'
    const start = row.manufacture_start_year ?? '—'
    const end = row.manufacture_end_year ?? '—'
    const suffix = extra ? ` · ${extra(row)}` : ''
    console.log(`- ${label(row)} | import=${imported} | start=${start} end=${end} | ${row.slug}${suffix}`)
  }
  if (items.length > limit) {
    console.log(`… and ${items.length - limit} more`)
  }
}

function printOverwriteList(items: AuditBuckets['wouldOverwriteResearch']) {
  console.log(`\n### Would overwrite AI / evidence-backed research (${items.length})`)
  if (items.length === 0) {
    console.log('—')
    return
  }

  const limit = 40
  for (const entry of items.slice(0, limit)) {
    const { row } = entry
    console.log(`- ${label(row)} | import=${row.manufacture_year ?? '—'} | researched ${row.manufacture_start_year ?? '—'}–${row.manufacture_end_year ?? '—'} | ${row.slug}`)
    console.log(`  ${entry.reason}`)
  }
  if (items.length > limit) {
    console.log(`… and ${items.length - limit} more`)
  }
}

function printBrandReport(brand: string, buckets: AuditBuckets) {
  console.log('\n' + '='.repeat(72))
  console.log(brand)
  console.log('='.repeat(72))
  console.log(`Total rows: ${buckets.total}`)
  console.log(`Rows with imported manufacture_year: ${buckets.importHasYear} (${pct(buckets.importHasYear, buckets.total)})`)
  console.log(`Rows with manufacture_start_year (researched/derived): ${buckets.researchedHasStart} (${pct(buckets.researchedHasStart, buckets.total)})`)
  console.log(`Rows with any lifecycle evidence: ${buckets.researchedHasAnyLifecycle} (${pct(buckets.researchedHasAnyLifecycle, buckets.total)})`)
  console.log(`Already aligned (import year = start year): ${buckets.alreadyAligned.length}`)
  console.log(`Import year available, v2 start NOT populated: ${buckets.importAvailableUnpopulated.length}`)
  console.log(`Missing manufacture year completely: ${buckets.missingCompletely.length}`)
  console.log(`Would overwrite existing research if import synced: ${buckets.wouldOverwriteResearch.length}`)
  console.log(`Research/evidence only, no import year: ${buckets.researchOnlyNoImport.length}`)

  printRowList(
    'Import year available but manufacture_start_year not populated',
    buckets.importAvailableUnpopulated,
  )
  printRowList(
    'Missing manufacture year completely (no import, no research)',
    buckets.missingCompletely,
  )
  printOverwriteList(buckets.wouldOverwriteResearch)
}

function pct(part: number, total: number) {
  if (total === 0) return '0%'
  return `${Math.round((part / total) * 100)}%`
}

loadEnvLocal()

const arg = Deno.args[0]?.trim()
const auditAll = arg === '--all'
const brandFilter = auditAll ? null : (arg || 'Technogym')

const brands = auditAll ? await fetchAllBrands() : [brandFilter!]
const summary: Array<{ brand: string; buckets: AuditBuckets }> = []

for (const brand of brands) {
  const rows = await fetchEquipmentForBrand(brand)
  if (rows.length === 0) {
    console.log(`\n${brand}: no equipment_intelligence rows found`)
    continue
  }

  const lifecycleByEquipment = await fetchLifecycleSources(rows.map((row) => row.id))
  const buckets = auditRows(rows, lifecycleByEquipment)
  summary.push({ brand, buckets })
  printBrandReport(brand, buckets)
}

if (summary.length > 1) {
  console.log('\n' + '='.repeat(72))
  console.log('ALL MANUFACTURERS SUMMARY')
  console.log('='.repeat(72))
  console.log('Brand | Total | Import year | Start year | Unpopulated | Missing | Overwrite risk')
  for (const { brand, buckets } of summary) {
    console.log([
      brand.padEnd(18),
      String(buckets.total).padStart(5),
      String(buckets.importHasYear).padStart(11),
      String(buckets.researchedHasStart).padStart(10),
      String(buckets.importAvailableUnpopulated.length).padStart(11),
      String(buckets.missingCompletely.length).padStart(7),
      String(buckets.wouldOverwriteResearch.length).padStart(15),
    ].join(' | '))
  }
}
