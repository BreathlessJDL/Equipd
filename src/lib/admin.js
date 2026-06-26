import { supabase } from './supabase'
import { formatOrderFulfilmentStatus, formatOrderTimestamp, formatPayoutStatus } from './orders'
import { formatPaymentStatus } from './payments'
import { formatPricePence } from './listings'
import {
  formatReportReason,
  formatReportStatus,
  formatReportType,
  getReportErrorMessage,
  REPORT_STATUSES,
} from './reports'
import {
  formatSupportRequestReason,
  formatSupportRequestStatus,
  formatSupportRequestTimestamp,
  getSupportRequestErrorMessage,
  SUPPORT_REQUEST_STATUSES,
} from './supportRequests'

export const ADMIN_ORDER_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'awaiting_payment', label: 'Awaiting payment' },
  { value: 'paid_in_progress', label: 'Paid / in progress' },
  { value: 'buyer_confirmed', label: 'Buyer confirmed' },
  { value: 'completed', label: 'Completed' },
  { value: 'payout_failed', label: 'Payout failed' },
  { value: 'cancelled', label: 'Cancelled' },
]

export const ADMIN_ORDER_WARNING_TYPES = {
  PAID_NOT_COMPLETED: 'paid_not_completed',
  CONFIRMED_PAYOUT_UNPAID: 'confirmed_payout_unpaid',
  PAYOUT_FAILED: 'payout_failed',
  SELLER_SETUP_MISSING: 'seller_setup_missing',
  CANCELLED: 'cancelled',
}

const ADMIN_ORDER_WARNING_LABELS = {
  [ADMIN_ORDER_WARNING_TYPES.PAID_NOT_COMPLETED]: 'Payment paid but order not completed',
  [ADMIN_ORDER_WARNING_TYPES.CONFIRMED_PAYOUT_UNPAID]: 'Buyer confirmed but payout not paid',
  [ADMIN_ORDER_WARNING_TYPES.PAYOUT_FAILED]: 'Payout failed',
  [ADMIN_ORDER_WARNING_TYPES.SELLER_SETUP_MISSING]: 'Seller setup missing',
  [ADMIN_ORDER_WARNING_TYPES.CANCELLED]: 'Cancelled',
}

export const ADMIN_SUPPORT_STATUS_FILTERS = [
  { value: 'all', label: 'All' },
  { value: SUPPORT_REQUEST_STATUSES.OPEN, label: 'Open' },
  { value: SUPPORT_REQUEST_STATUSES.REVIEWING, label: 'Reviewing' },
  { value: SUPPORT_REQUEST_STATUSES.RESOLVED, label: 'Resolved' },
  { value: SUPPORT_REQUEST_STATUSES.CLOSED, label: 'Closed' },
]

export const ADMIN_SUPPORT_STATUS_OPTIONS = [
  { value: SUPPORT_REQUEST_STATUSES.OPEN, label: formatSupportRequestStatus('open') },
  { value: SUPPORT_REQUEST_STATUSES.REVIEWING, label: formatSupportRequestStatus('reviewing') },
  { value: SUPPORT_REQUEST_STATUSES.RESOLVED, label: formatSupportRequestStatus('resolved') },
  { value: SUPPORT_REQUEST_STATUSES.CLOSED, label: formatSupportRequestStatus('closed') },
]

export const ADMIN_REPORT_STATUS_FILTERS = [
  { value: 'all', label: 'All' },
  { value: REPORT_STATUSES.OPEN, label: 'Open' },
  { value: REPORT_STATUSES.UNDER_REVIEW, label: 'Under review' },
  { value: REPORT_STATUSES.RESOLVED, label: 'Resolved' },
  { value: REPORT_STATUSES.DISMISSED, label: 'Dismissed' },
]

export const ADMIN_REPORT_STATUS_OPTIONS = [
  { value: REPORT_STATUSES.OPEN, label: formatReportStatus('open') },
  { value: REPORT_STATUSES.UNDER_REVIEW, label: formatReportStatus('under_review') },
  { value: REPORT_STATUSES.RESOLVED, label: formatReportStatus('resolved') },
  { value: REPORT_STATUSES.DISMISSED, label: formatReportStatus('dismissed') },
]

export function isUserAdmin(profile) {
  return profile?.is_admin === true
}

export function getAdminErrorMessage(error) {
  if (!error) return 'Something went wrong. Please try again.'
  return error.message || 'Something went wrong. Please try again.'
}

export function formatAdminUserLabel(userId, displayName) {
  if (displayName?.trim()) return displayName.trim()
  if (!userId) return 'Unknown user'
  return `${userId.slice(0, 8)}…`
}

export async function fetchAdminSupportRequests(statusFilter = 'all') {
  if (!supabase) {
    return { data: null, error: new Error('Supabase is not configured.') }
  }

  const { data, error } = await supabase.rpc('admin_list_support_requests', {
    p_status: statusFilter === 'all' ? null : statusFilter,
  })

  return { data: data ?? [], error }
}

export async function updateAdminSupportRequest({
  requestId,
  status,
  adminNotes = '',
  resolutionNotes = '',
}) {
  if (!supabase) {
    return { data: null, error: new Error('Supabase is not configured.') }
  }

  const { data, error } = await supabase.rpc('admin_update_support_request', {
    p_request_id: requestId,
    p_status: status,
    p_admin_notes: adminNotes,
    p_resolution_notes: resolutionNotes,
  })

  return { data, error }
}

export async function fetchOpenReports(statusFilter = REPORT_STATUSES.OPEN) {
  return fetchAdminReports(statusFilter)
}

export async function fetchAdminReports(statusFilter = 'all') {
  if (!supabase) {
    return { data: null, error: new Error('Supabase is not configured.') }
  }

  const { data, error } = await supabase.rpc('admin_list_reports', {
    p_status: statusFilter === 'all' ? null : statusFilter,
  })

  return { data: data ?? [], error }
}

export async function updateReportStatus({ reportId, status, adminNote = '' }) {
  if (!supabase) {
    return { data: null, error: new Error('Supabase is not configured.') }
  }

  const { data, error } = await supabase.rpc('admin_update_report_status', {
    p_report_id: reportId,
    p_status: status,
    p_admin_note: adminNote,
  })

  return { data, error }
}

export async function fetchAdminOrders(filter = 'all') {
  if (!supabase) {
    return { data: null, error: new Error('Supabase is not configured.') }
  }

  const { data, error } = await supabase.rpc('admin_list_orders', {
    p_filter: filter,
  })

  return { data: data ?? [], error }
}

export function getAdminOrderWarnings(order) {
  if (!order) return []

  const warnings = []

  if (
    order.payment_status === 'paid' &&
    order.fulfilment_status !== 'completed' &&
    order.fulfilment_status !== 'cancelled'
  ) {
    warnings.push(ADMIN_ORDER_WARNING_TYPES.PAID_NOT_COMPLETED)
  }

  if (order.fulfilment_status === 'buyer_confirmed' && order.payout_status !== 'paid') {
    warnings.push(ADMIN_ORDER_WARNING_TYPES.CONFIRMED_PAYOUT_UNPAID)
  }

  if (order.payout_status === 'failed') {
    warnings.push(ADMIN_ORDER_WARNING_TYPES.PAYOUT_FAILED)
  }

  if (
    order.payment_status === 'awaiting_seller_setup' ||
    order.payout_status === 'awaiting_seller_setup'
  ) {
    warnings.push(ADMIN_ORDER_WARNING_TYPES.SELLER_SETUP_MISSING)
  }

  if (
    order.fulfilment_status === 'cancelled' ||
    ['cancelled', 'expired', 'refunded'].includes(order.payment_status)
  ) {
    warnings.push(ADMIN_ORDER_WARNING_TYPES.CANCELLED)
  }

  return [...new Set(warnings)]
}

export function formatAdminOrderWarning(type) {
  return ADMIN_ORDER_WARNING_LABELS[type] ?? type
}

export function formatAdminBuyerConfirmed(value) {
  return value ? formatOrderTimestamp(value) : 'No'
}

export {
  formatOrderFulfilmentStatus,
  formatOrderTimestamp,
  formatPaymentStatus,
  formatPayoutStatus,
  formatPricePence,
  formatReportReason,
  formatReportStatus,
  formatReportType,
  formatSupportRequestReason,
  formatSupportRequestStatus,
  formatSupportRequestTimestamp,
  getReportErrorMessage,
  getSupportRequestErrorMessage,
}
