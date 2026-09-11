import { supabase } from './supabase'

export const PROFILE_IMAGES_BUCKET = 'profile-images'

export const ALLOWED_PROFILE_IMAGE_TYPES = ['image/jpeg', 'image/png']

export const MAX_PROFILE_IMAGE_FILE_SIZE = 5 * 1024 * 1024

export const PROFILE_IMAGE_QR_REJECT_MESSAGE =
  "QR codes aren't permitted in profile images. For your safety, payments and communication should remain within Equipd."

export function validateProfileImageFile(file) {
  if (!ALLOWED_PROFILE_IMAGE_TYPES.includes(file.type)) {
    return 'Only JPG and PNG images are allowed.'
  }

  if (file.size > MAX_PROFILE_IMAGE_FILE_SIZE) {
    return 'Profile image must be 5 MB or smaller.'
  }

  return null
}

export function buildProfileImageStoragePath(userId, fileName) {
  return `${userId}/${fileName}`
}

export function generateProfileImageFileName(file) {
  const extension = file.type === 'image/png' ? 'png' : 'jpg'
  return `${crypto.randomUUID()}.${extension}`
}

export function getProfileImagePublicUrl(storagePath) {
  if (!supabase || !storagePath) return null

  const { data } = supabase.storage.from(PROFILE_IMAGES_BUCKET).getPublicUrl(storagePath)
  return data.publicUrl
}

export function getProfileImageErrorMessage(error) {
  if (!error) return 'Something went wrong uploading the profile image.'

  const message = error.message ?? ''
  const statusCode = error.statusCode ?? error.status

  if (
    statusCode === '404'
    || statusCode === 404
    || /bucket not found/i.test(message)
  ) {
    return 'Profile image storage is not set up yet. Run supabase/profile-images-storage.sql in the Supabase SQL Editor, then try again.'
  }

  if (/qr codes aren't permitted/i.test(message)) {
    return PROFILE_IMAGE_QR_REJECT_MESSAGE
  }

  return message || 'Something went wrong uploading the profile image.'
}

/**
 * Upload avatar through Edge Function (QR scan + service-role Storage write).
 * Direct Storage inserts are revoked for authenticated clients.
 */
export async function uploadProfileImage({ userId, file }) {
  if (!supabase) {
    return { data: null, error: new Error('Supabase is not configured.') }
  }

  if (!userId) {
    return { data: null, error: new Error('Authentication required.') }
  }

  const validationError = validateProfileImageFile(file)
  if (validationError) {
    return { data: null, error: new Error(validationError) }
  }

  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession()

  if (sessionError || !session?.access_token) {
    return { data: null, error: new Error('Authentication required.') }
  }

  const form = new FormData()
  form.append('file', file)

  const { data, error } = await supabase.functions.invoke('upload-profile-image', {
    body: form,
  })

  if (error) {
    let message = error.message || 'Could not upload profile image.'
    try {
      if (error.context && typeof error.context.json === 'function') {
        const payload = await error.context.json()
        if (payload?.error) message = String(payload.error)
      }
    } catch {
      // keep message
    }
    return { data: null, error: new Error(message) }
  }

  if (data?.error) {
    return { data: null, error: new Error(String(data.error)) }
  }

  if (!data?.publicUrl || !data?.storagePath) {
    return { data: null, error: new Error('Could not upload profile image.') }
  }

  return {
    data: {
      storagePath: data.storagePath,
      publicUrl: data.publicUrl,
    },
    error: null,
  }
}
