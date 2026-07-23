/**
 * Public brand catalogue data loaders for /brands and /brands/:brandSlug.
 */

import { brandsMatch, normalizeBrandKey } from './consoleModifierMatch.js'
import {
  buildEquipmentProductPagePath,
  fetchApprovedEquipmentProducts,
} from './equipmentProducts.js'
import {
  buildEquipmentProductImagePublicUrl,
  productHasDisplayableImage,
} from './equipmentProductImages.js'
import {
  calculateEquipmentProductValuation,
  formatValuationRange,
  getEquipmentProductCompletionStatus,
} from './equipmentValuation.js'
import { enrichListingWithImages } from './listingImages.js'
import { attachPublicAvailabilityToListings } from './listings.js'
import { isSupabaseConfigured, supabase } from './supabase.js'
import {
  aggregateBrandCategories,
  aggregateBrandSeries,
  buildBrandDirectoryFromProducts,
  buildBrandIntro,
  buildRelatedBrands,
  findUnresolvedBrandDuplicates,
  getBrandAbsoluteUrl,
  getBrandDisplayName,
  getBrandPagePath,
  getBrandSlug,
  getBrowseBrandFilterHref,
  getProductSeriesLabel,
  formatPublicCanonicalProductDisplayName,
  isPublicBrandCatalogueProduct,
  resolveBrandRegistryEntry,
  slugifyBrandName,
} from './brandCatalogueCore.js'

export * from './brandCatalogueCore.js'

export function resolveProductImageUrl(product) {
  if (!productHasDisplayableImage(product)) return null
  if (product.image_storage_path) {
    return buildEquipmentProductImagePublicUrl(product.image_storage_path) || product.image_url || null
  }
  return product.image_url || null
}

function formatYearRange(product) {
  const start = product.production_start_year || product.baseline_manufacture_year
  const end = product.production_end_year
  if (start && end && start !== end) return `${start}–${end}`
  if (start) return `${start}+`
  if (end) return String(end)
  return null
}

function resolveEstimatedValueLabel(product, currency) {
  const completion = getEquipmentProductCompletionStatus(product)
  if (!completion.canValue) return null

  const valuation = calculateEquipmentProductValuation(product)
  if (!valuation?.ok) return null

  const low = Number(valuation.estimated_low)
  const high = Number(valuation.estimated_high)
  if (!Number.isFinite(low) || !Number.isFinite(high) || low <= 0 || high <= 0) {
    return null
  }

  return formatValuationRange(low, high, currency)
}

export function mapBrandCatalogueProduct(product) {
  const currency = product.original_base_price_currency || 'GBP'
  const originalRrp = product.original_base_price ?? null
  const hasRrp = originalRrp != null && Number(originalRrp) > 0

  return {
    id: product.id,
    brand: product.brand,
    displayName: formatPublicCanonicalProductDisplayName(product) || product.canonical_product_name,
    canonicalProductKey: product.canonical_product_key,
    href: buildEquipmentProductPagePath(product.canonical_product_key),
    equipmentType: product.equipment_type || null,
    series: getProductSeriesLabel(product),
    yearLabel: formatYearRange(product),
    originalRrp: hasRrp ? originalRrp : null,
    currency,
    estimatedValueLabel: resolveEstimatedValueLabel(product, currency),
    imageUrl: resolveProductImageUrl(product),
    updatedAt: product.updated_at || product.image_updated_at || product.created_at || null,
  }
}

export async function fetchActiveListingBrandCounts() {
  if (!isSupabaseConfigured || !supabase) {
    return { countsByKey: {}, error: new Error('Supabase is not configured.') }
  }

  const countsByKey = {}
  const pageSize = 1000
  let from = 0

  while (true) {
    const { data, error } = await supabase
      .from('listings_public_browse')
      .select('brand')
      .eq('status', 'active')
      .range(from, from + pageSize - 1)

    if (error) return { countsByKey: {}, error }
    if (!data?.length) break

    for (const row of data) {
      const key = normalizeBrandKey(row.brand)
      if (!key) continue
      countsByKey[key] = (countsByKey[key] || 0) + 1
    }

    if (data.length < pageSize) break
    from += pageSize
  }

  return { countsByKey, error: null }
}

async function fetchActiveListingsForBrand(brandName, { limit = 8 } = {}) {
  if (!isSupabaseConfigured || !supabase) {
    return { data: [], error: new Error('Supabase is not configured.') }
  }

  const { data, error } = await supabase
    .from('listings_public_browse')
    .select('*, listing_images(id, storage_path, sort_order)')
    .eq('status', 'active')
    .eq('brand', brandName)
    .order('created_at', { ascending: false })
    .order('sort_order', { ascending: true, foreignTable: 'listing_images' })
    .limit(limit)
    .limit(1, { foreignTable: 'listing_images' })

  if (error) return { data: [], error }

  return {
    data: await attachPublicAvailabilityToListings((data ?? []).map(enrichListingWithImages)),
    error: null,
  }
}

export async function fetchBrandDirectory() {
  const [productsResult, listingResult] = await Promise.all([
    fetchApprovedEquipmentProducts(),
    fetchActiveListingBrandCounts(),
  ])

  if (productsResult.error) {
    return { brands: [], featured: [], byLetter: {}, error: productsResult.error, duplicates: [] }
  }

  const directory = buildBrandDirectoryFromProducts(
    productsResult.products,
    listingResult.countsByKey || {},
  )

  return {
    ...directory,
    error: listingResult.error || null,
    duplicates: findUnresolvedBrandDuplicates(productsResult.products),
  }
}

export async function fetchBrandPageData(brandSlug, {
  listingLimit = 8,
} = {}) {
  const slug = slugifyBrandName(brandSlug)
  if (!slug) {
    return { notFound: true, brand: null, products: [], listings: [], error: null }
  }

  const productsResult = await fetchApprovedEquipmentProducts()
  if (productsResult.error) {
    return { notFound: false, brand: null, products: [], listings: [], error: productsResult.error }
  }

  const registry = resolveBrandRegistryEntry(slug)
  const matchedProducts = productsResult.products.filter((product) => {
    if (!isPublicBrandCatalogueProduct(product)) return false
    const productSlug = getBrandSlug(product.brand)
    if (productSlug === slug) return true
    if (registry) return brandsMatch(registry.displayName, product.brand)
    return false
  })

  if (!matchedProducts.length) {
    return { notFound: true, brand: null, products: [], listings: [], error: null }
  }

  const displayName = registry?.displayName || getBrandDisplayName(matchedProducts[0].brand)
  const listingBrand = registry?.displayName || matchedProducts[0].brand

  let listingsResult = await fetchActiveListingsForBrand(listingBrand, { limit: listingLimit })
  let listings = listingsResult.data ?? []
  if (!listings.length && registry?.aliases?.length) {
    for (const alias of registry.aliases) {
      if (alias === listingBrand) continue
      const aliasResult = await fetchActiveListingsForBrand(alias, { limit: listingLimit })
      if (aliasResult.data?.length) {
        listings = aliasResult.data
        listingsResult = aliasResult
        break
      }
    }
  }

  const listingCountResult = await fetchActiveListingBrandCounts()
  const listingCount = listingCountResult.countsByKey?.[registry?.key || normalizeBrandKey(displayName)] || listings.length

  const brand = {
    key: registry?.key || normalizeBrandKey(displayName),
    displayName,
    slug,
    href: getBrandPagePath(slug),
    absoluteUrl: getBrandAbsoluteUrl(slug),
    shortDescription: registry?.shortDescription || null,
    logoPath: registry?.logoPath || null,
    logoAlt: registry?.logoAlt || `${displayName} logo`,
    logoMaxWidth: registry?.logoMaxWidth || null,
    logoMaxHeight: registry?.logoMaxHeight || null,
    logoScale: registry?.logoScale ?? 1,
    intro: buildBrandIntro(displayName),
    productCount: matchedProducts.length,
    listingCount,
    browseListingsHref: getBrowseBrandFilterHref(displayName),
  }

  return {
    notFound: false,
    brand,
    products: matchedProducts
      .map(mapBrandCatalogueProduct)
      .sort((left, right) => left.displayName.localeCompare(right.displayName)),
    categories: aggregateBrandCategories(matchedProducts),
    series: aggregateBrandSeries(matchedProducts, resolveProductImageUrl),
    listings,
    relatedBrands: buildRelatedBrands(displayName, productsResult.products, listingCountResult.countsByKey || {}),
    error: listingsResult.error || listingCountResult.error || null,
    lastmod: matchedProducts.reduce((latest, product) => {
      const stamp = product.updated_at || product.created_at
      if (!stamp) return latest
      return !latest || stamp > latest ? stamp : latest
    }, null),
  }
}
