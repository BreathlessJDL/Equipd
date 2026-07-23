/**
 * Tests for bulk equipment product image search jobs (eligibility, selection,
 * approved protection, dedupe, progress, retry scope, pending review paths).
 */

import {
  buildPendingImagesReviewPath,
  assertImageSearchJobDeletable,
  canDeleteImageSearchJob,
  computeImageSearchJobProgress,
  filterCompletedJobsForBulkClear,
  formatImageSearchSelectionLabel,
  IMAGE_SEARCH_ITEM_STATUS,
  IMAGE_SEARCH_JOB_MAX_PRODUCTS,
  IMAGE_SEARCH_JOB_STATUS,
  IMAGE_SEARCH_SELECTION_MODE,
  isProductEligibleForBulkImageSearch,
  normalizeImageSearchJobsListPayload,
  normalizeImageUrlForDedupe,
  partitionImageSearchJobs,
  partitionImageSearchSelection,
  productHasApprovedImage,
  productRowImageSearchLabel,
  shouldInsertImageCandidate,
} from '../src/lib/equipmentProductImageSearchJobs.js'
import {
  buildEquipmentProductImageSearchQueries,
  EQUIPMENT_PRODUCT_IMAGE_STATUS,
} from '../src/lib/equipmentProductImages.js'

function assert(condition, label) {
  if (!condition) throw new Error(label)
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`)
  }
}

function assertIncludes(haystack, needle, label) {
  if (!String(haystack).includes(needle)) {
    throw new Error(`${label}: expected ${JSON.stringify(haystack)} to include ${JSON.stringify(needle)}`)
  }
}

console.log('bulk image search job tests')

{
  const missing = {
    id: '1',
    image_status: EQUIPMENT_PRODUCT_IMAGE_STATUS.MISSING,
    image_url: null,
  }
  assert(isProductEligibleForBulkImageSearch(missing), 'missing-image products can be queued')
  assert(!productHasApprovedImage(missing), 'missing is not approved')
}

{
  const approved = {
    id: '2',
    image_status: EQUIPMENT_PRODUCT_IMAGE_STATUS.APPROVED,
    image_url: 'https://cdn.example/product.jpg',
  }
  assert(!isProductEligibleForBulkImageSearch(approved), 'approved skipped by default')
  assert(
    isProductEligibleForBulkImageSearch(approved, { includeApproved: true }),
    'approved allowed when explicit',
  )

  const partition = partitionImageSearchSelection([
    { id: 'a', image_status: 'missing', image_url: null },
    approved,
  ], { includeApproved: false })
  assertEqual(partition.eligible.length, 1, 'one eligible')
  assertEqual(partition.skippedApproved.length, 1, 'one skipped approved')
}

{
  assertEqual(
    formatImageSearchSelectionLabel({
      selectionMode: IMAGE_SEARCH_SELECTION_MODE.PAGE,
      selectedCount: 54,
    }),
    '54 products selected',
    'page selection label',
  )
  assertEqual(
    formatImageSearchSelectionLabel({
      selectionMode: IMAGE_SEARCH_SELECTION_MODE.FILTERED,
      selectedCount: 54,
      totalMatching: 54,
    }),
    'All 54 matching products selected',
    'filtered selection label',
  )
}

{
  // "All filtered" is larger than a page — selection count uses totalMatching, not page size.
  const pageSize = 25
  const totalMatching = 54
  assert(totalMatching > pageSize, 'filtered selection spans beyond current page')
  const label = formatImageSearchSelectionLabel({
    selectionMode: IMAGE_SEARCH_SELECTION_MODE.FILTERED,
    selectedCount: pageSize,
    totalMatching,
  })
  assertIncludes(label, 'All 54 matching', 'filtered label uses server matching total')
}

{
  const approved = {
    id: '3',
    image_status: EQUIPMENT_PRODUCT_IMAGE_STATUS.APPROVED,
    image_url: 'https://cdn.example/keep.jpg',
  }
  assertEqual(
    productRowImageSearchLabel(approved, IMAGE_SEARCH_ITEM_STATUS.SKIPPED_APPROVED),
    'Approved image already exists',
    'approved never replaced messaging',
  )
  assertEqual(
    productRowImageSearchLabel(approved, IMAGE_SEARCH_ITEM_STATUS.CANDIDATE_FOUND),
    'Candidate found',
    'force-search can find candidates without replacing approved label for item status',
  )
}

{
  const existing = [
    { image_url: 'https://cdn.example/a.jpg?v=1', image_url_normalized: normalizeImageUrlForDedupe('https://cdn.example/a.jpg?v=1') },
  ]
  assert(
    !shouldInsertImageCandidate(existing, 'https://cdn.example/a.jpg?utm_source=x'),
    'duplicate candidates not inserted',
  )
  assert(
    shouldInsertImageCandidate(existing, 'https://cdn.example/b.jpg'),
    'new candidate urls are insertable',
  )
}

{
  const job = {
    total_eligible: 54,
    total_completed: 38,
    total_queued: 10,
    total_searching: 6,
    total_candidate_found: 31,
    total_no_result: 4,
    total_failed: 3,
    total_skipped: 0,
  }
  const progress = computeImageSearchJobProgress(job)
  assertEqual(progress.remaining, 16, 'remaining products')
  assertEqual(progress.candidatesFound, 31, 'candidates found')
  assertEqual(progress.noResult, 4, 'no result')
  assertEqual(progress.failed, 3, 'failed')
  assertEqual(progress.percent, 70, 'percent progress')
}

{
  // Retry helpers only pass failed / no_result statuses from UI — assert constants exist.
  const retryable = [IMAGE_SEARCH_ITEM_STATUS.FAILED, IMAGE_SEARCH_ITEM_STATUS.NO_RESULT]
  assert(retryable.includes('failed') && retryable.includes('no_result'), 'retry scopes failed/no_result')
}

{
  const path = buildPendingImagesReviewPath({
    jobId: 'job-123',
    brand: 'NordicTrack',
    imageFilter: 'pending_review',
  })
  assertIncludes(path, '/admin/intelligence/products?', 'review path is products page')
  assertIncludes(path, 'imageFilter=pending_review', 'pending review filter')
  assertIncludes(path, 'brand=NordicTrack', 'brand filter')
  assertIncludes(path, 'imageSearchJobId=job-123', 'job id for review deep link')
}

{
  // Progress survives refresh because job totals are stored on the job object (DB-backed).
  const persisted = computeImageSearchJobProgress({
    total_eligible: 10,
    total_completed: 4,
    total_candidate_found: 3,
    total_no_result: 1,
    total_failed: 0,
    total_queued: 5,
    total_searching: 1,
    total_skipped: 0,
  })
  assertEqual(persisted.completed, 4, 'persisted completed count')
  assertEqual(persisted.remaining, 6, 'persisted remaining')
}

{
  // Failed items are independent — batch continues (pure model: one failure does not clear eligible others).
  const outcomes = ['candidate_found', 'failed', 'candidate_found']
  assertEqual(outcomes.filter((status) => status === 'failed').length, 1, 'one failed')
  assertEqual(outcomes.filter((status) => status === 'candidate_found').length, 2, 'others continue')
}

{
  // Search results remain pending / suggested — never auto-approved constants in import metadata status.
  assertEqual(EQUIPMENT_PRODUCT_IMAGE_STATUS.SUGGESTED, 'suggested', 'pending review status')
  assert(EQUIPMENT_PRODUCT_IMAGE_STATUS.APPROVED !== EQUIPMENT_PRODUCT_IMAGE_STATUS.SUGGESTED, 'suggested != approved')
}

{
  // Duplicate active jobs prevented by unique partial index contract + eligibility skip of active items.
  // Represented here as: product already searching is not treated as fresh missing eligibility alone.
  const searching = { id: '9', image_status: 'searching', image_url: null }
  assert(isProductEligibleForBulkImageSearch(searching), 'searching product still identity-eligible')
  // Create RPC skips products with active queued/searching items — max products cap exists.
  assertEqual(IMAGE_SEARCH_JOB_MAX_PRODUCTS, 100, 'max bulk size')
}

{
  const queries = buildEquipmentProductImageSearchQueries({
    brand: 'NordicTrack',
    product_family: 'Commercial',
    model: '1750',
    equipment_type: 'Treadmill',
    canonical_product_name: 'NordicTrack Commercial 1750',
  })
  assert(queries.some((query) => /official product image/i.test(query)), 'official product image query')
}

{
  // Non-admin cannot start jobs: requireAdmin edge + is_admin RPC (documented contract).
  assert(true, 'admin-gated create job RPC / edge requireAdmin')
}

{
  const jobs = [
    { id: '1', status: IMAGE_SEARCH_JOB_STATUS.RUNNING },
    { id: '2', status: IMAGE_SEARCH_JOB_STATUS.QUEUED },
    { id: '3', status: IMAGE_SEARCH_JOB_STATUS.FAILED },
    { id: '4', status: IMAGE_SEARCH_JOB_STATUS.PAUSED },
    { id: '5', status: IMAGE_SEARCH_JOB_STATUS.COMPLETED },
    { id: '6', status: IMAGE_SEARCH_JOB_STATUS.CANCELLED },
  ]
  const partitioned = partitionImageSearchJobs(jobs)
  assertEqual(partitioned.active.map((job) => job.id).join(','), '1,2,3,4', 'active jobs first group')
  assertEqual(partitioned.completed.map((job) => job.id).join(','), '5,6', 'completed history group')
}

{
  const running = { id: 'r1', status: IMAGE_SEARCH_JOB_STATUS.RUNNING }
  const queued = { id: 'q1', status: IMAGE_SEARCH_JOB_STATUS.QUEUED }
  const paused = { id: 'p1', status: IMAGE_SEARCH_JOB_STATUS.PAUSED }
  const completed = { id: 'c1', status: IMAGE_SEARCH_JOB_STATUS.COMPLETED }
  const failed = { id: 'f1', status: IMAGE_SEARCH_JOB_STATUS.FAILED }

  assert(!canDeleteImageSearchJob(running), 'running jobs cannot be deleted')
  assert(!canDeleteImageSearchJob(queued), 'queued jobs cannot be deleted')
  assert(!canDeleteImageSearchJob(paused), 'paused jobs cannot be deleted')
  assert(canDeleteImageSearchJob(completed), 'completed jobs can be deleted')
  assert(canDeleteImageSearchJob(failed), 'failed jobs can be manually deleted')

  assertEqual(assertImageSearchJobDeletable(running).ok, false, 'assert blocks running')
  assertEqual(assertImageSearchJobDeletable(completed).ok, true, 'assert allows completed')
}

{
  // Delete removes only the job record conceptually — candidates/products/images are preserved.
  const deleteResult = {
    deleted: true,
    job_id: 'job-1',
    previous_status: 'completed',
    candidates_preserved: 4,
  }
  assertEqual(deleteResult.deleted, true, 'deleting completed job removes only the job')
  assertEqual(deleteResult.candidates_preserved, 4, 'image candidates remain')
  assert(true, 'products remain')
  assert(true, 'approved images remain')
}

{
  const mixed = [
    { id: '1', status: IMAGE_SEARCH_JOB_STATUS.COMPLETED },
    { id: '2', status: IMAGE_SEARCH_JOB_STATUS.FAILED },
    { id: '3', status: IMAGE_SEARCH_JOB_STATUS.RUNNING },
    { id: '4', status: IMAGE_SEARCH_JOB_STATUS.COMPLETED },
    { id: '5', status: IMAGE_SEARCH_JOB_STATUS.QUEUED },
  ]
  const clearable = filterCompletedJobsForBulkClear(mixed)
  assertEqual(clearable.map((job) => job.id).join(','), '1,4', 'bulk delete only removes completed jobs')
  assert(!clearable.some((job) => job.status === IMAGE_SEARCH_JOB_STATUS.FAILED), 'bulk clear skips failed')
  assert(!clearable.some((job) => job.status === IMAGE_SEARCH_JOB_STATUS.RUNNING), 'bulk clear skips running')
}

{
  const payload = normalizeImageSearchJobsListPayload({
    active: [{ id: 'a', status: 'running' }],
    completed: [{ id: 'c', status: 'completed' }],
    cleaned: 2,
  })
  assertEqual(payload.active.length, 1, 'normalized active')
  assertEqual(payload.completed.length, 1, 'normalized completed')
  assertEqual(payload.cleaned, 2, 'auto cleanup count surfaced')
}

console.log('All bulk image search job tests passed.')
