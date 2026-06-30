import BuyerProtectionPriceDisplay from '../BuyerProtectionPriceDisplay'
import SellerPayoutSummary from '../SellerPayoutSummary'
import {
  formatListingUploadedAgo,
  getListingDeliveryOptions,
  parseListingDescriptionExtras,
} from '../../lib/listingDetailDisplay'
import { formatListingLocationDetail } from '../../lib/listingLocation'
import {
  formatListingStatus,
  getCategoryDisplayName,
  getConditionLabel,
  getRatingLabel,
} from '../../lib/listings'
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
  const extras = parseListingDescriptionExtras(listing.description)
  const deliveryOptions = getListingDeliveryOptions(listing, { buyerProfile, viewerUserId })
  const uploadedAgo = formatListingUploadedAgo(listing.created_at)
  const categoryName = getCategoryDisplayName(listing)
  const conditionLabel = getConditionLabel(listing.condition)
  const ratingLabel = getRatingLabel(listing.rating)
  const locationLabel = formatListingLocationDetail(listing)

  const subtitleParts = [categoryName, conditionLabel, listing.brand].filter(Boolean)

  return (
    <aside className="listing-summary">
      {listing.status !== 'active' ? (
        <span className="listing-summary__status">{formatListingStatus(listing.status)}</span>
      ) : null}

      <h1 className="listing-summary__title">{listing.title}</h1>

      {subtitleParts.length > 0 ? (
        <p className="listing-summary__subtitle">{subtitleParts.join(' · ')}</p>
      ) : null}

      {uploadedAgo ? <p className="listing-summary__uploaded">{uploadedAgo}</p> : null}

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

        {actions ? <div className="listing-summary__actions">{actions}</div> : null}

        {reportListing}
      </section>

      <section className="listing-summary__block" aria-labelledby="listing-summary-description">
        <h2 id="listing-summary-description" className="listing-summary__block-title">
          Description
        </h2>
        {extras.description ? (
          <p className="listing-summary__description">{extras.description}</p>
        ) : (
          <p className="listing-summary__description listing-summary__description--empty">
            No description provided.
          </p>
        )}
      </section>

      <section className="listing-summary__block" aria-labelledby="listing-summary-specs">
        <h2 id="listing-summary-specs" className="listing-summary__block-title">
          Item specifics
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
          className="listing-summary__block listing-summary__block--fulfilment"
          aria-labelledby="listing-summary-delivery"
        >
          <h2 id="listing-summary-delivery" className="listing-summary__block-title">
            Delivery &amp; collection
          </h2>
          <ul className="listing-summary__fulfilment-panel">
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

export { parseListingDescriptionExtras }
export default ListingItemSummary
