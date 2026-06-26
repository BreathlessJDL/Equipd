/**
 * Browse distance search helpers — radius options, haversine, URL state, labels.
 */

export const BROWSE_RADIUS_UK_WIDE = 'uk'

export const BROWSE_RADIUS_OPTIONS = [
  { value: BROWSE_RADIUS_UK_WIDE, label: 'UK wide' },
  { value: '10', label: '10 miles' },
  { value: '25', label: '25 miles' },
  { value: '50', label: '50 miles' },
  { value: '100', label: '100 miles' },
]

const EARTH_RADIUS_MILES = 3958.7613

export function isValidCoordinate(value) {
  if (value == null || value === '') return false

  const number = Number(value)
  return Number.isFinite(number)
}

export function getListingCoordinates(item) {
  const latitude =
    item?.latitude ?? item?.lat ?? item?.location_lat ?? item?.profile_latitude ?? null
  const longitude =
    item?.longitude ?? item?.lng ?? item?.location_lng ?? item?.profile_longitude ?? null

  if (!isValidCoordinate(latitude) || !isValidCoordinate(longitude)) {
    return { latitude: null, longitude: null }
  }

  return { latitude: Number(latitude), longitude: Number(longitude) }
}

export function hasValidCoordinates(item) {
  const { latitude, longitude } = getListingCoordinates(item)
  return latitude != null && longitude != null
}

export function normalizeBuyerCoordinates(coords) {
  if (!coords) return null

  const latitude = coords.latitude
  const longitude = coords.longitude

  if (!isValidCoordinate(latitude) || !isValidCoordinate(longitude)) {
    console.warn('[browse] Invalid buyer coordinates; nearest sort unavailable.', coords)
    return null
  }

  return { latitude: Number(latitude), longitude: Number(longitude) }
}

export function safeDistanceMiles(lat1, lng1, lat2, lng2) {
  if (
    !isValidCoordinate(lat1) ||
    !isValidCoordinate(lng1) ||
    !isValidCoordinate(lat2) ||
    !isValidCoordinate(lng2)
  ) {
    return null
  }

  return haversineDistanceMiles(Number(lat1), Number(lng1), Number(lat2), Number(lng2))
}

export function parseBrowseRadiusMiles(value) {
  if (value == null || value === '' || value === BROWSE_RADIUS_UK_WIDE) {
    return null
  }

  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null
  }

  return parsed
}

export function isBrowseRadiusSearchActive(radiusMiles) {
  return radiusMiles != null && radiusMiles > 0
}

export function haversineDistanceMiles(lat1, lon1, lat2, lon2) {
  if (
    lat1 == null ||
    lon1 == null ||
    lat2 == null ||
    lon2 == null ||
    !Number.isFinite(lat1) ||
    !Number.isFinite(lon1) ||
    !Number.isFinite(lat2) ||
    !Number.isFinite(lon2)
  ) {
    return null
  }

  const toRadians = (degrees) => (degrees * Math.PI) / 180
  const dLat = toRadians(lat2 - lat1)
  const dLon = toRadians(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) ** 2

  return EARTH_RADIUS_MILES * 2 * Math.asin(Math.min(1, Math.sqrt(a)))
}

export function formatListingDistanceLabel(listing) {
  const miles = listing?.distance_miles

  if (miles == null || !Number.isFinite(miles)) {
    return ''
  }

  if (miles < 1) {
    return 'Less than a mile away'
  }

  const rounded = Math.round(miles)
  return `${rounded} mile${rounded === 1 ? '' : 's'} away`
}

export function parseBrowseLocationFromSearchParams(searchParams) {
  const locationSearch = searchParams.get('location')?.trim() ?? ''
  const latParam = searchParams.get('lat')
  const lngParam = searchParams.get('lng')
  const lat = latParam != null && latParam !== '' ? Number(latParam) : NaN
  const lng = lngParam != null && lngParam !== '' ? Number(lngParam) : NaN
  const radiusParam = searchParams.get('radius') ?? BROWSE_RADIUS_UK_WIDE
  const radiusMilesValue = parseBrowseRadiusMiles(radiusParam)
  const radiusMiles =
    radiusMilesValue == null ? BROWSE_RADIUS_UK_WIDE : String(radiusMilesValue)

  const hasCoordinates = Number.isFinite(lat) && Number.isFinite(lng)

  return {
    locationSearch,
    locationPlace: hasCoordinates
      ? {
          displayLabel: locationSearch || `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
          latitude: lat,
          longitude: lng,
        }
      : null,
    radiusMiles,
    radiusMilesValue,
    buyerLatitude: hasCoordinates ? lat : null,
    buyerLongitude: hasCoordinates ? lng : null,
  }
}

export function applyBrowseLocationToSearchParams(searchParams, {
  locationSearch = '',
  locationPlace = null,
  radiusMiles = BROWSE_RADIUS_UK_WIDE,
}) {
  searchParams.delete('location')
  searchParams.delete('lat')
  searchParams.delete('lng')
  searchParams.delete('radius')

  if (locationPlace?.latitude != null && locationPlace?.longitude != null) {
    const label = locationSearch || locationPlace.displayLabel
    if (label) searchParams.set('location', label)
    searchParams.set('lat', String(locationPlace.latitude))
    searchParams.set('lng', String(locationPlace.longitude))

    const parsedRadius = parseBrowseRadiusMiles(radiusMiles)
    if (parsedRadius != null) {
      searchParams.set('radius', String(parsedRadius))
    }
  }

  return searchParams
}

export function shouldUseDistanceSearch({ buyerLatitude, buyerLongitude }) {
  return isValidCoordinate(buyerLatitude) && isValidCoordinate(buyerLongitude)
}

export function listingMatchesRadiusSearch(listing, radiusMiles) {
  if (!isBrowseRadiusSearchActive(radiusMiles)) {
    return true
  }

  return listing?.latitude != null && listing?.longitude != null
}

export function filterListingsByRadius(listings, buyerLatitude, buyerLongitude, radiusMiles) {
  if (!shouldUseDistanceSearch({ buyerLatitude, buyerLongitude })) {
    return listings ?? []
  }

  const buyer = normalizeBuyerCoordinates({ latitude: buyerLatitude, longitude: buyerLongitude })
  if (!buyer) {
    console.warn('[browse] Skipping radius distance enrichment: invalid buyer coordinates.')
    return listings ?? []
  }

  if (!isBrowseRadiusSearchActive(radiusMiles)) {
    return (listings ?? []).map((listing) => {
      const { latitude, longitude } = getListingCoordinates(listing)
      return {
        ...listing,
        distance_miles:
          listing.distance_miles ??
          safeDistanceMiles(buyer.latitude, buyer.longitude, latitude, longitude),
      }
    })
  }

  return (listings ?? [])
    .map((listing) => {
      const { latitude, longitude } = getListingCoordinates(listing)
      return {
        ...listing,
        distance_miles:
          listing.distance_miles ??
          safeDistanceMiles(buyer.latitude, buyer.longitude, latitude, longitude),
      }
    })
    .filter((listing) => listing.distance_miles != null && listing.distance_miles <= radiusMiles)
}

export function sortListingsByDistance(listings) {
  return [...(listings ?? [])].sort((left, right) => {
    const leftDistance = Number.isFinite(left.distance_miles)
      ? left.distance_miles
      : Number.POSITIVE_INFINITY
    const rightDistance = Number.isFinite(right.distance_miles)
      ? right.distance_miles
      : Number.POSITIVE_INFINITY

    if (leftDistance !== rightDistance) {
      return leftDistance - rightDistance
    }

    return new Date(right.created_at).getTime() - new Date(left.created_at).getTime()
  })
}
