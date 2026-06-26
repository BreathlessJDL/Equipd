import { Link } from 'react-router-dom'

function LocationSellerSection({ locationView }) {
  const nearbyAreas = locationView.selectedArea
    ? locationView.regionName
    : locationView.sellerNearbyText

  return (
    <section className="location-page__seller" aria-labelledby="location-seller-title">
      <div className="location-page__seller-card">
        <h2 id="location-seller-title" className="location-page__seller-title">
          Selling gym equipment in {locationView.name}?
        </h2>
        <p className="location-page__seller-text">
          List your used treadmills, spin bikes, rowers, dumbbells, racks, pin-loaded machines,
          and commercial gym kit on Equipd to reach buyers actively searching for equipment near{' '}
          {locationView.name}
          {!locationView.selectedArea && locationView.areas.length > 1
            ? ` and across ${nearbyAreas}`
            : locationView.selectedArea
              ? ` and the wider ${locationView.regionName} area`
              : ''}
          . Create a listing in minutes, set your price, and choose how buyers can collect or
          receive delivery.
        </p>
        <Link to="/listings/new" className="location-page__seller-cta">
          Create Listing
        </Link>
      </div>
    </section>
  )
}

export default LocationSellerSection
