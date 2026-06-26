import { Link } from 'react-router-dom'
import {
  getBrowseBrandHref,
  HOME_DISCOVERY_BRANDS,
  HOME_DISCOVERY_LOCATIONS,
} from '../../lib/homeDiscovery'

function HomeDiscoverySection() {
  return (
    <section className="home-discovery" aria-label="Browse by location and popular brands">
      <div className="home-section__inner">
        <div className="home-discovery__grid">
          <article className="home-discovery-card" aria-labelledby="home-discovery-locations-title">
            <h2 id="home-discovery-locations-title" className="home-discovery-card__title">
              Browse by location
            </h2>
            <div className="home-discovery-card__chips">
              {HOME_DISCOVERY_LOCATIONS.map((location) => (
                <Link
                  key={location.slug}
                  to={location.href}
                  className="home-discovery-chip"
                >
                  {location.label}
                </Link>
              ))}
            </div>
          </article>

          <article className="home-discovery-card" aria-labelledby="home-discovery-brands-title">
            <h2 id="home-discovery-brands-title" className="home-discovery-card__title">
              Popular brands
            </h2>
            <div className="home-discovery-card__chips">
              {HOME_DISCOVERY_BRANDS.map((brand) => (
                <Link
                  key={brand.value}
                  to={getBrowseBrandHref(brand.value)}
                  className="home-discovery-chip"
                >
                  {brand.label}
                </Link>
              ))}
            </div>
          </article>
        </div>
      </div>
    </section>
  )
}

export default HomeDiscoverySection
