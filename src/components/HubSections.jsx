import { Link } from 'react-router-dom'
import BuyerOrderConfirmation from './BuyerOrderConfirmation'
import { formatPricePence } from '../lib/listings'
import {
  canPayNow,
  formatPaymentStatus,
  isAwaitingSellerSetup,
  isPaymentComplete,
  isPaymentExpired,
} from '../lib/payments'
import { formatOfferStatus, formatOfferTimestamp } from '../lib/offers'
import {
  canBuyerConfirmOrder,
  getOfferOrder,
  isOrderAwaitingConfirmation,
  isOrderBuyerConfirmed,
  isOrderCompleted,
  PAYOUT_STATUSES,
} from '../lib/orders'

const BUYER_AWAITING_CONFIRMATION_LABEL =
  'Paid — awaiting collection/delivery confirmation'
const BUYER_CONFIRMED_LABEL = 'You confirmed receipt — payout pending'
const SELLER_AWAITING_CONFIRMATION_LABEL =
  'Buyer has paid — awaiting collection/delivery confirmation'
const SELLER_CONFIRMED_SETUP_LABEL =
  'Buyer confirmed receipt — complete payout setup to receive funds'
const SELLER_CONFIRMED_READY_LABEL = 'Buyer confirmed receipt — payout ready'

function getHubOrderStatusLabel(offer, role) {
  const payment = offer.payment
  const order = getOfferOrder(offer)

  if (role === 'buyer' && isOrderCompleted(order)) {
    return 'Purchase completed'
  }

  if (role === 'buyer' && isOrderBuyerConfirmed(order) && !isOrderCompleted(order)) {
    if (order.payout_status === PAYOUT_STATUSES.PROCESSING) {
      return 'You confirmed receipt — releasing payout…'
    }

    return BUYER_CONFIRMED_LABEL
  }

  if (role === 'seller' && isOrderBuyerConfirmed(order) && !isOrderCompleted(order)) {
    if (order.payout_status === PAYOUT_STATUSES.AWAITING_SELLER_SETUP) {
      return SELLER_CONFIRMED_SETUP_LABEL
    }

    if (order.payout_status === PAYOUT_STATUSES.PROCESSING) {
      return 'Buyer confirmed receipt — releasing payout…'
    }

    if (order.payout_status === PAYOUT_STATUSES.FAILED) {
      return 'Buyer confirmed receipt — payout release failed'
    }

    if (order.payout_status === PAYOUT_STATUSES.READY) {
      return SELLER_CONFIRMED_READY_LABEL
    }
  }

  if (isOrderAwaitingConfirmation(order, payment)) {
    return role === 'seller'
      ? SELLER_AWAITING_CONFIRMATION_LABEL
      : BUYER_AWAITING_CONFIRMATION_LABEL
  }

  if (isPaymentComplete(payment)) {
    return formatPaymentStatus(payment.status)
  }

  return null
}

function HubOfferList({
  offers,
  emptyMessage,
  showPaymentStatus = false,
  orderStatusRole = null,
  showBuyerConfirm = false,
  onConfirmOrder,
  onPayNow,
  payingPaymentId = null,
  payError = '',
}) {
  if (offers.length === 0) {
    return emptyMessage ? <p className="hub-section__empty">{emptyMessage}</p> : null
  }

  return (
    <>
      {payError ? (
        <p className="hub-page__message hub-page__message--error" role="alert">
          {payError}
        </p>
      ) : null}

      <ul className="hub-offer-list">
        {offers.map((offer) => {
          const listing = offer.listing
          const listingUrl = listing?.slug ? `/listings/${listing.slug}` : null
          const payment = offer.payment
          const order = getOfferOrder(offer)
          const showPayButton = showPaymentStatus && canPayNow(payment)
          const orderStatusLabel = orderStatusRole
            ? getHubOrderStatusLabel(offer, orderStatusRole)
            : null
          const showConfirm =
            showBuyerConfirm && canBuyerConfirmOrder(order, payment) && order?.id

          return (
            <li key={offer.id} className="hub-offer-list__item">
              <div className="hub-offer-list__main">
                {listingUrl ? (
                  <Link to={listingUrl} className="hub-offer-list__title">
                    {listing.title}
                  </Link>
                ) : (
                  <span className="hub-offer-list__title">Listing unavailable</span>
                )}
                <p className="hub-offer-list__meta">
                  Offer {formatPricePence(offer.amount_pence)} · {formatOfferStatus(offer.status)} ·{' '}
                  {formatOfferTimestamp(offer.created_at)}
                </p>
                {orderStatusLabel ? (
                  <p className="hub-offer-list__notice">{orderStatusLabel}</p>
                ) : showPaymentStatus && payment ? (
                  <p className="hub-offer-list__notice">
                    {formatPaymentStatus(payment.status)}
                    {['awaiting_seller_setup', 'pending'].includes(payment.status) &&
                    payment.expires_at &&
                    !isPaymentExpired(payment)
                      ? ` · Pay by ${formatOfferTimestamp(payment.expires_at)}`
                      : ''}
                    {isPaymentExpired(payment) ? ' · Payment window expired' : ''}
                    {isAwaitingSellerSetup(payment)
                      ? ' · Seller must complete payout setup before you can pay'
                      : ''}
                  </p>
                ) : null}
                {orderStatusRole === 'seller' &&
                isOrderBuyerConfirmed(order) &&
                order.payout_status === PAYOUT_STATUSES.AWAITING_SELLER_SETUP ? (
                  <p className="hub-offer-list__follow-up">
                    <Link to="/profile">Complete payout setup</Link>
                  </p>
                ) : null}
                {showConfirm ? (
                  <BuyerOrderConfirmation
                    orderId={order.id}
                    compact
                    onConfirmed={() => onConfirmOrder?.(offer)}
                  />
                ) : null}
                {offer.message ? (
                  <p className="hub-offer-list__message">{offer.message}</p>
                ) : null}
              </div>
              <div className="hub-offer-list__actions">
                {showPayButton ? (
                  <button
                    type="button"
                    className="hub-offer-list__pay-button"
                    disabled={payingPaymentId === payment.id}
                    onClick={() => onPayNow?.(payment.id)}
                  >
                    {payingPaymentId === payment.id ? 'Redirecting…' : 'Pay now'}
                  </button>
                ) : null}
                {listingUrl ? (
                  <Link to={listingUrl} className="hub-offer-list__link">
                    View listing
                  </Link>
                ) : null}
              </div>
            </li>
          )
        })}
      </ul>
    </>
  )
}

function HubSection({ title, lead, linkTo, linkLabel, children }) {
  return (
    <section className="hub-section">
      <header className="hub-section__header">
        <div>
          <h3 className="hub-section__title">{title}</h3>
          {lead ? <p className="hub-section__lead">{lead}</p> : null}
        </div>
        {linkTo && linkLabel ? (
          <Link to={linkTo} className="hub-section__action">
            {linkLabel}
          </Link>
        ) : null}
      </header>
      {children}
    </section>
  )
}

export { HubOfferList, HubSection }
