/**
 * Trace Technogym original-price research pipeline for one equipment row.
 * Usage:
 *   npx deno run --allow-env --allow-net --allow-read scripts/diagnose-technogym-price-research.ts
 *   npx deno run --allow-env --allow-net --allow-read scripts/diagnose-technogym-price-research.ts --equipment-id <uuid>
 */

import { createClient } from 'npm:@supabase/supabase-js@2'
import {
  analyzePriceCurrencyEvidence,
  classifyResearchSourceType,
  collectEquipmentResearchEvidence,
  extractEquipmentResearchRecommendation,
  extractResearchDomain,
  filterOriginalPriceResearchHits,
  finalizeResearchPriceRecommendation,
  getResearchAuthorityScore,
  isResalePricingSource,
  isUkPriceResearchHit,
  rankResearchHits,
  RESEARCH_STAGE1_CONFIDENCE_THRESHOLD,
  scorePriceRelevance,
  scoreResearchHitCombinedRank,
  scoreUkPriceSourceBias,
  selectOriginalPriceResearchHitsForAi,
  selectStage2EnrichmentTargets,
  shouldRunStage2Enrichment,
  enrichTopResearchHitsForStage2,
  type SerpResearchHit,
} from '../supabase/functions/_shared/intelligenceEquipmentResearch.ts'
import {
  extractEvidenceWindowTexts,
  extractPageContent,
  fetchCandidatePage,
  preparePageContentForAi,
  PRICE_EVIDENCE_MARKERS,
} from '../supabase/functions/_shared/intelligencePageExtract.ts'

const TECHNOGYM_EXTRA_MARKERS = [
  { label: '£', pattern: /£/ },
  { label: 'GBP', pattern: /\bGBP\b/i },
  { label: 'Price', pattern: /\bprice\b/i },
  { label: 'List Price', pattern: /\blist price\b/i },
  { label: 'RRP', pattern: /\brrp\b/i },
  { label: 'MSRP', pattern: /\bmsrp\b/i },
  { label: 'from £', pattern: /\bfrom\s*£/i },
  { label: 'starting from', pattern: /\bstarting from\b/i },
  { label: 'incl. VAT', pattern: /\bincl\.?\s*vat\b/i },
  { label: 'excl. VAT', pattern: /\bexcl\.?\s*vat\b/i },
  { label: 'from £ (marker)', pattern: /\bfrom\s*£\s*[\d,]+/i },
  { label: 'price from', pattern: /\bprice from\b/i },
  { label: 'incl VAT', pattern: /\bincl(?:\.|uding)?\s*vat\b/i },
  { label: 'excl VAT', pattern: /\bexcl(?:\.|uding)?\s*vat\b/i },
  { label: 'full price', pattern: /\bfull price\b/i },
  { label: 'cash price', pattern: /\bcash price\b/i },
] as const

function loadEnvFile(path: string) {
  try {
    const text = Deno.readTextFileSync(path)
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

function parseArgs() {
  const args = Deno.args
  const equipmentIdIndex = args.indexOf('--equipment-id')
  return {
    equipmentId: equipmentIdIndex >= 0 ? args[equipmentIdIndex + 1] : null,
  }
}

function markerScan(text: string, patterns: Array<{ label: string; pattern: RegExp }>) {
  return patterns.map(({ label, pattern }) => ({
    label,
    found: pattern.test(text),
    sample: (() => {
      const match = text.match(pattern)
      if (match?.index == null) return null
      const start = Math.max(0, match.index - 40)
      const end = Math.min(text.length, match.index + match[0].length + 80)
      return text.slice(start, end).replace(/\s+/g, ' ').trim()
    })(),
  }))
}

function findPriceAmounts(text: string): string[] {
  const amounts = new Set<string>()
  for (const match of text.matchAll(/(?:£|GBP\s*|USD\s*|\$)\s*[\d,]+(?:\.\d{2})?/gi)) {
    amounts.add(match[0].trim())
  }
  for (const match of text.matchAll(/\bfrom\s*£\s*[\d,]+(?:\.\d{2})?/gi)) {
    amounts.add(match[0].trim())
  }
  return [...amounts].slice(0, 20)
}

function inspectEmbeddedJson(html: string) {
  const scriptBlocks = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi)]
  const priceHints: Array<{ source: string; snippet: string }> = []

  for (const [index, block] of scriptBlocks.entries()) {
    const content = block[1]?.trim() ?? ''
    if (!content) continue

    const lower = content.toLowerCase()
    const hasPriceSignal = /price|amount|gbp|£|currency|offers|product/i.test(content)
    if (!hasPriceSignal) continue

    const jsonLike = content.match(
      /"(?:price|lowPrice|highPrice|amount|listPrice|salePrice|value)"\s*:\s*["{[\d]/i,
    )
    const poundMatch = content.match(/£\s*[\d,]+(?:\.\d{2})?/)
    const gbpMatch = content.match(/"priceCurrency"\s*:\s*"GBP"[\s\S]{0,200}?"price"\s*:\s*[\d"]+/i)

    if (jsonLike || poundMatch || gbpMatch) {
      const snippet = (poundMatch?.[0] || gbpMatch?.[0] || jsonLike?.[0] || content.slice(0, 180))
        .replace(/\s+/g, ' ')
      priceHints.push({
        source: `script[${index}]`,
        snippet: snippet.slice(0, 240),
      })
    }
  }

  return priceHints.slice(0, 12)
}

function hasVisiblePriceSignal(hit: Pick<SerpResearchHit, 'title' | 'snippet' | 'url'>) {
  const haystack = `${hit.title} ${hit.snippet} ${hit.url}`
  return /£|\bgbp\b|\bprice\b|\bmsrp\b|\brrp\b|\bfrom\s*£/i.test(haystack)
}

function isTechnogymHit(hit: Pick<SerpResearchHit, 'url' | 'domain' | 'title'>) {
  const domain = (hit.domain || extractResearchDomain(hit.url)).toLowerCase()
  return domain.includes('technogym') || /technogym/i.test(hit.title)
}

async function main() {
  loadEnvFile('.env.local')
  const { equipmentId: argEquipmentId } = parseArgs()

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? Deno.env.get('VITE_SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const serpApiKey = Deno.env.get('SERPAPI_API_KEY') ?? Deno.env.get('SERPAPI_KEY')
  const openAiApiKey = Deno.env.get('OPENAI_API_KEY')

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY')
  }
  if (!serpApiKey) {
    throw new Error('Missing SERPAPI_API_KEY')
  }

  const admin = createClient(supabaseUrl, serviceRoleKey)

  let equipmentId = argEquipmentId
  if (!equipmentId) {
    equipmentId = '0d283fa0-f545-48ed-ba0e-d5d81a594a13'
  }

  const { data: equipment, error } = await admin
    .from('equipment_intelligence')
    .select('id, brand, series, model, slug, equipment_type, category, original_rrp, currency')
    .eq('id', equipmentId)
    .maybeSingle()

  if (error || !equipment) {
    throw new Error(error?.message || `Equipment not found: ${equipmentId}`)
  }

  console.log('=== Technogym price research diagnostic ===')
  console.log('Equipment:', [equipment.brand, equipment.series, equipment.model].filter(Boolean).join(' '))
  console.log('ID:', equipment.id)
  console.log('Slug:', equipment.slug)
  console.log('')

  const collected = await collectEquipmentResearchEvidence(equipment, serpApiKey, {
    researchMode: 'price_only',
  })

  console.log('--- Step 1: Serp price collection ---')
  console.log('Queries run:', collected.price_queries_run.length)
  console.log('Raw price hits before dedupe:', collected.price_hits.length)

  const rankedAll = rankResearchHits(collected.price_hits, equipment.brand)
  const afterResaleFilter = filterOriginalPriceResearchHits(rankedAll)
  const priceInputSources = selectOriginalPriceResearchHitsForAi(rankedAll)
  const stage2Targets = selectStage2EnrichmentTargets(priceInputSources, [])

  const technogymOfficial = rankedAll.find((hit) => /technogym\.com/i.test(hit.domain || extractResearchDomain(hit.url)))
  const technogymWithPrice = technogymOfficial
    ?? rankedAll.find((hit) => isTechnogymHit(hit) && hasVisiblePriceSignal(hit))
    ?? rankedAll.find((hit) => isTechnogymHit(hit))

  if (!technogymWithPrice) {
    console.log('No Technogym hit found in ranked price results.')
    console.log('Top 10 ranked domains:', rankedAll.slice(0, 10).map((h) => h.domain))
    return
  }

  console.log('')
  console.log('--- Target Technogym result ---')
  console.log('Focus:', technogymOfficial ? 'official technogym.com page (selected #1 in price_input_sources)' : 'first Technogym-branded hit with price signal')
  console.log('Title:', technogymWithPrice.title)
  console.log('URL:', technogymWithPrice.url)
  console.log('Snippet:', technogymWithPrice.snippet)
  console.log('Serp position:', technogymWithPrice.position)
  console.log('')

  const domain = technogymWithPrice.domain || extractResearchDomain(technogymWithPrice.url)
  const sourceType = classifyResearchSourceType(technogymWithPrice, equipment.brand)
  const relevance = scoreResearchHitCombinedRank(technogymWithPrice, sourceType)
  const ukBias = scoreUkPriceSourceBias(technogymWithPrice)
  const resaleFiltered = isResalePricingSource(technogymWithPrice)
  const rankIndex = rankedAll.findIndex((hit) => hit.url === technogymWithPrice.url)
  const filteredRankIndex = afterResaleFilter.findIndex((hit) => hit.url === technogymWithPrice.url)
  const selectedForAi = priceInputSources.some((hit) => hit.url === technogymWithPrice.url)
  const selectedForStage2 = stage2Targets.some((hit) => hit.url === technogymWithPrice.url)

  console.log('--- Step 2: Ranking / filtering trace ---')
  console.log('Selected in price_input_sources?', selectedForAi)
  console.log('Overall rank (all price hits):', rankIndex >= 0 ? rankIndex + 1 : 'not ranked')
  console.log('Rank after resale filter:', filteredRankIndex >= 0 ? filteredRankIndex + 1 : 'FILTERED OUT')
  console.log('source_type:', sourceType)
  console.log('authority_score:', relevance.authority_score, `(${getResearchAuthorityScore(sourceType)})`)
  console.log('price_relevance_score:', relevance.price_relevance_score)
  console.log('UK/GBP bias score:', ukBias)
  console.log('is_uk_price_hit:', isUkPriceResearchHit(technogymWithPrice))
  console.log('resale filter would remove?', resaleFiltered)
  console.log('combined_rank_score:', relevance.combined_rank_score)
  console.log('price_input_sources URLs:', priceInputSources.map((h) => h.url))
  if (!selectedForAi) {
    const blockingReasons: string[] = []
    if (resaleFiltered) blockingReasons.push('removed by resale pricing filter')
    if (filteredRankIndex < 0) blockingReasons.push('not in post-resale pool')
    const domainsAhead = priceInputSources.map((h) => h.domain)
    if (!domainsAhead.includes(domain)) {
      blockingReasons.push(`domain "${domain}" not in top ${priceInputSources.length} diverse domains: ${domainsAhead.join(', ')}`)
    }
    const ahead = rankedAll.slice(0, filteredRankIndex >= 0 ? filteredRankIndex : rankedAll.length)
      .filter((hit) => (hit.domain || extractResearchDomain(hit.url)) !== domain)
    if (ahead.length > 0) {
      blockingReasons.push(`higher-ranked domains ahead: ${ahead.slice(0, 5).map((h) => `${h.domain} (score ${h.combined_rank_score})`).join('; ')}`)
    }
    console.log('Why not selected:', blockingReasons.join(' | ') || 'unknown')
  }

  console.log('')
  console.log('--- Step 3: Stage 2 fetch selection ---')
  console.log('Selected for Stage 2 enrichment?', selectedForStage2)
  console.log('Stage 2 target URLs:', stage2Targets.map((h) => h.url))

  let rawHtml = ''
  let pageExtract = null as ReturnType<typeof extractPageContent> | null
  let fetchError: string | null = null

  console.log('')
  console.log('--- Step 4: Page fetch (direct diagnostic fetch) ---')
  const fetched = await fetchCandidatePage(technogymWithPrice.url)
  if (!fetched.ok || !fetched.content) {
    fetchError = fetched.error ?? 'fetch failed'
    console.log('Fetch failed:', fetchError)
  } else {
    const refetch = await fetch(technogymWithPrice.url, {
      headers: {
        'User-Agent': 'EquipdIntelligenceBot/1.0 (admin market sync POC)',
        Accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
      },
      redirect: 'follow',
    })
    rawHtml = await refetch.text()
    pageExtract = extractPageContent(rawHtml, technogymWithPrice.title)
    console.log('Fetch OK. HTML bytes:', rawHtml.length)
    console.log('Title:', pageExtract.title)
    console.log('Meta:', pageExtract.metaDescription?.slice(0, 200) || '—')
    console.log('Body text length:', pageExtract.bodyText.length)
    console.log('JSON-LD text length:', pageExtract.jsonLdText.length)
    console.log('Combined text length:', pageExtract.combinedText.length)
    console.log('Detected price amounts:', findPriceAmounts(pageExtract.combinedText).join(' | ') || 'none')
  }

  if (pageExtract) {
    console.log('')
    console.log('--- Step 5: Marker scan (raw / extracted) ---')
    const rawMarkerScan = markerScan(rawHtml, TECHNOGYM_EXTRA_MARKERS)
    const bodyMarkerScan = markerScan(pageExtract.bodyText, TECHNOGYM_EXTRA_MARKERS)
    const combinedMarkerScan = markerScan(pageExtract.combinedText, TECHNOGYM_EXTRA_MARKERS)
    const jsonMarkerScan = markerScan(pageExtract.jsonLdText, TECHNOGYM_EXTRA_MARKERS)

    console.log('Raw HTML markers:')
    for (const entry of rawMarkerScan) {
      console.log(`  ${entry.found ? '✓' : '✗'} ${entry.label}${entry.sample ? ` — "${entry.sample}"` : ''}`)
    }
    console.log('Visible body markers:')
    for (const entry of bodyMarkerScan) {
      console.log(`  ${entry.found ? '✓' : '✗'} ${entry.label}${entry.sample ? ` — "${entry.sample}"` : ''}`)
    }
    console.log('JSON-LD markers:')
    for (const entry of jsonMarkerScan) {
      console.log(`  ${entry.found ? '✓' : '✗'} ${entry.label}${entry.sample ? ` — "${entry.sample}"` : ''}`)
    }
    console.log('Combined extracted markers:')
    for (const entry of combinedMarkerScan) {
      console.log(`  ${entry.found ? '✓' : '✗'} ${entry.label}${entry.sample ? ` — "${entry.sample}"` : ''}`)
    }

    const embeddedJson = inspectEmbeddedJson(rawHtml)
    console.log('')
    console.log('Embedded script/JSON price hints:', embeddedJson.length)
    for (const hint of embeddedJson) {
      console.log(`  ${hint.source}: ${hint.snippet}`)
    }

    console.log('')
    console.log('--- Step 6: preparePageContentForAi ---')
    const prepared = preparePageContentForAi(pageExtract)
    const evidenceWindows = extractEvidenceWindowTexts(
      [pageExtract.bodyText, pageExtract.jsonLdText].filter(Boolean).join(' '),
    )
    const preparedHasAmount = findPriceAmounts(prepared)
    const preparedMarkerScan = markerScan(prepared, TECHNOGYM_EXTRA_MARKERS)

    console.log('Prepared length:', prepared.length)
    console.log('PRICE_EVIDENCE_MARKERS matched windows:', evidenceWindows.price.length)
    for (const [index, window] of evidenceWindows.price.entries()) {
      console.log(`  window[${index}]:`, window.slice(0, 300))
    }
    console.log('Prepared contains price amounts?', preparedHasAmount.length > 0 ? preparedHasAmount.join(' | ') : 'NO')
    console.log('Prepared marker hits:')
    for (const entry of preparedMarkerScan) {
      console.log(`  ${entry.found ? '✓' : '✗'} ${entry.label}`)
    }
    if (prepared.length > 0) {
      console.log('Prepared preview:')
      console.log(prepared.slice(0, 1200))
    }

    const lossPoint = (() => {
      if (!findPriceAmounts(pageExtract.combinedText).length && embeddedJson.length === 0) {
        return 'raw/extracted text does NOT contain a detectable price'
      }
      if (!findPriceAmounts(prepared).length && evidenceWindows.price.length === 0) {
        return 'price exists in raw/extract but preparePageContentForAi dropped it (marker/window gap)'
      }
      return 'prepared content includes price — loss likely at OpenAI stage'
    })()
    console.log('')
    console.log('Likely loss point (pre-OpenAI):', lossPoint)
  }

  console.log('')
  console.log('--- Step 7: Stage 2 pipeline fetch (as research runs) ---')
  const enriched = await enrichTopResearchHitsForStage2(stage2Targets)
  const enrichedHit = enriched.hits.find((hit) => hit.url === technogymWithPrice.url)
  if (enrichedHit) {
    console.log('Stage 2 page_read_status:', enrichedHit.page_read_status)
    console.log('Stage 2 page_read_error:', enrichedHit.page_read_error ?? '—')
    console.log('Stage 2 page_content length:', enrichedHit.page_content?.length ?? 0)
    if (enrichedHit.page_content) {
      console.log('Stage 2 prepared amounts:', findPriceAmounts(enrichedHit.page_content).join(' | ') || 'none')
      console.log('Stage 2 prepared preview:', enrichedHit.page_content.slice(0, 800))
    }
  } else {
    console.log('Technogym URL was NOT in Stage 2 enrichment targets.')
  }

  if (openAiApiKey && selectedForAi) {
    console.log('')
    console.log('--- Step 8: OpenAI Stage 1 (snippet) ---')
    const stage1Hits = priceInputSources
    const stage1 = await extractEquipmentResearchRecommendation(equipment, { priceHits: stage1Hits, lifecycleHits: [] }, {
      apiKey: openAiApiKey,
      stage: 'snippet',
    })
    const finalized = finalizeResearchPriceRecommendation(stage1.recommendation, stage1Hits)
    console.log('Stage 1 original_new_price:', finalized.recommendation.original_new_price)
    console.log('Stage 1 currency:', finalized.recommendation.currency)
    console.log('Stage 1 price_confidence:', finalized.recommendation.price_confidence)
    console.log('Stage 1 price_reasoning:', finalized.recommendation.price_reasoning)
    console.log('Currency debug:', JSON.stringify(stage1.price_currency_debug))

    const stage1Confidence = finalized.recommendation.confidence ?? 0
    console.log('Would run Stage 2?', shouldRunStage2Enrichment(stage1Confidence), `(confidence ${stage1Confidence}, threshold ${RESEARCH_STAGE1_CONFIDENCE_THRESHOLD})`)

    if (shouldRunStage2Enrichment(stage1Confidence) && enrichedHit?.page_content) {
      console.log('')
      console.log('--- Step 9: OpenAI Stage 2 (enriched) ---')
      const enrichedPool = enriched.hits
      const stage2Hits = selectOriginalPriceResearchHitsForAi(enrichedPool)
      const stage2 = await extractEquipmentResearchRecommendation(
        equipment,
        { priceHits: stage2Hits, lifecycleHits: [] },
        { apiKey: openAiApiKey, stage: 'enriched' },
      )
      const finalized2 = finalizeResearchPriceRecommendation(stage2.recommendation, stage2Hits)
      console.log('Stage 2 original_new_price:', finalized2.recommendation.original_new_price)
      console.log('Stage 2 currency:', finalized2.recommendation.currency)
      console.log('Stage 2 price_confidence:', finalized2.recommendation.price_confidence)
      console.log('Stage 2 price_reasoning:', finalized2.recommendation.price_reasoning)
    }
  } else if (!openAiApiKey) {
    console.log('')
    console.log('OPENAI_API_KEY not set — skipping OpenAI extraction steps.')
  }

  console.log('')
  console.log('=== TRACE SUMMARY ===')
  console.log(`Search result found → ${technogymWithPrice.url}`)
  console.log(`Selected in price_input_sources? → ${selectedForAi ? 'YES' : 'NO'}`)
  console.log(`Stage 2 target? → ${selectedForStage2 ? 'YES' : 'NO'}`)
  console.log(`Page fetched (diagnostic)? → ${pageExtract ? 'YES' : `NO (${fetchError})`}`)
  console.log(`Raw/extracted contains price? → ${pageExtract ? (findPriceAmounts(pageExtract.combinedText).length > 0 || inspectEmbeddedJson(rawHtml).length > 0 ? 'YES' : 'NO') : 'unknown'}`)
  if (pageExtract) {
    const prepared = preparePageContentForAi(pageExtract)
    const evidenceWindows = extractEvidenceWindowTexts(
      [pageExtract.bodyText, pageExtract.jsonLdText].filter(Boolean).join(' '),
    )
    console.log(`Prepared AI content contains price? → ${findPriceAmounts(prepared).length > 0 || evidenceWindows.price.length > 0 ? 'YES' : 'NO'}`)
  }
}

await main()
