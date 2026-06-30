import { supabase } from './supabase'
import { formatOrderReference } from './orders'
import { formatDisputeReason, formatDisputeStatus } from './orderDisputes'
import { formatSupportRequestReason, formatSupportRequestStatus } from './supportRequests'

export const ADMIN_CASE_SORT_OPTIONS = [
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'oldest_active', label: 'Oldest active first' },
]

export const ADMIN_CASE_FILTERS = [
  { value: 'active', label: 'Active' },
  { value: 'all', label: 'All' },
  { value: 'review', label: 'Review' },
  { value: 'awaiting_buyer', label: 'Awaiting buyer' },
  { value: 'awaiting_seller', label: 'Awaiting seller' },
  { value: 'refund', label: 'Refund' },
  { value: 'closed', label: 'Closed' },
]

export const CASE_TYPES = {
  BUYER_PROTECTION_DISPUTE: 'buyer_protection_dispute',
  SUPPORT_REQUEST: 'support_request',
}

const CASE_TYPE_LABELS = {
  [CASE_TYPES.BUYER_PROTECTION_DISPUTE]: 'Buyer Protection dispute',
  [CASE_TYPES.SUPPORT_REQUEST]: 'Support request',
}

const WAITING_ON_LABELS = {
  buyer: 'Buyer',
  seller: 'Seller',
  equipd: 'Equipd',
  none: '—',
}

export function formatCaseType(caseType) {
  return CASE_TYPE_LABELS[caseType] ?? caseType
}

export function formatCaseWaitingOn(waitingOn) {
  return WAITING_ON_LABELS[waitingOn] ?? waitingOn ?? '—'
}

export function formatCaseReason(caseType, reason) {
  if (caseType === CASE_TYPES.SUPPORT_REQUEST) {
    return formatSupportRequestReason(reason)
  }

  return formatDisputeReason(reason)
}

export function formatCaseStatusLabel(caseType, status) {
  if (caseType === CASE_TYPES.SUPPORT_REQUEST) {
    return formatSupportRequestStatus(status)
  }

  return formatDisputeStatus(status)
}

export function formatCaseTimestamp(value) {
  if (!value) return ''

  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

export function formatCaseAge(openedAt) {
  if (!openedAt) return '—'

  const openedMs = new Date(openedAt).getTime()
  if (Number.isNaN(openedMs)) return '—'

  const diffMs = Date.now() - openedMs
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))

  if (diffHours < 1) return '<1h'
  if (diffHours < 24) return `${diffHours}h`

  const diffDays = Math.floor(diffHours / 24)
  if (diffDays === 1) return '1 day'
  if (diffDays < 14) return `${diffDays} days`

  const diffWeeks = Math.floor(diffDays / 7)
  return `${diffWeeks} wk`
}

export function isCaseOverdue(caseRow) {
  if (!caseRow?.is_active) return false

  const openedMs = new Date(caseRow.opened_at).getTime()
  if (Number.isNaN(openedMs)) return false

  const ageDays = (Date.now() - openedMs) / (1000 * 60 * 60 * 24)
  return ageDays >= 7
}

export function formatAdminCaseUserLabel(displayName, email, userId) {
  if (displayName?.trim() && email?.trim()) {
    return `${displayName.trim()} (${email.trim()})`
  }

  if (displayName?.trim()) return displayName.trim()
  if (email?.trim()) return email.trim()
  if (!userId) return 'Unknown user'
  return `${userId.slice(0, 8)}…`
}

export async function fetchAdminCases(filter = 'all') {
  if (!supabase) {
    return { data: null, error: new Error('Supabase is not configured.') }
  }

  const { data, error } = await supabase.rpc('admin_list_cases', {
    p_filter: filter === 'all' ? 'all' : filter,
  })

  return { data: data ?? [], error }
}

function normalizeAdminCaseSearch(value) {
  return value?.trim().toLowerCase() ?? ''
}

function formatOrderIdSearchFragment(orderId) {
  if (!orderId) return ''
  const reference = formatOrderReference(orderId)
  return `${String(orderId).toLowerCase()} ${reference.toLowerCase()} #${reference.toLowerCase()}`
}

export function filterAdminCases(cases, searchQuery) {
  const query = normalizeAdminCaseSearch(searchQuery)
  if (!query) return cases ?? []

  return (cases ?? []).filter((caseRow) => {
    const haystack = [
      caseRow.case_id,
      caseRow.order_id,
      formatOrderIdSearchFragment(caseRow.order_id),
      caseRow.listing_title,
      caseRow.buyer_display_name,
      caseRow.buyer_email,
      caseRow.seller_display_name,
      caseRow.seller_email,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()

    return haystack.includes(query)
  })
}

export function sortAdminCases(cases, sortKey = 'newest') {
  const rows = [...(cases ?? [])]

  rows.sort((left, right) => {
    const leftOpened = new Date(left.opened_at).getTime()
    const rightOpened = new Date(right.opened_at).getTime()

    if (sortKey === 'oldest') {
      return leftOpened - rightOpened
    }

    if (sortKey === 'oldest_active') {
      if (left.is_active !== right.is_active) {
        return left.is_active ? -1 : 1
      }

      return leftOpened - rightOpened
    }

    return rightOpened - leftOpened
  })

  return rows
}
