import { Link } from 'react-router-dom'
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
  getListingBrandPageHref,
  getListingBrowseTypeHref,
  getListingValuationHref,
} from '../../lib/listingDiscovery'
import { isSoldListingStatus } from '../../lib/listingSoldLifecycle'
import { parseOfferQuantityInput } from '../../lib/offers'
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
  equipmentProduct = null,
  actions = null,
  reportListing = null,
  buyerProfile = null,
  viewerUserId = null,
  isOwner = false,
  selectedQuantity = 1,
  onSelectedQuantityChange = null,
  onQuantityValidationError = null,
}) {
  const isSold = isSoldListingStatus(listing)
  const deliveryOptions = isSold
    ? []
    : getListingDeliveryOptions(listing, { buyerProfile, viewerUserId })
  const listedDate = formatListingListedDate(listing.created_at)
  const categoryName = getCategoryDisplayName(listing)
  const conditionLabel = getConditionLabel(listing.condition)
  const ratingLabel = getRatingLabel(listing.rating)
  const locationLabel = formatListingLocationDetail(listing)
  const brandHref = getListingBrandPageHref(listing.brand)
  const categoryHref = getListingBrowseTypeHref(listing, equipmentProduct)
  const valuationHref = getListingValuationHref(listing, equipmentProduct)

  const metaParts = [conditionLabel, listedDate, listing.brand].filter(Boolean)
  const availableQuantity = isSold ? null : getDisplayableAvailableQuantity(listing)
  const showBuyerQuantitySelector =
    !isSold
    && !isOwner
    && availableQuantity != null
    && typeof onSelectedQuantityChange === 'function'
  const unitPricePence = listing.price_pence ?? listing.price

  function handleQuantityInputChange(rawValue) {
    if (typeof onSelectedQuantityChange !== 'function') return
    const { quantity: nextQuantity, error } = parseOfferQuantityInput(
      rawValue,
      availableQuantity,
    )
    if (error && nextQuantity == null) {
      onQuantityValidationError?.(error)
      return
    }
    if (nextQuantity != null) {
      onSelectedQuantityChange(nextQuantity)
      if (error) {
        onQuantityValidationError?.(error)
      }
    }
  }

  return (
    <aside className="listing-summary">
      {!isSold && listing.status !== 'active' ? (
        <span className="listing-summary__status">{formatListingStatus(listing.status)}</span>
      ) : null}

      <header className="listing-summary__header">
        <h1 className="listing-summary__title">{listing.title}</h1>
        {metaParts.length > 0 ? (
          <p className="listing-summary__meta">{metaParts.join(' • ')}</p>
        ) : null}
      </header>

      <section className="listing-summary__purchase" aria-label="Price and actions">
        {isSold ? (
          <div className="listing-summary__sold-state" role="status">
            <p className="listing-summary__sold-title">This item has now sold</p>
            <p className="listing-summary__sold-copy">
              This listing has been completed on Equipd.
            </p>
            {unitPricePence != null ? (
              <p className="listing-summary__sold-price">
                Listed at {formatPricePence(unitPricePence)}
              </p>
            ) : null}
          </div>
        ) : isOwner ? (
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

        {showBuyerQuantitySelector ? (
          <div className="listing-summary__quantity" aria-label="Purchase quantity">
            <span className="listing-summary__quantity-label">Quantity</span>
            <div className="listing-summary__quantity-row">
              <div className="listing-summary__quantity-stepper">
                <button
                  type="button"
                  aria-label="Decrease selected quantity"
                  disabled={selectedQuantity <= 1}
                  onClick={() => onSelectedQuantityChange(selectedQuantity - 1)}
                >
                  −
                </button>
                <input
                  className="listing-summary__quantity-input"
                  type="number"
                  min={1}
                  max={availableQuantity}
                  step={1}
                  inputMode="numeric"
                  aria-label="Selected quantity"
                  value={selectedQuantity}
                  onChange={(event) => handleQuantityInputChange(event.target.value)}
                />
                <button
                  type="button"
                  aria-label="Increase selected quantity"
                  disabled={selectedQuantity >= availableQuantity}
                  onClick={() => onSelectedQuantityChange(selectedQuantity + 1)}
                >
                  +
                </button>
              </div>
              <span className="listing-summary__quantity-available">
                {availableQuantity} available
              </span>
            </div>
            <div className="listing-summary__quantity-pricing">
              <span>{formatPricePence(unitPricePence)} per item</span>
              <strong>{formatPricePence(unitPricePence * selectedQuantity)} item subtotal</strong>
            </div>
          </div>
        ) : availableQuantity != null ? (
          <div className="listing-summary__availability">
            <p className="listing-summary__availability-price">
              {formatPricePence(unitPricePence)} each
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
          <SummaryRow label="Category" value={categoryName}>
            {categoryName && categoryHref ? (
              <Link to={categoryHref} className="listing-summary__inline-link">
                {categoryName}
              </Link>
            ) : (
              categoryName
            )}
          </SummaryRow>
          <SummaryRow label="Brand" value={listing.brand}>
            {listing.brand && brandHref ? (
              <Link to={brandHref} className="listing-summary__inline-link">
                {listing.brand}
              </Link>
            ) : (
              listing.brand
            )}
          </SummaryRow>
          <SummaryRow label="Model" value={listing.model} />
          <SummaryRow label="Condition" value={conditionLabel} />
          <SummaryRow label="Usage rating" value={ratingLabel} />
          <SummaryRow label="Location" value={locationLabel} />
        </dl>
      </section>

      <div className="listing-summary__valuation-cta">
        <Link to={valuationHref} className="listing-summary__valuation-button">
          <span className="listing-summary__valuation-icon" aria-hidden="true">
            <svg viewBox="0 0 16 16" width="16" height="16" fill="none">
              <path
                d="M2.5 11.5 6 8l2.25 2.25L13.5 4.5"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M10.25 4.5H13.5V7.75"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          Value this equipment
        </Link>
      </div>

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

export default ListingItemSummary
