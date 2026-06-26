import {
  logBlockedMarketplaceMessage,
  MARKETPLACE_MESSAGE_BLOCK_MESSAGE,
  validateMarketplaceMessageWithContext,
} from './marketplaceMessageValidation'
import { supabase } from './supabase'

export const MESSAGE_ATTACHMENTS_BUCKET = 'message-attachments'

export const ALLOWED_MESSAGE_ATTACHMENT_TYPES = ['image/jpeg', 'image/png', 'image/webp']

export const MAX_MESSAGE_ATTACHMENT_FILE_SIZE = 8 * 1024 * 1024

export const MAX_MESSAGE_ATTACHMENTS_PER_MESSAGE = 4

const SIGNED_URL_TTL_SECONDS = 60 * 60

const MIME_EXTENSION = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

export function getMessageAttachmentErrorMessage(error) {
  if (!error) return 'Something went wrong. Please try again.'
  return error.message || 'Something went wrong. Please try again.'
}

export function validateMessageAttachmentFile(file) {
  if (!file) {
    return 'Image file is required.'
  }

  const mimeType = normalizeMessageAttachmentMimeType(file.type)

  if (!ALLOWED_MESSAGE_ATTACHMENT_TYPES.includes(mimeType)) {
    return 'Only JPG, PNG, and WebP images are allowed.'
  }

  if (file.size > MAX_MESSAGE_ATTACHMENT_FILE_SIZE) {
    return 'Each image must be 8 MB or smaller.'
  }

  return null
}

export function validateMessageAttachmentMetadata(metadata) {
  if (!metadata) {
    return 'Attachment metadata is required.'
  }

  const mimeType = metadata.mime_type?.trim()

  if (!ALLOWED_MESSAGE_ATTACHMENT_TYPES.includes(mimeType)) {
    return 'Only JPG, PNG, and WebP images are allowed.'
  }

  const fileSize = Number(metadata.file_size_bytes)

  if (!Number.isFinite(fileSize) || fileSize <= 0 || fileSize > MAX_MESSAGE_ATTACHMENT_FILE_SIZE) {
    return 'Each image must be 8 MB or smaller.'
  }

  const displayOrder = Number(metadata.display_order)

  if (!Number.isInteger(displayOrder) || displayOrder < 0 || displayOrder > 3) {
    return 'Attachment display order is invalid.'
  }

  if (!metadata.storage_path?.trim()) {
    return 'Attachment storage path is missing.'
  }

  const width = metadata.image_width
  const height = metadata.image_height
  const hasWidth = width != null && width !== ''
  const hasHeight = height != null && height !== ''

  if (hasWidth !== hasHeight) {
    return 'Attachment image dimensions are invalid.'
  }

  return null
}

export function normalizeMessageAttachmentMimeType(mimeType) {
  if (mimeType === 'image/jpg') {
    return 'image/jpeg'
  }

  return mimeType
}

export function buildMessageAttachmentStoragePath(conversationId, userId, file) {
  const mimeType = normalizeMessageAttachmentMimeType(file.type)
  const extension = MIME_EXTENSION[mimeType] ?? 'jpg'
  return `${conversationId}/${userId}/${crypto.randomUUID()}.${extension}`
}

export function assertMessageAttachmentStoragePath(storagePath, { conversationId, userId }) {
  const expectedPrefix = `${conversationId}/${userId}/`

  if (!storagePath?.startsWith(expectedPrefix)) {
    throw new Error('Attachment storage path does not match the conversation or uploader.')
  }

  if (storagePath.includes('/../') || storagePath.endsWith('/')) {
    throw new Error('Attachment storage path is invalid.')
  }
}

export async function readMessageAttachmentImageDimensions(file) {
  if (typeof window === 'undefined' || !(file instanceof File)) {
    return { width: null, height: null }
  }

  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const image = new Image()

    image.onload = () => {
      URL.revokeObjectURL(url)
      resolve({
        width: image.naturalWidth || null,
        height: image.naturalHeight || null,
      })
    }

    image.onerror = () => {
      URL.revokeObjectURL(url)
      resolve({ width: null, height: null })
    }

    image.src = url
  })
}

export async function uploadMessageAttachmentImage({ conversationId, userId, file, displayOrder }) {
  if (!supabase) {
    return { data: null, error: new Error('Supabase is not configured.') }
  }

  const validationError = validateMessageAttachmentFile(file)

  if (validationError) {
    return { data: null, error: new Error(validationError) }
  }

  const mimeType = normalizeMessageAttachmentMimeType(file.type)
  const storagePath = buildMessageAttachmentStoragePath(conversationId, userId, file)
  const { width, height } = await readMessageAttachmentImageDimensions(file)

  const { error: uploadError } = await supabase.storage
    .from(MESSAGE_ATTACHMENTS_BUCKET)
    .upload(storagePath, file, {
      cacheControl: '3600',
      upsert: false,
      contentType: mimeType,
    })

  if (uploadError) {
    return { data: null, error: uploadError }
  }

  return {
    data: {
      storage_path: storagePath,
      mime_type: mimeType,
      file_size_bytes: file.size,
      image_width: width,
      image_height: height,
      display_order: displayOrder,
    },
    error: null,
  }
}

export async function uploadMessageAttachmentImages({ conversationId, userId, files }) {
  const selectedFiles = [...(files ?? [])]

  if (selectedFiles.length > MAX_MESSAGE_ATTACHMENTS_PER_MESSAGE) {
    return {
      data: [],
      error: new Error(`You can attach up to ${MAX_MESSAGE_ATTACHMENTS_PER_MESSAGE} images per message.`),
    }
  }

  const uploaded = []

  for (let index = 0; index < selectedFiles.length; index += 1) {
    const file = selectedFiles[index]
    const { data, error } = await uploadMessageAttachmentImage({
      conversationId,
      userId,
      file,
      displayOrder: index,
    })

    if (error) {
      if (uploaded.length > 0) {
        await cleanupMessageAttachmentStorage(uploaded.map((item) => item.storage_path))
      }

      return { data: uploaded, error }
    }

    uploaded.push(data)
  }

  return { data: uploaded, error: null }
}

export async function cleanupMessageAttachmentStorage(storagePaths) {
  if (!supabase) {
    return { error: new Error('Supabase is not configured.') }
  }

  const paths = [...new Set((storagePaths ?? []).filter(Boolean))]

  if (!paths.length) {
    return { error: null }
  }

  const { error } = await supabase.storage.from(MESSAGE_ATTACHMENTS_BUCKET).remove(paths)
  return { error }
}

export async function getMessageAttachmentSignedUrl(storagePath) {
  if (!supabase || !storagePath) {
    return { url: null, error: new Error('Attachment file path is missing.') }
  }

  const { data, error } = await supabase.storage
    .from(MESSAGE_ATTACHMENTS_BUCKET)
    .createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS)

  if (error) {
    return { url: null, error }
  }

  return { url: data.signedUrl, error: null }
}

export async function getMessageAttachmentSignedUrls(storagePaths) {
  const entries = await Promise.all(
    (storagePaths ?? []).map(async (path) => {
      const { url, error } = await getMessageAttachmentSignedUrl(path)
      return [path, { url, error }]
    }),
  )

  return Object.fromEntries(entries)
}

export function sortMessageAttachments(attachments = []) {
  return [...attachments].sort((left, right) => left.display_order - right.display_order)
}

export function normalizeMessageAttachments(message) {
  if (!message) return message

  const attachments = sortMessageAttachments(
    Array.isArray(message.attachments) ? message.attachments : [],
  )

  return {
    ...message,
    attachments,
  }
}

function normalizeRpcMessageRow(row) {
  if (!row) return null

  return normalizeMessageAttachments({
    id: row.id,
    conversation_id: row.conversation_id,
    sender_id: row.sender_id,
    body: row.body,
    message_type: row.message_type,
    offer_id: row.offer_id ?? null,
    created_at: row.created_at,
    attachments: Array.isArray(row.attachments) ? row.attachments : [],
  })
}

export async function sendMessageWithAttachments({
  conversationId,
  senderId,
  body = '',
  attachments = [],
  recentMessages = [],
}) {
  if (!supabase) {
    return { data: null, error: new Error('Supabase is not configured.') }
  }

  const trimmedBody = body?.trim() ?? ''
  const attachmentMetadata = [...attachments]

  if (!trimmedBody && attachmentMetadata.length === 0) {
    return { data: null, error: new Error('Add a message or at least one image.') }
  }

  if (attachmentMetadata.length > MAX_MESSAGE_ATTACHMENTS_PER_MESSAGE) {
    return {
      data: null,
      error: new Error(`You can attach up to ${MAX_MESSAGE_ATTACHMENTS_PER_MESSAGE} images per message.`),
    }
  }

  const displayOrders = new Set()

  for (const metadata of attachmentMetadata) {
    const metadataError = validateMessageAttachmentMetadata(metadata)

    if (metadataError) {
      return { data: null, error: new Error(metadataError) }
    }

    try {
      assertMessageAttachmentStoragePath(metadata.storage_path, {
        conversationId,
        userId: senderId,
      })
    } catch (pathError) {
      return { data: null, error: pathError }
    }

    if (displayOrders.has(metadata.display_order)) {
      return { data: null, error: new Error('Attachment display order values must be unique.') }
    }

    displayOrders.add(metadata.display_order)
  }

  let sanitizedBody = ''

  if (trimmedBody) {
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

      return {
        data: null,
        error: new Error(validation.error ?? MARKETPLACE_MESSAGE_BLOCK_MESSAGE),
      }
    }

    sanitizedBody = validation.sanitizedBody
  }

  const rpcAttachments = attachmentMetadata.map((metadata) => ({
    storage_path: metadata.storage_path,
    mime_type: metadata.mime_type,
    file_size_bytes: metadata.file_size_bytes,
    image_width: metadata.image_width ?? null,
    image_height: metadata.image_height ?? null,
    display_order: metadata.display_order,
  }))

  const { data, error } = await supabase.rpc('send_message_with_attachments', {
    p_conversation_id: conversationId,
    p_body: sanitizedBody,
    p_attachments: rpcAttachments,
  })

  if (error) {
    return { data: null, error }
  }

  return {
    data: normalizeRpcMessageRow(data),
    error: null,
  }
}
