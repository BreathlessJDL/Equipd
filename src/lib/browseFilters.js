/**
 * Browse/search filter URL state, active chips, and query helpers.
 */

import {
  applyBrowseLocationToSearchParams,
  BROWSE_RADIUS_OPTIONS,
  BROWSE_RADIUS_UK_WIDE,
  isValidCoordinate,
  normalizeBuyerCoordinates,
  parseBrowseLocationFromSearchParams,
  parseBrowseRadiusMiles,
} from './listingDistance.js'
import { BROWSE_SORT_OPTIONS, DEFAULT_LISTING_SORT, parseListingSort } from './listingSort.js'

export const BROWSE_FILTER_EMPTY_MESSAGE =
  'No listings found. Try increasing your radius or clearing filters.'

const BROWSE_PARAM_KEYS = [
  'search',
  'category',
  'brand',
  'condition',
  'rating',
  'minPrice',
  'maxPrice',
  'sort',
  'location',
  'lat',
  'lng',
  'radius',
]

const CONDITION_LABELS = {
  new: 'New',
  like_new: 'Like new',
  good: 'Good',
  fair: 'Fair',
  poor: 'Poor',
}

const RATING_LABELS = {
  full_commercial: 'Full commercial',
  light_commercial: 'Light commercial',
  home_use: 'Home use',
}

function parseBrowsePriceToPence(priceInput) {
  if (priceInput === '' || priceInput == null) return null

  const pounds = Number(String(priceInput).replace(/,/g, '').trim())
  if (!Number.isFinite(pounds) || pounds <= 0) return null

  return Math.round(pounds * 100)
}

function parseRepeatedParam(searchParams, key) {
  const values = searchParams
    .getAll(key)
    .flatMap((entry) => entry.split(',').map((part) => part.trim()))
    .filter(Boolean)

  return [...new Set(values)]
}

function normalizeStringArray(values = [], legacyValue = '') {
  const normalized = (Array.isArray(values) ? values : [])
    .map((value) => String(value).trim())
    .filter(Boolean)

  if (normalized.length > 0) {
    return [...new Set(normalized)]
  }

  const legacy = String(legacyValue ?? '').trim()
  return legacy ? [legacy] : []
}

export function summarizeBrowseFilterValues(labels, { maxShown = 2, emptyLabel = 'All' } = {}) {
  const items = labels.filter(Boolean)
  if (items.length === 0) return emptyLabel
  if (items.length <= maxShown) return items.join(', ')
  return `${items.length} selected`
}

export function parseBrowseFiltersFromSearchParams(searchParams, categories = []) {
  const location = parseBrowseLocationFromSearchParams(searchParams)
  const categorySlugs = parseRepeatedParam(searchParams, 'category')
  const categoryIds = categorySlugs
    .map((slug) => categories.find((category) => category.slug === slug)?.id)
    .filter(Boolean)
  const brands = parseRepeatedParam(searchParams, 'brand')
  const conditions = parseRepeatedParam(searchParams, 'condition')

  return {
    search: searchParams.get('search') ?? '',
    brands,
    brand: brands[0] ?? '',
    conditions,
    condition: conditions[0] ?? '',
    rating: searchParams.get('rating') ?? '',
    minPrice: searchParams.get('minPrice') ?? '',
    maxPrice: searchParams.get('maxPrice') ?? '',
    categoryIds,
    categoryId: categoryIds[0] ?? '',
    categorySlug: categorySlugs[0] ?? '',
    categorySlugs,
    sort: parseListingSort(searchParams.get('sort'), {
      hasLocationSearch: location.buyerLatitude != null && location.buyerLongitude != null,
      allowNearestWithoutLocation: true,
    }),
    ...location,
  }
}

export function applyBrowseFiltersToSearchParams(
  searchParams,
  filters,
  categories = [],
  { profileCoordinates = null } = {},
) {
  for (const key of BROWSE_PARAM_KEYS) {
    searchParams.delete(key)
  }

  const trimmedSearch = filters.search?.trim()
  if (trimmedSearch) searchParams.set('search', trimmedSearch)

  const brands = normalizeStringArray(filters.brands, filters.brand)
  for (const brand of brands) {
    searchParams.append('brand', brand)
  }

  const conditions = normalizeStringArray(filters.conditions, filters.condition)
  for (const condition of conditions) {
    searchParams.append('condition', condition)
  }

  if (filters.rating) searchParams.set('rating', filters.rating)

  if (filters.minPrice?.trim()) searchParams.set('minPrice', filters.minPrice.trim())
  if (filters.maxPrice?.trim()) searchParams.set('maxPrice', filters.maxPrice.trim())

  const categoryIds = normalizeStringArray(filters.categoryIds, filters.categoryId)
  for (const categoryId of categoryIds) {
    const category = categories.find((entry) => entry.id === categoryId)
    if (category?.slug) searchParams.append('category', category.slug)
  }

  if (categoryIds.length === 0 && filters.categorySlug) {
    searchParams.append('category', filters.categorySlug)
  }

  const hasLocationSearch = hasBrowseLocationForSort(filters, profileCoordinates)
  const sort = parseListingSort(filters.sort, {
    hasLocationSearch,
    allowNearestWithoutLocation: true,
  })
  if (sort && sort !== DEFAULT_LISTING_SORT) {
    searchParams.set('sort', sort)
  }

  applyBrowseLocationToSearchParams(searchParams, {
    locationSearch: filters.locationSearch ?? '',
    locationPlace:
      filters.locationPlace ??
      (filters.buyerLatitude != null && filters.buyerLongitude != null
        ? {
            displayLabel: filters.locationSearch?.trim() || 'Selected location',
            latitude: filters.buyerLatitude,
            longitude: filters.buyerLongitude,
          }
        : null),
    radiusMiles: filters.radiusMiles ?? BROWSE_RADIUS_UK_WIDE,
  })

  return searchParams
}

export function buildBrowseQueryOptions(filters, { locationAreas = [], profileCoordinates = null } = {}) {
  const minPricePence = parseBrowsePriceToPence(filters.minPrice)
  const maxPricePence = parseBrowsePriceToPence(filters.maxPrice)
  const radiusMiles =
    filters.radiusMilesValue ?? parseBrowseRadiusMiles(filters.radiusMiles)
  const categoryIds = normalizeStringArray(filters.categoryIds, filters.categoryId)
  const brands = normalizeStringArray(filters.brands, filters.brand)
  const conditions = normalizeStringArray(filters.conditions, filters.condition)

  const buyerCoordinates = resolveBrowseBuyerCoordinates(filters, profileCoordinates)

  return {
    search: filters.search?.trim() ?? '',
    categoryIds,
    categoryId: categoryIds[0] ?? '',
    conditions,
    condition: conditions[0] ?? '',
    brands,
    brand: brands[0] ?? '',
    rating: filters.rating ?? '',
    minPricePence,
    maxPricePence,
    locationAreas,
    buyerLatitude: buyerCoordinates.latitude,
    buyerLongitude: buyerCoordinates.longitude,
    radiusMiles,
    sort: filters.sort ?? DEFAULT_LISTING_SORT,
  }
}

export function resolveBrowseBuyerCoordinates(filters, profileCoordinates = null) {
  if (filters?.buyerLatitude != null && filters?.buyerLongitude != null) {
    const buyer = normalizeBuyerCoordinates({
      latitude: filters.buyerLatitude,
      longitude: filters.buyerLongitude,
    })
    if (buyer) return buyer
  }

  if (filters?.sort === 'nearest') {
    const profileBuyer = normalizeBuyerCoordinates(profileCoordinates)
    if (profileBuyer) return profileBuyer
  }

  return { latitude: null, longitude: null }
}

export function hasBrowseLocationForSort(filters, profileCoordinates = null) {
  const { latitude, longitude } = resolveBrowseBuyerCoordinates(filters, profileCoordinates)
  return isValidCoordinate(latitude) && isValidCoordinate(longitude)
}

export function serializeBrowseQueryOptions(options) {
  return JSON.stringify(options ?? {})
}

export function hasActiveBrowseFilters(filters) {
  if (!filters) return false

  const categoryIds = normalizeStringArray(filters.categoryIds, filters.categoryId)
  const brands = normalizeStringArray(filters.brands, filters.brand)
  const conditions = normalizeStringArray(filters.conditions, filters.condition)

  return Boolean(
    filters.search?.trim() ||
      categoryIds.length > 0 ||
      conditions.length > 0 ||
      filters.rating ||
      brands.length > 0 ||
      filters.minPrice?.trim() ||
      filters.maxPrice?.trim() ||
      filters.buyerLatitude != null ||
      (filters.sort && filters.sort !== DEFAULT_LISTING_SORT),
  )
}

function getConditionLabel(value) {
  return CONDITION_LABELS[value] ?? value
}

function getRatingLabel(value) {
  return RATING_LABELS[value] ?? value
}

function getRadiusLabel(radiusMiles) {
  const option = BROWSE_RADIUS_OPTIONS.find((entry) => entry.value === radiusMiles)
  return option?.label ?? radiusMiles
}

function getSortLabel(sort) {
  return BROWSE_SORT_OPTIONS.find((entry) => entry.value === sort)?.label ?? sort
}

export function buildBrowseActiveFilterChips(filters, categories = []) {
  if (!filters) return []

  const chips = []
  const categoryIds = normalizeStringArray(filters.categoryIds, filters.categoryId)
  const brands = normalizeStringArray(filters.brands, filters.brand)
  const conditions = normalizeStringArray(filters.conditions, filters.condition)

  if (filters.search?.trim()) {
    chips.push({
      key: 'search',
      label: `Search: ${filters.search.trim()}`,
      removeKey: 'search',
    })
  }

  for (const categoryId of categoryIds) {
    const category = categories.find((entry) => entry.id === categoryId)
    chips.push({
      key: `category-${categoryId}`,
      label: category?.name ?? 'Category',
      removeKey: 'categoryIds',
      removeValue: categoryId,
    })
  }

  for (const brandValue of brands) {
    chips.push({
      key: `brand-${brandValue}`,
      label: brandValue,
      removeKey: 'brands',
      removeValue: brandValue,
    })
  }

  for (const conditionValue of conditions) {
    chips.push({
      key: `condition-${conditionValue}`,
      label: getConditionLabel(conditionValue),
      removeKey: 'conditions',
      removeValue: conditionValue,
    })
  }

  if (filters.rating) {
    chips.push({
      key: 'rating',
      label: `Usage: ${getRatingLabel(filters.rating)}`,
      removeKey: 'rating',
    })
  }

  if (filters.minPrice?.trim() || filters.maxPrice?.trim()) {
    const min = filters.minPrice?.trim()
    const max = filters.maxPrice?.trim()
    let label = ''

    if (min && max) label = `£${min} – £${max}`
    else if (min) label = `from £${min}`
    else label = `up to £${max}`

    chips.push({
      key: 'price',
      label,
      removeKey: 'price',
    })
  }

  if (filters.buyerLatitude != null && filters.buyerLongitude != null) {
    const locationLabel = filters.locationSearch?.trim() || filters.locationPlace?.displayLabel
    if (locationLabel) {
      chips.push({
        key: 'location',
        label: `Near ${locationLabel}`,
        removeKey: 'location',
      })
    }

    if (filters.radiusMiles && filters.radiusMiles !== BROWSE_RADIUS_UK_WIDE) {
      chips.push({
        key: 'radius',
        label: `Within ${getRadiusLabel(filters.radiusMiles)}`,
        removeKey: 'radius',
      })
    }
  }

  if (filters.sort && filters.sort !== DEFAULT_LISTING_SORT) {
    chips.push({
      key: 'sort',
      label: `Sort: ${getSortLabel(filters.sort)}`,
      removeKey: 'sort',
    })
  }

  return chips
}

export function removeBrowseFilterKey(filters, removeKey, removeValue = '') {
  const next = { ...filters }

  switch (removeKey) {
    case 'search':
      next.search = ''
      break
    case 'categoryIds':
      next.categoryIds = normalizeStringArray(filters.categoryIds, filters.categoryId).filter(
        (id) => id !== removeValue,
      )
      next.categoryId = next.categoryIds[0] ?? ''
      next.categorySlug = ''
      break
    case 'categoryId':
      next.categoryIds = []
      next.categoryId = ''
      next.categorySlug = ''
      break
    case 'brands':
      next.brands = normalizeStringArray(filters.brands, filters.brand).filter(
        (brand) => brand !== removeValue,
      )
      next.brand = next.brands[0] ?? ''
      break
    case 'brand':
      next.brands = []
      next.brand = ''
      break
    case 'conditions':
      next.conditions = normalizeStringArray(filters.conditions, filters.condition).filter(
        (condition) => condition !== removeValue,
      )
      next.condition = next.conditions[0] ?? ''
      break
    case 'condition':
      next.conditions = []
      next.condition = ''
      break
    case 'rating':
      next.rating = ''
      break
    case 'price':
      next.minPrice = ''
      next.maxPrice = ''
      break
    case 'location':
      next.locationSearch = ''
      next.locationPlace = null
      next.buyerLatitude = null
      next.buyerLongitude = null
      next.radiusMiles = BROWSE_RADIUS_UK_WIDE
      next.radiusMilesValue = null
      break
    case 'radius':
      next.radiusMiles = BROWSE_RADIUS_UK_WIDE
      next.radiusMilesValue = null
      break
    case 'sort':
      next.sort = DEFAULT_LISTING_SORT
      break
    default:
      break
  }

  return next
}

export function countBrowsePanelFilters(filters) {
  let count = 0

  count += normalizeStringArray(filters.categoryIds, filters.categoryId).length
  count += normalizeStringArray(filters.conditions, filters.condition).length
  count += normalizeStringArray(filters.brands, filters.brand).length
  if (filters.minPrice?.trim()) count += 1
  if (filters.maxPrice?.trim()) count += 1

  return count
}

export { parseBrowseRadiusMiles }
