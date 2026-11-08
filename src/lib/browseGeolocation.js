import {
  BROWSE_CURRENT_LOCATION_LABEL,
  BROWSE_LOCATION_SOURCE_BROWSER,
  isPrivateBrowserOrigin,
  isValidCoordinate,
} from './listingDistance.js'

const GEO_STATUS_KEY = 'equipd:browse-geolocation-status'
const BROWSER_ORIGIN_KEY = 'equipd:browse-browser-origin'

export const BROWSE_GEO_STATUS = {
  PROMPTED: 'prompted',
  GRANTED: 'granted',
  DENIED: 'denied',
}

export function getBrowseGeolocationStatus() {
  if (typeof window === 'undefined') return null

  try {
    return window.sessionStorage.getItem(GEO_STATUS_KEY)
  } catch {
    return null
  }
}

export function setBrowseGeolocationStatus(status) {
  if (typeof window === 'undefined') return

  try {
    window.sessionStorage.setItem(GEO_STATUS_KEY, status)
  } catch {
    // Ignore storage failures — browsing should still work.
  }
}

export function hasBrowseLocationInSearchParams(searchParams) {
  const lat = searchParams.get('lat')
  const lng = searchParams.get('lng')

  if (!lat || !lng) return false

  const parsedLat = Number(lat)
  const parsedLng = Number(lng)

  return Number.isFinite(parsedLat) && Number.isFinite(parsedLng)
}

export function shouldAutoPromptBrowseGeolocation(_searchParams) {
  return false
}

export const BROWSE_LOCATION_PROMPT_COPY =
  'To search within a distance, use your current location or enter a town or postcode.'

export function buildCurrentLocationPlace(latitude, longitude) {
  return {
    displayLabel: BROWSE_CURRENT_LOCATION_LABEL,
    locationName: BROWSE_CURRENT_LOCATION_LABEL,
    city: null,
    county: null,
    postcode: null,
    latitude,
    longitude,
    source: BROWSE_LOCATION_SOURCE_BROWSER,
  }
}

export function getStoredBrowseBrowserOrigin() {
  if (typeof window === 'undefined') return null

  try {
    const raw = window.sessionStorage.getItem(BROWSER_ORIGIN_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!isValidCoordinate(parsed?.latitude) || !isValidCoordinate(parsed?.longitude)) return null
    return { latitude: Number(parsed.latitude), longitude: Number(parsed.longitude) }
  } catch {
    return null
  }
}

export function setStoredBrowseBrowserOrigin(latitude, longitude) {
  if (typeof window === 'undefined') return
  if (!isValidCoordinate(latitude) || !isValidCoordinate(longitude)) return

  try {
    window.sessionStorage.setItem(
      BROWSER_ORIGIN_KEY,
      JSON.stringify({ latitude: Number(latitude), longitude: Number(longitude) }),
    )
  } catch {
    // Ignore storage failures — browsing should still work for this session.
  }
}

export function clearStoredBrowseBrowserOrigin() {
  if (typeof window === 'undefined') return

  try {
    window.sessionStorage.removeItem(BROWSER_ORIGIN_KEY)
  } catch {
    // Ignore storage failures.
  }
}

export function hydrateBrowseLocationOrigin(location) {
  if (!location) return location

  if (isValidCoordinate(location.buyerLatitude) && isValidCoordinate(location.buyerLongitude)) {
    if (isPrivateBrowserOrigin(location.locationPlace, location.locationSearch)) {
      setStoredBrowseBrowserOrigin(location.buyerLatitude, location.buyerLongitude)
      return {
        ...location,
        locationSearch: location.locationSearch || BROWSE_CURRENT_LOCATION_LABEL,
        locationPlace: {
          ...(location.locationPlace || buildCurrentLocationPlace(location.buyerLatitude, location.buyerLongitude)),
          source: BROWSE_LOCATION_SOURCE_BROWSER,
        },
      }
    }
    return location
  }

  const stored = getStoredBrowseBrowserOrigin()
  if (!stored) return location
  if (!isPrivateBrowserOrigin(location.locationPlace, location.locationSearch)) return location

  return {
    ...location,
    buyerLatitude: stored.latitude,
    buyerLongitude: stored.longitude,
    locationSearch: location.locationSearch || BROWSE_CURRENT_LOCATION_LABEL,
    locationPlace: buildCurrentLocationPlace(stored.latitude, stored.longitude),
  }
}
