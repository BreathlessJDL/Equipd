import { Link } from 'react-router-dom'
import { formatPricePence } from '../lib/listings'
import { formatOfferStatus, formatOfferTimestamp } from '../lib/offers'

function HubOfferList({ offers, showPaymentNotice = false, emptyMessage }) {
  if (offers.length === 0) {
    return <p className="hub-section__empty">{emptyMessage}</p>
  }

  return (
    <ul className="hub-offer-list">
      {offers.map((offer) => {
        const listing = offer.listing
        const listingUrl = listing?.slug ? `/listings/${listing.slug}` : null

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
              {offer.message ? (
                <p className="hub-offer-list__message">{offer.message}</p>
              ) : null}
              {showPaymentNotice ? (
                <p className="hub-offer-list__notice">Payment not implemented yet</p>
              ) : null}
            </div>
            {listingUrl ? (
              <Link to={listingUrl} className="hub-offer-list__link">
                View listing
              </Link>
            ) : null}
          </li>
        )
      })}
    </ul>
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
