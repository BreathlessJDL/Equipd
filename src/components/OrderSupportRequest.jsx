import { useState } from 'react'
import {
  SUPPORT_REQUEST_REASON_OPTIONS,
  SUPPORT_REQUEST_REASONS,
  canShowResolutionNotes,
  canUserRaiseSupportRequest,
  createSupportRequest,
  formatSupportRequestReason,
  formatSupportRequestStatus,
  formatSupportRequestTimestamp,
  getSupportRequestErrorMessage,
  getUserActiveSupportRequest,
  isSupportRequestActive,
} from '../lib/supportRequests'
import './OrderSupportRequest.css'

function OrderSupportRequest({
  order,
  payment,
  requests,
  userId,
  viewerRole,
  onSubmitted,
}) {
  const [reason, setReason] = useState(SUPPORT_REQUEST_REASONS.ITEM_NOT_RECEIVED)
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const userActiveRequest = getUserActiveSupportRequest(requests, userId)
  const counterpartyActiveRequest = (requests ?? []).find(
    (request) => request.opened_by !== userId && isSupportRequestActive(request),
  )
  const canRaise = canUserRaiseSupportRequest(order, payment, requests, userId)
  const pastRequests = (requests ?? []).filter(
    (request) =>
      !isSameRequest(request, userActiveRequest) &&
      !isSameRequest(request, counterpartyActiveRequest),
  )

  async function handleSubmit(event) {
    event.preventDefault()

    if (!order?.id || submitting || !canRaise) return

    setSubmitting(true)
    setError('')

    const { error: submitError } = await createSupportRequest({
      orderId: order.id,
      reason,
      message,
    })

    if (submitError) {
      setError(getSupportRequestErrorMessage(submitError))
      setSubmitting(false)
      return
    }

    setMessage('')
    setReason(SUPPORT_REQUEST_REASONS.ITEM_NOT_RECEIVED)
    setSubmitting(false)
    onSubmitted?.()
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
            <SupportResolutionNotes request={counterpartyActiveRequest} />
          </dl>
        </div>
      ) : null}

      {userActiveRequest ? (
        <div className="order-support__current">
          <h3 className="order-support__subtitle">Your support request</h3>
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
            <SupportResolutionNotes request={userActiveRequest} />
          </dl>
        </div>
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
                {canShowResolutionNotes(request) ? (
                  <p className="order-support__resolution">{request.resolution_notes}</p>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  )
}

function SupportResolutionNotes({ request }) {
  if (!canShowResolutionNotes(request)) return null

  return (
    <div className="order-support__row">
      <dt className="order-support__label">Resolution</dt>
      <dd className="order-support__value order-support__resolution">
        {request.resolution_notes}
      </dd>
    </div>
  )
}

function isSameRequest(a, b) {
  if (!a || !b) return false
  return a.id === b.id
}

export default OrderSupportRequest
