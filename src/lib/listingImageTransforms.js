/**
 * Listing photos are stored at upload resolution (often 3-5 MB), which is far
 * more than a card thumbnail needs. Supabase Storage can resize and re-encode
 * on the fly, so cards request an appropriately sized variant instead.
 *
 * Every helper returns null when the URL is not a Supabase public object URL,
 * and callers keep the original URL as a fallback.
 */

const PUBLIC_OBJECT_SEGMENT = '/storage/v1/object/public/'
const RENDER_SEGMENT = '/storage/v1/render/image/public/'

const DEFAULT_QUALITY = 70

/** Card widths cover 1x through 3x device pixel ratios. */
export const LISTING_CARD_IMAGE_WIDTHS = [300, 450, 600, 900]

/** Row thumbnails render far smaller than grid cards. */
export const LISTING_ROW_IMAGE_WIDTHS = [150, 240, 360]

export function buildListingImageVariantUrl(url, { width, quality = DEFAULT_QUALITY } = {}) {
  if (typeof url !== 'string' || !url.includes(PUBLIC_OBJECT_SEGMENT)) return null
  if (!Number.isFinite(width) || width <= 0) return null

  const [base] = url.split('?')
  const params = new URLSearchParams({
    width: String(Math.round(width)),
    quality: String(quality),
    resize: 'contain',
  })

  return `${base.replace(PUBLIC_OBJECT_SEGMENT, RENDER_SEGMENT)}?${params.toString()}`
}

/**
 * Resolves the src/srcSet pair for a listing image. Falls back to the original
 * URL with no srcSet when the image is not served from Supabase Storage.
 */
export function buildListingImageSources(url, { widths = LISTING_CARD_IMAGE_WIDTHS, quality } = {}) {
  const variants = widths
    .map((width) => ({ width, url: buildListingImageVariantUrl(url, { width, quality }) }))
    .filter((variant) => Boolean(variant.url))

  if (!variants.length) {
    return { src: url, srcSet: undefined }
  }

  return {
    src: variants[0].url,
    srcSet: variants.map((variant) => `${variant.url} ${variant.width}w`).join(', '),
  }
}
