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

const CONDITION_TONE_BY_VALUE = {
  new: 'like-new',
  like_new: 'like-new',
  very_good: 'very-good',
  good: 'good',
  fair: 'fair',
  poor: 'poor',
}

function isRecentListing(listing) {
  if (!listing?.created_at) return false

  const createdAt = new Date(listing.created_at).getTime()
  if (Number.isNaN(createdAt)) return false

  const ageMs = Date.now() - createdAt
  return ageMs <= NEW_LISTING_DAYS * 24 * 60 * 60 * 1000
}

function getConditionTone(value) {
  return CONDITION_TONE_BY_VALUE[value] || 'neutral'
}

function ListingCardImage({ listing }) {
  const imageUrl = getListingPrimaryImageUrl(listing)

  if (imageUrl) {
    return <img src={imageUrl} alt="" className="listing-card__image" />
  }

  return <div className="listing-card__image listing-card__image--placeholder">No photo</div>
}

function ConditionPill({ condition }) {
  const label = getConditionLabel(condition)
  if (!label) return null

  return (
    <span
      className={`listing-card__condition listing-card__condition--${getConditionTone(condition)}`}
    >
      {label}
    </span>
  )
}

function ListingCardGrid({ listing, showStatus = false, showNewBadge = false, primaryLinkTo = null, onSavedChange }) {
  const showBadge = showNewBadge && isRecentListing(listing)
  const locationLabel = formatListingLocationCard(listing)
  const distanceLabel = formatListingDistanceLabel(listing)
  const listingHref = primaryLinkTo ?? `/listings/${listing.slug}`

  return (
    <article className="listing-card listing-card--grid">
      <div className="listing-card__media">
        <Link to={listingHref} className="listing-card__image-link" tabIndex={-1}>
          <ListingCardImage listing={listing} />
        </Link>
        {showBadge ? <span className="listing-card__badge">New</span> : null}
        <ListingSaveButton listing={listing} onSavedChange={onSavedChange} />
      </div>

      <Link to={listingHref} className="listing-card__body">
        <ConditionPill condition={listing.condition} />

        <h3 className="listing-card__title" title={listing.title}>
          {listing.title}
        </h3>

        <BuyerProtectionPriceDisplay
          itemPricePence={normalizeListingPricePence(listing.price_pence ?? listing.price)}
          compact
          className="listing-card__price-stack"
        />

        <div className="listing-card__footer">
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
              <span className="listing-card__location-text">{locationLabel}</span>
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
        </div>
      </Link>

      {primaryLinkTo ? (
        <div className="listing-card__owner-action">
          <Link to={primaryLinkTo} className="listing-card__owner-action-link">
            Edit draft
          </Link>
        </div>
      ) : null}
    </article>
  )
}

function ListingCardRow({ listing, showStatus = false, primaryLinkTo = null, onSavedChange }) {
  const hasCollection = listing.collection_available !== false
  const locationLabel = formatListingLocationCard(listing)
  const distanceLabel = formatListingDistanceLabel(listing)
  const listingHref = primaryLinkTo ?? `/listings/${listing.slug}`

  return (
    <article className="listing-row">
      <div className="listing-row__media">
        <Link to={listingHref} className="listing-row__image-link" tabIndex={-1}>
          <ListingCardImage listing={listing} />
        </Link>
        <ListingSaveButton listing={listing} onSavedChange={onSavedChange} />
      </div>

      <div className="listing-row__content">
        <Link to={listingHref} className="listing-row__title">
          {listing.title}
        </Link>

        <div className="listing-row__tags">
          {showStatus ? (
            <span className="listing-row__status">{formatListingStatus(listing.status)}</span>
          ) : null}
          <ConditionPill condition={listing.condition} />
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
  primaryLinkTo = null,
  onSavedChange,
}) {
  if (variant === 'row') {
    return (
      <ListingCardRow
        listing={listing}
        showStatus={showStatus}
        primaryLinkTo={primaryLinkTo}
        onSavedChange={onSavedChange}
      />
    )
  }

  return (
    <ListingCardGrid
      listing={listing}
      showStatus={showStatus}
      showNewBadge={showNewBadge}
      primaryLinkTo={primaryLinkTo}
      onSavedChange={onSavedChange}
    />
  )
}

export default ListingCard
