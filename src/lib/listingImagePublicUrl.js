/**
 * Node-safe listing image public URL builder (no Supabase client required).
 */

export const LISTING_IMAGES_BUCKET = 'listing-images'

/**
 * Build a durable public Storage URL for a listing image path.
 * Uses the project Supabase URL — never signed/expiring URLs.
 */
export function buildListingImagePublicUrl(storagePath, supabaseUrl) {
  const path = String(storagePath ?? '').replace(/^\/+/, '').trim()
  const base = String(supabaseUrl ?? '').replace(/\/+$/, '').trim()
  if (!path || !base) return null
  return `${base}/storage/v1/object/public/${LISTING_IMAGES_BUCKET}/${path}`
}

export function mapListingImagesForPrerender(images = [], supabaseUrl) {
  return [...(images || [])]
    .sort((a, b) => Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0))
    .map((image) => {
      const url = image.url || buildListingImagePublicUrl(image.storage_path, supabaseUrl)
      return url ? { ...image, url } : null
    })
    .filter(Boolean)
}

export function enrichListingImagesForPrerender(listing, supabaseUrl) {
  if (!listing) return listing
  const listingImages = mapListingImagesForPrerender(listing.listing_images, supabaseUrl)
  return {
    ...listing,
    listing_images: listingImages,
    primary_image_url: listingImages[0]?.url ?? listing.primary_image_url ?? null,
  }
}
