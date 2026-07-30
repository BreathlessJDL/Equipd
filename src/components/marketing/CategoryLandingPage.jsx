import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import BrandLogo from '../BrandLogo'
import ListingCard from '../ListingCard'
import MarketingLandingHero from './MarketingLandingHero'
import BreadcrumbSchema from '../seo/BreadcrumbSchema'
import FaqPageSchema from '../seo/FaqPageSchema'
import WebPageSchema from '../seo/WebPageSchema'
import JsonLd from '../JsonLd'
import { EmptyState, ErrorState, LoadingState } from '../ui/UiState'
import { usePageMeta } from '../../hooks/usePageMeta'
import { fetchBrandDirectory } from '../../lib/brandCatalogue'
import { fetchActiveListings, fetchCategories } from '../../lib/listings'
import {
  buildCategoryLandingBreadcrumbSchema,
  buildCategoryLandingCollectionSchema,
  buildCategoryLandingFaqSchema,
  buildCategoryLandingOpenGraph,
  buildCategoryLandingWebPageSchema,
  buildFeaturedBrands,
} from '../../lib/categoryLandingSeo'
import '../../pages/BuyUsedGymEquipmentPage.css'
import '../../pages/CommercialGymEquipmentPage.css'

const LISTINGS_LIMIT = 8

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Narrow marketplace rows for search-intent landings (e.g. Smith / Leg Press).
 * When searchIn is set, require the query to match title/brand/model (not description-only).
 */
function filterListingsForIntent(rows, listingFilter = {}) {
  let next = Array.isArray(rows) ? rows : []
  const search = String(listingFilter.search || '').trim().toLowerCase()
  const searchIn = listingFilter.searchIn

  if (search && Array.isArray(searchIn) && searchIn.length > 0) {
    const compact = search.replace(/\s+/g, '')
    const wordBoundary =
      !search.includes(' ') && compact === search
        ? new RegExp(`\\b${escapeRegExp(search)}\\b`, 'i')
        : null

    next = next.filter((row) => {
      const haystack = searchIn
        .map((field) => String(row?.[field] || ''))
        .join(' ')
        .toLowerCase()
      if (!haystack) return false
      if (wordBoundary) return wordBoundary.test(haystack)
      return haystack.includes(search) || haystack.replace(/\s+/g, '').includes(compact)
    })
  }

  const excludeTitleIncludes = listingFilter.excludeTitleIncludes
  if (Array.isArray(excludeTitleIncludes) && excludeTitleIncludes.length > 0) {
    next = next.filter((row) => {
      const title = String(row?.title || '').toLowerCase()
      return !excludeTitleIncludes.some((needle) => title.includes(String(needle).toLowerCase()))
    })
  }

  return next
}

function ValuationJourney({ steps }) {
  return (
    <ol className="buy-page__valuation-preview" aria-hidden="true">
      {steps.map((step) => (
        <li
          key={step.label}
          className={`buy-page__valuation-card${step.emphasize ? ' buy-page__valuation-card--emphasis' : ''}`}
        >
          <span className="buy-page__valuation-card-label">{step.label}</span>
          <span className="buy-page__valuation-card-body">{step.body}</span>
        </li>
      ))}
    </ol>
  )
}

function FaqItem({ question, answer }) {
  return (
    <details className="buy-page__faq-item">
      <summary className="buy-page__faq-question">{question}</summary>
      <div className="buy-page__faq-answer-wrap">
        <p className="buy-page__faq-answer">{answer}</p>
      </div>
    </details>
  )
}

function formatListingCount(count) {
  const n = Number(count) || 0
  if (n <= 0) return 'View brand guide'
  return `${new Intl.NumberFormat('en-GB').format(n)} live ${n === 1 ? 'listing' : 'listings'}`
}

/**
 * Shared SEO category landing page shell.
 * Pass a normalised `content` object from a landing content module.
 */
export default function CategoryLandingPage({ content }) {
  const idPrefix = content.idPrefix || 'landing'
  const openGraph = useMemo(() => buildCategoryLandingOpenGraph(content), [content])
  const [listings, setListings] = useState([])
  const [listingsLoading, setListingsLoading] = useState(true)
  const [listingsError, setListingsError] = useState('')
  const [brands, setBrands] = useState([])

  usePageMeta({
    title: content.metaTitle,
    description: content.metaDescription,
    canonicalPath: content.path,
    robotsContent: 'index, follow, max-image-preview:large',
    openGraph,
  })

  const breadcrumbSchema = useMemo(() => buildCategoryLandingBreadcrumbSchema(content), [content])
  const webPageSchema = useMemo(() => buildCategoryLandingWebPageSchema(content), [content])
  const collectionSchema = useMemo(() => buildCategoryLandingCollectionSchema(content), [content])
  const faqSchema = useMemo(() => buildCategoryLandingFaqSchema(content), [content])

  useEffect(() => {
    let cancelled = false
    const listingFilter = content.listingFilter || {}
    const categorySlugs = listingFilter.categorySlugs || []
    const slugSet = new Set(categorySlugs)

    async function loadMarketplace() {
      setListingsLoading(true)
      setListingsError('')

      let categoryIds = []
      if (categorySlugs.length > 0) {
        const categoriesResult = await fetchCategories()
        if (cancelled) return
        categoryIds = (categoriesResult?.data || [])
          .filter((category) => slugSet.has(category.slug))
          .map((category) => category.id)
      }

      const [listingsResult, brandResult] = await Promise.all([
        fetchActiveListings({
          rating: listingFilter.rating || '',
          categoryIds,
          search: listingFilter.search || '',
          sort: 'newest',
          // Over-fetch when post-filtering so description-only matches can be dropped.
          limit:
            listingFilter.searchIn || listingFilter.excludeTitleIncludes
              ? LISTINGS_LIMIT * 4
              : LISTINGS_LIMIT,
        }),
        fetchBrandDirectory(),
      ])

      if (cancelled) return

      if (listingsResult.error) {
        setListingsError(listingsResult.error.message || 'Unable to load listings.')
        setListings([])
      } else {
        let rows = Array.isArray(listingsResult.data) ? listingsResult.data : []
        if (categorySlugs.length > 0 && categoryIds.length === 0) {
          rows = rows.filter((row) => slugSet.has(String(row?.category?.slug || '').trim()))
        }
        rows = filterListingsForIntent(rows, listingFilter).slice(0, LISTINGS_LIMIT)
        setListings(rows)
      }

      setBrands(buildFeaturedBrands(content.featuredBrandSlugs || [], brandResult?.brands || []))
      setListingsLoading(false)
    }

    loadMarketplace()
    return () => {
      cancelled = true
    }
  }, [content])

  return (
    <article className="buy-page commercial-page">
      <BreadcrumbSchema schema={breadcrumbSchema} />
      <WebPageSchema schema={webPageSchema} />
      <JsonLd data={collectionSchema} />
      <FaqPageSchema schema={faqSchema} />

      <header className="buy-page__hero commercial-page__hero" aria-labelledby={`${idPrefix}-page-title`}>
        <div className="buy-page__visual-rail">
          <MarketingLandingHero
            titleId={`${idPrefix}-page-title`}
            eyebrow={content.eyebrow}
            title={content.h1}
            description={content.lead}
            primaryCta={content.primaryCta}
            secondaryCta={content.secondaryCta}
            searchId={`${idPrefix}-equipment-search`}
            searchLabel={content.searchLabel || 'Search equipment'}
            trustItems={content.heroTrustItems || []}
          />
        </div>
      </header>

      <section
        className="commercial-page__listings-section"
        aria-labelledby={`${idPrefix}-listings-heading`}
      >
        <div className="buy-page__visual-rail">
          <div className="commercial-page__listings-header">
            <header className="buy-page__intro">
              <span className="buy-page__handwritten-note">{content.listingsNote}</span>
              <h2 id={`${idPrefix}-listings-heading`} className="buy-page__h2">
                {content.listingsHeading}
              </h2>
              <p className="buy-page__intro-lead">{content.listingsLead}</p>
            </header>
            <Link to={content.browsePath} className="buy-page__btn buy-page__btn--secondary">
              {content.listingsCta}
            </Link>
          </div>

          {listingsLoading && listings.length === 0 ? (
            <LoadingState compact>{content.listingsLoadingLabel || 'Loading listings…'}</LoadingState>
          ) : null}

          {!listingsLoading && listingsError && listings.length === 0 ? (
            <ErrorState compact>{listingsError}</ErrorState>
          ) : null}

          {!listingsLoading && !listingsError && listings.length === 0 ? (
            <EmptyState compact>
              <p className="commercial-page__listings-empty">
                {content.listingsEmpty ||
                  'No matching listings are live right now. Browse all equipment or check back soon.'}
              </p>
            </EmptyState>
          ) : null}

          {listings.length > 0 ? (
            <div className="commercial-page__listing-grid">
              {listings.map((listing) => (
                <ListingCard
                  key={listing.id}
                  listing={listing}
                  variant="home"
                  showNewBadge
                />
              ))}
            </div>
          ) : null}

          {listings.length > 0 ? (
            <div className="commercial-page__listings-footer">
              <Link to={content.browsePath} className="buy-page__btn buy-page__btn--primary">
                {content.listingsCta}
              </Link>
            </div>
          ) : null}
        </div>
      </section>

      <section
        className="commercial-page__categories-section"
        aria-labelledby={`${idPrefix}-categories-heading`}
      >
        <div className="buy-page__visual-rail">
          <header className="buy-page__intro">
            <span className="buy-page__handwritten-note">{content.categoryNote}</span>
            <h2 id={`${idPrefix}-categories-heading`} className="buy-page__h2">
              {content.categoryHeading}
            </h2>
            <p className="buy-page__intro-lead">{content.categoryLead}</p>
          </header>
          <ul className="commercial-page__category-grid">
            {(content.categories || []).map((category) => (
              <li key={category.id}>
                <Link to={category.to} className="commercial-page__category-card">
                  <p className="commercial-page__category-label">{category.label}</p>
                  <p className="commercial-page__category-copy">{category.description}</p>
                  <span className="commercial-page__category-cta">Browse →</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section
        className="commercial-page__brands-section"
        aria-labelledby={`${idPrefix}-brands-heading`}
      >
        <div className="buy-page__visual-rail">
          <header className="buy-page__intro">
            <span className="buy-page__handwritten-note">{content.brandNote}</span>
            <h2 id={`${idPrefix}-brands-heading`} className="buy-page__h2">
              {content.brandHeading}
            </h2>
            <p className="buy-page__intro-lead">{content.brandLead}</p>
          </header>
          <ul className="commercial-page__brand-grid">
            {brands.map((brand, index) => (
              <li key={brand.slug}>
                <Link to={brand.href} className="commercial-page__brand-card">
                  <span className="commercial-page__brand-logo">
                    <BrandLogo brand={brand} size="hero" priority={index < 4} />
                  </span>
                  <p className="commercial-page__brand-name">{brand.displayName}</p>
                  <p className="commercial-page__brand-count">
                    {formatListingCount(brand.listingCount)}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section
        className="buy-page__benefits-section"
        aria-labelledby={`${idPrefix}-benefits-heading`}
      >
        <div className="buy-page__visual-rail">
          <h2 id={`${idPrefix}-benefits-heading`} className="buy-page__h2">
            {content.benefitsHeading}
          </h2>
          <ul className="buy-page__benefits">
            {(content.benefits || []).map((item, index) => (
              <li key={item.id} className="buy-page__benefit">
                <span className="buy-page__benefit-mark" aria-hidden="true">
                  {index + 1}
                </span>
                <h3 className="buy-page__benefit-title">{item.title}</h3>
                <p className="buy-page__benefit-body">{item.body}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="buy-page__optional" aria-labelledby={`${idPrefix}-valuation-heading`}>
        <div className="buy-page__reading-rail buy-page__reading-rail--optional">
          <div className="buy-page__optional-panel">
            <div>
              <p className="buy-page__eyebrow">{content.valuationEyebrow}</p>
              <h2 id={`${idPrefix}-valuation-heading`} className="buy-page__h2 buy-page__h2--optional">
                {content.valuationHeading}
              </h2>
              <p className="buy-page__optional-copy">{content.valuationCopy}</p>
              <div className="buy-page__optional-actions buy-page__optional-actions--row">
                <Link to={content.secondaryCta.to} className="buy-page__btn buy-page__btn--primary">
                  Get a Free Valuation
                </Link>
                <Link to={content.browsePath} className="buy-page__btn buy-page__btn--secondary">
                  {content.valuationSecondaryCtaLabel || content.listingsCta}
                </Link>
              </div>
            </div>
            <ValuationJourney steps={content.valuationSteps || []} />
          </div>
        </div>
      </section>

      <section className="buy-page__seo" aria-labelledby={`${idPrefix}-guide-heading`}>
        <div className="buy-page__visual-rail buy-page__seo-layout">
          <div className="buy-page__guide-intro">
            <span className="buy-page__handwritten-note">{content.guideNote}</span>
            <h2 id={`${idPrefix}-guide-heading`} className="buy-page__h2 buy-page__h2--guide">
              {content.guideHeading}
            </h2>
            <p className="buy-page__guide-lede">{content.guideIntro}</p>
            <div className="commercial-page__guide-sections">
              {(content.guideSections || []).map((section) => (
                <section
                  key={section.id}
                  className="commercial-page__guide-block"
                  aria-labelledby={`${idPrefix}-guide-${section.id}`}
                >
                  <h3
                    id={`${idPrefix}-guide-${section.id}`}
                    className="commercial-page__guide-block-title"
                  >
                    {section.heading}
                  </h3>
                  {section.paragraphs.map((text) => (
                    <p key={text.slice(0, 48)}>{text}</p>
                  ))}
                </section>
              ))}
            </div>
          </div>

          <div className="buy-page__faq-column" aria-labelledby={`${idPrefix}-faq-heading`}>
            <span className="buy-page__handwritten-note">{content.faqNote}</span>
            <h2 id={`${idPrefix}-faq-heading`} className="buy-page__h2 buy-page__h2--faq">
              Frequently asked questions
            </h2>
            <p className="buy-page__faq-lede">{content.faqIntro}</p>
            <div className="buy-page__faq-list">
              {(content.faqItems || []).map((item) => (
                <FaqItem key={item.question} question={item.question} answer={item.answer} />
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="buy-page__mid-cta" aria-labelledby={`${idPrefix}-mid-cta-heading`}>
        <div className="buy-page__reading-rail buy-page__reading-rail--mid-cta">
          <h2 id={`${idPrefix}-mid-cta-heading`} className="buy-page__mid-cta-title">
            {content.midCtaHeading}
          </h2>
          <p className="buy-page__mid-cta-lead">{content.midCtaLead}</p>
          <Link
            to={content.browsePath}
            className="buy-page__btn buy-page__btn--primary buy-page__btn--primary-lg"
          >
            {content.midCtaLabel}
          </Link>
        </div>
      </section>

      <section
        className="commercial-page__explore-section"
        aria-labelledby={`${idPrefix}-explore-heading`}
      >
        <div className="buy-page__visual-rail">
          <header className="buy-page__intro">
            <span className="buy-page__handwritten-note">{content.exploreNote}</span>
            <h2 id={`${idPrefix}-explore-heading`} className="buy-page__h2">
              {content.exploreHeading}
            </h2>
            <p className="buy-page__intro-lead">{content.exploreLead}</p>
          </header>
          <ul className="commercial-page__explore-grid">
            {(content.exploreLinks || []).map((link) => (
              <li key={link.to + link.label}>
                <Link to={link.to} className="commercial-page__explore-card">
                  <p className="commercial-page__explore-label">{link.label}</p>
                  <p className="commercial-page__explore-copy">{link.description}</p>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </article>
  )
}
