/**
 * Canonical equipment products: one row per physical machine/model.
 * Console descriptors are variants/modifiers, not product identity.
 */

import {
  buildCoreProductKeyFromFields,
  buildCoreProductName,
  deriveCoreProductFields,
  GROUPING_CONFIDENCE,
  KNOWN_BASE_MODEL_CODES,
} from './intelligenceCoreProductGrouping.js'
import { isValidCanonicalBaselineYear } from './equipmentResearchQueue.js'

export const PRODUCT_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  EXCLUDED: 'excluded',
  NEEDS_REVIEW: 'needs_review',
}

function normalizeWhitespace(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim()
}

function normalizeTokenKey(value) {
  return normalizeWhitespace(value).toLowerCase().replace(/[^a-z0-9]/g, '')
}

/**
 * Accept a valid four-digit catalogue year; otherwise null.
 * Used for verified baseline/start years and (opt-in only) generic manufacture_year.
 */
export function coerceCanonicalManufactureYear(value, now = new Date()) {
  if (value == null || value === '') return null
  const year = typeof value === 'number' ? value : Number(String(value).trim())
  if (!Number.isInteger(year)) return null
  if (!isValidCanonicalBaselineYear(year, now)) return null
  return year
}

/**
 * Resolve an earliest-release / baseline year from an intelligence row.
 *
 * Semantics:
 * - baseline_manufacture_year / manufacture_start_year = explicit verified earliest year
 * - manufacture_year = generation / observed / pricing-associated year (NOT a baseline by default)
 *
 * Automatic CSV promotion must keep allowManufactureYearAsBaseline=false.
 */
export function resolveCanonicalBaselineYear(row, {
  allowManufactureYearAsBaseline = false,
  now = new Date(),
} = {}) {
  const fromExplicitBaseline = coerceCanonicalManufactureYear(row?.baseline_manufacture_year, now)
  if (fromExplicitBaseline != null) return fromExplicitBaseline

  const fromStart = coerceCanonicalManufactureYear(row?.manufacture_start_year, now)
  if (fromStart != null) return fromStart

  if (allowManufactureYearAsBaseline) {
    return coerceCanonicalManufactureYear(row?.manufacture_year, now)
  }

  return null
}

export function resolveCanonicalProductionStartYear(row, {
  allowManufactureYearAsBaseline = false,
  now = new Date(),
} = {}) {
  const fromStart = coerceCanonicalManufactureYear(row?.manufacture_start_year, now)
  if (fromStart != null) return fromStart

  return resolveCanonicalBaselineYear(row, { allowManufactureYearAsBaseline, now })
}

export function pickEarliestCanonicalYear(...years) {
  const valid = years
    .map((year) => coerceCanonicalManufactureYear(year))
    .filter((year) => year != null)
  if (!valid.length) return null
  return Math.min(...valid)
}

export function hasVerifiedCanonicalBaselineYear(row, now = new Date()) {
  return resolveCanonicalBaselineYear(row, {
    allowManufactureYearAsBaseline: false,
    now,
  }) != null
}

export function summariseSourceYearFields(rows = []) {
  let withManufactureYear = 0
  let withVerifiedBaseline = 0
  let withNeither = 0

  for (const row of rows) {
    const hasManufacture = coerceCanonicalManufactureYear(row?.manufacture_year
      ?? row?.normalised?.manufacture_year) != null
    const hasVerified = hasVerifiedCanonicalBaselineYear(row?.normalised ?? row)
    if (hasManufacture) withManufactureYear += 1
    if (hasVerified) withVerifiedBaseline += 1
    if (!hasManufacture && !hasVerified) withNeither += 1
  }

  return {
    totalRows: rows.length,
    withManufactureYear,
    withVerifiedBaseline,
    withoutVerifiedBaseline: Math.max(0, rows.length - withVerifiedBaseline),
    withNeither,
  }
}

function isDistinctHardwareModel(modelA, modelB) {
  const keyA = normalizeTokenKey(modelA)
  const keyB = normalizeTokenKey(modelB)
  if (!keyA || !keyB || keyA === keyB) return false

  // 95Ti vs 95Te, T3 vs T5, etc.
  if (KNOWN_BASE_MODEL_CODES.some((code) => {
    const k = code.replace(/\s+/g, '')
    return (keyA === k || keyB === k) && keyA !== keyB
  })) {
    return true
  }

  // Single-token model codes that differ by trailing letter/digit
  if (/^[a-z0-9]{2,6}$/i.test(keyA) && /^[a-z0-9]{2,6}$/i.test(keyB)) {
    const sharedPrefix = keyA.slice(0, Math.min(keyA.length, keyB.length) - 1)
    if (sharedPrefix.length >= 2 && keyA.startsWith(sharedPrefix) && keyB.startsWith(sharedPrefix)) {
      return true
    }
  }

  return false
}

export function deriveCanonicalProductFields(row, { technogymGroupingEnabled = true } = {}) {
  const derived = deriveCoreProductFields(row, { technogymGroupingEnabled })
  const canonicalProductKey = derived.core_product_key
  const canonicalProductName = derived.core_product_name
  const strippedModel = derived.core_model
  const productFamily = row?.product_family ?? derived.product_family
  const detectedConsole = derived.variant_name ?? null

  let status = PRODUCT_STATUS.PENDING
  let needsReview = false
  const reviewReasons = []

  if (!canonicalProductKey || !strippedModel) {
    needsReview = true
    reviewReasons.push('missing canonical identity')
  }

  if (derived.core_product_group_confidence < GROUPING_CONFIDENCE.HIGH) {
    needsReview = true
    reviewReasons.push('medium-confidence grouping')
  }

  if (detectedConsole && normalizeTokenKey(detectedConsole) === normalizeTokenKey(strippedModel)) {
    needsReview = true
    reviewReasons.push('console term may be part of model identity')
  }

  const sourceConfidence = normalizeWhitespace(row?.confidence).toLowerCase()
  if (sourceConfidence === 'low') {
    needsReview = true
    reviewReasons.push('low source confidence')
  }

  if (needsReview) {
    status = PRODUCT_STATUS.NEEDS_REVIEW
  }

  return {
    brand: row.brand,
    product_family: productFamily,
    model: strippedModel,
    equipment_type: row.equipment_type ?? null,
    canonical_product_name: canonicalProductName,
    canonical_product_key: canonicalProductKey,
    detected_console: detectedConsole,
    lifecycle_note: derived.lifecycle_note ?? null,
    variant_type: derived.variant_type,
    grouping_confidence: derived.core_product_group_confidence,
    status,
    review_reasons: reviewReasons,
    source_row_id: row.id,
    original_series: row.series ?? null,
    original_model: row.model ?? null,
  }
}

export function buildCanonicalProductsFromRows(rows = [], {
  technogymGroupingEnabled = true,
  allowManufactureYearAsBaseline = false,
} = {}) {
  const productMap = new Map()
  const yearOptions = { allowManufactureYearAsBaseline }

  for (const row of rows) {
    const fields = deriveCanonicalProductFields(row, { technogymGroupingEnabled })
    if (!fields.canonical_product_key) continue

    const member = {
      intelligence_row_id: row.id,
      slug: row.slug,
      brand: row.brand,
      series: row.series,
      model: row.model,
      equipment_type: row.equipment_type,
      detected_console: fields.detected_console,
      lifecycle_note: fields.lifecycle_note,
      baseline_manufacture_year: resolveCanonicalBaselineYear(row, yearOptions),
      manufacture_start_year: row.manufacture_start_year ?? null,
      manufacture_end_year: row.manufacture_end_year ?? null,
      original_rrp: row.original_rrp ?? null,
      best_original_price: row.best_original_price ?? null,
      best_original_price_confidence: row.best_original_price_confidence ?? null,
      currency: row.currency ?? row.best_original_price_currency ?? null,
      grouping_confidence: fields.grouping_confidence,
      status_hint: fields.status,
      review_reasons: fields.review_reasons,
    }

    const existing = productMap.get(fields.canonical_product_key)
    if (!existing) {
      const baselineYear = resolveCanonicalBaselineYear(row, yearOptions)
      const productionStart = resolveCanonicalProductionStartYear(row, yearOptions)
      productMap.set(fields.canonical_product_key, {
        brand: fields.brand,
        product_family: fields.product_family,
        model: fields.model,
        equipment_type: fields.equipment_type,
        canonical_product_name: fields.canonical_product_name,
        canonical_product_key: fields.canonical_product_key,
        status: fields.status,
        review_reasons: [...fields.review_reasons],
        source_intelligence_row_ids: [row.id],
        source_rows: [member],
        detected_consoles: fields.detected_console ? [fields.detected_console] : [],
        lifecycle_notes: fields.lifecycle_note ? [fields.lifecycle_note] : [],
        baseline_manufacture_year: baselineYear,
        production_start_year: productionStart,
        production_end_year: coerceCanonicalManufactureYear(row.manufacture_end_year) ?? null,
        original_base_price: row.best_original_price ?? row.original_rrp ?? null,
        original_base_price_currency: row.best_original_price_currency ?? row.currency ?? 'GBP',
        original_price_confidence: row.best_original_price_confidence ?? null,
      })
      continue
    }

    existing.source_intelligence_row_ids.push(row.id)
    existing.source_rows.push(member)

    if (fields.detected_console && !existing.detected_consoles.includes(fields.detected_console)) {
      existing.detected_consoles.push(fields.detected_console)
    }

    if (fields.lifecycle_note && !existing.lifecycle_notes.includes(fields.lifecycle_note)) {
      existing.lifecycle_notes.push(fields.lifecycle_note)
    }

    for (const reason of fields.review_reasons) {
      if (!existing.review_reasons.includes(reason)) {
        existing.review_reasons.push(reason)
      }
    }

    if (fields.status === PRODUCT_STATUS.NEEDS_REVIEW) {
      existing.status = PRODUCT_STATUS.NEEDS_REVIEW
    }

    const nextBaseline = resolveCanonicalBaselineYear(row, yearOptions)
    existing.baseline_manufacture_year = pickEarliestCanonicalYear(
      existing.baseline_manufacture_year,
      nextBaseline,
    )

    const nextStart = resolveCanonicalProductionStartYear(row, yearOptions)
    existing.production_start_year = pickEarliestCanonicalYear(
      existing.production_start_year,
      nextStart,
    )

    if (!existing.production_end_year && row.manufacture_end_year) {
      existing.production_end_year = coerceCanonicalManufactureYear(row.manufacture_end_year)
        ?? row.manufacture_end_year
    }

    const candidatePrice = row.best_original_price ?? row.original_rrp
    const candidateConfidence = Number(row.best_original_price_confidence ?? 0)
    const existingConfidence = Number(existing.original_price_confidence ?? 0)
    if (candidatePrice && candidateConfidence >= existingConfidence) {
      existing.original_base_price = candidatePrice
      existing.original_price_confidence = candidateConfidence || null
      existing.original_base_price_currency = row.best_original_price_currency ?? row.currency ?? 'GBP'
    }
  }

  const products = [...productMap.values()].map((product) => ({
    ...product,
    source_row_count: product.source_rows.length,
    duplicate_rows_collapsed: Math.max(0, product.source_rows.length - 1),
  }))

  products.sort((left, right) => (
    right.source_row_count - left.source_row_count
    || String(left.canonical_product_name).localeCompare(String(right.canonical_product_name))
  ))

  return products
}

export function buildCanonicalProductAuditReport(
  rows = [],
  {
    brandFilter = null,
    technogymGroupingEnabled = true,
    allowManufactureYearAsBaseline = false,
  } = {},
) {
  const filteredRows = brandFilter
    ? rows.filter((row) => normalizeWhitespace(row.brand).toLowerCase() === brandFilter.toLowerCase())
    : rows

  const products = buildCanonicalProductsFromRows(filteredRows, {
    technogymGroupingEnabled,
    allowManufactureYearAsBaseline,
  })
  const needsReview = products.filter((product) => product.status === PRODUCT_STATUS.NEEDS_REVIEW)
  const collapsedRows = products.reduce((sum, product) => sum + product.duplicate_rows_collapsed, 0)

  const examplesByBrand = {}
  for (const product of products) {
    if (!examplesByBrand[product.brand]) {
      examplesByBrand[product.brand] = []
    }
    if (examplesByBrand[product.brand].length < 5) {
      examplesByBrand[product.brand].push({
        canonical_product_name: product.canonical_product_name,
        source_row_count: product.source_row_count,
        detected_consoles: product.detected_consoles,
        status: product.status,
        source_models: product.source_rows.map((row) => row.model),
      })
    }
  }

  return {
    total_intelligence_rows: filteredRows.length,
    suggested_canonical_products: products.length,
    duplicate_rows_collapsed: collapsedRows,
    products_needing_review: needsReview.length,
    products,
    needs_review: needsReview,
    examples_by_brand: examplesByBrand,
  }
}

export function buildCanonicalProductAuditPayload(product) {
  return {
    canonical_product_key: product.canonical_product_key,
    brand: product.brand,
    product_family: product.product_family,
    model: product.model,
    equipment_type: product.equipment_type,
    canonical_product_name: product.canonical_product_name,
    source_intelligence_row_ids: product.source_intelligence_row_ids,
    status: product.status,
    baseline_manufacture_year: product.baseline_manufacture_year,
    production_start_year: product.production_start_year,
    production_end_year: product.production_end_year,
    original_base_price: product.original_base_price,
    original_base_price_currency: product.original_base_price_currency ?? 'GBP',
    original_price_confidence: product.original_price_confidence,
    lifecycle_confidence: null,
    review_notes: product.review_reasons?.length
      ? product.review_reasons.join('; ')
      : null,
  }
}

export function isSafeForBulkApprove(product) {
  return product?.status === PRODUCT_STATUS.PENDING
}

export const REVIEW_REASON_LABELS = {
  'missing canonical identity': 'Missing canonical identity',
  'medium-confidence grouping': 'Medium-confidence grouping',
  'console term may be part of model identity': 'Console in model identity',
}

const GENERIC_MODEL_TOKENS = new Set([
  'treadmill',
  'bike',
  'uprightbike',
  'recumbentbike',
  'crosstrainer',
  'elliptical',
  'stepper',
  'rower',
  'climber',
  'spinbike',
])

export function parseProductReviewReasons(product) {
  const notes = normalizeWhitespace(product?.review_notes)
  if (!notes) return []
  return notes
    .split(';')
    .map((part) => normalizeWhitespace(part))
    .filter(Boolean)
}

export function getProductReviewReasons(product, sourceRow = null) {
  const fromNotes = parseProductReviewReasons(product)
  if (fromNotes.length) return fromNotes
  if (!sourceRow) return []
  return deriveCanonicalProductFields(sourceRow).review_reasons ?? []
}

export function formatProductReviewReasons(reasons = []) {
  return reasons.map((reason) => REVIEW_REASON_LABELS[reason] ?? reason)
}

export function isOnlyLowGroupingConfidenceReview(reasons = []) {
  if (!reasons.length) return false
  return reasons.every((reason) => reason === 'medium-confidence grouping')
}

export function isWeakProductModel(product) {
  const model = normalizeWhitespace(product?.model)
  if (!model) return true

  const key = normalizeTokenKey(model)
  if (!key || key.length < 2) return true
  if (GENERIC_MODEL_TOKENS.has(key)) return true
  if (product?.equipment_type && key === normalizeTokenKey(product.equipment_type)) return true
  return false
}

export function isBlockedSourceRow(row) {
  return row?.core_product_group_status === 'not_duplicate'
    || row?.core_product_group_status === 'excluded'
}

export function evaluateSingleSourceApproval(product, sourceRows = []) {
  const blockers = []
  const sourceIds = product?.source_intelligence_row_ids ?? []
  const sourceRow = sourceRows[0] ?? null
  const reviewReasons = getProductReviewReasons(product, sourceRow)

  if (sourceIds.length !== 1) {
    return {
      eligible: false,
      blockers: ['not_single_source'],
      reviewReasons,
      isSingleSourceNeedsReviewSafe: false,
    }
  }

  if (product?.status === PRODUCT_STATUS.EXCLUDED) {
    blockers.push('excluded')
  } else if (product?.status === PRODUCT_STATUS.APPROVED) {
    blockers.push('already_approved')
  } else if (![PRODUCT_STATUS.PENDING, PRODUCT_STATUS.NEEDS_REVIEW].includes(product?.status)) {
    blockers.push('ineligible_status')
  }

  if (isManuallyBlockedProduct(product)) blockers.push('manually_blocked')
  if (!normalizeWhitespace(product?.brand)) blockers.push('missing_brand')
  if (!normalizeWhitespace(product?.equipment_type)) blockers.push('missing_equipment_type')
  if (isWeakProductModel(product)) blockers.push('weak_model')

  if (!sourceRow) {
    blockers.push('missing_source_row')
  } else {
    if (isBlockedSourceRow(sourceRow)) blockers.push('blocked_source_row')
    if (product?.brand && sourceRow.brand
      && normalizeTokenKey(product.brand) !== normalizeTokenKey(sourceRow.brand)) {
      blockers.push('brand_conflict')
    }
    if (product?.equipment_type && sourceRow.equipment_type
      && normalizeTokenKey(product.equipment_type) !== normalizeTokenKey(sourceRow.equipment_type)) {
      blockers.push('equipment_type_conflict')
    }
  }

  if (product?.status === PRODUCT_STATUS.NEEDS_REVIEW
    && !isOnlyLowGroupingConfidenceReview(reviewReasons)) {
    blockers.push('unsafe_review_reason')
  }

  return {
    eligible: blockers.length === 0,
    blockers,
    reviewReasons,
    isSingleSourceNeedsReviewSafe: product?.status === PRODUCT_STATUS.NEEDS_REVIEW
      && blockers.length === 0,
  }
}

export function getDetectedConsoleFromRow(row) {
  if (row?.variant_name) return normalizeWhitespace(row.variant_name)
  return deriveCanonicalProductFields(row).detected_console ?? null
}

/**
 * Safe approval candidates:
 * - single source row when identity/blocker checks pass (pending or needs_review with only low-confidence reason)
 * - multiple rows differing only by console variant (pending only)
 */
export function isSafeApprovalCandidate(product, sourceRows = []) {
  if (!product) return false
  if (product.status === PRODUCT_STATUS.EXCLUDED || product.status === PRODUCT_STATUS.APPROVED) {
    return false
  }

  const sourceIds = product.source_intelligence_row_ids ?? []
  if (!sourceIds.length) return false

  if (sourceIds.length === 1) {
    return evaluateSingleSourceApproval(product, sourceRows).eligible
  }

  if (product.status !== PRODUCT_STATUS.PENDING) return false
  if (sourceRows.length !== sourceIds.length) return false

  const canonicalModels = new Set()
  const families = new Set()
  const equipmentTypes = new Set()
  const consoles = []

  for (const row of sourceRows) {
    const derived = deriveCanonicalProductFields(row)
    canonicalModels.add(normalizeTokenKey(derived.model))
    families.add(normalizeTokenKey(row.product_family ?? product.product_family ?? ''))
    equipmentTypes.add(normalizeTokenKey(row.equipment_type ?? product.equipment_type ?? ''))
    consoles.push(getDetectedConsoleFromRow(row))
  }

  if (canonicalModels.size > 1 || families.size > 1 || equipmentTypes.size > 1) {
    return false
  }

  const rowsWithConsole = consoles.filter(Boolean).length
  if (rowsWithConsole === 0) return false

  const distinctConsoles = new Set(consoles.map((value) => normalizeTokenKey(value)))
  return distinctConsoles.size >= 1 && rowsWithConsole >= 1
}

export function buildSafeApprovalCandidateIds(products = [], intelligenceRowsById = new Map()) {
  const safeIds = []

  for (const product of products) {
    if (![PRODUCT_STATUS.PENDING, PRODUCT_STATUS.NEEDS_REVIEW].includes(product.status)) continue

    const sourceIds = product.source_intelligence_row_ids ?? []
    if (!sourceIds.length) continue

    const sourceRows = sourceIds
      .map((id) => intelligenceRowsById.get(id))
      .filter(Boolean)

    if (isSafeApprovalCandidate(product, sourceRows)) {
      safeIds.push(product.id)
    }
  }

  return safeIds
}

export function buildSingleSourceNeedsReviewCandidateIds(
  products = [],
  intelligenceRowsById = new Map(),
) {
  const ids = []

  for (const product of products) {
    if (product.status !== PRODUCT_STATUS.NEEDS_REVIEW) continue
    const sourceRows = (product.source_intelligence_row_ids ?? [])
      .map((id) => intelligenceRowsById.get(id))
      .filter(Boolean)
    const evaluation = evaluateSingleSourceApproval(product, sourceRows)
    if (evaluation.isSingleSourceNeedsReviewSafe) {
      ids.push(product.id)
    }
  }

  return ids
}

export function buildProductReviewMetadata(
  products = [],
  intelligenceRowsById = new Map(),
) {
  const reviewReasonsByProductId = {}

  for (const product of products) {
    const sourceRows = (product.source_intelligence_row_ids ?? [])
      .map((id) => intelligenceRowsById.get(id))
      .filter(Boolean)
    const reviewReasons = getProductReviewReasons(product, sourceRows[0] ?? null)
    const singleSourceEvaluation = (product.source_intelligence_row_ids?.length ?? 0) === 1
      ? evaluateSingleSourceApproval(product, sourceRows)
      : null

    reviewReasonsByProductId[product.id] = {
      reviewReasons,
      reviewReasonLabels: formatProductReviewReasons(reviewReasons),
      isSafeCandidate: isSafeApprovalCandidate(product, sourceRows),
      isSingleSourceNeedsReviewSafe: singleSourceEvaluation?.isSingleSourceNeedsReviewSafe ?? false,
      blockers: singleSourceEvaluation?.blockers ?? [],
    }
  }

  return reviewReasonsByProductId
}

export const HIGH_CONFIDENCE_SKIP_REASONS = {
  ALREADY_APPROVED: 'already_approved',
  EXCLUDED: 'excluded',
  INELIGIBLE_STATUS: 'ineligible_status',
  BELOW_MIN_SCORE: 'below_min_score',
  MANUALLY_BLOCKED: 'manually_blocked',
  NOT_DUPLICATE_SOURCE: 'not_duplicate_source',
  CONFLICTING_SOURCE_IDENTITY: 'conflicting_source_identity',
  MISSING_SOURCE_ROWS: 'missing_source_rows',
}

export const HIGH_CONFIDENCE_SKIP_REASON_LABELS = {
  [HIGH_CONFIDENCE_SKIP_REASONS.ALREADY_APPROVED]: 'Already approved',
  [HIGH_CONFIDENCE_SKIP_REASONS.EXCLUDED]: 'Excluded',
  [HIGH_CONFIDENCE_SKIP_REASONS.INELIGIBLE_STATUS]: 'Ineligible status',
  [HIGH_CONFIDENCE_SKIP_REASONS.BELOW_MIN_SCORE]: 'Grouping score below threshold',
  [HIGH_CONFIDENCE_SKIP_REASONS.MANUALLY_BLOCKED]: 'Manually blocked',
  [HIGH_CONFIDENCE_SKIP_REASONS.NOT_DUPLICATE_SOURCE]: 'Source row marked not duplicate',
  [HIGH_CONFIDENCE_SKIP_REASONS.CONFLICTING_SOURCE_IDENTITY]: 'Conflicting brand or equipment type in sources',
  [HIGH_CONFIDENCE_SKIP_REASONS.MISSING_SOURCE_ROWS]: 'Missing linked source rows',
}

const ELIGIBLE_HIGH_CONFIDENCE_STATUSES = new Set([
  PRODUCT_STATUS.PENDING,
  PRODUCT_STATUS.NEEDS_REVIEW,
])

export function isManuallyBlockedProduct(product) {
  const notes = normalizeWhitespace(product?.review_notes).toLowerCase()
  if (!notes) return false
  return notes.startsWith('[blocked]')
    || notes.startsWith('blocked:')
    || notes.includes('do not approve')
    || notes.includes('manual block')
}

export function deriveRowGroupingScore(row) {
  const derived = deriveCanonicalProductFields(row)
  const stored = Number(row?.core_product_group_confidence)
  const derivedScore = Number(derived.grouping_confidence)
  if (Number.isFinite(stored) && Number.isFinite(derivedScore)) {
    return Math.min(stored, derivedScore)
  }
  if (Number.isFinite(stored)) return stored
  if (Number.isFinite(derivedScore)) return derivedScore
  return 0
}

export function deriveProductGroupingScore(product, sourceRows = []) {
  if (!sourceRows.length) return 0
  return Math.min(...sourceRows.map((row) => deriveRowGroupingScore(row)))
}

export function hasConflictingSourceIdentity(product, sourceRows = []) {
  if (!sourceRows.length) return false

  const brands = new Set(
    sourceRows.map((row) => normalizeTokenKey(row.brand ?? product.brand)),
  )
  const equipmentTypes = new Set(
    sourceRows
      .map((row) => normalizeTokenKey(row.equipment_type ?? product.equipment_type ?? ''))
      .filter(Boolean),
  )

  if (brands.size > 1) return true
  if (equipmentTypes.size > 1) return true
  return false
}

export function hasNotDuplicateSourceRow(sourceRows = []) {
  return sourceRows.some((row) => row.core_product_group_status === 'not_duplicate')
}

export function evaluateHighConfidenceApproval(
  product,
  sourceRows = [],
  { minScore = 90 } = {},
) {
  const reasons = []
  const sourceIds = product?.source_intelligence_row_ids ?? []

  if (product?.status === PRODUCT_STATUS.APPROVED) {
    reasons.push(HIGH_CONFIDENCE_SKIP_REASONS.ALREADY_APPROVED)
  } else if (product?.status === PRODUCT_STATUS.EXCLUDED) {
    reasons.push(HIGH_CONFIDENCE_SKIP_REASONS.EXCLUDED)
  } else if (!ELIGIBLE_HIGH_CONFIDENCE_STATUSES.has(product?.status)) {
    reasons.push(HIGH_CONFIDENCE_SKIP_REASONS.INELIGIBLE_STATUS)
  }
  if (isManuallyBlockedProduct(product)) {
    reasons.push(HIGH_CONFIDENCE_SKIP_REASONS.MANUALLY_BLOCKED)
  }
  if (!sourceIds.length || sourceRows.length !== sourceIds.length) {
    reasons.push(HIGH_CONFIDENCE_SKIP_REASONS.MISSING_SOURCE_ROWS)
  }
  if (sourceRows.length && hasNotDuplicateSourceRow(sourceRows)) {
    reasons.push(HIGH_CONFIDENCE_SKIP_REASONS.NOT_DUPLICATE_SOURCE)
  }
  if (sourceRows.length && hasConflictingSourceIdentity(product, sourceRows)) {
    reasons.push(HIGH_CONFIDENCE_SKIP_REASONS.CONFLICTING_SOURCE_IDENTITY)
  }

  const groupingScore = deriveProductGroupingScore(product, sourceRows)
  if (groupingScore < minScore) {
    reasons.push(HIGH_CONFIDENCE_SKIP_REASONS.BELOW_MIN_SCORE)
  }

  return {
    eligible: reasons.length === 0,
    reasons,
    groupingScore,
  }
}

export function buildHighConfidenceApprovalEvaluation(
  products = [],
  intelligenceRowsById = new Map(),
  { minScore = 90 } = {},
) {
  const eligible = []
  const skipped = []
  const skippedByReason = {}

  function recordSkip(reason) {
    skippedByReason[reason] = (skippedByReason[reason] ?? 0) + 1
  }

  for (const product of products) {
    const sourceRows = (product.source_intelligence_row_ids ?? [])
      .map((id) => intelligenceRowsById.get(id))
      .filter(Boolean)

    const evaluation = evaluateHighConfidenceApproval(product, sourceRows, { minScore })
    if (evaluation.eligible) {
      eligible.push({
        ...product,
        groupingScore: evaluation.groupingScore,
      })
      continue
    }

    for (const reason of evaluation.reasons) {
      recordSkip(reason)
    }

    skipped.push({
      product,
      reasons: evaluation.reasons,
      groupingScore: evaluation.groupingScore,
    })
  }

  return {
    eligible,
    eligibleIds: eligible.map((product) => product.id),
    eligibleIdSet: new Set(eligible.map((product) => product.id)),
    skipped,
    summary: {
      eligibleCount: eligible.length,
      pendingCount: eligible.filter((product) => product.status === PRODUCT_STATUS.PENDING).length,
      needsReviewCount: eligible.filter((product) => product.status === PRODUCT_STATUS.NEEDS_REVIEW).length,
      skippedCount: skipped.length,
      skippedByReason,
    },
  }
}

export function summarizeSkippedReasons(skippedByReason = {}) {
  return Object.entries(skippedByReason)
    .sort((left, right) => right[1] - left[1])
    .map(([reason, count]) => ({
      reason,
      label: HIGH_CONFIDENCE_SKIP_REASON_LABELS[reason] ?? reason,
      count,
    }))
}

function pickCanonicalProductKeeper(products = [], idealProduct = null) {
  const sorted = [...products].sort((left, right) => {
    if (left.status === PRODUCT_STATUS.APPROVED && right.status !== PRODUCT_STATUS.APPROVED) return -1
    if (right.status === PRODUCT_STATUS.APPROVED && left.status !== PRODUCT_STATUS.APPROVED) return 1
    const leftSources = left.source_intelligence_row_ids?.length ?? 0
    const rightSources = right.source_intelligence_row_ids?.length ?? 0
    if (leftSources !== rightSources) return rightSources - leftSources
    if (idealProduct?.canonical_product_name) {
      const leftExact = left.canonical_product_name === idealProduct.canonical_product_name ? 1 : 0
      const rightExact = right.canonical_product_name === idealProduct.canonical_product_name ? 1 : 0
      if (leftExact !== rightExact) return rightExact - leftExact
    }
    const leftHasDateMarker = /\(\s*\d{2,4}/.test(left.canonical_product_name ?? '') ? 1 : 0
    const rightHasDateMarker = /\(\s*\d{2,4}/.test(right.canonical_product_name ?? '') ? 1 : 0
    if (leftHasDateMarker !== rightHasDateMarker) return leftHasDateMarker - rightHasDateMarker
    return String(left.canonical_product_name).length - String(right.canonical_product_name).length
  })
  return sorted[0]
}

export function coalesceMergedCanonicalProductFields(keeper, duplicates = [], idealProduct = null) {
  const candidates = [keeper, ...duplicates]
  const withPrice = candidates
    .filter((product) => product.original_base_price != null)
    .sort((left, right) => Number(right.original_price_confidence ?? 0) - Number(left.original_price_confidence ?? 0))

  const priced = withPrice[0] ?? keeper
  const reviewNotes = [
    keeper.review_notes,
    ...duplicates.map((product) => product.review_notes),
  ].filter(Boolean).join(' | ') || keeper.review_notes

  return {
    canonical_product_name: idealProduct?.canonical_product_name ?? keeper.canonical_product_name,
    canonical_product_key: idealProduct?.canonical_product_key ?? keeper.canonical_product_key,
    product_family: idealProduct?.product_family ?? keeper.product_family,
    model: idealProduct?.model ?? keeper.model,
    equipment_type: idealProduct?.equipment_type ?? keeper.equipment_type,
    original_base_price: priced.original_base_price ?? keeper.original_base_price,
    original_base_price_currency: priced.original_base_price_currency ?? keeper.original_base_price_currency,
    original_price_confidence: priced.original_price_confidence ?? keeper.original_price_confidence,
    original_price_source: priced.original_price_source ?? keeper.original_price_source,
    baseline_manufacture_year: keeper.baseline_manufacture_year
      ?? duplicates.find((product) => product.baseline_manufacture_year)?.baseline_manufacture_year
      ?? null,
    production_start_year: keeper.production_start_year
      ?? duplicates.find((product) => product.production_start_year)?.production_start_year
      ?? null,
    production_end_year: keeper.production_end_year
      ?? duplicates.find((product) => product.production_end_year)?.production_end_year
      ?? null,
    review_notes: reviewNotes,
  }
}

export function buildConsoleDuplicateRepairPlan(
  products = [],
  intelligenceRows = [],
) {
  const intelligenceRowsById = new Map(intelligenceRows.map((row) => [row.id, row]))
  const idealProducts = buildCanonicalProductsFromRows(intelligenceRows)
  const rowToIdealKey = new Map()

  for (const ideal of idealProducts) {
    for (const rowId of ideal.source_intelligence_row_ids ?? []) {
      rowToIdealKey.set(rowId, ideal.canonical_product_key)
    }
  }

  const clusters = new Map()
  const ambiguous = []

  for (const product of products) {
    if (product.status === PRODUCT_STATUS.EXCLUDED) continue

    const idealKeys = new Set(
      (product.source_intelligence_row_ids ?? [])
        .map((rowId) => rowToIdealKey.get(rowId))
        .filter(Boolean),
    )

    if (idealKeys.size === 0) continue
    if (idealKeys.size > 1) {
      ambiguous.push(product)
      continue
    }

    const idealKey = [...idealKeys][0]
    if (!clusters.has(idealKey)) clusters.set(idealKey, [])
    clusters.get(idealKey).push(product)
  }

  const merges = []

  for (const [idealKey, cluster] of clusters.entries()) {
    if (cluster.length <= 1) continue

    const idealProduct = idealProducts.find((product) => product.canonical_product_key === idealKey)
    const keeper = pickCanonicalProductKeeper(cluster, idealProduct)
    const duplicates = cluster.filter((product) => product.id !== keeper.id)
    const mergedSourceIds = [
      ...new Set(cluster.flatMap((product) => product.source_intelligence_row_ids ?? [])),
    ]

    merges.push({
      idealKey,
      idealProduct,
      idealProductName: idealProduct?.canonical_product_name ?? keeper.canonical_product_name,
      keeper,
      duplicates,
      mergedSourceIds,
    })
  }

  return { merges, ambiguous, idealProducts }
}

export function productHasBaselineYear(product) {
  return product?.baseline_manufacture_year != null
}

export function productHasRrp(product) {
  const price = Number(product?.original_base_price)
  return Number.isFinite(price) && price > 0
}

export function getSourceRowsForProduct(product, intelligenceRowsById = new Map()) {
  return (product?.source_intelligence_row_ids ?? [])
    .map((id) => intelligenceRowsById.get(id))
    .filter(Boolean)
}

export function classifyAuditApprovalCandidates(products = [], intelligenceRowsById = new Map()) {
  const safeApprovals = []
  const singleSourceApprovals = []
  const consoleOnlyGroups = []
  const needsReviewProducts = []

  for (const product of products) {
    const sourceRows = getSourceRowsForProduct(product, intelligenceRowsById)

    if (product.status === PRODUCT_STATUS.NEEDS_REVIEW) {
      needsReviewProducts.push(product)
      const evaluation = evaluateSingleSourceApproval(product, sourceRows)
      if (evaluation.isSingleSourceNeedsReviewSafe) {
        singleSourceApprovals.push(product)
      }
      continue
    }

    if (!isSafeApprovalCandidate(product, sourceRows)) continue

    safeApprovals.push(product)
    if ((product.source_intelligence_row_ids?.length ?? 0) > 1) {
      consoleOnlyGroups.push(product)
    }
  }

  return {
    safeApprovals,
    singleSourceApprovals,
    consoleOnlyGroups,
    needsReviewProducts,
  }
}

export function buildBrandCanonicalWorkflowReport(
  audit,
  {
    equipmentProducts = [],
    intelligenceRows = [],
  } = {},
) {
  const intelligenceRowsById = new Map(intelligenceRows.map((row) => [row.id, row]))
  const approval = classifyAuditApprovalCandidates(audit.products, intelligenceRowsById)
  const repairPlan = buildConsoleDuplicateRepairPlan(equipmentProducts, intelligenceRows)

  return {
    brand: audit.brand ?? null,
    total_intelligence_rows: audit.total_intelligence_rows,
    suggested_canonical_products: audit.suggested_canonical_products,
    duplicate_rows_collapsed: audit.duplicate_rows_collapsed,
    products_needing_review: audit.products_needing_review,
    safe_approvals: approval.safeApprovals.length,
    single_source_approvals: approval.singleSourceApprovals.length,
    console_only_groups: approval.consoleOnlyGroups.length,
    merge_clusters: repairPlan.merges.length,
    ambiguous_products: repairPlan.ambiguous.length,
    approval,
    repairPlan,
    audit,
  }
}

export function summarizeEquipmentProductCounts(products = []) {
  const counts = {
    approved: 0,
    pending: 0,
    needs_review: 0,
    excluded: 0,
    complete: 0,
    missing_price: 0,
    missing_baseline: 0,
    missing_both: 0,
  }

  for (const product of products) {
    const status = product?.status ?? 'pending'
    if (status === PRODUCT_STATUS.APPROVED) counts.approved += 1
    else if (status === PRODUCT_STATUS.NEEDS_REVIEW) counts.needs_review += 1
    else if (status === PRODUCT_STATUS.EXCLUDED) counts.excluded += 1
    else counts.pending += 1

    const hasPrice = productHasRrp(product)
    const hasBaseline = productHasBaselineYear(product)
    if (hasPrice && hasBaseline) counts.complete += 1
    else if (!hasPrice && !hasBaseline) counts.missing_both += 1
    else if (!hasPrice) counts.missing_price += 1
    else counts.missing_baseline += 1
  }

  return counts
}

export {
  buildCoreProductKeyFromFields,
  buildCoreProductName,
}
