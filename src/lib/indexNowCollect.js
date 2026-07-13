/**
 * Pure IndexNow URL collectors (no Supabase). Safe for Node tests and scripts.
 */

import {
  buildBrandIndexNowUrl,
  buildEquipmentIndexNowUrl,
  buildListingIndexNowUrl,
  buildLocationIndexNowUrl,
  dedupeIndexNowUrls,
  isEquipmentConfidenceOnlyChange,
  shouldNotifyEquipmentContentChange,
  shouldNotifyEquipmentProductChange,
  shouldNotifyListingChange,
  summarizeIndexNowUrlFamilies,
} from './indexNowCore.js'
import { getBrandSlug, isPublicBrandCatalogueProduct } from './brandCatalogueCore.js'
import { getLocationSlugForArea, LOCATION_PAGES, LOCATION_SLUGS } from './locations.js'

/**
 * Resolve a listing city/area to a public location page slug when one exists.
 * @param {Record<string, unknown> | null | undefined} listing
 */
export function resolveListingLocationPageSlug(listing) {
  const candidates = [
    listing?.city,
    listing?.location_name,
    listing?.location,
  ]
  for (const candidate of candidates) {
    if (candidate == null || !String(candidate).trim()) continue
    const direct = getLocationSlugForArea(candidate)
    if (direct) return direct

    const normalized = String(candidate).trim().toLowerCase()
    for (const slug of LOCATION_SLUGS) {
      const page = LOCATION_PAGES[slug]
      if (page.areas.some((area) => area.trim().toLowerCase() === normalized)) {
        return slug
      }
    }
  }
  return null
}

/**
 * @param {{
 *   previous?: Record<string, unknown> | null,
 *   next?: Record<string, unknown> | null,
 *   action?: 'create' | 'update' | 'delete' | 'images',
 * }} input
 */
export function collectListingIndexNowUrls({ previous = null, next = null, action = 'update' } = {}) {
  const decision = shouldNotifyListingChange({ previous, next, action })
  if (!decision.notify) {
    return { ...decision, urls: [], families: summarizeIndexNowUrlFamilies([]) }
  }

  const urls = []
  const previousSlug = previous?.slug
  const nextSlug = next?.slug

  if (action === 'delete' && previousSlug) {
    urls.push(buildListingIndexNowUrl(previousSlug))
  } else {
    if (previousSlug && previousSlug !== nextSlug) {
      urls.push(buildListingIndexNowUrl(previousSlug))
    }
    if (nextSlug) {
      urls.push(buildListingIndexNowUrl(nextSlug))
    } else if (previousSlug) {
      urls.push(buildListingIndexNowUrl(previousSlug))
    }
  }

  const previousLocation = resolveListingLocationPageSlug(previous)
  const nextLocation = resolveListingLocationPageSlug(next)
  if (previousLocation) urls.push(buildLocationIndexNowUrl(previousLocation))
  if (nextLocation && nextLocation !== previousLocation) {
    urls.push(buildLocationIndexNowUrl(nextLocation))
  }

  const unique = dedupeIndexNowUrls(urls)
  return {
    ...decision,
    urls: unique,
    families: summarizeIndexNowUrlFamilies(unique),
  }
}

/**
 * @param {{
 *   previous?: Record<string, unknown> | null,
 *   next?: Record<string, unknown> | null,
 *   action?: string,
 *   includeBrandDirectory?: boolean,
 * }} input
 */
export function collectEquipmentIndexNowUrls({
  previous = null,
  next = null,
  action = 'update',
  includeBrandDirectory = false,
} = {}) {
  if (isEquipmentConfidenceOnlyChange(previous, next)) {
    return { notify: false, reason: 'equipment_confidence_only', urls: [] }
  }

  const decision = shouldNotifyEquipmentProductChange({
    previous,
    next,
    action,
    publicEligible: isPublicBrandCatalogueProduct,
  })

  if (!decision.notify) {
    return { ...decision, urls: [] }
  }

  const urls = []
  const previousKey = previous?.canonical_product_key
  const nextKey = next?.canonical_product_key

  if (previousKey && previousKey !== nextKey) {
    urls.push(buildEquipmentIndexNowUrl(previousKey))
  }
  if (nextKey) {
    urls.push(buildEquipmentIndexNowUrl(nextKey))
  } else if (previousKey) {
    urls.push(buildEquipmentIndexNowUrl(previousKey))
  }

  const brand = next?.brand || previous?.brand
  const brandSlug = getBrandSlug(brand)
  if (brandSlug) {
    urls.push(buildBrandIndexNowUrl(brandSlug))
  }
  if (includeBrandDirectory) {
    urls.push(buildBrandIndexNowUrl(null))
  }

  return {
    ...decision,
    urls: dedupeIndexNowUrls(urls),
    families: summarizeIndexNowUrlFamilies(urls),
  }
}

/**
 * @param {{
 *   rows?: Array<Record<string, unknown>>,
 *   action?: string,
 * }} input
 */
export function collectEquipmentContentIndexNowUrls({ rows = [], action = 'publish' } = {}) {
  const urls = []
  const reasons = []

  for (const row of rows) {
    const previous = action === 'publish'
      ? { ...row, generation_status: 'draft' }
      : row
    const next = action === 'publish'
      ? { ...row, generation_status: 'approved' }
      : row
    const decision = shouldNotifyEquipmentContentChange({ previous, next, action })
    if (!decision.notify) continue
    reasons.push(decision.reason)
    const key = row.canonical_product_key || row.equipment_products?.canonical_product_key
    const url = buildEquipmentIndexNowUrl(key)
    if (url) urls.push(url)
    const brand = row.brand || row.equipment_products?.brand
    const brandSlug = getBrandSlug(brand)
    if (brandSlug) urls.push(buildBrandIndexNowUrl(brandSlug))
  }

  const unique = dedupeIndexNowUrls(urls)
  const families = summarizeIndexNowUrlFamilies(unique)
  return {
    notify: unique.length > 0,
    reason: reasons[0] || 'equipment_content_noop',
    urls: unique,
    families,
    brandUrlCount: families.brands + families.brandDirectory,
  }
}
