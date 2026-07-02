import {
  formatOfferStatus,
  formatOfferTimestamp,
  isOfferCancelled,
} from './offers'
import { formatListingStatus, getConditionLabel } from './listings'
import { formatListingLocationDetail } from './listingLocation'
import { isPaymentComplete, isPaymentExpired } from './payments'
import { getOrderStatusBadge } from './orderStatusBadge'
import {
  getCollectionHubStatusLabel,
  getCourierDeliveryHubStatusLabel,
  getCourierHubStatusLabel,
  getOfferOrder,
  getSellerDeliveryHubStatusLabel,
  getSellerPayoutProcessingMessage,
  hasOfferLinkedOrder,
  isOrderCompleted,
  isOrderRefundedForHub,
  isPayoutReleased,
  isSellerAwaitingPayout,
  ORDER_FULFILMENT_STATUSES,
  ORDER_TYPES,
} from './orders'

const HUB_FULFILMENT_LABELS = {
  [ORDER_TYPES.COLLECTION]: 'Collection order',
  [ORDER_TYPES.BUYER_COURIER]: 'Buyer-arranged courier',
  [ORDER_TYPES.SELLER_DELIVERY]: 'Seller delivery',
}

export function getHubFulfilmentLabel(order) {
  if (!order?.order_type) return null

  return HUB_FULFILMENT_LABELS[order.order_type] ?? 'Order'
}

export function getHubItemStatusBadge(
  offer,
  { orderStatusRole = null, showPaymentStatus = false, disputes = [], caseUpdates = [] } = {},
) {
  const order = getOfferOrder(offer)
  const payment = offer.payment

  if (isOfferCancelled(offer)) {
    return { variant: 'cancelled', label: 'Cancelled' }
  }

  if (order && isOrderRefundedForHub(order)) {
    return { variant: 'refunded', label: 'Refunded' }
  }

  if (
    orderStatusRole &&
    payment &&
    isPaymentComplete(payment) &&
    !hasOfferLinkedOrder(offer)
  ) {
    return { variant: 'buyer_protection', label: 'In progress' }
  }

  if (order && (orderStatusRole || (showPaymentStatus && payment))) {
    const badge = getOrderStatusBadge({
      order,
      payment,
      offer,
      supportRequests: null,
      disputes,
      caseUpdates,
      viewerRole: orderStatusRole ?? 'buyer',
    })

    if (badge) {
      return badge
    }

    if (payment && isPaymentComplete(payment)) {
      return { variant: 'buyer_protection', label: 'In progress' }
    }
  }

  if (showPaymentStatus && payment && !isPaymentComplete(payment)) {
    if (isPaymentExpired(payment)) {
      return { variant: 'cancelled', label: 'Payment expired' }
    }

    return { variant: 'awaiting_payment', label: 'Awaiting Payment' }
  }

  if (offer.status === 'pending') {
    return { variant: 'pending', label: 'Pending' }
  }

  if (offer.status === 'accepted') {
    return { variant: 'accepted', label: 'Accepted' }
  }

  if (offer.status === 'rejected') {
    return { variant: 'cancelled', label: 'Declined' }
  }

  return {
    variant: 'pending',
    label: formatOfferStatus(offer.status) || 'Pending',
  }
}

export function getHubOfferMetadataItems({
  partyLabel,
  partyName,
  order = null,
  isOrderContext = false,
  datePrefix = 'Submitted',
  date,
}) {
  const items = []

  if (partyLabel && partyName) {
    items.push({
      type: 'party',
      text: `${partyLabel}: ${partyName}`,
    })
  }

  if (isOrderContext && order) {
    const fulfilment = getHubFulfilmentLabel(order)
    if (fulfilment) {
      items.push({
        type: 'fulfilment',
        text: fulfilment,
      })
    }
  }

  if (date) {
    items.push({
      type: 'date',
      text: `${datePrefix} ${formatOfferTimestamp(date)}`,
    })
  }

  return items
}

export function formatHubOfferMetadata(args) {
  return getHubOfferMetadataItems(args)
    .map((item) => item.text)
    .join('\n')
}

/** @deprecated Use formatHubOfferMetadata */
export function formatHubItemMetadata(args) {
  return formatHubOfferMetadata(args)
}

export function getHubOrderStageHint(offer, orderStatusRole) {
  const order = getOfferOrder(offer)
  const payment = offer.payment

  if (!orderStatusRole || !order) return null

  if (isOrderRefundedForHub(order)) {
    return orderStatusRole === 'buyer' ? 'Refund completed' : 'Case closed'
  }

  if (orderStatusRole === 'seller' && isSellerAwaitingPayout(order)) {
    return getSellerPayoutProcessingMessage(order)
  }

  if (orderStatusRole === 'buyer' && isOrderCompleted(order)) {
    return 'Purchase completed'
  }

  if (orderStatusRole === 'seller' && isOrderCompleted(order) && isPayoutReleased(order)) {
    return 'Sale completed'
  }

  return (
    getCollectionHubStatusLabel(order, orderStatusRole) ||
    getSellerDeliveryHubStatusLabel(order, orderStatusRole) ||
    getCourierHubStatusLabel(order, orderStatusRole, payment) ||
    getCourierDeliveryHubStatusLabel(order, orderStatusRole) ||
    null
  )
}

export function getHubListingStatusBadge(listing) {
  const variants = {
    draft: 'pending',
    active: 'accepted',
    reserved: 'awaiting_collection',
    in_progress: 'in_transit',
    sold: 'completed',
  }

  return {
    variant: variants[listing?.status] ?? 'pending',
    label: formatListingStatus(listing?.status),
  }
}

export function formatHubListingMetadata(listing) {
  const lines = []
  const condition = getConditionLabel(listing?.condition)

  if (condition) {
    lines.push(condition)
  }

  const location = formatListingLocationDetail(listing)
  if (location) {
    lines.push(location)
  }

  if (listing?.updated_at) {
    lines.push(`Updated ${formatOfferTimestamp(listing.updated_at)}`)
  }

  return lines.join('\n')
}

export function getHubPaymentHint(payment) {
  if (!payment) return null

  const parts = []

  if (payment.status === 'awaiting_seller_setup') {
    parts.push('Waiting for seller payout setup')
  } else if (payment.status === 'pending') {
    parts.push('Payment due')
  } else if (payment.status === 'paid') {
    parts.push('Paid')
  } else if (payment.status === 'expired') {
    parts.push('Payment expired')
  } else if (payment.status === 'cancelled') {
    parts.push('Payment cancelled')
  } else if (payment.status === 'refunded') {
    parts.push('Refunded')
  }

  if (['awaiting_seller_setup', 'pending'].includes(payment.status) && payment.expires_at) {
    if (!isPaymentExpired(payment)) {
      parts.push(`Pay by ${formatOfferTimestamp(payment.expires_at)}`)
    }
  }

  if (isPaymentExpired(payment)) {
    parts.push('Payment window expired')
  }

  return parts.join(' · ')
}
