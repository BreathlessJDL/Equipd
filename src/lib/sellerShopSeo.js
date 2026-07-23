/**
 * Public seller shop SEO + AggregateRating schema.
 * Only emits rating schema when real public review summary data is visible.
 */

import { EQUIPD_SITE_ORIGIN } from './brandCatalogueCore.js'
import { getSellerShopPath } from './sellerShopUrls.js'
import { buildSocialOpenGraph } from './socialPreview.js'

function normalizeWhitespace(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim()
}

function resolvePublicSellerName(profile) {
  const username = normalizeWhitespace(profile?.username)
  if (username) return username
  const displayName = normalizeWhitespace(profile?.display_name)
  if (displayName) return displayName
  return null
}

export function getSellerShopCanonicalPath(profile) {
  if (!profile) return null
  const path = getSellerShopPath(profile)
  return path?.startsWith('/shop/') ? path : null
}

export function getSellerShopCanonicalUrl(profile) {
  const path = getSellerShopCanonicalPath(profile)
  return path ? `${EQUIPD_SITE_ORIGIN}${path}` : null
}

export function buildSellerShopPageSeo(profile, {
  listingCount = 0,
  reviewSummary = null,
} = {}) {
  const displayName = resolvePublicSellerName(profile) || 'Seller'
  const titleForHook = `${displayName} on Equipd`
  const descriptionBits = [
    `Browse used gym equipment listed by ${displayName} on Equipd.`,
  ]
  if (Number(listingCount) > 0) {
    descriptionBits.push(
      `${listingCount} active listing${listingCount === 1 ? '' : 's'} available.`,
    )
  }
  if (reviewSummary?.reviewCount > 0 && reviewSummary?.averageRating != null) {
    descriptionBits.push(
      `Rated ${Number(reviewSummary.averageRating).toFixed(1)} from ${reviewSummary.reviewCount} review${reviewSummary.reviewCount === 1 ? '' : 's'}.`,
    )
  } else {
    descriptionBits.push('View seller profile, active listings and feedback.')
  }

  const canonicalPath = getSellerShopCanonicalPath(profile)
  const canonicalUrl = getSellerShopCanonicalUrl(profile)
  const description = descriptionBits.join(' ')
  const titleWithSite = `${titleForHook} | Equipd`

  return {
    titleForHook,
    titleWithSite,
    description,
    canonicalPath,
    canonicalUrl,
    openGraph: buildSocialOpenGraph({
      title: titleWithSite,
      description,
      url: canonicalUrl,
      image: normalizeWhitespace(profile?.avatar_url) || null,
      fallbackImage: true,
    }),
  }
}

/**
 * ProfilePage + Person with AggregateRating only when public reviews exist.
 * Does not emit individual Review entities (privacy / self-serving safety).
 */
export function buildSellerShopStructuredData(profile, {
  reviewSummary = null,
  completedSalesCount = null,
} = {}) {
  const displayName = resolvePublicSellerName(profile)
  const url = getSellerShopCanonicalUrl(profile)
  if (!displayName || !url) return null

  const person = {
    '@type': 'Person',
    '@id': `${url}#person`,
    name: displayName,
    url,
  }

  const username = normalizeWhitespace(profile?.username)
  if (username && username !== displayName) person.alternateName = username

  if (Number(completedSalesCount) > 0) {
    person.description = `${displayName} has completed ${completedSalesCount} sale${completedSalesCount === 1 ? '' : 's'} on Equipd.`
  }

  const hasReviews = Number(reviewSummary?.reviewCount) > 0
    && reviewSummary?.averageRating != null
    && Number.isFinite(Number(reviewSummary.averageRating))

  if (hasReviews) {
    person.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: Number(Number(reviewSummary.averageRating).toFixed(1)),
      reviewCount: Number(reviewSummary.reviewCount),
      bestRating: 5,
      worstRating: 1,
    }
  }

  return {
    '@context': 'https://schema.org',
    '@type': 'ProfilePage',
    '@id': `${url}#profile`,
    url,
    name: `${displayName} on Equipd`,
    mainEntity: person,
  }
}
