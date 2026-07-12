/**
 * Baseline manufacture year — primary lifecycle field for depreciation.
 * The valuation engine should use `baseline_manufacture_year` by default.
 */

export const BASELINE_MANUFACTURE_YEAR_SOURCE = {
  AI_RESEARCH_APPROVED: 'ai_research_approved',
  TECHNOGYM_TRADE_IN_MATRIX: 'technogym_trade_in_matrix_earliest_year',
  ADMIN_LIFECYCLE_SOURCE: 'admin_lifecycle_source',
  INHERITED_CANONICAL: 'inherited_canonical_baseline',
  MANUAL_IMPORT: 'manual_import',
}

export const PROVISIONAL_BASELINE_CONFIDENCE = 60

export const BASELINE_STATUS = {
  VERIFIED: 'verified',
  ESTIMATED: 'estimated',
  MISSING: 'missing',
}

export function slugModelFamilyKey(slug) {
  return String(slug ?? '').replace(/-\d{4}$/, '')
}

export function isTechnogymTradeInMatrixRow(row) {
  return String(row?.brand ?? '').trim().toLowerCase() === 'technogym'
    && row?.manufacture_year != null
    && /-\d{4}$/.test(String(row?.slug ?? ''))
}

export function isProvisionalBaselineSource(source) {
  return source === BASELINE_MANUFACTURE_YEAR_SOURCE.TECHNOGYM_TRADE_IN_MATRIX
    || source === BASELINE_MANUFACTURE_YEAR_SOURCE.LIFE_FITNESS_SERIES_DEFAULT
}

export function formatBaselineManufactureYearSource(source) {
  switch (source) {
    case BASELINE_MANUFACTURE_YEAR_SOURCE.AI_RESEARCH_APPROVED:
      return 'AI research (admin approved)'
    case BASELINE_MANUFACTURE_YEAR_SOURCE.TECHNOGYM_TRADE_IN_MATRIX:
      return 'Technogym trade-in matrix (earliest year, provisional)'
    case BASELINE_MANUFACTURE_YEAR_SOURCE.ADMIN_LIFECYCLE_SOURCE:
      return 'Admin lifecycle source'
    case BASELINE_MANUFACTURE_YEAR_SOURCE.INHERITED_CANONICAL:
      return 'Inherited from canonical row'
    case BASELINE_MANUFACTURE_YEAR_SOURCE.LIFE_FITNESS_SERIES_DEFAULT:
      return 'Life Fitness series default'
    case BASELINE_MANUFACTURE_YEAR_SOURCE.MANUAL_IMPORT:
      return 'Manual spreadsheet import'
    default:
      return source || '—'
  }
}

export function formatBaselineManufactureYearStatus(status) {
  if (status === BASELINE_STATUS.VERIFIED) return 'Verified'
  if (status === BASELINE_STATUS.ESTIMATED) return 'Estimated'
  return 'Missing'
}

/**
 * Status for admin UI:
 * - verified: admin-approved / researched baseline
 * - estimated: provisional Technogym trade-in earliest year
 * - missing: no baseline year
 */
export function deriveBaselineManufactureYearStatus(equipment) {
  if (equipment?.baseline_manufacture_year == null) {
    return BASELINE_STATUS.MISSING
  }

  if (isProvisionalBaselineSource(equipment?.baseline_manufacture_year_source)) {
    return BASELINE_STATUS.ESTIMATED
  }

  return BASELINE_STATUS.VERIFIED
}

/**
 * Depreciation should read this field first on equipment_intelligence rows.
 */
export function getDepreciationManufactureYear(equipment) {
  if (equipment?.baseline_manufacture_year != null) {
    return equipment.baseline_manufacture_year
  }

  if (equipment?.manufacture_start_year != null) {
    return equipment.manufacture_start_year
  }

  if (equipment?.manufacture_year != null) {
    return equipment.manufacture_year
  }

  return null
}

export function shouldApplyBaselineManufactureYearUpdate(current = {}, proposed = {}) {
  if (proposed.year == null) return false
  if (current.year == null) return true

  if (
    current.source
    && !isProvisionalBaselineSource(current.source)
    && isProvisionalBaselineSource(proposed.source)
  ) {
    return false
  }

  const currentConfidence = Number(current.confidence ?? 0)
  const proposedConfidence = Number(proposed.confidence ?? 0)
  if (proposedConfidence > currentConfidence) return true

  if (
    isProvisionalBaselineSource(current.source)
    && !isProvisionalBaselineSource(proposed.source)
  ) {
    return true
  }

  return false
}

export function buildBaselineManufactureYearPatch({
  year,
  confidence,
  source,
  updatedAt = new Date().toISOString(),
}) {
  if (year == null) return null

  return {
    baseline_manufacture_year: Math.trunc(Number(year)),
    baseline_manufacture_year_confidence: confidence != null
      ? Math.trunc(Number(confidence))
      : null,
    baseline_manufacture_year_source: source ?? null,
    baseline_manufacture_year_updated_at: updatedAt,
  }
}

export function buildResearchApprovedBaselineFields(recommendation, updatedAt = new Date().toISOString()) {
  const year = recommendation?.baseline_manufacture_year
    ?? recommendation?.production_start_year
    ?? recommendation?.production_end_year
  if (year == null) return null

  const confidence = Number(
    recommendation?.lifecycle_confidence
    ?? recommendation?.production_confidence
    ?? recommendation?.confidence,
  )

  return buildBaselineManufactureYearPatch({
    year,
    confidence: Number.isFinite(confidence) ? confidence : null,
    source: BASELINE_MANUFACTURE_YEAR_SOURCE.AI_RESEARCH_APPROVED,
    updatedAt,
  })
}

export function buildTechnogymProvisionalBaselinePlan(rows = []) {
  const families = new Map()

  for (const row of rows) {
    const familyKey = slugModelFamilyKey(row.slug)
    if (!familyKey) continue

    if (!families.has(familyKey)) {
      families.set(familyKey, {
        familyKey,
        rows: [],
        matrixRows: [],
        canonicalRows: [],
        earliestImportYear: null,
      })
    }

    const family = families.get(familyKey)
    family.rows.push(row)

    if (isTechnogymTradeInMatrixRow(row)) {
      family.matrixRows.push(row)
      if (
        family.earliestImportYear == null
        || row.manufacture_year < family.earliestImportYear
      ) {
        family.earliestImportYear = row.manufacture_year
      }
    } else {
      family.canonicalRows.push(row)
    }
  }

  const applications = []
  const inheritanceCandidates = []

  for (const family of families.values()) {
    const researchedCanonical = family.canonicalRows.find((row) => (
      row.baseline_manufacture_year != null
      && !isProvisionalBaselineSource(row.baseline_manufacture_year_source)
    ))

    if (researchedCanonical) {
      for (const row of family.rows) {
        if (
          row.id !== researchedCanonical.id
          && row.baseline_manufacture_year == null
        ) {
          inheritanceCandidates.push({
            row,
            inheritFrom: researchedCanonical,
            familyKey: family.familyKey,
          })
        }
      }
      continue
    }

    if (family.earliestImportYear == null) continue

    for (const row of family.rows) {
      const proposed = {
        year: family.earliestImportYear,
        confidence: PROVISIONAL_BASELINE_CONFIDENCE,
        source: BASELINE_MANUFACTURE_YEAR_SOURCE.TECHNOGYM_TRADE_IN_MATRIX,
      }
      const current = {
        year: row.baseline_manufacture_year,
        confidence: row.baseline_manufacture_year_confidence,
        source: row.baseline_manufacture_year_source,
      }

      if (shouldApplyBaselineManufactureYearUpdate(current, proposed)) {
        applications.push({
          row,
          familyKey: family.familyKey,
          earliestImportYear: family.earliestImportYear,
          proposed,
        })
      }
    }
  }

  return {
    families: [...families.values()],
    applications,
    inheritanceCandidates,
    familiesWithEarliestYear: [...families.values()].filter(
      (family) => family.earliestImportYear != null,
    ),
  }
}
