import { Link } from 'react-router-dom'
import { CollectionPinIcon } from '../icons/NavIcons'
import { NewOfferTagIcon } from '../icons/NotificationIcons'
import '../icons/NavIcons.css'
import {
  getBrandPagePath,
  HOME_DISCOVERY_BRANDS,
  HOME_DISCOVERY_LOCATIONS,
  HOME_DISCOVERY_VIEW_ALL_BRANDS_PATH,
  HOME_DISCOVERY_VIEW_ALL_LOCATIONS_PATH,
} from '../../lib/homeDiscovery'

function HomeDiscoveryCardHeader({ icon: Icon, title, subtitle, titleId }) {
  return (
    <header className="home-discovery-card__header">
      <div className="home-discovery-card__heading">
        <span className="home-discovery-card__icon" aria-hidden="true">
          <Icon className="home-discovery-card__icon-svg" />
        </span>
        <h2 id={titleId} className="home-discovery-card__title">
          {title}
        </h2>
      </div>
      <p className="home-discovery-card__subtitle">{subtitle}</p>
    </header>
  )
}

function HomeDiscoveryCardFooter({ to, label }) {
  return (
    <footer className="home-discovery-card__footer">
      <Link to={to} className="home-discovery-card__more">
        {label}
      </Link>
    </footer>
  )
}

function HomeDiscoverySection() {
  return (
    <section className="home-discovery" aria-label="Browse by location and equipment values">
      <div className="home-section__inner">
        <div className="home-discovery__grid">
          <article
            className="home-discovery-card home-discovery-card--locations"
            aria-labelledby="home-discovery-locations-title"
          >
            <HomeDiscoveryCardHeader
              icon={CollectionPinIcon}
              title="Browse by Location"
              subtitle="Find equipment near you and save on collection costs."
              titleId="home-discovery-locations-title"
            />
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
            <HomeDiscoveryCardFooter
              to={HOME_DISCOVERY_VIEW_ALL_LOCATIONS_PATH}
              label="View all locations →"
            />
          </article>

          <article
            className="home-discovery-card home-discovery-card--brands home-discovery-card--desktop-only"
            aria-labelledby="home-discovery-brands-title"
          >
            <HomeDiscoveryCardHeader
              icon={NewOfferTagIcon}
              title="Equipment Values"
              subtitle="Browse equipment values, product information and current marketplace listings by manufacturer."
              titleId="home-discovery-brands-title"
            />
            <div className="home-discovery-card__chips">
              {HOME_DISCOVERY_BRANDS.map((brand) => (
                <Link
                  key={brand.value}
                  to={getBrandPagePath(brand.slug || brand.value)}
                  className="home-discovery-chip"
                >
                  {brand.label}
                </Link>
              ))}
            </div>
            <HomeDiscoveryCardFooter
              to={HOME_DISCOVERY_VIEW_ALL_BRANDS_PATH}
              label="View all equipment values →"
            />
          </article>
        </div>
      </div>
    </section>
  )
}

export default HomeDiscoverySection
