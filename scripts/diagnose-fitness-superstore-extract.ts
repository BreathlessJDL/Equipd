/**
 * Diagnostic: what content does the pipeline send to OpenAI for Fitness Superstore?
 * Does not change research logic — mirrors stage 1 / stage 2 paths for inspection.
 *
 * Usage:
 *   npx deno run --allow-env --allow-net scripts/diagnose-fitness-superstore-extract.ts [equipment_id]
 */

import { getSupabaseAdmin } from '../supabase/functions/_shared/supabase-admin.ts'
import {
  buildAiResearchPrompt,
  collectEquipmentResearchEvidence,
  enrichTopResearchHitsForStage2,
  mergeEnrichmentIntoResearchHits,
  selectOriginalPriceResearchHitsForAi,
  selectLifecycleResearchHitsForAi,
  selectStage2EnrichmentTargets,
} from '../supabase/functions/_shared/intelligenceEquipmentResearch.ts'
import { fetchCandidatePage, preparePageContentForAi, AI_PAGE_CONTENT_MAX_CHARS } from '../supabase/functions/_shared/intelligencePageExtract.ts'

const EQUIPMENT_ID = Deno.args[0]?.trim() || '433f33f9-f2b1-494b-9749-bcee9618226d'
const MAX_PAGE_CONTENT_CHARS = AI_PAGE_CONTENT_MAX_CHARS

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

function containsMarkers(text: string) {
  const lower = text.toLowerCase()
  return {
    '7544': /7[,.]?544|7544/.test(text),
    '£7,544': /£\s*7[,.]?544/.test(text),
    'list price': /\blist price\b/i.test(lower),
    msrp: /\bmsrp\b/i.test(lower),
    'original price': /\boriginal price\b/i.test(lower),
  }
}

function printSection(title: string) {
  console.log('\n' + '='.repeat(80))
  console.log(title)
  console.log('='.repeat(80))
}

loadEnvLocal()

const serpApiKey = Deno.env.get('SERPAPI_API_KEY')?.trim()
if (!serpApiKey) {
  console.error('SERPAPI_API_KEY required')
  Deno.exit(1)
}

const admin = getSupabaseAdmin()
const { data: equipment, error } = await admin
  .from('equipment_intelligence')
  .select('id, brand, series, model, slug, equipment_type')
  .eq('id', EQUIPMENT_ID)
  .maybeSingle()

if (error || !equipment) {
  console.error(error?.message || 'Equipment not found')
  Deno.exit(1)
}

printSection(`Equipment: ${equipment.brand} ${equipment.series ?? ''} ${equipment.model} (${equipment.id})`)

const collected = await collectEquipmentResearchEvidence(equipment, serpApiKey)
const rankedPrice = collected.price_hits
const stage1PriceHits = selectOriginalPriceResearchHitsForAi(rankedPrice)
const stage1LifecycleHits = selectLifecycleResearchHitsForAi(collected.lifecycle_hits)

const superstoreHits = rankedPrice.filter((hit) => /fitness-superstore/i.test(hit.url) || /fitness-superstore/i.test(hit.domain))
const superstoreInStage1 = stage1PriceHits.filter((hit) => /fitness-superstore/i.test(hit.url) || /fitness-superstore/i.test(hit.domain))

printSection('Serp: Fitness Superstore hits (all ranked)')
if (superstoreHits.length === 0) {
  console.log('No Fitness Superstore URLs in Serp results.')
} else {
  for (const hit of superstoreHits) {
    console.log(`- rank score ${hit.combined_rank_score ?? 'n/a'} | ${hit.title}`)
    console.log(`  URL: ${hit.url}`)
    console.log(`  Snippet (${hit.snippet?.length ?? 0} chars): ${hit.snippet || '—'}`)
    console.log(`  Snippet markers: ${JSON.stringify(containsMarkers(hit.snippet || ''))}`)
  }
}

printSection('Stage 1 AI selection (snippet-only)')
console.log(`Price sources selected ${stage1PriceHits.length}:`)
for (const hit of stage1PriceHits) {
  const isSuperstore = /fitness-superstore/i.test(hit.url)
  console.log(`- ${isSuperstore ? '[SUPERSTORE] ' : ''}${hit.title}`)
  console.log(`  ${hit.url}`)
}
console.log(`Lifecycle sources selected ${stage1LifecycleHits.length}:`)
for (const hit of stage1LifecycleHits) {
  console.log(`- ${hit.title}`)
  console.log(`  ${hit.url}`)
}
console.log(`Fitness Superstore in price stage 1: ${superstoreInStage1.length > 0 ? 'YES' : 'NO'}`)

const targetHit = superstoreInStage1[0] ?? superstoreHits[0] ?? null

if (!targetHit) {
  console.log('\nCannot diagnose page extraction — no Fitness Superstore hit found.')
  Deno.exit(0)
}

printSection(`Stage 1 OpenAI prompt excerpt for Fitness Superstore`)
const stage1Prompt = buildAiResearchPrompt(equipment, {
  priceHits: [targetHit],
  lifecycleHits: stage1LifecycleHits.slice(0, 1),
}, 'snippet')
console.log(`Prompt length: ${stage1Prompt.length} chars`)
console.log(`Includes "Page content:" line: ${stage1Prompt.includes('Page content:')}`)
console.log('\n--- Full prompt for this single source (stage 1) ---\n')
console.log(stage1Prompt)

printSection('Page fetch + extraction (stage 2 path)')
console.log(`Fetching: ${targetHit.url}`)

const fetched = await fetchCandidatePage(targetHit.url)
console.log(`Fetch OK: ${fetched.ok}`)
console.log(`Fetch error: ${fetched.error ?? 'none'}`)

if (fetched.content) {
  const { title, metaDescription, jsonLdText, bodyText, combinedText } = fetched.content
  console.log(`\nExtracted field lengths:`)
  console.log(`  title: ${title.length}`)
  console.log(`  metaDescription: ${metaDescription.length}`)
  console.log(`  jsonLdText: ${jsonLdText.length}`)
  console.log(`  bodyText: ${bodyText.length} (capped at 12,000 in extractor)`)
  console.log(`  combinedText (full): ${combinedText.length}`)
  console.log(`  combinedText after pipeline slice (MAX_PAGE_CONTENT_CHARS=${MAX_PAGE_CONTENT_CHARS}): ${Math.min(combinedText.length, MAX_PAGE_CONTENT_CHARS)}`)

  const prepared = preparePageContentForAi(fetched.content)
  console.log(`\nMarkers in prepared OpenAI content: ${JSON.stringify(containsMarkers(prepared))}`)
  console.log(`Prepared content length: ${prepared.length}`)

  const sliced = prepared

  printSection('Prepared OpenAI page content (stage 2)')
  console.log(sliced.slice(0, 5000))
  console.log(`Markers in jsonLdText only: ${JSON.stringify(containsMarkers(jsonLdText))}`)
  console.log(`Markers in bodyText only: ${JSON.stringify(containsMarkers(bodyText))}`)
  console.log(`Markers in snippet only: ${JSON.stringify(containsMarkers(targetHit.snippet || ''))}`)
  console.log(`Markers in full combinedText: ${JSON.stringify(containsMarkers(combinedText))}`)

  if (jsonLdText) {
    printSection('JSON-LD extracted text')
    console.log(jsonLdText.slice(0, 2000))
  }
}

printSection('Stage 2 enrichment simulation (top 3 page reads)')
const enriched = await enrichTopResearchHitsForStage2(
  selectStage2EnrichmentTargets(stage1PriceHits, stage1LifecycleHits),
  { maxPageReads: 3, maxPdfDownloads: 2 },
)
const enrichedPricePool = mergeEnrichmentIntoResearchHits(collected.price_hits, enriched.hits)
const enrichedLifecyclePool = mergeEnrichmentIntoResearchHits(collected.lifecycle_hits, enriched.hits)
const enrichedSuperstore = [...enrichedPricePool, ...enrichedLifecyclePool].find((hit) => /fitness-superstore/i.test(hit.url))

if (enrichedSuperstore) {
  console.log(`Superstore page_read_status: ${enrichedSuperstore.page_read_status}`)
  console.log(`Superstore page_read_error: ${enrichedSuperstore.page_read_error ?? 'none'}`)
  console.log(`Superstore page_content length: ${enrichedSuperstore.page_content?.length ?? 0}`)
  const superstoreRankInStage1 = stage1PriceHits.findIndex((hit) => hit.url === enrichedSuperstore.url)
  console.log(`Superstore rank in stage 1 hits (0-based): ${superstoreRankInStage1}`)
  console.log(`Would be fetched in stage 2 (top 3 only): ${superstoreRankInStage1 >= 0 && superstoreRankInStage1 < 3 ? 'YES' : 'NO'}`)
} else {
  console.log('Fitness Superstore not in stage 1 hits — would not be enriched in stage 2.')
}

const enrichedPrompt = buildAiResearchPrompt(
  equipment!,
  {
    priceHits: selectOriginalPriceResearchHitsForAi(enrichedPricePool),
    lifecycleHits: selectLifecycleResearchHitsForAi(enrichedLifecyclePool),
  },
  'enriched',
)
const superstoreBlock = enrichedPrompt.split('\n\n').find((block) => /fitness-superstore/i.test(block))
if (superstoreBlock) {
  printSection('Stage 2 OpenAI prompt block for Fitness Superstore')
  console.log(superstoreBlock.slice(0, 6000))
} else {
  printSection('Stage 2 OpenAI prompt block for Fitness Superstore')
  console.log('Not present in enriched prompt (page not in AI selection or no page_content).')
}

printSection('Summary')
console.log('1. Stage 1 sends snippet only — no HTML fetch.')
console.log(`2. Stage 2 fetches HTML for up to ${3} combined price/lifecycle stage-1 sources.`)
console.log('3. preparePageContentForAi prioritises marker windows, then caps at 4000 chars.')
console.log(`4. Pipeline sends prepared page_content up to ${MAX_PAGE_CONTENT_CHARS} chars before OpenAI.`)
