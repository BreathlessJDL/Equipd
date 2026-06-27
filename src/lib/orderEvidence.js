import { supabase } from './supabase'

export const ORDER_EVIDENCE_BUCKET = 'order-evidence'

export const ALLOWED_EVIDENCE_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']

export const ALLOWED_EVIDENCE_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime']

export const MAX_EVIDENCE_IMAGE_SIZE = 5 * 1024 * 1024

export const MAX_EVIDENCE_VIDEO_SIZE = 50 * 1024 * 1024

const SIGNED_URL_TTL_SECONDS = 60 * 60

export function validateEvidenceImageFile(file) {
  if (!ALLOWED_EVIDENCE_IMAGE_TYPES.includes(file.type)) {
    return 'Only JPEG, PNG, and WebP photos are allowed.'
  }

  if (file.size > MAX_EVIDENCE_IMAGE_SIZE) {
    return 'Each photo must be 5 MB or smaller.'
  }

  return null
}

export function validateEvidenceVideoFile(file) {
  if (!ALLOWED_EVIDENCE_VIDEO_TYPES.includes(file.type)) {
    return 'Only MP4, WebM, and MOV videos are allowed.'
  }

  if (file.size > MAX_EVIDENCE_VIDEO_SIZE) {
    return 'Condition video must be 50 MB or smaller.'
  }

  return null
}

function extensionForMimeType(mimeType) {
  const map = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'video/mp4': 'mp4',
    'video/webm': 'webm',
    'video/quicktime': 'mov',
  }

  return map[mimeType] ?? 'bin'
}

export function buildOrderEvidenceStoragePath(orderId, kind, file) {
  const extension = extensionForMimeType(file.type)
  return `${orderId}/${kind}/${crypto.randomUUID()}.${extension}`
}

export function buildDisputeEvidenceStoragePath(orderId, disputeId, file) {
  const extension = extensionForMimeType(file.type)
  return `${orderId}/disputes/${disputeId}/${crypto.randomUUID()}.${extension}`
}

export async function uploadDisputeEvidenceFile(orderId, disputeId, file) {
  if (!supabase) {
    return { path: null, error: new Error('Supabase is not configured.') }
  }

  const storagePath = buildDisputeEvidenceStoragePath(orderId, disputeId, file)

  const { error } = await supabase.storage
    .from(ORDER_EVIDENCE_BUCKET)
    .upload(storagePath, file, {
      cacheControl: '3600',
      upsert: false,
      contentType: file.type,
    })

  if (error) {
    return { path: null, error }
  }

  return { path: storagePath, error: null }
}

export async function uploadOrderEvidenceFile(orderId, kind, file) {
  if (!supabase) {
    return { path: null, error: new Error('Supabase is not configured.') }
  }

  const storagePath = buildOrderEvidenceStoragePath(orderId, kind, file)

  const { error } = await supabase.storage
    .from(ORDER_EVIDENCE_BUCKET)
    .upload(storagePath, file, {
      cacheControl: '3600',
      upsert: false,
      contentType: file.type,
    })

  if (error) {
    return { path: null, error }
  }

  return { path: storagePath, error: null }
}

export async function getOrderEvidenceSignedUrl(storagePath) {
  if (!supabase || !storagePath) {
    return { url: null, error: new Error('Evidence file path is missing.') }
  }

  const { data, error } = await supabase.storage
    .from(ORDER_EVIDENCE_BUCKET)
    .createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS)

  if (error) {
    return { url: null, error }
  }

  return { url: data.signedUrl, error: null }
}

export async function getOrderEvidenceSignedUrls(storagePaths) {
  const entries = await Promise.all(
    (storagePaths ?? []).map(async (path) => {
      const { url, error } = await getOrderEvidenceSignedUrl(path)
      return [path, { url, error }]
    }),
  )

  return Object.fromEntries(entries)
}

export function getCourierEvidenceErrorMessage(error) {
  if (!error) return 'Something went wrong. Please try again.'
  return error.message || 'Something went wrong. Please try again.'
}

export async function submitCourierHandoverEvidence(orderId, payload) {
  if (!supabase) {
    return { data: null, error: new Error('Supabase is not configured.') }
  }

  const { data, error } = await supabase.rpc('submit_courier_handover_evidence', {
    p_order_id: orderId,
    p_payload: payload,
  })

  return { data, error }
}

export function buildCourierEvidencePayload({
  videoPath,
  preCollectionPhotoPath,
  handoverPhotoPath,
  courierName,
  courierCompany,
  dispatchDate,
  evidenceNotes,
  signatureName,
  signatureData,
}) {
  const dispatchAt =
    dispatchDate && /^\d{4}-\d{2}-\d{2}$/.test(dispatchDate)
      ? new Date(`${dispatchDate}T12:00:00`).toISOString()
      : null

  return {
    courier_evidence_video_url: videoPath,
    courier_pre_collection_photo_url: preCollectionPhotoPath,
    courier_handover_photo_url: handoverPhotoPath,
    courier_name: courierName?.trim() || null,
    courier_company: courierCompany?.trim() || null,
    courier_collected_at: dispatchAt,
    courier_evidence_notes: evidenceNotes?.trim() || null,
    courier_signature_name: signatureName?.trim() || null,
    courier_signature_data: signatureData || null,
  }
}
