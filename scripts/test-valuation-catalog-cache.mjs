/**
 * Valuation catalogue / search-index wiring checks.
 */

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const cacheSource = readFileSync(join(process.cwd(), 'src', 'lib', 'valuationCatalogCache.js'), 'utf8')
assert.match(cacheSource, /getValuationSearchIndex/)
assert.match(cacheSource, /prefetchValuationSearchIndex/)
assert.match(cacheSource, /searchIndexInflight/)
assert.doesNotMatch(cacheSource, /fetchDedupedApprovedCanonicalProducts/)

const autocompleteSource = readFileSync(
  join(process.cwd(), 'src', 'components', 'CanonicalEquipmentAutocomplete.jsx'),
  'utf8',
)
assert.match(autocompleteSource, /getValuationSearchIndex/)
assert.match(autocompleteSource, /Loading equipment/)
assert.doesNotMatch(autocompleteSource, /Searching…/)

const homeSource = readFileSync(
  join(process.cwd(), 'src', 'components', 'home', 'HomeEquipmentValuator.jsx'),
  'utf8',
)
assert.match(homeSource, /prefetchValuationSearchIndex/)
assert.match(homeSource, /requestIdleCallback/)

const pageSource = readFileSync(join(process.cwd(), 'src', 'pages', 'ValuationPage.jsx'), 'utf8')
assert.match(pageSource, /getValuationSearchIndex/)
assert.doesNotMatch(pageSource, /getValuationCatalogProducts\(/)
assert.match(pageSource, /state:\s*\{\s*product\s*\}/)

console.log('test-valuation-catalog-cache: ok')
