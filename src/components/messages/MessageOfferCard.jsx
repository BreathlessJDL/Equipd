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
import {
  shouldShowBuyerPricing,
  shouldShowSellerPricing,
} from '../../lib/pricingViewerRole'
import PayNowWithFulfilment from '../PayNowWithFulfilment'
import BuyerProtectionPriceDisplay from '../BuyerProtectionPriceDisplay'
import SellerPayoutSummary from '../SellerPayoutSummary'
import { formatMessageTimestamp } from '../../lib/messages'
import CounterOfferModal from './CounterOfferModal'
import AcceptOfferConfirmationModal from '../listing/AcceptOfferConfirmationModal'
import './MessageOfferCard.css'

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
  const showBuyerPricing = shouldShowBuyerPricing({ userId: user?.id, offer })
  const showSellerPricing = shouldShowSellerPricing({ userId: user?.id, offer })
  const quantity = offer.quantity ?? 1
  const unitOfferPence = getOfferUnitAmountPence(offer.amount_pence, quantity)

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
        aria-label={`Offer ${formatPricePence(offer.amount_pence)}`}
      >
        <div className="message-offer-card__header">
          <span className="message-offer-card__badge">Offer</span>
          <span
            className={`message-offer-card__status message-offer-card__status--${displayStatus.variant}`}
          >
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
            <p className="message-offer-card__amount">
              Offer for {quantity} {quantity === 1 ? 'item' : 'items'}
            </p>
            <p className="message-offer-card__meta">
              {unitOfferPence ? `${formatPricePence(unitOfferPence)} per item` : ''}
              {unitOfferPence ? ' · ' : ''}
              {formatPricePence(offer.amount_pence)} total
            </p>
            {offer.message ? (
              <p className="message-offer-card__note">{offer.message}</p>
            ) : null}
            {showBuyerPricing ? (
              <BuyerProtectionPriceDisplay
                payment={payment ?? null}
                itemPricePence={payment ? null : offer.amount_pence}
                quantity={quantity}
              />
            ) : null}
            {showSellerPricing ? (
              <SellerPayoutSummary
                itemPricePence={offer.amount_pence}
                quantity={quantity}
                payment={payment ?? null}
                compact
                offerAmountLabel="Offer price"
                receiveLabel="You'll receive"
              />
            ) : null}
          </div>
        </div>

        <time className="message-offer-card__time" dateTime={message.created_at}>
          {formatMessageTimestamp(message.created_at)}
        </time>

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
              <p className="message-offer-card__meta">
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
