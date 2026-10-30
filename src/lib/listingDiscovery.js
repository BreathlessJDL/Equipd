/**
 * Listing ↔ Equipment Intelligence mapping and discovery helpers.
 * Node-safe. No fuzzy product matching at render time.
 */

import {
  getBrandPagePath,
  getBrandDisplayName,
  resolveBrandRegistryEntry,
} from './brandCatalogueCore.js'
import { getDefaultCompatibleConsoleName } from './consoleCompatibility.js'
import { resolveCategorySlugForEquipmentType } from './createListingFromEquipment.js'
import {
  buildListingSeoProductName,
  buildListingImageAltText,
} from './listingPageSeo.js'
import {
  calculateEquipmentProductValuation,
  formatValuationMoney,
  getEquipmentProductDisplayName,
  getProductManufacturedFromYear,
} from './equipmentValuation.js'
import { buildEquipmentCanonicalPath } from './equipmentPageSeo.js'
import { buildValuationHref } from './valuationNavigation.js'

export const LISTING_INTELLIGENCE_VALUATION_DISCLAIMER =
  'Indicative valuation based on original equipment pricing, age-based depreciation and applicable model adjustments. Not based on verified completed sales.'

function normalizeWhitespace(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim()
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    .test(String(value ?? '').trim())
}

/**
 * Extract only persisted/explicit product refs — never invent from title text.
 */
export function resolveListingProductMapping(listing) {
  const equipmentProductId = isUuid(listing?.equipment_product_id)
    ? String(listing.equipment_product_id).trim()
    : null
  const canonicalProductKey = normalizeWhitespace(listing?.canonical_product_key) || null

  return {
    equipmentProductId,
    canonicalProductKey,
    hasMapping: Boolean(equipmentProductId || canonicalProductKey),
  }
}

/**
 * Normalize form / payload fields for listing writes.
 * Empty or invalid values become null (unmapped).
 */
export function normalizeListingEquipmentProductWriteFields({
  equipmentProductId = null,
  equipmentProductKey = null,
} = {}) {
  const id = isUuid(equipmentProductId) ? String(equipmentProductId).trim() : null
  const key = normalizeWhitespace(equipmentProductKey) || null
  return {
    equipment_product_id: id,
    canonical_product_key: key,
  }
}

export function getListingEquipmentPagePath(listing, equipmentProduct = null) {
  const key = normalizeWhitespace(equipmentProduct?.canonical_product_key)
    || resolveListingProductMapping(listing).canonicalProductKey
  if (!key) return null
  return buildEquipmentCanonicalPath({ canonical_product_key: key })
}

/**
 * Brand page href only when the brand is in the public brand registry
 * (avoids dead /brands/:slug pages for unknown brands).
 */
export function getListingBrandPageHref(brand) {
  const entry = resolveBrandRegistryEntry(brand)
  if (!entry?.slug) return null
  return getBrandPagePath(entry.slug)
}

export function getListingBrowseTypeHref(listing, equipmentProduct = null) {
  const categorySlug = normalizeWhitespace(listing?.category?.slug)
  if (categorySlug) {
    return `/browse?category=${encodeURIComponent(categorySlug)}`
  }

  const type = normalizeWhitespace(equipmentProduct?.equipment_type)
    || normalizeWhitespace(listing?.equipment_type)
  const resolved = resolveCategorySlugForEquipmentType(type)
  if (!resolved) return null
  return `/browse?category=${encodeURIComponent(resolved)}`
}

export function getListingValuationHref(listing, equipmentProduct = null) {
  const key = normalizeWhitespace(equipmentProduct?.canonical_product_key)
    || resolveListingProductMapping(listing).canonicalProductKey
  if (key) {
    return buildValuationHref({ productKey: key })
  }

  const brand = normalizeWhitespace(listing?.brand) || normalizeWhitespace(equipmentProduct?.brand)
  if (brand) {
    return buildValuationHref({ query: brand })
  }

  return buildValuationHref()
}

/**
 * Natural internal links for listing pages. No SEO dump — only useful destinations.
 */
export function buildListingInternalLinks(listing, equipmentProduct = null) {
  const links = []
  const mapping = resolveListingProductMapping(listing)
  const hasMappedProduct = Boolean(equipmentProduct) || mapping.hasMapping

  const equipmentHref = getListingEquipmentPagePath(listing, equipmentProduct)
  if (hasMappedProduct && equipmentHref) {
    links.push({
      href: equipmentHref,
      label: 'View full product information',
      kind: 'equipment',
    })
  }

  const brandName = normalizeWhitespace(listing?.brand)
    || normalizeWhitespace(equipmentProduct?.brand)
  const brandHref = getListingBrandPageHref(brandName)
  if (brandHref && brandName) {
    links.push({
      href: brandHref,
      label: getBrandDisplayName(brandName),
      kind: 'brand',
    })
  }

  const typeHref = getListingBrowseTypeHref(listing, equipmentProduct)
  const typeLabel = normalizeWhitespace(equipmentProduct?.equipment_type)
    || normalizeWhitespace(listing?.category?.name)
  if (typeHref && typeLabel) {
    links.push({
      href: typeHref,
      label: `Browse ${typeLabel}`,
      kind: 'type-browse',
    })
  }

  links.push({
    href: getListingValuationHref(listing, equipmentProduct),
    label: 'Value this equipment',
    kind: 'valuation',
  })

  return links
}

/**
 * Default console for the earliest supported year — same rule as Equipment Values.
 * Listings do not store a console, so we never infer one from the title.
 */
export function resolveListingIntelligenceConsoleName({
  productConsoleOptions = [],
  manufactureYear,
} = {}) {
  return getDefaultCompatibleConsoleName({
    productConsoleOptions,
    manufactureYear,
  }) || null
}

/**
 * Compact Equipd Intelligence summary for mapped listings only.
 * Shows the catalogue earliest year and the modelled resale value at that year.
 * Never guesses a product from the listing title, and never uses the seller’s price.
 */
export function buildListingIntelligenceSummary(listing, equipmentProduct, {
  productConsoleOptions = [],
  modifiers = [],
  currentYear = new Date().getFullYear(),
} = {}) {
  if (!equipmentProduct) return null

  const status = String(equipmentProduct.status ?? 'approved').toLowerCase()
  if (status !== 'approved') return null

  const mapping = resolveListingProductMapping(listing)
  const key = normalizeWhitespace(equipmentProduct.canonical_product_key)
  if (!mapping.hasMapping || !key) return null

  const name = getEquipmentProductDisplayName(equipmentProduct)
    || normalizeWhitespace(equipmentProduct.canonical_product_name)
  if (!name) return null

  const earliestYear = getProductManufacturedFromYear(equipmentProduct)
  if (earliestYear == null) return null

  const consoleName = resolveListingIntelligenceConsoleName({
    productConsoleOptions,
    manufactureYear: earliestYear,
  })

  const valuation = calculateEquipmentProductValuation(equipmentProduct, {
    condition: 'Good',
    actual_manufacture_year: earliestYear,
    current_year: currentYear,
    console_name: consoleName,
    console_key: consoleName,
    modifiers,
    product_console_options: productConsoleOptions,
  })

  if (!valuation?.ok || Number(valuation.estimated_mid) <= 0) return null

  const currency = valuation.currency || equipmentProduct.original_base_price_currency || 'GBP'
  const brand = normalizeWhitespace(equipmentProduct.brand)

  return {
    name,
    earliestYear,
    estimatedMid: valuation.estimated_mid,
    fields: [
      {
        key: 'earliestYear',
        label: 'Earliest supported model year',
        value: String(earliestYear),
      },
      {
        key: 'earliestValue',
        label: `Estimated resale value for a ${earliestYear} model`,
        value: formatValuationMoney(valuation.estimated_mid, currency),
      },
    ],
    disclaimer: LISTING_INTELLIGENCE_VALUATION_DISCLAIMER,
    equipmentHref: getListingEquipmentPagePath(listing, equipmentProduct),
    valuationHref: getListingValuationHref(listing, equipmentProduct),
    brandHref: brand ? getListingBrandPageHref(brand) : null,
    productName: name,
  }
}

/**
 * Ranking score for similar listings (lower is better). Null = exclude.
 * Priority: same product → same series (sibling ids) → brand+type/category → type/category → recent.
 */
export function getSimilarListingMatchRank(candidate, {
  listingId,
  equipmentProductId = null,
  siblingProductIds = null,
  brand = null,
  categoryId = null,
  equipmentType = null,
} = {}) {
  if (!candidate?.id || candidate.id === listingId) return null

  const status = String(candidate.status ?? 'active').toLowerCase()
  if (status !== 'active') return null
  if (candidate.is_test_data === true) return null

  if (equipmentProductId && candidate.equipment_product_id === equipmentProductId) {
    return 1
  }

  if (
    siblingProductIds
    && candidate.equipment_product_id
    && siblingProductIds.has(candidate.equipment_product_id)
  ) {
    return 2
  }

  const candidateBrand = normalizeWhitespace(candidate.brand)
  const sourceBrand = normalizeWhitespace(brand)
  const brandMatch = Boolean(sourceBrand && candidateBrand
    && sourceBrand.toLowerCase() === candidateBrand.toLowerCase())

  const categoryMatch = Boolean(
    categoryId
    && candidate.category_id
    && String(candidate.category_id) === String(categoryId),
  )

  const type = normalizeWhitespace(equipmentType)
  const candidateType = normalizeWhitespace(candidate.equipment_type)
    || normalizeWhitespace(candidate.category?.name)
  const typeMatch = Boolean(
    type
    && candidateType
    && type.toLowerCase() === candidateType.toLowerCase(),
  )

  if (brandMatch && (categoryMatch || typeMatch)) return 3
  if (categoryMatch || typeMatch) return 4
  return 5
}

/**
 * Sort candidates by similar-listing priority then recency. Used by tests and
 * any client-side fallback; production fetch uses ordered DB batches.
 */
export function rankSimilarListingCandidates(candidates, context, { limit = 12 } = {}) {
  const scored = []
  const seen = new Set()

  for (const candidate of candidates ?? []) {
    if (!candidate?.id || seen.has(candidate.id)) continue
    const rank = getSimilarListingMatchRank(candidate, context)
    if (rank == null) continue
    seen.add(candidate.id)
    const created = Date.parse(candidate.created_at || '') || 0
    scored.push({ candidate, rank, created })
  }

  scored.sort((a, b) => {
    if (a.rank !== b.rank) return a.rank - b.rank
    return b.created - a.created
  })

  return scored.slice(0, Math.max(0, limit)).map((entry) => entry.candidate)
}

export { buildListingImageAltText, buildListingSeoProductName }
