/**
 * Compact valuation search-index contract + helpers.
 * Autocomplete uses this lean payload instead of the full catalogue.
 */

export const VALUATION_SEARCH_INDEX_VERSION = 1
export const VALUATION_SEARCH_INDEX_PATH = '/data/valuation-search-index.json'
export const VALUATION_SEARCH_INDEX_STORAGE_KEY = 'equipd:valuation-search-index:v1'

/** Fields requested when generating the static search index. */
export const VALUATION_SEARCH_INDEX_FIELDS = Object.freeze([
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
  'image_storage_path',
  'image_status',
])

const ALLOWED_FIELD_SET = new Set(VALUATION_SEARCH_INDEX_FIELDS)

export function toValuationSearchIndexRow(product = {}) {
  const row = {}
  for (const field of VALUATION_SEARCH_INDEX_FIELDS) {
    row[field] = product?.[field] ?? null
  }
  return row
}

export function assertValuationSearchIndexRowShape(row = {}) {
  const keys = Object.keys(row)
  for (const key of keys) {
    if (!ALLOWED_FIELD_SET.has(key)) {
      throw new Error(`Unexpected valuation search-index field: ${key}`)
    }
  }
  for (const field of VALUATION_SEARCH_INDEX_FIELDS) {
    if (!(field in row)) {
      throw new Error(`Missing valuation search-index field: ${field}`)
    }
  }
  return true
}

export function normalizeValuationSearchIndexPayload(payload) {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Valuation search index payload is invalid.')
  }
  const version = Number(payload.version)
  if (!Number.isFinite(version) || version < 1) {
    throw new Error('Valuation search index version is invalid.')
  }
  if (!Array.isArray(payload.products)) {
    throw new Error('Valuation search index products must be an array.')
  }
  const products = payload.products.map((row) => toValuationSearchIndexRow(row))
  return {
    version,
    generatedAt: payload.generatedAt ?? null,
    count: products.length,
    products,
  }
}

export function readValuationSearchIndexFromSessionStorage(storage = null) {
  try {
    const store = storage || (typeof sessionStorage !== 'undefined' ? sessionStorage : null)
    if (!store) return null
    const raw = store.getItem(VALUATION_SEARCH_INDEX_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    const normalized = normalizeValuationSearchIndexPayload(parsed)
    if (normalized.version !== VALUATION_SEARCH_INDEX_VERSION) return null
    return normalized
  } catch {
    return null
  }
}

export function writeValuationSearchIndexToSessionStorage(payload, storage = null) {
  try {
    const store = storage || (typeof sessionStorage !== 'undefined' ? sessionStorage : null)
    if (!store) return false
    store.setItem(VALUATION_SEARCH_INDEX_STORAGE_KEY, JSON.stringify(payload))
    return true
  } catch {
    return false
  }
}
