import { enrichListingWithImages } from './listingImages'
import { isPaymentComplete, paymentFields } from './payments'
import { supabase } from './supabase'

export const ORDER_FULFILMENT_STATUSES = {
  AWAITING_PAYMENT: 'awaiting_payment',
  PAID: 'paid',
  AWAITING_COLLECTION: 'awaiting_collection',
  AWAITING_COURIER_COLLECTION: 'awaiting_courier_collection',
  AWAITING_SELLER_DELIVERY: 'awaiting_seller_delivery',
  COLLECTED: 'collected',
  IN_TRANSIT: 'in_transit',
  DELIVERED: 'delivered',
  AWAITING_PAYOUT: 'awaiting_payout',
  IN_PROGRESS: 'in_progress',
  BUYER_CONFIRMED: 'buyer_confirmed',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  DISPUTED: 'disputed',
  REFUNDED: 'refunded',
}

export const ORDER_TYPES = {
  COLLECTION: 'collection',
  SELLER_DELIVERY: 'seller_delivery',
  BUYER_COURIER: 'buyer_courier',
}

const CONFIRMABLE_FULFILMENT_STATUSES = new Set([
  ORDER_FULFILMENT_STATUSES.PAID,
  ORDER_FULFILMENT_STATUSES.AWAITING_COLLECTION,
  ORDER_FULFILMENT_STATUSES.AWAITING_COURIER_COLLECTION,
  ORDER_FULFILMENT_STATUSES.DELIVERED,
])

const HUB_PAID_ACTIVE_FULFILMENT_STATUSES = new Set([
  ORDER_FULFILMENT_STATUSES.PAID,
  ORDER_FULFILMENT_STATUSES.AWAITING_COLLECTION,
  ORDER_FULFILMENT_STATUSES.AWAITING_COURIER_COLLECTION,
  ORDER_FULFILMENT_STATUSES.AWAITING_SELLER_DELIVERY,
  ORDER_FULFILMENT_STATUSES.COLLECTED,
  ORDER_FULFILMENT_STATUSES.IN_TRANSIT,
  ORDER_FULFILMENT_STATUSES.DELIVERED,
  ORDER_FULFILMENT_STATUSES.IN_PROGRESS,
  ORDER_FULFILMENT_STATUSES.AWAITING_PAYOUT,
  ORDER_FULFILMENT_STATUSES.BUYER_CONFIRMED,
  ORDER_FULFILMENT_STATUSES.DISPUTED,
])

export const PAYOUT_STATUSES = {
  NOT_DUE: 'not_due',
  ON_HOLD: 'on_hold',
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
  item_price_pence,
  buyer_protection_fee_pence,
  buyer_total_pence,
  platform_fee_pence,
  seller_net_pence,
  order_type,
  fulfilment_status,
  payout_status,
  buyer_confirmed_at,
  payout_release_at,
  payout_released_at,
  dispute_window_hours,
  protection_status,
  collected_at,
  delivered_at,
  collection_confirmed_at,
  collection_confirmed_by,
  collection_rejected_at,
  collection_rejection_reason,
  courier_name,
  courier_company,
  courier_tracking_reference,
  courier_buyer_tracking_reference,
  courier_evidence_notes,
  courier_collected_at,
  courier_evidence_submitted_at,
  courier_delivered_at,
  stripe_transfer_id,
  created_at,
  updated_at
`

const orderDetailListingSelect = `
  id,
  slug,
  title,
  brand,
  model,
  price_pence,
  condition,
  location,
  status,
  seller_id,
  collection_available,
  courier_available,
  delivery_notes,
  listing_images(id, storage_path, sort_order)
`

const courierEvidenceDetailFields = `
  courier_evidence_video_url,
  courier_pre_collection_photo_url,
  courier_handover_photo_url,
  courier_evidence_notes,
  courier_signature_name,
  courier_signature_data,
  courier_signed_at,
  courier_evidence_submitted_by,
  courier_delivery_confirmed_by,
  courier_delivery_confirmation_checks,
  courier_delivery_confirmation_user_agent
`

export function getCourierTrackingDisplayReference(order) {
  const buyerTracking = order?.courier_buyer_tracking_reference?.trim()
  if (buyerTracking) return buyerTracking

  return order?.courier_tracking_reference?.trim() || ''
}

export function getCourierDeliveryTimelineTrackingDetail(order) {
  const buyerTracking = order?.courier_buyer_tracking_reference?.trim()
  if (buyerTracking) return `Tracking number: ${buyerTracking}`

  if (order?.courier_delivered_at || order?.delivered_at) {
    return 'No tracking number provided'
  }

  return null
}

const orderDetailSelect = `
  ${orderFields},
  ${courierEvidenceDetailFields},
  listing:listings(
    ${orderDetailListingSelect}
  ),
  payment:payments(
    ${paymentFields}
  ),
  offer:offers(
    id,
    status,
    conversation_id,
    amount_pence,
    created_at,
    updated_at
  )
`

function normalizeOrderRelation(value) {
  if (!value) return null
  return Array.isArray(value) ? (value[0] ?? null) : value
}

function enrichOrderDetail(order) {
  if (!order) return order

  const listing = normalizeOrderRelation(order.listing)

  return {
    ...order,
    listing: listing ? enrichListingWithImages(listing) : null,
    payment: normalizeOrderRelation(order.payment),
    offer: normalizeOrderRelation(order.offer),
  }
}

export { enrichOrderDetail }

export async function fetchOrderById(orderId) {
  if (!supabase) {
    return { data: null, error: new Error('Supabase is not configured.') }
  }

  const { data, error } = await supabase
    .from('orders_client')
    .select(orderDetailSelect)
    .eq('id', orderId)
    .order('sort_order', { ascending: true, foreignTable: 'listings.listing_images' })
    .limit(1, { foreignTable: 'listings.listing_images' })
    .single()

  if (error) {
    return { data: null, error }
  }

  return { data: enrichOrderDetail(data), error: null }
}

export function isOrderParticipant(order, userId) {
  if (!order || !userId) return false
  return order.buyer_id === userId || order.seller_id === userId
}

export function getOrderViewerRole(order, userId) {
  if (!order || !userId) return null
  if (order.buyer_id === userId) return 'buyer'
  if (order.seller_id === userId) return 'seller'
  return null
}

export function formatOrderTimestamp(value) {
  if (!value) return ''

  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

export function formatOrderReference(orderId) {
  if (!orderId) return ''
  return orderId.replace(/-/g, '').slice(0, 8).toUpperCase()
}

export function isPayoutReleased(order) {
  return (
    order?.payout_status === PAYOUT_STATUSES.PAID || Boolean(order?.payout_released_at)
  )
}

export function isSellerAwaitingPayout(order) {
  if (!order || isPayoutReleased(order)) return false

  if (
    order.payout_status === PAYOUT_STATUSES.CANCELLED ||
    order.payout_status === PAYOUT_STATUSES.ON_HOLD ||
    order.payout_status === PAYOUT_STATUSES.AWAITING_SELLER_SETUP
  ) {
    return false
  }

  return (
    order.fulfilment_status === ORDER_FULFILMENT_STATUSES.COMPLETED ||
    order.payout_status === PAYOUT_STATUSES.READY ||
    order.payout_status === PAYOUT_STATUSES.PROCESSING ||
    order.payout_status === PAYOUT_STATUSES.FAILED
  )
}

export function getSellerPayoutProcessingMessage(order) {
  if (!isSellerAwaitingPayout(order)) return null

  const reference = formatOrderReference(order.id)

  return (
    `Buyer Protection has ended. Your payout is queued and should be released in the next scheduled payout run at 12:00 or 00:00. ` +
    `If it has not arrived after the next run, contact Equipd support with order reference #${reference}.`
  )
}

export async function fetchOrdersByOfferIds(offerIds) {
  if (!supabase) {
    return { data: null, error: new Error('Supabase is not configured.') }
  }

  const ids = [...new Set((offerIds ?? []).filter(Boolean))]

  if (ids.length === 0) {
    return { data: [], error: null }
  }

  const { data, error } = await supabase.from('orders_client').select(orderFields).in('offer_id', ids)

  return { data: data ?? [], error }
}

export function formatOrderFulfilmentStatus(status) {
  const labels = {
    awaiting_payment: 'Awaiting payment',
    paid: 'Paid — awaiting collection',
    awaiting_collection: 'Awaiting collection',
    awaiting_courier_collection: 'Awaiting courier collection',
    awaiting_seller_delivery: 'Awaiting seller delivery',
    collected: 'Collected',
    in_transit: 'In transit',
    delivered: 'Delivered',
    awaiting_payout: 'Awaiting payout',
    in_progress: 'In progress',
    buyer_confirmed: 'Buyer confirmed',
    completed: 'Completed',
    cancelled: 'Cancelled',
    disputed: 'Disputed',
    refunded: 'Refunded',
  }

  return labels[status] ?? status
}

export function formatPayoutStatus(status) {
  const labels = {
    not_due: 'Payout not due',
    on_hold: 'Payout on hold',
    awaiting_seller_setup: 'Awaiting seller payout setup',
    ready: 'Ready for payout',
    processing: 'Payout processing',
    paid: 'Paid out',
    failed: 'Payout failed',
    cancelled: 'Cancelled',
  }

  return labels[status] ?? status
}

export function getOrderFulfilmentDisplayStatus(order, viewerRole = null) {
  if (!order) return '—'

  if (
    (viewerRole === 'seller' || viewerRole === 'admin') &&
    isOrderCompleted(order) &&
    !isPayoutReleased(order)
  ) {
    return 'Awaiting payout'
  }

  return formatOrderFulfilmentStatus(order.fulfilment_status)
}

export function getOrderPayoutDisplayStatus(order, viewerRole = null) {
  if (!order || viewerRole === 'buyer') return null
  return formatPayoutStatus(order.payout_status)
}

export function getOrderDeliveryMethodLabel(order) {
  const orderType = order?.order_type ?? ORDER_TYPES.COLLECTION

  const labels = {
    [ORDER_TYPES.COLLECTION]: 'Collection',
    [ORDER_TYPES.SELLER_DELIVERY]: 'Seller delivery',
    [ORDER_TYPES.BUYER_COURIER]: 'Buyer-arranged courier',
  }

  return labels[orderType] ?? 'Collection'
}

export function getOrderDeliveryMethodDescription(order) {
  const orderType = order?.order_type ?? ORDER_TYPES.COLLECTION

  if (orderType === ORDER_TYPES.SELLER_DELIVERY) {
    return 'Seller delivery selected. The seller will arrange delivery.'
  }

  if (orderType === ORDER_TYPES.BUYER_COURIER) {
    const trackingReference = getCourierTrackingDisplayReference(order)
    const courierCompany = order?.courier_company?.trim()

    if (trackingReference) {
      const trackingLabel = [courierCompany, trackingReference].filter(Boolean).join(' · ')
      return `Buyer-arranged courier selected. Tracking: ${trackingLabel}.`
    }

    return 'Buyer-arranged courier selected. Tracking information will appear here once dispatched.'
  }

  return 'Collection selected at checkout. Arrange collection through messages.'
}

export function getOfferOrder(offer) {
  if (!offer?.order) return null
  return Array.isArray(offer.order) ? (offer.order[0] ?? null) : offer.order
}

export function isPaidHubOrder(order, payment) {
  if (!order || !isPaymentComplete(payment)) return false

  return HUB_PAID_ACTIVE_FULFILMENT_STATUSES.has(order.fulfilment_status)
}

export function isBuyerHubPurchase(order, payment) {
  return isPaidHubOrder(order, payment)
}

export function isSellerHubSale(order, payment) {
  return isPaidHubOrder(order, payment)
}

export function isBuyerHubPurchaseInProgress(order, payment) {
  if (!isPaidHubOrder(order, payment)) return false
  if (isOrderCompleted(order)) return false
  if (isOrderBuyerConfirmed(order)) return false
  return true
}

export function isSellerHubSaleInProgress(order, payment) {
  if (!isPaidHubOrder(order, payment)) return false
  return !isPayoutReleased(order)
}

export function canBuyerConfirmOrder(order, payment) {
  if (
    order?.order_type === ORDER_TYPES.COLLECTION &&
    (order?.fulfilment_status === ORDER_FULFILMENT_STATUSES.AWAITING_COLLECTION ||
      order?.fulfilment_status === ORDER_FULFILMENT_STATUSES.PAID)
  ) {
    return false
  }

  if (order?.order_type === ORDER_TYPES.SELLER_DELIVERY) {
    return false
  }

  if (
    order?.order_type === ORDER_TYPES.BUYER_COURIER &&
    order?.fulfilment_status === ORDER_FULFILMENT_STATUSES.AWAITING_COURIER_COLLECTION
  ) {
    return false
  }

  if (order?.order_type === ORDER_TYPES.BUYER_COURIER) {
    return false
  }

  return (
    payment?.status === 'paid' &&
    CONFIRMABLE_FULFILMENT_STATUSES.has(order?.fulfilment_status)
  )
}

export function isInPersonHandoverOrder(order) {
  const orderType = order?.order_type ?? ORDER_TYPES.COLLECTION

  return (
    orderType === ORDER_TYPES.COLLECTION || orderType === ORDER_TYPES.SELLER_DELIVERY
  )
}

export function hasBuyerTakenPossession(order) {
  if (!order) return false

  if (order.order_type === ORDER_TYPES.BUYER_COURIER) {
    return order.fulfilment_status === ORDER_FULFILMENT_STATUSES.DELIVERED
  }

  return order.fulfilment_status === ORDER_FULFILMENT_STATUSES.COLLECTED
}

export function isAwaitingInPersonHandover(order, payment) {
  if (!isPaymentComplete(payment) || !isInPersonHandoverOrder(order)) {
    return false
  }

  if (order.order_type === ORDER_TYPES.SELLER_DELIVERY) {
    return order.fulfilment_status === ORDER_FULFILMENT_STATUSES.AWAITING_SELLER_DELIVERY
  }

  return (
    order.fulfilment_status === ORDER_FULFILMENT_STATUSES.AWAITING_COLLECTION ||
    order.fulfilment_status === ORDER_FULFILMENT_STATUSES.PAID
  )
}

export function canShowHandoverQr(order, payment) {
  return isAwaitingInPersonHandover(order, payment)
}

export function canShowBuyerHandoverAction(order, payment) {
  return isAwaitingInPersonHandover(order, payment)
}

export function canShowSellerCollectionQr(order, payment) {
  return canShowHandoverQr(order, payment)
}

export function isOrderCollected(order) {
  return order?.fulfilment_status === ORDER_FULFILMENT_STATUSES.COLLECTED
}

export function getCollectionHubStatusLabel(order, role) {
  const payoutLabel = getOrderPayoutReleaseStatusLabel(order)
  if (payoutLabel) return payoutLabel

  if (!isOrderCollected(order) || !isInPersonHandoverOrder(order)) return null

  const isSellerDelivery = order?.order_type === ORDER_TYPES.SELLER_DELIVERY

  if (role === 'seller') {
    return isSellerDelivery
      ? 'Handover confirmed — payout due after 24 hours unless a dispute is raised.'
      : 'Collected — payout due after 24 hours unless a dispute is raised.'
  }

  if (role === 'buyer') {
    return isSellerDelivery
      ? 'Handover confirmed. Your 24-hour Buyer Protection window has started.'
      : 'Collection confirmed. Your 24-hour Buyer Protection window has started.'
  }

  return null
}

export function isOrderInTransit(order) {
  return order?.fulfilment_status === ORDER_FULFILMENT_STATUSES.IN_TRANSIT
}

export function canSellerSubmitCourierEvidence(order, payment) {
  return (
    payment?.status === 'paid' &&
    order?.order_type === ORDER_TYPES.BUYER_COURIER &&
    order?.fulfilment_status === ORDER_FULFILMENT_STATUSES.AWAITING_COURIER_COLLECTION
  )
}

export function canShowCourierEvidenceSummary(order) {
  return (
    order?.order_type === ORDER_TYPES.BUYER_COURIER &&
    (order?.fulfilment_status === ORDER_FULFILMENT_STATUSES.IN_TRANSIT ||
      order?.fulfilment_status === ORDER_FULFILMENT_STATUSES.DELIVERED ||
      Boolean(order?.courier_evidence_submitted_at))
  )
}

export function canBuyerConfirmCourierDelivery(order, payment) {
  return (
    payment?.status === 'paid' &&
    order?.order_type === ORDER_TYPES.BUYER_COURIER &&
    order?.fulfilment_status === ORDER_FULFILMENT_STATUSES.IN_TRANSIT
  )
}

export function isOrderCourierDelivered(order) {
  return (
    order?.order_type === ORDER_TYPES.BUYER_COURIER &&
    order?.fulfilment_status === ORDER_FULFILMENT_STATUSES.DELIVERED
  )
}

export function getCourierDeliveryHubStatusLabel(order, role) {
  const payoutLabel = getOrderPayoutReleaseStatusLabel(order)
  if (payoutLabel) return payoutLabel

  if (!isOrderCourierDelivered(order)) return null

  if (role === 'buyer') {
    return 'Delivery confirmed. Your 24-hour Buyer Protection window has started.'
  }

  if (role === 'seller') {
    return 'Delivered — payout due after 24 hours unless a dispute is raised.'
  }

  return null
}

export function getOrderPayoutReleaseStatusLabel(order) {
  if (!order) return null

  if (
    order.payout_status === PAYOUT_STATUSES.ON_HOLD ||
    order.fulfilment_status === ORDER_FULFILMENT_STATUSES.DISPUTED
  ) {
    return 'Payout on hold'
  }

  if (order.payout_status === PAYOUT_STATUSES.PAID || order.payout_released_at) {
    return 'Payout released'
  }

  if (isSellerAwaitingPayout(order)) {
    return null
  }

  const inProtectionWindow =
    order.payout_status === PAYOUT_STATUSES.NOT_DUE &&
    (order.fulfilment_status === ORDER_FULFILMENT_STATUSES.COLLECTED ||
      order.fulfilment_status === ORDER_FULFILMENT_STATUSES.DELIVERED)

  if (order.payout_release_at && inProtectionWindow) {
    const releaseAt = new Date(order.payout_release_at).getTime()

    if (!Number.isNaN(releaseAt)) {
      if (releaseAt > Date.now()) {
        return 'Payout due after Buyer Protection window'
      }

      return 'Payout pending release'
    }
  }

  if (
    order.fulfilment_status === ORDER_FULFILMENT_STATUSES.BUYER_CONFIRMED &&
    order.payout_status !== PAYOUT_STATUSES.PAID &&
    order.payout_status !== PAYOUT_STATUSES.CANCELLED
  ) {
    if (
      order.payout_status === PAYOUT_STATUSES.READY ||
      order.payout_status === PAYOUT_STATUSES.PROCESSING ||
      order.payout_status === PAYOUT_STATUSES.FAILED
    ) {
      return 'Payout pending release'
    }
  }

  return null
}

export function getCourierHubStatusLabel(order, role, payment) {
  if (canSellerSubmitCourierEvidence(order, payment)) {
    return role === 'seller'
      ? 'Awaiting courier collection — submit handover evidence before collection.'
      : 'Awaiting courier collection — seller must submit handover evidence.'
  }

  if (isOrderInTransit(order) && order?.order_type === ORDER_TYPES.BUYER_COURIER) {
    return role === 'buyer'
      ? 'Collected by courier — confirm delivery once received.'
      : 'Courier handover evidence submitted — item in transit.'
  }

  const deliveredLabel = getCourierDeliveryHubStatusLabel(order, role)
  if (deliveredLabel) {
    return deliveredLabel
  }

  return null
}

export function isOrderBuyerConfirmed(order) {
  return order?.fulfilment_status === ORDER_FULFILMENT_STATUSES.BUYER_CONFIRMED
}

export function isOrderAwaitingConfirmation(order, payment) {
  return canBuyerConfirmOrder(order, payment)
}

export function canSellerConfirmSellerDelivery() {
  return false
}

export function isOrderSellerDeliveryHandoverConfirmed(order) {
  return (
    order?.order_type === ORDER_TYPES.SELLER_DELIVERY &&
    isOrderCollected(order)
  )
}

export function getSellerDeliveryHubStatusLabel(order, role) {
  const payoutLabel = getOrderPayoutReleaseStatusLabel(order)
  if (payoutLabel) return payoutLabel

  if (isOrderSellerDeliveryHandoverConfirmed(order)) {
    return getCollectionHubStatusLabel(order, role)
  }

  if (order?.fulfilment_status === ORDER_FULFILMENT_STATUSES.AWAITING_SELLER_DELIVERY) {
    return role === 'seller'
      ? 'Paid — show your handover QR code once you have delivered the item'
      : 'Paid — awaiting seller delivery. Inspect the equipment, then scan the seller handover QR code.'
  }

  return null
}

export function isOrderAwaitingFulfilment(order, payment) {
  if (!isPaidHubOrder(order, payment)) return false

  return (
    order.fulfilment_status === ORDER_FULFILMENT_STATUSES.AWAITING_COLLECTION ||
    order.fulfilment_status === ORDER_FULFILMENT_STATUSES.AWAITING_COURIER_COLLECTION ||
    order.fulfilment_status === ORDER_FULFILMENT_STATUSES.AWAITING_SELLER_DELIVERY ||
    order.fulfilment_status === ORDER_FULFILMENT_STATUSES.PAID ||
    order.fulfilment_status === ORDER_FULFILMENT_STATUSES.IN_PROGRESS
  )
}

export function isOrderCompleted(order) {
  return order?.fulfilment_status === ORDER_FULFILMENT_STATUSES.COMPLETED
}

export function getOrderErrorMessage(error) {
  if (!error) return 'Something went wrong. Please try again.'

  const message = error.message ?? ''

  if (message.includes('Admin access required')) {
    return 'You do not have access to this order.'
  }

  if (message.includes('Order not found')) {
    return 'This order could not be found.'
  }

  return message || 'Something went wrong. Please try again.'
}

export async function setOrderFulfilmentMethod(paymentId, orderType) {
  if (!supabase) {
    return { data: null, error: new Error('Supabase is not configured.') }
  }

  const { data, error } = await supabase.rpc('set_order_fulfilment_method', {
    p_payment_id: paymentId,
    p_order_type: orderType,
  })

  return { data, error }
}

export async function confirmSellerDelivery(orderId) {
  if (!supabase) {
    return { data: null, error: new Error('Supabase is not configured.') }
  }

  const { data, error } = await supabase.rpc('confirm_seller_delivery', {
    p_order_id: orderId,
  })

  return { data, error }
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
