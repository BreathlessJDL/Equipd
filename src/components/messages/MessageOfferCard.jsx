import { useState } from 'react'
import { Link } from 'react-router-dom'
import { formatPricePence } from '../../lib/listings'
import { getListingPrimaryImageUrl } from '../../lib/listingImages'
import {
  acceptCounterOffer,
  acceptOffer,
  canBuyerRespondToCounterOffer,
  canSellerRespondToOffer,
  counterOffer,
  declineOffer,
  formatOfferTimestamp,
  getOfferDisplayStatus,
  getOfferErrorMessage,
  getOfferUnitAmountPence,
} from '../../lib/offers'
import { canPayNow } from '../../lib/payments'
import PayNowWithFulfilment from '../PayNowWithFulfilment'
import { formatMessageTimestamp } from '../../lib/messages'
import { CircleCheckIcon, NewOfferTagIcon } from '../icons/NotificationIcons'
import CounterOfferModal from './CounterOfferModal'
import AcceptOfferConfirmationModal from '../listing/AcceptOfferConfirmationModal'
import './MessageOfferCard.css'

function OfferCalendarIcon({ className = '' }) {
  return (
    <svg
      className={className}
      viewBox="0 0 16 16"
      width="14"
      height="14"
      fill="none"
      aria-hidden="true"
    >
      <rect
        x="2.25"
        y="3.25"
        width="11.5"
        height="10.5"
        rx="1.5"
        stroke="currentColor"
        strokeWidth="1.25"
      />
      <path d="M2.25 6.5h11.5" stroke="currentColor" strokeWidth="1.25" />
      <path
        d="M5.25 2.25v2M10.75 2.25v2"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
      />
    </svg>
  )
}

function MessageOfferCard({ message, conversation, user, onOfferUpdated }) {
  const offer = message.offer
  const [acting, setActing] = useState(false)
  const [actionError, setActionError] = useState('')
  const [paying, setPaying] = useState(false)
  const [counterModalOpen, setCounterModalOpen] = useState(false)
  const [acceptConfirmationOpen, setAcceptConfirmationOpen] = useState(false)

  if (!offer) return null

  const listing = offer.listing ?? conversation?.listing
  const isSeller = user?.id === conversation?.seller_id
  const isBuyer = user?.id === conversation?.buyer_id
  const isMine = message.sender_id === user?.id
  const payment = offer.payment
  const showSellerActions = isSeller && canSellerRespondToOffer(offer)
  const showBuyerCounterActions = isBuyer && canBuyerRespondToCounterOffer(offer)
  const showPayNow = isBuyer && offer.status === 'accepted' && canPayNow(payment)
  const displayStatus = getOfferDisplayStatus(offer)
  const counterPartyRole = isBuyer ? 'buyer' : 'seller'
  const quantity = offer.quantity ?? 1
  const unitOfferPence = getOfferUnitAmountPence(offer.amount_pence, quantity)
  const quantityLabel = `Offer for ${quantity} ${quantity === 1 ? 'item' : 'items'}`
  const primaryAmountLabel = formatPricePence(offer.amount_pence)
  const unitAmountLabel = quantity > 1 && unitOfferPence
    ? `${formatPricePence(unitOfferPence)} per item`
    : null
  const statusVariant = displayStatus.variant === 'declined'
    ? 'rejected'
    : displayStatus.variant

  async function runAction(action) {
    setActing(true)
    setActionError('')

    const actionMap = {
      accept: () => acceptOffer(offer.id),
      acceptCounter: () => acceptCounterOffer(offer.id),
      decline: () => declineOffer(offer.id),
    }

    const { error } = await actionMap[action]()

    setActing(false)

    if (error) {
      setActionError(getOfferErrorMessage(error))
      return
    }

    if (action === 'accept' && isSeller) {
      setAcceptConfirmationOpen(true)
    }

    onOfferUpdated?.()
  }

  async function handleCounterSubmit(amountInput) {
    setActing(true)
    setActionError('')

    const { error } = await counterOffer(offer.id, amountInput)

    setActing(false)
    setCounterModalOpen(false)

    if (error) {
      setActionError(getOfferErrorMessage(error))
      return
    }

    onOfferUpdated?.()
  }

  const thumbnailUrl = getListingPrimaryImageUrl(listing)

  return (
    <>
      <div
        className={`message-offer-card${isMine ? ' message-offer-card--mine' : ''}`}
        aria-label={`Offer ${primaryAmountLabel}`}
      >
        <div className="message-offer-card__header">
          <div className="message-offer-card__badge">
            <NewOfferTagIcon className="message-offer-card__badge-icon" />
            <span>Offer</span>
          </div>
          <span
            className={`message-offer-card__status message-offer-card__status--${statusVariant}`}
          >
            {statusVariant === 'accepted' ? (
              <CircleCheckIcon className="message-offer-card__status-icon" />
            ) : null}
            {displayStatus.label}
          </span>
        </div>

        <div className="message-offer-card__body">
          {thumbnailUrl ? (
            <img src={thumbnailUrl} alt="" className="message-offer-card__thumb" />
          ) : (
            <div
              className="message-offer-card__thumb message-offer-card__thumb--empty"
              aria-hidden="true"
            >
              No photo
            </div>
          )}

          <div className="message-offer-card__copy">
            {listing?.slug ? (
              <Link to={`/listings/${listing.slug}`} className="message-offer-card__title">
                {listing.title ?? 'Listing'}
              </Link>
            ) : (
              <p className="message-offer-card__title">{listing?.title ?? 'Listing'}</p>
            )}
            <p className="message-offer-card__quantity">{quantityLabel}</p>
            <div className="message-offer-card__price">
              <span className="message-offer-card__price-label">Offer price</span>
              <p className="message-offer-card__amount">{primaryAmountLabel}</p>
              {unitAmountLabel ? (
                <p className="message-offer-card__unit-amount">{unitAmountLabel}</p>
              ) : null}
            </div>
            {offer.message ? (
              <p className="message-offer-card__note">{offer.message}</p>
            ) : null}
          </div>
        </div>

        <div className="message-offer-card__footer">
          <OfferCalendarIcon className="message-offer-card__footer-icon" />
          <time className="message-offer-card__time" dateTime={message.created_at}>
            {formatMessageTimestamp(message.created_at)}
          </time>
        </div>

        {actionError ? (
          <p className="message-offer-card__error" role="alert">
            {actionError}
          </p>
        ) : null}

        {showSellerActions ? (
          <div className="message-offer-card__actions">
            <button
              type="button"
              className="message-offer-card__button message-offer-card__button--primary"
              disabled={acting}
              onClick={() => runAction('accept')}
            >
              {acting ? 'Accepting…' : 'Accept offer'}
            </button>
            <button
              type="button"
              className="message-offer-card__button message-offer-card__button--secondary"
              disabled={acting}
              onClick={() => setCounterModalOpen(true)}
            >
              Counter offer
            </button>
            <button
              type="button"
              className="message-offer-card__button message-offer-card__button--secondary"
              disabled={acting}
              onClick={() => runAction('decline')}
            >
              {acting ? 'Declining…' : 'Decline'}
            </button>
          </div>
        ) : null}

        {showBuyerCounterActions ? (
          <div className="message-offer-card__actions">
            <button
              type="button"
              className="message-offer-card__button message-offer-card__button--primary"
              disabled={acting}
              onClick={() => runAction('acceptCounter')}
            >
              {acting ? 'Accepting…' : 'Accept counter-offer'}
            </button>
            <button
              type="button"
              className="message-offer-card__button message-offer-card__button--secondary"
              disabled={acting}
              onClick={() => setCounterModalOpen(true)}
            >
              Counter offer
            </button>
            <button
              type="button"
              className="message-offer-card__button message-offer-card__button--secondary"
              disabled={acting}
              onClick={() => runAction('decline')}
            >
              {acting ? 'Declining…' : 'Decline'}
            </button>
          </div>
        ) : null}

        {showPayNow ? (
          <div className="message-offer-card__actions">
            <PayNowWithFulfilment
              offer={{ ...offer, listing }}
              payment={payment}
              payingPaymentId={paying ? payment.id : null}
              onPayStart={() => setPaying(true)}
              onPayComplete={() => setPaying(false)}
            />
            {payment?.expires_at ? (
              <p className="message-offer-card__pay-by">
                Pay by {formatOfferTimestamp(payment.expires_at)}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>

      <CounterOfferModal
        open={counterModalOpen}
        listingPricePence={listing?.price_pence}
        quantity={quantity}
        submitting={acting}
        counterPartyRole={counterPartyRole}
        onClose={() => setCounterModalOpen(false)}
        onSubmit={handleCounterSubmit}
      />

      <AcceptOfferConfirmationModal
        open={acceptConfirmationOpen}
        itemPricePence={offer.amount_pence}
        quantity={quantity}
        conversationId={offer.conversation_id ?? conversation?.id ?? null}
        onClose={() => setAcceptConfirmationOpen(false)}
      />
    </>
  )
}

export default MessageOfferCard
