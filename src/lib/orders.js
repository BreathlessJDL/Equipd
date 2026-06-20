import { supabase } from './supabase'

export const ORDER_FULFILMENT_STATUSES = {
  AWAITING_PAYMENT: 'awaiting_payment',
  PAID: 'paid',
  IN_PROGRESS: 'in_progress',
  BUYER_CONFIRMED: 'buyer_confirmed',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  DISPUTED: 'disputed',
}

export const PAYOUT_STATUSES = {
  NOT_DUE: 'not_due',
  AWAITING_SELLER_SETUP: 'awaiting_seller_setup',
  READY: 'ready',
  PROCESSING: 'processing',
  PAID: 'paid',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
}

const orderFields = `
  id,
  offer_id,
  payment_id,
  listing_id,
  buyer_id,
  seller_id,
  amount_pence,
  platform_fee_pence,
  seller_net_pence,
  fulfilment_status,
  payout_status,
  buyer_confirmed_at,
  payout_released_at,
  stripe_transfer_id,
  created_at,
  updated_at
`

export async function fetchOrdersByOfferIds(offerIds) {
  if (!supabase) {
    return { data: null, error: new Error('Supabase is not configured.') }
  }

  const ids = [...new Set((offerIds ?? []).filter(Boolean))]

  if (ids.length === 0) {
    return { data: [], error: null }
  }

  const { data, error } = await supabase.from('orders').select(orderFields).in('offer_id', ids)

  return { data: data ?? [], error }
}

export function formatOrderFulfilmentStatus(status) {
  const labels = {
    awaiting_payment: 'Awaiting payment',
    paid: 'Paid — awaiting collection',
    in_progress: 'In progress',
    buyer_confirmed: 'Buyer confirmed',
    completed: 'Completed',
    cancelled: 'Cancelled',
    disputed: 'Disputed',
  }

  return labels[status] ?? status
}

export function formatPayoutStatus(status) {
  const labels = {
    not_due: 'Payout not due',
    awaiting_seller_setup: 'Awaiting seller payout setup',
    ready: 'Ready for payout',
    processing: 'Payout processing',
    paid: 'Paid out',
    failed: 'Payout failed',
    cancelled: 'Cancelled',
  }

  return labels[status] ?? status
}

export function getOfferOrder(offer) {
  if (!offer?.order) return null
  return Array.isArray(offer.order) ? (offer.order[0] ?? null) : offer.order
}

export function canBuyerConfirmOrder(order, payment) {
  return (
    payment?.status === 'paid' &&
    order?.fulfilment_status === ORDER_FULFILMENT_STATUSES.PAID
  )
}

export function isOrderBuyerConfirmed(order) {
  return order?.fulfilment_status === ORDER_FULFILMENT_STATUSES.BUYER_CONFIRMED
}

export function isOrderAwaitingConfirmation(order, payment) {
  return canBuyerConfirmOrder(order, payment)
}

export function isOrderCompleted(order) {
  return order?.fulfilment_status === ORDER_FULFILMENT_STATUSES.COMPLETED
}

export function getOrderErrorMessage(error) {
  if (!error) return 'Something went wrong. Please try again.'
  return error.message || 'Something went wrong. Please try again.'
}

export async function confirmOrderReceived(orderId) {
  if (!supabase) {
    return { data: null, error: new Error('Supabase is not configured.') }
  }

  const { data, error } = await supabase.rpc('confirm_order_received', {
    p_order_id: orderId,
  })

  return { data, error }
}

export function shouldAttemptPayoutRelease(payoutStatus) {
  return (
    payoutStatus === PAYOUT_STATUSES.READY || payoutStatus === PAYOUT_STATUSES.FAILED
  )
}

export function enrichOfferWithOrder(offer) {
  if (!offer) return offer

  return {
    ...offer,
    order: getOfferOrder(offer),
  }
}

export { orderFields }
