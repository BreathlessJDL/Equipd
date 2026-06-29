#!/usr/bin/env node
/**
 * Phase 5A — listing location formatting tests.
 *
 * Usage:
 *   node scripts/test-listing-location-formatting.mjs
 */

import {
  buildListingLocationFields,
  buildCollectionAddressPlaceSelection,
  formatListingLocationCard,
  formatListingLocationDetail,
  formatStructuredLocationDisplay,
  listingLocationFromRecord,
  listingLocationToFormFields,
  mapGooglePlaceToListingLocation,
  normalizeUkPostcode,
  pickExistingListingLocationFields,
  resolveListingLocationPayload,
  shouldAutoFillListingLocationFromAddress,
} from '../src/lib/listingLocation.js'

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function logPass(message) {
  console.log(`PASS: ${message}`)
}

assert(normalizeUkPostcode('ls14dy') === 'LS1 4DY', 'Postcode normalisation')

const wakefieldPlace = mapGooglePlaceToListingLocation({
  name: 'Wakefield',
  address_components: [
    { long_name: 'Wakefield', short_name: 'Wakefield', types: ['postal_town'] },
    { long_name: 'West Yorkshire', short_name: 'West Yorkshire', types: ['administrative_area_level_2'] },
    { long_name: 'England', short_name: 'England', types: ['administrative_area_level_1'] },
  ],
  geometry: {
    location: {
      lat: () => 53.6833,
      lng: () => -1.4977,
    },
  },
})

assert(wakefieldPlace.city === 'Wakefield', 'Wakefield city parsed')
assert(wakefieldPlace.county === 'West Yorkshire', 'Wakefield county parsed')
assert(
  wakefieldPlace.displayLabel === 'Wakefield, West Yorkshire',
  'Wakefield display label formatted',
)

const dbFields = buildListingLocationFields(wakefieldPlace)
assert(dbFields.location === 'Wakefield, West Yorkshire', 'DB location synced')
assert(dbFields.latitude === 53.6833, 'Latitude stored')

const legacyListing = {
  location: 'Leeds',
  location_name: 'Leeds',
  city: 'Leeds',
}

assert(formatListingLocationDetail(legacyListing) === 'Leeds', 'Legacy listing detail display')
assert(formatListingLocationCard(legacyListing) === 'Leeds', 'Legacy listing card display')

const legacyForm = listingLocationToFormFields({ location: 'Manchester, Greater Manchester' })
assert(legacyForm.locationSearch === 'Manchester, Greater Manchester', 'Legacy form search preserved')

const preserved = resolveListingLocationPayload(
  { locationPlace: null, locationSearch: 'Manchester, Greater Manchester' },
  { location: 'Manchester, Greater Manchester', city: 'Manchester', county: 'Greater Manchester' },
)
assert(preserved.city === 'Manchester', 'Edit preserves existing structured location')

const selected = resolveListingLocationPayload({
  locationPlace: wakefieldPlace,
  locationSearch: wakefieldPlace.displayLabel,
})
assert(selected.postcode == null || selected.city === 'Wakefield', 'Selected place payload saved')

assert(listingLocationFromRecord(preserved)?.city === 'Manchester', 'Structured record round-trip')

assert(
  shouldAutoFillListingLocationFromAddress({ locationPlace: null, locationSearch: '' }) === true,
  'Auto-fill allowed when listing location empty',
)
assert(
  shouldAutoFillListingLocationFromAddress({
    locationPlace: wakefieldPlace,
    locationSearch: wakefieldPlace.displayLabel,
  }) === false,
  'Auto-fill blocked when listing location already selected',
)

const streetPlace = buildCollectionAddressPlaceSelection({
  formatted_address: '12 High Street, Wakefield WF1 1AA, UK',
  address_components: [
    { long_name: '12', short_name: '12', types: ['street_number'] },
    { long_name: 'High Street', short_name: 'High St', types: ['route'] },
    { long_name: 'Wakefield', short_name: 'Wakefield', types: ['postal_town'] },
    { long_name: 'West Yorkshire', short_name: 'West Yorkshire', types: ['administrative_area_level_2'] },
    { long_name: 'WF1 1AA', short_name: 'WF1 1AA', types: ['postal_code'] },
  ],
  geometry: {
    location: {
      lat: () => 53.6833,
      lng: () => -1.4977,
    },
  },
})

assert(streetPlace.formattedAddress.includes('High Street'), 'Collection address keeps full street line')
assert(streetPlace.publicLocation.city === 'Wakefield', 'Public location uses town not street')
assert(
  streetPlace.publicLocation.displayLabel === 'Wakefield, West Yorkshire',
  'Public location label is card-safe',
)

logPass('Listing location helpers behave as expected')
console.log('\nAll listing location formatting checks passed.')
