/**
 * Admin impersonation client helpers.
 *
 * Security boundary: Postgres RLS + Edge requireAdmin + Access Token Hook.
 * sessionStorage metadata and Settings UI blocks are NOT Auth security boundaries.
 * Supabase Auth updateUser (password/email) cannot be cryptographically blocked for a
 * genuine customer JWT — see architecture review.
 */

import { supabase } from './supabase'

export const IMPERSONATION_STORAGE_KEY = 'equipd:impersonation:v1'
export const IMPERSONATION_LOGIN_MESSAGE_KEY = 'equipd:impersonation:login_message'
export const IMPERSONATION_TTL_MS = 60 * 60 * 1000

/**
 * @typedef {{
 *   sessionId: string,
 *   adminUserId: string,
 *   impersonatedUserId: string,
 *   displayName: string,
 *   username: string | null,
 *   expiresAt: string,
 *   adminRestoreHashedToken: string,
 * }} ImpersonationClientState
 */

function readStorage() {
  if (typeof sessionStorage === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(IMPERSONATION_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed?.sessionId || !parsed?.impersonatedUserId || !parsed?.adminRestoreHashedToken) {
      return null
    }
    return /** @type {ImpersonationClientState} */ (parsed)
  } catch {
    return null
  }
}

export function getImpersonationClientState() {
  return readStorage()
}

export function clearImpersonationClientState() {
  if (typeof sessionStorage === 'undefined') return
  sessionStorage.removeItem(IMPERSONATION_STORAGE_KEY)
}

/**
 * @param {ImpersonationClientState} state
 */
export function setImpersonationClientState(state) {
  sessionStorage.setItem(IMPERSONATION_STORAGE_KEY, JSON.stringify(state))
}

export function decodeAccessTokenPayload(accessToken) {
  if (!accessToken || typeof accessToken !== 'string') return null
  try {
    const parts = accessToken.split('.')
    if (parts.length < 2) return null
    const json = atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'))
    return JSON.parse(json)
  } catch {
    return null
  }
}

export function getImpersonatedByFromSession(session) {
  const payload = decodeAccessTokenPayload(session?.access_token)
  const claim = payload?.app_metadata?.impersonated_by
  if (typeof claim === 'string' && claim.trim()) return claim.trim()
  return null
}

/**
 * True when the live Auth session is an admin-impersonation session.
 * Requires JWT claim (or matching client state that agrees with auth.uid).
 * Never trusts sessionStorage alone.
 */
export function isImpersonatingSession(session, user = session?.user ?? null) {
  if (!session || !user?.id) return false
  const claimAdminId = getImpersonatedByFromSession(session)
  if (claimAdminId) return true

  const stored = readStorage()
  if (!stored) return false
  if (stored.impersonatedUserId !== user.id) return false
  if (stored.expiresAt && Date.parse(stored.expiresAt) <= Date.now()) return false
  // Storage agrees with uid but claim missing (hook lag / not yet enabled): treat as
  // impersonating for UX/expiry, still not a privilege source.
  return true
}

export function getImpersonationDisplayName(session, user = session?.user ?? null) {
  const stored = readStorage()
  if (stored?.displayName && stored.impersonatedUserId === user?.id) {
    return stored.displayName
  }
  return (
    user?.user_metadata?.display_name ||
    user?.user_metadata?.username ||
    user?.email ||
    'this user'
  )
}

export function isImpersonationExpired(session) {
  const stored = readStorage()
  if (stored?.expiresAt && Date.parse(stored.expiresAt) <= Date.now()) return true
  return false
}

/**
 * UX safeguard only — not a cryptographic Auth boundary.
 */
export function isSensitiveAccountActionBlockedByImpersonation(session, user) {
  return isImpersonatingSession(session, user)
}

async function invokeImpersonationFunction(functionName, body) {
  if (!supabase) {
    return { data: null, error: new Error('Supabase is not configured.') }
  }

  const { data, error } = await supabase.functions.invoke(functionName, { body })
  if (error) {
    let message = error.message || `Failed to call ${functionName}`
    try {
      const ctx = error.context
      if (ctx && typeof ctx.json === 'function') {
        const payload = await ctx.json()
        if (payload?.error) message = String(payload.error)
      }
    } catch {
      // keep message
    }
    return { data: null, error: new Error(message) }
  }

  if (data?.error) {
    return { data: null, error: new Error(String(data.error)) }
  }

  return { data, error: null }
}

export async function searchAdminUsers(query, limit = 50) {
  if (!supabase) {
    return { data: null, error: new Error('Supabase is not configured.') }
  }

  const { data, error } = await supabase.rpc('admin_search_users', {
    p_query: query?.trim() ? query.trim() : null,
    p_limit: limit,
  })

  if (error) return { data: null, error }
  return { data: { items: Array.isArray(data?.items) ? data.items : [] }, error: null }
}

export async function startAdminImpersonation(targetUserId) {
  return invokeImpersonationFunction('admin-impersonate-start', { targetUserId })
}

export async function endAdminImpersonationSession(sessionId, endedReason = 'exited') {
  return invokeImpersonationFunction('admin-impersonate-end', { sessionId, endedReason })
}

/**
 * Exchange customer hashed token and enter impersonation.
 * Aborts if resulting auth.uid does not match the selected target.
 */
export async function enterImpersonationWithCustomerToken({
  customerHashedToken,
  adminRestoreHashedToken,
  sessionId,
  expiresAt,
  target,
  adminUserId,
}) {
  if (!supabase) {
    return { error: new Error('Supabase is not configured.') }
  }

  setImpersonationClientState({
    sessionId,
    adminUserId,
    impersonatedUserId: target.id,
    displayName: target.displayName || target.username || target.email || 'User',
    username: target.username || null,
    expiresAt,
    adminRestoreHashedToken,
  })

  const { data, error } = await supabase.auth.verifyOtp({
    type: 'email',
    token_hash: customerHashedToken,
  })

  if (error) {
    clearImpersonationClientState()
    return { error }
  }

  const userId = data.session?.user?.id || data.user?.id
  if (!userId || userId !== target.id) {
    clearImpersonationClientState()
    await supabase.auth.signOut({ scope: 'local' })
    return { error: new Error('Impersonation aborted: signed-in identity did not match the selected user.') }
  }

  return { session: data.session, error: null }
}

/**
 * Restore admin via one-time magiclink token, then close audit row.
 */
export async function exitImpersonation() {
  if (!supabase) {
    return { error: new Error('Supabase is not configured.'), redirectTo: '/login' }
  }

  const stored = readStorage()
  if (!stored?.adminRestoreHashedToken || !stored?.sessionId) {
    clearImpersonationClientState()
    await supabase.auth.signOut({ scope: 'local' })
    setLoginMessage('Your admin session could not be restored. Please sign in again.')
    return { error: new Error('Missing restoration token'), redirectTo: '/login' }
  }

  const expectedAdminId = stored.adminUserId
  const sessionId = stored.sessionId
  const restoreToken = stored.adminRestoreHashedToken

  const { data, error } = await supabase.auth.verifyOtp({
    type: 'email',
    token_hash: restoreToken,
  })

  if (error) {
    clearImpersonationClientState()
    await supabase.auth.signOut({ scope: 'local' })
    setLoginMessage('Admin restoration failed. Please sign in again.')
    return { error, redirectTo: '/login' }
  }

  const restoredId = data.session?.user?.id || data.user?.id
  if (!restoredId || (expectedAdminId && restoredId !== expectedAdminId)) {
    clearImpersonationClientState()
    await supabase.auth.signOut({ scope: 'local' })
    setLoginMessage('Admin restoration identity mismatch. Please sign in again.')
    return { error: new Error('Wrong restoration identity'), redirectTo: '/login' }
  }

  clearImpersonationClientState()
  await endAdminImpersonationSession(sessionId, 'exited')

  return { error: null, redirectTo: '/admin/users' }
}

export async function failSafeLeaveImpersonation(message) {
  clearImpersonationClientState()
  if (supabase) {
    await supabase.auth.signOut({ scope: 'local' })
  }
  if (message) setLoginMessage(message)
  return { redirectTo: '/login' }
}

function setLoginMessage(message) {
  if (typeof sessionStorage === 'undefined') return
  sessionStorage.setItem(IMPERSONATION_LOGIN_MESSAGE_KEY, message)
}

export function consumeImpersonationLoginMessage() {
  if (typeof sessionStorage === 'undefined') return null
  const message = sessionStorage.getItem(IMPERSONATION_LOGIN_MESSAGE_KEY)
  sessionStorage.removeItem(IMPERSONATION_LOGIN_MESSAGE_KEY)
  return message
}
