import { Link } from 'react-router-dom'
import { HOME_HERO_MOBILE_MEDIA } from '../../lib/homeHeroCarousel'

export function HomeHeroBannerPicture({
  banner,
  className,
  alt = '',
  priority = false,
}) {
  return (
    <picture>
      <source
        media={HOME_HERO_MOBILE_MEDIA}
        srcSet={banner.mobileSrc}
        width={banner.mobileWidth}
        height={banner.mobileHeight}
      />
      <img
        src={banner.src}
        alt={alt}
        className={className}
        width={banner.width}
        height={banner.height}
        decoding="async"
        loading={priority ? 'eager' : 'lazy'}
        fetchPriority={priority ? 'high' : 'low'}
        draggable="false"
      />
    </picture>
  )
}

function HomeHeroImageSlide({ banner, priority = false, variant = 'home-gym' }) {
  return (
    <div className={`home-hero-image-slide home-hero-image-slide--${variant}`}>
      <HomeHeroBannerPicture
        banner={banner}
        className={`home-hero__image home-hero__image--photo home-hero__image--${variant}`}
        priority={priority}
      />
      <Link
        to={banner.href}
        className="home-hero-image-slide__cta"
        aria-label={banner.label}
      >
        <span className="visually-hidden">{banner.label}</span>
      </Link>
    </div>
  )
}

export default HomeHeroImageSlide
