import { getSupabaseAdmin } from '../supabase/functions/_shared/supabase-admin.ts'

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
  } catch { /* optional */ }
}

loadEnvLocal()
const admin = getSupabaseAdmin()

const researched = await admin
  .from('equipment_intelligence')
  .select('brand, series, model, slug, manufacture_year, manufacture_start_year, manufacture_end_year, manufacture_year_confidence, lifecycle_updated_at')
  .not('manufacture_start_year', 'is', null)

console.log('Rows with manufacture_start_year:', researched.data?.length ?? 0)
console.log(JSON.stringify(researched.data, null, 2))

const lcCount = await admin.from('equipment_lifecycle_sources').select('id', { count: 'exact', head: true })
console.log('\nTotal equipment_lifecycle_sources:', lcCount.count)

const tgRows: Array<{ model: string; slug: string; manufacture_year: number }> = []
let from = 0
while (true) {
  const { data, error } = await admin
    .from('equipment_intelligence')
    .select('model, slug, manufacture_year')
    .eq('brand', 'Technogym')
    .not('manufacture_year', 'is', null)
    .range(from, from + 999)
  if (error) throw error
  const page = data ?? []
  tgRows.push(...page as typeof tgRows)
  if (page.length < 1000) break
  from += 1000
}

const years = new Map<number, number>()
const modelKeys = new Set<string>()
for (const row of tgRows) {
  years.set(row.manufacture_year, (years.get(row.manufacture_year) ?? 0) + 1)
  modelKeys.add(String(row.slug).replace(/-\d{4}$/, ''))
}

console.log('\nTechnogym manufacture_year value distribution:')
console.log(JSON.stringify(Object.fromEntries([...years.entries()].sort((a, b) => a[0] - b[0])), null, 2))
console.log(`Technogym distinct model families (slug minus trailing year): ${modelKeys.size}`)
console.log(`Technogym rows with manufacture_year: ${tgRows.length}`)
