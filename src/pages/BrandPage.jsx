import { useEffect, useId, useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import BrandLogo from '../components/BrandLogo'
import BrandModelCard from '../components/BrandModelCard'
import BrandValueResearchCard from '../components/BrandValueResearchCard'
import EquipmentValueGuideCard from '../components/EquipmentValueGuideCard'
import JsonLd from '../components/JsonLd'
import ListingCard from '../components/ListingCard'
import { BrandWantedRequestCard } from '../components/wanted/WantedRequestSurfaces'
import PageBreadcrumbs from '../components/PageBreadcrumbs'
import BreadcrumbSchema from '../components/seo/BreadcrumbSchema'
import { usePageMeta } from '../hooks/usePageMeta'
import {
  buildBrandPageJsonLd,
  buildBrandPageMetaDescription,
  buildBrandPageMetaTitle,
  buildBrandPageTitle,
  fetchBrandPageData,
  getBrandAbsoluteUrl,
  getBrandPagePath,
} from '../lib/brandCatalogue'
import {
  getBrandBuyerSeoConfig,
  isBuyerIntentBrand,
  selectConfiguredBrandModelGroups,
} from '../lib/brandBuyerSeo'
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

function BrandMarketplaceSection({
  brand,
  listings,
  buyerConfig,
}) {
  const hasListings = listings.length > 0
  const heading = hasListings
    ? (buyerConfig?.marketplaceHeading || 'Currently for sale')
    : (buyerConfig?.marketplaceHeadingEmpty || `Looking for used ${brand.displayName} equipment?`)
  const lede = hasListings
    ? (buyerConfig?.marketplaceLede || `Live ${brand.displayName} listings from Equipd marketplace sellers.`)
    : (buyerConfig?.marketplaceLedeEmpty || (
      `There are no matching ${brand.displayName} listings right now. Browse related equipment `
      + 'or request what you need — new stock appears on Equipd as sellers list it.'
    ))
  const headingId = hasListings ? 'brand-listings-title' : 'brand-listings-empty-title'

  return (
    <section
      className={`brand-page__section brand-page__section--marketplace${hasListings ? '' : ' brand-page__section--marketplace-empty'}`}
      aria-labelledby={headingId}
    >
      <div className="brand-page__section-head">
        <div className="brand-page__section-head-copy">
          <h2 id={headingId} className="brand-page__section-title">
            {heading}
          </h2>
          <p className="brand-page__section-lede">{lede}</p>
        </div>
        <Link to={brand.browseListingsHref} className="brand-page__section-link">
          {hasListings ? 'View all listings →' : `Browse ${brand.displayName} →`}
        </Link>
      </div>
      {hasListings ? (
        <div className="brand-page__listings listing-card-grid">
          {listings.slice(0, 6).map((listing, index) => (
            <ListingCard
              key={listing.id}
              listing={listing}
              variant="home"
              imagePriority={index < 4}
            />
          ))}
        </div>
      ) : (
        <div className="brand-page__marketplace-empty">
          <p className="brand-page__marketplace-empty-actions">
            Request the equipment you need, or browse related {brand.displayName} results while new
            listings arrive.
          </p>
        </div>
      )}
      <div className="brand-page__wanted-wrap">
        <BrandWantedRequestCard brandName={brand.displayName} />
      </div>
    </section>
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
  const buyerConfig = useMemo(
    () => (brand ? getBrandBuyerSeoConfig(brand.slug) : null),
    [brand],
  )
  const buyerIntent = Boolean(buyerConfig && isBuyerIntentBrand(brand?.slug))
  const series = useMemo(
    () => enrichBrandSeriesWithTags(payload?.series || [], allProducts),
    [payload?.series, allProducts],
  )

  usePageMeta({
    title: brand
      ? buildBrandPageMetaTitle(brand.displayName, { slug: brand.slug })
      : notFound
        ? 'Brand not found'
        : 'Brand',
    description: brand
      ? buildBrandPageMetaDescription(brand.displayName, { slug: brand.slug })
      : 'Explore gym equipment value guides by brand on Equipd.',
    canonicalPath: brand ? getBrandPagePath(brand.slug) : null,
    noIndex: notFound,
    openGraph: brand
      ? {
          'og:title': `${buildBrandPageMetaTitle(brand.displayName, { slug: brand.slug })} | Equipd`,
          'og:description': buildBrandPageMetaDescription(brand.displayName, { slug: brand.slug }),
          'og:url': getBrandAbsoluteUrl(brand.slug),
          'og:image': 'https://www.equipd.co.uk/sell-gym-equipment/sell-gym-equipment-og.png',
          'twitter:card': 'summary_large_image',
          'twitter:title': `${buildBrandPageMetaTitle(brand.displayName, { slug: brand.slug })} | Equipd`,
          'twitter:description': buildBrandPageMetaDescription(brand.displayName, { slug: brand.slug }),
          'twitter:image': 'https://www.equipd.co.uk/sell-gym-equipment/sell-gym-equipment-og.png',
        }
      : null,
  })

  const popularProducts = useMemo(
    () => selectPopularBrandProducts(allProducts, { listings }),
    [allProducts, listings],
  )
  const configuredModelGroups = useMemo(
    () => selectConfiguredBrandModelGroups(buyerConfig, allProducts),
    [buyerConfig, allProducts],
  )
  const valueResearchProducts = useMemo(() => {
    if (!buyerIntent) return []
    const configured = configuredModelGroups.flatMap((group) => group.items.map((item) => item.product))
    return configured.length ? configured : selectPopularBrandProducts(allProducts, { listings })
  }, [buyerIntent, configuredModelGroups, allProducts, listings])
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
      variant: buyerIntent ? 'marketplace' : 'default',
    }),
    [brand?.productCount, brand?.listingCount, categories, series, buyerIntent],
  )
  const faqItems = useMemo(
    () => (brand ? buildBrandFaqItems(brand.displayName, { slug: brand.slug }) : []),
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

  const pageTitle = buildBrandPageTitle(brand.displayName, { slug: brand.slug })
  const heroLede = buyerConfig?.lede || brand.intro
  const aboutTitle = buyerConfig?.about?.title || `About ${brand.displayName}`
  const aboutParagraphs = buyerConfig?.about?.paragraphs || [
    brand.intro,
    (
      `Equipd estimates used values for ${brand.displayName} equipment from original RRP `
      + 'baselines, production years, condition and console options where mapped — then '
      + 'links you to live marketplace listings when sellers have the same brand listed.'
    ),
  ]

  const seriesSection = featuredSeries.length ? (
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
  ) : null

  const popularSection = popularProducts.length && !buyerIntent ? (
    <section className="brand-page__section" aria-labelledby="brand-popular-title">
      <div className="brand-page__section-head">
        <h2 id="brand-popular-title" className="brand-page__section-title">
          {`Popular ${brand.displayName} equipment`}
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
  ) : null

  const valuesResearchSection = buyerIntent && valueResearchProducts.length ? (
    <section className="brand-page__section" aria-labelledby="brand-popular-title">
      <div className="brand-page__section-head">
        <div className="brand-page__section-head-copy">
          <h2 id="brand-popular-title" className="brand-page__section-title">
            {buyerConfig?.valuesHeading || `Research ${brand.displayName} equipment values`}
          </h2>
          <p className="brand-page__section-lede">
            {buyerConfig?.valuesLede || (
              `Open a model value guide to research original RRP, production information and `
              + `estimated used values for ${brand.displayName} equipment.`
            )}
          </p>
        </div>
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
      <div className="brand-page__value-research-list">
        {valueResearchProducts.map((product, index) => (
          <BrandValueResearchCard
            key={product.id || product.canonicalProductKey}
            product={product}
            priority={index < 2}
          />
        ))}
      </div>
    </section>
  ) : null

  const modelsSection = buyerIntent && configuredModelGroups.length ? (
    <section className="brand-page__section" aria-labelledby="brand-models-title">
      <div className="brand-page__section-head">
        <div className="brand-page__section-head-copy">
          <h2 id="brand-models-title" className="brand-page__section-title">
            {buyerConfig.modelsHeading || `Explore ${brand.displayName} equipment`}
          </h2>
          {buyerConfig.modelsLede ? (
            <p className="brand-page__section-lede">{buyerConfig.modelsLede}</p>
          ) : null}
        </div>
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
      {configuredModelGroups.map((group) => (
        <div key={group.id} className="brand-page__model-group">
          {group.title ? (
            <h3 className="brand-page__model-group-title">{group.title}</h3>
          ) : null}
          <div className="brand-page__model-grid">
            {group.items.map(({ product, blurb }, index) => (
              <BrandModelCard
                key={product.id || product.canonicalProductKey}
                product={product}
                blurb={blurb}
                priority={index < 3}
              />
            ))}
          </div>
        </div>
      ))}
    </section>
  ) : null

  const buyingGuideSection = buyerConfig?.buyingGuide ? (
    <section className="brand-page__section" aria-labelledby="brand-buying-title">
      <h2 id="brand-buying-title" className="brand-page__section-title">
        {buyerConfig.buyingGuide.title}
      </h2>
      {buyerConfig.buyingGuide.checkpoints?.length ? (
        <div className="brand-page__checkpoint-grid">
          {buyerConfig.buyingGuide.checkpoints.map((checkpoint) => (
            <article key={checkpoint.title} className="brand-page__checkpoint">
              <h3 className="brand-page__checkpoint-title">{checkpoint.title}</h3>
              <p className="brand-page__checkpoint-body">{checkpoint.body}</p>
            </article>
          ))}
        </div>
      ) : (
        <div className="brand-page__prose">
          {(buyerConfig.buyingGuide.paragraphs || []).map((paragraph) => (
            <p key={paragraph.slice(0, 48)} className="brand-page__about-copy">
              {paragraph}
            </p>
          ))}
        </div>
      )}
    </section>
  ) : null

  const categoryLinksSection = buyerConfig?.categoryLinks?.length ? (
    <section className="brand-page__section" aria-labelledby="brand-related-cats-title">
      <h2 id="brand-related-cats-title" className="brand-page__section-title">
        Related equipment on Equipd
      </h2>
      <nav className="brand-page__category-nav" aria-label="Related equipment categories">
        {buyerConfig.categoryLinks.map((link) => (
          <Link key={link.to} to={link.to} className="brand-page__category-chip">
            {link.label}
          </Link>
        ))}
      </nav>
    </section>
  ) : null

  const marketplaceSection = (
    <BrandMarketplaceSection
      brand={brand}
      listings={listings}
      buyerConfig={buyerConfig}
    />
  )

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
          <div className="brand-page__hero-main">
            <div className="brand-page__hero-logo-wrap">
              <BrandLogo brand={brand} size="hero" priority className="brand-page__hero-logo" />
            </div>

            {buyerIntent ? (
              <p className="brand-page__eyebrow">Used gym equipment</p>
            ) : null}

            <h1 className="brand-page__title">{pageTitle}</h1>
            <p className="brand-page__lede">{heroLede}</p>

            <section className="brand-page__search-panel" aria-label={`${brand.displayName} model search`}>
              <form className="brand-page__search-form" onSubmit={handleSearchSubmit}>
                <label className="visually-hidden" htmlFor={searchInputId}>
                  Search {brand.displayName} equipment and models
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
                      placeholder={
                        buyerConfig?.searchPlaceholder
                        || `Search ${brand.displayName} equipment and models...`
                      }
                      onChange={(event) => {
                        setSearch(event.target.value)
                        setPage(1)
                        if (event.target.value.trim().length >= 2) setShowAllModels(true)
                      }}
                      onFocus={() => setSearchFocused(true)}
                      onBlur={() => {
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
                            {product.estimatedValueLabel && !buyerIntent ? (
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
              </form>
            </section>

            <nav className="brand-page__hero-links" aria-label={`${brand.displayName} page actions`}>
              {buyerIntent ? (
                <>
                  <Link to={brand.browseListingsHref} className="brand-page__hero-link">
                    {buyerConfig?.heroCta?.label || `Browse ${brand.displayName} for sale`}
                    {' '}
                    →
                  </Link>
                  <Link
                    to={`${getBrandPagePath(brand.slug)}?catalogue=1`}
                    className="brand-page__hero-link"
                    onClick={(event) => {
                      event.preventDefault()
                      openCatalogue()
                    }}
                  >
                    {buyerConfig?.heroSecondaryCta?.label || `Explore ${brand.displayName} values`}
                    {' '}
                    →
                  </Link>
                </>
              ) : (
                <Link to="/valuation" className="brand-page__hero-link">
                  Value your equipment →
                </Link>
              )}
            </nav>
          </div>

          <aside className="brand-page__hero-aside" aria-label={`${brand.displayName} marketplace summary`}>
            {stats.length ? (
              <ul className="brand-page__hero-stats">
                {stats.map((stat) => (
                  <li key={stat.key} className="brand-page__hero-stat">
                    <span className="brand-page__hero-stat-value">{stat.value}</span>
                    <span className="brand-page__hero-stat-label">{stat.label}</span>
                  </li>
                ))}
              </ul>
            ) : null}

            <div className="brand-page__hero-context">
              <p className="brand-page__hero-context-heading">
                {`${brand.displayName} on Equipd`}
              </p>
              <p className="brand-page__hero-context-body">
                {buyerConfig?.heroContextBody
                  || 'Compare models, research values and buy with confidence from UK sellers on Equipd.'}
              </p>
            </div>
          </aside>
        </header>

        {buyerIntent ? (
          <>
            {marketplaceSection}
            {modelsSection}
            {buyingGuideSection}
            {categoryLinksSection}
            {valuesResearchSection}
          </>
        ) : (
          <>
            {seriesSection}
            {popularSection}
            {marketplaceSection}
          </>
        )}

        <section className="brand-page__section brand-page__section--about" aria-labelledby="brand-about-title">
          <div className="brand-page__about-grid">
            <div>
              <h2 id="brand-about-title" className="brand-page__section-title">
                {aboutTitle}
              </h2>
              {aboutParagraphs.map((paragraph) => (
                <p key={paragraph.slice(0, 48)} className="brand-page__about-copy">
                  {paragraph}
                </p>
              ))}
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

            <p className="brand-page__catalogue-count">
              {filteredProducts.length} {filteredProducts.length === 1 ? 'model' : 'models'}
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
