import { useState } from 'react'
import { confirmOrderReceived, getOrderErrorMessage } from '../lib/orders'
import './BuyerOrderConfirmation.css'

function BuyerOrderConfirmation({ orderId, onConfirmed, compact = false }) {
  const [checked, setChecked] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  async function handleConfirm() {
    if (!orderId || !checked || submitting) return

    setSubmitting(true)
    setError('')

    const { data, error: confirmError } = await confirmOrderReceived(orderId)

    if (confirmError) {
      setError(getOrderErrorMessage(confirmError))
      setSubmitting(false)
      return
    }

    setChecked(false)
    setSubmitting(false)
    onConfirmed?.(data)
  }

  return (
    <div
      className={`buyer-order-confirmation${
        compact ? ' buyer-order-confirmation--compact' : ''
      }`}
    >
      <p className="buyer-order-confirmation__warning">
        Only confirm once you have the item and are satisfied with it. Seller payout is
        released automatically after the Buyer Protection window ends. This cannot be undone
        from your account.
      </p>

      <label className="buyer-order-confirmation__checkbox">
        <input
          type="checkbox"
          checked={checked}
          disabled={submitting}
          onChange={(event) => setChecked(event.target.checked)}
        />
        <span>
          I confirm I have collected or received this item and I am happy with its
          condition.
        </span>
      </label>

      <button
        type="button"
        className="buyer-order-confirmation__button"
        disabled={!checked || submitting}
        onClick={handleConfirm}
      >
        {submitting ? 'Confirming…' : 'Confirm collection / delivery'}
      </button>

      {error ? (
        <p className="buyer-order-confirmation__error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )
}

export default BuyerOrderConfirmation
