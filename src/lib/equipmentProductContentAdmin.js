import {
  EQUIPMENT_PRODUCT_CONTENT_FIELDS,
  EQUIPMENT_PRODUCT_CONTENT_STATUS,
} from './equipmentProductContentPage.js'

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

/** UI label for generation_status — "Published" maps to DB `approved`. */
export function getEquipmentProductContentStatusLabel(status) {
  if (status === EQUIPMENT_PRODUCT_CONTENT_STATUS.APPROVED) return 'Published'
  if (status === EQUIPMENT_PRODUCT_CONTENT_STATUS.DRAFT) return 'Draft'
  if (status === EQUIPMENT_PRODUCT_CONTENT_STATUS.FAILED) return 'Failed'
  if (status === EQUIPMENT_PRODUCT_CONTENT_STATUS.REJECTED) return 'Rejected'
  if (status === EQUIPMENT_PRODUCT_CONTENT_STATUS.STALE) return 'Stale'
  return status ? String(status) : 'Missing'
}

export function summarizeEquipmentProductContentStatuses(rows = []) {
  const summary = {
    draft: 0,
    published: 0,
    failed: 0,
    rejected: 0,
    stale: 0,
    total: rows.length,
  }

  for (const row of rows) {
    const status = row?.generation_status
    if (status === EQUIPMENT_PRODUCT_CONTENT_STATUS.DRAFT) summary.draft += 1
    else if (status === EQUIPMENT_PRODUCT_CONTENT_STATUS.APPROVED) summary.published += 1
    else if (status === EQUIPMENT_PRODUCT_CONTENT_STATUS.FAILED) summary.failed += 1
    else if (status === EQUIPMENT_PRODUCT_CONTENT_STATUS.REJECTED) summary.rejected += 1
    else if (status === EQUIPMENT_PRODUCT_CONTENT_STATUS.STALE) summary.stale += 1
  }

  return summary
}

export function isPublishableEquipmentProductContent(row) {
  return row?.generation_status === EQUIPMENT_PRODUCT_CONTENT_STATUS.DRAFT
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
      .filter((row) => selected.has(row.id) || selected.has(row.equipment_product_id))
      .map((row) => row.id)
  }

  if (scope === CONTENT_PUBLISH_SCOPE.CURRENT_BRAND) {
    if (!brandFilter) return []
    return drafts
      .filter((row) => String(row.brand ?? '').trim() === brandFilter)
      .map((row) => row.id)
  }

  if (scope === CONTENT_PUBLISH_SCOPE.ALL_DRAFTS) {
    return drafts.map((row) => row.id)
  }

  return []
}

export function buildPublishDraftsConfirmationMessage(count) {
  const n = Number(count) || 0
  return [
    `You are about to publish ${n} draft description${n === 1 ? '' : 's'}.`,
    '',
    'These descriptions will become visible on public equipment pages.',
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

function normalizeJoinedProduct(row) {
  const product = Array.isArray(row?.equipment_products)
    ? row.equipment_products[0]
    : row?.equipment_products

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
    brand: product?.brand ?? row.brand ?? null,
    canonical_product_name: product?.canonical_product_name ?? row.canonical_product_name ?? null,
    canonical_product_key: product?.canonical_product_key ?? row.canonical_product_key ?? null,
  }
}

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

  const pageSize = 1000
  const rows = []
  let from = 0

  while (true) {
    const { data, error } = await client
      .from('equipment_product_content')
      .select(`${EQUIPMENT_PRODUCT_CONTENT_FIELDS}, equipment_products ( brand, canonical_product_name, canonical_product_key )`)
      .order('generated_at', { ascending: false, nullsFirst: false })
      .range(from, from + pageSize - 1)

    if (error) return { rows: [], error }
    const chunk = (data ?? []).map(normalizeJoinedProduct)
    rows.push(...chunk)
    if (chunk.length < pageSize) break
    from += pageSize
  }

  return { rows, error: null }
}

/**
 * Publish draft content rows to approved (Published).
 * Only updates generation_status; only rows currently in draft are changed.
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
  const chunkSize = 100
  const update = buildPublishEquipmentProductContentUpdate()

  for (let index = 0; index < ids.length; index += chunkSize) {
    const chunk = ids.slice(index, index + chunkSize)
    const { data, error } = await client
      .from('equipment_product_content')
      .update(update)
      .in('id', chunk)
      .eq('generation_status', EQUIPMENT_PRODUCT_CONTENT_STATUS.DRAFT)
      .select('id')

    if (error) {
      return { publishedIds, publishedCount: publishedIds.length, error }
    }

    publishedIds.push(...(data ?? []).map((row) => row.id))
  }

  return {
    publishedIds,
    publishedCount: publishedIds.length,
    error: null,
  }
}
