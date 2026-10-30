import ProtectedLink from '../auth/ProtectedLink'
import { COAT_RACK_HERO_BANNER } from '../../lib/homeHeroCarousel'
import { HomeHeroBannerPicture } from './HomeHeroImageSlide'

export const HERO_BANNER = COAT_RACK_HERO_BANNER

function HomeHero({
  priority = true,
} = {}) {
  return (
    <div className="home-hero-image-slide home-hero-image-slide--coat-rack">
      <HomeHeroBannerPicture
        banner={HERO_BANNER}
        alt={HERO_BANNER.alt}
        className="home-hero__image home-hero__image--photo home-hero__image--coat-rack"
        priority={priority}
      />
      <ProtectedLink
        to={HERO_BANNER.href}
        className="home-hero-image-slide__cta"
        aria-label={HERO_BANNER.label}
      >
        <span className="visually-hidden">{HERO_BANNER.label}</span>
      </ProtectedLink>
    </div>
  )
}

export default HomeHero
