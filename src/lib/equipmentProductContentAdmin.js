import {
  EQUIPMENT_PRODUCT_CONTENT_FIELDS,
  EQUIPMENT_PRODUCT_CONTENT_STATUS,
} from './equipmentProductContentPage.js'
import { PRODUCT_STATUS } from './intelligenceCanonicalProducts.js'

export const CONTENT_PUBLISH_SCOPE = {
  SELECTED: 'selected',
  CURRENT_BRAND: 'current_brand',
  ALL_DRAFTS: 'all_drafts',
}

export const CONTENT_PUBLISH_SCOPE_LABELS = {
  [CONTENT_PUBLISH_SCOPE.SELECTED]: 'Selected products',
  [CONTENT_PUBLISH_SCOPE.CURRENT_BRAND]: 'Current brand',
  [CONTENT_PUBLISH_SCOPE.ALL_DRAFTS]: 'All drafts',
}

/**
 * Canonical product statuses that may appear in the admin Product Content list
 * for draft description preparation. Public pages still require product + content
 * approval separately.
 */
export const CONTENT_ELIGIBLE_PRODUCT_STATUSES = Object.freeze([
  PRODUCT_STATUS.PENDING,
  PRODUCT_STATUS.NEEDS_REVIEW,
  PRODUCT_STATUS.APPROVED,
])

export const CONTENT_PRODUCT_STATUS_FILTER = {
  ALL: '',
  PENDING: PRODUCT_STATUS.PENDING,
  NEEDS_REVIEW: PRODUCT_STATUS.NEEDS_REVIEW,
  APPROVED: PRODUCT_STATUS.APPROVED,
}

export const CONTENT_PRODUCT_STATUS_FILTER_LABELS = {
  [CONTENT_PRODUCT_STATUS_FILTER.ALL]: 'All eligible',
  [CONTENT_PRODUCT_STATUS_FILTER.PENDING]: 'Pending',
  [CONTENT_PRODUCT_STATUS_FILTER.NEEDS_REVIEW]: 'Needs review',
  [CONTENT_PRODUCT_STATUS_FILTER.APPROVED]: 'Approved',
}

export const CONTENT_GENERATION_STATUS_FILTER = {
  ALL: '',
  MISSING: 'missing',
  DRAFT: EQUIPMENT_PRODUCT_CONTENT_STATUS.DRAFT,
  APPROVED: EQUIPMENT_PRODUCT_CONTENT_STATUS.APPROVED,
  FAILED: EQUIPMENT_PRODUCT_CONTENT_STATUS.FAILED,
  REJECTED: EQUIPMENT_PRODUCT_CONTENT_STATUS.REJECTED,
  STALE: EQUIPMENT_PRODUCT_CONTENT_STATUS.STALE,
}

const ADMIN_CONTENT_PRODUCT_FIELDS = [
  'id',
  'brand',
  'model',
  'status',
  'canonical_product_name',
  'canonical_product_key',
  'equipment_type',
  'original_base_price',
  'baseline_manufacture_year',
  'updated_at',
].join(', ')

/** UI label for generation_status — "Published" maps to DB `approved`. */
export function getEquipmentProductContentStatusLabel(status) {
  if (status === EQUIPMENT_PRODUCT_CONTENT_STATUS.APPROVED) return 'Published'
  if (status === EQUIPMENT_PRODUCT_CONTENT_STATUS.DRAFT) return 'Draft'
  if (status === EQUIPMENT_PRODUCT_CONTENT_STATUS.FAILED) return 'Failed'
  if (status === EQUIPMENT_PRODUCT_CONTENT_STATUS.REJECTED) return 'Rejected'
  if (status === EQUIPMENT_PRODUCT_CONTENT_STATUS.STALE) return 'Stale'
  return status ? String(status) : 'Missing'
}

export function isEligibleAdminProductContentProduct(product) {
  return CONTENT_ELIGIBLE_PRODUCT_STATUSES.includes(product?.status)
}

export function productHasIncompleteContentSourceData(product) {
  const price = Number(product?.original_base_price)
  const missingPrice = !(Number.isFinite(price) && price > 0)
  const missingYear = product?.baseline_manufacture_year == null
  return {
    missingPrice,
    missingYear,
    incomplete: missingPrice || missingYear,
    warning: [
      missingPrice ? 'missing RRP' : null,
      missingYear ? 'missing baseline year' : null,
    ].filter(Boolean).join(', ') || null,
  }
}

export function buildAdminProductContentListRow(product, contentRow = null) {
  if (!product?.id) return null

  const incomplete = productHasIncompleteContentSourceData(product)
  const hasContent = Boolean(contentRow?.id)

  return {
    // Prefer real content-row id so publish selection stays UUID-safe.
    id: hasContent ? contentRow.id : `missing:${product.id}`,
    content_id: hasContent ? contentRow.id : null,
    equipment_product_id: product.id,
    overview_text: contentRow?.overview_text ?? null,
    seo_title: contentRow?.seo_title ?? null,
    seo_meta_description: contentRow?.seo_meta_description ?? null,
    faq_json: contentRow?.faq_json ?? [],
    generation_status: contentRow?.generation_status ?? null,
    source_data_hash: contentRow?.source_data_hash ?? null,
    ai_model: contentRow?.ai_model ?? null,
    generated_at: contentRow?.generated_at ?? null,
    approved_at: contentRow?.approved_at ?? null,
    version: contentRow?.version ?? null,
    created_at: contentRow?.created_at ?? null,
    updated_at: contentRow?.updated_at ?? product.updated_at ?? null,
    error_message: contentRow?.error_message ?? null,
    brand: product.brand ?? null,
    model: product.model ?? null,
    canonical_product_name: product.canonical_product_name ?? null,
    canonical_product_key: product.canonical_product_key ?? null,
    product_status: product.status ?? null,
    equipment_type: product.equipment_type ?? null,
    original_base_price: product.original_base_price ?? null,
    baseline_manufacture_year: product.baseline_manufacture_year ?? null,
    incomplete_source: incomplete,
  }
}

export function buildAdminProductContentListRows(products = [], contentRows = []) {
  const contentByProductId = new Map(
    (contentRows ?? [])
      .filter((row) => row?.equipment_product_id)
      .map((row) => [row.equipment_product_id, row]),
  )

  return (products ?? [])
    .filter(isEligibleAdminProductContentProduct)
    .map((product) => buildAdminProductContentListRow(
      product,
      contentByProductId.get(product.id) ?? null,
    ))
    .filter(Boolean)
    .sort((left, right) => {
      const brandCmp = String(left.brand ?? '').localeCompare(String(right.brand ?? ''))
      if (brandCmp !== 0) return brandCmp
      return String(left.canonical_product_name ?? '')
        .localeCompare(String(right.canonical_product_name ?? ''))
    })
}

export function summarizeEquipmentProductContentStatuses(rows = []) {
  const summary = {
    draft: 0,
    published: 0,
    failed: 0,
    rejected: 0,
    stale: 0,
    missing: 0,
    total: rows.length,
  }

  for (const row of rows) {
    const status = row?.generation_status
    if (!status) summary.missing += 1
    else if (status === EQUIPMENT_PRODUCT_CONTENT_STATUS.DRAFT) summary.draft += 1
    else if (status === EQUIPMENT_PRODUCT_CONTENT_STATUS.APPROVED) summary.published += 1
    else if (status === EQUIPMENT_PRODUCT_CONTENT_STATUS.FAILED) summary.failed += 1
    else if (status === EQUIPMENT_PRODUCT_CONTENT_STATUS.REJECTED) summary.rejected += 1
    else if (status === EQUIPMENT_PRODUCT_CONTENT_STATUS.STALE) summary.stale += 1
  }

  return summary
}

export function matchesAdminContentGenerationStatusFilter(row, generationStatusFilter = '') {
  const filter = String(generationStatusFilter ?? '').trim()
  if (!filter) return true
  if (filter === CONTENT_GENERATION_STATUS_FILTER.MISSING) {
    return !row?.generation_status
  }
  return row?.generation_status === filter
}

export function matchesAdminContentProductStatusFilter(row, productStatusFilter = '') {
  const filter = String(productStatusFilter ?? '').trim()
  if (!filter) return true
  return row?.product_status === filter
}

export function isPublishableEquipmentProductContent(row) {
  const contentId = resolveContentRowId(row)
  return Boolean(contentId)
    && row?.generation_status === EQUIPMENT_PRODUCT_CONTENT_STATUS.DRAFT
}

function resolveContentRowId(row) {
  if (row?.content_id) return row.content_id
  const id = String(row?.id ?? '')
  if (!id || id.startsWith('missing:')) return null
  return id
}

/**
 * Resolve draft content row IDs for a publish scope.
 * @param {object} options
 * @param {Array} options.rows - content rows joined with product brand
 * @param {string} options.scope
 * @param {Set<string>|string[]} options.selectedIds - content row ids
 * @param {string|null} options.brand
 */
export function resolveDraftContentIdsForPublish({
  rows = [],
  scope = CONTENT_PUBLISH_SCOPE.SELECTED,
  selectedIds = [],
  brand = null,
} = {}) {
  const selected = selectedIds instanceof Set ? selectedIds : new Set(selectedIds)
  const brandFilter = String(brand ?? '').trim()
  const drafts = rows.filter(isPublishableEquipmentProductContent)

  if (scope === CONTENT_PUBLISH_SCOPE.SELECTED) {
    return drafts
      .filter((row) => {
        const contentId = resolveContentRowId(row)
        return selected.has(contentId)
          || selected.has(row.id)
          || selected.has(row.equipment_product_id)
      })
      .map((row) => resolveContentRowId(row))
      .filter(Boolean)
  }

  if (scope === CONTENT_PUBLISH_SCOPE.CURRENT_BRAND) {
    if (!brandFilter) return []
    return drafts
      .filter((row) => String(row.brand ?? '').trim() === brandFilter)
      .map((row) => resolveContentRowId(row))
      .filter(Boolean)
  }

  if (scope === CONTENT_PUBLISH_SCOPE.ALL_DRAFTS) {
    return drafts.map((row) => resolveContentRowId(row)).filter(Boolean)
  }

  return []
}

export function buildPublishDraftsConfirmationMessage(count) {
  const n = Number(count) || 0
  return [
    `You are about to publish ${n} draft description${n === 1 ? '' : 's'}.`,
    '',
    'These descriptions will become visible on public equipment pages.',
    'Publishing content does not approve or publish the canonical product itself.',
    '',
    'Continue?',
  ].join('\n')
}

/** Status-only update payload — does not touch hash, generated_at, or body fields. */
export function buildPublishEquipmentProductContentUpdate() {
  return {
    generation_status: EQUIPMENT_PRODUCT_CONTENT_STATUS.APPROVED,
  }
}

function normalizeContentRow(row) {
  return {
    id: row.id,
    equipment_product_id: row.equipment_product_id,
    overview_text: row.overview_text,
    seo_title: row.seo_title,
    seo_meta_description: row.seo_meta_description,
    faq_json: row.faq_json,
    generation_status: row.generation_status,
    source_data_hash: row.source_data_hash,
    ai_model: row.ai_model,
    generated_at: row.generated_at,
    approved_at: row.approved_at,
    version: row.version,
    created_at: row.created_at,
    updated_at: row.updated_at,
    error_message: row.error_message,
  }
}

async function fetchAllEligibleProducts(client) {
  const pageSize = 1000
  const products = []
  let from = 0

  while (true) {
    const { data, error } = await client
      .from('equipment_products')
      .select(ADMIN_CONTENT_PRODUCT_FIELDS)
      .in('status', CONTENT_ELIGIBLE_PRODUCT_STATUSES)
      .order('brand')
      .order('canonical_product_name')
      .range(from, from + pageSize - 1)

    if (error) return { products: [], error }
    const chunk = data ?? []
    products.push(...chunk)
    if (chunk.length < pageSize) break
    from += pageSize
  }

  return { products, error: null }
}

async function fetchContentRowsForProducts(client, productIds = []) {
  if (!productIds.length) return { rows: [], error: null }

  // Keep IN() batches small — large UUID lists exceed PostgREST URL limits (HTTP 400).
  const pageSize = 80
  const rows = []
  for (let index = 0; index < productIds.length; index += pageSize) {
    const chunkIds = productIds.slice(index, index + pageSize)
    const { data, error } = await client
      .from('equipment_product_content')
      .select(EQUIPMENT_PRODUCT_CONTENT_FIELDS)
      .in('equipment_product_id', chunkIds)

    if (error) return { rows: [], error }
    rows.push(...(data ?? []).map(normalizeContentRow))
  }

  return { rows, error: null }
}

/**
 * Admin Product Content list: eligible canonical products left-joined to content.
 * Includes pending / needs_review / approved products even when no content row exists.
 * Excludes excluded (and any other non-eligible) products.
 */
export async function fetchEquipmentProductContentAdminRows({
  supabaseClient = null,
} = {}) {
  let client = supabaseClient
  if (!client) {
    const { isSupabaseConfigured, supabase } = await import('./supabase.js')
    if (!isSupabaseConfigured || !supabase) {
      return { rows: [], error: null }
    }
    client = supabase
  }

  const productsResult = await fetchAllEligibleProducts(client)
  if (productsResult.error) return { rows: [], error: productsResult.error }

  const contentResult = await fetchContentRowsForProducts(
    client,
    productsResult.products.map((product) => product.id),
  )
  if (contentResult.error) return { rows: [], error: contentResult.error }

  return {
    rows: buildAdminProductContentListRows(productsResult.products, contentResult.rows),
    error: null,
  }
}

/**
 * Publish draft content rows to approved (Published).
 * Only updates generation_status; only rows currently in draft are changed.
 * Does not change equipment_products.status.
 */
export async function publishEquipmentProductContentDrafts(contentIds = [], {
  supabaseClient = null,
} = {}) {
  const ids = [...new Set((contentIds ?? []).map((id) => String(id ?? '').trim()).filter(Boolean))]

  if (!ids.length) {
    return { publishedIds: [], publishedCount: 0, error: null }
  }

  let client = supabaseClient
  if (!client) {
    const { isSupabaseConfigured, supabase } = await import('./supabase.js')
    if (!isSupabaseConfigured || !supabase) {
      return { publishedIds: [], publishedCount: 0, error: new Error('Supabase is not configured') }
    }
    client = supabase
  }

  const publishedIds = []
  const publishedRows = []
  const chunkSize = 100
  const update = buildPublishEquipmentProductContentUpdate()

  for (let index = 0; index < ids.length; index += chunkSize) {
    const chunk = ids.slice(index, index + chunkSize)
    const { data, error } = await client
      .from('equipment_product_content')
      .update(update)
      .in('id', chunk)
      .eq('generation_status', EQUIPMENT_PRODUCT_CONTENT_STATUS.DRAFT)
      .select(`${EQUIPMENT_PRODUCT_CONTENT_FIELDS}, equipment_products ( brand, canonical_product_key, status )`)

    if (error) {
      return { publishedIds, publishedCount: publishedIds.length, error }
    }

    for (const row of data ?? []) {
      publishedIds.push(row.id)
      const product = Array.isArray(row.equipment_products)
        ? row.equipment_products[0]
        : row.equipment_products
      publishedRows.push({
        ...normalizeContentRow(row),
        brand: product?.brand ?? null,
        canonical_product_key: product?.canonical_product_key ?? null,
        product_status: product?.status ?? null,
      })
    }
  }

  if (publishedRows.length) {
    try {
      const { notifyIndexNowForEquipmentContentChange } = await import('./indexNowNotify.js')
      notifyIndexNowForEquipmentContentChange({
        rows: publishedRows,
        action: 'publish',
        source: 'publishEquipmentProductContentDrafts',
      })
    } catch {
      // IndexNow is best-effort; admin publish must not fail if notify wiring is unavailable.
    }
  }

  return {
    publishedIds,
    publishedCount: publishedIds.length,
    error: null,
  }
}
