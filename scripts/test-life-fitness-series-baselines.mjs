/**
 * Life Fitness series baseline mapping tests.
 */

import { PRODUCT_STATUS } from '../src/lib/intelligenceCanonicalProducts.js'
import {
  buildLifeFitnessSeriesBaselinePlan,
  buildSeriesBaselineReviewNote,
  deriveEquipmentProductBaselineSource,
  EQUIPMENT_PRODUCT_BASELINE_SOURCE,
  evaluateLifeFitnessSeriesBaselineProduct,
  findLifeFitnessSeriesBaselineRule,
  SERIES_BASELINE_SKIP_REASON,
} from '../src/lib/lifeFitnessSeriesBaselines.js'

function assert(condition, label) {
  if (!condition) throw new Error(label)
}

const integrityMissing = {
  id: 'lf-integrity-bike',
  brand: 'Life Fitness',
  product_family: 'Integrity Series',
  model: 'Bike',
  canonical_product_name: 'Life Fitness Integrity Series Bike',
  baseline_manufacture_year: null,
  source_intelligence_row_ids: ['row-integrity'],
  review_notes: null,
}

const integrityEvaluation = evaluateLifeFitnessSeriesBaselineProduct(integrityMissing)
assert(integrityEvaluation.rule?.year === 2017, 'missing Integrity baseline gets 2017')
assert(integrityEvaluation.rule?.seriesLabel === 'Integrity Series', 'Integrity Series label matched')

const integrityVerified = {
  ...integrityMissing,
  id: 'lf-integrity-verified',
  baseline_manufacture_year: 2015,
  lifecycle_confidence: 95,
  review_notes: '[research_approved 2026-01-01] engine=v3',
}
const verifiedEvaluation = evaluateLifeFitnessSeriesBaselineProduct(integrityVerified)
assert(
  verifiedEvaluation.skipReason === SERIES_BASELINE_SKIP_REASON.ALREADY_HAS_BASELINE,
  'verified baseline is not overwritten',
)

const discoverMissing = {
  id: 'lf-discover-pm',
  brand: 'Life Fitness',
  product_family: 'Discover',
  model: 'PowerMill',
  canonical_product_name: 'Life Fitness Discover PowerMill',
  baseline_manufacture_year: null,
  source_intelligence_row_ids: [],
}
assert(
  findLifeFitnessSeriesBaselineRule(discoverMissing) == null,
  'Discover Series cardio no longer has a series baseline default',
)

const elevationAchieve = {
  id: 'lf-elevation-achieve',
  brand: 'Life Fitness',
  product_family: 'Elevation - Achieve',
  model: 'Treadmill',
  canonical_product_name: 'Life Fitness Elevation Achieve Treadmill',
  baseline_manufacture_year: null,
  source_intelligence_row_ids: [],
}
assert(
  findLifeFitnessSeriesBaselineRule(elevationAchieve)?.year === 2010,
  'Elevation Achieve gets Elevation = 2010',
)
assert(
  findLifeFitnessSeriesBaselineRule(elevationAchieve)?.seriesLabel === 'Elevation',
  'Elevation Achieve maps to Elevation series default',
)

const technogymProduct = {
  id: 'tg-treadmill',
  brand: 'Technogym',
  product_family: 'Excite',
  canonical_product_name: 'Technogym Excite Run',
  baseline_manufacture_year: null,
  source_intelligence_row_ids: [],
}
const technogymPlan = buildLifeFitnessSeriesBaselinePlan([technogymProduct], new Map())
assert(technogymPlan.productApplications.length === 0, 'no non-Life Fitness products affected')
assert(technogymPlan.skipped.length === 0, 'non-Life Fitness products are ignored, not counted as skipped')

const plan = buildLifeFitnessSeriesBaselinePlan(
  [integrityMissing, integrityVerified, discoverMissing, elevationAchieve],
  new Map([
    ['row-integrity', {
      id: 'row-integrity',
      brand: 'Life Fitness',
      baseline_manufacture_year: null,
      baseline_manufacture_year_confidence: null,
      baseline_manufacture_year_source: null,
    }],
  ]),
)

assert(plan.productApplications.length === 2, 'two eligible Life Fitness products without baseline')
assert(
  plan.productApplications.find((entry) => entry.product.id === integrityMissing.id)?.proposedBaseline === 2017,
  'Integrity product included in apply plan',
)
assert(
  !plan.productApplications.some((entry) => entry.product.id === integrityVerified.id),
  'verified Integrity product excluded from apply plan',
)
assert(
  plan.intelligenceApplications.some((entry) => entry.rowId === 'row-integrity'),
  'missing linked intelligence baseline is included for propagation',
)

const reviewNote = buildSeriesBaselineReviewNote('Integrity Series', 2017)
assert(
  reviewNote.includes('Integrity Series = 2017'),
  'review note records series default provenance',
)

const seriesDefaultSource = deriveEquipmentProductBaselineSource({
  baseline_manufacture_year: 2017,
  review_notes: reviewNote,
})
assert(
  seriesDefaultSource.type === EQUIPMENT_PRODUCT_BASELINE_SOURCE.SERIES_DEFAULT,
  'admin baseline source detects series default',
)

const researchSource = deriveEquipmentProductBaselineSource({
  baseline_manufacture_year: 2016,
  review_notes: '[research_approved 2026-02-01] engine=v3 lifecycle_conf=92',
  lifecycle_confidence: 92,
  status: PRODUCT_STATUS.APPROVED,
  original_base_price: 5000,
  original_price_confidence: 90,
})
assert(
  researchSource.type === EQUIPMENT_PRODUCT_BASELINE_SOURCE.PRODUCT_RESEARCH,
  'admin baseline source detects product research',
)

console.log('life fitness series baseline tests passed')
