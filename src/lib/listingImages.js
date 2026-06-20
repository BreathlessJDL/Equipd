import { MAX_LISTING_IMAGES } from './constants'
import { supabase } from './supabase'

export const LISTING_IMAGES_BUCKET = 'listing-images'

export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']

export const MAX_IMAGE_FILE_SIZE = 5 * 1024 * 1024

const imageFields = 'id, listing_id, storage_path, sort_order, created_at'

export function getListingImagePublicUrl(storagePath) {
  if (!supabase || !storagePath) return null

  const { data } = supabase.storage.from(LISTING_IMAGES_BUCKET).getPublicUrl(storagePath)
  return data.publicUrl
}

export function validateListingImageFile(file) {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return 'Only JPEG, PNG, and WebP images are allowed.'
  }

  if (file.size > MAX_IMAGE_FILE_SIZE) {
    return 'Each image must be 5 MB or smaller.'
  }

  return null
}

export function buildListingImageStoragePath(userId, listingId, fileName) {
  return `${userId}/${listingId}/${fileName}`
}

export function generateListingImageFileName(file) {
  const extensionByType = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
  }

  const extension = extensionByType[file.type] ?? 'jpg'
  return `${crypto.randomUUID()}.${extension}`
}

export function mapListingImages(images = []) {
  return [...images]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((image) => ({
      ...image,
      url: getListingImagePublicUrl(image.storage_path),
    }))
}

export function enrichListingWithImages(listing) {
  if (!listing) return listing

  const listingImages = mapListingImages(listing.listing_images ?? [])

  return {
    ...listing,
    listing_images: listingImages,
    primary_image_url: listingImages[0]?.url ?? null,
  }
}

export function getImageErrorMessage(error) {
  if (!error) return 'Something went wrong uploading the image.'
  return error.message || 'Something went wrong uploading the image.'
}

export async function fetchListingImages(listingId) {
  if (!supabase) {
    return { data: null, error: new Error('Supabase is not configured.') }
  }

  const { data, error } = await supabase
    .from('listing_images')
    .select(imageFields)
    .eq('listing_id', listingId)
    .order('sort_order', { ascending: true })

  if (error) {
    return { data: null, error }
  }

  return { data: mapListingImages(data ?? []), error: null }
}

export async function uploadListingImage({ userId, listingId, file, sortOrder }) {
  if (!supabase) {
    return { data: null, error: new Error('Supabase is not configured.') }
  }

  const validationError = validateListingImageFile(file)
  if (validationError) {
    return { data: null, error: new Error(validationError) }
  }

  const fileName = generateListingImageFileName(file)
  const storagePath = buildListingImageStoragePath(userId, listingId, fileName)

  const { error: uploadError } = await supabase.storage
    .from(LISTING_IMAGES_BUCKET)
    .upload(storagePath, file, {
      contentType: file.type,
      upsert: false,
    })

  if (uploadError) {
    return { data: null, error: uploadError }
  }

  const { data, error: insertError } = await supabase
    .from('listing_images')
    .insert({
      listing_id: listingId,
      storage_path: storagePath,
      sort_order: sortOrder,
    })
    .select(imageFields)
    .single()

  if (insertError) {
    await supabase.storage.from(LISTING_IMAGES_BUCKET).remove([storagePath])
    return { data: null, error: insertError }
  }

  return {
    data: {
      ...data,
      url: getListingImagePublicUrl(storagePath),
    },
    error: null,
  }
}

export async function uploadListingImages({ userId, listingId, files, startSortOrder = 0 }) {
  const uploaded = []

  for (let index = 0; index < files.length; index += 1) {
    const { data, error } = await uploadListingImage({
      userId,
      listingId,
      file: files[index],
      sortOrder: startSortOrder + index,
    })

    if (error) {
      return { data: uploaded, error }
    }

    uploaded.push(data)
  }

  return { data: uploaded, error: null }
}

export async function deleteListingImage(image) {
  if (!supabase) {
    return { error: new Error('Supabase is not configured.') }
  }

  const { error: storageError } = await supabase.storage
    .from(LISTING_IMAGES_BUCKET)
    .remove([image.storage_path])

  if (storageError) {
    return { error: storageError }
  }

  const { error } = await supabase.from('listing_images').delete().eq('id', image.id)

  return { error }
}

export function getRemainingImageSlots(existingCount, pendingCount = 0) {
  return Math.max(0, MAX_LISTING_IMAGES - existingCount - pendingCount)
}

export function validateImageSelection(files, existingCount, pendingCount = 0) {
  const remaining = getRemainingImageSlots(existingCount, pendingCount)

  if (files.length > remaining) {
    return `You can upload up to ${MAX_LISTING_IMAGES} images per listing.`
  }

  for (const file of files) {
    const validationError = validateListingImageFile(file)
    if (validationError) {
      return validationError
    }
  }

  return null
}
