import { useState } from 'react'
import {
  CASE_OUTCOME_OPTIONS,
  adminCloseDisputeCase,
  adminCloseSupportCase,
  adminMarkDisputeRefundCompleted,
  adminMarkSupportRefundCompleted,
  canCloseCase,
  canMarkRefundCompleted,
  getCaseClosureErrorMessage,
  getDefaultCloseCaseCustomerMessage,
  getDefaultRefundCompletedCustomerMessage,
  suggestCaseOutcome,
} from '../lib/caseClosure'
import './OrderDisputeSection.css'

export function CaseRefundCompletedAction({
  record,
  isDispute,
  adminNote,
  onUpdated,
}) {
  const [customerMessage, setCustomerMessage] = useState(() =>
    getDefaultRefundCompletedCustomerMessage(),
  )
  const [refundReference, setRefundReference] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  if (!canMarkRefundCompleted(record)) return null

  async function handleSubmit(event) {
    event.preventDefault()
    if (submitting) return

    setSubmitting(true)
    setError('')
    setSuccess('')

    const payload = {
      adminNote,
      customerMessage,
      refundReference,
    }

    const result = isDispute
      ? await adminMarkDisputeRefundCompleted({ disputeId: record.id, ...payload })
      : await adminMarkSupportRefundCompleted({ requestId: record.id, ...payload })

    setSubmitting(false)

    if (result?.error) {
      setError(getCaseClosureErrorMessage(result.error))
      return
    }

    setSuccess('Refund marked as completed.')
    onUpdated?.(result.data)
  }

  return (
    <form className="order-case-closure__form" onSubmit={handleSubmit}>
      <p className="order-case-return__lead">
        Confirm the refund has been processed manually before closing this case.
      </p>

      <label className="order-dispute__admin-field">
        <span className="order-dispute__label">Refund reference (optional)</span>
        <input
          type="text"
          value={refundReference}
          disabled={submitting}
          placeholder="Bank or payment reference"
          onChange={(event) => setRefundReference(event.target.value)}
        />
      </label>

      <label className="order-dispute__admin-field">
        <span className="order-dispute__label">Message to buyer &amp; seller</span>
        <textarea
          value={customerMessage}
          disabled={submitting}
          rows={3}
          onChange={(event) => setCustomerMessage(event.target.value)}
        />
      </label>

      <button
        type="submit"
        className="listing-detail__button listing-detail__button--primary"
        disabled={submitting}
      >
        {submitting ? 'Saving…' : 'Mark refund completed'}
      </button>

      {error ? (
        <p className="order-dispute__error" role="alert">
          {error}
        </p>
      ) : null}
      {success ? (
        <p className="order-dispute__admin-success" role="status">
          {success}
        </p>
      ) : null}
    </form>
  )
}

export function CaseCloseAction({
  record,
  isDispute,
  adminNote,
  showAdminNoteField = false,
  onAdminNoteChange,
  onUpdated,
}) {
  const [caseOutcome, setCaseOutcome] = useState(() => suggestCaseOutcome(record))
  const [customerMessage, setCustomerMessage] = useState(() =>
    getDefaultCloseCaseCustomerMessage(suggestCaseOutcome(record)),
  )
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  if (!canCloseCase(record)) return null

  function handleOutcomeChange(nextOutcome) {
    setCaseOutcome(nextOutcome)
    setCustomerMessage(getDefaultCloseCaseCustomerMessage(nextOutcome))
  }

  async function handleSubmit(event) {
    event.preventDefault()
    if (submitting || !caseOutcome) return

    setSubmitting(true)
    setError('')
    setSuccess('')

    const payload = {
      caseOutcome,
      adminNote,
      customerMessage,
    }

    const result = isDispute
      ? await adminCloseDisputeCase({ disputeId: record.id, ...payload })
      : await adminCloseSupportCase({ requestId: record.id, ...payload })

    setSubmitting(false)

    if (result?.error) {
      setError(getCaseClosureErrorMessage(result.error))
      return
    }

    setSuccess('Case closed.')
    onUpdated?.(result.data)
  }

  return (
    <form className="order-case-closure__form" onSubmit={handleSubmit}>
      <p className="order-case-return__lead">
        Final step. Closing this case removes it from the active case queue. Buyers and sellers will
        receive the final support update and no further evidence can be uploaded.
      </p>

      {showAdminNoteField ? (
        <label className="order-dispute__admin-field">
          <span className="order-dispute__label">Admin note (internal)</span>
          <textarea
            value={adminNote}
            disabled={submitting}
            rows={3}
            placeholder="Internal note for Equipd staff."
            onChange={(event) => onAdminNoteChange?.(event.target.value)}
          />
        </label>
      ) : null}

      <label className="order-dispute__admin-field">
        <span className="order-dispute__label">Case outcome</span>
        <select
          value={caseOutcome}
          disabled={submitting}
          required
          onChange={(event) => handleOutcomeChange(event.target.value)}
        >
          {CASE_OUTCOME_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <label className="order-dispute__admin-field">
        <span className="order-dispute__label">Final customer message</span>
        <textarea
          value={customerMessage}
          disabled={submitting}
          rows={3}
          required
          onChange={(event) => setCustomerMessage(event.target.value)}
        />
      </label>

      <button
        type="submit"
        className="listing-detail__button listing-detail__button--primary"
        disabled={submitting}
      >
        {submitting ? 'Closing…' : 'Close case'}
      </button>

      {error ? (
        <p className="order-dispute__error" role="alert">
          {error}
        </p>
      ) : null}
      {success ? (
        <p className="order-dispute__admin-success" role="status">
          {success}
        </p>
      ) : null}
    </form>
  )
}
