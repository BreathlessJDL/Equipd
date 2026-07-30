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
  HOME_BENEFITS,
  HOME_BENEFITS_HEADING,
  HOME_BRAND_HEADING,
  HOME_BRAND_LEAD,
  HOME_BRAND_NOTE,
  HOME_BROWSE_PATH,
  HOME_CATEGORIES,
  HOME_CATEGORY_HEADING,
  HOME_CATEGORY_LEAD,
  HOME_CATEGORY_NOTE,
  HOME_EXPLORE_HEADING,
  HOME_EXPLORE_LEAD,
  HOME_EXPLORE_LINKS,
  HOME_EXPLORE_NOTE,
  HOME_FAQ_INTRO,
  HOME_FAQ_ITEMS,
  HOME_FAQ_NOTE,
  HOME_GUIDE_HEADING,
  HOME_GUIDE_INTRO,
  HOME_GUIDE_NOTE,
  HOME_GUIDE_SECTIONS,
  HOME_GYM_EQUIPMENT_EYEBROW,
  HOME_GYM_EQUIPMENT_H1,
  HOME_GYM_EQUIPMENT_LEAD,
  HOME_GYM_EQUIPMENT_META_DESCRIPTION,
  HOME_GYM_EQUIPMENT_META_TITLE,
  HOME_GYM_EQUIPMENT_PATH,
  HOME_HERO_TRUST_ITEMS,
  HOME_LISTINGS_CTA,
  HOME_LISTINGS_HEADING,
  HOME_LISTINGS_LEAD,
  HOME_LISTINGS_NOTE,
  HOME_MID_CTA_HEADING,
  HOME_MID_CTA_LABEL,
  HOME_MID_CTA_LEAD,
  HOME_PRIMARY_CTA,
  HOME_SECONDARY_CTA,
  HOME_VALUATION_COPY,
  HOME_VALUATION_EYEBROW,
  HOME_VALUATION_HEADING,
  HOME_VALUATION_STEPS,
  VALUATION_PATH,
  buildHomeFeaturedBrands,
  buildHomeGymEquipmentBreadcrumbSchema,
  buildHomeGymEquipmentCollectionSchema,
  buildHomeGymEquipmentFaqSchema,
  buildHomeGymEquipmentOpenGraph,
  buildHomeGymEquipmentWebPageSchema,
} from '../lib/homeGymEquipmentPage.js'
import './BuyUsedGymEquipmentPage.css'
import './CommercialGymEquipmentPage.css'

const LISTINGS_LIMIT = 8

function ValuationJourney() {
  return (
    <ol className="buy-page__valuation-preview" aria-hidden="true">
      {HOME_VALUATION_STEPS.map((step) => (
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

export default function HomeGymEquipmentPage() {
  const openGraph = useMemo(() => buildHomeGymEquipmentOpenGraph(), [])
  const [listings, setListings] = useState([])
  const [listingsLoading, setListingsLoading] = useState(true)
  const [listingsError, setListingsError] = useState('')
  const [brands, setBrands] = useState([])

  usePageMeta({
    title: HOME_GYM_EQUIPMENT_META_TITLE,
    description: HOME_GYM_EQUIPMENT_META_DESCRIPTION,
    canonicalPath: HOME_GYM_EQUIPMENT_PATH,
    robotsContent: 'index, follow, max-image-preview:large',
    openGraph,
  })

  const breadcrumbSchema = useMemo(() => buildHomeGymEquipmentBreadcrumbSchema(), [])
  const webPageSchema = useMemo(() => buildHomeGymEquipmentWebPageSchema(), [])
  const collectionSchema = useMemo(() => buildHomeGymEquipmentCollectionSchema(), [])
  const faqSchema = useMemo(() => buildHomeGymEquipmentFaqSchema(), [])

  useEffect(() => {
    let cancelled = false

    async function loadMarketplace() {
      setListingsLoading(true)
      setListingsError('')

      const [listingsResult, brandResult] = await Promise.all([
        fetchActiveListings({
          rating: 'home_use',
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

      setBrands(buildHomeFeaturedBrands(brandResult?.brands || []))
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

      <header className="buy-page__hero commercial-page__hero" aria-labelledby="home-page-title">
        <div className="buy-page__visual-rail">
          <MarketingLandingHero
            titleId="home-page-title"
            eyebrow={HOME_GYM_EQUIPMENT_EYEBROW}
            title={HOME_GYM_EQUIPMENT_H1}
            description={HOME_GYM_EQUIPMENT_LEAD}
            primaryCta={HOME_PRIMARY_CTA}
            secondaryCta={HOME_SECONDARY_CTA}
            searchId="home-equipment-search"
            searchLabel="Search home gym equipment"
            trustItems={HOME_HERO_TRUST_ITEMS}
          />
        </div>
      </header>

      <section
        className="commercial-page__listings-section"
        aria-labelledby="home-listings-heading"
      >
        <div className="buy-page__visual-rail">
          <div className="commercial-page__listings-header">
            <header className="buy-page__intro">
              <span className="buy-page__handwritten-note">{HOME_LISTINGS_NOTE}</span>
              <h2 id="home-listings-heading" className="buy-page__h2">
                {HOME_LISTINGS_HEADING}
              </h2>
              <p className="buy-page__intro-lead">{HOME_LISTINGS_LEAD}</p>
            </header>
            <Link to={HOME_BROWSE_PATH} className="buy-page__btn buy-page__btn--secondary">
              {HOME_LISTINGS_CTA}
            </Link>
          </div>

          {listingsLoading && listings.length === 0 ? (
            <LoadingState compact>Loading home listings…</LoadingState>
          ) : null}

          {!listingsLoading && listingsError && listings.length === 0 ? (
            <ErrorState compact>{listingsError}</ErrorState>
          ) : null}

          {!listingsLoading && !listingsError && listings.length === 0 ? (
            <EmptyState compact>
              <p className="commercial-page__listings-empty">
                No home-use listings are live right now. Browse all equipment or check back soon.
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
                to={HOME_BROWSE_PATH}
                className="buy-page__btn buy-page__btn--primary"
              >
                {HOME_LISTINGS_CTA}
              </Link>
            </div>
          ) : null}
        </div>
      </section>

      <section
        className="commercial-page__categories-section"
        aria-labelledby="home-categories-heading"
      >
        <div className="buy-page__visual-rail">
          <header className="buy-page__intro">
            <span className="buy-page__handwritten-note">{HOME_CATEGORY_NOTE}</span>
            <h2 id="home-categories-heading" className="buy-page__h2">
              {HOME_CATEGORY_HEADING}
            </h2>
            <p className="buy-page__intro-lead">{HOME_CATEGORY_LEAD}</p>
          </header>
          <ul className="commercial-page__category-grid">
            {HOME_CATEGORIES.map((category) => (
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

      <section className="commercial-page__brands-section" aria-labelledby="home-brands-heading">
        <div className="buy-page__visual-rail">
          <header className="buy-page__intro">
            <span className="buy-page__handwritten-note">{HOME_BRAND_NOTE}</span>
            <h2 id="home-brands-heading" className="buy-page__h2">
              {HOME_BRAND_HEADING}
            </h2>
            <p className="buy-page__intro-lead">{HOME_BRAND_LEAD}</p>
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

      <section className="buy-page__benefits-section" aria-labelledby="home-benefits-heading">
        <div className="buy-page__visual-rail">
          <h2 id="home-benefits-heading" className="buy-page__h2">
            {HOME_BENEFITS_HEADING}
          </h2>
          <ul className="buy-page__benefits">
            {HOME_BENEFITS.map((item, index) => (
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

      <section className="buy-page__optional" aria-labelledby="home-valuation-heading">
        <div className="buy-page__reading-rail buy-page__reading-rail--optional">
          <div className="buy-page__optional-panel">
            <div>
              <p className="buy-page__eyebrow">{HOME_VALUATION_EYEBROW}</p>
              <h2 id="home-valuation-heading" className="buy-page__h2 buy-page__h2--optional">
                {HOME_VALUATION_HEADING}
              </h2>
              <p className="buy-page__optional-copy">{HOME_VALUATION_COPY}</p>
              <div className="buy-page__optional-actions buy-page__optional-actions--row">
                <Link to={VALUATION_PATH} className="buy-page__btn buy-page__btn--primary">
                  Get a Free Valuation
                </Link>
                <Link to={HOME_BROWSE_PATH} className="buy-page__btn buy-page__btn--secondary">
                  Browse Home Equipment
                </Link>
              </div>
            </div>
            <ValuationJourney />
          </div>
        </div>
      </section>

      <section className="buy-page__seo" aria-labelledby="home-guide-heading">
        <div className="buy-page__visual-rail buy-page__seo-layout">
          <div className="buy-page__guide-intro">
            <span className="buy-page__handwritten-note">{HOME_GUIDE_NOTE}</span>
            <h2 id="home-guide-heading" className="buy-page__h2 buy-page__h2--guide">
              {HOME_GUIDE_HEADING}
            </h2>
            <p className="buy-page__guide-lede">{HOME_GUIDE_INTRO}</p>
            <div className="commercial-page__guide-sections">
              {HOME_GUIDE_SECTIONS.map((section) => (
                <section
                  key={section.id}
                  className="commercial-page__guide-block"
                  aria-labelledby={`home-guide-${section.id}`}
                >
                  <h3 id={`home-guide-${section.id}`} className="commercial-page__guide-block-title">
                    {section.heading}
                  </h3>
                  {section.paragraphs.map((text) => (
                    <p key={text.slice(0, 48)}>{text}</p>
                  ))}
                </section>
              ))}
            </div>
          </div>

          <div className="buy-page__faq-column" aria-labelledby="home-faq-heading">
            <span className="buy-page__handwritten-note">{HOME_FAQ_NOTE}</span>
            <h2 id="home-faq-heading" className="buy-page__h2 buy-page__h2--faq">
              Frequently asked questions
            </h2>
            <p className="buy-page__faq-lede">{HOME_FAQ_INTRO}</p>
            <div className="buy-page__faq-list">
              {HOME_FAQ_ITEMS.map((item) => (
                <FaqItem key={item.question} question={item.question} answer={item.answer} />
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="buy-page__mid-cta" aria-labelledby="home-mid-cta-heading">
        <div className="buy-page__reading-rail buy-page__reading-rail--mid-cta">
          <h2 id="home-mid-cta-heading" className="buy-page__mid-cta-title">
            {HOME_MID_CTA_HEADING}
          </h2>
          <p className="buy-page__mid-cta-lead">{HOME_MID_CTA_LEAD}</p>
          <Link
            to={HOME_BROWSE_PATH}
            className="buy-page__btn buy-page__btn--primary buy-page__btn--primary-lg"
          >
            {HOME_MID_CTA_LABEL}
          </Link>
        </div>
      </section>

      <section
        className="commercial-page__explore-section"
        aria-labelledby="home-explore-heading"
      >
        <div className="buy-page__visual-rail">
          <header className="buy-page__intro">
            <span className="buy-page__handwritten-note">{HOME_EXPLORE_NOTE}</span>
            <h2 id="home-explore-heading" className="buy-page__h2">
              {HOME_EXPLORE_HEADING}
            </h2>
            <p className="buy-page__intro-lead">{HOME_EXPLORE_LEAD}</p>
          </header>
          <ul className="commercial-page__explore-grid">
            {HOME_EXPLORE_LINKS.map((link) => (
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
