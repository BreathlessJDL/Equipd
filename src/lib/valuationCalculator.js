import {
  groupObservationsByAge,
  summarizeObservationPrices,
} from './priceGuideStats'

export const VALUATION_CONDITIONS = [
  { value: 'Excellent', label: 'Excellent', adjustment: 0.15 },
  { value: 'Good', label: 'Good', adjustment: 0 },
  { value: 'Fair', label: 'Fair', adjustment: -0.15 },
  { value: 'Poor', label: 'Poor', adjustment: -0.3 },
  { value: 'Faulty', label: 'Faulty', adjustment: -0.5 },
]

export const WORKING_STATUSES = [
  { value: 'Fully working', label: 'Fully working', adjustment: 0 },
  { value: 'Works with issues', label: 'Works with issues', adjustment: -0.2 },
  { value: 'Not working', label: 'Not working', adjustment: -0.55 },
  { value: 'Unknown', label: 'Unknown', adjustment: -0.1 },
]

export const REFURBISHED_OPTIONS = [
  { value: 'Yes', label: 'Yes', adjustment: 0.15 },
  { value: 'No', label: 'No', adjustment: 0 },
  { value: 'Unknown', label: 'Unknown', adjustment: -0.05 },
]

const STRONG_MATCH_SCORE = 80
const MIN_AGE_OBSERVATIONS = 6
const MIN_AGE_GROUP_OBSERVATIONS = 2

function getAdjustment(options, value) {
  return options.find((option) => option.value === value)?.adjustment ?? 0
}

function getSimpleAgeAdjustment(ageYears) {
  const age = Number(ageYears)
  if (!Number.isFinite(age) || age < 0) return 0
  if (age <= 3) return 0.2
  if (age <= 7) return 0.05
  if (age <= 12) return 0
  if (age <= 17) return -0.1
  return -0.25
}

/** RRP retention by age band when no market observations exist. */
function getRrpAgeRetention(ageYears) {
  const age = Number(ageYears)
  if (!Number.isFinite(age) || age < 0) return 0.35
  if (age <= 3) return 0.55
  if (age <= 7) return 0.42
  if (age <= 12) return 0.35
  if (age <= 17) return 0.28
  return 0.2
}

function roundMoney(value) {
  if (!Number.isFinite(value)) return null
  return Math.max(0, Math.round(value))
}

function buildRanges(adjustedValue) {
  const value = Number(adjustedValue)
  if (!Number.isFinite(value) || value <= 0) return null

  return {
    estimatedValueMin: roundMoney(value * 0.875),
    estimatedValueMax: roundMoney(value * 1.125),
    quickSaleMin: roundMoney(value * 0.7),
    quickSaleMax: roundMoney(value * 0.85),
    dealerResaleMin: roundMoney(value * 1.15),
    dealerResaleMax: roundMoney(value * 1.4),
    adjustedValue: roundMoney(value),
  }
}

function resolveConfidence(observationCount, usedFallback) {
  if (usedFallback || observationCount <= 0) return 'Very low'
  if (observationCount >= 20) return 'High'
  if (observationCount >= 6) return 'Medium'
  return 'Low'
}

function findAgeGroupAdjustment(observations, userAgeYears, overallMedian) {
  const ageGroups = groupObservationsByAge(observations)
  const agedObservationCount = ageGroups.reduce((sum, group) => sum + group.count, 0)

  if (agedObservationCount < MIN_AGE_OBSERVATIONS || !Number.isFinite(overallMedian) || overallMedian <= 0) {
    return {
      enoughAgeData: false,
      adjustment: getSimpleAgeAdjustment(userAgeYears),
      ageGroupAverage: null,
      matchedAgeYears: null,
    }
  }

  const userAge = Math.round(Number(userAgeYears))
  if (!Number.isFinite(userAge) || userAge < 0) {
    return {
      enoughAgeData: false,
      adjustment: 0,
      ageGroupAverage: null,
      matchedAgeYears: null,
    }
  }

  let bestGroup = null
  let bestDistance = Infinity

  for (const group of ageGroups) {
    if (group.count < MIN_AGE_GROUP_OBSERVATIONS || group.averagePrice == null) continue
    const distance = Math.abs(group.ageYears - userAge)
    if (distance < bestDistance) {
      bestDistance = distance
      bestGroup = group
    }
  }

  if (!bestGroup) {
    return {
      enoughAgeData: false,
      adjustment: getSimpleAgeAdjustment(userAgeYears),
      ageGroupAverage: null,
      matchedAgeYears: null,
    }
  }

  return {
    enoughAgeData: true,
    adjustment: bestGroup.averagePrice / overallMedian - 1,
    ageGroupAverage: bestGroup.averagePrice,
    matchedAgeYears: bestGroup.ageYears,
  }
}

/**
 * Score how well an equipment model matches a free-text query.
 */
export function scoreEquipmentModelMatch(model, query) {
  const normalizedQuery = query?.trim().toLowerCase()
  if (!normalizedQuery || !model) return 0

  const brand = (model.brand ?? '').toLowerCase()
  const modelName = (model.model ?? '').toLowerCase()
  const family = (model.model_family ?? '').toLowerCase()
  const category = (model.category ?? '').toLowerCase()
  const slug = (model.slug ?? '').toLowerCase()
  const displayName = `${brand} ${modelName}`.trim()

  if (slug === normalizedQuery) return 100
  if (displayName === normalizedQuery) return 95
  if (`${brand} ${modelName}` === normalizedQuery) return 95

  let score = 0

  if (slug.includes(normalizedQuery) || normalizedQuery.includes(slug)) score += 40
  if (displayName.includes(normalizedQuery)) score += 35
  if (brand === normalizedQuery) score += 30
  else if (brand.includes(normalizedQuery) || normalizedQuery.includes(brand)) score += 18
  if (modelName === normalizedQuery) score += 30
  else if (modelName.includes(normalizedQuery) || normalizedQuery.includes(modelName)) score += 20
  if (family && (family.includes(normalizedQuery) || normalizedQuery.includes(family))) score += 12
  if (category && (category.includes(normalizedQuery) || normalizedQuery.includes(category))) score += 8

  const tokens = normalizedQuery.split(/\s+/).filter(Boolean)
  if (tokens.length > 1) {
    const haystack = [brand, modelName, family, category, slug].join(' ')
    const matchedTokens = tokens.filter((token) => haystack.includes(token)).length
    score += Math.round((matchedTokens / tokens.length) * 20)
  }

  return Math.min(100, score)
}

export function searchEquipmentModels(models, query) {
  const normalizedQuery = query?.trim()
  if (!normalizedQuery) {
    return {
      matches: [],
      strongMatch: null,
      hasStrongSingleMatch: false,
    }
  }

  const matches = (models ?? [])
    .map((model) => ({
      model,
      score: scoreEquipmentModelMatch(model, normalizedQuery),
    }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score
      const leftName = `${left.model.brand} ${left.model.model}`
      const rightName = `${right.model.brand} ${right.model.model}`
      return leftName.localeCompare(rightName)
    })

  const strongMatches = matches.filter((entry) => entry.score >= STRONG_MATCH_SCORE)
  const strongMatch = strongMatches.length === 1 ? strongMatches[0].model : null

  return {
    matches: matches.map((entry) => entry.model),
    scoredMatches: matches,
    strongMatch,
    hasStrongSingleMatch: Boolean(strongMatch),
  }
}

/**
 * Calculate an instant valuation for a selected equipment model.
 *
 * Depreciation note: when equipment_intelligence rows are used, prefer
 * `baseline_manufacture_year` as the primary manufacture year for age-based
 * depreciation. See `getDepreciationManufactureYear()` in baselineManufactureYear.js.
 */
export function calculateValuation({
  model,
  observations = [],
  condition,
  ageYears,
  workingStatus,
  refurbished,
} = {}) {
  const summary = summarizeObservationPrices(observations)
  const observationCount = summary.count
  const cleanedMedian = summary.median

  let baseValue = null
  let usedFallback = false
  let baseSource = null
  let ageMeta = {
    enoughAgeData: false,
    adjustment: 0,
    ageGroupAverage: null,
    matchedAgeYears: null,
  }

  if (cleanedMedian != null && cleanedMedian > 0) {
    baseValue = cleanedMedian
    baseSource = 'observations'
    ageMeta = findAgeGroupAdjustment(observations, ageYears, cleanedMedian)
  } else {
    const rrp = Number(model?.estimated_original_rrp)
    if (Number.isFinite(rrp) && rrp > 0) {
      baseValue = rrp * getRrpAgeRetention(ageYears)
      usedFallback = true
      baseSource = 'rrp_fallback'
      ageMeta = {
        enoughAgeData: false,
        adjustment: 0,
        ageGroupAverage: null,
        matchedAgeYears: null,
      }
    }
  }

  if (baseValue == null || baseValue <= 0) {
    return {
      ok: false,
      reason: 'no_data',
      observationCount,
      usedFallback: true,
      confidence: 'Very low',
      baseValue: null,
      adjustedValue: null,
      ranges: null,
      adjustments: null,
    }
  }

  const conditionAdjustment = getAdjustment(VALUATION_CONDITIONS, condition)
  const workingAdjustment = getAdjustment(WORKING_STATUSES, workingStatus)
  const refurbishedAdjustment = getAdjustment(REFURBISHED_OPTIONS, refurbished)
  const ageAdjustment = usedFallback ? 0 : ageMeta.adjustment

  const totalAdjustment =
    1 + conditionAdjustment + workingAdjustment + refurbishedAdjustment + ageAdjustment

  const adjustedValue = baseValue * Math.max(totalAdjustment, 0.05)
  const ranges = buildRanges(adjustedValue)
  const confidence = resolveConfidence(observationCount, usedFallback)

  return {
    ok: true,
    reason: null,
    observationCount,
    usedFallback,
    baseSource,
    confidence,
    baseValue: roundMoney(baseValue),
    adjustedValue: ranges.adjustedValue,
    ranges,
    adjustments: {
      condition: conditionAdjustment,
      workingStatus: workingAdjustment,
      refurbished: refurbishedAdjustment,
      age: ageAdjustment,
      ageEnoughData: ageMeta.enoughAgeData,
      ageGroupAverage: ageMeta.ageGroupAverage,
      matchedAgeYears: ageMeta.matchedAgeYears,
      totalMultiplier: totalAdjustment,
    },
  }
}

export function formatConfidenceLabel(confidence) {
  return confidence ?? 'Very low'
}

export function formatPriceRange(min, max) {
  if (min == null && max == null) return '—'
  if (min == null) return formatMoneyOnly(max)
  if (max == null) return formatMoneyOnly(min)
  if (min === max) return formatMoneyOnly(min)
  return `${formatMoneyOnly(min)} – ${formatMoneyOnly(max)}`
}

function formatMoneyOnly(amount) {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Number(amount))
}
