#!/usr/bin/env node
/**
 * Regression: clicking a Google Places suggestion must not dismiss the
 * Browse Distance filter before `place_changed` can select the location.
 *
 * Usage:
 *   node scripts/test-browse-places-filter-dismiss.mjs
 */

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { shouldDismissBrowseFilterOnOutsidePointer } from '../src/lib/browseFilters.js'
import { isEventFromGooglePlacesAutocomplete } from '../src/lib/listingLocation.js'

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function logPass(message) {
  console.log(`PASS: ${message}`)
}

function createNode({ className = '', parent = null } = {}) {
  const node = {
    className,
    classList: {
      contains(name) {
        return className.split(/\s+/).filter(Boolean).includes(name)
      },
    },
    parentElement: parent,
    parentNode: parent,
    closest(selector) {
      const expected = selector.startsWith('.') ? selector.slice(1) : selector
      let current = node
      while (current) {
        if (current.classList?.contains?.(expected)) return current
        current = current.parentElement
      }
      return null
    },
    contains(other) {
      let current = other
      while (current) {
        if (current === node) return true
        current = current.parentElement
      }
      return false
    },
  }
  return node
}

function createEvent(target, { composedPath } = {}) {
  return {
    target,
    composedPath: composedPath
      ? () => composedPath
      : undefined,
  }
}

const filterRoot = createNode({ className: 'listing-browse__filters' })
const portalMenu = createNode({ className: 'browse-filter-pill__menu browse-filter-pill__menu--portal' })
const menuButton = createNode({ className: 'browse-distance-filter__town-btn', parent: portalMenu })
const pageBackground = createNode({ className: 'listing-browse__results' })

const pacContainer = createNode({ className: 'pac-container' })
const pacItem = createNode({ className: 'pac-item', parent: pacContainer })

assert(
  isEventFromGooglePlacesAutocomplete(createEvent(pacItem)) === true,
  'pac-item mousedown is recognised as Places autocomplete',
)
assert(
  isEventFromGooglePlacesAutocomplete(createEvent(pacContainer)) === true,
  'pac-container mousedown is recognised as Places autocomplete',
)
assert(
  isEventFromGooglePlacesAutocomplete(createEvent(pageBackground)) === false,
  'page background is not treated as Places autocomplete',
)
logPass('Places autocomplete event detection')

assert(
  shouldDismissBrowseFilterOnOutsidePointer(createEvent(pacItem), { rootElement: filterRoot }) === false,
  'clicking a Places suggestion does not dismiss the parent filter',
)
assert(
  shouldDismissBrowseFilterOnOutsidePointer(createEvent(pacContainer), { rootElement: filterRoot }) === false,
  'clicking the Places dropdown container does not dismiss the parent filter',
)
assert(
  shouldDismissBrowseFilterOnOutsidePointer(
    createEvent(pacItem, { composedPath: [pacItem, pacContainer, { nodeType: 9 }] }),
    { rootElement: filterRoot },
  ) === false,
  'composedPath through .pac-container does not dismiss the parent filter',
)
logPass('Places suggestion click keeps Distance filter open')

assert(
  shouldDismissBrowseFilterOnOutsidePointer(createEvent(menuButton), { rootElement: filterRoot }) === false,
  'clicks inside the portaled Distance menu stay open',
)
assert(
  shouldDismissBrowseFilterOnOutsidePointer(createEvent(filterRoot), { rootElement: filterRoot }) === false,
  'clicks inside the filter root stay open',
)
assert(
  shouldDismissBrowseFilterOnOutsidePointer(createEvent(pageBackground), { rootElement: filterRoot }) === true,
  'true outside clicks still dismiss the filter',
)
logPass('Existing outside-click dismiss behaviour is preserved')

const filtersSource = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../src/components/ListingBrowseFilters.jsx'),
  'utf8',
)
assert(
  filtersSource.includes('shouldDismissBrowseFilterOnOutsidePointer'),
  'ListingBrowseFilters uses the Places-aware dismiss helper',
)
assert(
  /document\.addEventListener\('mousedown', handlePointerDown\)/.test(filtersSource),
  'desktop filter still dismisses on document mousedown',
)
logPass('ListingBrowseFilters wires the regression fix')

console.log('All browse Places filter dismiss tests passed.')
