import {
  canSellerSubmitCourierEvidence,
  getOfferOrder,
  hasOfferLinkedOrder,
} from './orders'
import { isOrderDisputed } from './orderDisputes'

export const HUB_ATTENTION_DISPLAY = {
  'offers-received': {
    actionRequired: true,
    compactTitle: 'Offers to respond to',
    description: (count) =>
      `${count} offer${count === 1 ? '' : 's'} need accepting, declining, or countering.`,
    actionLabel: 'Review offers',
  },
  'buyer-pay': {
    actionRequired: true,
    compactTitle: 'Payment needed',
    description: (count) =>
      `${count} accepted offer${count === 1 ? '' : 's'} waiting for your payment.`,
    actionLabel: 'Complete payment',
  },
  'seller-awaiting-pay': {
    actionRequired: false,
    compactTitle: 'Waiting for payment',
    description: (count) =>
      `${count} buyer${count === 1 ? '' : 's'} still need to complete checkout.`,
    actionLabel: 'View sales',
  },
  'buyer-collection': {
    actionRequired: true,
    compactTitle: 'Ready to collect',
    description: (count) =>
      `${count} order${count === 1 ? '' : 's'} ready for collection or delivery.`,
    actionLabel: 'View orders',
  },
  'courier-evidence': {
    actionRequired: true,
    compactTitle: 'Courier evidence',
    description: () => 'Upload handover evidence before courier collection.',
    actionLabel: 'Submit evidence',
  },
  disputes: {
    actionRequired: true,
    compactTitle: 'Open disputes',
    description: (count) =>
      `${count} open dispute${count === 1 ? '' : 's'} need your attention.`,
    actionLabel: 'View disputes',
    urgent: true,
  },
  'counter-offers-received': {
    actionRequired: true,
    compactTitle: 'Counter offers',
    description: (count) =>
      `${count} counter offer${count === 1 ? '' : 's'} need your response.`,
    actionLabel: 'Review counter offers',
  },
  'payout-setup': {
    actionRequired: true,
    compactTitle: 'Set up payouts',
    description: () => 'Connect your payout account to receive funds from reserved listings.',
    actionLabel: 'Set up payouts',
    urgent: true,
  },
  'pending-reviews': {
    actionRequired: true,
    compactTitle: 'Leave a review',
    description: () => 'Leave a review for completed orders.',
    actionLabel: 'Review orders',
  },
}

export function getHubAttentionTone(display = {}) {
  if (display.urgent) return 'urgent'
  if (display.actionRequired) return 'action'
  return 'info'
}

export function buildHubNeedsAttention({
  pendingOffersFromBuyers,
  pendingBuyerCounterOffers = [],
  acceptedUnpaidOffers,
  sellerAcceptedUnpaidOffers,
  buyerAwaitingFulfilmentOrders,
  activeSellerSales,
  showPayoutSetupBanner,
  pendingReviewCount = 0,
}) {
  const items = []

  if (pendingOffersFromBuyers.length > 0) {
    items.push({
      id: 'offers-received',
      label: 'Offers awaiting your response',
      count: pendingOffersFromBuyers.length,
      section: 'selling',
      tab: 'offers',
    })
  }

  if (pendingBuyerCounterOffers.length > 0) {
    items.push({
      id: 'counter-offers-received',
      label: 'Counter offers awaiting your response',
      count: pendingBuyerCounterOffers.length,
      section: 'buying',
      tab: 'offers',
    })
  }

  if (acceptedUnpaidOffers.length > 0) {
    items.push({
      id: 'buyer-pay',
      label: 'Accepted offers awaiting your payment',
      count: acceptedUnpaidOffers.length,
      section: 'offers',
    })
  }

  if (sellerAcceptedUnpaidOffers.length > 0) {
    items.push({
      id: 'seller-awaiting-pay',
      label: 'Accepted sales awaiting buyer payment',
      count: sellerAcceptedUnpaidOffers.length,
      section: 'selling',
      tab: 'awaiting_payment',
    })
  }

  if (buyerAwaitingFulfilmentOrders.length > 0) {
    items.push({
      id: 'buyer-collection',
      label: 'Orders awaiting collection',
      count: buyerAwaitingFulfilmentOrders.length,
      section: 'buying',
      tab: 'in_progress',
    })
  }

  const courierEvidenceCount = activeSellerSales.filter((offer) => {
    if (!hasOfferLinkedOrder(offer)) return false
    return canSellerSubmitCourierEvidence(getOfferOrder(offer), offer.payment)
  }).length

  if (courierEvidenceCount > 0) {
    items.push({
      id: 'courier-evidence',
      label: 'Courier evidence required',
      count: courierEvidenceCount,
      section: 'selling',
      tab: 'active',
    })
  }

  const disputeCount = activeSellerSales.filter((offer) => {
    if (!hasOfferLinkedOrder(offer)) return false
    return isOrderDisputed(getOfferOrder(offer))
  }).length

  if (disputeCount > 0) {
    items.push({
      id: 'disputes',
      label: 'Open disputes',
      count: disputeCount,
      section: 'selling',
      tab: 'active',
    })
  }

  if (showPayoutSetupBanner) {
    items.push({
      id: 'payout-setup',
      label: 'Payout setup required',
      count: 1,
      section: 'settings',
    })
  }

  if (pendingReviewCount > 0) {
    items.push({
      id: 'pending-reviews',
      label: 'Orders ready for review',
      count: pendingReviewCount,
      section: 'reviews',
      tab: 'pending',
    })
  }

  return items
}
