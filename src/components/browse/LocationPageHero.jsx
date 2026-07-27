import { Link } from 'react-router-dom'
import LocationHeroMarketplacePreview from './LocationHeroMarketplacePreview'

const LISTINGS_ANCHOR = '#location-listings'

function LocationPageHero({ locationView, listingCount, loading, listingsAnchorId = 'location-listings' }) {
  const countLabel =
    loading && listingCount === 0
      ? 'Loading local listings…'
      : listingCount === 1
        ? '1 listing available'
        : `${listingCount} listings available`

  const handleBrowseClick = (event) => {
    event.preventDefault()
    const target = document.getElementById(listingsAnchorId)
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' })
      return
    }
    window.location.hash = LISTINGS_ANCHOR
  }

  return (
    <section id="location-page-hero" className="location-page__hero" aria-labelledby="location-page-title">
      <div className="location-page__hero-glow" aria-hidden="true" />
      <div className="location-page__hero-rail">
        <div className="location-page__hero-copy">
          <p className="location-page__eyebrow">Gym equipment near you</p>
          <h1 id="location-page-title" className="location-page__title">
            {locationView.headingPrefix}
            <span className="location-page__title-accent">{locationView.headingAccent}</span>
          </h1>
          <p className="location-page__lead">{locationView.heroIntro}</p>

          <div className="location-page__hero-actions">
            <a
              href={LISTINGS_ANCHOR}
              className="location-page__btn location-page__btn--primary"
              onClick={handleBrowseClick}
            >
              {locationView.browseCtaLabel}
            </a>
            <Link to="/valuation" className="location-page__btn location-page__btn--secondary">
              Get a free valuation
            </Link>
          </div>
        </div>

        <LocationHeroMarketplacePreview
          cityName={locationView.name}
          listingCountLabel={countLabel}
        />
      </div>
    </section>
  )
}

export default LocationPageHero
