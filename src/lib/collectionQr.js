import { supabase } from './supabase'

export const COLLECTION_CONFIRMATION_CHECKS = {
  item_collected: 'item_collected',
  item_inspected: 'item_inspected',
  item_matches_listing: 'item_matches_listing',
}

export function buildCollectionCollectUrl(token) {
  if (!token) return ''

  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}/orders/collect/${token}`
  }

  return `/orders/collect/${token}`
}

export function getCollectionQrErrorMessage(error) {
  if (!error) return 'Something went wrong. Please try again.'
  return error.message || 'Something went wrong. Please try again.'
}

export async function generateCollectionQrToken(orderId) {
  if (!supabase) {
    return { data: null, error: new Error('Supabase is not configured.') }
  }

  const { data, error } = await supabase.rpc('generate_collection_qr_token', {
    p_order_id: orderId,
  })

  return { data, error }
}

export async function fetchCollectionQrPreview(token) {
  if (!supabase) {
    return { data: null, error: new Error('Supabase is not configured.') }
  }

  const { data, error } = await supabase.rpc('get_collection_qr_preview', {
    p_token: token,
  })

  return { data, error }
}

export async function confirmCollectionByQr(token, checks) {
  if (!supabase) {
    return { data: null, error: new Error('Supabase is not configured.') }
  }

  const userAgent =
    typeof navigator !== 'undefined' && navigator.userAgent
      ? navigator.userAgent.slice(0, 512)
      : null

  const { data, error } = await supabase.rpc('confirm_collection_by_qr', {
    p_token: token,
    p_checks: checks,
    p_user_agent: userAgent,
  })

  return { data, error }
}

export function buildCollectionConfirmationChecks({
  itemCollected,
  itemInspected,
  itemMatchesListing,
}) {
  return {
    [COLLECTION_CONFIRMATION_CHECKS.item_collected]: Boolean(itemCollected),
    [COLLECTION_CONFIRMATION_CHECKS.item_inspected]: Boolean(itemInspected),
    [COLLECTION_CONFIRMATION_CHECKS.item_matches_listing]: Boolean(itemMatchesListing),
  }
}

export function areCollectionConfirmationChecksComplete(checks) {
  return (
    checks?.item_collected === true &&
    checks?.item_inspected === true &&
    checks?.item_matches_listing === true
  )
}

export async function devConfirmOrderHandover(orderId) {
  if (!supabase) {
    return { data: null, error: new Error('Supabase is not configured.') }
  }

  const userAgent =
    typeof navigator !== 'undefined' && navigator.userAgent
      ? navigator.userAgent.slice(0, 512)
      : null

  const { data, error } = await supabase.rpc('dev_confirm_order_handover', {
    p_order_id: orderId,
    p_user_agent: userAgent,
    p_checks: {
      source: 'dev_admin_handover_button',
    },
  })

  return { data, error }
}
