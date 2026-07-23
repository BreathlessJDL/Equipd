/**
 * Edge port of equipmentProductContentGenerateMissing.js eligibility + usage segments.
 * Keep brand lists in sync with src/lib/equipmentProductContentUsage.js
 */

export const PREMIUM_HOME_CONTENT_BRANDS = Object.freeze([
  'Peloton',
  'NordicTrack',
  'BowFlex',
  'Bowflex',
])

export const HOME_CONTENT_BRANDS = Object.freeze([
  'ProForm',
  'Pro Form',
  'Sole',
  'Sole Fitness',
  'Horizon',
  'Horizon Fitness',
  'York Fitness',
  'York',
  'Reebok',
  'Schwinn',
  'WaterRower',
  'Water Rower',
  'BH Fitness',
  'BH',
  'Spirit Fitness',
  'Spirit',
  'Powertec',
  'REP',
  'REP Fitness',
])

export const HOME_USE_CONTENT_BRANDS = Object.freeze([
  ...PREMIUM_HOME_CONTENT_BRANDS,
  ...HOME_CONTENT_BRANDS,
])

export const CONTENT_USAGE_SEGMENT = Object.freeze({
  COMMERCIAL: 'commercial',
  PREMIUM_HOME: 'premium_home',
  HOME: 'home',
  HOME_USE: 'home',
  STRENGTH: 'strength',
  LIGHT_COMMERCIAL: 'light_commercial',
})

export const CONTENT_GENERATION_STATUS = Object.freeze({
  DRAFT: 'draft',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  FAILED: 'failed',
  STALE: 'stale',
})

const PRODUCT_STATUS = Object.freeze({
  PENDING: 'pending',
  APPROVED: 'approved',
  EXCLUDED: 'excluded',
  NEEDS_REVIEW: 'needs_review',
})

const LIGHT_COMMERCIAL_KEYS = new Set(['wattbike'])
const COMMERCIAL_KEYS = new Set([
  'lifefitness',
  'technogym',
  'matrixfitness',
  'matrix',
  'precor',
  'cybex',
  'woodway',
  'hammerstrength',
  'pulsefitness',
  'pulse',
  'stairmaster',
])
const PREMIUM_HOME_KEYS = new Set(
  PREMIUM_HOME_CONTENT_BRANDS.map((brand) => normalizeBrandKey(brand)),
)
const HOME_KEYS = new Set(
  HOME_CONTENT_BRANDS.map((brand) => normalizeBrandKey(brand)),
)
const HOME_LIKE_KEYS = new Set([...PREMIUM_HOME_KEYS, ...HOME_KEYS])

function normalizeWhitespace(value: unknown) {
  return String(value ?? '').replace(/\s+/g, ' ').trim()
}

export function normalizeBrandKey(brand: unknown) {
  return normalizeWhitespace(brand).toLowerCase().replace(/[^a-z0-9]/g, '')
}

export function isHomeUseContentBrand(brand: unknown) {
  return HOME_LIKE_KEYS.has(normalizeBrandKey(brand))
}

function isStrengthEquipmentType(equipmentType: unknown) {
  const key = normalizeWhitespace(equipmentType).toLowerCase()
  if (!key) return false
  return /\b(press|curl|extension|pulldown|abductor|adductor|bench|rack|smith|functional|cable|multi[\s-]?gym|plate[\s-]?loaded|selectorised|free weights|strength)\b/i.test(key)
}

function matchHomeToken(hay: string, token: string) {
  const escaped = String(token).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`(?:^|[^A-Za-z0-9])${escaped}(?:[^A-Za-z0-9]|$)`, 'i').test(hay)
}

function productHaystack(product: Record<string, unknown> = {}) {
  return [
    product.model,
    product.product_family,
    product.canonical_product_name,
    product.canonical_product_key,
  ].map(normalizeWhitespace).filter(Boolean).join(' ')
}

/** Port of parseLifeFitnessHomeIdentity / parseMatrixHomeIdentity for edge usage segments. */
function isDualBrandHomeCatalogueProduct(product: Record<string, unknown> = {}) {
  const brandKey = normalizeBrandKey(product?.brand)
  const hay = productHaystack(product)
  if (!hay) return false
  const lower = hay.toLowerCase()

  if (brandKey === 'lifefitness') {
    if (/\bintegrity\b|\belevation\b|\bsilver\s*line\b/i.test(hay)) return false
    if (/\brow\s*hx\b/i.test(hay)) return true
    for (const base of ['RS1', 'RS3', 'T3', 'T5', 'F3', 'E1', 'E3', 'E5', 'C1', 'C3', 'G2', 'G4', 'G7', 'X1', 'X3', 'X5', 'R1', 'R3']) {
      if (matchHomeToken(hay, base)) return true
    }
    return false
  }

  if (brandKey === 'matrix' || brandKey === 'matrixfitness') {
    if (/\blifestyle\b|\bendurance\b|\bperformance\b|\bonyx\b/i.test(hay)) return false
    if (/\bhome\s+functional\s+trainer\b/i.test(hay) || (/\bfunctional\s+trainer\b/i.test(hay) && /\bhome\b/i.test(lower) && !/\bg3\b|\baura\b/i.test(hay))) {
      return true
    }
    if (/\bhome\s+rower\b/i.test(hay) || (/\brower\b/i.test(hay) && /\bhome\b/i.test(lower))) {
      return true
    }
    for (const base of ['ICR50', 'CXR50', 'TF50', 'TF30', 'T75', 'T50', 'T30', 'E50', 'E30', 'A50', 'A30', 'U50', 'U30', 'R50', 'R30', 'C50']) {
      if (matchHomeToken(hay, base)) return true
    }
    return false
  }

  return false
}

export function resolveProductContentUsageSegment(product: Record<string, unknown> = {}) {
  if (isDualBrandHomeCatalogueProduct(product)) {
    return CONTENT_USAGE_SEGMENT.HOME
  }

  const brandKey = normalizeBrandKey(product?.brand)
  if (isStrengthEquipmentType(product?.equipment_type)) {
    if (PREMIUM_HOME_KEYS.has(brandKey)) return CONTENT_USAGE_SEGMENT.PREMIUM_HOME
    if (HOME_KEYS.has(brandKey)) return CONTENT_USAGE_SEGMENT.HOME
    return CONTENT_USAGE_SEGMENT.STRENGTH
  }
  if (PREMIUM_HOME_KEYS.has(brandKey)) return CONTENT_USAGE_SEGMENT.PREMIUM_HOME
  if (HOME_KEYS.has(brandKey)) return CONTENT_USAGE_SEGMENT.HOME
  if (LIGHT_COMMERCIAL_KEYS.has(brandKey)) return CONTENT_USAGE_SEGMENT.LIGHT_COMMERCIAL
  if (COMMERCIAL_KEYS.has(brandKey)) return CONTENT_USAGE_SEGMENT.COMMERCIAL
  return CONTENT_USAGE_SEGMENT.COMMERCIAL
}

export function isEligibleProductStatusForContentGeneration(status: unknown) {
  return status === PRODUCT_STATUS.PENDING
    || status === PRODUCT_STATUS.NEEDS_REVIEW
    || status === PRODUCT_STATUS.APPROVED
}

export function hasRequiredProductIdentityForContent(product: Record<string, unknown> = {}) {
  const brand = normalizeWhitespace(product.brand)
  const canonical = normalizeWhitespace(product.canonical_product_name)
  const model = normalizeWhitespace(product.model)
  if (!brand) return false
  if (!canonical && !model) return false
  return true
}

function isMissingOrFailedContent(contentRow: Record<string, unknown> | null) {
  return !contentRow
    || contentRow.generation_status === CONTENT_GENERATION_STATUS.FAILED
}

export function evaluateMissingDraftGenerationEligibility(
  product: Record<string, unknown> | null,
  contentRow: Record<string, unknown> | null = null,
) {
  if (!product?.id) {
    return { eligible: false, reason: 'missing_product', action: 'invalid' }
  }

  if (!isEligibleProductStatusForContentGeneration(product.status)) {
    return {
      eligible: false,
      reason: product.status === PRODUCT_STATUS.EXCLUDED ? 'excluded' : 'ineligible_status',
      action: 'invalid',
    }
  }

  if (!hasRequiredProductIdentityForContent(product)) {
    return { eligible: false, reason: 'missing_identity', action: 'invalid' }
  }

  if (contentRow?.generation_status === CONTENT_GENERATION_STATUS.APPROVED) {
    return { eligible: false, reason: 'approved_content_exists', action: 'skipped_approved' }
  }

  if (contentRow?.generation_status === CONTENT_GENERATION_STATUS.DRAFT) {
    return { eligible: false, reason: 'draft_exists', action: 'skipped_draft' }
  }

  if (contentRow?.generation_status === CONTENT_GENERATION_STATUS.STALE) {
    return { eligible: false, reason: 'stale_content_exists', action: 'skipped_draft' }
  }

  if (contentRow?.generation_status === CONTENT_GENERATION_STATUS.REJECTED) {
    return { eligible: false, reason: 'rejected_content_exists', action: 'skipped_draft' }
  }

  if (!isMissingOrFailedContent(contentRow)) {
    return { eligible: false, reason: 'content_exists', action: 'skipped_draft' }
  }

  return {
    eligible: true,
    reason: contentRow?.generation_status === CONTENT_GENERATION_STATUS.FAILED
      ? 'failed_retry'
      : 'missing',
    action: 'generate',
    usage_segment: resolveProductContentUsageSegment(product),
  }
}
