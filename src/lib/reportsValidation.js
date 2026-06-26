export const REPORT_TYPES = {
  LISTING: 'listing',
  USER: 'user',
  CONVERSATION: 'conversation',
  MESSAGE: 'message',
}

export const REPORT_STATUSES = {
  OPEN: 'open',
  UNDER_REVIEW: 'under_review',
  RESOLVED: 'resolved',
  DISMISSED: 'dismissed',
}

export const REPORT_REASONS = {
  SUSPECTED_FRAUD: 'suspected_fraud',
  MISLEADING_LISTING: 'misleading_listing',
  PROHIBITED_ITEM: 'prohibited_item',
  DUPLICATE_LISTING: 'duplicate_listing',
  INCORRECT_CATEGORY: 'incorrect_category',
  OFFENSIVE_CONTENT: 'offensive_content',
  REQUESTED_OFF_PLATFORM_PAYMENT: 'requested_off_platform_payment',
  SUSPICIOUS_BEHAVIOUR: 'suspicious_behaviour',
  HARASSMENT: 'harassment',
  NO_SHOW: 'no_show',
  ABUSIVE_LANGUAGE: 'abusive_language',
  FRAUD: 'fraud',
  SHARED_CONTACT_DETAILS: 'shared_contact_details',
  OTHER: 'other',
}

const LISTING_REASON_OPTIONS = [
  { value: REPORT_REASONS.SUSPECTED_FRAUD, label: 'Suspected fraud' },
  { value: REPORT_REASONS.MISLEADING_LISTING, label: 'Misleading listing' },
  { value: REPORT_REASONS.PROHIBITED_ITEM, label: 'Prohibited item' },
  { value: REPORT_REASONS.DUPLICATE_LISTING, label: 'Duplicate listing' },
  { value: REPORT_REASONS.INCORRECT_CATEGORY, label: 'Incorrect category' },
  { value: REPORT_REASONS.OFFENSIVE_CONTENT, label: 'Offensive content' },
  { value: REPORT_REASONS.OTHER, label: 'Other' },
]

const USER_REASON_OPTIONS = [
  {
    value: REPORT_REASONS.REQUESTED_OFF_PLATFORM_PAYMENT,
    label: 'Requested off-platform payment',
  },
  { value: REPORT_REASONS.SUSPICIOUS_BEHAVIOUR, label: 'Suspicious behaviour' },
  { value: REPORT_REASONS.HARASSMENT, label: 'Harassment' },
  { value: REPORT_REASONS.NO_SHOW, label: 'No show' },
  { value: REPORT_REASONS.ABUSIVE_LANGUAGE, label: 'Abusive language' },
  { value: REPORT_REASONS.FRAUD, label: 'Fraud' },
  { value: REPORT_REASONS.OTHER, label: 'Other' },
]

const CONVERSATION_REASON_OPTIONS = [
  {
    value: REPORT_REASONS.REQUESTED_OFF_PLATFORM_PAYMENT,
    label: 'Requested off-platform payment',
  },
  { value: REPORT_REASONS.SHARED_CONTACT_DETAILS, label: 'Shared contact details' },
  { value: REPORT_REASONS.HARASSMENT, label: 'Harassment' },
  { value: REPORT_REASONS.ABUSIVE_LANGUAGE, label: 'Abusive language' },
  { value: REPORT_REASONS.SUSPICIOUS_BEHAVIOUR, label: 'Suspicious behaviour' },
  { value: REPORT_REASONS.OTHER, label: 'Other' },
]

export const REPORT_SUBMITTED_MESSAGE = 'Thanks, your report has been submitted.'
export const REPORT_OPEN_WARNING =
  'You already have an open report for this item. Equipd will review it soon.'

const REPORT_TYPE_LABELS = {
  [REPORT_TYPES.LISTING]: 'Report listing',
  [REPORT_TYPES.USER]: 'Report user',
  [REPORT_TYPES.CONVERSATION]: 'Report conversation',
  [REPORT_TYPES.MESSAGE]: 'Report message',
}

const REASON_OPTIONS_BY_TYPE = {
  [REPORT_TYPES.LISTING]: LISTING_REASON_OPTIONS,
  [REPORT_TYPES.USER]: USER_REASON_OPTIONS,
  [REPORT_TYPES.CONVERSATION]: CONVERSATION_REASON_OPTIONS,
  [REPORT_TYPES.MESSAGE]: CONVERSATION_REASON_OPTIONS,
}

export function getReportReasons(reportType) {
  return REASON_OPTIONS_BY_TYPE[reportType] ?? []
}

export function getReportModalTitle(reportType) {
  return REPORT_TYPE_LABELS[reportType] ?? 'Report'
}

export function formatReportReason(reason) {
  const allOptions = [
    ...LISTING_REASON_OPTIONS,
    ...USER_REASON_OPTIONS,
    ...CONVERSATION_REASON_OPTIONS,
  ]
  const option = allOptions.find((entry) => entry.value === reason)
  return option?.label ?? reason
}

export function formatReportStatus(status) {
  const labels = {
    open: 'Open',
    under_review: 'Under review',
    resolved: 'Resolved',
    dismissed: 'Dismissed',
  }

  return labels[status] ?? status
}

export function formatReportType(reportType) {
  const labels = {
    listing: 'Listing',
    user: 'User',
    conversation: 'Conversation',
    message: 'Message',
  }

  return labels[reportType] ?? reportType
}

export function getReportErrorMessage(error) {
  if (!error) return 'Something went wrong. Please try again.'
  return error.message || 'Something went wrong. Please try again.'
}

export function validateReportInput({ reportType, reason, description }) {
  if (!reportType) {
    return { ok: false, error: 'Report type is required.' }
  }

  if (!reason) {
    return { ok: false, error: 'Please choose a reason.' }
  }

  const allowedReasons = getReportReasons(reportType).map((entry) => entry.value)

  if (!allowedReasons.includes(reason)) {
    return { ok: false, error: 'Please choose a valid reason.' }
  }

  const trimmedDescription = description?.trim() ?? ''

  if (reason === REPORT_REASONS.OTHER && !trimmedDescription) {
    return { ok: false, error: 'Please describe the issue when selecting Other.' }
  }

  return { ok: true, description: trimmedDescription || null }
}

export function canReportListing(listing, userId) {
  if (!listing?.id || !userId) return false
  return listing.seller_id !== userId
}

export function canReportUser(reportedUserId, userId) {
  if (!reportedUserId || !userId) return false
  return reportedUserId !== userId
}

export function canReportConversation(conversation, userId) {
  if (!conversation?.id || !userId) return false
  return conversation.buyer_id === userId || conversation.seller_id === userId
}
