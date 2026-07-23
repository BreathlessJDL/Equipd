import { useEffect, useId, useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import BrandLogo from '../components/BrandLogo'
import EquipmentValueGuideCard from '../components/EquipmentValueGuideCard'
import JsonLd from '../components/JsonLd'
import ListingCard from '../components/ListingCard'
import PageBreadcrumbs from '../components/PageBreadcrumbs'
import BreadcrumbSchema from '../components/seo/BreadcrumbSchema'
import { usePageMeta } from '../hooks/usePageMeta'
import {
  buildBrandPageJsonLd,
  buildBrandPageMetaDescription,
  buildBrandPageMetaTitle,
  buildBrandPageTitle,
  fetchBrandPageData,
  getBrandPagePath,
} from '../lib/brandCatalogue'
import {
  buildBrandFaqItems,
  buildBrandFaqPageSchema,
  buildBrandPageStats,
  enrichBrandSeriesWithTags,
  selectFeaturedBrandSeries,
  selectPopularBrandProducts,
  FEATURED_SERIES_LIMIT,
} from '../lib/brandPageCurated'
import { buildBrandPageBreadcrumbSchema } from '../lib/breadcrumbStructuredData'
import './BrandPage.css'

const PAGE_SIZE = 24

function SearchIcon() {
  return (
    <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true" fill="none">
      <circle cx="8.5" cy="8.5" r="5.75" stroke="currentColor" strokeWidth="1.6" />
      <path d="m13.1 13.1 4.15 4.15" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}

export default function BrandPage() {
  const { brandSlug } = useParams()
  const [searchParams] = useSearchParams()
  const searchInputId = useId()
  const [payload, setPayload] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [categoryFilter, setCategoryFilter] = useState('')
  const [seriesFilter, setSeriesFilter] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [showAllModels, setShowAllModels] = useState(false)
  const [showAllSeries, setShowAllSeries] = useState(false)
  const [searchFocused, setSearchFocused] = useState(false)
  const [openFaqIndex, setOpenFaqIndex] = useState(0)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      setCategoryFilter('')
      setSeriesFilter('')
      setSearch('')
      setPage(1)
      setShowAllModels(false)
      setShowAllSeries(false)
      setOpenFaqIndex(0)
      const result = await fetchBrandPageData(brandSlug)
      if (cancelled) return
      if (result.error && !result.brand) {
        setError(result.error.message || 'Unable to load brand.')
      }
      setPayload(result)
      const seriesFromUrl = String(searchParams.get('series') || '').trim()
      if (seriesFromUrl && result?.series?.length) {
        const known = result.series.some((entry) => entry.name === seriesFromUrl)
        if (known) {
          setSeriesFilter(seriesFromUrl)
          setShowAllModels(true)
        }
      }
      if (String(searchParams.get('catalogue') || '').trim() === '1') {
        setShowAllModels(true)
      }
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [brandSlug, searchParams])

  const brand = payload?.brand
  const notFound = Boolean(payload?.notFound)
  const allProducts = payload?.products || []
  const listings = payload?.listings || []
  const categories = payload?.categories || []
  const series = useMemo(
    () => enrichBrandSeriesWithTags(payload?.series || [], allProducts),
    [payload?.series, allProducts],
  )

  usePageMeta({
    title: brand
      ? buildBrandPageMetaTitle(brand.displayName)
      : notFound
        ? 'Brand not found | Equipd'
        : 'Brand | Equipd',
    description: brand
      ? buildBrandPageMetaDescription(brand.displayName)
      : 'Explore gym equipment value guides by brand on Equipd.',
    canonicalPath: brand ? getBrandPagePath(brand.slug) : null,
    noIndex: notFound,
  })

  const popularProducts = useMemo(
    () => selectPopularBrandProducts(allProducts, { listings }),
    [allProducts, listings],
  )
  const featuredSeries = useMemo(
    () => selectFeaturedBrandSeries(series),
    [series],
  )
  const displayedSeries = showAllSeries ? series : featuredSeries
  const remainingSeriesCount = Math.max(0, series.length - featuredSeries.length)
  const searchSuggestions = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (query.length < 2) return []
    return allProducts
      .filter((product) => {
        const haystack = [product.displayName, product.series, product.equipmentType]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
        return haystack.includes(query)
      })
      .slice(0, 8)
  }, [allProducts, search])
  const stats = useMemo(
    () => buildBrandPageStats({
      productCount: brand?.productCount,
      listingCount: brand?.listingCount,
      categories,
      series,
    }),
    [brand?.productCount, brand?.listingCount, categories, series],
  )
  const faqItems = useMemo(
    () => (brand ? buildBrandFaqItems(brand.displayName) : []),
    [brand],
  )

  const filteredProducts = useMemo(() => {
    const query = search.trim().toLowerCase()
    return allProducts.filter((product) => {
      if (categoryFilter && product.equipmentType !== categoryFilter) return false
      if (seriesFilter && product.series !== seriesFilter) return false
      if (!query) return true
      const haystack = [product.displayName, product.series, product.equipmentType]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return haystack.includes(query)
    })
  }, [allProducts, categoryFilter, seriesFilter, search])

  const catalogueOpen = showAllModels
    || Boolean(seriesFilter)
    || Boolean(categoryFilter)
    || search.trim().length >= 2

  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const pageProducts = filteredProducts.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  const jsonLd = useMemo(() => {
    if (!brand) return null
    const collection = buildBrandPageJsonLd(brand, allProducts)
    const faqSchema = buildBrandFaqPageSchema(brand, faqItems)
    return [collection, faqSchema].filter(Boolean)
  }, [brand, allProducts, faqItems])

  const breadcrumbSchema = useMemo(
    () => (brand ? buildBrandPageBreadcrumbSchema(brand) : null),
    [brand],
  )

  function resetFilters() {
    setCategoryFilter('')
    setSeriesFilter('')
    setSearch('')
    setPage(1)
  }

  function openCatalogue({ seriesName = null } = {}) {
    if (seriesName) {
      setSeriesFilter(seriesName)
      setCategoryFilter('')
    }
    setShowAllModels(true)
    setPage(1)
    requestAnimationFrame(() => {
      document.getElementById('all-models')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }

  function handleSearchSubmit(event) {
    event.preventDefault()
    openCatalogue()
  }

  if (loading) {
    return (
      <div className="brand-page">
        <div className="brand-page__inner">
          <p className="brand-page__status">Loading equipment values…</p>
        </div>
      </div>
    )
  }

  if (notFound || !brand) {
    return (
      <div className="brand-page">
        <div className="brand-page__inner">
          <PageBreadcrumbs items={[{ label: 'Home', to: '/' }, { label: 'Equipment Values', to: '/brands' }, { label: 'Not found' }]} />
          <h1 className="brand-page__title">Brand not found</h1>
          <p className="brand-page__lede">
            This brand is not in the public Equipd value-guide directory.
          </p>
          <Link to="/brands" className="brand-page__text-link">View all brand value guides</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="brand-page">
      <JsonLd data={jsonLd} />
      <BreadcrumbSchema schema={breadcrumbSchema} />
      <div className="brand-page__inner">
        <PageBreadcrumbs
          items={[
            { label: 'Home', to: '/' },
            { label: 'Equipment Values', to: '/brands' },
            { label: brand.displayName },
          ]}
        />

        <header className="brand-page__hero">
          <div className="brand-page__hero-inner">
            <div className="brand-page__hero-logo-wrap">
              <BrandLogo brand={brand} size="hero" priority className="brand-page__hero-logo" />
            </div>
            <h1 className="brand-page__title">{buildBrandPageTitle(brand.displayName)}</h1>
            <p className="brand-page__lede">
              Explore estimated used values, original RRPs, production years and console
              compatibility across {brand.displayName} equipment.
            </p>

            <section className="brand-page__search-panel" aria-label={`${brand.displayName} model search`}>
              <form className="brand-page__search-form" onSubmit={handleSearchSubmit}>
                <label className="visually-hidden" htmlFor={searchInputId}>
                  Search {brand.displayName} models by name or keyword
                </label>
                <div className="brand-page__search-control">
                  <div className="brand-page__search-field">
                    <span className="brand-page__search-icon" aria-hidden="true">
                      <SearchIcon />
                    </span>
                    <input
                      id={searchInputId}
                      type="search"
                      className="brand-page__search-input"
                      value={search}
                      placeholder={`Search ${brand.displayName} models by name or keyword...`}
                      onChange={(event) => {
                        setSearch(event.target.value)
                        setPage(1)
                        if (event.target.value.trim().length >= 2) setShowAllModels(true)
                      }}
                      onFocus={() => setSearchFocused(true)}
                      onBlur={() => {
                        // Delay so suggestion link clicks register before the list unmounts.
                        window.setTimeout(() => setSearchFocused(false), 120)
                      }}
                      autoComplete="off"
                      aria-autocomplete="list"
                      aria-controls={searchSuggestions.length ? `${searchInputId}-suggestions` : undefined}
                    />
                  </div>
                  {searchFocused && searchSuggestions.length ? (
                    <ul
                      id={`${searchInputId}-suggestions`}
                      className="brand-page__search-suggestions"
                      role="listbox"
                    >
                      {searchSuggestions.map((product) => (
                        <li key={product.id} role="option">
                          <Link to={product.href} className="brand-page__search-suggestion">
                            <span className="brand-page__search-suggestion-name">{product.displayName}</span>
                            {product.estimatedValueLabel ? (
                              <span className="brand-page__search-suggestion-value">
                                {product.estimatedValueLabel}
                              </span>
                            ) : null}
                          </Link>
                        </li>
                      ))}
                      <li>
                        <button
                          type="submit"
                          className="brand-page__search-suggestion brand-page__search-suggestion--all"
                        >
                          View all matching models →
                        </button>
                      </li>
                    </ul>
                  ) : null}
                </div>
                <Link to="/valuation" className="brand-page__search-cta">
                  Value your equipment →
                </Link>
              </form>
            </section>

            {stats.length ? (
              <ul className="brand-page__stats" aria-label={`${brand.displayName} coverage`}>
                {stats.map((stat, index) => (
                  <li key={stat.key} className="brand-page__stat">
                    {index > 0 ? (
                      <span className="brand-page__stat-sep" aria-hidden="true">•</span>
                    ) : null}
                    <strong>{stat.value}</strong>
                    {' '}
                    <span>{stat.label}</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </header>

        {featuredSeries.length ? (
          <section className="brand-page__section" aria-labelledby="brand-series-title">
            <div className="brand-page__section-head">
              <h2 id="brand-series-title" className="brand-page__section-title">
                Browse by series
              </h2>
              {remainingSeriesCount > 0 ? (
                <button
                  type="button"
                  className="brand-page__section-link"
                  onClick={() => setShowAllSeries((current) => !current)}
                >
                  {showAllSeries ? 'Show fewer series' : 'View all series →'}
                </button>
              ) : null}
            </div>
            <div className="brand-page__series-row">
              {displayedSeries.map((entry, index) => (
                <article key={entry.name} className="brand-page__series-card">
                  <div className="brand-page__series-media">
                    {entry.imageUrl ? (
                      <img
                        src={entry.imageUrl}
                        alt=""
                        className="brand-page__series-image"
                        loading={index < 3 ? 'eager' : 'lazy'}
                        decoding="async"
                      />
                    ) : (
                      <span className="brand-page__series-placeholder" aria-hidden="true">
                        No image
                      </span>
                    )}
                  </div>
                  <div className="brand-page__series-body">
                    <h3 className="brand-page__series-name">{entry.name}</h3>
                    <p className="brand-page__series-count">
                      {entry.productCount} {entry.productCount === 1 ? 'model' : 'models'}
                    </p>
                    <Link
                      to={`${getBrandPagePath(brand.slug)}?series=${encodeURIComponent(entry.name)}`}
                      className="brand-page__series-cta"
                      onClick={(event) => {
                        event.preventDefault()
                        openCatalogue({ seriesName: entry.name })
                      }}
                    >
                      Explore series →
                    </Link>
                  </div>
                </article>
              ))}
            </div>
            {!showAllSeries && series.length > FEATURED_SERIES_LIMIT ? (
              <p className="brand-page__series-more">
                Showing {FEATURED_SERIES_LIMIT} of {series.length} series.
              </p>
            ) : null}
          </section>
        ) : null}

        {popularProducts.length ? (
          <section className="brand-page__section" aria-labelledby="brand-popular-title">
            <div className="brand-page__section-head">
              <h2 id="brand-popular-title" className="brand-page__section-title">
                Popular {brand.displayName} equipment
              </h2>
              <Link
                to={`${getBrandPagePath(brand.slug)}?catalogue=1`}
                className="brand-page__section-link"
                onClick={(event) => {
                  event.preventDefault()
                  openCatalogue()
                }}
              >
                View all models →
              </Link>
            </div>
            <div className="brand-page__value-grid">
              {popularProducts.map((product, index) => (
                <EquipmentValueGuideCard
                  key={product.id}
                  product={product}
                  priority={index < 3}
                />
              ))}
            </div>
          </section>
        ) : null}

        {listings.length ? (
          <section
            className="brand-page__section brand-page__section--marketplace"
            aria-labelledby="brand-listings-title"
          >
            <div className="brand-page__marketplace-panel">
              <div className="brand-page__marketplace-intro">
                <h2 id="brand-listings-title" className="brand-page__section-title">
                  Currently for sale
                </h2>
                <p className="brand-page__section-lede">
                  Live {brand.displayName} listings from Equipd marketplace sellers.
                </p>
                <Link to={brand.browseListingsHref} className="brand-page__section-link">
                  View all listings →
                </Link>
              </div>
              <div className="brand-page__listings">
                {listings.slice(0, 6).map((listing) => (
                  <ListingCard key={listing.id} listing={listing} variant="home" />
                ))}
              </div>
            </div>
          </section>
        ) : null}

        <section className="brand-page__section brand-page__section--about" aria-labelledby="brand-about-title">
          <div className="brand-page__about-grid">
            <div>
              <h2 id="brand-about-title" className="brand-page__section-title">
                About {brand.displayName}
              </h2>
              <p className="brand-page__about-copy">
                {brand.intro}
              </p>
              <p className="brand-page__about-copy">
                Equipd estimates used values for {brand.displayName} equipment from original RRP
                baselines, production years, condition and console options where mapped — then
                links you to live marketplace listings when sellers have the same brand listed.
              </p>
              <Link to="/valuation" className="brand-page__text-link">
                Value your {brand.displayName} equipment →
              </Link>
            </div>
            <div className="brand-page__faq" aria-labelledby="brand-faq-title">
              <h2 id="brand-faq-title" className="brand-page__section-title">
                Common questions
              </h2>
              <div className="brand-page__faq-list">
                {faqItems.map((item, index) => {
                  const open = openFaqIndex === index
                  return (
                    <div key={item.question} className={`brand-page__faq-item${open ? ' is-open' : ''}`}>
                      <button
                        type="button"
                        className="brand-page__faq-trigger"
                        aria-expanded={open}
                        onClick={() => setOpenFaqIndex(open ? -1 : index)}
                      >
                        <span>{item.question}</span>
                        <span className="brand-page__faq-icon" aria-hidden="true">{open ? '−' : '+'}</span>
                      </button>
                      {open ? (
                        <p className="brand-page__faq-answer">{item.answer}</p>
                      ) : null}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </section>

        {catalogueOpen ? (
          <section
            className="brand-page__section brand-page__section--catalogue"
            aria-labelledby="all-models-title"
            id="all-models"
          >
            <div className="brand-page__section-head">
              <div>
                <h2 id="all-models-title" className="brand-page__section-title">
                  All {brand.displayName} models
                </h2>
                <p className="brand-page__section-lede">
                  Search and filter the full value-guide catalogue.
                </p>
              </div>
              {(categoryFilter || seriesFilter || search) ? (
                <button type="button" className="brand-page__clear" onClick={resetFilters}>
                  Clear filters
                </button>
              ) : null}
            </div>

            <div className="brand-page__catalogue-filters">
              {categories.length ? (
                <label className="brand-page__type-select">
                  <span className="visually-hidden">Equipment type</span>
                  <select
                    value={categoryFilter}
                    onChange={(event) => {
                      setCategoryFilter(event.target.value)
                      setPage(1)
                    }}
                  >
                    <option value="">All equipment types</option>
                    {categories.map((category) => (
                      <option key={category.name} value={category.name}>
                        {category.name} ({category.productCount})
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              {series.length ? (
                <label className="brand-page__type-select">
                  <span className="visually-hidden">Series</span>
                  <select
                    value={seriesFilter}
                    onChange={(event) => {
                      setSeriesFilter(event.target.value)
                      setPage(1)
                    }}
                  >
                    <option value="">All series</option>
                    {series.map((entry) => (
                      <option key={entry.name} value={entry.name}>
                        {entry.name} ({entry.productCount})
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
            </div>

            <p className="brand-page__filter-note">
              Showing {filteredProducts.length} model{filteredProducts.length === 1 ? '' : 's'}
              {seriesFilter ? ` in ${seriesFilter}` : ''}
              {categoryFilter ? ` · ${categoryFilter}` : ''}
              {search ? ` matching “${search}”` : ''}
            </p>

            {pageProducts.length ? (
              <div className="brand-page__value-grid">
                {pageProducts.map((product, index) => (
                  <EquipmentValueGuideCard
                    key={product.id}
                    product={product}
                    priority={index < 2}
                    showEquipmentType
                  />
                ))}
              </div>
            ) : (
              <p className="brand-page__status">
                No equipment models match this filter.
                {' '}
                <button type="button" className="brand-page__clear" onClick={resetFilters}>
                  Reset filters
                </button>
              </p>
            )}

            {totalPages > 1 ? (
              <nav className="brand-page__pagination" aria-label="Model catalogue pages">
                {Array.from({ length: totalPages }, (_, index) => {
                  const pageNumber = index + 1
                  return (
                    <button
                      key={pageNumber}
                      type="button"
                      className={`brand-page__page-link ${pageNumber === safePage ? 'is-active' : ''}`}
                      aria-current={pageNumber === safePage ? 'page' : undefined}
                      onClick={() => setPage(pageNumber)}
                    >
                      {pageNumber}
                    </button>
                  )
                })}
              </nav>
            ) : null}
          </section>
        ) : null}

        {/* Always expose full crawlable value-guide links regardless of client filters. */}
        <ul className="brand-page__crawl-links">
          {allProducts.map((product) => (
            <li key={`crawl-${product.id}`}>
              <Link to={product.href}>{product.displayName} value guide</Link>
            </li>
          ))}
        </ul>

        {payload.relatedBrands?.length ? (
          <section className="brand-page__section" aria-labelledby="related-brands-title">
            <h2 id="related-brands-title" className="brand-page__section-title">Related brands</h2>
            <div className="brand-page__related">
              {payload.relatedBrands.map((related) => (
                <Link key={related.slug} to={related.href} className="brand-page__related-card">
                  <BrandLogo brand={related} size="card" className="brand-page__related-logo" />
                  <span className="brand-page__related-name visually-hidden">{related.displayName}</span>
                  <span className="brand-page__related-count">
                    {related.productCount} {related.productCount === 1 ? 'model' : 'models'} covered
                  </span>
                </Link>
              ))}
            </div>
          </section>
        ) : null}

        {error ? <p className="brand-page__error">{error}</p> : null}
      </div>
    </div>
  )
}
