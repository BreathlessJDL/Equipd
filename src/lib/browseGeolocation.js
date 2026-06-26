const GEO_STATUS_KEY = 'equipd:browse-geolocation-status'

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

export function shouldAutoPromptBrowseGeolocation(searchParams) {
  if (hasBrowseLocationInSearchParams(searchParams)) return false

  return getBrowseGeolocationStatus() == null
}

export function buildCurrentLocationPlace(latitude, longitude) {
  return {
    displayLabel: 'Current location',
    locationName: 'Current location',
    city: null,
    county: null,
    postcode: null,
    latitude,
    longitude,
  }
}
