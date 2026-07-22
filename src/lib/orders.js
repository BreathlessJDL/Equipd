import { enrichListingWithImages } from './listingImages'
import { getOfferPayment, isPaymentComplete, paymentFields } from './payments'
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
  REFUND_PENDING: 'refund_pending',
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
  ORDER_FULFILMENT_STATUSES.REFUND_PENDING,
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
  quantity,
  listing_unit_price_pence,
  agreed_unit_price_pence,
  item_subtotal_pence,
  inventory_state,
  item_price_pence,
  buyer_protection_fee_pence,
  buyer_total_pence,
  platform_fee_pence,
  seller_service_fee_pence,
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
  inventory_reserved_at,
  inventory_sold_at,
  inventory_released_at,
  inventory_restocked_at,
  inventory_no_restock_at,
  created_at,
  updated_at
`

/** Subset aligned with orders_client migrations — used when extended columns are unavailable. */
const orderHubFields = `
  id,
  offer_id,
  payment_id,
  listing_id,
  buyer_id,
  seller_id,
  amount_pence,
  quantity,
  listing_unit_price_pence,
  agreed_unit_price_pence,
  item_subtotal_pence,
  inventory_state,
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
  inventory_reserved_at,
  inventory_sold_at,
  inventory_released_at,
  inventory_restocked_at,
  inventory_no_restock_at,
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
    quantity,
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

export async function fetchOrdersByOfferIds(offerIds, { fields } = {}) {
  if (!supabase) {
    return { data: null, error: new Error('Supabase is not configured.') }
  }

  const ids = [...new Set((offerIds ?? []).filter(Boolean))]

  if (ids.length === 0) {
    return { data: [], error: null }
  }

  const fieldSets = fields ? [fields] : [orderFields, orderHubFields]
  let lastError = null

  for (const selectFields of fieldSets) {
    const { data, error } = await supabase
      .from('orders_client')
      .select(selectFields)
      .in('offer_id', ids)

    if (!error) {
      return { data: data ?? [], error: null }
    }

    lastError = error
    console.warn('[orders] fetchOrdersByOfferIds failed; retrying with narrower select', {
      message: error.message,
      code: error.code,
    })
  }

  return { data: null, error: lastError }
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

export function getOrderFulfilmentDisplayStatus(order, viewerRole = null, options = {}) {
  if (!order) return '—'

  const { hasDeliveryDetails = false } = options

  if (
    order.order_type === ORDER_TYPES.SELLER_DELIVERY &&
    order.fulfilment_status === ORDER_FULFILMENT_STATUSES.AWAITING_SELLER_DELIVERY
  ) {
    if (!hasDeliveryDetails) {
      if (viewerRole === 'buyer') return 'Add delivery details'
      if (viewerRole === 'seller' || viewerRole === 'admin') {
        return 'Waiting for buyer delivery details'
      }
    }

    return 'Awaiting seller delivery'
  }

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

  const order = Array.isArray(offer.order) ? (offer.order[0] ?? null) : offer.order

  return order?.id ? order : null
}

export function hasOfferLinkedOrder(offer) {
  return Boolean(getOfferOrder(offer)?.id)
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
  if (isOrderHubHistory(order)) return false
  if (isOrderBuyerConfirmed(order)) return false
  return true
}

export function isSellerHubSaleInProgress(order, payment) {
  if (!isPaidHubOrder(order, payment)) return false
  if (isOrderHubHistory(order)) return false
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
  if (!order || !isPaymentComplete(payment) || !isInPersonHandoverOrder(order)) {
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

export function getSellerDeliveryHubStatusLabel(order, role, options = {}) {
  const { hasDeliveryDetails = false } = options
  const payoutLabel = getOrderPayoutReleaseStatusLabel(order)
  if (payoutLabel) return payoutLabel

  if (isOrderSellerDeliveryHandoverConfirmed(order)) {
    return getCollectionHubStatusLabel(order, role)
  }

  if (order?.fulfilment_status === ORDER_FULFILMENT_STATUSES.AWAITING_SELLER_DELIVERY) {
    if (!hasDeliveryDetails) {
      return role === 'seller'
        ? 'Paid — waiting for buyer delivery details'
        : 'Paid — add your delivery details'
    }

    return role === 'seller'
      ? 'Paid — arrange delivery, then show your handover QR code'
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

export function isOrderRefundedForHub(order) {
  return order?.fulfilment_status === ORDER_FULFILMENT_STATUSES.REFUNDED
}

/** Terminal orders shown in Hub completed/history (successful or refunded). */
export function isOrderHubHistory(order) {
  if (!order) return false

  return isOrderCompleted(order) || isOrderRefundedForHub(order)
}

/** Paid checkout or terminal refund — Hub history does not require payout_status = paid. */
export function isHubTransactionSettled(payment, order) {
  return isPaymentComplete(payment) || isOrderRefundedForHub(order)
}

export function isHubCompletedOffer(offer) {
  const order = getOfferOrder(offer)
  if (!order?.id) return false

  const payment = getOfferPayment(offer)
  if (!isHubTransactionSettled(payment, order)) return false

  return isOrderHubHistory(order)
}

export function isHubPurchasesInProgressOffer(offer) {
  return !isHubCompletedOffer(offer)
}

export function applyOrdersToOffers(offers, orders) {
  if (!offers?.length) return offers ?? []

  const ordersByOfferId = new Map(
    (orders ?? [])
      .filter((order) => order?.offer_id && order?.id)
      .map((order) => [order.offer_id, order]),
  )

  return offers.map((offer) => {
    const fetched = ordersByOfferId.get(offer.id)
    if (!fetched) return enrichOfferWithOrder(offer)

    return enrichOfferWithOrder({ ...offer, order: fetched })
  })
}

export function diagnoseHubOfferPipeline(offer) {
  const order = getOfferOrder(offer)
  const payment = getOfferPayment(offer)
  const exclusionReasons = []

  if (!order?.id) {
    exclusionReasons.push('missing_linked_order')
  }

  if (order?.id && !isHubTransactionSettled(payment, order)) {
    exclusionReasons.push('payment_not_settled')
  }

  if (order?.id && isHubTransactionSettled(payment, order) && !isOrderHubHistory(order)) {
    exclusionReasons.push('order_not_terminal_history')
  }

  if (order?.id && isOrderRefundedForHub(order) && !isHubCompletedOffer(offer)) {
    exclusionReasons.push('refunded_order_failed_completed_filter')
  }

  return {
    offerId: offer?.id ?? null,
    orderId: order?.id ?? null,
    fulfilmentStatus: order?.fulfilment_status ?? null,
    paymentStatus: payment?.status ?? null,
    payoutStatus: order?.payout_status ?? null,
    buckets: {
      completed: isHubCompletedOffer(offer),
      purchasesInProgress: isHubPurchasesInProgressOffer(offer),
      buyerInProgressNarrow: Boolean(
        order?.id &&
          isPaidHubOrder(order, payment) &&
          !isOrderHubHistory(order),
      ),
      sellerInProgressNarrow: Boolean(
        order?.id &&
          isPaymentComplete(payment) &&
          !isOrderHubHistory(order) &&
          isPaidHubOrder(order, payment),
      ),
    },
    exclusionReasons,
  }
}

export function logHubOfferPipelineDiagnostics({
  acceptedBuyerOffers = [],
  acceptedSellerOffers = [],
  requestedOfferIds = [],
  orders = [],
  orderFetchError = null,
} = {}) {
  if (!import.meta.env?.DEV) return

  const refundedOrders = (orders ?? []).filter(isOrderRefundedForHub)
  const paidAcceptedWithoutOrder = [...acceptedBuyerOffers, ...acceptedSellerOffers].filter(
    (offer) => isPaymentComplete(getOfferPayment(offer)) && !getOfferOrder(offer)?.id,
  )

  console.group('[hub] offer/order pipeline')
  console.log('accepted buyer offers loaded', acceptedBuyerOffers.length)
  console.log('accepted seller offers loaded', acceptedSellerOffers.length)
  console.log('order IDs requested (offer ids)', requestedOfferIds.length)
  console.log('orders returned', orders.length)
  if (orderFetchError) {
    console.warn('order fetch error', orderFetchError.message ?? orderFetchError)
  }
  if (refundedOrders.length) {
    console.log(
      'refunded orders in batch',
      refundedOrders.map((order) => ({
        orderId: order.id,
        offerId: order.offer_id,
        fulfilmentStatus: order.fulfilment_status,
        payoutStatus: order.payout_status,
      })),
    )
  }

  for (const offer of [...acceptedBuyerOffers, ...acceptedSellerOffers]) {
    const order = getOfferOrder(offer)
    if (!order?.id || !isOrderRefundedForHub(order)) continue

    const diagnosis = diagnoseHubOfferPipeline(offer)
    console.log('refunded offer pipeline', diagnosis)
    if (!diagnosis.buckets.completed) {
      console.warn('refunded offer excluded from completed/history', diagnosis.exclusionReasons)
    }
    if (diagnosis.buckets.buyerInProgressNarrow || diagnosis.buckets.sellerInProgressNarrow) {
      console.warn('refunded offer still in narrow in-progress bucket', diagnosis.buckets)
    }
  }

  for (const offer of paidAcceptedWithoutOrder) {
    console.warn('[hub] paid accepted offer missing linked order after merge', {
      offerId: offer.id,
      paymentStatus: getOfferPayment(offer)?.status,
    })
  }

  console.groupEnd()
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

export function enrichOfferWithOrder(offer) {
  if (!offer) return offer

  return {
    ...offer,
    order: getOfferOrder(offer),
  }
}

export { orderFields, orderHubFields }
