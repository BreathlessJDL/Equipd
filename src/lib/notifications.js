import { supabase } from './supabase'

const notificationFields = 'id, user_id, type, title, body, link_url, is_read, created_at'

export const NOTIFICATION_TYPES = {
  MESSAGE_RECEIVED: 'message_received',
  OFFER_RECEIVED: 'offer_received',
  OFFER_ACCEPTED: 'offer_accepted',
  OFFER_REJECTED: 'offer_rejected',
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

export async function fetchNotifications(userId) {
  if (!supabase) {
    return { data: null, error: new Error('Supabase is not configured.') }
  }

  const { data, error } = await supabase
    .from('notifications')
    .select(notificationFields)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  return { data, error }
}

export async function fetchUnreadNotificationCount(userId) {
  if (!supabase) {
    return { count: 0, error: new Error('Supabase is not configured.') }
  }

  const { count, error } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('is_read', false)

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

  return { data, error }
}

export async function markAllNotificationsRead(userId) {
  if (!supabase) {
    return { error: new Error('Supabase is not configured.') }
  }

  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('user_id', userId)
    .eq('is_read', false)

  return { error }
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
