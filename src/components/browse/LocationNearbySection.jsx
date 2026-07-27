import { Link } from 'react-router-dom'
import { getAreaNavigationHref, isAreaPillActive } from '../../lib/locations'

function LocationNearbySection({ locationView }) {
  const areas = locationView.nearbyAreas?.length
    ? locationView.nearbyAreas
    : locationView.areas.filter(
        (area) => area.toLowerCase() !== locationView.regionName.toLowerCase(),
      )

  if (!areas.length) return null

  return (
    <section
      className="location-page__nearby"
      aria-labelledby="location-nearby-heading"
    >
      <div className="location-page__nearby-inner">
        <h2 id="location-nearby-heading" className="location-page__nearby-title">
          {locationView.nearbyHeading}
        </h2>
        <ul className="location-page__nearby-list">
          {areas.map((area) => {
            const href = getAreaNavigationHref(area, locationView.slug)
            const isActive = isAreaPillActive(area, locationView)
            return (
              <li key={area}>
                <Link
                  to={href}
                  className={`location-page__nearby-pill${
                    isActive ? ' location-page__nearby-pill--current' : ''
                  }`}
                  aria-current={isActive ? 'true' : undefined}
                >
                  {area}
                </Link>
              </li>
            )
          })}
        </ul>
      </div>
    </section>
  )
}

export default LocationNearbySection
