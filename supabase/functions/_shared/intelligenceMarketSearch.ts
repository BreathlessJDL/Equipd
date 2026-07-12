import {
  fetchCandidatePages,
  type PageFetchResult,
} from './intelligencePageExtract.ts'
import {
  buildAcceptedReason,
  findQualityRejection,
  getMinimumUsedPrice,
  hasUsedSignal,
  type QualityEquipmentContext,
} from './intelligenceCandidateQuality.ts'

export type EquipmentIntelligenceRow = {
  id: string
  brand: string
  series: string | null
  model: string
  slug: string
  category?: string | null
  equipment_type?: string | null
  original_rrp?: number | null
}

export type MarketSearchCandidate = {
  price: number | null
  currency: 'GBP'
  source_domain: string
  url: string
  title: string
  snippet: string
  confidence: number
  status: 'accepted' | 'rejected'
  reason: string
  page_fetch_status: 'fetched' | 'failed' | 'skipped'
  page_fetch_error: string | null
  price_source: 'snippet' | 'page' | 'json_ld' | null
}

export type PageFetchFailure = {
  url: string
  error: string
}

export type SearchQueryPlanItem = {
  text: string
  region: 'uk' | 'broad'
}

export type MarketSearchCollectionResult = {
  queries_run: string[]
  raw_result_count: number
  deduped_result_count: number
  pages_fetched: number
  pages_failed: number
  prices_found: number
  page_fetch_failures: PageFetchFailure[]
  candidates: MarketSearchCandidate[]
  accepted_count: number
  rejected_count: number
}

type BraveWebResult = {
  title: string
  url: string
  snippet: string
}

type SimilarityLevel = 'High' | 'Medium' | 'Low'

type SimilarityResult = {
  level: SimilarityLevel
  confidence: number
  reason: string
  exactModelMatch: boolean
}

type PriceMatch = {
  price: number
  score: number
  source: 'snippet' | 'page' | 'json_ld'
}

const GBP_PRICE_PATTERNS = [
  /£\s*([\d]{1,3}(?:,\d{3})*(?:\.\d{2})?|\d+(?:\.\d{2})?)/gi,
  /([\d]{1,3}(?:,\d{3})*(?:\.\d{2})?|\d+(?:\.\d{2})?)\s*gbp/gi,
  /gbp\s*([\d]{1,3}(?:,\d{3})*(?:\.\d{2})?|\d+(?:\.\d{2})?)/gi,
]

const NON_GBP_CURRENCY_PATTERNS = [
  /\$\s*[\d,]+(?:\.\d{2})?/i,
  /\bUSD\b/i,
  /€\s*[\d,]+(?:\.\d{2})?/i,
  /\bEUR\b/i,
  /\bAUD\b/i,
  /\bCAD\b/i,
  /\bNZD\b/i,
]

const BRAND_ALIAS_GROUPS: string[][] = [
  ['Concept II', 'Concept 2', 'Concept2', 'Concept ii', 'ConceptII'],
]

export function normalizeWhitespace(value: string): string {
  return String(value ?? '').trim().replace(/\s+/g, ' ')
}

export function removeDuplicateWords(phrase: string): string {
  const words = normalizeWhitespace(phrase).split(' ').filter(Boolean)
  const seen = new Set<string>()
  const result: string[] = []

  for (const word of words) {
    const key = word.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    result.push(word)
  }

  return result.join(' ')
}

export function removeDuplicatePhrases(phrase: string): string {
  const words = normalizeWhitespace(phrase).split(' ').filter(Boolean)
  if (words.length < 2) return words.join(' ')

  for (let size = Math.floor(words.length / 2); size >= 1; size -= 1) {
    for (let index = 0; index <= words.length - size * 2; index += 1) {
      const left = words.slice(index, index + size).join(' ').toLowerCase()
      const right = words.slice(index + size, index + size * 2).join(' ').toLowerCase()

      if (left === right) {
        const nextWords = [
          ...words.slice(0, index + size),
          ...words.slice(index + size * 2),
        ]
        return removeDuplicatePhrases(nextWords.join(' '))
      }
    }
  }

  return words.join(' ')
}

function normalizeBrandKey(brand: string): string {
  return brand.toLowerCase().replace(/[^a-z0-9]+/g, '')
}

export function getBrandAliases(brand: string): string[] {
  const normalizedBrand = normalizeWhitespace(brand)
  if (!normalizedBrand) return []

  const aliases = new Set<string>([normalizedBrand])
  const brandKey = normalizeBrandKey(normalizedBrand)

  for (const group of BRAND_ALIAS_GROUPS) {
    const normalizedGroup = group.map((alias) => normalizeBrandKey(alias))
    if (normalizedGroup.includes(brandKey)) {
      for (const alias of group) {
        aliases.add(alias)
      }
    }
  }

  return [...aliases]
}

export function buildModelPhrase(series: string, model: string): string {
  const normalizedSeries = normalizeWhitespace(series)
  const normalizedModel = normalizeWhitespace(model)

  if (!normalizedModel) return removeDuplicatePhrases(removeDuplicateWords(normalizedSeries))
  if (!normalizedSeries) {
    return removeDuplicatePhrases(removeDuplicateWords(normalizedModel))
  }

  const seriesLower = normalizedSeries.toLowerCase()
  const modelLower = normalizedModel.toLowerCase()

  if (modelLower.includes(seriesLower)) {
    return removeDuplicatePhrases(removeDuplicateWords(normalizedModel))
  }

  return removeDuplicatePhrases(
    removeDuplicateWords(`${normalizedSeries} ${normalizedModel}`),
  )
}

function uniqueQueries(items: SearchQueryPlanItem[]): SearchQueryPlanItem[] {
  const seen = new Set<string>()
  const result: SearchQueryPlanItem[] = []

  for (const item of items) {
    const key = `${item.region}:${item.text.toLowerCase()}`
    if (seen.has(key)) continue
    seen.add(key)
    result.push(item)
  }

  return result
}

export function buildSearchQueryPlan(equipment: EquipmentIntelligenceRow): SearchQueryPlanItem[] {
  const brand = normalizeWhitespace(equipment.brand ?? '')
  const modelPhrase = buildModelPhrase(equipment.series ?? '', equipment.model ?? '')
  const equipmentType = normalizeWhitespace(equipment.equipment_type ?? '')
  const brandAliases = getBrandAliases(brand)
  const plan: SearchQueryPlanItem[] = []

  for (const alias of brandAliases) {
    if (modelPhrase) {
      plan.push({ text: `${alias} ${modelPhrase} used`, region: 'broad' })
      plan.push({ text: `${alias} ${modelPhrase} for sale`, region: 'broad' })
      plan.push({ text: `${alias} ${modelPhrase} pre-owned`, region: 'broad' })
      plan.push({ text: `${alias} ${modelPhrase} used gym equipment`, region: 'broad' })
      plan.push({ text: `${alias} ${modelPhrase} used UK`, region: 'uk' })
      plan.push({ text: `${alias} ${modelPhrase} for sale UK`, region: 'uk' })
      plan.push({ text: `${alias} ${modelPhrase} second hand UK`, region: 'uk' })
    }

    if (equipmentType) {
      plan.push({ text: `${alias} ${equipmentType} used`, region: 'broad' })
      plan.push({ text: `${alias} ${equipmentType} for sale`, region: 'broad' })
      plan.push({ text: `${alias} ${equipmentType} used UK`, region: 'uk' })
    }
  }

  return uniqueQueries(plan.filter((item) => item.text.trim() !== ''))
}

export function buildSearchQueries(equipment: EquipmentIntelligenceRow): string[] {
  return buildSearchQueryPlan(equipment).map((item) => item.text)
}

function brandMatchesText(text: string, brand: string): boolean {
  const haystack = text.toLowerCase()
  const aliases = getBrandAliases(brand)

  return aliases.some((alias) => {
    const needle = alias.toLowerCase()
    if (haystack.includes(needle)) return true

    const compactNeedle = needle.replace(/[^a-z0-9]+/g, '')
    const compactHaystack = haystack.replace(/[^a-z0-9]+/g, '')
    return compactNeedle.length > 0 && compactHaystack.includes(compactNeedle)
  })
}

function buildContextTerms(equipment: EquipmentIntelligenceRow): string[] {
  const brand = normalizeWhitespace(equipment.brand ?? '')
  const modelPhrase = buildModelPhrase(equipment.series ?? '', equipment.model ?? '')
  const model = normalizeWhitespace(equipment.model ?? '')
  const series = normalizeWhitespace(equipment.series ?? '')

  return [...new Set([
    ...getBrandAliases(brand),
    modelPhrase,
    model,
    series,
    equipment.equipment_type ?? '',
  ].filter(Boolean))]
}

export function normalizeResultUrl(url: string): string {
  try {
    const parsed = new URL(url.trim())
    parsed.hash = ''
    let normalized = parsed.toString()
    if (normalized.endsWith('/')) {
      normalized = normalized.slice(0, -1)
    }
    return normalized.toLowerCase()
  } catch {
    return url.trim().toLowerCase()
  }
}

export function getSourceDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./i, '')
  } catch {
    return ''
  }
}

function tokenize(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 1)
}

function hasNonGbpCurrencyNear(text: string, start: number, end: number): boolean {
  const window = text.slice(Math.max(0, start - 24), Math.min(text.length, end + 24))
  return NON_GBP_CURRENCY_PATTERNS.some((pattern) => pattern.test(window))
}

function scorePriceProximity(text: string, index: number, contextTerms: string[]): number {
  const window = text
    .slice(Math.max(0, index - 220), Math.min(text.length, index + 220))
    .toLowerCase()

  let score = 0
  for (const term of contextTerms) {
    const normalized = term.toLowerCase().trim()
    if (!normalized) continue
    if (window.includes(normalized)) score += 12
  }

  return score
}

export function findBestGbpPrice(
  sources: Array<{ text: string; source: 'snippet' | 'page' | 'json_ld' }>,
  contextTerms: string[],
): PriceMatch | null {
  const matches: PriceMatch[] = []

  for (const { text, source } of sources) {
    if (!text) continue

    for (const pattern of GBP_PRICE_PATTERNS) {
      const globalPattern = new RegExp(pattern.source, 'gi')
      let match: RegExpExecArray | null = globalPattern.exec(text)

      while (match) {
        const amount = Number(match[1]?.replace(/,/g, ''))
        const matchStart = match.index ?? 0
        const matchEnd = matchStart + match[0].length

        if (Number.isFinite(amount) && amount > 0 && amount < 500_000) {
          if (!hasNonGbpCurrencyNear(text, matchStart, matchEnd)) {
            matches.push({
              price: Math.round(amount),
              score: scorePriceProximity(text, matchStart, contextTerms),
              source,
            })
          }
        }

        match = globalPattern.exec(text)
      }
    }
  }

  if (matches.length === 0) return null

  matches.sort((left, right) => {
    if (right.score !== left.score) return right.score - left.score
    return left.price - right.price
  })

  return matches[0]
}

function toQualityEquipmentContext(equipment: EquipmentIntelligenceRow): QualityEquipmentContext {
  return {
    brand: equipment.brand,
    series: equipment.series,
    model: equipment.model,
    category: equipment.category ?? null,
    equipment_type: equipment.equipment_type ?? null,
    original_rrp: equipment.original_rrp ?? null,
  }
}

function buildRejectedCandidate(
  base: Omit<MarketSearchCandidate, 'status' | 'reason' | 'confidence'>,
  reason: string,
  confidence = 30,
): MarketSearchCandidate {
  return {
    ...base,
    confidence,
    status: 'rejected',
    reason,
  }
}

export function extractGbpPrice(text: string): number | null {
  const match = findBestGbpPrice([{ text, source: 'snippet' }], [])
  return match?.price ?? null
}

function scoreModelSimilarity(
  equipment: EquipmentIntelligenceRow,
  text: string,
): SimilarityResult {
  const brand = normalizeWhitespace(equipment.brand ?? '')
  const modelPhrase = buildModelPhrase(equipment.series ?? '', equipment.model ?? '')
  const model = normalizeWhitespace(equipment.model ?? '')
  const series = normalizeWhitespace(equipment.series ?? '')

  if (!brand || !brandMatchesText(text, brand)) {
    return {
      level: 'Low',
      confidence: 40,
      reason: 'Brand not clearly matched in result',
      exactModelMatch: false,
    }
  }

  const textLower = text.toLowerCase()
  const modelPhraseLower = modelPhrase.toLowerCase()
  const modelLower = model.toLowerCase()

  if (modelPhraseLower && textLower.includes(modelPhraseLower)) {
    return {
      level: 'High',
      confidence: 90,
      reason: 'Brand and model phrase match',
      exactModelMatch: true,
    }
  }

  if (modelLower && textLower.includes(modelLower)) {
    return {
      level: 'High',
      confidence: 88,
      reason: 'Brand and full model match',
      exactModelMatch: true,
    }
  }

  const modelTokens = tokenize(modelPhrase || model).filter((token) => token.length > 2)
  const seriesTokens = tokenize(series).filter((token) => token.length > 2)
  const matchedModelTokens = modelTokens.filter((token) => textLower.includes(token))
  const matchedSeriesTokens = seriesTokens.filter((token) => textLower.includes(token))

  if (modelTokens.length > 0 && matchedModelTokens.length === modelTokens.length) {
    return {
      level: 'High',
      confidence: 85,
      reason: 'Brand and model terms match',
      exactModelMatch: true,
    }
  }

  if (matchedModelTokens.length > 0) {
    return {
      level: 'Medium',
      confidence: 72,
      reason: 'Brand and partial model match',
      exactModelMatch: false,
    }
  }

  if (series && textLower.includes(series.toLowerCase())) {
    return {
      level: 'Medium',
      confidence: 68,
      reason: 'Brand and series match',
      exactModelMatch: false,
    }
  }

  if (matchedSeriesTokens.length > 0) {
    return {
      level: 'Medium',
      confidence: 65,
      reason: 'Brand and partial series match',
      exactModelMatch: false,
    }
  }

  return {
    level: 'Low',
    confidence: 48,
    reason: 'Weak model similarity',
    exactModelMatch: false,
  }
}

export function classifyEnrichedSearchResult(
  equipment: EquipmentIntelligenceRow,
  result: BraveWebResult,
  pageFetch: PageFetchResult | null,
  options: { pageFetchAttempted: boolean },
): MarketSearchCandidate {
  const braveTitle = result.title?.trim() ?? ''
  const braveSnippet = result.snippet?.trim() ?? ''
  const url = result.url?.trim() ?? ''
  const pageContent = pageFetch?.ok ? pageFetch.content : undefined
  const pageTitle = pageContent?.title ?? ''
  const title = pageTitle || braveTitle
  const contextTerms = buildContextTerms(equipment)
  const qualityEquipment = toQualityEquipmentContext(equipment)

  const pageFetchStatus: MarketSearchCandidate['page_fetch_status'] = !options.pageFetchAttempted
    ? 'skipped'
    : pageFetch?.ok
    ? 'fetched'
    : 'failed'
  const pageFetchError = pageFetch?.ok ? null : pageFetch?.error ?? null

  const combinedText = [
    braveTitle,
    braveSnippet,
    pageContent?.metaDescription ?? '',
    pageContent?.jsonLdText ?? '',
    pageContent?.bodyText ?? '',
  ]
    .filter(Boolean)
    .join(' ')

  const snippet = normalizeWhitespace(
    [braveSnippet, pageContent?.metaDescription ?? ''].filter(Boolean).join(' — '),
  )

  const priceSources = buildPriceSources(braveTitle, braveSnippet, pageContent)
  const similarity = scoreModelSimilarity(equipment, combinedText)
  const priceMatch = findBestGbpPrice(priceSources, contextTerms)
  const priceNearModelTerms = (priceMatch?.score ?? 0) > 0
  const sanityFloor = getMinimumUsedPrice(qualityEquipment)

  const candidateBase = {
    price: priceMatch?.price ?? null,
    currency: 'GBP' as const,
    source_domain: getSourceDomain(url),
    url,
    title,
    snippet,
    page_fetch_status: pageFetchStatus,
    page_fetch_error: pageFetchError,
    price_source: priceMatch?.source ?? null,
  }

  const qualityRejection = findQualityRejection(
    combinedText,
    qualityEquipment,
    priceMatch?.price ?? null,
    {
      similarityLevel: similarity.level,
      hasStrongModelMatch: similarity.level === 'High',
      priceNearModelTerms,
    },
  )

  if (qualityRejection) {
    return buildRejectedCandidate(
      candidateBase,
      appendPageFetchNote(qualityRejection.reason, pageFetchStatus, pageFetchError),
      similarity.confidence,
    )
  }

  if (!priceMatch) {
    return buildRejectedCandidate(
      { ...candidateBase, price: null, price_source: null },
      appendPageFetchNote(
        pageFetchStatus === 'failed'
          ? 'No GBP price found (page fetch failed)'
          : 'No GBP price found in snippet or fetched page',
        pageFetchStatus,
        pageFetchError,
      ),
      similarity.confidence,
    )
  }

  const acceptedReason = buildAcceptedReason({
    similarityLevel: similarity.level,
    exactModelMatch: similarity.exactModelMatch,
    usedSignalFound: hasUsedSignal(combinedText),
    priceNearModelTerms,
    sanityFloor,
  })

  return {
    ...candidateBase,
    price: priceMatch.price,
    price_source: priceMatch.source,
    confidence: Math.min(
      95,
      similarity.confidence + Math.min(10, Math.floor(priceMatch.score / 4)),
    ),
    status: 'accepted',
    reason: appendPageFetchNote(acceptedReason, pageFetchStatus, pageFetchError),
  }
}

function buildPriceSources(
  braveTitle: string,
  braveSnippet: string,
  pageContent?: {
    metaDescription: string
    jsonLdText: string
    bodyText: string
    combinedText: string
  },
): Array<{ text: string; source: 'snippet' | 'page' | 'json_ld' }> {
  const sources: Array<{ text: string; source: 'snippet' | 'page' | 'json_ld' }> = [
    { text: `${braveTitle} ${braveSnippet}`.trim(), source: 'snippet' },
  ]

  if (pageContent?.jsonLdText) {
    sources.push({ text: pageContent.jsonLdText, source: 'json_ld' })
  }

  if (pageContent) {
    sources.push({
      text: [
        pageContent.metaDescription,
        pageContent.bodyText,
        pageContent.combinedText,
      ]
        .filter(Boolean)
        .join(' '),
      source: 'page',
    })
  }

  return sources
}

function appendPageFetchNote(
  reason: string,
  pageFetchStatus: MarketSearchCandidate['page_fetch_status'],
  pageFetchError: string | null,
): string {
  if (pageFetchStatus === 'failed' && pageFetchError) {
    return `${reason} (page fetch: ${pageFetchError})`
  }
  return reason
}

export async function searchBraveWeb(
  query: string,
  apiKey: string,
  options: { country?: string | null } = {},
): Promise<BraveWebResult[]> {
  const url = new URL('https://api.search.brave.com/res/v1/web/search')
  url.searchParams.set('q', query)
  url.searchParams.set('count', '10')
  url.searchParams.set('search_lang', 'en')

  if (options.country) {
    url.searchParams.set('country', options.country)
  }

  const response = await fetch(url.toString(), {
    headers: {
      Accept: 'application/json',
      'Accept-Encoding': 'gzip',
      'X-Subscription-Token': apiKey,
    },
  })

  const responseText = await response.text()

  if (!response.ok) {
    let message = responseText.trim()

    try {
      const parsed = JSON.parse(responseText)
      message = parsed?.message || parsed?.error || message
    } catch {
      // keep raw text
    }

    throw new Error(
      message
        ? `Brave Search API error (${response.status}): ${message}`
        : `Brave Search API error (${response.status})`,
    )
  }

  let payload: { web?: { results?: Array<{ title?: string; url?: string; description?: string }> } }

  try {
    payload = JSON.parse(responseText)
  } catch {
    throw new Error('Brave Search API returned an invalid JSON response')
  }

  const results = payload?.web?.results ?? []

  return results.map((result) => ({
    title: result.title ?? '',
    url: result.url ?? '',
    snippet: result.description ?? '',
  }))
}

export function dedupeSearchResults(results: BraveWebResult[]): BraveWebResult[] {
  const seen = new Set<string>()
  const deduped: BraveWebResult[] = []

  for (const result of results) {
    const url = result.url?.trim()
    if (!url) continue

    const key = normalizeResultUrl(url)
    if (seen.has(key)) continue

    seen.add(key)
    deduped.push({
      title: result.title ?? '',
      url,
      snippet: result.snippet ?? '',
    })
  }

  return deduped
}

export function rankAndLimitCandidates(
  candidates: MarketSearchCandidate[],
  limit = 15,
): MarketSearchCandidate[] {
  const statusOrder = { accepted: 0, rejected: 1 } as const

  return [...candidates]
    .sort((left, right) => {
      const statusDiff = statusOrder[left.status] - statusOrder[right.status]
      if (statusDiff !== 0) return statusDiff
      return right.confidence - left.confidence
    })
    .slice(0, limit)
}

async function runQueryPlan(
  plan: SearchQueryPlanItem[],
  apiKey: string,
): Promise<{ queriesRun: string[]; rawResults: BraveWebResult[] }> {
  const queriesRun: string[] = []
  const rawResults: BraveWebResult[] = []

  for (const item of plan) {
    const results = await searchBraveWeb(item.text, apiKey, {
      country: item.region === 'uk' ? 'GB' : null,
    })
    queriesRun.push(item.text)
    rawResults.push(...results)
  }

  return { queriesRun, rawResults }
}

export async function collectMarketSearchCandidates(
  equipment: EquipmentIntelligenceRow,
  apiKey: string,
): Promise<MarketSearchCollectionResult> {
  const plan = buildSearchQueryPlan(equipment)
  const ukPlan = plan.filter((item) => item.region === 'uk')
  const broadPlan = plan.filter((item) => item.region === 'broad')

  let queriesRun: string[] = []
  let rawResults: BraveWebResult[] = []

  if (ukPlan.length > 0) {
    const ukSearch = await runQueryPlan(ukPlan, apiKey)
    queriesRun = ukSearch.queriesRun
    rawResults = ukSearch.rawResults
  }

  if (rawResults.length === 0 && broadPlan.length > 0) {
    const broadSearch = await runQueryPlan(broadPlan, apiKey)
    queriesRun = [...queriesRun, ...broadSearch.queriesRun]
    rawResults = broadSearch.rawResults
  }

  const rawResultCount = rawResults.length
  const deduped = dedupeSearchResults(rawResults)
  const dedupedResultCount = deduped.length

  const pageFetchResults = await fetchCandidatePages(deduped.map((result) => result.url))

  let pagesFetched = 0
  let pagesFailed = 0
  let pricesFound = 0
  const pageFetchFailures: PageFetchFailure[] = []

  const enrichedCandidates = deduped.map((result) => {
    const pageFetch = pageFetchResults.get(result.url) ?? null
    const pageFetchAttempted = pageFetchResults.has(result.url)

    if (pageFetchAttempted) {
      if (pageFetch?.ok) {
        pagesFetched += 1
      } else {
        pagesFailed += 1
        pageFetchFailures.push({
          url: result.url,
          error: pageFetch?.error ?? 'Unknown fetch error',
        })
      }
    }

    const candidate = classifyEnrichedSearchResult(equipment, result, pageFetch, {
      pageFetchAttempted,
    })

    if (candidate.price != null) {
      pricesFound += 1
    }

    return candidate
  })

  const candidates = rankAndLimitCandidates(enrichedCandidates)
  const acceptedCount = candidates.filter((candidate) => candidate.status === 'accepted').length
  const rejectedCount = candidates.filter((candidate) => candidate.status === 'rejected').length

  return {
    queries_run: queriesRun,
    raw_result_count: rawResultCount,
    deduped_result_count: dedupedResultCount,
    pages_fetched: pagesFetched,
    pages_failed: pagesFailed,
    prices_found: pricesFound,
    page_fetch_failures: pageFetchFailures,
    candidates,
    accepted_count: acceptedCount,
    rejected_count: rejectedCount,
  }
}

export function formatNoResultsMessage(queriesRun: string[]): string {
  if (queriesRun.length === 0) {
    return 'No results found. No queries were generated for this equipment.'
  }

  return `No results found. Queries tried: ${queriesRun.join('; ')}`
}
