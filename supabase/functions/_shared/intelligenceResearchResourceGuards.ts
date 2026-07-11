import type { EquipmentResearchMode, SerpResearchHit } from './intelligenceEquipmentResearch.ts'
import {
  classifyResearchSourceType,
  extractResearchDomain,
} from './intelligenceEquipmentResearch.ts'
import type { StructuredEvidenceItem } from './intelligenceStructuredEvidence.ts'
import {
  isV3TrustedUkDealerDomain,
} from './intelligenceStructuredEvidence.ts'

export const RESEARCH_V3_DEFAULT_PAGE_READS = 3
export const RESEARCH_V3_MAX_PAGE_READS = 5
export const RESEARCH_V3_MAX_PDF_DOWNLOADS = 1
export const MAX_EVIDENCE_PER_PAGE = 6
export const MAX_TOTAL_EVIDENCE_CANDIDATES = 20
export const MAX_RESPONSE_SURROUNDING_TEXT = 120

export type PageSkipReason =
  | 'too_large_html'
  | 'too_large_pdf'
  | 'low_value_domain'
  | 'parse_budget_exceeded'
  | 'pdf_skipped'

export type PageSkipEntry = {
  url: string
  reason: PageSkipReason
  detail?: string | null
}

export const HEAVY_RESEARCH_DOMAIN_SUFFIXES = [
  'archive.org',
  'web.archive.org',
] as const

const PRICE_SNIPPET_SIGNAL = /\b(?:rrp|msrp|list\s+price|retail\s+price|original\s+price|£\s*[\d,]{3,})/i
const LIFECYCLE_PDF_SIGNAL = /\b(?:manual|service|spec(?:ification)?|brochure|datasheet)\b/i

export function isHeavyResearchDomain(domainOrUrl: string): boolean {
  const normalized = domainOrUrl.trim().toLowerCase()
  if (!normalized) return false
  return HEAVY_RESEARCH_DOMAIN_SUFFIXES.some((suffix) => (
    normalized === suffix || normalized.endsWith(`.${suffix}`) || normalized.includes(suffix)
  ))
}

export function classifyOversizedDownload(
  byteLength: number,
  kind: 'html' | 'pdf',
  limits: { maxHtmlBytes: number; maxPdfBytes: number },
): PageSkipReason | null {
  if (kind === 'html' && byteLength > limits.maxHtmlBytes) return 'too_large_html'
  if (kind === 'pdf' && byteLength > limits.maxPdfBytes) return 'too_large_pdf'
  return null
}

export function isTrustedResearchSourceHit(hit: SerpResearchHit, brand: string): boolean {
  const domain = hit.domain || extractResearchDomain(hit.url)
  if (isV3TrustedUkDealerDomain(domain)) return true
  const sourceType = hit.source_type ?? classifyResearchSourceType({ ...hit, domain }, brand)
  return sourceType === 'manufacturer_website'
    || sourceType === 'official_distributor'
    || sourceType === 'dealer_catalogue'
}

export function shouldFetchPdfForV3(
  hit: SerpResearchHit,
  options: {
    brand: string
    researchMode?: EquipmentResearchMode
    lifecycleNeeded?: boolean
  },
): boolean {
  const domain = hit.domain || extractResearchDomain(hit.url)
  const url = hit.url.toLowerCase()
  const lifecycleIntent = /lifecycle|manual|service|history|timeline|production|launch|discontinued/i.test(
    `${hit.intent} ${hit.query}`,
  )

  if (options.researchMode === 'lifecycle_only' || lifecycleIntent || options.lifecycleNeeded) {
    return LIFECYCLE_PDF_SIGNAL.test(url) || LIFECYCLE_PDF_SIGNAL.test(hit.title)
  }

  if (isTrustedResearchSourceHit(hit, options.brand)) {
    return /brochure|price|rrp|msrp|catalog|spec/i.test(url)
  }

  return false
}

export function resolveV3PageReadLimit(
  priceHits: SerpResearchHit[],
  lifecycleHits: SerpResearchHit[],
  researchMode: EquipmentResearchMode = 'full',
  brand = '',
): number {
  if (researchMode === 'lifecycle_only') {
    const lifecyclePdfTargets = lifecycleHits.filter((hit) => isPdfUrl(hit.url)).length
    return lifecyclePdfTargets > 0 ? RESEARCH_V3_MAX_PAGE_READS : RESEARCH_V3_DEFAULT_PAGE_READS
  }

  const snippetHaystacks = priceHits.map((hit) => [hit.title, hit.snippet].filter(Boolean).join(' '))
  const strongSnippetHits = snippetHaystacks.filter((text) => PRICE_SNIPPET_SIGNAL.test(text)).length
  const trustedCount = priceHits.filter((hit) => isTrustedResearchSourceHit(hit, brand)).length

  if (strongSnippetHits >= 2) {
    return RESEARCH_V3_DEFAULT_PAGE_READS
  }

  if (trustedCount >= 2) {
    return RESEARCH_V3_MAX_PAGE_READS
  }

  if (lifecycleHits.length > 0 && strongSnippetHits === 0) {
    return RESEARCH_V3_MAX_PAGE_READS
  }

  return RESEARCH_V3_DEFAULT_PAGE_READS
}

function isPdfUrl(url: string): boolean {
  return /\.pdf(?:$|[?#])/i.test(url.trim())
}

export function compactStructuredEvidenceItem(item: StructuredEvidenceItem) {
  return {
    id: item.id,
    type: item.type,
    label: item.label,
    value: item.value,
    currency: item.currency,
    year: item.year,
    yearEnd: item.yearEnd,
    sourceDomain: item.sourceDomain,
    sourceUrl: item.sourceUrl,
    confidence: item.confidence,
    score: item.score,
    surroundingText: item.surroundingText.slice(0, MAX_RESPONSE_SURROUNDING_TEXT),
  }
}

export function estimateJsonBytes(value: unknown): number {
  return new TextEncoder().encode(JSON.stringify(value)).length
}
