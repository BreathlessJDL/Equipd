import { getSupabaseAdmin } from '../supabase/functions/_shared/supabase-admin.ts'
import { researchEquipmentIntelligenceV3 } from '../supabase/functions/_shared/intelligenceEquipmentResearchV3.ts'

const equipmentId = Deno.args[0]?.trim()
if (!equipmentId) {
  console.error('Usage: deno run scripts/profile-equipment-research-v3-local.ts <equipment_id>')
  Deno.exit(1)
}

const serpApiKey = Deno.env.get('SERPAPI_API_KEY')?.trim()
const openAiApiKey = Deno.env.get('OPENAI_API_KEY')?.trim()
if (!serpApiKey || !openAiApiKey) {
  console.error('SERPAPI_API_KEY and OPENAI_API_KEY are required')
  Deno.exit(1)
}

function mem() {
  return Deno.memoryUsage()
}

function logStage(stage: string, startedAt: number) {
  const usage = mem()
  console.info(JSON.stringify({
    stage,
    elapsed_ms: Date.now() - startedAt,
    heap_used_mb: Math.round(usage.heapUsed / 1024 / 1024),
    heap_total_mb: Math.round(usage.heapTotal / 1024 / 1024),
    rss_mb: Math.round(usage.rss / 1024 / 1024),
  }))
}

const admin = getSupabaseAdmin()
const { data: equipment, error } = await admin
  .from('equipment_intelligence')
  .select('id, brand, series, model, slug, equipment_type, category, original_rrp, product_family, core_product_name, core_product_key, variant_name, is_base_product')
  .eq('id', equipmentId)
  .maybeSingle()

if (error || !equipment) {
  console.error(error?.message ?? 'Equipment not found')
  Deno.exit(1)
}

const startedAt = Date.now()
logStage('start', startedAt)

const result = await researchEquipmentIntelligenceV3(equipment, {
  serpApiKey,
  openAiApiKey,
  openAiModel: Deno.env.get('OPENAI_MODEL')?.trim() || undefined,
})

logStage('complete', startedAt)

const debug = result.debug_log
const timings = debug.timings
const responseBytes = JSON.stringify(result).length
const promptBytes = JSON.stringify(debug.v3_openai_request?.prompt ?? '').length

console.info(JSON.stringify({
  summary: {
    equipment: debug.equipment_label,
    total_execution_ms: timings.total_execution_ms,
    serp_total_ms: timings.serp_total_ms,
    serp_requests: timings.serp_requests.length,
    ranking_ms: timings.ranking_ms,
    stage_2_fetch_total_ms: timings.stage_2_fetch_total_ms,
    stage_2_openai_ms: timings.stage_2_openai_ms,
    pages_fetched: debug.sources_successfully_read,
    pdf_downloads: debug.pdf_downloads_attempted,
    serp_raw_url_hits: debug.serp_raw_url_hits,
    sources_sent_to_ai: debug.sources_sent_to_ai,
    structured_price_evidence: debug.structured_price_evidence?.length ?? 0,
    structured_lifecycle_evidence: debug.structured_lifecycle_evidence?.length ?? 0,
    response_bytes: responseBytes,
    prompt_bytes: promptBytes,
    progress_log: debug.progress_log,
  },
  memory_at_end: {
    heap_used_mb: Math.round(mem().heapUsed / 1024 / 1024),
    rss_mb: Math.round(mem().rss / 1024 / 1024),
  },
}))
