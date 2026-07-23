/**
 * Listing page SEO metadata and image alt helpers.
 * Node-safe (no DOM / Supabase). Sellers do not enter separate SEO text.
 */

import { EQUIPD_SITE_ORIGIN } from './brandCatalogueCore.js'
import { formatListingLocationCard } from './listingLocation.js'
import {
  getSoldListingIndexingState,
  isEligiblePublicSoldListing,
  isSoldListingStatus,
} from './listingSoldLifecycle.js'
import { buildSocialOpenGraph, getEquipdDefaultSocialImageUrl } from './socialPreview.js'

const CONDITION_LABELS = {
  new: 'New',
  like_new: 'Like new',
  good: 'Good',
  fair: 'Fair',
  poor: 'Poor',
}

function normalizeWhitespace(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim()
}

function collapseDuplicateSpaces(value) {
  return normalizeWhitespace(value)
}

function getConditionLabel(value) {
  if (!value) return null
  return CONDITION_LABELS[value] ?? String(value)
}

function formatPricePence(pence) {
  if (pence == null || Number.isNaN(Number(pence))) return null
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Number(pence) / 100)
}

/**
 * Prefer already-enriched image URLs (listing detail / cards). Does not call Storage.
 */
export function resolveListingSocialImageUrl(listing) {
  if (!listing) return null
  if (listing.primary_image_url) return listing.primary_image_url
  const first = listing.listing_images?.[0]
  if (!first) return null
  return first.url || null
}

/**
 * Case-insensitive phrase presence for avoiding duplicated brand/type/used wording.
 */
export function textIncludesPhrase(haystack, needle) {
  const hay = normalizeWhitespace(haystack).toLowerCase()
  const needleNorm = normalizeWhitespace(needle).toLowerCase()
  if (!hay || !needleNorm) return false
  return hay.includes(needleNorm)
}

function stripLeadingUsed(value) {
  return normalizeWhitespace(value).replace(/^used\s+/i, '')
}

function stripTrailingForSale(value) {
  return normalizeWhitespace(value).replace(/\s+for\s+sale$/i, '')
}

/**
 * Prefer canonical product display name when a mapped equipment product is provided.
 */
function resolveCanonicalProductName(equipmentProduct) {
  if (!equipmentProduct) return null
  return (
    normalizeWhitespace(equipmentProduct.displayName)
    || normalizeWhitespace(equipmentProduct.canonical_product_name)
    || normalizeWhitespace(equipmentProduct.publicName)
    || null
  )
}

function resolveEquipmentType(listing, equipmentProduct) {
  return (
    normalizeWhitespace(equipmentProduct?.equipment_type)
    || normalizeWhitespace(equipmentProduct?.equipmentType)
    || normalizeWhitespace(listing?.category?.name)
    || normalizeWhitespace(listing?.equipment_type)
    || null
  )
}

/**
 * Build the core product phrase used in titles and alts.
 * Priority: brand + model / canonical name → cleaned seller title; then type if helpful.
 */
export function buildListingSeoProductName(listing, equipmentProduct = null) {
  const brand = normalizeWhitespace(listing?.brand)
  const model = normalizeWhitespace(listing?.model)
  const canonical = resolveCanonicalProductName(equipmentProduct)
  const sellerTitle = stripTrailingForSale(stripLeadingUsed(listing?.title))
  const equipmentType = resolveEquipmentType(listing, equipmentProduct)

  let core = null

  if (canonical) {
    core = brand && !textIncludesPhrase(canonical, brand)
      ? `${brand} ${canonical}`
      : canonical
  } else if (brand && model) {
    core = textIncludesPhrase(model, brand) ? model : `${brand} ${model}`
  } else if (model) {
    core = model
  } else if (brand && sellerTitle) {
    core = textIncludesPhrase(sellerTitle, brand) ? sellerTitle : `${brand} ${sellerTitle}`
  } else if (sellerTitle) {
    core = sellerTitle
  } else if (brand) {
    core = brand
  }

  if (!core) return null

  if (
    equipmentType
    && !textIncludesPhrase(core, equipmentType)
    && equipmentType.length <= 40
  ) {
    core = `${core} ${equipmentType}`
  }

  return collapseDuplicateSpaces(core)
}

/**
 * Hook title (without "| Equipd" — usePageTitle / formatPageTitle adds the site name).
 * Active example: "Used ProForm Tour de France CLC Exercise Bike for Sale"
 * Sold example: "Sold ProForm Tour de France CLC Exercise Bike"
 */
export function buildListingPageSeoTitle(listing, {
  equipmentProduct = null,
  sold = false,
} = {}) {
  const productName = buildListingSeoProductName(listing, equipmentProduct)
  const fallback = stripTrailingForSale(stripLeadingUsed(listing?.title)) || 'Gym Equipment'
  const base = stripTrailingForSale(stripLeadingUsed(productName || fallback))

  if (sold) {
    const soldTitle = textIncludesPhrase(base, 'sold') ? base : `Sold ${base}`
    return collapseDuplicateSpaces(soldTitle)
  }

  let title = textIncludesPhrase(base, 'used') ? base : `Used ${base}`
  if (!textIncludesPhrase(title, 'for sale')) {
    title = `${title} for Sale`
  }

  return collapseDuplicateSpaces(title)
}

/**
 * Natural unique meta description from available listing fields only.
 */
export function buildListingPageMetaDescription(listing, {
  equipmentProduct = null,
  sold = false,
} = {}) {
  const productName = buildListingSeoProductName(listing, equipmentProduct)
    || stripLeadingUsed(listing?.title)
    || 'this gym equipment'
  const condition = getConditionLabel(listing?.condition)
  const location = formatListingLocationCard(listing)
  const priceLabel = listing?.price_pence != null && Number(listing.price_pence) > 0
    ? formatPricePence(listing.price_pence)
    : null

  const bits = []

  if (sold) {
    bits.push(`This ${stripLeadingUsed(productName)} has now sold on Equipd.`)
    if (condition) bits.push(`It was listed in ${String(condition).toLowerCase()} condition.`)
    bits.push('Browse similar equipment currently available, or value this equipment on Equipd.')
  } else {
    const lead = [`Buy this used ${stripLeadingUsed(productName)}`]
    if (condition) lead.push(`in ${String(condition).toLowerCase()} condition`)
    if (location) lead.push(`in ${location}`)
    if (priceLabel) lead.push(`for ${priceLabel}`)
    bits.push(`${collapseDuplicateSpaces(lead.join(' '))}.`)
    bits.push('View photos, buy securely with Buyer Protection, or make an offer on Equipd.')
  }

  return collapseDuplicateSpaces(bits.join(' '))
}

/**
 * Preferred alt: "Used {Brand} {Model} {Equipment Type}" with cleaned title fallback.
 */
export function buildListingImageAltText(listing, {
  equipmentProduct = null,
  photoIndex = null,
} = {}) {
  const productName = buildListingSeoProductName(listing, equipmentProduct)
  const fallback = stripTrailingForSale(stripLeadingUsed(listing?.title)) || 'Gym equipment'
  let alt = productName || fallback
  if (!textIncludesPhrase(alt, 'used')) {
    alt = `Used ${alt}`
  }
  alt = collapseDuplicateSpaces(alt)
  if (photoIndex != null && Number(photoIndex) > 0) {
    alt = `${alt} — photo ${Number(photoIndex) + 1}`
  }
  return alt
}

export function getListingCanonicalPath(listing) {
  const slug = normalizeWhitespace(listing?.slug)
  if (!slug) return null
  return `/listings/${slug}`
}

export function getListingCanonicalUrl(listing) {
  const path = getListingCanonicalPath(listing)
  if (!path) return null
  return `${EQUIPD_SITE_ORIGIN}${path}`
}

function isListingIndexable(listing, now = new Date()) {
  if (!listing?.slug) return false
  const status = String(listing.status || '').toLowerCase()
  if (status === 'active') return true
  if (status === 'sold' && isEligiblePublicSoldListing(listing)) {
    return getSoldListingIndexingState({ soldAt: listing.sold_at, now }).indexable
  }
  return false
}

/**
 * Full listing SEO bundle for usePageMeta.
 */
export function buildListingPageSeo({ listing, equipmentProduct = null, now = new Date() } = {}) {
  if (!listing) {
    return {
      titleForHook: 'Listing Not Found',
      description: 'This listing could not be found on Equipd.',
      canonicalPath: null,
      canonicalUrl: null,
      noIndex: true,
      robotsContent: 'noindex, follow',
      openGraph: null,
      imageAlt: 'Gym equipment',
      socialImage: null,
      indexable: false,
    }
  }

  const sold = isSoldListingStatus(listing)
  const titleForHook = buildListingPageSeoTitle(listing, { equipmentProduct, sold })
  const description = buildListingPageMetaDescription(listing, { equipmentProduct, sold })
  const canonicalPath = getListingCanonicalPath(listing)
  const canonicalUrl = getListingCanonicalUrl(listing)
  const socialImage = resolveListingSocialImageUrl(listing)
  const soldIndexing = sold
    ? getSoldListingIndexingState({ soldAt: listing.sold_at, now })
    : null
  const indexable = isListingIndexable(listing, now)
  const robotsContent = sold
    ? (isEligiblePublicSoldListing(listing) ? soldIndexing.robotsContent : 'noindex, follow')
    : (indexable ? 'index, follow' : 'noindex, follow')
  const titleWithSite = `${titleForHook} | Equipd`
  const resolvedSocialImage = socialImage || getEquipdDefaultSocialImageUrl()

  return {
    titleForHook,
    titleWithSite,
    description,
    canonicalPath,
    canonicalUrl,
    noIndex: !indexable,
    robotsContent,
    openGraph: buildSocialOpenGraph({
      title: titleWithSite,
      description,
      url: canonicalUrl,
      image: resolvedSocialImage,
      fallbackImage: true,
    }),
    imageAlt: buildListingImageAltText(listing, { equipmentProduct }),
    socialImage: resolvedSocialImage,
    indexable,
    sold,
  }
}
