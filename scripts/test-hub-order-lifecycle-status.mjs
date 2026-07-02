#!/usr/bin/env node
/**
 * Hub order lifecycle badge tests.
 * Usage: node scripts/test-hub-order-lifecycle-status.mjs
 */

import { createServer } from 'vite'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

const server = await createServer({ root: ROOT, logLevel: 'error' })

try {
  const { getHubItemStatusBadge } = await server.ssrLoadModule('/src/lib/hubItemStatus.js')
  const { getStatusBadgeFromOrderLifecycleStage } = await server.ssrLoadModule(
    '/src/lib/orderLifecycleStatus.js',
  )
  const { buildHubNavActions } = await server.ssrLoadModule('/src/components/hub/HubItemActions.jsx')
  const {
    ORDER_FULFILMENT_STATUSES,
    ORDER_TYPES,
    canShowHandoverQr,
    canSellerSubmitCourierEvidence,
    getOfferOrder,
    hasOfferLinkedOrder,
    isOrderHubHistory,
    isOrderRefundedForHub,
  } = await server.ssrLoadModule('/src/lib/orders.js')
  const { PAYMENT_STATUSES, isPaymentComplete } = await server.ssrLoadModule('/src/lib/payments.js')
  const { isOrderDisputed } = await server.ssrLoadModule('/src/lib/orderDisputes.js')

  const paidCollectionOrder = {
    id: 'order-paid-collection',
    order_type: ORDER_TYPES.COLLECTION,
    fulfilment_status: ORDER_FULFILMENT_STATUSES.COLLECTED,
    collection_confirmed_at: new Date().toISOString(),
    payout_release_at: new Date(Date.now() + 86400000).toISOString(),
    payout_released_at: null,
    payout_status: 'not_due',
  }

  const paidOffer = {
    status: 'accepted',
    payment: { status: PAYMENT_STATUSES.PAID },
    order: paidCollectionOrder,
  }

  assert(hasOfferLinkedOrder(paidOffer), 'Valid linked order must be detected')
  assert(getOfferOrder(paidOffer)?.id === 'order-paid-collection', 'getOfferOrder must return linked order')

  const badge = getHubItemStatusBadge(paidOffer, { orderStatusRole: 'buyer' })
  assert(badge.label !== 'Accepted', `Paid order must not show Accepted, got ${badge.label}`)
  assert(badge.label !== 'In progress', `Paid order must not use missing-order fallback, got ${badge.label}`)
  assert(badge.variant === 'buyer_protection', `Expected buyer_protection variant, got ${badge.variant}`)
  console.log(`PASS: paid offer with valid order shows "${badge.label}"`)

  const awaitingPayment = getHubItemStatusBadge(
    {
      status: 'accepted',
      payment: { status: PAYMENT_STATUSES.PENDING },
      order: {
        id: 'order-awaiting-payment',
        fulfilment_status: ORDER_FULFILMENT_STATUSES.AWAITING_PAYMENT,
      },
    },
    { showPaymentStatus: true },
  )
  assert(awaitingPayment.label === 'Awaiting Payment', `Expected Awaiting Payment, got ${awaitingPayment.label}`)
  console.log('PASS: awaiting payment badge')

  const missingOrderBadge = getHubItemStatusBadge(
    {
      status: 'accepted',
      payment: { status: PAYMENT_STATUSES.PAID },
      order: null,
    },
    { orderStatusRole: 'buyer' },
  )
  assert(
    missingOrderBadge.label === 'In progress',
    `Missing linked order should fall back safely, got ${missingOrderBadge.label}`,
  )
  console.log('PASS: paid offer with null order uses safe fallback')

  const missingIdOrderBadge = getHubItemStatusBadge(
    {
      status: 'accepted',
      payment: { status: PAYMENT_STATUSES.PAID },
      order: { fulfilment_status: ORDER_FULFILMENT_STATUSES.COLLECTED },
    },
    { orderStatusRole: 'buyer' },
  )
  assert(
    missingIdOrderBadge.label === 'In progress',
    `Order without id must use safe fallback, got ${missingIdOrderBadge.label}`,
  )
  console.log('PASS: paid offer without order id uses safe fallback')

  const disputedOffer = {
    status: 'accepted',
    payment: { status: PAYMENT_STATUSES.PAID },
    order: {
      id: 'order-disputed',
      order_type: ORDER_TYPES.COLLECTION,
      fulfilment_status: ORDER_FULFILMENT_STATUSES.DISPUTED,
    },
  }
  assert(isOrderDisputed(disputedOffer.order), 'Fixture dispute order should be disputed')
  const disputeBadge = getHubItemStatusBadge(disputedOffer, {
    orderStatusRole: 'buyer',
    disputes: [{ id: 'dispute-1', status: 'under_review', order_id: 'order-disputed' }],
  })
  assert(disputeBadge.label === 'Dispute Open', `Expected Dispute Open, got ${disputeBadge.label}`)
  assert(disputeBadge.variant === 'disputed', `Expected disputed variant, got ${disputeBadge.variant}`)
  console.log('PASS: active dispute visible in Hub badge')

  const handoverOffer = {
    status: 'accepted',
    payment: { status: PAYMENT_STATUSES.PAID },
    order: {
      id: 'order-handover',
      order_type: ORDER_TYPES.COLLECTION,
      fulfilment_status: ORDER_FULFILMENT_STATUSES.AWAITING_COLLECTION,
    },
  }
  assert(
    canShowHandoverQr(handoverOffer.order, handoverOffer.payment),
    'Seller should see handover QR for awaiting collection',
  )
  console.log('PASS: awaiting QR handover')

  const courierOffer = {
    status: 'accepted',
    payment: { status: PAYMENT_STATUSES.PAID },
    order: {
      id: 'order-courier',
      order_type: ORDER_TYPES.BUYER_COURIER,
      fulfilment_status: ORDER_FULFILMENT_STATUSES.AWAITING_COURIER_COLLECTION,
    },
  }
  assert(
    canSellerSubmitCourierEvidence(courierOffer.order, courierOffer.payment),
    'Seller should be able to submit courier evidence',
  )
  console.log('PASS: awaiting courier upload')

  const completedBadge = getHubItemStatusBadge(
    {
      status: 'accepted',
      payment: { status: PAYMENT_STATUSES.PAID },
      order: {
        id: 'order-completed',
        order_type: ORDER_TYPES.COLLECTION,
        fulfilment_status: ORDER_FULFILMENT_STATUSES.COMPLETED,
        payout_status: 'paid',
        payout_released_at: new Date().toISOString(),
      },
    },
    { orderStatusRole: 'buyer' },
  )
  assert(completedBadge.label === 'Completed', `Expected Completed, got ${completedBadge.label}`)
  console.log('PASS: completed order badge')

  const refundedOffer = {
    status: 'accepted',
    payment: { status: PAYMENT_STATUSES.PAID },
    order: {
      id: 'order-refunded',
      order_type: ORDER_TYPES.COLLECTION,
      fulfilment_status: ORDER_FULFILMENT_STATUSES.REFUNDED,
      payout_status: 'cancelled',
      protection_status: 'refunded',
    },
  }
  assert(isOrderRefundedForHub(refundedOffer.order), 'Refunded order helper')
  assert(isOrderHubHistory(refundedOffer.order), 'Refunded order is hub history')
  const refundedBadge = getHubItemStatusBadge(refundedOffer, { orderStatusRole: 'buyer' })
  assert(refundedBadge.label === 'Refunded', `Expected Refunded badge, got ${refundedBadge.label}`)
  const sellerRefundedBadge = getHubItemStatusBadge(refundedOffer, { orderStatusRole: 'seller' })
  assert(sellerRefundedBadge.label === 'Refunded', `Expected seller Refunded badge, got ${sellerRefundedBadge.label}`)
  console.log('PASS: refunded order badge')

  const inProgressOffers = [
    refundedOffer,
    {
      status: 'accepted',
      payment: { status: PAYMENT_STATUSES.PAID },
      order: {
        id: 'order-active',
        fulfilment_status: ORDER_FULFILMENT_STATUSES.COLLECTED,
      },
    },
  ]
  const completedOffers = inProgressOffers.filter(
    (offer) => isPaymentComplete(offer.payment) && isOrderHubHistory(getOfferOrder(offer)),
  )
  const activeOffers = inProgressOffers.filter((offer) => {
    const order = getOfferOrder(offer)
    const payment = offer.payment
    return !(isPaymentComplete(payment) && isOrderHubHistory(order))
  })
  assert(completedOffers.length === 1, 'Refunded offer should appear in completed hub filter')
  assert(activeOffers.length === 1, 'Only active offer should remain in in-progress hub filter')
  assert(
    completedOffers[0].order.id === 'order-refunded',
    'Completed hub filter should include refunded order',
  )
  console.log('PASS: refunded order appears in completed hub filters')

  assert(
    canShowHandoverQr(null, { status: PAYMENT_STATUSES.PAID }) === false,
    'canShowHandoverQr must not throw when order is null',
  )
  console.log('PASS: null order handover check')

  const disputeStageBadge = getStatusBadgeFromOrderLifecycleStage({
    key: 'disputed',
    label: 'Dispute under review',
  })
  assert(disputeStageBadge.label === 'Dispute Open', 'Dispute label')
  assert(disputeStageBadge.variant === 'disputed', 'Dispute variant')
  console.log('PASS: dispute badge styling')

  const navWithOrder = buildHubNavActions({
    order: paidCollectionOrder,
    conversationUrl: '/messages/abc',
    listingUrl: '/listings/foo',
    includeViewOrder: true,
  })
  assert(navWithOrder, 'View order nav should render when order exists')
  console.log('PASS: View order button visible when order exists')

  const navWithoutOrder = buildHubNavActions({
    order: null,
    conversationUrl: '/messages/abc',
    listingUrl: '/listings/foo',
    includeViewOrder: true,
  })
  assert(navWithoutOrder, 'Listing/message actions should still render without order')
  const navText = JSON.stringify(navWithoutOrder)
  assert(!navText.includes('/orders/'), 'View order link must be hidden when order is missing')
  console.log('PASS: View order hidden when order missing')

  console.log('\nAll hub lifecycle status checks passed.')
} catch (error) {
  console.error('FAIL:', error.message)
  process.exitCode = 1
} finally {
  await server.close()
}
