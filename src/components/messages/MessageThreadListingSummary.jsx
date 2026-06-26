import { Link } from 'react-router-dom'
import {
  calculateBuyerCheckoutTotals,
  formatBuyerProtectionPricePence,
} from '../../lib/buyerProtection'
import { formatPricePence } from '../../lib/listings'
import { getConversationListingImageUrl } from '../../lib/messages'
import EquipdTypeIcon from '../icons/EquipdTypeIcon'
import '../icons/EquipdTypeIcon.css'
import { EQUIPD_ICON_VARIANT } from '../../lib/equipdIconVariants'
import './MessageThreadListingSummary.css'

function ProtectionShieldIcon() {
  return (
    <svg className="message-thread-listing-summary__shield" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M8 1.5 3.25 3.5v4.25c0 3.45 2.05 6.65 4.75 7.75 2.7-1.1 4.75-4.3 4.75-7.75V3.5L8 1.5Z"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinejoin="round"
      />
      <path
        d="M5.75 8 7.25 9.5 10.25 6.5"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function MessageThreadListingSummary({
  conversation,
  userId,
  buyerHasPendingOffer = false,
  onMakeOffer,
}) {
  const listing = conversation?.listing
  const listingSlug = listing?.slug
  const listingTitle = listing?.title?.trim() || 'Listing'
  const imageUrl = getConversationListingImageUrl(conversation)
  const isBuyer = Boolean(userId && conversation?.buyer_id === userId)
  const isActive = listing?.status === 'active'
  const canMakeOffer = isBuyer && isActive && typeof onMakeOffer === 'function'
  const pricePence = listing?.price_pence
  const checkoutTotals =
    pricePence != null && pricePence > 0 ? calculateBuyerCheckoutTotals(pricePence) : null

  if (!listing) {
    return null
  }

  return (
    <section className="message-thread-listing-summary" aria-label="Listing summary">
      <div className="message-thread-listing-summary__main">
        <div className="message-thread-listing-summary__thumb" aria-hidden="true">
          {imageUrl ? (
            <img className="message-thread-listing-summary__thumb-image" src={imageUrl} alt="" />
          ) : (
            <EquipdTypeIcon
              variant={EQUIPD_ICON_VARIANT.MESSAGES}
              className="message-thread-listing-summary__thumb-icon"
            />
          )}
        </div>

        <div className="message-thread-listing-summary__content">
          <h3 className="message-thread-listing-summary__title">{listingTitle}</h3>

          {pricePence != null ? (
            <p className="message-thread-listing-summary__price">{formatPricePence(pricePence)}</p>
          ) : null}

          {checkoutTotals?.buyerTotalPence ? (
            <p className="message-thread-listing-summary__protected-price">
              <span className="message-thread-listing-summary__protected-amount">
                {formatBuyerProtectionPricePence(checkoutTotals.buyerTotalPence)}
              </span>
              <span className="message-thread-listing-summary__protected-label">
                inc. Buyer Protection
                <ProtectionShieldIcon />
              </span>
            </p>
          ) : null}
        </div>
      </div>

      {listingSlug ? (
        <div
          className={`message-thread-listing-summary__actions${
            canMakeOffer ? '' : ' message-thread-listing-summary__actions--single'
          }`}
        >
          <Link
            to={`/listings/${listingSlug}`}
            className="message-thread-listing-summary__button message-thread-listing-summary__button--secondary"
          >
            View listing
          </Link>

          {canMakeOffer ? (
            <button
              type="button"
              className="message-thread-listing-summary__button message-thread-listing-summary__button--primary"
              onClick={onMakeOffer}
              disabled={buyerHasPendingOffer}
              title={
                buyerHasPendingOffer
                  ? 'You already have a pending offer on this listing'
                  : undefined
              }
            >
              Make offer
            </button>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}

export default MessageThreadListingSummary
