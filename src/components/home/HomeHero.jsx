import { useEffect, useState } from 'react'
import ProtectedLink from '../auth/ProtectedLink'

const HERO_BANNER = {
  desktopSrc: '/design-reference/New%20main%20hero%20banner%20main.png',
  mobileSrc: '/design-reference/second-hero-banner-mobile.png',
  alt: 'Buy, sell and value used gym equipment on the Equipd marketplace.',
  href: '/listings/new',
  label: 'Sell used gym equipment on Equipd',
}

function HomeHero() {
  const [failedSrc, setFailedSrc] = useState(null)

  useEffect(() => {
    setFailedSrc(null)
  }, [HERO_BANNER.desktopSrc, HERO_BANNER.mobileSrc])

  return (
    <section className="home-hero" aria-labelledby="home-hero-title">
      <div className="home-hero__frame">
        <div className="home-hero__banner">
          <ProtectedLink
            to={HERO_BANNER.href}
            className="home-hero__link"
            aria-label={HERO_BANNER.label}
          >
            <div className="home-hero__viewport">
              {failedSrc ? (
                <div className="home-hero__error" role="alert">
                  Hero image failed: {failedSrc}
                </div>
              ) : (
                <picture>
                  <source media="(max-width: 768px)" srcSet={HERO_BANNER.mobileSrc} />
                  <img
                    src={HERO_BANNER.desktopSrc}
                    alt={HERO_BANNER.alt}
                    className="home-hero__image"
                    decoding="async"
                    onError={(event) => setFailedSrc(event.currentTarget.currentSrc || HERO_BANNER.desktopSrc)}
                  />
                </picture>
              )}
            </div>
          </ProtectedLink>
        </div>
      </div>

      <div className="home-section__inner home-hero__copy">
        <p className="home-hero__eyebrow">Equipd Marketplace</p>
        <h1 id="home-hero-title" className="home-hero__title">
          Buy, sell & value used gym equipment
        </h1>
        <p className="home-hero__lede">
          The UK marketplace for used gym equipment — browse listings from sellers nationwide,
          sell your kit securely, and value equipment instantly with our built-in valuation tool.
        </p>
      </div>
    </section>
  )
}

export default HomeHero
