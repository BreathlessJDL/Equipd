import type { EquipmentIntelligenceRow } from './intelligenceMarketSearch.ts'
import {
  createEmptyResearchTimings,
  enrichTopResearchHitsForStage2,
  extractResearchDomain,
  finalizeResearchPriceRecommendation,
  filterOriginalPriceResearchHits,
  hitsToResearchSupportingSources,
  OPENAI_REQUEST_TIMEOUT_MS,
  parseEquipmentResearchRecommendation,
  selectLifecycleResearchHitsForAi,
  selectOriginalPriceResearchHitsForAi,
  type EquipmentResearchDebugLog,
  type EquipmentResearchMode,
  type EquipmentResearchRecommendation,
  type EquipmentResearchResult,
  type EquipmentResearchV3Metadata,
  type SerpResearchHit,
} from './intelligenceEquipmentResearch.ts'
import {
  buildTrustedSnippetReviewEvidence,
  buildV3TrustedSourceSummary,
  collectSnippetOnlyStructuredEvidence,
  collectV3SourceFirstResearchEvidence,
  hasTrustedSnippetEvidenceForReview,
  mergeStructuredEvidence,
  prioritizeTrustedDealerHits,
  resolveV3SourceFirstPageReadLimit,
  selectV3TrustedEnrichmentTargets,
} from './intelligenceEquipmentResearchSourceFirst.ts'
import {
  buildTrustedDealerLifecycleEvidence,
  collectLifecycleEvidenceFromHits,
  collectV3TargetedLifecycleHits,
  extractLifecycleFromTargetedSerpHits,
  finalizeV3LifecycleRecommendation,
  lifecycleEvidenceForOpenAi,
  mergeLifecycleEvidence,
  resolveBaselineFromLifecycleEvidence,
  sanitizeSeriesForLifecyclePrompt,
  toAdminLifecycleEvidenceRow,
  type LifecycleEvidenceItem,
} from './intelligenceLifecycleEvidence.ts'
import {
  annotatePriceEvidenceForAdmin,
  applyManualPriceSelectionRequirement,
  compareOriginalPriceCandidates,
  ensureBestCandidateInEvidenceList,
  finalizeV3PriceRecommendation,
  resolveV3PriceSelection,
} from './intelligencePriceSelection.ts'
import {
  estimateJsonBytes,
  MAX_EVIDENCE_PER_PAGE,
  MAX_TOTAL_EVIDENCE_CANDIDATES,
  RESEARCH_V3_MAX_PDF_DOWNLOADS,
  shouldFetchPdfForV3,
  type PageSkipEntry,
} from './intelligenceResearchResourceGuards.ts'
import {
  collectStructuredEvidenceFromHits,
  structuredEvidenceForOpenAi,
  buildStructuredProductContext,
  type ResearchEquipmentRow,
  type StructuredEvidenceItem,
} from './intelligenceStructuredEvidence.ts'
import {
  buildCanonicalProductIdentityFromEquipment,
  filterHitsByIdentity,
  freezeCanonicalProductIdentity,
  formatIdentityScoreLabel,
  NO_RELIABLE_IDENTITY_MATCH,
  scoreSerpHitIdentity,
  type CanonicalProductIdentity,
} from './intelligenceProductIdentity.ts'

export const RESEARCH_V3_PAGE_READS = 3
export const RESEARCH_V3_PDF_DOWNLOADS = RESEARCH_V3_MAX_PDF_DOWNLOADS
export const RESEARCH_V3_MAX_PRICE_EVIDENCE = 12
export const RESEARCH_V3_MAX_LIFECYCLE_EVIDENCE = 8
export const RESEARCH_V3_MAX_RESPONSE_BYTES = 50_000

function logV3Diagnostics(
  stage: string,
  startedAt: number,
  detail: Record<string, unknown> = {},
) {
  const memory = Deno.memoryUsage()
  console.info('equipment_research_v3_diagnostics', {
    stage,
    elapsed_from_start_ms: Date.now() - startedAt,
    heap_used_mb: Math.round(memory.heapUsed / 1024 / 1024),
    rss_mb: Math.round(memory.rss / 1024 / 1024),
    ...detail,
  })
}

const V3_SYSTEM_PROMPT = `You are an equipment catalogue research analyst for Equipd.

You will receive structured price and lifecycle evidence extracted from web pages. Each item already has source scores and confidence.

Rules:
- Choose original price ONLY from candidate_price_evidence. Never invent prices.
- Prefer explicit RRP/MSRP/original price over list/current/was/sale/our price for original_new_price.
- If recommended_price_candidate is provided and price_selection_status is not manual_required, prefer it unless clearly unrelated.
- When multiple explicit RRP/MSRP candidates conflict materially, return null for original_price and note that manual admin selection is required. Do not auto-pick the lowest or highest.
- Do not use FitKit-style "Now £X / Was £Y" current prices as original RRP when explicit RRP exists.
- Marketplace, auction, finance/monthly, leasing, delivery, and spare-part prices are NOT valid RRP.
- Prefer trusted UK commercial fitness dealers with explicit RRP/list/original price over manufacturer pages without price.
- Search snippets and titles from trusted dealers (FitKit, Fitshop, Pinnacle, Fitness Superstore, Powerhouse, Amazon Leisure) are valid evidence when they mention RRP, list price, or £ amounts near the product name.
- Keep USD prices as USD — do not relabel USD as GBP.
- Use baseline_manufacture_year from lifecycle evidence — prefer earliest credible platform/family launch year, not console upgrade periods.
- Console timeline evidence (e.g. SE3/SE3HD upgrades) informs notes but must NOT override an earlier platform baseline year.
- Do not set production_end_year from console upgrade ranges (e.g. 2016-2019) or present/latest iteration wording unless the product is explicitly discontinued.
- Trusted UK dealer snippets/pages are valid lifecycle evidence, not only manufacturer sites.
- Return lifecycle_notes explaining baseline choice when console evidence exists.
- If candidate_lifecycle_evidence is empty, return null for baseline_manufacture_year, production_start_year, and production_end_year. Never infer lifecycle years from price snippets or variant console labels.
- Return strict JSON only.`

export type ResearchV3TargetContext = {
  dedupeEligible?: boolean
  coreProductKey?: string | null
  memberCount?: number
  priceScope?: 'base_machine' | 'variant_specific'
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timeout)
  }
}

function buildV3OpenAiUserPrompt(
  equipment: ResearchEquipmentRow,
  priceEvidence: StructuredEvidenceItem[],
  lifecycleEvidence: LifecycleEvidenceItem[],
  lifecycleGuidance: ReturnType<typeof resolveBaselineFromLifecycleEvidence>,
  trustedSourceSummary: ReturnType<typeof buildV3TrustedSourceSummary>,
  recommendedPriceCandidate: StructuredEvidenceItem | null,
): string {
  const product = buildStructuredProductContext(equipment)
  const consoleTimelineEvidence = lifecycleEvidence.filter((item) => item.isConsoleTimeline)
  const baselineLifecycleEvidence = lifecycleEvidence.filter((item) => item.affectsBaseline)

  return JSON.stringify({
    product: {
      brand: product.brand,
      series: sanitizeSeriesForLifecyclePrompt(product.series),
      model: product.model,
      equipment_type: product.equipmentType,
      product_family: product.productFamily,
      core_product_name: product.coreProductName,
    },
    candidate_price_evidence: structuredEvidenceForOpenAi(priceEvidence),
    recommended_price_candidate: recommendedPriceCandidate
      ? structuredEvidenceForOpenAi([recommendedPriceCandidate])[0]
      : null,
    candidate_lifecycle_evidence: lifecycleEvidenceForOpenAi(baselineLifecycleEvidence),
    console_timeline_evidence: lifecycleEvidenceForOpenAi(consoleTimelineEvidence),
    lifecycle_guidance: lifecycleGuidance,
    trusted_source_summary: trustedSourceSummary,
    required_output: {
      original_price: 'number | null',
      original_price_currency: 'ISO currency | null',
      original_price_source: 'source URL | null',
      original_price_confidence: '0-100 | null',
      selected_price_evidence_id: 'evidence_id | null',
      price_inference_method: 'structured_extraction | ai_inference',
      price_label_detected: 'string | null',
      baseline_manufacture_year: 'year | null — earliest credible platform/family year',
      production_start_year: 'year | null — usually same as baseline unless clearer machine production start exists',
      production_end_year: 'year | null — only when explicitly discontinued',
      lifecycle_confidence: '0-100 | null',
      lifecycle_notes: 'string — explain console vs platform baseline when relevant',
      explanation: 'string',
      price_sources_used: 'string[]',
      production_sources_used: 'string[]',
      confidence: '0-100',
      confidence_reasoning: 'string',
    },
  }, null, 2)
}

function resolveV3Metadata(
  parsed: Record<string, unknown>,
  priceEvidence: StructuredEvidenceItem[],
  target: ResearchV3TargetContext,
  selectedCandidate: StructuredEvidenceItem | null = null,
): EquipmentResearchV3Metadata {
  const selectedId = selectedCandidate?.id
    ?? (typeof parsed.selected_price_evidence_id === 'string'
      ? parsed.selected_price_evidence_id
      : null)
  const selected = selectedCandidate
    ?? priceEvidence.find((item) => item.id === selectedId)
    ?? null
  const inferenceMethod = parsed.price_inference_method === 'structured_extraction'
    || (selected?.extractionMethod === 'structured' && selected.confidence >= 70)
    ? 'structured_extraction'
    : 'ai_inference'

  return {
    research_engine: 'v3',
    price_inference_method: inferenceMethod,
    price_label_detected: (
      typeof parsed.price_label_detected === 'string'
        ? parsed.price_label_detected
        : selected?.label
    ) ?? null,
    source_domain: selected?.sourceDomain
      ?? (typeof parsed.original_price_source === 'string'
        ? extractResearchDomain(String(parsed.original_price_source))
        : null),
    evidence_confidence: selected?.confidence
      ?? (typeof parsed.original_price_confidence === 'number' ? parsed.original_price_confidence : null),
    core_product_group_research: Boolean(target.dedupeEligible && (target.memberCount ?? 0) > 1),
    dedupe_eligible: Boolean(target.dedupeEligible),
    price_scope: target.priceScope ?? (target.dedupeEligible ? 'base_machine' : 'variant_specific'),
    structured_evidence_selected_id: selectedId,
  }
}

async function chooseFromStructuredEvidence(
  equipment: ResearchEquipmentRow,
  priceEvidence: StructuredEvidenceItem[],
  lifecycleEvidence: LifecycleEvidenceItem[],
  priceHits: SerpResearchHit[],
  options: {
    apiKey: string
    model?: string
    researchMode?: EquipmentResearchMode
    target?: ResearchV3TargetContext
    lifecycleGuidance?: ReturnType<typeof resolveBaselineFromLifecycleEvidence>
    trustedSourceSummary?: ReturnType<typeof buildV3TrustedSourceSummary>
    recommendedPriceCandidate?: StructuredEvidenceItem | null
    allPriceCandidates?: StructuredEvidenceItem[]
    priceSelection?: ReturnType<typeof resolveV3PriceSelection>
  },
): Promise<{
  recommendation: EquipmentResearchRecommendation
  rawResponse: unknown
  requestPayload: unknown
}> {
  const lifecycleGuidance = options.lifecycleGuidance
    ?? resolveBaselineFromLifecycleEvidence(lifecycleEvidence)
  const recommendedPriceCandidate = options.recommendedPriceCandidate ?? null
  const userPrompt = buildV3OpenAiUserPrompt(
    equipment,
    priceEvidence,
    lifecycleEvidence,
    lifecycleGuidance,
    options.trustedSourceSummary ?? [],
    recommendedPriceCandidate,
  )

  const response = await fetchWithTimeout('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${options.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: options.model ?? 'gpt-4o-mini',
      temperature: 0.1,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: V3_SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
    }),
  }, OPENAI_REQUEST_TIMEOUT_MS)

  const body = await response.json() as {
    error?: { message?: string }
    choices?: Array<{ message?: { content?: string } }>
  }

  if (!response.ok) {
    throw new Error(body.error?.message || `OpenAI request failed (${response.status})`)
  }

  const content = body.choices?.[0]?.message?.content
  if (!content) {
    throw new Error('OpenAI returned no recommendation content')
  }

  const parsed = JSON.parse(content) as Record<string, unknown>
  let recommendation = parseEquipmentResearchRecommendation(parsed, priceHits)
  const allPriceCandidates = options.allPriceCandidates ?? priceEvidence
  const priceSelection = options.priceSelection
    ?? resolveV3PriceSelection(allPriceCandidates)
  const bestCandidate = priceSelection.autoSelectedCandidate
  recommendation = finalizeV3PriceRecommendation(
    recommendation,
    allPriceCandidates,
    bestCandidate,
    { manualSelectionRequired: priceSelection.manualSelectionRequired },
  )
  recommendation = applyManualPriceSelectionRequirement(recommendation, priceSelection)
  recommendation = finalizeV3LifecycleRecommendation(recommendation, lifecycleEvidence)

  const finalized = finalizeResearchPriceRecommendation(recommendation, priceHits)
  const selectedCandidate = priceSelection.manualSelectionRequired ? null : bestCandidate

  return {
    recommendation: {
      ...finalized.recommendation,
      price_reasoning: typeof parsed.explanation === 'string' && parsed.explanation
        ? parsed.explanation
        : finalized.recommendation.price_reasoning,
      v3_metadata: {
        ...resolveV3Metadata(parsed, priceEvidence, options.target ?? {}, selectedCandidate),
        price_selection_status: priceSelection.priceSelectionStatus,
        ai_suggested_price: priceSelection.manualSelectionRequired
          ? (typeof parsed.original_price === 'number' ? parsed.original_price : recommendation.v3_metadata?.ai_suggested_price ?? null)
          : null,
        ai_suggested_confidence: priceSelection.manualSelectionRequired
          ? (typeof parsed.original_price_confidence === 'number' ? parsed.original_price_confidence : null)
          : null,
        conflicting_rrp_count: priceSelection.conflictingRrpCandidates.length,
        conflicting_rrp_spread_percent: priceSelection.conflictSpreadPercent,
      },
    },
    rawResponse: parsed,
    requestPayload: {
      research_engine: 'v3',
      price_evidence_count: priceEvidence.length,
      lifecycle_evidence_count: lifecycleEvidence.length,
      console_timeline_evidence_count: lifecycleEvidence.filter((item) => item.isConsoleTimeline).length,
      lifecycle_guidance: lifecycleGuidance,
      prompt_chars: userPrompt.length,
      prompt_bytes: new TextEncoder().encode(userPrompt).length,
    },
  }
}

export function buildSlimV3ResearchResult(
  full: EquipmentResearchResult,
  pagesSkipped: PageSkipEntry[] = [],
): EquipmentResearchResult {
  const compactPriceEvidence = (full.debug_log.structured_price_evidence ?? [])
    .map((item) => ({
      id: item.id,
      label: item.label,
      value: item.value,
      currency: item.currency ?? null,
      sourceDomain: item.sourceDomain,
      confidence: item.confidence,
      score: item.score,
      selected: Boolean(item.selected),
      selectionNote: item.selectionNote ?? null,
      surroundingText: item.surroundingText?.slice(0, 240) ?? null,
      sourceUrl: item.sourceUrl ?? null,
    }))
  const compactLifecycleEvidence = (full.debug_log.structured_lifecycle_evidence ?? [])
    .map((item) => ({
      id: item.id,
      label: item.label,
      year: item.year,
      yearEnd: item.yearEnd,
      sourceDomain: item.sourceDomain,
      confidence: item.confidence,
      type: item.type,
      snippet: item.snippet?.slice(0, 120) ?? item.snippet,
      affectsBaseline: item.affectsBaseline,
      isConsoleTimeline: item.isConsoleTimeline,
    }))

  const rankedSources = full.debug_log.ranked_sources ?? []
  const slimDebugLog: EquipmentResearchDebugLog = {
    equipment_label: full.debug_log.equipment_label,
    research_stage: 'stage_2',
    research_engine: 'v3',
    progress_log: full.debug_log.progress_log,
    timings: full.debug_log.timings,
    serp_query_analysis: [],
    serp_errors: full.debug_log.serp_errors,
    serp_warning: full.debug_log.serp_warning,
    price_input_sources: full.debug_log.price_input_sources,
    lifecycle_input_sources: full.debug_log.lifecycle_input_sources,
    lifecycle_search_queries: full.debug_log.lifecycle_search_queries,
    lifecycle_sources_returned: full.debug_log.lifecycle_sources_returned,
    specialist_support_queries: full.debug_log.specialist_support_queries,
    specialist_support_hits: [],
    specialist_support_sources: [],
    price_sources_returned: full.debug_log.price_sources_returned,
    serp_unique_queries: full.debug_log.serp_unique_queries,
    serp_raw_url_hits: full.debug_log.serp_raw_url_hits,
    serp_duplicate_urls_removed: full.debug_log.serp_duplicate_urls_removed,
    openai_request_payload: null,
    searches_executed: full.debug_log.searches_executed,
    sources_returned: full.debug_log.sources_returned,
    sources_sent_to_ai: full.debug_log.sources_sent_to_ai,
    sources_successfully_read: full.debug_log.sources_successfully_read,
    pdf_downloads_attempted: full.debug_log.pdf_downloads_attempted,
    sources_used_by_ai: full.debug_log.sources_used_by_ai,
    openai_raw_response: null,
    duration_ms: full.debug_log.duration_ms,
    ranked_sources: rankedSources,
    structured_price_evidence: compactPriceEvidence,
    structured_lifecycle_evidence: compactLifecycleEvidence,
    v3_openai_request: full.debug_log.v3_openai_request && typeof full.debug_log.v3_openai_request === 'object'
      ? {
        research_engine: 'v3',
        price_evidence_count: (full.debug_log.v3_openai_request as { price_evidence_count?: number }).price_evidence_count ?? 0,
        lifecycle_evidence_count: (full.debug_log.v3_openai_request as { lifecycle_evidence_count?: number }).lifecycle_evidence_count ?? 0,
        prompt_chars: (full.debug_log.v3_openai_request as { prompt_chars?: number }).prompt_chars ?? 0,
      }
      : null,
    v3_target: full.debug_log.v3_target ?? null,
    v3_metadata: full.debug_log.v3_metadata ?? null,
    v3_pages_skipped: pagesSkipped,
    v3_trusted_source_summary: full.debug_log.v3_trusted_source_summary ?? [],
    research_strategy: full.debug_log.research_strategy ?? null,
    trusted_queries_run: full.debug_log.trusted_queries_run ?? [],
    broad_queries_run: full.debug_log.broad_queries_run ?? [],
    v3_targeted_lifecycle_queries: full.debug_log.v3_targeted_lifecycle_queries ?? [],
    v3_lifecycle_query_debug: full.debug_log.v3_lifecycle_query_debug ?? [],
  }

  return {
    equipment: full.equipment,
    queries_run: full.queries_run,
    serp_result_count: full.serp_result_count,
    deduped_result_count: full.deduped_result_count,
    search_hits: [],
    ai_input_sources: rankedSources.map((source) => ({
      title: source.title,
      domain: source.domain,
      url: source.url,
      source_type: source.source_type,
    })),
    price_input_sources: full.price_input_sources,
    lifecycle_input_sources: full.lifecycle_input_sources,
    specialist_support_hits: [],
    recommendation: full.recommendation,
    debug_log: slimDebugLog,
  }
}

export async function researchEquipmentIntelligenceV3(
  equipment: ResearchEquipmentRow,
  options: {
    serpApiKey: string
    openAiApiKey: string
    openAiModel?: string
    researchMode?: EquipmentResearchMode
    target?: ResearchV3TargetContext
    canonicalIdentity?: CanonicalProductIdentity | null
  },
): Promise<EquipmentResearchResult> {
  const researchMode = options.researchMode ?? 'full'
  const startedAt = Date.now()
  const timings = createEmptyResearchTimings(startedAt)
  const progressLog: string[] = ['v3_started']
  const pagesSkipped: PageSkipEntry[] = []

  const canonicalIdentity = freezeCanonicalProductIdentity(
    options.canonicalIdentity ?? buildCanonicalProductIdentityFromEquipment(equipment),
  )
  const researchEquipment: ResearchEquipmentRow = {
    ...equipment,
    research_canonical_identity: canonicalIdentity,
  }

  const collected = await collectV3SourceFirstResearchEvidence(researchEquipment, options.serpApiKey, {
    researchMode,
    serpRequestTimings: timings.serp_requests,
    serpQueryAnalysis: [],
    startedAt,
  })

  timings.serp_total_ms = collected.serp_total_ms
  timings.ranking_ms = collected.ranking_ms
  logV3Diagnostics('serp_complete', startedAt, {
    serp_requests: timings.serp_requests.length,
    serp_total_ms: collected.serp_total_ms,
    serp_raw_url_hits: collected.serp_raw_url_hits,
    ranking_ms: collected.ranking_ms,
    research_strategy: collected.research_strategy,
    trusted_queries_run: collected.trusted_queries_run.length,
    broad_queries_run: collected.broad_queries_run.length,
  })

  const priceHitsFiltered = filterHitsByIdentity(
    filterOriginalPriceResearchHits(collected.price_hits),
    canonicalIdentity,
  )
  const lifecycleHitsFiltered = filterHitsByIdentity(
    collected.lifecycle_hits,
    canonicalIdentity,
  )
  const sourceIdentityScores = [
    ...priceHitsFiltered.rejected,
    ...lifecycleHitsFiltered.rejected,
  ].map((hit) => ({
    url: hit.url,
    domain: hit.domain || extractResearchDomain(hit.url),
    title: hit.title,
    score: hit.identityScore.score,
    level: hit.identityScore.level,
    label: formatIdentityScoreLabel(hit.identityScore),
  }))

  const pricePool = prioritizeTrustedDealerHits(
    priceHitsFiltered.accepted,
    researchEquipment.brand,
  )
  const lifecyclePool = selectLifecycleResearchHitsForAi(lifecycleHitsFiltered.accepted, 8)
  const priceTargets = selectOriginalPriceResearchHitsForAi(pricePool, 8)

  const snippetEvidence = collectSnippetOnlyStructuredEvidence(priceTargets, researchEquipment, {
    maxPerPage: MAX_EVIDENCE_PER_PAGE,
    maxTotal: MAX_TOTAL_EVIDENCE_CANDIDATES,
  })
  logV3Diagnostics('snippet_evidence_complete', startedAt, {
    snippet_evidence_count: snippetEvidence.length,
    trusted_hits: pricePool.filter((hit) => collected.trusted_queries_run.some((query) => (
      query.includes(hit.domain || extractResearchDomain(hit.url))
    ))).length,
  })

  const pageReadLimit = collected.research_strategy === 'source_first'
    ? resolveV3SourceFirstPageReadLimit(priceTargets, researchEquipment.brand)
    : 3
  const fetchTargets = selectV3TrustedEnrichmentTargets(
    priceTargets,
    lifecyclePool,
    researchEquipment.brand,
    pageReadLimit,
  )

  progressLog.push(`v3_fetch_started:${pageReadLimit}`)
  const enriched = await enrichTopResearchHitsForStage2(fetchTargets, {
    maxPageReads: pageReadLimit,
    maxPdfDownloads: RESEARCH_V3_MAX_PDF_DOWNLOADS,
    pageFetchTimings: timings.stage_2_page_fetches,
    startedAt,
    equipment: researchEquipment,
    serpApiKey: options.serpApiKey,
    resourceGuards: {
      skipHeavyDomains: true,
      lifecycleNeeded: researchMode !== 'price_only',
      researchMode,
      shouldFetchPdf: (hit) => shouldFetchPdfForV3(hit, {
        brand: researchEquipment.brand,
        researchMode,
        lifecycleNeeded: researchMode !== 'price_only',
      }),
      onPageSkipped: (entry) => pagesSkipped.push(entry),
    },
  })
  timings.stage_2_fetch_total_ms = enriched.stage_2_fetch_total_ms
  pagesSkipped.push(...enriched.pages_skipped)
  progressLog.push('v3_fetch_complete')
  const pageContentChars = enriched.hits.reduce((total, hit) => (
    total + (hit.page_content?.length ?? 0)
  ), 0)
  logV3Diagnostics('page_fetch_complete', startedAt, {
    pages_read: enriched.pagesRead,
    pdf_downloads_attempted: enriched.pdfDownloadsAttempted,
    page_fetch_targets: fetchTargets.length,
    page_read_limit: pageReadLimit,
    page_content_chars: pageContentChars,
    pages_skipped: pagesSkipped,
    stage_2_fetch_total_ms: enriched.stage_2_fetch_total_ms,
  })

  const enrichedByUrl = new Map(enriched.hits.map((hit) => [hit.url.trim().toLowerCase(), hit]))
  const mergedHits = fetchTargets.map((hit) => enrichedByUrl.get(hit.url.trim().toLowerCase()) ?? hit)

  const targetedLifecycle = researchMode !== 'price_only'
    ? await collectV3TargetedLifecycleHits(researchEquipment, options.serpApiKey, {
      serpRequestTimings: timings.serp_requests,
      serpErrors: collected.serp_errors ?? [],
      startedAt,
    })
    : { queries: [], hits: [], query_debug: [] }
  progressLog.push(`v3_targeted_lifecycle:${targetedLifecycle.queries.length}`)
  logV3Diagnostics('targeted_lifecycle_complete', startedAt, {
    targeted_lifecycle_queries: targetedLifecycle.queries.length,
    targeted_lifecycle_hits: targetedLifecycle.hits.length,
    query_debug: targetedLifecycle.query_debug,
  })

  const structuredEvidence = mergeStructuredEvidence(
    snippetEvidence,
    collectStructuredEvidenceFromHits(mergedHits, researchEquipment, {
      maxPerPage: MAX_EVIDENCE_PER_PAGE,
      maxTotal: MAX_TOTAL_EVIDENCE_CANDIDATES,
    }).filter((item) => item.type === 'price'),
    buildTrustedSnippetReviewEvidence(priceTargets, researchEquipment),
  )
  const allPriceCandidates = structuredEvidence.filter((item) => item.type === 'price')
  const priceSelection = resolveV3PriceSelection(allPriceCandidates)
  const bestOriginalPriceCandidate = priceSelection.autoSelectedCandidate
  let priceEvidence = ensureBestCandidateInEvidenceList(
    [...allPriceCandidates].sort(compareOriginalPriceCandidates),
    bestOriginalPriceCandidate,
    RESEARCH_V3_MAX_PRICE_EVIDENCE,
  )
  const adminPriceEvidence = annotatePriceEvidenceForAdmin(
    allPriceCandidates,
    priceSelection.manualSelectionRequired ? null : bestOriginalPriceCandidate?.id ?? null,
  )

  const lifecycleSourceHits = prioritizeTrustedDealerHits(
    [...priceTargets, ...lifecyclePool, ...targetedLifecycle.hits],
    researchEquipment.brand,
  )
  const snippetLifecycleHits = lifecycleSourceHits.map((hit) => ({
    ...hit,
    page_content: hit.snippet
      ? `Search snippet: ${hit.snippet}\nSearch title: ${hit.title}`
      : hit.title ? `Search title: ${hit.title}` : null,
    page_read_status: 'snippet_only' as const,
  }))
  let lifecycleEvidence = mergeLifecycleEvidence(
    extractLifecycleFromTargetedSerpHits(targetedLifecycle.hits, researchEquipment),
    collectLifecycleEvidenceFromHits(snippetLifecycleHits, researchEquipment, {
      maxPerPage: 8,
      maxTotal: 24,
    }),
    collectLifecycleEvidenceFromHits(mergedHits, researchEquipment, {
      maxPerPage: 8,
      maxTotal: 24,
    }),
    buildTrustedDealerLifecycleEvidence(lifecycleSourceHits, researchEquipment),
  ).slice(0, RESEARCH_V3_MAX_LIFECYCLE_EVIDENCE)
  const lifecycleGuidance = resolveBaselineFromLifecycleEvidence(lifecycleEvidence)
  const adminLifecycleEvidence = lifecycleEvidence.map((item) => toAdminLifecycleEvidenceRow(item))

  const fetchedUrls = new Set(mergedHits.map((hit) => hit.url.trim().toLowerCase()))
  const trustedSourceSummary = buildV3TrustedSourceSummary(
    collected.trusted_queries_run,
    pricePool,
    priceEvidence,
    fetchedUrls,
  )

  logV3Diagnostics('structured_evidence_complete', startedAt, {
    structured_evidence_total: structuredEvidence.length + lifecycleEvidence.length,
    price_evidence_selected: priceEvidence.length,
    lifecycle_evidence_selected: lifecycleEvidence.length,
    lifecycle_guidance: lifecycleGuidance,
    trusted_source_summary: trustedSourceSummary,
  })

  const hasReviewableTrustedSnippets = hasTrustedSnippetEvidenceForReview(
    priceTargets,
    researchEquipment.brand,
  )

  if (researchMode !== 'lifecycle_only' && priceTargets.length === 0) {
    throw new Error(NO_RELIABLE_IDENTITY_MATCH)
  }

  if (researchMode !== 'lifecycle_only' && priceEvidence.length === 0 && hasReviewableTrustedSnippets) {
    priceEvidence = buildTrustedSnippetReviewEvidence(priceTargets, researchEquipment)
      .slice(0, RESEARCH_V3_MAX_PRICE_EVIDENCE)
  }

  if (researchMode !== 'lifecycle_only' && priceEvidence.length === 0 && !hasReviewableTrustedSnippets) {
    throw new Error(
      sourceIdentityScores.length > 0
        ? NO_RELIABLE_IDENTITY_MATCH
        : 'V3 found no trusted dealer or structured price evidence after snippet and page review',
    )
  }
  if (researchMode === 'lifecycle_only' && lifecycleEvidence.length === 0) {
    throw new Error(
      sourceIdentityScores.length > 0
        ? NO_RELIABLE_IDENTITY_MATCH
        : 'V3 structured extraction found no lifecycle evidence',
    )
  }

  progressLog.push('v3_openai_started')
  const openAiStartedAt = Date.now()
  const extracted = await chooseFromStructuredEvidence(
    researchEquipment,
    priceEvidence,
    lifecycleEvidence,
    mergedHits,
    {
      apiKey: options.openAiApiKey,
      model: options.openAiModel,
      researchMode,
      target: options.target,
      lifecycleGuidance,
      trustedSourceSummary,
      recommendedPriceCandidate: priceSelection.manualSelectionRequired
        ? null
        : bestOriginalPriceCandidate,
      allPriceCandidates,
      priceSelection,
    },
  )
  timings.stage_2_openai_ms = Date.now() - openAiStartedAt
  progressLog.push('v3_openai_complete')

  timings.total_execution_ms = Date.now() - startedAt
  const openAiPromptBytes = extracted.requestPayload && typeof extracted.requestPayload === 'object'
    ? (extracted.requestPayload as { prompt_bytes?: number }).prompt_bytes ?? 0
    : 0
  logV3Diagnostics('complete', startedAt, {
    total_execution_ms: timings.total_execution_ms,
    serp_total_ms: timings.serp_total_ms,
    stage_2_fetch_total_ms: timings.stage_2_fetch_total_ms,
    stage_2_openai_ms: timings.stage_2_openai_ms,
    openai_prompt_bytes: openAiPromptBytes,
    pages_skipped: pagesSkipped,
  })
  console.info('equipment_research_timings', JSON.stringify(timings))

  const fullResult: EquipmentResearchResult = {
    equipment: {
      id: equipment.id,
      brand: equipment.brand,
      series: equipment.series,
      model: equipment.model,
      slug: equipment.slug,
      equipment_type: equipment.equipment_type ?? null,
    },
    queries_run: collected.queries_run,
    serp_result_count: collected.hits.length,
    deduped_result_count: collected.hits.length,
    search_hits: mergedHits,
    ai_input_sources: hitsToResearchSupportingSources(mergedHits),
    price_input_sources: hitsToResearchSupportingSources(mergedHits),
    lifecycle_input_sources: hitsToResearchSupportingSources(lifecyclePool),
    specialist_support_hits: collected.specialist_support_hits,
    recommendation: extracted.recommendation,
    debug_log: {
      equipment_label: canonicalIdentity.canonicalProductName,
      canonical_product_identity: canonicalIdentity,
      source_identity_scores: [
        ...priceTargets.map((hit) => {
          const identityScore = scoreSerpHitIdentity(hit, canonicalIdentity)
          return {
            url: hit.url,
            domain: hit.domain || extractResearchDomain(hit.url),
            title: hit.title,
            score: identityScore.score,
            level: identityScore.level,
            label: formatIdentityScoreLabel(identityScore),
            accepted: true,
          }
        }),
        ...sourceIdentityScores.map((entry) => ({ ...entry, accepted: false })),
      ],
      identity_rejected_source_count: sourceIdentityScores.length,
      research_stage: 'stage_2',
      research_engine: 'v3',
      progress_log: progressLog,
      timings,
      serp_query_analysis: collected.serp_query_analysis,
      serp_errors: collected.serp_errors,
      serp_warning: collected.serp_warning,
      price_input_sources: hitsToResearchSupportingSources(mergedHits),
      lifecycle_input_sources: hitsToResearchSupportingSources(lifecyclePool),
      lifecycle_search_queries: collected.lifecycle_queries_run,
      lifecycle_sources_returned: collected.lifecycle_sources_returned,
      specialist_support_queries: collected.specialist_support_queries_run,
      specialist_support_hits: [],
      specialist_support_sources: [],
      price_sources_returned: collected.price_sources_returned,
      serp_unique_queries: collected.queries_run.length,
      serp_raw_url_hits: collected.serp_raw_url_hits,
      serp_duplicate_urls_removed: collected.serp_duplicate_urls_removed,
      openai_request_payload: null,
      searches_executed: collected.queries_run,
      sources_returned: collected.hits.length,
      sources_sent_to_ai: priceEvidence.length + lifecycleEvidence.length,
      sources_successfully_read: enriched.pagesRead,
      pdf_downloads_attempted: enriched.pdfDownloadsAttempted,
      sources_used_by_ai: extracted.recommendation.price_sources_used,
      openai_raw_response: extracted.rawResponse,
      duration_ms: timings.total_execution_ms,
      ranked_sources: mergedHits.map((hit) => ({
        title: hit.title,
        url: hit.url,
        domain: hit.domain,
        source_type: hit.source_type,
        page_read_status: hit.page_read_status,
      })),
      structured_price_evidence: adminPriceEvidence,
      structured_lifecycle_evidence: adminLifecycleEvidence,
      v3_openai_request: extracted.requestPayload,
      v3_target: options.target ?? null,
      v3_metadata: extracted.recommendation.v3_metadata ?? null,
      price_selection: {
        status: priceSelection.priceSelectionStatus,
        manual_selection_required: priceSelection.manualSelectionRequired,
        conflicting_rrp_count: priceSelection.conflictingRrpCandidates.length,
        conflicting_rrp_spread_percent: priceSelection.conflictSpreadPercent,
      },
      v3_pages_skipped: pagesSkipped,
      v3_trusted_source_summary: trustedSourceSummary,
      research_strategy: collected.research_strategy,
      trusted_queries_run: collected.trusted_queries_run,
      broad_queries_run: collected.broad_queries_run,
      v3_targeted_lifecycle_queries: targetedLifecycle.queries,
      v3_lifecycle_query_debug: targetedLifecycle.query_debug,
    },
  }

  const slim = buildSlimV3ResearchResult(fullResult, pagesSkipped)
  const responseBytes = estimateJsonBytes(slim)
  logV3Diagnostics('response_payload', startedAt, {
    response_bytes: responseBytes,
    under_response_budget: responseBytes <= RESEARCH_V3_MAX_RESPONSE_BYTES,
  })

  return slim
}
