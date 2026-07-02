#!/usr/bin/env node
/**
 * Unit tests for refund completion admin guards.
 * Usage: node scripts/test-case-refund-completion-guards.mjs
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
  const {
    canMarkRefundCompleted,
    canCloseCase,
    isCaseClosed,
    isRefundPendingCase,
    hasRefundCompletedTimeline,
  } = await server.ssrLoadModule('/src/lib/caseClosure.js')
  const {
    getAdminDisputeDecisionGroups,
    getAdminSupportDecisionGroups,
    DISPUTE_STATUSES,
    isOrderRefundPending,
  } = await server.ssrLoadModule('/src/lib/orderDisputes.js')

  assert(canMarkRefundCompleted({ status: DISPUTE_STATUSES.REFUND_PENDING }), 'full refund pending')
  assert(
    canMarkRefundCompleted({ status: DISPUTE_STATUSES.PARTIAL_REFUND_PENDING }),
    'partial refund pending',
  )
  assert(!canMarkRefundCompleted({ status: DISPUTE_STATUSES.READY_FOR_REFUND }), 'ready for refund')
  assert(
    !canMarkRefundCompleted({ status: 'resolved', case_outcome: 'buyer_upheld_full_refund' }),
    'closed',
  )
  assert(
    canMarkRefundCompleted(
      { status: DISPUTE_STATUSES.RESOLVED_BUYER, case_outcome: 'buyer_upheld_full_refund' },
      { order: { fulfilment_status: 'refund_pending' } },
    ),
    'order refund pending with provisional outcome',
  )
  assert(
    !isCaseClosed(
      { status: DISPUTE_STATUSES.REFUND_PENDING, case_outcome: 'buyer_upheld_full_refund' },
    ),
    'refund pending with outcome is not closed',
  )
  assert(
    !isCaseClosed(
      { status: DISPUTE_STATUSES.RESOLVED_BUYER },
      { order: { fulfilment_status: 'refund_pending' } },
    ),
    'resolved buyer while order refund pending is not closed',
  )
  assert(
    !canMarkRefundCompleted(
      { id: 'd1', status: DISPUTE_STATUSES.REFUND_PENDING },
      { caseUpdates: [{ event_type: 'refund_completed', dispute_id: 'd1' }] },
    ),
    'blocked when refund_completed timeline exists',
  )
  assert(isRefundPendingCase({ status: DISPUTE_STATUSES.REFUND_PENDING }), 'refund pending case')
  assert(isOrderRefundPending({ fulfilment_status: 'refund_pending' }), 'order refund pending')
  assert(
    hasRefundCompletedTimeline([{ event_type: 'refund_completed', dispute_id: 'd1' }], { id: 'd1' }),
    'timeline match',
  )

  assert(!canCloseCase({ status: DISPUTE_STATUSES.REFUND_PENDING }), 'cannot manual close while pending')
  assert(canCloseCase({ status: DISPUTE_STATUSES.REJECTED }), 'can close rejected')
  assert(isCaseClosed({ status: 'resolved', case_outcome: 'seller_upheld' }), 'resolved with outcome is closed')

  assert(getAdminDisputeDecisionGroups({ status: DISPUTE_STATUSES.REFUND_PENDING }).length === 0, 'no decisions while refund pending')
  assert(
    getAdminSupportDecisionGroups({ status: DISPUTE_STATUSES.PARTIAL_REFUND_PENDING }).length === 0,
    'no support decisions while partial refund pending',
  )
  assert(
    getAdminDisputeDecisionGroups({ status: DISPUTE_STATUSES.UNDER_REVIEW }).length > 0,
    'decisions available under review',
  )

  console.log('PASS: refund completion guard checks')
  console.log('\nAll refund completion guard checks passed.')
} catch (error) {
  console.error('FAIL:', error.message)
  process.exitCode = 1
} finally {
  await server.close()
}
