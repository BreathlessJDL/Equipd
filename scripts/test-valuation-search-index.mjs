/**
 * Compact valuation search-index + cache behaviour tests.
 */

import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  VALUATION_SEARCH_INDEX_FIELDS,
  VALUATION_SEARCH_INDEX_PATH,
  VALUATION_SEARCH_INDEX_VERSION,
  assertValuationSearchIndexRowShape,
  normalizeValuationSearchIndexPayload,
  toValuationSearchIndexRow,
  readValuationSearchIndexFromSessionStorage,
  writeValuationSearchIndexToSessionStorage,
} from '../src/lib/valuationSearchIndex.js'
import { resolveValuationSearchMatches } from '../src/lib/equipmentValuation.js'

const forbiddenFields = [
  'review_notes',
  'source_intelligence_row_ids',
  'image_reviewed_by',
  'image_failure_reason',
  'original_price_source_url',
  'faq',
  'overview',
]

{
  const row = toValuationSearchIndexRow({
    id: '1',
    brand: 'Life Fitness',
    product_family: 'Integrity',
    model: 'Integrity Treadmill',
    equipment_type: 'Treadmill',
    canonical_product_name: 'Life Fitness Integrity Treadmill',
    canonical_product_key: 'life-fitness-treadmill-integrity-series-treadmill',
    baseline_manufacture_year: 2018,
    production_start_year: 2018,
    production_end_year: null,
    original_base_price: 9000,
    original_base_price_currency: 'GBP',
    image_storage_path: 'equipment/life-fitness/x.png',
    image_status: 'approved',
    review_notes: 'should be stripped',
    overview: 'should be stripped',
  })
  assertValuationSearchIndexRowShape(row)
  for (const field of VALUATION_SEARCH_INDEX_FIELDS) {
    assert.ok(field in row, `row includes ${field}`)
  }
  for (const field of forbiddenFields) {
    assert.equal(Object.hasOwn(row, field), false, `row excludes ${field}`)
  }
}

{
  const payload = normalizeValuationSearchIndexPayload({
    version: VALUATION_SEARCH_INDEX_VERSION,
    generatedAt: '2026-07-22T00:00:00.000Z',
    products: [
      {
        id: 'a',
        brand: 'Technogym',
        product_family: 'Excite',
        model: 'Run 600',
        equipment_type: 'Treadmill',
        canonical_product_name: 'Technogym Excite Run 600',
        canonical_product_key: 'technogym-treadmill-excite-run-600',
        baseline_manufacture_year: 2012,
        production_start_year: 2010,
        production_end_year: 2016,
        original_base_price: 7000,
        original_base_price_currency: 'GBP',
        image_storage_path: null,
        image_status: 'none',
      },
      {
        id: 'b',
        brand: 'Life Fitness',
        product_family: 'Elevation',
        model: '95T',
        equipment_type: 'Treadmill',
        canonical_product_name: 'Life Fitness Elevation 95T',
        canonical_product_key: 'life-fitness-treadmill-elevation-treadmill',
        baseline_manufacture_year: 2015,
        production_start_year: 2015,
        production_end_year: null,
        original_base_price: 8500,
        original_base_price_currency: 'GBP',
        image_storage_path: null,
        image_status: 'none',
      },
    ],
  })
  assert.equal(payload.count, 2)
  const matches = resolveValuationSearchMatches(payload.products, 'life fitness treadmill')
  assert.ok(matches.matches.length >= 1, 'local ranking returns matches from compact rows')
  assert.equal(
    matches.matches[0].canonical_product_key,
    'life-fitness-treadmill-elevation-treadmill',
  )
}

{
  const memory = new Map()
  const storage = {
    getItem: (key) => memory.get(key) ?? null,
    setItem: (key, value) => { memory.set(key, String(value)) },
  }
  const payload = {
    version: VALUATION_SEARCH_INDEX_VERSION,
    generatedAt: '2026-07-22T00:00:00.000Z',
    count: 1,
    products: [
      toValuationSearchIndexRow({
        id: 'c',
        brand: 'Matrix',
        model: 'T7x',
        equipment_type: 'Treadmill',
        canonical_product_name: 'Matrix T7x',
        canonical_product_key: 'matrix-treadmill-t7x',
        baseline_manufacture_year: 2019,
        original_base_price: 5000,
        original_base_price_currency: 'GBP',
      }),
    ],
  }
  assert.equal(writeValuationSearchIndexToSessionStorage(payload, storage), true)
  const restored = readValuationSearchIndexFromSessionStorage(storage)
  assert.equal(restored.count, 1)
  assert.equal(restored.products[0].canonical_product_key, 'matrix-treadmill-t7x')
}

const cacheSource = readFileSync(join(process.cwd(), 'src', 'lib', 'valuationCatalogCache.js'), 'utf8')
assert.match(cacheSource, /getValuationSearchIndex/)
assert.match(cacheSource, /prefetchValuationSearchIndex/)
assert.match(cacheSource, /searchIndexInflight/)
assert.doesNotMatch(cacheSource, /fetchDedupedApprovedCanonicalProducts/)

const packageJson = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf8'))
assert.match(packageJson.scripts.build, /generate-valuation-search-index/)

const indexPath = join(process.cwd(), 'public', VALUATION_SEARCH_INDEX_PATH.replace(/^\//, ''))
if (existsSync(indexPath)) {
  const onDisk = normalizeValuationSearchIndexPayload(JSON.parse(readFileSync(indexPath, 'utf8')))
  assert.equal(onDisk.version, VALUATION_SEARCH_INDEX_VERSION)
  assert.ok(onDisk.products.length > 100, 'generated index contains catalogue products')
  assertValuationSearchIndexRowShape(onDisk.products[0])
  for (const field of forbiddenFields) {
    assert.equal(Object.hasOwn(onDisk.products[0], field), false)
  }
}

console.log('test-valuation-search-index: ok')
