import { useEffect, useId, useState } from 'react'
import { formatPricePence } from '../../lib/listings'
import BuyerProtectionOfferSummary from '../BuyerProtectionOfferSummary'
import '../auth/AuthModal.css'
import '../listing/MakeOfferModal.css'

function CounterOfferModal({ open, listingPricePence, submitting = false, onClose, onSubmit }) {
  const amountId = useId()
  const [amount, setAmount] = useState('')

  useEffect(() => {
    if (!open) {
      setAmount('')
      return undefined
    }

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    function handleKeyDown(event) {
      if (event.key === 'Escape' && !submitting) {
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [open, onClose, submitting])

  function handleSubmit(event) {
    event.preventDefault()
    if (!amount || submitting) return
    onSubmit(amount)
  }

  if (!open) return null

  return (
    <div className="auth-modal make-offer-modal" role="presentation">
      <button
        type="button"
        className="auth-modal__backdrop"
        aria-label="Close"
        disabled={submitting}
        onClick={onClose}
      />

      <div
        className="auth-modal__dialog make-offer-modal__dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="counter-offer-modal-title"
      >
        <h2 id="counter-offer-modal-title" className="make-offer-modal__title">
          Counter offer
        </h2>
        {listingPricePence ? (
          <p className="make-offer-modal__lead">
            Enter your counter-offer. Asking price is {formatPricePence(listingPricePence)}.
          </p>
        ) : (
          <p className="make-offer-modal__lead">Enter your counter-offer amount.</p>
        )}

        <form className="make-offer-modal__form" onSubmit={handleSubmit}>
          <div className="make-offer-modal__field">
            <label className="make-offer-modal__label" htmlFor={amountId}>
              Counter-offer amount
            </label>
            <input
              id={amountId}
              className="make-offer-modal__input"
              type="number"
              min="0.01"
              step="0.01"
              inputMode="decimal"
              placeholder="150.00"
              value={amount}
              disabled={submitting}
              onChange={(event) => setAmount(event.target.value)}
            />
          </div>

          <BuyerProtectionOfferSummary
            amountInput={amount}
            compact
            totalLabel="Total payable if accepted"
          />

          <div className="make-offer-modal__actions">
            <button
              type="submit"
              className="listing-detail__button listing-detail__button--primary make-offer-modal__button"
              disabled={submitting || !amount}
            >
              {submitting ? 'Sending…' : 'Send counter-offer'}
            </button>
            <button
              type="button"
              className="listing-detail__button listing-detail__button--secondary make-offer-modal__button"
              disabled={submitting}
              onClick={onClose}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default CounterOfferModal
