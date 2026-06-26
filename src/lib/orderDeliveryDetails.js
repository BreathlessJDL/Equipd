import {
  fetchListingFulfilmentPrivate,
  getListingFulfilmentPrivateErrorMessage,
} from './listingFulfilmentPrivate'
import { isPaymentComplete } from './payments'
import { ORDER_TYPES } from './orders'
import { supabase } from './supabase'

export const FULFILMENT_VIEWER_ROLES = {
  BUYER: 'buyer',
  SELLER: 'seller',
  ADMIN: 'admin',
}

const SUPPORTED_FULFILMENT_ORDER_TYPES = new Set([
  ORDER_TYPES.COLLECTION,
  ORDER_TYPES.BUYER_COURIER,
  ORDER_TYPES.SELLER_DELIVERY,
])

const COLLECTION_FULFILMENT_ORDER_TYPES = new Set([
  ORDER_TYPES.COLLECTION,
  ORDER_TYPES.BUYER_COURIER,
])

export function isCollectionFulfilmentOrderType(orderType) {
  const type = orderType ?? ORDER_TYPES.COLLECTION
  return COLLECTION_FULFILMENT_ORDER_TYPES.has(type)
}

export function isSellerDeliveryFulfilmentOrderType(orderType) {
  return (orderType ?? ORDER_TYPES.COLLECTION) === ORDER_TYPES.SELLER_DELIVERY
}

export function isSupportedFulfilmentOrderType(orderType) {
  const type = orderType ?? ORDER_TYPES.COLLECTION
  return SUPPORTED_FULFILMENT_ORDER_TYPES.has(type)
}

export function isPaidNonCancelledOrder(order, payment) {
  if (!order?.id || !payment) return false
  if (!isPaymentComplete(payment)) return false
  return order.fulfilment_status !== 'cancelled'
}

export function canShowOrderFulfilmentDetails({ order, payment, viewerRole }) {
  if (!order?.id || !payment || !viewerRole) return false
  if (!isPaidNonCancelledOrder(order, payment)) return false
  if (!isSupportedFulfilmentOrderType(order.order_type)) return false

  return (
    viewerRole === FULFILMENT_VIEWER_ROLES.BUYER
    || viewerRole === FULFILMENT_VIEWER_ROLES.SELLER
    || viewerRole === FULFILMENT_VIEWER_ROLES.ADMIN
  )
}

export function getOrderFulfilmentDetailsCardTitle(orderType) {
  const type = orderType ?? ORDER_TYPES.COLLECTION

  if (type === ORDER_TYPES.BUYER_COURIER) {
    return 'Courier collection details'
  }

  if (type === ORDER_TYPES.SELLER_DELIVERY) {
    return 'Delivery details'
  }

  return 'Collection details'
}

export function normalizeListingFulfilmentPrivate(row) {
  if (!row || typeof row !== 'object') return null

  return {
    listingId: row.listing_id,
    collectionAddress: row.collection_address ?? null,
    collectionPhone: row.collection_phone ?? null,
    collectionInstructions: row.collection_instructions ?? null,
    createdAt: row.created_at ?? null,
    updatedAt: row.updated_at ?? null,
  }
}

export function normalizeOrderDeliveryDetails(row) {
  if (!row || typeof row !== 'object') return null

  return {
    orderId: row.order_id,
    buyerDeliveryAddress: row.buyer_delivery_address ?? null,
    createdAt: row.created_at ?? null,
    updatedAt: row.updated_at ?? null,
  }
}

export function formatFulfilmentDetailsTimestamp(value) {
  if (!value) return ''

  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

export function getOrderDeliveryDetailsErrorMessage(error) {
  if (!error) return 'Something went wrong. Please try again.'

  const message = error.message ?? ''

  if (message.includes('Not authenticated')) {
    return 'Sign in to view delivery details.'
  }

  if (message.includes('Only the buyer may change delivery details')) {
    return 'Only the buyer can update the delivery address for this order.'
  }

  if (message.includes('Delivery details cannot be added for this order')
    || message.includes('Delivery details cannot be changed for this order')) {
    return 'Delivery details cannot be updated for this order.'
  }

  if (message.includes('Enter a delivery address')) {
    return 'Enter a delivery address before saving.'
  }

  if (message.includes('row-level security') || message.includes('permission denied')) {
    return 'You do not have access to these fulfilment details.'
  }

  return getListingFulfilmentPrivateErrorMessage(error)
}

export async function fetchOrderDeliveryDetails(orderId) {
  if (!supabase) {
    return { data: null, error: new Error('Supabase is not configured.') }
  }

  if (!orderId) {
    return { data: null, error: new Error('Order id is required.') }
  }

  const { data, error } = await supabase
    .from('order_delivery_details')
    .select('order_id, buyer_delivery_address, created_at, updated_at')
    .eq('order_id', orderId)
    .maybeSingle()

  if (error) {
    return { data: null, error }
  }

  return {
    data: normalizeOrderDeliveryDetails(data),
    error: null,
  }
}

export async function updateOrderDeliveryDetails(orderId, patch = {}) {
  if (!supabase) {
    return { data: null, error: new Error('Supabase is not configured.') }
  }

  if (!orderId) {
    return { data: null, error: new Error('Order id is required.') }
  }

  const address =
    patch.buyerDeliveryAddress?.trim()
    ?? patch.buyer_delivery_address?.trim()
    ?? ''

  if (!address) {
    return { data: null, error: new Error('Enter a delivery address before saving.') }
  }

  const { data, error } = await supabase
    .from('order_delivery_details')
    .upsert(
      {
        order_id: orderId,
        buyer_delivery_address: address,
      },
      { onConflict: 'order_id' },
    )
    .select('order_id, buyer_delivery_address, created_at, updated_at')
    .single()

  if (error) {
    return { data: null, error }
  }

  return {
    data: normalizeOrderDeliveryDetails(data),
    error: null,
  }
}

export async function fetchListingFulfilmentPrivateForOrder(orderId, listingId = null) {
  if (!supabase) {
    return { data: null, error: new Error('Supabase is not configured.') }
  }

  if (!orderId && !listingId) {
    return { data: null, error: new Error('Order id or listing id is required.') }
  }

  let resolvedListingId = listingId

  if (!resolvedListingId) {
    const { data: orderRow, error: orderError } = await supabase
      .from('orders_client')
      .select('listing_id')
      .eq('id', orderId)
      .maybeSingle()

    if (orderError) {
      return { data: null, error: orderError }
    }

    if (!orderRow?.listing_id) {
      return { data: null, error: new Error('Listing not found for this order.') }
    }

    resolvedListingId = orderRow.listing_id
  }

  const { data, error } = await fetchListingFulfilmentPrivate(resolvedListingId)

  if (error) {
    return { data: null, error }
  }

  return {
    data: normalizeListingFulfilmentPrivate(data),
    error: null,
  }
}
