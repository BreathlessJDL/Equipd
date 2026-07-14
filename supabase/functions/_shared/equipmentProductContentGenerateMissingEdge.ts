/**
 * Edge port of equipmentProductContentGenerateMissing.js eligibility.
 * Keep in sync with src/lib/equipmentProductContentGenerateMissing.js
 */

export const HOME_USE_CONTENT_BRANDS = Object.freeze([
  'Peloton',
  'NordicTrack',
  'BowFlex',
])

export const CONTENT_USAGE_SEGMENT = Object.freeze({
  COMMERCIAL: 'commercial',
  HOME_USE: 'home_use',
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

const HOME_USE_BRAND_KEYS = new Set(
  HOME_USE_CONTENT_BRANDS.map((brand) => normalizeBrandKey(brand)),
)

function normalizeWhitespace(value: unknown) {
  return String(value ?? '').replace(/\s+/g, ' ').trim()
}

export function normalizeBrandKey(brand: unknown) {
  return normalizeWhitespace(brand).toLowerCase().replace(/[^a-z0-9]/g, '')
}

export function isHomeUseContentBrand(brand: unknown) {
  return HOME_USE_BRAND_KEYS.has(normalizeBrandKey(brand))
}

export function resolveProductContentUsageSegment(product: Record<string, unknown> = {}) {
  return isHomeUseContentBrand(product?.brand)
    ? CONTENT_USAGE_SEGMENT.HOME_USE
    : CONTENT_USAGE_SEGMENT.COMMERCIAL
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
