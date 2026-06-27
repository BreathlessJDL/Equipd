import { useEffect, useState } from 'react'
import ProtectedLink from '../auth/ProtectedLink'

const HERO_BANNER = {
  desktopSrc: '/design-reference/New%20main%20hero%20banner%20main.png',
  mobileSrc: '/design-reference/second-hero-banner-mobile.png',
  alt: 'Your gym should not be a coat rack. Turn it into cash on Equipd.',
  href: '/listings/new',
  label: 'Sell gym equipment',
}

function HomeHero() {
  const [failedSrc, setFailedSrc] = useState(null)

  useEffect(() => {
    setFailedSrc(null)
  }, [HERO_BANNER.desktopSrc, HERO_BANNER.mobileSrc])

  return (
    <section className="home-hero" aria-label="Equipd hero banner">
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
    </section>
  )
}

export default HomeHero
