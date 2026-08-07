/**
 * Pure helpers for resolving the other conversation participant.
 * Kept free of Supabase imports so Node unit tests can load this module.
 */

function normalizeEmbeddedRow(row) {
  if (!row) return null
  return Array.isArray(row) ? (row[0] ?? null) : row
}

export function sameParticipantId(left, right) {
  if (left == null || right == null) return false
  return String(left) === String(right)
}

export function getConversationParticipantLabel(profile) {
  const displayName = profile?.display_name?.trim()
  if (displayName) return displayName

  const username = profile?.username?.trim()
  if (username) return username

  return null
}

export function getConversationOtherPartyId(conversation, userId) {
  if (!conversation || !userId) return null
  if (sameParticipantId(conversation.buyer_id, userId)) return conversation.seller_id
  if (sameParticipantId(conversation.seller_id, userId)) return conversation.buyer_id
  return null
}

export function getConversationOtherPartyProfile(conversation, userId) {
  if (!conversation || !userId) return null

  if (sameParticipantId(conversation.buyer_id, userId)) {
    return normalizeEmbeddedRow(conversation.seller)
  }

  if (sameParticipantId(conversation.seller_id, userId)) {
    return normalizeEmbeddedRow(conversation.buyer)
  }

  return null
}

export function getConversationOtherPartyName(conversation, userId) {
  const otherParty = getConversationOtherPartyProfile(conversation, userId)
  if (!otherParty) return 'Unknown user'
  return getConversationParticipantLabel(otherParty) || 'Unknown user'
}

export function getConversationViewerRoleLabel(conversation, userId) {
  if (!conversation || !userId) return ''

  if (sameParticipantId(conversation.buyer_id, userId)) {
    return "You're the buyer"
  }

  if (sameParticipantId(conversation.seller_id, userId)) {
    return "You're the seller"
  }

  return ''
}
