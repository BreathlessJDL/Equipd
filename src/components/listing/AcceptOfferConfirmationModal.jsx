import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import SellerPayoutSummary from '../SellerPayoutSummary'
import '../auth/AuthModal.css'
import './OfferSentConfirmationModal.css'

function AcceptOfferConfirmationModal({
  open,
  itemPricePence = null,
  payment = null,
  quantity = 1,
  conversationId = null,
  onClose,
}) {
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
        className="auth-modal__dialog offer-sent-modal__dialog offer-sent-modal__dialog--wide"
        role="dialog"
        aria-modal="true"
        aria-labelledby="accept-offer-modal-title"
      >
        <h2 id="accept-offer-modal-title" className="offer-sent-modal__title">
          Offer accepted
        </h2>
        <p className="offer-sent-modal__body" role="status">
          {quantity > 1
            ? `The offer for ${quantity} items was accepted. The buyer can now complete payment. Your payout breakdown:`
            : 'The buyer can now complete payment. Your payout breakdown:'}
        </p>

        <SellerPayoutSummary
          itemPricePence={itemPricePence}
          payment={payment}
          quantity={quantity}
          offerAmountLabel="Sale price"
          receiveLabel="You'll receive"
          showNote
        />

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
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

export default AcceptOfferConfirmationModal
