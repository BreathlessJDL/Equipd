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
  isOrderDisputeOpen,
  isOrderDisputed,
  isOrderRefundPending,
} from './orderDisputes'
import { CASE_OUTCOMES, isCaseClosed } from './caseClosure'
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

const POST_SUCCESS_MILESTONE_KEYS = new Set([
  ...POST_PROTECTION_STEP_ORDER,
  'payout_ready',
  'payout_processing',
  'seller_paid',
])

const REFUND_TERMINAL_TIMELINE_KEYS = new Set([
  'dispute_case_closed',
  'dispute_refund_completed',
  'dispute_rejected',
  'support_closed',
])

const REFUND_CASE_OUTCOMES = new Set([
  CASE_OUTCOMES.BUYER_UPHELD_FULL_REFUND,
  CASE_OUTCOMES.BUYER_UPHELD_PARTIAL_REFUND,
])

function isBuyerProtectionActive(order) {
  return isBuyerProtectionWindowActive(order)
}

const DISPUTE_TIMELINE_STEP_ORDER = [
  'dispute_opened',
  'dispute_under_review',
  'dispute_return_authorised',
  'dispute_collection_confirmed',
  'dispute_refund_pending',
  'dispute_refund_completed',
  'dispute_rejected',
  'dispute_case_closed',
]

function hasPausedDispute(order, disputes) {
  return isOrderDisputeOpen(order, disputes)
}

export function isOrderRefunded(order, disputes = [], caseUpdates = []) {
  if (!order) return false

  if (order.fulfilment_status === ORDER_FULFILMENT_STATUSES.REFUNDED) return true
  if (order.payout_status === PAYOUT_STATUSES.CANCELLED) return true

  const dispute = getLatestOrderDispute(disputes)
  if (dispute?.refund_completed_at) return true

  const refundCompletedInTimeline = (caseUpdates ?? []).some(
    (update) => update.event_type === 'refund_completed',
  )
  if (refundCompletedInTimeline) return true

  if (dispute && REFUND_CASE_OUTCOMES.has(dispute.case_outcome)) {
    return (
      dispute.status === DISPUTE_STATUSES.RESOLVED ||
      dispute.status === DISPUTE_STATUSES.RESOLVED_BUYER ||
      refundCompletedInTimeline
    )
  }

  return false
}

function shouldSuppressPostSuccessMilestones(order, disputes = [], caseUpdates = []) {
  if (isOrderRefunded(order, disputes, caseUpdates)) return true
  if (isOrderRefundPending(order)) return true

  const dispute = getLatestOrderDispute(disputes)
  if (
    dispute?.status === DISPUTE_STATUSES.REFUND_PENDING ||
    dispute?.status === DISPUTE_STATUSES.PARTIAL_REFUND_PENDING
  ) {
    return true
  }

  return hasPausedDispute(order, disputes)
}

function isFulfilmentPlaceholderStep(eventKey) {
  return (
    FULFILMENT_TIMELINE_STEP_KEYS.has(eventKey) ||
    eventKey === 'awaiting_collection' ||
    eventKey === 'collection_rejected'
  )
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

function getFinalLifecycleSteps(order, payment, cancelled, disputes = [], caseUpdates = []) {
  if (cancelled || payment?.status !== PAYMENT_STATUSES.PAID || !order) {
    return []
  }

  if (shouldSuppressPostSuccessMilestones(order, disputes, caseUpdates)) {
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

const DISPUTE_STATUS_PROGRESS = {
  [DISPUTE_STATUSES.OPEN]: 10,
  [DISPUTE_STATUSES.UNDER_REVIEW]: 20,
  [DISPUTE_STATUSES.AWAITING_BUYER_EVIDENCE]: 20,
  [DISPUTE_STATUSES.AWAITING_SELLER_EVIDENCE]: 20,
  [DISPUTE_STATUSES.RETURN_AUTHORISED]: 40,
  [DISPUTE_STATUSES.AWAITING_SELLER_COLLECTION]: 45,
  [DISPUTE_STATUSES.COLLECTION_ARRANGED]: 50,
  [DISPUTE_STATUSES.COLLECTION_CONFIRMED]: 60,
  [DISPUTE_STATUSES.READY_FOR_REFUND]: 65,
  [DISPUTE_STATUSES.REFUND_PENDING]: 70,
  [DISPUTE_STATUSES.PARTIAL_REFUND_PENDING]: 70,
  [DISPUTE_STATUSES.REFUND_COMPLETED]: 80,
  [DISPUTE_STATUSES.REJECTED]: 90,
  [DISPUTE_STATUSES.RESOLVED]: 100,
  [DISPUTE_STATUSES.RESOLVED_BUYER]: 100,
  [DISPUTE_STATUSES.RESOLVED_SELLER]: 100,
  [DISPUTE_STATUSES.CANCELLED]: 100,
}

const TERMINAL_DISPUTE_STATUSES = new Set([
  DISPUTE_STATUSES.REJECTED,
  DISPUTE_STATUSES.RESOLVED,
  DISPUTE_STATUSES.RESOLVED_BUYER,
  DISPUTE_STATUSES.RESOLVED_SELLER,
  DISPUTE_STATUSES.CANCELLED,
])

const DISPUTE_MILESTONE_EVENT_TO_STEP_KEY = {
  case_opened: 'dispute_opened',
  return_authorised: 'dispute_return_authorised',
  collection_confirmed: 'dispute_collection_confirmed',
  refund_pending: 'dispute_refund_pending',
  refund_completed: 'dispute_refund_completed',
  case_closed: 'dispute_case_closed',
}

function disputeStatusProgress(status) {
  return DISPUTE_STATUS_PROGRESS[status] ?? 0
}

function isTerminalDisputeStatus(status) {
  return TERMINAL_DISPUTE_STATUSES.has(status)
}

function getDisputeResolutionTimelineLabel(dispute) {
  if (dispute?.status === DISPUTE_STATUSES.REJECTED) {
    return 'Claim rejected'
  }

  switch (dispute?.case_outcome) {
    case CASE_OUTCOMES.BUYER_UPHELD_FULL_REFUND:
      return 'Full refund approved'
    case CASE_OUTCOMES.BUYER_UPHELD_PARTIAL_REFUND:
      return 'Partial refund agreed'
    case CASE_OUTCOMES.SELLER_UPHELD:
      return 'Claim rejected'
    default:
      return 'Case closed'
  }
}

function disputeHadReturnWorkflow(dispute, caseUpdates = []) {
  if ((caseUpdates ?? []).some((update) => update.event_type === 'return_authorised')) {
    return true
  }

  return [
    DISPUTE_STATUSES.RETURN_AUTHORISED,
    DISPUTE_STATUSES.AWAITING_SELLER_COLLECTION,
    DISPUTE_STATUSES.COLLECTION_ARRANGED,
    DISPUTE_STATUSES.COLLECTION_CONFIRMED,
    DISPUTE_STATUSES.READY_FOR_REFUND,
  ].includes(dispute?.status)
}

function disputeHadRefundWorkflow(dispute, caseUpdates = []) {
  if (
    [
      DISPUTE_STATUSES.REFUND_PENDING,
      DISPUTE_STATUSES.PARTIAL_REFUND_PENDING,
      DISPUTE_STATUSES.REFUND_COMPLETED,
    ].includes(dispute?.status)
  ) {
    return true
  }

  if (
    dispute?.case_outcome === CASE_OUTCOMES.BUYER_UPHELD_FULL_REFUND ||
    dispute?.case_outcome === CASE_OUTCOMES.BUYER_UPHELD_PARTIAL_REFUND
  ) {
    return true
  }

  return (caseUpdates ?? []).some(
    (update) =>
      update.event_type === 'refund_pending' || update.event_type === 'refund_completed',
  )
}

function buildSimplifiedDisputeTimelineSteps(order, dispute, caseUpdates = []) {
  const steps = [
    {
      key: 'dispute_opened',
      label: 'Dispute opened',
      timestamp: dispute?.created_at ?? order?.updated_at ?? null,
    },
  ]

  if (!dispute) {
    if (isOrderDisputed(order)) {
      steps.push({ key: 'dispute_under_review', label: 'Under review', timestamp: null })
    }
    return steps
  }

  const { status } = dispute
  const progress = disputeStatusProgress(status)
  const terminal = isTerminalDisputeStatus(status)

  if (
    !terminal &&
    progress <= disputeStatusProgress(DISPUTE_STATUSES.AWAITING_SELLER_EVIDENCE)
  ) {
    steps.push({
      key: 'dispute_under_review',
      label: 'Under review',
      timestamp: dispute.updated_at ?? null,
    })
  }

  const hadReturnWorkflow = disputeHadReturnWorkflow(dispute, caseUpdates)

  if (hadReturnWorkflow) {
    steps.push({
      key: 'dispute_return_authorised',
      label: 'Return authorised',
      timestamp: null,
    })
  }

  if (
    hadReturnWorkflow &&
    progress >= disputeStatusProgress(DISPUTE_STATUSES.COLLECTION_CONFIRMED)
  ) {
    steps.push({
      key: 'dispute_collection_confirmed',
      label: 'Collection confirmed',
      timestamp: null,
    })
  }

  const hadRefundWorkflow = disputeHadRefundWorkflow(dispute, caseUpdates)

  if (hadRefundWorkflow) {
    steps.push({
      key: 'dispute_refund_pending',
      label:
        status === DISPUTE_STATUSES.PARTIAL_REFUND_PENDING
          ? 'Partial refund pending'
          : 'Refund pending',
      timestamp: dispute.updated_at ?? null,
    })
  }

  if (
    hadRefundWorkflow &&
    (status === DISPUTE_STATUSES.REFUND_COMPLETED ||
      progress >= disputeStatusProgress(DISPUTE_STATUSES.REFUND_COMPLETED) ||
      dispute.refund_completed_at)
  ) {
    steps.push({
      key: 'dispute_refund_completed',
      label: 'Refund completed',
      timestamp: dispute.refund_completed_at ?? dispute.updated_at ?? null,
    })
  }

  if (terminal) {
    const finalKey =
      status === DISPUTE_STATUSES.REJECTED ||
      dispute.case_outcome === CASE_OUTCOMES.SELLER_UPHELD
        ? 'dispute_rejected'
        : 'dispute_case_closed'

    if (!steps.some((step) => step.key === finalKey)) {
      steps.push({
        key: finalKey,
        label: getDisputeResolutionTimelineLabel(dispute),
        timestamp: dispute.resolved_at ?? dispute.updated_at ?? null,
      })
    }
  }

  return steps
}

function applyDisputeMilestoneTimestamps(steps, caseUpdates) {
  const timestampsByKey = {}

  for (const update of caseUpdates ?? []) {
    const stepKey = DISPUTE_MILESTONE_EVENT_TO_STEP_KEY[update.event_type]
    if (!stepKey || timestampsByKey[stepKey]) continue
    timestampsByKey[stepKey] = update.created_at ?? null
  }

  return steps.map((step) => ({
    ...step,
    timestamp: timestampsByKey[step.key] ?? step.timestamp,
  }))
}

export function buildDisputeTimelineSteps(order, disputes = [], caseUpdates = []) {
  const dispute = getDisputeForTimeline(order, disputes)
  if (!dispute && !isOrderDisputed(order)) return []

  const disputeUpdates = getDisputeCaseUpdates(caseUpdates, dispute?.id)
  const steps = buildSimplifiedDisputeTimelineSteps(order, dispute, disputeUpdates)
  return applyDisputeMilestoneTimestamps(steps, disputeUpdates)
}

function getDisputeCurrentStage(order, disputes = [], caseUpdates = []) {
  const dispute = getDisputeForTimeline(order, disputes)
  if (!dispute && !isOrderDisputed(order)) return null

  const steps = buildDisputeTimelineSteps(order, disputes, caseUpdates)
  if (steps.length > 0) {
    const latestStep = steps[steps.length - 1]
    const closed = dispute && isCaseClosed(dispute)
    return {
      key: closed ? 'case_closed' : 'disputed',
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
        key: 'case_closed',
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

    for (const step of getFinalLifecycleSteps(order, payment, cancelled, disputes, caseUpdates)) {
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

  if (isOrderRefunded(order, disputes, caseUpdates)) {
    const disputeStage = getDisputeCurrentStage(order, disputes, caseUpdates)
    if (disputeStage) return disputeStage

    return {
      key: 'case_closed',
      label: 'Case closed',
      eventKey: 'dispute_case_closed',
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

  let currentIndex = stepKeys.indexOf(currentEventKey)
  if (currentIndex === -1) {
    const dispute = getDisputeForTimeline(order, disputes)
    if (dispute && isTerminalDisputeStatus(dispute.status)) {
      currentIndex = stepKeys.length - 1
    } else {
      return null
    }
  }

  const eventIndex = stepKeys.indexOf(eventKey)

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

  if (currentStage.key === 'case_closed' && currentStage.eventKey) {
    if (events.some((event) => event.key === currentStage.eventKey)) {
      return currentStage.eventKey
    }
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

function filterTimelineEventsForRefundedOrder(events, order, disputes, caseUpdates) {
  if (!isOrderRefunded(order, disputes, caseUpdates)) {
    return events
  }

  let filtered = events.filter((event) => !POST_SUCCESS_MILESTONE_KEYS.has(event.key))

  filtered = filtered.filter((event) => {
    if (event.state !== 'upcoming') return true
    return !isFulfilmentPlaceholderStep(event.key)
  })

  let lastTerminalIndex = -1
  for (let index = 0; index < filtered.length; index += 1) {
    if (REFUND_TERMINAL_TIMELINE_KEYS.has(filtered[index].key)) {
      lastTerminalIndex = index
    }
  }

  if (lastTerminalIndex >= 0) {
    filtered = filtered.slice(0, lastTerminalIndex + 1)
  }

  return filtered
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
  const filteredEvents = filterTimelineEventsForRefundedOrder(
    eventsWithStates,
    order,
    disputes,
    caseUpdates,
  )
  const eventsWithTimestamps = applyDuplicateTimestampLabels(filteredEvents)

  return {
    currentStage,
    events: eventsWithTimestamps,
  }
}

export function formatTimelineTimestamp(value) {
  if (!value) return null
  return formatOrderTimestamp(value) || formatSupportRequestTimestamp(value)
}
