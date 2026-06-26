#!/usr/bin/env node
/**
 * Nearest-first browse sort safety checks.
 *
 * Usage:
 *   node scripts/test-nearest-sort.mjs
 */

import {
  hasBrowseLocationForSort,
  resolveBrowseBuyerCoordinates,
} from '../src/lib/browseFilters.js'
import {
  getListingCoordinates,
  hasValidCoordinates,
  isValidCoordinate,
  safeDistanceMiles,
} from '../src/lib/listingDistance.js'
import {
  applyListingSort,
  getEffectiveListingSort,
  getFetchListingSort,
  getSortDbOrder,
  sortListingsByNearest,
} from '../src/lib/listingSort.js'

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function logPass(message) {
  console.log(`PASS: ${message}`)
}

assert(!isValidCoordinate(null), 'null is invalid')
assert(!isValidCoordinate(''), 'empty string is invalid')
assert(!isValidCoordinate('abc'), 'abc is invalid')
assert(isValidCoordinate('53.8'), 'numeric string is valid')
assert(isValidCoordinate(53.8), 'number is valid')

logPass('isValidCoordinate guards')

assert(!hasValidCoordinates({ latitude: null, longitude: -1.5 }), 'null latitude rejected')
assert(hasValidCoordinates({ lat: 53.8, lng: -1.5 }), 'lat/lng aliases supported')
assert(safeDistanceMiles(53.8, -1.5, 53.9, -1.6) != null, 'safeDistanceMiles returns miles')
assert(safeDistanceMiles('bad', -1.5, 53.9, -1.6) == null, 'safeDistanceMiles rejects invalid input')

logPass('listing coordinate helpers')

const profile = { latitude: 53.8, longitude: -1.5 }
const filtersNearest = { sort: 'nearest', buyerLatitude: null, buyerLongitude: null }
const filtersInvalid = { sort: 'nearest', buyerLatitude: '', buyerLongitude: '' }

assert(
  !hasBrowseLocationForSort(filtersNearest, null),
  'nearest without profile coords has no location for sort',
)
assert(
  hasBrowseLocationForSort(filtersNearest, profile),
  'nearest with profile coords has location for sort',
)
assert(
  !hasBrowseLocationForSort(filtersInvalid, { latitude: 'bad', longitude: 'data' }),
  'invalid profile coords ignored',
)

const resolved = resolveBrowseBuyerCoordinates(filtersNearest, profile)
assert(resolved.latitude === 53.8, 'profile coords resolved for nearest sort')

logPass('browse buyer coordinate resolution')

assert(
  getEffectiveListingSort('nearest', { hasLocationSearch: false }) === 'newest',
  'nearest without location falls back for fetch sort',
)
assert(
  getEffectiveListingSort('nearest', { hasLocationSearch: true }) === 'nearest',
  'nearest with location stays nearest',
)
assert(
  getFetchListingSort('nearest', { hasLocationSearch: true }) === 'newest',
  'nearest fetch uses newest at DB layer',
)
assert(
  getSortDbOrder('nearest', { hasLocationSearch: true }).column === 'created_at',
  'nearest never orders by distance_miles in DB',
)

logPass('sort selection guards')

const listings = [
  { id: 'far', latitude: 54.5, longitude: -2, created_at: '2024-01-01T00:00:00Z' },
  { id: 'near', latitude: 53.81, longitude: -1.51, created_at: '2024-01-02T00:00:00Z' },
  { id: 'none', location: 'Leeds', created_at: '2024-01-03T00:00:00Z' },
  { id: 'bad', latitude: 'oops', longitude: 'nope', created_at: '2024-01-04T00:00:00Z' },
]

const nearestSorted = sortListingsByNearest(listings, 53.8, -1.5)
assert(nearestSorted[0].id === 'near', 'nearest listing first')
const tailIds = nearestSorted.slice(-2).map((listing) => listing.id)
assert(tailIds.includes('none') && tailIds.includes('bad'), 'listings without coords sort last')
assert(
  applyListingSort(listings, 'nearest', '', {
    hasLocationSearch: false,
    buyerCoordinates: null,
  }).length === listings.length,
  'nearest without buyer coords does not drop listings',
)
assert(
  applyListingSort(listings, 'nearest', '', {
    hasLocationSearch: true,
    buyerCoordinates: profile,
  })[0].id === 'near',
  'applyListingSort nearest uses buyer profile coords',
)

const coords = getListingCoordinates({ lat: 1.2, lng: 3.4 })
assert(coords.latitude === 1.2 && coords.longitude === 3.4, 'listing coordinate aliases normalize')

logPass('nearest client-side sorting')

console.log('\nAll nearest sort safety checks passed.')
