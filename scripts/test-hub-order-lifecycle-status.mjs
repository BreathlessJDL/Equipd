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
  const {
    ORDER_FULFILMENT_STATUSES,
    ORDER_TYPES,
    canShowHandoverQr,
  } = await server.ssrLoadModule('/src/lib/orders.js')
  const { PAYMENT_STATUSES } = await server.ssrLoadModule('/src/lib/payments.js')

  const paidOffer = {
    status: 'accepted',
    payment: { status: PAYMENT_STATUSES.PAID },
    order: {
      order_type: ORDER_TYPES.COLLECTION,
      fulfilment_status: ORDER_FULFILMENT_STATUSES.COLLECTED,
      collection_confirmed_at: new Date().toISOString(),
      payout_release_at: new Date(Date.now() + 86400000).toISOString(),
      payout_released_at: null,
      payout_status: 'not_due',
    },
  }

  const badge = getHubItemStatusBadge(paidOffer, { orderStatusRole: 'buyer' })
  assert(badge.label !== 'Accepted', `Paid order must not show Accepted, got ${badge.label}`)
  assert(badge.variant === 'buyer_protection', `Expected buyer_protection variant, got ${badge.variant}`)
  console.log(`PASS: paid order shows "${badge.label}" instead of Accepted`)

  const awaitingPayment = getHubItemStatusBadge(
    {
      status: 'accepted',
      payment: { status: PAYMENT_STATUSES.PENDING },
      order: { fulfilment_status: ORDER_FULFILMENT_STATUSES.AWAITING_PAYMENT },
    },
    { showPaymentStatus: true },
  )
  assert(awaitingPayment.label === 'Awaiting Payment', `Expected Awaiting Payment, got ${awaitingPayment.label}`)
  console.log('PASS: awaiting payment badge')

  const disputeBadge = getStatusBadgeFromOrderLifecycleStage({
    key: 'disputed',
    label: 'Dispute under review',
  })
  assert(disputeBadge.label === 'Dispute Open', 'Dispute label')
  assert(disputeBadge.variant === 'disputed', 'Dispute variant')
  console.log('PASS: dispute badge styling')

  assert(
    canShowHandoverQr(null, { status: PAYMENT_STATUSES.PAID }) === false,
    'canShowHandoverQr must not throw when order is null',
  )
  console.log('PASS: null order handover check')

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
    `Missing order should fall back safely, got ${missingOrderBadge.label}`,
  )
  console.log('PASS: missing linked order badge fallback')

  console.log('\nAll hub lifecycle status checks passed.')
} catch (error) {
  console.error('FAIL:', error.message)
  process.exitCode = 1
} finally {
  await server.close()
}
