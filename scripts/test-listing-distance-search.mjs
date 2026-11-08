#!/usr/bin/env node
/**
 * Phase 5B — distance search unit tests.
 *
 * Usage:
 *   node scripts/test-listing-distance-search.mjs
 */

import {
  applyBrowseLocationToSearchParams,
  BROWSE_LOCATION_SOURCE_BROWSER,
  BROWSE_RADIUS_OPTIONS,
  BROWSE_RADIUS_PRESETS,
  BROWSE_RADIUS_SLIDER_MAX,
  BROWSE_RADIUS_SLIDER_MIN,
  BROWSE_RADIUS_SLIDER_STEP,
  BROWSE_RADIUS_UK_WIDE,
  getBrowseRadiusSliderDisplayMiles,
  snapBrowseRadiusMiles,
  filterListingsByRadius,
  formatListingDistanceLabel,
  getBrowseRadiusLabel,
  haversineDistanceMiles,
  isBrowseRadiusSearchActive,
  listingMatchesRadiusSearch,
  parseBrowseLocationFromSearchParams,
  parseBrowseRadiusMiles,
  shouldUseDistanceSearch,
  sortListingsByDistance,
} from '../src/lib/listingDistance.js'

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function logPass(message) {
  console.log(`PASS: ${message}`)
}

const leedsLat = 53.8008
const leedsLng = -1.5491
const wakefieldLat = 53.6833
const wakefieldLng = -1.4977

const distance = haversineDistanceMiles(leedsLat, leedsLng, wakefieldLat, wakefieldLng)
assert(distance != null && distance > 8 && distance < 12, `Expected ~10 miles, got ${distance}`)

logPass('Haversine distance between Leeds and Wakefield is about 10 miles')

assert(parseBrowseRadiusMiles(BROWSE_RADIUS_UK_WIDE) === null, 'UK wide radius parses to null')
assert(parseBrowseRadiusMiles('25') === 25, 'Numeric radius parses correctly')
assert(parseBrowseRadiusMiles('5') === 5, '5 miles parses correctly')
assert(parseBrowseRadiusMiles('200') === 200, '200 miles parses correctly')
assert(isBrowseRadiusSearchActive(25), '25 miles is an active radius search')
assert(!isBrowseRadiusSearchActive(null), 'UK wide is not a radius search')
assert(getBrowseRadiusLabel(BROWSE_RADIUS_UK_WIDE) === 'Nationwide', 'Nationwide label')
assert(
  BROWSE_RADIUS_OPTIONS.map((entry) => entry.value).join(',') === 'uk,5,10,25,50,100,200',
  'Radius options include 5–200 miles and nationwide',
)
assert(
  BROWSE_RADIUS_PRESETS.map((entry) => entry.value).join(',') === '5,10,25,50,100,200',
  'Distance presets are six explicit mile values with no nationwide default',
)
assert(BROWSE_RADIUS_SLIDER_MIN === 5, 'Slider minimum is 5 miles')
assert(BROWSE_RADIUS_SLIDER_MAX === 200, 'Slider maximum is 200 miles')
assert(BROWSE_RADIUS_SLIDER_STEP === 5, 'Slider steps in 5-mile increments')
assert(snapBrowseRadiusMiles(23) === 25, 'Slider snaps 23 miles to 25')
assert(snapBrowseRadiusMiles(7) === 5, 'Slider snaps 7 miles to 5')
assert(snapBrowseRadiusMiles(198) === 200, 'Slider snaps 198 miles to 200')
assert(getBrowseRadiusSliderDisplayMiles(BROWSE_RADIUS_UK_WIDE) === 25, 'Nationwide preview sits at 25 miles visually')
assert(getBrowseRadiusSliderDisplayMiles('40') === 40, 'Committed 40-mile radius is shown on the slider')
assert(getBrowseRadiusSliderDisplayMiles('12') === 10, 'Odd radius values snap to 5-mile increments')

const withCoords = {
  id: 'a',
  created_at: '2026-01-01T00:00:00Z',
  latitude: wakefieldLat,
  longitude: wakefieldLng,
}
const withoutCoords = {
  id: 'b',
  created_at: '2026-01-02T00:00:00Z',
  location: 'Leeds',
}

const ukWideResults = filterListingsByRadius(
  [withCoords, withoutCoords],
  leedsLat,
  leedsLng,
  null,
)
assert(ukWideResults.length === 2, 'UK wide search keeps listings without coordinates')
assert(
  ukWideResults.find((entry) => entry.id === 'a')?.distance_miles != null,
  'UK wide search computes distance when coordinates exist',
)

const radiusResults = filterListingsByRadius(
  [withCoords, withoutCoords],
  leedsLat,
  leedsLng,
  25,
)
assert(radiusResults.length === 1, 'Radius search excludes listings without coordinates')
assert(
  radiusResults[0].distance_miles <= 25,
  'Radius search keeps listings within selected radius',
)

logPass('UK wide and radius filtering behave as expected')

assert(
  listingMatchesRadiusSearch(withoutCoords, 25) === false,
  'Listings without coordinates fail radius match',
)
assert(
  listingMatchesRadiusSearch(withoutCoords, null) === true,
  'Listings without coordinates still match UK wide',
)

const sorted = sortListingsByDistance([
  { id: 'far', created_at: '2026-01-01T00:00:00Z', distance_miles: 40 },
  { id: 'near', created_at: '2026-01-02T00:00:00Z', distance_miles: 5 },
])
assert(sorted[0].id === 'near', 'Distance sort orders nearest first')

assert(
  formatListingDistanceLabel({ distance_miles: 12.2 }) === '12 miles away',
  'Distance label rounds to whole miles',
)
assert(
  formatListingDistanceLabel({ distance_miles: 0.4 }) === 'Less than a mile away',
  'Sub-mile distances use friendly label',
)

const params = new URLSearchParams('location=Wakefield&lat=53.6833&lng=-1.4977&radius=25')
const parsed = parseBrowseLocationFromSearchParams(params)
assert(parsed.locationSearch === 'Wakefield', 'Location label parsed from URL')
assert(parsed.buyerLatitude === 53.6833, 'Latitude parsed from URL')
assert(parsed.radiusMiles === '25', 'Radius parsed from URL')
assert(parsed.radiusMilesValue === 25, 'Radius value parsed from URL')
assert(
  shouldUseDistanceSearch({
    buyerLatitude: parsed.buyerLatitude,
    buyerLongitude: parsed.buyerLongitude,
  }),
  'URL location enables distance search',
)

logPass('URL parsing and distance labels behave as expected')

const townParams = applyBrowseLocationToSearchParams(new URLSearchParams(), {
  locationSearch: 'Wakefield',
  locationPlace: {
    displayLabel: 'Wakefield',
    latitude: wakefieldLat,
    longitude: wakefieldLng,
    source: 'place',
  },
  radiusMiles: '25',
})
assert(townParams.get('location') === 'Wakefield', 'Town search keeps the location label')
assert(townParams.get('lat') === String(wakefieldLat), 'Town search keeps latitude in the URL')
assert(townParams.get('lng') === String(wakefieldLng), 'Town search keeps longitude in the URL')
assert(townParams.get('radius') === '25', 'Town search keeps the selected radius')

const browserParams = applyBrowseLocationToSearchParams(new URLSearchParams(), {
  locationSearch: 'Current location',
  locationPlace: {
    displayLabel: 'Current location',
    latitude: leedsLat,
    longitude: leedsLng,
    source: BROWSE_LOCATION_SOURCE_BROWSER,
  },
  radiusMiles: '10',
})
assert(browserParams.get('location') === 'Current location', 'Browser origin keeps a coarse location label')
assert(!browserParams.has('lat'), 'Browser origin does not write latitude to the URL')
assert(!browserParams.has('lng'), 'Browser origin does not write longitude to the URL')
assert(browserParams.get('radius') === '10', 'Browser origin still writes the selected radius')

logPass('URL location privacy keeps town coordinates and omits precise browser coordinates')

console.log('\nAll listing distance search checks passed.')
