import { useState } from 'react'
import AddAdditionalEvidenceSection from './AddAdditionalEvidenceSection'
import EvidenceFilePicker from './EvidenceFilePicker'
import {
  canShowParticipantCaseEvidenceUpload,
  getActiveOrderCase,
  isOrderCaseActive,
} from '../lib/caseEvidence'
import {
  SUPPORT_REQUEST_REASON_OPTIONS,
  SUPPORT_REQUEST_REASONS,
  canUserRaiseSupportRequest,
  createSupportRequest,
  formatSupportRequestReason,
  formatSupportRequestStatus,
  formatSupportRequestTimestamp,
  getEquipdSupportUpdateFromSupportRequest,
  getSupportRequestErrorMessage,
  getUserActiveSupportRequest,
  isSupportRequestActive,
} from '../lib/supportRequests'
import {
  MAX_ISSUE_EVIDENCE_FILES,
  uploadSupportEvidenceFile,
  validateIssueEvidenceFile,
} from '../lib/orderEvidence'
import IssueEvidenceList from './IssueEvidenceList'
import SupportUpdateCard from './SupportUpdateCard'
import './OrderSupportRequest.css'

function OrderSupportRequest({
  order,
  payment,
  requests,
  disputes = [],
  userId,
  viewerRole,
  useCaseUpdateHistory = false,
  onSubmitted,
}) {
  function renderSupportUpdate(request) {
    if (useCaseUpdateHistory) return null
    const update = getEquipdSupportUpdateFromSupportRequest(request)
    return update ? <SupportUpdateCard {...update} /> : null
  }

  const [reason, setReason] = useState(SUPPORT_REQUEST_REASONS.ITEM_NOT_RECEIVED)
  const [message, setMessage] = useState('')
  const [evidenceFiles, setEvidenceFiles] = useState([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const activeCase = getActiveOrderCase(disputes, requests)
  const caseIsActive = isOrderCaseActive(activeCase)
  const userActiveRequest = getUserActiveSupportRequest(requests, userId)
  const counterpartyActiveRequest = (requests ?? []).find(
    (request) => request.opened_by !== userId && isSupportRequestActive(request),
  )
  const canRaise = canUserRaiseSupportRequest(order, payment, requests, userId, disputes)
  const canUploadEvidence = canShowParticipantCaseEvidenceUpload(
    activeCase,
    order,
    viewerRole,
    userId,
  )
  const showClosedCaseMessage =
    !caseIsActive &&
    (requests?.length ?? 0) > 0 &&
    !getActiveOrderCase(disputes, requests) &&
    !canRaise
  const pastRequests = (requests ?? []).filter(
    (request) =>
      !isSameRequest(request, userActiveRequest) &&
      !isSameRequest(request, counterpartyActiveRequest),
  )

  async function uploadEvidenceFiles(orderId, requestId, files) {
    const evidencePaths = []

    for (const file of files) {
      const validationError = validateIssueEvidenceFile(file)
      if (validationError) {
        throw new Error(validationError)
      }

      const { path, error: uploadError } = await uploadSupportEvidenceFile(orderId, requestId, file)
      if (uploadError) {
        throw uploadError
      }
      evidencePaths.push(path)
    }

    return evidencePaths
  }

  async function handleSubmit(event) {
    event.preventDefault()

    if (!order?.id || submitting || !canRaise) return

    setSubmitting(true)
    setError('')

    try {
      for (const file of evidenceFiles) {
        const validationError = validateIssueEvidenceFile(file)
        if (validationError) throw new Error(validationError)
      }

      const requestId = crypto.randomUUID()
      let evidencePaths = []

      if (evidenceFiles.length) {
        evidencePaths = await uploadEvidenceFiles(order.id, requestId, evidenceFiles)
      }

      const { error: submitError } = await createSupportRequest({
        orderId: order.id,
        reason,
        message,
        evidencePaths,
        requestId,
      })

      if (submitError) throw submitError

      setMessage('')
      setReason(SUPPORT_REQUEST_REASONS.ITEM_NOT_RECEIVED)
      setEvidenceFiles([])
      onSubmitted?.()
    } catch (submitError) {
      setError(getSupportRequestErrorMessage(submitError))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="order-support">
      <h2 className="order-support__title">Support &amp; disputes</h2>
      <p className="order-support__placeholder" role="status">
        Equipd support will review this manually. Refunds and payout reversals are not
        automated yet.
      </p>

      {counterpartyActiveRequest ? (
        <div className="order-support__current order-support__current--counterparty">
          <h3 className="order-support__subtitle">Support issue raised by the other party</h3>
          {renderSupportUpdate(counterpartyActiveRequest)}
          <dl className="order-support__meta">
            <div className="order-support__row">
              <dt className="order-support__label">Status</dt>
              <dd className="order-support__value">
                {formatSupportRequestStatus(counterpartyActiveRequest.status)}
              </dd>
            </div>
            <div className="order-support__row">
              <dt className="order-support__label">Reason</dt>
              <dd className="order-support__value">
                {formatSupportRequestReason(counterpartyActiveRequest.reason)}
              </dd>
            </div>
            <div className="order-support__row">
              <dt className="order-support__label">Submitted</dt>
              <dd className="order-support__value">
                {formatSupportRequestTimestamp(counterpartyActiveRequest.created_at)}
              </dd>
            </div>
          </dl>
          <IssueEvidenceList paths={counterpartyActiveRequest.evidence_paths} />
        </div>
      ) : null}

      {userActiveRequest ? (
        <div className="order-support__current">
          <h3 className="order-support__subtitle">Your support request</h3>
          {renderSupportUpdate(userActiveRequest)}
          <dl className="order-support__meta">
            <div className="order-support__row">
              <dt className="order-support__label">Status</dt>
              <dd className="order-support__value">
                {formatSupportRequestStatus(userActiveRequest.status)}
              </dd>
            </div>
            <div className="order-support__row">
              <dt className="order-support__label">Reason</dt>
              <dd className="order-support__value">
                {formatSupportRequestReason(userActiveRequest.reason)}
              </dd>
            </div>
            <div className="order-support__row">
              <dt className="order-support__label">Submitted</dt>
              <dd className="order-support__value">
                {formatSupportRequestTimestamp(userActiveRequest.created_at)}
              </dd>
            </div>
            <div className="order-support__row">
              <dt className="order-support__label">Message</dt>
              <dd className="order-support__value order-support__message">
                {userActiveRequest.message}
              </dd>
            </div>
          </dl>
          <IssueEvidenceList paths={userActiveRequest.evidence_paths} />
        </div>
      ) : null}

      {canUploadEvidence && activeCase?.type === 'support' ? (
        <AddAdditionalEvidenceSection
          orderId={order.id}
          caseType={activeCase.type}
          caseId={activeCase.record.id}
          uploaderRole={viewerRole}
          onUploaded={() => onSubmitted?.()}
        />
      ) : null}

      {showClosedCaseMessage && !activeCase ? (
        <p className="order-support__closed-notice" role="status">
          This case has been closed. You can no longer upload additional evidence.
        </p>
      ) : null}

      {canRaise ? (
        <form className="order-support__form" onSubmit={handleSubmit}>
          <h3 className="order-support__subtitle">Raise support issue</h3>
          <p className="order-support__lead">
            Tell us what went wrong on this {viewerRole === 'buyer' ? 'purchase' : 'sale'}.
          </p>

          <label className="order-support__field">
            <span className="order-support__label">Reason</span>
            <select
              className="order-support__select"
              value={reason}
              disabled={submitting}
              onChange={(event) => setReason(event.target.value)}
            >
              {SUPPORT_REQUEST_REASON_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="order-support__field">
            <span className="order-support__label">Details</span>
            <textarea
              className="order-support__textarea"
              rows={4}
              value={message}
              disabled={submitting}
              placeholder="Describe the issue so Equipd support can review it."
              onChange={(event) => setMessage(event.target.value)}
            />
          </label>

          <EvidenceFilePicker
            inputId="support-new-evidence"
            files={evidenceFiles}
            disabled={submitting}
            onChange={setEvidenceFiles}
            label="Evidence files (optional)"
            hint={`Up to ${MAX_ISSUE_EVIDENCE_FILES} files. Images, videos, or PDFs. Max 25 MB each.`}
          />

          <button
            type="submit"
            className="order-support__button"
            disabled={submitting || !message.trim()}
          >
            {submitting ? 'Submitting…' : 'Raise support issue'}
          </button>

          {error ? (
            <p className="order-support__error" role="alert">
              {error}
            </p>
          ) : null}
        </form>
      ) : error ? (
        <p className="order-support__error" role="alert">
          {error}
        </p>
      ) : null}

      {pastRequests.length > 0 ? (
        <div className="order-support__history">
          <h3 className="order-support__subtitle">Previous support requests</h3>
          <ul className="order-support__list">
            {pastRequests.map((request) => (
              <li key={request.id} className="order-support__list-item">
                <p className="order-support__list-title">
                  {formatSupportRequestReason(request.reason)} ·{' '}
                  {formatSupportRequestStatus(request.status)}
                </p>
                <p className="order-support__list-meta">
                  {request.opened_by === userId ? 'Raised by you' : 'Raised by the other party'}
                  {' · '}
                  {formatSupportRequestTimestamp(request.created_at)}
                </p>
                {renderSupportUpdate(request)}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  )
}

function isSameRequest(a, b) {
  if (!a || !b) return false
  return a.id === b.id
}

export default OrderSupportRequest
