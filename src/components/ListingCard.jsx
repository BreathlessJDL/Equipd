import { Link } from 'react-router-dom'
import {
  formatBrandModel,
  formatListingStatus,
  formatPricePence,
  getConditionLabel,
} from '../lib/listings'
import './ListingBrowse.css'

function ListingCard({ listing, showStatus = false }) {
  const brandModel = formatBrandModel(listing)

  return (
    <Link to={`/listings/${listing.slug}`} className="listing-card">
      <div className="listing-card__image-wrap">
        {listing.primary_image_url ? (
          <img src={listing.primary_image_url} alt="" className="listing-card__image" />
        ) : (
          <div className="listing-card__image listing-card__image--placeholder">No photo</div>
        )}
      </div>

      <div className="listing-card__body">
        <h3 className="listing-card__title">{listing.title}</h3>
        {brandModel ? <p className="listing-card__brand-model">{brandModel}</p> : null}
        <p className="listing-card__price">{formatPricePence(listing.price_pence)}</p>
        <div className="listing-card__meta">
          {showStatus ? (
            <span className="listing-card__tag listing-card__tag--status">
              {formatListingStatus(listing.status)}
            </span>
          ) : null}
          <span className="listing-card__tag">{getConditionLabel(listing.condition)}</span>
          {listing.location ? <span className="listing-card__tag">{listing.location}</span> : null}
          {listing.courier_available ? (
            <span className="listing-card__tag">Courier</span>
          ) : null}
          {!showStatus && listing.category?.name ? (
            <span className="listing-card__tag">{listing.category.name}</span>
          ) : null}
        </div>
      </div>
    </Link>
  )
}

export default ListingCard
