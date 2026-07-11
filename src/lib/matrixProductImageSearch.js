/**
 * Matrix Fitness-specific product image search, ranking, and confidence rules.
 */

import {
  extractDomainFromUrl,
  getImageSourceDomainFromCandidate,
  normalizeHostname,
  scoreImageSourceDomain,
} from './equipmentProductImageDomains.js'
import {
  applyIdentityConfidenceCap,
  buildIdentityScoreBreakdown,
  evaluateImageCandidateIdentity,
  extractProductImageIdentity,
  filterQueriesToRetainIdentity,
  requiredIdentityQueryTokens,
} from './equipmentProductImageIdentity.js'

export const MATRIX_IMAGE_NEEDS_REVIEW_REASON = 'matrix_image_needs_review'

export const MATRIX_PREFERRED_IMAGE_DOMAINS = [
  'matrixfitness.com',
  'johnsonfitness.com',
  'johnsonhealthtech.com',
  'johnsonhealthtech.co.uk',
]

export const MATRIX_CONSOLE_VARIANT_TOKENS = new Set([
  'xr',
  'xer',
  'xir',
  'xur',
  'touch',
  'xl',
  'premium',
  'led',
  'console',
  'display',
  'screen',
])

export const MATRIX_PRODUCT_FAMILY_RULES = [
  {
    id: 'onyx',
    labels: ['onyx', 'onyx collection'],
    patterns: [/\bonyx\b/i],
    searchLabel: 'Onyx',
  },
  {
    id: 'performance_plus',
    labels: ['performance plus', 'performance+'],
    patterns: [/\bperformance\s*plus\b/i, /\bperformance\+/i],
    searchLabel: 'Performance Plus',
  },
  {
    id: 'performance',
    labels: ['performance series', 'performance'],
    patterns: [/\bperformance\s+series\b/i, /\bperformance\b/i],
    searchLabel: 'Performance',
  },
  {
    id: 'endurance',
    labels: ['endurance', 'endurance series'],
    patterns: [/\bendurance\b/i],
    searchLabel: 'Endurance',
  },
  {
    id: 'lifestyle',
    labels: ['lifestyle', 'lifestyle series'],
    patterns: [/\blifestyle\b/i],
    searchLabel: 'Lifestyle',
  },
  {
    id: 'aura_series',
    labels: ['aura series', 'aura', 'g3 strength'],
    patterns: [/\bg3\s+strength\b[^)]*\(\s*aura\b/i, /\baura\s+series\b/i, /\bg3\s+strength\s*\(\s*aura\b/i],
    searchLabel: 'Aura Series',
  },
  {
    id: 'ultra_series',
    labels: ['ultra series', 'ultra', 'g7 strength'],
    patterns: [/\bg7\s+strength\b[^)]*\(\s*ultra\b/i, /\bultra\s+series\b/i, /\bg7\s+strength\s*\(\s*ultra\b/i],
    searchLabel: 'Ultra Series',
  },
  {
    id: 'versa_series',
    labels: ['versa series', 'versa'],
    patterns: [/\bversa\s+series\b/i, /\bversa\b/i],
    searchLabel: 'Versa Series',
  },
  {
    id: 'magnum_series',
    labels: ['magnum series', 'magnum'],
    patterns: [/\bmagnum\s+series\b/i, /\bmagnum\s+plateloaded\b/i, /\bmagnum\b/i],
    searchLabel: 'Magnum',
  },
  {
    id: 'climbmill',
    labels: ['climbmill', 'climb mill'],
    patterns: [/\bclimb\s*mill\b/i, /\bc\d{1,2}x(?:e|i)?\b/i],
    searchLabel: 'ClimbMill',
  },
  {
    id: 'ascent_trainer',
    labels: ['ascent trainer', 'ascent'],
    patterns: [/\bascent\s+trainer\b/i, /\ba\d{1,2}x(?:e|i)?\b/i, /\bascent\b/i],
    searchLabel: 'Ascent Trainer',
  },
  {
    id: 'treadmill',
    labels: ['treadmill'],
    patterns: [/\btreadmill\b/i, /\bt\d{1,2}x(?:e|i)?\b/i],
    searchLabel: 'Treadmill',
  },
  {
    id: 'elliptical',
    labels: ['elliptical', 'cross trainer'],
    patterns: [/\belliptical\b/i, /\bcross\s+trainer\b/i, /\be\d{1,2}x(?:e|i)?\b/i],
    searchLabel: 'Elliptical',
  },
  {
    id: 'recumbent_bike',
    labels: ['recumbent bike', 'recumbent'],
    patterns: [/\brecumbent\b/i, /\br\d{1,2}x(?:e|i)?\b/i],
    searchLabel: 'Recumbent Bike',
  },
  {
    id: 'upright_bike',
    labels: ['upright bike', 'upright cycle'],
    patterns: [/\bupright\s+bike\b/i, /\bupright\s+cycle\b/i, /\bu\d{1,2}x(?:e|i)?\b/i],
    searchLabel: 'Upright Bike',
  },
  {
    id: 'hybrid_bike',
    labels: ['hybrid bike', 'hybrid cycle'],
    patterns: [/\bhybrid\s+bike\b/i, /\bhybrid\s+cycle\b/i, /\bh\d{1,2}x(?:e|i)?\b/i],
    searchLabel: 'Hybrid Bike',
  },
  {
    id: 'stepper',
    labels: ['stepper'],
    patterns: [/\bstepper\b/i, /\bs\d{1,2}x(?:e|i)?\b/i],
    searchLabel: 'Stepper',
  },
  {
    id: 'indoor_cycle',
    labels: ['indoor cycle', 'indoor bike', 'group cycle'],
    patterns: [/\bindoor\s+bike\b/i, /\bindoor\s+cycle\b/i, /\bgroup\s+cycle\b/i, /\bcx[cmp]\b/i],
    searchLabel: 'Indoor Cycle',
  },
]

const STRENGTH_FAMILY_IDS = new Set([
  'aura_series',
  'ultra_series',
  'versa_series',
  'magnum_series',
])

const MODERN_SERIES_FAMILY_IDS = new Set([
  'onyx',
  'lifestyle',
  'endurance',
  'performance',
  'performance_plus',
])

const CARDIO_FAMILY_IDS = new Set([
  'climbmill',
  'ascent_trainer',
  'treadmill',
  'elliptical',
  'recumbent_bike',
  'upright_bike',
  'hybrid_bike',
  'stepper',
  'indoor_cycle',
  ...MODERN_SERIES_FAMILY_IDS,
])

const PEOPLE_IMAGE_PATTERNS = [
  /\bpeople\b/i,
  /\bperson\b/i,
  /\bgym\s+user/i,
  /\bpersonal\s+trainer\b/i,
  /\bwith\s+trainer\b/i,
  /\bwoman\b/i,
  /\bman\b/i,
  /\bmen\b/i,
  /\bwomen\b/i,
  /\bathlete\b/i,
  /\bworking\s+out\b/i,
  /\bexercis(?:e|ing)\b/i,
  /\bin\s+use\b/i,
  /\bwith\s+user/i,
]

const CONSOLE_ONLY_PATTERNS = [
  /\bconsole\s+only\b/i,
  /\bscreen\s+only\b/i,
  /\bdisplay\s+only\b/i,
  /\bclose[\s-]?up\b/i,
  /\bcloseup\b/i,
  /\btouchscreen\b/i,
  /\bconsole\s+close/i,
  /\bmonitor\s+only\b/i,
  /\b(?:xr|xer|xir|xur)\s+console\b/i,
  /\bpremium\s+led\s+console\b/i,
  /\btouch\s+xl\s+console\b/i,
  /\bconsole\s+photo\b/i,
  /\bdisplay\s+panel\b/i,
]

const PARTIAL_MACHINE_PATTERNS = [
  /\bspare\s+part/i,
  /\breplacement\s+part/i,
  /\baccessory\s+only/i,
  /\bpartial\s+view/i,
  /\bcropped\b/i,
  /\bonly\s+console\b/i,
]

const GYM_FLOOR_PATTERNS = [
  /\bgym\s+floor\b/i,
  /\bin\s+gym\b/i,
  /\bcommercial\s+gym\b/i,
  /\bfitness\s+center\b/i,
  /\bstudio\s+photo\b/i,
]

function normalizeWhitespace(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim()
}

function normalizeKey(value) {
  return normalizeWhitespace(value).toLowerCase()
}

function tokenize(value) {
  return normalizeKey(value).split(/[^a-z0-9+]+/).filter((token) => token.length >= 2)
}

function titleCaseWords(value) {
  return normalizeWhitespace(value)
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

export function isMatrixBrand(brand) {
  const normalized = normalizeKey(brand)
  return normalized === 'matrix' || normalized === 'matrix fitness'
}

export function detectMatrixProductFamilyFromText(text) {
  const haystack = normalizeWhitespace(text)
  if (!haystack) return null

  for (const rule of MATRIX_PRODUCT_FAMILY_RULES) {
    if (rule.patterns.some((pattern) => pattern.test(haystack))) {
      return rule.id
    }
  }

  return null
}

export function detectMatrixProductFamily(product) {
  if (!isMatrixBrand(product?.brand)) return null

  const haystack = [
    product?.product_family,
    product?.model,
    product?.canonical_product_name,
    product?.equipment_type,
  ].filter(Boolean).join(' ')

  return detectMatrixProductFamilyFromText(haystack)
}

export function getMatrixProductFamilyRule(familyId) {
  return MATRIX_PRODUCT_FAMILY_RULES.find((entry) => entry.id === familyId) ?? null
}

export function getMatrixProductFamilyLabel(familyId) {
  const rule = getMatrixProductFamilyRule(familyId)
  return rule?.searchLabel ?? rule?.labels?.[0] ?? null
}

export function extractMatrixModelFamilyCode(product) {
  const haystack = [
    product?.product_family,
    product?.model,
    product?.canonical_product_name,
  ].filter(Boolean).join(' ')

  const match = haystack.match(/\b([A-Z]\d{1,2}x(?:e|i)?)\b/i)
  if (!match) return null
  return match[1].charAt(0).toUpperCase() + match[1].slice(1).toLowerCase()
}

function extractMatrixModelCodesFromText(text) {
  const matches = [...String(text ?? '').matchAll(/\b([A-Za-z]\d{1,2}x(?:e|i)?)\b/gi)]
  return matches.map((match) => match[1].charAt(0).toUpperCase() + match[1].slice(1).toLowerCase())
}

export function detectConflictingMatrixModelCode(productCode, text) {
  if (!productCode) return null

  const productPrefix = productCode.charAt(0).toUpperCase()
  const productPlatform = productCode.match(/\d{1,2}/)?.[0]
  if (!productPlatform) return null

  const codes = extractMatrixModelCodesFromText(text)
    .filter((code) => code.charAt(0).toUpperCase() === productPrefix)

  for (const code of codes) {
    const platform = code.match(/\d{1,2}/)?.[0]
    if (platform && platform !== productPlatform) {
      return code
    }
  }

  return null
}

export function normalizeMatrixFamilyBaseId(familyId, product = null) {
  if (!familyId) return null

  if (STRENGTH_FAMILY_IDS.has(familyId)) return familyId

  const modelCode = extractMatrixModelFamilyCode(product)
  if (modelCode && CARDIO_FAMILY_IDS.has(familyId)) {
    const platform = modelCode.replace(/[^0-9]/g, '')
    return `${familyId}_${platform || 'unknown'}`
  }

  return familyId
}

export function detectConflictingMatrixProductFamily(productFamilyId, text, product = null) {
  if (!productFamilyId) return null

  const detected = detectMatrixProductFamilyFromText(text)
  if (!detected || detected === productFamilyId) return null

  if (STRENGTH_FAMILY_IDS.has(productFamilyId) && STRENGTH_FAMILY_IDS.has(detected)) {
    return detected
  }

  if (CARDIO_FAMILY_IDS.has(productFamilyId) && CARDIO_FAMILY_IDS.has(detected)) {
    if (productFamilyId !== detected) return detected

    const productBase = normalizeMatrixFamilyBaseId(productFamilyId, product)
    const detectedBase = normalizeMatrixFamilyBaseId(detected, { canonical_product_name: text })
    if (productBase && detectedBase && productBase !== detectedBase) return detected
    return null
  }

  if (productFamilyId !== detected) return detected
  return null
}

export function isMatrixPreferredImageDomain(domain) {
  const normalized = normalizeHostname(domain)
  if (!normalized) return false
  return MATRIX_PREFERRED_IMAGE_DOMAINS.some((entry) => (
    normalized === entry || normalized.endsWith(`.${entry}`)
  ))
}

export function scoreMatrixPreferredDomain(domain) {
  if (!isMatrixPreferredImageDomain(domain)) return 0
  if (normalizeHostname(domain)?.includes('matrixfitness')) return 30
  if (normalizeHostname(domain)?.includes('johnson')) return 24
  return 18
}

function buildMatrixEquipmentLabel(product, familyId) {
  const equipmentType = normalizeWhitespace(product?.equipment_type)
  const model = normalizeWhitespace(product?.model)

  if (equipmentType && equipmentType.toUpperCase() !== 'OTHER') {
    return equipmentType
  }

  if (familyId === 'climbmill') return 'ClimbMill'
  if (familyId === 'ascent_trainer') return 'Ascent Trainer'
  if (model && model.toUpperCase() !== 'OTHER') return model
  return getMatrixProductFamilyLabel(familyId)
}

function buildPrimaryMatrixSearchQuery(product) {
  const brand = 'Matrix'
  const identity = extractProductImageIdentity(product, { kind: 'product' })
  const required = requiredIdentityQueryTokens(product)
  const familyId = detectMatrixProductFamily(product)
  const familyRule = getMatrixProductFamilyRule(familyId)
  const familyLabel = familyRule?.searchLabel ?? getMatrixProductFamilyLabel(familyId)
  const model = normalizeWhitespace(product?.model)
  const modelCode = extractMatrixModelFamilyCode(product)
  const canonical = normalizeWhitespace(product?.canonical_product_name)
  const equipmentLabel = buildMatrixEquipmentLabel(product, familyId)

  // Modern series / exact identity: never strip Onyx / Performance Plus / digit codes.
  if (required.length) {
    if (canonical && required.every((token) => normalizeKey(canonical).includes(normalizeKey(token)))) {
      return canonical.replace(/^matrix(?:\s+fitness)?\s+/i, 'Matrix ')
    }
    const parts = [brand, ...required]
    if (equipmentLabel && !required.some((token) => normalizeKey(token) === normalizeKey(equipmentLabel))) {
      parts.push(equipmentLabel)
    }
    return normalizeWhitespace(parts.join(' '))
  }

  if (canonical && familyRule?.patterns.some((pattern) => pattern.test(canonical))) {
    if (STRENGTH_FAMILY_IDS.has(familyId)) {
      const machine = model && model.toUpperCase() !== 'OTHER' ? model : equipmentLabel
      return normalizeWhitespace(`${brand} ${familyLabel} ${machine}`)
    }

    if (familyId === 'climbmill' && modelCode) {
      return normalizeWhitespace(`${brand} ${familyLabel} ${modelCode}`)
    }

    if (CARDIO_FAMILY_IDS.has(familyId) && modelCode) {
      return normalizeWhitespace(`${brand} ${modelCode} ${equipmentLabel}`)
    }
  }

  const parts = [brand]
  if (STRENGTH_FAMILY_IDS.has(familyId) && familyLabel) {
    parts.push(familyLabel)
    if (model && model.toUpperCase() !== 'OTHER') parts.push(model)
  } else if (familyId === 'climbmill') {
    parts.push('ClimbMill')
    if (modelCode) parts.push(modelCode)
  } else if (MODERN_SERIES_FAMILY_IDS.has(familyId)) {
    parts.push(familyLabel)
    if (equipmentLabel) parts.push(equipmentLabel)
  } else if (CARDIO_FAMILY_IDS.has(familyId)) {
    if (modelCode) parts.push(modelCode)
    if (equipmentLabel) parts.push(equipmentLabel)
  } else if (familyLabel) {
    parts.push(familyLabel)
    if (model && model.toUpperCase() !== 'OTHER') parts.push(model)
  } else if (model && model.toUpperCase() !== 'OTHER') {
    parts.push(model)
  }

  if (parts.length > 1) return parts.join(' ')

  if (canonical) {
    return canonical.replace(/^matrix(?:\s+fitness)?\s+/i, 'Matrix ')
  }

  return brand
}

function buildFallbackMatrixSearchQuery(product) {
  const canonical = normalizeWhitespace(product?.canonical_product_name)
  if (canonical) {
    return canonical.replace(/^matrix(?:\s+fitness)?\s+/i, 'Matrix ')
  }

  return ['Matrix', product?.product_family, product?.model, product?.equipment_type]
    .filter(Boolean)
    .join(' ')
}

function buildBroadMatrixSearchQuery(product) {
  const required = requiredIdentityQueryTokens(product)
  const model = normalizeWhitespace(product?.model)
  const equipmentType = normalizeWhitespace(product?.equipment_type)
  if (required.length) {
    return normalizeWhitespace(['Matrix', ...required, equipmentType].filter(Boolean).join(' '))
  }
  if (model && equipmentType) {
    return `Matrix ${model}`
  }
  if (model) return `Matrix ${model}`
  return null
}

function buildManufacturerBiasedMatrixQuery(product) {
  const required = requiredIdentityQueryTokens(product)
  const needle = required[0]
    || normalizeWhitespace(product?.model)
    || normalizeWhitespace(product?.canonical_product_name)
  if (!needle) return null
  return `site:matrixfitness.com "${needle}"`
}

export function buildMatrixImageSearchQueries(product) {
  const primary = buildPrimaryMatrixSearchQuery(product)
  const fallback = buildFallbackMatrixSearchQuery(product)
  const broad = buildBroadMatrixSearchQuery(product)
  const siteBiased = buildManufacturerBiasedMatrixQuery(product)

  const queries = [primary]
  if (fallback && normalizeKey(fallback) !== normalizeKey(primary)) {
    queries.push(fallback)
  }
  if (broad && normalizeKey(broad) !== normalizeKey(primary) && normalizeKey(broad) !== normalizeKey(fallback)) {
    queries.push(broad)
  }
  if (siteBiased && !queries.some((query) => normalizeKey(query) === normalizeKey(siteBiased))) {
    queries.push(siteBiased)
  }

  return filterQueriesToRetainIdentity(
    [...new Set(queries.map((query) => normalizeWhitespace(query)).filter(Boolean))],
    product,
  )
}

export function buildMatrixImageSearchQuery(product) {
  return buildMatrixImageSearchQueries(product)[0] ?? 'Matrix'
}

export function productMatchesMatrixLineFilter(product, lineFilter) {
  if (!lineFilter) return true

  const needle = normalizeKey(lineFilter)
  const text = normalizeKey([
    product?.canonical_product_name,
    product?.product_family,
    product?.model,
    product?.equipment_type,
    getMatrixProductFamilyLabel(detectMatrixProductFamily(product)),
  ].filter(Boolean).join(' '))
  const familyId = detectMatrixProductFamily(product)

  if (needle === 'ultra series' || needle === 'ultra') {
    return familyId === 'ultra_series' || /g7\s*strength.*ultra/.test(text)
  }
  if (needle === 'aura series' || needle === 'aura') {
    return familyId === 'aura_series' || /g3\s*strength.*aura/.test(text)
  }
  if (needle === 'versa series' || needle === 'versa') {
    return familyId === 'versa_series' || /\bversa\b/.test(text)
  }
  if (needle === 'magnum series' || needle === 'magnum') {
    return familyId === 'magnum_series' || /\bmagnum\b/.test(text)
  }
  if (needle === '7xi' || needle === '7xe' || needle === '7x') {
    return /\b[tectraucshrua]7x(?:e|i)?\b/.test(text) && !/g7\s*strength/.test(text)
  }
  if (needle === '5x' || needle === '5xe') {
    return /\b[tectraucshrua]5x(?:e|i)?\b/.test(text)
  }
  if (needle === '3x' || needle === '3xe') {
    return /\b[tectraucshrua]3x(?:e|i)?\b/.test(text)
  }

  return text.includes(needle)
}

export function assessMatrixImageCandidateContent(candidate) {
  const haystack = [
    candidate?.title,
    candidate?.source,
    candidate?.sourceUrl,
    candidate?.imageUrl,
  ].filter(Boolean).join(' ')

  const warnings = []
  const penalties = []

  if (PEOPLE_IMAGE_PATTERNS.some((pattern) => pattern.test(haystack))) {
    warnings.push('contains_people')
    penalties.push(45)
  }
  if (CONSOLE_ONLY_PATTERNS.some((pattern) => pattern.test(haystack))) {
    warnings.push('console_only_or_close_up')
    penalties.push(50)
  }
  if (PARTIAL_MACHINE_PATTERNS.some((pattern) => pattern.test(haystack))) {
    warnings.push('partial_machine_or_parts')
    penalties.push(35)
  }
  if (GYM_FLOOR_PATTERNS.some((pattern) => pattern.test(haystack))) {
    warnings.push('gym_floor_context')
    penalties.push(18)
  }

  const width = Number(candidate?.width)
  const height = Number(candidate?.height)
  if (Number.isFinite(width) && Number.isFinite(height)) {
    if (width < 320 || height < 240) {
      warnings.push('low_resolution')
      penalties.push(20)
    }
    const aspect = width / height
    if (aspect > 2.4 || aspect < 0.45) {
      warnings.push('unusual_aspect_ratio')
      penalties.push(12)
    }
  }

  return {
    warnings,
    penalty: penalties.reduce((sum, value) => sum + value, 0),
    reject: warnings.includes('console_only_or_close_up') && warnings.includes('contains_people'),
  }
}

function countTokenMatches(tokens, haystack) {
  let matched = 0
  for (const token of tokens) {
    if (haystack.includes(token)) matched += 1
  }
  return matched
}

function buildMatrixProductTokens(product, familyId) {
  const modelCode = extractMatrixModelFamilyCode(product)
  const tokens = [
    ...tokenize(product?.canonical_product_name),
    ...tokenize(product?.model),
    ...tokenize(product?.product_family),
    ...tokenize(product?.equipment_type),
    ...tokenize(getMatrixProductFamilyLabel(familyId)),
    ...tokenize(modelCode),
  ].filter((token) => token !== 'matrix' && token !== 'fitness' && !MATRIX_CONSOLE_VARIANT_TOKENS.has(token))

  return [...new Set(tokens)]
}

export function scoreMatrixImageCandidate(candidate, product, {
  baseRejection = null,
} = {}) {
  if (baseRejection?.reject) {
    return {
      score: 0,
      rejection: baseRejection,
      domain: getImageSourceDomainFromCandidate(candidate),
      warnings: [],
      reasons: [],
      productFamily: detectMatrixProductFamily(product),
      confidenceBand: 'rejected',
      identity: null,
      scoreBreakdown: null,
    }
  }

  const identityGate = evaluateImageCandidateIdentity(product, candidate)
  if (!identityGate.eligible) {
    return {
      score: 0,
      rejection: {
        reject: true,
        reason: identityGate.reason,
        conflicts: identityGate.conflicts,
      },
      domain: getImageSourceDomainFromCandidate(candidate),
      warnings: [`conflicting_product_identity:${(identityGate.conflicts || []).map((entry) => entry.token).join(',')}`],
      reasons: [],
      productFamily: detectMatrixProductFamily(product),
      confidenceBand: 'rejected',
      identity: identityGate.identityResult,
      scoreBreakdown: identityGate.breakdown,
    }
  }

  const productFamily = detectMatrixProductFamily(product)
  const haystack = [
    candidate?.title,
    candidate?.source,
    candidate?.sourceUrl,
    candidate?.imageUrl,
  ].filter(Boolean).join(' ').toLowerCase()

  const productTokens = new Set(buildMatrixProductTokens(product, productFamily))
  const warnings = []
  const reasons = []
  let score = 24

  const domain = getImageSourceDomainFromCandidate(candidate)
  const domainScore = scoreImageSourceDomain(domain)
  if (domainScore < 0) {
    return {
      score: 0,
      rejection: { reject: true, reason: 'blocked_dealer_source_domain' },
      domain,
      warnings,
      reasons,
      productFamily,
      confidenceBand: 'rejected',
      identity: identityGate.identityResult,
      scoreBreakdown: identityGate.breakdown,
    }
  }

  score += domainScore
  score += scoreMatrixPreferredDomain(domain)

  const matchedTokens = countTokenMatches(productTokens, haystack)
  if (matchedTokens > 0) {
    score += Math.min(30, matchedTokens * 8)
    reasons.push(`${matchedTokens} product token(s) matched`)
  } else {
    score -= 20
    warnings.push('weak_model_match')
  }

  if (productFamily) {
    const familyRule = getMatrixProductFamilyRule(productFamily)
    const familyMatched = familyRule?.patterns.some((pattern) => pattern.test(haystack))
    if (familyMatched) {
      score += 24
      reasons.push(`product family matched (${getMatrixProductFamilyLabel(productFamily)})`)
    } else if (tokenize(getMatrixProductFamilyLabel(productFamily)).some((token) => haystack.includes(token))) {
      score += 16
      reasons.push(`partial product family matched (${getMatrixProductFamilyLabel(productFamily)})`)
    } else {
      score -= 28
      warnings.push('missing_product_family')
    }

    const conflictingFamily = detectConflictingMatrixProductFamily(productFamily, haystack, product)
    if (conflictingFamily) {
      score -= 55
      warnings.push(`conflicting_product_family:${conflictingFamily}`)
    }
  } else {
    score -= 18
    warnings.push('ambiguous_product_family')
  }

  const modelCode = extractMatrixModelFamilyCode(product)
  if (modelCode) {
    const conflictingModelCode = detectConflictingMatrixModelCode(modelCode, haystack)
    if (conflictingModelCode) {
      score -= 52
      warnings.push(`conflicting_model_code:${conflictingModelCode}`)
    } else if (haystack.includes(modelCode.toLowerCase())) {
      score += 18
      reasons.push(`model code matched (${modelCode})`)
    } else if (haystack.includes(modelCode.replace(/e$/i, '').toLowerCase())) {
      score += 12
      reasons.push(`partial model code matched (${modelCode})`)
    } else {
      score -= 16
      warnings.push('missing_model_code')
    }
  }

  const content = assessMatrixImageCandidateContent(candidate)
  warnings.push(...content.warnings)
  score -= content.penalty
  if (content.reject) {
    return {
      score: 0,
      rejection: { reject: true, reason: 'matrix_content_rejected' },
      domain,
      warnings,
      reasons,
      productFamily,
      confidenceBand: 'rejected',
      identity: identityGate.identityResult,
      scoreBreakdown: identityGate.breakdown,
    }
  }

  const width = Number(candidate?.width)
  const height = Number(candidate?.height)
  let qualityScore = 0
  if (Number.isFinite(width) && Number.isFinite(height) && width >= 480 && height >= 360) {
    qualityScore = 10
    score += 10
    reasons.push('large_image_dimensions')
  }

  if (normalizeKey(haystack).includes(normalizeKey(product?.canonical_product_name))) {
    score += 18
    reasons.push('canonical_name_match')
  }

  const breakdown = buildIdentityScoreBreakdown(identityGate.identityResult, {
    domainScore,
    qualityScore,
  })
  const normalizedScore = applyIdentityConfidenceCap(
    Math.max(0, Math.min(100, score)),
    identityGate.identityResult,
  )

  let confidenceBand = 'needs_review'
  if (
    identityGate.identityResult.evidenceLevel === 'exact'
    && normalizedScore >= 85
    && warnings.length === 0
    && productFamily
  ) {
    confidenceBand = 'high_confidence'
  } else if (
    identityGate.identityResult.evidenceLevel !== 'brand_type_only'
    && normalizedScore >= 68
    && !warnings.some((warning) => warning.startsWith('conflicting_product_family'))
    && !warnings.some((warning) => warning.startsWith('conflicting_model_code'))
    && !warnings.includes('missing_product_family')
  ) {
    confidenceBand = 'suggested'
  } else if (identityGate.identityResult.evidenceLevel === 'brand_type_only') {
    confidenceBand = 'needs_review'
  }

  return {
    score: normalizedScore,
    rejection: null,
    domain,
    warnings,
    reasons,
    productFamily,
    confidenceBand,
    identity: identityGate.identityResult,
    scoreBreakdown: {
      ...breakdown,
      legacyScoreBeforeCap: Math.max(0, Math.min(100, score)),
    },
  }
}

export function rankMatrixImageCandidates(candidates = [], product) {
  return candidates
    .map((candidate) => {
      const result = scoreMatrixImageCandidate(candidate, product)
      return { candidate, ...result }
    })
    .filter((entry) => entry.score > 0 && !entry.rejection?.reject)
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score
      return (left.warnings?.length ?? 0) - (right.warnings?.length ?? 0)
    })
}

export function resolveMatrixImageImportMetadata({
  imageUrl,
  storagePath,
  sourceUrl,
  scoreResult,
}) {
  const domain = extractDomainFromUrl(sourceUrl)
  const confidence = scoreResult?.score ?? 0
  const warnings = scoreResult?.warnings ?? []
  const band = scoreResult?.confidenceBand ?? 'needs_review'

  const needsReview = band === 'needs_review'
    || warnings.some((warning) => warning.startsWith('conflicting_product_family'))
    || warnings.some((warning) => warning.startsWith('conflicting_model_code'))
    || warnings.includes('missing_product_family')
    || warnings.includes('missing_model_code')
    || warnings.includes('ambiguous_product_family')
    || warnings.includes('contains_people')
    || warnings.includes('console_only_or_close_up')

  const reviewReason = needsReview
    ? [
      MATRIX_IMAGE_NEEDS_REVIEW_REASON,
      ...warnings,
      ...(scoreResult?.reasons ?? []),
    ].join('; ')
    : null

  return {
    image_url: imageUrl,
    image_storage_path: storagePath,
    image_source_url: sourceUrl,
    image_source_domain: domain,
    image_confidence: confidence,
    image_status: 'suggested',
    image_failure_reason: reviewReason,
    image_updated_at: new Date().toISOString(),
  }
}
