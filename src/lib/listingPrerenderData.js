import { buildListingImagePublicUrl, enrichListingImagesForPrerender } from './listingImagePublicUrl.js'

export const PUBLIC_LISTING_RENDER_SELECT = `
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
  sold_at,
  is_test_data,
  category:categories(id, name, slug),
  listing_images(id, storage_path, sort_order)
`

const EQUIPMENT_PRODUCT_SELECT = `
  id,
  brand,
  model,
  equipment_type,
  product_family,
  canonical_product_name,
  canonical_product_key,
  baseline_manufacture_year,
  production_start_year,
  production_end_year,
  original_base_price,
  original_base_price_currency,
  status
`

const PUBLIC_PROFILE_SELECT = 'id, display_name, username, created_at'

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

export function enrichListingForPrerender(listing, supabaseUrl) {
  if (!listing) return listing
  return enrichListingImagesForPrerender({
    ...listing,
    listing_images: (listing.listing_images ?? []).map((image) => ({
      ...image,
      url: image.url || buildListingImagePublicUrl(image.storage_path, supabaseUrl),
    })),
  }, supabaseUrl)
}

export async function fetchPublicReadableListingBySlug(supabase, slug, { supabaseUrl } = {}) {
  const { data, error } = await supabase
    .from('listings')
    .select(PUBLIC_LISTING_RENDER_SELECT)
    .eq('slug', slug)
    .maybeSingle()

  if (error) throw error
  if (!data) return null
  return enrichListingForPrerender(data, supabaseUrl)
}

export async function fetchPublicReadableListings(supabase, { supabaseUrl, statuses = ['active', 'sold'] } = {}) {
  const rows = await fetchAllRows(
    (from, to) => supabase
      .from('listings')
      .select(PUBLIC_LISTING_RENDER_SELECT)
      .in('status', statuses)
      .order('created_at', { ascending: false })
      .range(from, to),
  )
  return rows.map((row) => enrichListingForPrerender(row, supabaseUrl))
}

export async function fetchApprovedEquipmentProductsForListings(supabase, listings = []) {
  const ids = [...new Set(listings.map((listing) => listing?.equipment_product_id).filter(Boolean))]
  const keys = [...new Set(listings.map((listing) => listing?.canonical_product_key).filter(Boolean))]

  if (ids.length === 0 && keys.length === 0) {
    return { byListingId: new Map(), byId: new Map(), byKey: new Map(), allProducts: [] }
  }

  const allProducts = await fetchAllRows(
    (from, to) => supabase
      .from('equipment_products')
      .select(EQUIPMENT_PRODUCT_SELECT)
      .eq('status', 'approved')
      .order('brand')
      .range(from, to),
    { pageSize: 1000 },
  )

  const byId = new Map(allProducts.map((product) => [product.id, product]))
  const byKey = new Map(allProducts.map((product) => [product.canonical_product_key, product]))
  const byListingId = new Map()

  for (const listing of listings) {
    const product = byId.get(listing?.equipment_product_id)
      || byKey.get(listing?.canonical_product_key)
      || null
    if (product) byListingId.set(listing.id, product)
  }

  return { byListingId, byId, byKey, allProducts }
}

export async function fetchPublicSellerProfilesForListings(supabase, listings = []) {
  const sellerIds = [...new Set(listings.map((listing) => listing?.seller_id).filter(Boolean))]
  if (!sellerIds.length) return new Map()

  const rows = await fetchAllRows(
    (from, to) => supabase
      .from('profiles_public')
      .select(PUBLIC_PROFILE_SELECT)
      .in('id', sellerIds)
      .range(from, to),
  )

  return new Map(rows.map((profile) => [profile.id, profile]))
}
