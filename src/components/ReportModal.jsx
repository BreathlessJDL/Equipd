import { useEffect, useState } from 'react'
import '../components/auth/AuthModal.css'
import './ReportModal.css'
import {
  getReportModalTitle,
  getReportReasons,
  REPORT_REASONS,
  REPORT_SUBMITTED_MESSAGE,
} from '../lib/reports'

function ReportModal({
  open,
  reportType,
  submitting,
  error,
  blocked = false,
  onClose,
  onSubmit,
}) {
  const reasonOptions = getReportReasons(reportType)
  const [reason, setReason] = useState(reasonOptions[0]?.value ?? '')
  const [description, setDescription] = useState('')
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    if (!open) return undefined

    setReason(getReportReasons(reportType)[0]?.value ?? '')
    setDescription('')
    setSubmitted(false)
    document.body.style.overflow = 'hidden'

    function handleEscape(event) {
      if (event.key === 'Escape' && !submitting) {
        onClose()
      }
    }

    window.addEventListener('keydown', handleEscape)

    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', handleEscape)
    }
  }, [open, reportType, submitting, onClose])

  if (!open) return null

  const title = getReportModalTitle(reportType)
  const requiresDescription = reason === REPORT_REASONS.OTHER

  function handleSubmit(event) {
    event.preventDefault()

    if (submitting || submitted) return

    onSubmit({
      reason,
      description,
      onSuccess: () => setSubmitted(true),
    })
  }

  return (
    <div className="auth-modal report-modal" role="presentation">
      <button
        type="button"
        className="auth-modal__backdrop"
        aria-label={`Close ${title.toLowerCase()} dialog`}
        disabled={submitting}
        onClick={onClose}
      />
      <div
        className="auth-modal__dialog report-modal__dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="report-modal-title"
      >
        <button
          type="button"
          className="auth-modal__close"
          aria-label="Close"
          disabled={submitting}
          onClick={onClose}
        >
          ×
        </button>

        <h2 id="report-modal-title" className="report-modal__title">
          {title}
        </h2>

        {submitted ? (
          <div className="report-modal__confirmation">
            <p className="report-modal__confirmation-text" role="status">
              {REPORT_SUBMITTED_MESSAGE}
            </p>
            <button
              type="button"
              className="listing-detail__button listing-detail__button--primary"
              onClick={onClose}
            >
              Close
            </button>
          </div>
        ) : blocked ? (
          <div className="report-modal__confirmation">
            {error ? (
              <p className="report-modal__error" role="alert">
                {error}
              </p>
            ) : null}
            <button
              type="button"
              className="listing-detail__button listing-detail__button--primary"
              onClick={onClose}
            >
              Close
            </button>
          </div>
        ) : (
          <>
            <p className="report-modal__lead">
              Tell us what happened. Reports help keep Equipd safe for buyers and sellers.
            </p>

            <form className="report-modal__form" onSubmit={handleSubmit}>
              <label className="report-modal__field">
                <span className="report-modal__label">Reason</span>
                <select
                  value={reason}
                  disabled={submitting || reasonOptions.length <= 1}
                  onChange={(event) => setReason(event.target.value)}
                >
                  {reasonOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="report-modal__field">
                <span className="report-modal__label">
                  Description{requiresDescription ? '' : ' (optional)'}
                </span>
                <textarea
                  value={description}
                  disabled={submitting}
                  rows={4}
                  required={requiresDescription}
                  placeholder={
                    requiresDescription
                      ? 'Please describe the issue.'
                      : 'Add any helpful details.'
                  }
                  onChange={(event) => setDescription(event.target.value)}
                />
              </label>

              {error ? (
                <p className="report-modal__error" role="alert">
                  {error}
                </p>
              ) : null}

              <div className="report-modal__actions">
                <button
                  type="button"
                  className="listing-detail__button listing-detail__button--secondary"
                  disabled={submitting}
                  onClick={onClose}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="listing-detail__button listing-detail__button--primary"
                  disabled={submitting || (requiresDescription && !description.trim())}
                >
                  {submitting ? 'Submitting…' : 'Submit report'}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  )
}

export default ReportModal
