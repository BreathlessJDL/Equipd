import { useEffect } from 'react'
import FulfilmentMethodSelector from './FulfilmentMethodSelector'
import './auth/AuthModal.css'
import './FulfilmentChoiceModal.css'

function FulfilmentChoiceModal({
  open,
  options,
  selectedOrderType,
  name,
  submitting = false,
  error = '',
  onSelect,
  onClose,
  onContinue,
}) {
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

  if (!open) return null

  return (
    <div className="auth-modal fulfilment-choice-modal" role="presentation">
      <button
        type="button"
        className="auth-modal__backdrop"
        aria-label="Close"
        disabled={submitting}
        onClick={onClose}
      />

      <div
        className="auth-modal__dialog fulfilment-choice-modal__dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="fulfilment-choice-modal-title"
      >
        <h2 id="fulfilment-choice-modal-title" className="fulfilment-choice-modal__title">
          How will you receive this item?
        </h2>

        <FulfilmentMethodSelector
          options={options}
          selectedOrderType={selectedOrderType}
          name={name}
          disabled={submitting}
          hideLegend
          modal
          onSelect={onSelect}
        />

        {error ? (
          <p className="fulfilment-choice-modal__error" role="alert">
            {error}
          </p>
        ) : null}

        <div className="fulfilment-choice-modal__actions">
          <button
            type="button"
            className="listing-detail__button listing-detail__button--primary fulfilment-choice-modal__button"
            disabled={submitting || !selectedOrderType}
            onClick={onContinue}
          >
            {submitting ? 'Redirecting…' : 'Continue to payment'}
          </button>
          <button
            type="button"
            className="listing-detail__button listing-detail__button--secondary fulfilment-choice-modal__button"
            disabled={submitting}
            onClick={onClose}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

export default FulfilmentChoiceModal
