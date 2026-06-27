import { useEffect, useId, useState } from 'react'
import { formatPricePence } from '../../lib/listings'
import {
  getOfferErrorMessage,
  validateBuyerOfferAmount,
} from '../../lib/offers'
import { submitListingOffer } from '../../lib/offerMessaging'
import BuyerProtectionOfferSummary from '../BuyerProtectionOfferSummary'
import '../auth/AuthModal.css'
import './MakeOfferModal.css'

function MakeOfferModal({
  open,
  listing,
  user,
  buyerHasPendingOffer = false,
  onClose,
  onSubmitted,
}) {
  const amountId = useId()
  const messageId = useId()
  const [offerAmount, setOfferAmount] = useState('')
  const [offerMessage, setOfferMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return undefined

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

  useEffect(() => {
    if (!open) {
      setOfferAmount('')
      setOfferMessage('')
      setError('')
      setSubmitting(false)
    }
  }, [open])

  async function handleSubmit(event) {
    event.preventDefault()
    if (!user?.id || !listing || buyerHasPendingOffer) return

    setSubmitting(true)
    setError('')

    const amountPence = Math.round(Number.parseFloat(offerAmount) * 100)
    const amountError = validateBuyerOfferAmount(amountPence, listing.price_pence)
    if (amountError) {
      setSubmitting(false)
      setError(amountError)
      return
    }

    const { data, error: submitError } = await submitListingOffer({
      listingId: listing.id,
      buyerId: user.id,
      sellerId: listing.seller_id,
      amountInput: offerAmount,
      message: offerMessage,
      listingPricePence: listing.price_pence,
    })

    setSubmitting(false)

    if (submitError) {
      setError(getOfferErrorMessage(submitError))
      return
    }

    onSubmitted(data)
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
        aria-labelledby="make-offer-modal-title"
      >
        <h2 id="make-offer-modal-title" className="make-offer-modal__title">
          Make an offer
        </h2>
        <p className="make-offer-modal__lead">
          Enter an offer up to the asking price of {formatPricePence(listing.price_pence)}.
        </p>

        {buyerHasPendingOffer ? (
          <>
            <p className="make-offer-modal__note" role="status">
              You already have a pending offer on this listing. Withdraw it from your Hub before
              submitting a new one.
            </p>
            <button
              type="button"
              className="listing-detail__button listing-detail__button--secondary make-offer-modal__button"
              onClick={onClose}
            >
              Cancel
            </button>
          </>
        ) : (
          <form className="make-offer-modal__form" onSubmit={handleSubmit}>
            <div className="make-offer-modal__field">
              <label className="make-offer-modal__label" htmlFor={amountId}>
                Offer amount
              </label>
              <input
                id={amountId}
                className="make-offer-modal__input"
                type="number"
                min="0.01"
                max={(listing.price_pence / 100).toFixed(2)}
                step="0.01"
                inputMode="decimal"
                placeholder="150.00"
                value={offerAmount}
                disabled={submitting}
                onChange={(event) => {
                  setOfferAmount(event.target.value)
                  setError('')
                }}
              />
            </div>

            <BuyerProtectionOfferSummary amountInput={offerAmount} compact />

            <div className="make-offer-modal__field">
              <label className="make-offer-modal__label" htmlFor={messageId}>
                Message (optional)
              </label>
              <textarea
                id={messageId}
                className="make-offer-modal__textarea"
                rows={3}
                value={offerMessage}
                disabled={submitting}
                onChange={(event) => {
                  setOfferMessage(event.target.value)
                  setError('')
                }}
              />
            </div>

            {error ? (
              <p className="make-offer-modal__error" role="alert">
                {error}
              </p>
            ) : null}

            <div className="make-offer-modal__actions">
              <button
                type="submit"
                className="listing-detail__button listing-detail__button--primary make-offer-modal__button"
                disabled={submitting || !offerAmount}
              >
                {submitting ? 'Submitting offer…' : 'Submit offer'}
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
        )}
      </div>
    </div>
  )
}

export default MakeOfferModal
