import { Link } from 'react-router-dom'
import { LOCATION_PAGES, LOCATION_SLUGS } from '../lib/locations'
import './LocationPageLinks.css'

function LocationPageLinks({ variant = 'browse' }) {
  return (
    <nav
      className={`location-links location-links--${variant}`}
      aria-label="Browse by location"
    >
      {variant === 'browse' ? (
        <h3 className="location-links__title">Browse by location</h3>
      ) : null}
      <ul className="location-links__list">
        {LOCATION_SLUGS.map((slug) => {
          const location = LOCATION_PAGES[slug]

          return (
            <li key={slug} className="location-links__item">
              <Link to={`/listings/${slug}`} className="location-links__link">
                {location.heading}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

export default LocationPageLinks
