import { isOfferCancelled } from './offers'
import {
  formatOrderTimestamp,
  hasBuyerTakenPossession,
  isPayoutReleased,
  ORDER_FULFILMENT_STATUSES,
  ORDER_TYPES,
  PAYOUT_STATUSES,
  getCourierDeliveryTimelineTrackingDetail,
} from './orders'
import { PAYMENT_STATUSES } from './payments'
import {
  DISPUTE_STATUSES,
  getActiveOrderDispute,
  getLatestOrderDispute,
  isDisputeActive,
  isBuyerProtectionWindowActive,
  isOrderDisputed,
} from './orderDisputes'
import { formatCaseUpdateStatus } from './caseUpdates'
import {
  SUPPORT_REQUEST_STATUSES,
  formatSupportRequestReason,
  formatSupportRequestTimestamp,
} from './supportRequests'

const BASE_TRANSACTION_STEP_ORDER = [
  'offer_accepted',
  'listing_reserved',
  'order_created',
  'payment_received',
]

const POST_PROTECTION_STEP_ORDER = [
  'buyer_protection_completed',
  'awaiting_payout',
  'payout_released',
  'order_completed',
]

function isBuyerProtectionActive(order) {
  return isBuyerProtectionWindowActive(order)
}

const DISPUTE_TIMELINE_STEP_ORDER = [
  'dispute_opened',
  'dispute_evidence_received',
  'dispute_awaiting_evidence',
  'dispute_under_review',
  'dispute_review_pending',
  'dispute_return_authorised',
  'dispute_awaiting_seller_collection',
  'dispute_collection_arranged',
  'dispute_collection_confirmed',
  'dispute_ready_for_refund',
  'dispute_refund_pending',
  'dispute_refund_completed',
  'dispute_rejected',
  'dispute_case_closed',
  'dispute_resolved',
]

function hasPausedDispute(order, disputes) {
  if (getActiveOrderDispute(disputes)) return true
  return isOrderDisputed(order)
}

function isBuyerProtectionCompleted(order, disputes = []) {
  if (hasPausedDispute(order, disputes)) return false
  if (order?.protection_status === 'released') return true
  if (
    order?.fulfilment_status === ORDER_FULFILMENT_STATUSES.COMPLETED &&
    !isBuyerProtectionWindowActive(order)
  ) {
    return true
  }
  return hasBuyerTakenPossession(order) && !isBuyerProtectionWindowActive(order)
}

function hasDisputeTimelineHistory(disputes) {
  return Boolean(getLatestOrderDispute(disputes))
}

function isOrderFulfilmentComplete(order) {
  return (
    order?.fulfilment_status === ORDER_FULFILMENT_STATUSES.COMPLETED &&
    isPayoutReleased(order)
  )
}

function isOrderMarketplaceComplete(order) {
  return order?.fulfilment_status === ORDER_FULFILMENT_STATUSES.COMPLETED
}

function parseTimestamp(value) {
  if (!value) return null

  const time = new Date(value).getTime()
  return Number.isNaN(time) ? null : time
}

function isTransactionCancelled({ order, payment, offer }) {
  return (
    isOfferCancelled(offer) ||
    order?.fulfilment_status === ORDER_FULFILMENT_STATUSES.CANCELLED ||
    payment?.status === PAYMENT_STATUSES.CANCELLED ||
    payment?.status === PAYMENT_STATUSES.EXPIRED ||
    payment?.status === PAYMENT_STATUSES.REFUNDED
  )
}

function hasActiveSupportRequest(supportRequests) {
  return (supportRequests ?? []).some(
    (request) =>
      request.status === SUPPORT_REQUEST_STATUSES.OPEN ||
      request.status === SUPPORT_REQUEST_STATUSES.REVIEWING,
  )
}

function isBuyerConfirmedOrLater(order) {
  return (
    order?.fulfilment_status === ORDER_FULFILMENT_STATUSES.BUYER_CONFIRMED ||
    order?.fulfilment_status === ORDER_FULFILMENT_STATUSES.COMPLETED
  )
}

function isProtectionWindowComplete(order) {
  return isBuyerProtectionCompleted(order)
}

function getBuyerConfirmedLabel(viewerRole) {
  return viewerRole === 'buyer' ? 'You confirmed receipt' : 'Buyer confirmed receipt'
}

function getSupportOpenedLabel(request, viewerRole, userId) {
  if (request.opened_by === userId) {
    return 'You opened a support request'
  }

  return viewerRole === 'buyer'
    ? 'Seller opened a support request'
    : 'Buyer opened a support request'
}

const FULFILMENT_TIMELINE_STEP_KEYS = new Set([
  'awaiting_collection',
  'awaiting_courier_collection',
  'awaiting_seller_delivery',
  'courier_evidence_submitted',
  'in_transit',
  'collection_confirmed',
  'delivery_confirmed',
  'buyer_protection_active',
])

function isFulfilmentTimelineStepComplete(stepKey, order, disputes = []) {
  if (!order) return false

  const status = order.fulfilment_status
  const protectionCompleted = isBuyerProtectionCompleted(order, disputes)
  const protectionActive = isBuyerProtectionWindowActive(order)
  const disputePaused = hasPausedDispute(order, disputes)

  switch (stepKey) {
    case 'awaiting_collection':
      return (
        hasBuyerTakenPossession(order) ||
        status === ORDER_FULFILMENT_STATUSES.BUYER_CONFIRMED ||
        status === ORDER_FULFILMENT_STATUSES.COMPLETED ||
        protectionActive ||
        protectionCompleted ||
        disputePaused
      )
    case 'awaiting_seller_delivery':
      return (
        status === ORDER_FULFILMENT_STATUSES.COLLECTED ||
        status === ORDER_FULFILMENT_STATUSES.BUYER_CONFIRMED ||
        status === ORDER_FULFILMENT_STATUSES.COMPLETED ||
        protectionActive ||
        protectionCompleted ||
        disputePaused
      )
    case 'awaiting_courier_collection':
      return (
        Boolean(order.courier_evidence_submitted_at) ||
        status === ORDER_FULFILMENT_STATUSES.IN_TRANSIT ||
        status === ORDER_FULFILMENT_STATUSES.DELIVERED ||
        status === ORDER_FULFILMENT_STATUSES.COMPLETED ||
        protectionActive ||
        protectionCompleted ||
        disputePaused
      )
    case 'courier_evidence_submitted':
      return (
        Boolean(order.courier_collected_at) ||
        status === ORDER_FULFILMENT_STATUSES.DELIVERED ||
        status === ORDER_FULFILMENT_STATUSES.COMPLETED ||
        protectionCompleted ||
        disputePaused
      )
    case 'in_transit':
      return (
        Boolean(order.courier_delivered_at || order.delivered_at) ||
        status === ORDER_FULFILMENT_STATUSES.DELIVERED ||
        status === ORDER_FULFILMENT_STATUSES.COMPLETED ||
        protectionCompleted ||
        disputePaused
      )
    case 'delivery_confirmed':
      return (
        Boolean(order.courier_delivered_at || order.delivered_at) ||
        protectionActive ||
        protectionCompleted ||
        disputePaused ||
        status === ORDER_FULFILMENT_STATUSES.COMPLETED
      )
    case 'collection_confirmed':
      return (
        Boolean(order.collection_confirmed_at || order.collected_at) ||
        status === ORDER_FULFILMENT_STATUSES.COLLECTED ||
        status === ORDER_FULFILMENT_STATUSES.BUYER_CONFIRMED ||
        status === ORDER_FULFILMENT_STATUSES.COMPLETED ||
        protectionActive ||
        protectionCompleted ||
        disputePaused
      )
    case 'buyer_protection_active':
      return protectionCompleted || disputePaused || hasDisputeTimelineHistory(disputes)
    default:
      return false
  }
}

function getFulfilmentTimelineStepState(eventKey, order, currentEventKey, event, disputes = []) {
  if (!FULFILMENT_TIMELINE_STEP_KEYS.has(eventKey)) return null

  if (isFulfilmentTimelineStepComplete(eventKey, order, disputes)) {
    return eventKey === currentEventKey ? 'current' : 'complete'
  }

  if (eventKey === currentEventKey || event?.isCurrent) {
    return 'current'
  }

  return 'upcoming'
}

function getFulfilmentSteps(order) {
  const orderType = order?.order_type ?? ORDER_TYPES.COLLECTION
  const status = order?.fulfilment_status

  if (orderType === ORDER_TYPES.BUYER_COURIER) {
    return [
      {
        key: 'awaiting_courier_collection',
        label: 'Awaiting courier collection',
        timestamp: null,
        isCurrent: status === ORDER_FULFILMENT_STATUSES.AWAITING_COURIER_COLLECTION,
      },
      {
        key: 'courier_evidence_submitted',
        label: 'Courier handover evidence submitted',
        timestamp: order?.courier_evidence_submitted_at ?? null,
        isCurrent: status === ORDER_FULFILMENT_STATUSES.IN_TRANSIT,
      },
      {
        key: 'in_transit',
        label: 'In transit',
        timestamp: order?.courier_collected_at ?? null,
        isCurrent: status === ORDER_FULFILMENT_STATUSES.IN_TRANSIT,
      },
      {
        key: 'delivery_confirmed',
        label: 'Delivery confirmed',
        timestamp: order?.courier_delivered_at ?? order?.delivered_at ?? null,
        isCurrent: status === ORDER_FULFILMENT_STATUSES.DELIVERED,
      },
      {
        key: 'buyer_protection_active',
        label: 'Buyer Protection active',
        timestamp: order?.courier_delivered_at ?? order?.delivered_at ?? null,
        isCurrent: isBuyerProtectionActive(order),
      },
    ]
  }

  if (orderType === ORDER_TYPES.SELLER_DELIVERY) {
    return [
      {
        key: 'awaiting_seller_delivery',
        label: 'Awaiting seller delivery',
        timestamp: null,
        isCurrent: status === ORDER_FULFILMENT_STATUSES.AWAITING_SELLER_DELIVERY,
      },
      {
        key: 'collection_confirmed',
        label: 'Handover confirmed',
        timestamp: order?.collection_confirmed_at ?? order?.collected_at ?? null,
        isCurrent:
          status === ORDER_FULFILMENT_STATUSES.COLLECTED &&
          !isBuyerProtectionActive(order),
      },
      {
        key: 'buyer_protection_active',
        label: 'Buyer Protection active',
        timestamp: order?.collection_confirmed_at ?? order?.collected_at ?? null,
        isCurrent: isBuyerProtectionActive(order),
      },
    ]
  }

  return [
    {
      key: 'awaiting_collection',
      label: 'Awaiting collection',
      timestamp: null,
      isCurrent:
        status === ORDER_FULFILMENT_STATUSES.AWAITING_COLLECTION &&
        !order?.collection_rejected_at,
    },
    {
      key: 'collection_rejected',
      label: 'Item rejected at collection',
      timestamp: order?.collection_rejected_at ?? null,
      isCurrent: Boolean(order?.collection_rejected_at) && !order?.collected_at,
    },
    {
      key: 'collection_confirmed',
      label: 'Collection confirmed',
      timestamp: order?.collection_confirmed_at ?? order?.collected_at ?? null,
      isCurrent:
        status === ORDER_FULFILMENT_STATUSES.COLLECTED &&
        !isBuyerProtectionActive(order),
    },
    {
      key: 'buyer_protection_active',
      label: 'Buyer Protection active',
      timestamp: order?.collection_confirmed_at ?? order?.collected_at ?? null,
      isCurrent: isBuyerProtectionActive(order),
    },
  ]
}

function getFinalLifecycleSteps(order, payment, cancelled, disputes = []) {
  if (cancelled || payment?.status !== PAYMENT_STATUSES.PAID || !order) {
    return []
  }

  if (hasPausedDispute(order, disputes)) {
    return []
  }

  const protectionCompleted = isBuyerProtectionCompleted(order, disputes)
  const payoutReleased = isPayoutReleased(order)
  const orderCompleted = isOrderFulfilmentComplete(order)

  return [
    {
      key: 'buyer_protection_completed',
      label: 'Buyer Protection completed',
      timestamp: protectionCompleted
        ? order?.payout_release_at ?? order?.buyer_confirmed_at ?? null
        : null,
    },
    {
      key: 'awaiting_payout',
      label: 'Awaiting payout',
      timestamp: null,
    },
    {
      key: 'payout_released',
      label: 'Payout released',
      timestamp: payoutReleased ? order?.payout_released_at ?? null : null,
    },
    {
      key: 'order_completed',
      label: 'Order completed',
      timestamp: orderCompleted
        ? order?.payout_released_at ?? order?.buyer_confirmed_at ?? null
        : null,
    },
  ]
}

function getDisputeForTimeline(order, disputes = []) {
  const latest = getLatestOrderDispute(disputes)
  const active = getActiveOrderDispute(disputes)
  const terminalStatuses = new Set([
    DISPUTE_STATUSES.REJECTED,
    DISPUTE_STATUSES.RESOLVED,
    DISPUTE_STATUSES.RESOLVED_BUYER,
    DISPUTE_STATUSES.RESOLVED_SELLER,
    DISPUTE_STATUSES.CANCELLED,
  ])
  const terminalDispute =
    latest && !active && terminalStatuses.has(latest.status) ? latest : null

  return active ?? (isOrderDisputed(order) ? latest : null) ?? terminalDispute
}

function getDisputeCaseUpdates(caseUpdates, disputeId) {
  if (!disputeId) return []

  return (caseUpdates ?? [])
    .filter((update) => update.dispute_id === disputeId)
    .filter((update) => update.event_type !== 'admin_note_update')
    .sort((left, right) => {
      const leftTime = parseTimestamp(left.created_at) ?? 0
      const rightTime = parseTimestamp(right.created_at) ?? 0
      if (leftTime !== rightTime) return leftTime - rightTime
      return String(left.id).localeCompare(String(right.id))
    })
}

function shouldSkipDisputeCaseUpdate(update, seenKeys) {
  if (update.event_type === 'admin_note_update' || update.event_type === 'support_message_update') {
    return true
  }

  if (update.event_type !== 'admin_decision') return false

  switch (update.status) {
    case DISPUTE_STATUSES.AWAITING_SELLER_COLLECTION:
      return seenKeys.has('dispute_awaiting_seller_collection')
    case DISPUTE_STATUSES.COLLECTION_ARRANGED:
      return seenKeys.has('dispute_collection_arranged')
    case DISPUTE_STATUSES.READY_FOR_REFUND:
      return seenKeys.has('dispute_ready_for_refund')
    case DISPUTE_STATUSES.REFUND_PENDING:
    case DISPUTE_STATUSES.PARTIAL_REFUND_PENDING:
      return seenKeys.has('dispute_refund_pending')
    case DISPUTE_STATUSES.REFUND_COMPLETED:
      return seenKeys.has('dispute_refund_completed')
    case DISPUTE_STATUSES.RESOLVED:
      return seenKeys.has('dispute_case_closed')
    case DISPUTE_STATUSES.RETURN_AUTHORISED:
      return seenKeys.has('dispute_return_authorised')
    default:
      return false
  }
}

function expandCaseUpdateToDisputeSteps(update) {
  const timestamp = update.created_at ?? null
  const { event_type: eventType, status } = update

  switch (eventType) {
    case 'case_opened':
      if (status === 'evidence_received') {
        return [
          { key: 'dispute_opened', label: 'Dispute opened', timestamp },
          { key: 'dispute_evidence_received', label: 'Evidence received', timestamp },
        ]
      }

      if (status === 'awaiting_buyer_evidence') {
        return [
          { key: 'dispute_opened', label: 'Dispute opened', timestamp },
          { key: 'dispute_awaiting_evidence', label: 'Awaiting buyer evidence', timestamp },
        ]
      }

      return [{ key: 'dispute_opened', label: 'Dispute opened', timestamp }]

    case 'return_authorised':
      return [
        { key: 'dispute_return_authorised', label: 'Return authorised', timestamp },
        {
          key: 'dispute_awaiting_seller_collection',
          label: 'Awaiting seller collection',
          timestamp,
        },
      ]

    case 'collection_arranged':
      return [{ key: 'dispute_collection_arranged', label: 'Collection arranged', timestamp }]

    case 'collection_confirmed':
      if (status === DISPUTE_STATUSES.READY_FOR_REFUND) {
        return [
          { key: 'dispute_collection_confirmed', label: 'Collection confirmed', timestamp },
          { key: 'dispute_ready_for_refund', label: 'Ready for refund', timestamp },
        ]
      }

      return [{ key: 'dispute_collection_confirmed', label: 'Collection confirmed', timestamp }]

    case 'refund_pending':
      return [{ key: 'dispute_refund_pending', label: 'Refund pending', timestamp }]

    case 'refund_completed':
      return [{ key: 'dispute_refund_completed', label: 'Refund completed', timestamp }]

    case 'case_closed':
      return [{ key: 'dispute_case_closed', label: 'Case closed', timestamp }]

    default:
      break
  }

  if (eventType === 'admin_decision' || eventType === 'legacy_support_update') {
    switch (status) {
      case DISPUTE_STATUSES.OPEN:
        return [{ key: 'dispute_review_pending', label: 'Equipd review in progress', timestamp }]
      case DISPUTE_STATUSES.UNDER_REVIEW:
      case DISPUTE_STATUSES.AWAITING_BUYER_EVIDENCE:
      case DISPUTE_STATUSES.AWAITING_SELLER_EVIDENCE:
        return [{ key: 'dispute_under_review', label: 'Equipd review in progress', timestamp }]
      case DISPUTE_STATUSES.RETURN_AUTHORISED:
        return [{ key: 'dispute_return_authorised', label: 'Return authorised', timestamp }]
      case DISPUTE_STATUSES.AWAITING_SELLER_COLLECTION:
        return [
          { key: 'dispute_return_authorised', label: 'Return authorised', timestamp },
          {
            key: 'dispute_awaiting_seller_collection',
            label: 'Awaiting seller collection',
            timestamp,
          },
        ]
      case DISPUTE_STATUSES.COLLECTION_ARRANGED:
        return [{ key: 'dispute_collection_arranged', label: 'Collection arranged', timestamp }]
      case DISPUTE_STATUSES.COLLECTION_CONFIRMED:
        return [{ key: 'dispute_collection_confirmed', label: 'Collection confirmed', timestamp }]
      case DISPUTE_STATUSES.READY_FOR_REFUND:
        return [{ key: 'dispute_ready_for_refund', label: 'Ready for refund', timestamp }]
      case DISPUTE_STATUSES.REFUND_PENDING:
      case DISPUTE_STATUSES.PARTIAL_REFUND_PENDING:
        return [{ key: 'dispute_refund_pending', label: 'Refund pending', timestamp }]
      case DISPUTE_STATUSES.REFUND_COMPLETED:
        return [{ key: 'dispute_refund_completed', label: 'Refund completed', timestamp }]
      case DISPUTE_STATUSES.REJECTED:
        return [{ key: 'dispute_rejected', label: 'Claim rejected', timestamp }]
      case DISPUTE_STATUSES.RESOLVED:
      case DISPUTE_STATUSES.RESOLVED_BUYER:
      case DISPUTE_STATUSES.RESOLVED_SELLER:
        return [{ key: 'dispute_case_closed', label: 'Case closed', timestamp }]
      default:
        return null
    }
  }

  const label = formatCaseUpdateStatus(status)
  if (label && label !== status) {
    return [{ key: `dispute_status_${status}`, label, timestamp }]
  }

  return null
}

function appendDisputeSteps(steps, seenKeys, nextSteps) {
  for (const step of nextSteps ?? []) {
    if (!step?.key || seenKeys.has(step.key)) continue
    seenKeys.add(step.key)
    steps.push(step)
  }
}

function appendTerminalDisputeSteps(steps, seenKeys, dispute, order) {
  if (
    [
      DISPUTE_STATUSES.RESOLVED,
      DISPUTE_STATUSES.RESOLVED_BUYER,
      DISPUTE_STATUSES.RESOLVED_SELLER,
    ].includes(dispute?.status) &&
    !seenKeys.has('dispute_case_closed')
  ) {
    appendDisputeSteps(steps, seenKeys, [
      {
        key: 'dispute_case_closed',
        label: 'Case closed',
        timestamp: dispute.resolved_at ?? dispute.updated_at ?? null,
      },
    ])
  }

  if (
    dispute?.status === DISPUTE_STATUSES.REJECTED &&
    !seenKeys.has('dispute_rejected')
  ) {
    appendDisputeSteps(steps, seenKeys, [
      {
        key: 'dispute_rejected',
        label: 'Claim rejected',
        timestamp: dispute.resolved_at ?? dispute.updated_at ?? null,
      },
    ])
  }
}

export function buildDisputeTimelineSteps(order, disputes = [], caseUpdates = []) {
  const dispute = getDisputeForTimeline(order, disputes)
  if (!dispute && !isOrderDisputed(order)) return []

  const disputeUpdates = getDisputeCaseUpdates(caseUpdates, dispute?.id)
  const steps = []
  const seenKeys = new Set()

  if (disputeUpdates.length > 0) {
    for (const update of disputeUpdates) {
      if (shouldSkipDisputeCaseUpdate(update, seenKeys)) continue
      appendDisputeSteps(steps, seenKeys, expandCaseUpdateToDisputeSteps(update))
    }

    appendTerminalDisputeSteps(steps, seenKeys, dispute, order)

    if (steps.length > 0) {
      return steps
    }
  }

  return getDisputeStepsFromStatus(order, disputes)
}

function getDisputeStepsFromStatus(order, disputes = []) {
  const dispute = getDisputeForTimeline(order, disputes)
  if (!dispute && !isOrderDisputed(order)) return []

  const steps = [
    {
      key: 'dispute_opened',
      label: 'Dispute opened',
      timestamp: dispute?.created_at ?? order?.updated_at ?? null,
    },
  ]

  if (!dispute) {
    steps.push({
      key: 'dispute_review_pending',
      label: 'Equipd review in progress',
      timestamp: null,
    })
    return steps
  }

  const status = dispute.status

  if (status === DISPUTE_STATUSES.OPEN) {
    steps.push({
      key: 'dispute_review_pending',
      label: 'Equipd review in progress',
      timestamp: null,
    })
    return steps
  }

  if (
    status === DISPUTE_STATUSES.UNDER_REVIEW ||
    status === DISPUTE_STATUSES.AWAITING_BUYER_EVIDENCE ||
    status === DISPUTE_STATUSES.AWAITING_SELLER_EVIDENCE
  ) {
    steps.push({
      key: 'dispute_under_review',
      label: 'Equipd review in progress',
      timestamp: dispute.updated_at ?? null,
    })
    return steps
  }

  if (
    status === DISPUTE_STATUSES.RETURN_AUTHORISED ||
    status === DISPUTE_STATUSES.AWAITING_SELLER_COLLECTION ||
    status === DISPUTE_STATUSES.COLLECTION_ARRANGED ||
    status === DISPUTE_STATUSES.COLLECTION_CONFIRMED ||
    status === DISPUTE_STATUSES.READY_FOR_REFUND
  ) {
    steps.push({
      key: 'dispute_under_review',
      label: 'Equipd review in progress',
      timestamp: dispute.created_at ?? null,
    })
    steps.push({
      key: 'dispute_return_authorised',
      label: 'Return authorised',
      timestamp: dispute.updated_at ?? null,
    })

    if (
      status === DISPUTE_STATUSES.AWAITING_SELLER_COLLECTION ||
      status === DISPUTE_STATUSES.COLLECTION_ARRANGED ||
      status === DISPUTE_STATUSES.COLLECTION_CONFIRMED ||
      status === DISPUTE_STATUSES.READY_FOR_REFUND
    ) {
      steps.push({
        key: 'dispute_awaiting_seller_collection',
        label: 'Awaiting seller collection',
        timestamp: null,
      })
    }

    if (
      status === DISPUTE_STATUSES.COLLECTION_ARRANGED ||
      status === DISPUTE_STATUSES.COLLECTION_CONFIRMED ||
      status === DISPUTE_STATUSES.READY_FOR_REFUND
    ) {
      steps.push({
        key: 'dispute_collection_arranged',
        label: 'Collection arranged',
        timestamp: dispute.updated_at ?? null,
      })
    }

    if (
      status === DISPUTE_STATUSES.COLLECTION_CONFIRMED ||
      status === DISPUTE_STATUSES.READY_FOR_REFUND
    ) {
      steps.push({
        key: 'dispute_collection_confirmed',
        label: 'Collection confirmed',
        timestamp: dispute.updated_at ?? null,
      })
    }

    if (status === DISPUTE_STATUSES.READY_FOR_REFUND) {
      steps.push({
        key: 'dispute_ready_for_refund',
        label: 'Ready for refund',
        timestamp: dispute.updated_at ?? null,
      })
    }

    return steps
  }

  if (
    status === DISPUTE_STATUSES.REFUND_PENDING ||
    status === DISPUTE_STATUSES.PARTIAL_REFUND_PENDING
  ) {
    const hadReturnWorkflow =
      dispute.resolution?.toLowerCase().includes('collection') ||
      dispute.customer_message?.toLowerCase().includes('collection')

    if (hadReturnWorkflow) {
      steps.push({
        key: 'dispute_under_review',
        label: 'Equipd review in progress',
        timestamp: dispute.created_at ?? null,
      })
      steps.push({
        key: 'dispute_return_authorised',
        label: 'Return authorised',
        timestamp: null,
      })
      steps.push({
        key: 'dispute_awaiting_seller_collection',
        label: 'Awaiting seller collection',
        timestamp: null,
      })
      steps.push({
        key: 'dispute_collection_arranged',
        label: 'Collection arranged',
        timestamp: null,
      })
      steps.push({
        key: 'dispute_collection_confirmed',
        label: 'Collection confirmed',
        timestamp: null,
      })
      steps.push({
        key: 'dispute_ready_for_refund',
        label: 'Ready for refund',
        timestamp: null,
      })
    } else {
      steps.push({
        key: 'dispute_under_review',
        label: 'Under review',
        timestamp: dispute.updated_at ?? null,
      })
    }

    steps.push({
      key: 'dispute_refund_pending',
      label: 'Refund pending',
      timestamp: dispute.resolved_at ?? dispute.updated_at ?? null,
    })
    return steps
  }

  if (status === DISPUTE_STATUSES.REFUND_COMPLETED) {
    const hadReturnWorkflow =
      dispute.resolution?.toLowerCase().includes('collection') ||
      dispute.customer_message?.toLowerCase().includes('collection')

    if (hadReturnWorkflow) {
      steps.push({
        key: 'dispute_under_review',
        label: 'Equipd review in progress',
        timestamp: dispute.created_at ?? null,
      })
      steps.push({
        key: 'dispute_return_authorised',
        label: 'Return authorised',
        timestamp: null,
      })
      steps.push({
        key: 'dispute_awaiting_seller_collection',
        label: 'Awaiting seller collection',
        timestamp: null,
      })
      steps.push({
        key: 'dispute_collection_arranged',
        label: 'Collection arranged',
        timestamp: null,
      })
      steps.push({
        key: 'dispute_collection_confirmed',
        label: 'Collection confirmed',
        timestamp: null,
      })
      steps.push({
        key: 'dispute_ready_for_refund',
        label: 'Ready for refund',
        timestamp: null,
      })
    } else {
      steps.push({
        key: 'dispute_under_review',
        label: 'Under review',
        timestamp: dispute.updated_at ?? null,
      })
    }

    steps.push({
      key: 'dispute_refund_pending',
      label: 'Refund pending',
      timestamp: dispute.refund_completed_at ?? dispute.updated_at ?? null,
    })
    steps.push({
      key: 'dispute_refund_completed',
      label: 'Refund completed',
      timestamp: dispute.refund_completed_at ?? dispute.updated_at ?? null,
    })
    return steps
  }

  if (status === DISPUTE_STATUSES.REJECTED) {
    steps.push({
      key: 'dispute_under_review',
      label: 'Under review',
      timestamp: dispute.updated_at ?? null,
    })
    steps.push({
      key: 'dispute_rejected',
      label: 'Claim rejected',
      timestamp: dispute.resolved_at ?? dispute.updated_at ?? null,
    })
    return steps
  }

  if (
    status === DISPUTE_STATUSES.RESOLVED ||
    status === DISPUTE_STATUSES.RESOLVED_BUYER ||
    status === DISPUTE_STATUSES.RESOLVED_SELLER
  ) {
    steps.push({
      key: 'dispute_under_review',
      label: 'Under review',
      timestamp: dispute.updated_at ?? null,
    })

    if (dispute.case_outcome) {
      if (
        dispute.case_outcome === 'buyer_upheld_full_refund' ||
        dispute.case_outcome === 'buyer_upheld_partial_refund'
      ) {
        steps.push({
          key: 'dispute_refund_completed',
          label: 'Refund completed',
          timestamp: dispute.refund_completed_at ?? dispute.resolved_at ?? null,
        })
      }

      if (dispute.case_outcome === 'seller_upheld') {
        steps.push({
          key: 'dispute_rejected',
          label: 'Claim rejected',
          timestamp: dispute.resolved_at ?? dispute.updated_at ?? null,
        })
      }

      steps.push({
        key: 'dispute_case_closed',
        label: 'Case closed',
        timestamp: dispute.resolved_at ?? dispute.updated_at ?? null,
      })
    } else {
      steps.push({
        key: 'dispute_resolved',
        label: 'Dispute resolved',
        timestamp: dispute.resolved_at ?? dispute.updated_at ?? null,
      })
    }

    return steps
  }

  steps.push({
    key: 'dispute_review_pending',
    label: 'Equipd review in progress',
    timestamp: null,
  })

  return steps
}

function getDisputeCurrentStage(order, disputes = [], caseUpdates = []) {
  const dispute = getDisputeForTimeline(order, disputes)
  if (!dispute && !isOrderDisputed(order)) return null

  const steps = buildDisputeTimelineSteps(order, disputes, caseUpdates)
  if (steps.length > 0) {
    const latestStep = steps[steps.length - 1]
    return {
      key: 'disputed',
      label: latestStep.label,
      eventKey: latestStep.key,
    }
  }

  if (!dispute) {
    return {
      key: 'disputed',
      label: 'Equipd review in progress',
      eventKey: 'dispute_review_pending',
    }
  }

  switch (dispute.status) {
    case DISPUTE_STATUSES.OPEN:
      return {
        key: 'disputed',
        label: 'Equipd review in progress',
        eventKey: 'dispute_review_pending',
      }
    case DISPUTE_STATUSES.UNDER_REVIEW:
    case DISPUTE_STATUSES.AWAITING_BUYER_EVIDENCE:
    case DISPUTE_STATUSES.AWAITING_SELLER_EVIDENCE:
      return {
        key: 'disputed',
        label: 'Equipd review in progress',
        eventKey: 'dispute_under_review',
      }
    case DISPUTE_STATUSES.RETURN_AUTHORISED:
      return {
        key: 'disputed',
        label: 'Return authorised',
        eventKey: 'dispute_return_authorised',
      }
    case DISPUTE_STATUSES.AWAITING_SELLER_COLLECTION:
      return {
        key: 'disputed',
        label: 'Awaiting seller collection',
        eventKey: 'dispute_awaiting_seller_collection',
      }
    case DISPUTE_STATUSES.COLLECTION_ARRANGED:
      return {
        key: 'disputed',
        label: 'Collection arranged',
        eventKey: 'dispute_collection_arranged',
      }
    case DISPUTE_STATUSES.COLLECTION_CONFIRMED:
      return {
        key: 'disputed',
        label: 'Collection confirmed',
        eventKey: 'dispute_collection_confirmed',
      }
    case DISPUTE_STATUSES.READY_FOR_REFUND:
      return {
        key: 'disputed',
        label: 'Ready for refund',
        eventKey: 'dispute_ready_for_refund',
      }
    case DISPUTE_STATUSES.REFUND_PENDING:
    case DISPUTE_STATUSES.PARTIAL_REFUND_PENDING:
      return {
        key: 'disputed',
        label: 'Refund pending',
        eventKey: 'dispute_refund_pending',
      }
    case DISPUTE_STATUSES.REFUND_COMPLETED:
      return {
        key: 'disputed',
        label: 'Refund completed',
        eventKey: 'dispute_refund_completed',
      }
    case DISPUTE_STATUSES.REJECTED:
      return {
        key: 'disputed',
        label: 'Claim rejected',
        eventKey: 'dispute_rejected',
      }
    case DISPUTE_STATUSES.RESOLVED:
    case DISPUTE_STATUSES.RESOLVED_BUYER:
    case DISPUTE_STATUSES.RESOLVED_SELLER:
      return {
        key: 'disputed',
        label: 'Case closed',
        eventKey: 'dispute_case_closed',
      }
    default:
      return {
        key: 'disputed',
        label: 'Dispute opened',
        eventKey: 'dispute_opened',
      }
  }
}

function buildTransactionStepDefinitions({
  order,
  payment,
  offer,
  viewerRole,
  cancelled,
  disputes = [],
  caseUpdates = [],
}) {
  const definitions = []

  if (offer && (offer.status === 'accepted' || isOfferCancelled(offer))) {
    definitions.push({
      key: 'offer_accepted',
      label: 'Offer accepted',
      timestamp: offer.updated_at ?? offer.created_at ?? null,
    })
  }

  if (order && offer && (offer.status === 'accepted' || isOfferCancelled(offer))) {
    definitions.push({
      key: 'listing_reserved',
      label: 'Listing reserved',
      timestamp: order.created_at ?? payment?.created_at ?? null,
    })
  }

  if (order) {
    definitions.push({
      key: 'order_created',
      label: 'Order created',
      timestamp: order.created_at ?? null,
    })
  }

  if (payment?.status === PAYMENT_STATUSES.PAID) {
    definitions.push({
      key: 'payment_received',
      label: 'Payment received',
      timestamp: payment.paid_at ?? null,
    })
  }

  if (order && payment?.status === PAYMENT_STATUSES.PAID) {
    for (const step of getFulfilmentSteps(order)) {
      const definition = {
        key: step.key,
        label: step.label,
        timestamp: step.timestamp,
        isCurrent: step.isCurrent,
      }

      if (
        step.key === 'delivery_confirmed' &&
        isFulfilmentTimelineStepComplete('delivery_confirmed', order, disputes)
      ) {
        const trackingDetail = getCourierDeliveryTimelineTrackingDetail(order)
        if (trackingDetail) {
          definition.detail = trackingDetail
        }
      }

      definitions.push(definition)
    }

    for (const step of buildDisputeTimelineSteps(order, disputes, caseUpdates)) {
      definitions.push({
        key: step.key,
        label: step.label,
        timestamp: step.timestamp,
      })
    }

    for (const step of getFinalLifecycleSteps(order, payment, cancelled, disputes)) {
      definitions.push({
        key: step.key,
        label: step.label,
        timestamp: step.timestamp,
      })
    }
  }

  if (order?.buyer_confirmed_at || isBuyerConfirmedOrLater(order)) {
    definitions.push({
      key: 'buyer_confirmed',
      label: getBuyerConfirmedLabel(viewerRole),
      timestamp: order.buyer_confirmed_at ?? null,
    })
  }

  if (cancelled) {
    definitions.push({
      key: 'transaction_cancelled',
      label: 'Transaction cancelled',
      timestamp:
        offer?.updated_at ?? payment?.updated_at ?? order?.updated_at ?? null,
    })
  }

  return definitions
}

function buildSupportRequestEvents(supportRequests, viewerRole, userId) {
  const events = []

  for (const request of supportRequests ?? []) {
    const suffix = request.id.slice(0, 8)

    events.push({
      id: `support_opened_${suffix}`,
      key: 'support_opened',
      label: getSupportOpenedLabel(request, viewerRole, userId),
      detail: formatSupportRequestReason(request.reason),
      timestamp: request.created_at ?? null,
      sortOrder: 1000,
    })

    if (
      request.status === SUPPORT_REQUEST_STATUSES.REVIEWING ||
      request.status === SUPPORT_REQUEST_STATUSES.RESOLVED ||
      request.status === SUPPORT_REQUEST_STATUSES.CLOSED
    ) {
      events.push({
        id: `support_reviewed_${suffix}`,
        key: 'support_reviewed',
        label: 'Support request reviewed',
        timestamp: null,
        sortOrder: 1100,
      })
    }

    if (
      request.status === SUPPORT_REQUEST_STATUSES.RESOLVED ||
      request.status === SUPPORT_REQUEST_STATUSES.CLOSED
    ) {
      events.push({
        id: `support_resolved_${suffix}`,
        key: 'support_resolved',
        label: 'Support request resolved',
        timestamp: request.resolved_at ?? null,
        sortOrder: 1200,
      })
    }

    if (request.status === SUPPORT_REQUEST_STATUSES.CLOSED) {
      events.push({
        id: `support_closed_${suffix}`,
        key: 'support_closed',
        label: 'Support request closed',
        timestamp: request.resolved_at ?? null,
        sortOrder: 1300,
      })
    }
  }

  return events
}

function getStepOrderIndex(key) {
  const baseIndex = BASE_TRANSACTION_STEP_ORDER.indexOf(key)
  if (baseIndex >= 0) return baseIndex

  const fulfilmentIndex = [
    'awaiting_collection',
    'collection_rejected',
    'awaiting_courier_collection',
    'awaiting_seller_delivery',
    'courier_evidence_submitted',
    'in_transit',
    'collection_confirmed',
    'delivery_confirmed',
    'delivered',
    'buyer_protection_active',
    ...DISPUTE_TIMELINE_STEP_ORDER,
    'buyer_confirmed',
  ].indexOf(key)

  if (fulfilmentIndex >= 0) {
    return BASE_TRANSACTION_STEP_ORDER.length + fulfilmentIndex
  }

  const postIndex = POST_PROTECTION_STEP_ORDER.indexOf(key)
  if (postIndex >= 0) {
    return BASE_TRANSACTION_STEP_ORDER.length + 20 + postIndex
  }

  if (key === 'transaction_cancelled') return 999
  if (key === 'payout_ready') return 200
  if (key === 'payout_processing') return 201
  if (key === 'seller_paid') return 202

  return 500
}

function isSellerOrAdminView(viewerRole) {
  return viewerRole === 'seller' || viewerRole === 'admin'
}

export function getOrderTimelineCurrentStage({
  order,
  payment,
  offer,
  supportRequests,
  disputes = [],
  caseUpdates = [],
  viewerRole,
}) {
  if (isTransactionCancelled({ order, payment, offer })) {
    return {
      key: 'cancelled',
      label: 'Cancelled',
      eventKey: 'transaction_cancelled',
    }
  }

  if (hasActiveSupportRequest(supportRequests)) {
    return {
      key: 'support_open',
      label: 'Support issue open',
      eventKey: 'support_opened',
    }
  }

  const disputeStage = getDisputeCurrentStage(order, disputes, caseUpdates)
  if (disputeStage) {
    return disputeStage
  }

  if (isOrderMarketplaceComplete(order)) {
    if (isPayoutReleased(order)) {
      return {
        key: 'completed',
        label: 'Order completed',
        eventKey: 'order_completed',
      }
    }

    if (isSellerOrAdminView(viewerRole)) {
      return {
        key: 'awaiting_payout',
        label: 'Awaiting payout',
        eventKey: 'awaiting_payout',
      }
    }

    return {
      key: 'order_completed',
      label: 'Order completed',
      eventKey: 'order_completed',
    }
  }

  if (isPayoutReleased(order)) {
    return {
      key: 'payout_released',
      label: 'Payout released',
      eventKey: 'payout_released',
    }
  }

  if (isBuyerProtectionWindowActive(order)) {
    return {
      key: 'buyer_protection_active',
      label: 'Buyer Protection active',
      eventKey: 'buyer_protection_active',
    }
  }

  if (payment?.status === PAYMENT_STATUSES.PAID) {
    const fulfilmentSteps = getFulfilmentSteps(order)
    const currentStep = fulfilmentSteps.find((step) => step.isCurrent)

    if (currentStep) {
      return {
        key: currentStep.key,
        label: currentStep.label,
        eventKey: currentStep.key,
      }
    }

    if (isBuyerProtectionCompleted(order, disputes) && !isOrderFulfilmentComplete(order)) {
      return {
        key: 'buyer_protection_completed',
        label: 'Buyer Protection completed',
        eventKey: 'buyer_protection_completed',
      }
    }
  }

  if (
    payment?.status !== PAYMENT_STATUSES.PAID &&
    order?.fulfilment_status === ORDER_FULFILMENT_STATUSES.AWAITING_PAYMENT
  ) {
    return {
      key: 'awaiting_payment',
      label: 'Awaiting payment',
      eventKey: 'order_created',
    }
  }

  return null
}

function getLifecycleMilestoneState(eventKey, order, currentEventKey, viewerRole, disputes = []) {
  let isComplete = false

  switch (eventKey) {
    case 'buyer_protection_active':
      if (isBuyerProtectionWindowActive(order)) {
        return eventKey === currentEventKey ? 'current' : 'complete'
      }
      if (isBuyerProtectionCompleted(order, disputes)) {
        return 'complete'
      }
      if (hasPausedDispute(order, disputes) || hasDisputeTimelineHistory(disputes)) {
        return 'complete'
      }
      return 'upcoming'
    case 'buyer_protection_completed':
      isComplete = isBuyerProtectionCompleted(order, disputes)
      break
    case 'order_completed':
      isComplete = isSellerOrAdminView(viewerRole)
        ? isOrderFulfilmentComplete(order)
        : isOrderMarketplaceComplete(order)
      break
    case 'awaiting_payout':
      if (isPayoutReleased(order)) return 'complete'
      if (eventKey === currentEventKey) return 'current'
      if (isBuyerProtectionCompleted(order, disputes)) return 'upcoming'
      return 'upcoming'
    case 'payout_released':
      isComplete = isPayoutReleased(order)
      break
    default:
      return null
  }

  if (isComplete) return 'complete'
  if (eventKey === currentEventKey) return 'current'
  return 'upcoming'
}

function filterTimelineEventsForViewer(events, viewerRole) {
  if (viewerRole === 'buyer') {
    return events.filter(
      (event) => event.key !== 'payout_released' && event.key !== 'awaiting_payout',
    )
  }

  return events
}

function getDisputeTimelineStepState(eventKey, order, disputes, currentEventKey, caseUpdates = []) {
  const steps = buildDisputeTimelineSteps(order, disputes, caseUpdates)
  const stepKeys = steps.map((step) => step.key)
  if (!stepKeys.includes(eventKey)) return null

  const currentIndex = stepKeys.indexOf(currentEventKey)
  const eventIndex = stepKeys.indexOf(eventKey)

  if (currentIndex === -1) return null

  if (eventIndex < currentIndex) return 'complete'
  if (eventIndex === currentIndex) return 'current'
  return 'upcoming'
}

function assignEventStates(events, currentEventKey, currentStage, order, viewerRole, disputes = [], caseUpdates = []) {
  let foundCurrent = false
  const lastSupportIndex =
    currentStage?.key === 'support_open'
      ? events.findLastIndex((event) => event.key === 'support_opened')
      : -1

  return events.map((event, index) => {
    const fulfilmentState = getFulfilmentTimelineStepState(
      event.key,
      order,
      currentEventKey,
      event,
      disputes,
    )
    if (fulfilmentState) {
      if (fulfilmentState === 'current') {
        foundCurrent = true
      }
      return { ...event, state: fulfilmentState }
    }

    const disputeState = getDisputeTimelineStepState(
      event.key,
      order,
      disputes,
      currentEventKey,
      caseUpdates,
    )
    if (disputeState) {
      if (disputeState === 'current') {
        foundCurrent = true
      }
      return { ...event, state: disputeState }
    }

    const milestoneState = getLifecycleMilestoneState(
      event.key,
      order,
      currentEventKey,
      viewerRole,
      disputes,
    )
    if (milestoneState) {
      if (milestoneState === 'current') {
        foundCurrent = true
      }
      return { ...event, state: milestoneState }
    }

    if (event.isCurrent && !foundCurrent) {
      foundCurrent = true
      return { ...event, state: 'current' }
    }

    if (lastSupportIndex >= 0) {
      if (index === lastSupportIndex) {
        return { ...event, state: 'current' }
      }

      if (index < lastSupportIndex) {
        return { ...event, state: 'complete' }
      }

      return { ...event, state: 'upcoming' }
    }

    if (event.key === currentEventKey && !foundCurrent) {
      foundCurrent = true
      return { ...event, state: 'current' }
    }

    if (!foundCurrent) {
      return { ...event, state: 'complete' }
    }

    return { ...event, state: 'upcoming' }
  })
}

function resolveCurrentEventKey(events, currentStage) {
  if (!currentStage) {
    const explicitCurrent = events.find((event) => event.isCurrent)
    if (explicitCurrent) return explicitCurrent.key
    return events.at(-1)?.key ?? null
  }

  if (currentStage.key === 'support_open') {
    return events.findLast((event) => event.key === 'support_opened')?.key ?? null
  }

  if (currentStage.key === 'cancelled') {
    return 'transaction_cancelled'
  }

  if (events.some((event) => event.key === currentStage.eventKey)) {
    return currentStage.eventKey
  }

  return events.at(-1)?.key ?? null
}

function sortTransactionEvents(events) {
  return [...events].sort(
    (a, b) => getStepOrderIndex(a.key) - getStepOrderIndex(b.key),
  )
}

function truncateAfterOrderCompleted(events, order, viewerRole) {
  const isComplete = isSellerOrAdminView(viewerRole)
    ? isOrderFulfilmentComplete(order)
    : isOrderMarketplaceComplete(order)

  if (!isComplete) {
    return events
  }

  const completeIndex = events.findIndex((event) => event.key === 'order_completed')
  if (completeIndex === -1) {
    return events
  }

  return events.slice(0, completeIndex + 1)
}

export function applyDuplicateTimestampLabels(events) {
  let lastTimestamp = null

  return events.map((event) => {
    if (!event.timestamp) {
      return { ...event, timestampLabel: null }
    }

    const parsed = parseTimestamp(event.timestamp)
    if (parsed === null) {
      return { ...event, timestampLabel: null }
    }

    if (lastTimestamp === parsed) {
      return { ...event, timestampLabel: 'Same time' }
    }

    lastTimestamp = parsed
    return {
      ...event,
      timestampLabel: formatTimelineTimestamp(event.timestamp),
    }
  })
}

export function buildOrderTimelineEvents({
  order,
  payment,
  offer,
  supportRequests,
  disputes = [],
  caseUpdates = [],
  viewerRole,
  userId,
}) {
  const cancelled = isTransactionCancelled({ order, payment, offer })
  const transactionEvents = sortTransactionEvents(
    buildTransactionStepDefinitions({
      order,
      payment,
      offer,
      viewerRole,
      cancelled,
      disputes,
      caseUpdates,
    }).map((step, index) => ({
      id: step.key,
      ...step,
      sortOrder: index,
    })),
  )

  let events = [...transactionEvents]

  if (order?.fulfilment_status !== ORDER_FULFILMENT_STATUSES.COMPLETED) {
    events = [...events, ...buildSupportRequestEvents(supportRequests, viewerRole, userId)]
  }

  events = truncateAfterOrderCompleted(events, order, viewerRole)

  return filterTimelineEventsForViewer(events, viewerRole)
}

export function buildOrderTimeline({
  order,
  payment,
  offer,
  supportRequests,
  disputes = [],
  caseUpdates = [],
  viewerRole,
  userId,
}) {
  const currentStage = getOrderTimelineCurrentStage({
    order,
    payment,
    offer,
    supportRequests,
    disputes,
    caseUpdates,
    viewerRole,
  })

  const events = buildOrderTimelineEvents({
    order,
    payment,
    offer,
    supportRequests,
    disputes,
    caseUpdates,
    viewerRole,
    userId,
  })

  const currentEventKey = resolveCurrentEventKey(events, currentStage)
  const eventsWithStates = assignEventStates(
    events,
    currentEventKey,
    currentStage,
    order,
    viewerRole,
    disputes,
    caseUpdates,
  )
  const eventsWithTimestamps = applyDuplicateTimestampLabels(eventsWithStates)

  return {
    currentStage,
    events: eventsWithTimestamps,
  }
}

export function formatTimelineTimestamp(value) {
  if (!value) return null
  return formatOrderTimestamp(value) || formatSupportRequestTimestamp(value)
}
