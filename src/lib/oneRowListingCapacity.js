/**
 * How many fixed-width marketplace cards fit in one row of a container.
 * Mobile (<640px) defaults to a 2-up row (category pages); callers can raise
 * `mobileCapacity` for preview grids (e.g. brand pages use 4 = 2×2).
 */
export function getListingCardWidthRem(viewportWidth) {
  if (viewportWidth >= 1024) return 13
  if (viewportWidth >= 640) return 12.25
  return 11.5
}

export function getOneRowListingCapacity(
  containerWidthPx,
  viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1024,
  { rootFontSizePx = 16, gapRem = 1, mobileCapacity = 2 } = {},
) {
  if (viewportWidth < 640) return Math.max(1, mobileCapacity)

  const width = Number(containerWidthPx)
  if (!Number.isFinite(width) || width <= 0) return 4

  const cardPx = getListingCardWidthRem(viewportWidth) * rootFontSizePx
  const gapPx = gapRem * rootFontSizePx
  return Math.max(1, Math.floor((width + gapPx) / (cardPx + gapPx)))
}

/** Fetch enough to fill the widest marketplace rail (≈7–8 at 13rem). */
export const CATEGORY_LISTINGS_FETCH_LIMIT = 12

/** Brand landing preview: enough for one desktop row or mobile 2×2. */
export const BRAND_LISTINGS_FETCH_LIMIT = 12
