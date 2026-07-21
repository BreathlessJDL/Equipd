import BuyerProtectionPriceDisplay from '../BuyerProtectionPriceDisplay'
import SellerPayoutSummary from '../SellerPayoutSummary'
import {
  formatListingListedDate,
  getListingDeliveryOptions,
} from '../../lib/listingDetailDisplay'
import { formatListingLocationDetail } from '../../lib/listingLocation'
import {
  formatListingStatus,
  formatPricePence,
  getCategoryDisplayName,
  getConditionLabel,
  getRatingLabel,
} from '../../lib/listings'
import { getDisplayableAvailableQuantity } from '../../lib/listingAvailability'
import {
  CollectionPinIcon,
  CourierTruckIcon,
  PackageIcon,
  SellerDeliveryIcon,
} from '../icons/NavIcons'
import '../icons/NavIcons.css'
import ListingSummarySeller from './ListingSummarySeller'

function FulfilmentOptionIcon({ optionId }) {
  const className = 'listing-summary__fulfilment-icon-svg'

  if (optionId === 'collection') {
    return <CollectionPinIcon className={className} />
  }

  if (optionId === 'buyer_courier') {
    return <CourierTruckIcon className={className} />
  }

  if (optionId === 'seller_delivery') {
    return <SellerDeliveryIcon className={className} />
  }

  return <PackageIcon className={className} />
}

function SummaryRow({ label, value, children }) {
  if (!value && !children) return null

  return (
    <div className="listing-summary__row">
      <dt className="listing-summary__label">{label}</dt>
      <dd className="listing-summary__value">{children ?? value}</dd>
    </div>
  )
}

function ListingItemSummary({
  listing,
  actions = null,
  reportListing = null,
  buyerProfile = null,
  viewerUserId = null,
  isOwner = false,
}) {
  const deliveryOptions = getListingDeliveryOptions(listing, { buyerProfile, viewerUserId })
  const listedDate = formatListingListedDate(listing.created_at)
  const categoryName = getCategoryDisplayName(listing)
  const conditionLabel = getConditionLabel(listing.condition)
  const ratingLabel = getRatingLabel(listing.rating)
  const locationLabel = formatListingLocationDetail(listing)

  const metaParts = [conditionLabel, listedDate, listing.brand].filter(Boolean)
  const availableQuantity = getDisplayableAvailableQuantity(listing)

  return (
    <aside className="listing-summary">
      {listing.status !== 'active' ? (
        <span className="listing-summary__status">{formatListingStatus(listing.status)}</span>
      ) : null}

      <header className="listing-summary__header">
        <h1 className="listing-summary__title">{listing.title}</h1>
        {metaParts.length > 0 ? (
          <p className="listing-summary__meta">{metaParts.join(' • ')}</p>
        ) : null}
      </header>

      <section className="listing-summary__purchase" aria-label="Price and actions">
        {isOwner ? (
          <SellerPayoutSummary
            itemPricePence={listing.price_pence ?? listing.price}
            offerAmountLabel="Asking price"
            receiveLabel="You'll receive"
            showNote
            className="listing-summary__seller-payout"
          />
        ) : (
          <BuyerProtectionPriceDisplay
            itemPricePence={listing.price_pence ?? listing.price}
            className="buyer-protection-price--detail listing-summary__price-stack"
          />
        )}

        {availableQuantity != null ? (
          <div className="listing-summary__availability">
            <p className="listing-summary__availability-price">
              {formatPricePence(listing.price_pence ?? listing.price)} each
            </p>
            <p className="listing-summary__availability-count">{availableQuantity} available</p>
          </div>
        ) : null}

        {actions ? <div className="listing-summary__actions">{actions}</div> : null}

        {reportListing}
      </section>

      <section className="listing-summary__section" aria-labelledby="listing-summary-details">
        <h2 id="listing-summary-details" className="listing-summary__section-title">
          Listing details
        </h2>
        <dl className="listing-summary__specs">
          <SummaryRow label="Category" value={categoryName} />
          <SummaryRow label="Brand" value={listing.brand} />
          <SummaryRow label="Model" value={listing.model} />
          <SummaryRow label="Condition" value={conditionLabel} />
          <SummaryRow label="Usage rating" value={ratingLabel} />
          <SummaryRow label="Location" value={locationLabel} />
        </dl>
      </section>

      {deliveryOptions.length > 0 ? (
        <section
          className="listing-summary__section listing-summary__section--fulfilment"
          aria-labelledby="listing-summary-delivery"
        >
          <h2 id="listing-summary-delivery" className="listing-summary__section-title">
            Collection &amp; delivery
          </h2>
          <ul className="listing-summary__fulfilment-list">
            {deliveryOptions.map((option) => (
              <li
                key={option.id}
                className={`listing-summary__fulfilment-option${
                  option.disabled ? ' listing-summary__fulfilment-option--disabled' : ''
                }`}
              >
                <span className="listing-summary__fulfilment-icon" aria-hidden="true">
                  <FulfilmentOptionIcon optionId={option.id} />
                </span>
                <div className="listing-summary__fulfilment-copy">
                  <p className="listing-summary__fulfilment-title">{option.title}</p>
                  {option.disabled && option.disabledReason ? (
                    <p className="listing-summary__fulfilment-description listing-summary__fulfilment-description--muted">
                      {option.disabledReason}
                    </p>
                  ) : option.description ? (
                    <p className="listing-summary__fulfilment-description">{option.description}</p>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {listing.seller_id ? <ListingSummarySeller sellerId={listing.seller_id} /> : null}
    </aside>
  )
}

export { parseListingDescriptionExtras } from '../../lib/listingDetailDisplay'
export default ListingItemSummary
