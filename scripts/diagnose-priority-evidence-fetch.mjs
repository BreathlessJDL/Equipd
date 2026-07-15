import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'

function loadEnv() {
  try {
    const text = readFileSync('.env.local', 'utf8')
    for (const line of text.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const index = trimmed.indexOf('=')
      if (index === -1) continue
      const key = trimmed.slice(0, index).trim()
      const value = trimmed.slice(index + 1).trim().replace(/^['"]|['"]$/g, '')
      if (!process.env[key]) process.env[key] = value
    }
  } catch { /* optional */ }
}

loadEnv()

const admin = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
)

const { rankSearchGroupsByPriority } = await import('../supabase/functions/_shared/intelligencePrioritySync.ts')

const rows = []
let from = 0
while (true) {
  const { data, error, count } = await admin
    .from('equipment_intelligence')
    .select('id, brand, series, model, equipment_type, category, slug', { count: 'exact' })
    .order('id')
    .range(from, from + 999)
  if (error) throw error
  rows.push(...(data ?? []))
  if ((data ?? []).length < 1000) break
  from += 1000
}
console.log('total catalogue rows:', rows.length)

for (const limit of [50, 100, 200]) {
  const top = rankSearchGroupsByPriority(rows, limit)
  const ids = [...new Set(top.flatMap((g) => g.equipment_ids ?? []))]
  console.log(`priority limit ${limit}: groups=${top.length}, unique equipment ids=${ids.length}`)
}

const top200 = rankSearchGroupsByPriority(rows, 200)
const ids = [...new Set(top200.flatMap((g) => g.equipment_ids ?? []))]

const fields = 'id, brand, series, model, slug, equipment_type, manufacture_year, original_rrp, currency, best_original_price, best_original_price_currency, best_original_price_confidence, best_original_price_source_id, best_original_price_updated_at, manufacture_start_year, manufacture_end_year, manufacture_year_confidence, manufacture_year_source_id, lifecycle_updated_at, baseline_manufacture_year, baseline_manufacture_year_confidence, baseline_manufacture_year_source, baseline_manufacture_year_updated_at'

console.log('\n.in(id) threshold test (full EVIDENCE_EQUIPMENT_FIELDS):')
for (const n of [50, 100, 150, 200, 300, 400, 500, 600, 700, 800, 900, 1000, ids.length]) {
  const chunk = ids.slice(0, Math.min(n, ids.length))
  const { error } = await admin.from('equipment_intelligence').select(fields).in('id', chunk)
  console.log(`  ${chunk.length} ids -> ${error?.message ?? 'ok'}`)
}

const fieldsOld = 'id, brand, series, model, slug, equipment_type, manufacture_year, original_rrp, currency, best_original_price, best_original_price_currency, best_original_price_confidence, best_original_price_source_id, best_original_price_updated_at, manufacture_start_year, manufacture_end_year, manufacture_year_confidence, manufacture_year_source_id, lifecycle_updated_at'

console.log('\nCompare old vs new field list at 533 ids (limit 100 groups):')
const top100 = rankSearchGroupsByPriority(rows, 100)
const ids100 = [...new Set(top100.flatMap((g) => g.equipment_ids ?? []))]
for (const [label, fieldList] of [['old fields', fieldsOld], ['new fields (+baseline)', fields]]) {
  const { error } = await admin.from('equipment_intelligence').select(fieldList).in('id', ids100)
  console.log(`  ${label}, ${ids100.length} ids -> ${error?.message ?? 'ok'}`)
}

console.log('\nFull fetchPriorityEvidenceGroups simulation:')
for (const queueScanLimit of [100, 200]) {
  const top = rankSearchGroupsByPriority(rows, queueScanLimit)
  const groupIds = [...new Set(top.flatMap((g) => g.equipment_ids ?? []))]
  const { error } = await admin.from('equipment_intelligence').select(fields).in('id', groupIds)
  console.log(`  queueScanLimit=${queueScanLimit}, equipment ids=${groupIds.length} -> ${error?.message ?? 'ok'}`)
}
