#!/usr/bin/env node
/**
 * Browse location input must stay editable without remounting or restoring GPS.
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  applyBrowseFiltersToSearchParams,
  parseBrowseFiltersFromSearchParams,
} from '../src/lib/browseFilters.js'
import { hydrateBrowseLocationOrigin, setStoredBrowseBrowserOrigin } from '../src/lib/browseGeolocation.js'
import {
  BROWSE_CURRENT_LOCATION_LABEL,
  getEditableBrowseLocationInputValue,
} from '../src/lib/listingDistance.js'

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

assert.equal(
  getEditableBrowseLocationInputValue(
    { source: 'browser', displayLabel: BROWSE_CURRENT_LOCATION_LABEL },
    BROWSE_CURRENT_LOCATION_LABEL,
  ),
  '',
  'Current location is not copied into the editable field',
)
assert.equal(
  getEditableBrowseLocationInputValue(
    { source: 'place', displayLabel: 'Shrewsbury' },
    'Shrewsbury',
  ),
  'Shrewsbury',
)

setStoredBrowseBrowserOrigin(52.7073, -2.7541)
const clearedWhileStored = hydrateBrowseLocationOrigin({
  locationSearch: '',
  locationPlace: null,
  buyerLatitude: null,
  buyerLongitude: null,
})
assert.equal(clearedWhileStored.buyerLatitude, null, 'empty input does not restore stored GPS')
assert.equal(clearedWhileStored.buyerLongitude, null)

const partialLabel = hydrateBrowseLocationOrigin({
  locationSearch: 'Current locatio',
  locationPlace: null,
  buyerLatitude: null,
  buyerLongitude: null,
})
assert.equal(partialLabel.buyerLatitude, null, 'partial Current location text does not restore GPS')

const draftAfterClear = {
  locationSearch: '',
  locationPlace: null,
  buyerLatitude: null,
  buyerLongitude: null,
  radiusMiles: '25',
}
const params = applyBrowseFiltersToSearchParams(new URLSearchParams(), draftAfterClear)
assert.equal(params.get('location'), null)
assert.equal(params.has('lat'), false)
assert.equal(params.get('radius'), '25', 'radius remains after clearing the location field')

const parsed = parseBrowseFiltersFromSearchParams(params)
assert.equal(parsed.locationSearch, '')
assert.equal(parsed.buyerLatitude, null)

const fieldSource = readFileSync('src/components/browse/BrowseLocationSearchField.jsx', 'utf8')
assert.doesNotMatch(
  fieldSource,
  /onPlaceSelectedRef\.current\(null\)/,
  'typing does not emit a second place-null update',
)

const filterSource = readFileSync('src/components/browse/BrowseDistanceFilter.jsx', 'utf8')
assert.match(filterSource, /const \[inputValue, setInputValue\]/)
assert.match(filterSource, /getEditableBrowseLocationInputValue/)
assert.doesNotMatch(
  filterSource,
  /if \(hasExplicitOrigin\) \{\s*setShowTownSearch\(false\)/,
  'committed origin does not unmount the town field while editing',
)
assert.match(filterSource, /value=\{inputValue\}/)
assert.doesNotMatch(filterSource, /value=\{locationSearch\}/)

const fieldCss = readFileSync('src/components/browse/BrowseLocationSearchField.css', 'utf8')
assert.match(
  fieldCss,
  /@media \(max-width: 767px\)[\s\S]*\.browse-location-search__input[\s\S]*font-size:\s*16px/,
  'mobile location input is at least 16px to prevent iOS focus zoom',
)
assert.match(fieldCss, /font-size:\s*0\.875rem/, 'desktop location input keeps compact type')

const distanceCss = readFileSync('src/components/browse/BrowseDistanceFilter.css', 'utf8')
assert.match(
  distanceCss,
  /@media \(max-width: 767px\)[\s\S]*font-size:\s*16px/,
  'Distance town field also uses 16px on mobile',
)

assert.match(fieldSource, /inputRef\.current\.blur\(\)/, 'selecting a Places result blurs the input')

const indexHtml = readFileSync('index.html', 'utf8')
assert.match(indexHtml, /name="viewport"/)
assert.doesNotMatch(indexHtml, /user-scalable\s*=\s*no/)
assert.doesNotMatch(indexHtml, /maximum-scale\s*=\s*1/)

const hookSource = readFileSync('src/hooks/useBrowseFilters.js', 'utf8')
assert.match(
  hookSource,
  /if \(!place\) \{\s*handleLocationSearchChange\(''\)/,
)
assert.match(hookSource, /clearStoredBrowseBrowserOrigin\(\)/)

console.log('PASS: browse location input stays separate from committed origin')
