import { enrichListingWithImages } from './listingImages'
import { supabase } from './supabase'

const savedListingFields = 'id, user_id, listing_id, created_at'

const savedListingCardSelect = `
  id,
  created_at,
  listing_id,
  listing:listings(
    id,
    slug,
    title,
    brand,
    model,
    price_pence,
    condition,
    location,
    status,
    collection_available,
    courier_available,
    created_at,
    category:categories(id, name, slug),
    listing_images(id, storage_path, sort_order)
  )
`

export function getSavedListingErrorMessage(error) {
  if (!error) return 'Something went wrong. Please try again.'

  if (
    error.code === '42501' ||
    /row-level security policy/i.test(error.message ?? '')
  ) {
    return "You can't save your own listing."
  }

  return error.message || 'Something went wrong. Please try again.'
}

function withPrimaryListingImageOnly(query) {
  return query
    .order('sort_order', { ascending: true, foreignTable: 'listings.listing_images' })
    .limit(1, { foreignTable: 'listings.listing_images' })
}

export function partitionSavedListings(savedRows = []) {
  const activeListings = []
  const unavailableSaved = []

  for (const saved of savedRows) {
    if (saved.listing?.status === 'active') {
      activeListings.push(enrichListingWithImages(saved.listing))
    } else {
      unavailableSaved.push(saved)
    }
  }

  return { activeListings, unavailableSaved }
}

export async function saveListing(_userId, listingId) {
  if (!supabase) {
    return { data: null, error: new Error('Supabase is not configured.') }
  }

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { data: null, error: authError ?? new Error('You must be signed in to save listings.') }
  }

  const { data, error } = await supabase
    .from('saved_listings')
    .insert({
      user_id: user.id,
      listing_id: listingId,
    })
    .select(savedListingFields)
    .single()

  return { data, error }
}

export async function unsaveListing(_userId, listingId) {
  if (!supabase) {
    return { error: new Error('Supabase is not configured.') }
  }

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { error: authError ?? new Error('You must be signed in to manage saved listings.') }
  }

  const { error } = await supabase
    .from('saved_listings')
    .delete()
    .eq('user_id', user.id)
    .eq('listing_id', listingId)

  return { error }
}

export async function isListingSaved(userId, listingId) {
  if (!supabase) {
    return { saved: false, error: new Error('Supabase is not configured.') }
  }

  const { data, error } = await supabase
    .from('saved_listings')
    .select('id')
    .eq('user_id', userId)
    .eq('listing_id', listingId)
    .maybeSingle()

  if (error) {
    return { saved: false, error }
  }

  return { saved: Boolean(data), error: null }
}

export async function fetchSavedListings(userId) {
  if (!supabase) {
    return { data: null, error: new Error('Supabase is not configured.') }
  }

  const { data, error } = await withPrimaryListingImageOnly(
    supabase
      .from('saved_listings')
      .select(savedListingCardSelect)
      .eq('user_id', userId)
      .order('created_at', { ascending: false }),
  )

  if (error) {
    return { data: null, error }
  }

  return { data: data ?? [], error: null }
}

export async function fetchListingSavedCount(listingId) {
  if (!supabase) {
    return { count: 0, error: new Error('Supabase is not configured.') }
  }

  if (!listingId) {
    return { count: 0, error: null }
  }

  const { data, error } = await supabase.rpc('get_listing_saved_count', {
    p_listing_id: listingId,
  })

  if (error) {
    return { count: 0, error }
  }

  const count = Number.isFinite(data) ? Math.max(0, data) : 0
  return { count, error: null }
}
