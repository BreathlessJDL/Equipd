import { supabase } from './supabase'

export const ORDER_EVIDENCE_BUCKET = 'order-evidence'

export const MAX_ISSUE_EVIDENCE_FILES = 8
export const MAX_ISSUE_EVIDENCE_FILE_SIZE = 25 * 1024 * 1024

export const ALLOWED_EVIDENCE_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']

export const ALLOWED_EVIDENCE_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime']

export const ALLOWED_EVIDENCE_PDF_TYPES = ['application/pdf']

export const ALLOWED_ISSUE_EVIDENCE_TYPES = [
  ...ALLOWED_EVIDENCE_IMAGE_TYPES,
  ...ALLOWED_EVIDENCE_VIDEO_TYPES,
  ...ALLOWED_EVIDENCE_PDF_TYPES,
]

export const MAX_EVIDENCE_IMAGE_SIZE = MAX_ISSUE_EVIDENCE_FILE_SIZE

export const MAX_EVIDENCE_VIDEO_SIZE = MAX_ISSUE_EVIDENCE_FILE_SIZE

const SIGNED_URL_TTL_SECONDS = 60 * 60

function formatFileSizeLimit(bytes) {
  return `${Math.round(bytes / (1024 * 1024))} MB`
}

export function validateIssueEvidenceFile(file) {
  if (!ALLOWED_ISSUE_EVIDENCE_TYPES.includes(file.type)) {
    return 'Only JPEG, PNG, WebP, MP4, WebM, MOV, and PDF files are allowed.'
  }

  if (file.size > MAX_ISSUE_EVIDENCE_FILE_SIZE) {
    return `Each file must be ${formatFileSizeLimit(MAX_ISSUE_EVIDENCE_FILE_SIZE)} or smaller.`
  }

  return null
}

export function validateEvidenceImageFile(file) {
  return validateIssueEvidenceFile(file)
}

export function validateEvidenceVideoFile(file) {
  return validateIssueEvidenceFile(file)
}

function extensionForMimeType(mimeType) {
  const map = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'video/mp4': 'mp4',
    'video/webm': 'webm',
    'video/quicktime': 'mov',
    'application/pdf': 'pdf',
  }

  return map[mimeType] ?? 'bin'
}

export function buildOrderEvidenceStoragePath(orderId, kind, file) {
  const extension = extensionForMimeType(file.type)
  return `${orderId}/${kind}/${crypto.randomUUID()}.${extension}`
}

export function buildDisputeEvidenceStoragePath(orderId, disputeId, file, options = {}) {
  const extension = extensionForMimeType(file.type)
  const uploaderSegment = options.uploader === 'seller' ? 'seller' : 'buyer'
  return `${orderId}/disputes/${disputeId}/${uploaderSegment}/${crypto.randomUUID()}.${extension}`
}

export const UPLOAD_EVIDENCE_TIMEOUT_MS = 90_000

async function withUploadTimeout(promise, timeoutMs = UPLOAD_EVIDENCE_TIMEOUT_MS) {
  let timeoutId

  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error('Upload timed out. Please check your connection and try again.'))
    }, timeoutMs)
  })

  try {
    return await Promise.race([promise, timeoutPromise])
  } finally {
    clearTimeout(timeoutId)
  }
}

export function buildSupportEvidenceStoragePath(orderId, requestId, file) {
  const extension = extensionForMimeType(file.type)
  return `${orderId}/support/${requestId}/${crypto.randomUUID()}.${extension}`
}

export async function uploadDisputeEvidenceFile(orderId, disputeId, file, options = {}) {
  if (!supabase) {
    return { path: null, error: new Error('Supabase is not configured.') }
  }

  const storagePath = buildDisputeEvidenceStoragePath(orderId, disputeId, file, options)

  const { error } = await withUploadTimeout(
    supabase.storage.from(ORDER_EVIDENCE_BUCKET).upload(storagePath, file, {
      cacheControl: '3600',
      upsert: false,
      contentType: file.type,
    }),
  )

  if (error) {
    return { path: null, error }
  }

  return { path: storagePath, error: null }
}

export async function uploadSupportEvidenceFile(orderId, requestId, file) {
  if (!supabase) {
    return { path: null, error: new Error('Supabase is not configured.') }
  }

  const storagePath = buildSupportEvidenceStoragePath(orderId, requestId, file)

  const { error } = await withUploadTimeout(
    supabase.storage.from(ORDER_EVIDENCE_BUCKET).upload(storagePath, file, {
      cacheControl: '3600',
      upsert: false,
      contentType: file.type,
    }),
  )

  if (error) {
    return { path: null, error }
  }

  return { path: storagePath, error: null }
}

const IMAGE_EVIDENCE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif'])
const VIDEO_EVIDENCE_EXTENSIONS = new Set(['mp4', 'webm', 'mov'])

export const MIN_EVIDENCE_THUMBNAIL_BYTES = 500
export const MIN_EVIDENCE_THUMBNAIL_DIMENSION = 8

function readUint16Be(bytes, offset) {
  return (bytes[offset] << 8) | bytes[offset + 1]
}

function readUint16Le(bytes, offset) {
  return bytes[offset] | (bytes[offset + 1] << 8)
}

function readUint32Be(bytes, offset) {
  return (
    ((bytes[offset] << 24) |
      (bytes[offset + 1] << 16) |
      (bytes[offset + 2] << 8) |
      bytes[offset + 3]) >>>
    0
  )
}

export function analyzeEvidenceImageBytes(input, extension = '') {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input ?? [])
  const ext = extension.toLowerCase()
  const base = {
    bytes: bytes.length,
    format: ext || 'unknown',
    width: null,
    height: null,
    valid: false,
    reason: null,
  }

  if (!bytes.length) {
    return { ...base, reason: 'empty_file' }
  }

  const isJpeg = bytes[0] === 0xff && bytes[1] === 0xd8
  const isPng =
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47
  const isGif = bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46
  const isWebp =
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50

  if (isJpeg || ext === 'jpg' || ext === 'jpeg') {
    base.format = 'jpeg'

    for (let index = 2; index < bytes.length - 8; index += 1) {
      if (bytes[index] !== 0xff) continue

      const marker = bytes[index + 1]
      if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue
      if (index + 3 >= bytes.length) break

      const segmentLength = readUint16Be(bytes, index + 2)
      if (segmentLength < 2) break

      if (
        (marker >= 0xc0 && marker <= 0xc3) ||
        (marker >= 0xc5 && marker <= 0xc7) ||
        (marker >= 0xc9 && marker <= 0xcb) ||
        (marker >= 0xcd && marker <= 0xcf)
      ) {
        if (index + 7 < bytes.length) {
          base.height = readUint16Be(bytes, index + 5)
          base.width = readUint16Be(bytes, index + 7)
          base.valid = base.width > 0 && base.height > 0
        }
        break
      }

      index += segmentLength
    }

    if (!base.valid) {
      return { ...base, reason: 'invalid_jpeg' }
    }
  } else if (isPng || ext === 'png') {
    base.format = 'png'
    if (bytes.length >= 24) {
      base.width = readUint32Be(bytes, 16)
      base.height = readUint32Be(bytes, 20)
      base.valid = base.width > 0 && base.height > 0
    }

    if (!base.valid) {
      return { ...base, reason: 'invalid_png' }
    }
  } else if (isGif || ext === 'gif') {
    base.format = 'gif'
    if (bytes.length >= 10) {
      base.width = readUint16Le(bytes, 6)
      base.height = readUint16Le(bytes, 8)
      base.valid = base.width > 0 && base.height > 0
    }

    if (!base.valid) {
      return { ...base, reason: 'invalid_gif' }
    }
  } else if (isWebp || ext === 'webp') {
    base.format = 'webp'
    base.valid = true
    base.reason = 'webp_dimensions_unknown'
  } else {
    return { ...base, reason: 'unsupported_format' }
  }

  if (
    base.width != null &&
    base.height != null &&
    (base.width < MIN_EVIDENCE_THUMBNAIL_DIMENSION ||
      base.height < MIN_EVIDENCE_THUMBNAIL_DIMENSION)
  ) {
    return { ...base, valid: false, reason: 'image_too_small' }
  }

  if (bytes.length < MIN_EVIDENCE_THUMBNAIL_BYTES) {
    return { ...base, valid: false, reason: 'file_too_small' }
  }

  if (!base.valid) {
    return { ...base, reason: base.reason ?? 'invalid_image' }
  }

  return base
}

export async function analyzeEvidenceImageBlob(blob, extension = '') {
  if (!blob) {
    return analyzeEvidenceImageBytes(new Uint8Array(), extension)
  }

  const buffer = await blob.arrayBuffer()
  return analyzeEvidenceImageBytes(new Uint8Array(buffer), extension)
}

export function isEvidenceImageViableForThumbnail(analysis) {
  if (!analysis) return false
  if (!analysis.valid) return false
  if (analysis.reason === 'webp_dimensions_unknown') return true
  if (analysis.width != null && analysis.height != null) {
    return (
      analysis.width >= MIN_EVIDENCE_THUMBNAIL_DIMENSION &&
      analysis.height >= MIN_EVIDENCE_THUMBNAIL_DIMENSION &&
      analysis.bytes >= MIN_EVIDENCE_THUMBNAIL_BYTES
    )
  }

  return analysis.bytes >= MIN_EVIDENCE_THUMBNAIL_BYTES
}

export function normalizeEvidenceStoragePath(path) {
  if (!path || typeof path !== 'string') return ''

  let normalized = path.trim()
  const queryIndex = normalized.indexOf('?')
  if (queryIndex !== -1) {
    normalized = normalized.slice(0, queryIndex)
  }

  normalized = normalized.replace(/^\/+/, '')

  const bucketPrefix = `${ORDER_EVIDENCE_BUCKET}/`
  if (normalized.startsWith(bucketPrefix)) {
    normalized = normalized.slice(bucketPrefix.length)
  }

  return normalized
}

export function getEvidencePathExtension(path) {
  const normalized = normalizeEvidenceStoragePath(path)
  const filename = normalized.split('/').pop()?.toLowerCase() ?? ''
  const dotIndex = filename.lastIndexOf('.')

  if (dotIndex <= 0) return ''

  return filename.slice(dotIndex + 1)
}

export function isImageEvidencePath(path) {
  return IMAGE_EVIDENCE_EXTENSIONS.has(getEvidencePathExtension(path))
}

export function isVideoEvidencePath(path) {
  return VIDEO_EVIDENCE_EXTENSIONS.has(getEvidencePathExtension(path))
}

export function isPdfEvidencePath(path) {
  return getEvidencePathExtension(path) === 'pdf'
}

export function getEvidencePathKind(path) {
  if (isPdfEvidencePath(path)) return 'pdf'
  if (isImageEvidencePath(path)) return 'image'
  if (isVideoEvidencePath(path)) return 'video'
  return 'file'
}

export function getEvidenceFileLabel(path) {
  const normalized = normalizeEvidenceStoragePath(path)
  if (!normalized) return 'File'
  return normalized.split('/').pop() ?? normalized
}

export function getEvidencePreviewRenderMode(path, options = {}) {
  const kind = getEvidencePathKind(path)
  const {
    hasPreviewUrl = false,
    hasOpenUrl = false,
    signedImageFailed = false,
    thumbnailViable = true,
    previewLoadFailed = false,
  } = options

  if (!hasOpenUrl) return 'unavailable'
  if (kind !== 'image') return 'file-tile'
  if (!thumbnailViable || previewLoadFailed) return 'file-tile'
  if (hasPreviewUrl) return 'image-thumbnail'
  if (!signedImageFailed) return 'image-signed-url'
  return 'file-tile'
}

export function getEvidenceFileTypeLabel(kind) {
  if (kind === 'pdf') return 'PDF'
  if (kind === 'video') return 'Video'
  if (kind === 'image') return 'Image'
  return 'File'
}

export function revokeOrderEvidencePreviewUrls(entriesByPath) {
  for (const entry of Object.values(entriesByPath ?? {})) {
    if (entry?.previewUrl?.startsWith('blob:')) {
      URL.revokeObjectURL(entry.previewUrl)
    }
  }
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
  const normalizedPath = normalizeEvidenceStoragePath(storagePath)

  if (!supabase || !normalizedPath) {
    return { url: null, error: new Error('Evidence file path is missing.') }
  }

  const { data, error } = await supabase.storage
    .from(ORDER_EVIDENCE_BUCKET)
    .createSignedUrl(normalizedPath, SIGNED_URL_TTL_SECONDS)

  if (error) {
    return { url: null, error }
  }

  return { url: data.signedUrl, error: null }
}

export async function getOrderEvidenceSignedUrls(storagePaths) {
  const entries = await Promise.all(
    (storagePaths ?? []).map(async (rawPath) => {
      const path = normalizeEvidenceStoragePath(rawPath)
      const { url, error } = await getOrderEvidenceSignedUrl(path)
      return [path, { url, error }]
    }),
  )

  return Object.fromEntries(entries.filter(([path]) => Boolean(path)))
}

export async function loadOrderEvidencePreviewEntry(storagePath) {
  const path = normalizeEvidenceStoragePath(storagePath)
  const kind = getEvidencePathKind(path)
  const label = getEvidenceFileLabel(path)

  if (!supabase || !path) {
    return {
      path,
      kind,
      label,
      openUrl: null,
      previewUrl: null,
      thumbnailViable: false,
      imageAnalysis: null,
      error: new Error('Evidence file path is missing.'),
    }
  }

  const { url: openUrl, error: signedError } = await getOrderEvidenceSignedUrl(path)

  if (kind !== 'image') {
    return {
      path,
      kind,
      label,
      openUrl,
      previewUrl: null,
      thumbnailViable: false,
      imageAnalysis: null,
      error: signedError,
    }
  }

  const { data: blob, error: downloadError } = await supabase.storage
    .from(ORDER_EVIDENCE_BUCKET)
    .download(path)

  if (!downloadError && blob) {
    const extension = getEvidencePathExtension(path)
    const imageAnalysis = await analyzeEvidenceImageBlob(blob, extension)
    const thumbnailViable = isEvidenceImageViableForThumbnail(imageAnalysis)

    return {
      path,
      kind,
      label,
      openUrl,
      previewUrl: thumbnailViable ? URL.createObjectURL(blob) : null,
      thumbnailViable,
      imageAnalysis,
      error: null,
    }
  }

  return {
    path,
    kind,
    label,
    openUrl,
    previewUrl: null,
    thumbnailViable: false,
    imageAnalysis: null,
    error: downloadError ?? signedError,
  }
}

export async function loadOrderEvidencePreviewEntries(storagePaths) {
  const paths = [
    ...new Set(
      (storagePaths ?? [])
        .map((rawPath) => normalizeEvidenceStoragePath(rawPath))
        .filter(Boolean),
    ),
  ]

  const entries = await Promise.all(paths.map((path) => loadOrderEvidencePreviewEntry(path)))
  return Object.fromEntries(entries.map((entry) => [entry.path, entry]))
}

export function getStorageUploadErrorMessage(error) {
  if (!error) return 'Upload failed. Please try again.'
  const message = error.message || String(error)

  if (/row-level security|permission denied|not authorized/i.test(message)) {
    return 'You do not have permission to upload evidence for this case. If the problem continues, contact Equipd support.'
  }

  if (/gateway timeout|timed out|timeout/i.test(message)) {
    return 'Upload timed out. Please try again with a smaller file or a stronger connection.'
  }

  return message || 'Upload failed. Please try again.'
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
