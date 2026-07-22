import { useCallback, useEffect, useId, useState } from 'react'
import { formatPricePence } from '../../lib/listings'
import {
  calculateTotalOfferPence,
  formatPenceAsOfferInput,
  parseUnitOfferPence,
  validateBuyerUnitOfferAmount,
} from '../../lib/offers'
import BuyerProtectionOfferSummary from '../BuyerProtectionOfferSummary'
import SellerPayoutSummary from '../SellerPayoutSummary'
import '../auth/AuthModal.css'
import '../listing/MakeOfferModal.css'

function CounterOfferModal({
  open,
  listingPricePence,
  quantity = 1,
  submitting = false,
  counterPartyRole = 'seller',
  onClose,
  onSubmit,
}) {
  const amountId = useId()
  const [unitOfferAmount, setUnitOfferAmount] = useState('')
  const [error, setError] = useState('')

  const resetForm = useCallback(() => {
    setUnitOfferAmount('')
    setError('')
  }, [])

  const handleClose = useCallback(() => {
    resetForm()
    onClose()
  }, [onClose, resetForm])

  useEffect(() => {
    if (!open) return undefined

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    function handleKeyDown(event) {
      if (event.key === 'Escape' && !submitting) {
        handleClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [handleClose, open, submitting])

  async function handleSubmit(event) {
    event.preventDefault()
    if (!unitOfferAmount || submitting) return

    const unitOfferPence = parseUnitOfferPence(unitOfferAmount)
    const validationError = validateBuyerUnitOfferAmount(unitOfferPence, listingPricePence)
    if (validationError) {
      setError(validationError)
      return
    }

    const totalOfferPence = calculateTotalOfferPence(unitOfferPence, quantity)
    if (totalOfferPence == null) {
      setError('Enter a valid counter offer per item greater than zero.')
      return
    }

    await onSubmit(formatPenceAsOfferInput(totalOfferPence))
    resetForm()
  }

  if (!open) return null

  const unitOfferPence = parseUnitOfferPence(unitOfferAmount)
  const totalOfferPence = calculateTotalOfferPence(unitOfferPence, quantity)
  const totalOfferInput =
    totalOfferPence != null ? formatPenceAsOfferInput(totalOfferPence) : ''

  return (
    <div className="auth-modal make-offer-modal" role="presentation">
      <button
        type="button"
        className="auth-modal__backdrop"
        aria-label="Close"
        disabled={submitting}
        onClick={handleClose}
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
            Quantity is fixed for this negotiation. Asking price is{' '}
            {formatPricePence(listingPricePence)} per item.
          </p>
        ) : (
          <p className="make-offer-modal__lead">Enter your counter offer per item.</p>
        )}

        <form className="make-offer-modal__form" onSubmit={handleSubmit}>
          <div className="make-offer-modal__selection-summary">
            <span>
              Quantity: {quantity} {quantity === 1 ? 'item' : 'items'}
            </span>
            {listingPricePence ? (
              <span>Asking price: {formatPricePence(listingPricePence)} per item</span>
            ) : null}
          </div>

          <div className="make-offer-modal__field">
            <label className="make-offer-modal__label" htmlFor={amountId}>
              Counter offer per item
            </label>
            <input
              id={amountId}
              className="make-offer-modal__input"
              type="number"
              min="0.01"
              max={listingPricePence ? (listingPricePence / 100).toFixed(2) : undefined}
              step="0.01"
              inputMode="decimal"
              placeholder="525.00"
              value={unitOfferAmount}
              disabled={submitting}
              onChange={(event) => {
                setUnitOfferAmount(event.target.value)
                setError('')
              }}
            />
            {unitOfferPence ? (
              <p className="make-offer-modal__unit-offer">
                {formatPricePence(unitOfferPence)} per item
              </p>
            ) : null}
          </div>

          {totalOfferPence ? (
            <div className="make-offer-modal__total-offer" aria-live="polite">
              <span className="make-offer-modal__total-offer-label">Total counter-offer</span>
              <strong className="make-offer-modal__total-offer-value">
                {formatPricePence(totalOfferPence)}
              </strong>
            </div>
          ) : null}

          {counterPartyRole === 'seller' ? (
            <SellerPayoutSummary
              amountInput={totalOfferInput}
              quantity={quantity}
              compact
              offerAmountLabel="Counter-offer price"
              receiveLabel="You'll receive"
            />
          ) : (
            <BuyerProtectionOfferSummary amountInput={totalOfferInput} compact />
          )}

          {error ? (
            <p className="make-offer-modal__error" role="alert">
              {error}
            </p>
          ) : null}

          <div className="make-offer-modal__actions">
            <button
              type="submit"
              className="listing-detail__button listing-detail__button--primary make-offer-modal__button"
              disabled={submitting || !unitOfferAmount}
            >
              {submitting ? 'Sending…' : 'Send counter-offer'}
            </button>
            <button
              type="button"
              className="listing-detail__button listing-detail__button--secondary make-offer-modal__button"
              disabled={submitting}
              onClick={handleClose}
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
