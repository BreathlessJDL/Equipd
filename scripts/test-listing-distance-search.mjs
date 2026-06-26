#!/usr/bin/env node
/**
 * Phase 5B — distance search unit tests.
 *
 * Usage:
 *   node scripts/test-listing-distance-search.mjs
 */

import {
  BROWSE_RADIUS_UK_WIDE,
  filterListingsByRadius,
  formatListingDistanceLabel,
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
assert(isBrowseRadiusSearchActive(25), '25 miles is an active radius search')
assert(!isBrowseRadiusSearchActive(null), 'UK wide is not a radius search')

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

console.log('\nAll listing distance search checks passed.')
