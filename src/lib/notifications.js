import { supabase } from './supabase'
import {
  buildHubMyOffersPath,
  buildHubSellingOffersPath,
  extractOfferIdFromNotificationLink,
  getOfferNotificationNavigationPath,
  resolveHubOfferPathFromLink,
} from './notificationNavigation.js'

export {
  buildHubMyOffersPath,
  buildHubSellingOffersPath,
  extractOfferIdFromNotificationLink,
  resolveHubOfferPathFromLink,
  getOfferNotificationNavigationPath,
} from './notificationNavigation.js'

const notificationFields = 'id, user_id, type, title, body, link_url, is_read, created_at'

export const NOTIFICATION_TYPES = {
  MESSAGE_RECEIVED: 'message_received',
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
  SUPPORT_REQUEST_OPENED: 'support_request_opened',
  REVIEW_RECEIVED: 'review_received',
  BUYER_REVIEW_REMINDER: 'buyer_review_reminder',
  SELLER_PAYOUT_COMPLETE: 'seller_payout_complete',
  BUYER_PAYMENT_RECEIVED: 'buyer_payment_received',
  COLLECTION_CONFIRMED: 'collection_confirmed',
  COURIER_COLLECTION_CONFIRMED: 'courier_collection_confirmed',
  COURIER_EVIDENCE_SUBMITTED: 'courier_evidence_submitted',
  COURIER_DELIVERY_CONFIRMED: 'courier_delivery_confirmed',
  SELLER_DELIVERY_CONFIRMED: 'seller_delivery_confirmed',
  ORDER_DISPUTE_OPENED: 'order_dispute_opened',
  ORDER_DISPUTE_UNDER_REVIEW: 'order_dispute_under_review',
  ORDER_DISPUTE_RESOLVED_BUYER: 'order_dispute_resolved_buyer',
  ORDER_DISPUTE_RESOLVED_SELLER: 'order_dispute_resolved_seller',
}

const OFFER_NOTIFICATION_TYPES = new Set([
  NOTIFICATION_TYPES.OFFER_RECEIVED,
  NOTIFICATION_TYPES.OFFER_ACCEPTED,
  NOTIFICATION_TYPES.OFFER_REJECTED,
  NOTIFICATION_TYPES.OFFER_DECLINED,
  NOTIFICATION_TYPES.OFFER_COUNTERED,
  NOTIFICATION_TYPES.COUNTER_OFFER_RECEIVED,
  NOTIFICATION_TYPES.COUNTER_OFFER_ACCEPTED,
  NOTIFICATION_TYPES.COUNTER_OFFER_DECLINED,
  NOTIFICATION_TYPES.OFFER_WITHDRAWN,
  NOTIFICATION_TYPES.OFFER_CANCELLED,
  NOTIFICATION_TYPES.OFFER_CREATED,
  NOTIFICATION_TYPES.COUNTER_OFFER,
  NOTIFICATION_TYPES.NEW_OFFER,
])

const BELL_EXCLUDED_NOTIFICATION_TYPES = [NOTIFICATION_TYPES.MESSAGE_RECEIVED]

function applyBellNotificationFilter(query) {
  return BELL_EXCLUDED_NOTIFICATION_TYPES.reduce(
    (filteredQuery, type) => filteredQuery.neq('type', type),
    query,
  )
}

export function getNotificationErrorMessage(error) {
  if (!error) return 'Something went wrong. Please try again.'
  return error.message || 'Something went wrong. Please try again.'
}

export function formatNotificationTimestamp(value) {
  if (!value) return ''

  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

export function isOfferNotification(notification) {
  if (!notification) return false

  const type = (notification.type ?? '').toLowerCase()

  if (OFFER_NOTIFICATION_TYPES.has(type)) {
    return true
  }

  if (type.startsWith('offer_')) {
    return true
  }

  if (type.includes('offer')) {
    return true
  }

  return Boolean(extractOfferIdFromNotificationLink(notification.link_url))
}

/** @deprecated Use buildHubMyOffersPath or buildHubSellingOffersPath */
export function buildHubOffersPath(offerId) {
  return buildHubMyOffersPath(offerId)
}

export function getNotificationNavigationPath(notification) {
  return getOfferNotificationNavigationPath(notification)
}

export async function fetchNotifications(userId, { limit, unreadOnly = false } = {}) {
  if (!supabase) {
    return { data: null, error: new Error('Supabase is not configured.') }
  }

  let query = applyBellNotificationFilter(
    supabase
      .from('notifications')
      .select(notificationFields)
      .eq('user_id', userId),
  ).order('created_at', { ascending: false })

  if (unreadOnly) {
    query = query.eq('is_read', false)
  }

  if (limit) {
    query = query.limit(limit)
  }

  const { data, error } = await query

  return { data, error }
}

export const NOTIFICATION_POPOVER_LIMIT = 10

export const CLEAR_ALL_NOTIFICATIONS_CONFIRM = 'Mark all notifications as read?'

export const NOTIFICATIONS_CHANGED_EVENT = 'equipd:notifications-changed'

export function dispatchNotificationsChanged(detail = {}) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(NOTIFICATIONS_CHANGED_EVENT, { detail }))
}

export function confirmClearAllNotifications() {
  if (typeof window === 'undefined') return false
  return window.confirm(CLEAR_ALL_NOTIFICATIONS_CONFIRM)
}

export async function fetchUnreadNotificationCount(userId) {
  if (!supabase) {
    return { count: 0, error: new Error('Supabase is not configured.') }
  }

  const { count, error } = await applyBellNotificationFilter(
    supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_read', false),
  )

  return { count: count ?? 0, error }
}

export async function markNotificationRead(notificationId) {
  if (!supabase) {
    return { data: null, error: new Error('Supabase is not configured.') }
  }

  const { data, error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('id', notificationId)
    .select(notificationFields)
    .single()

  if (!error) {
    dispatchNotificationsChanged({ scope: 'single', notificationId })
  }

  return { data, error }
}

export async function markAllNotificationsRead() {
  if (!supabase) {
    return { count: 0, error: new Error('Supabase is not configured.') }
  }

  const { data, error } = await supabase.rpc('mark_all_notifications_read')

  if (!error) {
    dispatchNotificationsChanged({ scope: 'all' })
  }

  return { count: data ?? 0, error }
}

export async function createNotification({ userId, type, title, body, linkUrl }) {
  if (!supabase) {
    return { data: null, error: new Error('Supabase is not configured.') }
  }

  const { data, error } = await supabase.rpc('create_notification', {
    p_user_id: userId,
    p_type: type,
    p_title: title,
    p_body: body,
    p_link_url: linkUrl ?? null,
  })

  return { data, error }
}
