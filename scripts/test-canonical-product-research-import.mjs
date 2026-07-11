/**
 * Canonical product research import tests.
 */

import { PRODUCT_STATUS } from '../src/lib/intelligenceCanonicalProducts.js'
import {
  buildCanonicalProductImportPlan,
  buildCanonicalProductImportUpdate,
  buildImportPlanWithIntelligence,
  canOverwriteImportedValue,
  deriveCanonicalProductBaselineSource,
  deriveCanonicalProductPriceSource,
  IMPORT_ACTION,
  IMPORT_SOURCE,
  matchCanonicalProduct,
  normalizeImportHeaderMap,
  parseCsvResearchImportText,
} from '../src/lib/canonicalProductResearchImport.js'
import { BASELINE_MANUFACTURE_YEAR_SOURCE } from '../src/lib/baselineManufactureYear.js'

function assert(condition, label) {
  if (!condition) throw new Error(label)
}

const products = [
  {
    id: 'p1',
    brand: 'Life Fitness',
    canonical_product_name: 'Life Fitness Integrity Series Bike',
    canonical_product_key: 'life-fitness-exercise-bike-integrity-series-bike',
    original_base_price: null,
    baseline_manufacture_year: null,
    baseline_source: null,
    original_price_source: null,
    review_notes: null,
    source_intelligence_row_ids: ['row-1'],
    status: PRODUCT_STATUS.APPROVED,
  },
  {
    id: 'p2',
    brand: 'Life Fitness',
    canonical_product_name: 'Life Fitness Discover PowerMill',
    canonical_product_key: 'life-fitness-discover-powermill',
    original_base_price: 5200,
    original_price_source: 'manual',
    baseline_manufacture_year: 2012,
    baseline_source: 'manual_import',
    review_notes: '[research_approved 2026-01-01]',
    source_intelligence_row_ids: ['row-2'],
    status: PRODUCT_STATUS.APPROVED,
  },
  {
    id: 'p3',
    brand: 'Life Fitness',
    canonical_product_name: 'Life Fitness Integrity Series Crosstrainer',
    canonical_product_key: 'life-fitness-cross-trainer-integrity-series-crosstrainer',
    original_base_price: null,
    baseline_manufacture_year: 2017,
    baseline_source: null,
    review_notes: 'Baseline year populated from Life Fitness series default: Integrity Series = 2017.',
    source_intelligence_row_ids: ['row-3'],
    status: PRODUCT_STATUS.APPROVED,
  },
  {
    id: 'p4',
    brand: 'Technogym',
    canonical_product_name: 'Technogym Run Artis',
    canonical_product_key: 'technogym-treadmill-run-artis',
    original_base_price: null,
    baseline_manufacture_year: null,
    source_intelligence_row_ids: [],
    status: PRODUCT_STATUS.APPROVED,
  },
]

const csv = [
  'Canonical product key,Brand,Canonical product,Base price,Currency,Baseline year,Price confidence,Lifecycle confidence,Source URL',
  'life-fitness-exercise-bike-integrity-series-bike,Life Fitness,Life Fitness Integrity Series Bike,4800,GBP,2017,85,82,https://example.com/bike',
  'life-fitness-discover-powermill,Life Fitness,Life Fitness Discover PowerMill,5000,GBP,2013,80,80,',
  'life-fitness-cross-trainer-integrity-series-crosstrainer,Life Fitness,Life Fitness Integrity Series Crosstrainer,3900,GBP,2018,80,80,',
  ',Technogym,Technogym Run Artis,3000,GBP,2016,,,',
  ',Life Fitness,Life Fitness Integrity Series Bike,1000,GBP,2000,,,',
  ',Unknown Brand,Unknown Product,1000,GBP,2000,,,',
].join('\n')

const parsed = parseCsvResearchImportText(csv)
const headerMap = normalizeImportHeaderMap(parsed.headers)

assert(
  matchCanonicalProduct(products, {
    canonical_product_key: 'life-fitness-exercise-bike-integrity-series-bike',
  }).product?.id === 'p1',
  'matches by canonical_product_key',
)

assert(
  matchCanonicalProduct(products, {
    brand: 'Life Fitness',
    canonical_product_name: 'Life Fitness Discover PowerMill',
  }).product?.id === 'p2',
  'falls back to brand + canonical_product_name',
)

assert(
  matchCanonicalProduct([
    ...products,
    {
      ...products[0],
      id: 'p1-dup',
    },
  ], {
    canonical_product_key: 'life-fitness-exercise-bike-integrity-series-bike',
  }).ambiguous,
  'ambiguous canonical_product_key match is reported',
)

const verifiedUpdate = buildCanonicalProductImportUpdate(products[1], {
  original_base_price: 5000,
  baseline_manufacture_year: 2013,
})
assert(verifiedUpdate.conflicts.length > 0, 'verified price/baseline are not overwritten without force')

const seriesUpdate = buildCanonicalProductImportUpdate(products[2], {
  original_base_price: 3900,
  baseline_manufacture_year: 2018,
})
assert(seriesUpdate.update.original_base_price === 3900, 'missing price on series-default product can be imported')
assert(seriesUpdate.update.baseline_manufacture_year === 2018, 'series_default baseline can be overwritten')
assert(
  deriveCanonicalProductBaselineSource(products[2]) === 'series_default',
  'series default baseline source detected from review notes',
)

const forcedUpdate = buildCanonicalProductImportUpdate(
  products[1],
  { original_base_price: 5000, baseline_manufacture_year: 2013 },
  { force: true },
)
assert(forcedUpdate.conflicts.length === 0, '--force allows verified overwrite')
assert(forcedUpdate.update.original_price_source === IMPORT_SOURCE, 'import sets manual_import price source')

assert(
  !canOverwriteImportedValue({
    currentValue: 5200,
    currentSource: 'manual',
    force: false,
  }),
  'manual values are protected',
)

const dryPlan = buildCanonicalProductImportPlan(products, parsed.rows, headerMap)
const dryPlan2 = buildCanonicalProductImportPlan(products, parsed.rows, headerMap)
assert(
  JSON.stringify(dryPlan.summary) === JSON.stringify(dryPlan2.summary),
  'dry-run plan is deterministic',
)
assert(
  dryPlan.results.some((row) => row.action === IMPORT_ACTION.UPDATE),
  'dry-run includes UPDATE rows',
)
assert(
  dryPlan.results.some((row) => row.action === IMPORT_ACTION.CONFLICT),
  'dry-run includes CONFLICT rows',
)
assert(
  dryPlan.results.some((row) => row.action === IMPORT_ACTION.NO_MATCH),
  'dry-run includes NO_MATCH rows for unknown products',
)
assert(
  dryPlan.results.find((row) => row.importRow.brand === 'Technogym')?.action === IMPORT_ACTION.UPDATE,
  'non-Life Fitness products in catalogue can still be matched when present in spreadsheet',
)

const intelligenceRowsById = new Map([
  ['row-1', {
    id: 'row-1',
    best_original_price: null,
    best_original_price_source_id: null,
    baseline_manufacture_year: null,
    baseline_manufacture_year_source: null,
  }],
  ['row-3', {
    id: 'row-3',
    best_original_price: null,
    best_original_price_source_id: null,
    baseline_manufacture_year: 2017,
    baseline_manufacture_year_source: BASELINE_MANUFACTURE_YEAR_SOURCE.LIFE_FITNESS_SERIES_DEFAULT,
  }],
])

const planWithIntelligence = buildImportPlanWithIntelligence(
  products,
  parsed.rows,
  headerMap,
  intelligenceRowsById,
)

const bikeResult = planWithIntelligence.results.find((row) => row.matchedProductId === 'p1')
assert(bikeResult?.intelligencePatches?.length === 1, 'missing intelligence rows receive propagation patches')

const crossResult = planWithIntelligence.results.find((row) => row.matchedProductId === 'p3')
assert(crossResult?.intelligencePatches?.length === 1, 'series_default intelligence baseline can be propagated')

console.log('canonical product research import tests passed')
