/**
 * Listing ↔ Equipment Intelligence mapping and discovery helpers.
 * Node-safe. No fuzzy product matching at render time.
 */

import {
  getBrandPagePath,
  getBrandDisplayName,
  getProductSeriesLabel,
  resolveBrandRegistryEntry,
} from './brandCatalogueCore.js'
import { resolveCategorySlugForEquipmentType } from './createListingFromEquipment.js'
import {
  buildListingSeoProductName,
  buildListingImageAltText,
} from './listingPageSeo.js'
import {
  calculateEquipmentProductValuation,
  formatProductProductionYears,
  formatValuationMoney,
  formatValuationRange,
  getEquipmentProductDisplayName,
  productHasValuationRrp,
} from './equipmentValuation.js'
import { buildEquipmentCanonicalPath } from './equipmentPageSeo.js'
import { buildValuationHref } from './valuationNavigation.js'

const LISTING_TO_VALUATION_CONDITION = {
  new: 'Excellent',
  like_new: 'Excellent',
  good: 'Good',
  fair: 'Fair',
  poor: 'Poor',
}

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

function mapListingConditionToValuationCondition(condition) {
  const key = String(condition ?? '').trim().toLowerCase()
  return LISTING_TO_VALUATION_CONDITION[key] || 'Good'
}

/**
 * Concise Equipd Intelligence summary for mapped listings only.
 * Hides missing/unreliable fields. Never uses listing price as market value.
 */
export function buildListingIntelligenceSummary(listing, equipmentProduct) {
  if (!equipmentProduct) return null

  const status = String(equipmentProduct.status ?? 'approved').toLowerCase()
  if (status !== 'approved') return null

  const mapping = resolveListingProductMapping(listing)
  const key = normalizeWhitespace(equipmentProduct.canonical_product_key)
  if (!mapping.hasMapping || !key) return null

  const name = getEquipmentProductDisplayName(equipmentProduct)
    || normalizeWhitespace(equipmentProduct.canonical_product_name)
  if (!name) return null

  const fields = []
  fields.push({ key: 'name', label: 'Product', value: name })

  const brand = normalizeWhitespace(equipmentProduct.brand)
  if (brand) fields.push({ key: 'brand', label: 'Brand', value: getBrandDisplayName(brand) })

  const type = normalizeWhitespace(equipmentProduct.equipment_type)
  if (type && type.toLowerCase() !== 'unknown') {
    fields.push({ key: 'type', label: 'Equipment type', value: type })
  }

  const series = getProductSeriesLabel(equipmentProduct)
  if (series) fields.push({ key: 'series', label: 'Series', value: series })

  const currency = equipmentProduct.original_base_price_currency || 'GBP'
  if (productHasValuationRrp(equipmentProduct)) {
    fields.push({
      key: 'rrp',
      label: 'Original RRP',
      value: formatValuationMoney(equipmentProduct.original_base_price, currency),
    })
  }

  const productionRange = formatProductProductionYears(equipmentProduct)
  if (productionRange) {
    fields.push({ key: 'production', label: 'Production years', value: productionRange })
  } else {
    const baseline = Number(equipmentProduct.baseline_manufacture_year)
    if (Number.isFinite(baseline) && baseline > 0) {
      fields.push({ key: 'year', label: 'Manufacture year', value: String(baseline) })
    }
  }

  const valuation = calculateEquipmentProductValuation(equipmentProduct, {
    condition: mapListingConditionToValuationCondition(listing?.condition),
  })
  if (
    valuation?.ok
    && Number(valuation.estimated_mid) > 0
    && Number(valuation.estimated_low) > 0
    && Number(valuation.estimated_high) > 0
  ) {
    fields.push({
      key: 'market',
      label: 'Estimated used market value',
      value: formatValuationRange(
        valuation.estimated_low,
        valuation.estimated_high,
        valuation.currency || currency,
      ),
      note: 'Equipd estimate — not the seller’s asking price.',
    })
  }

  const equipmentHref = getListingEquipmentPagePath(listing, equipmentProduct)
  const valuationHref = getListingValuationHref(listing, equipmentProduct)
  const brandHref = brand ? getListingBrandPageHref(brand) : null

  return {
    name,
    fields,
    disclaimer:
      'Equipment information provided by Equipd Intelligence and independent of the seller’s listing.',
    equipmentHref,
    valuationHref,
    brandHref,
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
