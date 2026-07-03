const USERNAME_PATTERN = /^[a-zA-Z0-9_-]+$/

export const STRIPE_BUSINESS_PROFILE_PRODUCT_DESCRIPTION =
  'Selling used fitness and gym equipment through Equipd Marketplace.'

function normalizeUsername(value: string | null | undefined) {
  return value?.trim() ?? ''
}

export function buildSellerShopPath(profile: { id?: string; username?: string | null }) {
  const normalizedUsername = normalizeUsername(profile?.username)

  if (
    normalizedUsername.length >= 3
    && normalizedUsername.length <= 24
    && USERNAME_PATTERN.test(normalizedUsername)
  ) {
    return `/shop/${encodeURIComponent(normalizedUsername)}`
  }

  if (profile?.id) {
    return `/shop/${profile.id}`
  }

  return '/shop'
}

export function buildSellerBusinessProfileUrl(
  profile: { id?: string; username?: string | null },
  baseUrl: string,
) {
  const trimmedBase = String(baseUrl ?? '').replace(/\/+$/, '')
  return `${trimmedBase}${buildSellerShopPath(profile)}`
}
