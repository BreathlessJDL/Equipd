import { supabase } from './supabase'
import {
  canReportConversation,
  canReportListing,
  canReportUser,
  formatReportReason,
  formatReportStatus,
  formatReportType,
  getReportErrorMessage,
  getReportModalTitle,
  getReportReasons,
  REPORT_OPEN_WARNING,
  REPORT_REASONS,
  REPORT_STATUSES,
  REPORT_SUBMITTED_MESSAGE,
  REPORT_TYPES,
  validateReportInput,
} from './reportsValidation'

export {
  canReportConversation,
  canReportListing,
  canReportUser,
  formatReportReason,
  formatReportStatus,
  formatReportType,
  getReportErrorMessage,
  getReportModalTitle,
  getReportReasons,
  REPORT_OPEN_WARNING,
  REPORT_REASONS,
  REPORT_STATUSES,
  REPORT_SUBMITTED_MESSAGE,
  REPORT_TYPES,
  validateReportInput,
}

export async function hasOpenReport({
  reportType,
  reportedUserId = null,
  listingId = null,
  conversationId = null,
  messageId = null,
}) {
  if (!supabase) {
    return { data: false, error: new Error('Supabase is not configured.') }
  }

  const { data, error } = await supabase.rpc('has_open_report', {
    p_report_type: reportType,
    p_reported_user_id: reportedUserId,
    p_listing_id: listingId,
    p_conversation_id: conversationId,
    p_message_id: messageId,
  })

  return { data: data === true, error }
}

export async function createReport({
  reportType,
  reason,
  description = null,
  reportedUserId = null,
  listingId = null,
  conversationId = null,
  messageId = null,
}) {
  if (!supabase) {
    return { data: null, error: new Error('Supabase is not configured.') }
  }

  const validation = validateReportInput({ reportType, reason, description })

  if (!validation.ok) {
    return { data: null, error: new Error(validation.error) }
  }

  const { data, error } = await supabase.rpc('create_report', {
    p_report_type: reportType,
    p_reason: reason,
    p_description: validation.description,
    p_reported_user_id: reportedUserId,
    p_listing_id: listingId,
    p_conversation_id: conversationId,
    p_message_id: messageId,
  })

  return { data, error }
}
