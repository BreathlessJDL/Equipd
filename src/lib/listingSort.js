import {
  getListingCoordinates,
  normalizeBuyerCoordinates,
  safeDistanceMiles,
} from './listingDistance.js'

export const DEFAULT_LISTING_SORT = 'newest'

export const BROWSE_SORT_OPTIONS = [
  {
    value: 'newest',
    label: 'Newest',
    dbColumn: 'created_at',
    ascending: false,
  },
  {
    value: 'oldest',
    label: 'Oldest',
    dbColumn: 'created_at',
    ascending: true,
  },
  {
    value: 'price_asc',
    label: 'Price: low to high',
    dbColumn: 'price_pence',
    ascending: true,
  },
  {
    value: 'price_desc',
    label: 'Price: high to low',
    dbColumn: 'price_pence',
    ascending: false,
  },
  {
    value: 'nearest',
    label: 'Nearest first',
    dbColumn: 'created_at',
    ascending: false,
    requiresLocation: true,
    clientSide: true,
  },
]

export const LISTING_SORT_OPTIONS = [
  {
    value: 'newest',
    label: 'Newest first',
    dbColumn: 'created_at',
    ascending: false,
  },
  {
    value: 'oldest',
    label: 'Oldest first',
    dbColumn: 'created_at',
    ascending: true,
  },
  {
    value: 'nearest',
    label: 'Nearest first',
    dbColumn: 'created_at',
    ascending: false,
    requiresLocation: true,
    clientSide: true,
  },
  {
    value: 'price_asc',
    label: 'Lowest price',
    dbColumn: 'price_pence',
    ascending: true,
  },
  {
    value: 'price_desc',
    label: 'Highest price',
    dbColumn: 'price_pence',
    ascending: false,
  },
  {
    value: 'updated',
    label: 'Recently updated',
    dbColumn: 'updated_at',
    ascending: false,
  },
  {
    value: 'relevant',
    label: 'Most relevant',
    dbColumn: 'created_at',
    ascending: false,
    clientSide: true,
  },
]

export function parseListingSort(
  value,
  { hasLocationSearch = false, allowNearestWithoutLocation = false } = {},
) {
  const option = LISTING_SORT_OPTIONS.find((entry) => entry.value === value)
  if (!option) return DEFAULT_LISTING_SORT

  if (option.requiresLocation && !hasLocationSearch && !allowNearestWithoutLocation) {
    return DEFAULT_LISTING_SORT
  }

  if (value === 'nearest' && !hasLocationSearch && !allowNearestWithoutLocation) {
    return DEFAULT_LISTING_SORT
  }

  return option.value
}

export function getEffectiveListingSort(sort, { hasLocationSearch = false } = {}) {
  if (sort === 'nearest' && !hasLocationSearch) {
    return DEFAULT_LISTING_SORT
  }

  return parseListingSort(sort, { hasLocationSearch, allowNearestWithoutLocation: true })
}

export function getFetchListingSort(sort, { hasLocationSearch = false } = {}) {
  const effectiveSort = getEffectiveListingSort(sort, { hasLocationSearch })
  if (effectiveSort === 'nearest') {
    return DEFAULT_LISTING_SORT
  }

  return effectiveSort
}

export function getSortDbOrder(sort, { hasLocationSearch = false } = {}) {
  const parsed = parseListingSort(sort, { hasLocationSearch, allowNearestWithoutLocation: true })
  const option = LISTING_SORT_OPTIONS.find((entry) => entry.value === parsed)

  if (parsed === 'nearest' || parsed === 'relevant') {
    return {
      column: 'created_at',
      ascending: false,
    }
  }

  return {
    column: option?.dbColumn ?? 'created_at',
    ascending: option?.ascending ?? false,
  }
}

export function scoreListingRelevance(listing, searchTerm) {
  const term = searchTerm.trim().toLowerCase()
  if (!term) return 0

  const title = (listing.title ?? '').toLowerCase()
  const brand = (listing.brand ?? '').toLowerCase()
  const model = (listing.model ?? '').toLowerCase()

  let score = 0

  if (title === term) score += 100
  else if (title.startsWith(term)) score += 50
  else if (title.includes(term)) score += 30

  if (brand.startsWith(term)) score += 20
  else if (brand.includes(term)) score += 10

  if (model.startsWith(term)) score += 15
  else if (model.includes(term)) score += 8

  return score
}

export function sortListingsByRelevance(listings, searchTerm) {
  const term = searchTerm.trim()
  if (!term) return listings

  return [...listings].sort((left, right) => {
    const scoreDiff = scoreListingRelevance(right, term) - scoreListingRelevance(left, term)
    if (scoreDiff !== 0) return scoreDiff

    return new Date(right.created_at).getTime() - new Date(left.created_at).getTime()
  })
}

function compareCreatedAtDesc(left, right) {
  const leftTime = new Date(left?.created_at ?? 0).getTime()
  const rightTime = new Date(right?.created_at ?? 0).getTime()
  const leftValid = Number.isFinite(leftTime)
  const rightValid = Number.isFinite(rightTime)

  if (leftValid && rightValid && leftTime !== rightTime) {
    return rightTime - leftTime
  }

  return 0
}

export function sortListingsByNearest(listings, buyerLat, buyerLng) {
  const buyer = normalizeBuyerCoordinates({ latitude: buyerLat, longitude: buyerLng })
  if (!buyer) {
    console.warn('[browse] Nearest sort skipped: buyer coordinates are missing or invalid.')
    return Array.isArray(listings) ? listings : []
  }

  const safeListings = Array.isArray(listings) ? listings : []

  const ranked = [...safeListings]
    .map((listing) => {
      const { latitude, longitude } = getListingCoordinates(listing)
      const distance =
        Number.isFinite(listing.distance_miles) && listing.distance_miles >= 0
          ? listing.distance_miles
          : safeDistanceMiles(buyer.latitude, buyer.longitude, latitude, longitude)

      return {
        listing,
        distance,
        hasDistance: distance != null,
      }
    })
    .sort((left, right) => {
      if (left.hasDistance && right.hasDistance && left.distance !== right.distance) {
        return left.distance - right.distance
      }

      if (left.hasDistance !== right.hasDistance) {
        return left.hasDistance ? -1 : 1
      }

      return compareCreatedAtDesc(left.listing, right.listing)
    })

  const withCoords = ranked.filter((entry) => entry.hasDistance).length
  const withoutCoords = ranked.length - withCoords

  if (typeof import.meta !== 'undefined' && import.meta.env?.DEV) {
    console.debug('[browse] Nearest sort applied', {
      buyerCoordinates: buyer,
      listingsWithCoordinates: withCoords,
      listingsWithoutCoordinates: withoutCoords,
      sampleDistancesMiles: ranked
        .filter((entry) => entry.hasDistance)
        .slice(0, 5)
        .map((entry) => ({
          id: entry.listing.id,
          distanceMiles: Number(entry.distance.toFixed(2)),
        })),
    })
  }

  return ranked.map(({ listing, distance }) => ({
    ...listing,
    distance_miles: distance ?? listing.distance_miles ?? null,
  }))
}

export function applyListingSort(
  listings,
  sort,
  searchTerm = '',
  { hasLocationSearch = false, buyerCoordinates = null } = {},
) {
  const safeListings = Array.isArray(listings) ? listings : []

  try {
    const parsed = parseListingSort(sort, { hasLocationSearch, allowNearestWithoutLocation: true })

    if (parsed === 'relevant') {
      return sortListingsByRelevance(safeListings, searchTerm)
    }

    if (parsed === 'nearest') {
      const buyer = normalizeBuyerCoordinates(buyerCoordinates)
      if (!buyer) {
        console.warn(
          '[browse] Nearest sort requested without valid buyer coordinates; keeping fetch order.',
        )
        return safeListings
      }

      return sortListingsByNearest(safeListings, buyer.latitude, buyer.longitude)
    }

    return safeListings
  } catch (error) {
    console.warn('[browse] Listing sort failed; returning original order.', error)
    return safeListings
  }
}

export function getBrowseSortOptions() {
  return BROWSE_SORT_OPTIONS
}

export function getListingSortOptions() {
  return getBrowseSortOptions()
}
