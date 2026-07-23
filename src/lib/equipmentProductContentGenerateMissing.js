/**
 * Shared eligibility + planning for “Generate missing drafts”.
 * Used by admin UI preview and CLI. Does not call OpenAI.
 */

import { PRODUCT_STATUS } from './intelligenceCanonicalProducts.js'
import {
  CONTENT_USAGE_SEGMENT,
  HOME_USE_CONTENT_BRANDS,
  isCommercialContentBrand,
  isHomeLikeUsageSegment,
  isHomeUseContentBrand,
  normalizeBrandKey,
  resolveProductContentUsageSegment,
} from './equipmentProductContentUsage.js'

export {
  CONTENT_USAGE_SEGMENT,
  HOME_USE_CONTENT_BRANDS,
  isCommercialContentBrand,
  isHomeLikeUsageSegment,
  isHomeUseContentBrand,
  normalizeBrandKey,
  resolveProductContentUsageSegment,
}

export const CONTENT_GENERATION_STATUS = Object.freeze({
  DRAFT: 'draft',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  FAILED: 'failed',
  STALE: 'stale',
})

export const GENERATE_MISSING_SCOPE = Object.freeze({
  FILTERED: 'filtered',
  SELECTED: 'selected',
})

export const GENERATE_MISSING_SCOPE_LABELS = Object.freeze({
  [GENERATE_MISSING_SCOPE.FILTERED]: 'All matching filtered products',
  [GENERATE_MISSING_SCOPE.SELECTED]: 'Selected rows only',
})

export const GENERATE_MISSING_DEFAULT_CONCURRENCY = 3
export const GENERATE_MISSING_MAX_PER_STEP = 5

function normalizeWhitespace(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim()
}

export function isEligibleProductStatusForContentGeneration(status) {
  return status === PRODUCT_STATUS.PENDING
    || status === PRODUCT_STATUS.NEEDS_REVIEW
    || status === PRODUCT_STATUS.APPROVED
}

export function hasRequiredProductIdentityForContent(product = {}) {
  const brand = normalizeWhitespace(product.brand)
  const canonical = normalizeWhitespace(product.canonical_product_name)
  const model = normalizeWhitespace(product.model)
  if (!brand) return false
  if (!canonical && !model) return false
  return true
}

function isMissingOrFailedContent(contentRow) {
  return !contentRow
    || contentRow.generation_status === CONTENT_GENERATION_STATUS.FAILED
}

/**
 * Decide skip / generate for a product + current content row.
 * Recheck-friendly: pure function of latest DB state.
 */
export function evaluateMissingDraftGenerationEligibility(product, contentRow = null) {
  if (!product?.id) {
    return { eligible: false, reason: 'missing_product', action: 'invalid' }
  }

  if (!isEligibleProductStatusForContentGeneration(product.status)) {
    return {
      eligible: false,
      reason: product.status === PRODUCT_STATUS.EXCLUDED ? 'excluded' : 'ineligible_status',
      action: 'invalid',
    }
  }

  if (!hasRequiredProductIdentityForContent(product)) {
    return { eligible: false, reason: 'missing_identity', action: 'invalid' }
  }

  if (contentRow?.generation_status === CONTENT_GENERATION_STATUS.APPROVED) {
    return { eligible: false, reason: 'approved_content_exists', action: 'skipped_approved' }
  }

  if (contentRow?.generation_status === CONTENT_GENERATION_STATUS.DRAFT) {
    return { eligible: false, reason: 'draft_exists', action: 'skipped_draft' }
  }

  if (contentRow?.generation_status === CONTENT_GENERATION_STATUS.STALE) {
    // Stale still has published copy history; treat as existing content — do not overwrite.
    return { eligible: false, reason: 'stale_content_exists', action: 'skipped_draft' }
  }

  if (contentRow?.generation_status === CONTENT_GENERATION_STATUS.REJECTED) {
    return { eligible: false, reason: 'rejected_content_exists', action: 'skipped_draft' }
  }

  // missing or failed → generate
  if (!isMissingOrFailedContent(contentRow)) {
    return { eligible: false, reason: 'content_exists', action: 'skipped_draft' }
  }

  return {
    eligible: true,
    reason: contentRow?.generation_status === CONTENT_GENERATION_STATUS.FAILED
      ? 'failed_retry'
      : 'missing',
    action: 'generate',
    usage_segment: resolveProductContentUsageSegment(product),
  }
}

export function buildGenerateMissingPreview({
  products = [],
  contentByProductId = {},
  productIds = null,
} = {}) {
  const idFilter = productIds == null
    ? null
    : new Set((productIds ?? []).map((id) => String(id)))

  const summary = {
    considered: 0,
    eligible: 0,
    skipped_draft: 0,
    skipped_approved: 0,
    invalid: 0,
    by_brand: {},
    eligible_product_ids: [],
    eligible_by_brand: {},
    samples: {
      eligible: [],
      skipped_draft: [],
      skipped_approved: [],
      invalid: [],
    },
  }

  for (const product of products) {
    if (idFilter && !idFilter.has(String(product.id))) continue
    summary.considered += 1

    const content = contentByProductId[product.id]
      ?? contentByProductId[String(product.id)]
      ?? null
    const decision = evaluateMissingDraftGenerationEligibility(product, content)
    const brand = normalizeWhitespace(product.brand) || 'Unknown'

    if (!summary.by_brand[brand]) {
      summary.by_brand[brand] = {
        considered: 0,
        eligible: 0,
        skipped_draft: 0,
        skipped_approved: 0,
        invalid: 0,
      }
    }
    summary.by_brand[brand].considered += 1

    const sample = {
      id: product.id,
      brand,
      name: product.canonical_product_name || product.model || product.id,
      reason: decision.reason,
      product_status: product.status,
    }

    if (decision.action === 'generate') {
      summary.eligible += 1
      summary.by_brand[brand].eligible += 1
      summary.eligible_product_ids.push(product.id)
      summary.eligible_by_brand[brand] = (summary.eligible_by_brand[brand] || 0) + 1
      if (summary.samples.eligible.length < 8) summary.samples.eligible.push(sample)
      continue
    }

    if (decision.action === 'skipped_approved') {
      summary.skipped_approved += 1
      summary.by_brand[brand].skipped_approved += 1
      if (summary.samples.skipped_approved.length < 5) summary.samples.skipped_approved.push(sample)
      continue
    }

    if (decision.action === 'skipped_draft') {
      summary.skipped_draft += 1
      summary.by_brand[brand].skipped_draft += 1
      if (summary.samples.skipped_draft.length < 5) summary.samples.skipped_draft.push(sample)
      continue
    }

    summary.invalid += 1
    summary.by_brand[brand].invalid += 1
    if (summary.samples.invalid.length < 5) summary.samples.invalid.push(sample)
  }

  summary.brands_affected = Object.keys(summary.eligible_by_brand).sort()
  summary.estimated_batches = Math.ceil(
    summary.eligible / GENERATE_MISSING_MAX_PER_STEP,
  )

  return summary
}

export function chunkProductIds(productIds = [], size = GENERATE_MISSING_MAX_PER_STEP) {
  const chunkSize = Math.max(1, Math.min(Number(size) || GENERATE_MISSING_MAX_PER_STEP, 10))
  const ids = [...new Set((productIds ?? []).map((id) => String(id ?? '').trim()).filter(Boolean))]
  const chunks = []
  for (let index = 0; index < ids.length; index += chunkSize) {
    chunks.push(ids.slice(index, index + chunkSize))
  }
  return chunks
}

export function emptyGenerateMissingProgress(total = 0) {
  return {
    total: Number(total) || 0,
    queued: Number(total) || 0,
    processing: 0,
    completed: 0,
    skipped: 0,
    failed: 0,
    created: 0,
    failures: [],
  }
}

export function applyGenerateMissingStepResult(progress, stepResult = {}) {
  const next = {
    ...progress,
    failures: [...(progress.failures || [])],
  }
  const created = Number(stepResult.created) || 0
  const skipped = Number(stepResult.skipped) || 0
  const failed = Number(stepResult.failed) || 0
  const processed = created + skipped + failed

  next.created += created
  next.skipped += skipped
  next.failed += failed
  next.completed += processed
  next.queued = Math.max(0, next.total - next.completed)
  next.processing = 0

  for (const failure of stepResult.failures || []) {
    next.failures.push(failure)
  }

  return next
}

export function summarizeGenerateMissingRun({
  preview = null,
  progress = null,
} = {}) {
  return {
    products_considered: preview?.considered ?? progress?.total ?? 0,
    drafts_created: progress?.created ?? 0,
    skipped_draft_exists: preview?.skipped_draft ?? 0,
    skipped_approved_exists: preview?.skipped_approved ?? 0,
    invalid_ineligible: preview?.invalid ?? 0,
    failed: progress?.failed ?? 0,
    brands_processed: preview?.brands_affected ?? [],
    failures: progress?.failures ?? [],
  }
}

function mapAdminRowToProduct(row) {
  return {
    id: row.equipment_product_id || row.id,
    brand: row.brand,
    model: row.model,
    status: row.product_status || row.status,
    canonical_product_name: row.canonical_product_name,
    equipment_type: row.equipment_type,
  }
}

function mapAdminRowToContent(row) {
  if (!row?.generation_status) return null
  return {
    equipment_product_id: row.equipment_product_id,
    generation_status: row.generation_status,
    overview_text: row.overview_text,
  }
}

/**
 * Build preview from already-loaded admin list rows + current filters/selection.
 * Shared by UI (and tests) — same eligibility as CLI.
 */
export function previewGenerateMissingFromAdminRows({
  filteredRows = [],
  selectedIds = new Set(),
  scope = GENERATE_MISSING_SCOPE.FILTERED,
} = {}) {
  let rows = filteredRows
  if (scope === GENERATE_MISSING_SCOPE.SELECTED) {
    rows = filteredRows.filter((row) => selectedIds.has(row.id))
  }

  const products = rows.map(mapAdminRowToProduct)
  const contentByProductId = {}
  for (const row of rows) {
    const productId = row.equipment_product_id || row.id
    const content = mapAdminRowToContent(row)
    if (content) contentByProductId[productId] = content
  }

  return buildGenerateMissingPreview({ products, contentByProductId })
}

export function buildGenerateMissingConfirmationSummary(preview) {
  if (!preview) return ''
  const brands = (preview.brands_affected || []).join(', ') || 'none'
  return [
    `Eligible products: ${preview.eligible}`,
    `Brands affected: ${brands}`,
    `Already have drafts: ${preview.skipped_draft}`,
    `Already have approved content: ${preview.skipped_approved}`,
    `Excluded / invalid: ${preview.invalid}`,
    `Estimated batches: ${preview.estimated_batches}`,
  ].join('\n')
}
