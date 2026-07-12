import { useEffect, useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import BrandLogo from '../components/BrandLogo'
import EquipmentValueGuideCard from '../components/EquipmentValueGuideCard'
import JsonLd from '../components/JsonLd'
import ListingCard from '../components/ListingCard'
import PageBreadcrumbs from '../components/PageBreadcrumbs'
import { usePageMeta } from '../hooks/usePageMeta'
import {
  buildBrandPageJsonLd,
  buildBrandPageMetaDescription,
  buildBrandPageMetaTitle,
  buildBrandPageTitle,
  fetchBrandPageData,
  getBrandPagePath,
} from '../lib/brandCatalogue'
import './BrandPage.css'

const PAGE_SIZE = 24

function formatModelsCovered(count) {
  const n = Number(count) || 0
  return `${n} equipment ${n === 1 ? 'model' : 'models'}`
}

function formatMarketplaceListings(count) {
  const n = Number(count) || 0
  return `${n} current marketplace ${n === 1 ? 'listing' : 'listings'}`
}

export default function BrandPage() {
  const { brandSlug } = useParams()
  const [searchParams] = useSearchParams()
  const [payload, setPayload] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [categoryFilter, setCategoryFilter] = useState('')
  const [seriesFilter, setSeriesFilter] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      setCategoryFilter('')
      setSeriesFilter('')
      setSearch('')
      setPage(1)
      const result = await fetchBrandPageData(brandSlug)
      if (cancelled) return
      if (result.error && !result.brand) {
        setError(result.error.message || 'Unable to load brand.')
      }
      setPayload(result)
      const seriesFromUrl = String(searchParams.get('series') || '').trim()
      if (seriesFromUrl && result?.series?.length) {
        const known = result.series.some((entry) => entry.name === seriesFromUrl)
        if (known) setSeriesFilter(seriesFromUrl)
      }
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [brandSlug, searchParams])

  const brand = payload?.brand
  const notFound = Boolean(payload?.notFound)
  const allProducts = payload?.products || []

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

  const visibleSeries = useMemo(() => {
    const series = payload?.series || []
    if (!categoryFilter && !search.trim()) return series

    const query = search.trim().toLowerCase()
    return series.filter((entry) => {
      const matching = allProducts.filter((product) => {
        if (product.series !== entry.name) return false
        if (categoryFilter && product.equipmentType !== categoryFilter) return false
        if (!query) return true
        const haystack = [product.displayName, product.series, product.equipmentType]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
        return haystack.includes(query)
      })
      return matching.length > 0
    }).map((entry) => {
      const matchingCount = allProducts.filter((product) => {
        if (product.series !== entry.name) return false
        if (categoryFilter && product.equipmentType !== categoryFilter) return false
        if (!search.trim()) return true
        const haystack = [product.displayName, product.series, product.equipmentType]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
        return haystack.includes(search.trim().toLowerCase())
      }).length
      return { ...entry, productCount: matchingCount }
    })
  }, [payload?.series, allProducts, categoryFilter, search])

  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const pageProducts = filteredProducts.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  const jsonLd = useMemo(
    () => (brand ? buildBrandPageJsonLd(brand, allProducts) : null),
    [brand, allProducts],
  )

  function resetFilters() {
    setCategoryFilter('')
    setSeriesFilter('')
    setSearch('')
    setPage(1)
  }

  function selectSeries(name) {
    setSeriesFilter((current) => (current === name ? '' : name))
    setCategoryFilter('')
    setPage(1)
    const section = document.getElementById('value-guides')
    if (section) section.scrollIntoView({ behavior: 'smooth', block: 'start' })
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
      <div className="brand-page__inner">
        <PageBreadcrumbs
          items={[
            { label: 'Home', to: '/' },
            { label: 'Equipment Values', to: '/brands' },
            { label: brand.displayName },
          ]}
        />

        <header className="brand-page__hero">
          <div className="brand-page__hero-logo-wrap">
            <BrandLogo brand={brand} size="hero" priority className="brand-page__hero-logo" />
          </div>
          <div className="brand-page__hero-copy">
            <h1 className="brand-page__title">{buildBrandPageTitle(brand.displayName)}</h1>
            <p className="brand-page__lede">{brand.intro}</p>
            <dl className="brand-page__stats">
              <div className="brand-page__stat">
                <dt className="visually-hidden">Value-guide coverage</dt>
                <dd>{formatModelsCovered(brand.productCount)}</dd>
              </div>
              <div className="brand-page__stat brand-page__stat--listings">
                <dt className="visually-hidden">Marketplace listings</dt>
                <dd>{formatMarketplaceListings(brand.listingCount)}</dd>
              </div>
            </dl>
          </div>
          <div className="brand-page__hero-aside">
            <p className="brand-page__hero-cta-label">Value your equipment</p>
            <p className="brand-page__hero-cta-copy">
              Get an instant estimate for your {brand.displayName} equipment.
            </p>
            <Link to="/valuation" className="brand-page__hero-cta">
              Value your equipment →
            </Link>
          </div>
        </header>

        <div className="brand-page__filters">
          <section className="brand-page__section brand-page__section--search" aria-labelledby="brand-search-title">
            <h2 id="brand-search-title" className="brand-page__section-title">
              Find your model
            </h2>
            <label className="brand-page__search brand-page__search--wide">
              <span className="visually-hidden">Search {brand.displayName} equipment models</span>
              <input
                type="search"
                value={search}
                placeholder={`Search ${brand.displayName} equipment models...`}
                onChange={(event) => {
                  setSearch(event.target.value)
                  setPage(1)
                }}
                autoComplete="off"
              />
            </label>
          </section>

          {payload.categories?.length ? (
            <section className="brand-page__section brand-page__section--type" aria-labelledby="brand-categories-title">
              <h2 id="brand-categories-title" className="brand-page__section-title">
                Browse by equipment type
              </h2>
              <label className="brand-page__type-select">
                <span className="visually-hidden">Equipment type</span>
                <select
                  value={categoryFilter}
                  onChange={(event) => {
                    setCategoryFilter(event.target.value)
                    setSeriesFilter('')
                    setPage(1)
                  }}
                >
                  <option value="">All equipment types</option>
                  {payload.categories.map((category) => (
                    <option key={category.name} value={category.name}>
                      {category.name} ({category.productCount})
                    </option>
                  ))}
                </select>
              </label>
            </section>
          ) : null}
        </div>

        {visibleSeries.length ? (
          <section className="brand-page__section" aria-labelledby="brand-series-title">
            <div className="brand-page__section-intro">
              <h2 id="brand-series-title" className="brand-page__section-title">
                Browse by series
              </h2>
              <p className="brand-page__section-lede">
                Select a series to explore models and values.
              </p>
            </div>
            <div className="brand-page__series-grid">
              {visibleSeries.map((entry, index) => (
                <button
                  key={entry.name}
                  type="button"
                  className={`brand-page__series-card ${seriesFilter === entry.name ? 'is-active' : ''}`}
                  onClick={() => selectSeries(entry.name)}
                  aria-pressed={seriesFilter === entry.name}
                >
                  <span className="brand-page__series-media">
                    {entry.imageUrl ? (
                      <img
                        src={entry.imageUrl}
                        alt={`${brand.displayName} ${entry.name} series equipment`}
                        className="brand-page__series-image"
                        loading={index < 5 ? 'eager' : 'lazy'}
                        decoding="async"
                      />
                    ) : (
                      <span className="brand-page__series-placeholder" aria-hidden="true">
                        No image
                      </span>
                    )}
                  </span>
                  <span className="brand-page__series-text">
                    <span className="brand-page__series-name">{entry.name}</span>
                    <span className="brand-page__series-count">
                      {entry.productCount} {entry.productCount === 1 ? 'model' : 'models'}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </section>
        ) : null}

        <section className="brand-page__section" aria-labelledby="brand-value-guides-title" id="value-guides">
          <div className="brand-page__section-intro">
            <h2 id="brand-value-guides-title" className="brand-page__section-title">
              Explore {brand.displayName} equipment values
            </h2>
            <p className="brand-page__section-lede">
              Browse individual models to see estimated used values, production years and console compatibility.
            </p>
          </div>

          {(categoryFilter || seriesFilter || search) ? (
            <p className="brand-page__filter-note">
              Showing
              {categoryFilter ? ` ${categoryFilter}` : ''}
              {seriesFilter ? ` ${seriesFilter}` : ''}
              {search ? ` matching “${search}”` : ''}
              {' '}
              (
              {filteredProducts.length}
              )
              {' '}
              <button type="button" className="brand-page__clear" onClick={resetFilters}>
                Clear filters
              </button>
            </p>
          ) : null}

          {pageProducts.length ? (
            <div className="brand-page__value-grid">
              {pageProducts.map((product, index) => (
                <EquipmentValueGuideCard
                  key={product.id}
                  product={product}
                  priority={index < 4}
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
            <nav className="brand-page__pagination" aria-label="Value guide pages">
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

          {/* Always expose full crawlable value-guide links regardless of client filters. */}
          <ul className="brand-page__crawl-links">
            {allProducts.map((product) => (
              <li key={`crawl-${product.id}`}>
                <Link to={product.href}>{product.displayName} value guide</Link>
              </li>
            ))}
          </ul>
        </section>

        <section
          className="brand-page__section brand-page__section--marketplace"
          aria-labelledby="brand-listings-title"
        >
          <div className="brand-page__section-head">
            <div>
              <h2 id="brand-listings-title" className="brand-page__section-title">
                Current {brand.displayName} marketplace listings
              </h2>
              <p className="brand-page__section-lede">
                Equipment currently listed for sale by Equipd marketplace sellers.
              </p>
            </div>
            {payload.listings?.length ? (
              <Link to={brand.browseListingsHref} className="brand-page__text-link">
                View all {brand.displayName} marketplace listings
              </Link>
            ) : null}
          </div>

          {payload.listings?.length ? (
            <div className="brand-page__listings">
              {payload.listings.map((listing) => (
                <ListingCard key={listing.id} listing={listing} variant="home" />
              ))}
            </div>
          ) : (
            <p className="brand-page__status">
              No active {brand.displayName} marketplace listings right now.
              {' '}
              <Link to={brand.browseListingsHref} className="brand-page__text-link">
                Browse related listings
              </Link>
            </p>
          )}
        </section>

        <section className="brand-page__cta" aria-labelledby="brand-valuator-title">
          <h2 id="brand-valuator-title" className="brand-page__cta-title">
            Value your equipment
          </h2>
          <p className="brand-page__cta-copy">
            Estimate the current used value of your {brand.displayName} equipment based on
            model, year, condition and console.
          </p>
          <Link to="/valuation" className="brand-page__cta-button">
            Value your equipment
          </Link>
        </section>

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
