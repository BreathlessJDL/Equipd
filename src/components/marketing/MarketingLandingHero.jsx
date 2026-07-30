import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import CanonicalEquipmentAutocomplete from '../CanonicalEquipmentAutocomplete'
import { buildValuationHref } from '../../lib/valuationNavigation'
import './MarketingLandingHero.css'

function SearchIcon({ className = '' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="10.5" cy="10.5" r="6.25" stroke="currentColor" strokeWidth="1.85" />
      <path
        d="M15.4 15.4 20 20"
        stroke="currentColor"
        strokeWidth="1.85"
        strokeLinecap="round"
      />
    </svg>
  )
}

/**
 * Shared centred SEO landing-page hero.
 * Typography-led cream/peach banner — no imagery or decorative panels.
 */
export default function MarketingLandingHero({
  titleId,
  eyebrow,
  title,
  description,
  primaryCta,
  secondaryCta,
  searchId,
  searchLabel = 'Search equipment',
  trustItems = [],
}) {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [selectedProduct, setSelectedProduct] = useState(null)

  function handleSelectedProductChange(product) {
    setSelectedProduct(product)
    if (!product) return
    const key = product.canonical_product_key
    if (!key) return
    navigate(buildValuationHref({ productKey: key }))
  }

  return (
    <div className="marketing-landing-hero">
      <div className="marketing-landing-hero__inner">
        {eyebrow ? (
          <span className="marketing-landing-hero__eyebrow" aria-hidden="true">
            {eyebrow}
          </span>
        ) : null}

        <h1 id={titleId} className="marketing-landing-hero__title">
          {title}
        </h1>

        {description ? (
          <p className="marketing-landing-hero__lead">{description}</p>
        ) : null}

        <div className="marketing-landing-hero__actions">
          <Link to={primaryCta.to} className="buy-page__btn buy-page__btn--primary">
            {primaryCta.label}
          </Link>
          <Link to={secondaryCta.to} className="buy-page__btn buy-page__btn--secondary">
            {secondaryCta.label}
          </Link>
        </div>

        <div className="marketing-landing-hero__search">
          <label className="marketing-landing-hero__search-label" htmlFor={searchId}>
            {searchLabel}
          </label>
          <div className="marketing-landing-hero__search-field">
            <SearchIcon className="marketing-landing-hero__search-icon" />
            <CanonicalEquipmentAutocomplete
              id={searchId}
              value={query}
              onChange={setQuery}
              selectedProduct={selectedProduct}
              onSelectedProductChange={handleSelectedProductChange}
              placeholder="Search brand or model…"
              showImages
              inputClassName="marketing-landing-hero__search-input"
            />
          </div>
        </div>

        {trustItems.length > 0 ? (
          <ul className="marketing-landing-hero__trust" aria-label="Buying benefits">
            {trustItems.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  )
}
