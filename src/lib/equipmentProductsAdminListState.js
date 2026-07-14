/**
 * Pure URL/pagination helpers for the admin products list (no Supabase import).
 */

export const EQUIPMENT_PRODUCT_LIST_PAGE_SIZES = [25, 50, 100]
export const EQUIPMENT_PRODUCT_LIST_DEFAULT_PAGE_SIZE = 50
export const EQUIPMENT_PRODUCT_LIST_MAX_PAGE_SIZE = 100

export const EQUIPMENT_PRODUCT_LIST_SORTS = [
  'canonical_product_name',
  'brand',
  'status',
  'updated_at',
  'original_base_price',
  'baseline_manufacture_year',
  'equipment_type',
]

const FILTER_CHANGE_KEYS = new Set([
  'search',
  'brand',
  'status',
  'equipmentType',
  'completion',
  'attention',
  'sort',
  'sortDir',
  'imageFilter',
  'pageSize',
])

export function clampEquipmentProductListPageSize(pageSize) {
  const n = Number(pageSize)
  if (!Number.isFinite(n)) return EQUIPMENT_PRODUCT_LIST_DEFAULT_PAGE_SIZE
  return Math.min(
    EQUIPMENT_PRODUCT_LIST_MAX_PAGE_SIZE,
    Math.max(1, Math.trunc(n)),
  )
}

export function clampEquipmentProductListPage(page, totalCount, pageSize) {
  const size = clampEquipmentProductListPageSize(pageSize)
  const total = Math.max(0, Number(totalCount) || 0)
  const maxPage = Math.max(1, Math.ceil(total / size) || 1)
  const n = Math.trunc(Number(page) || 1)
  if (!Number.isFinite(n) || n < 1) return 1
  return Math.min(n, maxPage)
}

export function buildEquipmentProductListQueryParams(state = {}) {
  const params = new URLSearchParams()
  const page = Math.max(1, Math.trunc(Number(state.page) || 1))
  const pageSize = clampEquipmentProductListPageSize(state.pageSize)
  const search = String(state.search ?? '').trim()
  const brand = String(state.brand ?? '').trim()
  const status = String(state.status ?? '').trim()
  const equipmentType = String(state.equipmentType ?? '').trim()
  const completion = String(state.completion ?? '').trim()
  const attention = String(state.attention ?? '').trim()
  const sort = String(state.sort ?? '').trim()
  const sortDir = String(state.sortDir ?? '').trim().toLowerCase()
  const imageFilter = String(state.imageFilter ?? '').trim()

  if (page > 1) params.set('page', String(page))
  if (pageSize !== EQUIPMENT_PRODUCT_LIST_DEFAULT_PAGE_SIZE) {
    params.set('pageSize', String(pageSize))
  }
  if (search) params.set('search', search)
  if (brand) params.set('brand', brand)
  if (status) params.set('status', status)
  if (equipmentType) params.set('equipmentType', equipmentType)
  if (completion && completion !== 'all') params.set('completion', completion)
  if (attention && attention !== 'all') params.set('attention', attention)
  if (imageFilter && imageFilter !== 'all') params.set('imageFilter', imageFilter)
  if (sort && sort !== 'canonical_product_name') params.set('sort', sort)
  if (sortDir === 'desc') params.set('sortDir', 'desc')
  return params
}

export function parseEquipmentProductListQueryParams(searchParams) {
  const get = (key) => {
    if (typeof searchParams?.get === 'function') return searchParams.get(key)
    return searchParams?.[key] ?? null
  }

  const pageSize = clampEquipmentProductListPageSize(
    get('pageSize') || EQUIPMENT_PRODUCT_LIST_DEFAULT_PAGE_SIZE,
  )
  const page = Math.max(1, Math.trunc(Number(get('page')) || 1))
  const sortRaw = String(get('sort') || 'canonical_product_name').trim()
  const sort = EQUIPMENT_PRODUCT_LIST_SORTS.includes(sortRaw)
    ? sortRaw
    : 'canonical_product_name'

  return {
    page,
    pageSize,
    search: String(get('search') || '').trim(),
    brand: String(get('brand') || '').trim(),
    status: String(get('status') || '').trim(),
    equipmentType: String(get('equipmentType') || '').trim(),
    completion: String(get('completion') || '').trim(),
    attention: String(get('attention') || 'all').trim() || 'all',
    imageFilter: String(get('imageFilter') || '').trim(),
    sort,
    sortDir: String(get('sortDir') || 'asc').trim().toLowerCase() === 'desc' ? 'desc' : 'asc',
  }
}

/**
 * Merge a patch into the current list query.
 * Any filter / pageSize change resets page to 1 unless resetPage is false
 * and the patch only changes page.
 */
export function mergeEquipmentProductListQuery(current = {}, patch = {}, {
  resetPage = undefined,
} = {}) {
  const base = {
    page: 1,
    pageSize: EQUIPMENT_PRODUCT_LIST_DEFAULT_PAGE_SIZE,
    search: '',
    brand: '',
    status: '',
    equipmentType: '',
    completion: '',
    attention: 'all',
    imageFilter: '',
    sort: 'canonical_product_name',
    sortDir: 'asc',
    ...current,
  }

  const next = { ...base, ...patch }

  next.search = String(next.search ?? '').trim()
  next.brand = String(next.brand ?? '').trim()
  next.status = String(next.status ?? '').trim()
  next.equipmentType = String(next.equipmentType ?? '').trim()
  next.completion = String(next.completion ?? '').trim()
  next.attention = String(next.attention ?? 'all').trim() || 'all'
  next.imageFilter = String(next.imageFilter ?? '').trim()
  next.pageSize = clampEquipmentProductListPageSize(next.pageSize)
  next.page = Math.max(1, Math.trunc(Number(next.page) || 1))
  next.sort = EQUIPMENT_PRODUCT_LIST_SORTS.includes(next.sort)
    ? next.sort
    : 'canonical_product_name'
  next.sortDir = next.sortDir === 'desc' ? 'desc' : 'asc'

  const patchKeys = Object.keys(patch)
  const filterChanged = patchKeys.some((key) => FILTER_CHANGE_KEYS.has(key))
  const shouldResetPage = resetPage == null ? filterChanged : resetPage
  if (shouldResetPage) next.page = 1

  return next
}

/**
 * Build URLSearchParams from a previous URL + patch, preserving non-list params like edit.
 */
export function applyEquipmentProductListQueryPatch(previousSearchParams, patch = {}, options = {}) {
  const previous = previousSearchParams instanceof URLSearchParams
    ? previousSearchParams
    : new URLSearchParams(previousSearchParams ?? '')
  const current = parseEquipmentProductListQueryParams(previous)
  const merged = mergeEquipmentProductListQuery(current, patch, options)
  const params = buildEquipmentProductListQueryParams(merged)
  const edit = previous.get('edit')
  if (edit) params.set('edit', edit)
  if (params.toString() === previous.toString()) return previous
  return params
}

/**
 * Named arguments for admin_list_equipment_products.
 * Inactive filters must be null (not "" / "all").
 */
export function buildAdminListEquipmentProductsRpcArgs(query = {}) {
  const pageSize = clampEquipmentProductListPageSize(query.pageSize)
  const page = Math.max(1, Math.trunc(Number(query.page) || 1))
  const attention = String(query.attention ?? '').trim()
  const completion = String(query.completion ?? '').trim()
  const imageFilter = String(query.imageFilter ?? '').trim()

  return {
    p_search: String(query.search ?? '').trim() || null,
    p_brand: String(query.brand ?? '').trim() || null,
    p_status: String(query.status ?? '').trim() || null,
    p_equipment_type: String(query.equipmentType ?? '').trim() || null,
    p_completion: !completion || completion === 'all' ? null : completion,
    p_attention: !attention || attention === 'all' ? null : attention,
    p_image_filter: !imageFilter || imageFilter === 'all' ? null : imageFilter,
    p_page: page,
    p_page_size: pageSize,
    p_sort: EQUIPMENT_PRODUCT_LIST_SORTS.includes(query.sort)
      ? query.sort
      : 'canonical_product_name',
    p_sort_dir: query.sortDir === 'desc' ? 'desc' : 'asc',
  }
}

/** Coerce meta RPC option arrays into distinct primitive strings. */
export function normalizeFilterOptionList(values = []) {
  if (!Array.isArray(values)) return []

  const labels = values.map((value) => {
    if (value == null) return ''
    if (typeof value === 'string' || typeof value === 'number') {
      return String(value).trim()
    }
    if (typeof value === 'object') {
      return String(
        value.brand
        ?? value.name
        ?? value.equipment_type
        ?? value.equipmentType
        ?? value.value
        ?? value.label
        ?? '',
      ).trim()
    }
    return String(value).trim()
  }).filter(Boolean)

  return [...new Set(labels)].sort((a, b) => a.localeCompare(b))
}
