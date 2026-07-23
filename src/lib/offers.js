import { parsePriceToPence } from './listings'
import { enrichListingWithImages } from './listingImages'
import { notifyIndexNowForListingChange } from './indexNowNotify'
import { enrichOfferWithOrder, fetchOrdersByOfferIds, getOfferOrder } from './orders'
import { enrichOfferWithPayment, getOfferPayment, isPaymentComplete, paymentFields } from './payments'
import { fetchPublicProfilesByIds } from './profiles'
import { supabase } from './supabase'
import { validateBuyerOfferAmount } from './offerQuantity'

export {
  OFFER_EXCEEDS_ASKING_PRICE_ERROR,
  calculateTotalOfferPence,
  clampOfferQuantity,
  formatPenceAsOfferInput,
  getOfferUnitAmountPence,
  parseOfferQuantityInput,
  parseUnitOfferPence,
  validateBuyerOfferAmount,
  validateBuyerUnitOfferAmount,
} from './offerQuantity'

export const OFFERS_SCHEMA_MIGRATION_HINT =
  'Database migration required: run supabase/offers-schema-alignment.sql in the Supabase SQL Editor, then wait a moment for the schema cache to refresh.'

const offerFieldsCore = `
  id,
  listing_id,
  buyer_id,
  seller_id,
  conversation_id,
  amount_pence,
  quantity,
  status,
  message,
  created_at,
  updated_at
`

const offerFieldsExtended = `
  direction,
  parent_offer_id
`

const offerFields = `${offerFieldsCore}, ${offerFieldsExtended}`

const offerListingSelect = `
  listing:listings(
    id,
    slug,
    title,
    brand,
    model,
    price_pence,
    quantity_available,
    condition,
    location,
    status,
    seller_id,
    collection_available,
    courier_available,
    delivery_notes,
    seller_delivery_radius_miles,
    latitude,
    longitude,
    category:categories(id, name, slug),
    listing_images(id, storage_path, sort_order)
  )
`

const offerPaymentSelect = `
  payment:payments(
    ${paymentFields}
  )
`

const offerHubSelectFull = `${offerFields}, ${offerPaymentSelect}, ${offerListingSelect}`
const offerHubSelectLegacyFields = `${offerFieldsCore}, ${offerPaymentSelect}, ${offerListingSelect}`
const offerHubSelectNoListing = `${offerFields}, ${offerPaymentSelect}`
const offerHubSelectLegacyNoListing = `${offerFieldsCore}, ${offerPaymentSelect}`

export function logSupabaseError(context, error) {
  if (!error) return

  console.error(`[offers] ${context}`, {
    message: error.message,
    details: error.details,
    hint: error.hint,
    code: error.code,
  })
}

function isMissingSchemaColumnError(error, columnName = '') {
  if (!error) return false

  const message = (error.message ?? '').toLowerCase()
  const code = error.code ?? ''

  if (code === 'PGRST204') return true
  if (message.includes('schema cache')) return true
  if (columnName && message.includes(`'${columnName.toLowerCase()}'`)) return true

  return false
}

function enrichOfferSchemaError(error) {
  if (
    isMissingSchemaColumnError(error, 'direction') ||
    isMissingSchemaColumnError(error, 'parent_offer_id')
  ) {
    console.error('[offers]', OFFERS_SCHEMA_MIGRATION_HINT, error)
    return new Error(`${OFFERS_SCHEMA_MIGRATION_HINT} (${error.message})`)
  }

  return error
}

function withDefaultOfferDirection(offer) {
  if (!offer) return offer
  return {
    ...offer,
    direction: offer.direction ?? 'buyer_to_seller',
  }
}

async function selectOffers(queryFactory, selectFields = offerFields) {
  const result = await queryFactory(selectFields)

  if (!result.error || !isMissingSchemaColumnError(result.error, 'direction')) {
    return result
  }

  console.warn('[offers] Falling back to legacy offer select — apply offers-schema-alignment.sql')
  return queryFactory(offerFieldsCore)
}

function withPrimaryOfferListingImage(query) {
  return query
    .order('sort_order', { ascending: true, foreignTable: 'listings.listing_images' })
    .limit(1, { foreignTable: 'listings.listing_images' })
}

function enrichOfferWithListingFields(offer) {
  if (!offer) return offer

  return enrichOfferWithPayment({
    ...offer,
    listing: offer.listing ? enrichListingWithImages(offer.listing) : null,
  })
}

async function attachOrdersToOffers(offers) {
  const { data: orders, error } = await fetchOrdersByOfferIds(offers.map((offer) => offer.id))

  if (error) {
    return { data: null, error }
  }

  const ordersByOfferId = new Map((orders ?? []).map((order) => [order.offer_id, order]))

  return {
    data: offers.map((offer) => ({
      ...offer,
      order: ordersByOfferId.get(offer.id) ?? null,
    })),
    error: null,
  }
}

async function enrichOffersResponse(offers) {
  const withListingFields = (offers ?? []).map(enrichOfferWithListingFields)
  const { data: withOrders, error } = await attachOrdersToOffers(withListingFields)

  if (error) {
    logSupabaseError('attachOrdersToOffers', error)
    return {
      data: withListingFields.map(enrichOfferWithOrder),
      error: null,
    }
  }

  return { data: (withOrders ?? []).map(enrichOfferWithOrder), error: null }
}

function offerListingMissingFulfilmentFields(listing) {
  if (!listing) return true

  return (
    listing.collection_available === undefined &&
    listing.courier_available === undefined &&
    listing.delivery_notes === undefined
  )
}

async function attachListingsToOffers(offers) {
  const listingIds = [
    ...new Set(
      offers
        .filter(
          (offer) =>
            offer.listing_id &&
            (!offer.listing || offerListingMissingFulfilmentFields(offer.listing)),
        )
        .map((offer) => offer.listing_id),
    ),
  ]

  if (!listingIds.length || !supabase) {
    return offers
  }

  const listingSelectFull = `
    id,
    slug,
    title,
    brand,
    model,
    price_pence,
    condition,
    location,
    status,
    seller_id,
    collection_available,
    courier_available,
    delivery_notes,
    seller_delivery_radius_miles,
    latitude,
    longitude,
    category:categories(id, name, slug),
    listing_images(id, storage_path, sort_order)
  `

  let { data: listings, error } = await supabase
    .from('listings')
    .select(listingSelectFull)
    .in('id', listingIds)

  if (error) {
    logSupabaseError('attachListingsToOffers (full)', error)
    ;({ data: listings, error } = await supabase
      .from('listings')
      .select('id, slug, title, brand, model, price_pence, condition, location, status, seller_id, collection_available, courier_available, delivery_notes, seller_delivery_radius_miles, latitude, longitude')
      .in('id', listingIds))
  }

  if (error) {
    logSupabaseError('attachListingsToOffers (minimal)', error)
    return offers
  }

  const listingsById = new Map(
    (listings ?? []).map((listing) => [listing.id, enrichListingWithImages(listing)]),
  )

  return offers.map((offer) => {
    const fetchedListing = listingsById.get(offer.listing_id) ?? null

    if (!offer.listing) {
      return { ...offer, listing: fetchedListing }
    }

    if (offerListingMissingFulfilmentFields(offer.listing) && fetchedListing) {
      return { ...offer, listing: fetchedListing }
    }

    return offer
  })
}

function attachProfilesToOffers(offers, profilesById) {
  return offers.map((offer) => ({
    ...offer,
    buyer: profilesById.get(offer.buyer_id) ?? null,
    seller: profilesById.get(offer.seller_id) ?? null,
  }))
}

async function queryUserOffers({ userId, role, status, selectFields }) {
  const column = role === 'buyer' ? 'buyer_id' : 'seller_id'
  let query = supabase
    .from('offers')
    .select(selectFields)
    .eq(column, userId)
    .eq('status', status)
    .order('created_at', { ascending: false })

  if (selectFields.includes('listing:listings')) {
    query = withPrimaryOfferListingImage(query)
  }

  return query
}

async function fetchUserOffers({ userId, role, status }) {
  const context = `${role} offers (${status})`
  const attempts = [
    { label: 'full', fields: offerHubSelectFull, embedsListing: true },
    { label: 'legacy-fields', fields: offerHubSelectLegacyFields, embedsListing: true },
    { label: 'no-listing-embed', fields: offerHubSelectNoListing, embedsListing: false },
    { label: 'legacy-no-listing-embed', fields: offerHubSelectLegacyNoListing, embedsListing: false },
    { label: 'core-only', fields: offerFieldsCore, embedsListing: false },
  ]

  let lastError = null

  for (const attempt of attempts) {
    const { data, error } = await queryUserOffers({
      userId,
      role,
      status,
      selectFields: attempt.fields,
    })

    if (error) {
      lastError = error
      logSupabaseError(`fetchUserOffers ${context} [${attempt.label}]`, error)
      continue
    }

    if (attempt.label !== 'full') {
      console.warn(`[offers] Loaded ${context} using "${attempt.label}" fallback`)
    }

    let offers = (data ?? []).map(withDefaultOfferDirection)

    offers = await attachListingsToOffers(offers)

    const profilesById = await fetchPublicProfilesByIds(
      offers.flatMap((offer) => [offer.buyer_id, offer.seller_id]),
    )

    return enrichOffersResponse(attachProfilesToOffers(offers, profilesById))
  }

  return { data: null, error: enrichOfferSchemaError(lastError) }
}

export function getOfferErrorMessage(error) {
  if (!error) return 'Something went wrong. Please try again.'
  if (error.message?.includes(OFFERS_SCHEMA_MIGRATION_HINT)) return error.message
  const inventoryMatch = error.message?.match(
    /Insufficient inventory:\s*requested\s+\d+,\s*available\s+(\d+)/i,
  )
  if (inventoryMatch) {
    const available = Number(inventoryMatch[1])
    return available > 0
      ? `Only ${available} ${available === 1 ? 'item is' : 'items are'} still available. Choose a lower quantity and try again.`
      : 'This listing has just sold out. Refresh the page to see the latest availability.'
  }
  if (error.message?.includes('Listing is not available')) {
    return 'This listing is no longer available. Refresh the page to see the latest status.'
  }
  if (
    error.message?.includes('create_buyer_offer') &&
    error.message?.includes('schema cache')
  ) {
    return 'Offer submission is temporarily unavailable while the database updates. Wait a minute and try again.'
  }
  return error.message || 'Something went wrong. Please try again.'
}

export function formatOfferStatus(status) {
  const labels = {
    pending: 'Pending',
    accepted: 'Accepted',
    rejected: 'Declined',
    declined: 'Declined',
    withdrawn: 'Withdrawn',
    cancelled: 'Cancelled',
    countered: 'Countered',
  }
  return labels[status] ?? status
}

export function isBuyerOffer(offer) {
  return (offer?.direction ?? 'buyer_to_seller') === 'buyer_to_seller'
}

export function isSellerCounterOffer(offer) {
  return offer?.direction === 'seller_to_buyer'
}

/** Pending offer that is part of a counter-offer chain (not the original buyer offer). */
export function isActiveCounterOffer(offer) {
  return offer?.status === 'pending' && offer?.parent_offer_id != null
}

export function getOfferDisplayStatus(offer) {
  if (isActiveCounterOffer(offer)) {
    return { label: 'Counter offer', variant: 'counter' }
  }

  const status = offer?.status ?? 'pending'

  return {
    label: formatOfferStatus(status) || 'Pending',
    variant: status === 'pending' ? 'pending' : status,
  }
}

export function canSellerRespondToOffer(offer) {
  return isBuyerOffer(offer) && offer?.status === 'pending'
}

export function canBuyerRespondToCounterOffer(offer) {
  return isSellerCounterOffer(offer) && offer?.status === 'pending'
}

export function canBuyerWithdrawOffer(offer, userId) {
  return (
    Boolean(userId) &&
    offer?.buyer_id === userId &&
    offer?.status === 'pending' &&
    isBuyerOffer(offer)
  )
}

export function filterBuyerPendingOffers(offers = []) {
  return offers.filter((offer) => offer.status === 'pending')
}

export function filterBuyerCounterOffers(offers = []) {
  return offers.filter((offer) => offer.status === 'pending' && isSellerCounterOffer(offer))
}

export function filterSellerReceivedPendingOffers(offers = []) {
  return offers.filter((offer) => offer.status === 'pending' && isBuyerOffer(offer))
}

export function isOfferCancelled(offer) {
  return offer?.status === 'cancelled'
}

export function canSellerCancelAcceptedOffer(offer) {
  if (offer?.status !== 'accepted') return false

  const payment = getOfferPayment(offer)
  const order = getOfferOrder(offer)

  if (isPaymentComplete(payment)) return false
  if (order?.payout_status === 'paid') return false

  return true
}

export function needsPaidTransactionSupport(payment, order) {
  if (isPaymentComplete(payment)) return true
  if (order?.payout_status === 'paid') return true
  return false
}

export async function cancelAcceptedOffer(offerId) {
  if (!supabase) {
    return { data: null, error: new Error('Supabase is not configured.') }
  }

  const { data, error } = await supabase.rpc('cancel_accepted_offer', {
    p_offer_id: offerId,
  })

  return { data, error }
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

  const { data, error } = await selectOffers((fields) =>
    supabase
      .from('offers')
      .select(`${fields}, ${offerPaymentSelect}`)
      .eq('listing_id', listingId)
      .order('created_at', { ascending: false }),
  )

  if (error) {
    return { data: null, error: enrichOfferSchemaError(error) }
  }

  return enrichOffersResponse((data ?? []).map(withDefaultOfferDirection))
}

export async function createOffer({
  listingId,
  buyerId,
  sellerId,
  amountPence,
  message,
  conversationId,
  listingPricePence,
  quantity = 1,
  direction = 'buyer_to_seller',
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

  const { data: listingRow, error: listingError } = await supabase
    .from('listings')
    .select('id, status')
    .eq('id', listingId)
    .maybeSingle()

  if (listingError) {
    return { data: null, error: listingError }
  }

  if (!listingRow || String(listingRow.status).toLowerCase() !== 'active') {
    return {
      data: null,
      error: new Error('Offers can only be made on active listings.'),
    }
  }

  if (direction === 'buyer_to_seller') {
    const amountError = validateBuyerOfferAmount(amountPence, listingPricePence, quantity)
    if (amountError) {
      return { data: null, error: new Error(amountError) }
    }
  }

  if (direction !== 'buyer_to_seller') {
    return { data: null, error: new Error('New offers must be buyer-to-seller.') }
  }

  const { data, error } = await supabase.rpc('create_buyer_offer', {
    p_listing_id: listingId,
    p_conversation_id: conversationId,
    p_quantity: quantity,
    p_total_amount_pence: amountPence,
    p_message: message?.trim() || null,
  })

  return { data: withDefaultOfferDirection(data), error }
}

export async function createOfferFromForm({
  listingId,
  buyerId,
  sellerId,
  amountInput,
  message,
  conversationId,
  listingPricePence,
  quantity = 1,
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
    listingPricePence,
    quantity,
  })
}

async function notifyListingStatusTransitionIndexNow(listingId, source) {
  if (!listingId || !supabase) return
  try {
    const { data: listing } = await supabase
      .from('listings')
      .select('*')
      .eq('id', listingId)
      .maybeSingle()
    if (!listing) return

    // Offer/payment RPCs leave public `active` without going through updateListing.
    notifyIndexNowForListingChange({
      previous: { ...listing, status: 'active' },
      next: listing,
      action: 'update',
      source,
    })
  } catch (error) {
    console.info(
      '[indexnow] offer status notify failed',
      String(error?.message || error).slice(0, 200),
    )
  }
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

  void notifyListingStatusTransitionIndexNow(accepted?.listing_id, 'acceptOffer')

  const { data: offers, error: fetchError } = await fetchOffersForListing(accepted.listing_id)

  if (fetchError) {
    return { data: accepted, offers: null, error: fetchError }
  }

  return { data: accepted, offers: offers ?? [], error: null }
}

export async function rejectOffer(offerId) {
  return declineOffer(offerId)
}

export async function declineOffer(offerId) {
  if (!supabase) {
    return { data: null, error: new Error('Supabase is not configured.') }
  }

  const { data, error } = await supabase.rpc('decline_offer', {
    p_offer_id: offerId,
  })

  return { data, error }
}

export async function counterOffer(offerId, amountInput) {
  if (!supabase) {
    return { data: null, error: new Error('Supabase is not configured.') }
  }

  const amountPence = parsePriceToPence(amountInput)

  if (!amountPence) {
    return { data: null, error: new Error('Enter a valid counter-offer amount greater than zero.') }
  }

  const { data, error } = await supabase.rpc('counter_offer', {
    p_offer_id: offerId,
    p_amount_pence: amountPence,
  })

  return { data, error }
}

export async function acceptCounterOffer(offerId) {
  if (!supabase) {
    return { data: null, offers: null, error: new Error('Supabase is not configured.') }
  }

  const { data: accepted, error } = await supabase.rpc('accept_counter_offer', {
    p_offer_id: offerId,
  })

  if (error) {
    return { data: null, offers: null, error }
  }

  void notifyListingStatusTransitionIndexNow(accepted?.listing_id, 'acceptCounterOffer')

  const { data: offers, error: fetchError } = await fetchOffersForListing(accepted.listing_id)

  if (fetchError) {
    return { data: accepted, offers: null, error: fetchError }
  }

  return { data: accepted, offers: offers ?? [], error: null }
}

export async function withdrawOffer(offerId) {
  if (!supabase) {
    return { data: null, error: new Error('Supabase is not configured.') }
  }

  const { data, error } = await supabase.rpc('withdraw_offer', {
    p_offer_id: offerId,
  })

  if (!error) {
    return { data: withDefaultOfferDirection(data), error: null }
  }

  const message = (error.message ?? '').toLowerCase()
  const rpcMissing =
    error.code === 'PGRST202' ||
    message.includes('withdraw_offer') ||
    message.includes('could not find the function')

  if (!rpcMissing) {
    return { data: null, error: enrichOfferSchemaError(error) }
  }

  console.warn('[offers] withdraw_offer RPC missing — using direct update. Run withdraw-offer-rpc.sql')

  const updateResult = await updateOfferStatus(offerId, 'withdrawn')

  if (updateResult.error || !updateResult.data?.conversation_id) {
    return updateResult
  }

  await supabase.rpc('insert_conversation_system_message', {
    p_conversation_id: updateResult.data.conversation_id,
    p_body: 'Offer withdrawn.',
  })

  return updateResult
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
  return offers.some(
    (offer) =>
      offer.buyer_id === buyerId &&
      offer.status === 'pending' &&
      (offer.direction ?? 'buyer_to_seller') === 'buyer_to_seller',
  )
}

export function hasPendingCounterOffer(offers, buyerId) {
  return offers.some(
    (offer) =>
      offer.buyer_id === buyerId &&
      offer.status === 'pending' &&
      offer.direction === 'seller_to_buyer',
  )
}

export async function fetchBuyerOffers(userId, status) {
  if (!supabase) {
    return { data: null, error: new Error('Supabase is not configured.') }
  }

  return fetchUserOffers({ userId, role: 'buyer', status })
}

export async function fetchSellerOffers(userId, status) {
  if (!supabase) {
    return { data: null, error: new Error('Supabase is not configured.') }
  }

  return fetchUserOffers({ userId, role: 'seller', status })
}
