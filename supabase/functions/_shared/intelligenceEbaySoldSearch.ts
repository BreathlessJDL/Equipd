import {
  getMinimumUsedPrice,
  type QualityEquipmentContext,
} from './intelligenceCandidateQuality.ts'
import {
  detectModelTokensInTitle,
  extractStrongModelCode,
  getAllowedModelAliases,
  matchStrongModelCode,
} from './intelligenceEbaySoldModelCode.ts'
import {
  parseGbpSoldPriceText,
  resolveApifyEbaySoldPrice,
  type ResolvedEbaySoldPrice,
} from './intelligenceEbaySoldPrice.ts'
import {
  buildModelPhrase,
  getBrandAliases,
  normalizeWhitespace,
  removeDuplicatePhrases,
  removeDuplicateWords,
  type EquipmentIntelligenceRow,
} from './intelligenceMarketSearch.ts'

export type EbaySoldScoreBreakdown = {
  title: string
  status: 'accepted' | 'review' | 'rejected'
  final_confidence: number
  confidence_before_warnings: number
  base_score: number
  brand_score: number
  model_score: number
  equipment_type_score: number
  series_range_bonus: number
  sold_completed_bonus: number
  service_working_bonus: number
  low_price_penalty: number
  parts_accessory_hard_reject: string | null
  wrong_model_hard_reject: string | null
  missing_model_result: string | null
  expected_brand: string | null
  detected_brand: string | null
  brand_match: boolean
  expected_model: string | null
  detected_model_tokens: string[]
  matched_alias: string | null
  parts_terms_detected: string[]
  faulty_terms_detected: string[]
  reason: string
  score_path: string
  scoring_steps: string[]
}

export type EbaySoldCalibrationSummary = {
  accepted_count: number
  review_count: number
  rejected_count: number
  average_confidence: number
  rejected_by_parts_accessory_count: number
  rejected_by_wrong_model_count: number
  review_missing_exact_model_count: number
  low_price_penalised_count: number
}

export type EbaySoldCandidate = {
  price: number | null
  currency: 'GBP'
  title: string
  url: string
  sold_at: string | null
  condition: string | null
  source: 'ebay_sold'
  source_domain: string
  snippet: string
  confidence: number
  confidence_before_warnings?: number
  final_confidence?: number
  status: 'accepted' | 'review' | 'rejected'
  reason: string
  needs_review?: boolean
  structured_price_raw?: string | number | null
  price_used?: number | null
  price_source?: string | null
  required_terms?: string[]
  optional_terms?: string[]
  matched_terms?: string[]
  missing_required_terms?: string[]
  strong_model_code?: string | null
  allowed_model_aliases?: string[]
  expected_model_code?: string | null
  generated_aliases?: string[]
  detected_model_tokens_in_title?: string[]
  model_code_found?: boolean
  matched_alias?: string | null
  low_price_warning?: boolean
  parts_terms_detected?: string[]
  faulty_terms_detected?: string[]
  image_url?: string | null
  metadata_model_tokens?: string[]
  match_terms_found?: string[]
  missing_terms?: string[]
  score_breakdown?: EbaySoldScoreBreakdown
}

export type EbaySoldSearchProvider = 'direct' | 'apify'

export type ApifyEbaySoldInput = {
  keywords: string[]
  daysToScrape: number
  count: number
  category: string
  subcategory: string
  ebaySite: 'ebay.co.uk'
  sortOrder: 'endedRecently'
  minPrice: number
  condition: 'Used'
}

export type EbayKeywordAttempt = {
  keyword: string
  dataset_count: number
}

export type EbaySoldSearchResult = {
  query_run: string
  ebay_url: string
  raw_result_count: number
  candidates: EbaySoldCandidate[]
  accepted_count: number
  review_count: number
  rejected_count: number
  provider: EbaySoldSearchProvider
  actor_id?: string
  dataset_item_count?: number
  apify_input?: ApifyEbaySoldInput
  keyword_attempts?: EbayKeywordAttempt[]
  final_keyword?: string
  calibration_summary?: EbaySoldCalibrationSummary
}

type EbayRawListing = {
  title: string
  link: string
  condition?: string
  sold_date?: string
  price_raw?: string
  structured_price_raw?: string | number | null
  price_numeric?: number | null
  price_source?: ResolvedEbaySoldPrice['price_source']
  image_url?: string | null
  metadata_text?: string
}

const EBAY_FETCH_TIMEOUT_MS = 10000
const APIFY_FETCH_TIMEOUT_MS = 120_000
const MAX_EBAY_HTML_BYTES = 2_500_000
const DEFAULT_APIFY_EBAY_SOLD_ACTOR_ID = 'caffein.dev/ebay-sold-listings'
const MAX_EBAY_CANDIDATES = 20
const MAX_APIFY_KEYWORD_ATTEMPTS = 3
const ACCEPTED_CONFIDENCE_MIN = 80
const LOW_PRICE_CONFIDENCE_PENALTY = 8
const APIFY_EBAY_SOLD_DAYS_TO_SCRAPE_DEFAULT = 30
const APIFY_EBAY_SOLD_DAYS_TO_SCRAPE_MAX = 90

type ApifyEbaySoldItem = {
  title?: string
  url?: string
  condition?: string
  endedAt?: string
  soldPrice?: number | string
  totalPrice?: number | string
  price?: number | string
  soldCurrency?: string
  image?: string
  imageUrl?: string
  thumbnail?: string
  primaryImage?: string
  galleryImage?: string
  description?: string
  productDetail?: string
  itemSpecifics?: unknown
}

const EBAY_VARIANT_TERMS = new Set([
  'c',
  'led',
  'console',
  'pm5',
  'unity',
  'tv',
  'discover',
  'se',
  'classic',
])

const EQUIPMENT_DESCRIPTOR_PHRASES = [
  'indoor bike',
  'spin bike',
  'exercise bike',
  'group exercise bike',
  'indoor cycle',
  'spinning bike',
  'rowing machine',
  'rower',
  'treadmill',
  'elliptical',
  'cross trainer',
  'upright bike',
  'recumbent bike',
  'indoor cycling bike',
]

const DESCRIPTOR_EQUIVALENCE_GROUPS = [
  ['indoor bike', 'spin bike', 'exercise bike', 'group exercise bike', 'indoor cycle', 'spinning bike'],
  ['recumbent bike', 'recumbent exercise bike', 'recumbent cycle'],
]

const SERIES_RANGE_CONFIDENCE_PATTERNS: Array<{ label: string; pattern: RegExp; points: number }> = [
  { label: 'Silver Line', pattern: /\bsilver\s+line\b/i, points: 3 },
  { label: 'Integrity', pattern: /\bintegrity\b/i, points: 3 },
  { label: 'Club Series', pattern: /\bclub\s+series\b/i, points: 3 },
  { label: 'Discover', pattern: /\bdiscover\b/i, points: 2 },
  { label: 'SE', pattern: /\bSE\b/, points: 2 },
  { label: 'SL', pattern: /\bSL\b/, points: 2 },
  { label: 'Classic', pattern: /\bclassic\b/i, points: 2 },
  { label: 'Generation', pattern: /\bgeneration\b/i, points: 2 },
  { label: 'LED', pattern: /\bLED\b/i, points: 2 },
  { label: 'Track Connect', pattern: /\btrack\s+connect\b/i, points: 2 },
  { label: 'Console', pattern: /\bconsole\b/i, points: 2 },
]

const TREADMILL_TYPE_PHRASES = [
  'treadmill',
  'running machine',
  'running equipment',
]

const EBAY_PARTS_HARD_REJECT_PATTERNS: Array<{ label: string; pattern: RegExp }> = [
  { label: 'front roller', pattern: /\bfront\s+roller\b/i },
  { label: 'rear roller', pattern: /\brear\s+roller\b/i },
  { label: 'roller', pattern: /\broller\b/i },
  { label: 'belt only', pattern: /\bbelt\s+only\b/i },
  { label: 'running belt', pattern: /\brunning\s+belt\b/i },
  { label: 'motor', pattern: /\bmotor\b/i },
  { label: 'controller', pattern: /\bcontroller\b/i },
  { label: 'control board', pattern: /\bcontrol\s+board\b/i },
  { label: 'PCB', pattern: /\bPCB\b/i },
  { label: 'console only', pattern: /\bconsole\s+only\b/i },
  { label: 'display', pattern: /\bdisplay\b/i },
  { label: 'screen', pattern: /\bscreen\b/i },
  { label: 'deck', pattern: /\bdeck\b/i },
  { label: 'side rail', pattern: /\bside\s+rail\b/i },
  { label: 'cover', pattern: /\bcover\b/i },
  { label: 'cap', pattern: /\bcap\b/i },
  { label: 'wheel', pattern: /\bwheel\b/i },
  { label: 'pulley', pattern: /\bpulley\b/i },
  { label: 'bearing', pattern: /\bbearing\b/i },
  { label: 'cable', pattern: /\bcable\b/i },
  { label: 'sensor', pattern: /\bsensor\b/i },
  { label: 'key', pattern: /\bkey\b/i },
  { label: 'parts', pattern: /\bparts?\b/i },
  { label: 'spares', pattern: /\bspares?\b/i },
  { label: 'accessory', pattern: /\baccessory\b/i },
  { label: 'accessories', pattern: /\baccessories\b/i },
  { label: 'part number', pattern: /\b[A-Z0-9]*[A-Z][A-Z0-9]*-\d{4,}-\d{4,}\b/i },
]

const EBAY_FAULTY_HARD_REJECT_PATTERNS: Array<{ label: string; pattern: RegExp }> = [
  { label: 'faulty', pattern: /\bfaulty\b/i },
  { label: 'not working', pattern: /\bnot\s+working\b/i },
  { label: 'for repair', pattern: /\bfor\s+repair\b/i },
  { label: 'repair only', pattern: /\brepair\s+only\b/i },
]

const EBAY_GENERAL_REJECT_PATTERNS: Array<{ label: string; pattern: RegExp }> = [
  { label: 'brand new', pattern: /\bbrand\s+new\b/i },
  { label: 'new retail', pattern: /\bnew\s+in\s+box\b/i },
  { label: 'job lot', pattern: /\bjob\s+lot\b/i },
  { label: 'bundle', pattern: /\bbundle\b/i },
]

const NEW_CONDITION_PATTERNS = [
  /\bbrand\s+new\b/i,
  /\bnew\b/i,
  /\bnew\s+other\b/i,
]

const SKIP_TITLE_PATTERNS = [
  /^shop on ebay$/i,
  /^results matching fewer words$/i,
  /^tell us what you think/i,
]

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
}

function stripHtmlTags(value: string): string {
  return decodeHtmlEntities(value.replace(/<[^>]+>/g, ' '))
}

function tokenize(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 1)
}

function brandMatchesText(text: string, brand: string): boolean {
  const haystack = text.toLowerCase()
  return getBrandAliases(brand).some((alias) => {
    const needle = alias.toLowerCase()
    if (haystack.includes(needle)) return true
    const compactNeedle = needle.replace(/[^a-z0-9]+/g, '')
    const compactHaystack = haystack.replace(/[^a-z0-9]+/g, '')
    return compactNeedle.length > 0 && compactHaystack.includes(compactNeedle)
  })
}

function scoreModelSimilarity(
  equipment: EquipmentIntelligenceRow,
  text: string,
): { level: 'High' | 'Medium' | 'Low'; confidence: number; exactModelMatch: boolean } {
  const brand = normalizeWhitespace(equipment.brand ?? '')
  const modelPhrase = buildModelPhrase(equipment.series ?? '', equipment.model ?? '')
  const model = normalizeWhitespace(equipment.model ?? '')
  const series = normalizeWhitespace(equipment.series ?? '')

  if (!brand || !brandMatchesText(text, brand)) {
    return { level: 'Low', confidence: 40, exactModelMatch: false }
  }

  const textLower = text.toLowerCase()
  const modelPhraseLower = modelPhrase.toLowerCase()
  const modelLower = model.toLowerCase()

  if (modelPhraseLower && textLower.includes(modelPhraseLower)) {
    return { level: 'High', confidence: 92, exactModelMatch: true }
  }

  if (modelLower && textLower.includes(modelLower)) {
    return { level: 'High', confidence: 90, exactModelMatch: true }
  }

  const modelTokens = tokenize(modelPhrase || model).filter((token) => token.length > 2)
  const matchedModelTokens = modelTokens.filter((token) => textLower.includes(token))

  if (modelTokens.length > 0 && matchedModelTokens.length === modelTokens.length) {
    return { level: 'High', confidence: 86, exactModelMatch: true }
  }

  if (matchedModelTokens.length > 0) {
    return { level: 'Medium', confidence: 72, exactModelMatch: false }
  }

  if (series && textLower.includes(series.toLowerCase())) {
    return { level: 'Medium', confidence: 65, exactModelMatch: false }
  }

  return { level: 'Low', confidence: 45, exactModelMatch: false }
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

function normalizeBrandKey(brand: string): string {
  return brand.toLowerCase().replace(/[^a-z0-9]+/g, '')
}

export function normalizeEbaySearchBrand(brand: string): string {
  const normalized = normalizeWhitespace(brand)
  if (!normalized) return ''

  const brandKey = normalizeBrandKey(normalized)
  if (brandKey === 'concept2' || brandKey === 'conceptii') {
    return 'Concept2'
  }

  for (const alias of getBrandAliases(normalized)) {
    const aliasKey = normalizeBrandKey(alias)
    if (aliasKey === 'concept2' || aliasKey === 'conceptii') {
      return 'Concept2'
    }
  }

  return normalized
}

function dedupeEbayKeywords(keywords: string[]): string[] {
  const seen = new Set<string>()
  const result: string[] = []

  for (const keyword of keywords) {
    const normalized = normalizeWhitespace(keyword)
    if (!normalized) continue

    const key = normalized.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    result.push(normalized)
  }

  return result
}

function buildEbayKeywordPhrase(parts: string[]): string {
  return removeDuplicatePhrases(removeDuplicateWords(parts.filter(Boolean).join(' ')))
}

function isConcept2Equipment(brand: string): boolean {
  return normalizeEbaySearchBrand(brand) === 'Concept2'
}

function isRowerEquipment(equipment: EquipmentIntelligenceRow): boolean {
  const haystack = [
    equipment.equipment_type,
    equipment.category,
    equipment.model,
    equipment.series,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()

  return /(rower|rowing)/.test(haystack)
}

function extractModelDesignation(
  model: string,
  series: string,
): { modelLabel: string | null; modelLetter: string | null; hasPm5: boolean } {
  const combined = normalizeWhitespace(`${series} ${model}`)
  const hasPm5 = /\bpm5\b/i.test(combined)
  const modelMatch = combined.match(/\bmodel\s+([a-z0-9]+)\b/i)

  if (!modelMatch?.[1]) {
    return { modelLabel: null, modelLetter: null, hasPm5 }
  }

  const token = modelMatch[1]
  const modelLetter = /^[a-z]$/i.test(token) ? token.toUpperCase() : null
  const modelLabel = modelLetter ? `Model ${modelLetter}` : `Model ${token}`

  return { modelLabel, modelLetter, hasPm5 }
}

function buildConcept2RowerKeywords(equipment: EquipmentIntelligenceRow): string[] {
  const { modelLabel, modelLetter, hasPm5 } = extractModelDesignation(
    equipment.model ?? '',
    equipment.series ?? '',
  )

  if (!modelLabel || !modelLetter) return []

  const pm5Suffix = hasPm5 ? ' PM5' : ''
  const pm5SuffixLower = hasPm5 ? ' pm5' : ''

  return [
    `Concept2 rowing machine ${modelLabel}${pm5Suffix}`,
    `Concept2 ${modelLabel} rower${pm5Suffix}`,
    `Concept 2 rowing machine model ${modelLetter.toLowerCase()}${pm5SuffixLower}`,
    `Concept2 ${modelLabel} rower`,
    `Concept2 rower ${modelLabel}`,
    `Concept 2 rowing machine ${modelLabel}${pm5Suffix}`,
  ]
}

export function normalizeEbayMatchText(value: string): string {
  return normalizeWhitespace(
    String(value ?? '')
      .toLowerCase()
      .replace(/\(\s*\d{4}\s*[-–]\s*\d{4}\s*\)/g, ' ')
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .replace(/\s+/g, ' '),
  ).trim()
}

export function stripModelYearRange(model: string): string {
  return normalizeWhitespace(String(model ?? '').replace(/\(\s*\d{4}\s*[-–]\s*\d{4}\s*\)/gi, ''))
}

export function extractCoreModelTerms(model: string): string[] {
  const core = stripModelYearRange(model)
  const withoutDescriptors = stripDescriptorPhrases(core)
  const normalized = normalizeEbayMatchText(withoutDescriptors)
  if (!normalized) return []

  const tokens = normalized
    .split(' ')
    .filter((token) => token.length > 1 && !EBAY_VARIANT_TERMS.has(token))
    .filter((token) => !isEquipmentDescriptor(token))

  if (tokens.length > 0) return tokens

  const compact = normalized.replace(/\s/g, '')
  return compact.length > 1 ? [compact] : []
}

function isMeaningfulSeries(series: string, model: string): boolean {
  const normalizedSeries = normalizeWhitespace(series)
  if (!normalizedSeries || normalizedSeries.length < 2) return false

  const seriesLower = normalizedSeries.toLowerCase()
  const modelLower = normalizeWhitespace(model).toLowerCase()
  if (seriesLower === modelLower) return false

  return true
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function stripDescriptorPhrases(text: string): string {
  let normalized = normalizeEbayMatchText(text)
  const sortedDescriptors = [...EQUIPMENT_DESCRIPTOR_PHRASES].sort((a, b) => b.length - a.length)

  for (const descriptor of sortedDescriptors) {
    const pattern = descriptor.replace(/\s+/g, '\\s+')
    normalized = normalized.replace(new RegExp(`\\b${pattern}\\b`, 'g'), ' ')
  }

  return normalizeWhitespace(normalized)
}

function collectDescriptorPhrases(...sources: Array<string | null | undefined>): string[] {
  const descriptors: string[] = []

  for (const source of sources) {
    const phrase = normalizeWhitespace(source ?? '')
    if (!phrase) continue

    if (isEquipmentDescriptor(phrase)) {
      descriptors.push(phrase)
      continue
    }

    const normalized = normalizeEbayMatchText(phrase)
    for (const descriptor of EQUIPMENT_DESCRIPTOR_PHRASES) {
      if (normalized.includes(descriptor)) {
        descriptors.push(descriptor)
      }
    }
  }

  return dedupeMatchTerms(descriptors)
}

function dedupeMatchTerms(terms: string[]): string[] {
  const seen = new Set<string>()
  const result: string[] = []

  for (const term of terms) {
    const normalized = normalizeWhitespace(term)
    if (!normalized) continue
    const key = normalized.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    result.push(normalized)
  }

  return result
}

function isEquipmentDescriptor(phrase: string): boolean {
  const normalized = normalizeEbayMatchText(phrase)
  if (!normalized) return false

  return EQUIPMENT_DESCRIPTOR_PHRASES.some(
    (descriptor) => normalized === descriptor || normalized.includes(descriptor),
  )
}

function expandDescriptorEquivalents(descriptors: string[]): string[] {
  const expanded = new Set<string>()

  for (const descriptor of descriptors) {
    const normalized = normalizeEbayMatchText(descriptor)
    if (!normalized) continue

    expanded.add(normalized)

    for (const group of DESCRIPTOR_EQUIVALENCE_GROUPS) {
      if (group.some((phrase) => normalized.includes(phrase) || phrase.includes(normalized))) {
        for (const phrase of group) expanded.add(phrase)
      }
    }
  }

  return [...expanded]
}

export { extractStrongModelCode } from './intelligenceEbaySoldModelCode.ts'

function buildMatchRequirements(equipment: EquipmentIntelligenceRow): {
  required_terms: string[]
  optional_terms: string[]
  strong_model_code: string | null
  allowed_model_aliases: string[]
} {
  const brand = normalizeEbaySearchBrand(equipment.brand ?? '')
  const model = stripModelYearRange(equipment.model ?? '')
  const series = normalizeWhitespace(equipment.series ?? '')
  const equipmentType = normalizeWhitespace(equipment.equipment_type ?? '')
  const strongModelCode = extractStrongModelCode(model, series, equipmentType)
  const allowedModelAliases = strongModelCode ? getAllowedModelAliases(strongModelCode) : []

  const requiredTerms: string[] = []
  const optionalTerms: string[] = []

  if (brand) requiredTerms.push(brand)

  if (strongModelCode) {
    requiredTerms.push(strongModelCode)
    optionalTerms.push(
      ...collectDescriptorPhrases(series, equipmentType, equipment.model),
    )
  } else if (!isConcept2Equipment(brand)) {
    for (const term of extractCoreModelTerms(model)) {
      requiredTerms.push(term)
    }
  } else {
    for (const term of extractCoreModelTerms(model)) {
      requiredTerms.push(term)
    }
  }

  if (series && isMeaningfulSeries(series, model) && !isEquipmentDescriptor(series)) {
    optionalTerms.push(series)
  }

  return {
    required_terms: dedupeMatchTerms(requiredTerms),
    optional_terms: dedupeMatchTerms([
      ...optionalTerms,
      ...expandDescriptorEquivalents(optionalTerms),
    ]),
    strong_model_code: strongModelCode,
    allowed_model_aliases: allowedModelAliases,
  }
}

function descriptorMatchesText(descriptor: string, text: string): boolean {
  const normalizedText = normalizeEbayMatchText(text)
  const normalizedDescriptor = normalizeEbayMatchText(descriptor)
  if (!normalizedDescriptor) return false

  const phrases = expandDescriptorEquivalents([descriptor])
  return phrases.some((phrase) => normalizedText.includes(phrase))
}

function requiredTermMatchesText(term: string, text: string): boolean {
  const normalizedText = normalizeEbayMatchText(text)
  const compactText = normalizedText.replace(/\s/g, '')
  const normalizedTerm = normalizeEbayMatchText(term)
  const compactTerm = normalizedTerm.replace(/\s/g, '')

  if (getBrandAliases(term).length > 0 || term.includes(' ')) {
    if (brandMatchesText(text, term)) return true
  }

  if (/^ic\d+$/i.test(term)) {
    const numeric = term.replace(/^ic/i, '')
    return (
      new RegExp(`\\bIC\\s*-?\\s*${numeric}\\b`, 'i').test(text) ||
      compactText.includes(`ic${numeric}`)
    )
  }

  if (normalizedTerm.startsWith('model ')) {
    return normalizedText.includes(normalizedTerm) || compactText.includes(compactTerm)
  }

  if (normalizedTerm.startsWith('efx')) {
    return normalizedText.includes(normalizedTerm) || compactText.includes(compactTerm)
  }

  if (compactTerm === 'powermill') {
    return compactText.includes('powermill')
  }

  if (['skillbike', 'skillmill', '95ti', 't7xi', '770a', 'pm5'].includes(compactTerm)) {
    return compactText.includes(compactTerm)
  }

  if (normalizedText.includes(normalizedTerm)) return true
  return compactTerm.length > 1 && compactText.includes(compactTerm)
}

type EbaySoldMatchAnalysis = {
  required_terms: string[]
  optional_terms: string[]
  matched_terms: string[]
  missing_required_terms: string[]
  match_terms_found: string[]
  missing_terms: string[]
  brand_match: boolean
  core_model_match: boolean
  descriptor_match: boolean
  strong_model_code: string | null
  allowed_model_aliases: string[]
  expected_model_code: string | null
  generated_aliases: string[]
  detected_model_tokens_in_title: string[]
  model_code_found: boolean
  matched_alias: string | null
  series_match: boolean
  model_match: boolean
}

function analyzeEbaySoldMatch(
  equipment: EquipmentIntelligenceRow,
  title: string,
): EbaySoldMatchAnalysis {
  const requirements = buildMatchRequirements(equipment)
  const matchedTerms: string[] = []
  const missingRequiredTerms: string[] = []

  const brandMatch = !normalizeWhitespace(equipment.brand ?? '') ||
    brandMatchesText(title, equipment.brand ?? '')

  if (brandMatch && normalizeWhitespace(equipment.brand ?? '')) {
    matchedTerms.push(`brand:${normalizeEbaySearchBrand(equipment.brand ?? '')}`)
  } else if (normalizeWhitespace(equipment.brand ?? '')) {
    missingRequiredTerms.push(`brand:${normalizeEbaySearchBrand(equipment.brand ?? '')}`)
  }

  const allowedModelAliases = requirements.allowed_model_aliases
  const detectedModelTokens = detectModelTokensInTitle(title)
  const modelCodeMatch = requirements.strong_model_code
    ? matchStrongModelCode(requirements.strong_model_code, title)
    : { matched: false, matched_alias: null }
  const modelCodeFound = modelCodeMatch.matched

  const coreModelTerms = requirements.strong_model_code
    ? [requirements.strong_model_code]
    : requirements.required_terms.filter(
        (term) =>
          term !== normalizeEbaySearchBrand(equipment.brand ?? '') &&
          !normalizeEbayMatchText(term).includes(normalizeEbaySearchBrand(equipment.brand ?? '').toLowerCase()),
      )

  if (requirements.strong_model_code) {
    if (modelCodeFound) {
      matchedTerms.push(`model:${requirements.strong_model_code}`)
    } else {
      missingRequiredTerms.push(`model:${requirements.strong_model_code}`)
    }
  } else {
    for (const term of coreModelTerms) {
      if (requiredTermMatchesText(term, title)) {
        matchedTerms.push(`model:${term}`)
      } else {
        missingRequiredTerms.push(`model:${term}`)
      }
    }
  }

  const coreModelMatch = requirements.strong_model_code
    ? modelCodeFound
    : coreModelTerms.length === 0 ||
      coreModelTerms.every((term) => requiredTermMatchesText(term, title))

  for (const term of requirements.required_terms) {
    if (term === normalizeEbaySearchBrand(equipment.brand ?? '')) continue
    if (coreModelTerms.includes(term)) continue
    if (requirements.strong_model_code) continue
    if (isEquipmentDescriptor(term)) continue

    if (requiredTermMatchesText(term, title)) {
      matchedTerms.push(`series:${term}`)
    } else {
      missingRequiredTerms.push(`series:${term}`)
    }
  }

  const descriptorMatch = requirements.optional_terms.length === 0 ||
    requirements.optional_terms.some((term) => descriptorMatchesText(term, title))

  if (descriptorMatch) {
    for (const term of requirements.optional_terms) {
      if (descriptorMatchesText(term, title)) {
        matchedTerms.push(`descriptor:${term}`)
      }
    }
  }

  return {
    required_terms: requirements.required_terms,
    optional_terms: requirements.optional_terms,
    matched_terms: matchedTerms,
    missing_required_terms: missingRequiredTerms,
    match_terms_found: matchedTerms,
    missing_terms: missingRequiredTerms,
    brand_match: brandMatch,
    core_model_match: coreModelMatch,
    descriptor_match: descriptorMatch,
    strong_model_code: requirements.strong_model_code,
    allowed_model_aliases: allowedModelAliases,
    expected_model_code: requirements.strong_model_code,
    generated_aliases: allowedModelAliases,
    detected_model_tokens_in_title: detectedModelTokens,
    model_code_found: modelCodeFound,
    matched_alias: modelCodeMatch.matched_alias,
    series_match: missingRequiredTerms.every((term) => !term.startsWith('series:')),
    model_match: coreModelMatch,
  }
}

function scoreSeriesRangeBonus(
  equipment: EquipmentIntelligenceRow,
  text: string,
): { bonus: number; steps: string[] } {
  const steps: string[] = []
  let bonus = 0
  const series = normalizeWhitespace(equipment.series ?? '')

  if (series && isMeaningfulSeries(series, equipment.model ?? '')) {
    if (requiredTermMatchesText(series, text)) {
      bonus += 3
      steps.push(`Expected series (${series}): +3`)
    }
  }

  for (const entry of SERIES_RANGE_CONFIDENCE_PATTERNS) {
    if (entry.pattern.test(text)) {
      bonus += entry.points
      steps.push(`${entry.label}: +${entry.points}`)
    }
  }

  return { bonus: Math.min(8, bonus), steps }
}

function getWrongEquipmentTypeReason(
  equipment: EquipmentIntelligenceRow,
  text: string,
  analysis: EbaySoldMatchAnalysis,
): string | null {
  if (!analysis.brand_match || !analysis.model_code_found) return null
  if (equipmentTypeMatchesText(equipment, text)) return null

  const expectedType = normalizeWhitespace(equipment.equipment_type ?? '') || 'equipment type'
  return `Wrong equipment type: expected ${expectedType}`
}

function scoreEbaySoldSimilarity(
  equipment: EquipmentIntelligenceRow,
  text: string,
  analysis: EbaySoldMatchAnalysis,
): { level: 'High' | 'Medium' | 'Low'; confidence: number; exactModelMatch: boolean } {
  if (!analysis.brand_match) {
    return { level: 'Low', confidence: 40, exactModelMatch: false }
  }

  if (analysis.strong_model_code && !analysis.model_code_found) {
    return { level: 'Low', confidence: 28, exactModelMatch: false }
  }

  if (analysis.core_model_match) {
    const baseConfidence = analysis.descriptor_match &&
        analysis.optional_terms.length > 0
      ? 94
      : 88
    const confidence = Math.min(96, baseConfidence + scoreServiceConditionBonus(text))
    return { level: 'High', confidence, exactModelMatch: true }
  }

  if (analysis.strong_model_code) {
    return { level: 'Low', confidence: 28, exactModelMatch: false }
  }

  if (analysis.missing_required_terms.length === 0) {
    return { level: 'High', confidence: 85, exactModelMatch: true }
  }

  return scoreModelSimilarity(equipment, text)
}

function resolveListingPrice(listing: EbayRawListing): {
  price: number | null
  structured_price_raw: string | number | null
  price_used: number | null
  price_source: string | null
} {
  if (listing.price_numeric != null) {
    return {
      price: listing.price_numeric,
      structured_price_raw: listing.structured_price_raw ?? listing.price_numeric,
      price_used: listing.price_numeric,
      price_source: listing.price_source ?? 'structured',
    }
  }

  const parsed = parseGbpSoldPriceText(listing.price_raw ?? '')
  return {
    price: parsed,
    structured_price_raw: listing.price_raw ?? null,
    price_used: parsed,
    price_source: parsed != null ? 'text' : null,
  }
}

function buildStrictCanonicalKeyword(equipment: EquipmentIntelligenceRow): string {
  const brand = normalizeEbaySearchBrand(equipment.brand ?? '')
  const series = normalizeWhitespace(equipment.series ?? '')
  const model = normalizeWhitespace(equipment.model ?? '')
  return buildEbayKeywordPhrase([brand, series, model])
}

function buildGeneralEbayKeywords(equipment: EquipmentIntelligenceRow): string[] {
  const brand = normalizeEbaySearchBrand(equipment.brand ?? '')
  const model = normalizeWhitespace(equipment.model ?? '')
  const series = normalizeWhitespace(equipment.series ?? '')
  const equipmentType = normalizeWhitespace(equipment.equipment_type ?? '')

  if (!brand) return []

  const keywords = [
    buildEbayKeywordPhrase([brand, series, model]),
    buildEbayKeywordPhrase([brand, model]),
    buildEbayKeywordPhrase([brand, equipmentType, model]),
  ]

  return dedupeEbayKeywords(keywords)
}

export function buildEbayKeywordVariants(
  equipment: EquipmentIntelligenceRow,
  customKeyword?: string,
): string[] {
  const override = normalizeWhitespace(customKeyword ?? '')
  if (override) return [override]

  const brand = normalizeWhitespace(equipment.brand ?? '')

  if (isConcept2Equipment(brand) && isRowerEquipment(equipment)) {
    return dedupeEbayKeywords(buildConcept2RowerKeywords(equipment))
  }

  return buildGeneralEbayKeywords(equipment)
}

export function buildEbaySoldSearchQuery(
  equipment: EquipmentIntelligenceRow,
  customKeyword?: string,
): string {
  const override = normalizeWhitespace(customKeyword ?? '')
  if (override) return override

  const brand = normalizeWhitespace(equipment.brand ?? '')
  if (isConcept2Equipment(brand) && isRowerEquipment(equipment)) {
    return buildEbayKeywordVariants(equipment)[0] ?? ''
  }

  return buildStrictCanonicalKeyword(equipment)
}

export function buildEbaySoldSearchUrl(query: string): string {
  const url = new URL('https://www.ebay.co.uk/sch/i.html')
  url.searchParams.set('_fsrp', '1')
  url.searchParams.set('rt', 'nc')
  url.searchParams.set('_from', 'R40')
  url.searchParams.set('_nkw', query)
  url.searchParams.set('_sacat', '0')
  url.searchParams.set('LH_Sold', '1')
  return url.toString()
}

function findMatchedTerms(
  text: string,
  patterns: Array<{ label: string; pattern: RegExp }>,
): string[] {
  const found: string[] = []
  for (const { label, pattern } of patterns) {
    if (pattern.test(text)) found.push(label)
  }
  return found
}

function findPartsTerms(text: string): string[] {
  return findMatchedTerms(text, EBAY_PARTS_HARD_REJECT_PATTERNS)
}

function findFaultyTerms(text: string): string[] {
  return findMatchedTerms(text, EBAY_FAULTY_HARD_REJECT_PATTERNS)
}

function findGeneralRejectLabel(text: string): string | null {
  for (const { label, pattern } of EBAY_GENERAL_REJECT_PATTERNS) {
    if (pattern.test(text)) return label
  }
  return null
}

function hasConflictingModelCode(
  expectedCanonical: string,
  title: string,
): string | null {
  const detected = detectModelTokensInTitle(title)
  const conflicting = detected.filter(
    (code) => code.toLowerCase() !== expectedCanonical.toLowerCase(),
  )
  if (conflicting.length === 0) return null
  return `Different model code detected: expected ${expectedCanonical}, found ${conflicting.join(', ')}`
}

function equipmentTypeMatchesText(
  equipment: EquipmentIntelligenceRow,
  text: string,
): boolean {
  const normalizedText = normalizeEbayMatchText(text)
  const equipmentType = normalizeEbayMatchText(equipment.equipment_type ?? '')
  if (!equipmentType) return false

  if (normalizedText.includes(equipmentType)) return true

  if (equipmentType.includes('treadmill')) {
    return TREADMILL_TYPE_PHRASES.some((phrase) => normalizedText.includes(phrase))
  }

  return descriptorMatchesText(equipment.equipment_type ?? '', text)
}

function isVagueBrandEquipmentMatch(
  equipment: EquipmentIntelligenceRow,
  analysis: EbaySoldMatchAnalysis,
  title: string,
): boolean {
  if (!analysis.brand_match) return false
  if (!analysis.strong_model_code) return false
  if (analysis.model_code_found) return false
  if (hasConflictingModelCode(analysis.strong_model_code, title)) return false
  return equipmentTypeMatchesText(equipment, title)
}

function scoreServiceConditionBonus(text: string): number {
  let bonus = 0
  if (/\b(fully\s+)?working\b/i.test(text)) bonus += 1
  if (/\bserviced\b/i.test(text)) bonus += 1
  if (/\brefurbished\b/i.test(text)) bonus += 1
  if (/\bcommercial\b/i.test(text)) bonus += 1
  if (/\bheavy\s+duty\b/i.test(text)) bonus += 1
  if (/\bgym\s+quality\b/i.test(text)) bonus += 1
  return Math.min(3, bonus)
}

function scoreVagueMatchConfidence(
  equipment: EquipmentIntelligenceRow,
  text: string,
  analysis: EbaySoldMatchAnalysis,
): number {
  return buildVagueMatchScoreBreakdown(equipment, text, analysis).final_confidence
}

const EXACT_MODEL_BRAND_SCORE = 40
const EXACT_MODEL_CODE_SCORE = 48
const EXACT_MODEL_DESCRIPTOR_SCORE = 6
const VAGUE_REVIEW_BASE_WITHOUT_BRAND_SCORE = 55 - EXACT_MODEL_BRAND_SCORE

type ScoreBreakdownContext = {
  title: string
  listingText: string
  combinedText: string
  equipment: EquipmentIntelligenceRow
  matchAnalysis: EbaySoldMatchAnalysis
  partsTermsDetected: string[]
  faultyTermsDetected: string[]
  soldAt: string | null
  price: number | null
  minPrice: number
}

function expectedBrandLabel(equipment: EquipmentIntelligenceRow): string | null {
  const brand = normalizeEbaySearchBrand(equipment.brand ?? '')
  return brand || null
}

function resolveBrandScore(analysis: EbaySoldMatchAnalysis): number {
  return analysis.brand_match ? EXACT_MODEL_BRAND_SCORE : 0
}

function detectedBrandLabel(
  equipment: EquipmentIntelligenceRow,
  analysis: EbaySoldMatchAnalysis,
): string | null {
  if (!analysis.brand_match) return null
  return expectedBrandLabel(equipment)
}

function buildScoreBreakdownBase(
  context: ScoreBreakdownContext,
): Omit<
  EbaySoldScoreBreakdown,
  | 'status'
  | 'final_confidence'
  | 'confidence_before_warnings'
  | 'base_score'
  | 'brand_score'
  | 'model_score'
  | 'equipment_type_score'
  | 'series_range_bonus'
  | 'sold_completed_bonus'
  | 'service_working_bonus'
  | 'low_price_penalty'
  | 'parts_accessory_hard_reject'
  | 'wrong_model_hard_reject'
  | 'missing_model_result'
  | 'reason'
  | 'score_path'
  | 'scoring_steps'
> {
  return {
    title: context.title,
    expected_brand: expectedBrandLabel(context.equipment),
    detected_brand: detectedBrandLabel(context.equipment, context.matchAnalysis),
    brand_match: context.matchAnalysis.brand_match,
    expected_model: context.matchAnalysis.expected_model_code,
    detected_model_tokens: [...context.matchAnalysis.detected_model_tokens_in_title],
    matched_alias: context.matchAnalysis.matched_alias,
    parts_terms_detected: [...context.partsTermsDetected],
    faulty_terms_detected: [...context.faultyTermsDetected],
  }
}

function buildVagueMatchScoreBreakdown(
  equipment: EquipmentIntelligenceRow,
  text: string,
  analysis: EbaySoldMatchAnalysis,
): {
  base_score: number
  brand_score: number
  model_score: number
  equipment_type_score: number
  service_working_bonus: number
  final_confidence: number
  scoring_steps: string[]
} {
  const brandScore = resolveBrandScore(analysis)
  const baseScore = VAGUE_REVIEW_BASE_WITHOUT_BRAND_SCORE
  const scoring_steps: string[] = [
    `Brand match: +${brandScore}`,
    `Vague review base: +${baseScore}`,
  ]
  let equipmentTypeScore = 0
  let serviceWorkingBonus = 0

  if (equipmentTypeMatchesText(equipment, text)) {
    equipmentTypeScore += 8
    scoring_steps.push('Equipment type match: +8')
  }
  if (analysis.descriptor_match) {
    equipmentTypeScore += 6
    scoring_steps.push('Descriptor match: +6')
  }
  if (/\bcommercial\b/i.test(text)) {
    serviceWorkingBonus += 4
    scoring_steps.push('Commercial: +4')
  }
  if (/\bserviced\b/i.test(text)) {
    serviceWorkingBonus += 4
    scoring_steps.push('Serviced: +4')
  }
  if (/\bclassic\b/i.test(text)) {
    serviceWorkingBonus += 3
    scoring_steps.push('Classic: +3')
  }
  if (/\bintegrity\b/i.test(text)) {
    serviceWorkingBonus += 3
    scoring_steps.push('Integrity: +3')
  }
  if (/\bclub\s+series\b/i.test(text)) {
    serviceWorkingBonus += 3
    scoring_steps.push('Club series: +3')
  }

  const rawTotal = baseScore + brandScore + equipmentTypeScore + serviceWorkingBonus
  const finalConfidence = Math.min(75, rawTotal)
  if (finalConfidence < rawTotal) {
    scoring_steps.push(`Capped at review maximum: 75 (raw ${rawTotal})`)
  }

  return {
    base_score: baseScore,
    brand_score: brandScore,
    model_score: 0,
    equipment_type_score: equipmentTypeScore,
    service_working_bonus: serviceWorkingBonus,
    final_confidence: finalConfidence,
    scoring_steps,
  }
}

function buildExactModelScoreBreakdown(
  equipment: EquipmentIntelligenceRow,
  text: string,
  analysis: EbaySoldMatchAnalysis,
  soldAt: string | null,
): {
  base_score: number
  brand_score: number
  model_score: number
  equipment_type_score: number
  series_range_bonus: number
  service_working_bonus: number
  sold_completed_bonus: number
  confidence_before_warnings: number
  scoring_steps: string[]
} {
  const brandScore = resolveBrandScore(analysis)
  const modelScore = analysis.model_code_found ? EXACT_MODEL_CODE_SCORE : 0
  const equipmentTypeScore = equipmentTypeMatchesText(equipment, text)
    ? EXACT_MODEL_DESCRIPTOR_SCORE
    : 0
  const seriesRange = scoreSeriesRangeBonus(equipment, text)
  const serviceWorkingBonus = scoreServiceConditionBonus(text)
  const soldCompletedBonus = soldAt ? 2 : 0
  const scoring_steps = [
    `Brand match: +${brandScore}`,
    `Model code match: +${modelScore}`,
  ]

  if (equipmentTypeScore > 0) {
    scoring_steps.push(`Equipment type match: +${equipmentTypeScore}`)
  }
  for (const step of seriesRange.steps) {
    scoring_steps.push(`Series/range bonus: ${step}`)
  }
  if (serviceWorkingBonus > 0) {
    scoring_steps.push(`Service/working bonus: +${serviceWorkingBonus}`)
  }
  if (soldCompletedBonus > 0) {
    scoring_steps.push(`Sold/completed bonus: +${soldCompletedBonus}`)
  }

  const rawTotal = brandScore + modelScore + equipmentTypeScore + seriesRange.bonus +
    serviceWorkingBonus + soldCompletedBonus
  const confidenceBeforeWarnings = Math.min(96, rawTotal)
  if (confidenceBeforeWarnings < rawTotal) {
    scoring_steps.push(`Capped at accepted maximum: 96 (raw ${rawTotal})`)
  }

  return {
    base_score: 0,
    brand_score: brandScore,
    model_score: modelScore,
    equipment_type_score: equipmentTypeScore,
    series_range_bonus: seriesRange.bonus,
    service_working_bonus: serviceWorkingBonus,
    sold_completed_bonus: soldCompletedBonus,
    confidence_before_warnings: confidenceBeforeWarnings,
    scoring_steps,
  }
}

function finalizeCandidate(
  candidate: EbaySoldCandidate,
  breakdown: EbaySoldScoreBreakdown,
): EbaySoldCandidate {
  return {
    ...candidate,
    score_breakdown: breakdown,
  }
}

function buildCalibrationSummary(
  candidates: EbaySoldCandidate[],
): EbaySoldCalibrationSummary {
  const counts = summarizeCandidates(candidates)
  const confidences = candidates.map((candidate) => candidate.confidence)
  const averageConfidence = confidences.length > 0
    ? Math.round(
      confidences.reduce((sum, value) => sum + value, 0) / confidences.length,
    )
    : 0

  let rejectedByParts = 0
  let rejectedByWrongModel = 0
  let reviewMissingModel = 0
  let lowPricePenalised = 0

  for (const candidate of candidates) {
    const breakdown = candidate.score_breakdown
    if (!breakdown) continue

    if (breakdown.parts_accessory_hard_reject) rejectedByParts += 1
    if (breakdown.wrong_model_hard_reject) rejectedByWrongModel += 1
    if (candidate.status === 'review' && breakdown.missing_model_result) {
      reviewMissingModel += 1
    }
    if (breakdown.low_price_penalty > 0) lowPricePenalised += 1
  }

  return {
    ...counts,
    average_confidence: averageConfidence,
    rejected_by_parts_accessory_count: rejectedByParts,
    rejected_by_wrong_model_count: rejectedByWrongModel,
    review_missing_exact_model_count: reviewMissingModel,
    low_price_penalised_count: lowPricePenalised,
  }
}

function resolveApifyImageUrl(item: ApifyEbaySoldItem): string | null {
  const candidates = [
    item.imageUrl,
    item.image,
    item.thumbnail,
    item.primaryImage,
    item.galleryImage,
  ]

  for (const candidate of candidates) {
    const value = String(candidate ?? '').trim()
    if (value.startsWith('http')) return value
  }

  return null
}

function flattenApifyItemSpecifics(itemSpecifics: unknown): string {
  if (!itemSpecifics) return ''

  if (Array.isArray(itemSpecifics)) {
    return itemSpecifics
      .map((entry) => {
        if (!entry || typeof entry !== 'object') return ''
        const record = entry as Record<string, unknown>
        return [record.name, record.value, record.label, record.text]
          .filter((value) => typeof value === 'string' && value.trim())
          .join(' ')
      })
      .filter(Boolean)
      .join(' ')
  }

  if (typeof itemSpecifics === 'object') {
    return Object.entries(itemSpecifics as Record<string, unknown>)
      .map(([key, value]) => `${key} ${String(value ?? '')}`)
      .join(' ')
  }

  return ''
}

function buildApifyMetadataText(item: ApifyEbaySoldItem): string {
  return normalizeWhitespace([
    item.description,
    item.productDetail,
    flattenApifyItemSpecifics(item.itemSpecifics),
  ].filter(Boolean).join(' '))
}

function extractMetadataModelTokens(metadataText: string): string[] {
  if (!metadataText) return []
  return detectModelTokensInTitle(metadataText)
}

function hasLowPriceRejectContext(text: string): boolean {
  return findPartsTerms(text).length > 0 || findFaultyTerms(text).length > 0
}

function isNewCondition(condition: string): boolean {
  return NEW_CONDITION_PATTERNS.some((pattern) => pattern.test(condition))
}

function parseGbpSoldPriceRaw(raw: string): number | null {
  return parseGbpSoldPriceText(raw)
}

function parseSoldAt(value: string | undefined): string | null {
  const raw = String(value ?? '').trim()
  if (!raw) return null

  const cleaned = raw.replace(/^sold\s+/i, '').trim()
  const parsed = Date.parse(cleaned)
  if (!Number.isNaN(parsed)) {
    return new Date(parsed).toISOString()
  }

  return cleaned
}

function extractFirstMatch(block: string, patterns: RegExp[]): string {
  for (const pattern of patterns) {
    const match = block.match(pattern)
    if (match?.[1]) {
      return normalizeWhitespace(stripHtmlTags(match[1]))
    }
  }
  return ''
}

function normalizeEbayItemUrl(href: string): string {
  try {
    const parsed = new URL(href, 'https://www.ebay.co.uk')
    parsed.hash = ''
    return parsed.toString()
  } catch {
    return href.trim()
  }
}

function shouldSkipTitle(title: string): boolean {
  const normalized = title.trim()
  if (!normalized) return true
  return SKIP_TITLE_PATTERNS.some((pattern) => pattern.test(normalized))
}

export function parseEbaySoldHtml(html: string): EbayRawListing[] {
  const listings: EbayRawListing[] = []
  const seenUrls = new Set<string>()

  const itemBlocks = [
    ...html.matchAll(/<li[^>]*class="[^"]*(?:s-item|s-card)[^"]*"[^>]*>([\s\S]*?)<\/li>/gi),
  ]

  for (const blockMatch of itemBlocks) {
    const block = blockMatch[0]

    const link = extractFirstMatch(block, [
      /<a[^>]*class="[^"]*s-item__link[^"]*"[^>]*href="([^"]+)"/i,
      /<a[^>]*class="[^"]*s-card__link[^"]*"[^>]*href="([^"]+)"/i,
      /<a[^>]*href="([^"]*\/itm\/[^"]+)"[^>]*>/i,
    ])

    if (!link || !link.includes('/itm/')) continue

    const normalizedUrl = normalizeEbayItemUrl(link)
    if (seenUrls.has(normalizedUrl)) continue

    const title = extractFirstMatch(block, [
      /<div[^>]*role="heading"[^>]*>([\s\S]*?)<\/div>/i,
      /<span[^>]*role="heading"[^>]*>([\s\S]*?)<\/span>/i,
      /<h3[^>]*class="[^"]*s-item__title[^"]*"[^>]*>([\s\S]*?)<\/h3>/i,
      /<span[^>]*class="[^"]*s-item__title[^"]*"[^>]*>([\s\S]*?)<\/span>/i,
    ])

    if (shouldSkipTitle(title)) continue

    const priceRaw = extractFirstMatch(block, [
      /<span[^>]*class="[^"]*s-item__price[^"]*"[^>]*>([\s\S]*?)<\/span>/i,
      /<span[^>]*class="[^"]*s-card__price[^"]*"[^>]*>([\s\S]*?)<\/span>/i,
      /<span[^>]*class="[^"]*POSITIVE[^"]*"[^>]*>([\s\S]*?)<\/span>/i,
    ])

    const soldDate = extractFirstMatch(block, [
      /<span[^>]*class="[^"]*s-item__title--tag[^"]*"[^>]*>([\s\S]*?)<\/span>/i,
      /<span[^>]*class="[^"]*s-item__ended-date[^"]*"[^>]*>([\s\S]*?)<\/span>/i,
      /<span[^>]*class="[^"]*s-card__subtitle[^"]*"[^>]*>([\s\S]*?)<\/span>/i,
      /(Sold\s+[^<]+)/i,
    ])

    const condition = extractFirstMatch(block, [
      /<span[^>]*class="[^"]*SECONDARY_INFO[^"]*"[^>]*>([\s\S]*?)<\/span>/i,
      /<span[^>]*class="[^"]*s-item__subtitle[^"]*"[^>]*>([\s\S]*?)<\/span>/i,
      /<span[^>]*class="[^"]*s-card__attribute[^"]*"[^>]*>([\s\S]*?)<\/span>/i,
    ])

    seenUrls.add(normalizedUrl)
    listings.push({
      title,
      link: normalizedUrl,
      condition: condition || undefined,
      sold_date: soldDate || undefined,
      price_raw: priceRaw || undefined,
    })
  }

  if (listings.length > 0) {
    return listings
  }

  // Fallback: scan /itm/ links with nearby title/price fragments.
  const linkMatches = [...html.matchAll(/href="([^"]*\/itm\/[^"]+)"/gi)]
  for (const linkMatch of linkMatches) {
    const link = normalizeEbayItemUrl(decodeHtmlEntities(linkMatch[1]))
    if (seenUrls.has(link)) continue

    const index = linkMatch.index ?? 0
    const window = html.slice(Math.max(0, index - 400), Math.min(html.length, index + 1200))
    const title = extractFirstMatch(window, [
      /role="heading"[^>]*>([\s\S]{5,180})</i,
      /s-item__title[^>]*>([\s\S]{5,180})</i,
    ])
    if (shouldSkipTitle(title)) continue

    const priceRaw = extractFirstMatch(window, [
      /s-item__price[^>]*>([\s\S]{1,40})</i,
      /POSITIVE[^>]*>([\s\S]{1,40})</i,
      /(£\s*[\d,]+(?:\.\d{2})?)/i,
    ])

    seenUrls.add(link)
    listings.push({
      title,
      link,
      price_raw: priceRaw || undefined,
    })
  }

  return listings
}

export function classifyEbaySoldListing(
  equipment: EquipmentIntelligenceRow,
  listing: EbayRawListing,
): EbaySoldCandidate {
  const title = normalizeWhitespace(listing.title ?? '')
  const url = listing.link?.trim() ?? ''
  const condition = normalizeWhitespace(listing.condition ?? '')
  const soldAtRaw = listing.sold_date
  const soldAt = parseSoldAt(soldAtRaw)
  const metadataText = normalizeWhitespace(listing.metadata_text ?? '')
  const listingText = [title, condition, metadataText].filter(Boolean).join(' ')
  const combinedText = [listingText, soldAtRaw].filter(Boolean).join(' ')
  const priceResolution = resolveListingPrice(listing)
  const price = priceResolution.price
  const minPrice = getMinimumUsedPrice(toQualityEquipmentContext(equipment))
  const matchAnalysis = analyzeEbaySoldMatch(equipment, title)
  const metadataModelTokens = extractMetadataModelTokens(metadataText)
  const partsTermsDetected = findPartsTerms(listingText)
  const faultyTermsDetected = findFaultyTerms(listingText)
  const breakdownContext: ScoreBreakdownContext = {
    title,
    listingText,
    combinedText,
    equipment,
    matchAnalysis,
    partsTermsDetected,
    faultyTermsDetected,
    soldAt,
    price,
    minPrice,
  }

  const debugFields = {
    structured_price_raw: priceResolution.structured_price_raw,
    price_used: priceResolution.price_used,
    price_source: priceResolution.price_source,
    required_terms: matchAnalysis.required_terms,
    optional_terms: matchAnalysis.optional_terms,
    matched_terms: matchAnalysis.matched_terms,
    missing_required_terms: matchAnalysis.missing_required_terms,
    strong_model_code: matchAnalysis.strong_model_code,
    allowed_model_aliases: matchAnalysis.allowed_model_aliases,
    expected_model_code: matchAnalysis.expected_model_code,
    generated_aliases: matchAnalysis.generated_aliases,
    detected_model_tokens_in_title: matchAnalysis.detected_model_tokens_in_title,
    model_code_found: matchAnalysis.model_code_found,
    matched_alias: matchAnalysis.matched_alias,
    parts_terms_detected: partsTermsDetected,
    faulty_terms_detected: faultyTermsDetected,
    low_price_warning: false,
    needs_review: false,
    image_url: listing.image_url ?? null,
    metadata_model_tokens: metadataModelTokens,
    match_terms_found: matchAnalysis.matched_terms,
    missing_terms: matchAnalysis.missing_required_terms,
  }

  const base = {
    price,
    currency: 'GBP' as const,
    title,
    url,
    sold_at: soldAt,
    condition: condition || null,
    source: 'ebay_sold' as const,
    source_domain: 'ebay.co.uk',
    snippet: normalizeWhitespace([condition, soldAtRaw, listing.price_raw].filter(Boolean).join(' — ')),
    ...debugFields,
  }

  const buildRejected = (
    reason: string,
    confidence: number,
    scorePath: string,
    breakdownExtras: Partial<EbaySoldScoreBreakdown>,
    extra: Partial<EbaySoldCandidate> = {},
  ): EbaySoldCandidate => finalizeCandidate({
    ...base,
    ...extra,
    confidence,
    confidence_before_warnings: confidence,
    final_confidence: confidence,
    status: 'rejected',
    reason,
  }, {
    ...buildScoreBreakdownBase(breakdownContext),
    status: 'rejected',
    final_confidence: confidence,
    confidence_before_warnings: confidence,
    base_score: confidence,
    brand_score: 0,
    model_score: 0,
    equipment_type_score: 0,
    series_range_bonus: 0,
    sold_completed_bonus: 0,
    service_working_bonus: 0,
    low_price_penalty: 0,
    parts_accessory_hard_reject: null,
    wrong_model_hard_reject: null,
    missing_model_result: null,
    reason,
    score_path: scorePath,
    scoring_steps: [`Hard reject path: ${scorePath}`, `Assigned confidence: ${confidence}`],
    ...breakdownExtras,
  })

  if (condition && isNewCondition(condition)) {
    return buildRejected('Likely new retail: new condition', 25, 'new_condition_reject', {})
  }

  if (partsTermsDetected.length > 0) {
    return buildRejected(
      'Parts/accessory listing, not complete equipment',
      22,
      'parts_accessory_reject',
      {
        parts_accessory_hard_reject: 'Parts/accessory listing, not complete equipment',
        scoring_steps: [
          `Parts/accessory terms detected: ${partsTermsDetected.join(', ')}`,
          'Hard reject before scoring',
        ],
      },
    )
  }

  if (faultyTermsDetected.length > 0) {
    const reason = `Faulty/repair listing: ${faultyTermsDetected[0]}`
    return buildRejected(reason, 24, 'faulty_reject', {
      scoring_steps: [
        `Faulty terms detected: ${faultyTermsDetected.join(', ')}`,
        'Hard reject before scoring',
      ],
    })
  }

  const generalReject = findGeneralRejectLabel(listingText)
  if (generalReject) {
    const reason = generalReject === 'job lot' || generalReject === 'bundle'
      ? `Job lot/bundle: ${generalReject}`
      : `Excluded listing: ${generalReject}`
    return buildRejected(reason, 26, 'general_reject', {
      scoring_steps: [`General reject term: ${generalReject}`],
    })
  }

  if (matchAnalysis.strong_model_code) {
    const conflictReason = hasConflictingModelCode(matchAnalysis.strong_model_code, title)
    if (conflictReason) {
      return buildRejected(conflictReason, 28, 'wrong_model_reject', {
        wrong_model_hard_reject: conflictReason,
        scoring_steps: [
          `Expected model: ${matchAnalysis.strong_model_code}`,
          `Detected model tokens: ${matchAnalysis.detected_model_tokens_in_title.join(', ') || 'none'}`,
          'Hard reject: wrong model code',
        ],
      })
    }
  }

  const wrongEquipmentTypeReason = getWrongEquipmentTypeReason(equipment, combinedText, matchAnalysis)
  if (wrongEquipmentTypeReason) {
    return buildRejected(wrongEquipmentTypeReason, 30, 'wrong_equipment_type_reject', {
      brand_score: matchAnalysis.brand_match ? EXACT_MODEL_BRAND_SCORE : 0,
      model_score: matchAnalysis.model_code_found ? EXACT_MODEL_CODE_SCORE : 0,
      scoring_steps: [
        `Expected equipment type: ${equipment.equipment_type ?? 'unknown'}`,
        'Hard reject: wrong equipment type',
      ],
    })
  }

  if (matchAnalysis.model_code_found && matchAnalysis.brand_match) {
    const exactBreakdown = buildExactModelScoreBreakdown(equipment, combinedText, matchAnalysis, soldAt)
    const preSoldConfidence = Math.min(
      96,
      exactBreakdown.brand_score +
        exactBreakdown.model_score +
        exactBreakdown.equipment_type_score +
        exactBreakdown.series_range_bonus +
        exactBreakdown.service_working_bonus,
    )

    if (!price) {
      return buildRejected('No GBP sold price found', preSoldConfidence, 'missing_price_reject', {
        brand_score: exactBreakdown.brand_score,
        model_score: exactBreakdown.model_score,
        equipment_type_score: exactBreakdown.equipment_type_score,
        series_range_bonus: exactBreakdown.series_range_bonus,
        service_working_bonus: exactBreakdown.service_working_bonus,
        sold_completed_bonus: exactBreakdown.sold_completed_bonus,
        scoring_steps: [
          ...exactBreakdown.scoring_steps,
          'Rejected: no GBP sold price found',
        ],
      })
    }

    const lowPriceWarning = price != null && price < minPrice
    if (lowPriceWarning && hasLowPriceRejectContext(listingText)) {
      return buildRejected(
        'Below usual price range with parts/accessory/faulty terms',
        preSoldConfidence,
        'low_price_parts_reject',
        {
          brand_score: exactBreakdown.brand_score,
          model_score: exactBreakdown.model_score,
          equipment_type_score: exactBreakdown.equipment_type_score,
          series_range_bonus: exactBreakdown.series_range_bonus,
          service_working_bonus: exactBreakdown.service_working_bonus,
          sold_completed_bonus: exactBreakdown.sold_completed_bonus,
          low_price_penalty: 0,
          scoring_steps: [
            ...exactBreakdown.scoring_steps,
            `Below price floor (£${minPrice}) with parts/accessory/faulty context`,
          ],
        },
        { low_price_warning: true },
      )
    }

    const lowPricePenalty = lowPriceWarning
      ? exactBreakdown.confidence_before_warnings -
        Math.max(70, exactBreakdown.confidence_before_warnings - LOW_PRICE_CONFIDENCE_PENALTY)
      : 0
    const finalConfidence = lowPriceWarning
      ? Math.max(70, exactBreakdown.confidence_before_warnings - LOW_PRICE_CONFIDENCE_PENALTY)
      : exactBreakdown.confidence_before_warnings

    const reasonParts = [
      'Exact/strong model match',
      'eBay sold/completed listing',
      soldAt ? 'Sold date available' : 'Sold listing',
      lowPriceWarning ? 'Below usual price range' : `Passed sanity checks (min £${minPrice})`,
    ]
    const reason = reasonParts.join('; ')
    const scoringSteps = [...exactBreakdown.scoring_steps]
    if (lowPriceWarning) {
      scoringSteps.push(`Low price penalty: -${lowPricePenalty} (floor £${minPrice})`)
      if (finalConfidence === 70 && exactBreakdown.confidence_before_warnings - LOW_PRICE_CONFIDENCE_PENALTY < 70) {
        scoringSteps.push('Low price confidence floored at 70')
      }
    }

    return finalizeCandidate({
      ...base,
      price,
      low_price_warning: lowPriceWarning,
      needs_review: false,
      confidence_before_warnings: exactBreakdown.confidence_before_warnings,
      final_confidence: finalConfidence,
      confidence: finalConfidence,
      status: 'accepted',
      reason,
    }, {
      ...buildScoreBreakdownBase(breakdownContext),
      status: 'accepted',
      final_confidence: finalConfidence,
      confidence_before_warnings: exactBreakdown.confidence_before_warnings,
      base_score: exactBreakdown.base_score,
      brand_score: exactBreakdown.brand_score,
      model_score: exactBreakdown.model_score,
      equipment_type_score: exactBreakdown.equipment_type_score,
      series_range_bonus: exactBreakdown.series_range_bonus,
      sold_completed_bonus: exactBreakdown.sold_completed_bonus,
      service_working_bonus: exactBreakdown.service_working_bonus,
      low_price_penalty: lowPricePenalty,
      parts_accessory_hard_reject: null,
      wrong_model_hard_reject: null,
      missing_model_result: null,
      reason,
      score_path: 'exact_model_accept',
      scoring_steps: scoringSteps,
    })
  }

  if (isVagueBrandEquipmentMatch(equipment, matchAnalysis, title)) {
    const vagueBreakdown = buildVagueMatchScoreBreakdown(equipment, combinedText, matchAnalysis)
    const reason = 'Brand and equipment type match, but exact model code missing'

    return finalizeCandidate({
      ...base,
      price,
      needs_review: true,
      confidence_before_warnings: vagueBreakdown.final_confidence,
      final_confidence: vagueBreakdown.final_confidence,
      confidence: vagueBreakdown.final_confidence,
      status: 'review',
      reason,
    }, {
      ...buildScoreBreakdownBase(breakdownContext),
      status: 'review',
      final_confidence: vagueBreakdown.final_confidence,
      confidence_before_warnings: vagueBreakdown.final_confidence,
      base_score: vagueBreakdown.base_score,
      brand_score: vagueBreakdown.brand_score,
      model_score: vagueBreakdown.model_score,
      equipment_type_score: vagueBreakdown.equipment_type_score,
      series_range_bonus: 0,
      sold_completed_bonus: 0,
      service_working_bonus: vagueBreakdown.service_working_bonus,
      low_price_penalty: 0,
      parts_accessory_hard_reject: null,
      wrong_model_hard_reject: null,
      missing_model_result: reason,
      reason,
      score_path: 'vague_review',
      scoring_steps: vagueBreakdown.scoring_steps,
    })
  }

  if (matchAnalysis.strong_model_code) {
    const reason = `Missing expected model code: ${matchAnalysis.strong_model_code}`
    return buildRejected(reason, 28, 'missing_model_reject', {
      missing_model_result: reason,
      scoring_steps: [
        `Expected model: ${matchAnalysis.strong_model_code}`,
        'No matching alias found in title',
      ],
    })
  }

  const similarity = scoreEbaySoldSimilarity(equipment, combinedText, matchAnalysis)
  return buildRejected(
    'Unrelated model — weak brand/model match',
    similarity.confidence,
    'weak_match_reject',
    {
      brand_score: matchAnalysis.brand_match ? EXACT_MODEL_BRAND_SCORE : 0,
      scoring_steps: [
        `Weak similarity level: ${similarity.level}`,
        `Assigned confidence: ${similarity.confidence}`,
      ],
    },
  )
}

export async function fetchEbaySoldHtml(ebayUrl: string): Promise<string> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), EBAY_FETCH_TIMEOUT_MS)

  try {
    const response = await fetch(ebayUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-GB,en;q=0.9',
      },
      redirect: 'follow',
    })

    if (!response.ok) {
      throw new Error(`eBay returned HTTP ${response.status}`)
    }

    const contentType = (response.headers.get('content-type') ?? '').toLowerCase()
    if (!contentType.includes('text/html') && !contentType.includes('application/xhtml')) {
      throw new Error(`eBay returned non-HTML response (${contentType || 'unknown'})`)
    }

    const buffer = await response.arrayBuffer()
    if (buffer.byteLength > MAX_EBAY_HTML_BYTES) {
      throw new Error('eBay response too large to parse')
    }

    return new TextDecoder('utf-8', { fatal: false }).decode(buffer)
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('eBay fetch timeout (10s)')
    }
    throw error
  } finally {
    clearTimeout(timeoutId)
  }
}

function sortAndLimitCandidates(candidates: EbaySoldCandidate[]): EbaySoldCandidate[] {
  return candidates
    .sort((left, right) => {
      const statusOrder = { accepted: 0, review: 1, rejected: 2 } as const
      const statusDiff = statusOrder[left.status] - statusOrder[right.status]
      if (statusDiff !== 0) return statusDiff
      return right.confidence - left.confidence
    })
    .slice(0, MAX_EBAY_CANDIDATES)
}

function summarizeCandidates(
  candidates: EbaySoldCandidate[],
): { accepted_count: number; review_count: number; rejected_count: number } {
  return {
    accepted_count: candidates.filter((candidate) => candidate.status === 'accepted').length,
    review_count: candidates.filter((candidate) => candidate.status === 'review').length,
    rejected_count: candidates.filter((candidate) => candidate.status === 'rejected').length,
  }
}

export function normalizeApifyActorId(actorId: string): string {
  return actorId.trim().replace(/\//g, '~')
}

export function getDefaultApifyEbaySoldActorId(): string {
  return Deno.env.get('APIFY_EBAY_SOLD_ACTOR_ID')?.trim() || DEFAULT_APIFY_EBAY_SOLD_ACTOR_ID
}

function resolveApifyDaysToScrape(days?: number): number {
  const requested = days ?? APIFY_EBAY_SOLD_DAYS_TO_SCRAPE_DEFAULT
  if (!Number.isFinite(requested)) {
    return APIFY_EBAY_SOLD_DAYS_TO_SCRAPE_DEFAULT
  }

  return Math.min(
    Math.max(1, Math.floor(requested)),
    APIFY_EBAY_SOLD_DAYS_TO_SCRAPE_MAX,
  )
}

export function buildApifyEbaySoldInput(
  query: string,
  options?: { daysToScrape?: number; count?: number },
): ApifyEbaySoldInput {
  const count = options?.count
  const resolvedCount = Number.isFinite(count) && count! > 0
    ? Math.min(Math.floor(count!), MAX_EBAY_CANDIDATES)
    : MAX_EBAY_CANDIDATES

  return {
    keywords: [query],
    daysToScrape: resolveApifyDaysToScrape(options?.daysToScrape),
    count: resolvedCount,
    category: '',
    subcategory: '',
    ebaySite: 'ebay.co.uk',
    sortOrder: 'endedRecently',
    minPrice: 0,
    condition: 'Used',
  }
}

function mapApifyItemToRawListing(item: ApifyEbaySoldItem): EbayRawListing | null {
  const title = normalizeWhitespace(item.title ?? '')
  const link = normalizeWhitespace(item.url ?? '')
  if (!title || !link || !link.includes('/itm/')) return null

  const resolvedPrice = resolveApifyEbaySoldPrice(item)
  const metadataText = buildApifyMetadataText(item)

  return {
    title,
    link: normalizeEbayItemUrl(link),
    condition: normalizeWhitespace(item.condition ?? '') || undefined,
    sold_date: item.endedAt ? String(item.endedAt) : undefined,
    structured_price_raw: resolvedPrice.structured_price_raw,
    price_numeric: resolvedPrice.price,
    price_source: resolvedPrice.price_source,
    price_raw:
      resolvedPrice.price != null
        ? `£${resolvedPrice.price}`
        : undefined,
    image_url: resolveApifyImageUrl(item),
    metadata_text: metadataText || undefined,
  }
}

export async function fetchApifyEbaySoldItems(
  input: ApifyEbaySoldInput,
  options: { token: string; actorId: string },
): Promise<ApifyEbaySoldItem[]> {
  const actorId = normalizeApifyActorId(options.actorId)
  const endpoint = new URL(
    `https://api.apify.com/v2/acts/${encodeURIComponent(actorId)}/run-sync-get-dataset-items`,
  )
  endpoint.searchParams.set('token', options.token)

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), APIFY_FETCH_TIMEOUT_MS)

  try {
    const response = await fetch(endpoint.toString(), {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(input),
    })

    if (!response.ok) {
      const errorBody = await response.text()
      const detail = errorBody.trim().slice(0, 300)
      throw new Error(
        `Apify returned HTTP ${response.status}${detail ? `: ${detail}` : ''}`,
      )
    }

    const payload = await response.json()
    if (!Array.isArray(payload)) {
      throw new Error('Apify returned unexpected response format')
    }

    return payload as ApifyEbaySoldItem[]
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('Apify actor run timeout (120s)')
    }
    throw error
  } finally {
    clearTimeout(timeoutId)
  }
}

export async function collectEbaySoldCandidatesDirect(
  equipment: EquipmentIntelligenceRow,
  customKeyword?: string,
): Promise<EbaySoldSearchResult> {
  const query = buildEbaySoldSearchQuery(equipment, customKeyword)
  const ebayUrl = buildEbaySoldSearchUrl(query)
  const html = await fetchEbaySoldHtml(ebayUrl)
  const rawResults = parseEbaySoldHtml(html)
  const candidates = sortAndLimitCandidates(
    rawResults.map((listing) => classifyEbaySoldListing(equipment, listing)),
  )
  const counts = summarizeCandidates(candidates)

  return {
    query_run: query,
    ebay_url: ebayUrl,
    raw_result_count: rawResults.length,
    candidates,
    ...counts,
    calibration_summary: buildCalibrationSummary(candidates),
    provider: 'direct',
    final_keyword: query,
    keyword_attempts: [{ keyword: query, dataset_count: rawResults.length }],
  }
}

export type ApifyRawListingFetchResult = {
  query_run: string
  ebay_url: string
  raw_result_count: number
  dataset_item_count: number
  apify_input: ApifyEbaySoldInput
  keyword_attempts: EbayKeywordAttempt[]
  final_keyword: string
  actor_id: string
  raw_listings: EbayRawListing[]
}

export function classifyEbaySoldRawListings(
  equipment: EquipmentIntelligenceRow,
  rawListings: EbayRawListing[],
): EbaySoldCandidate[] {
  return sortAndLimitCandidates(
    rawListings.map((listing) => classifyEbaySoldListing(equipment, listing)),
  )
}

export async function fetchApifySoldRawListings(
  equipment: EquipmentIntelligenceRow,
  options: {
    token: string
    actorId: string
    customKeyword?: string
    daysToScrape?: number
    count?: number
  },
): Promise<ApifyRawListingFetchResult> {
  const keywordVariants = buildEbayKeywordVariants(equipment, options.customKeyword)
  const maxAttempts = options.customKeyword
    ? 1
    : Math.min(MAX_APIFY_KEYWORD_ATTEMPTS, keywordVariants.length)

  const keywordAttempts: EbayKeywordAttempt[] = []
  let finalKeyword = keywordVariants[0] ?? ''
  let apifyItems: ApifyEbaySoldItem[] = []
  let apifyInput = buildApifyEbaySoldInput(finalKeyword, {
    daysToScrape: options.daysToScrape,
    count: options.count,
  })

  for (let index = 0; index < maxAttempts; index += 1) {
    const keyword = keywordVariants[index]
    if (!keyword) continue

    const input = buildApifyEbaySoldInput(keyword, {
      daysToScrape: options.daysToScrape,
      count: options.count,
    })
    const items = await fetchApifyEbaySoldItems(input, options)

    keywordAttempts.push({
      keyword,
      dataset_count: items.length,
    })

    finalKeyword = keyword
    apifyInput = input

    if (items.length > 0) {
      apifyItems = items
      break
    }
  }

  const rawListings = apifyItems
    .map((item) => mapApifyItemToRawListing(item))
    .filter((listing): listing is EbayRawListing => listing !== null)

  return {
    query_run: finalKeyword,
    ebay_url: buildEbaySoldSearchUrl(finalKeyword),
    raw_result_count: apifyItems.length,
    dataset_item_count: apifyItems.length,
    apify_input: apifyInput,
    keyword_attempts: keywordAttempts,
    final_keyword: finalKeyword,
    actor_id: options.actorId,
    raw_listings: rawListings,
  }
}

export async function collectEbaySoldCandidatesApify(
  equipment: EquipmentIntelligenceRow,
  options: {
    token: string
    actorId: string
    customKeyword?: string
    daysToScrape?: number
    count?: number
  },
): Promise<EbaySoldSearchResult> {
  const rawFetch = await fetchApifySoldRawListings(equipment, options)
  const candidates = classifyEbaySoldRawListings(equipment, rawFetch.raw_listings)
  const counts = summarizeCandidates(candidates)

  return {
    query_run: rawFetch.query_run,
    ebay_url: rawFetch.ebay_url,
    raw_result_count: rawFetch.raw_result_count,
    dataset_item_count: rawFetch.dataset_item_count,
    candidates,
    ...counts,
    calibration_summary: buildCalibrationSummary(candidates),
    provider: 'apify',
    actor_id: rawFetch.actor_id,
    apify_input: rawFetch.apify_input,
    keyword_attempts: rawFetch.keyword_attempts,
    final_keyword: rawFetch.final_keyword,
  }
}

export async function collectEbaySoldCandidates(
  equipment: EquipmentIntelligenceRow,
  provider: EbaySoldSearchProvider = 'direct',
  options?: {
    token?: string
    actorId?: string
    customKeyword?: string
    daysToScrape?: number
    count?: number
  },
): Promise<EbaySoldSearchResult> {
  const customKeyword = options?.customKeyword

  if (provider === 'apify') {
    if (!options?.token) {
      throw new Error('APIFY_TOKEN is not configured')
    }
    return collectEbaySoldCandidatesApify(equipment, {
      token: options.token,
      actorId: options.actorId || getDefaultApifyEbaySoldActorId(),
      customKeyword,
      daysToScrape: options.daysToScrape,
      count: options.count,
    })
  }

  return collectEbaySoldCandidatesDirect(equipment, customKeyword)
}
