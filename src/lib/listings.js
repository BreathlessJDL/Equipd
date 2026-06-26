import { DEFAULT_LISTINGS_PAGE_SIZE } from './constants'
import { enrichListingWithImages } from './listingImages'
import {
  isBrowseRadiusSearchActive,
  filterListingsByRadius,
  shouldUseDistanceSearch,
} from './listingDistance'
import {
  hasListingLocationForPublish,
  listingLocationToFormFields,
  resolveListingLocationPayload,
} from './listingLocation'
import { getRatingLabel, LISTING_CATEGORY_OPTIONS } from './listingOptions'
import { DEFAULT_LISTING_SORT, getFetchListingSort, getSortDbOrder, parseListingSort } from './listingSort'
import {
  needsSellerDeliveryRadius,
  parseSellerDeliveryRadiusInput,
  validateListingFulfilmentDetails,
} from './listingFulfilmentPrivate'
import { supabase } from './supabase'

export { getCategoryDisplayName, getRatingLabel } from './listingOptions'

/**
 * Generate a URL-safe slug from a listing title.
 * Appends a short random suffix to reduce collision risk.
 */
export function generateListingSlug(title) {
  const base = title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80)

  const suffix = crypto.randomUUID().slice(0, 8)
  return base ? `${base}-${suffix}` : `listing-${suffix}`
}

/**
 * Format pence as GBP for display (whole pounds, no pence decimals).
 */
export function formatPricePence(pence) {
  if (pence == null || Number.isNaN(Number(pence))) {
    return '—'
  }

  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Number(pence) / 100)
}

/**
 * Parse a GBP amount string into integer pence.
 */
export function parsePriceToPence(priceInput) {
  if (priceInput === '' || priceInput == null) return null

  const pounds = Number(String(priceInput).replace(/,/g, '').trim())
  if (!Number.isFinite(pounds) || pounds <= 0) return null

  return Math.round(pounds * 100)
}

export function validateListingForPublish({
  title,
  categoryId,
  pricePence,
  condition,
  location,
  form,
  existingListing = null,
  description,
  hasPhotos,
  deliveryOptions = [],
}) {
  const errors = []

  if (!title?.trim() || title.trim().length < 3 || title.trim().length > 120) {
    errors.push('Title must be between 3 and 120 characters.')
  }

  if (!description?.trim() || description.trim().length < 10) {
    errors.push('Add a description of at least 10 characters.')
  }

  if (!categoryId) {
    errors.push('Category is required.')
  }

  if (!pricePence || pricePence <= 0) {
    errors.push('Enter a valid price greater than zero.')
  }

  if (!condition) {
    errors.push('Condition is required.')
  }

  if (form ? !hasListingLocationForPublish(form, existingListing) : !location?.trim()) {
    errors.push('Select a location from the suggestions.')
  }

  if (!hasPhotos) {
    errors.push('Add at least one photo.')
  }

  if (!deliveryOptions?.length) {
    errors.push('Select at least one collection or delivery option.')
  }

  errors.push(...validateListingFulfilmentDetails(form, { forPublish: true }))

  return errors
}

function appendOptionalItemDetails(description, form) {
  const details = []

  if (form.colour?.trim()) details.push(`Colour: ${form.colour.trim()}`)
  if (form.length?.trim() || form.width?.trim() || form.height?.trim()) {
    const length = form.length?.trim() || '—'
    const width = form.width?.trim() || '—'
    const height = form.height?.trim() || '—'
    details.push(`Dimensions (L×W×H cm): ${length} × ${width} × ${height}`)
  }

  if (details.length === 0) return description?.trim() || null

  const block = details.join('\n')
  const base = description?.trim() ?? ''
  return base ? `${base}\n\n${block}` : block
}

function buildDeliveryFields(form) {
  const options = form.deliveryOptions ?? []
  const hasCollection = options.includes('collection')
  const hasSellerDelivery = options.includes('seller_delivery')
  const hasBuyerCourier = options.includes('buyer_courier')
  const notes = []

  if (hasSellerDelivery) {
    notes.push('Seller can personally deliver')
  }

  if (hasBuyerCourier) {
    notes.push('Buyer can arrange a courier or collection service')
  }

  if (form.deliveryNotes?.trim()) {
    notes.push(form.deliveryNotes.trim())
  }

  return {
    collection_available: hasCollection || hasBuyerCourier,
    courier_available: hasSellerDelivery || hasBuyerCourier,
    delivery_notes: notes.length ? notes.join('. ') : null,
  }
}

export function inferDeliveryOptionsFromListing(listing) {
  const opts = []
  const notes = listing.delivery_notes?.toLowerCase() ?? ''

  if (notes.includes('buyer can arrange')) {
    opts.push('buyer_courier')
  }

  if (notes.includes('seller delivery') || notes.includes('seller can personally')) {
    opts.push('seller_delivery')
  }

  if (
    listing.seller_delivery_radius_miles != null
    && Number(listing.seller_delivery_radius_miles) > 0
  ) {
    opts.push('seller_delivery')
  }

  if (listing.collection_available !== false) {
    const sellerOnly =
      opts.includes('seller_delivery') &&
      !opts.includes('buyer_courier') &&
      (notes.includes('seller delivery') || notes.includes('seller can personally'))

    if (!sellerOnly) {
      opts.push('collection')
    }
  }

  if (opts.length === 0 && listing.courier_available) {
    opts.push('buyer_courier')
  }

  return [...new Set(opts)]
}

function inferDeliveryRangeMiles(notes = '') {
  const match = notes.match(/seller delivery up to ([\d.]+)\s*miles/i)
  return match?.[1] ?? ''
}

export function getSellerDeliveryRadiusMiles(listing) {
  if (listing?.seller_delivery_radius_miles != null) {
    return listing.seller_delivery_radius_miles
  }

  const legacy = inferDeliveryRangeMiles(listing?.delivery_notes ?? '')
  if (!legacy) return null

  const parsed = Number(legacy)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

export function prepareListingPayload(form, status, existingListing = null) {
  const trimmedTitle = form.title.trim()
  const title = trimmedTitle.length >= 3 ? trimmedTitle : 'Draft listing'

  const pricePence =
    parsePriceToPence(form.price) ?? (status === 'draft' ? 100 : null)

  const condition = form.condition || (status === 'draft' ? 'good' : null)
  const deliveryFields = buildDeliveryFields(form)
  const locationFields = resolveListingLocationPayload(form, existingListing)
  const deliveryOptions = form.deliveryOptions ?? []
  const sellerDeliveryRadiusMiles = needsSellerDeliveryRadius(deliveryOptions)
    ? parseSellerDeliveryRadiusInput(form.deliveryRangeMiles)
    : null

  return {
    category_id: form.categoryId || null,
    title: title.slice(0, 120),
    brand: form.brand.trim() || null,
    model: form.model.trim() || null,
    rating: form.rating || null,
    description: appendOptionalItemDetails(form.description, form),
    price_pence: pricePence,
    condition,
    ...locationFields,
    collection_available: deliveryFields.collection_available,
    courier_available: deliveryFields.courier_available,
    delivery_notes: deliveryFields.delivery_notes,
    seller_delivery_radius_miles: sellerDeliveryRadiusMiles,
    status,
  }
}

export function formatPenceToPriceInput(pence) {
  if (pence == null) return ''
  return (pence / 100).toFixed(2)
}

export function listingToForm(listing) {
  const deliveryOptions = inferDeliveryOptionsFromListing(listing)
  const locationFields = listingLocationToFormFields(listing)
  const structuredRadius = getSellerDeliveryRadiusMiles(listing)

  return {
    title: listing.title ?? '',
    description: listing.description ?? '',
    brand: listing.brand ?? '',
    model: listing.model ?? '',
    categoryId: listing.category_id ?? listing.category?.id ?? '',
    rating: listing.rating ?? '',
    price: formatPenceToPriceInput(listing.price_pence),
    condition: listing.condition ?? '',
    ...locationFields,
    colour: '',
    length: '',
    width: '',
    height: '',
    deliveryOptions,
    deliveryRangeMiles: structuredRadius != null ? String(structuredRadius) : '',
    collectionAddress: '',
    collectionPhone: '',
    collectionInstructions: '',
    collectionAvailable: listing.collection_available !== false,
    courierAvailable: Boolean(listing.courier_available),
    deliveryNotes: listing.delivery_notes ?? '',
  }
}

export function formatDeliveryOptionsLabel(listing) {
  const options = []

  if (listing.collection_available !== false) {
    options.push('Collection')
  }

  if (listing.courier_available) {
    options.push('Courier / delivery')
  }

  if (options.length === 0) {
    return 'Contact seller'
  }

  return options.join(' · ')
}

export function formatListingStatus(status) {
  const labels = {
    draft: 'Draft',
    active: 'Active',
    reserved: 'Reserved',
    in_progress: 'In progress',
    sold: 'Sold',
    archived: 'Archived',
  }
  return labels[status] ?? status
}

const HUB_MANAGEABLE_LISTING_STATUSES = new Set(['draft', 'active', 'archived'])
const HUB_IN_PROGRESS_SALE_LISTING_STATUSES = new Set(['reserved', 'in_progress'])

export function isHubManageableListing(listing) {
  return HUB_MANAGEABLE_LISTING_STATUSES.has(listing?.status)
}

export function isHubInProgressSaleListing(listing) {
  return HUB_IN_PROGRESS_SALE_LISTING_STATUSES.has(listing?.status)
}

export function getConditionLabel(value) {
  const labels = {
    new: 'New',
    like_new: 'Like new',
    good: 'Good',
    fair: 'Fair',
    poor: 'Poor',
  }
  return labels[value] ?? value
}

export function isListingOwner(listing, userId) {
  return Boolean(listing?.seller_id && userId && listing.seller_id === userId)
}

export function formatBrandModel(listing) {
  const parts = [listing.brand, listing.model].filter(Boolean)
  return parts.length > 0 ? parts.join(' · ') : null
}

export function getListingErrorMessage(error) {
  if (!error) return 'Something went wrong. Please try again.'
  return error.message || 'Something went wrong. Please try again.'
}

const CARD_LISTING_IMAGE_FIELDS = 'listing_images(id, storage_path, sort_order)'

/** Marketplace browse reads — excludes seller-only hidden import rows. */
const PUBLIC_BROWSE_LISTINGS_SOURCE = 'listings_public_browse'

const CARD_LISTING_FIELDS_LEGACY = `id, slug, title, brand, model, price_pence, condition, location, latitude, longitude, status, seller_id, rating, collection_available, courier_available, created_at, updated_at`

const CARD_LISTING_FIELDS = `${CARD_LISTING_FIELDS_LEGACY}, location_name, city, county, postcode`

/** Cached after first probe — null until checked. */
let structuredListingLocationAvailable = null

function isMissingStructuredListingLocationColumnError(error) {
  if (!error) return false

  const combined = `${error.message ?? ''} ${error.details ?? ''} ${error.hint ?? ''}`.toLowerCase()

  return (
    error.code === '42703'
    && (
      combined.includes('location_name')
      || combined.includes(' city')
      || combined.includes('county')
      || combined.includes('postcode')
    )
  )
}

function isMissingDistanceSearchRpcError(error) {
  if (!error) return false

  const combined = `${error.message ?? ''} ${error.details ?? ''} ${error.hint ?? ''}`.toLowerCase()

  return error.code === 'PGRST202' || combined.includes('search_listings_with_distance')
}

export async function supportsStructuredListingLocation() {
  if (structuredListingLocationAvailable !== null) {
    return structuredListingLocationAvailable
  }

  if (!supabase) {
    structuredListingLocationAvailable = false
    return false
  }

  const { error } = await supabase
    .from(PUBLIC_BROWSE_LISTINGS_SOURCE)
    .select('location_name, city, county, postcode')
    .limit(0)

  if (!error) {
    structuredListingLocationAvailable = true
    return true
  }

  if (isMissingStructuredListingLocationColumnError(error)) {
    structuredListingLocationAvailable = false
    return false
  }

  structuredListingLocationAvailable = false
  return false
}

async function getCardListingSelectFields() {
  return (await supportsStructuredListingLocation())
    ? CARD_LISTING_FIELDS
    : CARD_LISTING_FIELDS_LEGACY
}

function buildLocationAreasOrFilter(locationAreas, structuredLocation) {
  return locationAreas
    .flatMap((area) => {
      const pattern = escapeIlikePattern(area)
      const clauses = [`location.ilike.%${pattern}%`]

      if (structuredLocation) {
        clauses.push(
          `city.ilike.%${pattern}%`,
          `location_name.ilike.%${pattern}%`,
          `county.ilike.%${pattern}%`,
        )
      }

      return clauses
    })
    .join(',')
}

function withPrimaryListingImageOnly(query) {
  return query
    .order('sort_order', { ascending: true, foreignTable: 'listing_images' })
    .limit(1, { foreignTable: 'listing_images' })
}

export async function fetchCategories() {
  if (!supabase) {
    return { data: null, error: new Error('Supabase is not configured.') }
  }

  const { data, error } = await supabase
    .from('categories')
    .select('id, name, slug, sort_order')
    .order('sort_order', { ascending: true })

  if (error) {
    return { data, error }
  }

  const controlledSlugs = new Set(LISTING_CATEGORY_OPTIONS.map((option) => option.slug))
  const order = new Map(LISTING_CATEGORY_OPTIONS.map((option, index) => [option.slug, index]))
  const filtered = (data ?? [])
    .filter((category) => controlledSlugs.has(category.slug))
    .sort((left, right) => (order.get(left.slug) ?? 0) - (order.get(right.slug) ?? 0))

  return { data: filtered, error: null }
}

export async function createListing(sellerId, fields) {
  if (!supabase) {
    return { data: null, error: new Error('Supabase is not configured.') }
  }

  const slug = generateListingSlug(fields.title)

  const { data, error } = await supabase
    .from('listings')
    .insert({
      seller_id: sellerId,
      category_id: fields.category_id,
      slug,
      title: fields.title,
      brand: fields.brand,
      model: fields.model,
      rating: fields.rating,
      description: fields.description,
      price_pence: fields.price_pence,
      condition: fields.condition,
      location: fields.location,
      location_name: fields.location_name,
      city: fields.city,
      county: fields.county,
      postcode: fields.postcode,
      latitude: fields.latitude,
      longitude: fields.longitude,
      collection_available: fields.collection_available,
      courier_available: fields.courier_available,
      delivery_notes: fields.delivery_notes,
      seller_delivery_radius_miles: fields.seller_delivery_radius_miles ?? null,
      status: fields.status,
      source: 'manual',
    })
    .select('*')
    .single()

  return { data, error }
}

export async function updateListing(listingId, fields) {
  if (!supabase) {
    return { data: null, error: new Error('Supabase is not configured.') }
  }

  const updates = {}

  if (fields.category_id !== undefined) updates.category_id = fields.category_id
  if (fields.title !== undefined) updates.title = fields.title
  if (fields.brand !== undefined) updates.brand = fields.brand
  if (fields.model !== undefined) updates.model = fields.model
  if (fields.rating !== undefined) updates.rating = fields.rating
  if (fields.description !== undefined) updates.description = fields.description
  if (fields.price_pence !== undefined) updates.price_pence = fields.price_pence
  if (fields.condition !== undefined) updates.condition = fields.condition
  if (fields.location !== undefined) updates.location = fields.location
  if (fields.location_name !== undefined) updates.location_name = fields.location_name
  if (fields.city !== undefined) updates.city = fields.city
  if (fields.county !== undefined) updates.county = fields.county
  if (fields.postcode !== undefined) updates.postcode = fields.postcode
  if (fields.latitude !== undefined) updates.latitude = fields.latitude
  if (fields.longitude !== undefined) updates.longitude = fields.longitude
  if (fields.collection_available !== undefined) {
    updates.collection_available = fields.collection_available
  }
  if (fields.courier_available !== undefined) updates.courier_available = fields.courier_available
  if (fields.delivery_notes !== undefined) updates.delivery_notes = fields.delivery_notes
  if (fields.seller_delivery_radius_miles !== undefined) {
    updates.seller_delivery_radius_miles = fields.seller_delivery_radius_miles
  }
  if (fields.status !== undefined) updates.status = fields.status

  const { data, error } = await supabase
    .from('listings')
    .update(updates)
    .eq('id', listingId)
    .select('*')
    .single()

  return { data, error }
}

export async function deleteListing(listingId) {
  if (!supabase) {
    return { error: new Error('Supabase is not configured.') }
  }

  const { error } = await supabase.from('listings').delete().eq('id', listingId)

  return { error }
}

export async function incrementListingViews(slug) {
  if (!supabase) {
    return { error: new Error('Supabase is not configured.') }
  }

  const { error } = await supabase.rpc('increment_listing_views', { p_slug: slug })

  return { error }
}

export async function fetchListingBySlug(slug) {
  if (!supabase) {
    return { data: null, error: new Error('Supabase is not configured.') }
  }

  const { data, error } = await supabase
    .from('listings')
    .select('*, category:categories(id, name, slug), listing_images(id, storage_path, sort_order)')
    .eq('slug', slug)
    .maybeSingle()

  if (error) {
    return { data: null, error }
  }

  return { data: data ? enrichListingWithImages(data) : null, error: null }
}

export async function fetchMyListings(sellerId) {
  if (!supabase) {
    return { data: null, error: new Error('Supabase is not configured.') }
  }

  const { data, error } = await withPrimaryListingImageOnly(
    supabase
      .from('listings')
      .select(`*, category:categories(id, name, slug), ${CARD_LISTING_IMAGE_FIELDS}`)
      .eq('seller_id', sellerId)
      .order('created_at', { ascending: false }),
  )

  if (error) {
    return { data: null, error }
  }

  return { data: (data ?? []).map(enrichListingWithImages), error: null }
}

/** Public seller shop listings — uses marketplace visibility (excludes hidden zero-image imports). */
export async function fetchSellerActiveListings(sellerId) {
  if (!supabase) {
    return { data: null, error: new Error('Supabase is not configured.') }
  }

  const cardFields = await getCardListingSelectFields()

  const { data, error } = await withPrimaryListingImageOnly(
    supabase
      .from(PUBLIC_BROWSE_LISTINGS_SOURCE)
      .select(`${cardFields}, category:categories(id, name, slug), ${CARD_LISTING_IMAGE_FIELDS}`)
      .eq('seller_id', sellerId)
      .eq('status', 'active')
      .order('created_at', { ascending: false }),
  )

  if (error) {
    return { data: null, error }
  }

  return { data: (data ?? []).map(enrichListingWithImages), error: null }
}

export async function fetchSellerSoldListingCount(sellerId) {
  if (!supabase) {
    return { data: null, error: new Error('Supabase is not configured.') }
  }

  const { data, error } = await supabase.rpc('get_seller_sold_listing_count', {
    p_seller_id: sellerId,
  })

  if (error) {
    return { data: null, error }
  }

  const count = Number(data)
  return {
    data: Number.isFinite(count) ? count : 0,
    error: null,
  }
}

const RECOMMENDED_LISTINGS_LIMIT = 12

function appendRecommendedListings(collected, seen, listings, limit) {
  for (const listing of listings ?? []) {
    if (collected.length >= limit) break
    if (seen.has(listing.id)) continue
    seen.add(listing.id)
    collected.push(listing)
  }
}

async function fetchRecommendedBatch({ listingId, categoryId = '', brand = '', limit }) {
  if (!supabase) {
    return { data: [], error: new Error('Supabase is not configured.') }
  }

  const cardFields = await getCardListingSelectFields()

  let query = withPrimaryListingImageOnly(
    supabase
      .from(PUBLIC_BROWSE_LISTINGS_SOURCE)
      .select(
        `${cardFields}, category:categories(id, name, slug), ${CARD_LISTING_IMAGE_FIELDS}`,
      )
      .eq('status', 'active')
      .neq('id', listingId)
      .order('created_at', { ascending: false })
      .limit(limit),
  )

  if (categoryId) {
    query = query.eq('category_id', categoryId)
  }

  const trimmedBrand = brand?.trim()
  if (trimmedBrand) {
    query = query.eq('brand', trimmedBrand)
  }

  const { data, error } = await query

  if (error) {
    return { data: [], error }
  }

  return { data: (data ?? []).map(enrichListingWithImages), error: null }
}

export async function fetchRecommendedListings({
  listingId,
  categoryId = '',
  brand = '',
  limit = RECOMMENDED_LISTINGS_LIMIT,
} = {}) {
  if (!supabase) {
    return { data: [], error: new Error('Supabase is not configured.') }
  }

  if (!listingId) {
    return { data: [], error: null }
  }

  const collected = []
  const seen = new Set([listingId])
  const trimmedBrand = brand?.trim() ?? ''

  if (categoryId && trimmedBrand) {
    const { data, error } = await fetchRecommendedBatch({
      listingId,
      categoryId,
      brand: trimmedBrand,
      limit,
    })

    if (error) {
      return { data: [], error }
    }

    appendRecommendedListings(collected, seen, data, limit)
  }

  if (collected.length < limit && categoryId) {
    const { data, error } = await fetchRecommendedBatch({
      listingId,
      categoryId,
      limit: limit - collected.length,
    })

    if (error) {
      return { data: collected, error }
    }

    appendRecommendedListings(collected, seen, data, limit)
  }

  if (collected.length < limit && trimmedBrand) {
    const { data, error } = await fetchRecommendedBatch({
      listingId,
      brand: trimmedBrand,
      limit: limit - collected.length,
    })

    if (error) {
      return { data: collected, error }
    }

    appendRecommendedListings(collected, seen, data, limit)
  }

  return { data: collected, error: null }
}

function escapeIlikePattern(value) {
  return value.replace(/[%_\\]/g, '\\$&')
}

function mapDistanceSearchListing(row) {
  const listing = {
    id: row.id,
    slug: row.slug,
    title: row.title,
    brand: row.brand,
    model: row.model,
    price_pence: row.price_pence,
    condition: row.condition,
    location: row.location,
    location_name: row.location_name,
    city: row.city,
    county: row.county,
    postcode: row.postcode,
    latitude: row.latitude,
    longitude: row.longitude,
    status: row.status,
    seller_id: row.seller_id,
    rating: row.rating,
    collection_available: row.collection_available,
    courier_available: row.courier_available,
    created_at: row.created_at,
    updated_at: row.updated_at,
    distance_miles: row.distance_miles,
    category_id: row.category_id,
    category: row.category_id
      ? {
          id: row.category_id,
          name: row.category_name,
          slug: row.category_slug,
        }
      : null,
    listing_images: row.primary_image_storage_path
      ? [{ storage_path: row.primary_image_storage_path, sort_order: 0 }]
      : [],
  }

  return enrichListingWithImages(listing)
}

export async function searchListingsWithDistance({
  buyerLatitude,
  buyerLongitude,
  radiusMiles = null,
  search = '',
  categoryId = '',
  condition = '',
  brand = '',
  rating = '',
  minPricePence = null,
  maxPricePence = null,
  locationAreas = [],
  sort = DEFAULT_LISTING_SORT,
  limit = DEFAULT_LISTINGS_PAGE_SIZE,
  offset = 0,
} = {}) {
  if (!supabase) {
    return { data: null, error: new Error('Supabase is not configured.') }
  }

  if (!shouldUseDistanceSearch({ buyerLatitude, buyerLongitude })) {
    console.warn('[browse] Distance search skipped: buyer location is missing or invalid.')
    return { data: null, error: null }
  }

  const lat = Number(buyerLatitude)
  const lng = Number(buyerLongitude)

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    console.warn('[browse] Distance search skipped: buyer latitude/longitude are not valid numbers.')
    return { data: null, error: null }
  }

  const radiusValue = radiusMiles != null ? Number(radiusMiles) : null
  const parsedRadius =
    radiusValue != null && Number.isFinite(radiusValue) && radiusValue > 0 ? radiusValue : null

  const { data, error } = await supabase.rpc('search_listings_with_distance', {
    p_buyer_lat: lat,
    p_buyer_lng: lng,
    p_radius_miles: parsedRadius,
    p_search: search.trim() || null,
    p_category_id: categoryId || null,
    p_condition: condition || null,
    p_brand: brand.trim() || null,
    p_rating: rating || null,
    p_min_price_pence: minPricePence != null && minPricePence > 0 ? minPricePence : null,
    p_max_price_pence: maxPricePence != null && maxPricePence > 0 ? maxPricePence : null,
    p_location_areas: locationAreas.length > 0 ? locationAreas : null,
    p_sort: sort,
    p_limit: limit,
    p_offset: offset,
  })

  if (error) {
    return { data: null, error }
  }

  return { data: (data ?? []).map(mapDistanceSearchListing), error: null }
}

export async function fetchActiveListings({
  search = '',
  categoryId = '',
  categoryIds = [],
  condition = '',
  conditions = [],
  brand = '',
  brands = [],
  rating = '',
  minPricePence = null,
  maxPricePence = null,
  locationAreas = [],
  buyerLatitude = null,
  buyerLongitude = null,
  radiusMiles = null,
  sort = DEFAULT_LISTING_SORT,
  limit = DEFAULT_LISTINGS_PAGE_SIZE,
  offset = 0,
} = {}) {
  if (!supabase) {
    return { data: null, error: new Error('Supabase is not configured.') }
  }

  const resolvedCategoryIds = categoryIds.length > 0 ? categoryIds : categoryId ? [categoryId] : []
  const resolvedConditions = conditions.length > 0 ? conditions : condition ? [condition] : []
  const resolvedBrands = brands.length > 0 ? brands : brand.trim() ? [brand.trim()] : []
  const hasMultiSelectFilter =
    resolvedCategoryIds.length > 1 || resolvedConditions.length > 1 || resolvedBrands.length > 1

  const hasLocationSearch = shouldUseDistanceSearch({ buyerLatitude, buyerLongitude })
  const lat = Number(buyerLatitude)
  const lng = Number(buyerLongitude)
  const numericLocationSearch =
    hasLocationSearch && Number.isFinite(lat) && Number.isFinite(lng)
      ? { buyerLatitude: lat, buyerLongitude: lng }
      : { buyerLatitude: null, buyerLongitude: null }
  const radiusValue = radiusMiles != null ? Number(radiusMiles) : null
  const parsedRadius =
    radiusValue != null && Number.isFinite(radiusValue) && radiusValue > 0 ? radiusValue : null
  const fetchSort = getFetchListingSort(sort, {
    hasLocationSearch: numericLocationSearch.buyerLatitude != null,
  })

  if (numericLocationSearch.buyerLatitude != null && !hasMultiSelectFilter) {
    const rpcResult = await searchListingsWithDistance({
      buyerLatitude: numericLocationSearch.buyerLatitude,
      buyerLongitude: numericLocationSearch.buyerLongitude,
      radiusMiles: parsedRadius,
      search,
      categoryId: resolvedCategoryIds[0] ?? '',
      condition: resolvedConditions[0] ?? '',
      brand: resolvedBrands[0] ?? '',
      rating,
      minPricePence,
      maxPricePence,
      locationAreas,
      sort: fetchSort,
      limit,
      offset,
    })

    if (!rpcResult.error && Array.isArray(rpcResult.data)) {
      return rpcResult
    }

    if (rpcResult.error && !isMissingDistanceSearchRpcError(rpcResult.error)) {
      console.warn('[browse] Distance RPC failed; falling back to direct listing fetch.', rpcResult.error)
    }
  }

  const directResult = await fetchActiveListingsDirect({
    search,
    categoryIds: resolvedCategoryIds,
    conditions: resolvedConditions,
    brands: resolvedBrands,
    rating,
    minPricePence,
    maxPricePence,
    locationAreas,
    sort: fetchSort,
    limit,
    offset,
    hasLocationSearch: numericLocationSearch.buyerLatitude != null,
  })

  if (directResult.error || numericLocationSearch.buyerLatitude == null) {
    return directResult
  }

  return {
    data: filterListingsByRadius(
      directResult.data ?? [],
      numericLocationSearch.buyerLatitude,
      numericLocationSearch.buyerLongitude,
      parsedRadius,
    ),
    error: null,
  }
}

async function fetchActiveListingsDirect({
  search = '',
  categoryId = '',
  categoryIds = [],
  condition = '',
  conditions = [],
  brand = '',
  brands = [],
  rating = '',
  minPricePence = null,
  maxPricePence = null,
  locationAreas = [],
  sort = DEFAULT_LISTING_SORT,
  limit = DEFAULT_LISTINGS_PAGE_SIZE,
  offset = 0,
  hasLocationSearch = false,
} = {}) {
  const resolvedCategoryIds = categoryIds.length > 0 ? categoryIds : categoryId ? [categoryId] : []
  const resolvedConditions = conditions.length > 0 ? conditions : condition ? [condition] : []
  const resolvedBrands = brands.length > 0 ? brands : brand.trim() ? [brand.trim()] : []

  const structuredLocation = await supportsStructuredListingLocation()
  const cardFields = await getCardListingSelectFields()
  const parsedSort = parseListingSort(sort, { hasLocationSearch, allowNearestWithoutLocation: true })
  const { column, ascending } = getSortDbOrder(parsedSort, { hasLocationSearch })

  let query = withPrimaryListingImageOnly(
    supabase
      .from(PUBLIC_BROWSE_LISTINGS_SOURCE)
      .select(
        `${cardFields}, category:categories(id, name, slug), ${CARD_LISTING_IMAGE_FIELDS}`,
      )
      .eq('status', 'active')
      .order(column, { ascending })
      .range(offset, offset + limit - 1),
  )

  if (resolvedCategoryIds.length > 0) {
    query = query.in('category_id', resolvedCategoryIds)
  }

  if (resolvedConditions.length > 0) {
    query = query.in('condition', resolvedConditions)
  }

  if (rating) {
    query = query.eq('rating', rating)
  }

  if (minPricePence != null && minPricePence > 0) {
    query = query.gte('price_pence', minPricePence)
  }

  if (maxPricePence != null && maxPricePence > 0) {
    query = query.lte('price_pence', maxPricePence)
  }

  if (resolvedBrands.length > 0) {
    query = query.in('brand', resolvedBrands)
  }

  if (locationAreas.length > 0) {
    query = query.or(buildLocationAreasOrFilter(locationAreas, structuredLocation))
  }

  const trimmedSearch = search.trim()
  if (trimmedSearch) {
    const term = `%${escapeIlikePattern(trimmedSearch)}%`
    query = query.or(
      `title.ilike.${term},brand.ilike.${term},model.ilike.${term},description.ilike.${term}`,
    )
  }

  const { data, error } = await query

  if (error) {
    return { data: null, error }
  }

  return { data: (data ?? []).map(enrichListingWithImages), error: null }
}
