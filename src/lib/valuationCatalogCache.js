/**
 * Lazy-loaded cache for approved canonical products used by valuation search UIs.
 * Avoids fetching the catalogue on every homepage render.
 */

import { fetchDedupedApprovedCanonicalProducts } from './equipmentProducts.js'

let cachedProducts = null
let inflight = null

export async function getValuationCatalogProducts() {
  if (Array.isArray(cachedProducts)) {
    return { products: cachedProducts, error: null }
  }

  if (!inflight) {
    inflight = fetchDedupedApprovedCanonicalProducts()
      .then((result) => {
        if (!result.error) {
          cachedProducts = result.products ?? []
        }
        return result
      })
      .finally(() => {
        inflight = null
      })
  }

  return inflight
}

export function clearValuationCatalogCache() {
  cachedProducts = null
  inflight = null
}
