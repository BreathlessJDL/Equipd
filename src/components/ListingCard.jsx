import { Link } from 'react-router-dom'
import BuyerProtectionPriceDisplay from './BuyerProtectionPriceDisplay'
import { normalizeListingPricePence } from '../lib/buyerProtection'
import {
  formatListingStatus,
  getConditionLabel,
} from '../lib/listings'
import { formatListingLocationCard } from '../lib/listingLocation'
import { formatListingDistanceLabel } from '../lib/listingDistance'
import { getListingPrimaryImageUrl } from '../lib/listingImages'
import ListingSaveButton from './ListingSaveButton'
import './ListingCard.css'

const NEW_LISTING_DAYS = 14

function isRecentListing(listing) {
  if (!listing?.created_at) return false

  const createdAt = new Date(listing.created_at).getTime()
  if (Number.isNaN(createdAt)) return false

  const ageMs = Date.now() - createdAt
  return ageMs <= NEW_LISTING_DAYS * 24 * 60 * 60 * 1000
}

function ListingCardImage({ listing }) {
  const imageUrl = getListingPrimaryImageUrl(listing)

  if (imageUrl) {
    return <img src={imageUrl} alt="" className="listing-card__image" />
  }

  return <div className="listing-card__image listing-card__image--placeholder">No photo</div>
}

function ListingCardGrid({ listing, showStatus = false, showNewBadge = false }) {
  const showBadge = showNewBadge && isRecentListing(listing)
  const locationLabel = formatListingLocationCard(listing)
  const distanceLabel = formatListingDistanceLabel(listing)

  return (
    <article className="listing-card listing-card--grid">
      <div className="listing-card__media">
        <Link to={`/listings/${listing.slug}`} className="listing-card__image-link" tabIndex={-1}>
          <ListingCardImage listing={listing} />
        </Link>
        {showBadge ? <span className="listing-card__badge">New</span> : null}
        <ListingSaveButton listing={listing} />
      </div>

      <Link to={`/listings/${listing.slug}`} className="listing-card__body">
        <h3 className="listing-card__title" title={listing.title}>
          {listing.title}
        </h3>

        <p className="listing-card__condition">{getConditionLabel(listing.condition)}</p>

        <BuyerProtectionPriceDisplay
          itemPricePence={normalizeListingPricePence(listing.price_pence ?? listing.price)}
          compact
          className="listing-card__price-stack"
        />

        {locationLabel ? (
          <p className="listing-card__location">
            <svg viewBox="0 0 24 24" aria-hidden="true" className="listing-card__location-icon">
              <path
                d="M12 21s7-4.6 7-11a7 7 0 1 0-14 0c0 6.4 7 11 7 11Z"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.75"
              />
              <circle cx="12" cy="10" r="2.5" fill="currentColor" />
            </svg>
            {locationLabel}
          </p>
        ) : null}

        {distanceLabel ? <p className="listing-card__distance">{distanceLabel}</p> : null}

        {showStatus ? (
          <div className="listing-card__meta">
            <span className="listing-card__tag listing-card__tag--status">
              {formatListingStatus(listing.status)}
            </span>
            {listing.courier_available ? (
              <span className="listing-card__tag">Courier</span>
            ) : null}
          </div>
        ) : null}
      </Link>
    </article>
  )
}

function ListingCardRow({ listing, showStatus = false }) {
  const hasCollection = listing.collection_available !== false
  const locationLabel = formatListingLocationCard(listing)
  const distanceLabel = formatListingDistanceLabel(listing)

  return (
    <article className="listing-row">
      <div className="listing-row__media">
        <Link to={`/listings/${listing.slug}`} className="listing-row__image-link" tabIndex={-1}>
          <ListingCardImage listing={listing} />
        </Link>
        <ListingSaveButton listing={listing} />
      </div>

      <div className="listing-row__content">
        <Link to={`/listings/${listing.slug}`} className="listing-row__title">
          {listing.title}
        </Link>

        <div className="listing-row__tags">
          {showStatus ? (
            <span className="listing-row__status">{formatListingStatus(listing.status)}</span>
          ) : null}
          <span className="listing-row__condition">{getConditionLabel(listing.condition)}</span>
        </div>

        <BuyerProtectionPriceDisplay
          itemPricePence={normalizeListingPricePence(listing.price_pence ?? listing.price)}
          compact
          className="listing-row__price-stack"
        />

        {hasCollection ? (
          <p className="listing-row__collection">
            <svg viewBox="0 0 24 24" aria-hidden="true" className="listing-row__collection-icon">
              <path
                d="M3 10.5 12 4l9 6.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1v-9.5Z"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinejoin="round"
              />
            </svg>
            Collection available
            <svg viewBox="0 0 24 24" aria-hidden="true" className="listing-row__check-icon">
              <path
                d="M20 6 9.5 16.5 4 11"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </p>
        ) : null}

        {locationLabel ? (
          <p className="listing-row__location">
            <svg viewBox="0 0 24 24" aria-hidden="true" className="listing-row__location-icon">
              <path
                d="M12 21s7-4.6 7-11a7 7 0 1 0-14 0c0 6.4 7 11 7 11Z"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.75"
              />
              <circle cx="12" cy="10" r="2.5" fill="currentColor" />
            </svg>
            {locationLabel}
          </p>
        ) : null}

        {distanceLabel ? <p className="listing-row__distance">{distanceLabel}</p> : null}
      </div>
    </article>
  )
}

function ListingCard({
  listing,
  showStatus = false,
  variant = 'grid',
  showNewBadge = false,
}) {
  if (variant === 'row') {
    return <ListingCardRow listing={listing} showStatus={showStatus} />
  }

  return (
    <ListingCardGrid
      listing={listing}
      showStatus={showStatus}
      showNewBadge={showNewBadge}
    />
  )
}

export default ListingCard
