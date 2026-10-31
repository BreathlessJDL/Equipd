import {
  LISTING_GALLERY_MAIN_QUALITY,
  LISTING_GALLERY_MAIN_SIZES,
  LISTING_GALLERY_MAIN_WIDTHS,
  buildListingImageSources,
} from './listingImageTransforms.js'

/** Adjacent photos preload first; remaining photos follow two at a time. */
export const LISTING_GALLERY_PRELOAD_CONCURRENCY = 2

const SLOW_EFFECTIVE_TYPES = new Set(['slow-2g', '2g'])

/**
 * Remaining gallery photos stay lazy on save-data and slow mobile networks so
 * they do not compete with the visible photo or the rest of the listing page.
 */
export function shouldPreloadRemainingGalleryImages(env = typeof navigator === 'undefined' ? undefined : navigator) {
  if (!env) return true
  if (env.connection?.saveData) return false
  const connection = env.connection || env.mozConnection || env.webkitConnection
  const effectiveType = String(connection?.effectiveType || '').toLowerCase()
  return !SLOW_EFFECTIVE_TYPES.has(effectiveType)
}

/** Visible filmstrip thumbs skip lazy-load so they are ready immediately. */
export const LISTING_GALLERY_THUMB_EAGER_COUNT = 6

export function wrapGalleryIndex(index, count) {
  if (!Number.isInteger(count) || count < 1) return 0
  return ((Number(index) % count) + count) % count
}

export function getAdjacentGalleryIndexes(selectedIndex, count) {
  if (!Number.isInteger(count) || count < 2) return []
  const current = wrapGalleryIndex(selectedIndex, count)
  const next = wrapGalleryIndex(current + 1, count)
  const prev = wrapGalleryIndex(current - 1, count)
  if (next === prev) return [next]
  return [next, prev]
}

/**
 * Remaining indexes in swipe order (forward from the current photo), skipping
 * the current and already-queued adjacent photos.
 */
export function getProgressiveGalleryIndexes(selectedIndex, count, adjacent = []) {
  if (!Number.isInteger(count) || count < 1) return []
  const current = wrapGalleryIndex(selectedIndex, count)
  const skip = new Set([current, ...adjacent])
  const rest = []
  for (let offset = 1; offset < count; offset += 1) {
    const index = wrapGalleryIndex(current + offset, count)
    if (!skip.has(index)) rest.push(index)
  }
  return rest
}

export function pickListingImageWidth(widths, displayCssPx, devicePixelRatio = 1) {
  if (!Array.isArray(widths) || widths.length === 0) return null
  const needed = Math.max(1, Number(displayCssPx) * Number(devicePixelRatio || 1))
  return widths.find((width) => width >= needed) ?? widths[widths.length - 1]
}

export function createListingGalleryImageLoader({
  ImageCtor = typeof Image === 'function' ? Image : null,
  widths = LISTING_GALLERY_MAIN_WIDTHS,
  quality = LISTING_GALLERY_MAIN_QUALITY,
  sizes = LISTING_GALLERY_MAIN_SIZES,
} = {}) {
  return function loadListingGalleryImage(url, { fetchPriority = 'low' } = {}) {
    if (!url || !ImageCtor) return Promise.resolve(false)

    const { src, srcSet } = buildListingImageSources(url, { widths, quality })

    return new Promise((resolve) => {
      const image = new ImageCtor()
      image.decoding = 'async'
      image.sizes = sizes
      if (srcSet) image.srcset = srcSet
      if ('fetchPriority' in image) image.fetchPriority = fetchPriority

      const finish = (ok) => {
        image.onload = null
        image.onerror = null
        resolve(ok)
      }

      image.onload = () => finish(true)
      image.onerror = () => finish(false)
      image.src = src
    })
  }
}
