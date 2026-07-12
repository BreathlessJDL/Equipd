import type { EquipmentIntelligenceRow } from './intelligenceMarketSearch.ts'
import {
  buildEquipmentLifecycleResearchQueries,
  buildEquipmentResearchSearchPhrase,
  buildEquipmentSpecialistSupportResearchQueries,
  buildSerpPartialWarning,
  collectEquipmentResearchEvidence,
  dedupeSerpResearchHits,
  extractResearchDomain,
  hasCatalogueOriginalPriceSignals,
  logResearchTiming,
  rankLifecycleResearchHits,
  rankResearchHits,
  runSerpQueryBatch,
  type EquipmentResearchMode,
  type SerpFetchAttemptResult,
  type SerpQueryAnalysis,
  type SerpQueryError,
  type SerpResearchHit,
  type SerpRequestTiming,
} from './intelligenceEquipmentResearch.ts'
import {
  buildStructuredProductContext,
  collectStructuredEvidenceFromHits,
  extractStructuredPriceEvidenceFromText,
  isV3TrustedUkDealerDomain,
  matchesBrandModel,
  type StructuredEvidenceItem,
  type StructuredProductContext,
} from './intelligenceStructuredEvidence.ts'
import { isTrustedResearchSourceHit } from './intelligenceResearchResourceGuards.ts'

export const SOURCE_FIRST_COMMERCIAL_BRANDS = [
  'life fitness',
  'technogym',
  'precor',
  'matrix fitness',
  'matrix',
  'cybex',
  'true fitness',
  'hammer strength',
  'star trac',
  'concept2',
  'woodway',
  'eleiko',
] as const

export const V3_PRIORITY_DEALER_DOMAINS = [
  'fitkituk.com',
  'fitshop.co.uk',
  'pinnaclefitness.org.uk',
  'fitness-superstore.co.uk',
  'powerhouse-fitness.co.uk',
  'amazonleisure.co.uk',
] as const

export const V3_TRUSTED_DEALER_SITE_SEARCH_TARGETS = [
  { domain: 'fitkituk.com', templates: ['{phrase} RRP', '{phrase} {brand_quote}'] },
  { domain: 'fitshop.co.uk', templates: ['{phrase}'] },
  { domain: 'pinnaclefitness.org.uk', templates: ['{phrase}'] },
  { domain: 'fitness-superstore.co.uk', templates: ['{phrase}'] },
  { domain: 'powerhouse-fitness.co.uk', templates: ['{phrase}'] },
  { domain: 'amazonleisure.co.uk', templates: ['{phrase}'] },
] as const

export const RESEARCH_V3_SOURCE_FIRST_MAX_PAGE_READS = 3

export type V3TrustedSourceSummaryEntry = {
  domain: string
  queries: string[]
  hits_returned: number
  snippet_price_signals: boolean
  structured_evidence_count: number
  page_fetched: boolean
  evidence_labels: string[]
}

export function isSourceFirstCommercialBrand(brand: string): boolean {
  const normalized = brand.toLowerCase().trim()
  if (!normalized) return false
  return SOURCE_FIRST_COMMERCIAL_BRANDS.some((known) => (
    normalized.includes(known) || known.includes(normalized)
  ))
}

export function quoteResearchPhrase(phrase: string): string {
  const trimmed = phrase.trim()
  return trimmed.includes(' ') ? `"${trimmed}"` : trimmed
}

export function buildV3TrustedDealerPriceQueries(
  equipment: EquipmentIntelligenceRow & { core_product_name?: string | null },
): string[] {
  const phrase = buildEquipmentResearchSearchPhrase(equipment)
  const brand = equipment.brand?.trim() ?? ''
  if (!phrase) return []

  const quotedPhrase = quoteResearchPhrase(phrase)
  const queries: string[] = []

  for (const target of V3_TRUSTED_DEALER_SITE_SEARCH_TARGETS) {
    for (const template of target.templates) {
      const query = `site:${target.domain} ${template
        .replace('{phrase}', quotedPhrase)
        .replace('{brand_quote}', quoteResearchPhrase(brand))
        .replace('{brand}', brand)}`.replace(/\s+/g, ' ').trim()
      queries.push(query)
    }
  }

  return queries
}

export function buildV3BroadPriceResearchQueries(
  equipment: EquipmentIntelligenceRow & { core_product_name?: string | null },
): string[] {
  const phrase = buildEquipmentResearchSearchPhrase(equipment)
  if (!phrase) return []

  return [
    `${phrase} MSRP`.replace(/\s+/g, ' ').trim(),
    `${phrase} dealer RRP`.replace(/\s+/g, ' ').trim(),
  ]
}

const MANUFACTURER_DOMAINS: Record<string, string> = {
  'life fitness': 'lifefitness.com',
  'technogym': 'technogym.com',
  'precor': 'precor.com',
  'matrix fitness': 'matrixfitness.com',
  'matrix': 'matrixfitness.com',
  'cybex': 'cybex.com',
  'true fitness': 'truefitness.com',
  'hammer strength': 'hammerstrength.com',
  'concept2': 'concept2.com',
}

export function resolveManufacturerDomain(brand: string): string | null {
  const normalized = brand.toLowerCase().trim()
  for (const [key, domain] of Object.entries(MANUFACTURER_DOMAINS)) {
    if (normalized.includes(key)) return domain
  }
  return null
}

export function buildV3OfficialLifecycleQueries(
  equipment: EquipmentIntelligenceRow & { core_product_name?: string | null },
): string[] {
  const domain = resolveManufacturerDomain(equipment.brand ?? '')
  const phrase = buildEquipmentResearchSearchPhrase(equipment)
  if (!domain || !phrase) return []

  const quotedPhrase = quoteResearchPhrase(phrase)
  return [
    `site:${domain} ${quotedPhrase} discontinued`,
    `site:${domain} ${quotedPhrase} launch`,
  ]
}

export function isV3PriorityDealerDomain(domain: string): boolean {
  const normalized = domain.toLowerCase().replace(/^www\./i, '')
  return V3_PRIORITY_DEALER_DOMAINS.some((known) => (
    normalized === known || normalized.endsWith(`.${known}`)
  ))
}

export function prioritizeTrustedDealerHits(
  hits: SerpResearchHit[],
  brand: string,
): SerpResearchHit[] {
  return [...hits].sort((left, right) => {
    const leftDomain = left.domain || extractResearchDomain(left.url)
    const rightDomain = right.domain || extractResearchDomain(right.url)
    const leftPriority = isV3PriorityDealerDomain(leftDomain) ? 2 : (
      isTrustedResearchSourceHit(left, brand) ? 1 : 0
    )
    const rightPriority = isV3PriorityDealerDomain(rightDomain) ? 2 : (
      isTrustedResearchSourceHit(right, brand) ? 1 : 0
    )
    if (leftPriority !== rightPriority) return rightPriority - leftPriority

    const leftSignals = hasCatalogueOriginalPriceSignals(left) ? 1 : 0
    const rightSignals = hasCatalogueOriginalPriceSignals(right) ? 1 : 0
    if (leftSignals !== rightSignals) return rightSignals - leftSignals

    const leftCombined = left.combined_rank_score ?? 0
    const rightCombined = right.combined_rank_score ?? 0
    if (leftCombined !== rightCombined) return rightCombined - leftCombined
    if (left.position !== right.position) return left.position - right.position
    return left.title.localeCompare(right.title)
  })
}

export function selectV3TrustedEnrichmentTargets(
  priceHits: SerpResearchHit[],
  lifecycleHits: SerpResearchHit[],
  brand: string,
  maxPageReads = RESEARCH_V3_SOURCE_FIRST_MAX_PAGE_READS,
): SerpResearchHit[] {
  const selected: SerpResearchHit[] = []
  const seenUrls = new Set<string>()

  const addHit = (hit: SerpResearchHit) => {
    const urlKey = hit.url.trim().toLowerCase()
    if (!urlKey || seenUrls.has(urlKey)) return
    seenUrls.add(urlKey)
    selected.push(hit)
  }

  const trustedPrice = prioritizeTrustedDealerHits(priceHits, brand)
    .filter((hit) => isTrustedResearchSourceHit(hit, brand))

  for (const hit of trustedPrice.slice(0, Math.min(2, maxPageReads))) {
    addHit(hit)
    if (selected.length >= maxPageReads) return selected
  }

  const manufacturerDomain = resolveManufacturerDomain(brand)
  const lifecycleOrdered = [...lifecycleHits].sort((left, right) => {
    const leftDomain = left.domain || extractResearchDomain(left.url)
    const rightDomain = right.domain || extractResearchDomain(right.url)
    const leftOfficial = manufacturerDomain && leftDomain.includes(manufacturerDomain) ? 1 : 0
    const rightOfficial = manufacturerDomain && rightDomain.includes(manufacturerDomain) ? 1 : 0
    if (leftOfficial !== rightOfficial) return rightOfficial - leftOfficial
    return (right.combined_rank_score ?? 0) - (left.combined_rank_score ?? 0)
  })

  for (const hit of lifecycleOrdered) {
    addHit(hit)
    if (selected.length >= maxPageReads) break
  }

  return selected
}

export function trustedDealerPriceSignalsSufficient(
  hits: SerpResearchHit[],
  evidence: StructuredEvidenceItem[],
): boolean {
  const eligibleEvidence = evidence.filter((item) => (
    item.type === 'price'
    && item.rejectionReason == null
    && item.eligibleForOriginalPrice
  ))
  if (eligibleEvidence.length > 0) return true

  const trustedWithSignals = hits.filter((hit) => {
    const domain = hit.domain || extractResearchDomain(hit.url)
    return isV3TrustedUkDealerDomain(domain) && hasCatalogueOriginalPriceSignals(hit)
  })

  return trustedWithSignals.length >= 2
}

export function hasTrustedSnippetEvidenceForReview(
  hits: SerpResearchHit[],
  brand: string,
): boolean {
  return hits.some((hit) => {
    const domain = hit.domain || extractResearchDomain(hit.url)
    if (!isTrustedResearchSourceHit(hit, brand) && !isV3PriorityDealerDomain(domain)) {
      return false
    }
    return hasCatalogueOriginalPriceSignals(hit)
      || Boolean(hit.snippet?.match(/£[\d,]{3,}/))
  })
}

export function collectSnippetOnlyStructuredEvidence(
  hits: SerpResearchHit[],
  equipment: EquipmentIntelligenceRow & {
    product_family?: string | null
    core_product_name?: string | null
  },
  options: { maxPerPage?: number; maxTotal?: number } = {},
): StructuredEvidenceItem[] {
  const snippetHits = hits.map((hit) => ({
    ...hit,
    page_content: hit.snippet
      ? `Search snippet: ${hit.snippet}\nSearch title: ${hit.title}`
      : hit.title ? `Search title: ${hit.title}` : null,
    page_read_status: 'snippet_only' as const,
  }))

  return collectStructuredEvidenceFromHits(snippetHits, equipment, options)
}

export function buildTrustedSnippetReviewEvidence(
  hits: SerpResearchHit[],
  equipment: EquipmentIntelligenceRow & {
    product_family?: string | null
    core_product_name?: string | null
  },
): StructuredEvidenceItem[] {
  const context = buildStructuredProductContext(equipment)
  const items: StructuredEvidenceItem[] = []
  const seen = new Set<string>()

  for (const hit of hits) {
    const domain = hit.domain || extractResearchDomain(hit.url)
    if (!isV3TrustedUkDealerDomain(domain) && !isV3PriorityDealerDomain(domain)) continue

    const haystack = [hit.title, hit.snippet].filter(Boolean).join('\n')
    if (!haystack.trim()) continue

    const extracted = extractStructuredPriceEvidenceFromText(haystack, {
      sourceUrl: hit.url,
      sourceDomain: domain,
      sourceType: hit.source_type ?? 'dealer_catalogue',
      brand: equipment.brand,
    }, context)

    for (const item of extracted) {
      if (item.isFinancePrice || item.isMarketplace) continue
      const key = `${item.label}:${item.value}:${item.sourceUrl}`
      if (seen.has(key)) continue
      seen.add(key)
      items.push(item)
    }

    const barePrice = extractTrustedDealerBarePrice(haystack, hit, context)
    if (barePrice) {
      const key = `${barePrice.label}:${barePrice.value}:${barePrice.sourceUrl}`
      if (!seen.has(key)) {
        seen.add(key)
        items.push(barePrice)
      }
    }
  }

  return items.sort((left, right) => right.score - left.score)
}

function extractTrustedDealerBarePrice(
  haystack: string,
  hit: SerpResearchHit,
  context: StructuredProductContext,
): StructuredEvidenceItem | null {
  if (!matchesBrandModelLoose(context, haystack)) return null

  const domain = hit.domain || extractResearchDomain(hit.url)
  const rrpMatch = haystack.match(/\brrp\b[^£$€\d]{0,40}£\s*([\d,]{3,}(?:\.\d{2})?)/i)
  const msrpMatch = haystack.match(/\bmsrp\b[^£$€\d]{0,40}£\s*([\d,]{3,}(?:\.\d{2})?)/i)
  if (rrpMatch || msrpMatch) {
    return null
  }

  const match = haystack.match(/£\s*([\d,]{3,}(?:\.\d{2})?)/)
  if (!match) return null

  const value = Number(match[1].replace(/,/g, ''))
  if (!Number.isFinite(value) || value <= 0) return null

  const hasRetailLabel = /\b(?:list\s+price|retail\s+price|original\s+price)\b/i.test(haystack)
  const label = hasRetailLabel ? 'List Price' : 'Dealer Price'

  return {
    id: `snippet-price-${domain}-${value}`,
    type: 'price',
    label,
    value,
    currency: 'GBP',
    year: null,
    yearEnd: null,
    surroundingText: haystack.slice(0, 240),
    sourceUrl: hit.url,
    sourceDomain: domain,
    sourceType: hit.source_type ?? 'dealer_catalogue',
    sourceScore: 8,
    confidence: hasRetailLabel ? 55 : 35,
    score: hasRetailLabel ? 60 : 40,
    eligibleForOriginalPrice: hasRetailLabel,
    rejectionReason: hasRetailLabel ? null : 'dealer_price_without_rrp_label',
    extractionMethod: 'structured',
    nearModelName: true,
    brandModelMatch: true,
    productFamilyMatch: false,
    identityScore: null,
    identityLevel: null,
    identityLabel: null,
    isMarketplace: false,
    isFinancePrice: false,
  }
}

function matchesBrandModelLoose(context: StructuredProductContext, haystack: string): boolean {
  return matchesBrandModel(context, haystack)
}

export function buildV3TrustedSourceSummary(
  trustedQueries: string[],
  hits: SerpResearchHit[],
  evidence: StructuredEvidenceItem[],
  fetchedUrls: Set<string>,
): V3TrustedSourceSummaryEntry[] {
  const byDomain = new Map<string, V3TrustedSourceSummaryEntry>()

  for (const domain of V3_PRIORITY_DEALER_DOMAINS) {
    byDomain.set(domain, {
      domain,
      queries: trustedQueries.filter((query) => query.includes(`site:${domain}`)),
      hits_returned: 0,
      snippet_price_signals: false,
      structured_evidence_count: 0,
      page_fetched: false,
      evidence_labels: [],
    })
  }

  for (const hit of hits) {
    const domain = (hit.domain || extractResearchDomain(hit.url)).replace(/^www\./i, '')
    const entry = [...byDomain.values()].find((candidate) => (
      domain === candidate.domain || domain.endsWith(`.${candidate.domain}`)
    ))
    if (!entry) continue

    entry.hits_returned += 1
    if (hasCatalogueOriginalPriceSignals(hit)) {
      entry.snippet_price_signals = true
    }
    if (fetchedUrls.has(hit.url.trim().toLowerCase())) {
      entry.page_fetched = true
    }
  }

  for (const item of evidence) {
    const entry = [...byDomain.values()].find((candidate) => (
      item.sourceDomain === candidate.domain || item.sourceDomain.endsWith(`.${candidate.domain}`)
    ))
    if (!entry) continue
    entry.structured_evidence_count += 1
    if (!entry.evidence_labels.includes(item.label)) {
      entry.evidence_labels.push(item.label)
    }
  }

  return [...byDomain.values()]
}

export function mergeStructuredEvidence(
  ...groups: StructuredEvidenceItem[][]
): StructuredEvidenceItem[] {
  const seen = new Set<string>()
  const merged: StructuredEvidenceItem[] = []

  for (const group of groups) {
    for (const item of group) {
      const key = `${item.type}:${item.label}:${item.value}:${item.sourceUrl}:${item.year ?? ''}`
      if (seen.has(key)) continue
      seen.add(key)
      merged.push(item)
    }
  }

  return merged.sort((left, right) => right.score - left.score)
}

export function resolveV3SourceFirstPageReadLimit(
  priceHits: SerpResearchHit[],
  brand: string,
): number {
  const trusted = prioritizeTrustedDealerHits(priceHits, brand)
    .filter((hit) => isTrustedResearchSourceHit(hit, brand))
  const withSignals = trusted.filter((hit) => hasCatalogueOriginalPriceSignals(hit))

  if (withSignals.length >= 2) return Math.min(2, trusted.length || 2)
  if (withSignals.length === 1) return Math.min(2, trusted.length || 2)
  return Math.min(RESEARCH_V3_SOURCE_FIRST_MAX_PAGE_READS, trusted.length || RESEARCH_V3_SOURCE_FIRST_MAX_PAGE_READS)
}

export async function collectV3SourceFirstResearchEvidence(
  equipment: EquipmentIntelligenceRow & { core_product_name?: string | null },
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
    trustedDealerPriceQueries?: string[]
    broadPriceQueries?: string[]
    officialLifecycleQueries?: string[]
    useSourceFirst?: boolean
  } = {},
): Promise<Awaited<ReturnType<typeof collectEquipmentResearchEvidence>> & {
  research_strategy: 'source_first' | 'standard'
  trusted_queries_run: string[]
  broad_queries_run: string[]
}> {
  const researchMode = options.researchMode ?? 'full'
  const useSourceFirst = options.useSourceFirst ?? isSourceFirstCommercialBrand(equipment.brand ?? '')

  if (!useSourceFirst) {
    const standard = await collectEquipmentResearchEvidence(equipment, apiKey, options)
    return {
      ...standard,
      research_strategy: 'standard',
      trusted_queries_run: [],
      broad_queries_run: [],
    }
  }

  const includePrice = researchMode === 'full' || researchMode === 'price_only'
  const includeLifecycle = researchMode === 'full' || researchMode === 'lifecycle_only'
  const trustedQueries = options.trustedDealerPriceQueries ?? buildV3TrustedDealerPriceQueries(equipment)
  const broadQueries = options.broadPriceQueries ?? buildV3BroadPriceResearchQueries(equipment)
  const lifecycleQueries = buildEquipmentLifecycleResearchQueries(equipment)
  const officialLifecycleQueries = options.officialLifecycleQueries ?? buildV3OfficialLifecycleQueries(equipment)
  const specialistQueries = buildEquipmentSpecialistSupportResearchQueries(equipment)
  const serpStartedAt = Date.now()
  const serpErrors: SerpQueryError[] = options.serpErrors ?? []
  const emptyBatch = { hits: [] as SerpResearchHit[] }

  const trustedBatch = includePrice
    ? await runSerpQueryBatch(trustedQueries, apiKey, { ...options, serpErrors })
    : emptyBatch

  let trustedRanked = includePrice
    ? rankResearchHits(dedupeSerpResearchHits(trustedBatch.hits), equipment.brand)
    : []
  trustedRanked = prioritizeTrustedDealerHits(trustedRanked, equipment.brand)

  const snippetEvidence = includePrice
    ? collectSnippetOnlyStructuredEvidence(trustedRanked, equipment)
    : []

  const runBroadPrice = includePrice
    && !trustedDealerPriceSignalsSufficient(trustedRanked, snippetEvidence)

  const broadBatch = runBroadPrice
    ? await runSerpQueryBatch(broadQueries, apiKey, { ...options, serpErrors })
    : emptyBatch

  const combinedLifecycleQueries = [
    ...lifecycleQueries,
    ...officialLifecycleQueries,
  ]

  const lifecycleBatch = includeLifecycle
    ? await runSerpQueryBatch(combinedLifecycleQueries, apiKey, { ...options, serpErrors })
    : emptyBatch
  const specialistBatch = includeLifecycle
    ? await runSerpQueryBatch(specialistQueries, apiKey, { ...options, serpErrors })
    : emptyBatch

  const price_raw_hits = trustedBatch.hits.length + broadBatch.hits.length
  const lifecycle_raw_hits = lifecycleBatch.hits.length
  const specialist_raw_hits = specialistBatch.hits.length
  const totalQueries = (
    (includePrice ? trustedQueries.length + (runBroadPrice ? broadQueries.length : 0) : 0)
    + (includeLifecycle ? combinedLifecycleQueries.length + specialistQueries.length : 0)
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
  const priceDeduped = dedupeSerpResearchHits([
    ...trustedBatch.hits,
    ...broadBatch.hits,
  ])
  const lifecycleLegacyDeduped = dedupeSerpResearchHits(lifecycleBatch.hits)
  const specialistDeduped = dedupeSerpResearchHits(specialistBatch.hits)
  const lifecycleCombinedDeduped = dedupeSerpResearchHits([
    ...lifecycleBatch.hits,
    ...specialistBatch.hits,
  ])

  const price_hits = includePrice
    ? prioritizeTrustedDealerHits(
      rankResearchHits(priceDeduped, equipment.brand),
      equipment.brand,
    )
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
  const priceQueriesRun = [
    ...trustedQueries,
    ...(runBroadPrice ? broadQueries : []),
  ]

  logResearchTiming('serp_total', {
    duration_ms: serp_total_ms,
    request_count: totalQueries,
    research_mode: researchMode,
    research_strategy: 'source_first',
    price_sources_returned: price_hits.length,
    lifecycle_sources_returned: lifecycle_hits.length,
    specialist_support_sources_returned: specialist_support_hits.length,
    broad_price_queries_run: runBroadPrice,
  }, options.startedAt ?? serpStartedAt)
  logResearchTiming('ranking', {
    duration_ms: ranking_ms,
    price_source_count: price_hits.length,
    lifecycle_source_count: lifecycle_hits.length,
    specialist_support_source_count: specialist_support_hits.length,
  }, options.startedAt ?? serpStartedAt)

  return {
    price_queries_run: includePrice ? priceQueriesRun : [],
    lifecycle_queries_run: includeLifecycle ? lifecycleQueries : [],
    specialist_support_queries_run: includeLifecycle ? specialistQueries : [],
    queries_run: [
      ...(includePrice ? priceQueriesRun : []),
      ...(includeLifecycle ? [...combinedLifecycleQueries, ...specialistQueries] : []),
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
    research_strategy: 'source_first',
    trusted_queries_run: includePrice ? trustedQueries : [],
    broad_queries_run: includePrice && runBroadPrice ? broadQueries : [],
  }
}
