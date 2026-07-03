export const PROFILE_UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export const USERNAME_PATTERN = /^[a-zA-Z0-9_-]+$/

export const STRIPE_BUSINESS_PROFILE_PRODUCT_DESCRIPTION =
  'Selling used fitness and gym equipment through Equipd Marketplace.'

export function normalizeShopUsername(value) {
  return value?.trim() ?? ''
}

export function isProfileUuid(value) {
  return PROFILE_UUID_PATTERN.test(String(value ?? '').trim())
}

export function getSellerShopSlug({ id, username } = {}) {
  const normalizedUsername = normalizeShopUsername(username)

  if (
    normalizedUsername.length >= 3
    && normalizedUsername.length <= 24
    && USERNAME_PATTERN.test(normalizedUsername)
  ) {
    return encodeURIComponent(normalizedUsername)
  }

  if (id) {
    return String(id)
  }

  return null
}

export function getSellerShopPath(profileOrId, usernameMaybe) {
  if (profileOrId && typeof profileOrId === 'object') {
    return `/shop/${getSellerShopSlug(profileOrId)}`
  }

  if (typeof profileOrId === 'string' && isProfileUuid(profileOrId)) {
    return `/shop/${profileOrId}`
  }

  const normalizedUsername = normalizeShopUsername(
    typeof profileOrId === 'string' ? profileOrId : usernameMaybe,
  )

  if (
    normalizedUsername.length >= 3
    && normalizedUsername.length <= 24
    && USERNAME_PATTERN.test(normalizedUsername)
  ) {
    return `/shop/${encodeURIComponent(normalizedUsername)}`
  }

  if (profileOrId) {
    return `/shop/${String(profileOrId)}`
  }

  return '/shop'
}

export function getSellerShopUrl(profile, baseUrl = '') {
  const trimmedBase = String(baseUrl ?? '').replace(/\/+$/, '')
  const path = getSellerShopPath(profile)
  return trimmedBase ? `${trimmedBase}${path}` : path
}

export function buildStripeBusinessProfileUrl(profile, baseUrl) {
  return getSellerShopUrl(profile, baseUrl)
}
