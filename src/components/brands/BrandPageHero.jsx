import { Link } from 'react-router-dom'
import BrandLogo from '../BrandLogo'
import { ArrowRightIcon } from '../icons/NavIcons'
import { buildBrandHeroVisibleTitle } from '../../lib/brandPageCurated'
import { getBrandPagePath } from '../../lib/brandCatalogue'
import './BrandPageHero.css'

function formatStatValue(value) {
  return new Intl.NumberFormat('en-GB').format(Number(value) || 0)
}

function ListingsStatIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4.5" y="5" width="15" height="14" rx="2" />
      <path d="M8 9.5h8M8 12.5h8M8 15.5h5" />
    </svg>
  )
}

function ModelsStatIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 4.5 19 8.2v7.6L12 19.5 5 15.8V8.2L12 4.5Z" />
      <path d="M12 19.5V12M5 8.2 12 12l7-3.8" />
    </svg>
  )
}

function TypesStatIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4.5" y="4.5" width="6.2" height="6.2" rx="1.2" />
      <rect x="13.3" y="4.5" width="6.2" height="6.2" rx="1.2" />
      <rect x="4.5" y="13.3" width="6.2" height="6.2" rx="1.2" />
      <rect x="13.3" y="13.3" width="6.2" height="6.2" rx="1.2" />
    </svg>
  )
}

const STAT_ICONS = {
  listings: ListingsStatIcon,
  models: ModelsStatIcon,
  types: TypesStatIcon,
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
            {stats.map((stat) => {
              const Icon = STAT_ICONS[stat.key]
              return (
                <li key={stat.key} className="brand-page-hero__stat">
                  {Icon ? (
                    <span className="brand-page-hero__stat-icon">
                      <Icon />
                    </span>
                  ) : null}
                  <span className="brand-page-hero__stat-value">{formatStatValue(stat.value)}</span>
                  <span className="brand-page-hero__stat-label brand-page-hero__stat-label--full">{stat.label}</span>
                  {stat.shortLabel ? (
                    <span className="brand-page-hero__stat-label brand-page-hero__stat-label--short">{stat.shortLabel}</span>
                  ) : null}
                </li>
              )
            })}
          </ul>
        ) : null}

        <nav className="brand-page-hero__actions" aria-label={`${displayName} page actions`}>
          <Link to={browseHref} className="brand-page-hero__cta brand-page-hero__cta--primary">
            <span>Browse {displayName} listings</span>
            <ArrowRightIcon className="brand-page-hero__cta-icon" />
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
