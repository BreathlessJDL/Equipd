import { Link } from 'react-router-dom'
import { getAreaNavigationHref, isAreaPillActive } from '../../lib/locations'

function LocationPageHero({ locationView, listingCount, loading }) {
  const countLabel =
    loading && listingCount === 0
      ? 'Loading local listings…'
      : listingCount === 1
        ? '1 listing available'
        : `${listingCount} listings available`

  const scopeCopy = locationView.selectedArea
    ? `from sellers in ${locationView.selectedArea}`
    : `from sellers across ${locationView.areaScopeText}`

  return (
    <section id="location-page-hero" className="location-page__hero" aria-labelledby="location-page-title">
      <div className="location-page__hero-glow" aria-hidden="true" />
      <div className="location-page__hero-inner">
        <p className="location-page__eyebrow">Local marketplace</p>
        <h1 id="location-page-title" className="location-page__title">
          {locationView.heading}
        </h1>
        <p className="location-page__subtitle">
          {locationView.intro} Browse pre-owned treadmills, spin bikes, rowers, weights, racks and
          commercial gym kit {scopeCopy} — with collection, seller delivery, or buyer-arranged
          courier options.
        </p>

        <div className="location-page__hero-meta">
          <span className="location-page__count-badge">{countLabel}</span>
        </div>

        <div className="location-page__areas">
          <p className="location-page__areas-label">Nearby areas</p>
          <ul className="location-page__area-pills">
            {locationView.areas.map((area) => {
              const href = getAreaNavigationHref(area, locationView.slug)
              const isActive = isAreaPillActive(area, locationView)
              const isRegionPrimary =
                area.toLowerCase() === locationView.regionName.toLowerCase()
              const pillClassName = [
                'location-page__area-pill',
                isRegionPrimary && !locationView.selectedArea
                  ? 'location-page__area-pill--primary'
                  : '',
                isActive ? 'location-page__area-pill--current' : '',
              ]
                .filter(Boolean)
                .join(' ')

              return (
                <li key={area}>
                  <Link
                    to={href}
                    className={pillClassName}
                    aria-current={isActive ? 'true' : undefined}
                  >
                    {area}
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>
      </div>
    </section>
  )
}

export default LocationPageHero
