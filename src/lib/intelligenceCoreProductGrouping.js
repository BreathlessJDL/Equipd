/**
 * Core product / variant grouping for Equipment Intelligence.
 * Groups console variants under one base product when brand, equipment type, product family,
 * and model identity match. Does not merge rows that only share a final model word.
 */

import {
  buildTechnogymCanonicalProductName,
  isTechnogymBrand,
  stripTechnogymNonPricingVariants,
} from './technogymCoreProductGrouping.js'

export const CORE_PRODUCT_GROUP_STATUS = {
  PENDING: 'pending',
  AUTO: 'auto',
  APPROVED: 'approved',
  EXCLUDED: 'excluded',
  NOT_DUPLICATE: 'not_duplicate',
}

export const GROUPING_CONFIDENCE = {
  HIGH: 92,
  MEDIUM: 62,
  LOW: 45,
}

/** Console-only phrases stripped from model suffixes (longest first). */
export const CONSOLE_VARIANT_PHRASES = [
  'discover se3 hd',
  'discover se3hd',
  'discover se4',
  'discover se3',
  'discover se',
  'discover si',
  'discover st',
  '15 inch touchscreen',
  '10 inch touchscreen',
  'embedded touchscreen',
  'premium led',
  'e3 view',
  'track connect',
  'touch xl',
  'touchscreen',
  'live 22',
  'live 19',
  'live 16',
  'live 15',
  'live 12',
  'live 10',
  'se3hd',
  'achieve',
  'engage',
  'inspire',
  'unity',
  'connect',
  'console',
  'classic',
  'renew',
  'touch',
  'led',
  'lcd',
  'tv',
  'go',
  'sl',
  'st',
  'se',
  'se3',
  'se4',
  'si',
  'xr',
  'xer',
  'xir',
  'xur',
  'p82',
  'p62',
  'p31',
  '50l',
  '70t',
]

/**
 * Series patterns: extract optional console variant while preserving product family.
 * Order matters — most specific first.
 */
export const SERIES_FAMILY_CONSOLE_PATTERNS = [
  { pattern: /^discover\s+se3\s*hd$/i, family: 'Discover', variant: 'SE3HD' },
  { pattern: /^discover\s+se3$/i, family: 'Discover', variant: 'SE3' },
  { pattern: /^discover\s+se4$/i, family: 'Discover', variant: 'SE4' },
  { pattern: /^discover\s+se$/i, family: 'Discover', variant: 'SE' },
  { pattern: /^discover\s+si$/i, family: 'Discover', variant: 'SI' },
  { pattern: /^discover\s+st(?:\s+console)?$/i, family: 'Discover', variant: 'ST' },
  { pattern: /^discover$/i, family: 'Discover', variant: null },
  { pattern: /^elevation\s*-\s*achieve$/i, family: 'Elevation', variant: 'Achieve' },
  { pattern: /^elevation\s*-\s*engage$/i, family: 'Elevation', variant: 'Engage' },
  { pattern: /^elevation\s*-\s*inspire$/i, family: 'Elevation', variant: 'Inspire' },
  { pattern: /^unity(?:\s+renew)?$/i, family: null, variant: 'Unity' },
  { pattern: /^connect$/i, family: null, variant: 'Connect' },
  { pattern: /^live\s+22$/i, family: null, variant: 'Live 22' },
  { pattern: /^live\s+19$/i, family: null, variant: 'Live 19' },
  { pattern: /^live\s+16$/i, family: null, variant: 'Live 16' },
  { pattern: /^live\s+15$/i, family: null, variant: 'Live 15' },
  { pattern: /^live\s+12$/i, family: null, variant: 'Live 12' },
  { pattern: /^live\s+10$/i, family: null, variant: 'Live 10' },
  { pattern: /^(.+?)\s+se3\s*hd$/i, familyFromGroup: 1, variant: 'SE3HD' },
  { pattern: /^(.+?)\s+se3$/i, familyFromGroup: 1, variant: 'SE3' },
  { pattern: /^(.+?)\s+se4$/i, familyFromGroup: 1, variant: 'SE4' },
  { pattern: /^(.+?)\s+se$/i, familyFromGroup: 1, variant: 'SE' },
  { pattern: /^(.+?)\s+si$/i, familyFromGroup: 1, variant: 'SI' },
  { pattern: /^(.+?)\s+st(?:\s+console)?$/i, familyFromGroup: 1, variant: 'ST' },
  { pattern: /^(.+?)\s+unity(?:\s+renew)?$/i, familyFromGroup: 1, variant: 'Unity' },
  { pattern: /^(.+?)\s+track\s+connect$/i, familyFromGroup: 1, variant: 'Track Connect' },
  { pattern: /^(.+?)\s+touch\s+xl$/i, familyFromGroup: 1, variant: 'Touch XL' },
  { pattern: /^(.+?)\s+touchscreen$/i, familyFromGroup: 1, variant: 'Touchscreen' },
  { pattern: /^(.+?)\s+premium\s+led$/i, familyFromGroup: 1, variant: 'Premium LED' },
  { pattern: /^(.+?)\s+live\s+22$/i, familyFromGroup: 1, variant: 'Live 22' },
  { pattern: /^(.+?)\s+live\s+19$/i, familyFromGroup: 1, variant: 'Live 19' },
  { pattern: /^(.+?)\s+live\s+16$/i, familyFromGroup: 1, variant: 'Live 16' },
  { pattern: /^(.+?)\s+live\s+15$/i, familyFromGroup: 1, variant: 'Live 15' },
  { pattern: /^(.+?)\s+live\s+12$/i, familyFromGroup: 1, variant: 'Live 12' },
  { pattern: /^(.+?)\s+live\s+10$/i, familyFromGroup: 1, variant: 'Live 10' },
  { pattern: /^(.+?)\s+led$/i, familyFromGroup: 1, variant: 'LED' },
  { pattern: /^(.+?)\s+lcd$/i, familyFromGroup: 1, variant: 'LCD' },
  { pattern: /^(.+?)\s+tv$/i, familyFromGroup: 1, variant: 'TV' },
  { pattern: /^(.+?)\s+classic$/i, familyFromGroup: 1, variant: 'Classic' },
  { pattern: /^(.+?)\s+connect$/i, familyFromGroup: 1, variant: 'Connect' },
  { pattern: /^(.+?)\s+renew$/i, familyFromGroup: 1, variant: 'Renew' },
  { pattern: /^(.+?)\s+go$/i, familyFromGroup: 1, variant: 'GO' },
  { pattern: /^(.+?)\s+sl$/i, familyFromGroup: 1, variant: 'SL' },
  { pattern: /^(.+?)\s+console$/i, familyFromGroup: 1, variant: 'Console' },
]

/** Model tokens that must not be stripped when they are the sole identity. */
export const PROTECTED_SOLE_MODEL_IDENTITIES = new Set([
  'integrity',
  'discover',
  'classic',
  'powermill',
  'synchro',
  'clubseries',
])

/** Known base model codes — stripping must never remove these. */
export const KNOWN_BASE_MODEL_CODES = [
  '95ti', '95t', '95xi', '97ti', '97te',
  'ic7', 'ic6', 'ic5',
  'model d', 'model e', 'model c',
  'powermill', 'synchro', 'arc', 'g7', 'g5',
]

function normalizeWhitespace(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim()
}

function stripTrailingEquipmentType(model, equipmentType, { brand = null, productFamily = null } = {}) {
  const normalizedModel = normalizeWhitespace(model)
  const normalizedType = normalizeWhitespace(equipmentType)
  if (!normalizedModel) return normalizedModel

  if (isHammerStrengthBrand(brand)) {
    return normalizedModel
  }

  // Matrix modern series models are "{Series} {EquipmentType}" — keep full model for identity.
  if (isMatrixFitnessBrand(brand) && isMatrixModernSeries(productFamily)) {
    return normalizedModel
  }

  if (normalizedType) {
    const suffix = new RegExp(`\\s+${escapeRegExp(normalizedType)}$`, 'i')
    if (suffix.test(normalizedModel)) {
      const stripped = normalizeWhitespace(normalizedModel.replace(suffix, ''))
      const remainingTokens = stripped.split(/\s+/).filter(Boolean)
      if (remainingTokens.length === 1 && /iso-?lateral|linear|seated|ground base/i.test(stripped)) {
        return normalizedModel
      }
      return stripped
    }
  }

  return normalizedModel
}

export function stripModelYearRange(model, { lifeFitnessLifecycleStripping = false } = {}) {
  if (lifeFitnessLifecycleStripping) {
    return stripBracketedYearMarkers(model).stripped
  }
  return normalizeWhitespace(
    String(model ?? '').replace(/\(\s*\d{4}\s*[-–]\d{4}\s*\)/gi, ''),
  )
}

/** Bracketed lifecycle/date markers — not product identity. */
export const BRACKETED_YEAR_MARKER_PATTERN = /\(\s*\d{2,4}(?:\s*>\s*|\s*[-–]\s*\d{2,4}\s*)?\s*\)/gi

export function isLifeFitnessBrand(brand) {
  return normalizeTokenKey(brand) === 'lifefitness'
}

export function isHammerStrengthBrand(brand) {
  return normalizeTokenKey(brand) === 'hammerstrength'
}

export function isConcept2Brand(brand) {
  return normalizeTokenKey(brand) === 'concept2'
}

export function isMatrixFitnessBrand(brand) {
  const key = normalizeTokenKey(brand)
  return key === 'matrixfitness' || key === 'matrix'
}

export function isMatrixModernSeries(seriesOrFamily) {
  const value = normalizeWhitespace(seriesOrFamily)
  if (!value) return false
  return /^(lifestyle|endurance|performance(?:\s+plus)?|onyx)(\s+(series|collection))?$/i.test(value)
    || /\b(lifestyle|endurance|performance(?:\s+plus)?|onyx)\b/i.test(value)
}

/**
 * Modern Matrix series products are named "{SeriesToken} {Equipment}" (e.g. Lifestyle Treadmill).
 * Stripping the equipment type leaves only the series token and produces bad public names.
 * Prefer: Matrix {Family} {Type} — e.g. Matrix Lifestyle Series Treadmill.
 */
export function formatMatrixFamilyLabel(seriesOrFamily) {
  const value = normalizeWhitespace(seriesOrFamily)
  if (!value) return null
  if (/^onyx(?:\s+collection)?$/i.test(value)) return 'Onyx'
  if (/^performance\s+plus(?:\s+series)?$/i.test(value)) return 'Performance Plus'
  return value
}

export function extractMatrixTypeLabelFromModel(model, familyLabel) {
  const normalizedModel = normalizeWhitespace(model)
  if (!normalizedModel) return null

  const family = normalizeWhitespace(familyLabel)
  if (family) {
    const familyTokens = family
      .replace(/\b(series|collection)\b/gi, ' ')
      .split(/\s+/)
      .filter(Boolean)
    let remainder = normalizedModel
    for (const token of familyTokens) {
      const prefix = new RegExp(`^${escapeRegExp(token)}\\s+`, 'i')
      remainder = normalizeWhitespace(remainder.replace(prefix, ''))
    }
    if (remainder && normalizeTokenKey(remainder) !== normalizeTokenKey(normalizedModel)) {
      return remainder
    }
  }

  return normalizedModel
}

export function buildMatrixCanonicalProductIdentity({
  series = null,
  model = null,
  equipmentType = null,
  productFamily = null,
} = {}) {
  const familyLabel = formatMatrixFamilyLabel(series || productFamily)
  const typeLabel = extractMatrixTypeLabelFromModel(model, familyLabel)
    || normalizeWhitespace(equipmentType)
    || normalizeWhitespace(model)
    || null
  // Keep the full catalogue model (e.g. "Lifestyle Treadmill") so safe-approval
  // does not treat equipment-type-only models as weak identity.
  const coreModel = normalizeWhitespace(model) || typeLabel

  return {
    product_family: normalizeWhitespace(series || productFamily) || familyLabel,
    core_model: coreModel,
    core_product_name: ['Matrix', familyLabel, typeLabel].filter(Boolean).join(' ') || null,
  }
}

export function extractBracketedYearMarkers(text) {
  const input = String(text ?? '')
  const matches = input.match(new RegExp(BRACKETED_YEAR_MARKER_PATTERN.source, 'gi'))
  if (!matches?.length) return []
  return [...new Set(matches.map((match) => normalizeWhitespace(match)))]
}

export function stripBracketedYearMarkers(text) {
  const lifecycleNotes = extractBracketedYearMarkers(text)
  const stripped = normalizeWhitespace(
    String(text ?? '').replace(new RegExp(BRACKETED_YEAR_MARKER_PATTERN.source, 'gi'), ''),
  )
  return {
    stripped,
    lifecycleNote: lifecycleNotes[0] ?? null,
    lifecycleNotes,
  }
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function normalizeTokenKey(value) {
  return normalizeWhitespace(value).toLowerCase().replace(/[^a-z0-9]/g, '')
}

function normalizeFamilyLabel(value) {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null
  return normalized
    .split(/\s+/)
    .map((part) => {
      if (part.toLowerCase() === 'series') return 'Series'
      return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()
    })
    .join(' ')
}

function isProtectedSoleIdentity(modelText) {
  const key = normalizeTokenKey(modelText)
  if (!key) return true
  if (PROTECTED_SOLE_MODEL_IDENTITIES.has(key)) return true
  return KNOWN_BASE_MODEL_CODES.some((code) => key === code.replace(/\s+/g, ''))
}

function stripGenerationFromSeries(series, { lifeFitnessLifecycleStripping = false } = {}) {
  if (!series) return null
  if (lifeFitnessLifecycleStripping) {
    return stripBracketedYearMarkers(series).stripped || null
  }
  return normalizeWhitespace(
    String(series).replace(/\(\s*\d{4}[^)]*\)/g, ''),
  ) || null
}

function formatVariantLabel(raw) {
  const parts = normalizeWhitespace(raw).split(/\s+/).filter(Boolean)
  return parts.map((part) => {
    const upper = part.toUpperCase()
    if (['se', 'st', 'sl', 'go', 'se3', 'se3hd', 'se4', 'si', 'led', 'lcd', 'tv', 'xr', 'xer', 'xir', 'xur'].includes(part.toLowerCase())) {
      return upper
    }
    if (/^p\d{2}$/i.test(part)) return part.toUpperCase()
    if (/^\d{2}[lt]$/i.test(part)) return part.toUpperCase()
    if (part.toLowerCase() === 'discover') return 'Discover'
    return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()
  }).join(' ')
}

/**
 * Split a catalogue series into product family + optional console variant.
 * Family terms (Integrity Series, Discover line, Excite, etc.) stay in the grouping key.
 */
export function extractProductFamilyFromSeries(series, { brand = null } = {}) {
  const lifeFitnessLifecycleStripping = isLifeFitnessBrand(brand)
  const normalized = stripGenerationFromSeries(series, { lifeFitnessLifecycleStripping })
  if (!normalized) {
    return { productFamily: null, variantType: null, variantName: null }
  }

  for (const entry of SERIES_FAMILY_CONSOLE_PATTERNS) {
    const match = normalized.match(entry.pattern)
    if (!match) continue

    const productFamily = entry.family
      ? normalizeFamilyLabel(entry.family)
      : normalizeFamilyLabel(match[entry.familyFromGroup] ?? '')

    return {
      productFamily: productFamily || null,
      variantType: entry.variant ? 'console' : null,
      variantName: entry.variant ?? null,
    }
  }

  return {
    productFamily: normalizeFamilyLabel(normalized),
    variantType: null,
    variantName: null,
  }
}

/** @deprecated Use extractProductFamilyFromSeries */
export function isConsoleSeriesName(series) {
  const { variantName } = extractProductFamilyFromSeries(series)
  return Boolean(variantName)
}

/** @deprecated Use extractProductFamilyFromSeries */
export function extractVariantFromSeries(series) {
  const parsed = extractProductFamilyFromSeries(series)
  return {
    variantType: parsed.variantType,
    variantName: parsed.variantName,
    coreSeries: parsed.productFamily,
  }
}

/**
 * Strip console-only suffixes from a model string.
 * Never removes tokens that define the model identity.
 */
export function stripConsoleVariantFromModel(modelText, {
  productFamily = null,
  equipmentType = null,
  brand = null,
} = {}) {
  let model = stripModelYearRange(modelText)
  const equipmentTypeStripped = stripTrailingEquipmentType(model, equipmentType, {
    brand,
    productFamily,
  })
  if (equipmentTypeStripped) {
    model = equipmentTypeStripped
  }

  const detectedParts = []
  let variantType = null
  let changed = true

  while (changed && model) {
    changed = false
    for (const phrase of CONSOLE_VARIANT_PHRASES) {
      if (phrase === 'integrity' && /integrity/i.test(productFamily ?? '')) {
        continue
      }

      const trailing = new RegExp(
        `(?:^|\\s)${escapeRegExp(phrase)}(?:\\s+console)?$`,
        'i',
      )
      if (!trailing.test(model)) continue

      const stripped = normalizeWhitespace(model.replace(trailing, ''))
      if (!stripped) continue

      const modelTokens = model.split(/\s+/).filter(Boolean)
      if (modelTokens.length === 1 && isProtectedSoleIdentity(model)) continue

      if (normalizeTokenKey(stripped) === normalizeTokenKey(model)) continue

      model = stripped
      detectedParts.unshift(phrase)
      variantType = 'console'
      changed = true
      break
    }
  }

  const variantName = detectedParts.length > 0
    ? formatVariantLabel(detectedParts.join(' '))
    : null

  return {
    coreModel: model || stripModelYearRange(modelText),
    variantType,
    variantName,
    variantSource: variantName ? 'model' : null,
  }
}

export function slugifyCoreProductKey(...parts) {
  return parts
    .map((part) => normalizeWhitespace(part))
    .filter(Boolean)
    .join('-')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function resolveGroupingConfidence({
  variantName,
  variantSource,
  productFamily,
  rawModel,
  coreModel,
}) {
  if (variantName && (variantSource === 'model' || variantSource === 'series')) {
    return GROUPING_CONFIDENCE.HIGH
  }

  if (!variantName && normalizeTokenKey(rawModel) === normalizeTokenKey(coreModel)) {
    return GROUPING_CONFIDENCE.HIGH
  }

  if (rawModel && normalizeTokenKey(rawModel) !== normalizeTokenKey(coreModel)) {
    return GROUPING_CONFIDENCE.MEDIUM
  }

  if (productFamily) {
    return GROUPING_CONFIDENCE.MEDIUM
  }

  return GROUPING_CONFIDENCE.MEDIUM
}

/**
 * Derive core product fields from catalogue row data.
 */
export function deriveCoreProductFields(equipment, { technogymGroupingEnabled = true } = {}) {
  const brand = normalizeWhitespace(equipment?.brand ?? '')
  const lifeFitnessLifecycleStripping = isLifeFitnessBrand(brand)
  const equipmentType = normalizeWhitespace(equipment?.equipment_type ?? '') || null

  const seriesParsed = lifeFitnessLifecycleStripping
    ? stripBracketedYearMarkers(equipment?.series ?? '')
    : null
  const modelParsed = lifeFitnessLifecycleStripping
    ? stripBracketedYearMarkers(equipment?.model ?? '')
    : null

  const rawSeries = lifeFitnessLifecycleStripping
    ? (seriesParsed.stripped || null)
    : stripGenerationFromSeries(equipment?.series)
  const rawModel = lifeFitnessLifecycleStripping
    ? modelParsed.stripped
    : stripModelYearRange(equipment?.model ?? '')

  const lifecycleNote = lifeFitnessLifecycleStripping
    ? (seriesParsed.lifecycleNote ?? modelParsed.lifecycleNote ?? null)
    : null

  const familyParsed = extractProductFamilyFromSeries(equipment?.series, { brand })
  let modelParsedConsole = stripConsoleVariantFromModel(rawModel, {
    productFamily: familyParsed.productFamily,
    equipmentType,
    brand,
  })

  if (technogymGroupingEnabled && isTechnogymBrand(brand)) {
    const technogymParsed = stripTechnogymNonPricingVariants(modelParsedConsole.coreModel, {
      existingVariantName: modelParsedConsole.variantName ?? familyParsed.variantName ?? null,
    })
    modelParsedConsole = {
      ...modelParsedConsole,
      coreModel: technogymParsed.coreModel,
      variantType: technogymParsed.variantType ?? modelParsedConsole.variantType,
      variantName: technogymParsed.variantName,
      variantSource: technogymParsed.variantSource ?? modelParsedConsole.variantSource,
    }
  }

  let variantType = familyParsed.variantType ?? modelParsedConsole.variantType
  let variantName = familyParsed.variantName ?? modelParsedConsole.variantName
  let variantSource = familyParsed.variantName
    ? 'series'
    : modelParsedConsole.variantSource

  if (technogymGroupingEnabled && isTechnogymBrand(brand) && modelParsedConsole.variantName) {
    variantType = modelParsedConsole.variantType ?? variantType
    variantName = modelParsedConsole.variantName
    variantSource = modelParsedConsole.variantSource ?? variantSource
  }

  const productFamily = normalizeFamilyLabel(
    equipment?.product_family ?? familyParsed.productFamily,
  )
  let coreModel = modelParsedConsole.coreModel

  let coreProductName = buildCoreProductName(brand, productFamily, coreModel)

  if (technogymGroupingEnabled && isTechnogymBrand(brand)) {
    const technogymName = buildTechnogymCanonicalProductName(brand, {
      series: equipment?.series,
      model: rawModel,
      coreModel,
      equipmentType,
    })
    if (technogymName) coreProductName = technogymName
  }

  if (isMatrixFitnessBrand(brand) && isMatrixModernSeries(rawSeries || productFamily || equipment?.series)) {
    const matrixIdentity = buildMatrixCanonicalProductIdentity({
      series: rawSeries || equipment?.series,
      model: rawModel,
      equipmentType,
      productFamily,
    })
    if (matrixIdentity.core_product_name) {
      coreProductName = matrixIdentity.core_product_name
    }
    if (matrixIdentity.core_model) {
      coreModel = matrixIdentity.core_model
    }
  }

  const coreProductKey = slugifyCoreProductKey(
    brand,
    equipmentType,
    productFamily,
    coreModel,
  )

  const relatedModelKey = slugifyCoreProductKey(brand, equipmentType, coreModel)

  let groupingConfidence = resolveGroupingConfidence({
    variantName,
    variantSource,
    productFamily,
    rawModel,
    coreModel,
  })

  if (
    isMatrixFitnessBrand(brand)
    && isMatrixModernSeries(productFamily || rawSeries)
    && productFamily
    && coreModel
    && equipmentType
  ) {
    groupingConfidence = GROUPING_CONFIDENCE.HIGH
  }

  const isBaseProduct = !variantName

  return {
    core_product_name: coreProductName || null,
    core_product_key: coreProductKey || null,
    related_model_key: relatedModelKey || null,
    variant_type: variantType,
    variant_name: variantName,
    variant_source: variantSource,
    lifecycle_note: lifecycleNote,
    is_base_product: isBaseProduct,
    core_product_group_confidence: groupingConfidence,
    raw_model: rawModel,
    raw_series: rawSeries,
    core_model: coreModel,
    product_family: productFamily,
  }
}

export function pickRepresentativeEquipmentId(members = []) {
  if (!members.length) return null

  const approvedBase = members.find((member) => (
    member.is_base_product && member.core_product_group_status === CORE_PRODUCT_GROUP_STATUS.APPROVED
  ))
  if (approvedBase) return approvedBase.id

  const manualBase = members.find((member) => member.is_base_product)
  if (manualBase) return manualBase.id

  const withoutVariant = members.find((member) => !member.variant_name)
  if (withoutVariant) return withoutVariant.id

  const shortestModel = [...members].sort((left, right) => (
    String(left.model ?? '').length - String(right.model ?? '').length
  ))[0]
  return shortestModel?.id ?? members[0]?.id ?? null
}

function deriveGroupTier(members = []) {
  const confidences = members.map((member) => (
    Number(member.core_product_group_confidence ?? member.suggested?.core_product_group_confidence ?? 0)
  ))
  const avgConfidence = confidences.length
    ? Math.round(confidences.reduce((sum, value) => sum + value, 0) / confidences.length)
    : 0
  const variantNames = new Set(
    members.map((member) => member.variant_name ?? member.suggested?.variant_name ?? '').filter(Boolean),
  )
  const families = new Set(
    members.map((member) => member.suggested?.product_family ?? '').filter(Boolean),
  )

  if (members.length > 1 && avgConfidence >= GROUPING_CONFIDENCE.HIGH - 2 && families.size <= 1) {
    return 'high'
  }
  if (members.length > 1 && variantNames.size > 0) {
    return 'medium'
  }
  return members.length > 1 ? 'medium' : 'single'
}

function resolveGroupStatus(members = []) {
  if (members.some((member) => member.core_product_group_status === CORE_PRODUCT_GROUP_STATUS.APPROVED)) {
    return CORE_PRODUCT_GROUP_STATUS.APPROVED
  }
  if (members.every((member) => member.core_product_group_status === CORE_PRODUCT_GROUP_STATUS.NOT_DUPLICATE)) {
    return CORE_PRODUCT_GROUP_STATUS.NOT_DUPLICATE
  }
  if (members.some((member) => member.core_product_group_status === CORE_PRODUCT_GROUP_STATUS.EXCLUDED)) {
    return CORE_PRODUCT_GROUP_STATUS.EXCLUDED
  }
  if (members.some((member) => member.core_product_group_status === CORE_PRODUCT_GROUP_STATUS.AUTO)) {
    return CORE_PRODUCT_GROUP_STATUS.AUTO
  }
  return CORE_PRODUCT_GROUP_STATUS.PENDING
}

export function buildCoreProductName(brand, productFamily, coreModel) {
  const brandText = normalizeWhitespace(brand)
  const familyText = normalizeWhitespace(productFamily)
  const modelText = normalizeWhitespace(coreModel)
  const parts = []
  if (brandText) parts.push(brandText)
  // Avoid "Wattbike Atom Atom" when series and model are the same label.
  if (familyText && normalizeTokenKey(familyText) !== normalizeTokenKey(modelText)) {
    parts.push(familyText)
  }
  if (modelText) parts.push(modelText)
  return parts.join(' ')
}

export function buildCoreProductKeyFromFields({
  brand,
  equipmentType = null,
  productFamily = null,
  coreModel,
}) {
  return slugifyCoreProductKey(brand, equipmentType, productFamily, coreModel)
}

export function buildCoreProductGroupExplanation(group) {
  const members = group.members ?? []
  const variants = [...new Set(
    members.map((member) => member.variant_name ?? member.suggested?.variant_name).filter(Boolean),
  )]
  const family = group.product_family ?? members[0]?.product_family ?? members[0]?.suggested?.product_family
  const coreModel = group.core_model ?? members[0]?.suggested?.core_model
  const equipmentType = group.equipment_type ?? members[0]?.equipment_type

  const parts = ['Grouped because brand']
  if (equipmentType) parts.push('equipment type')
  if (family) parts.push('product family')
  parts.push(`and stripped model (${coreModel}) match`)

  let explanation = `${parts.join(', ')}.`

  if (variants.length > 0) {
    explanation += ` Difference detected only in console descriptor${variants.length > 1 ? 's' : ''}: ${variants.join(', ')}.`
  } else if (members.length > 1) {
    explanation += ' Multiple catalogue rows share the same core product identity.'
  }

  if (group.grouping_tier === 'medium') {
    explanation += ' Manual review recommended before treating as duplicates.'
  }

  return explanation
}

export function isResearchDedupeEligibleGroup(group) {
  if (!group || group.member_count < 2) return false

  const members = group.members ?? []
  if (members.some((member) => (
    member.core_product_group_status === CORE_PRODUCT_GROUP_STATUS.NOT_DUPLICATE
    || member.core_product_group_status === CORE_PRODUCT_GROUP_STATUS.EXCLUDED
  ))) {
    return false
  }

  if (members.some((member) => member.core_product_group_status === CORE_PRODUCT_GROUP_STATUS.APPROVED)) {
    return true
  }

  return group.grouping_tier === 'high'
    && members.every((member) => (
      !member.core_product_group_status
      || member.core_product_group_status === CORE_PRODUCT_GROUP_STATUS.PENDING
      || member.core_product_group_status === CORE_PRODUCT_GROUP_STATUS.AUTO
    ))
}

export function isApprovableCoreProductGroup(group) {
  if (!group?.members?.length) return false
  return group.group_status === CORE_PRODUCT_GROUP_STATUS.PENDING
    || group.group_status === CORE_PRODUCT_GROUP_STATUS.AUTO
}

export function buildCoreProductGroupApprovalPayload(group, overrides = {}) {
  const representativeId = overrides.representativeEquipmentId
    ?? group.suggested_representative_equipment_id
    ?? group.representative_equipment_id
    ?? group.members[0]?.id

  const coreProductKey = overrides.coreProductKey ?? group.core_product_key
  const coreProductName = overrides.coreProductName ?? group.core_product_name
  const productFamily = overrides.productFamily ?? group.product_family ?? null
  const editingMemberId = overrides.editingMemberId ?? null

  const members = group.members.map((member) => ({
    equipmentId: member.id,
    coreProductName,
    coreProductKey,
    productFamily,
    variantType: member.id === editingMemberId
      ? overrides.variantType
      : (member.variant_type ?? member.suggested?.variant_type ?? null),
    variantName: member.id === editingMemberId
      ? overrides.variantName
      : (member.variant_name ?? member.suggested?.variant_name ?? null),
    coreProductGroupConfidence: member.core_product_group_confidence
      ?? member.suggested?.core_product_group_confidence
      ?? null,
  }))

  return {
    coreProductKey,
    representativeEquipmentId: representativeId,
    members,
  }
}

export function expandCoreProductResearchTargets(groups = []) {
  const targets = []

  for (const group of groups) {
    const representativeId = group.representative_equipment_id
      ?? pickRepresentativeEquipmentId(group.members)

    if (isResearchDedupeEligibleGroup(group) && representativeId) {
      targets.push({
        group,
        equipmentId: representativeId,
        label: group.core_product_name || 'Core product',
        dedupeEligible: true,
      })
      continue
    }

    for (const member of group.members ?? []) {
      if (!member.id) continue
      const label = member.core_product_name
        ?? member.suggested?.core_product_name
        ?? [member.brand, member.model].filter(Boolean).join(' ')
      targets.push({
        group,
        equipmentId: member.id,
        label,
        dedupeEligible: false,
      })
    }
  }

  return targets
}

export function buildCoreProductGroups(rows = []) {
  const groupMap = new Map()

  for (const row of rows) {
    if (row.core_product_group_status === CORE_PRODUCT_GROUP_STATUS.EXCLUDED) {
      continue
    }

    const derived = deriveCoreProductFields(row)
    const key = row.core_product_key || derived.core_product_key
    if (!key) continue

    const member = {
      id: row.id,
      slug: row.slug,
      brand: row.brand,
      series: row.series,
      model: row.model,
      equipment_type: row.equipment_type,
      product_family: row.product_family ?? derived.product_family,
      core_product_name: row.core_product_name ?? derived.core_product_name,
      variant_type: row.variant_type ?? derived.variant_type,
      variant_name: row.variant_name ?? derived.variant_name,
      is_base_product: row.is_base_product ?? derived.is_base_product,
      core_product_group_status: row.core_product_group_status ?? CORE_PRODUCT_GROUP_STATUS.PENDING,
      core_product_group_confidence: row.core_product_group_confidence ?? derived.core_product_group_confidence,
      best_original_price: row.best_original_price,
      best_original_price_confidence: row.best_original_price_confidence,
      best_original_price_currency: row.best_original_price_currency,
      baseline_manufacture_year: row.baseline_manufacture_year,
      baseline_manufacture_year_confidence: row.baseline_manufacture_year_confidence,
      baseline_manufacture_year_source: row.baseline_manufacture_year_source,
      original_rrp: row.original_rrp,
      currency: row.currency,
      suggested: derived,
    }

    const existing = groupMap.get(key)
    if (!existing) {
      groupMap.set(key, {
        core_product_key: key,
        related_model_key: derived.related_model_key,
        core_product_name: row.core_product_name || derived.core_product_name,
        product_family: row.product_family ?? derived.product_family,
        brand: row.brand,
        series: row.series,
        core_model: derived.core_model,
        equipment_type: row.equipment_type,
        members: [member],
        member_count: 1,
        core_product_group_status: row.core_product_group_status ?? CORE_PRODUCT_GROUP_STATUS.PENDING,
      })
      continue
    }

    existing.members.push(member)
    existing.member_count += 1
    if (!existing.core_product_name && derived.core_product_name) {
      existing.core_product_name = derived.core_product_name
    }
  }

  const groups = [...groupMap.values()].map((group) => {
    const representativeEquipmentId = pickRepresentativeEquipmentId(group.members)
    const suggestedRepresentative = pickRepresentativeEquipmentId(
      group.members.map((member) => ({
        ...member,
        is_base_product: member.suggested?.is_base_product,
        variant_name: member.suggested?.variant_name,
      })),
    )
    const avgConfidence = Math.round(
      group.members.reduce((sum, member) => (
        sum + Number(member.core_product_group_confidence ?? member.suggested?.core_product_group_confidence ?? 0)
      ), 0) / group.member_count,
    )
    const groupingTier = deriveGroupTier(group.members)
    const groupStatus = resolveGroupStatus(group.members)

    return {
      ...group,
      representative_equipment_id: representativeEquipmentId,
      suggested_representative_equipment_id: suggestedRepresentative,
      is_duplicate_group: group.member_count > 1,
      grouping_tier: groupingTier,
      requires_manual_review: groupingTier !== 'high',
      research_dedupe_eligible: isResearchDedupeEligibleGroup({
        ...group,
        grouping_tier: groupingTier,
        group_status: groupStatus,
      }),
      group_status: groupStatus,
      grouping_explanation: buildCoreProductGroupExplanation({
        ...group,
        grouping_tier: groupingTier,
      }),
      avg_confidence: avgConfidence,
    }
  })

  groups.sort((left, right) => (
    right.member_count - left.member_count
    || String(left.core_product_name).localeCompare(String(right.core_product_name))
  ))

  return groups
}

/**
 * Clusters that share brand + equipment type + model word but differ by product family.
 * Shown in audit/admin as low-confidence related candidates — not auto-merged.
 */
export function buildPossibleRelatedClusters(rows = []) {
  const clusterMap = new Map()

  for (const row of rows) {
    if (row.core_product_group_status === CORE_PRODUCT_GROUP_STATUS.EXCLUDED) continue

    const derived = deriveCoreProductFields(row)
    const relatedKey = derived.related_model_key
    if (!relatedKey) continue

    const candidate = {
      id: row.id,
      slug: row.slug,
      series: row.series,
      model: row.model,
      core_product_name: derived.core_product_name,
      core_product_key: derived.core_product_key,
      product_family: derived.product_family,
      variant_name: derived.variant_name,
    }

    const existing = clusterMap.get(relatedKey)
    if (!existing) {
      clusterMap.set(relatedKey, {
        related_model_key: relatedKey,
        core_model: derived.core_model,
        brand: row.brand,
        equipment_type: row.equipment_type,
        core_product_keys: new Set([derived.core_product_key]),
        candidates: [candidate],
      })
      continue
    }

    existing.core_product_keys.add(derived.core_product_key)
    existing.candidates.push(candidate)
  }

  return [...clusterMap.values()]
    .filter((cluster) => cluster.core_product_keys.size > 1)
    .map((cluster) => ({
      related_model_key: cluster.related_model_key,
      core_model: cluster.core_model,
      brand: cluster.brand,
      equipment_type: cluster.equipment_type,
      candidate_count: cluster.candidates.length,
      distinct_core_products: cluster.core_product_keys.size,
      grouping_confidence: GROUPING_CONFIDENCE.LOW,
      candidates: cluster.candidates,
    }))
    .sort((left, right) => right.candidate_count - left.candidate_count)
}

export function buildCoreProductAuditReport(rows = [], { incompleteRowFilter = null } = {}) {
  const groups = buildCoreProductGroups(rows)
  const highConfidenceDuplicates = groups.filter((group) => (
    group.member_count > 1 && group.grouping_tier === 'high'
  ))
  const duplicateGroups = groups.filter((group) => group.member_count > 1)
  const possibleRelatedClusters = buildPossibleRelatedClusters(rows)
  const variantRows = rows.filter((row) => {
    const derived = deriveCoreProductFields(row)
    return Boolean(derived.variant_name)
  })

  const powermillRelated = possibleRelatedClusters.find((cluster) => (
    /powermill/i.test(cluster.core_model ?? '')
  ))

  const rowIncomplete = incompleteRowFilter ?? (() => true)
  const incompleteRows = rows.filter(rowIncomplete)
  const incompleteRowCount = incompleteRows.length

  const incompleteIds = new Set(incompleteRows.map((row) => row.id))
  const researchTargets = expandCoreProductResearchTargets(groups)
  const dedupedTargetIds = new Set()
  for (const target of researchTargets) {
    if (!incompleteIds.has(target.equipmentId)) continue
    dedupedTargetIds.add(target.equipmentId)
  }

  const estimatedResearchCallsBefore = incompleteRowCount
  const estimatedResearchCallsAfterDeduped = dedupedTargetIds.size
  const researchCallReduction = Math.max(
    0,
    estimatedResearchCallsBefore - estimatedResearchCallsAfterDeduped,
  )

  return {
    total_rows: rows.length,
    unique_core_products: groups.length,
    duplicate_group_count: duplicateGroups.length,
    high_confidence_duplicate_group_count: highConfidenceDuplicates.length,
    possible_related_cluster_count: possibleRelatedClusters.length,
    variant_row_count: variantRows.length,
    largest_duplicate_groups: highConfidenceDuplicates.slice(0, 25).map((group) => ({
      core_product_name: group.core_product_name,
      core_product_key: group.core_product_key,
      product_family: group.product_family,
      member_count: group.member_count,
      grouping_tier: group.grouping_tier,
      members: group.members.map((member) => ({
        id: member.id,
        slug: member.slug,
        model: member.model,
        series: member.series,
        variant_name: member.variant_name ?? member.suggested?.variant_name,
      })),
      suggested_representative_equipment_id: group.suggested_representative_equipment_id,
    })),
    possible_related_clusters: possibleRelatedClusters.slice(0, 25).map((cluster) => ({
      related_model_key: cluster.related_model_key,
      brand: cluster.brand,
      equipment_type: cluster.equipment_type,
      core_model: cluster.core_model,
      candidate_count: cluster.candidate_count,
      distinct_core_products: cluster.distinct_core_products,
      grouping_confidence: cluster.grouping_confidence,
      candidates: cluster.candidates.map((candidate) => ({
        core_product_name: candidate.core_product_name,
        product_family: candidate.product_family,
        series: candidate.series,
        model: candidate.model,
        variant_name: candidate.variant_name,
      })),
    })),
    estimated_research_calls: {
      before: estimatedResearchCallsBefore,
      after: estimatedResearchCallsAfterDeduped,
      reduction: researchCallReduction,
      reduction_percent: estimatedResearchCallsBefore > 0
        ? Math.round((researchCallReduction / estimatedResearchCallsBefore) * 1000) / 10
        : 0,
    },
    examples: powermillRelated ? [{
      related_model_key: powermillRelated.related_model_key,
      distinct_core_products: powermillRelated.distinct_core_products,
      candidates: powermillRelated.candidates.map((candidate) => ({
        core_product_name: candidate.core_product_name,
        product_family: candidate.product_family,
        series: candidate.series,
        model: candidate.model,
        variant_name: candidate.variant_name,
      })),
    }] : [],
    groups,
  }
}

/**
 * Merge member evidence for core-product research completeness.
 */
export function mergeCoreProductEvidence(members = []) {
  const bestPriceMember = [...members]
    .filter((member) => Number(member.best_original_price) > 0)
    .sort((left, right) => (
      Number(right.best_original_price_confidence ?? 0)
      - Number(left.best_original_price_confidence ?? 0)
    ))[0]

  const bestLifecycleMember = [...members]
    .filter((member) => member.baseline_manufacture_year != null)
    .sort((left, right) => (
      Number(right.baseline_manufacture_year_confidence ?? 0)
      - Number(left.baseline_manufacture_year_confidence ?? 0)
    ))[0]

  return {
    best_original_price: bestPriceMember?.best_original_price ?? null,
    best_original_price_confidence: bestPriceMember?.best_original_price_confidence ?? null,
    best_original_price_currency: bestPriceMember?.best_original_price_currency ?? null,
    baseline_manufacture_year: bestLifecycleMember?.baseline_manufacture_year ?? null,
    baseline_manufacture_year_source: bestLifecycleMember?.baseline_manufacture_year_source ?? null,
    manufacture_start_year: bestLifecycleMember?.manufacture_start_year ?? null,
    manufacture_end_year: bestLifecycleMember?.manufacture_end_year ?? null,
  }
}

export function buildCoreProductGroupingPayload(row) {
  const derived = deriveCoreProductFields(row)
  return {
    core_product_name: derived.core_product_name,
    core_product_key: derived.core_product_key,
    product_family: derived.product_family,
    variant_type: derived.variant_type,
    variant_name: derived.variant_name,
    is_base_product: derived.is_base_product,
    core_product_group_confidence: derived.core_product_group_confidence,
    core_product_group_status: CORE_PRODUCT_GROUP_STATUS.AUTO,
  }
}
