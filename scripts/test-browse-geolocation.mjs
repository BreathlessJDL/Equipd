#!/usr/bin/env node
/**
 * Browse geolocation is opt-in: never auto-prompt on page load.
 *
 *   node scripts/test-browse-geolocation.mjs
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  BROWSE_LOCATION_PROMPT_COPY,
  buildCurrentLocationPlace,
  hydrateBrowseLocationOrigin,
  setStoredBrowseBrowserOrigin,
  shouldAutoPromptBrowseGeolocation,
} from '../src/lib/browseGeolocation.js'
import { applyBrowseFiltersToSearchParams } from '../src/lib/browseFilters.js'

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

const css = readFileSync('src/components/messages/ConversationListItem.css', 'utf8')
assert.match(css, /white-space:\s*nowrap/, 'conversation previews truncate')
assert.match(css, /minmax\(0,\s*1fr\)/, 'conversation rows can shrink without overflow')
assert.doesNotMatch(css, /conversation-card__avatar-badge/, 'mobile inbox no longer overlays avatars')

console.log('test-browse-geolocation: ok')
