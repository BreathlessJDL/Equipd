import { useCallback, useEffect, useId, useState } from 'react'
import { formatPricePence } from '../../lib/listings'
import {
  calculateTotalOfferPence,
  clampOfferQuantity,
  formatPenceAsOfferInput,
  getOfferErrorMessage,
  parseOfferQuantityInput,
  parseUnitOfferPence,
  validateBuyerUnitOfferAmount,
} from '../../lib/offers'
import { submitListingOffer } from '../../lib/offerMessaging'
import BuyerProtectionOfferSummary from '../BuyerProtectionOfferSummary'
import '../auth/AuthModal.css'
import './MakeOfferModal.css'

function parseAvailableQuantityFromError(error) {
  const match = error?.message?.match(
    /Insufficient inventory:\s*requested\s+\d+,\s*available\s+(\d+)/i,
  )
  if (!match) return null
  const available = Number(match[1])
  return Number.isSafeInteger(available) ? available : null
}

function MakeOfferModal({
  open,
  listing,
  user,
  buyerHasPendingOffer = false,
  quantity: controlledQuantity = null,
  onQuantityChange = null,
  onAvailabilityChanged = null,
  onClose,
  onSubmitted,
}) {
  const availableQuantity = Number.isSafeInteger(Number(listing?.quantity_available))
    ? Math.max(1, Number(listing.quantity_available))
    : 1
  const amountId = useId()
  const quantityId = useId()
  const messageId = useId()
  const [unitOfferAmount, setUnitOfferAmount] = useState('')
  const [offerMessage, setOfferMessage] = useState('')
  const [internalQuantity, setInternalQuantity] = useState(1)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const quantity = clampOfferQuantity(
    controlledQuantity ?? internalQuantity,
    availableQuantity,
  )

  const changeQuantity = useCallback(
    (nextQuantity) => {
      const clamped = clampOfferQuantity(nextQuantity, availableQuantity)
      if (typeof onQuantityChange === 'function') {
        onQuantityChange(clamped)
      } else {
        setInternalQuantity(clamped)
      }
      setError('')
    },
    [availableQuantity, onQuantityChange],
  )

  const resetOfferFields = useCallback(() => {
    setUnitOfferAmount('')
    setOfferMessage('')
    setError('')
    setSubmitting(false)
  }, [])

  const handleClose = useCallback(() => {
    resetOfferFields()
    onClose()
  }, [onClose, resetOfferFields])

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

  function handleQuantityInputChange(rawValue) {
    const { quantity: nextQuantity, error: quantityError } = parseOfferQuantityInput(
      rawValue,
      availableQuantity,
    )
    if (quantityError && nextQuantity == null) {
      setError(quantityError)
      return
    }
    if (nextQuantity != null) {
      changeQuantity(nextQuantity)
      if (quantityError) {
        setError(quantityError)
      }
    }
  }

  async function handleSubmit(event) {
    event.preventDefault()
    if (!user?.id || !listing || buyerHasPendingOffer) return

    setSubmitting(true)
    setError('')

    const unitOfferPence = parseUnitOfferPence(unitOfferAmount)
    const unitError = validateBuyerUnitOfferAmount(unitOfferPence, listing.price_pence)
    if (unitError) {
      setSubmitting(false)
      setError(unitError)
      return
    }

    const totalOfferPence = calculateTotalOfferPence(unitOfferPence, quantity)
    if (totalOfferPence == null) {
      setSubmitting(false)
      setError('Enter a valid offer per item greater than zero.')
      return
    }

    const { data, error: submitError } = await submitListingOffer({
      listingId: listing.id,
      buyerId: user.id,
      sellerId: listing.seller_id,
      amountInput: formatPenceAsOfferInput(totalOfferPence),
      message: offerMessage,
      listingPricePence: listing.price_pence,
      quantity,
    })

    setSubmitting(false)

    if (submitError) {
      const refreshedAvailability = parseAvailableQuantityFromError(submitError)
      if (refreshedAvailability != null) {
        if (typeof onAvailabilityChanged === 'function') {
          onAvailabilityChanged(refreshedAvailability)
        }
        changeQuantity(clampOfferQuantity(quantity, refreshedAvailability))
      }
      setError(getOfferErrorMessage(submitError))
      return
    }

    resetOfferFields()
    onSubmitted(data)
  }

  if (!open) return null

  const showQuantity = availableQuantity > 1
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
        aria-labelledby="make-offer-modal-title"
      >
        <h2 id="make-offer-modal-title" className="make-offer-modal__title">
          Make an offer
        </h2>
        <p className="make-offer-modal__lead">
          Asking price is {formatPricePence(listing.price_pence)} per item.
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
              onClick={handleClose}
            >
              Cancel
            </button>
          </>
        ) : (
          <form className="make-offer-modal__form" onSubmit={handleSubmit}>
            {showQuantity ? (
              <div className="make-offer-modal__field">
                <label className="make-offer-modal__label" htmlFor={quantityId}>
                  Quantity
                </label>
                <div className="make-offer-modal__quantity-row">
                  <div className="make-offer-modal__stepper" aria-label="Offer quantity">
                    <button
                      type="button"
                      aria-label="Decrease quantity"
                      disabled={submitting || quantity <= 1}
                      onClick={() => changeQuantity(quantity - 1)}
                    >
                      −
                    </button>
                    <input
                      id={quantityId}
                      className="make-offer-modal__quantity-input"
                      type="number"
                      min={1}
                      max={availableQuantity}
                      step={1}
                      inputMode="numeric"
                      value={quantity}
                      disabled={submitting}
                      onChange={(event) => handleQuantityInputChange(event.target.value)}
                    />
                    <button
                      type="button"
                      aria-label="Increase quantity"
                      disabled={submitting || quantity >= availableQuantity}
                      onClick={() => changeQuantity(quantity + 1)}
                    >
                      +
                    </button>
                  </div>
                  <span className="make-offer-modal__availability">
                    {availableQuantity} available
                  </span>
                </div>
              </div>
            ) : null}

            <div className="make-offer-modal__field">
              <label className="make-offer-modal__label" htmlFor={amountId}>
                Offer per item
              </label>
              <input
                id={amountId}
                className="make-offer-modal__input"
                type="number"
                min="0.01"
                max={(listing.price_pence / 100).toFixed(2)}
                step="0.01"
                inputMode="decimal"
                placeholder="500.00"
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
                <span className="make-offer-modal__total-offer-label">Total offer</span>
                <strong className="make-offer-modal__total-offer-value">
                  {formatPricePence(totalOfferPence)}
                </strong>
              </div>
            ) : null}

            <BuyerProtectionOfferSummary amountInput={totalOfferInput} compact />

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
                disabled={submitting || !unitOfferAmount}
              >
                {submitting ? 'Submitting offer…' : 'Submit offer'}
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
        )}
      </div>
    </div>
  )
}

export default MakeOfferModal
