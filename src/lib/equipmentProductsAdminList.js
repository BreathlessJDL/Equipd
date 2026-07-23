/**
 * Paginated admin list + dashboard meta for Intelligence Products.
 * Uses additive RPCs — does not load the full catalogue for browsing.
 */

import { isSupabaseConfigured, supabase } from './supabase.js'
import { EQUIPMENT_PRODUCT_FIELDS } from './equipmentProducts.js'
import {
  buildAdminListEquipmentProductsRpcArgs,
  clampEquipmentProductListPage,
  clampEquipmentProductListPageSize,
  EQUIPMENT_PRODUCT_LIST_DEFAULT_PAGE_SIZE,
  normalizeFilterOptionList,
} from './equipmentProductsAdminListState.js'

export {
  applyEquipmentProductListQueryPatch,
  buildAdminListEquipmentProductsRpcArgs,
  buildEquipmentProductListQueryParams,
  clampEquipmentProductListPage,
  clampEquipmentProductListPageSize,
  EQUIPMENT_PRODUCT_LIST_DEFAULT_PAGE_SIZE,
  EQUIPMENT_PRODUCT_LIST_MAX_PAGE_SIZE,
  EQUIPMENT_PRODUCT_LIST_PAGE_SIZES,
  EQUIPMENT_PRODUCT_LIST_SORTS,
  mergeEquipmentProductListQuery,
  normalizeFilterOptionList,
  parseEquipmentProductListQueryParams,
} from './equipmentProductsAdminListState.js'

/** Compact fields already returned by admin_list_equipment_products (documentation). */
export const EQUIPMENT_PRODUCT_LIST_FIELDS = [
  'id',
  'brand',
  'product_family',
  'model',
  'equipment_type',
  'canonical_product_name',
  'canonical_product_key',
  'baseline_manufacture_year',
  'production_start_year',
  'production_end_year',
  'original_base_price',
  'original_base_price_currency',
  'original_price_confidence',
  'baseline_source',
  'status',
  'image_url',
  'image_storage_path',
  'image_source_url',
  'image_source_domain',
  'image_confidence',
  'image_status',
  'image_failure_reason',
  'image_updated_at',
  'image_reviewed_at',
  'image_reviewed_by',
  'approved_image_candidate_id',
  'latest_image_candidate_id',
  'latest_image_candidate_status',
  'latest_image_candidate_job_id',
  'latest_image_candidate_source_domain',
  'latest_image_candidate_score',
  'latest_image_candidate_identity_score',
  'latest_image_candidate_rejection_reason',
  'updated_at',
  'created_at',
  'source_intelligence_row_ids',
  'source_row_count',
  'content_generation_status',
  'completion_status',
]

function emptyListResult(error = null) {
  return {
    products: [],
    totalCount: 0,
    page: 1,
    pageSize: EQUIPMENT_PRODUCT_LIST_DEFAULT_PAGE_SIZE,
    error,
  }
}

function normalizeListRow(row) {
  if (!row) return null
  return {
    ...row,
    source_row_count: Number(row.source_row_count) || 0,
    source_intelligence_row_ids: Array.isArray(row.source_intelligence_row_ids)
      ? row.source_intelligence_row_ids
      : [],
  }
}

export async function fetchAdminEquipmentProductsPage({
  search = '',
  brand = '',
  status = '',
  equipmentType = '',
  completion = '',
  attention = 'all',
  imageFilter = '',
  imageSearchJobId = '',
  imageSourceDomain = '',
  minImageConfidence = '',
  minCandidateScore = '',
  page = 1,
  pageSize = EQUIPMENT_PRODUCT_LIST_DEFAULT_PAGE_SIZE,
  sort = 'canonical_product_name',
  sortDir = 'asc',
} = {}) {
  if (!isSupabaseConfigured || !supabase) {
    return emptyListResult(new Error('Supabase is not configured.'))
  }

  const safePageSize = clampEquipmentProductListPageSize(pageSize)
  const safePage = Math.max(1, Math.trunc(Number(page) || 1))

  const rpcArgs = buildAdminListEquipmentProductsRpcArgs({
    search,
    brand,
    status,
    equipmentType,
    completion,
    attention,
    imageFilter,
    imageSearchJobId,
    imageSourceDomain,
    minImageConfidence,
    minCandidateScore,
    page: safePage,
    pageSize: safePageSize,
    sort,
    sortDir,
  })

  const { data, error } = await supabase.rpc('admin_list_equipment_products', rpcArgs)

  if (error) return emptyListResult(error)

  const payload = data && typeof data === 'object' ? data : {}
  const rows = Array.isArray(payload.rows) ? payload.rows.map(normalizeListRow).filter(Boolean) : []
  const totalCount = Number(payload.total_count) || 0
  const resolvedPage = clampEquipmentProductListPage(
    Number(payload.page) || safePage,
    totalCount,
    Number(payload.page_size) || safePageSize,
  )

  return {
    products: rows,
    totalCount,
    page: resolvedPage,
    pageSize: Number(payload.page_size) || safePageSize,
    error: null,
  }
}

export async function fetchAdminEquipmentProductsDashboardMeta() {
  if (!isSupabaseConfigured || !supabase) {
    return { meta: null, error: new Error('Supabase is not configured.') }
  }

  const { data, error } = await supabase.rpc('admin_equipment_products_dashboard_meta')
  if (error) return { meta: null, error }

  const parsed = parseRpcJsonObject(data)
  if (!parsed) return { meta: null, error: null }

  const filterOptionsRaw = parsed.filterOptions ?? parsed.filter_options ?? {}
  return {
    meta: {
      ...parsed,
      summary: parsed.summary ?? null,
      statusCounts: parsed.statusCounts ?? parsed.status_counts ?? null,
      completion: parsed.completion ?? null,
      filterOptions: {
        brands: normalizeFilterOptionList(filterOptionsRaw.brands),
        equipmentTypes: normalizeFilterOptionList(
          filterOptionsRaw.equipmentTypes ?? filterOptionsRaw.equipment_types,
        ),
      },
    },
    error: null,
  }
}

/**
 * Lightweight distinct brand / category options for admin filter dropdowns.
 * Does not depend on the heavy dashboard meta RPC (which can fail/timeout
 * without blocking product list browsing).
 */
export async function fetchAdminEquipmentProductFilterOptions() {
  if (!isSupabaseConfigured || !supabase) {
    return {
      brands: [],
      equipmentTypes: [],
      error: new Error('Supabase is not configured.'),
    }
  }

  const rows = []
  let from = 0
  const pageSize = 1000

  while (true) {
    const { data, error } = await supabase
      .from('equipment_products')
      .select('brand, equipment_type')
      .order('brand', { ascending: true })
      .range(from, from + pageSize - 1)

    if (error) {
      return { brands: [], equipmentTypes: [], error }
    }

    const batch = data ?? []
    rows.push(...batch)
    if (batch.length < pageSize) break
    from += pageSize
    if (from > 20_000) break
  }

  return {
    brands: normalizeFilterOptionList(rows.map((row) => row.brand)),
    equipmentTypes: normalizeFilterOptionList(rows.map((row) => row.equipment_type)),
    error: null,
  }
}

function parseRpcJsonObject(data) {
  if (data == null) return null
  if (typeof data === 'object' && !Array.isArray(data)) return data
  if (typeof data === 'string') {
    try {
      const parsed = JSON.parse(data)
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null
    } catch {
      return null
    }
  }
  return null
}

export async function fetchAdminEquipmentProductById(productId) {
  const id = String(productId ?? '').trim()
  if (!id) return { product: null, error: null, notFound: true }
  if (!isSupabaseConfigured || !supabase) {
    return { product: null, error: new Error('Supabase is not configured.'), notFound: false }
  }

  const { data, error } = await supabase
    .from('equipment_products')
    .select(EQUIPMENT_PRODUCT_FIELDS)
    .eq('id', id)
    .maybeSingle()

  return {
    product: data ?? null,
    error,
    notFound: !data && !error,
  }
}

export async function fetchAdminEquipmentProductByKey(canonicalProductKey) {
  const key = String(canonicalProductKey ?? '').trim()
  if (!key) return { product: null, error: null, notFound: true }
  if (!isSupabaseConfigured || !supabase) {
    return { product: null, error: new Error('Supabase is not configured.'), notFound: false }
  }

  const { data, error } = await supabase
    .from('equipment_products')
    .select(EQUIPMENT_PRODUCT_FIELDS)
    .eq('canonical_product_key', key)
    .maybeSingle()

  return {
    product: data ?? null,
    error,
    notFound: !data && !error,
  }
}

/**
 * Fetch products by id for selected / current-page research export scopes.
 * Preserves deterministic brand → name → id ordering.
 */
export async function fetchAdminEquipmentProductsByIds(ids = [], {
  maxRows = 10000,
} = {}) {
  const unique = [...new Set((ids || []).map((id) => String(id || '').trim()).filter(Boolean))]
    .slice(0, maxRows)
  if (!unique.length) {
    return { products: [], totalCount: 0, truncated: false, error: null }
  }
  if (!isSupabaseConfigured || !supabase) {
    return {
      products: [],
      totalCount: 0,
      truncated: false,
      error: new Error('Supabase is not configured.'),
    }
  }

  const products = []
  for (let i = 0; i < unique.length; i += 80) {
    const chunk = unique.slice(i, i + 80)
    const { data, error } = await supabase
      .from('equipment_products')
      .select(EQUIPMENT_PRODUCT_FIELDS)
      .in('id', chunk)
    if (error) {
      return { products, totalCount: products.length, truncated: false, error }
    }
    products.push(...(data ?? []).map(normalizeListRow).filter(Boolean))
  }

  products.sort((a, b) => {
    const brandCmp = String(a.brand || '').localeCompare(String(b.brand || ''), 'en', { sensitivity: 'base' })
    if (brandCmp !== 0) return brandCmp
    const nameCmp = String(a.canonical_product_name || '').localeCompare(
      String(b.canonical_product_name || ''),
      'en',
      { sensitivity: 'base' },
    )
    if (nameCmp !== 0) return nameCmp
    return String(a.id).localeCompare(String(b.id))
  })

  return {
    products,
    totalCount: products.length,
    truncated: unique.length < ids.filter(Boolean).length,
    error: null,
  }
}

export async function fetchAdminEquipmentProductsForExport({
  brand = '',
  equipmentType = '',
  completion = 'incomplete',
  status = 'approved',
  search = '',
  attention = 'all',
  imageFilter = '',
  imageSearchJobId = '',
  imageSourceDomain = '',
  minImageConfidence = '',
  minCandidateScore = '',
  pageSize = 100,
  sort = 'brand',
  sortDir = 'asc',
  maxRows = 10000,
} = {}) {
  const products = []
  let page = 1
  let totalCount = Infinity

  while (products.length < totalCount && products.length < maxRows) {
    const result = await fetchAdminEquipmentProductsPage({
      brand,
      equipmentType,
      completion,
      status,
      search,
      attention,
      imageFilter,
      imageSearchJobId,
      imageSourceDomain,
      minImageConfidence,
      minCandidateScore,
      page,
      pageSize: clampEquipmentProductListPageSize(pageSize),
      sort,
      sortDir,
    })
    if (result.error) {
      return { products, totalCount: products.length, error: result.error }
    }
    totalCount = result.totalCount
    products.push(...result.products)
    if (!result.products.length || products.length >= totalCount) break
    page += 1
    if (page > 500) break
  }

  return {
    products: products.slice(0, maxRows),
    totalCount,
    truncated: totalCount > maxRows,
    error: null,
  }
}

export function buildContentStatusMapFromListRows(products = []) {
  const map = {}
  for (const product of products) {
    if (!product?.id) continue
    if (product.content_generation_status) {
      map[product.id] = { generation_status: product.content_generation_status }
    }
  }
  return map
}
