export const OFFER_ACCEPTED_HANDOVER_SYSTEM_MESSAGE =
  'Offer accepted! Complete your payment to secure the equipment. Once payment is confirmed, you can find contact details and collection or delivery information in your Order Details.'

export const COUNTER_OFFER_ACCEPTED_HANDOVER_SYSTEM_MESSAGE =
  'Counter-offer accepted! Complete your payment to secure the equipment. Once payment is confirmed, you can find contact details and collection or delivery information in your Order Details.'

export function isOfferAcceptedSystemMessage(message) {
  if (message?.message_type !== 'system') return false

  const body = message?.body?.trim() ?? ''
  return /^(counter-)?offer accepted/i.test(body)
}

export function getConversationOrderForViewer(offers, conversation, userId) {
  if (!conversation?.id || !userId) return null

  for (const offer of offers ?? []) {
    if (offer?.conversation_id && offer.conversation_id !== conversation.id) continue

    const order = offer?.order
    if (!order?.id) continue
    if (order.buyer_id !== userId && order.seller_id !== userId) continue
    if (conversation.listing_id && order.listing_id && order.listing_id !== conversation.listing_id) {
      continue
    }

    return order
  }

  return null
}
