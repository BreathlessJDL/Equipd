import { Link } from 'react-router-dom'
import ListingCard from '../ListingCard'
import LocationAreaFilterBanner from './LocationAreaFilterBanner'
import { BROWSE_FILTER_EMPTY_MESSAGE } from '../../lib/browseFilters'

function LocationResultsShell({ locationView, children }) {
  return (
    <div className="location-page__results">
      <LocationAreaFilterBanner locationView={locationView} />
      {children}
    </div>
  )
}

function LocationListingsResults({
  locationView,
  listings,
  loading,
  error,
  hasFilters,
  emptyMessage,
}) {
  if (loading && listings.length === 0) {
    return (
      <LocationResultsShell locationView={locationView}>
        <p className="location-page__message location-page__message--loading" role="status">
          Loading listings…
        </p>
      </LocationResultsShell>
    )
  }

  if (error && listings.length === 0) {
    return (
      <LocationResultsShell locationView={locationView}>
        <p className="location-page__message location-page__message--error" role="alert">
          {error}
        </p>
      </LocationResultsShell>
    )
  }

  if (listings.length === 0) {
    if (hasFilters) {
      return (
        <LocationResultsShell locationView={locationView}>
          <div className="location-page__empty location-page__empty--filtered">
            <h2 className="location-page__empty-title">No matches in {locationView.name}</h2>
            <p className="location-page__empty-text">{BROWSE_FILTER_EMPTY_MESSAGE}</p>
          </div>
        </LocationResultsShell>
      )
    }

    return (
      <LocationResultsShell locationView={locationView}>
        <div className="location-page__empty">
          <div className="location-page__empty-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
              <path
                d="M4 8.5h16M6.5 8.5V19a1 1 0 0 0 1 1h9a1 1 0 0 0 1-1V8.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path d="M9 5.5h6l1 3H8l1-3z" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <h2 className="location-page__empty-title">No listings in {locationView.name} yet</h2>
          <p className="location-page__empty-text">{emptyMessage}</p>
          <p className="location-page__empty-hint">
            New equipment is added regularly across the UK. Browse the full marketplace to see
            what&apos;s available now.
          </p>
          <Link to="/browse" className="location-page__empty-cta">
            Browse all equipment
          </Link>
        </div>
      </LocationResultsShell>
    )
  }

  const fewListings = listings.length <= 2

  return (
    <LocationResultsShell locationView={locationView}>
      <header className="location-page__results-header">
        <h2 className="location-page__results-title">
          {listings.length === 1
            ? `1 listing near ${locationView.name}`
            : `${listings.length} listings near ${locationView.name}`}
        </h2>
      </header>
      <div
        className={`location-page__grid listing-browse__grid${
          fewListings ? ' location-page__grid--few' : ''
        }`}
      >
        {listings.map((listing) => (
          <ListingCard key={listing.id} listing={listing} variant="home" />
        ))}
      </div>
    </LocationResultsShell>
  )
}

export default LocationListingsResults
