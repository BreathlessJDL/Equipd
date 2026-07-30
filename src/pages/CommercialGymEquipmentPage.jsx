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
import { fetchActiveListings } from '../lib/listings'
import {
  COMMERCIAL_BENEFITS,
  COMMERCIAL_BENEFITS_HEADING,
  COMMERCIAL_BRAND_HEADING,
  COMMERCIAL_BRAND_LEAD,
  COMMERCIAL_BRAND_NOTE,
  COMMERCIAL_BROWSE_PATH,
  COMMERCIAL_CATEGORIES,
  COMMERCIAL_CATEGORY_HEADING,
  COMMERCIAL_CATEGORY_LEAD,
  COMMERCIAL_CATEGORY_NOTE,
  COMMERCIAL_EXPLORE_HEADING,
  COMMERCIAL_EXPLORE_LEAD,
  COMMERCIAL_EXPLORE_LINKS,
  COMMERCIAL_EXPLORE_NOTE,
  COMMERCIAL_FAQ_INTRO,
  COMMERCIAL_FAQ_ITEMS,
  COMMERCIAL_FAQ_NOTE,
  COMMERCIAL_GUIDE_HEADING,
  COMMERCIAL_GUIDE_INTRO,
  COMMERCIAL_GUIDE_NOTE,
  COMMERCIAL_GUIDE_SECTIONS,
  COMMERCIAL_GYM_EQUIPMENT_EYEBROW,
  COMMERCIAL_GYM_EQUIPMENT_H1,
  COMMERCIAL_GYM_EQUIPMENT_LEAD,
  COMMERCIAL_GYM_EQUIPMENT_META_DESCRIPTION,
  COMMERCIAL_GYM_EQUIPMENT_META_TITLE,
  COMMERCIAL_GYM_EQUIPMENT_PATH,
  COMMERCIAL_HERO_TRUST_ITEMS,
  COMMERCIAL_LISTINGS_CTA,
  COMMERCIAL_LISTINGS_HEADING,
  COMMERCIAL_LISTINGS_LEAD,
  COMMERCIAL_LISTINGS_NOTE,
  COMMERCIAL_MID_CTA_HEADING,
  COMMERCIAL_MID_CTA_LABEL,
  COMMERCIAL_MID_CTA_LEAD,
  COMMERCIAL_PRIMARY_CTA,
  COMMERCIAL_SECONDARY_CTA,
  COMMERCIAL_VALUATION_COPY,
  COMMERCIAL_VALUATION_EYEBROW,
  COMMERCIAL_VALUATION_HEADING,
  COMMERCIAL_VALUATION_STEPS,
  VALUATION_PATH,
  buildCommercialFeaturedBrands,
  buildCommercialGymEquipmentBreadcrumbSchema,
  buildCommercialGymEquipmentCollectionSchema,
  buildCommercialGymEquipmentFaqSchema,
  buildCommercialGymEquipmentOpenGraph,
  buildCommercialGymEquipmentWebPageSchema,
} from '../lib/commercialGymEquipmentPage.js'
import './BuyUsedGymEquipmentPage.css'
import './CommercialGymEquipmentPage.css'

const LISTINGS_LIMIT = 8

function ValuationJourney() {
  return (
    <ol className="buy-page__valuation-preview" aria-hidden="true">
      {COMMERCIAL_VALUATION_STEPS.map((step) => (
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

export default function CommercialGymEquipmentPage() {
  const openGraph = useMemo(() => buildCommercialGymEquipmentOpenGraph(), [])
  const [listings, setListings] = useState([])
  const [listingsLoading, setListingsLoading] = useState(true)
  const [listingsError, setListingsError] = useState('')
  const [brands, setBrands] = useState([])

  usePageMeta({
    title: COMMERCIAL_GYM_EQUIPMENT_META_TITLE,
    description: COMMERCIAL_GYM_EQUIPMENT_META_DESCRIPTION,
    canonicalPath: COMMERCIAL_GYM_EQUIPMENT_PATH,
    robotsContent: 'index, follow, max-image-preview:large',
    openGraph,
  })

  const breadcrumbSchema = useMemo(() => buildCommercialGymEquipmentBreadcrumbSchema(), [])
  const webPageSchema = useMemo(() => buildCommercialGymEquipmentWebPageSchema(), [])
  const collectionSchema = useMemo(() => buildCommercialGymEquipmentCollectionSchema(), [])
  const faqSchema = useMemo(() => buildCommercialGymEquipmentFaqSchema(), [])

  useEffect(() => {
    let cancelled = false

    async function loadMarketplace() {
      setListingsLoading(true)
      setListingsError('')

      const [listingsResult, brandResult] = await Promise.all([
        fetchActiveListings({
          rating: 'full_commercial',
          sort: 'newest',
          limit: LISTINGS_LIMIT,
        }),
        fetchBrandDirectory(),
      ])

      if (cancelled) return

      if (listingsResult.error) {
        setListingsError(listingsResult.error.message || 'Unable to load listings.')
        setListings([])
      } else {
        setListings(Array.isArray(listingsResult.data) ? listingsResult.data : [])
      }

      setBrands(buildCommercialFeaturedBrands(brandResult?.brands || []))
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

      <header className="buy-page__hero commercial-page__hero" aria-labelledby="commercial-page-title">
        <div className="buy-page__visual-rail">
          <MarketingLandingHero
            titleId="commercial-page-title"
            eyebrow={COMMERCIAL_GYM_EQUIPMENT_EYEBROW}
            title={COMMERCIAL_GYM_EQUIPMENT_H1}
            description={COMMERCIAL_GYM_EQUIPMENT_LEAD}
            primaryCta={COMMERCIAL_PRIMARY_CTA}
            secondaryCta={COMMERCIAL_SECONDARY_CTA}
            searchId="commercial-equipment-search"
            searchLabel="Search commercial equipment"
            trustItems={COMMERCIAL_HERO_TRUST_ITEMS}
          />
        </div>
      </header>

      <section
        className="commercial-page__listings-section"
        aria-labelledby="commercial-listings-heading"
      >
        <div className="buy-page__visual-rail">
          <div className="commercial-page__listings-header">
            <header className="buy-page__intro">
              <span className="buy-page__handwritten-note">{COMMERCIAL_LISTINGS_NOTE}</span>
              <h2 id="commercial-listings-heading" className="buy-page__h2">
                {COMMERCIAL_LISTINGS_HEADING}
              </h2>
              <p className="buy-page__intro-lead">{COMMERCIAL_LISTINGS_LEAD}</p>
            </header>
            <Link to={COMMERCIAL_BROWSE_PATH} className="buy-page__btn buy-page__btn--secondary">
              {COMMERCIAL_LISTINGS_CTA}
            </Link>
          </div>

          {listingsLoading && listings.length === 0 ? (
            <LoadingState compact>Loading commercial listings…</LoadingState>
          ) : null}

          {!listingsLoading && listingsError && listings.length === 0 ? (
            <ErrorState compact>{listingsError}</ErrorState>
          ) : null}

          {!listingsLoading && !listingsError && listings.length === 0 ? (
            <EmptyState compact>
              <p className="commercial-page__listings-empty">
                No full-commercial listings are live right now. Browse all equipment or check back soon.
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
              <Link
                to={COMMERCIAL_BROWSE_PATH}
                className="buy-page__btn buy-page__btn--primary"
              >
                {COMMERCIAL_LISTINGS_CTA}
              </Link>
            </div>
          ) : null}
        </div>
      </section>

      <section
        className="commercial-page__categories-section"
        aria-labelledby="commercial-categories-heading"
      >
        <div className="buy-page__visual-rail">
          <header className="buy-page__intro">
            <span className="buy-page__handwritten-note">{COMMERCIAL_CATEGORY_NOTE}</span>
            <h2 id="commercial-categories-heading" className="buy-page__h2">
              {COMMERCIAL_CATEGORY_HEADING}
            </h2>
            <p className="buy-page__intro-lead">{COMMERCIAL_CATEGORY_LEAD}</p>
          </header>
          <ul className="commercial-page__category-grid">
            {COMMERCIAL_CATEGORIES.map((category) => (
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

      <section className="commercial-page__brands-section" aria-labelledby="commercial-brands-heading">
        <div className="buy-page__visual-rail">
          <header className="buy-page__intro">
            <span className="buy-page__handwritten-note">{COMMERCIAL_BRAND_NOTE}</span>
            <h2 id="commercial-brands-heading" className="buy-page__h2">
              {COMMERCIAL_BRAND_HEADING}
            </h2>
            <p className="buy-page__intro-lead">{COMMERCIAL_BRAND_LEAD}</p>
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

      <section className="buy-page__benefits-section" aria-labelledby="commercial-benefits-heading">
        <div className="buy-page__visual-rail">
          <h2 id="commercial-benefits-heading" className="buy-page__h2">
            {COMMERCIAL_BENEFITS_HEADING}
          </h2>
          <ul className="buy-page__benefits">
            {COMMERCIAL_BENEFITS.map((item, index) => (
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

      <section className="buy-page__optional" aria-labelledby="commercial-valuation-heading">
        <div className="buy-page__reading-rail buy-page__reading-rail--optional">
          <div className="buy-page__optional-panel">
            <div>
              <p className="buy-page__eyebrow">{COMMERCIAL_VALUATION_EYEBROW}</p>
              <h2 id="commercial-valuation-heading" className="buy-page__h2 buy-page__h2--optional">
                {COMMERCIAL_VALUATION_HEADING}
              </h2>
              <p className="buy-page__optional-copy">{COMMERCIAL_VALUATION_COPY}</p>
              <div className="buy-page__optional-actions buy-page__optional-actions--row">
                <Link to={VALUATION_PATH} className="buy-page__btn buy-page__btn--primary">
                  Get a Free Valuation
                </Link>
                <Link to={COMMERCIAL_BROWSE_PATH} className="buy-page__btn buy-page__btn--secondary">
                  Browse Commercial Equipment
                </Link>
              </div>
            </div>
            <ValuationJourney />
          </div>
        </div>
      </section>

      <section className="buy-page__seo" aria-labelledby="commercial-guide-heading">
        <div className="buy-page__visual-rail buy-page__seo-layout">
          <div className="buy-page__guide-intro">
            <span className="buy-page__handwritten-note">{COMMERCIAL_GUIDE_NOTE}</span>
            <h2 id="commercial-guide-heading" className="buy-page__h2 buy-page__h2--guide">
              {COMMERCIAL_GUIDE_HEADING}
            </h2>
            <p className="buy-page__guide-lede">{COMMERCIAL_GUIDE_INTRO}</p>
            <div className="commercial-page__guide-sections">
              {COMMERCIAL_GUIDE_SECTIONS.map((section) => (
                <section
                  key={section.id}
                  className="commercial-page__guide-block"
                  aria-labelledby={`commercial-guide-${section.id}`}
                >
                  <h3 id={`commercial-guide-${section.id}`} className="commercial-page__guide-block-title">
                    {section.heading}
                  </h3>
                  {section.paragraphs.map((text) => (
                    <p key={text.slice(0, 48)}>{text}</p>
                  ))}
                </section>
              ))}
            </div>
          </div>

          <div className="buy-page__faq-column" aria-labelledby="commercial-faq-heading">
            <span className="buy-page__handwritten-note">{COMMERCIAL_FAQ_NOTE}</span>
            <h2 id="commercial-faq-heading" className="buy-page__h2 buy-page__h2--faq">
              Frequently asked questions
            </h2>
            <p className="buy-page__faq-lede">{COMMERCIAL_FAQ_INTRO}</p>
            <div className="buy-page__faq-list">
              {COMMERCIAL_FAQ_ITEMS.map((item) => (
                <FaqItem key={item.question} question={item.question} answer={item.answer} />
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="buy-page__mid-cta" aria-labelledby="commercial-mid-cta-heading">
        <div className="buy-page__reading-rail buy-page__reading-rail--mid-cta">
          <h2 id="commercial-mid-cta-heading" className="buy-page__mid-cta-title">
            {COMMERCIAL_MID_CTA_HEADING}
          </h2>
          <p className="buy-page__mid-cta-lead">{COMMERCIAL_MID_CTA_LEAD}</p>
          <Link
            to={COMMERCIAL_BROWSE_PATH}
            className="buy-page__btn buy-page__btn--primary buy-page__btn--primary-lg"
          >
            {COMMERCIAL_MID_CTA_LABEL}
          </Link>
        </div>
      </section>

      <section
        className="commercial-page__explore-section"
        aria-labelledby="commercial-explore-heading"
      >
        <div className="buy-page__visual-rail">
          <header className="buy-page__intro">
            <span className="buy-page__handwritten-note">{COMMERCIAL_EXPLORE_NOTE}</span>
            <h2 id="commercial-explore-heading" className="buy-page__h2">
              {COMMERCIAL_EXPLORE_HEADING}
            </h2>
            <p className="buy-page__intro-lead">{COMMERCIAL_EXPLORE_LEAD}</p>
          </header>
          <ul className="commercial-page__explore-grid">
            {COMMERCIAL_EXPLORE_LINKS.map((link) => (
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
