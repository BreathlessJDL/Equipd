/**
 * Pure helpers + admin client API for bulk equipment product image search jobs.
 */

export const IMAGE_SEARCH_JOB_MAX_PRODUCTS = 100
export const IMAGE_SEARCH_JOB_WORKER_BATCH_SIZE = 3

export const IMAGE_SEARCH_SELECTION_MODE = Object.freeze({
  PAGE: 'page',
  FILTERED: 'filtered',
})

export const IMAGE_SEARCH_JOB_STATUS = Object.freeze({
  QUEUED: 'queued',
  RUNNING: 'running',
  PAUSED: 'paused',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  FAILED: 'failed',
})

export const IMAGE_SEARCH_ACTIVE_JOB_STATUSES = Object.freeze([
  IMAGE_SEARCH_JOB_STATUS.QUEUED,
  IMAGE_SEARCH_JOB_STATUS.RUNNING,
  IMAGE_SEARCH_JOB_STATUS.PAUSED,
  IMAGE_SEARCH_JOB_STATUS.FAILED,
])

export const IMAGE_SEARCH_COMPLETED_HISTORY_STATUSES = Object.freeze([
  IMAGE_SEARCH_JOB_STATUS.COMPLETED,
  IMAGE_SEARCH_JOB_STATUS.CANCELLED,
])

export const IMAGE_SEARCH_DELETABLE_JOB_STATUSES = Object.freeze([
  IMAGE_SEARCH_JOB_STATUS.COMPLETED,
  IMAGE_SEARCH_JOB_STATUS.FAILED,
  IMAGE_SEARCH_JOB_STATUS.CANCELLED,
])

export const IMAGE_SEARCH_ITEM_STATUS = Object.freeze({
  QUEUED: 'queued',
  SEARCHING: 'searching',
  CANDIDATE_FOUND: 'candidate_found',
  NO_RESULT: 'no_result',
  FAILED: 'failed',
  SKIPPED_APPROVED: 'skipped_approved',
  CANCELLED: 'cancelled',
})

const IMAGE_STATUS = {
  MISSING: 'missing',
  SUGGESTED: 'suggested',
  APPROVED: 'approved',
  FAILED: 'failed',
}
export const IMAGE_STATUS_FILTER_OPTIONS = [
  { value: '', label: 'All image statuses' },
  { value: 'missing', label: 'Missing' },
  { value: 'queued', label: 'Search queued' },
  { value: 'searching', label: 'Searching' },
  { value: 'pending_review', label: 'Pending review' },
  { value: 'approved', label: 'Approved' },
  { value: 'no_result', label: 'No result' },
  { value: 'failed', label: 'Failed' },
]

export function productHasApprovedImage(product) {
  return Boolean(
    product
    && product.image_status === IMAGE_STATUS.APPROVED
    && String(product.image_url ?? '').trim(),
  )
}

export function isProductEligibleForBulkImageSearch(product, { includeApproved = false } = {}) {
  if (!product?.id) return false
  if (productHasApprovedImage(product) && !includeApproved) return false
  return true
}

export function partitionImageSearchSelection(products = [], { includeApproved = false } = {}) {
  const eligible = []
  const skippedApproved = []
  for (const product of products) {
    if (productHasApprovedImage(product) && !includeApproved) {
      skippedApproved.push(product)
      continue
    }
    if (isProductEligibleForBulkImageSearch(product, { includeApproved })) {
      eligible.push(product)
    }
  }
  return { eligible, skippedApproved }
}

export function formatImageSearchSelectionLabel({
  selectionMode,
  selectedCount,
  totalMatching = null,
} = {}) {
  const count = Number(selectedCount) || 0
  if (selectionMode === IMAGE_SEARCH_SELECTION_MODE.FILTERED) {
    const total = totalMatching == null ? count : Number(totalMatching) || count
    return `All ${total.toLocaleString('en-GB')} matching products selected`
  }
  return `${count.toLocaleString('en-GB')} product${count === 1 ? '' : 's'} selected`
}

export function computeImageSearchJobProgress(job) {
  const total = Math.max(0, Number(job?.total_eligible) || 0)
  const completed = Math.max(0, Number(job?.total_completed) || 0)
  const remaining = Math.max(0, total - completed)
  const percent = total > 0 ? Math.min(100, Math.round((completed / total) * 100)) : 0
  return {
    total,
    completed,
    remaining,
    percent,
    queued: Number(job?.total_queued) || 0,
    searching: Number(job?.total_searching) || 0,
    candidatesFound: Number(job?.total_candidate_found) || 0,
    noResult: Number(job?.total_no_result) || 0,
    failed: Number(job?.total_failed) || 0,
    skipped: Number(job?.total_skipped) || 0,
  }
}

export function isImageSearchJobActive(job) {
  return IMAGE_SEARCH_ACTIVE_JOB_STATUSES.includes(job?.status)
}

export function isImageSearchJobCompletedHistory(job) {
  return IMAGE_SEARCH_COMPLETED_HISTORY_STATUSES.includes(job?.status)
}

export function canDeleteImageSearchJob(job) {
  return IMAGE_SEARCH_DELETABLE_JOB_STATUSES.includes(job?.status) && !job?.deleted_at
}

export function canClearCompletedImageSearchJobs(jobs = []) {
  return jobs.some((job) => job?.status === IMAGE_SEARCH_JOB_STATUS.COMPLETED && !job?.deleted_at)
}

export function partitionImageSearchJobs(jobs = []) {
  const active = []
  const completed = []
  for (const job of jobs) {
    if (!job || job.deleted_at) continue
    if (isImageSearchJobActive(job)) active.push(job)
    else if (isImageSearchJobCompletedHistory(job)) completed.push(job)
  }
  return { active, completed }
}

export function normalizeImageSearchJobsListPayload(data) {
  if (Array.isArray(data)) {
    return {
      ...partitionImageSearchJobs(data),
      cleaned: 0,
    }
  }
  if (data && typeof data === 'object') {
    const active = Array.isArray(data.active) ? data.active : []
    const completed = Array.isArray(data.completed) ? data.completed : []
    return {
      active,
      completed,
      cleaned: Number(data.cleaned) || 0,
    }
  }
  return { active: [], completed: [], cleaned: 0 }
}

/** Pure guard used by UI/tests: running/queued/paused must not be deleted. */
export function assertImageSearchJobDeletable(job) {
  if (!job) return { ok: false, reason: 'Job not found' }
  if (['queued', 'running', 'paused'].includes(job.status)) {
    return { ok: false, reason: 'Only completed, failed, or cancelled jobs can be deleted' }
  }
  if (!canDeleteImageSearchJob(job)) {
    return { ok: false, reason: `Job status ${job.status} cannot be deleted` }
  }
  return { ok: true, reason: null }
}

/** Bulk clear only removes completed jobs — never failed/running/queued/paused. */
export function filterCompletedJobsForBulkClear(jobs = []) {
  return jobs.filter((job) => job?.status === IMAGE_SEARCH_JOB_STATUS.COMPLETED && !job?.deleted_at)
}

export function jobCoversSelectedProducts(job, productIds = []) {
  if (!job || !['queued', 'running'].includes(job.status)) return false
  const filters = job.filters || {}
  // Conservative: if any selected product has an active item elsewhere the create RPC skips them.
  // UI also disables when an active job exists for the same brand+image filter combo.
  if (!productIds.length) return false
  const brand = String(filters.brand ?? '').trim().toLowerCase()
  const imageFilter = String(filters.image_filter ?? '').trim().toLowerCase()
  return Boolean(brand || imageFilter || job.selection_mode === IMAGE_SEARCH_SELECTION_MODE.FILTERED)
}

export function buildPendingImagesReviewPath({ jobId = null, brand = '', imageFilter = 'pending_review' } = {}) {
  const params = new URLSearchParams()
  if (imageFilter) params.set('imageFilter', imageFilter)
  if (brand) params.set('brand', brand)
  if (jobId) params.set('imageSearchJobId', jobId)
  const query = params.toString()
  return `/admin/intelligence/products${query ? `?${query}` : ''}`
}

export function normalizeImageUrlForDedupe(url) {
  const raw = String(url ?? '').trim().toLowerCase()
  if (!raw) return ''
  try {
    const parsed = new URL(raw)
    parsed.hash = ''
    // Drop common cache-busters.
    ;['utm_source', 'utm_medium', 'utm_campaign', 'v', 'ver', 'version'].forEach((key) => {
      parsed.searchParams.delete(key)
    })
    return parsed.toString().replace(/\/$/, '')
  } catch {
    return raw.replace(/\/$/, '')
  }
}

export function shouldInsertImageCandidate(existingCandidates = [], imageUrl) {
  const normalized = normalizeImageUrlForDedupe(imageUrl)
  if (!normalized) return false
  return !existingCandidates.some((row) => (
    normalizeImageUrlForDedupe(row.image_url_normalized || row.image_url) === normalized
  ))
}

export function productRowImageSearchLabel(product, jobItemStatus = null) {
  if (jobItemStatus === IMAGE_SEARCH_ITEM_STATUS.QUEUED) return 'Queued'
  if (jobItemStatus === IMAGE_SEARCH_ITEM_STATUS.SEARCHING) return 'Searching'
  if (jobItemStatus === IMAGE_SEARCH_ITEM_STATUS.CANDIDATE_FOUND) return 'Candidate found'
  if (jobItemStatus === IMAGE_SEARCH_ITEM_STATUS.NO_RESULT) return 'No result'
  if (jobItemStatus === IMAGE_SEARCH_ITEM_STATUS.FAILED) return 'Failed'
  if (jobItemStatus === IMAGE_SEARCH_ITEM_STATUS.SKIPPED_APPROVED) return 'Approved image already exists'

  const status = product?.image_status
  if (status === IMAGE_STATUS.APPROVED) return 'Approved image already exists'
  if (status === 'queued') return 'Queued'
  if (status === 'searching') return 'Searching'
  if (status === IMAGE_STATUS.SUGGESTED) return 'Pending review'
  if (status === 'no_result') return 'No result'
  if (status === IMAGE_STATUS.FAILED) return 'Failed'
  if (status === IMAGE_STATUS.MISSING) return 'Missing'
  return null
}

async function getSupabaseClient() {
  const module = await import('./supabase.js')
  return {
    isConfigured: Boolean(module.isSupabaseConfigured && module.supabase),
    supabase: module.supabase,
  }
}

function buildFilterRpcArgs(filters = {}, {
  selectionMode,
  productIds = null,
  includeApproved = false,
  maxProducts = IMAGE_SEARCH_JOB_MAX_PRODUCTS,
} = {}) {
  return {
    p_selection_mode: selectionMode,
    p_product_ids: selectionMode === IMAGE_SEARCH_SELECTION_MODE.PAGE ? productIds : null,
    p_search: filters.search || null,
    p_brand: filters.brand || null,
    p_status: filters.status || null,
    p_equipment_type: filters.equipmentType || null,
    p_completion: filters.completion || null,
    p_attention: filters.attention || null,
    p_image_filter: filters.imageFilter || null,
    p_include_approved: Boolean(includeApproved),
    p_max_products: maxProducts,
  }
}

export async function previewEquipmentProductImageSearchJob({
  selectionMode,
  productIds = [],
  filters = {},
  includeApproved = false,
  maxProducts = IMAGE_SEARCH_JOB_MAX_PRODUCTS,
} = {}) {
  const { isConfigured, supabase } = await getSupabaseClient()
  if (!isConfigured) {
    return { preview: null, error: new Error('Supabase is not configured.') }
  }

  const { data, error } = await supabase.rpc(
    'admin_preview_equipment_product_image_search_job',
    buildFilterRpcArgs(filters, { selectionMode, productIds, includeApproved, maxProducts }),
  )

  if (error) return { preview: null, error }
  return { preview: data, error: null }
}

export async function createEquipmentProductImageSearchJob({
  selectionMode,
  productIds = [],
  filters = {},
  includeApproved = false,
  maxProducts = IMAGE_SEARCH_JOB_MAX_PRODUCTS,
} = {}) {
  const { isConfigured, supabase } = await getSupabaseClient()
  if (!isConfigured) {
    return { result: null, error: new Error('Supabase is not configured.') }
  }

  const { data, error } = await supabase.rpc(
    'admin_create_equipment_product_image_search_job',
    buildFilterRpcArgs(filters, { selectionMode, productIds, includeApproved, maxProducts }),
  )

  if (error) return { result: null, error }
  return { result: data, error: null }
}

export async function fetchEquipmentProductImageSearchJob(jobId) {
  const { isConfigured, supabase } = await getSupabaseClient()
  if (!isConfigured) {
    return { data: null, error: new Error('Supabase is not configured.') }
  }
  const { data, error } = await supabase.rpc('admin_get_equipment_product_image_search_job', {
    p_job_id: jobId,
  })
  if (error) return { data: null, error }
  return { data, error: null }
}

export async function listActiveEquipmentProductImageSearchJobs(limit = 5) {
  const listed = await listEquipmentProductImageSearchJobs({
    activeLimit: limit,
    completedLimit: limit,
  })
  if (listed.error) return { jobs: [], error: listed.error }
  return {
    jobs: [...listed.active, ...listed.completed],
    active: listed.active,
    completed: listed.completed,
    cleaned: listed.cleaned,
    error: null,
  }
}

export async function listEquipmentProductImageSearchJobs({
  activeLimit = 20,
  completedLimit = 20,
  runCleanup = true,
} = {}) {
  const { isConfigured, supabase } = await getSupabaseClient()
  if (!isConfigured) {
    return {
      active: [],
      completed: [],
      cleaned: 0,
      error: new Error('Supabase is not configured.'),
    }
  }

  const { data, error } = await supabase.rpc('admin_list_equipment_product_image_search_jobs', {
    p_active_limit: activeLimit,
    p_completed_limit: completedLimit,
    p_run_cleanup: runCleanup,
  })

  if (error) {
    // Fallback for environments that only have the legacy list RPC.
    const legacy = await supabase.rpc('admin_list_active_equipment_product_image_search_jobs', {
      p_limit: Math.max(activeLimit, completedLimit),
    })
    if (legacy.error) {
      return { active: [], completed: [], cleaned: 0, error: legacy.error }
    }
    return {
      ...normalizeImageSearchJobsListPayload(legacy.data),
      error: null,
    }
  }

  return {
    ...normalizeImageSearchJobsListPayload(data),
    error: null,
  }
}

export async function deleteEquipmentProductImageSearchJob(jobId) {
  const { isConfigured, supabase } = await getSupabaseClient()
  if (!isConfigured) {
    return { data: null, error: new Error('Supabase is not configured.') }
  }
  const { data, error } = await supabase.rpc('admin_delete_equipment_product_image_search_job', {
    p_job_id: jobId,
  })
  if (error) return { data: null, error }
  return { data, error: null }
}

export async function clearCompletedEquipmentProductImageSearchJobs() {
  const { isConfigured, supabase } = await getSupabaseClient()
  if (!isConfigured) {
    return { data: null, error: new Error('Supabase is not configured.') }
  }
  const { data, error } = await supabase.rpc('admin_clear_completed_equipment_product_image_search_jobs')
  if (error) return { data: null, error }
  return { data, error: null }
}

export async function rerunEquipmentProductImageSearchJob(jobId) {
  const { isConfigured, supabase } = await getSupabaseClient()
  if (!isConfigured) {
    return { result: null, error: new Error('Supabase is not configured.') }
  }
  const { data, error } = await supabase.rpc('admin_rerun_equipment_product_image_search_job', {
    p_job_id: jobId,
  })
  if (error) return { result: null, error }
  return { result: data, error: null }
}

export async function cancelEquipmentProductImageSearchJob(jobId) {
  const { isConfigured, supabase } = await getSupabaseClient()
  if (!isConfigured) {
    return { data: null, error: new Error('Supabase is not configured.') }
  }
  const { data, error } = await supabase.rpc('admin_cancel_equipment_product_image_search_job', {
    p_job_id: jobId,
  })
  if (error) return { data: null, error }
  return { data, error: null }
}

export async function retryEquipmentProductImageSearchJob(jobId, statuses = ['failed', 'no_result']) {
  const { isConfigured, supabase } = await getSupabaseClient()
  if (!isConfigured) {
    return { data: null, error: new Error('Supabase is not configured.') }
  }
  const { data, error } = await supabase.rpc('admin_retry_equipment_product_image_search_job', {
    p_job_id: jobId,
    p_statuses: statuses,
  })
  if (error) return { data: null, error }
  return { data, error: null }
}

export async function runEquipmentProductImageSearchJobStep(jobId, {
  maxItems = IMAGE_SEARCH_JOB_WORKER_BATCH_SIZE,
} = {}) {
  const { isConfigured, supabase } = await getSupabaseClient()
  if (!isConfigured) {
    return { data: null, error: new Error('Supabase is not configured.') }
  }

  const { data, error } = await supabase.functions.invoke('equipment-product-image-search-job', {
    body: {
      job_id: jobId,
      max_items: maxItems,
    },
  })

  if (error) return { data: null, error }
  if (data?.error) return { data: null, error: new Error(data.error) }
  return { data, error: null }
}

export async function fetchJobItemStatusesForProducts(productIds = []) {
  const { isConfigured, supabase } = await getSupabaseClient()
  if (!isConfigured || !productIds.length) {
    return { byProductId: new Map(), error: null }
  }

  const { data, error } = await supabase
    .from('equipment_product_image_search_job_items')
    .select('product_id, status, job_id, updated_at')
    .in('product_id', productIds)
    .in('status', ['queued', 'searching', 'candidate_found', 'no_result', 'failed', 'skipped_approved'])
    .order('updated_at', { ascending: false })

  if (error) return { byProductId: new Map(), error }

  const byProductId = new Map()
  for (const row of data ?? []) {
    if (!byProductId.has(row.product_id)) {
      byProductId.set(row.product_id, row)
    }
  }
  return { byProductId, error: null }
}
