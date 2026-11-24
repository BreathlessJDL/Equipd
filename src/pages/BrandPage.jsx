import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import BrandPageHero from '../components/brands/BrandPageHero'
import BrandPageValuationSearch from '../components/brands/BrandPageValuationSearch'
import BrandLogo from '../components/BrandLogo'
import JsonLd from '../components/JsonLd'
import ListingCard from '../components/ListingCard'
import ListingAnalyticsList from '../components/analytics/ListingAnalyticsList'
import { BrandWantedRequestCard } from '../components/wanted/WantedRequestSurfaces'
import PageBreadcrumbs from '../components/PageBreadcrumbs'
import BreadcrumbSchema from '../components/seo/BreadcrumbSchema'
import { usePageMeta } from '../hooks/usePageMeta'
import { useOneRowListingCapacity } from '../hooks/useOneRowListingCapacity'
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
} from '../lib/brandBuyerSeo'
import {
  BRAND_VALUATION_SHORTCUT_LIMIT,
  BRAND_VALUATIONS_ANCHOR_ID,
  buildBrandFaqItems,
  buildBrandFaqPageSchema,
  buildBrandHeroStats,
  selectPopularBrandProducts,
} from '../lib/brandPageCurated'
import { buildBrandPageBreadcrumbSchema } from '../lib/breadcrumbStructuredData'
import { BRAND_LISTINGS_FETCH_LIMIT } from '../lib/oneRowListingCapacity'
import { getEquipdDefaultSocialImageUrl } from '../lib/socialPreview'
import './BrandPage.css'

function scrollToBrandValuations() {
  requestAnimationFrame(() => {
    document.getElementById(BRAND_VALUATIONS_ANCHOR_ID)?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    })
  })
}

function BrandMarketplaceSection({
  brand,
  listings,
  buyerConfig,
}) {
  const gridRef = useRef(null)
  const hasListings = listings.length > 0
  const capacity = useOneRowListingCapacity(gridRef, {
    enabled: true,
    capacityOptions: { mobileCapacity: 4 },
  })
  const visibleListings = hasListings ? listings.slice(0, capacity) : []
  const heading = hasListings
    ? (buyerConfig?.marketplaceHeading || `Used ${brand.displayName} equipment for sale`)
    : (buyerConfig?.marketplaceHeadingEmpty || `Looking for used ${brand.displayName} equipment?`)
  const lede = hasListings
    ? (buyerConfig?.marketplaceLede || `Live ${brand.displayName} listings from Equipd marketplace sellers.`)
    : (buyerConfig?.marketplaceLedeEmpty || (
      `There are no matching ${brand.displayName} listings right now. Browse related equipment `
      + 'or request what you need — new stock appears on Equipd as sellers list it.'
    ))
  const headingId = hasListings ? 'brand-listings-title' : 'brand-listings-empty-title'
  const ctaLabel = hasListings
    ? `View all ${brand.displayName} listings`
    : `Browse ${brand.displayName}`

  return (
    <section
      className={`brand-page__section brand-page__section--marketplace${hasListings ? '' : ' brand-page__section--marketplace-empty'}`}
      aria-labelledby={headingId}
    >
      <div className="brand-page__section-head brand-page__section-head--marketplace">
        <div className="brand-page__section-head-copy">
          <h2 id={headingId} className="brand-page__section-title">
            {heading}
          </h2>
          <p className="brand-page__section-lede">{lede}</p>
        </div>
      </div>

      {hasListings ? (
        <ListingAnalyticsList
          itemListId={`brand_${brand.slug || brand.id || 'listings'}`}
          itemListName={heading}
          listings={visibleListings}
        >
          <div
            ref={gridRef}
            className="brand-page__listings listing-card-grid brand-page__listings--one-row"
          >
            {visibleListings.map((listing, index) => (
              <ListingCard
                key={listing.id}
                listing={listing}
                variant="home"
                imagePriority={index < 4}
              />
            ))}
          </div>
        </ListingAnalyticsList>
      ) : (
        <>
          <div
            ref={gridRef}
            className="brand-page__listing-grid-measure"
            aria-hidden="true"
          />
          <div className="brand-page__marketplace-empty">
            <p className="brand-page__marketplace-empty-actions">
              Request the equipment you need, or browse related {brand.displayName} results while new
              listings arrive.
            </p>
          </div>
        </>
      )}

      <div className="brand-page__listings-footer">
        <Link to={brand.browseListingsHref} className="brand-page__listings-cta">
          {ctaLabel}
        </Link>
      </div>
    </section>
  )
}

export default function BrandPage() {
  const { brandSlug } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const searchInputId = useId()
  const [payload, setPayload] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')
  const [searchFocused, setSearchFocused] = useState(false)
  const [openFaqIndex, setOpenFaqIndex] = useState(0)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      setSearch('')
      setOpenFaqIndex(0)
      const result = await fetchBrandPageData(brandSlug, {
        listingLimit: BRAND_LISTINGS_FETCH_LIMIT,
      })
      if (cancelled) return
      if (result.error && !result.brand) {
        setError(result.error.message || 'Unable to load brand.')
      }
      setPayload(result)
      const shouldScrollToValuations = Boolean(
        String(searchParams.get('series') || '').trim()
        || String(searchParams.get('catalogue') || '').trim() === '1',
      )
      setLoading(false)
      if (shouldScrollToValuations) {
        scrollToBrandValuations()
      }
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
          'og:image': getEquipdDefaultSocialImageUrl(),
          'twitter:card': 'summary_large_image',
          'twitter:title': `${buildBrandPageMetaTitle(brand.displayName, { slug: brand.slug })} | Equipd`,
          'twitter:description': buildBrandPageMetaDescription(brand.displayName, { slug: brand.slug }),
          'twitter:image': getEquipdDefaultSocialImageUrl(),
        }
      : null,
  })

  const popularProducts = useMemo(
    () => selectPopularBrandProducts(allProducts, {
      listings,
      limit: BRAND_VALUATION_SHORTCUT_LIMIT,
    }),
    [allProducts, listings],
  )
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
    () => buildBrandHeroStats({
      productCount: brand?.productCount,
      listingCount: brand?.listingCount,
      categoryCount: categories.length,
    }),
    [brand?.productCount, brand?.listingCount, categories.length],
  )
  const faqItems = useMemo(
    () => (brand ? buildBrandFaqItems(brand.displayName, { slug: brand.slug }) : []),
    [brand],
  )

  const jsonLd = useMemo(() => {
    if (!brand) return null
    const collection = buildBrandPageJsonLd(brand, allProducts, { listings })
    const faqSchema = buildBrandFaqPageSchema(brand, faqItems)
    return [collection, faqSchema].filter(Boolean)
  }, [brand, allProducts, faqItems, listings])

  const breadcrumbSchema = useMemo(
    () => (brand ? buildBrandPageBreadcrumbSchema(brand) : null),
    [brand],
  )

  function handleSearchSubmit(event) {
    event.preventDefault()
    if (searchSuggestions[0]?.href) {
      navigate(searchSuggestions[0].href)
      return
    }
    scrollToBrandValuations()
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

        <BrandPageHero
          brand={brand}
          seoTitle={pageTitle}
          lede={heroLede}
          stats={stats}
          searchInputId={searchInputId}
          search={search}
          searchPlaceholder={
            buyerConfig?.searchPlaceholder
            || `Search ${brand.displayName} equipment and models...`
          }
          searchSuggestions={searchSuggestions}
          searchFocused={searchFocused}
          showSuggestionValues={!buyerIntent}
          onSearchChange={(event) => {
            setSearch(event.target.value)
          }}
          onSearchFocus={() => setSearchFocused(true)}
          onSearchBlur={() => {
            window.setTimeout(() => setSearchFocused(false), 120)
          }}
          onSearchSubmit={handleSearchSubmit}
          onExploreValues={scrollToBrandValuations}
        />

        <BrandMarketplaceSection
          brand={brand}
          listings={listings}
          buyerConfig={buyerConfig}
        />

        <section className="brand-page__section brand-page__section--wanted" aria-label={`${brand.displayName} wanted equipment`}>
          <div className="brand-page__wanted-wrap">
            <BrandWantedRequestCard brandName={brand.displayName} />
          </div>
        </section>

        <BrandPageValuationSearch
          brand={brand}
          modelCount={brand.productCount || allProducts.length}
          popularProducts={popularProducts}
        />

        {buyerIntent ? (
          <>
            {buyingGuideSection}
            {categoryLinksSection}
          </>
        ) : null}

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
