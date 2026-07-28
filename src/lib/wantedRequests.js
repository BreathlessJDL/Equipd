/**
 * Client API for creating and managing wanted equipment requests.
 * Create path uses create-wanted-request Edge Function (SendGrid stays server-side).
 * List/cancel use authenticated Supabase RLS on wanted_requests.
 */

import { supabase, isSupabaseConfigured } from './supabase.js'

/**
 * @returns {string}
 */
export function createWantedRequestClientId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const random = (Math.random() * 16) | 0
    const value = char === 'x' ? random : (random & 0x3) | 0x8
    return value.toString(16)
  })
}

/**
 * @param {import('./wantedRequestTypes.js').WantedRequestPayload} payload
 * @param {{ clientRequestId?: string }} [options]
 * @returns {Promise<{
 *   ok: true,
 *   id: string,
 *   created: boolean,
 *   emails?: Record<string, unknown>,
 * } | {
 *   ok: false,
 *   error: string,
 *   status?: number,
 * }>}
 */
export async function createWantedRequest(payload, options = {}) {
  if (!isSupabaseConfigured || !supabase) {
    return { ok: false, error: 'Supabase is not configured' }
  }

  const clientRequestId = options.clientRequestId || createWantedRequestClientId()

  const { data, error } = await supabase.functions.invoke('create-wanted-request', {
    body: {
      clientRequestId,
      entryMode: payload.entryMode,
      productId: payload.productId,
      canonicalProductKey: payload.canonicalProductKey,
      productName: payload.productName,
      brand: payload.brand,
      equipmentType: payload.equipmentType,
      manualBrand: payload.manualBrand,
      manualModelName: payload.manualModelName,
      searchTerm: payload.searchTerm,
      location: payload.location,
      radius: payload.radius,
      maximumBudget: payload.maximumBudget,
      conditionPreference: payload.conditionPreference,
      notes: payload.notes,
      email: payload.email,
      source: payload.source,
      currentPageUrl: payload.currentPageUrl,
      saveAsAlert: payload.saveAsAlert,
    },
  })

  if (error) {
    const status = error.context?.status
    let message = error.message || 'Failed to create wanted request'
    try {
      const body = typeof data === 'object' && data ? data : null
      if (body?.error) message = String(body.error)
    } catch {
      // keep default message
    }
    return { ok: false, error: message, status }
  }

  if (!data?.ok || !data?.id) {
    return {
      ok: false,
      error: data?.error || 'Failed to create wanted request',
    }
  }

  return {
    ok: true,
    id: data.id,
    created: Boolean(data.created),
    emails: data.emails,
  }
}

/**
 * @typedef {Object} WantedRequestRow
 * @property {string} id
 * @property {string} title
 * @property {string | null} brand
 * @property {string | null} model
 * @property {string | null} location
 * @property {number | null} max_price_pence
 * @property {number | null} radius_km
 * @property {string} status
 * @property {Record<string, unknown>} criteria
 * @property {string} created_at
 * @property {string} updated_at
 */

/**
 * @param {{ status?: string | null }} [options]
 * @returns {Promise<{ ok: true, rows: WantedRequestRow[] } | { ok: false, error: string }>}
 */
export async function listMyWantedRequests(options = {}) {
  if (!isSupabaseConfigured || !supabase) {
    return { ok: false, error: 'Supabase is not configured' }
  }

  let query = supabase
    .from('wanted_requests')
    .select(
      'id, title, brand, model, location, max_price_pence, radius_km, status, criteria, created_at, updated_at',
    )
    .order('created_at', { ascending: false })

  if (options.status && options.status !== 'all') {
    if (options.status === 'match_found') {
      query = query.eq('status', 'fulfilled')
    } else if (options.status === 'expired') {
      query = query.in('status', ['archived', 'paused'])
    } else {
      query = query.eq('status', options.status)
    }
  }

  const { data, error } = await query
  if (error) {
    return { ok: false, error: error.message }
  }

  return { ok: true, rows: data || [] }
}

/**
 * Soft-cancel by archiving. RLS restricts to the authenticated owner's rows.
 * @param {string} requestId
 * @returns {Promise<{ ok: true } | { ok: false, error: string }>}
 */
export async function cancelMyWantedRequest(requestId) {
  if (!isSupabaseConfigured || !supabase) {
    return { ok: false, error: 'Supabase is not configured' }
  }

  const id = String(requestId ?? '').trim()
  if (!id) {
    return { ok: false, error: 'Request id is required' }
  }

  const { error } = await supabase
    .from('wanted_requests')
    .update({ status: 'archived' })
    .eq('id', id)
    .eq('status', 'active')

  if (error) {
    return { ok: false, error: error.message }
  }

  return { ok: true }
}
