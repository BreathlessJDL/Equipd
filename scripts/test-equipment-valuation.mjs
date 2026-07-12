/**
 * Unit tests for equipment valuation v1.
 */

import { readFileSync } from 'fs'
import { buildConsoleOptionsForProduct } from '../src/lib/commercialCardioConsoleCompat.js'
import { calculateOriginalPriceWithConsole } from '../src/lib/consoleModifierValuation.js'
import {
  buildManufactureYearDropdownOptions,
  calculateEquipmentAge,
  calculateEquipmentProductValuation,
  calculateEquipmentValuation,
  formatValuationConfidence,
  getResidualPercentage,
  MANUFACTURE_YEAR_UNKNOWN_VALUE,
  parseSelectedManufactureYear,
  resolveDepreciationYear,
  searchEquipmentProducts,
} from '../src/lib/equipmentValuation.js'

function assert(condition, label) {
  if (!condition) throw new Error(label)
}

const modifiers = [
  { brand: 'Technogym', console_name: 'Unity', modifier_value: 15, console_tier: 'mid' },
  { brand: 'Technogym', console_name: 'LED', modifier_value: 0, console_tier: 'base' },
  { brand: 'Life Fitness', console_name: 'SE3HD', modifier_value: 22, console_tier: 'premium' },
]

const consoleUnity = calculateOriginalPriceWithConsole({
  originalBasePrice: 10000,
  brand: 'Technogym',
  consoleName: 'Unity',
  modifiers,
})
assert(consoleUnity.adjustedPrice === 11500, 'Unity console should add 15%')

function valuationAdjustedPrice(product, consoleName, basePrice = 10000) {
  const { options } = buildConsoleOptionsForProduct(product)
  const result = calculateEquipmentValuation({
    equipment_product_id: 'test',
    original_base_price: basePrice,
    baseline_manufacture_year: product.baseline_manufacture_year ?? 2020,
    brand: product.brand,
    console_name: consoleName,
    product_console_options: options,
    current_year: 2026,
    condition: 'Good',
  })
  return result.adjusted_original_price
}

const integrityTreadmill = {
  brand: 'Life Fitness',
  product_family: 'Integrity Series',
  model: 'Integrity Series Treadmill',
  equipment_type: 'Treadmill',
  baseline_manufacture_year: 2020,
}
const elevationTreadmill = {
  brand: 'Life Fitness',
  product_family: 'Elevation Series',
  model: 'Elevation Series PowerMill',
  equipment_type: 'Stepper',
  baseline_manufacture_year: 2018,
}
const matrixTreadmill = {
  brand: 'Matrix Fitness',
  product_family: 'Performance',
  model: 'Treadmill',
  equipment_type: 'Treadmill',
  baseline_manufacture_year: 2019,
}
const technogymArtis = {
  brand: 'Technogym',
  product_family: 'Artis',
  model: 'Artis Treadmill',
  equipment_type: 'Treadmill',
  baseline_manufacture_year: 2020,
}
const technogymExcite = {
  brand: 'Technogym',
  product_family: 'Excite',
  model: 'Excite Bike 1000',
  equipment_type: 'Exercise Bike',
  baseline_manufacture_year: 2018,
}
const technogymOlderExcite = {
  brand: 'Technogym',
  product_family: 'Excite',
  model: 'Excite Run 700',
  equipment_type: 'Treadmill',
  baseline_manufacture_year: 2010,
}

assert(
  valuationAdjustedPrice(integrityTreadmill, 'Discover SE4')
    > valuationAdjustedPrice(integrityTreadmill, 'Discover SE3HD'),
  'valuation: Life Fitness SE4 > SE3HD',
)
assert(
  valuationAdjustedPrice(elevationTreadmill, 'Discover SE3HD')
    > valuationAdjustedPrice(elevationTreadmill, 'Discover SE3'),
  'valuation: SE3HD > SE3',
)
assert(
  valuationAdjustedPrice(integrityTreadmill, 'Integrity X')
    > valuationAdjustedPrice(integrityTreadmill, 'Integrity C')
    && valuationAdjustedPrice(integrityTreadmill, 'Integrity X')
    > valuationAdjustedPrice(integrityTreadmill, 'Integrity SL')
    && valuationAdjustedPrice(integrityTreadmill, 'Integrity C')
    === valuationAdjustedPrice(integrityTreadmill, 'Integrity SL'),
  'valuation: Integrity X > C/SL base parity',
)
assert(
  valuationAdjustedPrice(matrixTreadmill, 'Touch XL')
    > valuationAdjustedPrice(matrixTreadmill, 'Touch')
    && valuationAdjustedPrice(matrixTreadmill, 'Touch')
    > valuationAdjustedPrice(matrixTreadmill, 'LED'),
  'valuation: Matrix Touch XL > Touch > LED',
)
assert(
  valuationAdjustedPrice(technogymArtis, 'LIVE 10')
    > valuationAdjustedPrice(technogymArtis, 'LIVE')
    && valuationAdjustedPrice(technogymArtis, 'LIVE')
    > valuationAdjustedPrice(technogymArtis, 'UNITY 3.0')
    && valuationAdjustedPrice(technogymArtis, 'UNITY 3.0')
    > valuationAdjustedPrice(technogymExcite, 'UNITY')
    && valuationAdjustedPrice(technogymExcite, 'UNITY')
    > valuationAdjustedPrice(technogymOlderExcite, 'Visio / Visioweb')
    && valuationAdjustedPrice(technogymOlderExcite, 'Visio / Visioweb')
    > valuationAdjustedPrice(technogymExcite, 'LED'),
  'valuation: Technogym LIVE 10 > LIVE > UNITY 3.0 > UNITY > Visio / Visioweb > LED',
)

assert(getResidualPercentage(1) === 0.55, 'year 1 residual 55%')
assert(getResidualPercentage(5) === 0.15, 'year 5 residual 15%')
assert(getResidualPercentage(9) === 0.11, 'year 9 residual 11%')
assert(getResidualPercentage(10) === 0.1, 'year 10 residual 10%')
assert(getResidualPercentage(11) === 0.09, 'year 11 residual 9%')
assert(getResidualPercentage(16) === 0.04, 'year 16 residual 4%')
assert(getResidualPercentage(17) === 0.03, 'year 17 residual 3%')
assert(getResidualPercentage(18) === 0.025, 'year 18 residual floor 2.5%')
assert(getResidualPercentage(25) === 0.025, 'year 25 residual floor 2.5%')

const baselineOnlyYear = resolveDepreciationYear({
  baseline_manufacture_year: 2010,
  current_year: 2026,
})
assert(baselineOnlyYear.depreciation_year_used === 2010, 'baseline only uses baseline year')
assert(baselineOnlyYear.used_supplied_manufacture_year === false, 'baseline only flag')

const actualYear = resolveDepreciationYear({
  baseline_manufacture_year: 2010,
  actual_manufacture_year: 2013,
  current_year: 2026,
})
assert(actualYear.depreciation_year_used === 2013, 'actual year used when newer than baseline')
assert(actualYear.used_supplied_manufacture_year === true, 'actual year flag')

const clampedYear = resolveDepreciationYear({
  baseline_manufacture_year: 2010,
  actual_manufacture_year: 2008,
  current_year: 2026,
})
assert(clampedYear.depreciation_year_used === 2010, 'actual earlier than baseline is clamped')
assert(clampedYear.actual_year_clamped === true, 'clamp flag set')

const adminOverride = resolveDepreciationYear({
  baseline_manufacture_year: 2010,
  actual_manufacture_year: 2008,
  current_year: 2026,
  allow_earlier_actual_year: true,
})
assert(adminOverride.depreciation_year_used === 2008, 'admin override allows earlier actual year')

const baselineValuation = calculateEquipmentValuation({
  original_base_price: 10000,
  baseline_manufacture_year: 2010,
  current_year: 2026,
  condition: 'Good',
})
assert(baselineValuation.ok === true, 'baseline valuation succeeds')
assert(baselineValuation.age_years === 16, 'baseline 2010 → age 16 in 2026')
assert(baselineValuation.depreciation_year_used === 2010, 'depreciation year is baseline')
assert(
  baselineValuation.explanation.includes('Using baseline year because actual manufacture year was not provided.'),
  'baseline explanation text',
)

const actualValuation = calculateEquipmentValuation({
  original_base_price: 10000,
  baseline_manufacture_year: 2010,
  actual_manufacture_year: 2013,
  current_year: 2026,
  condition: 'Good',
})
assert(actualValuation.age_years === 13, 'actual 2013 → age 13 in 2026')
assert(actualValuation.depreciation_year_used === 2013, 'depreciation year is actual')
assert(
  actualValuation.explanation.includes('Using supplied manufacture year for depreciation.'),
  'actual year explanation text',
)
assert(
  actualValuation.estimated_mid >= baselineValuation.estimated_mid,
  'newer actual year should not reduce value vs baseline-only at same residual band',
)

const youngerResidualCase = calculateEquipmentValuation({
  original_base_price: 10000,
  baseline_manufacture_year: 2010,
  actual_manufacture_year: 2020,
  current_year: 2026,
  condition: 'Good',
})
const olderResidualCase = calculateEquipmentValuation({
  original_base_price: 10000,
  baseline_manufacture_year: 2010,
  current_year: 2026,
  condition: 'Good',
})
assert(youngerResidualCase.age_years === 6, 'actual 2020 → age 6')
assert(olderResidualCase.age_years === 16, 'baseline only → age 16')
assert(youngerResidualCase.estimated_mid > olderResidualCase.estimated_mid, 'newer actual year yields higher value')

assert(youngerResidualCase.estimated_mid === 1400, 'age 6 residual 14% on 10000')
assert(olderResidualCase.estimated_mid === 400, 'age 16 residual 4% on 10000')

const clampedValuation = calculateEquipmentValuation({
  original_base_price: 10000,
  baseline_manufacture_year: 2010,
  actual_manufacture_year: 2005,
  current_year: 2026,
  condition: 'Good',
})
assert(clampedValuation.depreciation_year_used === 2010, 'clamped valuation uses baseline year')
assert(clampedValuation.actual_year_clamped === true, 'clamped flag on valuation')

const insufficient = calculateEquipmentValuation({
  original_base_price: null,
  baseline_manufacture_year: 2010,
})
assert(insufficient.ok === false, 'missing price should fail')

const productValuation = calculateEquipmentProductValuation({
  id: 'prod-3',
  brand: 'Technogym',
  original_base_price: 10000,
  baseline_manufacture_year: 2010,
  original_base_price_currency: 'GBP',
}, {
  actual_manufacture_year: 2013,
  current_year: 2026,
  condition: 'Excellent',
})
assert(productValuation.ok === true, 'product wrapper should succeed')
assert(productValuation.residual_percentage === 7, 'age 13 uses 7% residual')
assert(productValuation.condition_multiplier === 1.1, 'excellent multiplier')
assert(productValuation.estimated_mid === 770, '10000 × 7% × 1.10')

assert(calculateEquipmentAge(2013, 2026) === 13, 'age helper')

const search = searchEquipmentProducts([
  {
    brand: 'Technogym',
    model: 'RUN EXCITE 700',
    canonical_product_name: 'Technogym Excite Run 700',
    canonical_product_key: 'technogym-treadmill-excite-run-700',
    equipment_type: 'Treadmill',
  },
], 'Technogym Excite Run')
assert(search.matches.length === 1, 'product search finds canonical name')

assert(formatValuationConfidence(82) === 'High', 'confidence label high')

const manufactureYearOptions = buildManufactureYearDropdownOptions({
  baseline_manufacture_year: 2004,
  current_year: 2026,
})
assert(
  manufactureYearOptions[0].value === '2004',
  'manufacture year dropdown starts at baseline year (no unknown option)',
)
assert(
  manufactureYearOptions.every((option) => option.value !== MANUFACTURE_YEAR_UNKNOWN_VALUE),
  'manufacture year dropdown does not include I\'m not sure',
)
assert(
  manufactureYearOptions[0].label === '2004',
  'manufacture year dropdown first label is the baseline year',
)
assert(
  manufactureYearOptions[manufactureYearOptions.length - 1].value === '2026',
  'manufacture year dropdown ends at current year',
)
assert(
  manufactureYearOptions.length === 23,
  'manufacture year dropdown includes each year in range without blank option',
)

assert(parseSelectedManufactureYear('') === null, 'blank manufacture year parses to null')
assert(parseSelectedManufactureYear('2018') === 2018, 'selected manufacture year parses to number')

const blankYearValuation = calculateEquipmentProductValuation({
  id: 'prod-year-blank',
  brand: 'Precor',
  original_base_price: 10000,
  baseline_manufacture_year: 2004,
  original_base_price_currency: 'GBP',
}, {
  actual_manufacture_year: parseSelectedManufactureYear(MANUFACTURE_YEAR_UNKNOWN_VALUE),
  current_year: 2026,
  condition: 'Good',
})
assert(blankYearValuation.depreciation_year_used === 2004, 'blank manufacture year uses baseline year')
assert(
  blankYearValuation.explanation.includes('Using baseline year because actual manufacture year was not provided.'),
  'blank manufacture year explanation',
)

const selectedYearValuation = calculateEquipmentProductValuation({
  id: 'prod-year-selected',
  brand: 'Precor',
  original_base_price: 10000,
  baseline_manufacture_year: 2004,
  original_base_price_currency: 'GBP',
}, {
  actual_manufacture_year: parseSelectedManufactureYear('2018'),
  current_year: 2026,
  condition: 'Good',
})
assert(selectedYearValuation.depreciation_year_used === 2018, 'selected manufacture year is used for depreciation')
assert(selectedYearValuation.actual_manufacture_year === 2018, 'selected manufacture year is passed as actual_manufacture_year')

const valuationPageCss = readFileSync(new URL('../src/pages/ValuationPage.css', import.meta.url), 'utf8')
assert(
  valuationPageCss.includes('.valuation-page__details-actions'),
  'valuation details submit actions class exists',
)
assert(
  /\.valuation-page__details-actions\s*\{[^}]*margin-top:\s*var\(--space-md\)/s.test(valuationPageCss),
  'calculate valuation button has increased top spacing',
)
assert(
  /\.valuation-page__details-layout[\s\S]*grid-template-columns/s.test(valuationPageCss),
  'valuation details step uses two-column desktop layout',
)

console.log('equipment valuation tests passed')
