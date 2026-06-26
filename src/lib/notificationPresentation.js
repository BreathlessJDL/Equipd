import { isOfferNotification } from './notifications'

export const NOTIFICATION_DATE_GROUPS = {
  today: 'Today',
  yesterday: 'Yesterday',
  this_week: 'This week',
  earlier: 'Earlier',
}

const GROUP_ORDER = ['today', 'yesterday', 'this_week', 'earlier']

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function startOfWeekMonday(date) {
  const day = date.getDay()
  const mondayOffset = day === 0 ? 6 : day - 1
  const monday = startOfDay(date)
  monday.setDate(monday.getDate() - mondayOffset)
  return monday
}

export function getNotificationDateGroup(value) {
  if (!value) return 'earlier'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'earlier'

  const now = new Date()
  const today = startOfDay(now)
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  const weekStart = startOfWeekMonday(now)

  if (date >= today) return 'today'
  if (date >= yesterday) return 'yesterday'
  if (date >= weekStart) return 'this_week'
  return 'earlier'
}

export function groupNotificationsByDate(notifications = []) {
  const buckets = {
    today: [],
    yesterday: [],
    this_week: [],
    earlier: [],
  }

  for (const notification of notifications) {
    const group = getNotificationDateGroup(notification.created_at)
    buckets[group].push(notification)
  }

  return GROUP_ORDER.filter((key) => buckets[key].length > 0).map((key) => ({
    key,
    label: NOTIFICATION_DATE_GROUPS[key],
    notifications: buckets[key],
  }))
}

export function formatNotificationRelativeTime(value) {
  if (!value) return ''

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''

  const now = new Date()
  const today = startOfDay(now)
  const targetDay = startOfDay(date)
  const diffDays = Math.round((today - targetDay) / 86_400_000)
  const timeLabel = new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)

  if (diffDays === 0) return `Today • ${timeLabel}`
  if (diffDays === 1) return `Yesterday • ${timeLabel}`
  if (diffDays > 1 && diffDays < 7) return `${diffDays} days ago`

  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

export const NOTIFICATION_ICON_TYPES = {
  NEW_OFFER: 'new_offer',
  COUNTER_OFFER: 'counter_offer',
  OFFER_ACCEPTED: 'offer_accepted',
  OFFER_DECLINED: 'offer_declined',
  COLLECTION_CONFIRMED: 'collection_confirmed',
  ITEM_DISPATCHED: 'item_dispatched',
  DELIVERY_CONFIRMED: 'delivery_confirmed',
  PAYOUT_PAYMENT: 'payout_payment',
  SUPPORT_DISPUTE: 'support_dispute',
  REVIEW_RECEIVED: 'review_received',
  DEFAULT: 'default',
}

const OFFER_TYPE_PATTERNS = {
  [NOTIFICATION_ICON_TYPES.NEW_OFFER]: [
    'offer_received',
    'new_offer',
    'offer_created',
  ],
  [NOTIFICATION_ICON_TYPES.COUNTER_OFFER]: [
    'counter_offer',
    'offer_countered',
    'counter_offer_received',
  ],
  [NOTIFICATION_ICON_TYPES.OFFER_ACCEPTED]: [
    'offer_accepted',
    'counter_offer_accepted',
  ],
  [NOTIFICATION_ICON_TYPES.OFFER_DECLINED]: [
    'offer_declined',
    'offer_rejected',
    'counter_offer_declined',
    'offer_withdrawn',
    'offer_cancelled',
  ],
  [NOTIFICATION_ICON_TYPES.COLLECTION_CONFIRMED]: ['collection_confirmed'],
  [NOTIFICATION_ICON_TYPES.ITEM_DISPATCHED]: [
    'courier_evidence',
    'courier_collection',
    'seller_delivery_confirmed',
    'seller_delivery',
  ],
  [NOTIFICATION_ICON_TYPES.DELIVERY_CONFIRMED]: ['courier_delivery_confirmed'],
  [NOTIFICATION_ICON_TYPES.PAYOUT_PAYMENT]: ['payout'],
  [NOTIFICATION_ICON_TYPES.SUPPORT_DISPUTE]: [
    'support_request',
    'order_dispute',
    'dispute',
  ],
  [NOTIFICATION_ICON_TYPES.REVIEW_RECEIVED]: ['review_received'],
}

function matchesNotificationType(type, patterns) {
  return patterns.some((pattern) => type === pattern || type.includes(pattern))
}

function includesWholeWord(text, word) {
  const pattern = new RegExp(`\\b${word}\\b`, 'i')
  return pattern.test(text)
}

/**
 * Maps notification type/title to a specific icon category.
 * Type field is checked first to avoid false positives (e.g. "order" inside "offer").
 */
export function getNotificationIconType(notification) {
  const type = (notification?.type ?? '').toLowerCase()
  const title = (notification?.title ?? '').toLowerCase()
  const linkUrl = notification?.link_url?.trim() ?? ''

  if (matchesNotificationType(type, OFFER_TYPE_PATTERNS[NOTIFICATION_ICON_TYPES.REVIEW_RECEIVED])) {
    return NOTIFICATION_ICON_TYPES.REVIEW_RECEIVED
  }

  if (matchesNotificationType(type, OFFER_TYPE_PATTERNS[NOTIFICATION_ICON_TYPES.SUPPORT_DISPUTE])) {
    return NOTIFICATION_ICON_TYPES.SUPPORT_DISPUTE
  }

  if (
    includesWholeWord(title, 'dispute') ||
    includesWholeWord(title, 'support') ||
    title.includes('reported a problem')
  ) {
    return NOTIFICATION_ICON_TYPES.SUPPORT_DISPUTE
  }

  if (matchesNotificationType(type, OFFER_TYPE_PATTERNS[NOTIFICATION_ICON_TYPES.PAYOUT_PAYMENT])) {
    return NOTIFICATION_ICON_TYPES.PAYOUT_PAYMENT
  }

  if (title.includes('payout')) {
    return NOTIFICATION_ICON_TYPES.PAYOUT_PAYMENT
  }

  if (matchesNotificationType(type, OFFER_TYPE_PATTERNS[NOTIFICATION_ICON_TYPES.DELIVERY_CONFIRMED])) {
    return NOTIFICATION_ICON_TYPES.DELIVERY_CONFIRMED
  }

  if (
    title.includes('delivery confirmed') ||
    title.includes('buyer confirmed courier delivery')
  ) {
    return NOTIFICATION_ICON_TYPES.DELIVERY_CONFIRMED
  }

  if (matchesNotificationType(type, OFFER_TYPE_PATTERNS[NOTIFICATION_ICON_TYPES.COLLECTION_CONFIRMED])) {
    return NOTIFICATION_ICON_TYPES.COLLECTION_CONFIRMED
  }

  if (title.includes('collection confirmed')) {
    return NOTIFICATION_ICON_TYPES.COLLECTION_CONFIRMED
  }

  if (matchesNotificationType(type, OFFER_TYPE_PATTERNS[NOTIFICATION_ICON_TYPES.ITEM_DISPATCHED])) {
    return NOTIFICATION_ICON_TYPES.ITEM_DISPATCHED
  }

  if (
    title.includes('dispatched') ||
    title.includes('marked item as delivered') ||
    title.includes('courier handover evidence') ||
    title.includes('courier collection confirmed')
  ) {
    return NOTIFICATION_ICON_TYPES.ITEM_DISPATCHED
  }

  if (matchesNotificationType(type, OFFER_TYPE_PATTERNS[NOTIFICATION_ICON_TYPES.OFFER_DECLINED])) {
    return NOTIFICATION_ICON_TYPES.OFFER_DECLINED
  }

  if (
    title.includes('declined') ||
    title.includes('rejected') ||
    title.includes('cancelled') ||
    title.includes('withdrawn')
  ) {
    return NOTIFICATION_ICON_TYPES.OFFER_DECLINED
  }

  if (matchesNotificationType(type, OFFER_TYPE_PATTERNS[NOTIFICATION_ICON_TYPES.COUNTER_OFFER])) {
    return NOTIFICATION_ICON_TYPES.COUNTER_OFFER
  }

  if (title.includes('counter-offer') || title.includes('counter offer')) {
    return NOTIFICATION_ICON_TYPES.COUNTER_OFFER
  }

  if (matchesNotificationType(type, OFFER_TYPE_PATTERNS[NOTIFICATION_ICON_TYPES.OFFER_ACCEPTED])) {
    return NOTIFICATION_ICON_TYPES.OFFER_ACCEPTED
  }

  if (title.includes('offer accepted') || title.includes('counter-offer accepted')) {
    return NOTIFICATION_ICON_TYPES.OFFER_ACCEPTED
  }

  if (matchesNotificationType(type, OFFER_TYPE_PATTERNS[NOTIFICATION_ICON_TYPES.NEW_OFFER])) {
    return NOTIFICATION_ICON_TYPES.NEW_OFFER
  }

  if (title === 'new offer' || title.includes('new offer')) {
    return NOTIFICATION_ICON_TYPES.NEW_OFFER
  }

  if (isOfferNotification(notification)) {
    if (title.includes('accepted')) return NOTIFICATION_ICON_TYPES.OFFER_ACCEPTED
    if (title.includes('counter')) return NOTIFICATION_ICON_TYPES.COUNTER_OFFER
    if (title.includes('declined') || title.includes('rejected')) {
      return NOTIFICATION_ICON_TYPES.OFFER_DECLINED
    }
    return NOTIFICATION_ICON_TYPES.NEW_OFFER
  }

  if (linkUrl.startsWith('/orders/')) {
    if (title.includes('review')) return NOTIFICATION_ICON_TYPES.REVIEW_RECEIVED
    if (title.includes('collection')) return NOTIFICATION_ICON_TYPES.COLLECTION_CONFIRMED
    if (title.includes('delivery') || title.includes('delivered')) {
      return NOTIFICATION_ICON_TYPES.DELIVERY_CONFIRMED
    }
    return NOTIFICATION_ICON_TYPES.ITEM_DISPATCHED
  }

  if (type === 'review_received' || (includesWholeWord(title, 'review') && title.includes('received'))) {
    return NOTIFICATION_ICON_TYPES.REVIEW_RECEIVED
  }

  return NOTIFICATION_ICON_TYPES.DEFAULT
}

/** @deprecated Use getNotificationIconType */
export function getNotificationVisualType(notification) {
  return getNotificationIconType(notification)
}

export function getNotificationActionLabel(notification) {
  const iconType = getNotificationIconType(notification)

  if (iconType === NOTIFICATION_ICON_TYPES.REVIEW_RECEIVED) {
    return 'View review'
  }

  if (iconType === NOTIFICATION_ICON_TYPES.SUPPORT_DISPUTE) {
    return 'View support request'
  }

  if (
    iconType === NOTIFICATION_ICON_TYPES.NEW_OFFER ||
    iconType === NOTIFICATION_ICON_TYPES.COUNTER_OFFER ||
    iconType === NOTIFICATION_ICON_TYPES.OFFER_ACCEPTED ||
    iconType === NOTIFICATION_ICON_TYPES.OFFER_DECLINED ||
    isOfferNotification(notification)
  ) {
    return 'View offer'
  }

  if (
    iconType === NOTIFICATION_ICON_TYPES.COLLECTION_CONFIRMED ||
    iconType === NOTIFICATION_ICON_TYPES.ITEM_DISPATCHED ||
    iconType === NOTIFICATION_ICON_TYPES.DELIVERY_CONFIRMED ||
    iconType === NOTIFICATION_ICON_TYPES.PAYOUT_PAYMENT ||
    notification?.link_url?.trim().startsWith('/orders/')
  ) {
    return 'View order'
  }

  return 'View'
}

/**
 * Notifications only store id, type, title, body, link_url, is_read, created_at.
 * No listing image is available without extra queries.
 */
export function getNotificationThumbnailUrl() {
  return null
}
