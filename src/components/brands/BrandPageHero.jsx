import { Link } from 'react-router-dom'
import BrandLogo from '../BrandLogo'
import { buildBrandHeroVisibleTitle } from '../../lib/brandPageCurated'
import { getBrandPagePath } from '../../lib/brandCatalogue'
import './BrandPageHero.css'

function formatStatValue(value) {
  return new Intl.NumberFormat('en-GB').format(Number(value) || 0)
}

export default function BrandPageHero({
  brand,
  seoTitle,
  lede,
  stats = [],
  onExploreValues,
}) {
  const displayName = brand.displayName
  const visibleTitle = buildBrandHeroVisibleTitle(displayName)
  const browseHref = brand.browseListingsHref
  const valuesHref = `${getBrandPagePath(brand.slug)}?catalogue=1`

  return (
    <header className="brand-page-hero brand-page__hero">
      <h1 className="visually-hidden">{seoTitle}</h1>

      <div className="brand-page-hero__main">
        <div className="brand-page-hero__logo-wrap">
          <BrandLogo brand={brand} size="hero" priority className="brand-page-hero__logo" />
        </div>

        <p className="brand-page-hero__eyebrow">Used gym equipment</p>
        <p className="brand-page-hero__title">{visibleTitle}</p>
        {lede ? <p className="brand-page-hero__lede">{lede}</p> : null}
      </div>

      <aside className="brand-page-hero__aside" aria-label={`${displayName} marketplace summary`}>
        {stats.length ? (
          <ul className="brand-page-hero__stats">
            {stats.map((stat) => (
              <li key={stat.key} className="brand-page-hero__stat">
                <span className="brand-page-hero__stat-value">{formatStatValue(stat.value)}</span>
                <span className="brand-page-hero__stat-label brand-page-hero__stat-label--full">{stat.label}</span>
                {stat.shortLabel ? (
                  <span className="brand-page-hero__stat-label brand-page-hero__stat-label--short">{stat.shortLabel}</span>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}

        <nav className="brand-page-hero__actions" aria-label={`${displayName} page actions`}>
          <Link to={browseHref} className="brand-page-hero__cta brand-page-hero__cta--primary">
            Browse {displayName} listings
          </Link>
          <Link
            to={valuesHref}
            className="brand-page-hero__cta brand-page-hero__cta--secondary"
            onClick={(event) => {
              event.preventDefault()
              onExploreValues?.()
            }}
          >
            Explore {displayName} values
          </Link>
        </nav>
      </aside>
    </header>
  )
}
