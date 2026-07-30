import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import BrandLogo from '../components/BrandLogo'
import ListingCard from '../components/ListingCard'
import MarketingLandingHero from '../components/marketing/MarketingLandingHero'
import BreadcrumbSchema from '../components/seo/BreadcrumbSchema'
import FaqPageSchema from '../components/seo/FaqPageSchema'
import WebPageSchema from '../components/seo/WebPageSchema'
import JsonLd from '../components/JsonLd'
import { EmptyState, ErrorState, LoadingState } from '../components/ui/UiState'
import { usePageMeta } from '../hooks/usePageMeta'
import { fetchBrandDirectory } from '../lib/brandCatalogue'
import { fetchActiveListings, fetchCategories } from '../lib/listings'
import {
  COMMERCIAL_CARDIO_BENEFITS,
  COMMERCIAL_CARDIO_BENEFITS_HEADING,
  COMMERCIAL_CARDIO_BRAND_HEADING,
  COMMERCIAL_CARDIO_BRAND_LEAD,
  COMMERCIAL_CARDIO_BRAND_NOTE,
  COMMERCIAL_CARDIO_BROWSE_PATH,
  COMMERCIAL_CARDIO_CATEGORIES,
  COMMERCIAL_CARDIO_CATEGORY_HEADING,
  COMMERCIAL_CARDIO_CATEGORY_LEAD,
  COMMERCIAL_CARDIO_CATEGORY_NOTE,
  COMMERCIAL_CARDIO_CATEGORY_SLUGS,
  COMMERCIAL_CARDIO_EQUIPMENT_PATH,
  COMMERCIAL_CARDIO_EXPLORE_HEADING,
  COMMERCIAL_CARDIO_EXPLORE_LEAD,
  COMMERCIAL_CARDIO_EXPLORE_LINKS,
  COMMERCIAL_CARDIO_EXPLORE_NOTE,
  COMMERCIAL_CARDIO_EYEBROW,
  COMMERCIAL_CARDIO_FAQ_INTRO,
  COMMERCIAL_CARDIO_FAQ_ITEMS,
  COMMERCIAL_CARDIO_FAQ_NOTE,
  COMMERCIAL_CARDIO_GUIDE_HEADING,
  COMMERCIAL_CARDIO_GUIDE_INTRO,
  COMMERCIAL_CARDIO_GUIDE_NOTE,
  COMMERCIAL_CARDIO_GUIDE_SECTIONS,
  COMMERCIAL_CARDIO_H1,
  COMMERCIAL_CARDIO_HERO_TRUST_ITEMS,
  COMMERCIAL_CARDIO_LEAD,
  COMMERCIAL_CARDIO_LISTINGS_CTA,
  COMMERCIAL_CARDIO_LISTINGS_HEADING,
  COMMERCIAL_CARDIO_LISTINGS_LEAD,
  COMMERCIAL_CARDIO_LISTINGS_NOTE,
  COMMERCIAL_CARDIO_META_DESCRIPTION,
  COMMERCIAL_CARDIO_META_TITLE,
  COMMERCIAL_CARDIO_MID_CTA_HEADING,
  COMMERCIAL_CARDIO_MID_CTA_LABEL,
  COMMERCIAL_CARDIO_MID_CTA_LEAD,
  COMMERCIAL_CARDIO_PRIMARY_CTA,
  COMMERCIAL_CARDIO_SECONDARY_CTA,
  COMMERCIAL_CARDIO_VALUATION_COPY,
  COMMERCIAL_CARDIO_VALUATION_EYEBROW,
  COMMERCIAL_CARDIO_VALUATION_HEADING,
  COMMERCIAL_CARDIO_VALUATION_STEPS,
  VALUATION_PATH,
  buildCommercialCardioEquipmentBreadcrumbSchema,
  buildCommercialCardioEquipmentCollectionSchema,
  buildCommercialCardioEquipmentFaqSchema,
  buildCommercialCardioEquipmentOpenGraph,
  buildCommercialCardioEquipmentWebPageSchema,
  buildCommercialCardioFeaturedBrands,
} from '../lib/commercialCardioEquipmentPage.js'
import './BuyUsedGymEquipmentPage.css'
import './CommercialGymEquipmentPage.css'

const LISTINGS_LIMIT = 8

const CARDIO_SLUG_SET = new Set(COMMERCIAL_CARDIO_CATEGORY_SLUGS)

function ValuationJourney() {
  return (
    <ol className="buy-page__valuation-preview" aria-hidden="true">
      {COMMERCIAL_CARDIO_VALUATION_STEPS.map((step) => (
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

function isCardioListing(row) {
  const slug = String(row?.category?.slug || '').trim()
  return slug ? CARDIO_SLUG_SET.has(slug) : false
}

export default function CommercialCardioEquipmentPage() {
  const openGraph = useMemo(() => buildCommercialCardioEquipmentOpenGraph(), [])
  const [listings, setListings] = useState([])
  const [listingsLoading, setListingsLoading] = useState(true)
  const [listingsError, setListingsError] = useState('')
  const [brands, setBrands] = useState([])

  usePageMeta({
    title: COMMERCIAL_CARDIO_META_TITLE,
    description: COMMERCIAL_CARDIO_META_DESCRIPTION,
    canonicalPath: COMMERCIAL_CARDIO_EQUIPMENT_PATH,
    robotsContent: 'index, follow, max-image-preview:large',
    openGraph,
  })

  const breadcrumbSchema = useMemo(() => buildCommercialCardioEquipmentBreadcrumbSchema(), [])
  const webPageSchema = useMemo(() => buildCommercialCardioEquipmentWebPageSchema(), [])
  const collectionSchema = useMemo(() => buildCommercialCardioEquipmentCollectionSchema(), [])
  const faqSchema = useMemo(() => buildCommercialCardioEquipmentFaqSchema(), [])

  useEffect(() => {
    let cancelled = false

    async function loadMarketplace() {
      setListingsLoading(true)
      setListingsError('')

      const categoriesResult = await fetchCategories()
      if (cancelled) return

      const categoryIds = (categoriesResult?.data || [])
        .filter((category) => CARDIO_SLUG_SET.has(category.slug))
        .map((category) => category.id)

      const [listingsResult, brandResult] = await Promise.all([
        fetchActiveListings({
          rating: 'full_commercial',
          categoryIds,
          sort: 'newest',
          limit: LISTINGS_LIMIT,
        }),
        fetchBrandDirectory(),
      ])

      if (cancelled) return

      // Categories can fail to resolve on older environments; filtering by the
      // joined category slug keeps the page cardio-only either way.
      const cardioOnly = (rows) => (categoryIds.length > 0 ? rows : rows.filter(isCardioListing))

      if (listingsResult.error) {
        setListingsError(listingsResult.error.message || 'Unable to load listings.')
        setListings([])
      } else {
        setListings(cardioOnly(Array.isArray(listingsResult.data) ? listingsResult.data : []))
      }

      setBrands(buildCommercialCardioFeaturedBrands(brandResult?.brands || []))
      setListingsLoading(false)
    }

    loadMarketplace()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <article className="buy-page commercial-page">
      <BreadcrumbSchema schema={breadcrumbSchema} />
      <WebPageSchema schema={webPageSchema} />
      <JsonLd data={collectionSchema} />
      <FaqPageSchema schema={faqSchema} />

      <header className="buy-page__hero commercial-page__hero" aria-labelledby="commercial-cardio-page-title">
        <div className="buy-page__visual-rail">
          <MarketingLandingHero
            titleId="commercial-cardio-page-title"
            eyebrow={COMMERCIAL_CARDIO_EYEBROW}
            title={COMMERCIAL_CARDIO_H1}
            description={COMMERCIAL_CARDIO_LEAD}
            primaryCta={COMMERCIAL_CARDIO_PRIMARY_CTA}
            secondaryCta={COMMERCIAL_CARDIO_SECONDARY_CTA}
            searchId="commercial-cardio-equipment-search"
            searchLabel="Search commercial cardio"
            trustItems={COMMERCIAL_CARDIO_HERO_TRUST_ITEMS}
          />
        </div>
      </header>

      <section
        className="commercial-page__listings-section"
        aria-labelledby="commercial-cardio-listings-heading"
      >
        <div className="buy-page__visual-rail">
          <div className="commercial-page__listings-header">
            <header className="buy-page__intro">
              <span className="buy-page__handwritten-note">{COMMERCIAL_CARDIO_LISTINGS_NOTE}</span>
              <h2 id="commercial-cardio-listings-heading" className="buy-page__h2">
                {COMMERCIAL_CARDIO_LISTINGS_HEADING}
              </h2>
              <p className="buy-page__intro-lead">{COMMERCIAL_CARDIO_LISTINGS_LEAD}</p>
            </header>
            <Link
              to={COMMERCIAL_CARDIO_BROWSE_PATH}
              className="buy-page__btn buy-page__btn--secondary"
            >
              {COMMERCIAL_CARDIO_LISTINGS_CTA}
            </Link>
          </div>

          {listingsLoading && listings.length === 0 ? (
            <LoadingState compact>Loading commercial cardio listings…</LoadingState>
          ) : null}

          {!listingsLoading && listingsError && listings.length === 0 ? (
            <ErrorState compact>{listingsError}</ErrorState>
          ) : null}

          {!listingsLoading && !listingsError && listings.length === 0 ? (
            <EmptyState compact>
              <p className="commercial-page__listings-empty">
                No commercial cardio listings are live right now. Browse all commercial equipment or
                check back soon.
              </p>
            </EmptyState>
          ) : null}

          {listings.length > 0 ? (
            <div className="commercial-page__listing-grid">
              {listings.map((listing) => (
                <ListingCard key={listing.id} listing={listing} variant="home" showNewBadge />
              ))}
            </div>
          ) : null}

          {listings.length > 0 ? (
            <div className="commercial-page__listings-footer">
              <Link
                to={COMMERCIAL_CARDIO_BROWSE_PATH}
                className="buy-page__btn buy-page__btn--primary"
              >
                {COMMERCIAL_CARDIO_LISTINGS_CTA}
              </Link>
            </div>
          ) : null}
        </div>
      </section>

      <section
        className="commercial-page__categories-section"
        aria-labelledby="commercial-cardio-categories-heading"
      >
        <div className="buy-page__visual-rail">
          <header className="buy-page__intro">
            <span className="buy-page__handwritten-note">{COMMERCIAL_CARDIO_CATEGORY_NOTE}</span>
            <h2 id="commercial-cardio-categories-heading" className="buy-page__h2">
              {COMMERCIAL_CARDIO_CATEGORY_HEADING}
            </h2>
            <p className="buy-page__intro-lead">{COMMERCIAL_CARDIO_CATEGORY_LEAD}</p>
          </header>
          <ul className="commercial-page__category-grid">
            {COMMERCIAL_CARDIO_CATEGORIES.map((category) => (
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
        aria-labelledby="commercial-cardio-brands-heading"
      >
        <div className="buy-page__visual-rail">
          <header className="buy-page__intro">
            <span className="buy-page__handwritten-note">{COMMERCIAL_CARDIO_BRAND_NOTE}</span>
            <h2 id="commercial-cardio-brands-heading" className="buy-page__h2">
              {COMMERCIAL_CARDIO_BRAND_HEADING}
            </h2>
            <p className="buy-page__intro-lead">{COMMERCIAL_CARDIO_BRAND_LEAD}</p>
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
        aria-labelledby="commercial-cardio-benefits-heading"
      >
        <div className="buy-page__visual-rail">
          <h2 id="commercial-cardio-benefits-heading" className="buy-page__h2">
            {COMMERCIAL_CARDIO_BENEFITS_HEADING}
          </h2>
          <ul className="buy-page__benefits">
            {COMMERCIAL_CARDIO_BENEFITS.map((item, index) => (
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

      <section className="buy-page__optional" aria-labelledby="commercial-cardio-valuation-heading">
        <div className="buy-page__reading-rail buy-page__reading-rail--optional">
          <div className="buy-page__optional-panel">
            <div>
              <p className="buy-page__eyebrow">{COMMERCIAL_CARDIO_VALUATION_EYEBROW}</p>
              <h2
                id="commercial-cardio-valuation-heading"
                className="buy-page__h2 buy-page__h2--optional"
              >
                {COMMERCIAL_CARDIO_VALUATION_HEADING}
              </h2>
              <p className="buy-page__optional-copy">{COMMERCIAL_CARDIO_VALUATION_COPY}</p>
              <div className="buy-page__optional-actions buy-page__optional-actions--row">
                <Link to={VALUATION_PATH} className="buy-page__btn buy-page__btn--primary">
                  Get a Free Valuation
                </Link>
                <Link
                  to={COMMERCIAL_CARDIO_BROWSE_PATH}
                  className="buy-page__btn buy-page__btn--secondary"
                >
                  Browse Commercial Cardio
                </Link>
              </div>
            </div>
            <ValuationJourney />
          </div>
        </div>
      </section>

      <section className="buy-page__seo" aria-labelledby="commercial-cardio-guide-heading">
        <div className="buy-page__visual-rail buy-page__seo-layout">
          <div className="buy-page__guide-intro">
            <span className="buy-page__handwritten-note">{COMMERCIAL_CARDIO_GUIDE_NOTE}</span>
            <h2 id="commercial-cardio-guide-heading" className="buy-page__h2 buy-page__h2--guide">
              {COMMERCIAL_CARDIO_GUIDE_HEADING}
            </h2>
            <p className="buy-page__guide-lede">{COMMERCIAL_CARDIO_GUIDE_INTRO}</p>
            <div className="commercial-page__guide-sections">
              {COMMERCIAL_CARDIO_GUIDE_SECTIONS.map((section) => (
                <section
                  key={section.id}
                  className="commercial-page__guide-block"
                  aria-labelledby={`commercial-cardio-guide-${section.id}`}
                >
                  <h3
                    id={`commercial-cardio-guide-${section.id}`}
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

          <div className="buy-page__faq-column" aria-labelledby="commercial-cardio-faq-heading">
            <span className="buy-page__handwritten-note">{COMMERCIAL_CARDIO_FAQ_NOTE}</span>
            <h2 id="commercial-cardio-faq-heading" className="buy-page__h2 buy-page__h2--faq">
              Frequently asked questions
            </h2>
            <p className="buy-page__faq-lede">{COMMERCIAL_CARDIO_FAQ_INTRO}</p>
            <div className="buy-page__faq-list">
              {COMMERCIAL_CARDIO_FAQ_ITEMS.map((item) => (
                <FaqItem key={item.question} question={item.question} answer={item.answer} />
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="buy-page__mid-cta" aria-labelledby="commercial-cardio-mid-cta-heading">
        <div className="buy-page__reading-rail buy-page__reading-rail--mid-cta">
          <h2 id="commercial-cardio-mid-cta-heading" className="buy-page__mid-cta-title">
            {COMMERCIAL_CARDIO_MID_CTA_HEADING}
          </h2>
          <p className="buy-page__mid-cta-lead">{COMMERCIAL_CARDIO_MID_CTA_LEAD}</p>
          <Link
            to={COMMERCIAL_CARDIO_BROWSE_PATH}
            className="buy-page__btn buy-page__btn--primary buy-page__btn--primary-lg"
          >
            {COMMERCIAL_CARDIO_MID_CTA_LABEL}
          </Link>
        </div>
      </section>

      <section
        className="commercial-page__explore-section"
        aria-labelledby="commercial-cardio-explore-heading"
      >
        <div className="buy-page__visual-rail">
          <header className="buy-page__intro">
            <span className="buy-page__handwritten-note">{COMMERCIAL_CARDIO_EXPLORE_NOTE}</span>
            <h2 id="commercial-cardio-explore-heading" className="buy-page__h2">
              {COMMERCIAL_CARDIO_EXPLORE_HEADING}
            </h2>
            <p className="buy-page__intro-lead">{COMMERCIAL_CARDIO_EXPLORE_LEAD}</p>
          </header>
          <ul className="commercial-page__explore-grid">
            {COMMERCIAL_CARDIO_EXPLORE_LINKS.map((link) => (
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
