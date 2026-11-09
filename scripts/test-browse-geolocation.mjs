#!/usr/bin/env node
/**
 * Browse geolocation is opt-in: never auto-prompt on page load.
 *
 *   node scripts/test-browse-geolocation.mjs
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  BROWSE_GEOLOCATION_ERROR,
  BROWSE_GEOLOCATION_OPTIONS,
  BROWSE_LOCATION_PROMPT_COPY,
  buildCurrentLocationPlace,
  getBrowseGeolocationErrorMessage,
  hydrateBrowseLocationOrigin,
  readBrowseCurrentPositionCoords,
  requestBrowseCurrentPosition,
  setStoredBrowseBrowserOrigin,
  shouldAutoPromptBrowseGeolocation,
} from '../src/lib/browseGeolocation.js'
import { applyBrowseFiltersToSearchParams, buildBrowseQueryOptions } from '../src/lib/browseFilters.js'
import { LOCATION_PAGES, getLocationHubSearch } from '../src/lib/locations.js'

assert.equal(
  shouldAutoPromptBrowseGeolocation(new URLSearchParams()),
  false,
  'browse does not auto-prompt for location on load',
)
assert.equal(
  shouldAutoPromptBrowseGeolocation(new URLSearchParams('lat=53.8&lng=-1.5')),
  false,
  'browse still does not auto-prompt when coordinates are already in the URL',
)
assert.match(BROWSE_LOCATION_PROMPT_COPY, /use your current location/i)

const hookSource = readFileSync('src/hooks/useBrowseFilters.js', 'utf8')
assert.match(hookSource, /requestCurrentLocation/, 'hook exposes an explicit location request')
assert.doesNotMatch(
  hookSource,
  /shouldAutoPromptBrowseGeolocation\(searchParams\)/,
  'hook does not auto-call geolocation from search params',
)
assert.doesNotMatch(
  hookSource,
  /Saved location/,
  'distance filter does not auto-select the saved profile location',
)
assert.match(hookSource, /requestBrowseCurrentPosition/, 'current location uses the shared Geolocation helper')
assert.match(hookSource, /getBrowseGeolocationErrorMessage/, 'geolocation errors are mapped by type')
assert.match(
  hookSource,
  /BROWSE_RADIUS_SLIDER_PREVIEW_MILES/,
  'current location applies the visible radius around the GPS origin',
)
assert.doesNotMatch(
  hookSource,
  /enableHighAccuracy:\s*false/,
  'current location does not request a coarse network fallback',
)
assert.doesNotMatch(
  hookSource,
  /maximumAge:\s*300000/,
  'current location does not reuse a five-minute cached position',
)

assert.equal(BROWSE_GEOLOCATION_OPTIONS.enableHighAccuracy, true)
assert.equal(BROWSE_GEOLOCATION_OPTIONS.maximumAge, 0)
assert.ok(BROWSE_GEOLOCATION_OPTIONS.timeout >= 10000)

assert.equal(
  getBrowseGeolocationErrorMessage({ code: 1 }),
  BROWSE_GEOLOCATION_ERROR.PERMISSION_DENIED,
)
assert.equal(
  getBrowseGeolocationErrorMessage({ code: 2 }),
  BROWSE_GEOLOCATION_ERROR.POSITION_UNAVAILABLE,
)
assert.equal(
  getBrowseGeolocationErrorMessage({ code: 3 }),
  BROWSE_GEOLOCATION_ERROR.TIMEOUT,
)
assert.equal(
  getBrowseGeolocationErrorMessage({ code: 0, message: 'unsupported' }),
  BROWSE_GEOLOCATION_ERROR.UNSUPPORTED,
)

assert.deepEqual(
  readBrowseCurrentPositionCoords({ coords: { latitude: 55.8642, longitude: -4.2518 } }),
  { latitude: 55.8642, longitude: -4.2518 },
)
assert.equal(readBrowseCurrentPositionCoords({ coords: { latitude: null, longitude: -0.12 } }), null)

let capturedOptions = null
const fakeGeo = {
  getCurrentPosition(success, _error, options) {
    capturedOptions = options
    success({ coords: { latitude: 55.8642, longitude: -4.2518, accuracy: 25 } })
  },
}
const position = await requestBrowseCurrentPosition(fakeGeo)
assert.equal(position.coords.latitude, 55.8642)
assert.deepEqual(capturedOptions, BROWSE_GEOLOCATION_OPTIONS)

const deniedGeo = {
  getCurrentPosition(_success, error) {
    error({ code: 1, message: 'denied' })
  },
}
await assert.rejects(requestBrowseCurrentPosition(deniedGeo))

const unsupported = await requestBrowseCurrentPosition(null).then(
  () => null,
  (error) => error,
)
assert.equal(unsupported.code, 0)

const filterSource = readFileSync('src/components/browse/BrowseDistanceFilter.jsx', 'utf8')
assert.match(filterSource, /type="range"/, 'distance filter uses a compact radius slider')
assert.match(filterSource, /BROWSE_RADIUS_SLIDER_STEP/, 'slider uses 5-mile increments')
assert.match(filterSource, /Use my current location/, 'distance filter offers explicit current location')
assert.match(filterSource, /Enter a town or postcode/, 'distance filter offers manual town entry')
assert.match(filterSource, /Change location/, 'selected location can be changed')
assert.match(
  filterSource,
  /if \(!hasExplicitOrigin\) return/,
  'slider does not apply a radius until a location is chosen',
)

const store = new Map()
globalThis.window = {
  sessionStorage: {
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => {
      store.set(key, String(value))
    },
    removeItem: (key) => {
      store.delete(key)
    },
  },
}

const browserPlace = buildCurrentLocationPlace(53.8008, -1.5491)
const browserParams = applyBrowseFiltersToSearchParams(new URLSearchParams(), {
  locationSearch: 'Current location',
  locationPlace: browserPlace,
  buyerLatitude: 53.8008,
  buyerLongitude: -1.5491,
  radiusMiles: '25',
})
assert.equal(browserParams.get('location'), 'Current location')
assert.equal(browserParams.has('lat'), false, 'browser coordinates stay out of the browse URL')
assert.equal(browserParams.has('lng'), false)
assert.equal(browserParams.get('radius'), '25')

setStoredBrowseBrowserOrigin(53.8008, -1.5491)
const hydrated = hydrateBrowseLocationOrigin({
  locationSearch: 'Current location',
  locationPlace: { displayLabel: 'Current location', source: 'browser' },
  buyerLatitude: null,
  buyerLongitude: null,
})
assert.equal(hydrated.buyerLatitude, 53.8008)
assert.equal(hydrated.buyerLongitude, -1.5491)

const glasgow = { latitude: 55.8642, longitude: -4.2518 }
const londonHub = getLocationHubSearch(LOCATION_PAGES.london)
const gpsOnLondonHub = buildBrowseQueryOptions(
  {
    search: '',
    sort: 'newest',
    radiusMiles: 'uk',
    radiusMilesValue: null,
    buyerLatitude: glasgow.latitude,
    buyerLongitude: glasgow.longitude,
    locationSearch: 'Current location',
    locationPlace: buildCurrentLocationPlace(glasgow.latitude, glasgow.longitude),
  },
  { hubSearch: londonHub, profileCoordinates: { latitude: 51.5074, longitude: -0.1278 } },
)
assert.equal(gpsOnLondonHub.buyerLatitude, glasgow.latitude, 'GPS origin is not replaced by the London hub')
assert.equal(gpsOnLondonHub.buyerLongitude, glasgow.longitude)
assert.notEqual(gpsOnLondonHub.buyerLatitude, londonHub.latitude)
assert.equal(gpsOnLondonHub.radiusMiles, null, 'uk-wide radius stays unset until a mile value is chosen')

const gpsWithRadius = buildBrowseQueryOptions(
  {
    search: '',
    sort: 'newest',
    radiusMiles: '25',
    radiusMilesValue: 25,
    buyerLatitude: glasgow.latitude,
    buyerLongitude: glasgow.longitude,
    locationSearch: 'Current location',
    locationPlace: buildCurrentLocationPlace(glasgow.latitude, glasgow.longitude),
  },
  { hubSearch: londonHub, profileCoordinates: { latitude: 51.5074, longitude: -0.1278 } },
)
assert.equal(gpsWithRadius.buyerLatitude, glasgow.latitude)
assert.equal(gpsWithRadius.buyerLongitude, glasgow.longitude)
assert.equal(gpsWithRadius.radiusMiles, 25)

const failedGeoKeepsPlace = buildBrowseQueryOptions(
  {
    search: '',
    sort: 'newest',
    radiusMiles: '40',
    radiusMilesValue: 40,
    buyerLatitude: 53.4808,
    buyerLongitude: -2.2426,
    locationSearch: 'Manchester',
  },
  { hubSearch: londonHub },
)
assert.equal(failedGeoKeepsPlace.buyerLatitude, 53.4808, 'a failed GPS request must not invent London coordinates')
assert.equal(failedGeoKeepsPlace.buyerLongitude, -2.2426)

const css = readFileSync('src/components/messages/ConversationListItem.css', 'utf8')
assert.match(css, /white-space:\s*nowrap/, 'conversation previews truncate')
assert.match(css, /minmax\(0,\s*1fr\)/, 'conversation rows can shrink without overflow')
assert.doesNotMatch(css, /conversation-card__avatar-badge/, 'mobile inbox no longer overlays avatars')

console.log('test-browse-geolocation: ok')
