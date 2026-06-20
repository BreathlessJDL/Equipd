import { DEFAULT_LISTINGS_PAGE_SIZE } from './constants'
import { enrichListingWithImages } from './listingImages'
import { supabase } from './supabase'

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
 * Format pence as GBP display string.
 */
export function formatPricePence(pence) {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
  }).format(pence / 100)
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

export function validateListingForPublish({ title, categoryId, pricePence, condition, location }) {
  const errors = []

  if (!title?.trim() || title.trim().length < 3 || title.trim().length > 120) {
    errors.push('Title must be between 3 and 120 characters.')
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

  if (!location?.trim()) {
    errors.push('Location is required to publish.')
  }

  return errors
}

export function prepareListingPayload(form, status) {
  const trimmedTitle = form.title.trim()
  const title = trimmedTitle.length >= 3 ? trimmedTitle : 'Draft listing'

  const pricePence =
    parsePriceToPence(form.price) ?? (status === 'draft' ? 100 : null)

  const condition = form.condition || (status === 'draft' ? 'good' : null)

  return {
    category_id: form.categoryId || null,
    title: title.slice(0, 120),
    brand: form.brand.trim() || null,
    model: form.model.trim() || null,
    description: form.description.trim() || null,
    price_pence: pricePence,
    condition,
    location: form.location.trim() || null,
    collection_available: form.collectionAvailable !== false,
    courier_available: Boolean(form.courierAvailable),
    delivery_notes: form.deliveryNotes?.trim() || null,
    status,
  }
}

export function formatPenceToPriceInput(pence) {
  if (pence == null) return ''
  return (pence / 100).toFixed(2)
}

export function listingToForm(listing) {
  return {
    title: listing.title ?? '',
    brand: listing.brand ?? '',
    model: listing.model ?? '',
    categoryId: listing.category_id ?? listing.category?.id ?? '',
    price: formatPenceToPriceInput(listing.price_pence),
    condition: listing.condition ?? '',
    location: listing.location ?? '',
    description: listing.description ?? '',
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
    sold: 'Sold',
    archived: 'Archived',
  }
  return labels[status] ?? status
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

  return { data, error }
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
      description: fields.description,
      price_pence: fields.price_pence,
      condition: fields.condition,
      location: fields.location,
      collection_available: fields.collection_available,
      courier_available: fields.courier_available,
      delivery_notes: fields.delivery_notes,
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
  if (fields.description !== undefined) updates.description = fields.description
  if (fields.price_pence !== undefined) updates.price_pence = fields.price_pence
  if (fields.condition !== undefined) updates.condition = fields.condition
  if (fields.location !== undefined) updates.location = fields.location
  if (fields.collection_available !== undefined) {
    updates.collection_available = fields.collection_available
  }
  if (fields.courier_available !== undefined) updates.courier_available = fields.courier_available
  if (fields.delivery_notes !== undefined) updates.delivery_notes = fields.delivery_notes
  if (fields.status !== undefined) updates.status = fields.status

  const { data, error } = await supabase
    .from('listings')
    .update(updates)
    .eq('id', listingId)
    .select('*')
    .single()

  return { data, error }
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

function escapeIlikePattern(value) {
  return value.replace(/[%_\\]/g, '\\$&')
}

export async function fetchActiveListings({
  search = '',
  categoryId = '',
  condition = '',
  brand = '',
  minPricePence = null,
  maxPricePence = null,
  locationAreas = [],
  limit = DEFAULT_LISTINGS_PAGE_SIZE,
} = {}) {
  if (!supabase) {
    return { data: null, error: new Error('Supabase is not configured.') }
  }

  let query = withPrimaryListingImageOnly(
    supabase
      .from('listings')
      .select(
        `id, slug, title, brand, model, price_pence, condition, location, collection_available, courier_available, created_at, category:categories(id, name, slug), ${CARD_LISTING_IMAGE_FIELDS}`,
      )
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(limit),
  )

  if (categoryId) {
    query = query.eq('category_id', categoryId)
  }

  if (condition) {
    query = query.eq('condition', condition)
  }

  if (minPricePence != null && minPricePence > 0) {
    query = query.gte('price_pence', minPricePence)
  }

  if (maxPricePence != null && maxPricePence > 0) {
    query = query.lte('price_pence', maxPricePence)
  }

  const trimmedBrand = brand.trim()
  if (trimmedBrand) {
    query = query.ilike('brand', `%${escapeIlikePattern(trimmedBrand)}%`)
  }

  if (locationAreas.length > 0) {
    const locationOr = locationAreas
      .map((area) => `location.ilike.%${escapeIlikePattern(area)}%`)
      .join(',')
    query = query.or(locationOr)
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
