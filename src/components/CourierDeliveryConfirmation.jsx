import { useState } from 'react'
import PaymentCheckoutSummary from './PaymentCheckoutSummary'
import CourierEvidenceSummary from './CourierEvidenceSummary'
import {
  buildCourierDeliveryConfirmationChecks,
  confirmCourierDelivery,
  getCourierDeliveryErrorMessage,
} from '../lib/courierDelivery'
import './CourierDeliveryConfirmation.css'

function CourierDeliveryConfirmation({ order, payment, onConfirmed, compact = false }) {
  const [checks, setChecks] = useState({
    item_received: false,
    handover_evidence_reviewed: false,
    protection_window_acknowledged: false,
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const listing = order?.listing
  const allChecksComplete =
    checks.item_received &&
    checks.handover_evidence_reviewed &&
    checks.protection_window_acknowledged

  async function handleConfirm() {
    if (!order?.id || submitting || !allChecksComplete) return

    setSubmitting(true)
    setError('')

    const { data, error: confirmError } = await confirmCourierDelivery(
      order.id,
      buildCourierDeliveryConfirmationChecks({
        itemReceived: checks.item_received,
        handoverEvidenceReviewed: checks.handover_evidence_reviewed,
        protectionWindowAcknowledged: checks.protection_window_acknowledged,
      }),
    )

    setSubmitting(false)

    if (confirmError) {
      setError(getCourierDeliveryErrorMessage(confirmError))
      return
    }

    setSuccess(true)
    onConfirmed?.(data)
  }

  if (success) {
    return (
      <div
        className={`courier-delivery-confirmation${
          compact ? ' courier-delivery-confirmation--compact' : ''
        }`}
      >
        <p className="courier-delivery-confirmation__success" role="status">
          Delivery confirmed. Your 24-hour Buyer Protection window has started.
        </p>
      </div>
    )
  }

  return (
    <div
      className={`courier-delivery-confirmation${
        compact ? ' courier-delivery-confirmation--compact' : ''
      }`}
    >
      <h3 className="courier-delivery-confirmation__title">Confirm courier delivery</h3>
      <p className="courier-delivery-confirmation__lead">
        Review the seller&apos;s handover evidence and confirm once you have received{' '}
        {listing?.title ?? 'your item'}.
      </p>

      {listing?.title ? (
        <p className="courier-delivery-confirmation__summary">
          <strong>{listing.title}</strong>
        </p>
      ) : null}

      <PaymentCheckoutSummary payment={payment} order={order} compact />

      <CourierEvidenceSummary order={order} role="buyer" />

      <div className="courier-delivery-confirmation__checks">
        <label className="courier-delivery-confirmation__check">
          <input
            type="checkbox"
            checked={checks.item_received}
            disabled={submitting}
            onChange={(event) =>
              setChecks((current) => ({ ...current, item_received: event.target.checked }))
            }
          />
          <span>I have received the item</span>
        </label>
        <label className="courier-delivery-confirmation__check">
          <input
            type="checkbox"
            checked={checks.handover_evidence_reviewed}
            disabled={submitting}
            onChange={(event) =>
              setChecks((current) => ({
                ...current,
                handover_evidence_reviewed: event.target.checked,
              }))
            }
          />
          <span>I have reviewed the handover evidence</span>
        </label>
        <label className="courier-delivery-confirmation__check">
          <input
            type="checkbox"
            checked={checks.protection_window_acknowledged}
            disabled={submitting}
            onChange={(event) =>
              setChecks((current) => ({
                ...current,
                protection_window_acknowledged: event.target.checked,
              }))
            }
          />
          <span>I understand my 24-hour Buyer Protection window starts now</span>
        </label>
      </div>

      <button
        type="button"
        className="courier-delivery-confirmation__button"
        disabled={!allChecksComplete || submitting}
        onClick={handleConfirm}
      >
        {submitting ? 'Confirming…' : 'Confirm delivery'}
      </button>

      {error ? (
        <p className="courier-delivery-confirmation__error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )
}

export default CourierDeliveryConfirmation
