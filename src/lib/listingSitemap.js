/**
 * Marketplace listing sitemap helpers (Node-safe).
 * Uses the same canonical URL convention as Stage 1 listing SEO.
 */

import { EQUIPD_SITE_ORIGIN } from './brandCatalogueCore.js'
import {
  classifyListingDiscoveryState,
  isActivePublicListingCandidate,
  isListingEligibleForSitemapInclusion,
  LISTING_DISCOVERY_STATES,
} from './listingDiscoveryEligibility.js'
import { getListingCanonicalUrl } from './listingPageSeo.js'
import { isSoldListingStatus } from './listingSoldLifecycle.js'

/** Soft URL-count threshold before considering a sitemap index split. */
export const SITEMAP_SPLIT_URL_SOFT_LIMIT = 45000

/** Soft uncompressed size threshold (bytes) before considering a split. */
export const SITEMAP_SPLIT_SIZE_SOFT_LIMIT_BYTES = 45 * 1024 * 1024

/**
 * Meaningful lastmod for a listing.
 * Sold pages prefer sold_at; otherwise content/publish/create stamps.
 * Never invents “now”.
 */
export function resolveListingSitemapLastmod(listing) {
  const candidates = isSoldListingStatus(listing)
    ? [listing?.sold_at, listing?.updated_at, listing?.published_at, listing?.created_at]
    : [listing?.updated_at, listing?.published_at, listing?.created_at]

  for (const value of candidates) {
    if (!value) continue
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) continue
    return date.toISOString().slice(0, 10)
  }
  return null
}

/**
 * Active public-browse listing eligibility (Stage 4).
 */
export function isActiveListingEligibleForSitemap(listing) {
  return isActivePublicListingCandidate(listing)
}

/**
 * Eligible recent sold listing for sitemap (Stage 5).
 */
export function isSoldListingEligibleForSitemap(listing, { now = new Date() } = {}) {
  return classifyListingDiscoveryState(listing, { now }) === LISTING_DISCOVERY_STATES.SOLD_INDEXABLE
}

/** @deprecated Prefer isActiveListingEligibleForSitemap / isSoldListingEligibleForSitemap */
export function isListingEligibleForSitemap(listing) {
  return isActiveListingEligibleForSitemap(listing)
}

export function buildListingSitemapLoc(listing, { now = new Date() } = {}) {
  if (isListingEligibleForSitemapInclusion(listing, { now })) {
    return getListingCanonicalUrl(listing)
  }
  return null
}

/**
 * Deduplicate by canonical loc; keep the newest lastmod when duplicates appear.
 */
export function buildListingSitemapEntries(listings = [], { now = new Date() } = {}) {
  const byLoc = new Map()

  for (const listing of listings) {
    const loc = buildListingSitemapLoc(listing, { now })
    if (!loc) continue
    const lastmod = resolveListingSitemapLastmod(listing)
    const existing = byLoc.get(loc)
    if (!existing) {
      byLoc.set(loc, { loc, lastmod, listingId: listing.id || null })
      continue
    }
    if (lastmod && (!existing.lastmod || lastmod > existing.lastmod)) {
      byLoc.set(loc, { loc, lastmod, listingId: listing.id || existing.listingId })
    }
  }

  return [...byLoc.values()].sort((a, b) => a.loc.localeCompare(b.loc))
}

export function assertListingSitemapLocMatchesCanonical(listing) {
  const sitemapLoc = buildListingSitemapLoc(listing)
  const canonical = getListingCanonicalUrl(listing)
  return Boolean(sitemapLoc && canonical && sitemapLoc === canonical)
}

export function getListingCardHref(listing, { primaryLinkTo = null } = {}) {
  if (primaryLinkTo) return primaryLinkTo
  const slug = String(listing?.slug ?? '').trim()
  if (!slug) return null
  return `/listings/${slug}`
}

export function buildAbsoluteListingCardHref(listing, options = {}) {
  const path = getListingCardHref(listing, options)
  if (!path) return null
  if (path.startsWith('http')) return path
  return `${EQUIPD_SITE_ORIGIN}${path.startsWith('/') ? path : `/${path}`}`
}

export function shouldSplitSitemap({ urlCount = 0, byteLength = 0 } = {}) {
  return (
    Number(urlCount) >= SITEMAP_SPLIT_URL_SOFT_LIMIT
    || Number(byteLength) >= SITEMAP_SPLIT_SIZE_SOFT_LIMIT_BYTES
  )
}

export function summarizeSitemapEntries(entries = []) {
  const counts = {
    total: entries.length,
    home: 0,
    browse: 0,
    valuation: 0,
    static: 0,
    brandsIndex: 0,
    brands: 0,
    equipment: 0,
    listings: 0,
    other: 0,
  }

  for (const entry of entries) {
    const loc = typeof entry === 'string' ? entry : entry?.loc
    if (!loc) {
      counts.other += 1
      continue
    }
    try {
      const { pathname } = new URL(loc)
      if (pathname === '/') counts.home += 1
      else if (pathname === '/browse') counts.browse += 1
      else if (pathname === '/valuation') counts.valuation += 1
      else if (pathname === '/brands') counts.brandsIndex += 1
      else if (pathname.startsWith('/brands/')) counts.brands += 1
      else if (pathname.startsWith('/equipment/')) counts.equipment += 1
      else if (pathname.startsWith('/listings/')) counts.listings += 1
      else if (
        pathname === '/about'
        || pathname === '/help'
        || pathname === '/sell-gym-equipment'
      ) {
        counts.static += 1
      } else {
        counts.other += 1
      }
    } catch {
      counts.other += 1
    }
  }

  return counts
}
