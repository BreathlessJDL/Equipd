/**
 * Listing location helpers — Google Places mapping, formatting, and DB payloads.
 */

export const UK_POSTCODE_PATTERN = /^[A-Z]{1,2}[0-9][A-Z0-9]? ?[0-9][A-Z]{2}$/i

export function normalizeUkPostcode(value) {
  const trimmed = value?.trim().toUpperCase()
  if (!trimmed) return null

  const compact = trimmed.replace(/\s+/g, '')
  if (compact.length <= 3) return compact

  return `${compact.slice(0, -3)} ${compact.slice(-3)}`
}

function getAddressComponent(components, type, useShortName = false) {
  const match = components.find((component) => component.types?.includes(type))
  if (!match) return null
  return useShortName ? match.short_name : match.long_name
}

function pickPrimaryLocality(components) {
  return (
    getAddressComponent(components, 'postal_town') ||
    getAddressComponent(components, 'locality') ||
    getAddressComponent(components, 'sublocality') ||
    getAddressComponent(components, 'administrative_area_level_3') ||
    getAddressComponent(components, 'administrative_area_level_2')
  )
}

function pickCounty(components) {
  const level2 = getAddressComponent(components, 'administrative_area_level_2')
  const level1 = getAddressComponent(components, 'administrative_area_level_1')

  if (level2 && level2 !== level1) return level2
  return level1
}

export function mapGooglePlaceToListingLocation(place) {
  const components = place?.address_components ?? []
  const locationName = pickPrimaryLocality(components) || place?.name?.trim() || null
  const city = pickPrimaryLocality(components) || locationName
  const county = pickCounty(components)
  const postcode = normalizeUkPostcode(getAddressComponent(components, 'postal_code', true))
  const latitude = place?.geometry?.location?.lat?.()
  const longitude = place?.geometry?.location?.lng?.()

  const structured = {
    locationName,
    city,
    county,
    postcode,
    latitude: Number.isFinite(latitude) ? latitude : null,
    longitude: Number.isFinite(longitude) ? longitude : null,
  }

  return {
    ...structured,
    displayLabel: formatStructuredLocationDisplay(structured),
  }
}

/** Formatted street address for private collection/courier pickup (no lat/lng stored). */
export function mapGooglePlaceToFormattedAddress(place) {
  const formatted = place?.formatted_address?.trim()
  if (formatted) return formatted

  const components = place?.address_components ?? []
  if (components.length === 0) return ''

  const streetNumber = getAddressComponent(components, 'street_number')
  const route = getAddressComponent(components, 'route')
  const locality = pickPrimaryLocality(components)
  const postcode = normalizeUkPostcode(getAddressComponent(components, 'postal_code', true))

  const streetLine = [streetNumber, route].filter(Boolean).join(' ')
  return [streetLine, locality, postcode].filter(Boolean).join(', ')
}

export function formatStructuredLocationDisplay(location) {
  if (!location) return ''

  const city = location.city || location.locationName
  const county = location.county
  const postcode = location.postcode

  if (city && county && city !== county) {
    return `${city}, ${county}`
  }

  if (city && postcode) {
    return `${city}, ${postcode}`
  }

  if (city) return city
  if (postcode) return postcode
  return ''
}

export function formatListingLocationDetail(listing) {
  if (!listing) return ''

  const structured = formatStructuredLocationDisplay({
    locationName: listing.location_name,
    city: listing.city,
    county: listing.county,
    postcode: listing.postcode,
  })

  if (structured) return structured
  return listing.location?.trim() ?? ''
}

export function formatListingLocationCard(listing) {
  if (!listing) return ''

  return (
    listing.location_name ||
    listing.city ||
    listing.location?.split(',')?.[0]?.trim() ||
    listing.location ||
    ''
  )
}

export function buildListingLocationFields(location) {
  if (!location) {
    return {
      location: null,
      location_name: null,
      city: null,
      county: null,
      postcode: null,
      latitude: null,
      longitude: null,
    }
  }

  return {
    location_name: location.locationName || location.city || null,
    city: location.city || location.locationName || null,
    county: location.county || null,
    postcode: location.postcode || null,
    latitude: location.latitude ?? null,
    longitude: location.longitude ?? null,
    location: formatStructuredLocationDisplay(location) || null,
  }
}

export function pickExistingListingLocationFields(listing) {
  if (!listing) {
    return buildListingLocationFields(null)
  }

  return {
    location_name: listing.location_name ?? null,
    city: listing.city ?? null,
    county: listing.county ?? null,
    postcode: listing.postcode ?? null,
    latitude: listing.latitude ?? null,
    longitude: listing.longitude ?? null,
    location: listing.location ?? (formatListingLocationDetail(listing) || null),
  }
}

export function listingLocationFromRecord(listing) {
  if (!listing) return null

  const hasStructured =
    listing.location_name ||
    listing.city ||
    listing.county ||
    listing.postcode ||
    listing.latitude != null ||
    listing.longitude != null

  if (!hasStructured) return null

  const structured = {
    locationName: listing.location_name ?? listing.city ?? null,
    city: listing.city ?? listing.location_name ?? null,
    county: listing.county ?? null,
    postcode: listing.postcode ?? null,
    latitude: listing.latitude ?? null,
    longitude: listing.longitude ?? null,
  }

  return {
    ...structured,
    displayLabel: formatStructuredLocationDisplay(structured) || listing.location || '',
  }
}

export function listingLocationToFormFields(listing) {
  const locationPlace = listingLocationFromRecord(listing)
  const fallbackSearch = listing?.location?.trim() ?? ''

  return {
    locationPlace,
    locationSearch: locationPlace?.displayLabel || fallbackSearch,
  }
}

export function hasSelectedListingLocation(form) {
  const place = form?.locationPlace
  if (!place) return false

  return Boolean(
    (place.city || place.locationName || place.postcode) &&
      place.latitude != null &&
      place.longitude != null,
  )
}

export function shouldAutoFillListingLocationFromAddress(form) {
  return !hasSelectedListingLocation(form)
}

export function buildCollectionAddressPlaceSelection(place) {
  const formattedAddress = mapGooglePlaceToFormattedAddress(place)
  if (!formattedAddress) return null

  return {
    formattedAddress,
    publicLocation: mapGooglePlaceToListingLocation(place),
  }
}

export function hasListingLocationForPublish(form, existingListing = null) {
  if (hasSelectedListingLocation(form)) return true

  if (existingListing?.location?.trim()) return true
  if (listingLocationFromRecord(existingListing)) return true

  return false
}

export function resolveListingLocationPayload(form, existingListing = null) {
  if (hasSelectedListingLocation(form)) {
    return buildListingLocationFields(form.locationPlace)
  }

  if (existingListing) {
    return pickExistingListingLocationFields(existingListing)
  }

  return buildListingLocationFields(null)
}

export function profileLocationFromRecord(profile) {
  return listingLocationFromRecord(profile)
}

export function buildProfileLocationPayload({ locationPlace = null, locationText = '' } = {}) {
  if (
    locationPlace &&
    locationPlace.latitude != null &&
    locationPlace.longitude != null
  ) {
    return buildListingLocationFields(locationPlace)
  }

  const trimmed = locationText?.trim() ?? ''
  if (!trimmed) {
    return buildListingLocationFields(null)
  }

  return {
    location: trimmed,
    location_name: null,
    city: null,
    county: null,
    postcode: null,
    latitude: null,
    longitude: null,
  }
}

export function getGoogleMapsApiKey() {
  return import.meta.env.VITE_GOOGLE_MAPS_API_KEY?.trim() ?? ''
}

export function isGoogleMapsConfigured() {
  return Boolean(getGoogleMapsApiKey())
}

const PLACES_INIT_TIMEOUT_MS = 10000
const PLACES_POLL_INTERVAL_MS = 50

function isGooglePlacesReady() {
  return Boolean(window.google?.maps?.places)
}

function waitForGooglePlaces(timeoutMs = PLACES_INIT_TIMEOUT_MS) {
  if (isGooglePlacesReady()) {
    return Promise.resolve(window.google)
  }

  return new Promise((resolve, reject) => {
    const started = Date.now()

    const timer = window.setInterval(() => {
      if (isGooglePlacesReady()) {
        window.clearInterval(timer)
        resolve(window.google)
        return
      }

      if (Date.now() - started >= timeoutMs) {
        window.clearInterval(timer)
        reject(new Error('Google Maps Places library failed to initialise.'))
      }
    }, PLACES_POLL_INTERVAL_MS)
  })
}

async function ensureGooglePlacesReady() {
  if (isGooglePlacesReady()) {
    return window.google
  }

  const google = window.google
  if (google?.maps?.importLibrary) {
    await google.maps.importLibrary('places')
    return window.google
  }

  return waitForGooglePlaces()
}

let googleMapsLoadPromise = null

export function loadGoogleMapsPlaces() {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Google Maps can only load in the browser.'))
  }

  if (isGooglePlacesReady()) {
    return Promise.resolve(window.google)
  }

  if (googleMapsLoadPromise) {
    return googleMapsLoadPromise
  }

  const apiKey = getGoogleMapsApiKey()
  if (!apiKey) {
    return Promise.reject(new Error('Google Maps API key is not configured.'))
  }

  googleMapsLoadPromise = new Promise((resolve, reject) => {
    const finishReady = () => {
      ensureGooglePlacesReady()
        .then(resolve)
        .catch(reject)
    }

    const existingScript = document.querySelector('script[data-equipd-google-maps="true"]')

    if (existingScript) {
      if (existingScript.dataset.equipdGoogleMapsLoaded === 'true') {
        finishReady()
        return
      }

      existingScript.addEventListener(
        'load',
        () => {
          existingScript.dataset.equipdGoogleMapsLoaded = 'true'
          finishReady()
        },
        { once: true },
      )
      existingScript.addEventListener(
        'error',
        () => reject(new Error('Failed to load Google Maps.')),
        { once: true },
      )

      if (window.google?.maps) {
        existingScript.dataset.equipdGoogleMapsLoaded = 'true'
        finishReady()
      }

      return
    }

    const script = document.createElement('script')
    script.dataset.equipdGoogleMaps = 'true'
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&libraries=places&loading=async`
    script.async = true
    script.defer = true
    script.onload = () => {
      script.dataset.equipdGoogleMapsLoaded = 'true'
      finishReady()
    }
    script.onerror = () => reject(new Error('Failed to load Google Maps.'))
    document.head.appendChild(script)
  }).catch((error) => {
    googleMapsLoadPromise = null
    throw error
  })

  return googleMapsLoadPromise
}

export const GOOGLE_PLACES_PAC_HIDDEN_CLASS = 'equipd-pac-hidden'

const PAC_INPUT_PROXIMITY_THRESHOLD_PX = 240

/**
 * Associate a Google pac-container with its input. Google appends containers to
 * document.body, so we match by proximity below the input rather than removing
 * other inputs' containers (which breaks multi-autocomplete forms).
 */
export function findPacContainerForInput(input) {
  if (!input || typeof document === 'undefined') return null

  if (input._equipdPacContainer?.isConnected) {
    return input._equipdPacContainer
  }

  const containers = document.querySelectorAll('.pac-container')
  if (containers.length === 0) return null

  const inputRect = input.getBoundingClientRect()
  let bestMatch = null
  let bestScore = Infinity

  containers.forEach((container) => {
    const rect = container.getBoundingClientRect()
    const verticalDistance = Math.abs(rect.top - inputRect.bottom)
    const horizontalDistance = Math.abs(rect.left - inputRect.left)
    const score = verticalDistance + horizontalDistance * 0.25

    if (score < bestScore) {
      bestScore = score
      bestMatch = container
    }
  })

  if (bestMatch && bestScore <= PAC_INPUT_PROXIMITY_THRESHOLD_PX) {
    input._equipdPacContainer = bestMatch
    if (input.id) {
      bestMatch.dataset.equipdPlacesInputId = input.id
    }
  }

  return bestMatch
}

export function hideGooglePlacesAutocompleteDropdown(input = null) {
  if (typeof document === 'undefined') return

  if (input) {
    const container = findPacContainerForInput(input)
    if (container) {
      container.classList.add(GOOGLE_PLACES_PAC_HIDDEN_CLASS)
    }
    return
  }

  document.querySelectorAll('.pac-container').forEach((container) => {
    container.classList.add(GOOGLE_PLACES_PAC_HIDDEN_CLASS)
  })
}

export function resetGooglePlacesAutocompleteDropdownVisibility(input = null) {
  if (typeof document === 'undefined') return

  if (input) {
    findPacContainerForInput(input)

    document.querySelectorAll('.pac-container').forEach((container) => {
      const linkedInputId = container.dataset.equipdPlacesInputId
      if (!linkedInputId || linkedInputId === input.id) {
        container.classList.remove(GOOGLE_PLACES_PAC_HIDDEN_CLASS)
      }
    })

    return
  }

  document.querySelectorAll('.pac-container').forEach((container) => {
    container.classList.remove(GOOGLE_PLACES_PAC_HIDDEN_CLASS)
  })
}

export function destroyGooglePlacesAutocompleteDropdowns() {
  if (typeof document === 'undefined') return

  document.querySelectorAll('.pac-container').forEach((container) => {
    container.remove()
  })
}

/** @deprecated Prefer per-input pac scoping via findPacContainerForInput. */
export function dedupeGooglePlacesAutocompleteDropdowns() {
  if (typeof document === 'undefined') return
}
