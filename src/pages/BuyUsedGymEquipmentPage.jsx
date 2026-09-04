import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import BrandLogo from '../components/BrandLogo'
import ListingCard from '../components/ListingCard'
import JsonLd from '../components/JsonLd'
import BreadcrumbSchema from '../components/seo/BreadcrumbSchema'
import FaqPageSchema from '../components/seo/FaqPageSchema'
import WebPageSchema from '../components/seo/WebPageSchema'
import { EmptyState, ErrorState, LoadingState } from '../components/ui/UiState'
import { useWantedRequest } from '../components/wanted/useWantedRequest'
import { usePageMeta } from '../hooks/usePageMeta'
import { fetchBrandDirectory } from '../lib/brandCatalogue'
import { buildFeaturedBrands } from '../lib/categoryLandingSeo'
import { fetchActiveListings } from '../lib/listings'
import { WANTED_REQUEST_SOURCES } from '../lib/wantedRequestConstants'
import {
  BUY_BENEFITS,
  BUY_BENEFITS_HEADING,
  BUY_BRAND_HEADING,
  BUY_BRAND_LEAD,
  BUY_BRAND_NOTE,
  BUY_CONTEXT_HEADING,
  BUY_CONTEXT_HUBS,
  BUY_CONTEXT_LEAD,
  BUY_CONTEXT_NOTE,
  BUY_EQUIPMENT_TYPE_HEADING,
  BUY_EQUIPMENT_TYPE_LEAD,
  BUY_EQUIPMENT_TYPE_NOTE,
  BUY_EQUIPMENT_TYPES,
  BUY_FAQ_INTRO,
  BUY_FAQ_ITEMS,
  BUY_FAQ_NOTE,
  BUY_FEATURED_BRAND_SLUGS,
  BUY_GUIDE_BRAND_LINKS,
  BUY_GUIDE_HEADING,
  BUY_GUIDE_HIGHLIGHTS,
  BUY_GUIDE_INTRO,
  BUY_GUIDE_LINKS,
  BUY_GUIDE_NOTE,
  BUY_GUIDE_PARAGRAPHS,
  BUY_HERO_ARTWORK,
  BUY_HERO_PRIMARY_CTA,
  BUY_HERO_SECONDARY_CTA_LABEL,
  BUY_HERO_TRUST_ITEMS,
  BUY_JOURNEY_HEADING,
  BUY_JOURNEY_LEAD,
  BUY_JOURNEY_STEPS,
  BUY_LISTINGS_CTA,
  BUY_LISTINGS_EMPTY,
  BUY_LISTINGS_HEADING,
  BUY_LISTINGS_LEAD,
  BUY_LISTINGS_LIMIT,
  BUY_LISTINGS_LOADING_LABEL,
  BUY_LISTINGS_NOTE,
  BUY_USED_GYM_EQUIPMENT_EYEBROW,
  BUY_USED_GYM_EQUIPMENT_H1,
  BUY_USED_GYM_EQUIPMENT_LEAD,
  BUY_USED_GYM_EQUIPMENT_META_DESCRIPTION,
  BUY_USED_GYM_EQUIPMENT_META_TITLE,
  BUY_USED_GYM_EQUIPMENT_PATH,
  BUY_VALUATION_COPY,
  BUY_VALUATION_EYEBROW,
  BUY_VALUATION_HEADING,
  BUY_VALUATION_STEPS,
  BUY_WANTED_CTA_LABEL,
  BUY_WANTED_HEADING,
  BUY_WANTED_LEAD,
  BUY_WANTED_NOTE,
  BROWSE_PATH,
  buildBuyUsedGymEquipmentBreadcrumbSchema,
  buildBuyUsedGymEquipmentCollectionSchema,
  buildBuyUsedGymEquipmentFaqSchema,
  buildBuyUsedGymEquipmentOpenGraph,
  buildBuyUsedGymEquipmentWebPageSchema,
  VALUATION_PATH,
} from '../lib/buyUsedGymEquipmentPage.js'
import './BuyUsedGymEquipmentPage.css'
import './CommercialGymEquipmentPage.css'
import '../components/ListingCard.css'

function TrustLine() {
  return (
    <ul className="buy-page__trust" aria-label="Buying benefits">
      {BUY_HERO_TRUST_ITEMS.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  )
}

function useMinWidth(minWidthPx) {
  const query = `(min-width: ${minWidthPx}px)`
  const [matches, setMatches] = useState(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false
    return window.matchMedia(query).matches
  })

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined
    const media = window.matchMedia(query)
    const onChange = () => setMatches(media.matches)
    onChange()
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [query])

  return matches
}

function HeroArtwork() {
  return (
    <div className="buy-page__hero-artwork">
      <picture>
        <source srcSet={BUY_HERO_ARTWORK.src} type="image/webp" />
        <img
          src={BUY_HERO_ARTWORK.srcPng}
          alt={BUY_HERO_ARTWORK.alt}
          className="buy-page__hero-artwork-image"
          width={BUY_HERO_ARTWORK.width}
          height={BUY_HERO_ARTWORK.height}
          decoding="async"
          fetchPriority="high"
        />
      </picture>
    </div>
  )
}

function BuyJourneyStep({
  step,
  title,
  description,
  imageSrc,
  imageSrcPng,
  imageSrcMobile,
  imageSrcMobilePng,
  imageWidth,
  imageHeight,
  imageAlt,
  isLast,
}) {
  return (
    <li className={`buy-page__step${isLast ? ' buy-page__step--last' : ''}`}>
      <div className="buy-page__step-marker">
        <span className="buy-page__step-number" aria-hidden="true">
          {step}
        </span>
      </div>
      <h3 className="buy-page__step-title">{title}</h3>
      <div className="buy-page__step-frame">
        <picture>
          <source
            media="(max-width: 767px)"
            type="image/webp"
            srcSet={imageSrcMobile}
          />
          <source
            media="(max-width: 767px)"
            type="image/png"
            srcSet={imageSrcMobilePng}
          />
          <source
            media="(min-width: 768px)"
            type="image/png"
            srcSet={imageSrcPng || imageSrc}
          />
          <source
            media="(min-width: 768px)"
            type="image/webp"
            srcSet={imageSrc}
          />
          <img
            src={imageSrcPng || imageSrc}
            alt={imageAlt}
            className="buy-page__step-image"
            width={imageWidth || 1536}
            height={imageHeight || 1024}
            loading="lazy"
            decoding="async"
          />
        </picture>
      </div>
      <p className="buy-page__step-copy">{description}</p>
    </li>
  )
}

function ValuationJourney() {
  return (
    <ol className="buy-page__valuation-preview" aria-hidden="true">
      {BUY_VALUATION_STEPS.map((step) => (
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

function GuideInlineLink({ to, children }) {
  return (
    <Link to={to} className="buy-page__guide-link">
      {children}
    </Link>
  )
}

function BuyFaqItem({ question, answer }) {
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

function BuyWantedSection() {
  const { openWantedRequest } = useWantedRequest()

  return (
    <section className="buy-page__wanted-section" aria-labelledby="buy-wanted-heading">
      <div className="buy-page__reading-rail buy-page__reading-rail--wanted">
        <span className="buy-page__handwritten-note">{BUY_WANTED_NOTE}</span>
        <h2 id="buy-wanted-heading" className="buy-page__h2">
          {BUY_WANTED_HEADING}
        </h2>
        <p className="buy-page__wanted-lead">{BUY_WANTED_LEAD}</p>
        <button
          type="button"
          className="buy-page__btn buy-page__btn--primary"
          onClick={(event) =>
            openWantedRequest({
              source: WANTED_REQUEST_SOURCES.BUY_PAGE,
              preferredEntryMode: 'catalogue',
              triggerElement: event.currentTarget,
            })
          }
        >
          {BUY_WANTED_CTA_LABEL}
        </button>
      </div>
    </section>
  )
}

function BuySeoSection() {
  return (
    <section className="buy-page__seo" aria-labelledby="buy-guide-heading">
      <div className="buy-page__visual-rail buy-page__seo-layout">
        <div className="buy-page__guide-intro">
          <span className="buy-page__handwritten-note">{BUY_GUIDE_NOTE}</span>
          <h2 id="buy-guide-heading" className="buy-page__h2 buy-page__h2--guide">
            {BUY_GUIDE_HEADING}
          </h2>
          <p className="buy-page__guide-lede">{BUY_GUIDE_INTRO}</p>
          <ul className="buy-page__guide-highlights">
            {BUY_GUIDE_HIGHLIGHTS.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          {BUY_GUIDE_PARAGRAPHS.map((paragraph) => (
            <p key={paragraph.id} className="buy-page__guide-copy">
              {paragraph.text}
            </p>
          ))}
          <ul className="buy-page__guide-list">
            {BUY_GUIDE_LINKS.map((item) => (
              <li key={`${item.link.to}:${item.link.label}`}>
                {item.before}
                <GuideInlineLink to={item.link.to}>{item.link.label}</GuideInlineLink>
                {item.after}
              </li>
            ))}
          </ul>
          <p className="buy-page__guide-brands">
            {BUY_GUIDE_BRAND_LINKS.map((brand, index) => (
              <span key={brand.to}>
                {index > 0 ? <span aria-hidden="true"> · </span> : null}
                <GuideInlineLink to={brand.to}>{brand.label}</GuideInlineLink>
              </span>
            ))}
          </p>
        </div>

        <div className="buy-page__faq-column" aria-labelledby="buy-faq-heading">
          <span className="buy-page__handwritten-note">{BUY_FAQ_NOTE}</span>
          <h2 id="buy-faq-heading" className="buy-page__h2 buy-page__h2--faq">
            Frequently asked questions
          </h2>
          <p className="buy-page__faq-lede">{BUY_FAQ_INTRO}</p>
          <div className="buy-page__faq-list">
            {BUY_FAQ_ITEMS.map((item) => (
              <BuyFaqItem key={item.question} question={item.question} answer={item.answer} />
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

export default function BuyUsedGymEquipmentPage() {
  const openGraph = useMemo(() => buildBuyUsedGymEquipmentOpenGraph(), [])
  const showHeroArtwork = useMinWidth(768)
  const { openWantedRequest } = useWantedRequest()
  const [listings, setListings] = useState([])
  const [listingsLoading, setListingsLoading] = useState(true)
  const [listingsError, setListingsError] = useState('')
  const [brands, setBrands] = useState(() => buildFeaturedBrands([...BUY_FEATURED_BRAND_SLUGS], []))

  usePageMeta({
    title: BUY_USED_GYM_EQUIPMENT_META_TITLE,
    description: BUY_USED_GYM_EQUIPMENT_META_DESCRIPTION,
    canonicalPath: BUY_USED_GYM_EQUIPMENT_PATH,
    robotsContent: 'index, follow, max-image-preview:large',
    openGraph,
  })

  const breadcrumbSchema = useMemo(() => buildBuyUsedGymEquipmentBreadcrumbSchema(), [])
  const webPageSchema = useMemo(() => buildBuyUsedGymEquipmentWebPageSchema(), [])
  const collectionSchema = useMemo(
    () => buildBuyUsedGymEquipmentCollectionSchema(listings),
    [listings],
  )
  const faqSchema = useMemo(() => buildBuyUsedGymEquipmentFaqSchema(), [])

  useEffect(() => {
    let cancelled = false

    async function loadMarketplace() {
      setListingsLoading(true)
      setListingsError('')

      const [listingsResult, brandResult] = await Promise.all([
        fetchActiveListings({
          sort: 'newest',
          limit: BUY_LISTINGS_LIMIT,
        }),
        fetchBrandDirectory(),
      ])

      if (cancelled) return

      if (listingsResult.error) {
        setListingsError(listingsResult.error.message || 'Unable to load listings.')
        setListings([])
      } else {
        const rows = Array.isArray(listingsResult.data) ? listingsResult.data : []
        setListings(rows.slice(0, BUY_LISTINGS_LIMIT))
      }

      setBrands(buildFeaturedBrands([...BUY_FEATURED_BRAND_SLUGS], brandResult?.brands || []))
      setListingsLoading(false)
    }

    loadMarketplace()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <article className="buy-page commercial-page buy-page--marketplace-hub">
      <BreadcrumbSchema schema={breadcrumbSchema} />
      <WebPageSchema schema={webPageSchema} />
      <JsonLd data={collectionSchema} />
      <FaqPageSchema schema={faqSchema} />

      <header className="buy-page__hero" aria-labelledby="buy-page-title">
        <div className="buy-page__visual-rail">
          <div className="buy-page__hero-grid">
            <div className="buy-page__hero-copy">
              <span className="buy-page__hero-eyebrow" aria-hidden="true">
                {BUY_USED_GYM_EQUIPMENT_EYEBROW}
              </span>
              <h1 id="buy-page-title" className="buy-page__h1">
                {BUY_USED_GYM_EQUIPMENT_H1}
              </h1>
              <p className="buy-page__lead">{BUY_USED_GYM_EQUIPMENT_LEAD}</p>
              <div className="buy-page__actions">
                <Link to={BUY_HERO_PRIMARY_CTA.to} className="buy-page__btn buy-page__btn--primary">
                  {BUY_HERO_PRIMARY_CTA.label}
                </Link>
                <button
                  type="button"
                  className="buy-page__btn buy-page__btn--secondary"
                  onClick={(event) =>
                    openWantedRequest({
                      source: WANTED_REQUEST_SOURCES.BUY_PAGE,
                      preferredEntryMode: 'catalogue',
                      triggerElement: event.currentTarget,
                    })
                  }
                >
                  {BUY_HERO_SECONDARY_CTA_LABEL}
                </button>
              </div>
              <TrustLine />
            </div>
            {showHeroArtwork ? (
              <div className="buy-page__hero-visual">
                <HeroArtwork />
              </div>
            ) : null}
          </div>
        </div>
      </header>

      <section
        className="commercial-page__listings-section"
        aria-labelledby="buy-listings-heading"
      >
        <div className="buy-page__visual-rail">
          <div className="commercial-page__listings-header">
            <header className="buy-page__intro">
              <span className="buy-page__handwritten-note">{BUY_LISTINGS_NOTE}</span>
              <h2 id="buy-listings-heading" className="buy-page__h2">
                {BUY_LISTINGS_HEADING}
              </h2>
              <p className="buy-page__intro-lead">{BUY_LISTINGS_LEAD}</p>
            </header>
            <Link to={BROWSE_PATH} className="buy-page__btn buy-page__btn--secondary">
              {BUY_LISTINGS_CTA} →
            </Link>
          </div>

          {listingsLoading && listings.length === 0 ? (
            <LoadingState compact>{BUY_LISTINGS_LOADING_LABEL}</LoadingState>
          ) : null}

          {!listingsLoading && listingsError && listings.length === 0 ? (
            <ErrorState compact>{listingsError}</ErrorState>
          ) : null}

          {!listingsLoading && !listingsError && listings.length === 0 ? (
            <EmptyState compact>
              <p className="commercial-page__listings-empty">{BUY_LISTINGS_EMPTY}</p>
            </EmptyState>
          ) : null}

          {listings.length > 0 ? (
            <div className="listing-card-grid buy-page__listing-grid">
              {listings.map((listing, index) => (
                <ListingCard
                  key={listing.id}
                  listing={listing}
                  variant="home"
                  showNewBadge
                  imagePriority={index < 4}
                />
              ))}
            </div>
          ) : null}

          {listings.length > 0 ? (
            <div className="commercial-page__listings-footer">
              <Link to={BROWSE_PATH} className="buy-page__btn buy-page__btn--primary">
                {BUY_LISTINGS_CTA} →
              </Link>
            </div>
          ) : null}
        </div>
      </section>

      <section className="buy-page__journey-section" aria-labelledby="buy-journey-heading">
        <div className="buy-page__visual-rail">
          <header className="buy-page__intro">
            <h2 id="buy-journey-heading" className="buy-page__h2">
              {BUY_JOURNEY_HEADING}
            </h2>
            <p className="buy-page__intro-lead">{BUY_JOURNEY_LEAD}</p>
          </header>

          <ol className="buy-page__journey">
            {BUY_JOURNEY_STEPS.map((entry, index) => (
              <BuyJourneyStep
                key={entry.step}
                {...entry}
                isLast={index === BUY_JOURNEY_STEPS.length - 1}
              />
            ))}
          </ol>
        </div>
      </section>

      <section
        className="commercial-page__categories-section"
        aria-labelledby="buy-types-heading"
      >
        <div className="buy-page__visual-rail">
          <header className="buy-page__intro">
            <span className="buy-page__handwritten-note">{BUY_EQUIPMENT_TYPE_NOTE}</span>
            <h2 id="buy-types-heading" className="buy-page__h2">
              {BUY_EQUIPMENT_TYPE_HEADING}
            </h2>
            <p className="buy-page__intro-lead">{BUY_EQUIPMENT_TYPE_LEAD}</p>
          </header>
          <ul className="commercial-page__category-grid">
            {BUY_EQUIPMENT_TYPES.map((category) => (
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
        aria-labelledby="buy-brands-heading"
      >
        <div className="buy-page__visual-rail">
          <header className="buy-page__intro">
            <span className="buy-page__handwritten-note">{BUY_BRAND_NOTE}</span>
            <h2 id="buy-brands-heading" className="buy-page__h2">
              {BUY_BRAND_HEADING}
            </h2>
            <p className="buy-page__intro-lead">{BUY_BRAND_LEAD}</p>
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
        className="buy-page__context-section"
        aria-labelledby="buy-context-heading"
      >
        <div className="buy-page__visual-rail">
          <header className="buy-page__intro">
            <span className="buy-page__handwritten-note">{BUY_CONTEXT_NOTE}</span>
            <h2 id="buy-context-heading" className="buy-page__h2">
              {BUY_CONTEXT_HEADING}
            </h2>
            <p className="buy-page__intro-lead">{BUY_CONTEXT_LEAD}</p>
          </header>
          <ul className="buy-page__context-grid">
            {BUY_CONTEXT_HUBS.map((hub) => (
              <li key={hub.id} className="buy-page__context-card">
                <Link to={hub.to} className="buy-page__context-card-main">
                  <p className="buy-page__context-label">{hub.label}</p>
                  <p className="buy-page__context-copy">{hub.description}</p>
                  <span className="buy-page__context-cta">Explore →</span>
                </Link>
                <p className="buy-page__context-children">
                  {(hub.children || []).map((child, index) => (
                    <span key={child.to}>
                      {index > 0 ? <span aria-hidden="true"> · </span> : null}
                      <Link to={child.to}>{child.label}</Link>
                    </span>
                  ))}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <BuyWantedSection />

      <BuySeoSection />

      <section className="buy-page__benefits-section" aria-labelledby="buy-benefits-heading">
        <div className="buy-page__visual-rail">
          <h2 id="buy-benefits-heading" className="buy-page__h2">
            {BUY_BENEFITS_HEADING}
          </h2>
          <ul className="buy-page__benefits">
            {BUY_BENEFITS.map((item, index) => (
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

      <section className="buy-page__optional" aria-labelledby="buy-optional-heading">
        <div className="buy-page__reading-rail buy-page__reading-rail--optional">
          <div className="buy-page__optional-panel">
            <div>
              <p className="buy-page__eyebrow">{BUY_VALUATION_EYEBROW}</p>
              <h2 id="buy-optional-heading" className="buy-page__h2 buy-page__h2--optional">
                {BUY_VALUATION_HEADING}
              </h2>
              <p className="buy-page__optional-copy">{BUY_VALUATION_COPY}</p>
              <div className="buy-page__optional-actions buy-page__optional-actions--row">
                <Link to={VALUATION_PATH} className="buy-page__btn buy-page__btn--primary">
                  Get a Free Valuation
                </Link>
                <Link to={BROWSE_PATH} className="buy-page__btn buy-page__btn--secondary">
                  Browse Equipment
                </Link>
              </div>
            </div>
            <ValuationJourney />
          </div>
        </div>
      </section>
    </article>
  )
}
