/**
 * Shared marketplace listing discovery eligibility (Node-safe).
 *
 * Single source of truth for sitemap inclusion, listing prerender inclusion,
 * and sold indexing-window classification. Uses listings.sold_at only for the
 * 12-month archive boundary (UTC calendar months via listingSoldLifecycle).
 *
 * States:
 * - active_public          — publicly visible + indexable + sitemap + prerender
 * - sold_indexable         — readable sold within 12 months — sitemap + prerender
 * - sold_readable_noindex  — readable sold older than 12 months — no sitemap/prerender
 * - unreadable             — drafts, test, never-published sold, invalid slugs, etc.
 */

import {
  getSoldListingIndexingState,
  isEligiblePublicSoldListing,
  listingHasPublicImageEvidence,
  isSoldListingStatus,
} from './listingSoldLifecycle.js'

export const LISTING_DISCOVERY_STATES = Object.freeze({
  ACTIVE_PUBLIC: 'active_public',
  SOLD_INDEXABLE: 'sold_indexable',
  SOLD_READABLE_NOINDEX: 'sold_readable_noindex',
  UNREADABLE: 'unreadable',
})

function hasValidListingSlug(listing) {
  const slug = String(listing?.slug ?? '').trim()
  if (!slug || slug === 'new') return false
  if (slug.includes('/') || slug.includes('?') || slug.includes('#')) return false
  return true
}

/**
 * Active marketplace visibility (mirrors listings_public_browse intent for JS helpers).
 * Does not replace SQL listing_is_publicly_visible — used for sitemap/prerender routing.
 */
export function isActivePublicListingCandidate(listing) {
  if (!listing || typeof listing !== 'object') return false
  if (listing.is_test_data === true) return false
  if (String(listing.status ?? '').trim().toLowerCase() !== 'active') return false
  if (!hasValidListingSlug(listing)) return false

  if (listing.quantity_available != null) {
    const qty = Number(listing.quantity_available)
    if (Number.isFinite(qty) && qty <= 0) return false
  }

  if (String(listing?.source ?? '').trim().toLowerCase() === 'import' && !listingHasPublicImageEvidence(listing)) {
    return false
  }

  return true
}

/**
 * Classify a listing for discovery systems.
 * @returns {'active_public'|'sold_indexable'|'sold_readable_noindex'|'unreadable'}
 */
export function classifyListingDiscoveryState(listing, { now = new Date() } = {}) {
  if (!listing || typeof listing !== 'object') {
    return LISTING_DISCOVERY_STATES.UNREADABLE
  }

  if (listing.is_test_data === true) {
    return LISTING_DISCOVERY_STATES.UNREADABLE
  }

  if (!hasValidListingSlug(listing)) {
    return LISTING_DISCOVERY_STATES.UNREADABLE
  }

  if (isActivePublicListingCandidate(listing)) {
    return LISTING_DISCOVERY_STATES.ACTIVE_PUBLIC
  }

  if (isSoldListingStatus(listing)) {
    if (!isEligiblePublicSoldListing(listing)) {
      return LISTING_DISCOVERY_STATES.UNREADABLE
    }
    const indexing = getSoldListingIndexingState({ soldAt: listing.sold_at, now })
    return indexing.indexable
      ? LISTING_DISCOVERY_STATES.SOLD_INDEXABLE
      : LISTING_DISCOVERY_STATES.SOLD_READABLE_NOINDEX
  }

  return LISTING_DISCOVERY_STATES.UNREADABLE
}

/** Sitemap + IndexNow-facing public URLs (active public + indexable sold). */
export function isListingEligibleForSitemapInclusion(listing, { now = new Date() } = {}) {
  const state = classifyListingDiscoveryState(listing, { now })
  return (
    state === LISTING_DISCOVERY_STATES.ACTIVE_PUBLIC
    || state === LISTING_DISCOVERY_STATES.SOLD_INDEXABLE
  )
}

/**
 * Build-time HTML prerender set — same as sitemap inclusion.
 * Older sold pages remain readable at runtime but are not prerendered.
 */
export function isListingEligibleForPrerender(listing, { now = new Date() } = {}) {
  return isListingEligibleForSitemapInclusion(listing, { now })
}

export function isListingPubliclyReadableCandidate(listing, { now = new Date() } = {}) {
  const state = classifyListingDiscoveryState(listing, { now })
  return (
    state === LISTING_DISCOVERY_STATES.ACTIVE_PUBLIC
    || state === LISTING_DISCOVERY_STATES.SOLD_INDEXABLE
    || state === LISTING_DISCOVERY_STATES.SOLD_READABLE_NOINDEX
  )
}

export function summarizeListingDiscoveryClassification(listings = [], { now = new Date() } = {}) {
  const counts = {
    active_public: 0,
    sold_indexable: 0,
    sold_readable_noindex: 0,
    unreadable: 0,
    total: listings.length,
  }

  for (const listing of listings) {
    const state = classifyListingDiscoveryState(listing, { now })
    counts[state] = (counts[state] || 0) + 1
  }

  return counts
}
