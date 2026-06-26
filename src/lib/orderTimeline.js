import { isOfferCancelled } from './offers'
import {
  formatOrderTimestamp,
  hasBuyerTakenPossession,
  isPayoutReleased,
  ORDER_FULFILMENT_STATUSES,
  ORDER_TYPES,
  PAYOUT_STATUSES,
} from './orders'
import { PAYMENT_STATUSES } from './payments'
import {
  isBuyerProtectionWindowActive,
  isOrderDisputed,
} from './orderDisputes'
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

function isBuyerProtectionCompleted(order) {
  if (order?.protection_status === 'released') return true
  if (
    order?.fulfilment_status === ORDER_FULFILMENT_STATUSES.COMPLETED &&
    !isBuyerProtectionActive(order)
  ) {
    return true
  }
  return hasBuyerTakenPossession(order) && !isBuyerProtectionActive(order)
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

function isFulfilmentTimelineStepComplete(stepKey, order) {
  if (!order) return false

  const status = order.fulfilment_status

  switch (stepKey) {
    case 'awaiting_collection':
      return (
        hasBuyerTakenPossession(order) ||
        status === ORDER_FULFILMENT_STATUSES.BUYER_CONFIRMED ||
        status === ORDER_FULFILMENT_STATUSES.COMPLETED ||
        isBuyerProtectionActive(order) ||
        isBuyerProtectionCompleted(order)
      )
    case 'awaiting_seller_delivery':
      return (
        status === ORDER_FULFILMENT_STATUSES.COLLECTED ||
        status === ORDER_FULFILMENT_STATUSES.BUYER_CONFIRMED ||
        status === ORDER_FULFILMENT_STATUSES.COMPLETED ||
        isBuyerProtectionActive(order) ||
        isBuyerProtectionCompleted(order)
      )
    case 'awaiting_courier_collection':
      return (
        Boolean(order.courier_evidence_submitted_at) ||
        status === ORDER_FULFILMENT_STATUSES.IN_TRANSIT ||
        status === ORDER_FULFILMENT_STATUSES.DELIVERED ||
        status === ORDER_FULFILMENT_STATUSES.COMPLETED ||
        isBuyerProtectionActive(order) ||
        isBuyerProtectionCompleted(order)
      )
    case 'courier_evidence_submitted':
      return (
        Boolean(order.courier_collected_at) ||
        status === ORDER_FULFILMENT_STATUSES.DELIVERED ||
        status === ORDER_FULFILMENT_STATUSES.COMPLETED ||
        isBuyerProtectionCompleted(order)
      )
    case 'in_transit':
      return (
        Boolean(order.courier_delivered_at || order.delivered_at) ||
        status === ORDER_FULFILMENT_STATUSES.DELIVERED ||
        status === ORDER_FULFILMENT_STATUSES.COMPLETED ||
        isBuyerProtectionCompleted(order)
      )
    case 'delivery_confirmed':
      return (
        Boolean(order.courier_delivered_at || order.delivered_at) ||
        isBuyerProtectionActive(order) ||
        isBuyerProtectionCompleted(order) ||
        status === ORDER_FULFILMENT_STATUSES.COMPLETED
      )
    case 'collection_confirmed':
      return (
        Boolean(order.collection_confirmed_at || order.collected_at) ||
        status === ORDER_FULFILMENT_STATUSES.COLLECTED ||
        status === ORDER_FULFILMENT_STATUSES.BUYER_CONFIRMED ||
        status === ORDER_FULFILMENT_STATUSES.COMPLETED ||
        isBuyerProtectionActive(order) ||
        isBuyerProtectionCompleted(order)
      )
    case 'buyer_protection_active':
      return isBuyerProtectionCompleted(order)
    default:
      return false
  }
}

function getFulfilmentTimelineStepState(eventKey, order, currentEventKey, event) {
  if (!FULFILMENT_TIMELINE_STEP_KEYS.has(eventKey)) return null

  if (isFulfilmentTimelineStepComplete(eventKey, order)) {
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
        status === ORDER_FULFILMENT_STATUSES.AWAITING_COLLECTION ||
        (status === ORDER_FULFILMENT_STATUSES.PAID &&
          orderType === ORDER_TYPES.COLLECTION),
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

function getFinalLifecycleSteps(order, payment, cancelled) {
  if (cancelled || payment?.status !== PAYMENT_STATUSES.PAID || !order) {
    return []
  }

  const protectionCompleted = isBuyerProtectionCompleted(order)
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

function getDisputeSteps(order) {
  if (!isOrderDisputed(order)) return []

  return [
    {
      key: 'dispute_opened',
      label: 'Dispute opened',
      timestamp: order?.updated_at ?? null,
      isCurrent: order?.fulfilment_status === ORDER_FULFILMENT_STATUSES.DISPUTED,
    },
    {
      key: 'dispute_under_review',
      label: 'Under review',
      timestamp: null,
      isCurrent: order?.fulfilment_status === ORDER_FULFILMENT_STATUSES.DISPUTED,
    },
  ]
}

function buildTransactionStepDefinitions({ order, payment, offer, viewerRole, cancelled }) {
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
      definitions.push({
        key: step.key,
        label: step.label,
        timestamp: step.timestamp,
        isCurrent: step.isCurrent,
      })
    }

    for (const step of getDisputeSteps(order)) {
      definitions.push({
        key: step.key,
        label: step.label,
        timestamp: step.timestamp,
        isCurrent: step.isCurrent,
      })
    }

    for (const step of getFinalLifecycleSteps(order, payment, cancelled)) {
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
    'awaiting_courier_collection',
    'awaiting_seller_delivery',
    'courier_evidence_submitted',
    'in_transit',
    'collection_confirmed',
    'delivery_confirmed',
    'delivered',
    'buyer_protection_active',
    'dispute_opened',
    'dispute_under_review',
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

  if (isOrderDisputed(order)) {
    return {
      key: 'disputed',
      label: 'Dispute under review',
      eventKey: 'dispute_under_review',
    }
  }

  if (isBuyerProtectionActive(order)) {
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

    if (isBuyerProtectionCompleted(order) && !isOrderFulfilmentComplete(order)) {
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

function getLifecycleMilestoneState(eventKey, order, currentEventKey, viewerRole) {
  let isComplete = false

  switch (eventKey) {
    case 'buyer_protection_active':
      if (isBuyerProtectionActive(order)) {
        return eventKey === currentEventKey ? 'current' : 'complete'
      }
      if (isBuyerProtectionCompleted(order)) {
        return 'complete'
      }
      return 'upcoming'
    case 'buyer_protection_completed':
      isComplete = isBuyerProtectionCompleted(order)
      break
    case 'order_completed':
      isComplete = isSellerOrAdminView(viewerRole)
        ? isOrderFulfilmentComplete(order)
        : isOrderMarketplaceComplete(order)
      break
    case 'awaiting_payout':
      if (isPayoutReleased(order)) return 'complete'
      if (eventKey === currentEventKey) return 'current'
      if (isBuyerProtectionCompleted(order)) return 'upcoming'
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

function assignEventStates(events, currentEventKey, currentStage, order, viewerRole) {
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
    )
    if (fulfilmentState) {
      if (fulfilmentState === 'current') {
        foundCurrent = true
      }
      return { ...event, state: fulfilmentState }
    }

    const milestoneState = getLifecycleMilestoneState(
      event.key,
      order,
      currentEventKey,
      viewerRole,
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

export function buildOrderTimeline({ order, payment, offer, supportRequests, viewerRole, userId }) {
  const currentStage = getOrderTimelineCurrentStage({
    order,
    payment,
    offer,
    supportRequests,
    viewerRole,
  })

  const events = buildOrderTimelineEvents({
    order,
    payment,
    offer,
    supportRequests,
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
