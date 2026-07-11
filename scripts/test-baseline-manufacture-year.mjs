/**
 * Unit tests for baseline manufacture year helpers.
 */

import {
  BASELINE_MANUFACTURE_YEAR_SOURCE,
  PROVISIONAL_BASELINE_CONFIDENCE,
  buildResearchApprovedBaselineFields,
  buildTechnogymProvisionalBaselinePlan,
  deriveBaselineManufactureYearStatus,
  getDepreciationManufactureYear,
  shouldApplyBaselineManufactureYearUpdate,
} from '../src/lib/baselineManufactureYear.js'

function assert(condition, label) {
  if (!condition) throw new Error(label)
}

assert(
  deriveBaselineManufactureYearStatus({ baseline_manufacture_year: 2005, baseline_manufacture_year_source: 'ai_research_approved' }) === 'verified',
  'AI-approved baseline should be verified',
)
assert(
  deriveBaselineManufactureYearStatus({
    baseline_manufacture_year: 2012,
    baseline_manufacture_year_source: BASELINE_MANUFACTURE_YEAR_SOURCE.TECHNOGYM_TRADE_IN_MATRIX,
  }) === 'estimated',
  'Technogym provisional baseline should be estimated',
)
assert(
  deriveBaselineManufactureYearStatus({}) === 'missing',
  'empty equipment should be missing baseline status',
)

assert(
  shouldApplyBaselineManufactureYearUpdate(
    { year: 2005, confidence: 80, source: 'ai_research_approved' },
    { year: 2012, confidence: 60, source: BASELINE_MANUFACTURE_YEAR_SOURCE.TECHNOGYM_TRADE_IN_MATRIX },
  ) === false,
  'provisional should not overwrite verified baseline',
)
assert(
  shouldApplyBaselineManufactureYearUpdate(
    { year: 2012, confidence: 60, source: BASELINE_MANUFACTURE_YEAR_SOURCE.TECHNOGYM_TRADE_IN_MATRIX },
    { year: 2005, confidence: 80, source: 'ai_research_approved' },
  ) === true,
  'verified baseline should replace provisional',
)
assert(
  shouldApplyBaselineManufactureYearUpdate(
    { year: null, confidence: null, source: null },
    { year: 2012, confidence: 60, source: BASELINE_MANUFACTURE_YEAR_SOURCE.TECHNOGYM_TRADE_IN_MATRIX },
  ) === true,
  'provisional should apply when baseline empty',
)

const approved = buildResearchApprovedBaselineFields({
  production_start_year: 2005,
  production_end_year: 2015,
  production_confidence: 82,
})
assert(approved?.baseline_manufacture_year === 2005, 'approved baseline should use production_start_year')
assert(approved?.baseline_manufacture_year_source === 'ai_research_approved', 'approved baseline source')

const endOnly = buildResearchApprovedBaselineFields({
  production_end_year: 2018,
  production_confidence: 70,
})
assert(endOnly?.baseline_manufacture_year === 2018, 'single end year should become baseline')

assert(
  getDepreciationManufactureYear({ baseline_manufacture_year: 2004, manufacture_start_year: 2005 }) === 2004,
  'depreciation should prefer baseline_manufacture_year',
)

const technogymRows = [
  {
    id: 'a1',
    brand: 'Technogym',
    slug: 'technogym-strength-ab-crunch-2012',
    manufacture_year: 2012,
    baseline_manufacture_year: null,
    baseline_manufacture_year_confidence: null,
    baseline_manufacture_year_source: null,
  },
  {
    id: 'a2',
    brand: 'Technogym',
    slug: 'technogym-strength-ab-crunch-2016',
    manufacture_year: 2016,
    baseline_manufacture_year: null,
    baseline_manufacture_year_confidence: null,
    baseline_manufacture_year_source: null,
  },
  {
    id: 'b1',
    brand: 'Technogym',
    slug: 'technogym-strength-ab-crunch',
    manufacture_year: null,
    baseline_manufacture_year: null,
    baseline_manufacture_year_confidence: null,
    baseline_manufacture_year_source: null,
  },
  {
    id: 'c1',
    brand: 'Technogym',
    slug: 'technogym-skill-bike',
    manufacture_year: null,
    baseline_manufacture_year: null,
    baseline_manufacture_year_confidence: null,
    baseline_manufacture_year_source: null,
  },
]

const plan = buildTechnogymProvisionalBaselinePlan(technogymRows)
assert(plan.familiesWithEarliestYear.length === 1, 'one Technogym matrix family expected')
assert(plan.applications.length === 3, 'matrix family rows including canonical should receive provisional baseline')
assert(
  plan.applications.every((entry) => entry.proposed.year === 2012),
  'earliest trade-in year should be 2012',
)
assert(
  plan.applications.every((entry) => entry.proposed.confidence === PROVISIONAL_BASELINE_CONFIDENCE),
  'provisional confidence should be 60',
)

console.log('baseline manufacture year tests passed')
