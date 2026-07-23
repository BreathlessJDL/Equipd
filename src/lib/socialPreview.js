/**
 * Shared social preview helpers (Node-safe).
 * Prefer real page images; fall back to a stable public Equipd asset.
 */

import { EQUIPD_SITE_ORIGIN } from './brandCatalogueCore.js'

/** Best existing large public OG asset (1200×630 sell card). */
export const EQUIPD_DEFAULT_SOCIAL_IMAGE_PATH = '/sell-gym-equipment/sell-gym-equipment-og.png'

/** Logo-only fallback when a large card is inappropriate. */
export const EQUIPD_LOGO_SOCIAL_IMAGE_PATH = '/email/equipd-full-logo.png'

export function absoluteSocialUrl(pathOrUrl) {
  const value = String(pathOrUrl ?? '').trim()
  if (!value) return null
  if (value.startsWith('http://') || value.startsWith('https://')) return value
  return `${EQUIPD_SITE_ORIGIN}${value.startsWith('/') ? value : `/${value}`}`
}

export function getEquipdDefaultSocialImageUrl() {
  return absoluteSocialUrl(EQUIPD_DEFAULT_SOCIAL_IMAGE_PATH)
}

/**
 * Build a consistent Open Graph / Twitter set.
 * Uses summary_large_image when an image is available.
 */
export function buildSocialOpenGraph({
  title,
  description,
  url,
  image = null,
  type = 'website',
  siteName = 'Equipd',
  fallbackImage = true,
} = {}) {
  const resolvedImage = absoluteSocialUrl(image)
    || (fallbackImage ? getEquipdDefaultSocialImageUrl() : null)

  const openGraph = {
    'og:type': type,
    'og:site_name': siteName,
    'og:title': title,
    'og:description': description,
    'og:url': url,
    'twitter:card': resolvedImage ? 'summary_large_image' : 'summary',
    'twitter:title': title,
    'twitter:description': description,
  }

  if (resolvedImage) {
    openGraph['og:image'] = resolvedImage
    openGraph['twitter:image'] = resolvedImage
  }

  return openGraph
}
