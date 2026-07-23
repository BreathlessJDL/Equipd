/**
 * Sold listing archive indexing helpers (Node-safe, UTC).
 * Uses listings.sold_at only — never updated_at.
 */

export const SOLD_INDEXABLE_MONTHS = 12

function toUtcDate(value) {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null
    return value
  }
  if (value == null || value === '') return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date
}

/**
 * Add calendar months in UTC without local timezone drift.
 */
export function addUtcMonths(date, months) {
  const source = toUtcDate(date)
  if (!source) return null
  const year = source.getUTCFullYear()
  const month = source.getUTCMonth()
  const day = source.getUTCDate()
  const hours = source.getUTCHours()
  const minutes = source.getUTCMinutes()
  const seconds = source.getUTCSeconds()
  const ms = source.getUTCMilliseconds()

  const targetMonthIndex = month + Number(months)
  const result = new Date(Date.UTC(year, targetMonthIndex, 1, hours, minutes, seconds, ms))
  const daysInTargetMonth = new Date(Date.UTC(
    result.getUTCFullYear(),
    result.getUTCMonth() + 1,
    0,
  )).getUTCDate()
  result.setUTCDate(Math.min(day, daysInTargetMonth))
  return result
}

export function getSoldListingIndexExpiry(soldAt) {
  return addUtcMonths(soldAt, SOLD_INDEXABLE_MONTHS)
}

/**
 * @returns {{
 *   sold: boolean,
 *   indexable: boolean,
 *   robotsContent: 'index, follow' | 'noindex, follow',
 *   sitemapEligible: boolean,
 *   soldAt: string | null,
 *   indexUntil: string | null,
 * }}
 */
export function getSoldListingIndexingState({ soldAt, now = new Date() } = {}) {
  const soldDate = toUtcDate(soldAt)
  const nowDate = toUtcDate(now) || new Date()

  if (!soldDate) {
    return {
      sold: true,
      indexable: false,
      robotsContent: 'noindex, follow',
      sitemapEligible: false,
      soldAt: null,
      indexUntil: null,
    }
  }

  const indexUntil = getSoldListingIndexExpiry(soldDate)
  // Indexable while now < indexUntil (exactly 12 months later becomes noindex).
  const indexable = Boolean(indexUntil && nowDate.getTime() < indexUntil.getTime())

  return {
    sold: true,
    indexable,
    robotsContent: indexable ? 'index, follow' : 'noindex, follow',
    sitemapEligible: indexable,
    soldAt: soldDate.toISOString(),
    indexUntil: indexUntil ? indexUntil.toISOString() : null,
  }
}

export function isSoldListingStatus(listing) {
  return String(listing?.status ?? '').trim().toLowerCase() === 'sold'
}

export function listingHasPublicImageEvidence(listing) {
  if (!listing) return false
  if (listing.primary_image_url) return true
  if (Array.isArray(listing.listing_images) && listing.listing_images.length > 0) return true
  return false
}

/**
 * Client-side mirror of listing_is_publicly_readable sold branch (for SEO/sitemap helpers).
 * Does not replace RLS — anonymous fetch still gated by the database.
 */
export function isEligiblePublicSoldListing(listing) {
  if (!isSoldListingStatus(listing)) return false
  if (listing?.is_test_data === true) return false
  if (!listing?.published_at) return false
  if (!listing?.sold_at) return false
  if (String(listing?.source ?? '').trim().toLowerCase() === 'import' && !listingHasPublicImageEvidence(listing)) {
    return false
  }
  const slug = String(listing?.slug ?? '').trim()
  if (!slug || slug === 'new') return false
  return true
}
