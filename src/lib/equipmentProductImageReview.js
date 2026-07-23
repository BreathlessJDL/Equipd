import { assessEquipmentProductImageRisk, LOW_IMAGE_CONFIDENCE_THRESHOLD } from './equipmentProductImageAudit.js'
import {
  EQUIPMENT_PRODUCT_IMAGE_STATUS,
  productHasDisplayableImage,
} from './equipmentProductImages.js'

export const BULK_IMAGE_REVIEW_SKIP_REASON = Object.freeze({
  NOT_PENDING: 'not_pending',
  MISSING_IMAGE: 'missing_image',
  LOW_CONFIDENCE: 'low_confidence',
  CONFLICTING_MODEL: 'conflicting_model',
  MANUALLY_REJECTED_PREVIOUSLY: 'manually_rejected_previously',
  DUPLICATE_APPROVED_IMAGE: 'duplicate_approved_image',
})

export const BULK_IMAGE_REVIEW_SKIP_REASON_LABELS = Object.freeze({
  [BULK_IMAGE_REVIEW_SKIP_REASON.NOT_PENDING]: 'not pending review',
  [BULK_IMAGE_REVIEW_SKIP_REASON.MISSING_IMAGE]: 'missing image asset',
  [BULK_IMAGE_REVIEW_SKIP_REASON.LOW_CONFIDENCE]: 'low confidence',
  [BULK_IMAGE_REVIEW_SKIP_REASON.CONFLICTING_MODEL]: 'conflicting model',
  [BULK_IMAGE_REVIEW_SKIP_REASON.MANUALLY_REJECTED_PREVIOUSLY]: 'manually rejected previously',
  [BULK_IMAGE_REVIEW_SKIP_REASON.DUPLICATE_APPROVED_IMAGE]: 'duplicate approved image',
})

function incrementReason(map, reason) {
  if (!reason) return
  map[reason] = (map[reason] || 0) + 1
}

export function normalizeBulkImageReviewReason(reason) {
  return BULK_IMAGE_REVIEW_SKIP_REASON_LABELS[reason] || String(reason || '').trim() || 'other'
}

export function summarizeBulkImageReviewReasons(reasonCounts = {}) {
  return Object.entries(reasonCounts)
    .filter(([, count]) => Number(count) > 0)
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .map(([reason, count]) => ({
      reason,
      label: normalizeBulkImageReviewReason(reason),
      count: Number(count) || 0,
    }))
}

export function evaluateEquipmentProductImageApproval(product) {
  const reasons = []
  const imageStatus = String(product?.image_status ?? '').trim().toLowerCase()
  const hasImageAsset = Boolean(product?.image_url || product?.image_storage_path)
  const confidence = Number(product?.image_confidence ?? 0)
  const risk = assessEquipmentProductImageRisk(product)
  const candidateStatus = String(product?.latest_image_candidate_status ?? '').trim().toLowerCase()
  const candidateRejectionReason = String(product?.latest_image_candidate_rejection_reason ?? '').trim().toLowerCase()

  if (imageStatus !== EQUIPMENT_PRODUCT_IMAGE_STATUS.SUGGESTED) {
    reasons.push(BULK_IMAGE_REVIEW_SKIP_REASON.NOT_PENDING)
  }
  if (!hasImageAsset) {
    reasons.push(BULK_IMAGE_REVIEW_SKIP_REASON.MISSING_IMAGE)
  }
  if (productHasDisplayableImage(product) || candidateStatus === 'duplicate') {
    reasons.push(BULK_IMAGE_REVIEW_SKIP_REASON.DUPLICATE_APPROVED_IMAGE)
  }
  if (
    product?.latest_image_candidate_status === 'rejected'
    || imageStatus === EQUIPMENT_PRODUCT_IMAGE_STATUS.REJECTED
  ) {
    reasons.push(BULK_IMAGE_REVIEW_SKIP_REASON.MANUALLY_REJECTED_PREVIOUSLY)
  }
  if (hasImageAsset && confidence > 0 && confidence < LOW_IMAGE_CONFIDENCE_THRESHOLD) {
    reasons.push(BULK_IMAGE_REVIEW_SKIP_REASON.LOW_CONFIDENCE)
  }
  if (
    risk?.identityEvidence?.conflictingTokens?.length
    || candidateRejectionReason.includes('conflict')
  ) {
    reasons.push(BULK_IMAGE_REVIEW_SKIP_REASON.CONFLICTING_MODEL)
  }

  return {
    product,
    eligible: reasons.length === 0,
    reasons,
    risk,
    confidence,
    candidateScore: Number(product?.latest_image_candidate_score ?? 0) || 0,
  }
}

export function summarizeEquipmentProductImageApprovalSelection(products = []) {
  const evaluations = products.map(evaluateEquipmentProductImageApproval)
  const pendingCount = evaluations.filter(
    (entry) => entry.product?.image_status === EQUIPMENT_PRODUCT_IMAGE_STATUS.SUGGESTED,
  ).length
  const eligible = evaluations.filter((entry) => entry.eligible)
  const skipped = evaluations.filter((entry) => !entry.eligible)
  const skippedReasonCounts = {}

  for (const entry of skipped) {
    for (const reason of entry.reasons) {
      incrementReason(skippedReasonCounts, reason)
    }
  }

  return {
    evaluations,
    pendingCount,
    eligible,
    skipped,
    eligibleCount: eligible.length,
    skippedCount: skipped.length,
    skippedReasonCounts,
    skippedReasons: summarizeBulkImageReviewReasons(skippedReasonCounts),
  }
}

/** Bulk approve: every selected product is approved; no eligibility skipping. */
export function summarizeEquipmentProductImageBulkApprovalSelection(products = []) {
  const list = Array.isArray(products) ? products : []
  const evaluations = list.map(evaluateEquipmentProductImageApproval)
  const pendingCount = evaluations.filter(
    (entry) => entry.product?.image_status === EQUIPMENT_PRODUCT_IMAGE_STATUS.SUGGESTED,
  ).length
  const advisoryReasonCounts = {}

  for (const entry of evaluations) {
    for (const reason of entry.reasons) {
      incrementReason(advisoryReasonCounts, reason)
    }
  }

  return {
    evaluations,
    selectedCount: list.length,
    approveCount: list.length,
    pendingCount,
    advisoryReasonCounts,
    advisoryReasons: summarizeBulkImageReviewReasons(advisoryReasonCounts),
    // Legacy fields for callers that still read eligible/skipped counts.
    eligibleCount: list.length,
    skippedCount: 0,
    skippedReasons: [],
    skippedReasonCounts: {},
  }
}

export function isBulkImageApprovalShortcutVisible(filters = {}) {
  return Boolean(filters?.brand) && String(filters?.imageFilter ?? '').trim() === 'pending_review'
}
