/**
 * Classification report tests for research import (report-only; no logic change).
 * Run: node scripts/test-equipment-product-research-import-report.mjs
 */

import {
  RESEARCH_CSV_HEADERS,
  RESEARCH_IMPORT_ROW_CATEGORY,
  buildResearchImportPlan,
  sanitizeCsvCell,
} from '../src/lib/equipmentProductResearchCsv.js'
import {
  classifyResearchImportPlanRows,
} from '../src/lib/equipmentProductResearchImportReport.js'

function assert(condition, label) {
  if (!condition) throw new Error(label)
}

function assertEqual(a, b, label) {
  if (a !== b) throw new Error(`${label}: expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`)
}

function rowFrom(partial) {
  const base = Object.fromEntries(RESEARCH_CSV_HEADERS.map((h) => [h, '']))
  Object.assign(base, partial)
  return base
}

const productA = {
  id: 'a',
  brand: 'Peloton',
  canonical_product_key: 'peloton-a',
  product_family: 'Bike',
  model: 'Bike',
  equipment_type: 'Exercise Bike',
  baseline_manufacture_year: null,
  production_start_year: 2018,
  production_end_year: null,
  original_base_price: null,
  original_base_price_currency: null,
  original_price_confidence: null,
  status: 'pending',
}

const productB = {
  ...productA,
  id: 'b',
  canonical_product_key: 'peloton-b',
  model: 'Bike+',
  baseline_manufacture_year: 2020,
  original_base_price: 1000,
  original_base_price_currency: 'GBP',
}

const map = new Map([['a', productA], ['b', productB]])

const rows = [
  rowFrom({
    __line: 2,
    product_id: 'a',
    canonical_product_key: 'peloton-a',
    brand: 'Peloton',
    researched_baseline_manufacture_year: '2020',
  }),
  rowFrom({
    __line: 3,
    product_id: 'b',
    canonical_product_key: 'peloton-b',
    brand: 'Peloton',
    // blanks → no changes
  }),
  rowFrom({
    __line: 4,
    product_id: 'missing',
    canonical_product_key: 'x',
    brand: 'Peloton',
    researched_original_base_price: '100',
    researched_currency: 'GBP',
  }),
  rowFrom({
    __line: 5,
    product_id: 'a',
    canonical_product_key: 'wrong-key',
    brand: 'Peloton',
    researched_baseline_manufacture_year: '2021',
  }),
  rowFrom({
    __line: 6,
    product_id: 'b',
    canonical_product_key: 'peloton-b',
    brand: 'Peloton',
    researched_baseline_manufacture_year: '1969',
  }),
  rowFrom({
    __line: 7,
    product_id: 'b',
    canonical_product_key: 'peloton-b',
    brand: 'Peloton',
    researched_original_base_price: '-1',
    researched_currency: 'GBP',
  }),
  rowFrom({
    __line: 8,
    product_id: 'a',
    canonical_product_key: 'peloton-a',
    brand: 'Peloton',
    researched_category: 'Cardio',
  }),
  rowFrom({
    __line: 9,
    product_id: 'a',
    canonical_product_key: 'peloton-a',
    brand: 'Peloton',
    researched_baseline_manufacture_year: '2019',
  }),
]

// Line 5 is duplicate product id for 'a' after line 2; line 6/7/8/9 also use a or b after first a and b...
// Rebuild cleaner rows so duplicate id is explicit.

const cleanRows = [
  rowFrom({ __line: 2, product_id: 'a', canonical_product_key: 'peloton-a', brand: 'Peloton', researched_baseline_manufacture_year: '2020' }),
  rowFrom({ __line: 3, product_id: 'b', canonical_product_key: 'peloton-b', brand: 'Peloton' }),
  rowFrom({ __line: 4, product_id: 'missing', canonical_product_key: 'x', brand: 'Peloton', researched_currency: 'GBP', researched_original_base_price: '100' }),
  rowFrom({ __line: 5, product_id: 'a', canonical_product_key: 'wrong', brand: 'Peloton', researched_baseline_manufacture_year: '2021' }),
  rowFrom({
    __line: 6,
    product_id: 'c-missing',
    canonical_product_key: 'c',
    brand: 'Peloton',
    researched_baseline_manufacture_year: '1969',
  }),
]

// Need product for invalid year that's found — use b with bad year after b already used as unchanged:
const products = new Map([
  ['a', productA],
  ['b', productB],
  ['c', { ...productB, id: 'c', canonical_product_key: 'peloton-c' }],
  ['d', { ...productB, id: 'd', canonical_product_key: 'peloton-d' }],
  ['e', { ...productB, id: 'e', canonical_product_key: 'peloton-e' }],
  ['f', { ...productB, id: 'f', canonical_product_key: 'peloton-f' }],
])

const fullRows = [
  rowFrom({ __line: 2, product_id: 'a', canonical_product_key: 'peloton-a', brand: 'Peloton', researched_baseline_manufacture_year: '2020' }),
  rowFrom({ __line: 3, product_id: 'b', canonical_product_key: 'peloton-b', brand: 'Peloton' }),
  rowFrom({ __line: 4, product_id: 'missing', canonical_product_key: 'x', brand: 'Peloton', researched_original_base_price: '100', researched_currency: 'GBP' }),
  rowFrom({ __line: 5, product_id: 'c', canonical_product_key: 'wrong-key', brand: 'Peloton', researched_baseline_manufacture_year: '2021' }),
  rowFrom({ __line: 6, product_id: 'd', canonical_product_key: 'peloton-d', brand: 'Peloton', researched_baseline_manufacture_year: '1969' }),
  rowFrom({ __line: 7, product_id: 'e', canonical_product_key: 'peloton-e', brand: 'Peloton', researched_original_base_price: '-5', researched_currency: 'GBP' }),
  rowFrom({ __line: 8, product_id: 'f', canonical_product_key: 'peloton-f', brand: 'Peloton', researched_category: 'Cardio' }),
  rowFrom({ __line: 9, product_id: 'a', canonical_product_key: 'peloton-a', brand: 'Peloton', researched_baseline_manufacture_year: '2022' }),
]

const plan = buildResearchImportPlan(fullRows, products)
const report = classifyResearchImportPlanRows(fullRows, plan)

assertEqual(report.classifications.length, 8, 'one class per row')
assertEqual(report.classificationSummary.counts[RESEARCH_IMPORT_ROW_CATEGORY.VALID_UPDATE], 1, 'one valid')
assertEqual(report.classificationSummary.counts[RESEARCH_IMPORT_ROW_CATEGORY.NO_CHANGES], 1, 'one unchanged')
assertEqual(report.classificationSummary.counts[RESEARCH_IMPORT_ROW_CATEGORY.PRODUCT_ID_NOT_FOUND], 1, 'not found')
assertEqual(report.classificationSummary.counts[RESEARCH_IMPORT_ROW_CATEGORY.CANONICAL_KEY_MISMATCH], 1, 'key mismatch')
assertEqual(report.classificationSummary.counts[RESEARCH_IMPORT_ROW_CATEGORY.INVALID_BASELINE_YEAR], 1, 'bad year')
assertEqual(report.classificationSummary.counts[RESEARCH_IMPORT_ROW_CATEGORY.INVALID_PRICE], 1, 'bad price')
assertEqual(report.classificationSummary.counts[RESEARCH_IMPORT_ROW_CATEGORY.UNSUPPORTED_RESEARCHED_FIELD], 1, 'category unsupported')
assertEqual(report.classificationSummary.counts[RESEARCH_IMPORT_ROW_CATEGORY.DUPLICATE_PRODUCT_ID], 1, 'dup id')

assert(report.rejectionCsv.includes('rejection_reason'), 'rejection csv header')
assert(report.rejectionCsv.includes('product not found'), 'rejection csv body')
assertEqual(plan.summary.validUpdates, 1, 'import logic still one valid update')

console.log(report.classificationSummary.text)
console.log('test-equipment-product-research-import-report: all assertions passed')
