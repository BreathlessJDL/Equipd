import {
  fetchListingFulfilmentPrivate,
  getListingFulfilmentPrivateErrorMessage,
} from './listingFulfilmentPrivate'
import { isPaymentComplete } from './payments'
import { isOrderCollected, ORDER_FULFILMENT_STATUSES, ORDER_TYPES } from './orders'
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

const ORDER_DELIVERY_DETAILS_SELECT_BASE =
  'order_id, buyer_delivery_address, created_at, updated_at'

const ORDER_DELIVERY_DETAILS_SELECT_EXTENDED =
  `${ORDER_DELIVERY_DETAILS_SELECT_BASE}, delivery_contact_name, delivery_contact_phone, delivery_notes, delivery_details_submitted_at`

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

export function canBuyerEditDeliveryDetails(order) {
  if (!order?.id) return false
  if (!isSellerDeliveryFulfilmentOrderType(order.order_type)) return false
  if (order.fulfilment_status === ORDER_FULFILMENT_STATUSES.CANCELLED) return false
  if (isOrderCollected(order)) return false
  return order.fulfilment_status === ORDER_FULFILMENT_STATUSES.AWAITING_SELLER_DELIVERY
}

export function hasBuyerSubmittedDeliveryDetails(details) {
  if (!details) return false

  const hasAddress = Boolean(details.buyerDeliveryAddress?.trim())
  const hasName = Boolean(details.deliveryContactName?.trim())
  const hasPhone = Boolean(details.deliveryContactPhone?.trim())

  if (hasAddress && hasName && hasPhone) return true

  // Legacy rows may only have an address saved.
  return hasAddress && Boolean(details.submittedAt || details.updatedAt)
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
    deliveryContactName: row.delivery_contact_name ?? null,
    deliveryContactPhone: row.delivery_contact_phone ?? null,
    deliveryNotes: row.delivery_notes ?? null,
    submittedAt: row.delivery_details_submitted_at ?? row.created_at ?? null,
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

function logOrderDeliveryDetailsError(context, error, extra = {}) {
  if (!error) return

  console.error('[order_delivery_details]', context, {
    message: error.message,
    code: error.code,
    details: error.details,
    hint: error.hint,
    ...extra,
  })
}

function isMissingDeliveryDetailsColumnError(error) {
  const message = error?.message ?? ''
  const code = error?.code ?? ''

  return (
    code === '42703'
    || code === 'PGRST204'
    || /column.+does not exist/i.test(message)
    || /could not find the '.+' column of 'order_delivery_details'/i.test(message)
  )
}

function isOrderDeliveryDetailsPermissionError(error) {
  const message = error?.message ?? ''

  return (
    /permission denied/i.test(message)
    || /row-level security/i.test(message)
    || error?.code === '42501'
  )
}

export function getOrderDeliveryDetailsLoadErrorMessage(error) {
  if (!error) return 'Something went wrong. Please try again.'

  const message = error.message ?? ''

  if (message.includes('Not authenticated')) {
    return 'Sign in to view delivery details.'
  }

  if (isMissingDeliveryDetailsColumnError(error)) {
    return 'Delivery details are temporarily unavailable. Equipd needs to apply a database update — please contact support if this persists.'
  }

  if (isOrderDeliveryDetailsPermissionError(error)) {
    return 'Delivery details could not be loaded. Please refresh the page or contact support.'
  }

  return getListingFulfilmentPrivateErrorMessage(error)
}

export function getOrderDeliveryDetailsSaveErrorMessage(error) {
  if (!error) return 'Delivery details could not be saved. Please try again.'

  const message = error.message ?? ''

  if (message.includes('Not authenticated')) {
    return 'Sign in to save delivery details.'
  }

  if (message.includes('Only the buyer may change delivery details')) {
    return 'Only the buyer can update delivery details for this order.'
  }

  if (message.includes('Delivery details cannot be added for this order')
    || message.includes('Delivery details cannot be changed for this order')) {
    return 'Delivery details cannot be updated after handover has been confirmed.'
  }

  if (message.includes('Enter a delivery address')) {
    return 'Enter a delivery address before saving.'
  }

  if (message.includes('Enter a contact name')) {
    return 'Enter a contact name before saving.'
  }

  if (message.includes('Enter a contact phone number')) {
    return 'Enter a contact phone number before saving.'
  }

  if (isMissingDeliveryDetailsColumnError(error)) {
    return 'Delivery details could not be saved. A database update is required — please contact support.'
  }

  if (isOrderDeliveryDetailsPermissionError(error)) {
    return 'Delivery details could not be saved. Please try again.'
  }

  return 'Delivery details could not be saved. Please try again.'
}

/** @deprecated Use getOrderDeliveryDetailsLoadErrorMessage or getOrderDeliveryDetailsSaveErrorMessage */
export function getOrderDeliveryDetailsErrorMessage(error) {
  return getOrderDeliveryDetailsLoadErrorMessage(error)
}

async function queryOrderDeliveryDetails(orderId, selectColumns) {
  return supabase
    .from('order_delivery_details')
    .select(selectColumns)
    .eq('order_id', orderId)
    .maybeSingle()
}

export async function fetchOrderDeliveryDetails(orderId) {
  if (!supabase) {
    return { data: null, error: new Error('Supabase is not configured.') }
  }

  if (!orderId) {
    return { data: null, error: new Error('Order id is required.') }
  }

  let { data, error } = await queryOrderDeliveryDetails(
    orderId,
    ORDER_DELIVERY_DETAILS_SELECT_EXTENDED,
  )

  if (error && isMissingDeliveryDetailsColumnError(error)) {
    logOrderDeliveryDetailsError(
      'fetch fallback to base columns — run seller-delivery-buyer-details-extension.sql',
      error,
      { orderId },
    )

    const fallback = await queryOrderDeliveryDetails(orderId, ORDER_DELIVERY_DETAILS_SELECT_BASE)
    data = fallback.data
    error = fallback.error
  }

  if (error) {
    logOrderDeliveryDetailsError('fetch failed', error, {
      orderId,
      rlsHint: isOrderDeliveryDetailsPermissionError(error)
        ? 'Run supabase/order-delivery-details-rls-fix.sql'
        : undefined,
    })
    return { data: null, error }
  }

  // No row yet is a normal state for a new seller-delivery order.
  return {
    data: data ? normalizeOrderDeliveryDetails(data) : null,
    error: null,
  }
}

function validateDeliveryDetailsPatch(patch = {}) {
  const address =
    patch.buyerDeliveryAddress?.trim()
    ?? patch.buyer_delivery_address?.trim()
    ?? ''
  const contactName =
    patch.deliveryContactName?.trim()
    ?? patch.delivery_contact_name?.trim()
    ?? ''
  const contactPhone =
    patch.deliveryContactPhone?.trim()
    ?? patch.delivery_contact_phone?.trim()
    ?? ''
  const notes =
    patch.deliveryNotes?.trim()
    ?? patch.delivery_notes?.trim()
    ?? ''

  if (!address) {
    return { error: new Error('Enter a delivery address before saving.') }
  }

  if (!contactName) {
    return { error: new Error('Enter a contact name before saving.') }
  }

  if (!contactPhone) {
    return { error: new Error('Enter a contact phone number before saving.') }
  }

  return {
    payload: {
      buyer_delivery_address: address,
      delivery_contact_name: contactName,
      delivery_contact_phone: contactPhone,
      delivery_notes: notes || null,
    },
  }
}

async function upsertOrderDeliveryDetails(orderId, payload, selectColumns) {
  const { data: existing, error: readError } = await queryOrderDeliveryDetails(
    orderId,
    ORDER_DELIVERY_DETAILS_SELECT_BASE,
  )

  if (readError && !isMissingDeliveryDetailsColumnError(readError)) {
    return { data: null, error: readError, operation: null }
  }

  if (existing) {
    const result = await supabase
      .from('order_delivery_details')
      .update(payload)
      .eq('order_id', orderId)
      .select(selectColumns)
      .single()
    return { ...result, operation: 'update' }
  }

  const result = await supabase
    .from('order_delivery_details')
    .insert({
      order_id: orderId,
      ...payload,
    })
    .select(selectColumns)
    .single()
  return { ...result, operation: 'insert' }
}

export async function updateOrderDeliveryDetails(orderId, patch = {}) {
  if (!supabase) {
    return { data: null, error: new Error('Supabase is not configured.') }
  }

  if (!orderId) {
    return { data: null, error: new Error('Order id is required.') }
  }

  const validated = validateDeliveryDetailsPatch(patch)
  if (validated.error) {
    return { data: null, error: validated.error }
  }

  let { data, error, operation } = await upsertOrderDeliveryDetails(
    orderId,
    validated.payload,
    ORDER_DELIVERY_DETAILS_SELECT_EXTENDED,
  )

  if (error && isMissingDeliveryDetailsColumnError(error)) {
    logOrderDeliveryDetailsError(
      'save fallback to base columns — run seller-delivery-buyer-details-extension.sql',
      error,
      { orderId },
    )

    const fallback = await upsertOrderDeliveryDetails(
      orderId,
      { buyer_delivery_address: validated.payload.buyer_delivery_address },
      ORDER_DELIVERY_DETAILS_SELECT_BASE,
    )
    data = fallback.data
    error = fallback.error
    operation = fallback.operation
  }

  if (error) {
    logOrderDeliveryDetailsError('save failed', error, {
      orderId,
      operation,
      payload: validated.payload,
      rlsHint: isOrderDeliveryDetailsPermissionError(error)
        ? 'Run supabase/order-delivery-details-write-fix-live.sql (drop enforce trigger)'
        : undefined,
    })
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
    return { data: null, error: error }
  }

  return {
    data: normalizeListingFulfilmentPrivate(data),
    error: null,
  }
}
