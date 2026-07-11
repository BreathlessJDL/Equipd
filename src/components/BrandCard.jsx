import { Link } from 'react-router-dom'
import BrandLogo from './BrandLogo'
import './BrandCard.css'

function formatModelCount(count) {
  const n = Number(count) || 0
  return `${n} equipment ${n === 1 ? 'model' : 'models'}`
}

/**
 * Shared brand directory card.
 * featured: logo → name → count → CTA
 * compact: horizontal logo | name+count | arrow
 */
export default function BrandCard({
  brand,
  priority = false,
  compact = false,
}) {
  if (!brand?.href) return null

  const classes = [
    'brand-card',
    compact ? 'brand-card--compact' : 'brand-card--featured',
  ].filter(Boolean).join(' ')

  if (compact) {
    return (
      <Link
        to={brand.href}
        className={classes}
        aria-label={`${brand.displayName} equipment values`}
      >
        <span className="brand-card__logo-wrap brand-card__logo-wrap--compact">
          <BrandLogo brand={brand} size="compact" priority={priority} />
        </span>
        <span className="brand-card__meta">
          <span className="brand-card__name">{brand.displayName}</span>
          <span className="brand-card__count">{formatModelCount(brand.productCount)}</span>
        </span>
        <span className="brand-card__arrow" aria-hidden="true">→</span>
      </Link>
    )
  }

  return (
    <Link
      to={brand.href}
      className={classes}
      aria-label={`${brand.displayName} equipment values`}
    >
      <span className="brand-card__logo-wrap">
        <BrandLogo brand={brand} size="card" priority={priority} />
      </span>
      <span className="brand-card__name">{brand.displayName}</span>
      <span className="brand-card__count">{formatModelCount(brand.productCount)}</span>
      <span className="brand-card__cta">Explore equipment values →</span>
    </Link>
  )
}
