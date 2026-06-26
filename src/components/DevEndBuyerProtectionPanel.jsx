import { useState } from 'react'
import {
  devEndBuyerProtectionNow,
  getDisputeErrorMessage,
  isBuyerProtectionWindowActive,
} from '../lib/orderDisputes'
import { ORDER_FULFILMENT_STATUSES, PAYOUT_STATUSES } from '../lib/orders'

function DevEndBuyerProtectionPanel({ order, onEnded }) {
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [ended, setEnded] = useState(false)

  async function handleEndProtection() {
    if (!order?.id || submitting || ended) return

    setSubmitting(true)
    setError('')

    const { error: endError } = await devEndBuyerProtectionNow(order.id)

    if (endError) {
      setError(getDisputeErrorMessage(endError))
      setSubmitting(false)
      return
    }

    setEnded(true)
    setSubmitting(false)
    await onEnded?.()
  }

  return (
    <section className="order-detail__dev-handover" aria-labelledby="dev-end-protection-title">
      <h2 id="dev-end-protection-title" className="order-detail__section-title">
        Dev/Test Buyer Protection
      </h2>
      <p className="order-detail__message order-detail__message--dev-warning" role="note">
        Admin testing only — ends the Buyer Protection window immediately.
      </p>
      {ended ? (
        <p className="order-detail__message order-detail__message--notice" role="status">
          Buyer Protection ended for testing. The order is now completed with the same backend
          logic as natural window expiry — reviews are available; seller payout may still be
          pending.
        </p>
      ) : (
        <>
          <p className="order-detail__message order-detail__message--notice">
            Skip the 24-hour wait and complete the order using the same backend logic as natural
            Buyer Protection expiry.
          </p>
          <button
            type="button"
            className="order-detail__dev-handover-button"
            disabled={submitting}
            onClick={handleEndProtection}
          >
            {submitting ? 'Ending…' : 'Dev/Test: End Buyer Protection now'}
          </button>
          {error ? (
            <p className="order-detail__message order-detail__message--error" role="alert">
              {error}
            </p>
          ) : null}
        </>
      )}
    </section>
  )
}

export function canShowDevEndBuyerProtection({ order, user, isAdmin }) {
  if (!user || !order || !isAdmin) return false

  if (order.protection_status !== 'active') return false
  if (order.fulfilment_status !== ORDER_FULFILMENT_STATUSES.COLLECTED) return false
  if (order.payout_status !== PAYOUT_STATUSES.NOT_DUE) return false
  if (!isBuyerProtectionWindowActive(order)) return false

  return true
}

export default DevEndBuyerProtectionPanel
