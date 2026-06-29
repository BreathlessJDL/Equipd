#!/usr/bin/env node
/**
 * Timeline regression tests for Case Management / Buyer Protection returns.
 *
 * Usage:
 *   node scripts/test-order-timeline-case-management.mjs
 */

import { buildOrderTimeline, buildDisputeTimelineSteps } from '../src/lib/orderTimeline.js'
import { DISPUTE_STATUSES } from '../src/lib/orderDisputes.js'
import { ORDER_FULFILMENT_STATUSES, ORDER_TYPES } from '../src/lib/orders.js'
import { PAYMENT_STATUSES } from '../src/lib/payments.js'
const DISPUTE_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function logPass(message) {
  console.log(`PASS: ${message}`)
}

function baseOrder(overrides = {}) {
  return {
    id: 'order-1',
    order_type: ORDER_TYPES.COLLECTION,
    fulfilment_status: ORDER_FULFILMENT_STATUSES.DISPUTED,
    protection_status: 'active',
    collection_confirmed_at: '2026-01-01T10:00:00Z',
    collected_at: '2026-01-01T10:00:00Z',
    payout_release_at: '2026-02-01T10:00:00Z',
    created_at: '2026-01-01T09:00:00Z',
    ...overrides,
  }
}

function basePayment() {
  return { status: PAYMENT_STATUSES.PAID, paid_at: '2026-01-01T09:00:00Z' }
}

function buildDispute(status, overrides = {}) {
  return {
    id: DISPUTE_ID,
    status,
    created_at: '2026-01-10T10:00:00Z',
    updated_at: '2026-01-15T10:00:00Z',
    ...overrides,
  }
}

function getDisputeEvents(timeline) {
  return timeline.events.filter((event) => event.key.startsWith('dispute_'))
}

function getCurrentDisputeEvent(timeline) {
  return getDisputeEvents(timeline).find((event) => event.state === 'current') ?? null
}

function assertDisputeStepOrder(timeline, expectedKeys) {
  const keys = getDisputeEvents(timeline).map((event) => event.key)
  const filtered = keys.filter((key) => expectedKeys.includes(key))

  assert(
    filtered.join('|') === expectedKeys.join('|'),
    `Expected dispute keys ${expectedKeys.join(' → ')}, got ${filtered.join(' → ')}`,
  )
}

function assertRefundNotBeforeReturn(timeline) {
  const keys = getDisputeEvents(timeline).map((event) => event.key)
  const refundIndex = keys.indexOf('dispute_refund_pending')
  const returnIndex = keys.indexOf('dispute_return_authorised')

  if (refundIndex === -1 || returnIndex === -1) return

  assert(
    refundIndex > returnIndex,
    `Refund pending appeared before return authorised (${keys.join(' → ')})`,
  )
}

function buildTimeline({ order, disputes, caseUpdates, viewerRole = 'buyer' }) {
  return buildOrderTimeline({
    order,
    payment: basePayment(),
    offer: null,
    supportRequests: [],
    disputes,
    caseUpdates,
    viewerRole,
    userId: 'buyer-1',
  })
}

function testOpenedDisputeWithEvidence() {
  const caseUpdates = [
    {
      id: '1',
      dispute_id: DISPUTE_ID,
      event_type: 'case_opened',
      status: 'evidence_received',
      created_at: '2026-01-10T10:00:00Z',
    },
  ]

  const timeline = buildTimeline({
    order: baseOrder(),
    disputes: [buildDispute(DISPUTE_STATUSES.OPEN)],
    caseUpdates,
  })

  assertDisputeStepOrder(timeline, [
    'dispute_opened',
    'dispute_evidence_received',
  ])
  assert(getCurrentDisputeEvent(timeline)?.key === 'dispute_evidence_received', 'Expected evidence received current')
  assertRefundNotBeforeReturn(timeline)
  logPass('Opened dispute with evidence stops at evidence received')
}

function testAwaitingSellerCollection() {
  const caseUpdates = [
    {
      id: '1',
      dispute_id: DISPUTE_ID,
      event_type: 'case_opened',
      status: 'evidence_received',
      created_at: '2026-01-10T10:00:00Z',
    },
    {
      id: '2',
      dispute_id: DISPUTE_ID,
      event_type: 'return_authorised',
      status: DISPUTE_STATUSES.AWAITING_SELLER_COLLECTION,
      created_at: '2026-01-11T10:00:00Z',
    },
  ]

  const timeline = buildTimeline({
    order: baseOrder(),
    disputes: [buildDispute(DISPUTE_STATUSES.AWAITING_SELLER_COLLECTION)],
    caseUpdates,
  })

  assertDisputeStepOrder(timeline, [
    'dispute_opened',
    'dispute_evidence_received',
    'dispute_return_authorised',
    'dispute_awaiting_seller_collection',
  ])
  assert(
    getCurrentDisputeEvent(timeline)?.key === 'dispute_awaiting_seller_collection',
    'Expected awaiting seller collection current',
  )
  logPass('Return authorised shows awaiting seller collection as current')
}

function testCollectionArranged() {
  const caseUpdates = [
    {
      id: '1',
      dispute_id: DISPUTE_ID,
      event_type: 'case_opened',
      status: 'evidence_received',
      created_at: '2026-01-10T10:00:00Z',
    },
    {
      id: '2',
      dispute_id: DISPUTE_ID,
      event_type: 'return_authorised',
      status: DISPUTE_STATUSES.AWAITING_SELLER_COLLECTION,
      created_at: '2026-01-11T10:00:00Z',
    },
    {
      id: '3',
      dispute_id: DISPUTE_ID,
      event_type: 'collection_arranged',
      status: DISPUTE_STATUSES.COLLECTION_ARRANGED,
      created_at: '2026-01-12T10:00:00Z',
    },
  ]

  const timeline = buildTimeline({
    order: baseOrder(),
    disputes: [buildDispute(DISPUTE_STATUSES.COLLECTION_ARRANGED)],
    caseUpdates,
  })

  assert(
    getCurrentDisputeEvent(timeline)?.key === 'dispute_collection_arranged',
    'Expected collection arranged current',
  )
  logPass('Seller arranged collection is current')
}

function testReadyForRefund() {
  const caseUpdates = [
    {
      id: '1',
      dispute_id: DISPUTE_ID,
      event_type: 'case_opened',
      status: 'evidence_received',
      created_at: '2026-01-10T10:00:00Z',
    },
    {
      id: '2',
      dispute_id: DISPUTE_ID,
      event_type: 'return_authorised',
      status: DISPUTE_STATUSES.AWAITING_SELLER_COLLECTION,
      created_at: '2026-01-11T10:00:00Z',
    },
    {
      id: '3',
      dispute_id: DISPUTE_ID,
      event_type: 'collection_arranged',
      status: DISPUTE_STATUSES.COLLECTION_ARRANGED,
      created_at: '2026-01-12T10:00:00Z',
    },
    {
      id: '4',
      dispute_id: DISPUTE_ID,
      event_type: 'collection_confirmed',
      status: DISPUTE_STATUSES.READY_FOR_REFUND,
      created_at: '2026-01-13T10:00:00Z',
    },
  ]

  const timeline = buildTimeline({
    order: baseOrder(),
    disputes: [buildDispute(DISPUTE_STATUSES.READY_FOR_REFUND)],
    caseUpdates,
  })

  assert(
    getCurrentDisputeEvent(timeline)?.key === 'dispute_ready_for_refund',
    'Expected ready for refund current',
  )
  assert(
    !getDisputeEvents(timeline).some(
      (event) => event.key === 'dispute_refund_pending' && event.state === 'current',
    ),
    'Refund pending should not be current when ready for refund',
  )
  logPass('Buyer confirmed collection shows ready for refund as current')
}

function testRefundPendingAfterReturnFlow() {
  const caseUpdates = [
    {
      id: '1',
      dispute_id: DISPUTE_ID,
      event_type: 'case_opened',
      status: 'evidence_received',
      created_at: '2026-01-10T10:00:00Z',
    },
    {
      id: '2',
      dispute_id: DISPUTE_ID,
      event_type: 'return_authorised',
      status: DISPUTE_STATUSES.AWAITING_SELLER_COLLECTION,
      created_at: '2026-01-11T10:00:00Z',
    },
    {
      id: '3',
      dispute_id: DISPUTE_ID,
      event_type: 'collection_arranged',
      status: DISPUTE_STATUSES.COLLECTION_ARRANGED,
      created_at: '2026-01-12T10:00:00Z',
    },
    {
      id: '4',
      dispute_id: DISPUTE_ID,
      event_type: 'collection_confirmed',
      status: DISPUTE_STATUSES.READY_FOR_REFUND,
      created_at: '2026-01-13T10:00:00Z',
    },
    {
      id: '5',
      dispute_id: DISPUTE_ID,
      event_type: 'refund_pending',
      status: DISPUTE_STATUSES.REFUND_PENDING,
      created_at: '2026-01-14T10:00:00Z',
    },
  ]

  const timeline = buildTimeline({
    order: baseOrder({ fulfilment_status: ORDER_FULFILMENT_STATUSES.DISPUTED }),
    disputes: [buildDispute(DISPUTE_STATUSES.REFUND_PENDING)],
    caseUpdates,
  })

  assertDisputeStepOrder(timeline, [
    'dispute_opened',
    'dispute_evidence_received',
    'dispute_return_authorised',
    'dispute_awaiting_seller_collection',
    'dispute_collection_arranged',
    'dispute_collection_confirmed',
    'dispute_ready_for_refund',
    'dispute_refund_pending',
  ])
  assert(
    getCurrentDisputeEvent(timeline)?.key === 'dispute_refund_pending',
    'Expected refund pending current',
  )
  assertRefundNotBeforeReturn(timeline)
  logPass('Refund pending follows full return workflow in order')
}

function testRefundWithoutReturn() {
  const caseUpdates = [
    {
      id: '1',
      dispute_id: DISPUTE_ID,
      event_type: 'case_opened',
      status: 'evidence_received',
      created_at: '2026-01-10T10:00:00Z',
    },
    {
      id: '2',
      dispute_id: DISPUTE_ID,
      event_type: 'admin_decision',
      status: DISPUTE_STATUSES.UNDER_REVIEW,
      created_at: '2026-01-11T10:00:00Z',
    },
    {
      id: '3',
      dispute_id: DISPUTE_ID,
      event_type: 'refund_pending',
      status: DISPUTE_STATUSES.REFUND_PENDING,
      created_at: '2026-01-12T10:00:00Z',
    },
  ]

  const timeline = buildTimeline({
    order: baseOrder({ fulfilment_status: ORDER_FULFILMENT_STATUSES.DISPUTED }),
    disputes: [buildDispute(DISPUTE_STATUSES.REFUND_PENDING)],
    caseUpdates,
  })

  const disputeKeys = getDisputeEvents(timeline).map((event) => event.key)
  assert(!disputeKeys.includes('dispute_return_authorised'), 'Return steps should be skipped')
  assert(
    getCurrentDisputeEvent(timeline)?.key === 'dispute_refund_pending',
    'Expected refund pending current',
  )
  logPass('Full refund without return skips collection steps')
}

function testBuyerAndSellerTimelinesMatch() {
  const caseUpdates = [
    {
      id: '1',
      dispute_id: DISPUTE_ID,
      event_type: 'case_opened',
      status: 'evidence_received',
      created_at: '2026-01-10T10:00:00Z',
    },
    {
      id: '2',
      dispute_id: DISPUTE_ID,
      event_type: 'return_authorised',
      status: DISPUTE_STATUSES.AWAITING_SELLER_COLLECTION,
      created_at: '2026-01-11T10:00:00Z',
    },
    {
      id: '3',
      dispute_id: DISPUTE_ID,
      event_type: 'collection_arranged',
      status: DISPUTE_STATUSES.COLLECTION_ARRANGED,
      created_at: '2026-01-12T10:00:00Z',
    },
    {
      id: '4',
      dispute_id: DISPUTE_ID,
      event_type: 'collection_confirmed',
      status: DISPUTE_STATUSES.READY_FOR_REFUND,
      created_at: '2026-01-13T10:00:00Z',
    },
    {
      id: '5',
      dispute_id: DISPUTE_ID,
      event_type: 'refund_pending',
      status: DISPUTE_STATUSES.REFUND_PENDING,
      created_at: '2026-01-14T10:00:00Z',
    },
  ]

  const order = baseOrder({ fulfilment_status: ORDER_FULFILMENT_STATUSES.REFUND_PENDING })
  const disputes = [buildDispute(DISPUTE_STATUSES.REFUND_PENDING)]

  const buyerTimeline = buildTimeline({ order, disputes, caseUpdates, viewerRole: 'buyer' })
  const sellerTimeline = buildTimeline({ order, disputes, caseUpdates, viewerRole: 'seller' })

  const buyerKeys = getDisputeEvents(buyerTimeline).map((event) => `${event.key}:${event.state}`)
  const sellerKeys = getDisputeEvents(sellerTimeline).map((event) => `${event.key}:${event.state}`)

  assert(
    buyerKeys.join('|') === sellerKeys.join('|'),
    `Buyer/seller dispute timelines diverged:\nBuyer: ${buyerKeys.join(' → ')}\nSeller: ${sellerKeys.join(' → ')}`,
  )
  logPass('Buyer and seller dispute timelines match during return workflow')
}

function testCompletedOrderWithoutDispute() {
  const order = baseOrder({
    fulfilment_status: ORDER_FULFILMENT_STATUSES.COMPLETED,
    protection_status: 'released',
    payout_status: 'paid',
    payout_released_at: '2026-02-01T10:00:00Z',
    payout_release_at: '2026-01-31T10:00:00Z',
  })

  const timeline = buildTimeline({
    order,
    disputes: [],
    caseUpdates: [],
    viewerRole: 'buyer',
  })

  assert(getDisputeEvents(timeline).length === 0, 'Completed order should not show dispute steps')
  assert(
    timeline.events.some((event) => event.key === 'order_completed'),
    'Completed order should still show standard completion timeline',
  )
  logPass('Normal completed order keeps standard completion timeline')
}

function testBuildDisputeTimelineStepsExport() {
  const steps = buildDisputeTimelineSteps(
    baseOrder(),
    [buildDispute(DISPUTE_STATUSES.READY_FOR_REFUND)],
    [
      {
        id: '4',
        dispute_id: DISPUTE_ID,
        event_type: 'collection_confirmed',
        status: DISPUTE_STATUSES.READY_FOR_REFUND,
        created_at: '2026-01-13T10:00:00Z',
      },
    ],
  )

  assert(steps.at(-1)?.key === 'dispute_ready_for_refund', 'Latest built step should be ready for refund')
  logPass('buildDisputeTimelineSteps uses case updates chronologically')
}

function testRefundCompletedAndCaseClosed() {
  const caseUpdates = [
    {
      id: '1',
      dispute_id: DISPUTE_ID,
      event_type: 'case_opened',
      status: 'evidence_received',
      created_at: '2026-01-10T10:00:00Z',
    },
    {
      id: '2',
      dispute_id: DISPUTE_ID,
      event_type: 'admin_decision',
      status: DISPUTE_STATUSES.UNDER_REVIEW,
      created_at: '2026-01-11T10:00:00Z',
    },
    {
      id: '3',
      dispute_id: DISPUTE_ID,
      event_type: 'refund_pending',
      status: DISPUTE_STATUSES.REFUND_PENDING,
      created_at: '2026-01-12T10:00:00Z',
    },
    {
      id: '4',
      dispute_id: DISPUTE_ID,
      event_type: 'refund_completed',
      status: DISPUTE_STATUSES.REFUND_COMPLETED,
      created_at: '2026-01-13T10:00:00Z',
    },
    {
      id: '5',
      dispute_id: DISPUTE_ID,
      event_type: 'case_closed',
      status: DISPUTE_STATUSES.RESOLVED,
      created_at: '2026-01-14T10:00:00Z',
    },
  ]

  const timeline = buildTimeline({
    order: baseOrder({ fulfilment_status: ORDER_FULFILMENT_STATUSES.REFUND_PENDING }),
    disputes: [
      buildDispute(DISPUTE_STATUSES.RESOLVED, {
        case_outcome: 'buyer_upheld_full_refund',
        resolved_at: '2026-01-14T10:00:00Z',
        refund_completed_at: '2026-01-13T10:00:00Z',
      }),
    ],
    caseUpdates,
  })

  assertDisputeStepOrder(timeline, [
    'dispute_opened',
    'dispute_evidence_received',
    'dispute_under_review',
    'dispute_refund_pending',
    'dispute_refund_completed',
    'dispute_case_closed',
  ])
  assert(getCurrentDisputeEvent(timeline)?.key === 'dispute_case_closed', 'Expected case closed current')
  logPass('Refund completed and case closed appear in timeline order')
}

function testRejectedClaimClosed() {
  const caseUpdates = [
    {
      id: '1',
      dispute_id: DISPUTE_ID,
      event_type: 'case_opened',
      status: 'evidence_received',
      created_at: '2026-01-10T10:00:00Z',
    },
    {
      id: '2',
      dispute_id: DISPUTE_ID,
      event_type: 'admin_decision',
      status: DISPUTE_STATUSES.UNDER_REVIEW,
      created_at: '2026-01-11T10:00:00Z',
    },
    {
      id: '3',
      dispute_id: DISPUTE_ID,
      event_type: 'admin_decision',
      status: DISPUTE_STATUSES.REJECTED,
      created_at: '2026-01-12T10:00:00Z',
    },
    {
      id: '4',
      dispute_id: DISPUTE_ID,
      event_type: 'case_closed',
      status: DISPUTE_STATUSES.RESOLVED,
      created_at: '2026-01-13T10:00:00Z',
    },
  ]

  const timeline = buildTimeline({
    order: baseOrder(),
    disputes: [
      buildDispute(DISPUTE_STATUSES.RESOLVED, {
        case_outcome: 'seller_upheld',
        resolved_at: '2026-01-13T10:00:00Z',
      }),
    ],
    caseUpdates,
  })

  assertDisputeStepOrder(timeline, [
    'dispute_opened',
    'dispute_evidence_received',
    'dispute_under_review',
    'dispute_rejected',
    'dispute_case_closed',
  ])
  logPass('Rejected claim closes with case closed step')
}

function main() {
  testOpenedDisputeWithEvidence()
  testAwaitingSellerCollection()
  testCollectionArranged()
  testReadyForRefund()
  testRefundPendingAfterReturnFlow()
  testRefundWithoutReturn()
  testRefundCompletedAndCaseClosed()
  testRejectedClaimClosed()
  testBuyerAndSellerTimelinesMatch()
  testCompletedOrderWithoutDispute()
  testBuildDisputeTimelineStepsExport()
}

try {
  main()
  console.log('\nAll Case Management timeline checks passed.')
} catch (error) {
  console.error(`\nFAIL: ${error.message}`)
  process.exit(1)
}
