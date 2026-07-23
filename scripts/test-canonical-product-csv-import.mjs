/**
 * Tests for authoritative canonical product CSV import.
 *
 * Proves original_rrp → original_base_price and
 * baseline_manufacture_year → product baseline used by valuation.
 */

import {
  CANONICAL_CSV_GUIDANCE,
  CANONICAL_CSV_ROW_ACTION,
  SAMPLE_CANONICAL_PRODUCT_CSV,
  buildCanonicalCsvImportPlan,
  buildCanonicalCsvInsertPayload,
  buildCanonicalCsvUpdatePatch,
  buildCanonicalFieldChanges,
  normalizeCanonicalProductCsvRow,
  parseCanonicalProductCsv,
  validateCanonicalProductCsvRows,
  valuationFromCanonicalCsvNormalised,
} from '../src/lib/canonicalProductCsvImport.js'

function assert(condition, label) {
  if (!condition) throw new Error(label)
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`)
  }
}

function assertIncludes(haystack, needle, label) {
  if (!String(haystack).includes(needle)) {
    throw new Error(`${label}: expected ${JSON.stringify(haystack)} to include ${JSON.stringify(needle)}`)
  }
}

const HEADER = 'brand,series,model,category,equipment_type,baseline_manufacture_year,production_end_year,original_rrp,estimated_trade_in_value,market_observations,confidence,currency,slug,approval_status'

function fullRow(overrides = {}) {
  return {
    brand: 'Concept2',
    series: 'Indoor Rower',
    model: 'Model D',
    category: 'Rowing Machines',
    equipment_type: 'Rowers',
    baseline_manufacture_year: '2018',
    production_end_year: '',
    original_rrp: '1200',
    estimated_trade_in_value: '650',
    market_observations: '1850;1950',
    confidence: 'Medium',
    currency: 'GBP',
    slug: 'concept2-model-d-csv-test',
    approval_status: 'approved',
    ...overrides,
  }
}

function rowToCsv(row) {
  const keys = HEADER.split(',')
  return keys.map((key) => {
    const value = row[key] ?? ''
    const text = String(value)
    if (text.includes(',') || text.includes('"') || text.includes('\n')) {
      return `"${text.replace(/"/g, '""')}"`
    }
    return text
  }).join(',')
}

function parseAndValidate(csvText) {
  const parsed = parseCanonicalProductCsv(csvText)
  assert(!parsed.error, `parse should succeed: ${parsed.error}`)
  return validateCanonicalProductCsvRows(parsed.rows)
}

function planFromCsv(csvText, existingBySlug = new Map()) {
  const validation = parseAndValidate(csvText)
  return buildCanonicalCsvImportPlan(validation.rows, existingBySlug)
}

console.log('canonical product CSV import tests')

assertIncludes(CANONICAL_CSV_GUIDANCE, 'upserted by slug', 'guidance mentions upsert by slug')
assertIncludes(CANONICAL_CSV_GUIDANCE, 'original RRP', 'guidance mentions original RRP')
assertIncludes(CANONICAL_CSV_GUIDANCE, 'baseline manufacture year', 'guidance mentions baseline year')
assertIncludes(CANONICAL_CSV_GUIDANCE, 'Blank values do not overwrite', 'guidance mentions blank preserve')

{
  const parsed = parseCanonicalProductCsv(SAMPLE_CANONICAL_PRODUCT_CSV)
  assert(!parsed.error, `sample parse: ${parsed.error}`)
  const validation = validateCanonicalProductCsvRows(parsed.rows)
  assertEqual(validation.invalidCount, 0, 'sample rows valid')
  assertEqual(validation.validCount, 2, 'sample has 2 rows')
}

{
  const csv = `${HEADER}\n${rowToCsv(fullRow())}`
  const plan = planFromCsv(csv)
  assertEqual(plan.length, 1, 'one planned row')
  assertEqual(plan[0].action, CANONICAL_CSV_ROW_ACTION.CREATE, 'new row creates')
  assertEqual(plan[0].normalised.original_rrp, 1200, 'new row rrp')
  assertEqual(plan[0].normalised.baseline_manufacture_year, 2018, 'new row baseline')

  const insert = buildCanonicalCsvInsertPayload(plan[0].normalised)
  assertEqual(insert.original_base_price, 1200, 'insert writes original_base_price')
  assertEqual(insert.baseline_manufacture_year, 2018, 'insert writes baseline_manufacture_year')
  assertEqual(insert.canonical_product_key, 'concept2-model-d-csv-test', 'insert key from slug')
  assertEqual(insert.image_status, 'missing', 'import without image succeeds (missing status)')
  assert(!insert.primary_image_url, 'no image required on insert')
}

{
  const existing = {
    id: 'prod-1',
    canonical_product_key: 'concept2-model-d-csv-test',
    brand: 'Concept2',
    product_family: 'Indoor Rower',
    model: 'Model D',
    equipment_type: 'Rowers',
    original_base_price: null,
    baseline_manufacture_year: null,
    original_base_price_currency: 'GBP',
    status: 'pending',
  }
  const csv = `${HEADER}\n${rowToCsv(fullRow({ original_rrp: '2499', baseline_manufacture_year: '2017' }))}`
  const plan = planFromCsv(csv, new Map([[existing.canonical_product_key, existing]]))
  assertEqual(plan[0].action, CANONICAL_CSV_ROW_ACTION.UPDATE, 'blank fields update')
  const summaries = plan[0].changeSummaries.join('\n')
  assertIncludes(summaries, 'Original RRP: blank →', 'preview blank → rrp')
  assertIncludes(summaries, 'Baseline manufacture year: blank → 2017', 'preview blank → baseline')

  const patch = buildCanonicalCsvUpdatePatch(existing, plan[0].normalised)
  assertEqual(patch.original_base_price, 2499, 'patch fills blank rrp')
  assertEqual(patch.baseline_manufacture_year, 2017, 'patch fills blank baseline')
}

{
  const existing = {
    id: 'prod-2',
    canonical_product_key: 'concept2-model-d-csv-test',
    brand: 'Concept2',
    product_family: 'Indoor Rower',
    model: 'Model D',
    equipment_type: 'Rowers',
    original_base_price: 1000,
    baseline_manufacture_year: 2010,
    original_base_price_currency: 'GBP',
    status: 'approved',
  }
  const csv = `${HEADER}\n${rowToCsv(fullRow({ original_rrp: '2499', baseline_manufacture_year: '2017' }))}`
  const plan = planFromCsv(csv, new Map([[existing.canonical_product_key, existing]]))
  assertEqual(plan[0].action, CANONICAL_CSV_ROW_ACTION.UPDATE, 'overwrite existing')
  const patch = buildCanonicalCsvUpdatePatch(existing, plan[0].normalised)
  assertEqual(patch.original_base_price, 2499, 'imported rrp overwrites')
  assertEqual(patch.baseline_manufacture_year, 2017, 'imported baseline overwrites')
}

{
  const existing = {
    id: 'prod-3',
    canonical_product_key: 'concept2-model-d-csv-test',
    brand: 'Concept2',
    product_family: 'Indoor Rower',
    model: 'Model D',
    equipment_type: 'Rowers',
    canonical_product_name: 'Concept2 Indoor Rower Model D',
    original_base_price: 1800,
    baseline_manufacture_year: 2016,
    original_base_price_currency: 'GBP',
    production_end_year: 2022,
    status: 'approved',
  }
  const csv = `${HEADER}\n${rowToCsv(fullRow({
    original_rrp: '',
    baseline_manufacture_year: '',
    production_end_year: '',
    confidence: '',
    currency: '',
    approval_status: '',
  }))}`
  const plan = planFromCsv(csv, new Map([[existing.canonical_product_key, existing]]))
  assertEqual(plan[0].action, CANONICAL_CSV_ROW_ACTION.UNCHANGED, 'blank fields leave product unchanged')
  const patch = buildCanonicalCsvUpdatePatch(existing, plan[0].normalised)
  assertEqual(Object.keys(patch).filter((k) => k !== 'updated_at').length, 0, 'patch has no field erasures')
  assert(patch.original_base_price === undefined, 'blank rrp not in patch')
  assert(patch.baseline_manufacture_year === undefined, 'blank baseline not in patch')
}

{
  const csv = `${HEADER}\n${rowToCsv(fullRow({
    original_rrp: '2499',
    baseline_manufacture_year: '2017',
    currency: 'GBP',
  }))}`
  const plan = planFromCsv(csv)
  const { product, valuation, yearOptions } = valuationFromCanonicalCsvNormalised(plan[0].normalised)
  assertEqual(product.original_base_price, 2499, 'valuation product uses imported rrp')
  assertEqual(product.baseline_manufacture_year, 2017, 'valuation product uses imported baseline')
  assert(valuation?.ok === true, 'valuation ok')
  assertEqual(Number(valuation.original_base_price), 2499, 'valuation calc uses imported rrp')
  assertEqual(Number(valuation.baseline_manufacture_year), 2017, 'valuation uses imported baseline')
  assert(Array.isArray(yearOptions) && yearOptions.length > 0, 'year options present')
  const yearValues = yearOptions.map((option) => Number(option.value ?? option.year ?? option))
  assert(yearValues.includes(2017), 'year options include imported baseline')
}

{
  const csv = `${HEADER}\n${rowToCsv(fullRow({ market_observations: 'not-json-and-not-prices' }))}`
  const validation = parseAndValidate(csv)
  assertEqual(validation.invalidCount, 1, 'malformed observations invalid')
  assert(
    validation.rows[0].errors.some((error) => error.includes('market_observations')),
    'malformed observations error names field',
  )
  const plan = buildCanonicalCsvImportPlan(validation.rows, new Map())
  assertEqual(plan[0].action, CANONICAL_CSV_ROW_ACTION.FAIL, 'malformed observations fail')
}

{
  const legacyCsv = [
    'brand,series,model,category,equipment_type,manufacture_year,production_end_year,original_rrp,estimated_trade_in_value,market_observations,confidence,currency,slug,approval_status',
    'Concept2,Indoor Rower,Model D,Rowing Machines,Rowers,2019,,1200,650,1850;1950,Medium,GBP,concept2-model-d-legacy,approved',
  ].join('\n')
  const parsed = parseCanonicalProductCsv(legacyCsv)
  assert(!parsed.error, `legacy parse: ${parsed.error}`)
  assert(
    parsed.warnings.some((warning) => warning.toLowerCase().includes('deprecated')),
    'manufacture_year deprecated warning',
  )
  const validation = validateCanonicalProductCsvRows(parsed.rows)
  assertEqual(validation.rows[0].normalised.baseline_manufacture_year, 2019, 'legacy year maps to baseline')
  assert(
    validation.rows[0].warnings.some((warning) => warning.includes('deprecated')),
    'row-level deprecation warning',
  )
}

{
  const badYear = parseAndValidate(`${HEADER}\n${rowToCsv(fullRow({ baseline_manufacture_year: '17' }))}`)
  assert(badYear.rows[0].errors.some((e) => e.includes('baseline_manufacture_year')), 'bad year rejected')

  const badEnd = parseAndValidate(`${HEADER}\n${rowToCsv(fullRow({
    baseline_manufacture_year: '2018',
    production_end_year: '2010',
  }))}`)
  assert(badEnd.rows[0].errors.some((e) => e.includes('production_end_year')), 'end before baseline rejected')

  const badCurrency = parseAndValidate(`${HEADER}\n${rowToCsv(fullRow({ currency: 'AUD' }))}`)
  assert(badCurrency.rows[0].errors.some((e) => e.includes('currency')), 'bad currency rejected')

  const badConfidence = parseAndValidate(`${HEADER}\n${rowToCsv(fullRow({ confidence: 'Extreme' }))}`)
  assert(badConfidence.rows[0].errors.some((e) => e.includes('confidence')), 'bad confidence rejected')
}

{
  const normalised = normalizeCanonicalProductCsvRow({
    lineNumber: 2,
    raw: fullRow({ equipment_type: 'Treadmill', original_rrp: '2499', baseline_manufacture_year: '2017' }),
  }).normalised
  const changes = buildCanonicalFieldChanges(null, normalised)
  const summaries = changes.map((c) => c.summary)
  assert(summaries.some((s) => s.includes('Baseline manufacture year: blank → 2017')), 'create preview baseline')
  assert(summaries.some((s) => s.includes('Original RRP: blank →')), 'create preview rrp')
  assert(summaries.some((s) => s.includes('Equipment type: blank → Treadmill')), 'create preview type')
}

console.log('All canonical product CSV import tests passed.')
