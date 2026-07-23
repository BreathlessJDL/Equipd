/**
 * Google Merchant Center feed eligibility — stricter than public readability.
 * Never use listing_is_publicly_readable. Sold listings are always excluded.
 */

import {
  isListingGenuinelyPurchasable,
  resolveListingSchemaImageUrls,
} from './listingPageStructuredData.js'
import { listingHasPublicImageEvidence } from './listingSoldLifecycle.js'
import { getListingCanonicalUrl } from './listingPageSeo.js'
import { classifyMerchantFulfilment } from './merchantFeedFulfilment.js'
import { resolveMerchantIdentifierDecision } from './merchantFeedIdentity.js'
import { mapListingConditionToMerchant } from './merchantFeedContent.js'

export const MERCHANT_EXCLUSION_REASONS = Object.freeze({
  NOT_ACTIVE: 'not_active',
  NOT_PUBLIC: 'not_public',
  NOT_PURCHASABLE: 'not_purchasable',
  MISSING_SLUG: 'missing_slug',
  MISSING_CANONICAL: 'missing_canonical',
  MISSING_PRICE: 'missing_price',
  MISSING_TITLE: 'missing_title',
  MISSING_CONDITION: 'missing_condition',
  MISSING_IMAGE: 'missing_image',
  INVALID_IMAGE: 'invalid_image',
  UNSUPPORTED_FULFILMENT: 'unsupported_fulfilment',
  TEST_DATA: 'test_data',
  RESTRICTED_PRODUCT: 'restricted_product',
  SOLD: 'sold',
  ZERO_QUANTITY: 'unavailable_quantity',
  MISSING_SELLER: 'missing_seller',
  IDENTIFIER_BLOCKED: 'missing_identifier_decision',
})

function normalizeWhitespace(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim()
}

function isHttpUrl(value) {
  if (!value || typeof value !== 'string') return false
  try {
    const parsed = new URL(value)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

/**
 * Active marketplace visibility mirror (JS). Aligns with listing_is_publicly_visible
 * / listings_public_browse — does NOT include sold readability.
 */
export function isMerchantPubliclyVisibleListing(listing) {
  if (!listing) return false
  if (listing.is_test_data === true) return false
  if (String(listing.status ?? '').trim().toLowerCase() !== 'active') return false

  if (listing.quantity_available != null) {
    const qty = Number(listing.quantity_available)
    if (!Number.isFinite(qty) || qty <= 0) return false
  }

  const source = String(listing.source ?? '').trim().toLowerCase()
  if (source === 'import' && !listingHasPublicImageEvidence(listing)) return false

  return true
}

/**
 * Classify a listing for Merchant feed inclusion.
 * @returns {{ eligible: boolean, reasons: string[], fulfilment: object|null, identifierDecision: object, images: string[] }}
 */
export function classifyMerchantListingEligibility(listing, {
  equipmentProduct = null,
} = {}) {
  const reasons = []

  if (!listing) {
    return {
      eligible: false,
      reasons: [MERCHANT_EXCLUSION_REASONS.NOT_PUBLIC],
      fulfilment: null,
      identifierDecision: resolveMerchantIdentifierDecision(listing, equipmentProduct),
      images: [],
    }
  }

  if (listing.is_test_data === true) reasons.push(MERCHANT_EXCLUSION_REASONS.TEST_DATA)

  const status = String(listing.status ?? '').trim().toLowerCase()
  if (status === 'sold') reasons.push(MERCHANT_EXCLUSION_REASONS.SOLD)
  if (status !== 'active') reasons.push(MERCHANT_EXCLUSION_REASONS.NOT_ACTIVE)

  if (!isMerchantPubliclyVisibleListing(listing)) {
    reasons.push(MERCHANT_EXCLUSION_REASONS.NOT_PUBLIC)
  }

  if (!isListingGenuinelyPurchasable(listing)) {
    reasons.push(MERCHANT_EXCLUSION_REASONS.NOT_PURCHASABLE)
  }

  const slug = normalizeWhitespace(listing.slug)
  if (!slug) reasons.push(MERCHANT_EXCLUSION_REASONS.MISSING_SLUG)

  const canonicalUrl = getListingCanonicalUrl(listing)
  if (!canonicalUrl || !isHttpUrl(canonicalUrl)) {
    reasons.push(MERCHANT_EXCLUSION_REASONS.MISSING_CANONICAL)
  }

  const price = Number(listing.price_pence)
  if (!Number.isFinite(price) || price <= 0) {
    reasons.push(MERCHANT_EXCLUSION_REASONS.MISSING_PRICE)
  }

  const title = normalizeWhitespace(listing.title)
  if (!title) reasons.push(MERCHANT_EXCLUSION_REASONS.MISSING_TITLE)

  if (!mapListingConditionToMerchant(listing.condition)) {
    reasons.push(MERCHANT_EXCLUSION_REASONS.MISSING_CONDITION)
  }

  const images = resolveListingSchemaImageUrls(listing)
  if (!images.length) {
    reasons.push(MERCHANT_EXCLUSION_REASONS.MISSING_IMAGE)
  } else if (!images.every(isHttpUrl)) {
    reasons.push(MERCHANT_EXCLUSION_REASONS.INVALID_IMAGE)
  }

  if (!normalizeWhitespace(listing.seller_id)) {
    reasons.push(MERCHANT_EXCLUSION_REASONS.MISSING_SELLER)
  }

  const fulfilment = classifyMerchantFulfilment(listing)
  if (!fulfilment?.eligible) {
    reasons.push(MERCHANT_EXCLUSION_REASONS.UNSUPPORTED_FULFILMENT)
  }

  const identifierDecision = resolveMerchantIdentifierDecision(listing, equipmentProduct)
  if (identifierDecision.blocked) {
    reasons.push(MERCHANT_EXCLUSION_REASONS.IDENTIFIER_BLOCKED)
  }

  // De-dupe reasons while preserving order
  const uniqueReasons = [...new Set(reasons)]

  return {
    eligible: uniqueReasons.length === 0,
    reasons: uniqueReasons,
    fulfilment,
    identifierDecision,
    images,
    canonicalUrl: canonicalUrl || null,
  }
}

export function isMerchantFeedEligibleListing(listing, options = {}) {
  return classifyMerchantListingEligibility(listing, options).eligible
}

export function summarizeMerchantEligibility(results = []) {
  const excludedByReason = {}
  let eligible = 0
  for (const result of results) {
    if (result.eligible) {
      eligible += 1
      continue
    }
    for (const reason of result.reasons) {
      excludedByReason[reason] = (excludedByReason[reason] || 0) + 1
    }
  }
  return {
    total: results.length,
    eligible,
    excluded: results.length - eligible,
    excludedByReason,
  }
}
