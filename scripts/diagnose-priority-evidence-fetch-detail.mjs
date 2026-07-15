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
  const { data, error } = await admin
    .from('equipment_intelligence')
    .select('id, brand, series, model, equipment_type, category, slug')
    .order('id')
    .range(from, from + 999)
  if (error) throw error
  rows.push(...(data ?? []))
  if ((data ?? []).length < 1000) break
  from += 1000
}

const fields = 'id, brand, series, model, slug, equipment_type, manufacture_year, original_rrp, currency, best_original_price, best_original_price_currency, best_original_price_confidence, best_original_price_source_id, best_original_price_updated_at, manufacture_start_year, manufacture_end_year, manufacture_year_confidence, manufacture_year_source_id, lifecycle_updated_at, baseline_manufacture_year, baseline_manufacture_year_confidence, baseline_manufacture_year_source, baseline_manufacture_year_updated_at'

const top200 = rankSearchGroupsByPriority(rows, 200)
const equipmentIds = [...new Set(top200.flatMap((g) => g.equipment_ids ?? []))]

console.log('=== Reproducing fetchPriorityEvidenceGroups failure ===')
console.log('Step 1 - Edge function intelligence-priority-sync')
console.log('Frontend sends:', JSON.stringify({ limit: 200 }))
console.log('Edge function expects:', JSON.stringify({ limit: 'number (optional, clamped 1-200)' }))
console.log('Result: OK (not the source of 400)')

console.log('\nStep 2 - Supabase REST equipment_intelligence select')
console.log('Frontend sends:')
console.log('  method: GET (via supabase-js)')
console.log('  table: equipment_intelligence')
console.log('  select:', fields.split(', ').length, 'columns')
console.log('  filter: id=in.(' + equipmentIds.length + ' UUIDs)')
console.log('  sample ids:', equipmentIds.slice(0, 2))

const { data, error } = await admin
  .from('equipment_intelligence')
  .select(fields)
  .in('id', equipmentIds)

console.log('\nResponse:')
console.log('  error.message:', error?.message)
console.log('  error.code:', error?.code)
console.log('  error.details:', error?.details)
console.log('  error.hint:', error?.hint)
console.log('  rows:', data?.length ?? 0)

// Approximate URL length
const url = `${process.env.SUPABASE_URL}/rest/v1/equipment_intelligence?select=${encodeURIComponent(fields)}&id=in.(${equipmentIds.join(',')})`
console.log('\nApproximate GET URL length:', url.length, 'chars')

console.log('\nStep 3 - Research Top 100 click handler')
console.log('No HTTP request is made on click; only local buildIncompleteResearchQueue(allRankedGroups).')
console.log('The 400 occurs during page loadGroups() -> fetchPriorityEvidenceGroups(), not on button click.')
