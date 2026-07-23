/**
 * Fetch listings for Merchant feed generation (anon-safe browse view).
 */

import { enrichListingForPrerender } from './listingPrerenderData.js'
import { buildMerchantFeedItem, stripMerchantFeedItemPrivateMeta } from './merchantFeedItem.js'
import { classifyMerchantListingEligibility, summarizeMerchantEligibility } from './merchantEligibility.js'
import { buildMerchantFeedXml } from './merchantFeedXml.js'

/** Active browse columns only — never depend on sold readability fields. */
export const MERCHANT_BROWSE_LISTING_SELECT = `
  id,
  slug,
  status,
  title,
  description,
  brand,
  model,
  condition,
  rating,
  price_pence,
  quantity_available,
  collection_available,
  courier_available,
  delivery_notes,
  seller_delivery_radius_miles,
  seller_id,
  source,
  equipment_product_id,
  canonical_product_key,
  category_id,
  location,
  location_name,
  city,
  county,
  postcode,
  created_at,
  updated_at,
  published_at,
  is_test_data,
  category:categories(id, name, slug),
  listing_images(id, storage_path, sort_order)
`

async function fetchAllRows(queryBuilder, { pageSize = 100 } = {}) {
  const rows = []
  let from = 0
  while (true) {
    const { data, error } = await queryBuilder(from, from + pageSize - 1)
    if (error) throw error
    if (!data?.length) break
    rows.push(...data)
    if (data.length < pageSize) break
    from += pageSize
  }
  return rows
}

/**
 * Active marketplace listings only — listings_public_browse (never sold readability).
 */
export async function fetchMerchantCandidateListings(supabase, { supabaseUrl } = {}) {
  const rows = await fetchAllRows((from, to) => (
    supabase
      .from('listings_public_browse')
      .select(MERCHANT_BROWSE_LISTING_SELECT)
      .order('id', { ascending: true })
      .range(from, to)
  ))

  return rows.map((listing) => enrichListingForPrerender(listing, supabaseUrl))
}

export function buildMerchantFeedFromListings(listings, {
  equipmentById = new Map(),
  sellerById = new Map(),
  generatedAt = new Date(),
} = {}) {
  const classifications = []
  const items = []
  const exclusions = []

  for (const listing of listings) {
    const equipmentProduct = listing.equipment_product_id
      ? equipmentById.get(listing.equipment_product_id) || null
      : null
    const sellerProfile = listing.seller_id
      ? sellerById.get(listing.seller_id) || null
      : null

    const built = buildMerchantFeedItem(listing, { equipmentProduct, sellerProfile })
    classifications.push({
      listingId: listing.id,
      slug: listing.slug,
      eligible: built.eligible,
      reasons: built.reasons,
    })

    if (!built.eligible) {
      exclusions.push({
        listingId: listing.id,
        slug: listing.slug,
        reasons: built.reasons,
      })
      continue
    }

    items.push(stripMerchantFeedItemPrivateMeta(built.item))
  }

  const summary = summarizeMerchantEligibility(classifications)
  const xml = buildMerchantFeedXml(items, { generatedAt })

  return {
    items,
    xml,
    summary: {
      ...summary,
      generatedAt: generatedAt instanceof Date ? generatedAt.toISOString() : String(generatedAt),
      itemCount: items.length,
    },
    exclusions,
    classifications,
  }
}

export function buildMerchantReadinessReport({
  listings = [],
  feedResult = null,
} = {}) {
  const result = feedResult || buildMerchantFeedFromListings(listings)
  const missingImages = result.exclusions.filter((e) => e.reasons.includes('missing_image')).length
  const missingBrands = result.classifications.filter((c) => {
    const listing = listings.find((l) => l.id === c.listingId)
    return listing && !String(listing.brand || '').trim()
  }).length
  const unsupportedFulfilment = result.exclusions.filter((e) => (
    e.reasons.includes('unsupported_fulfilment')
  )).length
  const identifierBrandOnly = result.items.filter((i) => i.custom_label_1 === 'brand_only').length
  const identifierNone = result.items.filter((i) => i.custom_label_1 === 'no_reliable_identifier').length

  return {
    generatedAt: result.summary.generatedAt,
    totalActiveCandidates: listings.length,
    eligibleListings: result.summary.eligible,
    excludedListings: result.summary.excluded,
    excludedByReason: result.summary.excludedByReason,
    feedItemCount: result.summary.itemCount,
    missingImages,
    missingBrands,
    unsupportedFulfilment,
    identifierBrandOnly,
    identifierNone,
    soldInCandidates: listings.filter((l) => String(l.status).toLowerCase() === 'sold').length,
    testInCandidates: listings.filter((l) => l.is_test_data === true).length,
    pricePolicy: 'listing_price_plus_buyer_protection_as_shipping',
    submissionStatus: 'not_submitted_awaiting_review',
  }
}
