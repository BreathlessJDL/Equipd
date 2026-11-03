/**
 * Shared marketplace listing selection for buyer SEO landings and /browse.
 * Node-safe. Uses the same public-visibility rules as browse, not React hiding.
 */

import { EQUIPD_SITE_ORIGIN } from './brandCatalogueCore.js'
import { isActivePublicListingCandidate } from './listingDiscoveryEligibility.js'
import {
  buildListingImageSources,
  LISTING_CARD_IMAGE_SIZES,
  LISTING_CARD_IMAGE_WIDTHS,
} from './listingImageTransforms.js'
import { formatListingLocationCard } from './listingLocation.js'
import { CATEGORY_LISTINGS_FETCH_LIMIT } from './oneRowListingCapacity.js'

export const LANDING_LISTINGS_SEO_LIMIT = CATEGORY_LISTINGS_FETCH_LIMIT

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function listingCategorySlug(listing) {
  return String(listing?.category?.slug || listing?.category_slug || '').trim()
}

function formatGbpFromPence(pence) {
  if (pence == null || Number.isNaN(Number(pence))) return null
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Number(pence) / 100)
}

function listingPublishedTs(listing) {
  return Date.parse(listing?.published_at || listing?.created_at || 0) || 0
}

/**
 * Extra title/search narrowing used by Smith / Leg Press type landings.
 * Matches CategoryLandingPage client filtering.
 */
export function filterListingsForIntent(rows, listingFilter = {}) {
  let next = Array.isArray(rows) ? rows : []
  const search = String(listingFilter.search || '').trim().toLowerCase()
  const searchIn = listingFilter.searchIn

  if (search && Array.isArray(searchIn) && searchIn.length > 0) {
    const compact = search.replace(/\s+/g, '')
    const wordBoundary =
      !search.includes(' ') && compact === search
        ? new RegExp(`\\b${escapeRegExp(search)}\\b`, 'i')
        : null

    next = next.filter((row) => {
      const haystack = searchIn
        .map((field) => String(row?.[field] || ''))
        .join(' ')
        .toLowerCase()
      if (!haystack) return false
      if (wordBoundary) return wordBoundary.test(haystack)
      return haystack.includes(search) || haystack.replace(/\s+/g, '').includes(compact)
    })
  }

  const excludeTitleIncludes = listingFilter.excludeTitleIncludes
  if (Array.isArray(excludeTitleIncludes) && excludeTitleIncludes.length > 0) {
    next = next.filter((row) => {
      const title = String(row?.title || '').toLowerCase()
      return !excludeTitleIncludes.some((needle) => title.includes(String(needle).toLowerCase()))
    })
  }

  return next
}

export function selectPublicLandingListings(
  listings = [],
  listingFilter = {},
  { limit = LANDING_LISTINGS_SEO_LIMIT } = {},
) {
  const rating = String(listingFilter.rating || '').trim()
  const categorySlugs = Array.isArray(listingFilter.categorySlugs)
    ? listingFilter.categorySlugs.map((slug) => String(slug).trim()).filter(Boolean)
    : []
  const slugSet = new Set(categorySlugs)

  let next = (Array.isArray(listings) ? listings : []).filter(isActivePublicListingCandidate)

  if (rating) {
    next = next.filter((listing) => String(listing?.rating || '').trim() === rating)
  }

  if (slugSet.size > 0) {
    next = next.filter((listing) => slugSet.has(listingCategorySlug(listing)))
  }

  next = filterListingsForIntent(next, listingFilter)

  return next
    .slice()
    .sort((a, b) => listingPublishedTs(b) - listingPublishedTs(a))
    .slice(0, Math.max(0, limit))
}

export function mapLandingListingsForSeo(listings = [], { limit = LANDING_LISTINGS_SEO_LIMIT } = {}) {
  return (Array.isArray(listings) ? listings : [])
    .filter((listing) => listing?.slug && listing?.title)
    .slice(0, limit)
    .map((listing) => {
      const imageUrl = listing.primary_image_url
        || listing.listing_images?.[0]?.url
        || null
      const sources = imageUrl
        ? buildListingImageSources(imageUrl, { widths: LISTING_CARD_IMAGE_WIDTHS })
        : null
      return {
        title: String(listing.title).trim(),
        href: `/listings/${listing.slug}`,
        slug: listing.slug,
        priceLabel: formatGbpFromPence(listing.price_pence),
        locationLabel: formatListingLocationCard(listing) || null,
        imageUrl,
        imageSrc: sources?.src || imageUrl,
        imageSrcSet: sources?.srcSet || null,
        imageSizes: sources?.srcSet ? LISTING_CARD_IMAGE_SIZES : null,
      }
    })
}

export function renderLandingListingsHtml({
  listings = [],
  emptyMessage = 'No matching listings are live right now. Browse all equipment or check back soon.',
} = {}) {
  const summaries = mapLandingListingsForSeo(listings)
  if (!summaries.length) {
    return `<p>${escapeHtml(emptyMessage)}</p>`
  }

  const items = summaries.map((listing) => {
    const meta = [listing.priceLabel, listing.locationLabel].filter(Boolean).join(' · ')
    const image = listing.imageSrc
      ? `<img src="${escapeHtml(listing.imageSrc)}"${listing.imageSrcSet ? ` srcset="${escapeHtml(listing.imageSrcSet)}"` : ''}${listing.imageSizes ? ` sizes="${escapeHtml(listing.imageSizes)}"` : ''} alt="" width="300" height="300" loading="lazy" decoding="async" />`
      : ''
    return `<li>
      <a href="${escapeHtml(listing.href)}">${image}<span>${escapeHtml(listing.title)}</span></a>
      ${meta ? `<p>${escapeHtml(meta)}</p>` : ''}
    </li>`
  }).join('')

  return `<ul>${items}</ul>`
}

export function buildListingItemListElement(listings = []) {
  return mapLandingListingsForSeo(listings).map((listing, index) => ({
    '@type': 'ListItem',
    position: index + 1,
    name: listing.title,
    url: `${EQUIPD_SITE_ORIGIN}${listing.href}`,
  }))
}
