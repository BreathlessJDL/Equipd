import type { ResearchSourceType, SerpResearchHit } from './intelligenceEquipmentResearch.ts'
import {
  buildEquipmentResearchSearchPhrase,
  classifyLifecycleResearchSourceType,
  dedupeSerpResearchHits,
  extractResearchDomain,
  hasHistoricalLifecycleSignals,
  rankLifecycleResearchHits,
  runSerpQueryBatch,
  type SerpFetchAttemptResult,
  type SerpQueryError,
  type SerpRequestTiming,
} from './intelligenceEquipmentResearch.ts'
import type { EquipmentResearchRecommendation } from './intelligenceEquipmentResearch.ts'
import type { EquipmentIntelligenceRow } from './intelligenceMarketSearch.ts'
import { quoteResearchPhrase } from './intelligenceEquipmentResearchSourceFirst.ts'
import {
  isIdentityStrongEnoughForExtraction,
  isIdentityStrongEnoughForPageRead,
  scoreProductIdentity,
} from './intelligenceProductIdentity.ts'
import {
  buildStructuredProductContext,
  isV3TrustedUkDealerDomain,
  matchesBrandModel,
  resolveStructuredEvidenceIdentity,
  type StructuredEvidenceItem,
  type StructuredProductContext,
} from './intelligenceStructuredEvidence.ts'
import { isV3PriorityDealerDomain } from './intelligenceEquipmentResearchSourceFirst.ts'

export type LifecycleEvidenceKind =
  | 'launch'
  | 'introduced'
  | 'production_period'
  | 'discontinued'
  | 'console_timeline'
  | 'present'

export type LifecycleEvidenceItem = StructuredEvidenceItem & {
  lifecycleKind: LifecycleEvidenceKind
  affectsBaseline: boolean
  isConsoleTimeline: boolean
  lifecycleNotes: string | null
}

type LifecyclePattern = {
  lifecycleKind: LifecycleEvidenceKind
  label: string
  pattern: RegExp
  defaultAffectsBaseline?: boolean
  defaultConsole?: boolean
}

let lifecycleEvidenceIdCounter = 0

function nextLifecycleId(): string {
  lifecycleEvidenceIdCounter += 1
  return `lifecycle-${lifecycleEvidenceIdCounter}`
}

function parseYear(value: string | undefined): number | null {
  if (!value) return null
  const normalized = value.trim()
  if (/^present|current|>$/i.test(normalized)) return null

  if (/^\d{2}$/.test(normalized)) {
    const twoDigit = Number(normalized)
    return twoDigit >= 70 ? 1900 + twoDigit : 2000 + twoDigit
  }

  const year = Math.trunc(Number(normalized))
  if (!Number.isFinite(year) || year < 1970 || year > 2100) return null
  return year
}

function normalizeText(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

function surroundingContext(text: string, index: number, radius = 160): string {
  const start = Math.max(0, index - radius)
  const end = Math.min(text.length, index + radius)
  return normalizeText(text.slice(start, end))
}

function modelAndFamilyTokens(context: StructuredProductContext): string[] {
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
  if (context.coreProductName?.toLowerCase().includes('discover')) {
    tokens.add('discover')
  }
  return [...tokens]
}

export function matchesLifecycleProductContext(
  context: StructuredProductContext,
  haystack: string,
): boolean {
  if (context.canonicalIdentity) {
    return isIdentityStrongEnoughForExtraction(
      scoreProductIdentity(haystack, context.canonicalIdentity),
    )
  }

  if (matchesBrandModel(context, haystack)) return true

  const lower = haystack.toLowerCase()
  const brand = context.brand.toLowerCase()
  const tokens = modelAndFamilyTokens(context)

  if (lower.includes(brand)) {
    return tokens.some((token) => lower.includes(token))
  }

  if (context.coreProductName && lower.includes(context.coreProductName.toLowerCase())) {
    return true
  }

  const matchedTokens = tokens.filter((token) => lower.includes(token))
  return matchedTokens.length >= 2
}

export function classifyConsoleTimelineContext(contextText: string): {
  isConsoleTimeline: boolean
  affectsBaseline: boolean
  lifecycleKind: LifecycleEvidenceKind
  lifecycleNotes: string | null
} {
  const lower = contextText.toLowerCase()
  const mentionsConsole = /\bconsole?s?\b/i.test(lower)
  const isUpgrade = /\b(?:upgraded?|upgrade|replacement|latest\s+iteration)\b/i.test(lower)
  const mentionsSe3 = /\bse3hd?\b/i.test(lower)
  const mentionsSeSi = /\bdiscover\s+(?:se|si)\b/i.test(lower) || /\b(?:se|si)\s+console/i.test(lower)
  const isInitialPlatform = /\b(?:initial\s+launch|first\s+(?:produced|introduced)|launched)\b/i.test(lower)
  const isPresent = /\b(?:present|current|ongoing|still\s+available|latest\s+iteration)\b/i.test(lower)
  const isDiscontinued = /\bdiscontinued\b/i.test(lower)

  if (mentionsSe3 || (isUpgrade && mentionsConsole)) {
    return {
      isConsoleTimeline: true,
      affectsBaseline: false,
      lifecycleKind: 'console_timeline',
      lifecycleNotes: 'Console upgrade timeline (e.g. SE3/SE3HD); not used as base machine production end.',
    }
  }

  if (isInitialPlatform && (mentionsSeSi || /\bdiscover\b/i.test(lower))) {
    return {
      isConsoleTimeline: true,
      affectsBaseline: true,
      lifecycleKind: 'launch',
      lifecycleNotes: 'Earliest Discover platform/console launch evidence for product family baseline.',
    }
  }

  if (isDiscontinued) {
    return {
      isConsoleTimeline: false,
      affectsBaseline: false,
      lifecycleKind: 'discontinued',
      lifecycleNotes: null,
    }
  }

  if (isPresent) {
    return {
      isConsoleTimeline: false,
      affectsBaseline: false,
      lifecycleKind: 'present',
      lifecycleNotes: 'Product line appears current; do not infer production_end_year from present/latest wording.',
    }
  }

  if (mentionsConsole && !isUpgrade) {
    return {
      isConsoleTimeline: true,
      affectsBaseline: true,
      lifecycleKind: 'introduced',
      lifecycleNotes: 'Console introduction tied to product family timeline.',
    }
  }

  return {
    isConsoleTimeline: false,
    affectsBaseline: true,
    lifecycleKind: 'launch',
    lifecycleNotes: null,
  }
}

const LIFECYCLE_EXTRACTION_PATTERNS: LifecyclePattern[] = [
  {
    lifecycleKind: 'launch',
    label: 'Initial Launch',
    pattern: /\binitial\s+launch(?:\s+of)?[^.]{0,100}?(19\d{2}|20\d{2})/gi,
    defaultAffectsBaseline: true,
    defaultConsole: true,
  },
  {
    lifecycleKind: 'launch',
    label: 'Launch Year',
    pattern: /\b(?:launch(?:ed)?|released)\s+(?:in\s+)?(19\d{2}|20\d{2})\b/gi,
  },
  {
    lifecycleKind: 'introduced',
    label: 'Introduced Year',
    pattern: /\bintroduced\s+(?:in\s+)?(19\d{2}|20\d{2})\b/gi,
  },
  {
    lifecycleKind: 'introduced',
    label: 'Introduction Period',
    pattern: /\bintroduction\s+of\s+[^.]{0,120}?(19\d{2}|20\d{2})\s*[-–]\s*(19\d{2}|20\d{2}|\d{2})\b/gi,
    defaultConsole: true,
  },
  {
    lifecycleKind: 'production_period',
    label: 'Production Period',
    pattern: /\b(19\d{2}|20\d{2})\s*[-–]\s*(19\d{2}|20\d{2}|\d{2}|present|current)\b/gi,
  },
  {
    lifecycleKind: 'present',
    label: 'Current From Year',
    pattern: /\b(20\d{2}|19\d{2})\s*>\b/gi,
  },
  {
    lifecycleKind: 'discontinued',
    label: 'Discontinued',
    pattern: /\bdiscontinued\s+(?:in\s+)?(19\d{2}|20\d{2})?\b/gi,
  },
  {
    lifecycleKind: 'launch',
    label: 'First Produced',
    pattern: /\bfirst\s+produced\s+(?:in\s+)?(19\d{2}|20\d{2})\b/gi,
  },
  {
    lifecycleKind: 'introduced',
    label: 'Console Introduced',
    pattern: /\bconsole(?:s)?\s+introduced\s+(?:in\s+)?(19\d{2}|20\d{2})\b/gi,
    defaultConsole: true,
  },
  {
    lifecycleKind: 'present',
    label: 'Latest Iteration',
    pattern: /\b(?:latest\s+iteration|still\s+current|ongoing)\b/gi,
  },
  {
    lifecycleKind: 'launch',
    label: 'Generation Year',
    pattern: /\bgeneration\s+(?:\d+\s+)?(?:from\s+)?(19\d{2}|20\d{2})\b/gi,
  },
  {
    lifecycleKind: 'production_period',
    label: 'Manufactured',
    pattern: /\bmanufactured\s+(?:from\s+)?(19\d{2}|20\d{2})(?:\s*[-–]\s*(19\d{2}|20\d{2}|present|current))?/gi,
  },
  {
    lifecycleKind: 'launch',
    label: 'Production Years',
    pattern: /\bproduction\s+years?\s*(?:[:\-]?\s*)?(19\d{2}|20\d{2})(?:\s*[-–]\s*(19\d{2}|20\d{2}|present|current))?/gi,
  },
  {
    lifecycleKind: 'launch',
    label: 'Discover SE/SI Launch',
    pattern: /\bdiscover\s+(?:se|si)\b[^.]{0,120}?(19\d{2}|20\d{2})/gi,
    defaultConsole: true,
    defaultAffectsBaseline: true,
  },
  {
    lifecycleKind: 'console_timeline',
    label: 'Discover SE3/SE3HD',
    pattern: /\b(?:discover\s+)?se3hd?\b[^.]{0,120}?(19\d{2}|20\d{2})/gi,
    defaultConsole: true,
    defaultAffectsBaseline: false,
  },
  {
    lifecycleKind: 'launch',
    label: 'Platform Launch Context',
    pattern: /\b(?:platform|line|cardio)\s+[^.]{0,50}?\b(?:launch(?:ed)?|introduced)\b[^.]{0,50}?(19\d{2}|20\d{2})/gi,
  },
  {
    lifecycleKind: 'launch',
    label: 'Lifecycle Context Year',
    pattern: /\b(?:launch(?:ed)?|introduced|timeline|generation|platform)\b[^.]{0,80}?(19\d{2}|20\d{2})/gi,
  },
]

function scoreLifecycleEvidence(
  item: Omit<LifecycleEvidenceItem, 'confidence' | 'score'>,
  context: StructuredProductContext,
): { confidence: number; score: number } {
  let score = item.sourceScore
  let confidence = 40

  if (item.brandModelMatch) {
    score += 8
    confidence += 12
  }
  if (item.productFamilyMatch) {
    score += 5
    confidence += 8
  }
  if (item.affectsBaseline) {
    score += 10
    confidence += 10
  }
  if (isV3TrustedUkDealerDomain(item.sourceDomain)) {
    score += 14
    confidence += 18
  }
  if (item.lifecycleKind === 'launch' || item.lifecycleKind === 'introduced') {
    score += 6
    confidence += 8
  }
  if (item.isConsoleTimeline && !item.affectsBaseline) {
    score += 4
    confidence += 4
  }
  if (item.lifecycleKind === 'present') {
    score += 2
  }

  confidence = Math.max(0, Math.min(100, confidence + Math.round(score / 4)))
  return { confidence, score }
}

function trustedDealerLifecycleBoost(domain: string): number {
  if (domain.includes('fitkituk')) return 16
  if (domain.includes('fitshop')) return 14
  if (domain.includes('fitness-superstore')) return 14
  if (domain.includes('pinnaclefitness')) return 12
  return isV3TrustedUkDealerDomain(domain) ? 10 : 6
}

export function extractLifecycleEvidenceFromText(
  text: string,
  source: {
    sourceUrl: string
    sourceDomain: string
    sourceType: ResearchSourceType
    brand: string
  },
  context: StructuredProductContext,
): LifecycleEvidenceItem[] {
  const items: LifecycleEvidenceItem[] = []
  const seen = new Set<string>()

  for (const entry of LIFECYCLE_EXTRACTION_PATTERNS) {
    for (const match of text.matchAll(entry.pattern)) {
      const year = parseYear(match[1])
      const yearEnd = parseYear(match[2])
      const matchIndex = match.index ?? 0
      const contextText = surroundingContext(text, matchIndex)

      if (!matchesLifecycleProductContext(context, contextText)) continue

      const classification = classifyConsoleTimelineContext(contextText)
      const lifecycleKind = entry.defaultConsole === false
        ? entry.lifecycleKind
        : classification.lifecycleKind !== 'launch' || entry.lifecycleKind === 'launch'
          ? (entry.lifecycleKind === 'production_period' && classification.isConsoleTimeline
            ? 'console_timeline'
            : classification.lifecycleKind)
          : classification.lifecycleKind

      const isConsoleTimeline = entry.defaultConsole ?? classification.isConsoleTimeline
      let affectsBaseline = entry.defaultAffectsBaseline ?? classification.affectsBaseline

      if (lifecycleKind === 'console_timeline' || (isConsoleTimeline && /\bse3hd?\b/i.test(contextText))) {
        affectsBaseline = false
      }
      if (lifecycleKind === 'present') {
        affectsBaseline = false
      }
      if (lifecycleKind === 'production_period' && isConsoleTimeline && /\b(?:upgraded?|se3)/i.test(contextText)) {
        affectsBaseline = false
      }

      const effectiveYear = year ?? yearEnd
      if (effectiveYear == null && lifecycleKind !== 'present' && lifecycleKind !== 'discontinued') {
        continue
      }

      const key = `${lifecycleKind}:${effectiveYear ?? 'na'}:${yearEnd ?? ''}:${source.sourceUrl}:${matchIndex}`
      if (seen.has(key)) continue
      seen.add(key)

      const brandModelMatch = matchesLifecycleProductContext(context, contextText)
      const identity = resolveStructuredEvidenceIdentity(context, contextText)
      const base: Omit<LifecycleEvidenceItem, 'confidence' | 'score'> = {
        id: nextLifecycleId(),
        type: 'lifecycle',
        label: entry.label,
        value: effectiveYear ?? 0,
        currency: null,
        year: effectiveYear,
        yearEnd: lifecycleKind === 'present' ? null : yearEnd,
        surroundingText: contextText,
        sourceUrl: source.sourceUrl,
        sourceDomain: source.sourceDomain,
        sourceType: source.sourceType,
        sourceScore: trustedDealerLifecycleBoost(source.sourceDomain),
        eligibleForOriginalPrice: false,
        rejectionReason: null,
        extractionMethod: 'structured',
        nearModelName: brandModelMatch,
        brandModelMatch,
        productFamilyMatch: Boolean(context.productFamily
          && contextText.toLowerCase().includes(context.productFamily.toLowerCase())),
        identityScore: identity?.score ?? null,
        identityLevel: identity?.level ?? null,
        identityLabel: identity?.label ?? null,
        isMarketplace: false,
        isFinancePrice: false,
        lifecycleKind,
        affectsBaseline,
        isConsoleTimeline,
        lifecycleNotes: classification.lifecycleNotes,
      }

      const scored = scoreLifecycleEvidence(base, context)
      items.push({ ...base, ...scored })
    }
  }

  return items
}

export function extractLifecycleEvidenceFromHit(
  hit: SerpResearchHit,
  brand: string,
  context: StructuredProductContext,
): LifecycleEvidenceItem[] {
  const domain = hit.domain || extractResearchDomain(hit.url)
  const haystack = [hit.title, hit.snippet, hit.page_content].filter(Boolean).join('\n')
  if (!haystack.trim()) return []

  const lifecycleSourceType = classifyLifecycleResearchSourceType({ ...hit, domain }, brand)
  return extractLifecycleEvidenceFromText(haystack, {
    sourceUrl: hit.url,
    sourceDomain: domain,
    sourceType: lifecycleSourceType,
    brand,
  }, context)
}

export function collectLifecycleEvidenceFromHits(
  hits: SerpResearchHit[],
  equipment: EquipmentIntelligenceRow & {
    product_family?: string | null
    core_product_name?: string | null
  },
  options: { maxPerPage?: number; maxTotal?: number } = {},
): LifecycleEvidenceItem[] {
  const maxPerPage = options.maxPerPage ?? 8
  const maxTotal = options.maxTotal ?? 24
  const context = buildStructuredProductContext(equipment)
  const all: LifecycleEvidenceItem[] = []

  for (const hit of hits) {
    const fromHit = extractLifecycleEvidenceFromHit(hit, equipment.brand, context).slice(0, maxPerPage)
    all.push(...fromHit)
    if (all.length >= maxTotal) break
  }

  return all.sort((left, right) => right.score - left.score).slice(0, maxTotal)
}

export function buildTrustedDealerLifecycleEvidence(
  hits: SerpResearchHit[],
  equipment: EquipmentIntelligenceRow & {
    product_family?: string | null
    core_product_name?: string | null
  },
): LifecycleEvidenceItem[] {
  const context = buildStructuredProductContext(equipment)
  const items: LifecycleEvidenceItem[] = []
  const seen = new Set<string>()

  for (const hit of hits) {
    const domain = hit.domain || extractResearchDomain(hit.url)
    const isTrusted = isV3TrustedUkDealerDomain(domain) || isV3PriorityDealerDomain(domain)
    if (!isTrusted && !hasHistoricalLifecycleSignals(hit)) continue

    const haystack = [hit.title, hit.snippet].filter(Boolean).join('\n')
    if (!haystack.trim()) continue

    const lifecycleSourceType = hit.source_type ?? classifyLifecycleResearchSourceType({
      ...hit,
      domain,
    }, equipment.brand)

    const extracted = extractLifecycleEvidenceFromText(haystack, {
      sourceUrl: hit.url,
      sourceDomain: domain,
      sourceType: lifecycleSourceType,
      brand: equipment.brand,
    }, context)

    for (const item of extracted) {
      const key = `${item.lifecycleKind}:${item.year}:${item.yearEnd}:${item.sourceUrl}`
      if (seen.has(key)) continue
      seen.add(key)
      items.push(item)
    }
  }

  return items.sort((left, right) => right.score - left.score)
}

export function lifecycleEvidenceForOpenAi(items: LifecycleEvidenceItem[]) {
  return items.map((item) => ({
    evidence_id: item.id,
    type: item.type,
    lifecycle_kind: item.lifecycleKind,
    label: item.label,
    year: item.year,
    year_end: item.yearEnd,
    affects_baseline: item.affectsBaseline,
    is_console_timeline: item.isConsoleTimeline,
    lifecycle_notes: item.lifecycleNotes,
    surrounding_text: item.surroundingText,
    source_url: item.sourceUrl,
    source_domain: item.sourceDomain,
    source_type: item.sourceType,
    evidence_confidence: item.confidence,
    evidence_score: item.score,
  }))
}

export function resolveBaselineFromLifecycleEvidence(
  items: LifecycleEvidenceItem[],
): {
  baselineManufactureYear: number | null
  productionStartYear: number | null
  productionEndYear: number | null
  lifecycleConfidence: number | null
  lifecycleNotes: string
  baselineEvidenceIds: string[]
  consoleTimelineEvidenceIds: string[]
} {
  if (items.length === 0) {
    return {
      baselineManufactureYear: null,
      productionStartYear: null,
      productionEndYear: null,
      lifecycleConfidence: null,
      lifecycleNotes: '',
      baselineEvidenceIds: [],
      consoleTimelineEvidenceIds: [],
    }
  }

  const baselineCandidates = items.filter((item) => item.affectsBaseline && item.year != null)
  const consoleItems = items.filter((item) => item.isConsoleTimeline)
  const discontinued = items.filter((item) => item.lifecycleKind === 'discontinued' && item.year != null)
  const presentItems = items.filter((item) => item.lifecycleKind === 'present')

  const baselineYear = baselineCandidates.length > 0
    ? Math.min(...baselineCandidates.map((item) => item.year!))
    : null

  const productionEndYear = discontinued.length > 0 && presentItems.length === 0
    ? Math.max(...discontinued.map((item) => item.yearEnd ?? item.year!))
    : null

  const notes: string[] = []
  if (baselineYear != null) {
    notes.push(
      `Suggested baseline ${baselineYear} from earliest credible platform/family lifecycle evidence.`,
    )
  }
  if (consoleItems.length > 0) {
    const consoleRanges = consoleItems
      .filter((item) => item.year != null)
      .map((item) => (
        item.yearEnd ? `${item.year}-${item.yearEnd}` : String(item.year)
      ))
    if (consoleRanges.length > 0) {
      notes.push(`Console timeline evidence: ${consoleRanges.join(', ')}.`)
    }
  }
  if (presentItems.length > 0) {
    notes.push('Present/latest iteration wording found; production end year left unset unless explicitly discontinued.')
  }

  const topConfidence = baselineCandidates.length > 0
    ? Math.max(...baselineCandidates.map((item) => item.confidence))
    : (items[0]?.confidence ?? null)

  return {
    baselineManufactureYear: baselineYear,
    productionStartYear: baselineYear,
    productionEndYear,
    lifecycleConfidence: topConfidence,
    lifecycleNotes: notes.join(' '),
    baselineEvidenceIds: baselineCandidates
      .filter((item) => item.year === baselineYear)
      .map((item) => item.id),
    consoleTimelineEvidenceIds: consoleItems.map((item) => item.id),
  }
}

export function mergeLifecycleEvidence(
  ...groups: LifecycleEvidenceItem[][]
): LifecycleEvidenceItem[] {
  const seen = new Set<string>()
  const merged: LifecycleEvidenceItem[] = []

  for (const group of groups) {
    for (const item of group) {
      const key = `${item.lifecycleKind}:${item.year}:${item.yearEnd}:${item.sourceUrl}`
      if (seen.has(key)) continue
      seen.add(key)
      merged.push(item)
    }
  }

  return merged.sort((left, right) => right.score - left.score)
}

export function toAdminLifecycleEvidenceRow(item: LifecycleEvidenceItem) {
  return {
    id: item.id,
    year: item.year,
    yearEnd: item.yearEnd,
    type: item.lifecycleKind,
    sourceDomain: item.sourceDomain,
    snippet: item.surroundingText,
    confidence: item.confidence,
    affectsBaseline: item.affectsBaseline,
    isConsoleTimeline: item.isConsoleTimeline,
    lifecycleNotes: item.lifecycleNotes,
    sourceUrl: item.sourceUrl,
    label: item.label,
    score: item.score,
    identityScore: item.identityScore,
    identityLevel: item.identityLevel,
    identityLabel: item.identityLabel,
  }
}

export type V3LifecycleQueryDebugEntry = {
  query: string
  result_count: number
  snippets: Array<{
    title: string
    snippet: string
    url: string
    domain: string
  }>
}

export function sanitizeSeriesForLifecyclePrompt(series: string | null | undefined): string | null {
  if (!series) return null
  const cleaned = series
    .replace(/\(\s*\d{4}\s*>\s*\)/gi, '')
    .replace(/\(\s*\d{4}\s*[-–]\s*(?:\d{4}|\d{2}|present|current)\s*\)/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
  return cleaned || null
}

export function buildV3TargetedLifecycleQueries(
  equipment: EquipmentIntelligenceRow & { core_product_name?: string | null },
): string[] {
  const phrase = quoteResearchPhrase(buildEquipmentResearchSearchPhrase(equipment))
  const coreName = equipment.core_product_name?.trim() ?? ''
  const discoverPhrase = coreName.toLowerCase().includes('discover')
    ? quoteResearchPhrase(coreName)
    : quoteResearchPhrase('Discover Crosstrainer')

  return [
    `${phrase} "2012"`,
    `${phrase} "2016"`,
    `${phrase} "2019"`,
    `${phrase} "launched"`,
    `${phrase} "introduced"`,
    `${phrase} "Discover SE"`,
    `${phrase} "Discover SI"`,
    `${phrase} "SE3"`,
    `${phrase} "SE3HD"`,
    `site:lifefitness.com ${discoverPhrase} "2012"`,
    `site:fitkituk.com ${phrase} "2012"`,
    `site:fitkituk.com ${phrase} "SE3HD"`,
  ]
}

function buildQueryTargetedLifecycleItem(
  hit: SerpResearchHit,
  year: number,
  yearEnd: number | null,
  context: StructuredProductContext,
  options: {
    lifecycleKind: LifecycleEvidenceKind
    label: string
    affectsBaseline: boolean
    isConsoleTimeline: boolean
    lifecycleNotes: string | null
    surroundingText: string
  },
): LifecycleEvidenceItem {
  const domain = hit.domain || extractResearchDomain(hit.url)
  const lifecycleSourceType = classifyLifecycleResearchSourceType({ ...hit, domain }, context.brand)
  const brandModelMatch = matchesLifecycleProductContext(context, options.surroundingText)
  const identity = resolveStructuredEvidenceIdentity(context, options.surroundingText)

  const base: Omit<LifecycleEvidenceItem, 'confidence' | 'score'> = {
    id: nextLifecycleId(),
    type: 'lifecycle',
    label: options.label,
    value: year,
    currency: null,
    year,
    yearEnd,
    surroundingText: options.surroundingText,
    sourceUrl: hit.url,
    sourceDomain: domain,
    sourceType: lifecycleSourceType,
    sourceScore: trustedDealerLifecycleBoost(domain) + 4,
    eligibleForOriginalPrice: false,
    rejectionReason: null,
    extractionMethod: 'structured',
    nearModelName: brandModelMatch,
    brandModelMatch,
    productFamilyMatch: Boolean(context.productFamily
      && options.surroundingText.toLowerCase().includes(context.productFamily.toLowerCase())),
    identityScore: identity?.score ?? null,
    identityLevel: identity?.level ?? null,
    identityLabel: identity?.label ?? null,
    isMarketplace: false,
    isFinancePrice: false,
    lifecycleKind: options.lifecycleKind,
    affectsBaseline: options.affectsBaseline,
    isConsoleTimeline: options.isConsoleTimeline,
    lifecycleNotes: options.lifecycleNotes,
  }

  const scored = scoreLifecycleEvidence(base, context)
  return { ...base, ...scored, confidence: Math.max(scored.confidence, 55) }
}

export function extractLifecycleFromTargetedSerpHits(
  hits: SerpResearchHit[],
  equipment: EquipmentIntelligenceRow & {
    product_family?: string | null
    core_product_name?: string | null
  },
): LifecycleEvidenceItem[] {
  const context = buildStructuredProductContext(equipment)
  const items: LifecycleEvidenceItem[] = []
  const seen = new Set<string>()

  for (const hit of hits) {
    const domain = hit.domain || extractResearchDomain(hit.url)
    const haystack = [hit.title, hit.snippet].filter(Boolean).join('\n')
    if (!haystack.trim()) continue

    const lifecycleSourceType = classifyLifecycleResearchSourceType({ ...hit, domain }, equipment.brand)
    const extracted = extractLifecycleEvidenceFromText(haystack, {
      sourceUrl: hit.url,
      sourceDomain: domain,
      sourceType: lifecycleSourceType,
      brand: equipment.brand,
    }, context)

    for (const item of extracted) {
      const key = `${item.lifecycleKind}:${item.year}:${item.yearEnd}:${item.sourceUrl}`
      if (seen.has(key)) continue
      seen.add(key)
      items.push(item)
    }

    if (!matchesLifecycleProductContext(context, haystack)) continue

    const query = hit.query ?? ''
    const queryYearMatch = query.match(/"(19\d{2}|20\d{2})"/)
    if (queryYearMatch) {
      const year = parseYear(queryYearMatch[1])
      if (year != null && haystack.includes(String(year))) {
        const isConsoleQuery = /\b(?:se3hd?|se3)\b/i.test(query)
        let classification = isConsoleQuery
          ? {
            lifecycleKind: 'console_timeline' as const,
            affectsBaseline: false,
            isConsoleTimeline: true,
            lifecycleNotes: 'Targeted console query match (SE3/SE3HD).',
          }
          : classifyConsoleTimelineContext(haystack)

        if (year === 2019 && /\b2019\s*>/i.test(haystack) && !/\b(?:launch|introduced|initial)\b/i.test(haystack)) {
          classification = {
            ...classification,
            lifecycleKind: 'present',
            affectsBaseline: false,
            isConsoleTimeline: true,
            lifecycleNotes: 'Console refresh marker (2019>) — not a product launch baseline year.',
          }
        }

        const item = buildQueryTargetedLifecycleItem(hit, year, null, context, {
          lifecycleKind: classification.lifecycleKind,
          label: `Targeted query year ${year}`,
          affectsBaseline: classification.affectsBaseline,
          isConsoleTimeline: classification.isConsoleTimeline,
          lifecycleNotes: classification.lifecycleNotes,
          surroundingText: haystack.slice(0, 240),
        })
        const key = `${item.lifecycleKind}:${item.year}:${item.sourceUrl}`
        if (!seen.has(key)) {
          seen.add(key)
          items.push(item)
        }
      }
    }

    if (/\bse3hd?\b/i.test(query) && /\bse3hd?\b/i.test(haystack)) {
      const range = haystack.match(/\b(19\d{2}|20\d{2})\s*[-–]\s*(19\d{2}|20\d{2}|\d{2})\b/)
      const year = range ? parseYear(range[1]) : null
      const yearEnd = range ? parseYear(range[2]) : null
      if (year != null) {
        const item = buildQueryTargetedLifecycleItem(hit, year, yearEnd, context, {
          lifecycleKind: 'console_timeline',
          label: 'Targeted SE3/SE3HD timeline',
          affectsBaseline: false,
          isConsoleTimeline: true,
          lifecycleNotes: 'Console upgrade timeline from targeted SE3/SE3HD search.',
          surroundingText: haystack.slice(0, 240),
        })
        const key = `${item.lifecycleKind}:${item.year}:${item.yearEnd}:${item.sourceUrl}`
        if (!seen.has(key)) {
          seen.add(key)
          items.push(item)
        }
      }
    }
  }

  return items.sort((left, right) => right.score - left.score)
}

export async function collectV3TargetedLifecycleHits(
  equipment: EquipmentIntelligenceRow & { core_product_name?: string | null },
  apiKey: string,
  options: {
    serpRequestTimings?: SerpRequestTiming[]
    serpErrors?: SerpQueryError[]
    startedAt?: number
    fetchSerpResults?: (
      query: string,
      apiKey: string,
    ) => Promise<SerpFetchAttemptResult>
  } = {},
): Promise<{
  queries: string[]
  hits: SerpResearchHit[]
  query_debug: V3LifecycleQueryDebugEntry[]
}> {
  const queries = buildV3TargetedLifecycleQueries(equipment)
  const batch = await runSerpQueryBatch(queries, apiKey, options)
  const hits = rankLifecycleResearchHits(
    dedupeSerpResearchHits(batch.hits),
    equipment.brand,
  )

  const query_debug = queries.map((query) => {
    const queryHits = batch.hits.filter((hit) => hit.query === query)
    return {
      query,
      result_count: queryHits.length,
      snippets: queryHits.slice(0, 3).map((hit) => ({
        title: hit.title,
        snippet: hit.snippet,
        url: hit.url,
        domain: hit.domain || extractResearchDomain(hit.url),
      })),
    }
  })

  return { queries, hits, query_debug }
}

export function hasCredibleBaselineLifecycleEvidence(
  items: LifecycleEvidenceItem[],
): boolean {
  return items.some((item) => (
    item.affectsBaseline
    && item.confidence > 0
    && item.year != null
    && item.rejectionReason == null
  ))
}

export function finalizeV3LifecycleRecommendation(
  recommendation: EquipmentResearchRecommendation,
  lifecycleEvidence: LifecycleEvidenceItem[],
): EquipmentResearchRecommendation {
  const credibleBaseline = lifecycleEvidence.filter((item) => (
    item.affectsBaseline
    && item.confidence > 0
    && item.year != null
    && item.rejectionReason == null
  ))

  if (credibleBaseline.length === 0) {
    return {
      ...recommendation,
      baseline_manufacture_year: null,
      production_start_year: null,
      production_end_year: null,
      production_confidence: null,
      lifecycle_confidence: null,
      lifecycle_notes: lifecycleEvidence.length === 0
        ? 'No structured lifecycle evidence captured from trusted sources or targeted lifecycle searches.'
        : (recommendation.lifecycle_notes
          || 'Structured lifecycle evidence found, but no credible baseline-year candidate (confidence > 0).'),
      production_reasoning: lifecycleEvidence.length === 0
        ? 'No structured lifecycle evidence captured; baseline manufacture year not set.'
        : 'Lifecycle snippets found but none qualified for baseline manufacture year.',
    }
  }

  const resolved = resolveBaselineFromLifecycleEvidence(lifecycleEvidence)
  const bestConfidence = Math.max(...credibleBaseline.map((item) => item.confidence))

  return {
    ...recommendation,
    baseline_manufacture_year: resolved.baselineManufactureYear,
    production_start_year: resolved.productionStartYear,
    production_end_year: resolved.productionEndYear,
    lifecycle_confidence: bestConfidence,
    production_confidence: bestConfidence,
    lifecycle_notes: recommendation.lifecycle_notes || resolved.lifecycleNotes || null,
    production_reasoning: resolved.lifecycleNotes || recommendation.production_reasoning,
  }
}
