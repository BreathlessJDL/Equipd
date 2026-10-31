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

/**
 * Card widths cover typical 1x–2x densities and mobile 3x at ~50vw.
 * 900px variants were rarely chosen and competed with gallery requests.
 */
export const LISTING_CARD_IMAGE_WIDTHS = [300, 450, 600]

/** Row thumbnails render far smaller than grid cards. */
export const LISTING_ROW_IMAGE_WIDTHS = [150, 240, 360]

/** Hub, messages, and order thumbs are typically 64–96px. */
export const LISTING_THUMB_IMAGE_WIDTHS = [96, 160, 240]

/** Gallery filmstrip thumbs (~6.25rem). */
export const LISTING_GALLERY_THUMB_WIDTHS = [160, 240, 320]

/**
 * Main gallery image. 1280px covers 2x of the 720px desktop stage and 3x
 * of a typical mobile viewport without waiting on a 1600px transform.
 */
export const LISTING_GALLERY_MAIN_WIDTHS = [640, 960, 1280]

export const LISTING_GALLERY_MAIN_QUALITY = 75

export const LISTING_CARD_IMAGE_SIZES = '(max-width: 640px) 50vw, (max-width: 1100px) 33vw, 300px'
export const LISTING_ROW_IMAGE_SIZES = '120px'
export const LISTING_THUMB_IMAGE_SIZES = '96px'
export const LISTING_GALLERY_THUMB_SIZES = '(max-width: 767px) 4.5rem, 6.25rem'
export const LISTING_GALLERY_MAIN_SIZES = '(max-width: 767px) 100vw, min(720px, 70vw)'

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

export function isListingImageTransformUrl(url) {
  return typeof url === 'string' && url.includes(RENDER_SEGMENT)
}

/**
 * If a transformed src fails (plan without Image Transformations, or a 4xx),
 * drop srcset and show the original public object URL.
 */
export function restoreOriginalListingImage(image, originalUrl) {
  if (!image || !originalUrl) return
  const current = image.currentSrc || image.src
  if (current === originalUrl || !isListingImageTransformUrl(current)) return
  image.srcset = ''
  image.sizes = ''
  image.src = originalUrl
}
