import { Link } from 'react-router-dom'
import BrandLogo from '../BrandLogo'
import { buildBrandHeroVisibleTitle } from '../../lib/brandPageCurated'
import { getBrandPagePath } from '../../lib/brandCatalogue'
import './BrandPageHero.css'

function SearchIcon() {
  return (
    <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true" fill="none">
      <circle cx="8.5" cy="8.5" r="5.75" stroke="currentColor" strokeWidth="1.6" />
      <path d="m13.1 13.1 4.15 4.15" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}

function formatStatValue(value) {
  return new Intl.NumberFormat('en-GB').format(Number(value) || 0)
}

export default function BrandPageHero({
  brand,
  seoTitle,
  lede,
  stats = [],
  searchInputId,
  search,
  searchPlaceholder,
  searchSuggestions = [],
  searchFocused = false,
  showSuggestionValues = false,
  onSearchChange,
  onSearchFocus,
  onSearchBlur,
  onSearchSubmit,
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

        <section className="brand-page-hero__search" aria-label={`${displayName} model search`}>
          <form className="brand-page-hero__search-form" onSubmit={onSearchSubmit}>
            <label className="visually-hidden" htmlFor={searchInputId}>
              Search {displayName} equipment and models
            </label>
            <div className="brand-page-hero__search-control">
              <div className="brand-page-hero__search-field">
                <span className="brand-page-hero__search-icon" aria-hidden="true">
                  <SearchIcon />
                </span>
                <input
                  id={searchInputId}
                  type="search"
                  className="brand-page-hero__search-input"
                  value={search}
                  placeholder={searchPlaceholder || `Search ${displayName} equipment and models...`}
                  onChange={onSearchChange}
                  onFocus={onSearchFocus}
                  onBlur={onSearchBlur}
                  autoComplete="off"
                  aria-autocomplete="list"
                  aria-controls={searchSuggestions.length ? `${searchInputId}-suggestions` : undefined}
                />
              </div>
              {searchFocused && searchSuggestions.length ? (
                <ul
                  id={`${searchInputId}-suggestions`}
                  className="brand-page-hero__search-suggestions"
                  role="listbox"
                >
                  {searchSuggestions.map((product) => (
                    <li key={product.id} role="option">
                      <Link to={product.href} className="brand-page-hero__search-suggestion">
                        <span className="brand-page-hero__search-suggestion-name">{product.displayName}</span>
                        {product.estimatedValueLabel && showSuggestionValues ? (
                          <span className="brand-page-hero__search-suggestion-value">
                            {product.estimatedValueLabel}
                          </span>
                        ) : null}
                      </Link>
                    </li>
                  ))}
                  <li>
                    <button
                      type="submit"
                      className="brand-page-hero__search-suggestion brand-page-hero__search-suggestion--all"
                    >
                      View all matching models →
                    </button>
                  </li>
                </ul>
              ) : null}
            </div>
          </form>
        </section>
      </div>

      <aside className="brand-page-hero__aside" aria-label={`${displayName} marketplace summary`}>
        {stats.length ? (
          <ul className="brand-page-hero__stats">
            {stats.map((stat) => (
              <li key={stat.key} className="brand-page-hero__stat">
                <span className="brand-page-hero__stat-value">{formatStatValue(stat.value)}</span>
                <span className="brand-page-hero__stat-label">{stat.label}</span>
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
