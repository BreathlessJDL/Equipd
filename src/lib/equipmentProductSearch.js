function normalizeWhitespace(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim()
}

function normalizeKey(value) {
  return normalizeWhitespace(value).toLowerCase()
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export const KNOWN_EQUIPMENT_SEARCH_BRANDS = [
  { label: 'Life Fitness', aliases: ['life fitness'] },
  { label: 'Technogym', aliases: ['technogym'] },
  { label: 'Precor', aliases: ['precor'] },
  { label: 'Matrix Fitness', aliases: ['matrix fitness', 'matrix'] },
  { label: 'Cybex', aliases: ['cybex'] },
]

export const EQUIPMENT_SEARCH_INTENT_RULES = [
  {
    id: 'stair_climber',
    phrases: ['stair climber', 'stairclimber', 'stair'],
    equipmentTypes: ['stair climber', 'stepper/stair climber'],
    productTerms: ['stair climber', 'stairclimber', 'stair'],
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
    phrases: ['upright bike', 'exercise bike', 'indoor bike', 'bike', 'cycle'],
    equipmentTypes: ['upright bike', 'exercise bike', 'indoor bike'],
    productTerms: ['upright bike', 'bike', 'cycle'],
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
    phrases: ['row machine', 'seated row', 'low row'],
    equipmentTypes: ['row machine'],
    productTerms: ['row machine', 'seated row', 'low row', 'row'],
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

function containsPhrase(text, phrase) {
  const haystack = normalizeKey(text)
  const needle = normalizeKey(phrase)
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

function detectBrand(query) {
  const normalizedQuery = normalizeKey(query)
  const candidates = KNOWN_EQUIPMENT_SEARCH_BRANDS
    .flatMap((brand) => brand.aliases.map((alias) => ({ brand: brand.label, alias })))
    .sort((left, right) => right.alias.length - left.alias.length)

  for (const candidate of candidates) {
    if (!containsPhrase(query, candidate.alias)) continue
    return {
      brand: candidate.brand,
      remainingQuery: removePhrase(query, candidate.alias),
    }
  }

  for (const candidate of candidates) {
    const alias = normalizeKey(candidate.alias)
    if (normalizedQuery.length >= 2 && alias.startsWith(normalizedQuery)) {
      return {
        brand: candidate.brand,
        remainingQuery: '',
      }
    }
  }

  return { brand: null, remainingQuery: query }
}

function buildSearchTokensAfterBrand(query, brandResult) {
  const normalizedQuery = normalizeWhitespace(query)
  if (!normalizedQuery) return []

  if (!brandResult.brand) {
    return normalizedQuery.split(/\s+/).filter(Boolean)
  }

  const aliases = KNOWN_EQUIPMENT_SEARCH_BRANDS
    .filter((entry) => entry.label === brandResult.brand)
    .flatMap((entry) => entry.aliases)
    .sort((left, right) => normalizeKey(right).length - normalizeKey(left).length)

  for (const alias of aliases) {
    if (containsPhrase(normalizedQuery, alias)) {
      return normalizeWhitespace(removePhrase(normalizedQuery, alias))
        .split(/\s+/)
        .filter(Boolean)
    }
  }

  const normalizedFullQuery = normalizeKey(normalizedQuery)
  for (const alias of aliases) {
    const normalizedAlias = normalizeKey(alias)
    if (normalizedAlias.startsWith(normalizedFullQuery)) {
      return []
    }
  }

  return normalizedQuery.split(/\s+/).filter(Boolean)
}

const MIN_PARTIAL_SEARCH_TOKEN_LENGTH = 2
const MIN_PARTIAL_INTENT_TOKEN_LENGTH = 4

function phrasePartiallyMatchesToken(rule, phrase, token) {
  const normalizedPhrase = normalizeKey(phrase)
  const normalizedToken = normalizeKey(token)
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
  const normalizedToken = normalizeKey(token)
  const normalizedHaystack = normalizeKey(haystack)
  if (!normalizedToken || !normalizedHaystack) return false

  if (normalizedToken.includes(' ')) {
    return normalizedHaystack.includes(normalizedToken)
  }

  if (new RegExp(`\\b${escapeRegExp(normalizedToken)}\\b`, 'i').test(normalizedHaystack)) {
    return true
  }

  if (normalizedToken.length < MIN_PARTIAL_SEARCH_TOKEN_LENGTH) return false

  return normalizedHaystack.split(/\s+/).some((word) => (
    word.startsWith(normalizedToken) || normalizedToken.startsWith(word)
  ))
}

export function allSearchTokensMatchProduct(tokens = [], product) {
  if (!tokens.length) return true

  const haystack = [
    product?.canonical_product_name,
    product?.model,
    product?.product_family,
    product?.equipment_type,
    product?.canonical_product_key,
  ].map((value) => normalizeKey(value)).filter(Boolean).join(' ')

  return tokens.every((token) => searchTokenMatchesHaystack(token, haystack))
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
  const tokens = normalizeWhitespace(text).split(/\s+/).filter(Boolean)
  let bestMatch = null

  for (const token of tokens) {
    const normalizedToken = normalizeKey(token)
    if (normalizedToken.length < MIN_PARTIAL_INTENT_TOKEN_LENGTH) continue

    for (const rule of EQUIPMENT_SEARCH_INTENT_RULES) {
      for (const phrase of rule.phrases) {
        if (!phrasePartiallyMatchesToken(rule, phrase, token)) continue

        const score = Math.min(normalizeKey(phrase).length, normalizedToken.length)
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
  const tokens = normalizeWhitespace(query).split(/\s+/).filter(Boolean)

  const specificCandidates = EQUIPMENT_SEARCH_INTENT_RULES
    .flatMap((rule) => (rule.modelCodes ?? []).map((code) => ({ rule, code, specific: true })))
    .sort((left, right) => right.code.length - left.code.length)

  for (const token of tokens) {
    for (const candidate of specificCandidates) {
      if (normalizeKey(token) !== normalizeKey(candidate.code)) continue
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

function detectEquipmentIntent(query) {
  const exact = detectExactEquipmentIntent(query)
  if (exact) return exact

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

export function parseEquipmentProductSearchQuery(query) {
  const normalizedQuery = normalizeWhitespace(query)
  const brandResult = detectBrand(normalizedQuery)
  const allSearchTokens = buildSearchTokensAfterBrand(normalizedQuery, brandResult)
  const intentResult = detectEquipmentIntent(brandResult.remainingQuery)
  const freeText = normalizeWhitespace(intentResult.remainingQuery)
  const freeTextTokens = freeText ? freeText.split(/\s+/).filter(Boolean) : []

  return {
    rawQuery: normalizedQuery,
    brand: brandResult.brand,
    equipmentIntent: intentResult.intent,
    matchedIntentPhrase: intentResult.matchedPhrase,
    specificModelCode: intentResult.specificModelCode ?? null,
    partialIntent: Boolean(intentResult.partial),
    freeText,
    freeTextTokens,
    allSearchTokens,
    requireBrandAndIntent: Boolean(brandResult.brand && intentResult.intent),
  }
}

function buildProductHaystack(product) {
  return buildProductFieldHaystack(product, { includeKey: true })
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
    .map((value) => normalizeKey(value))
    .filter(Boolean)
    .join(' ')
}

function modelCodeMatchesField(code, field) {
  const normalizedCode = normalizeKey(code)
  const normalizedField = normalizeKey(field)
  if (!normalizedCode || !normalizedField) return false
  if (normalizedField === normalizedCode) return true
  if (new RegExp(`\\b${escapeRegExp(normalizedCode)}\\b`, 'i').test(normalizedField)) return true
  if (new RegExp(`\\b${escapeRegExp(normalizedCode)}\\d`, 'i').test(normalizedField)) return true
  return normalizedCode.length >= 3 && normalizedField.includes(normalizedCode)
}

function getRuleModelCodes(rule) {
  return [
    ...(rule?.modelCodes ?? []),
    ...(rule?.familyModelCodes ?? []),
  ]
}

function productMatchesModelCodes(product, codes = []) {
  if (!product || !codes.length) return false

  const fields = [
    product?.model,
    product?.canonical_product_name,
    product?.product_family,
    product?.canonical_product_key,
  ]

  return codes.some((code) => fields.some((field) => modelCodeMatchesField(code, field)))
}

function productHasExcludedModelCodes(product, rule) {
  return productMatchesModelCodes(product, rule?.excludeModelCodes ?? [])
}

function equipmentTypeMatchesIntent(product, rule) {
  const equipmentType = normalizeKey(product?.equipment_type)
  if (!equipmentType || !rule?.equipmentTypes?.length) return false
  return rule.equipmentTypes.some((entry) => (
    equipmentType === normalizeKey(entry)
    || equipmentType.includes(normalizeKey(entry))
  ))
}

function termMatchesHaystack(term, haystack) {
  const normalizedTerm = normalizeKey(term)
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

  const keyHaystack = normalizeKey(product?.canonical_product_key)
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
  return normalizeKey(product?.brand) === normalizeKey(brand)
}

function scoreSearchTokenAlignment(product, tokens = []) {
  if (!tokens.length) return 0

  const canonical = normalizeKey(product?.canonical_product_name)
  const family = normalizeKey(product?.product_family)
  const model = normalizeKey(product?.model)
  let score = 0

  for (const token of tokens) {
    if (searchTokenMatchesHaystack(token, canonical)) score += 24
    else if (searchTokenMatchesHaystack(token, family)) score += 20
    else if (searchTokenMatchesHaystack(token, model)) score += 16
    else score += 8
  }

  if (tokens.length > 1 && tokens.every((token) => searchTokenMatchesHaystack(token, canonical))) {
    score += 12
  }

  return score
}

function scoreFreeTextTokens(product, tokens = []) {
  if (!tokens.length) return 0
  return scoreSearchTokenAlignment(product, tokens)
}

function leftoverTokensMatchProduct(tokens = [], product) {
  return allSearchTokensMatchProduct(tokens, product)
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
    excludedReason = 'search_token_mismatch'
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
    requireBrandAndIntent,
  } = parsedQuery

  const canonicalName = normalizeKey(product?.canonical_product_name)
  const key = normalizeKey(product?.canonical_product_key)
  const normalizedQuery = normalizeKey(rawQuery)
  const displayName = canonicalName || normalizeKey(`${product?.brand ?? ''} ${product?.model ?? ''}`)

  if (specificModelCode && !productMatchesModelCodes(product, [specificModelCode])) {
    return 0
  }

  if (brand && !productMatchesSearchBrand(product, brand)) {
    return 0
  }

  if (allSearchTokens.length > 0 && !allSearchTokensMatchProduct(allSearchTokens, product)) {
    return 0
  }

  if (requireBrandAndIntent) {
    if (!productMatchesEquipmentIntent(product, equipmentIntent)) return 0
  } else if (equipmentIntent && !productMatchesEquipmentIntent(product, equipmentIntent)) {
    return 0
  }

  let score = 0

  if (key === normalizedQuery) score = Math.max(score, 100)
  if (displayName === normalizedQuery) score = Math.max(score, 98)
  if (displayName.includes(normalizedQuery)) score = Math.max(score, 92)
  if (canonicalName.includes(normalizedQuery)) score = Math.max(score, 90)

  if (brand && productMatchesSearchBrand(product, brand)) {
    score += 20
    if (equipmentIntent && equipmentTypeMatchesIntent(product, equipmentIntent)) {
      score += 45
    } else if (equipmentIntent && productMatchesEquipmentIntent(product, equipmentIntent)) {
      score += 35
    } else if (!equipmentIntent) {
      score += 10
    }

    const family = normalizeKey(product?.product_family)
    const model = normalizeKey(product?.model)
    if (equipmentIntent?.productTerms?.some((term) => termMatchesHaystack(term, family) || termMatchesHaystack(term, model))) {
      score += 20
    }
  } else if (equipmentIntent && productMatchesEquipmentIntent(product, equipmentIntent)) {
    score += 40
  }

  score += scoreSearchTokenAlignment(product, allSearchTokens)

  return Math.min(100, score)
}

export function searchEquipmentProductCatalog(products = [], query) {
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
      return String(left.product.canonical_product_name).localeCompare(String(right.product.canonical_product_name))
    })

  const strongMatches = scoredMatches.filter((entry) => entry.score >= 80)
  const strongMatch = strongMatches.length === 1 ? strongMatches[0].product : null

  const debugDiagnostics = parsedQuery.brand
    ? diagnostics.filter((entry) => productMatchesSearchBrand(entry.product, parsedQuery.brand))
    : diagnostics.filter((entry) => entry.included || entry.excludedReason)

  return {
    matches: scoredMatches.map((entry) => entry.product),
    scoredMatches,
    diagnostics: debugDiagnostics,
    strongMatch,
    hasStrongSingleMatch: Boolean(strongMatch),
    parsedQuery,
  }
}
