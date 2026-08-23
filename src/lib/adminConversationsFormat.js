export const ADMIN_CONVERSATION_PAGE_SIZE = 40
export const ADMIN_CONVERSATION_MESSAGE_PAGE_SIZE = 80

export function formatAdminConversationParticipantName(participant) {
  if (!participant || participant.deleted) return 'Deleted user'
  const username = participant.username?.trim()
  if (username) return username
  const displayName = participant.displayName?.trim() || participant.display_name?.trim()
  if (displayName) return displayName
  return 'Unknown user'
}

export function formatAdminConversationPreview(message) {
  if (!message) return 'No messages yet'

  const type = message.messageType || message.message_type
  if (type === 'offer') return 'Offer update'
  if (type === 'system') return message.body?.trim() || 'System update'

  const attachmentCount = Number(message.attachmentCount ?? message.attachment_count ?? 0)
  const attachments = Array.isArray(message.attachments) ? message.attachments : []
  const count = attachmentCount || attachments.length
  const body = message.body?.trim()

  if (count > 0) {
    const photoLabel = count === 1 ? 'Photo' : `${count} photos`
    return body || photoLabel
  }

  return body || 'Message'
}

export function formatAdminConversationTime(value, now = new Date()) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''

  const time = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date)

  const dayFormat = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/London',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })

  if (dayFormat.format(date) === dayFormat.format(now)) {
    return time
  }

  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date)
}

export function getAdminListingPublicPath(listing) {
  if (!listing?.public || !listing.slug) return null
  return `/listings/${listing.slug}`
}

export function getAdminConversationAuditHasMessageContent(entry) {
  if (!entry || typeof entry !== 'object') return false
  const keys = Object.keys(entry)
  return keys.some((key) => /body|content|message/i.test(key) && key !== 'conversation_id' && key !== 'conversationId')
}

function parseParticipant(raw) {
  if (!raw) return null
  return {
    id: raw.id ?? null,
    deleted: Boolean(raw.deleted),
    username: raw.username ?? null,
    displayName: raw.displayName ?? raw.display_name ?? null,
    avatarUrl: raw.avatarUrl ?? raw.avatar_url ?? null,
  }
}

function parseListing(raw) {
  if (!raw) return null
  return {
    id: raw.id ?? null,
    title: raw.title ?? null,
    slug: raw.slug ?? null,
    status: raw.status ?? null,
    pricePence: raw.pricePence ?? raw.price_pence ?? null,
    imagePath: raw.imagePath ?? raw.image_path ?? null,
    public: Boolean(raw.public),
  }
}

function parseMessage(raw) {
  if (!raw) return null
  return {
    id: raw.id,
    body: raw.body ?? '',
    messageType: raw.messageType ?? raw.message_type ?? 'text',
    createdAt: raw.createdAt ?? raw.created_at,
    senderId: raw.senderId ?? raw.sender_id ?? null,
    offerId: raw.offerId ?? raw.offer_id ?? null,
    attachmentCount: raw.attachmentCount ?? raw.attachment_count ?? (Array.isArray(raw.attachments) ? raw.attachments.length : 0),
    attachments: Array.isArray(raw.attachments)
      ? raw.attachments.map((attachment) => ({
          id: attachment.id,
          storage_path: attachment.storage_path ?? attachment.storagePath,
          mime_type: attachment.mime_type ?? attachment.mimeType,
          file_size_bytes: attachment.file_size_bytes ?? attachment.fileSizeBytes,
          image_width: attachment.image_width ?? attachment.imageWidth,
          image_height: attachment.image_height ?? attachment.imageHeight,
          display_order: attachment.display_order ?? attachment.displayOrder ?? 0,
        }))
      : [],
    offer: raw.offer
      ? {
          id: raw.offer.id,
          amountPence: raw.offer.amountPence ?? raw.offer.amount_pence,
          quantity: raw.offer.quantity ?? 1,
          status: raw.offer.status,
          direction: raw.offer.direction,
        }
      : null,
  }
}

export function parseAdminConversationList(payload) {
  const source = payload && typeof payload === 'object' ? payload : {}
  const items = Array.isArray(source.items) ? source.items : []
  return {
    items: items.map((item) => ({
      id: item.id,
      createdAt: item.createdAt ?? item.created_at,
      updatedAt: item.updatedAt ?? item.updated_at,
      listing: parseListing(item.listing),
      buyer: parseParticipant(item.buyer),
      seller: parseParticipant(item.seller),
      lastMessage: parseMessage(item.lastMessage ?? item.last_message),
    })),
    total: Number(source.total) || 0,
    limit: Number(source.limit) || ADMIN_CONVERSATION_PAGE_SIZE,
    offset: Number(source.offset) || 0,
  }
}

export function parseAdminConversationDetail(payload) {
  const source = payload && typeof payload === 'object' ? payload : {}
  const conversation = source.conversation
  if (!conversation) {
    return { conversation: null, messages: [], hasMore: false }
  }

  return {
    conversation: {
      id: conversation.id,
      createdAt: conversation.createdAt ?? conversation.created_at,
      updatedAt: conversation.updatedAt ?? conversation.updated_at,
      listing: parseListing(conversation.listing),
      buyer: parseParticipant(conversation.buyer),
      seller: parseParticipant(conversation.seller),
    },
    messages: Array.isArray(source.messages) ? source.messages.map(parseMessage).filter(Boolean) : [],
    hasMore: Boolean(source.hasMore ?? source.has_more),
  }
}
