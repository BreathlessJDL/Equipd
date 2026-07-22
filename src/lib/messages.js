import { supabase } from './supabase'
import { validateMarketplaceMessageWithContext, logBlockedMarketplaceMessage } from './marketplaceMessageValidation'
import { enrichListingWithImages } from './listingImages'
import { paymentFields } from './payments'
import { enrichOfferWithOrder, fetchOrdersByOfferIds } from './orders'
import { buildAvatarProfile, getProfileDisplayName } from './profiles'
import { formatNotificationRelativeTime } from './notificationPresentation'
import { normalizeMessageAttachments } from './messageAttachments'

const messageFields = `
  id,
  conversation_id,
  sender_id,
  body,
  message_type,
  offer_id,
  created_at
`

const messageOfferSelect = `
  offer:offers(
    id,
    listing_id,
    buyer_id,
    seller_id,
    conversation_id,
    amount_pence,
    quantity,
    status,
    message,
    direction,
    parent_offer_id,
    created_at,
    updated_at,
    payment:payments(${paymentFields}),
    listing:listings(
      id,
      slug,
      title,
      price_pence,
      quantity_available,
      status,
      collection_available,
      courier_available,
      delivery_notes,
      seller_delivery_radius_miles,
      latitude,
      longitude,
      listing_images(id, storage_path, sort_order)
    )
  )
`

const messageAttachmentSelect = `
  attachments:message_attachments(
    id,
    storage_path,
    mime_type,
    file_size_bytes,
    image_width,
    image_height,
    display_order,
    created_at
  )
`

const messageSelect = `${messageFields}, ${messageAttachmentSelect}, ${messageOfferSelect}`

const conversationListingSelect = `
  listing:listings(
    id,
    slug,
    title,
    price_pence,
    status,
    collection_available,
    courier_available,
    delivery_notes,
    seller_delivery_radius_miles,
    latitude,
    longitude,
    listing_images(id, storage_path, sort_order)
  )
`

const conversationFields = `
  id,
  listing_id,
  buyer_id,
  seller_id,
  created_at,
  updated_at,
  ${conversationListingSelect.trim()},
  read_state:conversation_reads(unread_count, last_read_at)
`

const conversationListFields = `
  id,
  listing_id,
  buyer_id,
  seller_id,
  created_at,
  updated_at,
  ${conversationListingSelect.trim()},
  read_state:conversation_reads(unread_count, last_read_at),
  buyer:profiles!buyer_id(id, display_name, username, avatar_url),
  seller:profiles!seller_id(id, display_name, username, avatar_url),
  messages(body, message_type, sender_id, created_at, attachments:message_attachments(id))
`

const conversationDetailFields = `
  ${conversationFields.trim()},
  buyer:profiles!buyer_id(id, display_name, username, avatar_url),
  seller:profiles!seller_id(id, display_name, username, avatar_url)
`

export function getMessageErrorMessage(error) {
  if (!error) return 'Something went wrong. Please try again.'
  return error.message || 'Something went wrong. Please try again.'
}

export function getConversationOtherPartyId(conversation, userId) {
  if (!conversation || !userId) return null
  if (conversation.buyer_id === userId) return conversation.seller_id
  if (conversation.seller_id === userId) return conversation.buyer_id
  return null
}

export function getConversationReadState(conversation) {
  const state = conversation?.read_state

  if (!state) {
    return { unread_count: 0, last_read_at: null }
  }

  const row = Array.isArray(state) ? (state[0] ?? null) : state

  return {
    unread_count: row?.unread_count ?? 0,
    last_read_at: row?.last_read_at ?? null,
  }
}

export function getConversationUnreadCount(conversation) {
  return getConversationReadState(conversation).unread_count ?? 0
}

function normalizeEmbeddedRow(row) {
  if (!row) return null
  return Array.isArray(row) ? (row[0] ?? null) : row
}

function listingHasDisplayableImage(listing) {
  if (!listing) return false

  return Boolean(
    listing.primary_image_url ||
      listing.listing_images?.some((image) => image?.url || image?.storage_path),
  )
}

function listingMissingFulfilmentFields(listing) {
  if (!listing) return true

  return (
    listing.collection_available === undefined &&
    listing.courier_available === undefined &&
    listing.delivery_notes === undefined
  )
}

function mergeOfferListingSources(...sources) {
  let merged = null

  for (const source of sources) {
    const normalized = source ? enrichListingWithImages(normalizeEmbeddedRow(source)) : null

    if (!normalized) continue

    if (!merged) {
      merged = normalized
      continue
    }

    merged = {
      ...merged,
      ...normalized,
      listing_images: listingHasDisplayableImage(normalized)
        ? normalized.listing_images
        : merged.listing_images,
      primary_image_url: normalized.primary_image_url ?? merged.primary_image_url,
    }
  }

  return merged
}

function resolveMessageOfferListing(offer, { conversationListing, listingsById } = {}) {
  if (!offer) return null

  const embeddedListing = normalizeEmbeddedRow(offer.listing)
  const fetchedListing = offer.listing_id ? listingsById?.get(offer.listing_id) : null
  const conversationMatch =
    conversationListing && offer.listing_id === conversationListing.id
      ? conversationListing
      : null

  return mergeOfferListingSources(embeddedListing, fetchedListing, conversationMatch, {
    id: offer.listing_id,
    slug: conversationListing?.slug,
    title: conversationListing?.title,
  })
}

function enrichMessageOffer(message, listingContext = {}) {
  if (!message?.offer) return message

  const offer = normalizeEmbeddedRow(message.offer)
  const payment = normalizeEmbeddedRow(offer?.payment)
  const listing = resolveMessageOfferListing(offer, listingContext)

  return {
    ...message,
    offer: offer
      ? {
          ...offer,
          listing,
          payment,
        }
      : null,
  }
}

async function fetchListingsByIdsForMessages(listingIds) {
  const ids = [...new Set((listingIds ?? []).filter(Boolean))]

  if (!ids.length || !supabase) {
    return new Map()
  }

  const listingSelect = `
    id,
    slug,
    title,
    price_pence,
    status,
    collection_available,
    courier_available,
    delivery_notes,
    seller_delivery_radius_miles,
    latitude,
    longitude,
    listing_images(id, storage_path, sort_order)
  `

  const { data, error } = await supabase.from('listings').select(listingSelect).in('id', ids)

  if (error) {
    console.error('[messages] fetchListingsByIdsForMessages', error)
    return new Map()
  }

  return new Map(
    (data ?? []).map((listing) => [listing.id, enrichListingWithImages(listing)]),
  )
}

function getConversationListing(conversation) {
  if (!conversation?.listing) return null
  return enrichListingWithImages(normalizeEmbeddedRow(conversation.listing))
}

function normalizeConversationLastMessage(messages) {
  const row = normalizeEmbeddedRow(messages)

  if (row) return row

  if (!Array.isArray(messages) || messages.length === 0) {
    return null
  }

  return [...messages].sort(
    (left, right) => new Date(right.created_at) - new Date(left.created_at),
  )[0]
}

export function normalizeConversationForList(conversation) {
  if (!conversation) return conversation

  const { messages, ...rest } = conversation

  return {
    ...rest,
    listing: getConversationListing(conversation),
    buyer: normalizeEmbeddedRow(conversation.buyer),
    seller: normalizeEmbeddedRow(conversation.seller),
    last_message: normalizeConversationLastMessage(messages),
  }
}

export function normalizeConversationDetail(conversation) {
  if (!conversation) return conversation

  return {
    ...conversation,
    listing: getConversationListing(conversation),
    buyer: normalizeEmbeddedRow(conversation.buyer),
    seller: normalizeEmbeddedRow(conversation.seller),
  }
}

export function getConversationOtherPartyName(conversation, userId) {
  const otherParty = getConversationOtherPartyProfile(conversation, userId)
  return otherParty ? getProfileDisplayName(otherParty) : ''
}

export function getConversationViewerRoleLabel(conversation, userId) {
  if (!conversation || !userId) return ''

  if (conversation.buyer_id === userId) {
    return "You're the buyer"
  }

  if (conversation.seller_id === userId) {
    return "You're the seller"
  }

  return ''
}

export function getConversationListingImageUrl(conversation) {
  const listing = conversation?.listing ?? getConversationListing(conversation)
  return listing?.primary_image_url ?? null
}

export function getConversationOtherPartyProfile(conversation, userId) {
  if (!conversation || !userId) return null

  if (conversation.buyer_id === userId) {
    return normalizeEmbeddedRow(conversation.seller)
  }

  if (conversation.seller_id === userId) {
    return normalizeEmbeddedRow(conversation.buyer)
  }

  return null
}

export function getConversationOtherPartyAvatarProfile(conversation, userId) {
  return buildAvatarProfile(getConversationOtherPartyProfile(conversation, userId))
}

export function getConversationParticipantLine(conversation, userId) {
  const otherParty = getConversationOtherPartyProfile(conversation, userId)

  if (!otherParty) return ''

  const name = getProfileDisplayName(otherParty)

  if (!name) return ''

  if (conversation.buyer_id === userId) {
    return `Seller · ${name}`
  }

  if (conversation.seller_id === userId) {
    return `Buyer · ${name}`
  }

  return name
}

export function getConversationMessagePreview(message) {
  if (!message) return ''

  if (message.message_type === 'offer') {
    return 'Offer update'
  }

  if (message.message_type === 'system') {
    return message.body?.trim() ?? 'System update'
  }

  const attachmentCount = Array.isArray(message.attachments) ? message.attachments.length : 0
  const body = message.body?.trim()

  if (attachmentCount > 0) {
    const photoLabel = attachmentCount === 1 ? 'Photo' : `${attachmentCount} photos`

    if (body) {
      return body
    }

    return photoLabel
  }

  if (!body) return ''

  return body
}

export function formatConversationListTime(value) {
  return formatNotificationRelativeTime(value)
}

async function enrichMessagesWithOfferListings(messages, conversation) {
  const conversationListing = getConversationListing(conversation)
  const listingIdsToFetch = new Set()
  const offerIds = []

  for (const message of messages ?? []) {
    const offer = normalizeEmbeddedRow(message?.offer)

    if (!offer?.listing_id) continue

    if (offer.id) {
      offerIds.push(offer.id)
    }

    const embedded = normalizeEmbeddedRow(offer.listing)
    const embeddedEnriched = embedded ? enrichListingWithImages(embedded) : null

    if (
      !listingHasDisplayableImage(embeddedEnriched) ||
      listingMissingFulfilmentFields(embeddedEnriched)
    ) {
      listingIdsToFetch.add(offer.listing_id)
    }
  }

  const listingsById = await fetchListingsByIdsForMessages([...listingIdsToFetch])
  const { data: orders } = await fetchOrdersByOfferIds(offerIds)
  const ordersByOfferId = new Map((orders ?? []).map((order) => [order.offer_id, order]))

  return (messages ?? []).map((message) => {
    const enrichedMessage = enrichMessageOffer(message, { conversationListing, listingsById })

    if (!enrichedMessage.offer) {
      return enrichedMessage
    }

    return {
      ...enrichedMessage,
      offer: enrichOfferWithOrder({
        ...enrichedMessage.offer,
        order: ordersByOfferId.get(enrichedMessage.offer.id) ?? enrichedMessage.offer.order ?? null,
      }),
    }
  })
}

export function isSystemMessage(message) {
  return message?.message_type === 'system'
}

export function isOfferMessage(message) {
  return message?.message_type === 'offer'
}

export function formatMessageTimestamp(value) {
  if (!value) return ''

  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

export async function fetchTotalUnreadMessageCount(userId) {
  if (!supabase) {
    return { count: 0, error: new Error('Supabase is not configured.') }
  }

  const { data, error } = await supabase
    .from('conversation_reads')
    .select('unread_count')
    .eq('user_id', userId)
    .gt('unread_count', 0)

  if (error) {
    return { count: 0, error }
  }

  const count = (data ?? []).reduce((sum, row) => sum + row.unread_count, 0)

  return { count, error: null }
}

export async function markConversationRead(conversationId) {
  if (!supabase) {
    return { data: null, error: new Error('Supabase is not configured.') }
  }

  const { data, error } = await supabase.rpc('mark_conversation_read', {
    p_conversation_id: conversationId,
  })

  return { data, error }
}

export function conversationHasInboxData(conversation) {
  return Boolean(conversation?.last_message)
}

export async function findConversationForListing({ listingId, buyerId }) {
  if (!supabase) {
    return { data: null, error: new Error('Supabase is not configured.') }
  }

  const { data, error } = await supabase
    .from('conversations')
    .select(conversationFields)
    .eq('listing_id', listingId)
    .eq('buyer_id', buyerId)
    .maybeSingle()

  if (error) {
    return { data: null, error }
  }

  return { data: data ?? null, error: null }
}

export async function ensureConversationForListing({ listingId, buyerId, sellerId }) {
  if (!supabase) {
    return { data: null, error: new Error('Supabase is not configured.') }
  }

  if (buyerId === sellerId) {
    return { data: null, error: new Error('You cannot message yourself.') }
  }

  const { data: existing, error: existingError } = await findConversationForListing({
    listingId,
    buyerId,
  })

  if (existingError) {
    return { data: null, error: existingError }
  }

  if (existing) {
    return { data: existing, error: null }
  }

  const { data, error } = await supabase
    .from('conversations')
    .insert({
      listing_id: listingId,
      buyer_id: buyerId,
      seller_id: sellerId,
    })
    .select(conversationFields)
    .single()

  return { data, error }
}

export async function startConversationForListing(args) {
  return ensureConversationForListing(args)
}

export async function resolveMessageThreadNavigation({ listingId, buyerId, sellerId }) {
  if (buyerId === sellerId) {
    return { path: null, error: new Error('You cannot message yourself.') }
  }

  const { data: existing, error } = await findConversationForListing({ listingId, buyerId })

  if (error) {
    return { path: null, error }
  }

  if (existing) {
    return { path: `/messages/${existing.id}`, error: null }
  }

  return { path: `/messages/draft/${listingId}`, error: null }
}

const draftListingSelect = `
  id,
  slug,
  title,
  price_pence,
  status,
  seller_id,
  collection_available,
  courier_available,
  delivery_notes,
  seller_delivery_radius_miles,
  latitude,
  longitude,
  listing_images(id, storage_path, sort_order)
`

export async function fetchDraftConversationContext({ listingId, buyerId }) {
  if (!supabase) {
    return { data: null, error: new Error('Supabase is not configured.') }
  }

  const { data: listing, error: listingError } = await supabase
    .from('listings')
    .select(draftListingSelect)
    .eq('id', listingId)
    .maybeSingle()

  if (listingError) {
    return { data: null, error: listingError }
  }

  if (!listing) {
    return { data: null, error: new Error('Listing not found.') }
  }

  if (buyerId === listing.seller_id) {
    return { data: null, error: new Error('You cannot message yourself.') }
  }

  const { data: profiles, error: profilesError } = await supabase
    .from('profiles_public')
    .select('id, display_name, username, avatar_url')
    .in('id', [buyerId, listing.seller_id])

  if (profilesError) {
    return { data: null, error: profilesError }
  }

  const profileById = new Map((profiles ?? []).map((profile) => [profile.id, profile]))

  return {
    data: normalizeConversationDetail({
      id: null,
      listing_id: listing.id,
      buyer_id: buyerId,
      seller_id: listing.seller_id,
      created_at: null,
      updated_at: null,
      listing,
      buyer: profileById.get(buyerId) ?? null,
      seller: profileById.get(listing.seller_id) ?? null,
      read_state: null,
    }),
    error: null,
  }
}

export async function fetchMyConversations(userId) {
  if (!supabase) {
    return { data: null, error: new Error('Supabase is not configured.') }
  }

  const { data, error } = await supabase
    .from('conversations')
    .select(conversationListFields)
    .or(`buyer_id.eq.${userId},seller_id.eq.${userId}`)
    .order('updated_at', { ascending: false })
    .order('created_at', { foreignTable: 'messages', ascending: false })
    .limit(1, { foreignTable: 'messages' })

  return {
    data: (data ?? []).map(normalizeConversationForList).filter(conversationHasInboxData),
    error,
  }
}

export async function fetchConversationById(conversationId) {
  if (!supabase) {
    return { data: null, error: new Error('Supabase is not configured.') }
  }

  const { data, error } = await supabase
    .from('conversations')
    .select(conversationDetailFields)
    .eq('id', conversationId)
    .maybeSingle()

  if (error || !data) {
    return { data, error }
  }

  return {
    data: normalizeConversationDetail(data),
    error: null,
  }
}

export async function fetchConversationMessages(conversationId, { conversation } = {}) {
  if (!supabase) {
    return { data: null, error: new Error('Supabase is not configured.') }
  }

  const { data, error } = await supabase
    .from('messages')
    .select(messageSelect)
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })

  if (error) {
    return { data: null, error }
  }

  let conversationForEnrichment = conversation

  if (!conversationForEnrichment) {
    const { data: conversationData } = await supabase
      .from('conversations')
      .select(conversationFields)
      .eq('id', conversationId)
      .maybeSingle()

    conversationForEnrichment = conversationData
  }

  const enriched = await enrichMessagesWithOfferListings(data ?? [], conversationForEnrichment)

  return {
    data: enriched.map((message) => normalizeMessageAttachments(message)),
    error: null,
  }
}

export async function insertOfferMessage({ conversationId, offerId, senderId, body = 'Offer' }) {
  if (!supabase) {
    return { data: null, error: new Error('Supabase is not configured.') }
  }

  const extendedPayload = {
    conversation_id: conversationId,
    sender_id: senderId,
    message_type: 'offer',
    offer_id: offerId,
    body,
  }

  let { data, error } = await supabase.from('messages').insert(extendedPayload).select(messageFields).single()

  if (!error) {
    return { data, error: null }
  }

  const message = (error.message ?? '').toLowerCase()
  const missingOfferMessageSchema =
    error.code === 'PGRST204' ||
    message.includes('schema cache') ||
    message.includes("'message_type'") ||
    message.includes("'offer_id'")

  if (!missingOfferMessageSchema) {
    return { data, error }
  }

  console.warn(
    '[messages] Retrying offer message without message_type — run supabase/offer-messaging-flow.sql',
  )

  const retry = await supabase
    .from('messages')
    .insert({
      conversation_id: conversationId,
      sender_id: senderId,
      body: `Offer submitted (${offerId})`,
    })
    .select(messageFields)
    .single()

  return { data: retry.data, error: retry.error }
}

export async function fetchRecentSenderTextMessages({
  conversationId,
  senderId,
  limit = 5,
  withinMinutes = 10,
}) {
  if (!supabase) {
    return { data: [], error: new Error('Supabase is not configured.') }
  }

  const cutoff = new Date(Date.now() - withinMinutes * 60 * 1000).toISOString()

  const { data, error } = await supabase
    .from('messages')
    .select('id, sender_id, body, message_type, created_at')
    .eq('conversation_id', conversationId)
    .eq('sender_id', senderId)
    .eq('message_type', 'text')
    .gte('created_at', cutoff)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    return { data: [], error }
  }

  return { data: (data ?? []).reverse(), error: null }
}

export async function sendMessage({ conversationId, senderId, body }) {
  if (!supabase) {
    return { data: null, error: new Error('Supabase is not configured.') }
  }

  const { data: recentMessages, error: recentError } = await fetchRecentSenderTextMessages({
    conversationId,
    senderId,
  })

  if (recentError) {
    return { data: null, error: recentError }
  }

  const validation = validateMarketplaceMessageWithContext(body, recentMessages, {
    senderId,
  })

  if (!validation.allowed) {
    logBlockedMarketplaceMessage({
      reason: validation.reason,
      matchedPattern: validation.matchedPattern,
      context: validation.context,
      conversationId,
      senderId,
    })

    return { data: null, error: new Error(validation.error) }
  }

  const { data, error } = await supabase.rpc('send_message', {
    p_conversation_id: conversationId,
    p_body: validation.sanitizedBody,
  })

  return { data, error }
}

export function isConversationParticipant(conversation, userId) {
  if (!conversation || !userId) return false
  return conversation.buyer_id === userId || conversation.seller_id === userId
}

export function withConversationReadCleared(conversation, readAt = new Date().toISOString()) {
  if (!conversation) return conversation

  return {
    ...conversation,
    read_state: [{ unread_count: 0, last_read_at: readAt }],
  }
}
