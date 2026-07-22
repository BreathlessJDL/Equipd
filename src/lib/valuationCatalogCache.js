/**
 * Shared caches for valuation search / details.
 * Autocomplete uses the compact static search index; full catalogue is no longer
 * required to show suggestions.
 */

import {
  fetchConsoleModifiers,
  fetchProductConsoleOptions,
} from './equipmentProducts.js'
import {
  VALUATION_SEARCH_INDEX_PATH,
  normalizeValuationSearchIndexPayload,
  readValuationSearchIndexFromSessionStorage,
  writeValuationSearchIndexToSessionStorage,
} from './valuationSearchIndex.js'

let cachedSearchIndex = null
let searchIndexInflight = null
let searchIndexFailure = null

let cachedModifiers = null
let modifiersInflight = null

const consoleOptionsByProductId = new Map()
const consoleOptionsInflight = new Map()

function resolveSearchIndexUrl() {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}${VALUATION_SEARCH_INDEX_PATH}`
  }
  return VALUATION_SEARCH_INDEX_PATH
}

async function fetchValuationSearchIndexNetwork() {
  const response = await fetch(resolveSearchIndexUrl(), {
    method: 'GET',
    credentials: 'same-origin',
    headers: { Accept: 'application/json' },
  })
  if (!response.ok) {
    throw new Error(`Failed to load valuation search index (${response.status}).`)
  }
  const payload = normalizeValuationSearchIndexPayload(await response.json())
  writeValuationSearchIndexToSessionStorage(payload)
  return payload
}

/**
 * Compact approved-product rows for local autocomplete ranking.
 * Dedupes in-flight requests and reuses memory + sessionStorage caches.
 */
export async function getValuationSearchIndex({ force = false } = {}) {
  if (!force && cachedSearchIndex?.products) {
    return { products: cachedSearchIndex.products, meta: cachedSearchIndex, error: null }
  }

  if (!force) {
    const fromSession = readValuationSearchIndexFromSessionStorage()
    if (fromSession?.products) {
      cachedSearchIndex = fromSession
      return { products: fromSession.products, meta: fromSession, error: null }
    }
  }

  if (!force && searchIndexInflight) {
    return searchIndexInflight
  }

  searchIndexInflight = fetchValuationSearchIndexNetwork()
    .then((payload) => {
      cachedSearchIndex = payload
      searchIndexFailure = null
      return { products: payload.products, meta: payload, error: null }
    })
    .catch((error) => {
      searchIndexFailure = error
      return { products: cachedSearchIndex?.products ?? [], meta: cachedSearchIndex, error }
    })
    .finally(() => {
      searchIndexInflight = null
    })

  return searchIndexInflight
}

/** Fire-and-forget prefetch for idle/focus paths. */
export function prefetchValuationSearchIndex() {
  void getValuationSearchIndex()
}

export function getValuationSearchIndexLoadState() {
  if (!cachedSearchIndex?.products) {
    const fromSession = readValuationSearchIndexFromSessionStorage()
    if (fromSession?.products) {
      cachedSearchIndex = fromSession
    }
  }
  return {
    ready: Boolean(cachedSearchIndex?.products),
    inflight: Boolean(searchIndexInflight),
    error: searchIndexFailure,
    count: cachedSearchIndex?.products?.length ?? 0,
  }
}

/**
 * @deprecated Prefer getValuationSearchIndex for autocomplete.
 * Kept as an alias so older call sites resolve to the compact index.
 */
export async function getValuationCatalogProducts() {
  return getValuationSearchIndex()
}

export async function getValuationConsoleModifiers() {
  if (Array.isArray(cachedModifiers)) {
    return { modifiers: cachedModifiers, error: null }
  }

  if (!modifiersInflight) {
    modifiersInflight = fetchConsoleModifiers()
      .then((result) => {
        if (!result.error) {
          cachedModifiers = result.modifiers ?? []
        }
        return result
      })
      .finally(() => {
        modifiersInflight = null
      })
  }

  return modifiersInflight
}

export async function getProductConsoleOptionsCached(productId) {
  const id = String(productId ?? '').trim()
  if (!id) {
    return { options: [], source: null, error: null }
  }

  if (consoleOptionsByProductId.has(id)) {
    return consoleOptionsByProductId.get(id)
  }

  if (consoleOptionsInflight.has(id)) {
    return consoleOptionsInflight.get(id)
  }

  const request = fetchProductConsoleOptions(id)
    .then((result) => {
      if (!result.error) {
        consoleOptionsByProductId.set(id, result)
      }
      return result
    })
    .finally(() => {
      consoleOptionsInflight.delete(id)
    })

  consoleOptionsInflight.set(id, request)
  return request
}

export function prefetchProductConsoleOptions(productId) {
  void getProductConsoleOptionsCached(productId)
}

export function clearValuationCatalogCache() {
  cachedSearchIndex = null
  searchIndexInflight = null
  searchIndexFailure = null
  cachedModifiers = null
  modifiersInflight = null
  consoleOptionsByProductId.clear()
  consoleOptionsInflight.clear()
}
