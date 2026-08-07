import { useEffect, useState } from 'react'
import ProtectedLink from '../auth/ProtectedLink'

const HERO_BANNER = {
  desktopSrc: '/design-reference/New%20main%20hero%20banner%20main.png',
  desktopWebp: '/design-reference/New%20main%20hero%20banner%20main.webp',
  desktopAvif: '/design-reference/New%20main%20hero%20banner%20main.avif',
  desktopWidth: 1846,
  desktopHeight: 399,
  mobileSrc: '/design-reference/second-hero-banner-mobile.png',
  mobileWebp: '/design-reference/second-hero-banner-mobile.webp',
  mobileAvif: '/design-reference/second-hero-banner-mobile.avif',
  mobileWidth: 1248,
  mobileHeight: 848,
  mobileMedia: '(max-width: 768px)',
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
                  <source
                    media={HERO_BANNER.mobileMedia}
                    type="image/avif"
                    srcSet={HERO_BANNER.mobileAvif}
                    width={HERO_BANNER.mobileWidth}
                    height={HERO_BANNER.mobileHeight}
                  />
                  <source
                    media={HERO_BANNER.mobileMedia}
                    type="image/webp"
                    srcSet={HERO_BANNER.mobileWebp}
                    width={HERO_BANNER.mobileWidth}
                    height={HERO_BANNER.mobileHeight}
                  />
                  <source
                    media={HERO_BANNER.mobileMedia}
                    srcSet={HERO_BANNER.mobileSrc}
                    width={HERO_BANNER.mobileWidth}
                    height={HERO_BANNER.mobileHeight}
                  />
                  <source
                    type="image/avif"
                    srcSet={HERO_BANNER.desktopAvif}
                    width={HERO_BANNER.desktopWidth}
                    height={HERO_BANNER.desktopHeight}
                  />
                  <source
                    type="image/webp"
                    srcSet={HERO_BANNER.desktopWebp}
                    width={HERO_BANNER.desktopWidth}
                    height={HERO_BANNER.desktopHeight}
                  />
                  <img
                    src={HERO_BANNER.desktopSrc}
                    alt={HERO_BANNER.alt}
                    className="home-hero__image"
                    width={HERO_BANNER.desktopWidth}
                    height={HERO_BANNER.desktopHeight}
                    decoding="async"
                    loading="eager"
                    fetchPriority="high"
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
