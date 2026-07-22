import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import '../auth/AuthModal.css'
import './OfferSentConfirmationModal.css'

function OfferSentConfirmationModal({ open, conversationId = null, quantity = 1, onClose }) {
  useEffect(() => {
    if (!open) return undefined

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="auth-modal offer-sent-modal" role="presentation">
      <button
        type="button"
        className="auth-modal__backdrop"
        aria-label="Close"
        onClick={onClose}
      />

      <div
        className="auth-modal__dialog offer-sent-modal__dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="offer-sent-modal-title"
      >
        <h2 id="offer-sent-modal-title" className="offer-sent-modal__title">
          Offer sent
        </h2>
        <p className="offer-sent-modal__body" role="status">
          {quantity > 1
            ? `Your offer for ${quantity} items has been sent to the seller.`
            : 'Your offer has been sent to the seller.'}
        </p>
        <div className="offer-sent-modal__actions">
          {conversationId ? (
            <Link
              to={`/messages/${conversationId}`}
              className="listing-detail__button listing-detail__button--primary offer-sent-modal__button"
              onClick={onClose}
            >
              View conversation
            </Link>
          ) : null}
          <button
            type="button"
            className="listing-detail__button listing-detail__button--secondary offer-sent-modal__button"
            onClick={onClose}
          >
            Stay on listing
          </button>
        </div>
      </div>
    </div>
  )
}

export default OfferSentConfirmationModal
