import { supabase } from './supabase'

export const PROFILE_IMAGES_BUCKET = 'profile-images'

export const ALLOWED_PROFILE_IMAGE_TYPES = ['image/jpeg', 'image/png']

export const MAX_PROFILE_IMAGE_FILE_SIZE = 5 * 1024 * 1024

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

  return message || 'Something went wrong uploading the profile image.'
}

export async function uploadProfileImage({ userId, file }) {
  if (!supabase) {
    return { data: null, error: new Error('Supabase is not configured.') }
  }

  const validationError = validateProfileImageFile(file)
  if (validationError) {
    return { data: null, error: new Error(validationError) }
  }

  const fileName = generateProfileImageFileName(file)
  const storagePath = buildProfileImageStoragePath(userId, fileName)

  const { error: uploadError } = await supabase.storage
    .from(PROFILE_IMAGES_BUCKET)
    .upload(storagePath, file, {
      contentType: file.type,
      upsert: false,
    })

  if (uploadError) {
    return { data: null, error: uploadError }
  }

  return {
    data: {
      storagePath,
      publicUrl: getProfileImagePublicUrl(storagePath),
    },
    error: null,
  }
}
