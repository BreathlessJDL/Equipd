/**
 * Compare legacy-only lifecycle search vs legacy + specialist support search.
 *
 * Usage:
 *   npx deno run --allow-env --allow-net scripts/compare-lifecycle-strategies.ts
 *
 * Requires SERPAPI_KEY in .env.local. Optionally OPENAI_API_KEY for production inference.
 */

import { compareLifecycleResearchStrategies } from '../supabase/functions/_shared/intelligenceEquipmentResearch.ts'

const TEST_EQUIPMENT = [
  {
    id: 'lf-95ti',
    brand: 'Life Fitness',
    series: 'Silver Line',
    model: '95Ti',
    slug: 'life-fitness-95ti',
    equipment_type: 'Treadmill',
  },
  {
    id: 'lf-ic7',
    brand: 'Life Fitness',
    series: 'ICG',
    model: 'IC7',
    slug: 'life-fitness-ic7',
    equipment_type: 'Bike',
  },
  {
    id: 'c2-model-d',
    brand: 'Concept2',
    series: null,
    model: 'Model D',
    slug: 'concept2-model-d',
    equipment_type: 'Rower',
  },
  {
    id: 'tg-skillmill',
    brand: 'Technogym',
    series: null,
    model: 'SkillMill',
    slug: 'technogym-skillmill',
    equipment_type: 'Treadmill',
  },
] as const

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
  } catch {
    // optional
  }
}

function formatProduction(production: {
  start_year: number | null
  end_year: number | null
  confidence: number | null
  sources_used: string[]
  reasoning: string
} | null) {
  if (!production) return 'OpenAI not run (set OPENAI_API_KEY for inference)'
  const years = production.start_year || production.end_year
    ? `${production.start_year ?? '?'}–${production.end_year ?? '?'}`
    : 'not found'
  return `${years} (confidence ${production.confidence ?? 0}%) · sources: ${production.sources_used.length}`
}

loadEnvLocal()

const serpApiKey = Deno.env.get('SERPAPI_KEY') || Deno.env.get('SERP_API_KEY')
if (!serpApiKey) {
  console.error('Missing SERPAPI_KEY in environment or .env.local')
  Deno.exit(1)
}

const openAiApiKey = Deno.env.get('OPENAI_API_KEY') || undefined

console.log('Lifecycle strategy comparison')
console.log(`OpenAI inference: ${openAiApiKey ? 'enabled' : 'disabled (Serp ranking only)'}`)
console.log('')

for (const equipment of TEST_EQUIPMENT) {
  console.log('='.repeat(72))
  console.log(equipment.brand, equipment.model)
  console.log('='.repeat(72))

  const result = await compareLifecycleResearchStrategies(equipment, serpApiKey, {
    openAiApiKey,
  })

  console.log('\nLegacy only (5 lifecycle queries)')
  console.log('  Sources returned:', result.legacy_only.sources_returned)
  console.log('  Top domains:', result.legacy_only.top_domains.join(', ') || '—')
  console.log('  AI selection domains:', result.legacy_only.ai_selection_domains.join(', ') || '—')
  console.log('  Production:', formatProduction(result.legacy_only.production))

  console.log('\nLegacy + specialist (5 lifecycle + 8 specialist queries)')
  console.log('  Sources returned:', result.legacy_plus_specialist.sources_returned)
  console.log('  Specialist-only returned:', result.legacy_plus_specialist.specialist_sources_returned)
  console.log('  Top domains:', result.legacy_plus_specialist.top_domains.join(', ') || '—')
  console.log('  AI selection domains:', result.legacy_plus_specialist.ai_selection_domains.join(', ') || '—')
  console.log('  Production:', formatProduction(result.legacy_plus_specialist.production))

  if (result.legacy_plus_specialist.production?.reasoning) {
    console.log('\n  Combined reasoning:', result.legacy_plus_specialist.production.reasoning)
  }

  console.log('')
}
