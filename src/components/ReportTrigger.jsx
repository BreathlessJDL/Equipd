import { useState } from 'react'
import './ReportModal.css'
import { useAuth } from '../hooks/useAuth'
import { useAuthModal } from '../hooks/useAuthModal'
import {
  createReport,
  getReportErrorMessage,
  hasOpenReport,
  REPORT_OPEN_WARNING,
} from '../lib/reports'
import ReportModal from './ReportModal'

function ReportTrigger({
  reportType,
  label,
  className = 'report-trigger',
  reportedUserId = null,
  listingId = null,
  conversationId = null,
  messageId = null,
}) {
  const { user } = useAuth()
  const { openLoginModal } = useAuthModal()
  const [open, setOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [blocked, setBlocked] = useState(false)

  async function handleOpen() {
    if (!user?.id) {
      openLoginModal({ redirectTo: window.location.pathname })
      return
    }

    setError('')
    setBlocked(false)

    const { data: alreadyOpen, error: checkError } = await hasOpenReport({
      reportType,
      reportedUserId,
      listingId,
      conversationId,
      messageId,
    })

    if (checkError) {
      setError(getReportErrorMessage(checkError))
      setOpen(true)
      return
    }

    if (alreadyOpen) {
      setError(REPORT_OPEN_WARNING)
      setBlocked(true)
      setOpen(true)
      return
    }

    setOpen(true)
  }

  async function handleSubmit({ reason, description, onSuccess }) {
    setSubmitting(true)
    setError('')

    const { error: submitError } = await createReport({
      reportType,
      reason,
      description,
      reportedUserId,
      listingId,
      conversationId,
      messageId,
    })

    setSubmitting(false)

    if (submitError) {
      setError(getReportErrorMessage(submitError))
      return
    }

    onSuccess()
  }

  function handleClose() {
    if (submitting) return
    setOpen(false)
    setError('')
    setBlocked(false)
  }

  return (
    <>
      <button type="button" className={className} onClick={handleOpen}>
        {label}
      </button>

      <ReportModal
        open={open}
        reportType={reportType}
        submitting={submitting}
        error={error}
        blocked={blocked}
        onClose={handleClose}
        onSubmit={handleSubmit}
      />
    </>
  )
}

export default ReportTrigger
