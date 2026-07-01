import { getOrderTimelineCurrentStage } from './orderTimeline'
import { getStatusBadgeFromOrderLifecycleStage } from './orderLifecycleStatus'

/**
 * Authoritative order status badge — same timeline stage logic as Order Detail.
 */
export function getOrderStatusBadge({
  order,
  payment = null,
  offer = null,
  supportRequests = null,
  disputes = [],
  caseUpdates = [],
  viewerRole = null,
} = {}) {
  const stage = getOrderTimelineCurrentStage({
    order,
    payment,
    offer,
    supportRequests,
    disputes,
    caseUpdates,
    viewerRole,
  })

  return getStatusBadgeFromOrderLifecycleStage(stage, { viewerRole })
}
