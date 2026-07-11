/**
 * Equipment valuation v1 — depreciation model using equipment_products as source of truth.
 */

import { calculateOriginalPriceWithConsole } from './consoleModifierValuation.js'
import {
  parseEquipmentProductSearchQuery,
  scoreEquipmentProductSearchMatch,
  searchEquipmentProductCatalog,
} from './equipmentProductSearch.js'

export const VALUATION_CONDITIONS = [
  { value: 'Excellent', label: 'Excellent', multiplier: 1.1 },
  { value: 'Good', label: 'Good', multiplier: 1 },
  { value: 'Fair', label: 'Fair', multiplier: 0.85 },
  { value: 'Poor', label: 'Poor', multiplier: 0.7 },
  { value: 'Faulty', label: 'Faulty', multiplier: 0.5 },
]

/** UI-facing condition options (valuation form). */
export const VALUATION_CONDITION_OPTIONS = VALUATION_CONDITIONS.filter(
  (entry) => entry.value !== 'Faulty',
)

const RANGE_LOW_FACTOR = 0.9
const RANGE_HIGH_FACTOR = 1.1

const MIN_MANUFACTURE_YEAR = 1970

export const MANUFACTURE_YEAR_UNKNOWN_VALUE = ''
export const MANUFACTURE_YEAR_UNKNOWN_LABEL = "I'm not sure"

const YEAR_RANGE_CONSOLE_TYPES = new Set(['factory', 'optional', 'fixed'])

function toFiniteYear(value) {
  if (value == null || value === '') return null
  const year = Number(value)
  return Number.isFinite(year) ? year : null
}

function resolveMinManufactureYear(product = {}) {
  const baseline = toFiniteYear(product.baseline_manufacture_year)
  const productionStart = toFiniteYear(product.production_start_year)
  if (baseline != null && productionStart != null) return Math.min(baseline, productionStart)
  if (baseline != null) return baseline
  if (productionStart != null) return productionStart
  return null
}

/**
 * Shared manufacture-year window for dropdowns, valuation, and listing prefill.
 *
 * Max-year priority:
 * 1. Explicit production_end / manufacture_end_year
 * 2. Verified lifecycle end field (when stored separately)
 * 3. Latest finite factory/optional/fixed console end year (UI-only fallback)
 * 4. Current year when no end evidence exists
 *
 * Console fallback never writes back to product lifecycle fields.
 */
export function getValidManufactureYearRange(product = {}, consoleCompatibility = [], {
  currentYear = new Date().getFullYear(),
} = {}) {
  const current = toFiniteYear(currentYear) ?? new Date().getFullYear()
  const minYear = resolveMinManufactureYear(product)

  const productionEnd = toFiniteYear(
    product.production_end_year ?? product.manufacture_end_year,
  )
  if (productionEnd != null) {
    const maxYear = minYear != null ? Math.max(minYear, productionEnd) : productionEnd
    return {
      minYear,
      maxYear,
      maxYearSource: 'production_end',
      maxYearConfirmed: true,
      needsConfirmedProductionEnd: false,
    }
  }

  const lifecycleEnd = toFiniteYear(
    product.lifecycle_end_year
    ?? product.verified_lifecycle_end_year
    ?? product.verified_production_end_year,
  )
  if (lifecycleEnd != null) {
    const maxYear = minYear != null ? Math.max(minYear, lifecycleEnd) : lifecycleEnd
    return {
      minYear,
      maxYear,
      maxYearSource: 'lifecycle_end',
      maxYearConfirmed: true,
      needsConfirmedProductionEnd: false,
    }
  }

  const compatRows = (Array.isArray(consoleCompatibility) ? consoleCompatibility : [])
    .filter((row) => row && row.is_active !== false)
    .filter((row) => {
      const type = row.compatibility_type ?? 'factory'
      return YEAR_RANGE_CONSOLE_TYPES.has(type)
    })

  if (compatRows.length) {
    const ends = compatRows.map((row) => toFiniteYear(
      row.available_to_year ?? row.retired_year,
    ))
    const hasOpenEnded = ends.some((year) => year == null)
    if (!hasOpenEnded) {
      const inferredEnd = Math.max(...ends)
      const maxYear = minYear != null ? Math.max(minYear, inferredEnd) : inferredEnd
      return {
        minYear,
        maxYear,
        maxYearSource: 'console_compat',
        maxYearConfirmed: false,
        needsConfirmedProductionEnd: true,
      }
    }
  }

  const maxYear = minYear != null ? Math.max(minYear, current) : current
  return {
    minYear,
    maxYear,
    maxYearSource: 'current_year',
    maxYearConfirmed: false,
    needsConfirmedProductionEnd: true,
  }
}

/**
 * Build manufacture year dropdown options for product / valuation controls.
 * Starts at the product introduction (baseline) year — never includes "I'm not sure".
 * Caps at confirmed production end, or inferred console end, never past known lifecycle.
 */
export function buildManufactureYearDropdownOptions({
  baseline_manufacture_year,
  production_start_year = null,
  production_end_year = null,
  manufacture_end_year = null,
  lifecycle_end_year = null,
  verified_lifecycle_end_year = null,
  console_compatibility = [],
  current_year = new Date().getFullYear(),
} = {}) {
  const range = getValidManufactureYearRange({
    baseline_manufacture_year,
    production_start_year,
    production_end_year,
    manufacture_end_year,
    lifecycle_end_year,
    verified_lifecycle_end_year,
  }, console_compatibility, { currentYear: current_year })

  if (!Number.isFinite(range.minYear) || !Number.isFinite(range.maxYear) || range.minYear > range.maxYear) {
    return []
  }

  const options = []
  for (let year = range.minYear; year <= range.maxYear; year += 1) {
    options.push({ value: String(year), label: String(year) })
  }

  return options
}

export function parseSelectedManufactureYear(selectedValue) {
  if (selectedValue == null || selectedValue === MANUFACTURE_YEAR_UNKNOWN_VALUE) {
    return null
  }

  const year = Number(selectedValue)
  return Number.isFinite(year) ? year : null
}

/**
 * Default manufacture year for product page valuation controls.
 * Prefers baseline year, then production start year, otherwise empty.
 */
export function getDefaultProductManufactureYear(product) {
  const baseline = Number(product?.baseline_manufacture_year)
  if (Number.isFinite(baseline)) return String(baseline)

  const start = Number(product?.production_start_year)
  if (Number.isFinite(start)) return String(start)

  return MANUFACTURE_YEAR_UNKNOWN_VALUE
}

/**
 * Ensure a manufacture-year select value exists in the dropdown options.
 * Invalid / out-of-range years reset to the product baseline (or first valid year).
 */
export function resolveManufactureYearSelectValue(product, selectedValue, {
  current_year = new Date().getFullYear(),
  console_compatibility = [],
} = {}) {
  const options = buildManufactureYearDropdownOptions({
    baseline_manufacture_year: product?.baseline_manufacture_year,
    production_start_year: product?.production_start_year,
    production_end_year: product?.production_end_year,
    manufacture_end_year: product?.manufacture_end_year,
    lifecycle_end_year: product?.lifecycle_end_year,
    verified_lifecycle_end_year: product?.verified_lifecycle_end_year,
    console_compatibility,
    current_year,
  })
  if (!options.length) return MANUFACTURE_YEAR_UNKNOWN_VALUE

  const selected = selectedValue == null ? '' : String(selectedValue)
  if (selected && options.some((option) => option.value === selected)) {
    return selected
  }

  const defaultYear = getDefaultProductManufactureYear(product)
  if (defaultYear && options.some((option) => option.value === defaultYear)) {
    return defaultYear
  }

  return options[0].value
}

/**
 * Fixed residual curve — fraction of adjusted original price retained by equipment age.
 * Ages 0–10 use the fixed table. After age 10, residual falls 1pp per year to a 2.5% floor.
 */
const RESIDUAL_BY_AGE = {
  0: 0.55,
  1: 0.55,
  2: 0.4,
  3: 0.3,
  4: 0.2,
  5: 0.15,
  6: 0.14,
  7: 0.13,
  8: 0.12,
  9: 0.11,
}

const RESIDUAL_AT_AGE_10 = 0.1
const RESIDUAL_FLOOR = 0.025

function normalizeWhitespace(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim()
}

function roundMoney(value) {
  if (!Number.isFinite(value)) return null
  return Math.max(0, Math.round(value))
}

function isValidManufactureYear(year, currentYear) {
  const value = Number(year)
  return Number.isFinite(value)
    && value >= MIN_MANUFACTURE_YEAR
    && value <= currentYear + 1
}

function getConditionMultiplier(condition) {
  return VALUATION_CONDITIONS.find((entry) => entry.value === condition)?.multiplier ?? 1
}

export function getResidualPercentage(ageYears) {
  const age = Math.max(0, Math.floor(Number(ageYears) || 0))
  if (age <= 10) {
    if (age === 10) return RESIDUAL_AT_AGE_10
    return RESIDUAL_BY_AGE[age] ?? RESIDUAL_AT_AGE_10
  }
  // Integer percentage points avoid float drift (e.g. 0.10 - 0.01 !== 0.09).
  const residualPercent = Math.max(RESIDUAL_FLOOR * 100, 10 - (age - 10))
  return residualPercent / 100
}

const GRAPH_EARLY_YEAR_FRACTIONS = [0.25, 0.5]

export function calculateEquipmentAgeFractional(manufactureYear, asOfYear) {
  const year = Number(manufactureYear)
  const asOf = Number(asOfYear)
  if (!Number.isFinite(year) || !Number.isFinite(asOf)) return null
  return Math.max(0, asOf - year)
}

/**
 * Graph-only residual curve: 100% at manufacture, then steepest drop in year 0–1.
 * Fractional ages interpolate between integer residual bands for a smooth plotted line.
 */
export function getGraphResidualPercentage(ageYears) {
  const age = Math.max(0, Number(ageYears) || 0)
  if (age === 0) return 1
  if (age < 1) {
    const endYearOne = getResidualPercentage(1)
    return 1 + (endYearOne - 1) * age
  }

  const lower = Math.floor(age)
  const upper = lower + 1
  const lowerResidual = getResidualPercentage(lower)
  const upperResidual = getResidualPercentage(upper)
  const fraction = age - lower
  return lowerResidual + (upperResidual - lowerResidual) * fraction
}

export function buildDepreciationGraphTimelinePositions(graphStartYear, currentYear) {
  const start = Number(graphStartYear)
  const end = Number(currentYear)
  if (!Number.isFinite(start) || !Number.isFinite(end) || start > end) return []

  const positions = [start]

  for (const fraction of GRAPH_EARLY_YEAR_FRACTIONS) {
    const position = start + fraction
    if (position <= end) {
      positions.push(position)
    }
  }

  for (let year = Math.floor(start) + 1; year <= end; year += 1) {
    positions.push(year)
  }

  return [...new Set(positions)].sort((left, right) => left - right)
}

function calculateGraphDepreciationPointValue({
  adjustedOriginalPrice,
  conditionMultiplier,
  manufactureYear,
  asOfYear,
}) {
  const age = calculateEquipmentAgeFractional(manufactureYear, asOfYear)
  const residual = getGraphResidualPercentage(age)
  return roundMoney(adjustedOriginalPrice * residual * conditionMultiplier)
}

/**
 * Resolve which manufacture year drives depreciation age.
 * baseline_manufacture_year is the oldest likely year / fallback.
 */
export function resolveDepreciationYear({
  baseline_manufacture_year,
  actual_manufacture_year = null,
  current_year = new Date().getFullYear(),
  allow_earlier_actual_year = false,
} = {}) {
  const baseline = Number(baseline_manufacture_year)
  const current = Number(current_year)
  const rawActual = actual_manufacture_year != null && actual_manufacture_year !== ''
    ? Number(actual_manufacture_year)
    : null

  const hasValidActual = rawActual != null
    && Number.isFinite(rawActual)
    && isValidManufactureYear(rawActual, current)

  if (hasValidActual) {
    let effectiveActual = rawActual
    let actual_year_clamped = false

    if (!allow_earlier_actual_year && effectiveActual < baseline) {
      effectiveActual = baseline
      actual_year_clamped = true
    }

    if (effectiveActual > current) {
      effectiveActual = current
      actual_year_clamped = true
    }

    return {
      depreciation_year_used: effectiveActual,
      baseline_manufacture_year: baseline,
      actual_manufacture_year: rawActual,
      effective_actual_manufacture_year: effectiveActual,
      used_supplied_manufacture_year: true,
      actual_year_clamped,
      age_year_source: actual_year_clamped && rawActual < baseline
        ? 'actual_clamped_to_baseline'
        : 'actual',
    }
  }

  return {
    depreciation_year_used: baseline,
    baseline_manufacture_year: baseline,
    actual_manufacture_year: null,
    effective_actual_manufacture_year: null,
    used_supplied_manufacture_year: false,
    actual_year_clamped: false,
    age_year_source: 'baseline',
  }
}

export function calculateEquipmentAge(manufactureYear, currentYear) {
  const year = Number(manufactureYear)
  const current = Number(currentYear)
  if (!Number.isFinite(year) || !Number.isFinite(current)) return null
  return Math.max(0, current - year)
}

export function scoreEquipmentProductMatch(product, query) {
  return scoreEquipmentProductSearchMatch(product, parseEquipmentProductSearchQuery(query))
}

export function searchEquipmentProducts(products = [], query) {
  return searchEquipmentProductCatalog(products, query)
}

function deriveConfidenceScore({
  priceConfidence,
  lifecycleConfidence,
  consoleProvided,
  consoleMatched,
  ageYears,
  usedSuppliedManufactureYear,
}) {
  const price = Number(priceConfidence)
  const lifecycle = Number(lifecycleConfidence)
  const components = []

  if (Number.isFinite(price)) components.push(price)
  if (Number.isFinite(lifecycle)) components.push(lifecycle)

  let score = components.length
    ? Math.round(components.reduce((sum, value) => sum + value, 0) / components.length)
    : 55

  if (consoleProvided && !consoleMatched) score -= 12
  if (!usedSuppliedManufactureYear) score -= 5
  if (Number.isFinite(ageYears) && ageYears > 15) score -= 8

  return Math.max(20, Math.min(95, score))
}

export function formatValuationConfidence(score) {
  const value = Number(score)
  if (!Number.isFinite(value)) return 'Low'
  if (value >= 80) return 'High'
  if (value >= 60) return 'Medium'
  if (value >= 40) return 'Low'
  return 'Very low'
}

export const INSUFFICIENT_VALUATION_MESSAGE = "We don't have enough data to estimate this product yet."

export function buildValuationEstimateDisclaimer({ includeConsole = false } = {}) {
  const consoleClause = includeConsole ? ', console configuration where applicable' : ''
  return (
    `This valuation is an estimate based on the original RRP, equipment age, condition${consoleClause}, `
    + 'and current market depreciation. Actual selling prices may vary depending on demand, location and overall condition.'
  )
}

export const VALUATION_ESTIMATE_DISCLAIMER = buildValuationEstimateDisclaimer()

export function buildValuationGraphCaption({
  startYear,
  includeConsole = false,
} = {}) {
  const yearLabel = Number.isFinite(Number(startYear)) ? String(startYear) : 'manufacture'
  const factors = [
    'the original RRP',
    'equipment age',
    'selected condition',
  ]
  if (includeConsole) factors.push('console configuration')
  factors.push('current market depreciation')

  const factorText = factors.length <= 2
    ? factors.join(' and ')
    : `${factors.slice(0, -1).join(', ')} and ${factors[factors.length - 1]}`

  return `Estimated depreciation from ${yearLabel} to today, based on ${factorText}.`
}

export const MANUFACTURED_FROM_LABEL = 'Manufactured from'
export const PRODUCTION_YEARS_LABEL = 'Production years'

export function getProductManufacturedFromYear(product) {
  const year = Number(product?.baseline_manufacture_year)
  return Number.isFinite(year) ? year : null
}

export function getProductGraphStartYear(product) {
  return getProductManufacturedFromYear(product)
}

export function formatProductProductionYears(product) {
  const end = toFiniteYear(product?.production_end_year ?? product?.manufacture_end_year)
  if (end == null) return null

  const start = toFiniteYear(product?.production_start_year)
    ?? toFiniteYear(product?.baseline_manufacture_year)
  if (start == null) return null

  return `${start}–${end}`
}

const GENERIC_EQUIPMENT_MODEL_LABELS = new Set([
  'bike',
  'run',
  'treadmill',
  'crosstrainer',
  'cross trainer',
  'upright bike',
  'recumbent bike',
])

function buildInsufficientDataResult({
  equipmentProductId = null,
  currency = 'GBP',
}) {
  return {
    ok: false,
    reason: 'insufficient_data',
    equipment_product_id: equipmentProductId,
    estimated_low: null,
    estimated_mid: null,
    estimated_high: null,
    depreciation_percentage: null,
    adjusted_original_price: null,
    depreciation_year_used: null,
    baseline_manufacture_year: null,
    actual_manufacture_year: null,
    age_years: null,
    residual_percentage: null,
    condition_multiplier: null,
    confidence: 0,
    confidence_label: 'Very low',
    explanation: INSUFFICIENT_VALUATION_MESSAGE,
    currency,
    steps: [],
  }
}

function buildAgeExplanation(yearResolution) {
  if (yearResolution.used_supplied_manufacture_year) {
    if (yearResolution.actual_year_clamped && yearResolution.actual_manufacture_year < yearResolution.baseline_manufacture_year) {
      return `Supplied manufacture year ${yearResolution.actual_manufacture_year} is earlier than baseline ${yearResolution.baseline_manufacture_year}; using baseline year for depreciation.`
    }
    return 'Using supplied manufacture year for depreciation.'
  }

  return 'Using baseline year because actual manufacture year was not provided.'
}

/**
 * Depreciation model v1.
 */
export function calculateEquipmentValuation({
  equipment_product_id = null,
  original_base_price,
  baseline_manufacture_year,
  actual_manufacture_year = null,
  brand = null,
  console_name = null,
  console_key = null,
  console_id = null,
  console_modifier = null,
  condition = 'Good',
  current_year = new Date().getFullYear(),
  allow_earlier_actual_year = false,
  modifiers = [],
  availability = [],
  product_console_options = [],
  currency = 'GBP',
  original_price_confidence = null,
  lifecycle_confidence = null,
} = {}) {
  const missingFields = []
  const basePrice = Number(original_base_price)
  const baselineYear = Number(baseline_manufacture_year)
  const currentYear = Number(current_year)

  if (!Number.isFinite(basePrice) || basePrice <= 0) {
    missingFields.push('original_base_price')
  }
  if (!isValidManufactureYear(baselineYear, currentYear)) {
    missingFields.push('baseline_manufacture_year')
  }

  if (missingFields.length) {
    return buildInsufficientDataResult({
      equipmentProductId: equipment_product_id,
      currency,
    })
  }

  const consoleAdjustment = calculateOriginalPriceWithConsole({
    originalBasePrice: basePrice,
    brand,
    consoleName: console_name,
    consoleKey: console_key || console_name,
    consoleId: console_id,
    consoleModifier: console_modifier,
    modifiers,
    availability,
    productConsoleOptions: product_console_options,
    currency,
  })

  const yearResolution = resolveDepreciationYear({
    baseline_manufacture_year: baselineYear,
    actual_manufacture_year,
    current_year: currentYear,
    allow_earlier_actual_year,
  })

  const adjustedOriginalPrice = consoleAdjustment.adjustedPrice
  const ageYears = calculateEquipmentAge(yearResolution.depreciation_year_used, currentYear)
  const residualPercentage = getResidualPercentage(ageYears)
  const conditionMultiplier = getConditionMultiplier(condition)

  const estimatedMid = roundMoney(adjustedOriginalPrice * residualPercentage * conditionMultiplier)
  const estimatedLow = roundMoney(estimatedMid * RANGE_LOW_FACTOR)
  const estimatedHigh = roundMoney(estimatedMid * RANGE_HIGH_FACTOR)

  const depreciationPercentage = adjustedOriginalPrice > 0
    ? Math.round((1 - (estimatedMid / adjustedOriginalPrice)) * 1000) / 10
    : null

  const ageExplanation = buildAgeExplanation(yearResolution)

  const confidence = deriveConfidenceScore({
    priceConfidence: original_price_confidence,
    lifecycleConfidence: lifecycle_confidence,
    consoleProvided: Boolean(normalizeWhitespace(console_key || console_name)),
    consoleMatched: Boolean(consoleAdjustment.modifier) || Number(consoleAdjustment.modifierPercent) > 0,
    ageYears,
    usedSuppliedManufactureYear: yearResolution.used_supplied_manufacture_year
      && !yearResolution.actual_year_clamped,
  })

  const steps = [
    `Adjusted original price: ${consoleAdjustment.explanation}`,
    ageExplanation,
    `Depreciation year used: ${yearResolution.depreciation_year_used} (age ${ageYears} years at ${currentYear}).`,
    `Residual percentage: ${Math.round(residualPercentage * 100)}%.`,
    `Condition (${condition}): ×${conditionMultiplier.toFixed(2)} multiplier.`,
    `Estimated value: ${formatValuationMoney(adjustedOriginalPrice, currency)} × ${Math.round(residualPercentage * 100)}% × ${conditionMultiplier.toFixed(2)} = ${formatValuationMoney(estimatedMid, currency)}.`,
    `Range: ${formatValuationMoney(estimatedLow, currency)} – ${formatValuationMoney(estimatedHigh, currency)}.`,
  ]

  return {
    ok: true,
    reason: null,
    equipment_product_id,
    adjusted_original_price: adjustedOriginalPrice,
    depreciation_year_used: yearResolution.depreciation_year_used,
    baseline_manufacture_year: baselineYear,
    actual_manufacture_year: yearResolution.actual_manufacture_year,
    effective_actual_manufacture_year: yearResolution.effective_actual_manufacture_year,
    age_years: ageYears,
    age_year_source: yearResolution.age_year_source,
    actual_year_clamped: yearResolution.actual_year_clamped,
    residual_percentage: Math.round(residualPercentage * 1000) / 10,
    condition,
    condition_multiplier: conditionMultiplier,
    estimated_low: estimatedLow,
    estimated_mid: estimatedMid,
    estimated_high: estimatedHigh,
    depreciation_percentage: depreciationPercentage,
    original_base_price: basePrice,
    confidence,
    confidence_label: formatValuationConfidence(confidence),
    explanation: `${ageExplanation} ${steps.slice(2).join(' ')}`,
    currency,
    console_modifier_percent: consoleAdjustment.modifierPercent,
    console_name: consoleAdjustment.consoleName,
    console_key: consoleAdjustment.consoleKey,
    steps,
  }
}

/**
 * Convenience wrapper when a full equipment_products row is available.
 */
export function calculateEquipmentProductValuation(product, options = {}) {
  if (!product) {
    return buildInsufficientDataResult({ equipmentProductId: null })
  }

  return calculateEquipmentValuation({
    equipment_product_id: product.id,
    original_base_price: product.original_base_price,
    baseline_manufacture_year: product.baseline_manufacture_year,
    brand: product.brand,
    currency: product.original_base_price_currency ?? 'GBP',
    original_price_confidence: product.original_price_confidence,
    lifecycle_confidence: product.lifecycle_confidence,
    ...options,
  })
}

export function formatValuationMoney(amount, currency = 'GBP') {
  if (amount == null) return '—'
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Number(amount))
}

export function formatValuationRange(low, high, currency = 'GBP') {
  if (low == null && high == null) return '—'
  if (low == null) return formatValuationMoney(high, currency)
  if (high == null) return formatValuationMoney(low, currency)
  if (low === high) return formatValuationMoney(low, currency)
  return `${formatValuationMoney(low, currency)} – ${formatValuationMoney(high, currency)}`
}

export function getEquipmentProductDisplayName(product) {
  return normalizeWhitespace(product?.canonical_product_name)
    || [product?.brand, product?.model].filter(Boolean).join(' ')
    || 'Equipment'
}

export function getEquipmentProductSlug(product) {
  return normalizeWhitespace(product?.canonical_product_key) || null
}

export function productHasValuationRrp(product) {
  const price = Number(product?.original_base_price)
  return Number.isFinite(price) && price > 0
}

export function productHasValuationBaselineYear(product) {
  return product?.baseline_manufacture_year != null
}

export function getEquipmentProductCompletionStatus(product) {
  const hasPrice = productHasValuationRrp(product)
  const hasBaseline = productHasValuationBaselineYear(product)

  if (hasPrice && hasBaseline) {
    return { status: 'complete', label: 'Complete', canValue: true }
  }
  if (!hasPrice && !hasBaseline) {
    return {
      status: 'missing_both',
      label: 'Missing RRP and baseline year',
      canValue: false,
    }
  }
  if (!hasPrice) {
    return { status: 'missing_price', label: 'Missing RRP', canValue: false }
  }
  return { status: 'missing_baseline', label: 'Missing baseline year', canValue: false }
}

export function buildValuationExplanationLines(valuation, currency = 'GBP') {
  if (!valuation?.ok) return []

  return [
    {
      label: 'Estimated original RRP',
      value: formatValuationMoney(valuation.original_base_price, currency),
    },
    {
      label: 'Manufacture year',
      value: String(valuation.depreciation_year_used),
    },
    {
      label: 'Equipment age',
      value: `${valuation.age_years} year${valuation.age_years === 1 ? '' : 's'}`,
    },
  ]
}

export function isGenericEquipmentModelLabel(model) {
  const normalized = normalizeWhitespace(model).toLowerCase()
  if (!normalized) return true
  return GENERIC_EQUIPMENT_MODEL_LABELS.has(normalized)
}

export function shouldShowRawEquipmentModelOnProductPage(product) {
  const rawModel = normalizeWhitespace(product?.model)
  if (!rawModel || isGenericEquipmentModelLabel(rawModel)) return false
  const displayName = getEquipmentProductDisplayName(product)
  return rawModel.toLowerCase() !== displayName.toLowerCase()
}

export function buildEquipmentDepreciationGraphData({
  original_base_price,
  baseline_manufacture_year,
  current_year = new Date().getFullYear(),
  condition = 'Good',
  depreciation_year_used = null,
  brand = null,
  console_name = null,
  console_key = null,
  modifiers = [],
  product_console_options = [],
} = {}) {
  const basePrice = Number(original_base_price)
  const baselineYear = Number(baseline_manufacture_year)
  const currentYear = Number(current_year)
  const manufactureYearUsed = Number(depreciation_year_used ?? baseline_manufacture_year)

  if (!Number.isFinite(basePrice) || basePrice <= 0) return null
  if (!isValidManufactureYear(baselineYear, currentYear)) return null
  if (!isValidManufactureYear(manufactureYearUsed, currentYear)) return null

  // Timeline represents the selected machine, not the product family's introduction year.
  const graphStartYear = manufactureYearUsed
  const timelinePositions = buildDepreciationGraphTimelinePositions(graphStartYear, currentYear)
  if (!timelinePositions.length) return null

  const terminalValuation = calculateEquipmentValuation({
    original_base_price: basePrice,
    baseline_manufacture_year: baselineYear,
    actual_manufacture_year: manufactureYearUsed === baselineYear ? null : manufactureYearUsed,
    current_year: currentYear,
    condition,
    brand,
    console_name,
    console_key: console_key || console_name,
    modifiers,
    product_console_options,
  })

  if (!terminalValuation.ok) return null

  const adjustedOriginalPrice = terminalValuation.adjusted_original_price
  const conditionMultiplier = terminalValuation.condition_multiplier

  const timelineYears = []
  for (let year = graphStartYear; year <= currentYear; year += 1) {
    timelineYears.push(year)
  }

  const points = timelinePositions.map((asOfYear) => {
    const isCurrentEstimate = asOfYear === currentYear
    const isManufactureHighlight = asOfYear === manufactureYearUsed
    const age = calculateEquipmentAgeFractional(manufactureYearUsed, asOfYear)
    const value = isCurrentEstimate
      ? terminalValuation.estimated_mid
      : calculateGraphDepreciationPointValue({
        adjustedOriginalPrice,
        conditionMultiplier,
        manufactureYear: manufactureYearUsed,
        asOfYear,
      })

    return {
      year: asOfYear,
      value,
      age,
      highlighted: isCurrentEstimate || isManufactureHighlight,
      highlightKind: isCurrentEstimate
        ? 'current'
        : isManufactureHighlight
          ? 'manufacture'
          : null,
    }
  })

  return {
    points,
    startYear: graphStartYear,
    endYear: currentYear,
    manufactureYearUsed,
    timelineYears,
    startValue: points[0]?.value ?? null,
    endValue: points[points.length - 1]?.value ?? null,
  }
}

export function pickDepreciationGraphYearTicks(years = [], { compact = false } = {}) {
  if (!years.length) return []
  if (years.length === 1) return years

  const maxTicks = compact ? 4 : Math.min(8, years.length)
  if (years.length <= maxTicks) return years

  const step = Math.ceil((years.length - 1) / (maxTicks - 1))
  const ticks = []

  for (let index = 0; index < years.length; index += step) {
    ticks.push(years[index])
  }

  const firstYear = years[0]
  const lastYear = years[years.length - 1]

  if (ticks[0] !== firstYear) {
    ticks.unshift(firstYear)
  }

  if (ticks[ticks.length - 1] !== lastYear) {
    ticks.push(lastYear)
  }

  return [...new Set(ticks)]
}

export function buildEquipmentDepreciationGraphDataFromProduct(
  product,
  {
    current_year = new Date().getFullYear(),
    condition = 'Good',
    depreciation_year_used = null,
    console_name = null,
    console_key = null,
    modifiers = [],
    product_console_options = [],
  } = {},
) {
  if (!productHasValuationRrp(product) || !productHasValuationBaselineYear(product)) {
    return null
  }

  const graphStartYear = getProductGraphStartYear(product)
  if (graphStartYear == null) return null

  return buildEquipmentDepreciationGraphData({
    original_base_price: product.original_base_price,
    baseline_manufacture_year: graphStartYear,
    current_year,
    condition,
    depreciation_year_used: depreciation_year_used ?? graphStartYear,
    brand: product.brand,
    console_name,
    console_key: console_key || console_name,
    modifiers,
    product_console_options,
  })
}

export function resolveValuationSearchMatches(products = [], query) {
  const trimmedQuery = normalizeWhitespace(query)
  if (!trimmedQuery) {
    return {
      matches: [],
      scoredMatches: [],
      diagnostics: [],
      hasQuery: false,
      showNoMatch: false,
    }
  }

  const result = searchEquipmentProducts(products, trimmedQuery)
  return {
    matches: result.matches,
    scoredMatches: result.scoredMatches ?? [],
    diagnostics: result.diagnostics ?? [],
    parsedQuery: result.parsedQuery ?? null,
    hasQuery: true,
    showNoMatch: result.matches.length === 0,
    strongMatch: result.strongMatch ?? null,
  }
}

export function shouldClearSelectedValuationProduct(selectedProduct, products = [], query) {
  if (!selectedProduct) return false

  // Catalogue not loaded yet — never clear a valid selection against an empty list.
  if (!Array.isArray(products) || products.length === 0) return false

  const trimmedQuery = normalizeWhitespace(query)
  if (!trimmedQuery) return true

  const result = searchEquipmentProducts(products, trimmedQuery)
  return !result.matches.some((product) => product.id === selectedProduct.id)
}

export function shouldValuationProductPageLinkStopSelection(event) {
  if (!event) return false
  event.stopPropagation()
  return true
}
