import type { EquipmentIntelligenceRow } from './intelligenceMarketSearch.ts'
import {
  classifyResearchSourceType,
  createEmptyResearchTimings,
  dedupeSerpResearchHits,
  extractResearchDomain,
  hitsToResearchSupportingSources,
  type EquipmentResearchDebugLog,
  type EquipmentResearchRecommendation,
  type EquipmentResearchResult,
  type SerpQueryError,
  type SerpResearchHit,
  tryFetchSerpGoogleResults,
} from './intelligenceEquipmentResearch.ts'
import {
  annotatePriceEvidenceForAdmin,
  resolveV3PriceSelection,
} from './intelligencePriceSelection.ts'
import {
  collectStructuredEvidenceFromHits,
  selectTopStructuredEvidence,
  type ResearchEquipmentRow,
  type StructuredEvidenceItem,
} from './intelligenceStructuredEvidence.ts'
import {
  buildCanonicalProductIdentityFromEquipment,
  formatIdentityScoreLabel,
  freezeCanonicalProductIdentity,
  scoreSerpHitIdentity,
  type CanonicalProductIdentity,
} from './intelligenceProductIdentity.ts'
import { quoteResearchPhrase } from './intelligenceEquipmentResearchSourceFirst.ts'

export const FAST_TRUSTED_RESEARCH_DOMAINS = [
  'fitkituk.com',
  'fitshop.co.uk',
  'pinnaclefitness.org.uk',
  'fitness-superstore.co.uk',
  'powerhouse-fitness.co.uk',
  'amazonleisure.co.uk',
  'lifefitness.com',
] as const

export const FAST_SERP_TIMEOUT_MS = 8_000
export const FAST_SERP_RESULTS_PER_QUERY = 3

export type FastSourceHitRow = {
  title: string
  snippet: string
  url: string
  domain: string
  query: string
  identityScore: number
  identityLevel: string
  identityLabel: string
}

export function resolveFastCanonicalSearchName(
  equipment: ResearchEquipmentRow,
  canonicalIdentity?: CanonicalProductIdentity | null,
): string {
  const identity = canonicalIdentity
    ?? equipment.research_canonical_identity
    ?? buildCanonicalProductIdentityFromEquipment(equipment)
  return identity.canonicalProductName
}

export function buildFastTrustedSourceQueries(canonicalProductName: string): string[] {
  const trimmed = canonicalProductName.trim()
  if (!trimmed) return []

  const quoted = quoteResearchPhrase(trimmed)
  return FAST_TRUSTED_RESEARCH_DOMAINS.map((domain) => `site:${domain} ${quoted}`)
}

export async function runFastSerpQueriesParallel(
  queries: string[],
  apiKey: string,
  brand: string,
): Promise<{
  hits: SerpResearchHit[]
  serp_errors: SerpQueryError[]
  serp_request_timings: Array<{
    query: string
    duration_ms: number
    result_count: number
    success: boolean
    error?: string | null
    timed_out?: boolean
  }>
}> {
  const startedAt = Date.now()
  const results = await Promise.all(queries.map(async (query) => {
    const requestStart = Date.now()
    const attempt = await tryFetchSerpGoogleResults(query, {
      apiKey,
      num: FAST_SERP_RESULTS_PER_QUERY,
    })
    const duration_ms = Date.now() - requestStart

    if (!attempt.ok) {
      return {
        query,
        duration_ms,
        result_count: 0,
        success: false as const,
        error: attempt.error,
        timed_out: attempt.timed_out,
        hits: [] as SerpResearchHit[],
      }
    }

    const hits = attempt.results.map((result) => {
      const domain = extractResearchDomain(result.url)
      return {
        intent: 'fast_trusted',
        query,
        title: result.title,
        url: result.url,
        snippet: result.snippet,
        position: result.position,
        domain,
        source_type: classifyResearchSourceType({ ...result, domain }, brand),
        source_rank: 0,
        page_content: null,
        page_read_status: 'snippet_only' as const,
        page_read_error: null,
      }
    })

    return {
      query,
      duration_ms,
      result_count: hits.length,
      success: true as const,
      error: null,
      timed_out: false,
      hits,
    }
  }))

  const serp_errors: SerpQueryError[] = []
  const serp_request_timings = []
  const allHits: SerpResearchHit[] = []

  for (const result of results) {
    serp_request_timings.push({
      query: result.query,
      duration_ms: result.duration_ms,
      result_count: result.result_count,
      success: result.success,
      error: result.error,
      timed_out: result.timed_out,
    })

    if (!result.success) {
      serp_errors.push({
        query: result.query,
        error: result.error ?? 'SerpAPI request failed',
        timed_out: Boolean(result.timed_out),
        duration_ms: result.duration_ms,
      })
      continue
    }

    allHits.push(...result.hits)
  }

  console.info('equipment_research_fast_serp_complete', {
    query_count: queries.length,
    hit_count: allHits.length,
    error_count: serp_errors.length,
    duration_ms: Date.now() - startedAt,
  })

  return {
    hits: dedupeSerpResearchHits(allHits),
    serp_errors,
    serp_request_timings,
  }
}

function buildFastSourceHitRows(
  hits: SerpResearchHit[],
  identity: CanonicalProductIdentity,
): FastSourceHitRow[] {
  return hits.map((hit) => {
    const identityScore = scoreSerpHitIdentity(hit, identity)
    return {
      title: hit.title,
      snippet: hit.snippet,
      url: hit.url,
      domain: hit.domain || extractResearchDomain(hit.url),
      query: hit.query,
      identityScore: identityScore.score,
      identityLevel: identityScore.level,
      identityLabel: formatIdentityScoreLabel(identityScore),
    }
  })
}

function attachSourceTitles(
  items: StructuredEvidenceItem[],
  hitsByUrl: Map<string, SerpResearchHit>,
): StructuredEvidenceItem[] {
  return items.map((item) => {
    const hit = hitsByUrl.get(item.sourceUrl)
    if (!hit?.title) return item
    return {
      ...item,
      surroundingText: item.surroundingText
        ? `${hit.title}\n${item.surroundingText}`
        : hit.title,
    }
  })
}

function toAdminLifecycleRow(item: StructuredEvidenceItem) {
  return {
    id: item.id,
    label: item.label,
    year: item.year,
    yearEnd: item.yearEnd,
    type: item.label,
    sourceDomain: item.sourceDomain,
    snippet: item.surroundingText,
    confidence: item.confidence,
    affectsBaseline: true,
    isConsoleTimeline: false,
    lifecycleNotes: null,
    sourceUrl: item.sourceUrl,
    score: item.score,
    identityScore: item.identityScore,
    identityLevel: item.identityLevel,
    identityLabel: item.identityLabel,
    sourceTitle: item.sourceUrl ? null : null,
  }
}

function buildFastRecommendation(
  identity: CanonicalProductIdentity,
  hitCount: number,
  priceCandidateCount: number,
  lifecycleCandidateCount: number,
): EquipmentResearchRecommendation {
  return {
    original_new_price: null,
    currency: 'GBP',
    price_confidence: null,
    price_reasoning: 'Fast trusted-source research — select RRP from snippet evidence below.',
    price_sources_used: [],
    price_review_status: 'needs_review',
    production_start_year: null,
    production_end_year: null,
    production_confidence: null,
    production_reasoning: lifecycleCandidateCount > 0
      ? 'Year candidates found in trusted snippets — confirm baseline/production years.'
      : 'No year candidates in trusted snippets.',
    production_sources_used: [],
    confidence: 0,
    confidence_reasoning: 'Snippet-only trusted sources; admin review required.',
    reasoning: `Fast research scanned ${hitCount} trusted Serp result(s) with ${priceCandidateCount} price and ${lifecycleCandidateCount} year candidate(s). No page fetch or AI.`,
    supporting_urls: [],
    supporting_sources: [],
    baseline_manufacture_year: null,
    lifecycle_confidence: null,
    lifecycle_notes: null,
    v3_metadata: {
      research_engine: 'fast',
      price_inference_method: 'snippet_only',
      price_label_detected: null,
      source_domain: null,
      evidence_confidence: null,
      core_product_group_research: false,
      dedupe_eligible: false,
      price_scope: 'base_machine',
      structured_evidence_selected_id: null,
      price_selection_status: 'manual_required',
      ai_suggested_price: null,
      ai_suggested_confidence: null,
      conflicting_rrp_count: 0,
      conflicting_rrp_spread_percent: null,
    },
  }
}

export async function researchEquipmentIntelligenceFast(
  equipment: ResearchEquipmentRow,
  options: {
    serpApiKey: string
    canonicalIdentity?: CanonicalProductIdentity | null
  },
): Promise<EquipmentResearchResult> {
  const startedAt = Date.now()
  const timings = createEmptyResearchTimings(startedAt)
  const identity = freezeCanonicalProductIdentity(
    options.canonicalIdentity
      ?? equipment.research_canonical_identity
      ?? buildCanonicalProductIdentityFromEquipment(equipment),
  )

  equipment = {
    ...equipment,
    research_canonical_identity: identity,
    core_product_name: identity.canonicalProductName,
    product_family: identity.productFamily,
  }

  const queries = buildFastTrustedSourceQueries(identity.canonicalProductName)
  const { hits, serp_errors, serp_request_timings } = await runFastSerpQueriesParallel(
    queries,
    options.serpApiKey,
    equipment.brand,
  )

  timings.serp_requests = serp_request_timings
  timings.serp_total_ms = serp_request_timings.reduce((sum, entry) => sum + entry.duration_ms, 0)
  timings.offsets_from_start_ms.serp_complete = Date.now() - startedAt

  const hitsByUrl = new Map(hits.map((hit) => [hit.url, hit]))
  const structuredItems = attachSourceTitles(
    collectStructuredEvidenceFromHits(hits, equipment, { maxPerPage: 4, maxTotal: 24 }),
    hitsByUrl,
  )

  const priceCandidates = selectTopStructuredEvidence(structuredItems, {
    type: 'price',
    limit: 12,
    minScore: 1,
  })
  const lifecycleCandidates = selectTopStructuredEvidence(structuredItems, {
    type: 'lifecycle',
    limit: 8,
    minScore: 1,
  })

  const priceSelection = resolveV3PriceSelection(priceCandidates)
  let recommendation = buildFastRecommendation(
    identity,
    hits.length,
    priceCandidates.length,
    lifecycleCandidates.length,
  )

  if (priceSelection.manualSelectionRequired) {
    recommendation = {
      ...recommendation,
      v3_metadata: {
        ...recommendation.v3_metadata!,
        price_selection_status: 'manual_required',
        conflicting_rrp_count: priceSelection.conflictingRrpCandidates.length,
        conflicting_rrp_spread_percent: priceSelection.conflictSpreadPercent,
      },
    }
  }

  const structuredPriceEvidence = annotatePriceEvidenceForAdmin(priceCandidates, null)
  const structuredLifecycleEvidence = lifecycleCandidates.map(toAdminLifecycleRow)
  const fastSourceHits = buildFastSourceHitRows(hits, identity)
  const sourceIdentityScores = fastSourceHits.map((row) => ({
    title: row.title,
    url: row.url,
    domain: row.domain,
    query: row.query,
    score: row.identityScore,
    level: row.identityLevel,
    label: row.identityLabel,
  }))

  const duration_ms = Date.now() - startedAt
  timings.offsets_from_start_ms.function_end = duration_ms
  timings.total_execution_ms = duration_ms

  const supportingSources = hitsToResearchSupportingSources(hits.slice(0, 12))
  const debug_log: EquipmentResearchDebugLog = {
    equipment_label: identity.canonicalProductName,
    research_stage: 'fast_trusted',
    research_engine: 'fast',
    progress_log: ['fast_started', 'fast_serp_complete', 'fast_snippet_extraction_complete'],
    timings,
    serp_query_analysis: serp_request_timings.map((entry) => ({
      query: entry.query,
      result_count: entry.result_count,
      top_urls: [],
      duration_ms: entry.duration_ms,
      error: entry.error,
      timed_out: entry.timed_out,
    })),
    serp_errors,
    serp_warning: serp_errors.length > 0
      ? `${serp_errors.length} of ${queries.length} trusted searches failed; showing available snippet evidence.`
      : null,
    price_input_sources: supportingSources,
    lifecycle_input_sources: [],
    lifecycle_search_queries: [],
    lifecycle_sources_returned: lifecycleCandidates.length,
    specialist_support_queries: [],
    specialist_support_hits: [],
    specialist_support_sources: [],
    price_sources_returned: hits.length,
    serp_unique_queries: queries.length,
    serp_raw_url_hits: hits.length,
    serp_duplicate_urls_removed: 0,
    openai_request_payload: null,
    searches_executed: queries,
    sources_returned: hits.length,
    sources_sent_to_ai: 0,
    sources_successfully_read: 0,
    pdf_downloads_attempted: 0,
    sources_used_by_ai: [],
    openai_raw_response: null,
    duration_ms,
    ranked_sources: hits.slice(0, 12).map((hit) => ({
      title: hit.title,
      url: hit.url,
      domain: hit.domain || extractResearchDomain(hit.url),
      source_type: hit.source_type ?? 'other',
      page_read_status: 'snippet_only',
    })),
    structured_price_evidence: structuredPriceEvidence,
    structured_lifecycle_evidence: structuredLifecycleEvidence,
    source_identity_scores: sourceIdentityScores,
    research_strategy: 'fast_trusted_snippet_only',
    trusted_queries_run: queries,
    broad_queries_run: [],
    fast_source_hits: fastSourceHits,
    v3_metadata: recommendation.v3_metadata ?? null,
  }

  return {
    equipment: {
      id: equipment.id,
      brand: equipment.brand,
      series: equipment.series ?? null,
      model: equipment.model,
      slug: equipment.slug,
      equipment_type: equipment.equipment_type ?? null,
    },
    queries_run: queries,
    serp_result_count: hits.length,
    deduped_result_count: hits.length,
    search_hits: hits,
    ai_input_sources: [],
    price_input_sources: supportingSources,
    lifecycle_input_sources: [],
    specialist_support_hits: [],
    recommendation,
    debug_log,
  }
}
