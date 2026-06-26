import { useState } from 'react'
import { cancelAcceptedOffer, getOfferErrorMessage } from '../lib/offers'
import './TransactionCancel.css'

function TransactionCancelButton({ offerId, onCancelled, compact = false }) {
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  async function handleCancel() {
    if (!offerId || submitting) return

    const confirmed = globalThis.confirm(
      'Cancel this accepted offer before the buyer pays? The listing will return to active.',
    )

    if (!confirmed) return

    setSubmitting(true)
    setError('')

    const { error: cancelError } = await cancelAcceptedOffer(offerId)

    if (cancelError) {
      setError(getOfferErrorMessage(cancelError))
      setSubmitting(false)
      return
    }

    setSubmitting(false)
    onCancelled?.()
  }

  return (
    <div className={`transaction-cancel${compact ? ' transaction-cancel--compact' : ''}`}>
      <button
        type="button"
        className="transaction-cancel__button"
        disabled={submitting}
        onClick={handleCancel}
      >
        {submitting ? 'Cancelling…' : 'Cancel sale'}
      </button>
      {error ? (
        <p className="transaction-cancel__error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )
}

function TransactionSupportNotice({ compact = false }) {
  return (
    <p
      className={`transaction-cancel__support${compact ? ' transaction-cancel__support--compact' : ''}`}
      role="status"
    >
      This transaction has progressed beyond pre-payment cancellation. Contact support to
      request cancellation or open a dispute. Refunds are not handled automatically yet.
    </p>
  )
}

export { TransactionCancelButton, TransactionSupportNotice }
