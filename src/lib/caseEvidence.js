import {
  getActiveOrderDispute,
  getLatestOrderDispute,
  isDisputeActive,
} from './orderDisputes'
import {
  getActiveSupportRequest,
  isSupportRequestActive,
} from './supportRequests'

export function getActiveOrderCase(disputes, supportRequests) {
  const dispute = getActiveOrderDispute(disputes)
  if (dispute) {
    return { type: 'dispute', record: dispute }
  }

  const support = getActiveSupportRequest(supportRequests)
  if (support) {
    return { type: 'support', record: support }
  }

  return null
}

export function isOrderCaseActive(activeCase) {
  if (!activeCase) return false

  if (activeCase.type === 'dispute') {
    return isDisputeActive(activeCase.record)
  }

  return isSupportRequestActive(activeCase.record)
}

export function orderHasCaseHistory(disputes, supportRequests) {
  return Boolean(getLatestOrderDispute(disputes)) || (supportRequests ?? []).length > 0
}

export function isOrderParticipant(order, userId) {
  if (!order?.id || !userId) return false
  return order.buyer_id === userId || order.seller_id === userId
}

export function isParticipantViewerRole(role) {
  return role === 'buyer' || role === 'seller'
}

export function canParticipantUploadAdditionalEvidence(activeCase, order, userId) {
  if (!activeCase || !order?.id || !userId) return false
  if (!isOrderCaseActive(activeCase)) return false

  return isOrderParticipant(order, userId)
}

export function canShowParticipantCaseEvidenceUpload(activeCase, order, role, userId) {
  return (
    isParticipantViewerRole(role) &&
    canParticipantUploadAdditionalEvidence(activeCase, order, userId)
  )
}
