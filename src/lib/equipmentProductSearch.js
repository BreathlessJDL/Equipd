/**
 * Equipment valuator product search — Amazon/Google-style ranking.
 *
 * Builds a normalized search index per product, detects brands from BRAND_REGISTRY,
 * and scores matches with strong exact-model preference and wrong-model penalties.
 */

import { BRAND_REGISTRY, resolveBrandRegistryEntry } from './brandCatalogueCore.js'
import { displayNameStartsWithPhrase } from './canonicalProductDisplayName.js'

const MIN_PARTIAL_SEARCH_TOKEN_LENGTH = 2
const MIN_PARTIAL_INTENT_TOKEN_LENGTH = 4
const MIN_BRAND_PREFIX_LENGTH = 3

/** Equipment-type / common phrase aliases expanded into the search index. */
export const EQUIPMENT_SEARCH_TERM_ALIASES = Object.freeze({
  'cross trainer': ['elliptical', 'cross trainer', 'crosstrainer', 'xtrainer'],
  elliptical: ['cross trainer', 'elliptical', 'crosstrainer'],
  'indoor bike': ['indoor bike', 'spin bike', 'exercise bike', 'upright bike', 'bike'],
  'spin bike': ['indoor bike', 'spin bike', 'exercise bike'],
  'exercise bike': ['indoor bike', 'spin bike', 'exercise bike', 'upright bike', 'bike'],
  'stair climber': ['stair climber', 'stairclimber', 'stepper', 'climbmill'],
  rower: ['rower', 'rowing machine', 'water rower'],
})

export const EQUIPMENT_SEARCH_INTENT_RULES = [
  {
    id: 'stair_climber',
    phrases: ['stair climber', 'stairclimber'],
    equipmentTypes: ['stair climber', 'stepper/stair climber'],
    productTerms: ['stair climber', 'stairclimber'],
  },
  {
    id: 'cross_trainer',
    phrases: ['cross trainer', 'crosstrainer', 'elliptical', 'efx', 'xtrainer'],
    equipmentTypes: ['cross trainer', 'crosstrainers'],
    productTerms: ['cross trainer', 'crosstrainer', 'elliptical', 'efx', 'xtrainer'],
    familyModelCodes: ['efx', 'amt'],
  },
  {
    id: 'recumbent_bike',
    phrases: ['recumbent bike', 'recumbent', 'rbk', 'ubk'],
    equipmentTypes: ['recumbent bike'],
    productTerms: ['recumbent', 'rbk', 'ubk'],
    familyModelCodes: ['rbk', 'ubk'],
  },
  {
    id: 'upright_bike',
    phrases: ['upright bike', 'exercise bike', 'indoor bike', 'spin bike', 'bike', 'cycle'],
    equipmentTypes: ['upright bike', 'exercise bike', 'indoor bike'],
    productTerms: ['upright bike', 'bike', 'cycle', 'spin bike'],
    excludeTerms: ['recumbent'],
  },
  {
    id: 'chest_press',
    phrases: ['chest press'],
    equipmentTypes: ['chest press'],
    productTerms: ['chest press'],
  },
  {
    id: 'leg_press',
    phrases: ['leg press'],
    equipmentTypes: ['leg press'],
    productTerms: ['leg press'],
  },
  {
    id: 'shoulder_press',
    phrases: ['shoulder press'],
    equipmentTypes: ['shoulder press'],
    productTerms: ['shoulder press'],
  },
  {
    id: 'lat_pulldown',
    phrases: ['lat pulldown', 'pulldown'],
    equipmentTypes: ['lat pulldown'],
    productTerms: ['lat pulldown', 'pulldown'],
  },
  {
    id: 'back_extension',
    phrases: ['back extension'],
    equipmentTypes: ['back extension'],
    productTerms: ['back extension'],
  },
  {
    id: 'leg_extension',
    phrases: ['leg extension'],
    equipmentTypes: ['leg extension'],
    productTerms: ['leg extension'],
  },
  {
    id: 'leg_curl',
    phrases: ['leg curl'],
    equipmentTypes: ['leg curl'],
    productTerms: ['leg curl'],
  },
  {
    id: 'row_machine',
    phrases: ['row machine', 'seated row', 'low row', 'rowing machine'],
    equipmentTypes: ['row machine', 'rower'],
    productTerms: ['row machine', 'seated row', 'low row', 'row', 'rower'],
  },
  {
    id: 'abdominal',
    phrases: ['abdominal crunch', 'ab crunch', 'abdominal', 'crunch'],
    equipmentTypes: ['abdominal machine'],
    productTerms: ['abdominal crunch', 'ab crunch', 'abdominal', 'crunch'],
    excludeTerms: ['treadmill'],
  },
  {
    id: 'treadmill',
    phrases: ['treadmill', 'treadmills', 'running machine', 'running', 'run', 'tread', 'treadm'],
    equipmentTypes: ['treadmill', 'non-motorised treadmill'],
    productTerms: ['treadmill', 'running', 'tread'],
    modelCodes: ['956i', '966i', '932i', '946i', 'c932', 'c946'],
    familyModelCodes: ['trm'],
    excludeModelCodes: ['amt', 'efx', 'rbk', 'ubk'],
    wordPatterns: [/\brun\b/i],
    excludeTerms: ['recumbent', 'abdominal', 'crunch', 'bike', 'press', 'row', 'curl', 'extension'],
  },
  {
    id: 'stepper',
    phrases: ['stepper', 'climbmill', 'climb mill', 'powermill', 'power mill'],
    equipmentTypes: ['stepper', 'stepper/stair climber'],
    productTerms: ['stepper', 'climbmill', 'climb mill', 'powermill', 'power mill'],
    excludeTerms: ['stair climber'],
  },
  {
    id: 'climber',
    phrases: ['climber'],
    equipmentTypes: ['climber'],
    productTerms: ['climber'],
    excludeTerms: ['stair'],
  },
]

/** Scoring weights (higher = better rank). */
export const EQUIPMENT_SEARCH_SCORE = Object.freeze({
  EXACT_MODEL: 1000,
  EXACT_BRAND_AND_MODEL: 800,
  BRAND_AND_MODEL_PREFIX: 600,
  EXACT_CANONICAL_NAME: 500,
  SERIES_MATCH: 300,
  BRAND_MATCH: 200,
  BRAND_PREFIX_MATCH: 180,
  EQUIPMENT_TYPE: 100,
  TOKEN_CANONICAL: 24,
  TOKEN_SERIES: 20,
  TOKEN_MODEL: 16,
  TOKEN_OTHER: 8,
  ALL_TOKENS_IN_CANONICAL: 12,
  MODEL_PREFIX: 120,
  PARTIAL_TOKEN: 40,
  WRONG_MODEL_NUMBER: -450,
  WRONG_EQUIPMENT_TYPE: -150,
  TOKEN_MISMATCH: -40,
})

function normalizeWhitespace(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim()
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Split CamelCase / digit boundaries: StairMaster → Stair Master, F85 → F 85, Concept2 → Concept 2 */
export function expandSearchBoundaries(value) {
  return String(value ?? '')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/([A-Za-z])(\d)/g, '$1 $2')
    .replace(/(\d)([A-Za-z])/g, '$1 $2')
}

/** Lowercase, strip punctuation/hyphens/underscores, collapse spaces. */
export function normalizeSearchText(value) {
  return expandSearchBoundaries(value)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Alphanumeric-only compact form: stair master → stairmaster, f-85 → f85 */
export function compactSearchText(value) {
  return normalizeSearchText(value).replace(/\s+/g, '')
}

export function tokenizeSearchText(value) {
  const normalized = normalizeSearchText(value)
  return normalized ? normalized.split(' ').filter(Boolean) : []
}

/**
 * Model-like tokens: F85, AD7, 1750, 95T, RBK615, Pro 9000 pieces, etc.
 */
export function extractModelNumberTokens(value) {
  const compact = compactSearchText(value)
  if (!compact) return []

  const tokens = new Set()
  const patterns = [
    /[a-z]+\d+[a-z]*/g,
    /\d+[a-z]+/g,
    /\d{3,}/g,
  ]

  for (const pattern of patterns) {
    const matches = compact.match(pattern) ?? []
    for (const match of matches) tokens.add(match)
  }

  // Spaced forms like "f 85" → also keep "f85"
  const spaced = normalizeSearchText(value)
  const letterDigit = spaced.match(/\b([a-z]+)\s+(\d+[a-z]*)\b/g) ?? []
  for (const pair of letterDigit) {
    tokens.add(compactSearchText(pair))
  }

  return [...tokens]
}

function uniqueStrings(values = []) {
  const seen = new Set()
  const out = []
  for (const value of values) {
    const trimmed = String(value ?? '').trim()
    if (!trimmed || seen.has(trimmed)) continue
    seen.add(trimmed)
    out.push(trimmed)
  }
  return out
}

function buildBrandAliasList(entry) {
  return uniqueStrings([
    entry.displayName,
    entry.slug?.replace(/-/g, ' '),
    ...(entry.aliases ?? []),
  ])
}

function buildKnownSearchBrands() {
  return BRAND_REGISTRY.map((entry) => ({
    label: entry.displayName,
    key: entry.key,
    aliases: buildBrandAliasList(entry),
  }))
}

/** Built from BRAND_REGISTRY so StairMaster, Sole, Concept2, etc. all resolve. */
export const KNOWN_EQUIPMENT_SEARCH_BRANDS = buildKnownSearchBrands()

const SEARCH_BRAND_CANDIDATES = KNOWN_EQUIPMENT_SEARCH_BRANDS
  .flatMap((brand) => brand.aliases.map((alias) => ({
    brand: brand.label,
    key: brand.key,
    alias,
    normalizedAlias: normalizeSearchText(alias),
    compactAlias: compactSearchText(alias),
  })))
  .filter((entry) => entry.normalizedAlias || entry.compactAlias)
  .sort((left, right) => right.compactAlias.length - left.compactAlias.length)

const EQUIPMENT_TYPE_ALIAS_ENTRIES = Object.entries(EQUIPMENT_SEARCH_TERM_ALIASES)

function containsPhrase(text, phrase) {
  const haystack = normalizeSearchText(text)
  const needle = normalizeSearchText(phrase)
  if (!haystack || !needle) return false
  if (needle.includes(' ')) return haystack.includes(needle)
  return new RegExp(`\\b${escapeRegExp(needle)}\\b`, 'i').test(haystack)
}

function removePhrase(text, phrase) {
  const haystack = normalizeWhitespace(text)
  const needle = normalizeWhitespace(phrase)
  if (!haystack || !needle) return haystack
  if (needle.includes(' ')) {
    return normalizeWhitespace(haystack.replace(new RegExp(escapeRegExp(needle), 'ig'), ' '))
  }
  return normalizeWhitespace(haystack.replace(new RegExp(`\\b${escapeRegExp(needle)}\\b`, 'ig'), ' '))
}

function removeNormalizedPrefix(text, normalizedAlias) {
  const normalizedText = normalizeSearchText(text)
  if (!normalizedAlias || !normalizedText.startsWith(normalizedAlias)) return text
  const remainder = normalizedText.slice(normalizedAlias.length).trim()
  return remainder
}

/**
 * Detect brand from full aliases, spaced/compact forms, and prefixes
 * (Stair → StairMaster, Techno → Technogym, Nord → NordicTrack).
 */
export function detectSearchBrand(query) {
  const normalizedQuery = normalizeSearchText(query)
  const compactQuery = compactSearchText(query)
  if (!normalizedQuery) return { brand: null, brandKey: null, remainingQuery: query, matchedAlias: null }

  // Exact / contained full alias (longest first).
  for (const candidate of SEARCH_BRAND_CANDIDATES) {
    if (!candidate.normalizedAlias) continue
    if (
      normalizedQuery === candidate.normalizedAlias
      || normalizedQuery.startsWith(`${candidate.normalizedAlias} `)
      || containsPhrase(query, candidate.alias)
    ) {
      const remaining = removeNormalizedPrefix(query, candidate.normalizedAlias)
        || removePhrase(query, candidate.alias)
      return {
        brand: candidate.brand,
        brandKey: candidate.key,
        remainingQuery: remaining,
        matchedAlias: candidate.alias,
      }
    }

    // Compact equality: concept2, stairmaster, waterrower, lifefitness
    if (compactQuery === candidate.compactAlias) {
      return {
        brand: candidate.brand,
        brandKey: candidate.key,
        remainingQuery: '',
        matchedAlias: candidate.alias,
      }
    }

    if (
      compactQuery.startsWith(candidate.compactAlias)
      && candidate.compactAlias.length >= MIN_BRAND_PREFIX_LENGTH
      && compactQuery.length > candidate.compactAlias.length
    ) {
      // e.g. concept2model — treat alias as brand prefix only when followed by a breakable boundary
      const restCompact = compactQuery.slice(candidate.compactAlias.length)
      if (/^\d/.test(restCompact) && !/\d$/.test(candidate.compactAlias)) {
        // Concept2 already ends matching; skip
      } else if (candidate.compactAlias.length >= 6) {
        return {
          brand: candidate.brand,
          brandKey: candidate.key,
          remainingQuery: restCompact,
          matchedAlias: candidate.alias,
        }
      }
    }
  }

  // Prefix of brand alias: stair, stairm, techno, nord, schw, life, sole, water, york, rep, …
  if (compactQuery.length >= MIN_BRAND_PREFIX_LENGTH || compactQuery.length >= 2) {
    let best = null
    for (const candidate of SEARCH_BRAND_CANDIDATES) {
      if (!candidate.compactAlias.startsWith(compactQuery)) continue
      // Allow short exact-ish brands (REP, BH) when query equals compact start
      if (
        compactQuery.length < MIN_BRAND_PREFIX_LENGTH
        && compactQuery !== candidate.compactAlias
        && candidate.compactAlias.length > compactQuery.length
      ) {
        continue
      }
      if (!best || candidate.compactAlias.length < best.compactAlias.length) {
        best = candidate
      }
    }
    if (best) {
      return {
        brand: best.brand,
        brandKey: best.key,
        remainingQuery: '',
        matchedAlias: best.alias,
      }
    }
  }

  return { brand: null, brandKey: null, remainingQuery: query, matchedAlias: null }
}

function buildSearchTokensAfterBrand(query, brandResult) {
  const normalizedQuery = normalizeWhitespace(query)
  if (!normalizedQuery) return []

  if (!brandResult.brand) {
    return tokenizeSearchText(normalizedQuery)
  }

  if (!brandResult.remainingQuery) {
    // Query was only a brand / brand prefix
    const fullNormalized = normalizeSearchText(normalizedQuery)
    const brandNormalized = normalizeSearchText(brandResult.matchedAlias || brandResult.brand)
    if (fullNormalized === brandNormalized || compactSearchText(normalizedQuery) === compactSearchText(brandResult.brand)) {
      return []
    }
    if (brandResult.remainingQuery === '') {
      // Prefix-only brand match (stair → StairMaster): no leftover tokens
      const compactQuery = compactSearchText(normalizedQuery)
      const brandCompact = compactSearchText(brandResult.brand)
      if (brandCompact.startsWith(compactQuery) || compactQuery === brandCompact) {
        return []
      }
    }
  }

  const remaining = brandResult.remainingQuery || ''
  if (!remaining) return []
  return tokenizeSearchText(remaining)
}

function phrasePartiallyMatchesToken(rule, phrase, token) {
  const normalizedPhrase = normalizeSearchText(phrase)
  const normalizedToken = normalizeSearchText(token)
  if (!normalizedPhrase || !normalizedToken) return false
  if (normalizedPhrase === normalizedToken) return true

  const phraseMatchesToken = normalizedPhrase.startsWith(normalizedToken)
    || normalizedToken.startsWith(normalizedPhrase)
  if (!phraseMatchesToken) return false

  if (rule.id === 'climber' && normalizedToken !== normalizedPhrase && normalizedToken.length < 7) {
    return false
  }

  return normalizedToken.length >= MIN_PARTIAL_INTENT_TOKEN_LENGTH
    || normalizedPhrase.length >= MIN_PARTIAL_INTENT_TOKEN_LENGTH
}

export function searchTokenMatchesHaystack(token, haystack) {
  const normalizedToken = normalizeSearchText(token)
  const normalizedHaystack = normalizeSearchText(haystack)
  const compactToken = compactSearchText(token)
  const compactHaystack = compactSearchText(haystack)

  if (!normalizedToken || !normalizedHaystack) return false

  if (normalizedToken.includes(' ')) {
    return normalizedHaystack.includes(normalizedToken) || (
      compactToken.length >= 3 && compactHaystack.includes(compactToken)
    )
  }

  if (new RegExp(`\\b${escapeRegExp(normalizedToken)}\\b`, 'i').test(normalizedHaystack)) {
    return true
  }

  // Avoid false positives like query token "7" matching "1750".
  if (compactToken.length >= 3 && compactHaystack.includes(compactToken)) {
    return true
  }

  if (normalizedToken.length < MIN_PARTIAL_SEARCH_TOKEN_LENGTH) return false

  if (
    compactToken.length >= MIN_PARTIAL_SEARCH_TOKEN_LENGTH
    && (compactHaystack.startsWith(compactToken) || compactToken.startsWith(compactHaystack))
  ) {
    return true
  }

  return normalizedHaystack.split(' ').some((word) => {
    const compactWord = compactSearchText(word)
    if (word.startsWith(normalizedToken) || normalizedToken.startsWith(word)) return true
    if (compactToken.length < MIN_PARTIAL_SEARCH_TOKEN_LENGTH) return false
    return compactWord.startsWith(compactToken) || compactToken.startsWith(compactWord)
  })
}

export function allSearchTokensMatchProduct(tokens = [], product) {
  if (!tokens.length) return true
  const index = getProductSearchIndex(product)
  return tokens.every((token) => searchTokenMatchesIndex(token, index))
}

function searchTokenMatchesIndex(token, index) {
  if (!token || !index) return false
  if (searchTokenMatchesHaystack(token, index.haystack)) return true
  const compactToken = compactSearchText(token)
  if (!compactToken || compactToken.length < MIN_PARTIAL_SEARCH_TOKEN_LENGTH) return false
  if (compactToken.length >= 3 && index.compactHaystack.includes(compactToken)) return true
  return index.tokens.some((entry) => (
    entry === compactToken
    || (entry.length >= MIN_PARTIAL_SEARCH_TOKEN_LENGTH && (
      entry.startsWith(compactToken) || compactToken.startsWith(entry)
    ))
  ))
}

function detectExactEquipmentIntent(query) {
  const candidates = EQUIPMENT_SEARCH_INTENT_RULES
    .flatMap((rule) => rule.phrases.map((phrase) => ({ rule, phrase })))
    .sort((left, right) => right.phrase.length - left.phrase.length)

  for (const candidate of candidates) {
    if (!containsPhrase(query, candidate.phrase)) continue
    return {
      intent: candidate.rule,
      matchedPhrase: candidate.phrase,
      remainingQuery: removePhrase(query, candidate.phrase),
      partial: false,
    }
  }

  return null
}

export function inferPartialEquipmentIntentFromText(text) {
  const tokens = tokenizeSearchText(text)
  let bestMatch = null

  for (const token of tokens) {
    const normalizedToken = normalizeSearchText(token)
    if (normalizedToken.length < MIN_PARTIAL_INTENT_TOKEN_LENGTH) continue

    for (const rule of EQUIPMENT_SEARCH_INTENT_RULES) {
      for (const phrase of rule.phrases) {
        if (!phrasePartiallyMatchesToken(rule, phrase, token)) continue

        const score = Math.min(normalizeSearchText(phrase).length, normalizedToken.length)
        if (!bestMatch || score > bestMatch.score) {
          bestMatch = {
            rule,
            matchedPhrase: token,
            score,
          }
        }
      }
    }
  }

  return bestMatch
}

function detectModelCodeEquipmentIntent(query) {
  const tokens = uniqueStrings([
    ...tokenizeSearchText(query),
    compactSearchText(query),
    ...extractModelNumberTokens(query),
  ])

  const specificCandidates = EQUIPMENT_SEARCH_INTENT_RULES
    .flatMap((rule) => (rule.modelCodes ?? []).map((code) => ({ rule, code, specific: true })))
    .sort((left, right) => right.code.length - left.code.length)

  for (const token of tokens) {
    for (const candidate of specificCandidates) {
      if (compactSearchText(token) !== compactSearchText(candidate.code)) continue
      return {
        intent: candidate.rule,
        matchedPhrase: token,
        remainingQuery: removePhrase(query, token),
        partial: false,
        modelCode: true,
        specificModelCode: candidate.code,
      }
    }
  }

  const familyCandidates = EQUIPMENT_SEARCH_INTENT_RULES
    .flatMap((rule) => (rule.familyModelCodes ?? []).map((code) => ({ rule, code, specific: false })))
    .sort((left, right) => right.code.length - left.code.length)

  for (const token of tokens) {
    for (const candidate of familyCandidates) {
      if (!modelCodeMatchesField(candidate.code, token)) continue
      return {
        intent: candidate.rule,
        matchedPhrase: token,
        remainingQuery: removePhrase(query, token),
        partial: false,
        modelCode: true,
        specificModelCode: null,
      }
    }
  }

  return null
}

function detectEquipmentIntent(query, { allowBareStair = false } = {}) {
  const exact = detectExactEquipmentIntent(query)
  if (exact) return exact

  // Bare "stair" is treated as StairMaster brand, not stair-climber intent.
  const normalized = normalizeSearchText(query)
  if (!allowBareStair && (normalized === 'stair' || compactSearchText(query) === 'stair')) {
    return { intent: null, matchedPhrase: null, remainingQuery: query, partial: false }
  }

  const partial = inferPartialEquipmentIntentFromText(query)
  if (partial) {
    return {
      intent: partial.rule,
      matchedPhrase: partial.matchedPhrase,
      remainingQuery: removePhrase(query, partial.matchedPhrase),
      partial: true,
    }
  }

  const modelCode = detectModelCodeEquipmentIntent(query)
  if (modelCode) return modelCode

  return { intent: null, matchedPhrase: null, remainingQuery: query, partial: false }
}

function detectBrand(query) {
  return detectSearchBrand(query)
}

export function parseEquipmentProductSearchQuery(query) {
  const normalizedQuery = normalizeWhitespace(query)
  const brandResult = detectBrand(normalizedQuery)
  const allSearchTokens = buildSearchTokensAfterBrand(normalizedQuery, brandResult)

  // Brand-only / brand-prefix queries skip equipment intent (Stair → StairMaster).
  const intentSource = brandResult.brand && !brandResult.remainingQuery
    ? ''
    : (brandResult.remainingQuery || (!brandResult.brand ? normalizedQuery : brandResult.remainingQuery))

  const intentResult = intentSource
    ? detectEquipmentIntent(intentSource)
    : { intent: null, matchedPhrase: null, remainingQuery: '', partial: false }

  const freeText = normalizeWhitespace(intentResult.remainingQuery)
  const freeTextTokens = freeText ? tokenizeSearchText(freeText) : []
  const queryModelTokens = extractModelNumberTokens(
    [brandResult.remainingQuery, freeText, ...allSearchTokens].filter(Boolean).join(' '),
  )

  return {
    rawQuery: normalizedQuery,
    normalizedQuery: normalizeSearchText(normalizedQuery),
    compactQuery: compactSearchText(normalizedQuery),
    brand: brandResult.brand,
    brandKey: brandResult.brandKey,
    matchedBrandAlias: brandResult.matchedAlias,
    equipmentIntent: intentResult.intent,
    matchedIntentPhrase: intentResult.matchedPhrase,
    specificModelCode: intentResult.specificModelCode ?? null,
    partialIntent: Boolean(intentResult.partial),
    freeText,
    freeTextTokens,
    allSearchTokens,
    queryModelTokens,
    requireBrandAndIntent: Boolean(brandResult.brand && intentResult.intent),
    brandOnly: Boolean(brandResult.brand && allSearchTokens.length === 0 && !intentResult.intent),
  }
}

function expandAliasTerms(value) {
  const normalized = normalizeSearchText(value)
  if (!normalized) return []
  const extras = []
  for (const [canonical, aliases] of EQUIPMENT_TYPE_ALIAS_ENTRIES) {
    if (normalized === canonical || aliases.some((alias) => normalizeSearchText(alias) === normalized)) {
      extras.push(canonical, ...aliases)
    }
  }
  return extras
}

/**
 * Build a normalized search index for a product.
 * Includes spaced tokens, compact forms, model numbers, slug pieces, and aliases.
 */
export function buildProductSearchIndex(product) {
  const brandEntry = resolveBrandRegistryEntry(product?.brand)
  const brandLabel = brandEntry?.displayName || product?.brand || ''
  const series = product?.product_family || product?.series || ''
  const model = product?.model || ''
  const equipmentType = product?.equipment_type || ''
  const canonical = product?.canonical_product_name || ''
  const key = product?.canonical_product_key || ''
  const slug = key || ''

  const brandAliases = brandEntry ? buildBrandAliasList(brandEntry) : [brandLabel]
  const typeAliases = expandAliasTerms(equipmentType)

  const sourceParts = uniqueStrings([
    brandLabel,
    ...brandAliases,
    canonical,
    series,
    model,
    equipmentType,
    ...typeAliases,
    slug.replace(/-/g, ' '),
  ])

  const tokenSet = new Set()
  const phraseSet = new Set()

  for (const part of sourceParts) {
    const normalized = normalizeSearchText(part)
    const compact = compactSearchText(part)
    if (normalized) phraseSet.add(normalized)
    if (compact) tokenSet.add(compact)
    for (const token of tokenizeSearchText(part)) {
      tokenSet.add(token)
      tokenSet.add(compactSearchText(token))
    }
    for (const modelToken of extractModelNumberTokens(part)) {
      tokenSet.add(modelToken)
    }
  }

  // Pair phrases: "sole f85", "sole treadmill"
  const brandCompact = compactSearchText(brandLabel)
  const modelCompact = compactSearchText(model)
  const typeCompact = compactSearchText(equipmentType)
  if (brandCompact && modelCompact) phraseSet.add(normalizeSearchText(`${brandLabel} ${model}`))
  if (brandCompact && typeCompact) phraseSet.add(normalizeSearchText(`${brandLabel} ${equipmentType}`))

  const modelTokens = uniqueStrings([
    ...extractModelNumberTokens(model),
    ...extractModelNumberTokens(canonical),
    ...extractModelNumberTokens(series),
  ])

  const haystack = [...phraseSet].join(' ')
  const compactHaystack = compactSearchText(haystack)

  return {
    brandLabel,
    brandKey: brandEntry?.key || compactSearchText(brandLabel),
    series: normalizeSearchText(series),
    model: normalizeSearchText(model),
    modelCompact,
    modelTokens,
    equipmentType: normalizeSearchText(equipmentType),
    canonical: normalizeSearchText(canonical),
    canonicalCompact: compactSearchText(canonical),
    tokens: [...tokenSet].filter(Boolean),
    phrases: [...phraseSet],
    haystack,
    compactHaystack,
  }
}

const productIndexCache = new WeakMap()

function getProductSearchIndex(product) {
  if (!product || typeof product !== 'object') {
    return buildProductSearchIndex(product)
  }
  let cached = productIndexCache.get(product)
  if (!cached) {
    cached = buildProductSearchIndex(product)
    productIndexCache.set(product, cached)
  }
  return cached
}

function buildProductFieldHaystack(product, { includeKey = false } = {}) {
  const fields = [
    product?.canonical_product_name,
    product?.model,
    product?.product_family,
    product?.equipment_type,
  ]
  if (includeKey) fields.push(product?.canonical_product_key)

  return fields
    .map((value) => normalizeSearchText(value))
    .filter(Boolean)
    .join(' ')
}

function modelCodeMatchesField(code, field) {
  const normalizedCode = compactSearchText(code)
  const normalizedField = compactSearchText(field)
  if (!normalizedCode || !normalizedField) return false
  if (normalizedField === normalizedCode) return true
  if (normalizedField.includes(normalizedCode)) return true
  return normalizedCode.length >= 3 && normalizeSearchText(field).includes(normalizeSearchText(code))
}

function getRuleModelCodes(rule) {
  return [
    ...(rule?.modelCodes ?? []),
    ...(rule?.familyModelCodes ?? []),
  ]
}

function productMatchesModelCodes(product, codes = []) {
  if (!product || !codes.length) return false
  const index = getProductSearchIndex(product)
  return codes.some((code) => {
    const compact = compactSearchText(code)
    return index.modelTokens.includes(compact)
      || index.compactHaystack.includes(compact)
      || modelCodeMatchesField(code, product?.model)
      || modelCodeMatchesField(code, product?.canonical_product_name)
  })
}

function productHasExcludedModelCodes(product, rule) {
  return productMatchesModelCodes(product, rule?.excludeModelCodes ?? [])
}

function equipmentTypeMatchesIntent(product, rule) {
  const equipmentType = normalizeSearchText(product?.equipment_type)
  if (!equipmentType || !rule?.equipmentTypes?.length) return false
  return rule.equipmentTypes.some((entry) => (
    equipmentType === normalizeSearchText(entry)
    || equipmentType.includes(normalizeSearchText(entry))
  ))
}

function termMatchesHaystack(term, haystack) {
  const normalizedTerm = normalizeSearchText(term)
  if (!normalizedTerm) return false
  if (normalizedTerm.includes(' ')) return haystack.includes(normalizedTerm)
  return new RegExp(`\\b${escapeRegExp(normalizedTerm)}\\b`, 'i').test(haystack)
}

export function productMatchesEquipmentIntent(product, rule) {
  if (!product || !rule) return false

  if (rule.id === 'treadmill' && productHasExcludedModelCodes(product, rule)) {
    return false
  }

  if (equipmentTypeMatchesIntent(product, rule)) {
    return true
  }

  if (productMatchesModelCodes(product, rule.modelCodes)) {
    return true
  }

  if (productMatchesModelCodes(product, rule.familyModelCodes)) {
    return true
  }

  const productHaystack = buildProductFieldHaystack(product)

  if (rule.excludeTerms?.some((term) => termMatchesHaystack(term, productHaystack))) {
    return false
  }

  if (rule.productTerms?.some((term) => termMatchesHaystack(term, productHaystack))) {
    return true
  }

  if (rule.wordPatterns?.some((pattern) => pattern.test(productHaystack))) {
    return true
  }

  const keyHaystack = normalizeSearchText(product?.canonical_product_key?.replace(/-/g, ' '))
  if (keyHaystack) {
    if (getRuleModelCodes(rule).some((code) => modelCodeMatchesField(code, keyHaystack))) {
      return true
    }

    if (rule.productTerms?.some((term) => termMatchesHaystack(term, keyHaystack))) {
      return true
    }
  }

  return false
}

export function productMatchesSearchBrand(product, brand) {
  if (!brand) return true
  const productEntry = resolveBrandRegistryEntry(product?.brand)
  const queryEntry = resolveBrandRegistryEntry(brand)
  if (productEntry && queryEntry) return productEntry.key === queryEntry.key
  return compactSearchText(product?.brand) === compactSearchText(brand)
    || normalizeSearchText(product?.brand) === normalizeSearchText(brand)
}

function modelsShareFamilyPrefix(left, right) {
  const a = compactSearchText(left)
  const b = compactSearchText(right)
  if (!a || !b || a === b) return false
  // F85 vs F80 share letter prefix + different numbers
  const leftMatch = a.match(/^([a-z]+)(\d+)/)
  const rightMatch = b.match(/^([a-z]+)(\d+)/)
  if (leftMatch && rightMatch && leftMatch[1] === rightMatch[1] && leftMatch[2] !== rightMatch[2]) {
    return true
  }
  // Pure numeric siblings: 1750 vs 2450
  if (/^\d+$/.test(a) && /^\d+$/.test(b) && a !== b) return true
  return false
}

function scoreModelTokenAgainstProduct(queryModelToken, index) {
  const compact = compactSearchText(queryModelToken)
  if (!compact) return { score: 0, exact: false, conflict: false }

  if (index.modelCompact === compact || index.modelTokens.includes(compact)) {
    return { score: EQUIPMENT_SEARCH_SCORE.EXACT_MODEL, exact: true, conflict: false }
  }

  if (index.modelCompact.startsWith(compact) || index.modelTokens.some((token) => token.startsWith(compact))) {
    return { score: EQUIPMENT_SEARCH_SCORE.MODEL_PREFIX, exact: false, conflict: false }
  }

  if (index.compactHaystack.includes(compact)) {
    return { score: EQUIPMENT_SEARCH_SCORE.TOKEN_MODEL, exact: false, conflict: false }
  }

  // Wrong sibling model (F85 query vs F80 product)
  if (
    modelsShareFamilyPrefix(compact, index.modelCompact)
    || index.modelTokens.some((token) => modelsShareFamilyPrefix(compact, token))
  ) {
    return { score: EQUIPMENT_SEARCH_SCORE.WRONG_MODEL_NUMBER, exact: false, conflict: true }
  }

  return { score: 0, exact: false, conflict: false }
}

function scoreSearchTokenAlignment(product, tokens = []) {
  if (!tokens.length) return 0

  const index = getProductSearchIndex(product)
  let score = 0
  let mismatches = 0

  for (const token of tokens) {
    if (searchTokenMatchesHaystack(token, index.canonical)) score += EQUIPMENT_SEARCH_SCORE.TOKEN_CANONICAL
    else if (searchTokenMatchesHaystack(token, index.series)) score += EQUIPMENT_SEARCH_SCORE.TOKEN_SERIES
    else if (searchTokenMatchesHaystack(token, index.model)) score += EQUIPMENT_SEARCH_SCORE.TOKEN_MODEL
    else if (searchTokenMatchesIndex(token, index)) score += EQUIPMENT_SEARCH_SCORE.TOKEN_OTHER
    else {
      mismatches += 1
      score += EQUIPMENT_SEARCH_SCORE.TOKEN_MISMATCH
    }
  }

  if (tokens.length > 1 && tokens.every((token) => searchTokenMatchesHaystack(token, index.canonical))) {
    score += EQUIPMENT_SEARCH_SCORE.ALL_TOKENS_IN_CANONICAL
  }

  return { score, mismatches }
}

export function evaluateEquipmentProductSearch(product, parsedQuery) {
  const allSearchTokens = parsedQuery?.allSearchTokens ?? []
  const brandMatched = productMatchesSearchBrand(product, parsedQuery?.brand)
  const tokensMatched = allSearchTokensMatchProduct(allSearchTokens, product)
  const equipmentIntentMatched = parsedQuery?.equipmentIntent
    ? productMatchesEquipmentIntent(product, parsedQuery.equipmentIntent)
    : false
  const specificModelCodeMatched = parsedQuery?.specificModelCode
    ? productMatchesModelCodes(product, [parsedQuery.specificModelCode])
    : true

  let excludedReason = null

  if (parsedQuery?.brand && !brandMatched) {
    excludedReason = 'brand_mismatch'
  } else if (allSearchTokens.length > 0 && !tokensMatched) {
    // Soft-include when a model token partially matches (F8 → F85) even if other checks differ
    const index = getProductSearchIndex(product)
    const partialModelHit = (parsedQuery.queryModelTokens ?? []).some((token) => {
      const compact = compactSearchText(token)
      return index.modelCompact.startsWith(compact) || index.modelTokens.some((entry) => entry.startsWith(compact))
    })
    if (!partialModelHit) excludedReason = 'search_token_mismatch'
  } else if (parsedQuery?.requireBrandAndIntent && !equipmentIntentMatched) {
    excludedReason = 'equipment_intent_mismatch'
  } else if (!parsedQuery?.requireBrandAndIntent && parsedQuery?.equipmentIntent && !equipmentIntentMatched) {
    excludedReason = 'equipment_intent_mismatch'
  } else if (parsedQuery?.specificModelCode && !specificModelCodeMatched) {
    excludedReason = 'model_code_mismatch'
  }

  const score = scoreEquipmentProductSearchMatch(product, parsedQuery)

  if (score <= 0 && !excludedReason) {
    excludedReason = 'low_score'
  }

  return {
    product,
    brandMatched,
    equipmentIntentMatched,
    score,
    excludedReason: score > 0 ? null : excludedReason,
    included: score > 0,
  }
}

export function scoreEquipmentProductSearchMatch(product, parsedQuery) {
  if (!product || !parsedQuery?.rawQuery) return 0

  const {
    rawQuery,
    brand,
    equipmentIntent,
    specificModelCode,
    allSearchTokens = [],
    queryModelTokens = [],
    requireBrandAndIntent,
    brandOnly,
    normalizedQuery,
    compactQuery,
  } = parsedQuery

  const index = getProductSearchIndex(product)

  if (specificModelCode && !productMatchesModelCodes(product, [specificModelCode])) {
    return 0
  }

  if (brand && !productMatchesSearchBrand(product, brand)) {
    return 0
  }

  if (allSearchTokens.length > 0 && !allSearchTokensMatchProduct(allSearchTokens, product)) {
    const partialModelHit = queryModelTokens.some((token) => {
      const compact = compactSearchText(token)
      return index.modelCompact.startsWith(compact) || index.modelTokens.some((entry) => entry.startsWith(compact))
    })
    if (!partialModelHit) return 0
  }

  if (requireBrandAndIntent) {
    if (!productMatchesEquipmentIntent(product, equipmentIntent)) return 0
  } else if (equipmentIntent && !productMatchesEquipmentIntent(product, equipmentIntent)) {
    return 0
  }

  let score = 0
  let exactModel = false

  // Model-number scoring (highest priority signal)
  const modelTokens = queryModelTokens.length
    ? queryModelTokens
    : extractModelNumberTokens(allSearchTokens.join(' ') || rawQuery)

  for (const modelToken of modelTokens) {
    const modelScore = scoreModelTokenAgainstProduct(modelToken, index)
    score += modelScore.score
    if (modelScore.exact) exactModel = true
  }

  // Exact brand + exact model
  if (brand && exactModel && productMatchesSearchBrand(product, brand)) {
    score += EQUIPMENT_SEARCH_SCORE.EXACT_BRAND_AND_MODEL
  } else if (brand && modelTokens.some((token) => {
    const compact = compactSearchText(token)
    return index.modelCompact.startsWith(compact) && compact.length > 0 && compact !== index.modelCompact
  })) {
    score += EQUIPMENT_SEARCH_SCORE.BRAND_AND_MODEL_PREFIX
  }

  // Exact canonical / display name
  if (index.canonical === normalizedQuery || index.canonicalCompact === compactQuery) {
    score += EQUIPMENT_SEARCH_SCORE.EXACT_CANONICAL_NAME
  } else if (index.canonical.includes(normalizedQuery) && normalizedQuery.length >= 3) {
    score += Math.round(EQUIPMENT_SEARCH_SCORE.EXACT_CANONICAL_NAME * 0.6)
  }

  // Series
  if (index.series && (
    allSearchTokens.some((token) => searchTokenMatchesHaystack(token, index.series))
    || (normalizedQuery && index.series.includes(normalizedQuery))
  )) {
    score += EQUIPMENT_SEARCH_SCORE.SERIES_MATCH
  }

  // Brand boost
  if (brand && productMatchesSearchBrand(product, brand)) {
    score += brandOnly
      ? EQUIPMENT_SEARCH_SCORE.BRAND_MATCH + 40
      : EQUIPMENT_SEARCH_SCORE.BRAND_MATCH
  } else if (!brand && productMatchesSearchBrand(product, rawQuery)) {
    score += EQUIPMENT_SEARCH_SCORE.BRAND_MATCH
  } else if (!brand) {
    // Partial brand from product side (query "techno" already resolved above)
    const productBrandCompact = index.brandKey
    if (compactQuery && productBrandCompact.startsWith(compactQuery) && compactQuery.length >= MIN_BRAND_PREFIX_LENGTH) {
      score += EQUIPMENT_SEARCH_SCORE.BRAND_PREFIX_MATCH
    }
  }

  // Equipment type
  if (equipmentIntent && equipmentTypeMatchesIntent(product, equipmentIntent)) {
    score += EQUIPMENT_SEARCH_SCORE.EQUIPMENT_TYPE
  } else if (equipmentIntent && productMatchesEquipmentIntent(product, equipmentIntent)) {
    score += Math.round(EQUIPMENT_SEARCH_SCORE.EQUIPMENT_TYPE * 0.7)
  } else if (allSearchTokens.some((token) => searchTokenMatchesHaystack(token, index.equipmentType))) {
    score += EQUIPMENT_SEARCH_SCORE.EQUIPMENT_TYPE
  } else if (equipmentIntent && !productMatchesEquipmentIntent(product, equipmentIntent)) {
    score += EQUIPMENT_SEARCH_SCORE.WRONG_EQUIPMENT_TYPE
  }

  const alignment = scoreSearchTokenAlignment(product, allSearchTokens)
  score += typeof alignment === 'number' ? alignment : alignment.score

  // Brand-only queries: every product of the brand is eligible; slight alphabetical nudge via name length stability
  if (brandOnly && productMatchesSearchBrand(product, brand)) {
    score = Math.max(score, EQUIPMENT_SEARCH_SCORE.BRAND_MATCH)
  }

  return score
}

/**
 * Display lines for valuator suggestions:
 * Brand / Series / Model / Equipment type
 */
export function formatEquipmentProductSearchSuggestion(product) {
  const brand = String(product?.brand ?? '').trim()
  let series = String(product?.product_family || product?.series || '').trim()
  const model = String(product?.model ?? '').trim()
  const equipmentType = String(product?.equipment_type ?? '').trim()
  if (series && model && displayNameStartsWithPhrase(model, series)) {
    series = ''
  }
  return {
    brand,
    series,
    model,
    equipmentType,
    lines: [brand, series, model, equipmentType].filter(Boolean),
    label: [brand, series, model, equipmentType].filter(Boolean).join(' · '),
  }
}

export function searchEquipmentProductCatalog(products = [], query, { limit = null } = {}) {
  const parsedQuery = parseEquipmentProductSearchQuery(query)
  if (!parsedQuery.rawQuery) {
    return {
      matches: [],
      scoredMatches: [],
      diagnostics: [],
      strongMatch: null,
      hasStrongSingleMatch: false,
      parsedQuery,
    }
  }

  const diagnostics = products.map((product) => evaluateEquipmentProductSearch(product, parsedQuery))
  const scoredMatches = diagnostics
    .filter((entry) => entry.included)
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score
      return String(left.product.canonical_product_name || '').localeCompare(
        String(right.product.canonical_product_name || ''),
      )
    })

  const limited = Number.isFinite(limit) && limit > 0
    ? scoredMatches.slice(0, limit)
    : scoredMatches

  const strongMatches = limited.filter((entry) => entry.score >= 800)
  const strongMatch = strongMatches.length === 1 ? strongMatches[0].product : null

  const debugDiagnostics = parsedQuery.brand
    ? diagnostics.filter((entry) => productMatchesSearchBrand(entry.product, parsedQuery.brand))
    : diagnostics.filter((entry) => entry.included || entry.excludedReason)

  return {
    matches: limited.map((entry) => entry.product),
    scoredMatches: limited,
    diagnostics: debugDiagnostics,
    strongMatch,
    hasStrongSingleMatch: Boolean(strongMatch),
    parsedQuery,
  }
}
