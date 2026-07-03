export const OFFER_NOTIFICATION_TYPE_VALUES = {
  OFFER_RECEIVED: 'offer_received',
  OFFER_ACCEPTED: 'offer_accepted',
  OFFER_REJECTED: 'offer_rejected',
  OFFER_DECLINED: 'offer_declined',
  OFFER_COUNTERED: 'offer_countered',
  COUNTER_OFFER_RECEIVED: 'counter_offer_received',
  COUNTER_OFFER_ACCEPTED: 'counter_offer_accepted',
  COUNTER_OFFER_DECLINED: 'counter_offer_declined',
  OFFER_WITHDRAWN: 'offer_withdrawn',
  OFFER_CANCELLED: 'offer_cancelled',
  OFFER_CREATED: 'offer_created',
  COUNTER_OFFER: 'counter_offer',
  NEW_OFFER: 'new_offer',
}

const OFFER_NOTIFICATION_TYPES = new Set(Object.values(OFFER_NOTIFICATION_TYPE_VALUES))

const PRESERVED_NOTIFICATION_PATH_PREFIXES = ['/orders/', '/messages']

const SELLER_OFFER_NOTIFICATION_TYPES = new Set([
  OFFER_NOTIFICATION_TYPE_VALUES.OFFER_RECEIVED,
  OFFER_NOTIFICATION_TYPE_VALUES.NEW_OFFER,
  OFFER_NOTIFICATION_TYPE_VALUES.COUNTER_OFFER_ACCEPTED,
  OFFER_NOTIFICATION_TYPE_VALUES.COUNTER_OFFER_DECLINED,
])

export function extractOfferIdFromNotificationLink(linkUrl) {
  if (!linkUrl) return null

  try {
    const url = linkUrl.startsWith('http')
      ? new URL(linkUrl)
      : new URL(linkUrl, 'http://equipd.local')

    return url.searchParams.get('offerId') ?? url.searchParams.get('offer_id')
  } catch {
    return null
  }
}

export function buildHubMyOffersPath(offerId) {
  const params = new URLSearchParams({ section: 'offers' })

  if (offerId) {
    params.set('offerId', offerId)
  }

  return `/hub?${params.toString()}`
}

export function buildHubSellingOffersPath(offerId) {
  const params = new URLSearchParams({ section: 'selling', tab: 'offers' })

  if (offerId) {
    params.set('offerId', offerId)
  }

  return `/hub?${params.toString()}`
}

export function resolveHubOfferPathFromLink(linkUrl, offerId = null) {
  if (!linkUrl) return null

  try {
    const url = linkUrl.startsWith('http')
      ? new URL(linkUrl)
      : new URL(linkUrl, 'http://equipd.local')

    if (url.pathname !== '/hub' && !url.pathname.endsWith('/hub')) {
      return null
    }

    const resolvedOfferId = offerId ?? url.searchParams.get('offerId') ?? url.searchParams.get('offer_id')
    const section = url.searchParams.get('section')
    const tab = url.searchParams.get('tab')

    if (section === 'selling' && tab === 'offers') {
      return buildHubSellingOffersPath(resolvedOfferId)
    }

    if (section === 'offers' || section === 'buying') {
      return buildHubMyOffersPath(resolvedOfferId)
    }
  } catch {
    return null
  }

  return null
}

export function isOfferNotificationType(type) {
  const normalized = (type ?? '').toLowerCase()

  if (OFFER_NOTIFICATION_TYPES.has(normalized)) {
    return true
  }

  if (normalized.startsWith('offer_')) {
    return true
  }

  return normalized.includes('offer')
}

export function getOfferNotificationNavigationPath(notification) {
  if (!notification) return null

  const linkUrl = notification.link_url?.trim() ?? ''

  if (
    linkUrl &&
    PRESERVED_NOTIFICATION_PATH_PREFIXES.some((prefix) => linkUrl.startsWith(prefix))
  ) {
    return linkUrl
  }

  const type = (notification.type ?? '').toLowerCase()
  const isOfferNotification =
    isOfferNotificationType(type) || Boolean(extractOfferIdFromNotificationLink(linkUrl))

  if (!isOfferNotification) {
    return linkUrl || null
  }

  const offerId = extractOfferIdFromNotificationLink(linkUrl)

  if (type === OFFER_NOTIFICATION_TYPE_VALUES.OFFER_RECEIVED || type === OFFER_NOTIFICATION_TYPE_VALUES.NEW_OFFER) {
    return buildHubSellingOffersPath(offerId)
  }

  const hubPath = resolveHubOfferPathFromLink(linkUrl, offerId)
  if (hubPath) {
    return hubPath
  }

  if (SELLER_OFFER_NOTIFICATION_TYPES.has(type)) {
    return buildHubSellingOffersPath(offerId)
  }

  return buildHubMyOffersPath(offerId)
}
