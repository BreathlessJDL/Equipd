import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'

const IN_QUERY_CHUNK_SIZE = 100

function chunkArray(items, chunkSize = IN_QUERY_CHUNK_SIZE) {
  if (!Array.isArray(items) || items.length === 0) return []
  const size = Math.max(1, Math.floor(chunkSize))
  const chunks = []
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size))
  }
  return chunks
}

function dedupeRowsById(rows = []) {
  return [...new Map(rows.map((row) => [row.id, row])).values()]
}

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
const chunks = chunkArray(equipmentIds, IN_QUERY_CHUNK_SIZE)

console.log(`Chunking ${equipmentIds.length} equipment IDs into ${chunks.length} requests (${IN_QUERY_CHUNK_SIZE} per chunk)`)

const merged = []
for (const chunkIds of chunks) {
  const { data, error } = await admin
    .from('equipment_intelligence')
    .select(fields)
    .in('id', chunkIds)
  if (error) {
    console.error('Chunk failed:', error.message)
    process.exit(1)
  }
  merged.push(...(data ?? []))
}

const deduped = dedupeRowsById(merged)
console.log(`Fetched ${merged.length} rows, ${deduped.length} unique after dedupe`)
console.log('Chunked hydration test passed')
