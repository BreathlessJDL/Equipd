import { isManuallyVerifiedCanonicalProductLifecycle } from './equipmentCanonicalResearchApprove.js'
import {
  BASELINE_MANUFACTURE_YEAR_SOURCE,
  buildBaselineManufactureYearPatch,
  isProvisionalBaselineSource,
  shouldApplyBaselineManufactureYearUpdate,
} from './baselineManufactureYear.js'
import { isLifeFitnessBrand } from './intelligenceCoreProductGrouping.js'

export const LIFE_FITNESS_SERIES_BASELINE_SOURCE = BASELINE_MANUFACTURE_YEAR_SOURCE.LIFE_FITNESS_SERIES_DEFAULT

export const LIFE_FITNESS_SERIES_BASELINE_CONFIDENCE = 65

export const EQUIPMENT_PRODUCT_BASELINE_SOURCE = {
  MISSING: 'missing',
  SERIES_DEFAULT: 'series_default',
  PRODUCT_RESEARCH: 'product_research',
  MANUAL_ADMIN: 'manual_admin',
}

export const SERIES_BASELINE_SKIP_REASON = {
  NOT_LIFE_FITNESS: 'not_life_fitness',
  ALREADY_HAS_BASELINE: 'already_has_baseline',
  VERIFIED_LIFECYCLE: 'verified_lifecycle',
  NO_SERIES_MATCH: 'no_series_match',
  FAMILY_FILTER_MISMATCH: 'family_filter_mismatch',
}

export const SERIES_BASELINE_SKIP_REASON_LABELS = {
  [SERIES_BASELINE_SKIP_REASON.NOT_LIFE_FITNESS]: 'Not Life Fitness',
  [SERIES_BASELINE_SKIP_REASON.ALREADY_HAS_BASELINE]: 'Baseline already set',
  [SERIES_BASELINE_SKIP_REASON.VERIFIED_LIFECYCLE]: 'Verified lifecycle on product',
  [SERIES_BASELINE_SKIP_REASON.NO_SERIES_MATCH]: 'No matching series default',
  [SERIES_BASELINE_SKIP_REASON.FAMILY_FILTER_MISMATCH]: 'Family filter mismatch',
}

/**
 * Ordered most-specific first. Hammer variants before generic series defaults.
 */
export const LIFE_FITNESS_SERIES_BASELINE_RULES = [
  {
    seriesLabel: 'Hammer Strength Plate Loaded',
    year: 2010,
    matches(product) {
      const text = normalizeMatchText(productMatchText(product))
      return text.includes('hammer strength') && text.includes('plate loaded')
    },
  },
  {
    seriesLabel: 'Hammer Strength MTS',
    year: 2005,
    matches(product) {
      const text = normalizeMatchText(productMatchText(product))
      return text.includes('hammer strength') && /\bmts\b/.test(text) && !text.includes('plate loaded')
    },
  },
  {
    seriesLabel: 'Integrity Series',
    year: 2017,
    matches(product) {
      const family = normalizeMatchText(product?.product_family)
      const name = normalizeMatchText(product?.canonical_product_name)
      return family === 'integrity series' || name.includes('integrity series')
    },
  },
  {
    seriesLabel: 'Signature Series',
    year: 2008,
    matches(product) {
      const family = normalizeMatchText(product?.product_family)
      const name = normalizeMatchText(product?.canonical_product_name)
      return family.startsWith('signature') || /\bsignature\b/.test(name)
    },
  },
  {
    seriesLabel: 'Circuit Series',
    year: 2012,
    matches(product) {
      const text = normalizeMatchText(productMatchText(product))
      return text.includes('circuit series')
    },
  },
  {
    seriesLabel: 'Activate Series',
    year: 2016,
    matches(product) {
      const text = normalizeMatchText(productMatchText(product))
      return text.includes('activate series')
    },
  },
  {
    seriesLabel: 'Club Series+',
    year: 2020,
    matches(product) {
      const text = normalizeMatchText(productMatchText(product))
      return text.includes('club series+') || text.includes('club series +')
    },
  },
  {
    seriesLabel: 'Aspire Series',
    year: 2022,
    matches(product) {
      const text = normalizeMatchText(productMatchText(product))
      return text.includes('aspire series')
    },
  },
  {
    seriesLabel: 'Insignia',
    year: 2014,
    matches(product) {
      const family = normalizeMatchText(product?.product_family)
      const name = normalizeMatchText(product?.canonical_product_name)
      return family === 'insignia' || /\binsignia\b/.test(name)
    },
  },
  {
    seriesLabel: 'Optima',
    year: 2012,
    matches(product) {
      const family = normalizeMatchText(product?.product_family)
      const name = normalizeMatchText(product?.canonical_product_name)
      return family === 'optima' || /\boptima\b/.test(name)
    },
  },
  {
    seriesLabel: 'Pro1',
    year: 2010,
    matches(product) {
      const text = normalizeMatchText(productMatchText(product))
      return /\bpro1\b/.test(text) || text.includes('pro 1')
    },
  },
  {
    seriesLabel: 'Elevation',
    year: 2010,
    matches(product) {
      const family = normalizeMatchText(product?.product_family)
      const name = normalizeMatchText(product?.canonical_product_name)
      if (family === 'elevation series' || family.startsWith('elevation')) return true
      return /\belevation\b/.test(name) && !/\bdiscover\b/.test(name)
    },
  },
]

function normalizeMatchText(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim().toLowerCase()
}

function productMatchText(product) {
  return [
    product?.product_family,
    product?.canonical_product_name,
    product?.model,
    product?.brand,
  ].filter(Boolean).join(' ')
}

export function buildSeriesBaselineReviewNote(seriesLabel, year) {
  return `Baseline year populated from Life Fitness series default: ${seriesLabel} = ${year}.`
}

export function isSeriesDefaultBaselineNote(reviewNotes) {
  return /life fitness series default:/i.test(String(reviewNotes ?? ''))
}

export function isResearchApprovedBaselineNote(reviewNotes) {
  return /\[research_approved\b/i.test(String(reviewNotes ?? ''))
}

export function appendSeriesBaselineReviewNote(existingNotes, seriesLabel, year) {
  const note = buildSeriesBaselineReviewNote(seriesLabel, year)
  const text = String(existingNotes ?? '').trim()
  if (!text) return note
  if (text.includes(note)) return text
  if (isSeriesDefaultBaselineNote(text)) return text
  return `${text}\n${note}`
}

export function findLifeFitnessSeriesBaselineRule(product) {
  return LIFE_FITNESS_SERIES_BASELINE_RULES.find((rule) => rule.matches(product)) ?? null
}

function ruleMatchesFamilyFilter(rule, familyFilter) {
  const normalizedFilter = normalizeMatchText(familyFilter)
  const normalizedLabel = normalizeMatchText(rule.seriesLabel)
  return normalizedLabel === normalizedFilter
    || normalizedLabel.includes(normalizedFilter)
    || normalizedFilter.includes(normalizedLabel)
}

export function evaluateLifeFitnessSeriesBaselineProduct(product, { familyFilter = null } = {}) {
  if (!isLifeFitnessBrand(product?.brand)) {
    return { rule: null, skipReason: SERIES_BASELINE_SKIP_REASON.NOT_LIFE_FITNESS }
  }

  if (product?.baseline_manufacture_year != null) {
    return { rule: null, skipReason: SERIES_BASELINE_SKIP_REASON.ALREADY_HAS_BASELINE }
  }

  if (isManuallyVerifiedCanonicalProductLifecycle(product)) {
    return { rule: null, skipReason: SERIES_BASELINE_SKIP_REASON.VERIFIED_LIFECYCLE }
  }

  const rule = findLifeFitnessSeriesBaselineRule(product)
  if (!rule) {
    return { rule: null, skipReason: SERIES_BASELINE_SKIP_REASON.NO_SERIES_MATCH }
  }

  if (familyFilter && !ruleMatchesFamilyFilter(rule, familyFilter)) {
    return { rule: null, skipReason: SERIES_BASELINE_SKIP_REASON.FAMILY_FILTER_MISMATCH }
  }

  return { rule, skipReason: null }
}

export function canApplySeriesDefaultToIntelligenceRow(row) {
  if (!isLifeFitnessBrand(row?.brand)) return false
  if (row?.baseline_manufacture_year == null) return true

  const source = row.baseline_manufacture_year_source
  if (!source) return false
  if (source === LIFE_FITNESS_SERIES_BASELINE_SOURCE) return false
  if (!isProvisionalBaselineSource(source)) return false

  return shouldApplyBaselineManufactureYearUpdate(
    {
      year: row.baseline_manufacture_year,
      confidence: row.baseline_manufacture_year_confidence,
      source,
    },
    {
      year: row.baseline_manufacture_year,
      confidence: LIFE_FITNESS_SERIES_BASELINE_CONFIDENCE,
      source: LIFE_FITNESS_SERIES_BASELINE_SOURCE,
    },
  )
}

export function buildLifeFitnessSeriesBaselineProductUpdate(product, rule) {
  return {
    baseline_manufacture_year: rule.year,
    lifecycle_confidence: LIFE_FITNESS_SERIES_BASELINE_CONFIDENCE,
    review_notes: appendSeriesBaselineReviewNote(product?.review_notes, rule.seriesLabel, rule.year),
  }
}

export function buildLifeFitnessSeriesBaselineIntelligencePatch(year) {
  return buildBaselineManufactureYearPatch({
    year,
    confidence: LIFE_FITNESS_SERIES_BASELINE_CONFIDENCE,
    source: LIFE_FITNESS_SERIES_BASELINE_SOURCE,
  })
}

export function buildLifeFitnessSeriesBaselinePlan(
  products = [],
  intelligenceRowsById = new Map(),
  { familyFilter = null } = {},
) {
  const productApplications = []
  const intelligenceApplications = []
  const skipped = []
  const intelligenceTouched = new Set()

  for (const product of products) {
    const evaluation = evaluateLifeFitnessSeriesBaselineProduct(product, { familyFilter })
    if (!evaluation.rule) {
      if (evaluation.skipReason !== SERIES_BASELINE_SKIP_REASON.NOT_LIFE_FITNESS) {
        skipped.push({
          product,
          productName: product.canonical_product_name,
          currentBaseline: product.baseline_manufacture_year ?? null,
          proposedBaseline: null,
          matchedFamily: null,
          skipReason: evaluation.skipReason,
        })
      }
      continue
    }

    const { rule } = evaluation
    productApplications.push({
      product,
      productName: product.canonical_product_name,
      currentBaseline: product.baseline_manufacture_year ?? null,
      proposedBaseline: rule.year,
      matchedFamily: rule.seriesLabel,
      skipReason: null,
      update: buildLifeFitnessSeriesBaselineProductUpdate(product, rule),
    })

    for (const rowId of product.source_intelligence_row_ids ?? []) {
      if (intelligenceTouched.has(rowId)) continue
      const row = intelligenceRowsById.get(rowId)
      if (!row || !canApplySeriesDefaultToIntelligenceRow(row)) continue

      intelligenceTouched.add(rowId)
      intelligenceApplications.push({
        rowId,
        productId: product.id,
        productName: product.canonical_product_name,
        currentBaseline: row.baseline_manufacture_year ?? null,
        proposedBaseline: rule.year,
        matchedFamily: rule.seriesLabel,
        patch: buildLifeFitnessSeriesBaselineIntelligencePatch(rule.year),
      })
    }
  }

  return {
    productApplications,
    intelligenceApplications,
    skipped,
    summary: {
      productsEligible: productApplications.length,
      intelligenceRowsEligible: intelligenceApplications.length,
      skipped: skipped.length,
    },
  }
}

export function deriveEquipmentProductBaselineSource(product) {
  if (product?.baseline_manufacture_year == null) {
    return {
      type: EQUIPMENT_PRODUCT_BASELINE_SOURCE.MISSING,
      label: 'Missing',
    }
  }

  if (isSeriesDefaultBaselineNote(product?.review_notes)) {
    return {
      type: EQUIPMENT_PRODUCT_BASELINE_SOURCE.SERIES_DEFAULT,
      label: 'Series default',
    }
  }

  if (String(product?.baseline_source ?? '').toLowerCase() === 'manual_import') {
    return {
      type: EQUIPMENT_PRODUCT_BASELINE_SOURCE.MANUAL_ADMIN,
      label: 'Manual import',
    }
  }

  if (isResearchApprovedBaselineNote(product?.review_notes)) {
    return {
      type: EQUIPMENT_PRODUCT_BASELINE_SOURCE.PRODUCT_RESEARCH,
      label: 'Product research',
    }
  }

  if (isManuallyVerifiedCanonicalProductLifecycle(product)) {
    return {
      type: EQUIPMENT_PRODUCT_BASELINE_SOURCE.MANUAL_ADMIN,
      label: 'Manual/admin',
    }
  }

  return {
    type: EQUIPMENT_PRODUCT_BASELINE_SOURCE.MANUAL_ADMIN,
    label: 'Manual/admin',
  }
}

export function formatSeriesBaselineSkipReason(reason) {
  return SERIES_BASELINE_SKIP_REASON_LABELS[reason] ?? reason ?? '—'
}
