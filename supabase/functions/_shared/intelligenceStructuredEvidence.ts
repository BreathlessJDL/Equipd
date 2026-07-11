import type { EquipmentIntelligenceRow } from './intelligenceMarketSearch.ts'
import type { ResearchSourceType, SerpResearchHit } from './intelligenceEquipmentResearch.ts'
import {
  classifyLifecycleResearchSourceType,
  classifyResearchSourceType,
  detectCurrenciesInHaystack,
  extractResearchDomain,
  isMarketplaceResaleDomain,
  isTrustedCommercialFitnessRetailerDomain,
  scorePriceSourceHierarchy,
} from './intelligenceEquipmentResearch.ts'
import {
  getOriginalPriceLabelPriority,
  isCurrentOrSalePriceContext,
  isWeakListPriceForOriginalRrp,
  priceMatchesExplicitOriginalLabel,
} from './intelligencePriceSelection.ts'
import {
  type CanonicalProductIdentity,
  isIdentityStrongEnoughForExtraction,
  isIdentityStrongEnoughForPageRead,
  scoreProductIdentity,
  type ProductIdentityScore,
} from './intelligenceProductIdentity.ts'

export const V3_TRUSTED_UK_DEALER_DOMAINS = [
  'fitness-superstore.co.uk',
  'fitkituk.com',
  'fitshop.co.uk',
  'pinnaclefitness.org.uk',
  'powerhouse-fitness.co.uk',
  'amazonleisure.co.uk',
  'gymkit.co.uk',
  'originfitness.com',
  'bestgymequipment.co.uk',
  'usedgymequipment.co.uk',
] as const

export const V3_MARKETPLACE_DOMAINS = [
  'ebay.co.uk',
  'ebay.com',
  'gumtree.com',
  'gumtree.co.uk',
  'facebook.com',
  'preloved.co.uk',
  'shpock.com',
  'craigslist.org',
  'craigslist.co.uk',
] as const

export type StructuredEvidenceType = 'price' | 'lifecycle'

export type StructuredEvidenceItem = {
  id: string
  type: StructuredEvidenceType
  label: string
  value: number
  currency: string | null
  year: number | null
  yearEnd: number | null
  surroundingText: string
  sourceUrl: string
  sourceDomain: string
  sourceType: ResearchSourceType
  sourceScore: number
  confidence: number
  score: number
  eligibleForOriginalPrice: boolean
  rejectionReason: string | null
  extractionMethod: 'structured'
  nearModelName: boolean
  brandModelMatch: boolean
  productFamilyMatch: boolean
  identityScore: number | null
  identityLevel: string | null
  identityLabel: string | null
  isMarketplace: boolean
  isFinancePrice: boolean
}

export type StructuredProductContext = {
  brand: string
  series?: string | null
  model: string
  equipmentType?: string | null
  productFamily?: string | null
  coreProductName?: string | null
  coreModel?: string | null
  canonicalIdentity?: CanonicalProductIdentity | null
}

export type ResearchEquipmentRow = EquipmentIntelligenceRow & {
  product_family?: string | null
  core_product_name?: string | null
  research_canonical_identity?: CanonicalProductIdentity | null
}

const FINANCE_PRICE_PATTERNS = [
  /\b(?:from|only)\s*£[\d,]+(?:\.\d{2})?\s*(?:\/|per)\s*month\b/i,
  /\b£[\d,]+(?:\.\d{2})?\s*(?:\/|per)\s*month\b/i,
  /\b\$[\d,]+(?:\.\d{2})?\s*(?:\/|per)\s*month\b/i,
  /\bmonthly\s+(?:payment|finance|lease|rental)\b/i,
  /\bleasing\b/i,
  /\bfinance\s+from\b/i,
  /\bhire\s+purchase\b/i,
] as const

const ACCESSORY_NOISE_PATTERNS = [
  /\bspare\s+part\b/i,
  /\breplacement\s+belt\b/i,
  /\bconsole\s+overlay\b/i,
  /\bdelivery\s+(?:charge|fee|cost)\b/i,
] as const

type PriceLabelPattern = {
  label: string
  pattern: RegExp
  baseScore: number
  eligibleForOriginalPrice: boolean
}

const PRICE_LABEL_PATTERNS: PriceLabelPattern[] = [
  { label: 'RRP', pattern: /\b(?:original\s+)?rrp\b[^£$€\d]{0,40}(£|gbp|\$|usd|€|eur)?\s*([\d,]+(?:\.\d{2})?)/gi, baseScore: 14, eligibleForOriginalPrice: true },
  { label: 'MSRP', pattern: /\bmsrp\b[^£$€\d]{0,40}(£|gbp|\$|usd|€|eur)?\s*([\d,]+(?:\.\d{2})?)/gi, baseScore: 14, eligibleForOriginalPrice: true },
  { label: 'List Price', pattern: /\blist\s+price\b[^£$€\d]{0,40}(£|gbp|\$|usd|€|eur)?\s*([\d,]+(?:\.\d{2})?)/gi, baseScore: 13, eligibleForOriginalPrice: true },
  { label: 'Recommended Retail Price', pattern: /\brecommended\s+retail\s+price\b[^£$€\d]{0,40}(£|gbp|\$|usd|€|eur)?\s*([\d,]+(?:\.\d{2})?)/gi, baseScore: 13, eligibleForOriginalPrice: true },
  { label: 'Original Retail Price', pattern: /\boriginal\s+retail\s+price\b[^£$€\d]{0,40}(£|gbp|\$|usd|€|eur)?\s*([\d,]+(?:\.\d{2})?)/gi, baseScore: 13, eligibleForOriginalPrice: true },
  { label: 'Original Price', pattern: /\boriginal\s+price\b[^£$€\d]{0,40}(£|gbp|\$|usd|€|eur)?\s*([\d,]+(?:\.\d{2})?)/gi, baseScore: 12, eligibleForOriginalPrice: true },
  { label: 'Retail Price', pattern: /\bretail\s+price\b[^£$€\d]{0,40}(£|gbp|\$|usd|€|eur)?\s*([\d,]+(?:\.\d{2})?)/gi, baseScore: 10, eligibleForOriginalPrice: true },
  { label: 'Launch Price', pattern: /\blaunch\s+price\b[^£$€\d]{0,40}(£|gbp|\$|usd|€|eur)?\s*([\d,]+(?:\.\d{2})?)/gi, baseScore: 11, eligibleForOriginalPrice: true },
  { label: 'Was', pattern: /\bwas\b[^£$€\d]{0,30}(£|gbp|\$|usd|€|eur)?\s*([\d,]+(?:\.\d{2})?)/gi, baseScore: 7, eligibleForOriginalPrice: true },
  { label: 'Our Price', pattern: /\bour\s+price\b[^£$€\d]{0,30}(£|gbp|\$|usd|€|eur)?\s*([\d,]+(?:\.\d{2})?)/gi, baseScore: 3, eligibleForOriginalPrice: false },
  { label: 'Was Price', pattern: /\bwas\s+price\b[^£$€\d]{0,40}(£|gbp|\$|usd|€|eur)?\s*([\d,]+(?:\.\d{2})?)/gi, baseScore: 8, eligibleForOriginalPrice: true },
  { label: 'Sale Price', pattern: /\b(?:sale|current)\s+price\b[^£$€\d]{0,40}(£|gbp|\$|usd|€|eur)?\s*([\d,]+(?:\.\d{2})?)/gi, baseScore: 2, eligibleForOriginalPrice: false },
  { label: 'Discontinued Price', pattern: /\bdiscontinued\s+price\b[^£$€\d]{0,40}(£|gbp|\$|usd|€|eur)?\s*([\d,]+(?:\.\d{2})?)/gi, baseScore: 6, eligibleForOriginalPrice: true },
]

const LIFECYCLE_LABEL_PATTERNS = [
  { label: 'Launch Year', pattern: /\b(?:launch(?:ed)?|introduced|released)\s+(?:in\s+)?(19\d{2}|20\d{2})\b/gi },
  { label: 'Release Year', pattern: /\brelease(?:d)?\s+(?:in\s+)?(19\d{2}|20\d{2})\b/gi },
  { label: 'Model Year', pattern: /\bmodel\s+year\s*(?:[:\-]?\s*)?(19\d{2}|20\d{2})\b/gi },
  { label: 'Production Years', pattern: /\bproduction\s+years?\s*(?:[:\-]?\s*)?(19\d{2}|20\d{2})(?:\s*[-–]\s*(19\d{2}|20\d{2}|present|current))?/gi },
  { label: 'Discontinued Year', pattern: /\bdiscontinued\s+(?:in\s+)?(19\d{2}|20\d{2})\b/gi },
  { label: 'Manufactured', pattern: /\bmanufactured\s+(?:from\s+)?(19\d{2}|20\d{2})(?:\s*[-–]\s*(19\d{2}|20\d{2}|present|current))?/gi },
] as const

function parseMoneyAmount(value: string): number | null {
  const number = Number(value.replace(/,/g, ''))
  if (!Number.isFinite(number) || number <= 0) return null
  return Math.round(number * 100) / 100
}

function parseYear(value: string): number | null {
  const year = Math.trunc(Number(value))
  if (!Number.isFinite(year) || year < 1970 || year > 2100) return null
  return year
}

function detectCurrency(symbol: string | undefined, haystack: string): string | null {
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

function normalizeText(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

function surroundingContext(text: string, index: number, radius = 120): string {
  const start = Math.max(0, index - radius)
  const end = Math.min(text.length, index + radius)
  return normalizeText(text.slice(start, end))
}

export function isV3MarketplaceDomain(domain: string, url = ''): boolean {
  const normalized = domain.toLowerCase().replace(/^www\./i, '')
  const normalizedUrl = url.toLowerCase()

  if (normalized.includes('facebook') && /marketplace/i.test(normalizedUrl)) {
    return true
  }

  if (/(^|\.)ebay\./i.test(normalized)) return true

  return V3_MARKETPLACE_DOMAINS.some((known) => (
    normalized === known || normalized.endsWith(`.${known}`)
  )) || isMarketplaceResaleDomain(domain, url)
}

export function isV3TrustedUkDealerDomain(domain: string): boolean {
  const normalized = domain.toLowerCase().replace(/^www\./i, '')
  return V3_TRUSTED_UK_DEALER_DOMAINS.some((known) => (
    normalized === known || normalized.endsWith(`.${known}`)
  )) || isTrustedCommercialFitnessRetailerDomain(domain)
}

export function isFinanceOrMonthlyPriceContext(context: string): boolean {
  return FINANCE_PRICE_PATTERNS.some((pattern) => pattern.test(context))
}

export function isAccessoryOrDeliveryNoise(context: string): boolean {
  return ACCESSORY_NOISE_PATTERNS.some((pattern) => pattern.test(context))
}

function modelTokens(context: StructuredProductContext): string[] {
  const tokens = new Set<string>()
  for (const part of [
    context.model,
    context.coreModel,
    context.coreProductName,
    context.series,
    context.productFamily,
  ]) {
    if (!part) continue
    for (const token of part.toLowerCase().split(/[^a-z0-9]+/i)) {
      if (token.length >= 3) tokens.add(token)
    }
  }
  return [...tokens]
}

export function matchesBrandModel(context: StructuredProductContext, haystack: string): boolean {
  if (context.canonicalIdentity) {
    return isIdentityStrongEnoughForExtraction(
      scoreProductIdentity(haystack, context.canonicalIdentity),
    )
  }

  const lower = haystack.toLowerCase()
  const brand = context.brand.toLowerCase()
  if (!lower.includes(brand)) return false
  return modelTokens(context).some((token) => lower.includes(token))
}

export function resolveStructuredEvidenceIdentity(
  context: StructuredProductContext,
  haystack: string,
): ProductIdentityScore | null {
  if (!context.canonicalIdentity) return null
  return scoreProductIdentity(haystack, context.canonicalIdentity)
}

export function matchesProductFamily(context: StructuredProductContext, haystack: string): boolean {
  if (!context.productFamily) return false
  return haystack.toLowerCase().includes(context.productFamily.toLowerCase())
}

export function buildStructuredProductContext(
  equipment: ResearchEquipmentRow,
  canonicalIdentity: CanonicalProductIdentity | null = null,
): StructuredProductContext {
  const identity = canonicalIdentity ?? equipment.research_canonical_identity ?? null

  return {
    brand: equipment.brand,
    series: equipment.series,
    model: equipment.model,
    equipmentType: equipment.equipment_type ?? null,
    productFamily: equipment.product_family ?? equipment.series ?? null,
    coreProductName: equipment.core_product_name ?? null,
    coreModel: equipment.model,
    canonicalIdentity: identity,
  }
}

function trustedDealerBoost(domain: string): number {
  if (domain.includes('fitness-superstore')) return 18
  if (domain.includes('fitkituk')) return 16
  if (domain.includes('fitshop')) return 16
  if (domain.includes('pinnaclefitness')) return 15
  if (domain.includes('powerhouse-fitness')) return 15
  if (domain.includes('amazonleisure')) return 14
  if (domain.includes('gymkit')) return 12
  if (domain.includes('originfitness')) return 12
  if (domain.includes('bestgymequipment')) return 12
  if (domain.includes('usedgymequipment')) return 8
  return isV3TrustedUkDealerDomain(domain) ? 10 : 0
}

export function scoreStructuredPriceEvidence(
  item: Omit<StructuredEvidenceItem, 'confidence' | 'score' | 'rejectionReason'>,
  context: StructuredProductContext,
): { score: number; confidence: number; rejectionReason: string | null } {
  if (item.isMarketplace) {
    return { score: -100, confidence: 0, rejectionReason: 'marketplace_not_rrp' }
  }
  if (item.isFinancePrice) {
    return { score: -100, confidence: 0, rejectionReason: 'finance_or_monthly_price' }
  }
  if (!item.eligibleForOriginalPrice) {
    return { score: -50, confidence: 5, rejectionReason: 'ineligible_price_label' }
  }
  if (!item.brandModelMatch) {
    return { score: -40, confidence: 8, rejectionReason: 'unrelated_model' }
  }
  if (!priceMatchesExplicitOriginalLabel(item as StructuredEvidenceItem)
    && isCurrentOrSalePriceContext(item.surroundingText)) {
    return { score: -80, confidence: 5, rejectionReason: 'current_sale_price_context' }
  }
  if (!priceMatchesExplicitOriginalLabel(item as StructuredEvidenceItem)
    && isWeakListPriceForOriginalRrp(item.surroundingText)) {
    return { score: -60, confidence: 10, rejectionReason: 'current_sale_price_context' }
  }

  let score = item.sourceScore
  let confidence = 35

  if (item.nearModelName) {
    score += 8
    confidence += 12
  }
  if (item.productFamilyMatch) {
    score += 5
    confidence += 8
  }

  const labelPriority = getOriginalPriceLabelPriority(item.label)
  if (labelPriority <= 2) {
    score += 28
    confidence += 22
  } else if (labelPriority <= 5) {
    score += 18
    confidence += 15
  } else if (labelPriority <= 7) {
    score += 10
    confidence += 10
  } else if (labelPriority <= 10) {
    score += 4
    confidence += 5
  } else {
    score -= 12
    confidence -= 12
  }
  if (item.currency === 'GBP') {
    confidence += 10
  } else if (item.currency === 'USD') {
    confidence += 6
  }
  if (isV3TrustedUkDealerDomain(item.sourceDomain)) {
    score += trustedDealerBoost(item.sourceDomain)
    confidence += 20
  }

  confidence = Math.max(0, Math.min(100, confidence + Math.round(score / 3)))
  return { score, confidence, rejectionReason: null }
}

let evidenceIdCounter = 0

function nextEvidenceId(prefix: string): string {
  evidenceIdCounter += 1
  return `${prefix}-${evidenceIdCounter}`
}

export function extractStructuredPriceEvidenceFromText(
  text: string,
  source: {
    sourceUrl: string
    sourceDomain: string
    sourceType: ResearchSourceType
    brand: string
  },
  context: StructuredProductContext,
): StructuredEvidenceItem[] {
  const items: StructuredEvidenceItem[] = []
  const seen = new Set<string>()
  const isMarketplace = isV3MarketplaceDomain(source.sourceDomain, source.sourceUrl)

  for (const entry of PRICE_LABEL_PATTERNS) {
    for (const match of text.matchAll(entry.pattern)) {
      const value = parseMoneyAmount(match[2])
      if (value == null) continue

      const matchIndex = match.index ?? 0
      const contextText = surroundingContext(text, matchIndex)
      const isFinancePrice = isFinanceOrMonthlyPriceContext(contextText)
      const isNoise = isAccessoryOrDeliveryNoise(contextText)
      const currency = detectCurrency(match[1], contextText)
      const key = `${entry.label}:${value}:${currency ?? 'unknown'}:${source.sourceUrl}`
      if (seen.has(key)) continue
      seen.add(key)

      const brandModelMatch = matchesBrandModel(context, contextText)
      const productFamilyMatch = matchesProductFamily(context, contextText)
      const nearModelName = brandModelMatch
      const identity = resolveStructuredEvidenceIdentity(context, contextText)
      if (context.canonicalIdentity && identity && !isIdentityStrongEnoughForExtraction(identity)) {
        continue
      }

      const base: Omit<StructuredEvidenceItem, 'confidence' | 'score' | 'rejectionReason'> = {
        id: nextEvidenceId('price'),
        type: 'price',
        label: entry.label,
        value,
        currency,
        year: null,
        yearEnd: null,
        surroundingText: contextText,
        sourceUrl: source.sourceUrl,
        sourceDomain: source.sourceDomain,
        sourceType: source.sourceType,
        sourceScore: scorePriceSourceHierarchy({
          title: '',
          snippet: contextText,
          url: source.sourceUrl,
          intent: 'structured',
          query: '',
          page_content: contextText,
          domain: source.sourceDomain,
          source_type: source.sourceType,
        }, source.sourceType),
        eligibleForOriginalPrice: entry.eligibleForOriginalPrice && !isNoise,
        extractionMethod: 'structured',
        nearModelName,
        brandModelMatch,
        productFamilyMatch,
        identityScore: identity?.score ?? null,
        identityLevel: identity?.level ?? null,
        identityLabel: identity?.label ?? null,
        isMarketplace,
        isFinancePrice,
      }

      const scored = scoreStructuredPriceEvidence(base, context)
      items.push({
        ...base,
        ...scored,
        eligibleForOriginalPrice: base.eligibleForOriginalPrice && !scored.rejectionReason,
      })
    }
  }

  return items
}

export function extractStructuredLifecycleEvidenceFromText(
  text: string,
  source: {
    sourceUrl: string
    sourceDomain: string
    sourceType: ResearchSourceType
  },
  context: StructuredProductContext,
): StructuredEvidenceItem[] {
  const items: StructuredEvidenceItem[] = []
  const seen = new Set<string>()

  for (const entry of LIFECYCLE_LABEL_PATTERNS) {
    for (const match of text.matchAll(entry.pattern)) {
      const year = parseYear(match[1])
      if (year == null) continue
      const yearEndRaw = match[2]
      const yearEnd = yearEndRaw && !/present|current/i.test(yearEndRaw)
        ? parseYear(yearEndRaw)
        : null
      const matchIndex = match.index ?? 0
      const contextText = surroundingContext(text, matchIndex)
      const key = `${entry.label}:${year}:${yearEnd ?? ''}:${source.sourceUrl}`
      if (seen.has(key)) continue
      seen.add(key)

      const brandModelMatch = matchesBrandModel(context, contextText)
      if (!brandModelMatch) continue
      const identity = resolveStructuredEvidenceIdentity(context, contextText)

      items.push({
        id: nextEvidenceId('lifecycle'),
        type: 'lifecycle',
        label: entry.label,
        value: year,
        currency: null,
        year,
        yearEnd,
        surroundingText: contextText,
        sourceUrl: source.sourceUrl,
        sourceDomain: source.sourceDomain,
        sourceType: source.sourceType,
        sourceScore: 6,
        confidence: 55,
        score: 55,
        eligibleForOriginalPrice: false,
        rejectionReason: null,
        extractionMethod: 'structured',
        nearModelName: true,
        brandModelMatch: true,
        productFamilyMatch: matchesProductFamily(context, contextText),
        identityScore: identity?.score ?? null,
        identityLevel: identity?.level ?? null,
        identityLabel: identity?.label ?? null,
        isMarketplace: isV3MarketplaceDomain(source.sourceDomain, source.sourceUrl),
        isFinancePrice: false,
      })
    }
  }

  return items
}

export function extractStructuredEvidenceFromHit(
  hit: SerpResearchHit,
  brand: string,
  context: StructuredProductContext,
): StructuredEvidenceItem[] {
  const domain = hit.domain || extractResearchDomain(hit.url)
  const haystack = [hit.title, hit.snippet, hit.page_content].filter(Boolean).join('\n')
  if (!haystack.trim()) return []

  if (context.canonicalIdentity) {
    const pageIdentity = scoreProductIdentity(haystack, context.canonicalIdentity)
    if (!isIdentityStrongEnoughForPageRead(pageIdentity)) return []
  }

  const priceSourceType = hit.source_type ?? classifyResearchSourceType({ ...hit, domain }, brand)
  const lifecycleSourceType = classifyLifecycleResearchSourceType({ ...hit, domain }, brand)
  const source = {
    sourceUrl: hit.url,
    sourceDomain: domain,
    sourceType: priceSourceType,
    brand,
  }

  const priceEvidence = extractStructuredPriceEvidenceFromText(haystack, source, context)
  const lifecycleEvidence = extractStructuredLifecycleEvidenceFromText(haystack, {
    ...source,
    sourceType: lifecycleSourceType,
  }, context)

  return [...priceEvidence, ...lifecycleEvidence]
}

export function collectStructuredEvidenceFromHits(
  hits: SerpResearchHit[],
  equipment: ResearchEquipmentRow,
  options: {
    maxPerPage?: number
    maxTotal?: number
  } = {},
): StructuredEvidenceItem[] {
  const maxPerPage = options.maxPerPage ?? 6
  const maxTotal = options.maxTotal ?? 20
  const context = buildStructuredProductContext(equipment)
  const all: StructuredEvidenceItem[] = []

  for (const hit of hits) {
    const fromHit = extractStructuredEvidenceFromHit(hit, equipment.brand, context)
      .slice(0, maxPerPage)
    all.push(...fromHit)
    if (all.length >= maxTotal) break
  }

  return all.sort((left, right) => right.score - left.score).slice(0, maxTotal)
}

export function selectTopStructuredEvidence(
  items: StructuredEvidenceItem[],
  {
    type,
    limit = 12,
    minScore = 0,
  }: {
    type: StructuredEvidenceType
    limit?: number
    minScore?: number
  },
): StructuredEvidenceItem[] {
  return items
    .filter((item) => item.type === type)
    .filter((item) => item.rejectionReason == null)
    .filter((item) => item.score >= minScore)
    .slice(0, limit)
}

export function structuredEvidenceForOpenAi(items: StructuredEvidenceItem[]) {
  return items.map((item) => ({
    evidence_id: item.id,
    type: item.type,
    label: item.label,
    value: item.value,
    currency: item.currency,
    year: item.year,
    year_end: item.yearEnd,
    surrounding_text: item.surroundingText,
    source_url: item.sourceUrl,
    source_domain: item.sourceDomain,
    source_type: item.sourceType,
    source_score: item.sourceScore,
    evidence_confidence: item.confidence,
    evidence_score: item.score,
    extraction_method: item.extractionMethod,
  }))
}
