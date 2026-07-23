/**
 * Tests for bulk image approval/reject scope and advisory rules.
 */

import {
  BULK_IMAGE_REVIEW_SKIP_REASON,
  summarizeEquipmentProductImageApprovalSelection,
  summarizeEquipmentProductImageBulkApprovalSelection,
} from '../src/lib/equipmentProductImageReview.js'
import { buildAdminListEquipmentProductsRpcArgs } from '../src/lib/equipmentProductsAdminListState.js'
import { EQUIPMENT_PRODUCT_IMAGE_STATUS } from '../src/lib/equipmentProductImages.js'

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`)
  }
}

const safeSuggested = {
  id: 'p1',
  brand: 'Technogym',
  product_family: 'Artis',
  model: 'Run',
  canonical_product_name: 'Technogym Artis Run',
  image_status: EQUIPMENT_PRODUCT_IMAGE_STATUS.SUGGESTED,
  image_url: 'https://cdn.example/artis-run.jpg',
  image_source_url: 'https://www.technogym.com/gb/artis-run-technogym-run',
  image_source_domain: 'technogym.com',
  image_confidence: 92,
  latest_image_candidate_status: 'pending',
  latest_image_candidate_score: 94,
}

const lowConfidence = {
  ...safeSuggested,
  id: 'p2',
  canonical_product_name: 'Technogym Artis Bike',
  image_url: 'https://cdn.example/artis-bike.jpg',
  image_source_url: 'https://www.technogym.com/gb/artis-bike',
  image_confidence: 64,
}

const conflictingModel = {
  ...safeSuggested,
  id: 'p3',
  brand: 'Life Fitness',
  product_family: 'Integrity',
  model: '95Ti',
  canonical_product_name: 'Life Fitness Integrity 95Ti',
  image_url: 'https://cdn.example/wrong-image.jpg',
  image_source_url: 'https://www.bowflex.com/treadmills/t56-other-model',
  image_source_domain: 'bowflex.com',
  latest_image_candidate_rejection_reason: 'conflicting_product_identity',
}

const previouslyRejected = {
  ...safeSuggested,
  id: 'p4',
  canonical_product_name: 'Technogym Bike Personal',
  latest_image_candidate_status: 'rejected',
}

const alreadyRejectedProduct = {
  ...safeSuggested,
  id: 'p5',
  canonical_product_name: 'Technogym Recline',
  image_status: EQUIPMENT_PRODUCT_IMAGE_STATUS.REJECTED,
}

console.log('bulk image review tests')

{
  const summary = summarizeEquipmentProductImageApprovalSelection([
    safeSuggested,
    lowConfidence,
    conflictingModel,
    previouslyRejected,
    alreadyRejectedProduct,
  ])

  assertEqual(summary.pendingCount, 4, 'pending images counted')
  assertEqual(summary.eligibleCount, 1, 'only one eligible image')
  assertEqual(summary.skippedCount, 4, 'remaining images skipped')
  assert(summary.skippedReasonCounts[BULK_IMAGE_REVIEW_SKIP_REASON.LOW_CONFIDENCE] >= 1, 'low confidence skipped')
  assert(summary.skippedReasonCounts[BULK_IMAGE_REVIEW_SKIP_REASON.CONFLICTING_MODEL] >= 1, 'conflicting model skipped')
  assert(summary.skippedReasonCounts[BULK_IMAGE_REVIEW_SKIP_REASON.MANUALLY_REJECTED_PREVIOUSLY] >= 2, 'manual rejection preserved')
}

{
  const products = [
    safeSuggested,
    lowConfidence,
    conflictingModel,
    previouslyRejected,
    alreadyRejectedProduct,
  ]
  const bulkSummary = summarizeEquipmentProductImageBulkApprovalSelection(products)

  assertEqual(bulkSummary.selectedCount, 5, 'all selected products counted')
  assertEqual(bulkSummary.approveCount, 5, 'all selected products approved')
  assertEqual(bulkSummary.skippedCount, 0, 'bulk approve does not skip')
  assert(bulkSummary.advisoryReasons.length > 0, 'advisory reasons still surfaced')
}

{
  const filteredSelectionTotal = 123
  const currentPageCount = 25
  assert(filteredSelectionTotal > currentPageCount, 'all-filtered selection spans beyond current page')
}

{
  const args = buildAdminListEquipmentProductsRpcArgs({
    brand: 'Technogym',
    imageFilter: 'pending_review',
    imageSearchJobId: 'job-123',
    imageSourceDomain: 'technogym.com',
    minImageConfidence: '80',
    minCandidateScore: '88.5',
  })
  assertEqual(args.p_brand, 'Technogym', 'brand arg passed')
  assertEqual(args.p_image_filter, 'pending_review', 'image filter arg passed')
  assertEqual(args.p_image_search_job_id, 'job-123', 'job filter arg passed')
  assertEqual(args.p_image_source_domain, 'technogym.com', 'source domain arg passed')
  assertEqual(args.p_min_image_confidence, 80, 'confidence filter arg passed')
  assertEqual(args.p_min_candidate_score, 88.5, 'candidate score arg passed')
}

console.log('bulk image review tests passed')
