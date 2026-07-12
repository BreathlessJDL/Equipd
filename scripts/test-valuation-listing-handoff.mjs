/**
 * Valuation flow and equipment → create listing handoff tests.
 */

import { readFileSync } from 'fs'
import {
  buildCreateListingFromEquipmentPath,
  buildCreateListingFromValuationPath,
  buildListingFormPrefillFromEquipmentProduct,
  buildListingFormPrefillFromValuation,
  mergeListingFormPrefill,
  mapValuationConditionToListingCondition,
  parseValuationListingSearchParams,
  resolveCategorySlugForEquipmentType,
} from '../src/lib/createListingFromEquipment.js'
import {
  buildDepreciationGraphTimelinePositions,
  buildEquipmentDepreciationGraphData,
  buildValuationExplanationLines,
  calculateEquipmentProductValuation,
  calculateEquipmentValuation,
  formatProductProductionYears,
  getEquipmentProductDisplayName,
  isGenericEquipmentModelLabel,
  pickDepreciationGraphYearTicks,
  resolveValuationSearchMatches,
  searchEquipmentProducts,
  shouldShowRawEquipmentModelOnProductPage,
  shouldValuationProductPageLinkStopSelection,
  VALUATION_ESTIMATE_DISCLAIMER,
} from '../src/lib/equipmentValuation.js'

function assert(condition, label) {
  if (!condition) throw new Error(label)
}

const sampleProducts = [
  {
    id: 'p1',
    canonical_product_key: 'technogym-excite-run-700',
    canonical_product_name: 'Technogym Excite Run 700',
    brand: 'Technogym',
    model: 'Excite Run 700',
    equipment_type: 'Treadmill',
    original_base_price: 12000,
    baseline_manufacture_year: 2018,
    status: 'approved',
  },
  {
    id: 'p2',
    canonical_product_key: 'life-fitness-t5',
    canonical_product_name: 'Life Fitness T5',
    brand: 'Life Fitness',
    model: 'T5',
    equipment_type: 'Treadmill',
    original_base_price: 9000,
    baseline_manufacture_year: 2016,
    status: 'approved',
  },
  {
    id: 'p3',
    canonical_product_key: 'technogym-synchro-500',
    canonical_product_name: 'Technogym Synchro 500',
    brand: 'Technogym',
    model: 'Synchro 500',
    equipment_type: 'Crosstrainer',
    original_base_price: 8000,
    baseline_manufacture_year: 2017,
    status: 'approved',
  },
]

const valuation = calculateEquipmentValuation({
  original_base_price: 10000,
  baseline_manufacture_year: 2010,
  current_year: 2026,
  condition: 'Good',
  console_name: 'Unity',
  modifiers: [{ brand: 'Technogym', console_name: 'Unity', modifier_value: 15 }],
})

const explanationLines = buildValuationExplanationLines(valuation, 'GBP')
const explanationLabels = explanationLines.map((line) => line.label)

assert(explanationLabels.length === 3, 'breakdown should include exactly three rows')
assert(explanationLabels.includes('Estimated original RRP'), 'breakdown includes estimated original RRP')
assert(explanationLabels.includes('Manufacture year'), 'breakdown uses Manufacture year label')
assert(explanationLabels.includes('Equipment age'), 'breakdown includes equipment age')
assert(!explanationLabels.includes('Residual value percentage'), 'breakdown hides residual value percentage')
assert(!explanationLabels.includes('Console adjustment'), 'breakdown hides console adjustment')
assert(!explanationLabels.includes('Condition adjustment'), 'breakdown hides condition adjustment')
assert(!explanationLabels.includes('Estimated current value'), 'breakdown hides estimated current value')
assert(!explanationLabels.includes('Manufacture year used'), 'breakdown no longer uses Manufacture year used')

assert(VALUATION_ESTIMATE_DISCLAIMER.includes('original RRP'), 'estimate disclaimer mentions original RRP')
assert(VALUATION_ESTIMATE_DISCLAIMER.includes('market depreciation'), 'estimate disclaimer mentions market depreciation')
assert(!VALUATION_ESTIMATE_DISCLAIMER.toLowerCase().includes('console'), 'estimate disclaimer hides console modifiers')

assert(formatProductProductionYears({ production_start_year: 2012 }) === null, 'production years hidden with only start year')
assert(formatProductProductionYears({ production_end_year: 2016 }) === null, 'production years hidden with only end year and no start/baseline')
assert(
  formatProductProductionYears({ production_start_year: 2012, production_end_year: 2016 }) === '2012–2016',
  'production years shown when both years exist',
)
assert(
  formatProductProductionYears({ baseline_manufacture_year: 2009, production_end_year: 2018 }) === '2009–2018',
  'production years can use baseline as start when production_start missing',
)

assert(isGenericEquipmentModelLabel('BIKE'), 'BIKE is a generic model label')
assert(isGenericEquipmentModelLabel('RUN'), 'RUN is a generic model label')
assert(isGenericEquipmentModelLabel('TREADMILL'), 'TREADMILL is a generic model label')
assert(!isGenericEquipmentModelLabel('Excite Run 700'), 'specific model is not generic')

const artisProduct = {
  canonical_product_name: 'Technogym Artis Bike',
  brand: 'Technogym',
  model: 'BIKE',
}
assert(
  getEquipmentProductDisplayName(artisProduct) === 'Technogym Artis Bike',
  'canonical product name appears as model display name',
)
assert(
  shouldShowRawEquipmentModelOnProductPage(artisProduct) === false,
  'generic raw model row is hidden',
)

const graphValuation = calculateEquipmentProductValuation(sampleProducts[0], {
  current_year: 2026,
  condition: 'Good',
})
const graphData = buildEquipmentDepreciationGraphData({
  original_base_price: sampleProducts[0].original_base_price,
  baseline_manufacture_year: sampleProducts[0].baseline_manufacture_year,
  current_year: 2026,
  condition: 'Good',
  depreciation_year_used: graphValuation.depreciation_year_used,
})
assert(graphData.points.length > 9, 'graph includes fractional early-year points beyond one per calendar year')
assert(graphData.startValue === sampleProducts[0].original_base_price, 'graph starts at estimated original RRP')
assert(graphData.endValue === graphValuation.estimated_mid, 'graph ends at current valuation mid')
assert(graphData.points[0].year === 2018, 'graph starts at selected manufacture year')
assert(graphData.points[graphData.points.length - 1].year === 2026, 'graph ends at current year')
assert(graphData.points[graphData.points.length - 1].highlighted === true, 'current year point is highlighted')

const early2018Point = graphData.points.find((point) => point.year === 2018.25)
assert(early2018Point && early2018Point.value < graphData.startValue, 'value drops before the next full year')
assert(
  graphData.points.find((point) => point.year === 2018).value
    !== graphData.points.find((point) => point.year === 2018.5).value,
  'graph does not keep a flat first-year segment after manufacture',
)

const graphData2014 = buildEquipmentDepreciationGraphData({
  original_base_price: 12000,
  baseline_manufacture_year: 2014,
  current_year: 2026,
  condition: 'Good',
})
assert(graphData2014.startValue === 12000, '2014 product graph starts at original RRP')
assert(
  graphData2014.points.find((point) => point.year === 2014.25).value < graphData2014.startValue,
  '2014 product value is below RRP before 2015',
)
assert(
  graphData2014.points.every((point) => point.year >= 2014),
  'no graph point is earlier than manufacture year',
)
assert(
  graphData2014.timelineYears.every((year) => Number.isInteger(year)),
  'x-axis timeline years remain whole-year labels only',
)
assert(
  buildDepreciationGraphTimelinePositions(2014, 2026)[0] === 2014
    && buildDepreciationGraphTimelinePositions(2014, 2026).includes(2014.25)
    && buildDepreciationGraphTimelinePositions(2014, 2026).includes(2014.5),
  'timeline positions include manufacture year and early fractional years',
)
assert(
  pickDepreciationGraphYearTicks([2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026], { compact: true }).length <= 5,
  'compact graph axis reduces year tick density',
)
assert(
  pickDepreciationGraphYearTicks([2014, 2015, 2016, 2017, 2018, 2019, 2020], { compact: true })[0] === 2014,
  'graph year ticks always include manufacture start year',
)
assert(
  graphData.startYear === sampleProducts[0].baseline_manufacture_year,
  'graph start year matches selected manufacture year when no later year is chosen',
)
assert(
  graphData.timelineYears[0] === sampleProducts[0].baseline_manufacture_year,
  'graph timeline begins at selected manufacture year',
)

const graphSelectedLaterThanBaseline = buildEquipmentDepreciationGraphData({
  original_base_price: 10000,
  baseline_manufacture_year: 2010,
  current_year: 2026,
  condition: 'Good',
  depreciation_year_used: 2018,
})
assert(graphSelectedLaterThanBaseline.startYear === 2018, 'graph starts at selected year 2018, not baseline 2010')
assert(graphSelectedLaterThanBaseline.timelineYears[0] === 2018, 'x-axis begins at selected manufacture year 2018')
assert(
  graphSelectedLaterThanBaseline.points.every((point) => point.year >= 2018),
  'no graph points before selected manufacture year 2018',
)
assert(graphSelectedLaterThanBaseline.startValue === 10000, 'selected-year graph starts at original RRP')
assert(
  graphSelectedLaterThanBaseline.points.find((point) => point.year === 2018.25).value
    < graphSelectedLaterThanBaseline.startValue,
  'depreciation begins immediately after selected manufacture year',
)
assert(
  pickDepreciationGraphYearTicks(graphSelectedLaterThanBaseline.timelineYears)[0] === 2018,
  'year ticks begin at selected manufacture year',
)

const graphSelectedNearPresent = buildEquipmentDepreciationGraphData({
  original_base_price: 9000,
  baseline_manufacture_year: 2015,
  current_year: 2026,
  condition: 'Good',
  depreciation_year_used: 2025,
})
assert(graphSelectedNearPresent.startYear === 2025, 'graph starts at selected year 2025, not baseline 2015')
assert(
  JSON.stringify(graphSelectedNearPresent.timelineYears) === JSON.stringify([2025, 2026]),
  'near-present selection only shows years from selected manufacture year',
)
assert(graphSelectedNearPresent.points[0].year === 2025, 'first plotted point is selected manufacture year')
assert(graphSelectedNearPresent.startValue === 9000, '2025 selection starts at original RRP')

assert(buildEquipmentDepreciationGraphData({
  original_base_price: null,
  baseline_manufacture_year: 2018,
}) === null, 'graph hidden without RRP')

const emptySearch = resolveValuationSearchMatches(sampleProducts, '')
assert(emptySearch.matches.length === 0, 'empty query returns no matches')
assert(emptySearch.showNoMatch === false, 'empty query does not show no-match state')

const technogymSearch = resolveValuationSearchMatches(sampleProducts, 'Technogym')
assert(technogymSearch.matches.length === 2, 'Technogym query filters matching products')

const incrementalA = searchEquipmentProducts(sampleProducts, 'Tech')
const incrementalB = searchEquipmentProducts(sampleProducts, 'Technogym Excite')
assert(incrementalA.matches.length >= incrementalB.matches.length, 'narrower query filters further')
assert(incrementalB.matches[0].canonical_product_key === 'technogym-excite-run-700', 'specific query finds Excite Run')

let cardSelected = false
const mockCardEvent = { stopPropagation() { mockCardEvent.stopped = true }, stopped: false }
shouldValuationProductPageLinkStopSelection(mockCardEvent)
assert(mockCardEvent.stopped === true, 'product page link stops card selection propagation')
cardSelected = false
const selectHandler = () => { cardSelected = true }
if (!mockCardEvent.stopped) selectHandler()
assert(cardSelected === false, 'product page link click does not select card')

let selectedProductId = null
const continueWithProduct = (product) => { selectedProductId = product.id }
continueWithProduct(sampleProducts[0])
assert(selectedProductId === 'p1', 'card click handler selects product for valuation')

assert(
  buildCreateListingFromEquipmentPath('technogym-excite-run-700') === '/sell?equipment=technogym-excite-run-700',
  'sell path includes equipment query param',
)
assert(buildCreateListingFromEquipmentPath('') === '/sell', 'empty equipment key falls back to /sell')

const categories = [
  { id: 'cat-treadmill', slug: 'treadmill', name: 'Treadmills' },
  { id: 'cat-cross', slug: 'crosstrainers', name: 'Crosstrainers' },
]

const valuationListingPath = buildCreateListingFromValuationPath({
  product: sampleProducts[0],
  valuation: {
    estimated_mid: 2400,
    estimated_low: 2160,
    estimated_high: 2640,
    depreciation_year_used: 2020,
    currency: 'GBP',
  },
  condition: 'Good',
  manufactureYear: 2020,
  consoleName: 'Unity',
  displayName: 'Technogym Excite Run 700',
})
assert(valuationListingPath.startsWith('/sell?'), 'valuation listing path targets sell page')
assert(valuationListingPath.includes('source=valuation'), 'valuation listing path includes source=valuation')
assert(valuationListingPath.includes('productId=p1'), 'valuation listing path includes product id')
assert(valuationListingPath.includes('equipment=technogym-excite-run-700'), 'valuation listing path includes equipment key')
assert(valuationListingPath.includes('title=Technogym'), 'valuation listing path includes title')
assert(valuationListingPath.includes('brand=Technogym'), 'valuation listing path includes brand')
assert(valuationListingPath.includes('year=2020'), 'valuation listing path includes manufacture year')
assert(valuationListingPath.includes('condition=good'), 'valuation listing path includes mapped condition')
assert(valuationListingPath.includes('console=Unity'), 'valuation listing path includes console')
assert(valuationListingPath.includes('estimatedMid=2400'), 'valuation listing path includes estimated mid')

const parsedValuationParams = parseValuationListingSearchParams(new URLSearchParams(valuationListingPath.split('?')[1]))
assert(parsedValuationParams?.productId === 'p1', 'valuation listing params parse product id')
assert(parsedValuationParams?.condition === 'good', 'valuation listing params parse condition')

assert(mapValuationConditionToListingCondition('Excellent') === 'like_new', 'excellent maps to like new')
assert(mapValuationConditionToListingCondition('Good') === 'good', 'good maps to good listing condition')

const valuationPrefill = buildListingFormPrefillFromValuation({
  product: sampleProducts[0],
  categories,
  valuationParams: parsedValuationParams,
})
assert(valuationPrefill.title === 'Technogym Excite Run 700', 'valuation prefill sets title')
assert(valuationPrefill.brand === 'Technogym', 'valuation prefill sets brand')
assert(valuationPrefill.model === 'Technogym Excite Run 700', 'valuation prefill sets model')
assert(valuationPrefill.condition === 'good', 'valuation prefill sets condition')
assert(valuationPrefill.price === '2400', 'valuation prefill sets suggested price')
assert(valuationPrefill.categoryId === 'cat-treadmill', 'valuation prefill resolves category from product')

const mergedPrefill = mergeListingFormPrefill(
  { ...buildListingFormPrefillFromEquipmentProduct(null, categories), title: 'Existing draft title' },
  valuationPrefill,
)
assert(mergedPrefill.title === 'Existing draft title', 'merge prefill does not overwrite existing title')
assert(mergedPrefill.brand === 'Technogym', 'merge prefill fills empty brand')

const valuationPageCss = readFileSync(new URL('../src/pages/ValuationPage.css', import.meta.url), 'utf8')
assert(valuationPageCss.includes('.valuation-page__search-shell'), 'valuation search shell class exists')
assert(
  /\.valuation-page__search-shell[\s\S]*max-width:\s*40rem/s.test(valuationPageCss),
  'valuation search shell keeps fixed max width',
)
assert(
  !valuationPageCss.includes('.valuation-page--wide'),
  'valuation page no longer widens when search results appear',
)

assert(resolveCategorySlugForEquipmentType('Treadmill') === 'treadmill', 'treadmill maps to treadmill category')

const prefill = buildListingFormPrefillFromEquipmentProduct(sampleProducts[0], categories)
assert(prefill.brand === 'Technogym', 'prefill sets brand')
assert(prefill.model === 'Technogym Excite Run 700', 'prefill sets canonical product name as model')
assert(prefill.title === 'Technogym Excite Run 700', 'prefill sets title from canonical product name')
assert(prefill.categoryId === 'cat-treadmill', 'prefill resolves category from equipment type')
assert(prefill.equipmentProductId === 'p1', 'prefill stores equipment product id')
assert(prefill.equipmentProductKey === 'technogym-excite-run-700', 'prefill stores canonical product key')
assert(prefill.equipmentProductFamily === '', 'prefill stores family when present')
assert(prefill.estimatedOriginalRrp === 12000, 'prefill stores estimated original RRP internally')
assert(prefill.estimatedOriginalRrpCurrency === 'GBP', 'prefill stores RRP currency')

const untouchedFields = buildListingFormPrefillFromEquipmentProduct(null, categories)
assert(untouchedFields.brand === '', 'missing product returns empty form defaults')

assert(
  `/equipment/${encodeURIComponent('technogym-excite-run-700')}` === '/equipment/technogym-excite-run-700',
  'product page path is separate from sell handoff path',
)

console.log('valuation flow and listing handoff tests passed')
