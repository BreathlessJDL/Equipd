import { parsePriceToPence } from './listings'
import { supabase } from './supabase'

const offerFields = `
  id,
  listing_id,
  buyer_id,
  seller_id,
  conversation_id,
  amount_pence,
  status,
  message,
  created_at,
  updated_at
`

export function getOfferErrorMessage(error) {
  if (!error) return 'Something went wrong. Please try again.'
  return error.message || 'Something went wrong. Please try again.'
}

export function formatOfferStatus(status) {
  const labels = {
    pending: 'Pending',
    accepted: 'Accepted',
    rejected: 'Rejected',
    withdrawn: 'Withdrawn',
  }
  return labels[status] ?? status
}

export function formatOfferTimestamp(value) {
  if (!value) return ''

  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

export async function fetchOffersForListing(listingId) {
  if (!supabase) {
    return { data: null, error: new Error('Supabase is not configured.') }
  }

  const { data, error } = await supabase
    .from('offers')
    .select(offerFields)
    .eq('listing_id', listingId)
    .order('created_at', { ascending: false })

  return { data, error }
}

export async function createOffer({
  listingId,
  buyerId,
  sellerId,
  amountPence,
  message,
  conversationId,
}) {
  if (!supabase) {
    return { data: null, error: new Error('Supabase is not configured.') }
  }

  if (buyerId === sellerId) {
    return { data: null, error: new Error('You cannot make an offer on your own listing.') }
  }

  if (!amountPence || amountPence <= 0) {
    return { data: null, error: new Error('Enter a valid offer amount greater than zero.') }
  }

  const { data, error } = await supabase
    .from('offers')
    .insert({
      listing_id: listingId,
      buyer_id: buyerId,
      seller_id: sellerId,
      conversation_id: conversationId ?? null,
      amount_pence: amountPence,
      message: message?.trim() || null,
      status: 'pending',
    })
    .select(offerFields)
    .single()

  return { data, error }
}

export async function createOfferFromForm({
  listingId,
  buyerId,
  sellerId,
  amountInput,
  message,
  conversationId,
}) {
  const amountPence = parsePriceToPence(amountInput)

  if (!amountPence) {
    return { data: null, error: new Error('Enter a valid offer amount greater than zero.') }
  }

  return createOffer({
    listingId,
    buyerId,
    sellerId,
    amountPence,
    message,
    conversationId,
  })
}

export async function acceptOffer(offerId) {
  if (!supabase) {
    return { data: null, offers: null, error: new Error('Supabase is not configured.') }
  }

  const { data: accepted, error } = await supabase.rpc('accept_offer', {
    p_offer_id: offerId,
  })

  if (error) {
    return { data: null, offers: null, error }
  }

  const { data: offers, error: fetchError } = await fetchOffersForListing(accepted.listing_id)

  if (fetchError) {
    return { data: accepted, offers: null, error: fetchError }
  }

  return { data: accepted, offers: offers ?? [], error: null }
}

export async function rejectOffer(offerId) {
  return updateOfferStatus(offerId, 'rejected')
}

export async function withdrawOffer(offerId) {
  return updateOfferStatus(offerId, 'withdrawn')
}

async function updateOfferStatus(offerId, status) {
  if (!supabase) {
    return { data: null, error: new Error('Supabase is not configured.') }
  }

  const { data, error } = await supabase
    .from('offers')
    .update({ status })
    .eq('id', offerId)
    .select(offerFields)
    .single()

  return { data, error }
}

export function hasPendingOffer(offers, buyerId) {
  return offers.some((offer) => offer.buyer_id === buyerId && offer.status === 'pending')
}
