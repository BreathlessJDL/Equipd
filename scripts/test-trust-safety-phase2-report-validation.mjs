#!/usr/bin/env node
/**
 * Trust & Safety Phase 2 — report validation unit tests.
 *
 * Usage:
 *   node scripts/test-trust-safety-phase2-report-validation.mjs
 */

import {
  REPORT_REASONS,
  REPORT_TYPES,
  validateReportInput,
} from '../src/lib/reportsValidation.js'

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function logPass(message) {
  console.log(`PASS: ${message}`)
}

const listingValid = validateReportInput({
  reportType: REPORT_TYPES.LISTING,
  reason: REPORT_REASONS.MISLEADING_LISTING,
  description: '',
})

assert(listingValid.ok, 'Listing report with reason should pass without description')

const otherMissing = validateReportInput({
  reportType: REPORT_TYPES.USER,
  reason: REPORT_REASONS.OTHER,
  description: '   ',
})

assert(!otherMissing.ok, 'Other reason should require description')
assert(
  otherMissing.error.includes('describe'),
  'Other reason should mention description requirement',
)

const otherValid = validateReportInput({
  reportType: REPORT_TYPES.USER,
  reason: REPORT_REASONS.OTHER,
  description: 'Asked me to pay by bank transfer.',
})

assert(otherValid.ok, 'Other reason with description should pass')

const invalidReason = validateReportInput({
  reportType: REPORT_TYPES.LISTING,
  reason: REPORT_REASONS.HARASSMENT,
  description: '',
})

assert(!invalidReason.ok, 'Listing report should reject user-only reasons')

logPass('Report validation rules behave as expected')
console.log('\nAll report validation checks passed.')
