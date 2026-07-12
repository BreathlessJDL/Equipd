/**
 * Canonical product list spreadsheet export tests.
 */

import {
  buildCanonicalProductExportRows,
  buildCanonicalProductExportWorkbook,
} from '../src/lib/canonicalProductListExport.js'
import {
  CANONICAL_COMPLETION_STATUS,
  mapCanonicalProductToDisplayGroup,
} from '../src/lib/equipmentResearchQueue.js'

function assert(condition, label) {
  if (!condition) throw new Error(label)
}

const product = {
  id: 'prod-1',
  brand: 'Life Fitness',
  product_family: 'Integrity Series',
  model: 'Bike',
  equipment_type: 'Exercise Bike',
  canonical_product_name: 'Life Fitness Integrity Series Bike',
  canonical_product_key: 'life-fitness-exercise-bike-integrity-series-bike',
  original_base_price: 5200,
  original_base_price_currency: 'GBP',
  original_price_confidence: 88,
  baseline_manufacture_year: 2017,
  production_start_year: 2011,
  production_end_year: 2018,
  source_intelligence_row_ids: ['row-1', 'row-2'],
  status: 'approved',
  review_notes: 'Baseline year populated from Life Fitness series default: Integrity Series = 2017.',
}

const group = mapCanonicalProductToDisplayGroup(product, 1)
group.completionStatus = CANONICAL_COMPLETION_STATUS.COMPLETE

const rows = buildCanonicalProductExportRows([group], { origin: 'https://equipd.test' })
assert(rows.length === 1, 'export builds one row per canonical product')
assert(rows[0].rank === 1, 'rank exported')
assert(rows[0].canonicalProductName === 'Life Fitness Integrity Series Bike', 'canonical name exported')
assert(rows[0].basePrice === 5200, 'base price exported as number')
assert(rows[0].baselineYear === 2017, 'baseline year exported')
assert(rows[0].baselineSource === 'Series default', 'baseline source exported')
assert(rows[0].sourceRowCount === 2, 'source row count exported')
assert(
  rows[0].productPageUrl.includes('/equipment/life-fitness-exercise-bike-integrity-series-bike'),
  'product page URL exported',
)

const workbook = await buildCanonicalProductExportWorkbook([group], { origin: 'https://equipd.test' })
const worksheet = workbook.getWorksheet('Canonical products')
assert(worksheet, 'workbook contains canonical products worksheet')
assert(worksheet.rowCount === 2, 'worksheet has header plus one data row')
assert(worksheet.getRow(1).getCell(1).value === 'Rank', 'header row present')

console.log('canonical product list export tests passed')
