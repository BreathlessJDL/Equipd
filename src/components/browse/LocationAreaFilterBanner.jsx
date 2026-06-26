import { Link } from 'react-router-dom'

function LocationAreaFilterBanner({ locationView }) {
  if (!locationView.selectedArea) return null

  return (
    <div className="location-page__area-filter" role="status" aria-live="polite">
      <p className="location-page__area-filter-text">
        Showing listings near <strong>{locationView.selectedArea}</strong>
      </p>
      <Link
        to={`/listings/${locationView.slug}`}
        className="location-page__area-filter-reset"
      >
        All {locationView.regionName} area
      </Link>
    </div>
  )
}

export default LocationAreaFilterBanner
