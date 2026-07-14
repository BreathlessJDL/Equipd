/**
 * Unit tests for equipment product research CSV export/import (round-trip).
 * Run: node scripts/test-equipment-product-research-csv.mjs
 */

import {
  RESEARCH_CLEAR_TOKEN,
  RESEARCH_CSV_HEADERS,
  RESEARCH_EXPORT_SCOPE,
  RESEARCH_MISSING_FIELD,
  RESEARCH_PRIORITY,
  buildResearchCsvContent,
  buildResearchCsvFilename,
  buildResearchImportAuditNote,
  buildResearchImportErrorCsv,
  buildResearchImportPlan,
  buildResearchUpdatePayload,
  deriveResearchMissingFields,
  deriveResearchPriority,
  isResearchExportEligible,
  mapProductToResearchExportRow,
  parseResearchCsv,
  sanitizeCsvCell,
} from '../src/lib/equipmentProductResearchCsv.js'

function assert(condition, label) {
  if (!condition) throw new Error(label)
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`)
  }
}

const pelotonBike = {
  id: 'id-bike',
  brand: 'Peloton',
  product_family: 'Bike',
  model: 'Bike',
  equipment_type: 'Exercise Bike',
  canonical_product_name: "Peloton Bike",
  canonical_product_key: 'peloton-exercise-bike-bike',
  baseline_manufacture_year: 2018,
  production_start_year: 2018,
  production_end_year: null,
  original_base_price: 1895,
  original_base_price_currency: 'GBP',
  original_price_confidence: 90,
  status: 'approved',
  completion_status: 'complete',
  review_notes: '',
  image_status: 'approved',
  image_url: 'https://example.com/bike.jpg',
  content_generation_status: 'approved',
  source_row_count: 2,
}

const pelotonBikePlus = {
  ...pelotonBike,
  id: 'id-bike-plus',
  model: 'Bike+',
  canonical_product_name: 'Peloton Bike+',
  canonical_product_key: 'peloton-exercise-bike-bike-plus',
  original_base_price: null,
  completion_status: 'incomplete',
  image_status: 'missing',
  image_url: null,
  content_generation_status: 'draft',
}

const nordicTrack = {
  id: 'id-nt-1750',
  brand: 'NordicTrack',
  product_family: 'Commercial',
  model: 'Commercial 1750',
  equipment_type: 'Treadmill',
  canonical_product_name: 'NordicTrack Commercial 1750',
  canonical_product_key: 'nordictrack-treadmill-commercial-1750',
  baseline_manufacture_year: 2019,
  production_start_year: 2019,
  production_end_year: null,
  original_base_price: 2499,
  original_base_price_currency: 'GBP',
  original_price_confidence: 70,
  status: 'approved',
  completion_status: 'incomplete',
  review_notes: '',
  image_status: 'approved',
  image_url: 'https://example.com/nt.jpg',
  content_generation_status: 'approved',
  source_row_count: 1,
}

const needsReview = {
  id: 'id-review',
  brand: 'Precor',
  product_family: null,
  model: null,
  equipment_type: null,
  canonical_product_name: 'Precor Unknown',
  canonical_product_key: 'precor-unknown',
  baseline_manufacture_year: null,
  production_start_year: null,
  production_end_year: null,
  original_base_price: null,
  original_base_price_currency: null,
  status: 'needs_review',
  completion_status: 'incomplete',
  review_notes: 'identity uncertain; research required',
  image_status: null,
  content_generation_status: null,
  source_row_count: 0,
}

// --- missing fields / priority ---
{
  const missingPlus = deriveResearchMissingFields(pelotonBikePlus)
  assert(missingPlus.includes(RESEARCH_MISSING_FIELD.ORIGINAL_BASE_PRICE), 'Bike+ missing price')
  assert(missingPlus.includes(RESEARCH_MISSING_FIELD.APPROVED_IMAGE), 'Bike+ missing image')
  assert(!missingPlus.includes(RESEARCH_MISSING_FIELD.MODEL), 'Bike+ has model')

  const { priority } = deriveResearchPriority(pelotonBikePlus, missingPlus)
  assertEqual(priority, RESEARCH_PRIORITY.HIGH, 'missing price => High')

  assert(isResearchExportEligible(pelotonBikePlus), 'incomplete eligible')
  assert(!isResearchExportEligible(pelotonBike), 'complete Bike not eligible by default')
}

{
  const missing = deriveResearchMissingFields(needsReview)
  assert(missing.includes(RESEARCH_MISSING_FIELD.IDENTITY_REVIEW), 'identity review flagged')
  assertEqual(deriveResearchPriority(needsReview, missing).priority, RESEARCH_PRIORITY.HIGH, 'needs_review High')
}

// --- CSV sanitize / Bike+ / BOM / quotes ---
{
  assertEqual(sanitizeCsvCell('Bike+'), 'Bike+', 'Bike+ not formula-escaped')
  assert(sanitizeCsvCell('=SUM(1)').startsWith("'"), 'equals formula escaped')
  assert(sanitizeCsvCell('+cmd').startsWith("'"), 'leading plus free text escaped')
  assertEqual(sanitizeCsvCell('+12.5', { numeric: true }), '+12.5', 'numeric plus preserved')
  assertEqual(sanitizeCsvCell('O\'Brien'), 'O\'Brien', 'apostrophe preserved')
  assert(sanitizeCsvCell('a,b').includes('"'), 'comma quoted')
}

{
  const csv = buildResearchCsvContent([pelotonBike, pelotonBikePlus])
  assert(csv.startsWith('\uFEFF'), 'UTF-8 BOM present')
  assert(csv.includes('Bike+'), 'plus sign survives export')
  assert(csv.includes('peloton-exercise-bike-bike-plus'), 'plus key survives')
  assert(csv.includes('peloton-exercise-bike-bike,'), 'Bike key distinct')
  for (const header of RESEARCH_CSV_HEADERS) {
    assert(csv.includes(header), `header ${header}`)
  }
  const parsed = parseResearchCsv(csv)
  assertEqual(parsed.rows.length, 2, 'two rows round-trip')
  const bike = parsed.rows.find((r) => r.product_id === 'id-bike')
  const bikePlus = parsed.rows.find((r) => r.product_id === 'id-bike-plus')
  assert(bike && bikePlus, 'both products parsed')
  assertEqual(bike.current_canonical_product_name, 'Peloton Bike', 'Bike name')
  assertEqual(bikePlus.current_canonical_product_name, 'Peloton Bike+', 'Bike+ name')
  assertEqual(bikePlus.researched_original_base_price, '', 'research columns empty on export')
  assert(bikePlus.missing_fields.includes('original_base_price'), 'missing_fields populated')
}

// --- filenames ---
{
  const d = new Date('2026-07-14T12:00:00Z')
  assertEqual(
    buildResearchCsvFilename({ scope: RESEARCH_EXPORT_SCOPE.SELECTED, date: d }),
    'equipd-product-research-selected-2026-07-14.csv',
    'selected filename',
  )
  assertEqual(
    buildResearchCsvFilename({ scope: RESEARCH_EXPORT_SCOPE.ALL_MATCHING, brand: 'Peloton', date: d }),
    'equipd-product-research-peloton-2026-07-14.csv',
    'brand filename',
  )
  assertEqual(
    buildResearchCsvFilename({ scope: RESEARCH_EXPORT_SCOPE.ALL_MATCHING, date: d }),
    'equipd-product-research-export-2026-07-14.csv',
    'default filename',
  )
}

// --- map deterministic ordering of missing_fields vocabulary ---
{
  const row = mapProductToResearchExportRow(needsReview)
  assert(row.missing_fields.split('|').includes('identity_review'), 'identity in missing_fields')
  assertEqual(row.research_priority, RESEARCH_PRIORITY.HIGH, 'export priority')
}

// --- import: blank = no change; __CLEAR__; ID+key; duplicate; mismatch ---
{
  const productsById = new Map([
    [nordicTrack.id, nordicTrack],
    [pelotonBike.id, pelotonBike],
    [pelotonBikePlus.id, { ...pelotonBikePlus, status: 'approved' }],
    [needsReview.id, needsReview],
  ])

  const headerLine = RESEARCH_CSV_HEADERS.join(',')
  function rowFrom(partial) {
    const base = Object.fromEntries(RESEARCH_CSV_HEADERS.map((h) => [h, '']))
    Object.assign(base, partial)
    return RESEARCH_CSV_HEADERS.map((h) => sanitizeCsvCell(base[h])).join(',')
  }

  const goodCsv = [
    headerLine,
    rowFrom({
      product_id: nordicTrack.id,
      canonical_product_key: nordicTrack.canonical_product_key,
      brand: nordicTrack.brand,
      researched_baseline_manufacture_year: '2021',
      researched_currency: '',
      research_notes: 'Corrected from brochure',
      year_source_url: 'https://example.com/nt-1750',
    }),
    rowFrom({
      product_id: pelotonBikePlus.id,
      canonical_product_key: pelotonBikePlus.canonical_product_key,
      brand: 'Peloton',
      researched_original_base_price: '2495',
      researched_currency: 'GBP',
      researched_price_confidence: 'High',
      price_source_url: 'https://example.com/bike-plus',
    }),
    rowFrom({
      product_id: pelotonBike.id,
      canonical_product_key: pelotonBike.canonical_product_key,
      brand: 'Peloton',
      // blanks only → unchanged
    }),
  ].join('\n')

  const parsed = parseResearchCsv(goodCsv)
  const plan = buildResearchImportPlan(parsed.rows, productsById)
  assertEqual(plan.summary.errors, 0, 'no validation errors on good csv')
  assertEqual(plan.summary.validUpdates, 2, 'two updates')
  assertEqual(plan.summary.unchanged, 1, 'one unchanged')

  const ntPlan = plan.plans.find((p) => p.product_id === nordicTrack.id)
  assert(ntPlan.fieldChanges.some((c) => c.field === 'baseline_manufacture_year' && c.next === 2021), 'NT year')
  assert(!ntPlan.fieldChanges.some((c) => c.field === 'original_base_price'), 'blank price no change')
  assertEqual(ntPlan.status, 'approved', 'status preserved on plan')

  const plusPlan = plan.plans.find((p) => p.product_id === pelotonBikePlus.id)
  assert(plusPlan.criticalChangeOnApproved, 'critical change flagged on approved')
  const payload = buildResearchUpdatePayload(plusPlan, pelotonBikePlus)
  assert(!Object.prototype.hasOwnProperty.call(payload.patch, 'status'), 'no status in patch')
  assert(payload.reviewNotes.includes('research_import'), 'audit note')
  assert(payload.reviewNotes.includes('critical valuation'), 'approved critical flag')

  // Idempotent: same values again → unchanged
  const againCsv = [
    headerLine,
    rowFrom({
      product_id: nordicTrack.id,
      canonical_product_key: nordicTrack.canonical_product_key,
      brand: nordicTrack.brand,
      researched_baseline_manufacture_year: '2019', // same as current
    }),
  ].join('\n')
  const againPlan = buildResearchImportPlan(parseResearchCsv(againCsv).rows, productsById)
  assertEqual(againPlan.plans[0].action, 'unchanged', 'idempotent when same value')

  // __CLEAR__
  const clearCsv = [
    headerLine,
    rowFrom({
      product_id: nordicTrack.id,
      canonical_product_key: nordicTrack.canonical_product_key,
      brand: nordicTrack.brand,
      researched_production_end_year: RESEARCH_CLEAR_TOKEN,
    }),
  ].join('\n')
  // production_end already null → unchanged
  const clearNull = buildResearchImportPlan(parseResearchCsv(clearCsv).rows, productsById)
  assertEqual(clearNull.plans[0].action, 'unchanged', 'clear already-null is no-op')

  const withEnd = {
    ...nordicTrack,
    production_end_year: 2024,
  }
  const clearMap = new Map([[nordicTrack.id, withEnd]])
  const clearReal = buildResearchImportPlan(parseResearchCsv(clearCsv).rows, clearMap)
  assert(
    clearReal.plans[0].fieldChanges.some((c) => c.action === 'clear' && c.field === 'production_end_year'),
    'explicit clear',
  )
  const clearPayload = buildResearchUpdatePayload(clearReal.plans[0], withEnd)
  assert(clearPayload.clearFields.includes('production_end_year'), 'clearFields includes end year')

  // invalid year
  const badYear = buildResearchImportPlan(parseResearchCsv([
    headerLine,
    rowFrom({
      product_id: nordicTrack.id,
      canonical_product_key: nordicTrack.canonical_product_key,
      brand: nordicTrack.brand,
      researched_baseline_manufacture_year: '1969',
    }),
  ].join('\n')).rows, productsById)
  assert(badYear.errors.some((e) => /between 1970/i.test(e.message)), 'invalid year rejected')

  // end before start
  const badRange = buildResearchImportPlan(parseResearchCsv([
    headerLine,
    rowFrom({
      product_id: nordicTrack.id,
      canonical_product_key: nordicTrack.canonical_product_key,
      brand: nordicTrack.brand,
      researched_production_start_year: '2020',
      researched_production_end_year: '2018',
    }),
  ].join('\n')).rows, productsById)
  assert(badRange.errors.some((e) => /cannot precede/i.test(e.message)), 'end before start')

  // price without currency
  const badPrice = buildResearchImportPlan(parseResearchCsv([
    headerLine,
    rowFrom({
      product_id: needsReview.id,
      canonical_product_key: needsReview.canonical_product_key,
      brand: needsReview.brand,
      researched_original_base_price: '1000',
    }),
  ].join('\n')).rows, productsById)
  assert(badPrice.errors.some((e) => /currency required/i.test(e.message)), 'currency required')

  // ID/key mismatch
  const mismatch = buildResearchImportPlan(parseResearchCsv([
    headerLine,
    rowFrom({
      product_id: pelotonBike.id,
      canonical_product_key: pelotonBikePlus.canonical_product_key,
      brand: 'Peloton',
      researched_original_base_price: '100',
      researched_currency: 'GBP',
    }),
  ].join('\n')).rows, productsById)
  assert(mismatch.errors.some((e) => /ID\/key mismatch/i.test(e.message)), 'id/key mismatch')
  assertEqual(mismatch.plans.length, 0, 'mismatch not guessed')

  // duplicate product id
  const dup = buildResearchImportPlan(parseResearchCsv([
    headerLine,
    rowFrom({
      product_id: nordicTrack.id,
      canonical_product_key: nordicTrack.canonical_product_key,
      brand: nordicTrack.brand,
      researched_baseline_manufacture_year: '2020',
    }),
    rowFrom({
      product_id: nordicTrack.id,
      canonical_product_key: nordicTrack.canonical_product_key,
      brand: nordicTrack.brand,
      researched_baseline_manufacture_year: '2021',
    }),
  ].join('\n')).rows, productsById)
  assert(dup.errors.some((e) => /duplicate product_id/i.test(e.message)), 'duplicate id')

  // researched_category unsupported
  const cat = buildResearchImportPlan(parseResearchCsv([
    headerLine,
    rowFrom({
      product_id: nordicTrack.id,
      canonical_product_key: nordicTrack.canonical_product_key,
      brand: nordicTrack.brand,
      researched_category: 'Cardio',
    }),
  ].join('\n')).rows, productsById)
  assert(cat.errors.some((e) => /researched_category/i.test(e.message)), 'category blocked')

  // canonical keys never in patch
  const patchKeys = Object.keys(payload.patch)
  assert(!patchKeys.includes('canonical_product_key'), 'no key rebuild')
  assert(!patchKeys.includes('canonical_product_name'), 'no auto name')

  // error CSV retains research input
  const errCsv = buildResearchImportErrorCsv(mismatch.errors)
  assert(errCsv.includes('researched_original_base_price') || errCsv.includes('100'), 'error csv keeps input')
  assert(errCsv.startsWith('\uFEFF'), 'error csv BOM')

  // audit note helper
  const note = buildResearchImportAuditNote({
    filename: 'test.csv',
    batchId: 'research-abc',
    fieldChanges: [{ field: 'baseline_manufacture_year', current: 2019, next: 2021 }],
    yearSourceUrl: 'https://example.com/y',
  })
  assert(note.includes('batch=research-abc'), 'batch in audit')
  assert(note.includes('2019 → 2021'), 'values in audit')
}

// regression: Precor not in CSV → not in plans
{
  const productsById = new Map([[needsReview.id, needsReview], [nordicTrack.id, nordicTrack]])
  const headerLine = RESEARCH_CSV_HEADERS.join(',')
  function rowFrom(partial) {
    const base = Object.fromEntries(RESEARCH_CSV_HEADERS.map((h) => [h, '']))
    Object.assign(base, partial)
    return RESEARCH_CSV_HEADERS.map((h) => sanitizeCsvCell(base[h])).join(',')
  }
  const plan = buildResearchImportPlan(parseResearchCsv([
    headerLine,
    rowFrom({
      product_id: nordicTrack.id,
      canonical_product_key: nordicTrack.canonical_product_key,
      brand: nordicTrack.brand,
      researched_baseline_manufacture_year: '2022',
    }),
  ].join('\n')).rows, productsById)
  assert(!plan.plans.some((p) => p.product_id === needsReview.id), 'Precor unchanged when not in CSV')
}

console.log('test-equipment-product-research-csv: all assertions passed')
