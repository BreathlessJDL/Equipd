import { getSupabaseAdmin } from '../supabase/functions/_shared/supabase-admin.ts'
import { researchEquipmentIntelligence } from '../supabase/functions/_shared/intelligenceEquipmentResearch.ts'

const equipmentId = Deno.args[0]?.trim()
if (!equipmentId) {
  console.error('Usage: deno run scripts/profile-equipment-research-local.ts <equipment_id>')
  Deno.exit(1)
}

const serpApiKey = Deno.env.get('SERPAPI_API_KEY')?.trim()
const openAiApiKey = Deno.env.get('OPENAI_API_KEY')?.trim()

if (!serpApiKey || !openAiApiKey) {
  console.error('SERPAPI_API_KEY and OPENAI_API_KEY are required')
  Deno.exit(1)
}

const admin = getSupabaseAdmin()
const { data: equipment, error } = await admin
  .from('equipment_intelligence')
  .select('id, brand, series, model, slug, equipment_type, category, original_rrp')
  .eq('id', equipmentId)
  .maybeSingle()

if (error) {
  console.error(error.message)
  Deno.exit(1)
}

if (!equipment) {
  console.error('Equipment intelligence record not found')
  Deno.exit(1)
}

const result = await researchEquipmentIntelligence(equipment, {
  serpApiKey,
  openAiApiKey,
  openAiModel: Deno.env.get('OPENAI_MODEL')?.trim() || undefined,
})

console.log(`__PROFILE_RESULT__${JSON.stringify(result)}`)
