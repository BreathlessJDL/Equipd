/**
 * Shared navigation helpers for the equipment valuator.
 */

export const VALUATION_DETAILS_STEP = 'details'

/**
 * Build a valuator URL.
 * - Selected canonical product → product key + details step
 * - Typed query only → search start with q populated
 * - Empty → generic start page
 */
export function buildValuationHref({
  productKey = null,
  query = null,
  step = null,
} = {}) {
  const key = String(productKey ?? '').trim()
  if (key) {
    const params = new URLSearchParams()
    params.set('product', key)
    params.set('step', step || VALUATION_DETAILS_STEP)
    return `/valuation?${params.toString()}`
  }

  const trimmedQuery = String(query ?? '').trim()
  if (trimmedQuery) {
    return `/valuation?q=${encodeURIComponent(trimmedQuery)}`
  }

  return '/valuation'
}

/**
 * Resolve a selected product from an already-loaded catalogue when possible.
 */
export function resolveValuationProductFromCatalog(products = [], productKey) {
  const key = String(productKey ?? '').trim()
  if (!key || !Array.isArray(products) || !products.length) return null
  return products.find((product) => product?.canonical_product_key === key) || null
}

export function formatCanonicalSuggestionYears(product) {
  const end = Number(product?.production_end_year ?? product?.manufacture_end_year)
  const start = Number(product?.production_start_year)
    || Number(product?.baseline_manufacture_year)

  if (Number.isFinite(start) && Number.isFinite(end) && end !== start) {
    return `${start}–${end}`
  }
  if (Number.isFinite(start) && Number.isFinite(end) && end === start) {
    return String(start)
  }
  if (Number.isFinite(start)) return `${start}+`
  return null
}

export function buildCanonicalSuggestionMeta(product) {
  return [
    product?.brand,
    product?.equipment_type || product?.series,
    formatCanonicalSuggestionYears(product),
  ].filter(Boolean).join(' · ')
}
