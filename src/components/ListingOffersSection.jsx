import { useState } from 'react'
import { Link } from 'react-router-dom'
import { formatPricePence } from '../lib/listings'
import {
  acceptOffer,
  createOfferFromForm,
  formatOfferStatus,
  formatOfferTimestamp,
  getOfferErrorMessage,
  hasPendingOffer,
  rejectOffer,
  withdrawOffer,
} from '../lib/offers'
import { startConversationForListing } from '../lib/messages'
import '../components/ListingDetail.css'

function ListingOffersSection({
  listing,
  user,
  isOwner,
  offers,
  loadingOffers,
  offersError,
  onOffersChange,
  onOfferAccepted,
}) {
  const [offerAmount, setOfferAmount] = useState('')
  const [offerMessage, setOfferMessage] = useState('')
  const [submittingOffer, setSubmittingOffer] = useState(false)
  const [offerFormError, setOfferFormError] = useState('')
  const [offerFormSuccess, setOfferFormSuccess] = useState('')
  const [updatingOfferId, setUpdatingOfferId] = useState(null)
  const [actionError, setActionError] = useState('')

  const canMakeOffer = Boolean(user && !isOwner && listing.status === 'active')
  const buyerHasPendingOffer = user ? hasPendingOffer(offers, user.id) : false
  const showOffersSection = Boolean(user && (isOwner || canMakeOffer || offers.length > 0))

  async function handleCreateOffer(event) {
    event.preventDefault()
    if (!user?.id || !listing) return

    setSubmittingOffer(true)
    setOfferFormError('')
    setOfferFormSuccess('')

    const { data: conversation } = await startConversationForListing({
      listingId: listing.id,
      buyerId: user.id,
      sellerId: listing.seller_id,
    })

    const { data, error } = await createOfferFromForm({
      listingId: listing.id,
      buyerId: user.id,
      sellerId: listing.seller_id,
      amountInput: offerAmount,
      message: offerMessage,
      conversationId: conversation?.id ?? null,
    })

    setSubmittingOffer(false)

    if (error) {
      setOfferFormError(getOfferErrorMessage(error))
      return
    }

    setOfferAmount('')
    setOfferMessage('')
    setOfferFormSuccess('Offer submitted.')
    onOffersChange([data, ...offers])
  }

  async function handleOfferAction(offerId, action) {
    setUpdatingOfferId(offerId)
    setActionError('')

    const actionMap = {
      accept: acceptOffer,
      reject: rejectOffer,
      withdraw: withdrawOffer,
    }

    const { data, offers: refreshedOffers, error } = await actionMap[action](offerId)

    setUpdatingOfferId(null)

    if (error) {
      setActionError(getOfferErrorMessage(error))
      return
    }

    if (action === 'accept' && refreshedOffers) {
      onOffersChange(refreshedOffers)
      onOfferAccepted?.()
      return
    }

    onOffersChange(offers.map((offer) => (offer.id === data.id ? data : offer)))
  }

  if (!showOffersSection) {
    return null
  }

  return (
    <section className="listing-detail__offers">
      <h2 className="listing-detail__offers-title">Offers</h2>

      {canMakeOffer ? (
        <form className="listing-detail__offer-form" onSubmit={handleCreateOffer}>
          <p className="listing-detail__offers-lead">
            Make an offer below the asking price of {formatPricePence(listing.price_pence)}.
          </p>

          <div className="listing-detail__offer-field">
            <label className="listing-detail__label" htmlFor="offer-amount">
              Your offer (GBP)
            </label>
            <input
              id="offer-amount"
              className="listing-detail__offer-input"
              type="number"
              min="0.01"
              step="0.01"
              inputMode="decimal"
              placeholder="150.00"
              value={offerAmount}
              disabled={buyerHasPendingOffer || submittingOffer}
              onChange={(event) => {
                setOfferAmount(event.target.value)
                setOfferFormError('')
                setOfferFormSuccess('')
              }}
            />
          </div>

          <div className="listing-detail__offer-field">
            <label className="listing-detail__label" htmlFor="offer-message">
              Message (optional)
            </label>
            <textarea
              id="offer-message"
              className="listing-detail__offer-textarea"
              value={offerMessage}
              disabled={buyerHasPendingOffer || submittingOffer}
              onChange={(event) => {
                setOfferMessage(event.target.value)
                setOfferFormError('')
                setOfferFormSuccess('')
              }}
            />
          </div>

          {buyerHasPendingOffer ? (
            <p className="listing-detail__offers-note">
              You already have a pending offer on this listing. Withdraw it below to submit a new
              one.
            </p>
          ) : null}

          {offerFormError ? (
            <p className="listing-detail__message listing-detail__message--error" role="alert">
              {offerFormError}
            </p>
          ) : null}

          {offerFormSuccess ? (
            <p className="listing-detail__message listing-detail__message--success" role="status">
              {offerFormSuccess}
            </p>
          ) : null}

          <button
            type="submit"
            className="listing-detail__button listing-detail__button--primary"
            disabled={submittingOffer || buyerHasPendingOffer || !offerAmount}
          >
            {submittingOffer ? 'Submitting offer…' : 'Make offer'}
          </button>
        </form>
      ) : null}

      {loadingOffers ? <p className="listing-detail__offers-note">Loading offers…</p> : null}

      {offersError ? (
        <p className="listing-detail__message listing-detail__message--error" role="alert">
          {offersError}
        </p>
      ) : null}

      {actionError ? (
        <p className="listing-detail__message listing-detail__message--error" role="alert">
          {actionError}
        </p>
      ) : null}

      {!loadingOffers && !offersError && offers.length === 0 ? (
        <p className="listing-detail__offers-note">
          {isOwner ? 'No offers yet.' : 'You have not made an offer on this listing yet.'}
        </p>
      ) : null}

      {!loadingOffers && offers.length > 0 ? (
        <ul className="listing-detail__offer-list">
          {offers.map((offer) => {
            const isBuyer = offer.buyer_id === user?.id
            const isSeller = offer.seller_id === user?.id
            const isPending = offer.status === 'pending'

            return (
              <li key={offer.id} className="listing-detail__offer-item">
                <div className="listing-detail__offer-header">
                  <p className="listing-detail__offer-amount">{formatPricePence(offer.amount_pence)}</p>
                  <span className="listing-detail__offer-status">{formatOfferStatus(offer.status)}</span>
                </div>

                <p className="listing-detail__offer-meta">
                  {isOwner ? 'From buyer' : 'Your offer'} · {formatOfferTimestamp(offer.created_at)}
                </p>

                {offer.message ? <p className="listing-detail__offer-message">{offer.message}</p> : null}

                {offer.conversation_id ? (
                  <p className="listing-detail__offer-meta">
                    <Link to={`/messages/${offer.conversation_id}`}>View conversation</Link>
                  </p>
                ) : null}

                {isSeller && isPending ? (
                  <div className="listing-detail__offer-actions">
                    <button
                      type="button"
                      className="listing-detail__button listing-detail__button--primary"
                      disabled={updatingOfferId === offer.id}
                      onClick={() => handleOfferAction(offer.id, 'accept')}
                    >
                      Accept
                    </button>
                    <button
                      type="button"
                      className="listing-detail__button listing-detail__button--secondary"
                      disabled={updatingOfferId === offer.id}
                      onClick={() => handleOfferAction(offer.id, 'reject')}
                    >
                      Reject
                    </button>
                  </div>
                ) : null}

                {isBuyer && isPending ? (
                  <div className="listing-detail__offer-actions">
                    <button
                      type="button"
                      className="listing-detail__button listing-detail__button--secondary"
                      disabled={updatingOfferId === offer.id}
                      onClick={() => handleOfferAction(offer.id, 'withdraw')}
                    >
                      Withdraw offer
                    </button>
                  </div>
                ) : null}
              </li>
            )
          })}
        </ul>
      ) : null}
    </section>
  )
}

export default ListingOffersSection
