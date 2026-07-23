/**
 * Marketplace listing Product + Offer JSON-LD.
 * Node-safe. Do not reuse catalogue equipment Product builders here —
 * catalogue Product schema belongs only on equipment URLs.
 */

import {
  buildListingPageMetaDescription,
  buildListingSeoProductName,
  getListingCanonicalUrl,
} from './listingPageSeo.js'

/** Equipd listing condition → Schema.org itemCondition URL. Exhaustive for LISTING_CONDITIONS. */
export const LISTING_CONDITION_SCHEMA_URLS = Object.freeze({
  new: 'https://schema.org/NewCondition',
  like_new: 'https://schema.org/UsedCondition',
  good: 'https://schema.org/UsedCondition',
  fair: 'https://schema.org/UsedCondition',
  poor: 'https://schema.org/UsedCondition',
})

const SCHEMA_ORG = 'https://schema.org'
const MAX_SCHEMA_DESCRIPTION_CHARS = 5000

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
 * Map Equipd condition enum to Schema.org URL. Unknown values → null (omit, do not guess).
 */
export function mapListingConditionToSchemaOrg(condition) {
  const key = String(condition ?? '').trim().toLowerCase()
  if (!key) return null
  return LISTING_CONDITION_SCHEMA_URLS[key] ?? null
}

/**
 * Public absolute listing image URLs for schema, primary first, deduped.
 * Only uses already-enriched http(s) URLs — never raw storage paths.
 */
export function resolveListingSchemaImageUrls(listing) {
  const urls = []
  const seen = new Set()

  function push(url) {
    const trimmed = normalizeWhitespace(url)
    if (!isHttpUrl(trimmed) || seen.has(trimmed)) return
    seen.add(trimmed)
    urls.push(trimmed)
  }

  push(listing?.primary_image_url)

  const images = Array.isArray(listing?.listing_images) ? [...listing.listing_images] : []
  images.sort((a, b) => {
    const aOrder = Number(a?.sort_order)
    const bOrder = Number(b?.sort_order)
    const aOk = Number.isFinite(aOrder)
    const bOk = Number.isFinite(bOrder)
    if (aOk && bOk) return aOrder - bOrder
    if (aOk) return -1
    if (bOk) return 1
    return 0
  })

  for (const image of images) {
    push(image?.url)
  }

  return urls
}

/**
 * Asking price in major currency units for Schema.org / Google (string).
 * Uses listing price_pence only — never Buyer Protection, delivery, valuation, or RRP.
 */
export function formatListingOfferPrice(listing) {
  const pence = Number(listing?.price_pence)
  if (!Number.isFinite(pence) || pence <= 0) return null
  const pounds = pence / 100
  return Number.isInteger(pounds) ? String(pounds) : pounds.toFixed(2)
}

export const LISTING_OFFER_CURRENCY = 'GBP'

/**
 * Reliable public seller display name only (username or display_name).
 * Omits email-derived and generic "Equipd member" fallbacks.
 */
export function resolveListingSchemaSellerName(sellerProfile) {
  if (!sellerProfile || typeof sellerProfile !== 'object') return null
  const username = normalizeWhitespace(sellerProfile.username)
  if (username) return username
  const displayName = normalizeWhitespace(sellerProfile.display_name)
  if (displayName) return displayName
  return null
}

/**
 * Active + positive asking price + available inventory (when known).
 * Fully reserved (quantity_available === 0) is not purchasable even if status lags.
 * Missing quantity_available on an active listing follows page behaviour (offer/message allowed).
 */
export function isListingGenuinelyPurchasable(listing) {
  if (!listing) return false
  const status = String(listing.status ?? '').trim().toLowerCase()
  if (status !== 'active') return false

  const pence = Number(listing.price_pence)
  if (!Number.isFinite(pence) || pence <= 0) return false

  if (listing.quantity_available == null) return true

  const available = Number(listing.quantity_available)
  if (!Number.isFinite(available) || available <= 0) return false

  return true
}

function resolveListingSchemaName(listing, equipmentProduct) {
  const structured = buildListingSeoProductName(listing, equipmentProduct)
  if (structured) return structured
  const title = normalizeWhitespace(listing?.title)
  return title || null
}

function resolveListingSchemaDescription(listing, equipmentProduct) {
  const sellerDescription = normalizeWhitespace(listing?.description)
  if (sellerDescription) {
    if (sellerDescription.length <= MAX_SCHEMA_DESCRIPTION_CHARS) return sellerDescription
    return `${sellerDescription.slice(0, MAX_SCHEMA_DESCRIPTION_CHARS - 1).trimEnd()}…`
  }

  // Fallback only from visible listing facts via Stage 1 helper (no invented claims).
  return buildListingPageMetaDescription(listing, {
    equipmentProduct,
    sold: String(listing?.status ?? '').toLowerCase() === 'sold',
  })
}

function resolveListingSchemaBrand(listing, equipmentProduct) {
  return (
    normalizeWhitespace(listing?.brand)
    || normalizeWhitespace(equipmentProduct?.brand)
    || null
  )
}

function resolveListingSchemaModel(listing, equipmentProduct) {
  return (
    normalizeWhitespace(listing?.model)
    || normalizeWhitespace(equipmentProduct?.model)
    || null
  )
}

function resolveListingSchemaCategory(listing, equipmentProduct) {
  return (
    normalizeWhitespace(equipmentProduct?.equipment_type)
    || normalizeWhitespace(equipmentProduct?.equipmentType)
    || normalizeWhitespace(listing?.category?.name)
    || normalizeWhitespace(listing?.equipment_type)
    || null
  )
}

export function buildListingSellerSchema(sellerProfile) {
  const name = resolveListingSchemaSellerName(sellerProfile)
  if (!name) return null
  return {
    '@type': 'Person',
    name,
  }
}

/**
 * Offer for a genuinely purchasable active listing. Null otherwise.
 * Stage 5 may extend sold handling without inventing SoldOut here.
 */
export function buildListingOfferSchema({
  listing,
  canonicalUrl,
  sellerProfile = null,
} = {}) {
  if (!isListingGenuinelyPurchasable(listing)) return null

  const url = canonicalUrl || getListingCanonicalUrl(listing)
  if (!url) return null

  const price = formatListingOfferPrice(listing)
  if (!price) return null

  const offer = {
    '@type': 'Offer',
    '@id': `${url}#offer`,
    url,
    price,
    priceCurrency: LISTING_OFFER_CURRENCY,
    availability: `${SCHEMA_ORG}/InStock`,
  }

  const itemCondition = mapListingConditionToSchemaOrg(listing.condition)
  if (itemCondition) {
    offer.itemCondition = itemCondition
  }

  const seller = buildListingSellerSchema(sellerProfile)
  if (seller) {
    offer.seller = seller
  }

  return offer
}

/**
 * One marketplace-listing Product entity. Never emits catalogue equipment Product fields/URLs.
 *
 * @param {{ listing: object, equipmentProduct?: object|null, canonicalUrl?: string|null, sellerProfile?: object|null }} args
 */
export function buildListingProductSchema({
  listing,
  equipmentProduct = null,
  canonicalUrl = null,
  sellerProfile = null,
} = {}) {
  if (!listing) return null

  const url = canonicalUrl || getListingCanonicalUrl(listing)
  if (!url) return null

  const name = resolveListingSchemaName(listing, equipmentProduct)
  if (!name) return null

  const product = {
    '@context': SCHEMA_ORG,
    '@type': 'Product',
    '@id': `${url}#product`,
    url,
    name,
  }

  const description = resolveListingSchemaDescription(listing, equipmentProduct)
  if (description) {
    product.description = description
  }

  const images = resolveListingSchemaImageUrls(listing)
  if (images.length === 1) {
    product.image = images[0]
  } else if (images.length > 1) {
    product.image = images
  }

  const brandName = resolveListingSchemaBrand(listing, equipmentProduct)
  if (brandName) {
    product.brand = {
      '@type': 'Brand',
      name: brandName,
    }
  }

  const model = resolveListingSchemaModel(listing, equipmentProduct)
  if (model) {
    product.model = model
  }

  const category = resolveListingSchemaCategory(listing, equipmentProduct)
  if (category) {
    product.category = category
  }

  const itemCondition = mapListingConditionToSchemaOrg(listing.condition)
  if (itemCondition) {
    product.itemCondition = itemCondition
  }

  const offer = buildListingOfferSchema({
    listing,
    canonicalUrl: url,
    sellerProfile,
  })
  if (offer) {
    product.offers = offer
  }

  // Intentionally omit: sku, gtin, mpn, aggregateRating, review.
  // Catalogue valuation / RRP must never appear as offers.price.
  return product
}

/**
 * Listing page structured-data bundle for Product + Breadcrumb coexistence tests.
 * Breadcrumb construction stays in breadcrumbStructuredData.buildListingBreadcrumbSchema.
 */
export function buildListingPageStructuredData({
  listing,
  equipmentProduct = null,
  canonicalUrl = null,
  sellerProfile = null,
  breadcrumbSchema = null,
} = {}) {
  const product = buildListingProductSchema({
    listing,
    equipmentProduct,
    canonicalUrl,
    sellerProfile,
  })

  const nodes = [product, breadcrumbSchema].filter(Boolean)
  const products = nodes.filter((node) => node?.['@type'] === 'Product')
  const breadcrumbs = nodes.filter((node) => node?.['@type'] === 'BreadcrumbList')

  return {
    product,
    breadcrumb: breadcrumbSchema,
    jsonLd: nodes,
    productCount: products.length,
    breadcrumbCount: breadcrumbs.length,
  }
}

/** True when a Product @id is a marketplace listing, not a catalogue equipment URL. */
export function isMarketplaceListingProductSchema(schema) {
  if (!schema || schema['@type'] !== 'Product') return false
  const id = String(schema['@id'] ?? '')
  const url = String(schema.url ?? '')
  return /\/listings\/[^/#]+#product$/.test(id) || /\/listings\/[^/#]+$/.test(url)
}

/** Guard: catalogue Product uses /brands/.../ or equipment paths, not /listings/. */
export function looksLikeCatalogueProductSchema(schema) {
  if (!schema || schema['@type'] !== 'Product') return false
  const id = String(schema['@id'] ?? '')
  const url = String(schema.url ?? '')
  if (/\/listings\//.test(id) || /\/listings\//.test(url)) return false
  return /\/brands\//.test(id) || /\/brands\//.test(url) || /#product$/.test(id)
}
