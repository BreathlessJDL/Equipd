import { supabase } from './supabase'
import { getListingImagePublicUrl } from './listingImages'
import {
  ADMIN_CONVERSATION_PAGE_SIZE,
  ADMIN_CONVERSATION_MESSAGE_PAGE_SIZE,
  parseAdminConversationDetail,
  parseAdminConversationList,
} from './adminConversationsFormat'

export {
  ADMIN_CONVERSATION_PAGE_SIZE,
  ADMIN_CONVERSATION_MESSAGE_PAGE_SIZE,
  formatAdminConversationParticipantName,
  formatAdminConversationPreview,
  formatAdminConversationTime,
  getAdminListingPublicPath,
  getAdminConversationAuditHasMessageContent,
  parseAdminConversationList,
  parseAdminConversationDetail,
} from './adminConversationsFormat'

export function getAdminListingImageUrl(listing) {
  if (!listing) return null
  if (listing.imageUrl) return listing.imageUrl
  return getListingImagePublicUrl(listing.imagePath || listing.image_path)
}

export async function fetchAdminConversations({ query = '', limit = ADMIN_CONVERSATION_PAGE_SIZE, offset = 0 } = {}) {
  if (!supabase) {
    return { data: null, error: new Error('Supabase is not configured.') }
  }

  const { data, error } = await supabase.rpc('admin_list_conversations', {
    p_query: query?.trim() ? query.trim() : null,
    p_limit: limit,
    p_offset: offset,
  })

  if (error) return { data: null, error }
  return { data: parseAdminConversationList(data), error: null }
}

export async function fetchAdminConversation(conversationId, { before = null, limit = ADMIN_CONVERSATION_MESSAGE_PAGE_SIZE } = {}) {
  if (!supabase) {
    return { data: null, error: new Error('Supabase is not configured.') }
  }

  const { data, error } = await supabase.rpc('admin_get_conversation', {
    p_conversation_id: conversationId,
    p_before: before,
    p_limit: limit,
  })

  if (error) return { data: null, error }
  return { data: parseAdminConversationDetail(data), error: null }
}
