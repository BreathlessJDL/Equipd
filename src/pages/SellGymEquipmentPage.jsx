import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import ProtectedLink from '../components/auth/ProtectedLink'
import BreadcrumbSchema from '../components/seo/BreadcrumbSchema'
import FaqPageSchema from '../components/seo/FaqPageSchema'
import WebPageSchema from '../components/seo/WebPageSchema'
import { usePageMeta } from '../hooks/usePageMeta'
import {
  buildSellGymEquipmentBreadcrumbSchema,
  buildSellGymEquipmentFaqSchema,
  buildSellGymEquipmentOpenGraph,
  buildSellGymEquipmentWebPageSchema,
  CREATE_LISTING_PATH,
  SELL_BENEFITS,
  SELL_FAQ_INTRO,
  SELL_FAQ_ITEMS,
  SELL_FAQ_NOTE,
  SELL_GUIDE_HEADING,
  SELL_GUIDE_HIGHLIGHTS,
  SELL_GUIDE_INTRO,
  SELL_GUIDE_NOTE,
  SELL_GUIDE_SECTIONS,
  SELL_GYM_EQUIPMENT_H1,
  SELL_GYM_EQUIPMENT_LEAD,
  SELL_GYM_EQUIPMENT_META_DESCRIPTION,
  SELL_GYM_EQUIPMENT_META_TITLE,
  SELL_GYM_EQUIPMENT_PATH,
  SELL_HERO_ARTWORK,
  SELL_HERO_TRUST_ITEMS,
  SELL_JOURNEY_IMAGE_SIZES,
  SELL_JOURNEY_STEPS,
  VALUATION_PATH,
} from '../lib/sellGymEquipmentPage.js'
import './SellGymEquipmentPage.css'

function TrustLine() {
  return (
    <ul className="sell-page__trust" aria-label="Selling benefits">
      {SELL_HERO_TRUST_ITEMS.map((item) => (
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
    <div className="sell-page__hero-artwork">
      <picture>
        <source srcSet={SELL_HERO_ARTWORK.src} type="image/webp" />
        <img
          src={SELL_HERO_ARTWORK.srcPng}
          alt={SELL_HERO_ARTWORK.alt}
          className="sell-page__hero-artwork-image"
          width={SELL_HERO_ARTWORK.width}
          height={SELL_HERO_ARTWORK.height}
          decoding="async"
          fetchPriority="high"
        />
      </picture>
    </div>
  )
}

function SellJourneyStep({
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
    <li className={`sell-page__step${isLast ? ' sell-page__step--last' : ''}`}>
      <div className="sell-page__step-marker">
        <span className="sell-page__step-number" aria-hidden="true">
          {step}
        </span>
      </div>
      <h3 className="sell-page__step-title">{title}</h3>
      <div className="sell-page__step-frame">
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
            type="image/webp"
            srcSet={`${imageSrcMobile} 800w, ${imageSrc} 1600w`}
            sizes={SELL_JOURNEY_IMAGE_SIZES}
          />
          <source
            media="(min-width: 768px)"
            type="image/png"
            srcSet={`${imageSrcMobilePng} 800w, ${imageSrcPng || imageSrc} 1600w`}
            sizes={SELL_JOURNEY_IMAGE_SIZES}
          />
          <img
            src={imageSrcPng || imageSrc}
            alt={imageAlt}
            className="sell-page__step-image"
            width={imageWidth || 1600}
            height={imageHeight || 900}
            sizes={SELL_JOURNEY_IMAGE_SIZES}
            loading="lazy"
            decoding="async"
          />
        </picture>
      </div>
      <p className="sell-page__step-copy">{description}</p>
    </li>
  )
}

function ValuationPreview() {
  return (
    <ol className="sell-page__valuation-preview" aria-hidden="true">
      <li className="sell-page__valuation-card">
        <span className="sell-page__valuation-card-label">Search</span>
        <span className="sell-page__valuation-search">Life Fitness T5…</span>
      </li>
      <li className="sell-page__valuation-card">
        <span className="sell-page__valuation-card-label">Estimate</span>
        <span className="sell-page__valuation-range">£2,100 – £2,600</span>
        <span className="sell-page__valuation-spark" />
      </li>
      <li className="sell-page__valuation-card">
        <span className="sell-page__valuation-card-label">Your choice</span>
        <span className="sell-page__valuation-list-cta">Choose your price</span>
      </li>
    </ol>
  )
}

function GuideInlineLink({ to, children }) {
  return (
    <Link to={to} className="sell-page__guide-link">
      {children}
    </Link>
  )
}

function GuideTopicBody({ section }) {
  return (
    <div className="sell-page__guide-topic-body">
      {(section.paragraphs || []).map((paragraph) => (
        <p key={paragraph.slice(0, 48)} className="sell-page__guide-copy">
          {paragraph}
        </p>
      ))}
      {section.bullets?.length ? (
        <ul className="sell-page__guide-list">
          {section.bullets.map((item) => (
            <li key={`${item.link.to}:${item.link.label}`}>
              {item.before}
              <GuideInlineLink to={item.link.to}>{item.link.label}</GuideInlineLink>
              {item.after}
            </li>
          ))}
        </ul>
      ) : null}
      {section.brandLinks?.length ? (
        <p className="sell-page__guide-brands">
          {section.brandLinks.map((brand, index) => (
            <span key={brand.to}>
              {index > 0 ? <span aria-hidden="true"> · </span> : null}
              <GuideInlineLink to={brand.to}>{brand.label}</GuideInlineLink>
            </span>
          ))}
        </p>
      ) : null}
      {(section.paragraphsAfter || []).map((paragraph) => (
        <p key={paragraph.slice(0, 48)} className="sell-page__guide-copy">
          {paragraph}{' '}
          {section.brandsDirectory ? (
            <GuideInlineLink to={section.brandsDirectory.to}>
              {section.brandsDirectory.label}
            </GuideInlineLink>
          ) : null}
          {section.brandsDirectory ? '.' : null}
        </p>
      ))}
    </div>
  )
}

function GuideTopic({ section, isOpen, onSelect }) {
  return (
    <details className="sell-page__guide-topic" open={isOpen}>
      <summary
        className="sell-page__guide-topic-summary"
        onClick={(event) => {
          event.preventDefault()
          onSelect()
        }}
      >
        <h3 className="sell-page__guide-topic-title">{section.title}</h3>
      </summary>
      <GuideTopicBody section={section} />
    </details>
  )
}

function SellGuideSection() {
  const [openTopicId, setOpenTopicId] = useState(SELL_GUIDE_SECTIONS[0]?.id ?? null)

  return (
    <section className="sell-page__guide" aria-labelledby="sell-guide-heading">
      <div className="sell-page__visual-rail sell-page__guide-layout">
        <div className="sell-page__guide-intro">
          <span className="sell-page__handwritten-note">{SELL_GUIDE_NOTE}</span>
          <h2 id="sell-guide-heading" className="sell-page__h2 sell-page__h2--guide">
            {SELL_GUIDE_HEADING}
          </h2>
          <p className="sell-page__guide-lede">{SELL_GUIDE_INTRO}</p>
          <ul className="sell-page__guide-highlights">
            {SELL_GUIDE_HIGHLIGHTS.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>

        <div className="sell-page__guide-topics">
          {SELL_GUIDE_SECTIONS.map((section) => (
            <GuideTopic
              key={section.id}
              section={section}
              isOpen={openTopicId === section.id}
              onSelect={() => {
                setOpenTopicId((current) => (current === section.id ? null : section.id))
              }}
            />
          ))}
        </div>
      </div>
    </section>
  )
}

function SellFaqItem({ question, answer }) {
  return (
    <details className="sell-page__faq-item">
      <summary className="sell-page__faq-question">{question}</summary>
      <div className="sell-page__faq-answer-wrap">
        <p className="sell-page__faq-answer">{answer}</p>
      </div>
    </details>
  )
}

export default function SellGymEquipmentPage() {
  const openGraph = useMemo(() => buildSellGymEquipmentOpenGraph(), [])
  const showHeroArtwork = useMinWidth(768)

  usePageMeta({
    title: SELL_GYM_EQUIPMENT_META_TITLE,
    description: SELL_GYM_EQUIPMENT_META_DESCRIPTION,
    canonicalPath: SELL_GYM_EQUIPMENT_PATH,
    robotsContent: 'index, follow, max-image-preview:large',
    openGraph,
  })

  const breadcrumbSchema = useMemo(() => buildSellGymEquipmentBreadcrumbSchema(), [])
  const webPageSchema = useMemo(() => buildSellGymEquipmentWebPageSchema(), [])
  const faqSchema = useMemo(() => buildSellGymEquipmentFaqSchema(), [])

  return (
    <div className="sell-page">
      <BreadcrumbSchema schema={breadcrumbSchema} />
      <WebPageSchema schema={webPageSchema} />
      <FaqPageSchema schema={faqSchema} />

      <section className="sell-page__hero" aria-labelledby="sell-page-title">
        <div className="sell-page__visual-rail">
          <div className="sell-page__hero-grid">
            <div className="sell-page__hero-copy">
              <span className="sell-page__hero-eyebrow" aria-hidden="true">
                Sell it simply
              </span>
              <h1 id="sell-page-title" className="sell-page__h1">
                {SELL_GYM_EQUIPMENT_H1}
              </h1>
              <p className="sell-page__lead">{SELL_GYM_EQUIPMENT_LEAD}</p>
              <div className="sell-page__actions">
                <ProtectedLink
                  to={CREATE_LISTING_PATH}
                  className="sell-page__btn sell-page__btn--primary"
                >
                  Create a Listing Now
                </ProtectedLink>
                <Link to={VALUATION_PATH} className="sell-page__btn sell-page__btn--secondary">
                  Get a Free Valuation
                </Link>
              </div>
              <TrustLine />
            </div>
            {showHeroArtwork ? (
              <div className="sell-page__hero-visual">
                <HeroArtwork />
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <section className="sell-page__journey-section" aria-labelledby="sell-journey-heading">
        <div className="sell-page__visual-rail">
          <header className="sell-page__intro">
            <h2 id="sell-journey-heading" className="sell-page__h2">
              How selling on Equipd works
            </h2>
            <p className="sell-page__intro-lead">
              List your equipment, agree a sale and get paid securely.
            </p>
          </header>

          <ol className="sell-page__journey">
            {SELL_JOURNEY_STEPS.map((entry, index) => (
              <SellJourneyStep
                key={entry.step}
                {...entry}
                isLast={index === SELL_JOURNEY_STEPS.length - 1}
              />
            ))}
          </ol>
        </div>
      </section>

      <section className="sell-page__optional" aria-labelledby="sell-optional-heading">
        <div className="sell-page__reading-rail sell-page__reading-rail--optional">
          <div className="sell-page__optional-panel">
            <div>
              <p className="sell-page__eyebrow">Valuation is optional</p>
              <h2 id="sell-optional-heading" className="sell-page__h2 sell-page__h2--optional">
                Want to know what it&apos;s worth first?
              </h2>
              <p className="sell-page__optional-copy">
                You can list your equipment straight away without completing a valuation. If you
                would like help choosing an asking price, use our free equipment valuation tool.
              </p>
              <div className="sell-page__optional-actions">
                <ProtectedLink
                  to={CREATE_LISTING_PATH}
                  className="sell-page__btn sell-page__btn--primary"
                >
                  Create a Listing
                </ProtectedLink>
                <p className="sell-page__optional-or" aria-hidden="true">
                  or
                </p>
                <Link to={VALUATION_PATH} className="sell-page__btn sell-page__btn--secondary">
                  Get a Free Valuation
                </Link>
              </div>
            </div>
            <ValuationPreview />
          </div>
        </div>
      </section>

      <section className="sell-page__benefits-section" aria-labelledby="sell-benefits-heading">
        <div className="sell-page__visual-rail">
          <h2 id="sell-benefits-heading" className="sell-page__h2">
            Why sell on Equipd?
          </h2>
          <ul className="sell-page__benefits">
            {SELL_BENEFITS.map((item, index) => (
              <li key={item.title} className="sell-page__benefit">
                <span className="sell-page__benefit-mark" aria-hidden="true">
                  {index + 1}
                </span>
                <h3 className="sell-page__benefit-title">{item.title}</h3>
                <p className="sell-page__benefit-body">{item.body}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="sell-page__mid-cta" aria-labelledby="sell-mid-cta-heading">
        <div className="sell-page__reading-rail sell-page__reading-rail--mid-cta">
          <h2 id="sell-mid-cta-heading" className="sell-page__mid-cta-title">
            Ready to get started?
          </h2>
          <p className="sell-page__mid-cta-lead">
            Create your listing in minutes and start reaching buyers today.
          </p>
          <ProtectedLink
            to={CREATE_LISTING_PATH}
            className="sell-page__btn sell-page__btn--primary sell-page__btn--primary-lg"
          >
            Create a Listing Now
          </ProtectedLink>
        </div>
      </section>

      <SellGuideSection />

      <section className="sell-page__faq" aria-labelledby="sell-faq-heading">
        <div className="sell-page__visual-rail sell-page__faq-layout">
          <div className="sell-page__faq-intro">
            <span className="sell-page__handwritten-note">{SELL_FAQ_NOTE}</span>
            <h2 id="sell-faq-heading" className="sell-page__h2 sell-page__h2--faq">
              Frequently asked questions
            </h2>
            <p className="sell-page__faq-lede">{SELL_FAQ_INTRO}</p>
          </div>

          <div className="sell-page__faq-list">
            {SELL_FAQ_ITEMS.map((item) => (
              <SellFaqItem key={item.question} question={item.question} answer={item.answer} />
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
