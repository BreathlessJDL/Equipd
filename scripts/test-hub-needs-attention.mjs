#!/usr/bin/env node
/**
 * Hub "Needs your attention" count and display tests.
 *
 * Usage:
 *   node scripts/test-hub-needs-attention.mjs
 */

import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function logPass(message) {
  console.log(`PASS: ${message}`)
}

const server = await createServer({ root: ROOT, logLevel: 'error' })

try {
  const { ORDER_FULFILMENT_STATUSES } = await server.ssrLoadModule('/src/lib/orders.js')
  const {
    PAYMENT_STATUSES,
    isAcceptedOfferAwaitingPayment,
    isPaymentOutstanding,
  } = await server.ssrLoadModule('/src/lib/payments.js')
  const { canUserLeaveReview } = await server.ssrLoadModule('/src/lib/reviews.js')
  const { HUB_ATTENTION_DISPLAY, buildHubNeedsAttention, getHubAttentionTone } =
    await server.ssrLoadModule('/src/lib/hubNeedsAttention.js')

  const completedOrder = {
    id: 'order-1',
    fulfilment_status: ORDER_FULFILMENT_STATUSES.COMPLETED,
  }
  const refundedOrder = {
    id: 'order-2',
    fulfilment_status: ORDER_FULFILMENT_STATUSES.REFUNDED,
  }
  const inProgressOrder = {
    id: 'order-3',
    fulfilment_status: ORDER_FULFILMENT_STATUSES.AWAITING_COLLECTION,
  }

  assert(canUserLeaveReview(completedOrder, [], 'user-1'), 'Completed unreviewed order is eligible')
  assert(
    !canUserLeaveReview(
      completedOrder,
      [{ order_id: 'order-1', reviewer_user_id: 'user-1' }],
      'user-1',
    ),
    'Already-reviewed completed order is excluded',
  )
  assert(!canUserLeaveReview(refundedOrder, [], 'user-1'), 'Refunded orders are not reviewable')
  assert(!canUserLeaveReview(inProgressOrder, [], 'user-1'), 'In-progress orders are not reviewable')
  assert(!canUserLeaveReview(completedOrder, [], null), 'Missing user cannot leave a review')
  logPass('Orders ready for review only include eligible unreviewed completed orders')

  assert(isPaymentOutstanding({ status: PAYMENT_STATUSES.PENDING }), 'Pending payment is outstanding')
  assert(
    isPaymentOutstanding({ status: PAYMENT_STATUSES.AWAITING_SELLER_SETUP }),
    'Awaiting setup is outstanding',
  )
  assert(!isPaymentOutstanding({ status: PAYMENT_STATUSES.PAID }), 'Paid payment is not outstanding')
  assert(!isPaymentOutstanding({ status: PAYMENT_STATUSES.EXPIRED }), 'Expired payment is not outstanding')
  assert(
    !isPaymentOutstanding({ status: PAYMENT_STATUSES.CANCELLED }),
    'Cancelled payment is not outstanding',
  )
  assert(!isPaymentOutstanding({ status: PAYMENT_STATUSES.REFUNDED }), 'Refunded payment is not outstanding')
  assert(
    isAcceptedOfferAwaitingPayment({ payment: { status: PAYMENT_STATUSES.PENDING } }),
    'Pending accepted sale is unpaid',
  )
  assert(
    !isAcceptedOfferAwaitingPayment({ payment: { status: PAYMENT_STATUSES.EXPIRED } }),
    'Expired accepted sale is not awaiting payment',
  )
  assert(
    !isAcceptedOfferAwaitingPayment({ payment: { status: PAYMENT_STATUSES.CANCELLED } }),
    'Cancelled accepted sale is not awaiting payment',
  )
  logPass('Accepted unpaid sales exclude paid, expired, cancelled and refunded payments')

  const attention = buildHubNeedsAttention({
    pendingOffersFromBuyers: [{ id: 'o1' }],
    pendingBuyerCounterOffers: [{ id: 'c1' }],
    acceptedUnpaidOffers: [{ id: 'pay-1' }, { id: 'pay-2' }],
    sellerAcceptedUnpaidOffers: [{ id: 'sale-1' }],
    buyerAwaitingFulfilmentOrders: [{ id: 'col-1' }],
    activeSellerSales: [],
    showPayoutSetupBanner: true,
    pendingReviewCount: 4,
  })

  const ids = attention.map((item) => item.id)
  assert(new Set(ids).size === ids.length, 'Attention categories are not duplicated')
  assert(attention.find((item) => item.id === 'pending-reviews')?.count === 4, 'Review count is the eligible total')
  assert(attention.find((item) => item.id === 'buyer-pay')?.count === 2, 'Buyer unpaid count uses outstanding offers')
  assert(
    attention.find((item) => item.id === 'seller-awaiting-pay')?.count === 1,
    'Seller unpaid count uses outstanding sales',
  )
  assert(attention.find((item) => item.id === 'buyer-pay')?.section === 'offers', 'Buyer pay keeps offers destination')
  assert(
    attention.find((item) => item.id === 'seller-awaiting-pay')?.section === 'selling',
    'Seller unpaid keeps selling destination',
  )
  assert(attention.find((item) => item.id === 'pending-reviews')?.tab === 'pending', 'Reviews keep pending tab')
  logPass('Attention items keep destinations and unique category counts')

  assert(getHubAttentionTone(HUB_ATTENTION_DISPLAY['buyer-pay']) === 'action', 'Buyer payment is an action')
  assert(
    getHubAttentionTone(HUB_ATTENTION_DISPLAY['seller-awaiting-pay']) === 'info',
    'Waiting for buyer payment is informational',
  )
  assert(getHubAttentionTone(HUB_ATTENTION_DISPLAY.disputes) === 'urgent', 'Disputes stay urgent')
  assert(
    HUB_ATTENTION_DISPLAY['seller-awaiting-pay'].actionRequired === false,
    'Seller awaiting pay is not an action the seller can take',
  )

  for (const item of attention) {
    const display = HUB_ATTENTION_DISPLAY[item.id]
    assert(display, `Display copy exists for ${item.id}`)
    assert(display.compactTitle, `Compact title exists for ${item.id}`)
  }
  logPass('Action vs informational tones and compact titles are defined')

  const empty = buildHubNeedsAttention({
    pendingOffersFromBuyers: [],
    pendingBuyerCounterOffers: [],
    acceptedUnpaidOffers: [],
    sellerAcceptedUnpaidOffers: [],
    buyerAwaitingFulfilmentOrders: [],
    activeSellerSales: [],
    showPayoutSetupBanner: false,
    pendingReviewCount: 0,
  })
  assert(empty.length === 0, 'No attention items when nothing is actionable')
  logPass('Empty attention list stays empty')

  const large = buildHubNeedsAttention({
    pendingOffersFromBuyers: Array.from({ length: 12 }, (_, index) => ({ id: `offer-${index}` })),
    pendingBuyerCounterOffers: [],
    acceptedUnpaidOffers: [],
    sellerAcceptedUnpaidOffers: [],
    buyerAwaitingFulfilmentOrders: [],
    activeSellerSales: [],
    showPayoutSetupBanner: false,
    pendingReviewCount: 0,
  })
  assert(large[0].count === 12, 'Large counts are preserved')
  logPass('Large attention counts are preserved')

  const mobileSource = readFileSync(path.join(ROOT, 'src/components/hub/HubMobileSummary.jsx'), 'utf8')
  assert(mobileSource.includes('hub-mobile-attention__list'), 'Mobile attention uses a unified panel')
  assert(mobileSource.includes('Your next steps on Equipd'), 'Mobile attention includes the section subtitle')
  assert(!mobileSource.includes('hub-attention__row--mobile-summary'), 'Separate mobile summary cards are removed')

  const css = readFileSync(path.join(ROOT, 'src/components/hub/HubMobileSummary.css'), 'utf8')
  assert(css.includes('min-height: 2.75rem'), 'Attention rows meet the 44px touch target')
  assert(css.includes('hub-mobile-attention__row--action'), 'Action rows have distinct styling')
  assert(css.includes('hub-mobile-attention__row--info'), 'Informational rows have distinct styling')
  logPass('Mobile attention markup is a compact unified panel')

  console.log('\nAll hub needs-attention checks passed.')
} finally {
  await server.close()
}
