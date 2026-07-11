import {
  extractCanonicalPageUrl,
  fetchCandidatePage,
  fetchCandidatePdf,
  preparePageContentForAi,
} from './intelligencePageExtract.ts'
import type { EquipmentIntelligenceRow } from './intelligenceMarketSearch.ts'
import type { PageSkipEntry, PageSkipReason } from './intelligenceResearchResourceGuards.ts'
import {
  isHeavyResearchDomain,
  shouldFetchPdfForV3,
} from './intelligenceResearchResourceGuards.ts'

export const TRUSTED_DEALER_PRICE_SITE_SEARCHES = [
  { intent: 'fitkit_rrp', domain: 'fitkituk.com', suffix: 'RRP' },
  { intent: 'fitshop_rrp', domain: 'fitshop.co.uk', suffix: 'RRP' },
  { intent: 'fitness_superstore_list', domain: 'fitness-superstore.co.uk', suffix: '"List Price"' },
  { intent: 'pinnacle_rrp', domain: 'pinnaclefitness.org.uk', suffix: 'RRP' },
  { intent: 'amazon_leisure_rrp', domain: 'amazonleisure.co.uk', suffix: 'RRP' },
  { intent: 'powerhouse_rrp', domain: 'powerhouse-fitness.co.uk', suffix: 'RRP' },
] as const

export const GENERIC_PRICE_RESEARCH_QUERY_INTENTS = [
  { intent: 'msrp', suffix: 'MSRP' },
  { intent: 'dealer', suffix: 'dealer RRP' },
] as const

export const RESEARCH_QUERY_INTENTS = [
  ...TRUSTED_DEALER_PRICE_SITE_SEARCHES,
  ...GENERIC_PRICE_RESEARCH_QUERY_INTENTS,
] as const

export const LIFECYCLE_QUERY_INTENTS = [
  { intent: 'production_years', suffix: 'production years' },
  { intent: 'manufactured', suffix: 'manufactured' },
  { intent: 'discontinued', suffix: 'discontinued' },
  { intent: 'launch_year', suffix: 'launch year' },
  { intent: 'service_manual', suffix: 'service manual' },
] as const

export const SPECIALIST_SUPPORT_QUERY_INTENTS = [
  { intent: 'model_history', suffix: 'model history' },
  { intent: 'timeline', suffix: 'timeline' },
  { intent: 'product_history', suffix: 'product history' },
  { intent: 'legacy', suffix: 'legacy' },
  { intent: 'support', suffix: 'support' },
  { intent: 'parts', suffix: 'parts' },
  { intent: 'compatibility', suffix: 'compatibility' },
  { intent: 'serial_number', suffix: 'serial number' },
] as const

export const MAX_RESEARCH_SEARCH_QUERIES = RESEARCH_QUERY_INTENTS.length
export const MAX_LIFECYCLE_SEARCH_QUERIES = LIFECYCLE_QUERY_INTENTS.length
export const MAX_SPECIALIST_SUPPORT_SEARCH_QUERIES = SPECIALIST_SUPPORT_QUERY_INTENTS.length

export const SPECIALIST_SUPPORT_DOMAINS = [
  'sportsmith.com',
  'gympart.com',
  'johnsonfitness.com',
  'gymstore.com',
  'fitnessrepairparts.com',
  'partssource.com',
  'truefitness.com',
  'precor.com',
  'cybex.com',
  'matrixfitness.com',
  'technogym.com',
  'concept2.com',
] as const

/** Resale marketplaces — valid for market observations, never for original new price research. */
export const MARKETPLACE_RESALE_DOMAINS = [
  'ebay.co.uk',
  'ebay.com',
  'ebay.de',
  'ebay.fr',
  'ebay.it',
  'ebay.es',
  'ebay.ie',
  'ebay.ca',
  'ebay.com.au',
  'gumtree.com',
  'gumtree.co.uk',
  'shpock.com',
  'craigslist.org',
  'craigslist.co.uk',
  'preloved.co.uk',
  'facebook.com',
] as const

/** UK dealer catalogues strongly preferred for RRP / list price evidence. */
export const UK_DEALER_CATALOGUE_DOMAINS = [
  'fitness-superstore.co.uk',
] as const

/** Established commercial fitness retailers with historical RRP / lifecycle evidence. */
export const TRUSTED_COMMERCIAL_FITNESS_RETAILER_DOMAINS = [
  'fitness-superstore.co.uk',
  'fitshop.co.uk',
  'fitkituk.com',
  'amazonleisure.co.uk',
  'pinnaclefitness.org.uk',
  'powerhouse-fitness.co.uk',
  'gymkit.co.uk',
  'originfitness.com',
  'bestgymequipment.co.uk',
  'usedgymequipment.co.uk',
] as const

/** Used/refurb dealers that may cite historical RRP, launch dates, or specs. */
export const USED_REFURB_DEALER_DOMAINS = [
  'fitkituk.com',
  'ukgymequipment.com',
  'ukgymequipment.co.uk',
  'usedgymequipment.co.uk',
  'gymkit.co.uk',
] as const

export type PriceCandidateEvidenceType =
  | 'manufacturer_msrp'
  | 'manufacturer_rrp'
  | 'manufacturer_list_price'
  | 'manufacturer_retail_price'
  | 'dealer_list_price'
  | 'dealer_rrp'
  | 'dealer_original_retail_price'
  | 'dealer_recommended_retail_price'
  | 'dealer_retail_price'
  | 'dealer_our_price'
  | 'dealer_sale_price'
  | 'dealer_used_price'
  | 'dealer_refurbished_price'
  | 'dealer_clearance_price'
  | 'dealer_finance_price'

export type ResearchPriceCandidate = {
  evidence_type: PriceCandidateEvidenceType
  extracted_label: string
  extracted_price: number
  currency: string | null
  score: number
  eligible_for_original_price: boolean
}

export type PriceCandidateDebugEntry = {
  domain: string
  source_type: ResearchSourceType
  evidence_type: PriceCandidateEvidenceType
  extracted_label: string
  extracted_price: number
  currency: string | null
  score: number
  eligible_for_original_price: boolean
  selected: boolean
  rejection_reason: string | null
  url: string
}
export type ResearchLifecycleEvidenceKind = 'lifecycle_evidence' | null
export type ResearchSourceFetchStatus = 'read' | 'snippet_only' | 'failed'

/** @deprecated Use RESEARCH_QUERY_INTENTS for the optimised five-query search set. */
export const RESEARCH_QUERY_SUFFIXES = RESEARCH_QUERY_INTENTS
  .filter((entry) => entry.suffix !== 'filetype:pdf')
  .map((entry) => entry.suffix)

export type ResearchSourceType =
  | 'manufacturer_pdf'
  | 'manufacturer_website'
  | 'official_distributor'
  | 'dealer_catalogue'
  | 'archived_website'
  | 'specialist_support'
  | 'marketplace_resale'
  | 'dealer_historical_reference'
  | 'other'

export type SerpResearchHit = {
  intent: string
  query: string
  title: string
  url: string
  snippet: string
  position: number
  domain: string
  source_type: ResearchSourceType
  source_rank: number
  authority_score?: number
  price_relevance_score?: number
  production_relevance_score?: number
  combined_rank_score?: number
  page_content: string | null
  page_read_status: 'read' | 'snippet_only' | 'failed' | 'pdf_snippet_only'
  page_read_error: string | null
  source_fetch_status?: ResearchSourceFetchStatus
  price_evidence_kind?: ResearchPriceEvidenceKind
  lifecycle_evidence_kind?: ResearchLifecycleEvidenceKind
  historical_rrp_price?: number | null
  historical_rrp_currency?: string | null
  ignored_used_prices?: number[]
}

export type ResearchSupportingSource = {
  title: string
  domain: string
  url: string
  source_type: ResearchSourceType
  price_evidence_kind?: ResearchPriceEvidenceKind
  lifecycle_evidence_kind?: ResearchLifecycleEvidenceKind
  source_fetch_status?: ResearchSourceFetchStatus
  historical_rrp_price?: number | null
  ignored_used_prices?: number[]
}

export type ResearchEvidenceInput = {
  priceHits: SerpResearchHit[]
  lifecycleHits: SerpResearchHit[]
}

export type EquipmentResearchV3Metadata = {
  research_engine: 'v3' | 'fast'
  price_inference_method: 'structured_extraction' | 'ai_inference' | 'snippet_only'
  price_label_detected: string | null
  source_domain: string | null
  evidence_confidence: number | null
  core_product_group_research: boolean
  dedupe_eligible: boolean
  price_scope: 'base_machine' | 'variant_specific' | null
  structured_evidence_selected_id: string | null
  price_selection_status?: 'auto_selected' | 'manual_required' | 'admin_selected' | null
  ai_suggested_price?: number | null
  ai_suggested_confidence?: number | null
  conflicting_rrp_count?: number | null
  conflicting_rrp_spread_percent?: number | null
}

export type EquipmentResearchRecommendation = {
  original_new_price: number | null
  currency: string | null
  price_confidence: number | null
  price_reasoning: string
  price_sources_used: string[]
  source_original_price?: number | null
  source_original_currency?: string | null
  converted_original_price_gbp?: number | null
  conversion_method?: string | null
  conversion_notes?: string | null
  exchange_rate_used?: number | null
  exchange_rate_date?: string | null
  price_review_status?: 'verified' | 'converted' | 'needs_review' | 'missing' | null
  production_start_year: number | null
  production_end_year: number | null
  production_confidence: number | null
  production_reasoning: string
  production_sources_used: string[]
  confidence: number
  confidence_reasoning: string
  reasoning: string
  supporting_urls: string[]
  supporting_sources: ResearchSupportingSource[]
  baseline_manufacture_year?: number | null
  lifecycle_confidence?: number | null
  lifecycle_notes?: string | null
  v3_metadata?: EquipmentResearchV3Metadata
}

export type SerpRequestTiming = {
  query: string
  duration_ms: number
  result_count: number
  success?: boolean
  error?: string | null
  timed_out?: boolean
}

export type SerpQueryError = {
  query: string
  error: string
  timed_out: boolean
  duration_ms: number
}

export type PageFetchTiming = {
  url: string
  fetch_type: 'html' | 'pdf' | 'skipped_pdf_limit'
  duration_ms: number
  success: boolean
  error: string | null
}

export type SerpQueryAnalysis = {
  query: string
  result_count: number
  top_urls: string[]
  duration_ms: number
  error?: string | null
  timed_out?: boolean
}

export type EquipmentResearchTimings = {
  function_started_at: string
  offsets_from_start_ms: {
    function_start: number
    serp_complete: number | null
    ranking_complete: number | null
    stage_1_openai_start: number | null
    stage_1_openai_end: number | null
    stage_2_fetch_start: number | null
    stage_2_fetch_end: number | null
    stage_2_openai_start: number | null
    stage_2_openai_end: number | null
    function_end: number | null
  }
  serp_requests: SerpRequestTiming[]
  serp_total_ms: number
  ranking_ms: number
  stage_1_openai_ms: number | null
  stage_2_page_fetches: PageFetchTiming[]
  stage_2_fetch_total_ms: number | null
  stage_2_openai_ms: number | null
  total_execution_ms: number
}

export type OpenAiResearchRequestPayload = {
  stage: ResearchEnrichmentStage
  equipment_label: string
  source_count: number
  price_source_count: number
  lifecycle_source_count: number
  price_sources: Array<{
    title: string
    snippet: string
    url: string
    source_type: ResearchSourceType
    domain: string
  }>
  lifecycle_sources: Array<{
    title: string
    snippet: string
    url: string
    source_type: ResearchSourceType
    domain: string
  }>
  /** @deprecated Combined list for backward compatibility. */
  sources: Array<{
    title: string
    snippet: string
    url: string
    source_type: ResearchSourceType
    domain: string
  }>
}

export type EquipmentResearchDebugLog = {
  equipment_label: string
  research_stage: 'stage_1' | 'stage_2'
  progress_log: string[]
  timings: EquipmentResearchTimings
  serp_query_analysis: SerpQueryAnalysis[]
  serp_errors?: SerpQueryError[]
  serp_warning?: string | null
  price_input_sources?: ResearchSupportingSource[]
  lifecycle_input_sources?: ResearchSupportingSource[]
  lifecycle_search_queries?: string[]
  lifecycle_sources_returned?: number
  specialist_support_queries?: string[]
  specialist_support_hits?: Array<{
    title: string
    url: string
    domain: string
    source_type: ResearchSourceType
    combined_rank_score?: number
  }>
  specialist_support_sources?: ResearchSupportingSource[]
  production_inferred_from_sources?: ProductionInferredFromSource[]
  price_sources_returned?: number
  price_currency_debug?: PriceCurrencyDebug
  price_source_classification?: PriceSourceClassificationEntry[]
  excluded_marketplace_price_sources?: PriceSourceClassificationEntry[]
  price_candidate_debug?: PriceCandidateDebugEntry[]
  serp_unique_queries: number
  serp_raw_url_hits: number
  serp_duplicate_urls_removed: number
  openai_request_payload: OpenAiResearchRequestPayload | null
  openai_stage1_request_payload?: OpenAiResearchRequestPayload | null
  openai_stage2_request_payload?: OpenAiResearchRequestPayload | null
  searches_executed: string[]
  sources_returned: number
  sources_sent_to_ai: number
  sources_successfully_read: number
  pdf_downloads_attempted: number
  sources_used_by_ai: string[]
  openai_raw_response: unknown
  openai_stage1_response?: unknown
  openai_stage2_response?: unknown
  duration_ms: number
  ranked_sources: Array<{
    title: string
    url: string
    domain: string
    source_type: ResearchSourceType
    page_read_status: SerpResearchHit['page_read_status']
  }>
  research_engine?: 'v2' | 'v3' | 'fast'
  structured_price_evidence?: Array<{
    id: string
    label: string
    value: number
    currency: string | null
    sourceDomain: string
    confidence: number
    score: number
    extractionMethod: string
    rejectionReason: string | null
    selected?: boolean
    selectionNote?: string | null
    sourceUrl?: string
  }>
  structured_lifecycle_evidence?: Array<{
    id: string
    label: string
    year: number | null
    yearEnd: number | null
    sourceDomain: string
    confidence: number
    type?: string
    snippet?: string
    affectsBaseline?: boolean
    isConsoleTimeline?: boolean
    lifecycleNotes?: string | null
    sourceUrl?: string
    score?: number
  }>
  v3_openai_request?: unknown
  v3_target?: {
    dedupeEligible?: boolean
    coreProductKey?: string | null
    memberCount?: number
    priceScope?: 'base_machine' | 'variant_specific'
  } | null
  v3_metadata?: EquipmentResearchV3Metadata | null
  v3_pages_skipped?: PageSkipEntry[]
  v3_trusted_source_summary?: Array<{
    domain: string
    queries: string[]
    hits_returned: number
    snippet_price_signals: boolean
    structured_evidence_count: number
    page_fetched: boolean
    evidence_labels: string[]
  }>
  research_strategy?: 'source_first' | 'standard' | 'fast_trusted_snippet_only'
  trusted_queries_run?: string[]
  broad_queries_run?: string[]
  source_identity_scores?: Array<{
    title?: string
    url: string
    domain: string
    query?: string
    score: number
    level: string
    label: string
    accepted?: boolean
  }>
  fast_source_hits?: Array<{
    title: string
    snippet: string
    url: string
    domain: string
    query: string
    identityScore: number
    identityLevel: string
    identityLabel: string
  }>
  v3_targeted_lifecycle_queries?: string[]
  v3_lifecycle_query_debug?: Array<{
    query: string
    result_count: number
    snippets: Array<{
      title: string
      snippet: string
      url: string
      domain: string
    }>
  }>
}

export type EquipmentResearchResult = {
  equipment: {
    id: string
    brand: string
    series: string | null
    model: string
    slug: string
    equipment_type: string | null
  }
  queries_run: string[]
  serp_result_count: number
  deduped_result_count: number
  search_hits: SerpResearchHit[]
  ai_input_sources: ResearchSupportingSource[]
  price_input_sources: ResearchSupportingSource[]
  lifecycle_input_sources: ResearchSupportingSource[]
  specialist_support_hits?: SerpResearchHit[]
  recommendation: EquipmentResearchRecommendation
  debug_log: EquipmentResearchDebugLog
}

export type ProductionInferredFromSource = {
  url: string
  domain: string
  title: string
  source_type: ResearchSourceType
  is_specialist_support: boolean
  query_intent?: string
}

const SOURCE_TYPE_RANK: Record<ResearchSourceType, number> = {
  manufacturer_pdf: 1,
  manufacturer_website: 2,
  dealer_historical_reference: 3,
  dealer_catalogue: 4,
  official_distributor: 5,
  archived_website: 6,
  specialist_support: 7,
  other: 8,
  marketplace_resale: 9,
}

const SOURCE_AUTHORITY_SCORES: Record<ResearchSourceType, number> = {
  manufacturer_pdf: 10,
  manufacturer_website: 10,
  dealer_historical_reference: 8,
  dealer_catalogue: 6,
  official_distributor: 8,
  specialist_support: 6,
  archived_website: 5,
  other: 3,
  marketplace_resale: 0,
}

const LIFECYCLE_SOURCE_TYPE_RANK: Record<ResearchSourceType, number> = {
  manufacturer_website: 1,
  archived_website: 2,
  specialist_support: 3,
  manufacturer_pdf: 4,
  official_distributor: 5,
  dealer_catalogue: 6,
  dealer_historical_reference: 6,
  other: 7,
  marketplace_resale: 8,
}

const LIFECYCLE_AUTHORITY_SCORES: Record<ResearchSourceType, number> = {
  manufacturer_website: 10,
  archived_website: 9,
  specialist_support: 9,
  manufacturer_pdf: 8,
  official_distributor: 6,
  dealer_catalogue: 4,
  dealer_historical_reference: 5,
  other: 2,
  marketplace_resale: 0,
}

const PRICE_RELEVANCE_MAX = 10
const PRICE_RELEVANCE_MIN = -8
const PRODUCTION_RELEVANCE_MAX = 10

export const EQUIPD_DEFAULT_VALUATION_CURRENCY = 'GBP'
export const NON_GBP_VERIFIED_CONFIDENCE_CAP = 89
export const USD_ONLY_RESEARCH_CONFIDENCE_CAP = 85
export const USD_WITH_GBP_EVIDENCE_CONFIDENCE_CAP = 75
/** Server-side USD→GBP rate for research conversion — not a live FX feed. */
export const USD_TO_GBP_RESEARCH_EXCHANGE_RATE = 0.75

export const OFFICIAL_MANUFACTURER_PRICE_SOURCE_TYPES = [
  'manufacturer_website',
  'manufacturer_pdf',
] as const

export type PriceCurrencyDebug = {
  detected_currencies: string[]
  selected_currency: string | null
  gbp_source_count: number
  non_gbp_source_count: number
}

export type PriceSourceClassificationEntry = {
  title: string
  url: string
  domain: string
  source_type: ResearchSourceType
  excluded_from_original_price: boolean
  exclusion_reason: 'marketplace_resale' | 'resale_pricing_context' | 'used_price_only' | null
  price_evidence_kind?: ResearchPriceEvidenceKind
  lifecycle_evidence_kind?: ResearchLifecycleEvidenceKind
  source_fetch_status?: ResearchSourceFetchStatus
}

export type PriceSourceCurrencyLean = 'gbp' | 'non_gbp' | 'neutral'

export function isUkPriceSourceDomain(domain: string): boolean {
  const normalized = domain.toLowerCase().replace(/^www\./i, '')
  return normalized.endsWith('.co.uk')
}

export function detectCurrenciesInHaystack(haystack: string): Set<string> {
  const currencies = new Set<string>()
  if (/£|\bgbp\b/i.test(haystack)) currencies.add('GBP')
  if (/(?:^|[^A-Za-z])\$|\busd\b/i.test(haystack)) currencies.add('USD')
  if (/€|\beur\b/i.test(haystack)) currencies.add('EUR')
  return currencies
}

export function isUkPriceResearchHit(
  hit: Pick<SerpResearchHit, 'title' | 'snippet' | 'url' | 'intent' | 'query' | 'page_content' | 'domain'>,
): boolean {
  const domain = hit.domain || extractResearchDomain(hit.url)
  const haystack = buildResearchHitHaystack(hit)
  return isUkPriceSourceDomain(domain)
    || /\b(united kingdom|uk dealer|uk distributor|\.co\.uk)\b/i.test(haystack)
    || detectCurrenciesInHaystack(haystack).has('GBP')
}

export function classifyPriceSourceCurrencyLean(
  hit: Pick<SerpResearchHit, 'title' | 'snippet' | 'url' | 'intent' | 'query' | 'page_content' | 'domain'>,
): PriceSourceCurrencyLean {
  const domain = hit.domain || extractResearchDomain(hit.url)
  const haystack = buildResearchHitHaystack(hit)
  const currencies = detectCurrenciesInHaystack(haystack)
  const hasGbp = currencies.has('GBP') || isUkPriceResearchHit(hit)
  const hasNonGbp = currencies.has('USD') || currencies.has('EUR')

  if (hasGbp) return 'gbp'
  if (hasNonGbp) return 'non_gbp'
  if (isUkPriceSourceDomain(domain)) return 'gbp'
  return 'neutral'
}

export function isOfficialManufacturerPriceSource(
  sourceType: ResearchSourceType | null | undefined,
): boolean {
  return sourceType === 'manufacturer_website' || sourceType === 'manufacturer_pdf'
}

export function isDealerSalePriceOnly(
  hit: Pick<SerpResearchHit, 'title' | 'snippet' | 'url' | 'intent' | 'query' | 'page_content' | 'domain' | 'source_type'>,
): boolean {
  const haystack = buildResearchHitHaystack(hit)
  const hasOfficialListSignal = /\b(list price|rrp|msrp|original price|original retail price|recommended retail price|new price)\b/i.test(haystack)
  const hasSaleSignal = /\bour price\b|\bnow\b[^.]{0,16}£|\bsale price\b|\bclearance\b|\bcurrent price\b|\bused price\b/i.test(haystack)
  const isDealerContext = hit.source_type === 'dealer_catalogue'
    || /\bdealer\b/i.test(haystack)
    || isUkDealerCatalogueDomain(hit.domain || extractResearchDomain(hit.url))

  return isDealerContext && hasSaleSignal && !hasOfficialListSignal
}

export function isGenuineCatalogueOriginalPriceHit(
  hit: Pick<SerpResearchHit, 'title' | 'snippet' | 'url' | 'intent' | 'query' | 'page_content' | 'domain' | 'source_type'>,
): boolean {
  if (isOfficialManufacturerPriceSource(hit.source_type)) {
    return hasOriginalPriceEvidenceSignals(hit)
  }

  return hasCatalogueOriginalPriceSignals(hit) && !isDealerSalePriceOnly(hit)
}

export function hasOriginalPriceEvidenceSignals(
  hit: Pick<SerpResearchHit, 'title' | 'snippet' | 'url' | 'intent' | 'query' | 'page_content' | 'domain' | 'source_type'>,
): boolean {
  const haystack = buildResearchHitHaystack(hit)
  const isMaintenanceNoise = /\bmaintenance\b|\bpreventive\b|\bservice manual\b|\boperation(?:al)? manual\b/i.test(haystack)

  if (isMaintenanceNoise) return false

  return hasCatalogueOriginalPriceSignals(hit)
    || /\b(msrp|rrp|list price|original price|new price|from \$|from £|\$\d|£\d)/i.test(haystack)
}

export function scoreOfficialPriceSourceBias(
  hit: Pick<SerpResearchHit, 'title' | 'snippet' | 'url' | 'intent' | 'query' | 'page_content' | 'domain' | 'source_type'>,
  sourceType: ResearchSourceType,
): number {
  let score = 0
  const domain = hit.domain || extractResearchDomain(hit.url)

  if (isOfficialManufacturerPriceSource(sourceType) && hasOriginalPriceEvidenceSignals(hit)) {
    score += 8
    if (hasCatalogueOriginalPriceSignals(hit)) score += 4
  } else if (sourceType === 'official_distributor' && hasCatalogueOriginalPriceSignals(hit)) {
    score += 4
  }

  if (isTrustedCommercialFitnessRetailerDomain(domain)
    && (hasHistoricalRrpSignals(hit) || hasCatalogueOriginalPriceSignals(hit))) {
    score += 10
    if (sourceType === 'dealer_historical_reference') score += 3
  }

  if (isDealerSalePriceOnly({ ...hit, source_type: sourceType })) {
    score -= 7
  } else if (isGenuineCatalogueOriginalPriceHit({ ...hit, source_type: sourceType })) {
    score += 3
  }

  const eligibleCandidates = extractPriceCandidates(hit).filter((candidate) => candidate.eligible_for_original_price)
  if (eligibleCandidates.length > 0) {
    score += Math.min(6, Math.max(...eligibleCandidates.map((candidate) => candidate.score)) / 2)
  }

  return score
}

export function getResearchExchangeRateDate(referenceDate: Date = new Date()): string {
  return referenceDate.toISOString().slice(0, 10)
}

export function convertUsdToGbpResearch(usd: number): number {
  return Math.round(usd * USD_TO_GBP_RESEARCH_EXCHANGE_RATE)
}

export function applyServerSidePriceCurrencyConversion(
  recommendation: Pick<EquipmentResearchRecommendation, 'original_new_price' | 'currency'>,
  referenceDate: Date = new Date(),
): Pick<
  EquipmentResearchRecommendation,
  | 'source_original_price'
  | 'source_original_currency'
  | 'converted_original_price_gbp'
  | 'conversion_method'
  | 'conversion_notes'
  | 'exchange_rate_used'
  | 'exchange_rate_date'
  | 'price_review_status'
  | 'currency'
> {
  const sourceCurrency = recommendation.currency?.toUpperCase() ?? null
  const sourcePrice = recommendation.original_new_price
  const exchangeRateDate = getResearchExchangeRateDate(referenceDate)

  if (!sourceCurrency || sourcePrice == null) {
    return {
      source_original_price: null,
      source_original_currency: null,
      converted_original_price_gbp: null,
      conversion_method: null,
      conversion_notes: null,
      exchange_rate_used: null,
      exchange_rate_date: null,
      price_review_status: 'missing',
      currency: null,
    }
  }

  if (sourceCurrency === EQUIPD_DEFAULT_VALUATION_CURRENCY) {
    return {
      source_original_price: sourcePrice,
      source_original_currency: sourceCurrency,
      converted_original_price_gbp: sourcePrice,
      conversion_method: 'native_gbp',
      conversion_notes: null,
      exchange_rate_used: 1,
      exchange_rate_date: exchangeRateDate,
      price_review_status: null,
      currency: sourceCurrency,
    }
  }

  if (sourceCurrency === 'USD') {
    return {
      source_original_price: sourcePrice,
      source_original_currency: 'USD',
      converted_original_price_gbp: convertUsdToGbpResearch(sourcePrice),
      conversion_method: 'server_usd_gbp_exchange_rate',
      conversion_notes: 'Converted from USD using server-side exchange rate for Equipd valuations.',
      exchange_rate_used: USD_TO_GBP_RESEARCH_EXCHANGE_RATE,
      exchange_rate_date: exchangeRateDate,
      price_review_status: 'converted',
      currency: 'USD',
    }
  }

  return {
    source_original_price: sourcePrice,
    source_original_currency: sourceCurrency,
    converted_original_price_gbp: null,
    conversion_method: null,
    conversion_notes: `Non-GBP currency (${sourceCurrency}) requires manual review before use in Equipd valuations.`,
    exchange_rate_used: null,
    exchange_rate_date: null,
    price_review_status: 'needs_review',
    currency: sourceCurrency,
  }
}

/** @deprecated Use applyServerSidePriceCurrencyConversion */
export function buildOfficialPriceCurrencyFields(
  recommendation: Pick<EquipmentResearchRecommendation, 'original_new_price' | 'currency'>,
  referenceDate: Date = new Date(),
): ReturnType<typeof applyServerSidePriceCurrencyConversion> {
  return applyServerSidePriceCurrencyConversion(recommendation, referenceDate)
}

/** @deprecated Use convertUsdToGbpResearch */
export function convertUsdToGbpIndicative(usd: number): number {
  return convertUsdToGbpResearch(usd)
}

function resolvePrimaryPriceSourceType(
  recommendation: Pick<EquipmentResearchRecommendation, 'price_sources_used'>,
  priceHits: SerpResearchHit[],
): ResearchSourceType | null {
  const hitByUrl = new Map(priceHits.map((hit) => [hit.url.trim().toLowerCase(), hit]))

  for (const url of recommendation.price_sources_used ?? []) {
    const hit = hitByUrl.get(url.trim().toLowerCase())
    if (hit?.source_type) return hit.source_type
  }

  return null
}

function countGenuineGbpCatalogueSources(priceHits: SerpResearchHit[]): number {
  return priceHits.filter((hit) => {
    if (isMarketplaceResalePriceSource(hit) || hit.source_type === 'marketplace_resale') {
      return false
    }
    if (classifyPriceSourceCurrencyLean(hit) !== 'gbp') return false
    return isGenuineCatalogueOriginalPriceHit(hit)
  }).length
}

export function scoreUkPriceSourceBias(
  hit: Pick<SerpResearchHit, 'title' | 'snippet' | 'url' | 'intent' | 'query' | 'page_content' | 'domain' | 'source_type'>,
  sourceType?: ResearchSourceType,
): number {
  const domain = hit.domain || extractResearchDomain(hit.url)
  const haystack = buildResearchHitHaystack(hit)
  const currencies = detectCurrenciesInHaystack(haystack)
  const resolvedSourceType = sourceType ?? hit.source_type
  const genuineCatalogue = isGenuineCatalogueOriginalPriceHit({
    ...hit,
    source_type: resolvedSourceType,
  })
  const officialManufacturer = isOfficialManufacturerPriceSource(resolvedSourceType)
  let score = 0

  if (isUkPriceSourceDomain(domain) && genuineCatalogue) score += 4
  if (/\b(united kingdom|uk distributor|uk dealer)\b/i.test(haystack) && genuineCatalogue) score += 3
  if (currencies.has('GBP') && genuineCatalogue) score += 3
  if (isDealerSalePriceOnly({ ...hit, source_type: resolvedSourceType })) score -= 6

  if (!officialManufacturer) {
    if (currencies.has('USD') && !currencies.has('GBP')) score -= 2
    if (currencies.has('EUR') && !currencies.has('GBP')) score -= 2
    if (/\b(us distributor|us msrp)\b/i.test(haystack) && !currencies.has('GBP')) score -= 2
  }

  return score
}

export function analyzePriceCurrencyEvidence(
  priceHits: SerpResearchHit[],
): PriceCurrencyDebug {
  const detected = new Set<string>()
  let gbp_source_count = 0
  let non_gbp_source_count = 0

  for (const hit of priceHits) {
    if (isMarketplaceResalePriceSource(hit) || hit.source_type === 'marketplace_resale') {
      continue
    }
    const haystack = buildResearchHitHaystack(hit)
    const currencies = detectCurrenciesInHaystack(haystack)
    for (const currency of currencies) detected.add(currency)

    const lean = classifyPriceSourceCurrencyLean(hit)
    if (lean === 'gbp') {
      if (isDealerSalePriceOnly(hit)) {
        continue
      }
      gbp_source_count += 1
      if (!currencies.has('GBP') && isUkPriceSourceDomain(hit.domain || extractResearchDomain(hit.url))) {
        detected.add('GBP')
      }
    } else if (lean === 'non_gbp') {
      non_gbp_source_count += 1
    } else if (/\bprice\b|\bmsrp\b|\brrp\b/i.test(haystack)) {
      // Pricing page with no explicit currency — leave neutral.
    }
  }

  return {
    detected_currencies: [...detected].sort(),
    selected_currency: null,
    gbp_source_count,
    non_gbp_source_count,
  }
}

export function finalizeResearchPriceRecommendation(
  recommendation: EquipmentResearchRecommendation,
  priceHits: SerpResearchHit[],
): { recommendation: EquipmentResearchRecommendation; price_currency_debug: PriceCurrencyDebug } {
  const analysis = analyzePriceCurrencyEvidence(priceHits)

  if (recommendation.original_new_price == null) {
    return {
      recommendation: {
        ...recommendation,
        price_confidence: null,
      },
      price_currency_debug: {
        ...analysis,
        selected_currency: null,
      },
    }
  }

  if (recommendationUsesMarketplacePriceSources(recommendation)) {
    return {
      recommendation: {
        ...recommendation,
        original_new_price: null,
        price_confidence: null,
        price_reasoning: recommendation.price_reasoning
          ? `${recommendation.price_reasoning} Marketplace, auction, and resale listings cannot support original new price.`
          : 'Marketplace, auction, and resale listings cannot support original new price.',
        price_sources_used: [],
      },
      price_currency_debug: {
        ...analysis,
        selected_currency: null,
      },
    }
  }

  let currency = recommendation.currency
  let price_confidence = recommendation.price_confidence
  let price_reasoning = recommendation.price_reasoning
  const hasGbpEvidence = analysis.gbp_source_count > 0
  const hasNonGbpEvidence = analysis.non_gbp_source_count > 0
  const primarySourceType = resolvePrimaryPriceSourceType(recommendation, priceHits)
  const isOfficialUsdPrice = currency?.toUpperCase() === 'USD'
    && isOfficialManufacturerPriceSource(primarySourceType)
  const genuineGbpCatalogueCount = countGenuineGbpCatalogueSources(priceHits)

  if (!currency) {
    if (hasGbpEvidence && !hasNonGbpEvidence) {
      currency = EQUIPD_DEFAULT_VALUATION_CURRENCY
    } else if (hasNonGbpEvidence && !hasGbpEvidence && analysis.detected_currencies.length === 1) {
      currency = analysis.detected_currencies[0]
    }
  }

  if (currency && currency !== EQUIPD_DEFAULT_VALUATION_CURRENCY) {
    const cap = !hasGbpEvidence && currency === 'USD'
      ? USD_ONLY_RESEARCH_CONFIDENCE_CAP
      : NON_GBP_VERIFIED_CONFIDENCE_CAP
    if (price_confidence != null && price_confidence > cap) {
      price_confidence = cap
    }
    if (isOfficialUsdPrice) {
      if (!/official price is usd/i.test(price_reasoning)) {
        price_reasoning = `${price_reasoning} Official price is USD — converted GBP requires review.`
      }
    } else if (!/non-gbp currency/i.test(price_reasoning)) {
      price_reasoning = `${price_reasoning} Non-GBP currency (${currency}) requires manual review before use in Equipd valuations.`
    }
  }

  if (currency === 'USD' && hasGbpEvidence && !isOfficialUsdPrice) {
    if (genuineGbpCatalogueCount > 0) {
      if (price_confidence != null && price_confidence > USD_WITH_GBP_EVIDENCE_CONFIDENCE_CAP) {
        price_confidence = USD_WITH_GBP_EVIDENCE_CONFIDENCE_CAP
      }
      if (!/gbp-priced uk sources were available/i.test(price_reasoning)) {
        price_reasoning = `${price_reasoning} Genuine GBP catalogue sources were available; USD was not preferred for Equipd.`
      }
    }
  }

  const currencyFields = applyServerSidePriceCurrencyConversion(
    {
      original_new_price: recommendation.original_new_price,
      currency,
    },
  )

  return {
    recommendation: {
      ...recommendation,
      price_confidence,
      price_reasoning,
      ...currencyFields,
    },
    price_currency_debug: {
      ...analysis,
      selected_currency: currency,
    },
  }
}

export const EXTERNAL_REQUEST_TIMEOUT_MS = 10_000
export const SERPAPI_REQUEST_TIMEOUT_MS = 15_000
export const OPENAI_REQUEST_TIMEOUT_MS = 60_000
/** Trim lifecycle sources when the OpenAI prompt exceeds this character count. */
export const OPENAI_PROMPT_TRIM_CHAR_THRESHOLD = 48_000
export const RESEARCH_STAGE1_AI_SOURCES = 5
export const RESEARCH_STAGE1_LIFECYCLE_AI_SOURCES = 5
export const RESEARCH_STAGE2_PAGE_READS = 3
export const RESEARCH_STAGE2_PDF_DOWNLOADS = 2
export const RESEARCH_STAGE1_CONFIDENCE_THRESHOLD = 90

export type ResearchEnrichmentStage = 'snippet' | 'enriched'

export type EquipmentResearchMode = 'full' | 'price_only' | 'lifecycle_only'

export function shouldRunStage2Enrichment(confidence: number): boolean {
  return confidence < RESEARCH_STAGE1_CONFIDENCE_THRESHOLD
}

export function createEmptyResearchTimings(startedAt: number): EquipmentResearchTimings {
  return {
    function_started_at: new Date(startedAt).toISOString(),
    offsets_from_start_ms: {
      function_start: 0,
      serp_complete: null,
      ranking_complete: null,
      stage_1_openai_start: null,
      stage_1_openai_end: null,
      stage_2_fetch_start: null,
      stage_2_fetch_end: null,
      stage_2_openai_start: null,
      stage_2_openai_end: null,
      function_end: null,
    },
    serp_requests: [],
    serp_total_ms: 0,
    ranking_ms: 0,
    stage_1_openai_ms: null,
    stage_2_page_fetches: [],
    stage_2_fetch_total_ms: null,
    stage_2_openai_ms: null,
    total_execution_ms: 0,
  }
}

export function logResearchTiming(
  stage: string,
  detail: Record<string, unknown>,
  startedAt: number,
) {
  console.info('equipment_research_timing', {
    stage,
    elapsed_from_start_ms: Date.now() - startedAt,
    ...detail,
  })
}

type SerpApiOrganicResult = {
  title?: string
  link?: string
  snippet?: string
  position?: number
}

type SerpApiResponse = {
  organic_results?: SerpApiOrganicResult[]
  error?: string
}

export function normalizeResearchWhitespace(value: string): string {
  return String(value ?? '').replace(/\s+/g, ' ').trim()
}

export function stripModelYearRange(model: string): string {
  return normalizeResearchWhitespace(
    String(model ?? '').replace(/\(\s*\d{4}\s*[-–]\d{4}\s*\)/gi, ''),
  )
}

export function stripTrailingEquipmentType(
  model: string,
  equipmentType: string | null | undefined,
): string {
  const normalizedModel = normalizeResearchWhitespace(model)
  const type = normalizeResearchWhitespace(equipmentType ?? '')
  if (!normalizedModel || !type) return normalizedModel

  const typePattern = new RegExp(`\\b${type.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b$`, 'i')
  const stripped = normalizedModel.replace(typePattern, '').replace(/\s+/g, ' ').trim()
  return stripped || normalizedModel
}

function needsEquipmentTypeDisambiguation(
  model: string,
  equipmentType: string | null | undefined,
): boolean {
  const normalizedModel = normalizeResearchWhitespace(model)
  const type = normalizeResearchWhitespace(equipmentType ?? '')
  if (!normalizedModel || !type) return false

  if (normalizedModel.length < 4) return true

  const genericModelPattern = /^(pro|elite|standard|classic|premium|commercial|home)$/i
  if (genericModelPattern.test(normalizedModel)) return true

  if (normalizedModel.toLowerCase() === type.toLowerCase()) return true

  return false
}

function isGenericResearchModel(model: string): boolean {
  const normalized = model.trim().toLowerCase()
  if (!normalized) return true
  if (normalized.length < 4) return true
  return /^(crosstrainer|cross[\s-]?trainer|treadmill|elliptical|bike|cycle|recumbent|upright|rower|climber|stepper|powermill|arc[\s-]?trainer)$/i.test(normalized)
}

export function buildEquipmentResearchSearchPhrase(
  equipment: EquipmentIntelligenceRow & { core_product_name?: string | null },
): string {
  const brand = normalizeResearchWhitespace(equipment.brand ?? '')
  const model = stripTrailingEquipmentType(
    stripModelYearRange(equipment.model ?? ''),
    equipment.equipment_type,
  )
  const coreName = normalizeResearchWhitespace(equipment.core_product_name ?? '')

  if (coreName) {
    const corePhrase = coreName.toLowerCase().startsWith(brand.toLowerCase())
      ? coreName
      : [brand, coreName].filter(Boolean).join(' ')
    if (isGenericResearchModel(model) || !corePhrase.toLowerCase().includes(model.toLowerCase())) {
      return corePhrase
    }
  }

  const phrase = [brand, model].filter(Boolean).join(' ')

  if (needsEquipmentTypeDisambiguation(model, equipment.equipment_type)) {
    return [brand, model, equipment.equipment_type].filter(Boolean).join(' ')
  }

  return phrase
}

export function buildEquipmentResearchPhrases(equipment: EquipmentIntelligenceRow): {
  primary: string
  withSeries: string
} {
  const brand = normalizeResearchWhitespace(equipment.brand ?? '')
  const series = normalizeResearchWhitespace(equipment.series ?? '')
  const model = stripTrailingEquipmentType(
    stripModelYearRange(equipment.model ?? ''),
    equipment.equipment_type,
  )

  const primary = buildEquipmentResearchSearchPhrase(equipment)
  const seriesAddsContext = Boolean(
    series
    && series.length >= 2
    && !model.toLowerCase().includes(series.toLowerCase())
    && !series.toLowerCase().includes(model.toLowerCase()),
  )

  const withSeries = seriesAddsContext
    ? [brand, series, model].filter(Boolean).join(' ')
    : primary

  return { primary, withSeries }
}

export function buildEquipmentResearchQueries(equipment: EquipmentIntelligenceRow): string[] {
  return buildEquipmentPriceResearchQueries(equipment)
}

export function buildEquipmentPriceResearchQueries(equipment: EquipmentIntelligenceRow): string[] {
  const phrase = buildEquipmentResearchSearchPhrase(equipment)
  if (!phrase) return []

  const siteQueries = TRUSTED_DEALER_PRICE_SITE_SEARCHES.map(({ domain, suffix }) => (
    `site:${domain} ${phrase} ${suffix}`.replace(/\s+/g, ' ').trim()
  ))

  const genericQueries = GENERIC_PRICE_RESEARCH_QUERY_INTENTS.map(({ suffix }) => (
    `${phrase} ${suffix}`.replace(/\s+/g, ' ').trim()
  ))

  return [...siteQueries, ...genericQueries]
}

export function buildEquipmentLifecycleResearchQueries(equipment: EquipmentIntelligenceRow): string[] {
  const phrase = buildEquipmentResearchSearchPhrase(equipment)
  if (!phrase) return []

  return LIFECYCLE_QUERY_INTENTS.map(({ suffix }) => (
    `${phrase} ${suffix}`.replace(/\s+/g, ' ').trim()
  ))
}

export function buildEquipmentSpecialistSupportResearchQueries(equipment: EquipmentIntelligenceRow): string[] {
  const phrase = buildEquipmentResearchSearchPhrase(equipment)
  if (!phrase) return []

  return SPECIALIST_SUPPORT_QUERY_INTENTS.map(({ suffix }) => (
    `${phrase} ${suffix}`.replace(/\s+/g, ' ').trim()
  ))
}

export function extractResearchDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./i, '').toLowerCase()
  } catch {
    return ''
  }
}

function normalizeBrandKey(brand: string): string {
  return brand.toLowerCase().replace(/[^a-z0-9]/g, '')
}

function isArchiveDomain(domain: string): boolean {
  return /(^|\.)archive\.org$/i.test(domain)
    || /web\.archive\.org/i.test(domain)
}

function isPdfUrl(url: string): boolean {
  return /\.pdf(?:$|[?#])/i.test(url) || /filetype:pdf/i.test(url)
}

function domainContainsBrand(domain: string, brand: string): boolean {
  const brandKey = normalizeBrandKey(brand)
  const domainKey = domain.toLowerCase().replace(/[^a-z0-9]/g, '')
  if (!brandKey || !domainKey) return false

  if (domainKey.includes(brandKey)) return true

  const compactBrand = brandKey
    .replace(/fitness/g, '')
    .replace(/gym/g, '')
  return compactBrand.length >= 4 && domainKey.includes(compactBrand)
}

export function isSpecialistSupportDomain(domain: string): boolean {
  const normalized = domain.toLowerCase().replace(/^www\./i, '')
  return SPECIALIST_SUPPORT_DOMAINS.some((knownDomain) => (
    normalized === knownDomain || normalized.endsWith(`.${knownDomain}`)
  ))
}

function hasSpecialistSupportSignals(
  haystack: string,
  url: string,
): boolean {
  if (isSpecialistSupportDomain(extractResearchDomain(url))) return true

  return /\b(parts? supplier|replacement parts|compatibility guide|support guide|model guide|model history|serial number|parts? catalogue)\b/i.test(haystack)
    || /\/(support|parts|guides|service|compatibility)\//i.test(url)
}

function isForumOrBlogDomain(domain: string): boolean {
  return /(^|\.)reddit\.com$/i.test(domain)
    || /(^|\.)quora\.com$/i.test(domain)
    || /\bforum\b/i.test(domain)
}

function isLifecyclePricingNoise(haystack: string): boolean {
  return /\bbuy\b|\bsale\b|\bour price\b|\bclearance\b|\bfinance\b|\bdelivery\b/i.test(haystack)
    && !/\btimeline\b|\bmodel history\b|\bsupport guide\b|\bcompatibility\b/i.test(haystack)
}

export function isMarketplaceResaleDomain(domain: string, url = ''): boolean {
  const normalized = domain.toLowerCase().replace(/^www\./i, '')
  const normalizedUrl = url.toLowerCase()

  if (/facebook\.com$/i.test(normalized) && /\/marketplace\b/i.test(normalizedUrl)) {
    return true
  }

  if (/(^|\.)ebay\./i.test(normalized)) return true

  return MARKETPLACE_RESALE_DOMAINS.some((knownDomain) => (
    normalized === knownDomain || normalized.endsWith(`.${knownDomain}`)
  ))
}

export function isUkDealerCatalogueDomain(domain: string): boolean {
  const normalized = domain.toLowerCase().replace(/^www\./i, '')
  return UK_DEALER_CATALOGUE_DOMAINS.some((knownDomain) => (
    normalized === knownDomain || normalized.endsWith(`.${knownDomain}`)
  ))
}

export function isTrustedCommercialFitnessRetailerDomain(domain: string): boolean {
  const normalized = domain.toLowerCase().replace(/^www\./i, '')
  return TRUSTED_COMMERCIAL_FITNESS_RETAILER_DOMAINS.some((knownDomain) => (
    normalized === knownDomain || normalized.endsWith(`.${knownDomain}`)
  ))
}

export function isAmazonLeisureNewEquipmentPage(
  hit: Pick<SerpResearchHit, 'title' | 'snippet' | 'url' | 'intent' | 'query' | 'page_content' | 'domain'>,
): boolean {
  const domain = hit.domain || extractResearchDomain(hit.url)
  if (!/amazonleisure\.co\.uk$/i.test(domain.replace(/^www\./i, ''))) {
    return true
  }

  const haystack = buildResearchHitHaystack(hit)
  return !/\b(used|refurbished|reconditioned|pre[\s-]?owned|second[\s-]?hand|ex[\s-]?display|clearance)\b/i.test(haystack)
}

export function isTrustedRetailerHistoricalReference(
  hit: Pick<SerpResearchHit, 'title' | 'snippet' | 'url' | 'intent' | 'query' | 'page_content' | 'domain' | 'source_type'>,
): boolean {
  const domain = hit.domain || extractResearchDomain(hit.url)
  if (!isTrustedCommercialFitnessRetailerDomain(domain)) return false
  if (!isAmazonLeisureNewEquipmentPage(hit)) return false

  return hasHistoricalRrpSignals(hit)
    || hasHistoricalLifecycleSignals(hit)
    || hasCatalogueOriginalPriceSignals(hit)
}

export function hasCatalogueOriginalPriceSignals(
  hit: Pick<SerpResearchHit, 'title' | 'snippet' | 'url' | 'intent' | 'query' | 'page_content'>,
): boolean {
  const haystack = buildResearchHitHaystack(hit)
  return hasHistoricalRrpSignals(hit)
    || /\b(msrp|new price)\b/i.test(haystack)
    || /£[\d,]+(?:\.\d{2})?/.test(haystack)
}

export function isUsedRefurbDealerDomain(domain: string): boolean {
  const normalized = domain.toLowerCase().replace(/^www\./i, '')
  return USED_REFURB_DEALER_DOMAINS.some((knownDomain) => (
    normalized === knownDomain || normalized.endsWith(`.${knownDomain}`)
  ))
}

export function hasUsedRefurbDealerContext(
  hit: Pick<SerpResearchHit, 'title' | 'snippet' | 'url' | 'intent' | 'query' | 'page_content' | 'domain'>,
): boolean {
  const domain = hit.domain || extractResearchDomain(hit.url)
  const haystack = buildResearchHitHaystack(hit)
  return isUsedRefurbDealerDomain(domain)
    || /\b(used|refurbished|reconditioned|pre[\s-]?owned|second[\s-]?hand)\b/i.test(haystack)
}

export function hasHistoricalRrpSignals(
  hit: Pick<SerpResearchHit, 'title' | 'snippet' | 'url' | 'intent' | 'query' | 'page_content'>,
): boolean {
  const haystack = buildResearchHitHaystack(hit)
  return /\b(rrp|original rrp|recommended retail price|original retail price|list price)\b/i.test(haystack)
}

export function hasHistoricalLifecycleSignals(
  hit: Pick<SerpResearchHit, 'title' | 'snippet' | 'url' | 'intent' | 'query' | 'page_content'>,
): boolean {
  const haystack = buildResearchHitHaystack(hit)
  return /\b(launch year|launched|discontinued|manufacture date|manufactured|production years|model year|available from|specs?|specifications?|history)\b/i.test(haystack)
}

export function isDealerHistoricalReferenceHit(
  hit: Pick<SerpResearchHit, 'title' | 'snippet' | 'url' | 'intent' | 'query' | 'page_content' | 'domain' | 'source_type'>,
): boolean {
  const domain = hit.domain || extractResearchDomain(hit.url)
  return hit.source_type === 'dealer_historical_reference'
    || isTrustedRetailerHistoricalReference(hit)
    || (
      (isUsedRefurbDealerDomain(domain) || hasUsedRefurbDealerContext(hit))
      && (hasHistoricalRrpSignals(hit) || hasHistoricalLifecycleSignals(hit))
    )
}

function parseHistoricalMoneyAmount(value: string): number | null {
  const number = Number(value.replace(/,/g, ''))
  if (!Number.isFinite(number) || number <= 0) return null
  return Math.round(number * 100) / 100
}

function detectHistoricalPriceCurrency(
  symbol: string | undefined,
  haystack: string,
): string | null {
  const normalized = (symbol ?? '').toLowerCase()
  if (normalized.includes('£') || normalized === 'gbp') return 'GBP'
  if (normalized.includes('$') || normalized === 'usd') return 'USD'
  if (normalized.includes('€') || normalized === 'eur') return 'EUR'
  const currencies = detectCurrenciesInHaystack(haystack)
  if (currencies.has('GBP')) return 'GBP'
  if (currencies.has('USD')) return 'USD'
  if (currencies.has('EUR')) return 'EUR'
  return null
}

type PriceCandidatePattern = {
  pattern: RegExp
  evidence_type: PriceCandidateEvidenceType
  extracted_label: string
  score: number
  eligible_for_original_price: boolean
}

const PRICE_CANDIDATE_PATTERNS: PriceCandidatePattern[] = [
  {
    pattern: /\bmsrp\b[^£$€\d]{0,32}(£|gbp|\$|usd|€|eur)?\s*([\d,]+(?:\.\d{2})?)/gi,
    evidence_type: 'manufacturer_msrp',
    extracted_label: 'MSRP',
    score: 10,
    eligible_for_original_price: true,
  },
  {
    pattern: /\b(?:original\s+)?rrp\b[^£$€\d]{0,32}(£|gbp|\$|usd|€|eur)?\s*([\d,]+(?:\.\d{2})?)/gi,
    evidence_type: 'dealer_rrp',
    extracted_label: 'RRP',
    score: 10,
    eligible_for_original_price: true,
  },
  {
    pattern: /\brecommended retail price\b[^£$€\d]{0,32}(£|gbp|\$|usd|€|eur)?\s*([\d,]+(?:\.\d{2})?)/gi,
    evidence_type: 'dealer_recommended_retail_price',
    extracted_label: 'Recommended Retail Price',
    score: 10,
    eligible_for_original_price: true,
  },
  {
    pattern: /\boriginal retail price\b[^£$€\d]{0,32}(£|gbp|\$|usd|€|eur)?\s*([\d,]+(?:\.\d{2})?)/gi,
    evidence_type: 'dealer_original_retail_price',
    extracted_label: 'Original Retail Price',
    score: 10,
    eligible_for_original_price: true,
  },
  {
    pattern: /\blist price\b[^£$€\d]{0,32}(£|gbp|\$|usd|€|eur)?\s*([\d,]+(?:\.\d{2})?)/gi,
    evidence_type: 'dealer_list_price',
    extracted_label: 'List Price',
    score: 9,
    eligible_for_original_price: true,
  },
  {
    pattern: /\bretail price\b[^£$€\d]{0,32}(£|gbp|\$|usd|€|eur)?\s*([\d,]+(?:\.\d{2})?)/gi,
    evidence_type: 'dealer_retail_price',
    extracted_label: 'Retail Price',
    score: 6,
    eligible_for_original_price: true,
  },
  {
    pattern: /\bour price\b[^£$€\d]{0,32}(£|gbp|\$|usd|€|eur)?\s*([\d,]+(?:\.\d{2})?)/gi,
    evidence_type: 'dealer_our_price',
    extracted_label: 'Our Price',
    score: 2,
    eligible_for_original_price: false,
  },
  {
    pattern: /\b(?:now|sale price|current price)\b[^£$€\d]{0,32}(£|gbp|\$|usd|€|eur)?\s*([\d,]+(?:\.\d{2})?)/gi,
    evidence_type: 'dealer_sale_price',
    extracted_label: 'Sale Price',
    score: 0,
    eligible_for_original_price: false,
  },
  {
    pattern: /\bclearance(?:\s+price)?\b[^£$€\d]{0,32}(£|gbp|\$|usd|€|eur)?\s*([\d,]+(?:\.\d{2})?)/gi,
    evidence_type: 'dealer_clearance_price',
    extracted_label: 'Clearance Price',
    score: 0,
    eligible_for_original_price: false,
  },
  {
    pattern: /\bfinance(?:\s+from)?\b[^£$€\d]{0,32}(£|gbp|\$|usd|€|eur)?\s*([\d,]+(?:\.\d{2})?)/gi,
    evidence_type: 'dealer_finance_price',
    extracted_label: 'Finance Price',
    score: 0,
    eligible_for_original_price: false,
  },
  {
    pattern: /\b(?:used|refurbished|reconditioned)\b[^£$€\d]{0,48}(£|gbp|\$|usd|€|eur)?\s*([\d,]+(?:\.\d{2})?)/gi,
    evidence_type: 'dealer_refurbished_price',
    extracted_label: 'Refurbished Price',
    score: 0,
    eligible_for_original_price: false,
  },
]

export function extractPriceCandidates(
  hit: Pick<SerpResearchHit, 'title' | 'snippet' | 'url' | 'intent' | 'query' | 'page_content'>,
): ResearchPriceCandidate[] {
  const haystack = buildResearchHitHaystack(hit)
  const candidates: ResearchPriceCandidate[] = []
  const seen = new Set<string>()

  for (const entry of PRICE_CANDIDATE_PATTERNS) {
    for (const match of haystack.matchAll(entry.pattern)) {
      const parsed = parseHistoricalMoneyAmount(match[2])
      if (parsed == null) continue

      const currency = detectHistoricalPriceCurrency(match[1], haystack)
      const key = `${entry.evidence_type}:${parsed}:${currency ?? 'unknown'}`
      if (seen.has(key)) continue
      seen.add(key)

      candidates.push({
        evidence_type: entry.evidence_type,
        extracted_label: entry.extracted_label,
        extracted_price: parsed,
        currency,
        score: entry.score,
        eligible_for_original_price: entry.eligible_for_original_price,
      })
    }
  }

  return candidates.sort((left, right) => right.score - left.score)
}

export function extractHistoricalPriceEvidence(
  hit: Pick<SerpResearchHit, 'title' | 'snippet' | 'url' | 'intent' | 'query' | 'page_content'>,
): {
  rrp_price: number | null
  used_prices: number[]
  currency: string | null
} {
  const candidates = extractPriceCandidates(hit)
  const eligible = candidates.filter((candidate) => candidate.eligible_for_original_price)
  const bestEligible = eligible[0] ?? null
  const used_prices = candidates
    .filter((candidate) => !candidate.eligible_for_original_price)
    .map((candidate) => candidate.extracted_price)

  return {
    rrp_price: bestEligible?.extracted_price ?? null,
    used_prices: [...new Set(used_prices)],
    currency: bestEligible?.currency ?? null,
  }
}

export function enrichResearchHitHistoricalEvidence(hit: SerpResearchHit): SerpResearchHit {
  const domain = hit.domain || extractResearchDomain(hit.url)
  const priceEvidence = extractHistoricalPriceEvidence(hit)
  let source_type = hit.source_type

  if (isDealerHistoricalReferenceHit({ ...hit, domain, source_type })) {
    source_type = 'dealer_historical_reference'
  }

  let price_evidence_kind: ResearchPriceEvidenceKind = hit.price_evidence_kind ?? null
  let lifecycle_evidence_kind: ResearchLifecycleEvidenceKind = hit.lifecycle_evidence_kind ?? null

  if (priceEvidence.rrp_price != null) {
    price_evidence_kind = 'rrp_evidence'
  } else if (hasUsedRefurbDealerContext({ ...hit, domain }) && priceEvidence.used_prices.length > 0) {
    price_evidence_kind = 'used_price_only'
  }

  if (hasHistoricalLifecycleSignals(hit)) {
    lifecycle_evidence_kind = 'lifecycle_evidence'
  }

  return {
    ...hit,
    domain,
    source_type,
    source_rank: getResearchSourceRank(source_type),
    historical_rrp_price: priceEvidence.rrp_price,
    historical_rrp_currency: priceEvidence.currency,
    ignored_used_prices: priceEvidence.used_prices,
    price_evidence_kind,
    lifecycle_evidence_kind,
    source_fetch_status: hit.source_fetch_status ?? hit.page_read_status,
  }
}

export function isMarketplaceResalePriceSource(
  hit: Pick<SerpResearchHit, 'title' | 'snippet' | 'url' | 'intent' | 'query' | 'page_content' | 'domain'>,
): boolean {
  const domain = hit.domain || extractResearchDomain(hit.url)
  return isMarketplaceResaleDomain(domain, hit.url)
}

export function classifyResearchSourceType(
  hit: Pick<SerpResearchHit, 'url' | 'title' | 'snippet' | 'intent' | 'domain' | 'query' | 'page_content'>,
  brand: string,
): ResearchSourceType {
  const domain = hit.domain || extractResearchDomain(hit.url)

  if (isMarketplaceResaleDomain(domain, hit.url)) {
    return 'marketplace_resale'
  }

  if (isTrustedRetailerHistoricalReference({ ...hit, domain, source_type: 'other' })) {
    return 'dealer_historical_reference'
  }

  if (isDealerHistoricalReferenceHit({ ...hit, domain, source_type: 'other' })) {
    return 'dealer_historical_reference'
  }

  const haystack = `${hit.title} ${hit.snippet} ${hit.url} ${hit.intent}`.toLowerCase()
  const onBrandDomain = domainContainsBrand(domain, brand)

  if (isArchiveDomain(domain)) {
    return 'archived_website'
  }

  if (isPdfUrl(hit.url)) {
    return onBrandDomain ? 'manufacturer_pdf' : 'dealer_catalogue'
  }

  if (onBrandDomain) {
    return 'manufacturer_website'
  }

  if (/\b(distributor|authorised distributor|authorized distributor)\b/i.test(haystack)) {
    return 'official_distributor'
  }

  if (/\b(dealer|catalogue|catalog|price list|brochure)\b/i.test(haystack)) {
    return 'dealer_catalogue'
  }

  if (/\barchive\b/i.test(haystack)) {
    return 'archived_website'
  }

  return 'other'
}

export function classifyLifecycleResearchSourceType(
  hit: Pick<SerpResearchHit, 'url' | 'title' | 'snippet' | 'intent' | 'domain' | 'query' | 'page_content'>,
  brand: string,
): ResearchSourceType {
  const domain = hit.domain || extractResearchDomain(hit.url)

  if (isArchiveDomain(domain)) {
    return 'archived_website'
  }

  if (isDealerHistoricalReferenceHit({ ...hit, domain, source_type: 'other' })
    && hasHistoricalLifecycleSignals(hit)) {
    return 'dealer_historical_reference'
  }

  const haystack = `${hit.title} ${hit.snippet} ${hit.url} ${hit.intent} ${hit.query}`.toLowerCase()
  const onBrandDomain = domainContainsBrand(domain, brand)

  if (isSpecialistSupportDomain(domain) || (
    hasSpecialistSupportSignals(haystack, hit.url)
    && !isLifecyclePricingNoise(haystack)
  )) {
    return 'specialist_support'
  }

  if (isPdfUrl(hit.url)) {
    if (onBrandDomain) return 'manufacturer_pdf'
    if (/\bparts?\b|\bcompatibility\b|\bsupport\b/i.test(haystack)) return 'specialist_support'
    return 'dealer_catalogue'
  }

  if (onBrandDomain) {
    if (/\b(support|manual|parts?|compatibility|service)\b/i.test(haystack)
      || /\/(support|manual|parts|service)\//i.test(hit.url)) {
      return 'manufacturer_website'
    }
    return 'manufacturer_website'
  }

  if (/\b(distributor|authorised distributor|authorized distributor)\b/i.test(haystack)) {
    return 'official_distributor'
  }

  if (/\barchive\b/i.test(haystack)) {
    return 'archived_website'
  }

  if (isForumOrBlogDomain(domain)) {
    return 'other'
  }

  if (/\b(dealer|catalogue|catalog|price list|brochure)\b/i.test(haystack)
    || isLifecyclePricingNoise(haystack)) {
    return 'dealer_catalogue'
  }

  if (/\bparts? catalogue\b|\bcompatibility guide\b|\bsupport guide\b/i.test(haystack)) {
    return 'specialist_support'
  }

  return 'other'
}

export function getLifecycleSourceRank(sourceType: ResearchSourceType): number {
  return LIFECYCLE_SOURCE_TYPE_RANK[sourceType]
}

export function getLifecycleAuthorityScore(sourceType: ResearchSourceType): number {
  return LIFECYCLE_AUTHORITY_SCORES[sourceType]
}

export function getResearchSourceRank(sourceType: ResearchSourceType): number {
  return SOURCE_TYPE_RANK[sourceType]
}

export function getResearchAuthorityScore(
  sourceType: ResearchSourceType,
  hit?: Pick<SerpResearchHit, 'title' | 'snippet' | 'url' | 'intent' | 'query' | 'page_content' | 'domain' | 'source_type'>,
): number {
  let score = SOURCE_AUTHORITY_SCORES[sourceType]
  if (!hit) return score

  const domain = hit.domain || extractResearchDomain(hit.url)
  if (isTrustedCommercialFitnessRetailerDomain(domain)
    && (hasHistoricalRrpSignals(hit) || hasCatalogueOriginalPriceSignals(hit))) {
    score = Math.max(score, 11)
  }

  if (isOfficialManufacturerPriceSource(sourceType) && hasOriginalPriceEvidenceSignals(hit)) {
    score = Math.max(score, 10)
  }

  if (sourceType === 'manufacturer_pdf' && !hasOriginalPriceEvidenceSignals(hit)) {
    score = Math.min(score, 2)
  }

  if (sourceType === 'dealer_catalogue'
    && !isTrustedCommercialFitnessRetailerDomain(domain)
    && isDealerSalePriceOnly({ ...hit, source_type: sourceType })) {
    score = Math.min(score, 2)
  }

  return score
}

export function scorePriceSourceHierarchy(
  hit: Pick<SerpResearchHit, 'title' | 'snippet' | 'url' | 'intent' | 'query' | 'page_content' | 'domain' | 'source_type'>,
  sourceType: ResearchSourceType,
): number {
  const domain = hit.domain || extractResearchDomain(hit.url)
  const hasExplicitRrp = hasHistoricalRrpSignals(hit) || hasCatalogueOriginalPriceSignals(hit)

  if (isTrustedCommercialFitnessRetailerDomain(domain)
    && hasExplicitRrp
    && hasOriginalPriceEvidenceSignals(hit)) {
    return 14
  }

  if (isOfficialManufacturerPriceSource(sourceType) && hasOriginalPriceEvidenceSignals(hit)) {
    return 12
  }

  if ((sourceType === 'dealer_historical_reference' || isDealerHistoricalReferenceHit(hit))
    && isTrustedCommercialFitnessRetailerDomain(domain)
    && hasHistoricalRrpSignals(hit)) {
    return 11
  }

  if (sourceType === 'manufacturer_pdf' || sourceType === 'official_distributor') {
    const haystack = buildResearchHitHaystack(hit)
    if (/\bmaintenance\b|\bpreventive\b|\bservice manual\b|\boperation(?:al)? manual\b/i.test(haystack)) {
      return 0
    }
    if (hasOriginalPriceEvidenceSignals(hit)) {
      return 8
    }
    if (sourceType === 'manufacturer_pdf') {
      return 1
    }
  }

  if (sourceType === 'dealer_catalogue'
    && /\bbrochure\b|\bcatalog(?:ue)?\b/i.test(buildResearchHitHaystack(hit))
    && hasOriginalPriceEvidenceSignals(hit)) {
    return 8
  }

  if ((sourceType === 'dealer_catalogue' || sourceType === 'dealer_historical_reference')
    && hasOriginalPriceEvidenceSignals(hit)
    && !isDealerSalePriceOnly({ ...hit, source_type: sourceType })) {
    return 6
  }

  if (sourceType === 'manufacturer_website' && hasHistoricalLifecycleSignals(hit)) {
    return 5
  }

  if (sourceType === 'specialist_support') {
    return 4
  }

  if (sourceType === 'dealer_catalogue' || sourceType === 'dealer_historical_reference') {
    return isDealerSalePriceOnly({ ...hit, source_type: sourceType }) ? -8 : 0
  }

  return 0
}

function buildResearchHitHaystack(
  hit: Pick<SerpResearchHit, 'title' | 'snippet' | 'url' | 'intent' | 'query' | 'page_content'>,
): string {
  const parts = [hit.title, hit.snippet, hit.url, hit.intent, hit.query]
  if (hit.page_content) parts.push(hit.page_content)
  return parts.join(' ').toLowerCase()
}

export function scorePriceRelevance(
  hit: Pick<SerpResearchHit, 'title' | 'snippet' | 'url' | 'intent' | 'query' | 'page_content' | 'domain' | 'source_type'>,
  sourceType?: ResearchSourceType,
): number {
  const haystack = buildResearchHitHaystack(hit)
  const resolvedSourceType = sourceType ?? hit.source_type ?? 'other'
  let score = 0

  if (/\bdealer\b/.test(haystack)) score += 3
  if (/\bcatalog(?:ue)?\b/.test(haystack)) score += 3
  if (
    /\bproduct page\b/.test(haystack)
    || /\/products?\//.test(haystack)
    || /commercial-/.test(haystack)
  ) score += 3
  if (/\bmsrp\b/.test(haystack)) score += 4
  if (/\brrp\b/.test(haystack)) score += 4
  if (/\boriginal price\b/.test(haystack)) score += 4
  if (/\bnew price\b/.test(haystack)) score += 4
  if (/\blist price\b/.test(haystack)) score += 3
  if (/\bproduct brochure\b/.test(haystack)) score += 3
  if (/\bretail\b/.test(haystack)) score += 3
  if (/\bbuy\b/.test(haystack)) score += 2
  if (/\bpricing\b/.test(haystack) || /\bprice\b/.test(haystack)) score += 2

  const domain = hit.domain || extractResearchDomain(hit.url)
  if (isTrustedCommercialFitnessRetailerDomain(domain) && hasCatalogueOriginalPriceSignals(hit)) {
    score += 8
  } else if (isUkDealerCatalogueDomain(domain) && hasCatalogueOriginalPriceSignals(hit)) {
    score += 6
  }

  if (hit.intent === 'dealer') score += 2
  if (hit.intent === 'msrp') score += 4
  if (hit.intent === 'brochure') score += 2

  if (/\bmaintenance\b/.test(haystack)) score -= 4
  if (/\bpreventive\b/.test(haystack)) score -= 4
  if (/\bservice manual\b/.test(haystack)) score -= 4
  if (/\boperation(?:al)? manual\b/.test(haystack)) score -= 4
  if (/\brepair\b/.test(haystack)) score -= 3
  if (/\bparts?\b/.test(haystack)) score -= 3
  if (/\bbelt\b/.test(haystack)) score -= 2
  if (/\bexploded view\b/.test(haystack)) score -= 4

  if (resolvedSourceType === 'dealer_historical_reference' && hasHistoricalRrpSignals(hit)) {
    score += 6
  }

  const eligibleCandidates = extractPriceCandidates(hit).filter((candidate) => candidate.eligible_for_original_price)
  if (eligibleCandidates.length > 0) {
    score += Math.min(5, eligibleCandidates[0].score / 2)
  }

  if (resolvedSourceType === 'dealer_catalogue'
    && !isTrustedCommercialFitnessRetailerDomain(domain)
    && isDealerSalePriceOnly({ ...hit, source_type: resolvedSourceType })) {
    score -= 8
  }

  score += scoreOfficialPriceSourceBias({ ...hit, source_type: resolvedSourceType }, resolvedSourceType)
  score += scoreUkPriceSourceBias(hit, resolvedSourceType)

  return Math.max(PRICE_RELEVANCE_MIN, Math.min(PRICE_RELEVANCE_MAX, score))
}

const RESALE_PRICE_REJECT_PATTERNS = [
  /\bused\b/i,
  /\brefurbished\b/i,
  /\breconditioned\b/i,
  /\bserviced\b/i,
  /\bpre[\s-]?owned\b/i,
  /\bsecond[\s-]?hand\b/i,
  /\bresale\b/i,
  /\bauction\b/i,
  /\bclearance\b/i,
  /\bex[\s-]?display\b/i,
  /\bcosmetic damage\b/i,
  /\bareas of rust\b/i,
  /\bcurrent price\b/i,
  /\bused equipment\b/i,
] as const

function isSalePriceOnlyContext(haystack: string): boolean {
  const hasSaleSignal = /\bsale price\b/i.test(haystack)
  const hasOriginalSignal = /\blist price\b|\brrp\b|\bmsrp\b|\boriginal price\b|\bnew price\b/i.test(haystack)
  return hasSaleSignal && !hasOriginalSignal
}

export function isResalePricingSource(
  hit: Pick<SerpResearchHit, 'title' | 'snippet' | 'url' | 'intent' | 'query' | 'page_content' | 'domain' | 'source_type'>,
): boolean {
  if (hasHistoricalRrpSignals(hit)) {
    return false
  }

  const haystack = buildResearchHitHaystack(hit)
  if (RESALE_PRICE_REJECT_PATTERNS.some((pattern) => pattern.test(haystack))) {
    return true
  }
  return isSalePriceOnlyContext(haystack)
}

export function isUsedPriceOnlyResearchSource(
  hit: Pick<SerpResearchHit, 'title' | 'snippet' | 'url' | 'intent' | 'query' | 'page_content' | 'domain' | 'source_type' | 'price_evidence_kind'>,
): boolean {
  if (hit.price_evidence_kind === 'used_price_only') return true
  if (hit.price_evidence_kind === 'rrp_evidence') return false
  if (hasHistoricalRrpSignals(hit)) return false
  return hasUsedRefurbDealerContext(hit) && isResalePricingSource(hit)
}

export function filterOriginalPriceResearchHits(hits: SerpResearchHit[]): SerpResearchHit[] {
  return hits
    .map((hit) => enrichResearchHitHistoricalEvidence(hit))
    .filter((hit) => {
      if (isMarketplaceResalePriceSource(hit) || hit.source_type === 'marketplace_resale') {
        return false
      }
      if (hit.source_type === 'dealer_historical_reference') {
        return hit.price_evidence_kind === 'rrp_evidence' || hasHistoricalRrpSignals(hit)
      }
      return !isUsedPriceOnlyResearchSource(hit) && !isResalePricingSource(hit)
    })
}

export function buildPriceSourceClassificationDebug(
  hits: SerpResearchHit[],
  brand: string,
): {
  price_source_classification: PriceSourceClassificationEntry[]
  excluded_marketplace_price_sources: PriceSourceClassificationEntry[]
} {
  const price_source_classification = hits.map((hit) => {
    const enriched = enrichResearchHitHistoricalEvidence(hit)
    const domain = enriched.domain || extractResearchDomain(enriched.url)
    const source_type = enriched.source_type
      ?? classifyResearchSourceType({ ...enriched, domain }, brand)
    const isMarketplace = source_type === 'marketplace_resale' || isMarketplaceResalePriceSource(enriched)
    const isUsedPriceOnly = isUsedPriceOnlyResearchSource(enriched)
    const isResale = !isUsedPriceOnly && isResalePricingSource(enriched)
    const excluded_from_original_price = isMarketplace
      || isUsedPriceOnly
      || (isResale && source_type !== 'dealer_historical_reference')
    let exclusion_reason: PriceSourceClassificationEntry['exclusion_reason'] = null
    if (isMarketplace) exclusion_reason = 'marketplace_resale'
    else if (isUsedPriceOnly) exclusion_reason = 'used_price_only'
    else if (isResale) exclusion_reason = 'resale_pricing_context'

    return {
      title: enriched.title,
      url: enriched.url,
      domain,
      source_type,
      excluded_from_original_price,
      exclusion_reason,
      price_evidence_kind: enriched.price_evidence_kind ?? null,
      lifecycle_evidence_kind: enriched.lifecycle_evidence_kind ?? null,
      source_fetch_status: enriched.source_fetch_status ?? enriched.page_read_status,
    }
  })

  const excluded_marketplace_price_sources = price_source_classification.filter(
    (entry) => entry.exclusion_reason === 'marketplace_resale',
  )

  return { price_source_classification, excluded_marketplace_price_sources }
}

export function buildPriceCandidateDebug(
  hits: SerpResearchHit[],
  brand: string,
): PriceCandidateDebugEntry[] {
  const debugEntries: PriceCandidateDebugEntry[] = []

  for (const hit of hits) {
    const domain = hit.domain || extractResearchDomain(hit.url)
    const enriched = enrichResearchHitHistoricalEvidence({ ...hit, domain })
    const source_type = enriched.source_type
      ?? classifyResearchSourceType({ ...enriched, domain }, brand)
    const candidates = extractPriceCandidates(enriched)
    const isExcluded = isMarketplaceResalePriceSource(enriched)
      || isUsedPriceOnlyResearchSource(enriched)
      || (isResalePricingSource(enriched) && source_type !== 'dealer_historical_reference')

    if (candidates.length === 0) {
      debugEntries.push({
        domain,
        source_type,
        evidence_type: 'dealer_sale_price',
        extracted_label: 'No price candidates',
        extracted_price: 0,
        currency: null,
        score: 0,
        eligible_for_original_price: false,
        selected: false,
        rejection_reason: isExcluded ? 'source_excluded_from_original_price' : 'no_price_candidates_found',
        url: enriched.url,
      })
      continue
    }

    const eligibleCandidates = candidates.filter((candidate) => candidate.eligible_for_original_price)
    const selectedCandidate = !isExcluded && eligibleCandidates.length > 0
      ? eligibleCandidates[0]
      : null

    for (const candidate of candidates) {
      let rejection_reason: string | null = null
      if (isExcluded) {
        rejection_reason = 'source_excluded_from_original_price'
      } else if (!candidate.eligible_for_original_price) {
        rejection_reason = 'ineligible_sale_or_used_price_label'
      } else if (selectedCandidate !== candidate) {
        rejection_reason = 'lower_priority_than_selected_candidate'
      }

      debugEntries.push({
        domain,
        source_type,
        evidence_type: candidate.evidence_type,
        extracted_label: candidate.extracted_label,
        extracted_price: candidate.extracted_price,
        currency: candidate.currency,
        score: candidate.score,
        eligible_for_original_price: candidate.eligible_for_original_price,
        selected: selectedCandidate === candidate,
        rejection_reason,
        url: enriched.url,
      })
    }
  }

  return debugEntries
}

function recommendationUsesMarketplacePriceSources(
  recommendation: Pick<EquipmentResearchRecommendation, 'price_sources_used' | 'supporting_urls'>,
): boolean {
  const urls = [
    ...(recommendation.price_sources_used ?? []),
    ...(recommendation.supporting_urls ?? []),
  ]
  return urls.some((url) => isMarketplaceResaleDomain(extractResearchDomain(url), url))
}

export function scoreProductionRelevance(
  hit: Pick<SerpResearchHit, 'title' | 'snippet' | 'url' | 'intent' | 'query' | 'page_content' | 'domain'>,
): number {
  const haystack = buildResearchHitHaystack(hit)
  let score = 0

  if (/\bproduction years\b/.test(haystack)) score += 4
  if (/\bmanufactured\b/.test(haystack)) score += 4
  if (/\bdiscontinued\b/.test(haystack)) score += 4
  if (/\bproduction\b/.test(haystack)) score += 3
  if (/\blaunched\b/.test(haystack)) score += 3
  if (/\breleased\b/.test(haystack)) score += 3
  if (/\bintroduced\b/.test(haystack)) score += 3
  if (/\bmodel year\b/.test(haystack)) score += 3
  if (/\bavailable from\b/.test(haystack)) score += 3
  if (/\blaunch year\b/.test(haystack)) score += 3
  if (/\brelease date\b/.test(haystack)) score += 3
  if (/\btimeline\b/.test(haystack)) score += 4
  if (/\bhistory\b/.test(haystack)) score += 3
  if (/\blegacy\b/.test(haystack)) score += 3
  if (/\bgeneration\b/.test(haystack)) score += 3
  if (/\bcompatibility\b/.test(haystack)) score += 3
  if (/\bserial number\b/.test(haystack)) score += 3
  if (/\bsupport guide\b/.test(haystack)) score += 4
  if (/\bmodel guide\b/.test(haystack)) score += 4
  if (/\breplacement model\b/.test(haystack)) score += 4
  if (/\bsuperseded by\b/.test(haystack)) score += 4
  if (/\bservice manual\b/.test(haystack)) score += 4
  if (/\boperation(?:al)? manual\b/.test(haystack)) score += 4
  if (/\bparts? catalogue\b/.test(haystack)) score += 3
  if (/\bpublication date\b/.test(haystack)) score += 2
  if (/\bmanual\b/.test(haystack)) score += 3
  if (/\bbrochure\b/.test(haystack)) score += 2
  if (/\bcatalog(?:ue)?\b/.test(haystack)) score += 2
  if (/\barchive\b/.test(haystack) || /web\.archive\.org/.test(haystack)) score += 3

  if (hit.intent === 'production_years') score += 3
  if (hit.intent === 'manufactured') score += 3
  if (hit.intent === 'discontinued') score += 3
  if (hit.intent === 'launch_year') score += 3
  if (hit.intent === 'service_manual') score += 3
  if (hit.intent === 'model_history') score += 4
  if (hit.intent === 'timeline') score += 4
  if (hit.intent === 'product_history') score += 3
  if (hit.intent === 'legacy') score += 3
  if (hit.intent === 'support') score += 3
  if (hit.intent === 'parts') score += 2
  if (hit.intent === 'compatibility') score += 3
  if (hit.intent === 'serial_number') score += 3
  if (hit.intent === 'brochure') score += 2
  if (hit.intent === 'pdf' && /\bmanual\b/.test(haystack)) score += 2

  if (hasHistoricalLifecycleSignals(hit) && hasUsedRefurbDealerContext(hit)) score += 3

  if (/\bbuy\b/.test(haystack)) score -= 3
  if (/\bsale\b/.test(haystack)) score -= 3
  if (/\bour price\b/.test(haystack)) score -= 4
  if (/\bclearance\b/.test(haystack)) score -= 4
  if (/\bfinance\b/.test(haystack)) score -= 3
  if (/\bdelivery\b/.test(haystack)) score -= 2
  if (/\blist price\b/.test(haystack)) score -= 2
  if (/\bprice\b/.test(haystack)) score -= 2

  return Math.max(-6, Math.min(PRODUCTION_RELEVANCE_MAX, score))
}

export function scoreResearchHitCombinedRank(
  hit: Pick<SerpResearchHit, 'title' | 'snippet' | 'url' | 'intent' | 'query' | 'page_content' | 'domain' | 'source_type'>,
  sourceType: ResearchSourceType,
): {
  authority_score: number
  price_relevance_score: number
  production_relevance_score: number
  combined_rank_score: number
} {
  const authority_score = getResearchAuthorityScore(sourceType, hit)
  const price_relevance_score = scorePriceRelevance(hit, sourceType)
  const production_relevance_score = scoreProductionRelevance(hit)
  const hierarchy_score = scorePriceSourceHierarchy(hit, sourceType)

  return {
    authority_score,
    price_relevance_score,
    production_relevance_score,
    combined_rank_score: authority_score + price_relevance_score + production_relevance_score + hierarchy_score,
  }
}

export function dedupeSerpResearchHits(hits: SerpResearchHit[]): SerpResearchHit[] {
  const seen = new Set<string>()
  const deduped: SerpResearchHit[] = []

  for (const hit of hits) {
    const key = hit.url.trim().toLowerCase()
    if (!key || seen.has(key)) continue
    seen.add(key)
    deduped.push(hit)
  }

  return deduped
}

export function rankResearchHits(
  hits: SerpResearchHit[],
  brand: string,
): SerpResearchHit[] {
  return [...hits]
    .map((hit) => {
      const domain = hit.domain || extractResearchDomain(hit.url)
      const enriched = enrichResearchHitHistoricalEvidence({ ...hit, domain })
      let source_type = classifyResearchSourceType({ ...enriched, domain }, brand)
      if (enriched.source_type === 'dealer_historical_reference'
        || enriched.source_type === 'marketplace_resale') {
        source_type = enriched.source_type
      }
      const relevance = scoreResearchHitCombinedRank({ ...enriched, source_type }, source_type)

      return {
        ...enriched,
        source_type,
        source_rank: getResearchSourceRank(source_type),
        authority_score: relevance.authority_score,
        price_relevance_score: relevance.price_relevance_score,
        production_relevance_score: relevance.production_relevance_score,
        combined_rank_score: relevance.combined_rank_score,
      }
    })
    .sort((left, right) => {
      const leftCombined = left.combined_rank_score ?? 0
      const rightCombined = right.combined_rank_score ?? 0
      if (leftCombined !== rightCombined) {
        return rightCombined - leftCombined
      }
      if (left.position !== right.position) {
        return left.position - right.position
      }
      return left.title.localeCompare(right.title)
    })
}

export function rankLifecycleResearchHits(
  hits: SerpResearchHit[],
  brand: string,
): SerpResearchHit[] {
  return [...hits]
    .map((hit) => {
      const domain = hit.domain || extractResearchDomain(hit.url)
      const source_type = classifyLifecycleResearchSourceType({ ...hit, domain }, brand)
      const authority_score = getLifecycleAuthorityScore(source_type)
      const production_relevance_score = scoreProductionRelevance(hit)
      const combined_rank_score = authority_score + production_relevance_score

      return {
        ...hit,
        domain,
        source_type,
        source_rank: getLifecycleSourceRank(source_type),
        authority_score,
        price_relevance_score: scorePriceRelevance(hit, source_type),
        production_relevance_score,
        combined_rank_score,
      }
    })
    .map((hit) => enrichResearchHitHistoricalEvidence(hit))
    .sort((left, right) => {
      const leftCombined = left.combined_rank_score ?? 0
      const rightCombined = right.combined_rank_score ?? 0
      if (leftCombined !== rightCombined) {
        return rightCombined - leftCombined
      }
      if (left.position !== right.position) {
        return left.position - right.position
      }
      return left.title.localeCompare(right.title)
    })
}

export function selectDiverseResearchHitsForAi(
  hits: SerpResearchHit[],
  maxSources = RESEARCH_STAGE1_AI_SOURCES,
): SerpResearchHit[] {
  const seenDomains = new Set<string>()
  const selected: SerpResearchHit[] = []

  for (const hit of hits) {
    const domain = (hit.domain || extractResearchDomain(hit.url)).toLowerCase()
    const domainKey = domain || hit.url.trim().toLowerCase()
    if (!domainKey || seenDomains.has(domainKey)) continue

    seenDomains.add(domainKey)
    selected.push(hit)
    if (selected.length >= maxSources) break
  }

  return selected
}

export function selectOriginalPriceResearchHitsForAi(
  hits: SerpResearchHit[],
  maxSources = RESEARCH_STAGE1_AI_SOURCES,
): SerpResearchHit[] {
  return selectDiverseResearchHitsForAi(filterOriginalPriceResearchHits(hits), maxSources)
}

export function selectLifecycleResearchHitsForAi(
  hits: SerpResearchHit[],
  maxSources = RESEARCH_STAGE1_LIFECYCLE_AI_SOURCES,
): SerpResearchHit[] {
  return selectDiverseResearchHitsForAi(hits, maxSources)
}

export function normalizeResearchEvidenceInput(
  evidence: SerpResearchHit[] | ResearchEvidenceInput,
): ResearchEvidenceInput {
  if (Array.isArray(evidence)) {
    return { priceHits: evidence, lifecycleHits: [] }
  }
  return evidence
}

export function mergeEnrichmentIntoResearchHits(
  hits: SerpResearchHit[],
  enrichedHits: SerpResearchHit[],
): SerpResearchHit[] {
  const enrichedByUrl = new Map(
    enrichedHits.map((hit) => [hit.url.trim().toLowerCase(), hit]),
  )

  return hits.map((hit) => enrichedByUrl.get(hit.url.trim().toLowerCase()) ?? hit)
}

export function selectStage2EnrichmentTargets(
  priceHits: SerpResearchHit[],
  lifecycleHits: SerpResearchHit[],
  maxPageReads = RESEARCH_STAGE2_PAGE_READS,
): SerpResearchHit[] {
  const selected: SerpResearchHit[] = []
  const seenUrls = new Set<string>()

  for (const hit of [
    ...priceHits.slice(0, 2),
    ...lifecycleHits.slice(0, Math.max(1, maxPageReads - 2)),
  ]) {
    const urlKey = hit.url.trim().toLowerCase()
    if (!urlKey || seenUrls.has(urlKey)) continue
    seenUrls.add(urlKey)
    selected.push(hit)
    if (selected.length >= maxPageReads) break
  }

  return selected
}

export function hitsToResearchSupportingSources(
  hits: SerpResearchHit[],
): ResearchSupportingSource[] {
  return hits.map((hit) => {
    const enriched = enrichResearchHitHistoricalEvidence(hit)
    return {
      title: enriched.title,
      domain: enriched.domain || extractResearchDomain(enriched.url),
      url: enriched.url,
      source_type: enriched.source_type,
      price_evidence_kind: enriched.price_evidence_kind ?? undefined,
      lifecycle_evidence_kind: enriched.lifecycle_evidence_kind ?? undefined,
      source_fetch_status: enriched.source_fetch_status ?? enriched.page_read_status,
      historical_rrp_price: enriched.historical_rrp_price ?? undefined,
      ignored_used_prices: enriched.ignored_used_prices,
    }
  })
}

export function formatResearchHitEvidenceSummary(
  source: Pick<
    ResearchSupportingSource,
    'price_evidence_kind' | 'lifecycle_evidence_kind' | 'source_fetch_status' | 'historical_rrp_price' | 'ignored_used_prices'
  >,
): string {
  const parts: string[] = []

  if (source.price_evidence_kind === 'rrp_evidence') {
    parts.push(source.historical_rrp_price != null
      ? `RRP evidence (£${source.historical_rrp_price.toLocaleString('en-GB')})`
      : 'RRP evidence')
    if (source.ignored_used_prices?.length) {
      parts.push('Used price ignored')
    }
  } else if (source.price_evidence_kind === 'used_price_only') {
    parts.push('Used price ignored')
  }

  if (source.lifecycle_evidence_kind === 'lifecycle_evidence') {
    parts.push('Lifecycle evidence')
  }

  if (source.source_fetch_status === 'failed') {
    parts.push('Fetch failed')
  } else if (source.source_fetch_status === 'snippet_only') {
    parts.push('Snippet only')
  }

  return parts.length > 0 ? parts.join(' · ') : '—'
}

export function buildOpenAiRequestPayload(
  equipment: EquipmentIntelligenceRow,
  evidence: SerpResearchHit[] | ResearchEvidenceInput,
  stage: ResearchEnrichmentStage,
): OpenAiResearchRequestPayload {
  const input = normalizeResearchEvidenceInput(evidence)
  const equipmentLabel = [
    equipment.brand,
    equipment.series,
    equipment.model,
    equipment.equipment_type,
  ]
    .filter(Boolean)
    .join(' ')

  const mapSources = (hits: SerpResearchHit[]) => hits.map((hit) => ({
    title: hit.title,
    snippet: hit.snippet || '',
    url: hit.url,
    source_type: hit.source_type,
    domain: hit.domain || extractResearchDomain(hit.url),
  }))

  const price_sources = mapSources(input.priceHits)
  const lifecycle_sources = mapSources(input.lifecycleHits)

  return {
    stage,
    equipment_label: equipmentLabel,
    source_count: price_sources.length + lifecycle_sources.length,
    price_source_count: price_sources.length,
    lifecycle_source_count: lifecycle_sources.length,
    price_sources,
    lifecycle_sources,
    sources: [...price_sources, ...lifecycle_sources],
  }
}

function formatResearchHitForPrompt(
  hit: SerpResearchHit,
  index: number,
  stage: ResearchEnrichmentStage,
): string {
  const enriched = enrichResearchHitHistoricalEvidence(hit)
  const lines = [
    `${index + 1}. [${enriched.source_type}] ${enriched.title}`,
    `URL: ${enriched.url}`,
    `Snippet: ${enriched.snippet || '—'}`,
  ]

  if (enriched.price_evidence_kind === 'rrp_evidence' && enriched.historical_rrp_price != null) {
    lines.push(
      `RRP evidence: ${enriched.historical_rrp_currency ?? 'GBP'} ${enriched.historical_rrp_price}`,
    )
    if (enriched.ignored_used_prices?.length) {
      lines.push(
        `Used/refurbished prices ignored for original new price: ${enriched.ignored_used_prices.join(', ')}`,
      )
    }
  } else if (enriched.price_evidence_kind === 'used_price_only') {
    lines.push('Used/refurbished price only — do not use for original new price.')
  }

  if (enriched.lifecycle_evidence_kind === 'lifecycle_evidence') {
    lines.push('Lifecycle evidence: launch/discontinued/manufacture/spec details may be present.')
  }

  const fetchStatus = enriched.source_fetch_status ?? enriched.page_read_status
  if (fetchStatus === 'failed') {
    lines.push('Fetch failed — using snippet-only evidence.')
  } else if (fetchStatus === 'snippet_only') {
    lines.push('Evidence source fetch status: snippet only.')
  }

  if (stage === 'enriched' && enriched.page_content) {
    lines.push(`Page content: ${enriched.page_content}`)
    lines.push(`Read status: ${enriched.page_read_status}`)
  }

  return lines.join('\n')
}

export function formatOpenAiTimeoutError(timeoutMs: number): string {
  return `OpenAI timed out after ${timeoutMs / 1000}s — retry this model.`
}

export function estimateEquipmentResearchOpenAiPromptChars(
  equipment: EquipmentIntelligenceRow,
  evidence: SerpResearchHit[] | ResearchEvidenceInput,
  stage: ResearchEnrichmentStage = 'snippet',
): number {
  return EQUIPMENT_RESEARCH_SYSTEM_PROMPT.length
    + buildAiResearchPrompt(equipment, evidence, stage).length
}

export function trimLifecycleHitsForOpenAiPrompt(
  equipment: EquipmentIntelligenceRow,
  evidence: ResearchEvidenceInput,
  stage: ResearchEnrichmentStage = 'snippet',
  maxChars: number = OPENAI_PROMPT_TRIM_CHAR_THRESHOLD,
): { input: ResearchEvidenceInput; trimmed_lifecycle_sources: number } {
  let lifecycleHits = [...evidence.lifecycleHits]
  let trimmed_lifecycle_sources = 0

  while (
    lifecycleHits.length > 0
    && estimateEquipmentResearchOpenAiPromptChars(
      equipment,
      { priceHits: evidence.priceHits, lifecycleHits },
      stage,
    ) > maxChars
  ) {
    lifecycleHits.pop()
    trimmed_lifecycle_sources += 1
  }

  return {
    input: { priceHits: evidence.priceHits, lifecycleHits },
    trimmed_lifecycle_sources,
  }
}

export function buildOpenAiPromptSizeLog(
  equipment: EquipmentIntelligenceRow,
  input: ResearchEvidenceInput,
  stage: ResearchEnrichmentStage,
  options: {
    researchMode?: EquipmentResearchMode
    trimmedLifecycleSources?: number
  } = {},
): {
  research_mode: EquipmentResearchMode | null
  stage: ResearchEnrichmentStage
  price_source_count: number
  lifecycle_source_count: number
  total_source_count: number
  system_prompt_chars: number
  user_prompt_chars: number
  approximate_total_chars: number
  trimmed_lifecycle_sources: number
} {
  const user_prompt_chars = buildAiResearchPrompt(equipment, input, stage).length
  const system_prompt_chars = EQUIPMENT_RESEARCH_SYSTEM_PROMPT.length

  return {
    research_mode: options.researchMode ?? null,
    stage,
    price_source_count: input.priceHits.length,
    lifecycle_source_count: input.lifecycleHits.length,
    total_source_count: input.priceHits.length + input.lifecycleHits.length,
    system_prompt_chars,
    user_prompt_chars,
    approximate_total_chars: system_prompt_chars + user_prompt_chars,
    trimmed_lifecycle_sources: options.trimmedLifecycleSources ?? 0,
  }
}

export function buildAiResearchPrompt(
  equipment: EquipmentIntelligenceRow,
  evidence: SerpResearchHit[] | ResearchEvidenceInput,
  stage: ResearchEnrichmentStage = 'snippet',
): string {
  const input = normalizeResearchEvidenceInput(evidence)
  const equipmentLabel = [
    equipment.brand,
    equipment.series,
    equipment.model,
    equipment.equipment_type,
  ]
    .filter(Boolean)
    .join(' ')

  const priceLines = input.priceHits.map((hit, index) => formatResearchHitForPrompt(hit, index, stage))
  const lifecycleLines = input.lifecycleHits.map((hit, index) => formatResearchHitForPrompt(hit, index, stage))

  const evidenceNote = stage === 'enriched'
    ? 'Some sources include fetched page excerpts prioritising list price and lifecycle evidence. Prefer those over snippets when available.'
    : 'Only search snippets are available. Be conservative with confidence if evidence is thin.'

  return [
    `Equipment: ${equipmentLabel}`,
    `Catalogue slug: ${equipment.slug}`,
    '',
    '=== ORIGINAL PRICE EVIDENCE ===',
    'Use these sources ONLY for original_price, original_currency, and price_sources_used.',
    priceLines.length > 0 ? priceLines.join('\n\n') : 'No original price sources returned.',
    '',
    '=== PRODUCTION / LIFECYCLE EVIDENCE ===',
    'Use these sources ONLY for production_start_year, production_end_year, and production_sources_used.',
    lifecycleLines.length > 0 ? lifecycleLines.join('\n\n') : 'No production/lifecycle sources returned.',
    '',
    evidenceNote,
    '',
    'Determine ONLY the original manufacturer selling price when the equipment was new.',
    'For original RRP, prefer trusted UK dealer product pages (FitKit UK, Fitshop, Fitness Superstore, Pinnacle Fitness, Amazon Leisure, Powerhouse Fitness) that explicitly state RRP, List Price, Recommended Retail Price, or Original Retail Price over manufacturer brochures, manuals, or PDFs that omit pricing.',
    'Trusted UK dealer pages with explicit RRP/List Price outrank manufacturer brochures/PDFs without price — use dealer RRP when the manufacturer document has specs/lifecycle only.',
    'Official manufacturer price with explicit MSRP/RRP is stronger than obscure dealer sale prices, but weaker than trusted UK dealer pages with explicit RRP/List Price.',
    'Prefer genuine List Price, RRP, MSRP, Original Price, and New Price from manufacturer or distributor pages when dealer RRP is unavailable.',
    'If the official manufacturer price is USD and GBP dealer sources only show Our Price or sale prices, return the USD official price.',
    'Never treat converted non-GBP prices as verified GBP — suggest GBP conversion for admin review instead.',
    'Original new price must come from manufacturer, distributor, dealer catalogue, or official product page evidence.',
    'Never use eBay, auction, marketplace, used, refurbished, or resale listings as original new price evidence unless the same page explicitly states historical RRP / recommended retail price / list price.',
    'Used/refurbished dealer pages such as FitKitUK may be used for historical RRP and lifecycle evidence when RRP, launch year, discontinued, or manufacture date language is present. Ignore used, refurbished, sale, and current prices on those pages.',
    'For original new price, prefer List Price, RRP, MSRP, Original Price, and New Price.',
    'Prefer UK dealer catalogues such as Fitness Superstore when they show RRP, List Price, or £ pricing.',
    'Never use current selling price, refurbished price, used price, Our Price, Sale Price, Clearance Price, or Current Price as original RRP.',
    'If a used/refurbished dealer page states both RRP and a current/sale price, use only the RRP for original_price.',
    'List Price is valid even when Our Price is discounted — use List Price as original_price.',
    'If only resale or discounted sale prices are present, return null for original_price and do not estimate.',
    'For production years, use lifecycle evidence only.',
    'Prefer timeline pages, support guides, compatibility guides, specialist parts/support companies (e.g. Sportsmith), and historical documentation over dealer product or pricing pages.',
    'You may combine multiple lifecycle sources to infer production_start_year and production_end_year — do not require one page to state both dates explicitly.',
    'Examples: earliest dated manual (2004) + timeline introduction (~2004) + replacement model appearing (2012) → infer approximately 2004–2012 with medium/high confidence and explain the reasoning.',
    'If exact production years are not explicitly stated, infer a likely production period from launch, discontinued, manual, timeline, support guide, brochure, or archive evidence, but explain the inference and set production_confidence accordingly.',
    'A manual publication date indicates availability/support timing, not production start, unless corroborated by other evidence.',
    'Prefer official manufacturer PDFs, manufacturer websites, manuals, and distributor catalogues.',
    'Equipd is UK-based. Prefer original new price in GBP for UK valuations when a genuine GBP list/RRP price exists.',
    'Prioritise UK sources for original price only when they show genuine List Price, RRP, MSRP, or Original Price — not Our Price or sale prices alone.',
    'If both genuine GBP list/RRP and official USD manufacturer prices exist, prefer the official manufacturer price and return USD with lower confidence.',
    'If both GBP and USD prices are found, choose GBP only when the GBP source is a genuine list/RRP/catalogue price.',
    'Do not return USD as the final currency unless no GBP evidence exists.',
    'If only USD (or other non-GBP) prices are found, return that currency explicitly and lower price_confidence — do not convert currencies and do not treat USD as GBP.',
    'Return null for fields you cannot support from the evidence.',
  ].join('\n')
}

export const EQUIPMENT_RESEARCH_SYSTEM_PROMPT = `You are a research assistant for commercial fitness equipment cataloguing on Equipd, a UK-based platform.
Given two labelled source groups (original price evidence and production/lifecycle evidence), extract:
- original_price: numeric original manufacturer selling price when new. Use ORIGINAL PRICE EVIDENCE only. For original RRP, prefer trusted UK dealer product pages (FitKit UK, Fitshop, Fitness Superstore, Pinnacle Fitness, Amazon Leisure, Powerhouse Fitness) that explicitly state RRP, List Price, Recommended Retail Price, or Original Retail Price over manufacturer brochures, manuals, or PDFs without pricing. Trusted dealer RRP/List Price outranks manufacturer documents that omit price. Official manufacturer price with explicit MSRP/RRP is stronger than obscure dealer sale prices. Original new price must come from manufacturer, distributor, dealer catalogue, or official product page evidence. Never use eBay, auction, marketplace, used, refurbished, reconditioned, pre-owned, serviced, second-hand, resale, or auction prices. Never use current selling price, refurbished price, used price, Our Price, Sale Price, Clearance Price, or Current Price as original RRP. Prefer List Price, RRP, MSRP, Original Price, and New Price. If a used/refurbished dealer page states both RRP and a sale/current price, use only the RRP for original_price. List Price is valid even when Our Price is discounted. If official manufacturer price is USD and GBP dealer sources are weak sale prices only, return the USD official price in original_price with original_currency USD.
- original_currency: ISO 4217 code such as GBP, USD, EUR. Return the currency of the original_price exactly as stated on the source. Do not convert currencies. Do not return a GBP amount for a USD source or vice versa. Never silently treat USD as GBP.
- price_confidence: integer 0-100 for the price conclusion only
- price_reasoning: concise explanation for the price conclusion
- price_sources_used: array of URLs from ORIGINAL PRICE EVIDENCE that support the price (max 5)
- production_start_year: integer four-digit year or null
- production_end_year: integer four-digit year or null (null if still in production or unknown end)
- production_confidence: integer 0-100 for the production years conclusion only
- production_reasoning: concise explanation for the production years conclusion
- production_sources_used: array of URLs from PRODUCTION / LIFECYCLE EVIDENCE that support the production years (max 5)
- confidence: integer 0-100 for the overall recommendation
- confidence_reasoning: concise explanation of overall confidence
- supporting_urls: array of the most relevant URLs overall (max 8)

Use dealer_historical_reference sources for historical RRP only — never their used/refurbished/current sale prices.
If a used/refurbished dealer page states both RRP and a sale price, use only the RRP for original_price.
Used/refurbished dealer lifecycle evidence should be medium confidence unless corroborated by manufacturer or specialist support sources.
Use PRODUCTION / LIFECYCLE EVIDENCE only for production_start_year and production_end_year.
Prefer timeline pages, support guides, compatibility guides, specialist parts/support companies, and historical documentation over dealer product or pricing pages.
Combine multiple lifecycle sources when needed — do not require one page to state both production_start_year and production_end_year.
Examples: earliest dated manual (2004) + timeline introduction (~2004) + replacement model (2012) → infer approximately 2004–2012 with medium/high confidence; always explain production_reasoning.
If exact production years are not explicitly stated, infer a likely production period from launch, discontinued, manual, timeline, support guide, brochure, or archive evidence, but explain the inference and set production_confidence accordingly.
Do not treat a manual publication date as production start unless corroborated by other evidence.
If only resale, marketplace, auction, or discounted sale prices are found, return null for original_price and do not estimate.
Do not return conversion fields, GBP equivalents, or exchange rates — only original_price and original_currency.
Be conservative. If price or years are ambiguous, use null and lower confidence.
Respond with JSON only using exactly these keys:
original_price, original_currency, price_confidence, price_reasoning, price_sources_used,
production_start_year, production_end_year, production_confidence, production_reasoning, production_sources_used,
confidence, confidence_reasoning, supporting_urls`

export function parseEquipmentResearchRecommendation(
  raw: unknown,
  hits: SerpResearchHit[] = [],
): EquipmentResearchRecommendation {
  const value = (raw && typeof raw === 'object') ? raw as Record<string, unknown> : {}

  const originalNewPrice = parseNullablePositiveNumber(value.original_price)
    ?? parseNullablePositiveNumber(value.original_new_price)
  const currency = parseNullableCurrency(value.original_currency)
    ?? parseNullableCurrency(value.currency)
  const productionStartYear = parseNullableYear(value.production_start_year)
  const productionEndYear = parseNullableYear(value.production_end_year)
  const baselineManufactureYear = parseNullableYear(value.baseline_manufacture_year)
  const lifecycleConfidence = clampConfidence(value.lifecycle_confidence)
  const lifecycleNotes = normalizeResearchWhitespace(String(value.lifecycle_notes ?? '')) || null
  const priceConfidence = clampConfidence(value.price_confidence)
  const productionConfidence = clampConfidence(value.production_confidence)
  const confidence = clampConfidence(value.confidence)
  const priceReasoning = normalizeResearchWhitespace(String(value.price_reasoning ?? ''))
    || 'No price reasoning provided.'
  const productionReasoning = normalizeResearchWhitespace(String(value.production_reasoning ?? ''))
    || 'No production reasoning provided.'
  const confidenceReasoning = normalizeResearchWhitespace(String(value.confidence_reasoning ?? ''))
    || 'No confidence reasoning provided.'
  const priceSourcesUsed = parseSupportingUrls(value.price_sources_used)
  const productionSourcesUsed = parseSupportingUrls(value.production_sources_used)
  const supportingUrls = parseSupportingUrls(value.supporting_urls, 8)
  const reasoning = [priceReasoning, productionReasoning].filter(Boolean).join(' ')

  const supportingSources = buildSupportingSources(
    supportingUrls.length > 0
      ? supportingUrls
      : [...new Set([...priceSourcesUsed, ...productionSourcesUsed])],
    hits,
  )

  const parsedRecommendation: EquipmentResearchRecommendation = {
    original_new_price: originalNewPrice,
    currency,
    price_confidence: originalNewPrice != null ? priceConfidence : null,
    price_reasoning: priceReasoning,
    price_sources_used: priceSourcesUsed,
    production_start_year: productionStartYear ?? baselineManufactureYear,
    production_end_year: productionEndYear,
    production_confidence: (productionStartYear != null || productionEndYear != null || baselineManufactureYear != null)
      ? (productionConfidence ?? lifecycleConfidence)
      : null,
    production_reasoning: productionReasoning,
    production_sources_used: productionSourcesUsed,
    baseline_manufacture_year: baselineManufactureYear ?? productionStartYear,
    lifecycle_confidence: lifecycleConfidence || null,
    lifecycle_notes: lifecycleNotes,
    confidence,
    confidence_reasoning: confidenceReasoning,
    reasoning,
    supporting_urls: supportingUrls,
    supporting_sources: supportingSources,
  }

  return parsedRecommendation
}

function buildSupportingSources(urls: string[], hits: SerpResearchHit[]): ResearchSupportingSource[] {
  const hitByUrl = new Map(hits.map((hit) => [hit.url.toLowerCase(), hit]))
  const sources: ResearchSupportingSource[] = []

  for (const url of urls) {
    const hit = hitByUrl.get(url.toLowerCase())
    sources.push({
      title: hit?.title || url,
      domain: hit?.domain || extractResearchDomain(url),
      url,
      source_type: hit?.source_type || 'other',
    })
  }

  return sources
}

function parseNullablePositiveNumber(value: unknown): number | null {
  const number = Number(value)
  if (!Number.isFinite(number) || number <= 0) return null
  return Math.round(number * 100) / 100
}

function parseNullableCurrency(value: unknown): string | null {
  const normalized = normalizeResearchWhitespace(String(value ?? '')).toUpperCase()
  if (!normalized) return null
  if (!/^[A-Z]{3}$/.test(normalized)) return null
  return normalized
}

function parseNullableYear(value: unknown): number | null {
  const number = Number(value)
  if (!Number.isFinite(number)) return null
  const year = Math.trunc(number)
  if (year < 1970 || year > 2100) return null
  return year
}

function clampConfidence(value: unknown): number {
  const number = Number(value)
  if (!Number.isFinite(number)) return 0
  return Math.max(0, Math.min(100, Math.trunc(number)))
}

function parseSupportingUrls(value: unknown, max = 5): string[] {
  if (!Array.isArray(value)) return []

  const urls: string[] = []
  for (const entry of value) {
    const url = normalizeResearchWhitespace(String(entry ?? ''))
    if (!url || !/^https?:\/\//i.test(url)) continue
    if (urls.includes(url)) continue
    urls.push(url)
    if (urls.length >= max) break
  }

  return urls
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit = {},
  timeoutMs = EXTERNAL_REQUEST_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timeoutId)
  }
}

export type SerpGoogleOrganicResult = {
  title: string
  url: string
  snippet: string
  position: number
}

export type SerpFetchAttemptResult =
  | { ok: true; results: SerpGoogleOrganicResult[] }
  | { ok: false; error: string; timed_out: boolean }

export function buildSerpPartialWarning(
  errors: SerpQueryError[],
  totalQueries: number,
): string | null {
  if (errors.length === 0) return null

  const timedOutCount = errors.filter((entry) => entry.timed_out).length
  const failedCount = errors.length

  if (timedOutCount === failedCount) {
    if (timedOutCount === 1) {
      return `1 of ${totalQueries} searches timed out; continuing with available results.`
    }
    return `${timedOutCount} of ${totalQueries} searches timed out; continuing with available results.`
  }

  return `${failedCount} of ${totalQueries} searches failed; continuing with available results.`
}

export async function tryFetchSerpGoogleResults(
  query: string,
  options: { apiKey: string; num?: number; gl?: string; hl?: string },
): Promise<SerpFetchAttemptResult> {
  const url = new URL('https://serpapi.com/search.json')
  url.searchParams.set('engine', 'google')
  url.searchParams.set('q', query)
  url.searchParams.set('api_key', options.apiKey)
  url.searchParams.set('num', String(options.num ?? 5))
  url.searchParams.set('gl', options.gl ?? 'uk')
  url.searchParams.set('hl', options.hl ?? 'en')

  let response: Response

  try {
    response = await fetchWithTimeout(url.toString(), {}, SERPAPI_REQUEST_TIMEOUT_MS)
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      return {
        ok: false,
        error: `SerpAPI request timed out (${SERPAPI_REQUEST_TIMEOUT_MS / 1000}s)`,
        timed_out: true,
      }
    }

    const message = error instanceof Error ? error.message : 'SerpAPI request failed'
    return { ok: false, error: message, timed_out: false }
  }

  const body = await response.json() as SerpApiResponse

  if (!response.ok) {
    return {
      ok: false,
      error: body.error || `SerpAPI request failed (${response.status})`,
      timed_out: false,
    }
  }

  if (body.error) {
    return { ok: false, error: body.error, timed_out: false }
  }

  const results = (body.organic_results ?? [])
    .map((result, index) => {
      const link = normalizeResearchWhitespace(result.link ?? '')
      const title = normalizeResearchWhitespace(result.title ?? '')
      if (!link || !title) return null

      return {
        title,
        url: link,
        snippet: normalizeResearchWhitespace(result.snippet ?? ''),
        position: Number(result.position) || index + 1,
      }
    })
    .filter((hit): hit is SerpGoogleOrganicResult => hit !== null)

  return { ok: true, results }
}

export async function fetchSerpGoogleResults(
  query: string,
  options: { apiKey: string; num?: number; gl?: string; hl?: string },
): Promise<SerpGoogleOrganicResult[]> {
  const attempt = await tryFetchSerpGoogleResults(query, options)
  if (!attempt.ok) {
    throw new Error(attempt.error)
  }
  return attempt.results
}

function inferIntentFromQuery(query: string): string {
  const lower = query.toLowerCase()
  if (lower.includes('filetype:pdf')) return 'pdf'

  for (const { intent, domain } of TRUSTED_DEALER_PRICE_SITE_SEARCHES) {
    if (lower.includes(`site:${domain}`)) return intent
  }

  for (const { intent, suffix } of SPECIALIST_SUPPORT_QUERY_INTENTS) {
    if (lower.includes(suffix.toLowerCase())) return intent
  }

  for (const { intent, suffix } of LIFECYCLE_QUERY_INTENTS) {
    if (lower.includes(suffix.toLowerCase())) return intent
  }

  for (const { intent, suffix } of GENERIC_PRICE_RESEARCH_QUERY_INTENTS) {
    if (lower.includes(suffix.toLowerCase())) return intent
  }

  return 'search'
}

export async function runSerpQueryBatch(
  queries: string[],
  apiKey: string,
  options: {
    serpRequestTimings?: SerpRequestTiming[]
    serpQueryAnalysis?: SerpQueryAnalysis[]
    serpErrors?: SerpQueryError[]
    startedAt?: number
    fetchSerpResults?: (
      query: string,
      apiKey: string,
    ) => Promise<SerpFetchAttemptResult>
  } = {},
): Promise<{
  hits: SerpResearchHit[]
  serp_errors: SerpQueryError[]
}> {
  const allHits: SerpResearchHit[] = []
  const serpRequestTimings = options.serpRequestTimings ?? []
  const serpQueryAnalysis = options.serpQueryAnalysis ?? []
  const serpErrors = options.serpErrors ?? []
  const fetchSerpResults = options.fetchSerpResults
    ?? ((query: string, key: string) => tryFetchSerpGoogleResults(query, { apiKey: key }))
  const batchStartedAt = Date.now()

  for (const query of queries) {
    const requestStart = Date.now()
    const attempt = await fetchSerpResults(query, apiKey)
    const duration_ms = Date.now() - requestStart

    if (!attempt.ok) {
      const errorEntry: SerpQueryError = {
        query,
        error: attempt.error,
        timed_out: attempt.timed_out,
        duration_ms,
      }
      serpErrors.push(errorEntry)
      serpRequestTimings.push({
        query,
        duration_ms,
        result_count: 0,
        success: false,
        error: attempt.error,
        timed_out: attempt.timed_out,
      })
      serpQueryAnalysis.push({
        query,
        result_count: 0,
        top_urls: [],
        duration_ms,
        error: attempt.error,
        timed_out: attempt.timed_out,
      })
      console.warn('equipment_research_serp_error', errorEntry)
      logResearchTiming('serp_request', {
        query,
        duration_ms,
        result_count: 0,
        success: false,
        error: attempt.error,
        timed_out: attempt.timed_out,
      }, options.startedAt ?? batchStartedAt)
      continue
    }

    const results = attempt.results
    const timing: SerpRequestTiming = {
      query,
      duration_ms,
      result_count: results.length,
      success: true,
      error: null,
      timed_out: false,
    }
    serpRequestTimings.push(timing)
    serpQueryAnalysis.push({
      query,
      result_count: results.length,
      top_urls: results.map((result) => result.url),
      duration_ms,
    })
    logResearchTiming('serp_request', timing, options.startedAt ?? batchStartedAt)

    for (const result of results) {
      const domain = extractResearchDomain(result.url)
      allHits.push({
        intent: inferIntentFromQuery(query),
        query,
        title: result.title,
        url: result.url,
        snippet: result.snippet,
        position: result.position,
        domain,
        source_type: 'other',
        source_rank: SOURCE_TYPE_RANK.other,
        page_content: null,
        page_read_status: 'snippet_only',
        page_read_error: null,
      })
    }
  }

  return { hits: allHits, serp_errors: serpErrors }
}

async function recoverResearchHitPageContent(
  hit: SerpResearchHit,
  options: {
    equipment?: EquipmentIntelligenceRow
    serpApiKey?: string
  } = {},
): Promise<SerpResearchHit> {
  const attemptFetch = async (url: string) => fetchCandidatePage(url)

  let fetched = await attemptFetch(hit.url)
  let resolvedUrl = hit.url

  if (!fetched.ok && fetched.rawHtml) {
    const canonicalUrl = extractCanonicalPageUrl(fetched.rawHtml, hit.url)
    if (canonicalUrl && canonicalUrl.trim().toLowerCase() !== hit.url.trim().toLowerCase()) {
      const canonicalFetch = await attemptFetch(canonicalUrl)
      if (canonicalFetch.ok && canonicalFetch.content?.combinedText) {
        fetched = canonicalFetch
        resolvedUrl = canonicalUrl
      }
    }
  }

  if (!fetched.ok && options.serpApiKey && options.equipment) {
    const domain = hit.domain || extractResearchDomain(hit.url)
    const phrase = buildEquipmentResearchSearchPhrase(options.equipment)
    if (domain && phrase) {
      const siteQuery = `site:${domain} ${phrase}`.replace(/\s+/g, ' ').trim()
      const siteSearch = await tryFetchSerpGoogleResults(siteQuery, {
        apiKey: options.serpApiKey,
        num: 3,
      })
      if (siteSearch.ok) {
        const replacement = siteSearch.results.find((result) => (
          extractResearchDomain(result.url) === domain
          && result.url.trim().toLowerCase() !== hit.url.trim().toLowerCase()
        ))
        if (replacement) {
          const replacementFetch = await attemptFetch(replacement.url)
          if (replacementFetch.ok && replacementFetch.content?.combinedText) {
            fetched = replacementFetch
            resolvedUrl = replacement.url
            hit = {
              ...hit,
              title: replacement.title || hit.title,
              snippet: replacement.snippet || hit.snippet,
            }
          }
        }
      }
    }
  }

  if (fetched.ok && fetched.content?.combinedText) {
    return enrichResearchHitHistoricalEvidence({
      ...hit,
      url: resolvedUrl,
      page_content: preparePageContentForAi(fetched.content),
      page_read_status: 'read',
      page_read_error: null,
      source_fetch_status: 'read',
    })
  }

  const snippetEvidence = hit.snippet
    ? `Search snippet evidence: ${hit.snippet}`
    : null

  return enrichResearchHitHistoricalEvidence({
    ...hit,
    url: resolvedUrl,
    page_content: snippetEvidence,
    page_read_status: hit.snippet ? 'snippet_only' : 'failed',
    source_fetch_status: hit.snippet ? 'snippet_only' : 'failed',
    page_read_error: fetched.error ?? 'Could not read page content',
  })
}

export async function enrichTopResearchHitsForStage2(
  hits: SerpResearchHit[],
  options: {
    maxPageReads?: number
    maxPdfDownloads?: number
    pageFetchTimings?: PageFetchTiming[]
    startedAt?: number
    equipment?: EquipmentIntelligenceRow
    serpApiKey?: string
    resourceGuards?: {
      skipHeavyDomains?: boolean
      lifecycleNeeded?: boolean
      researchMode?: EquipmentResearchMode
      shouldFetchPdf?: (hit: SerpResearchHit) => boolean
      onPageSkipped?: (entry: PageSkipEntry) => void
    }
  } = {},
): Promise<{
  hits: SerpResearchHit[]
  pagesRead: number
  pdfDownloadsAttempted: number
  page_fetch_timings: PageFetchTiming[]
  stage_2_fetch_total_ms: number
  pages_skipped: PageSkipEntry[]
}> {
  const maxPageReads = options.maxPageReads ?? RESEARCH_STAGE2_PAGE_READS
  const maxPdfDownloads = options.maxPdfDownloads ?? RESEARCH_STAGE2_PDF_DOWNLOADS
  const targets = hits.slice(0, maxPageReads)
  const enrichedByUrl = new Map<string, SerpResearchHit>()
  const pageFetchTimings = options.pageFetchTimings ?? []
  const pagesSkipped: PageSkipEntry[] = []
  let pagesRead = 0
  let pdfDownloadsAttempted = 0
  const fetchStartedAt = Date.now()

  const recordSkip = (url: string, reason: PageSkipReason, detail?: string | null) => {
    const entry = { url, reason, detail: detail ?? null }
    pagesSkipped.push(entry)
    options.resourceGuards?.onPageSkipped?.(entry)
    console.info('equipment_research_v3_diagnostics', {
      stage: 'page_skipped',
      url,
      reason,
      detail: detail ?? null,
    })
  }

  for (const hit of targets) {
    const domain = hit.domain || extractResearchDomain(hit.url)

    if (options.resourceGuards?.skipHeavyDomains && isHeavyResearchDomain(domain || hit.url)) {
      recordSkip(hit.url, 'low_value_domain', domain)
      enrichedByUrl.set(hit.url.toLowerCase(), {
        ...hit,
        page_content: hit.snippet ? `Search snippet evidence: ${hit.snippet}` : null,
        page_read_status: hit.snippet ? 'snippet_only' : 'failed',
        page_read_error: 'Skipped heavy archive domain; using snippet only',
      })
      continue
    }

    if (isPdfUrl(hit.url)) {
      const allowPdf = options.resourceGuards?.shouldFetchPdf
        ? options.resourceGuards.shouldFetchPdf(hit)
        : true

      if (!allowPdf) {
        recordSkip(hit.url, 'pdf_skipped', 'pdf_not_high_value')
        enrichedByUrl.set(hit.url.toLowerCase(), {
          ...hit,
          page_content: hit.snippet ? `Search snippet evidence: ${hit.snippet}` : null,
          page_read_status: 'pdf_snippet_only',
          page_read_error: 'PDF skipped for CPU safety; using search snippet',
        })
        continue
      }

      if (pdfDownloadsAttempted >= maxPdfDownloads) {
        const timing: PageFetchTiming = {
          url: hit.url,
          fetch_type: 'skipped_pdf_limit',
          duration_ms: 0,
          success: false,
          error: 'PDF download limit reached',
        }
        pageFetchTimings.push(timing)
        logResearchTiming('stage_2_page_fetch', timing, options.startedAt ?? fetchStartedAt)
        enrichedByUrl.set(hit.url.toLowerCase(), {
          ...hit,
          page_content: null,
          page_read_status: 'pdf_snippet_only',
          page_read_error: 'PDF download limit reached; using search snippet',
        })
        continue
      }

      pdfDownloadsAttempted += 1
      const requestStart = Date.now()
      const fetched = await fetchCandidatePdf(hit.url)
      const timing: PageFetchTiming = {
        url: hit.url,
        fetch_type: 'pdf',
        duration_ms: Date.now() - requestStart,
        success: Boolean(fetched.ok && fetched.content?.combinedText),
        error: fetched.error ?? null,
      }
      pageFetchTimings.push(timing)
      logResearchTiming('stage_2_page_fetch', timing, options.startedAt ?? fetchStartedAt)

      if (fetched.error === 'too_large_pdf') {
        recordSkip(hit.url, 'too_large_pdf', fetched.error)
      }

      if (fetched.ok && fetched.content?.combinedText) {
        pagesRead += 1
        enrichedByUrl.set(hit.url.toLowerCase(), {
          ...hit,
          page_content: preparePageContentForAi(fetched.content),
          page_read_status: 'read',
          page_read_error: null,
        })
        continue
      }

      enrichedByUrl.set(hit.url.toLowerCase(), {
        ...hit,
        page_content: null,
        page_read_status: 'pdf_snippet_only',
        page_read_error: fetched.error ?? 'Could not read PDF text',
      })
      continue
    }

    const requestStart = Date.now()
    const recovered = await recoverResearchHitPageContent(hit, {
      equipment: options.equipment,
      serpApiKey: options.serpApiKey,
    })
    const timing: PageFetchTiming = {
      url: hit.url,
      fetch_type: 'html',
      duration_ms: Date.now() - requestStart,
      success: recovered.page_read_status === 'read',
      error: recovered.page_read_error,
    }
    pageFetchTimings.push(timing)
    logResearchTiming('stage_2_page_fetch', timing, options.startedAt ?? fetchStartedAt)

    if (recovered.page_read_error === 'too_large_html') {
      recordSkip(hit.url, 'too_large_html', recovered.page_read_error)
    } else if (recovered.page_read_error === 'parse_budget_exceeded') {
      recordSkip(hit.url, 'parse_budget_exceeded', recovered.page_read_error)
    }

    if (recovered.page_read_status === 'read') {
      pagesRead += 1
    }

    enrichedByUrl.set(hit.url.toLowerCase(), recovered)
  }

  const mergedHits = hits.map((hit) => enrichedByUrl.get(hit.url.toLowerCase()) ?? hit)

  return {
    hits: mergedHits,
    pagesRead,
    pdfDownloadsAttempted,
    page_fetch_timings: pageFetchTimings,
    stage_2_fetch_total_ms: Date.now() - fetchStartedAt,
    pages_skipped: pagesSkipped,
  }
}

/** @deprecated Use enrichTopResearchHitsForStage2 during stage-2 fallback only. */
export async function enrichResearchHitsWithPageContent(
  hits: SerpResearchHit[],
): Promise<SerpResearchHit[]> {
  const result = await enrichTopResearchHitsForStage2(hits)
  return result.hits
}

export async function collectSerpResearchHits(
  equipment: EquipmentIntelligenceRow,
  apiKey: string,
  options: {
    serpRequestTimings?: SerpRequestTiming[]
    serpQueryAnalysis?: SerpQueryAnalysis[]
    serpErrors?: SerpQueryError[]
    startedAt?: number
    queries?: string[]
    fetchSerpResults?: (
      query: string,
      apiKey: string,
    ) => Promise<SerpFetchAttemptResult>
  } = {},
): Promise<{
  queries_run: string[]
  hits: SerpResearchHit[]
  serp_request_timings: SerpRequestTiming[]
  serp_query_analysis: SerpQueryAnalysis[]
  serp_errors: SerpQueryError[]
  serp_warning: string | null
  serp_raw_url_hits: number
  serp_duplicate_urls_removed: number
  serp_total_ms: number
  ranking_ms: number
}> {
  const queries = options.queries ?? buildEquipmentPriceResearchQueries(equipment)
  const serpStartedAt = Date.now()
  const serpErrors: SerpQueryError[] = options.serpErrors ?? []

  const batch = await runSerpQueryBatch(queries, apiKey, {
    ...options,
    serpErrors,
  })

  const serp_raw_url_hits = batch.hits.length
  if (serp_raw_url_hits === 0) {
    throw new Error(
      serpErrors.length === queries.length
        ? 'All SerpAPI searches failed'
        : 'No usable SerpAPI results',
    )
  }

  const serp_total_ms = Date.now() - serpStartedAt
  logResearchTiming('serp_total', {
    duration_ms: serp_total_ms,
    request_count: options.serpRequestTimings?.length ?? queries.length,
  }, options.startedAt ?? serpStartedAt)

  const rankingStartedAt = Date.now()
  const deduped = dedupeSerpResearchHits(batch.hits)
  const ranked = rankResearchHits(deduped, equipment.brand)
  const ranking_ms = Date.now() - rankingStartedAt
  const serp_duplicate_urls_removed = serp_raw_url_hits - deduped.length
  logResearchTiming('ranking', { duration_ms: ranking_ms, source_count: ranked.length }, options.startedAt ?? serpStartedAt)

  return {
    queries_run: queries,
    hits: ranked,
    serp_request_timings: options.serpRequestTimings ?? [],
    serp_query_analysis: options.serpQueryAnalysis ?? [],
    serp_errors: serpErrors,
    serp_warning: buildSerpPartialWarning(serpErrors, queries.length),
    serp_raw_url_hits,
    serp_duplicate_urls_removed,
    serp_total_ms,
    ranking_ms,
  }
}

export function buildProductionInferenceDebug(
  recommendation: EquipmentResearchRecommendation,
  lifecycleHits: SerpResearchHit[],
  specialistSupportHits: SerpResearchHit[] = [],
): ProductionInferredFromSource[] {
  const pools = [...lifecycleHits, ...specialistSupportHits]
  const byUrl = new Map(pools.map((hit) => [hit.url.trim().toLowerCase(), hit]))

  return recommendation.production_sources_used.map((url) => {
    const hit = byUrl.get(url.trim().toLowerCase())
    const domain = hit?.domain || extractResearchDomain(url)
    const source_type = hit?.source_type
      ?? classifyLifecycleResearchSourceType({
        url,
        title: url,
        snippet: '',
        intent: '',
        domain,
        query: '',
      }, '')

    return {
      url,
      domain,
      title: hit?.title || url,
      source_type,
      is_specialist_support: source_type === 'specialist_support' || isSpecialistSupportDomain(domain),
      query_intent: hit?.intent,
    }
  })
}

function summarizeSpecialistSupportHits(hits: SerpResearchHit[]) {
  return hits.slice(0, 15).map((hit) => ({
    title: hit.title,
    url: hit.url,
    domain: hit.domain,
    source_type: hit.source_type,
    combined_rank_score: hit.combined_rank_score,
  }))
}

export async function compareLifecycleResearchStrategies(
  equipment: EquipmentIntelligenceRow,
  apiKey: string,
  options: {
    fetchSerpResults?: (
      query: string,
      apiKey: string,
    ) => Promise<SerpFetchAttemptResult>
    openAiApiKey?: string
    openAiModel?: string
  } = {},
): Promise<{
  equipment_label: string
  legacy_only: {
    queries: string[]
    sources_returned: number
    top_domains: string[]
    ai_selection_domains: string[]
    production: {
      start_year: number | null
      end_year: number | null
      confidence: number | null
      sources_used: string[]
      reasoning: string
    } | null
  }
  legacy_plus_specialist: {
    queries: string[]
    specialist_queries: string[]
    sources_returned: number
    specialist_sources_returned: number
    top_domains: string[]
    ai_selection_domains: string[]
    production: {
      start_year: number | null
      end_year: number | null
      confidence: number | null
      sources_used: string[]
      reasoning: string
    } | null
  }
}> {
  const equipmentLabel = [
    equipment.brand,
    equipment.series,
    equipment.model,
  ].filter(Boolean).join(' ')

  const lifecycleQueries = buildEquipmentLifecycleResearchQueries(equipment)
  const specialistQueries = buildEquipmentSpecialistSupportResearchQueries(equipment)
  const fetchSerpResults = options.fetchSerpResults
    ?? ((query: string, key: string) => tryFetchSerpGoogleResults(query, { apiKey: key }))

  const lifecycleBatch = await runSerpQueryBatch(lifecycleQueries, apiKey, { fetchSerpResults })
  const specialistBatch = await runSerpQueryBatch(specialistQueries, apiKey, { fetchSerpResults })

  const legacyRanked = rankLifecycleResearchHits(
    dedupeSerpResearchHits(lifecycleBatch.hits),
    equipment.brand,
  )
  const combinedRanked = rankLifecycleResearchHits(
    dedupeSerpResearchHits([...lifecycleBatch.hits, ...specialistBatch.hits]),
    equipment.brand,
  )
  const specialistRanked = rankLifecycleResearchHits(
    dedupeSerpResearchHits(specialistBatch.hits),
    equipment.brand,
  )

  const legacyAiSelection = selectLifecycleResearchHitsForAi(legacyRanked)
  const combinedAiSelection = selectLifecycleResearchHitsForAi(combinedRanked)

  const uniqueDomains = (hits: SerpResearchHit[]) => [
    ...new Set(hits.slice(0, 10).map((hit) => hit.domain).filter(Boolean)),
  ]

  let legacyProduction: {
    start_year: number | null
    end_year: number | null
    confidence: number | null
    sources_used: string[]
    reasoning: string
  } | null = null

  let combinedProduction: typeof legacyProduction = null

  if (options.openAiApiKey) {
    const legacyExtracted = await extractEquipmentResearchRecommendation(
      equipment,
      { priceHits: [], lifecycleHits: legacyAiSelection },
      { apiKey: options.openAiApiKey, model: options.openAiModel, stage: 'snippet' },
    )
    legacyProduction = {
      start_year: legacyExtracted.recommendation.production_start_year,
      end_year: legacyExtracted.recommendation.production_end_year,
      confidence: legacyExtracted.recommendation.production_confidence,
      sources_used: legacyExtracted.recommendation.production_sources_used,
      reasoning: legacyExtracted.recommendation.production_reasoning,
    }

    const combinedExtracted = await extractEquipmentResearchRecommendation(
      equipment,
      { priceHits: [], lifecycleHits: combinedAiSelection },
      { apiKey: options.openAiApiKey, model: options.openAiModel, stage: 'snippet' },
    )
    combinedProduction = {
      start_year: combinedExtracted.recommendation.production_start_year,
      end_year: combinedExtracted.recommendation.production_end_year,
      confidence: combinedExtracted.recommendation.production_confidence,
      sources_used: combinedExtracted.recommendation.production_sources_used,
      reasoning: combinedExtracted.recommendation.production_reasoning,
    }
  }

  return {
    equipment_label: equipmentLabel,
    legacy_only: {
      queries: lifecycleQueries,
      sources_returned: legacyRanked.length,
      top_domains: uniqueDomains(legacyRanked),
      ai_selection_domains: uniqueDomains(legacyAiSelection),
      production: legacyProduction,
    },
    legacy_plus_specialist: {
      queries: lifecycleQueries,
      specialist_queries: specialistQueries,
      sources_returned: combinedRanked.length,
      specialist_sources_returned: specialistRanked.length,
      top_domains: uniqueDomains(combinedRanked),
      ai_selection_domains: uniqueDomains(combinedAiSelection),
      production: combinedProduction,
    },
  }
}

export async function collectEquipmentResearchEvidence(
  equipment: EquipmentIntelligenceRow,
  apiKey: string,
  options: {
    researchMode?: EquipmentResearchMode
    serpRequestTimings?: SerpRequestTiming[]
    serpQueryAnalysis?: SerpQueryAnalysis[]
    serpErrors?: SerpQueryError[]
    startedAt?: number
    fetchSerpResults?: (
      query: string,
      apiKey: string,
    ) => Promise<SerpFetchAttemptResult>
  } = {},
): Promise<{
  price_queries_run: string[]
  lifecycle_queries_run: string[]
  specialist_support_queries_run: string[]
  queries_run: string[]
  price_hits: SerpResearchHit[]
  lifecycle_hits: SerpResearchHit[]
  lifecycle_legacy_hits: SerpResearchHit[]
  specialist_support_hits: SerpResearchHit[]
  price_sources_returned: number
  lifecycle_sources_returned: number
  specialist_support_sources_returned: number
  hits: SerpResearchHit[]
  serp_request_timings: SerpRequestTiming[]
  serp_query_analysis: SerpQueryAnalysis[]
  serp_errors: SerpQueryError[]
  serp_warning: string | null
  serp_raw_url_hits: number
  serp_duplicate_urls_removed: number
  serp_total_ms: number
  ranking_ms: number
}> {
  const researchMode = options.researchMode ?? 'full'
  const includePrice = researchMode === 'full' || researchMode === 'price_only'
  const includeLifecycle = researchMode === 'full' || researchMode === 'lifecycle_only'

  const priceQueries = buildEquipmentPriceResearchQueries(equipment)
  const lifecycleQueries = buildEquipmentLifecycleResearchQueries(equipment)
  const specialistQueries = buildEquipmentSpecialistSupportResearchQueries(equipment)
  const serpStartedAt = Date.now()
  const serpErrors: SerpQueryError[] = options.serpErrors ?? []

  const emptyBatch = { hits: [] as SerpResearchHit[] }

  const priceBatch = includePrice
    ? await runSerpQueryBatch(priceQueries, apiKey, { ...options, serpErrors })
    : emptyBatch
  const lifecycleBatch = includeLifecycle
    ? await runSerpQueryBatch(lifecycleQueries, apiKey, { ...options, serpErrors })
    : emptyBatch
  const specialistBatch = includeLifecycle
    ? await runSerpQueryBatch(specialistQueries, apiKey, { ...options, serpErrors })
    : emptyBatch

  const price_raw_hits = priceBatch.hits.length
  const lifecycle_raw_hits = lifecycleBatch.hits.length
  const specialist_raw_hits = specialistBatch.hits.length
  const totalQueries = (
    (includePrice ? priceQueries.length : 0)
    + (includeLifecycle ? lifecycleQueries.length + specialistQueries.length : 0)
  )

  if (includePrice && price_raw_hits === 0) {
    throw new Error(
      serpErrors.length >= totalQueries
        ? 'All SerpAPI searches failed'
        : 'No usable SerpAPI price results',
    )
  }

  if (includeLifecycle && lifecycle_raw_hits + specialist_raw_hits === 0) {
    throw new Error(
      serpErrors.length >= totalQueries
        ? 'All SerpAPI searches failed'
        : 'No usable SerpAPI lifecycle results',
    )
  }

  const rankingStartedAt = Date.now()
  const priceDeduped = dedupeSerpResearchHits(priceBatch.hits)
  const lifecycleLegacyDeduped = dedupeSerpResearchHits(lifecycleBatch.hits)
  const specialistDeduped = dedupeSerpResearchHits(specialistBatch.hits)
  const lifecycleCombinedDeduped = dedupeSerpResearchHits([
    ...lifecycleBatch.hits,
    ...specialistBatch.hits,
  ])

  const price_hits = includePrice
    ? rankResearchHits(priceDeduped, equipment.brand)
    : []
  const lifecycle_legacy_hits = includeLifecycle
    ? rankLifecycleResearchHits(lifecycleLegacyDeduped, equipment.brand)
    : []
  const specialist_support_hits = includeLifecycle
    ? rankLifecycleResearchHits(specialistDeduped, equipment.brand)
    : []
  const lifecycle_hits = includeLifecycle
    ? rankLifecycleResearchHits(lifecycleCombinedDeduped, equipment.brand)
    : []
  const ranking_ms = Date.now() - rankingStartedAt

  const serp_raw_url_hits = price_raw_hits + lifecycle_raw_hits + specialist_raw_hits
  const serp_duplicate_urls_removed = (
    (price_raw_hits - price_hits.length)
    + (lifecycle_raw_hits + specialist_raw_hits - lifecycle_hits.length)
  )
  const serp_total_ms = Date.now() - serpStartedAt

  logResearchTiming('serp_total', {
    duration_ms: serp_total_ms,
    request_count: totalQueries,
    research_mode: researchMode,
    price_sources_returned: price_hits.length,
    lifecycle_sources_returned: lifecycle_hits.length,
    specialist_support_sources_returned: specialist_support_hits.length,
  }, options.startedAt ?? serpStartedAt)
  logResearchTiming('ranking', {
    duration_ms: ranking_ms,
    price_source_count: price_hits.length,
    lifecycle_source_count: lifecycle_hits.length,
    specialist_support_source_count: specialist_support_hits.length,
  }, options.startedAt ?? serpStartedAt)

  return {
    price_queries_run: includePrice ? priceQueries : [],
    lifecycle_queries_run: includeLifecycle ? lifecycleQueries : [],
    specialist_support_queries_run: includeLifecycle ? specialistQueries : [],
    queries_run: [
      ...(includePrice ? priceQueries : []),
      ...(includeLifecycle ? [...lifecycleQueries, ...specialistQueries] : []),
    ],
    price_hits,
    lifecycle_hits,
    lifecycle_legacy_hits,
    specialist_support_hits,
    price_sources_returned: price_hits.length,
    lifecycle_sources_returned: lifecycle_hits.length,
    specialist_support_sources_returned: specialist_support_hits.length,
    hits: [...price_hits, ...lifecycle_hits],
    serp_request_timings: options.serpRequestTimings ?? [],
    serp_query_analysis: options.serpQueryAnalysis ?? [],
    serp_errors: serpErrors,
    serp_warning: buildSerpPartialWarning(serpErrors, totalQueries),
    serp_raw_url_hits,
    serp_duplicate_urls_removed,
    serp_total_ms,
    ranking_ms,
  }
}

/** Serp collection only — no page fetching. */
export async function collectEquipmentResearchHits(
  equipment: EquipmentIntelligenceRow,
  apiKey: string,
): Promise<{ queries_run: string[]; hits: SerpResearchHit[] }> {
  return collectSerpResearchHits(equipment, apiKey)
}

export async function extractEquipmentResearchRecommendation(
  equipment: EquipmentIntelligenceRow,
  evidence: SerpResearchHit[] | ResearchEvidenceInput,
  options: {
    apiKey: string
    model?: string
    stage?: ResearchEnrichmentStage
    researchMode?: EquipmentResearchMode
  },
): Promise<{
  recommendation: EquipmentResearchRecommendation
  price_currency_debug: PriceCurrencyDebug
  rawResponse: unknown
  requestPayload: OpenAiResearchRequestPayload
}> {
  const enrichmentStage = options.stage ?? 'snippet'
  const normalizedInput = normalizeResearchEvidenceInput(evidence)
  const { input, trimmed_lifecycle_sources } = trimLifecycleHitsForOpenAiPrompt(
    equipment,
    normalizedInput,
    enrichmentStage,
  )

  const promptSizeLog = buildOpenAiPromptSizeLog(equipment, input, enrichmentStage, {
    researchMode: options.researchMode,
    trimmedLifecycleSources: trimmed_lifecycle_sources,
  })
  console.info('equipment_research_openai_prompt_size', promptSizeLog)

  const requestPayload = buildOpenAiRequestPayload(equipment, input, enrichmentStage)
  const userPrompt = buildAiResearchPrompt(equipment, input, enrichmentStage)

  console.info('equipment_research_openai_payload', JSON.stringify(requestPayload))

  let response: Response

  try {
    response = await fetchWithTimeout('https://api.openai.com/v1/chat/completions', {
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
          { role: 'system', content: EQUIPMENT_RESEARCH_SYSTEM_PROMPT },
          {
            role: 'user',
            content: userPrompt,
          },
        ],
      }),
    }, OPENAI_REQUEST_TIMEOUT_MS)
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error(formatOpenAiTimeoutError(OPENAI_REQUEST_TIMEOUT_MS))
    }
    throw error
  }

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

  let parsed: unknown
  try {
    parsed = JSON.parse(content)
  } catch {
    throw new Error('OpenAI returned invalid JSON')
  }

  const finalized = finalizeResearchPriceRecommendation(
    parseEquipmentResearchRecommendation(
      parsed,
      [...input.priceHits, ...input.lifecycleHits],
    ),
    input.priceHits,
  )

  return {
    recommendation: finalized.recommendation,
    price_currency_debug: finalized.price_currency_debug,
    rawResponse: parsed,
    requestPayload,
  }
}

export async function profileSerpResearchCollection(
  equipment: EquipmentIntelligenceRow,
  serpApiKey: string,
): Promise<{
  profile_mode: 'serp_only'
  equipment: EquipmentResearchResult['equipment']
  queries_run: string[]
  serp_result_count: number
  deduped_result_count: number
  debug_log: EquipmentResearchDebugLog
}> {
  const startedAt = Date.now()
  const timings = createEmptyResearchTimings(startedAt)
  const equipmentLabel = [
    equipment.brand,
    equipment.series,
    equipment.model,
  ].filter(Boolean).join(' ')

  console.info('equipment_research_progress', {
    equipment_id: equipment.id,
    equipment_label: equipmentLabel,
    stage: 'serp_only_profile_started',
    elapsed_from_start_ms: 0,
  })

  const serpQueryAnalysis: SerpQueryAnalysis[] = []
  const collected = await collectEquipmentResearchEvidence(equipment, serpApiKey, {
    serpRequestTimings: timings.serp_requests,
    serpQueryAnalysis,
    startedAt,
  })

  timings.serp_total_ms = collected.serp_total_ms
  timings.ranking_ms = collected.ranking_ms
  timings.total_execution_ms = Date.now() - startedAt
  timings.offsets_from_start_ms.serp_complete = timings.total_execution_ms
  timings.offsets_from_start_ms.ranking_complete = timings.total_execution_ms
  timings.offsets_from_start_ms.function_end = timings.total_execution_ms

  const debugLog: EquipmentResearchDebugLog = {
    equipment_label: equipmentLabel,
    research_stage: 'stage_1',
    progress_log: ['serp_only_profile'],
    timings,
    serp_query_analysis: collected.serp_query_analysis,
    serp_errors: collected.serp_errors,
    serp_warning: collected.serp_warning,
    serp_unique_queries: collected.queries_run.length,
    serp_raw_url_hits: collected.serp_raw_url_hits,
    serp_duplicate_urls_removed: collected.serp_duplicate_urls_removed,
    openai_request_payload: null,
    searches_executed: collected.queries_run,
    sources_returned: collected.hits.length,
    sources_sent_to_ai: 0,
    sources_successfully_read: 0,
    pdf_downloads_attempted: 0,
    sources_used_by_ai: [],
    openai_raw_response: null,
    duration_ms: timings.total_execution_ms,
    ...buildPriceSourceClassificationDebug(collected.price_hits, equipment.brand),
    price_candidate_debug: buildPriceCandidateDebug(collected.price_hits, equipment.brand),
    price_input_sources: hitsToResearchSupportingSources(
      selectOriginalPriceResearchHitsForAi(collected.price_hits),
    ),
    lifecycle_input_sources: hitsToResearchSupportingSources(
      selectLifecycleResearchHitsForAi(collected.lifecycle_hits),
    ),
    lifecycle_search_queries: collected.lifecycle_queries_run,
    lifecycle_sources_returned: collected.lifecycle_sources_returned,
    specialist_support_queries: collected.specialist_support_queries_run,
    specialist_support_hits: summarizeSpecialistSupportHits(collected.specialist_support_hits),
    specialist_support_sources: hitsToResearchSupportingSources(
      selectLifecycleResearchHitsForAi(collected.specialist_support_hits).filter(
        (hit) => hit.source_type === 'specialist_support',
      ),
    ),
    price_sources_returned: collected.price_sources_returned,
    price_currency_debug: analyzePriceCurrencyEvidence(collected.price_hits),
    ranked_sources: selectOriginalPriceResearchHitsForAi(collected.price_hits).map((hit) => ({
      title: hit.title,
      url: hit.url,
      domain: hit.domain,
      source_type: hit.source_type,
      page_read_status: hit.page_read_status,
    })),
  }

  console.info('equipment_research_timings', JSON.stringify(timings))
  console.info('equipment_research_debug', JSON.stringify(debugLog))

  return {
    profile_mode: 'serp_only',
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
    debug_log: debugLog,
  }
}

export async function researchEquipmentIntelligence(
  equipment: EquipmentIntelligenceRow,
  options: {
    serpApiKey: string
    openAiApiKey: string
    openAiModel?: string
    researchMode?: EquipmentResearchMode
  },
): Promise<EquipmentResearchResult> {
  const researchMode = options.researchMode ?? 'full'
  const startedAt = Date.now()
  const timings = createEmptyResearchTimings(startedAt)
  const equipmentLabel = [
    equipment.brand,
    equipment.series,
    equipment.model,
  ].filter(Boolean).join(' ')

  const progressLog: string[] = []
  const logProgress = (stage: string, detail: Record<string, unknown> = {}) => {
    progressLog.push(stage)
    const elapsed_from_start_ms = Date.now() - startedAt
    console.info('equipment_research_progress', {
      equipment_id: equipment.id,
      equipment_label: equipmentLabel,
      stage,
      elapsed_from_start_ms,
      ...detail,
    })
  }

  logProgress('started', { research_mode: researchMode })
  logResearchTiming('function_start', { equipment_id: equipment.id, research_mode: researchMode }, startedAt)

  logProgress('stage_1_serp_started', { research_mode: researchMode })
  const serpQueryAnalysis: SerpQueryAnalysis[] = []
  const collected = await collectEquipmentResearchEvidence(equipment, options.serpApiKey, {
    researchMode,
    serpRequestTimings: timings.serp_requests,
    serpQueryAnalysis,
    startedAt,
  })
  timings.serp_total_ms = collected.serp_total_ms
  timings.ranking_ms = collected.ranking_ms
  timings.offsets_from_start_ms.serp_complete = Date.now() - startedAt
  timings.offsets_from_start_ms.ranking_complete = timings.offsets_from_start_ms.serp_complete

  logProgress('stage_1_serp_complete', {
    searches_executed: collected.queries_run.length,
    price_sources_returned: collected.price_sources_returned,
    lifecycle_sources_returned: collected.lifecycle_sources_returned,
    specialist_support_sources_returned: collected.specialist_support_sources_returned,
    sources_returned: collected.hits.length,
    serp_total_ms: collected.serp_total_ms,
    ranking_ms: collected.ranking_ms,
    serp_errors: collected.serp_errors.length,
    serp_warning: collected.serp_warning,
  })

  const stage1PriceHits = researchMode === 'lifecycle_only'
    ? []
    : selectOriginalPriceResearchHitsForAi(collected.price_hits)
  const stage1LifecycleHits = researchMode === 'price_only'
    ? []
    : selectLifecycleResearchHitsForAi(collected.lifecycle_hits)
  const stage1Evidence: ResearchEvidenceInput = {
    priceHits: stage1PriceHits,
    lifecycleHits: stage1LifecycleHits,
  }

  if (stage1PriceHits.length === 0 && stage1LifecycleHits.length === 0) {
    throw new Error('No research evidence available for the selected research mode')
  }

  timings.offsets_from_start_ms.stage_1_openai_start = Date.now() - startedAt
  logProgress('stage_1_openai_started', {
    price_sources_for_ai: stage1PriceHits.length,
    lifecycle_sources_for_ai: stage1LifecycleHits.length,
  })

  const stage1OpenAiStartedAt = Date.now()
  const stage1Extracted = await extractEquipmentResearchRecommendation(
    equipment,
    stage1Evidence,
    {
      apiKey: options.openAiApiKey,
      model: options.openAiModel,
      stage: 'snippet',
      researchMode,
    },
  )
  timings.stage_1_openai_ms = Date.now() - stage1OpenAiStartedAt
  timings.offsets_from_start_ms.stage_1_openai_end = Date.now() - startedAt
  logResearchTiming('stage_1_openai', { duration_ms: timings.stage_1_openai_ms }, startedAt)

  logProgress('stage_1_openai_complete', {
    confidence: stage1Extracted.recommendation.confidence,
    duration_ms: timings.stage_1_openai_ms,
  })

  let researchStage: EquipmentResearchDebugLog['research_stage'] = 'stage_1'
  let finalPriceHits = stage1PriceHits
  let finalLifecycleHits = stage1LifecycleHits
  let finalRecommendation = stage1Extracted.recommendation
  let finalPriceCurrencyDebug = stage1Extracted.price_currency_debug
  let finalRawResponse: unknown = stage1Extracted.rawResponse
  const stage1RawResponse = stage1Extracted.rawResponse
  let stage2RawResponse: unknown | undefined
  let sourcesSuccessfullyRead = 0
  let pdfDownloadsAttempted = 0
  const stage1RequestPayload = stage1Extracted.requestPayload
  let stage2RequestPayload: OpenAiResearchRequestPayload | undefined
  let finalOpenAiRequestPayload: OpenAiResearchRequestPayload = stage1RequestPayload

  if (shouldRunStage2Enrichment(stage1Extracted.recommendation.confidence)) {
    logProgress('stage_2_started', {
      reason: 'confidence_below_threshold',
      confidence: stage1Extracted.recommendation.confidence,
      threshold: RESEARCH_STAGE1_CONFIDENCE_THRESHOLD,
    })

    timings.offsets_from_start_ms.stage_2_fetch_start = Date.now() - startedAt
    logProgress('stage_2_fetch_started', {
      max_page_reads: RESEARCH_STAGE2_PAGE_READS,
      max_pdf_downloads: RESEARCH_STAGE2_PDF_DOWNLOADS,
    })

    const enrichmentTargets = selectStage2EnrichmentTargets(stage1PriceHits, stage1LifecycleHits)
    const enriched = await enrichTopResearchHitsForStage2(enrichmentTargets, {
      pageFetchTimings: timings.stage_2_page_fetches,
      startedAt,
      equipment,
      serpApiKey: options.serpApiKey,
    })
    sourcesSuccessfullyRead = enriched.pagesRead
    pdfDownloadsAttempted = enriched.pdfDownloadsAttempted
    timings.stage_2_fetch_total_ms = enriched.stage_2_fetch_total_ms
    timings.offsets_from_start_ms.stage_2_fetch_end = Date.now() - startedAt
    logResearchTiming('stage_2_fetch_total', {
      duration_ms: enriched.stage_2_fetch_total_ms,
      pages_read: sourcesSuccessfullyRead,
    }, startedAt)

    logProgress('stage_2_fetch_complete', {
      sources_successfully_read: sourcesSuccessfullyRead,
      pdf_downloads_attempted: pdfDownloadsAttempted,
      duration_ms: enriched.stage_2_fetch_total_ms,
    })

    const enrichedPricePool = mergeEnrichmentIntoResearchHits(collected.price_hits, enriched.hits)
    const enrichedLifecyclePool = mergeEnrichmentIntoResearchHits(collected.lifecycle_hits, enriched.hits)
    finalPriceHits = selectOriginalPriceResearchHitsForAi(enrichedPricePool)
    finalLifecycleHits = selectLifecycleResearchHitsForAi(enrichedLifecyclePool)

    timings.offsets_from_start_ms.stage_2_openai_start = Date.now() - startedAt
    logProgress('stage_2_openai_started', {
      price_sources_for_ai: finalPriceHits.length,
      lifecycle_sources_for_ai: finalLifecycleHits.length,
    })

    const stage2OpenAiStartedAt = Date.now()
    const stage2Extracted = await extractEquipmentResearchRecommendation(
      equipment,
      {
        priceHits: finalPriceHits,
        lifecycleHits: finalLifecycleHits,
      },
      {
        apiKey: options.openAiApiKey,
        model: options.openAiModel,
        stage: 'enriched',
        researchMode,
      },
    )
    timings.stage_2_openai_ms = Date.now() - stage2OpenAiStartedAt
    timings.offsets_from_start_ms.stage_2_openai_end = Date.now() - startedAt
    logResearchTiming('stage_2_openai', { duration_ms: timings.stage_2_openai_ms }, startedAt)

    stage2RawResponse = stage2Extracted.rawResponse
    finalRecommendation = stage2Extracted.recommendation
    finalPriceCurrencyDebug = stage2Extracted.price_currency_debug
    finalRawResponse = stage2Extracted.rawResponse
    stage2RequestPayload = stage2Extracted.requestPayload
    finalOpenAiRequestPayload = stage2Extracted.requestPayload
    researchStage = 'stage_2'

    logProgress('stage_2_openai_complete', {
      confidence: stage2Extracted.recommendation.confidence,
      duration_ms: timings.stage_2_openai_ms,
    })
    logProgress('stage_2_complete')
  } else {
    logProgress('stage_1_early_exit', {
      confidence: stage1Extracted.recommendation.confidence,
      threshold: RESEARCH_STAGE1_CONFIDENCE_THRESHOLD,
    })
  }

  timings.total_execution_ms = Date.now() - startedAt
  timings.offsets_from_start_ms.function_end = timings.total_execution_ms

  const finalPriceInputSources = hitsToResearchSupportingSources(finalPriceHits)
  const finalLifecycleInputSources = hitsToResearchSupportingSources(finalLifecycleHits)
  const productionInferredFromSources = buildProductionInferenceDebug(
    finalRecommendation,
    collected.lifecycle_hits,
    collected.specialist_support_hits,
  )
  const specialistSupportInputSources = finalLifecycleInputSources.filter(
    (source) => source.source_type === 'specialist_support',
  )
  const sourcesUsedByAi = [
    ...new Set([
      ...finalRecommendation.price_sources_used,
      ...finalRecommendation.production_sources_used,
      ...finalRecommendation.supporting_urls,
    ]),
  ]

  const debugLog: EquipmentResearchDebugLog = {
    equipment_label: equipmentLabel,
    research_stage: researchStage,
    progress_log: progressLog,
    timings,
    serp_query_analysis: collected.serp_query_analysis,
    serp_errors: collected.serp_errors,
    serp_warning: collected.serp_warning,
    price_input_sources: finalPriceInputSources,
    lifecycle_input_sources: finalLifecycleInputSources,
    lifecycle_search_queries: collected.lifecycle_queries_run,
    lifecycle_sources_returned: collected.lifecycle_sources_returned,
    specialist_support_queries: collected.specialist_support_queries_run,
    specialist_support_hits: summarizeSpecialistSupportHits(collected.specialist_support_hits),
    specialist_support_sources: specialistSupportInputSources,
    production_inferred_from_sources: productionInferredFromSources,
    price_sources_returned: collected.price_sources_returned,
    price_currency_debug: finalPriceCurrencyDebug,
    ...buildPriceSourceClassificationDebug(collected.price_hits, equipment.brand),
    price_candidate_debug: buildPriceCandidateDebug(collected.price_hits, equipment.brand),
    serp_unique_queries: collected.queries_run.length,
    serp_raw_url_hits: collected.serp_raw_url_hits,
    serp_duplicate_urls_removed: collected.serp_duplicate_urls_removed,
    openai_request_payload: finalOpenAiRequestPayload,
    openai_stage1_request_payload: stage1RequestPayload,
    openai_stage2_request_payload: stage2RequestPayload,
    searches_executed: collected.queries_run,
    sources_returned: collected.hits.length,
    sources_sent_to_ai: finalPriceHits.length + finalLifecycleHits.length,
    sources_successfully_read: sourcesSuccessfullyRead,
    pdf_downloads_attempted: pdfDownloadsAttempted,
    sources_used_by_ai: sourcesUsedByAi,
    openai_raw_response: finalRawResponse,
    openai_stage1_response: stage1RawResponse,
    openai_stage2_response: stage2RawResponse,
    duration_ms: timings.total_execution_ms,
    ranked_sources: [...finalPriceHits, ...finalLifecycleHits].map((hit) => ({
      title: hit.title,
      url: hit.url,
      domain: hit.domain,
      source_type: hit.source_type,
      page_read_status: hit.page_read_status,
    })),
  }

  console.info('equipment_research_timings', JSON.stringify(timings))
  console.info('equipment_research_debug', JSON.stringify(debugLog))
  console.info('equipment_research_production_sources', JSON.stringify({
    production_start_year: finalRecommendation.production_start_year,
    production_end_year: finalRecommendation.production_end_year,
    production_confidence: finalRecommendation.production_confidence,
    production_inferred_from_sources: productionInferredFromSources,
  }))

  return {
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
    search_hits: [...finalPriceHits, ...finalLifecycleHits],
    ai_input_sources: [...finalPriceInputSources, ...finalLifecycleInputSources],
    price_input_sources: finalPriceInputSources,
    lifecycle_input_sources: finalLifecycleInputSources,
    specialist_support_hits: collected.specialist_support_hits,
    recommendation: finalRecommendation,
    debug_log: debugLog,
  }
}

export function formatResearchSourceTypeLabel(sourceType: ResearchSourceType): string {
  switch (sourceType) {
    case 'manufacturer_pdf':
      return 'Official manufacturer PDF'
    case 'manufacturer_website':
      return 'Official manufacturer website'
    case 'official_distributor':
      return 'Official distributor'
    case 'specialist_support':
      return 'Specialist support / parts company'
    case 'dealer_catalogue':
      return 'Dealer catalogue'
    case 'dealer_historical_reference':
      return 'Dealer historical reference'
    case 'marketplace_resale':
      return 'Marketplace / resale'
    case 'archived_website':
      return 'Archived website'
    default:
      return 'Other'
  }
}
