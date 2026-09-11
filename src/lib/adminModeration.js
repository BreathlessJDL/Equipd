import { supabase } from './supabase'

export async function suspendUser(userId, reason = '') {
  if (!supabase) return { data: null, error: new Error('Supabase is not configured.') }
  const { data, error } = await supabase.functions.invoke('admin-moderate-user', {
    body: { userId, reason, action: 'suspend' },
  })
  if (error) {
    let message = error.message || 'Could not suspend user.'
    try {
      if (error.context && typeof error.context.json === 'function') {
        const payload = await error.context.json()
        if (payload?.error) message = String(payload.error)
      }
    } catch {
      // keep
    }
    return { data: null, error: new Error(message) }
  }
  if (data?.error) return { data: null, error: new Error(String(data.error)) }
  return { data, error: null, warning: data?.warning || null }
}

export async function unsuspendUser(userId, reason = '') {
  if (!supabase) return { data: null, error: new Error('Supabase is not configured.') }
  const { data, error } = await supabase.functions.invoke('admin-moderate-user', {
    body: { userId, reason, action: 'unsuspend' },
  })
  if (error) {
    let message = error.message || 'Could not unsuspend user.'
    try {
      if (error.context && typeof error.context.json === 'function') {
        const payload = await error.context.json()
        if (payload?.error) message = String(payload.error)
      }
    } catch {
      // keep
    }
    return { data: null, error: new Error(message) }
  }
  if (data?.error) return { data: null, error: new Error(String(data.error)) }
  return { data, error: null, warning: data?.warning || null }
}

export async function fetchAdminUserModerationSummary(userId) {
  if (!supabase) return { data: null, error: new Error('Supabase is not configured.') }
  const { data, error } = await supabase.rpc('admin_user_moderation_summary', {
    p_user_id: userId,
  })
  return { data, error }
}

export async function fetchUsersContactedBy(userId) {
  if (!supabase) return { data: null, error: new Error('Supabase is not configured.') }
  const { data, error } = await supabase.rpc('admin_list_users_contacted_by', {
    p_user_id: userId,
  })
  return { data: Array.isArray(data) ? data : [], error }
}

export async function fetchSuspiciousMessageFlags({ status = 'open', limit = 50 } = {}) {
  if (!supabase) return { data: null, error: new Error('Supabase is not configured.') }
  const { data, error } = await supabase.rpc('admin_list_suspicious_message_flags', {
    p_status: status,
    p_limit: limit,
  })
  return { data: Array.isArray(data) ? data : [], error }
}

export async function fetchSuspendedUsers(limit = 50) {
  if (!supabase) return { data: null, error: new Error('Supabase is not configured.') }
  const { data, error } = await supabase.rpc('admin_list_suspended_users', {
    p_limit: limit,
  })
  return { data: Array.isArray(data) ? data : [], error }
}

export async function fetchHighVolumeNewConversationAccounts({
  hours = 24,
  minConversations = 8,
  limit = 50,
} = {}) {
  if (!supabase) return { data: null, error: new Error('Supabase is not configured.') }
  const { data, error } = await supabase.rpc(
    'admin_list_high_volume_new_conversation_accounts',
    {
      p_hours: hours,
      p_min_conversations: minConversations,
      p_limit: limit,
    },
  )
  return { data: Array.isArray(data) ? data : [], error }
}

export async function listReservedEquipdIdentityConflicts() {
  if (!supabase) return { data: null, error: new Error('Supabase is not configured.') }
  const { data, error } = await supabase.rpc('list_reserved_equipd_identity_conflicts')
  return { data: Array.isArray(data) ? data : [], error }
}

export function contactedUsersToCsv(rows = []) {
  const header = [
    'contacted_user_id',
    'username',
    'display_name',
    'email',
    'conversation_id',
    'first_contact_at',
    'last_contact_at',
    'messages_sent_by_user',
  ]
  const escape = (value) => {
    const text = value == null ? '' : String(value)
    if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`
    return text
  }
  const lines = [header.join(',')]
  for (const row of rows) {
    lines.push(
      [
        row.contacted_user_id,
        row.username,
        row.display_name,
        row.email,
        row.conversation_id,
        row.first_contact_at,
        row.last_contact_at,
        row.messages_sent_by_user,
      ]
        .map(escape)
        .join(','),
    )
  }
  return `${lines.join('\n')}\n`
}
