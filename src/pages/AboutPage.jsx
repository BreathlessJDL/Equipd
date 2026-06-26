import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { AboutWideSelectionIcon } from '../components/about/AboutPageIcons'
import {
  AlertCircleIcon,
  CollectionPinIcon,
  CreditCardIcon,
} from '../components/icons/NavIcons'
import { useInViewOnce } from '../hooks/useInViewOnce'
import './AboutPage.css'

const SUPPORT_EMAIL = 'support@equipd.co.uk'

const TRUST_HIGHLIGHTS = [
  {
    title: 'UK-wide marketplace',
    body: 'Connect with buyers and sellers of gym equipment across the United Kingdom.',
    Icon: CollectionPinIcon,
  },
  {
    title: 'Secure payments',
    body: 'Protected checkout and buyer support designed for marketplace peace of mind.',
    Icon: CreditCardIcon,
  },
  {
    title: 'Gym equipment only',
    body: 'A dedicated platform for fitness kit — not general classifieds.',
    Icon: AboutWideSelectionIcon,
  },
]

const PROBLEM_ITEMS = [
  'Fake or misleading listings',
  'Poor communication between buyers and sellers',
  'No protection during payments',
  'Quality equipment getting lost amongst unrelated listings',
]

const OFFER_CARDS = [
  {
    title: 'Wide Selection',
    body: 'Browse a range of new and used gym equipment from trusted sellers across the UK.',
    imageSrc: '/design-reference/wide%20selection%20icon.png',
    imageAlt: 'Wide selection of gym equipment',
  },
  {
    title: 'Simple Buying & Selling',
    body: 'Create listings, make offers and manage orders easily in one place.',
    imageSrc: '/design-reference/simple%20buying%20and%20selling%20icon.png',
    imageAlt: 'Simple buying and selling',
  },
  {
    title: 'Flexible Delivery Options',
    body: 'Choose collection or delivery options provided by sellers.',
    imageSrc: '/design-reference/flexible%20delivery%20options%20icon.png',
    imageAlt: 'Flexible delivery options',
  },
]

const VALUE_CARDS = [
  {
    title: 'Trust & Transparency',
    body: 'Clear listings, secure payments and open communication.',
    imageSrc: '/design-reference/trust%20and%20transparency%20icon.png',
    imageAlt: 'Trust and transparency',
  },
  {
    title: 'Fair Pricing',
    body: 'Competitive prices with no hidden fees.',
    imageSrc: '/design-reference/fair%20pricing%20icon.png',
    imageAlt: 'Fair pricing',
  },
  {
    title: 'Community',
    body: 'Supporting gyms, studios and fitness professionals.',
    imageSrc: '/design-reference/community%20icon.png',
    imageAlt: 'Fitness community',
  },
]

function AboutFeatureCard({ title, body, imageSrc, imageAlt, visible, delayMs }) {
  return (
    <article
      className={`about-page__card${visible ? ' about-page__card--visible' : ''}`}
      style={{ '--about-card-delay': `${delayMs}ms` }}
    >
      <div className="about-page__card-icon">
        <img
          src={imageSrc}
          alt={imageAlt}
          className="about-page__card-icon-img"
          width={96}
          height={96}
          loading="lazy"
          decoding="async"
        />
      </div>
      <h3 className="about-page__card-title">{title}</h3>
      <p className="about-page__card-body">{body}</p>
    </article>
  )
}

function AboutTrustCard({ title, body, Icon }) {
  return (
    <article className="about-page__trust-card">
      <div className="about-page__trust-card-icon" aria-hidden="true">
        <Icon className="about-page__trust-card-icon-svg" />
      </div>
      <div className="about-page__trust-card-copy">
        <h3 className="about-page__trust-card-title">{title}</h3>
        <p className="about-page__trust-card-body">{body}</p>
      </div>
    </article>
  )
}

function AboutHeroSection() {
  return (
    <section className="about-page__hero-band" aria-labelledby="about-page-title">
      <div className="about-page__hero-band-glow" aria-hidden="true" />
      <div className="about-page__hero-inner">
        <div className="about-page__hero-grid">
          <div className="about-page__hero-copy">
            <p className="about-page__eyebrow">Our story</p>
            <h1 id="about-page-title" className="about-page__title">
              About Equipd
            </h1>
            <p className="about-page__subtitle">
              The trusted UK marketplace for buying and selling used gym equipment
            </p>
            <div className="about-page__intro">
              <p>
                Equipd connects buyers and sellers of quality fitness equipment across the UK. Our
                platform was created to make it easier for gyms, studios, and home users to buy and
                sell equipment in one trusted place.
              </p>
              <p>
                Unlike general marketplaces, Equipd focuses exclusively on gym equipment — helping
                sellers reach a targeted audience while giving buyers a reliable place to find the
                equipment they need.
              </p>
            </div>
            <Link to="/browse" className="about-page__cta">
              Browse Equipment
            </Link>
          </div>

          <aside className="about-page__hero-aside" aria-label="Why buyers and sellers choose Equipd">
            <div className="about-page__hero-aside-card">
              <p className="about-page__hero-aside-label">Built for the fitness community</p>
              <div className="about-page__trust-grid">
                {TRUST_HIGHLIGHTS.map((item) => (
                  <AboutTrustCard key={item.title} {...item} />
                ))}
              </div>
            </div>
          </aside>
        </div>
      </div>
    </section>
  )
}

function AboutWhySection() {
  return (
    <section className="about-page__why-band" aria-labelledby="about-why-title">
      <div className="about-page__why-panel">
        <div className="about-page__why-grid">
          <div className="about-page__why-intro">
            <h2 id="about-why-title" className="about-page__why-title">
              Why Equipd Exists
            </h2>
            <p>
              Gym equipment is often bought and sold on platforms that were never designed for it.
              This can lead to common problems such as:
            </p>
            <p className="about-page__emphasis">Equipd was created to solve this.</p>
          </div>

          <div className="about-page__why-details">
            <ul className="about-page__problem-list">
              {PROBLEM_ITEMS.map((item) => (
                <li key={item} className="about-page__problem-item">
                  <span className="about-page__problem-icon" aria-hidden="true">
                    <AlertCircleIcon className="about-page__problem-icon-svg" />
                  </span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="about-page__why-footer">
          <p>
            Whether you&apos;re upgrading a commercial facility, building a home gym, or selling
            unused equipment, Equipd makes the process simple, transparent, and secure.
          </p>
          <p>
            By focusing exclusively on fitness equipment, Equipd provides a dedicated marketplace
            where buyers and sellers can connect with confidence. Our goal is to make buying and
            selling gym equipment simpler, safer, and more transparent for everyone involved.
          </p>
        </div>
      </div>
    </section>
  )
}

function AboutFeatureSection({ id, title, cards }) {
  const { ref, inView } = useInViewOnce()

  return (
    <section className="about-page__feature-section" aria-labelledby={id}>
      <div className="about-page__feature-header">
        <h2 id={id} className="about-page__feature-title">
          {title}
        </h2>
        <span className="about-page__feature-underline" aria-hidden="true" />
      </div>

      <div ref={ref} className="about-page__card-grid">
        {cards.map((card, index) => (
          <AboutFeatureCard
            key={card.title}
            {...card}
            visible={inView}
            delayMs={index * 90}
          />
        ))}
      </div>
    </section>
  )
}

function AboutPage() {
  useEffect(() => {
    const previousTitle = document.title
    document.title = 'About Equipd — Used gym equipment marketplace'

    const metaDescription = document.querySelector('meta[name="description"]')
    const createdMeta = !metaDescription
    const meta = metaDescription ?? document.createElement('meta')
    const previousContent = meta.getAttribute('content') ?? ''

    if (createdMeta) {
      meta.setAttribute('name', 'description')
      document.head.appendChild(meta)
    }

    meta.setAttribute(
      'content',
      'Learn about Equipd, the trusted UK marketplace for buying and selling used gym equipment.',
    )

    return () => {
      document.title = previousTitle
      if (createdMeta) {
        meta.remove()
      } else {
        meta.setAttribute('content', previousContent)
      }
    }
  }, [])

  return (
    <article className="about-page">
      <AboutHeroSection />
      <AboutWhySection />

      <div className="about-page__features-band">
        <div className="about-page__features-inner">
          <AboutFeatureSection id="about-offer-title" title="What We Offer" cards={OFFER_CARDS} />
          <AboutFeatureSection id="about-values-title" title="Our Values" cards={VALUE_CARDS} />
        </div>
      </div>

      <section className="about-page__contact" aria-labelledby="about-contact-title">
        <div className="about-page__contact-inner">
          <h2 id="about-contact-title" className="about-page__contact-title">
            Have questions or need support?
          </h2>
          <p className="about-page__contact-text">Our team is here to help.</p>
          <p className="about-page__contact-email">
            Email:{' '}
            <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
          </p>
          <Link to="/support" className="about-page__contact-button">
            Contact Us
          </Link>
        </div>
      </section>
    </article>
  )
}

export default AboutPage
