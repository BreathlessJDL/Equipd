import { useState } from 'react'
import { confirmSellerDelivery, getOrderErrorMessage } from '../lib/orders'
import './SellerDeliveryConfirmation.css'

function SellerDeliveryConfirmation({ orderId, onConfirmed, compact = false }) {
  const [checked, setChecked] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  async function handleConfirm() {
    if (!orderId || !checked || submitting) return

    setSubmitting(true)
    setError('')

    const { error: confirmError } = await confirmSellerDelivery(orderId)

    if (confirmError) {
      setError(getOrderErrorMessage(confirmError))
      setSubmitting(false)
      return
    }

    setChecked(false)
    setSubmitting(false)
    onConfirmed?.()
  }

  return (
    <div
      className={`seller-delivery-confirmation${
        compact ? ' seller-delivery-confirmation--compact' : ''
      }`}
    >
      <p className="seller-delivery-confirmation__lead">
        Mark this order as delivered once you have handed the item to the buyer.
      </p>

      <label className="seller-delivery-confirmation__checkbox">
        <input
          type="checkbox"
          checked={checked}
          disabled={submitting}
          onChange={(event) => setChecked(event.target.checked)}
        />
        <span>I confirm I have delivered this item to the buyer.</span>
      </label>

      <button
        type="button"
        className="seller-delivery-confirmation__button"
        disabled={!checked || submitting}
        onClick={handleConfirm}
      >
        {submitting ? 'Confirming…' : 'Mark as delivered'}
      </button>

      {error ? (
        <p className="seller-delivery-confirmation__error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )
}

export default SellerDeliveryConfirmation
