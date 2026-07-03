import { supabase } from './supabase'

export function needsCollectionPrivateDetails(deliveryOptions = []) {
  return deliveryOptions.includes('collection') || deliveryOptions.includes('buyer_courier')
}

export function needsSellerDeliveryRadius(deliveryOptions = []) {
  return deliveryOptions.includes('seller_delivery')
}

export function parseSellerDeliveryRadiusInput(value) {
  if (value === '' || value == null) return null

  const trimmed = String(value).trim()
  if (!trimmed) return null

  const parsed = Number(trimmed)
  if (!Number.isFinite(parsed) || parsed <= 0 || !Number.isInteger(parsed)) {
    return null
  }

  return parsed
}

export function fulfilmentPrivateFromForm(form) {
  return {
    collection_address: form.collectionAddress?.trim() || null,
    collection_phone: form.collectionPhone?.trim() || null,
    collection_instructions: form.collectionInstructions?.trim() || null,
  }
}

export function mergeFulfilmentPrivateIntoForm(form, row) {
  if (!row) return form

  return {
    ...form,
    collectionAddress: row.collection_address ?? '',
    collectionPhone: row.collection_phone ?? '',
    collectionInstructions: row.collection_instructions ?? '',
  }
}

export function validateListingFulfilmentDetails(form, { forPublish = false } = {}) {
  if (!forPublish || !form) return []

  const errors = []
  const deliveryOptions = form.deliveryOptions ?? []

  if (needsCollectionPrivateDetails(deliveryOptions)) {
    if (!form.collectionAddress?.trim()) {
      errors.push('Collection address is required.')
    }

    if (!form.collectionPhone?.trim()) {
      errors.push('Best contact number is required.')
    }
  }

  if (needsSellerDeliveryRadius(deliveryOptions)) {
    const radius = parseSellerDeliveryRadiusInput(form.deliveryRangeMiles)

    if (radius == null) {
      errors.push('Enter a valid delivery radius in whole miles.')
    }
  }

  return errors
}

export function getListingFulfilmentPrivateErrorMessage(error) {
  if (!error) return 'Something went wrong. Please try again.'
  return error.message || 'Something went wrong. Please try again.'
}

export async function fetchListingFulfilmentPrivate(listingId) {
  if (!supabase) {
    return { data: null, error: new Error('Supabase is not configured.') }
  }

  if (!listingId) {
    return { data: null, error: new Error('Listing id is required.') }
  }

  const { data, error } = await supabase
    .from('listing_fulfilment_private')
    .select('listing_id, collection_address, collection_phone, collection_instructions, created_at, updated_at')
    .eq('listing_id', listingId)
    .maybeSingle()

  return { data, error }
}

export async function upsertListingFulfilmentPrivate(listingId, data) {
  if (!supabase) {
    return { data: null, error: new Error('Supabase is not configured.') }
  }

  if (!listingId) {
    return { data: null, error: new Error('Listing id is required.') }
  }

  const { data: row, error } = await supabase
    .from('listing_fulfilment_private')
    .upsert(
      {
        listing_id: listingId,
        collection_address: data.collection_address ?? null,
        collection_phone: data.collection_phone ?? null,
        collection_instructions: data.collection_instructions ?? null,
      },
      { onConflict: 'listing_id' },
    )
    .select('listing_id, collection_address, collection_phone, collection_instructions, created_at, updated_at')
    .single()

  return { data: row, error }
}

export async function deleteListingFulfilmentPrivate(listingId) {
  if (!supabase) {
    return { error: new Error('Supabase is not configured.') }
  }

  if (!listingId) {
    return { error: new Error('Listing id is required.') }
  }

  const { error } = await supabase
    .from('listing_fulfilment_private')
    .delete()
    .eq('listing_id', listingId)

  return { error }
}

export async function persistListingFulfilmentPrivate(listingId, form) {
  if (!needsCollectionPrivateDetails(form.deliveryOptions)) {
    return deleteListingFulfilmentPrivate(listingId)
  }

  return upsertListingFulfilmentPrivate(listingId, fulfilmentPrivateFromForm(form))
}
