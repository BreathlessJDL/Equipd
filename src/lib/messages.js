import { supabase } from './supabase'

const conversationFields = `
  id,
  listing_id,
  buyer_id,
  seller_id,
  created_at,
  updated_at,
  listing:listings(id, slug, title, status)
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

export function formatMessageTimestamp(value) {
  if (!value) return ''

  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

export async function startConversationForListing({ listingId, buyerId, sellerId }) {
  if (!supabase) {
    return { data: null, error: new Error('Supabase is not configured.') }
  }

  if (buyerId === sellerId) {
    return { data: null, error: new Error('You cannot message yourself.') }
  }

  const { data: existing, error: existingError } = await supabase
    .from('conversations')
    .select(conversationFields)
    .eq('listing_id', listingId)
    .eq('buyer_id', buyerId)
    .maybeSingle()

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

export async function fetchMyConversations(userId) {
  if (!supabase) {
    return { data: null, error: new Error('Supabase is not configured.') }
  }

  const { data, error } = await supabase
    .from('conversations')
    .select(conversationFields)
    .or(`buyer_id.eq.${userId},seller_id.eq.${userId}`)
    .order('updated_at', { ascending: false })

  return { data, error }
}

export async function fetchConversationById(conversationId) {
  if (!supabase) {
    return { data: null, error: new Error('Supabase is not configured.') }
  }

  const { data, error } = await supabase
    .from('conversations')
    .select(conversationFields)
    .eq('id', conversationId)
    .maybeSingle()

  return { data, error }
}

export async function fetchConversationMessages(conversationId) {
  if (!supabase) {
    return { data: null, error: new Error('Supabase is not configured.') }
  }

  const { data, error } = await supabase
    .from('messages')
    .select('id, conversation_id, sender_id, body, created_at')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })

  return { data, error }
}

export async function sendMessage({ conversationId, senderId, body }) {
  if (!supabase) {
    return { data: null, error: new Error('Supabase is not configured.') }
  }

  const trimmedBody = body.trim()
  if (!trimmedBody) {
    return { data: null, error: new Error('Message cannot be empty.') }
  }

  const { data, error } = await supabase
    .from('messages')
    .insert({
      conversation_id: conversationId,
      sender_id: senderId,
      body: trimmedBody,
    })
    .select('id, conversation_id, sender_id, body, created_at')
    .single()

  return { data, error }
}

export function isConversationParticipant(conversation, userId) {
  if (!conversation || !userId) return false
  return conversation.buyer_id === userId || conversation.seller_id === userId
}
