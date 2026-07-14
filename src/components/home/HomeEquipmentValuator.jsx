import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import CanonicalEquipmentAutocomplete from '../CanonicalEquipmentAutocomplete'
import { getEquipmentProductDisplayName } from '../../lib/equipmentValuation'
import { buildValuationHref } from '../../lib/valuationNavigation'
import './HomeEquipmentValuator.css'

const DEFAULT_TRUST_POINTS = [
  'Based on real market data',
  'Accurate, up-to-date valuations',
  'Takes less than 60 seconds',
]

const DEFAULT_EYEBROW = 'Equipment valuator'
const DEFAULT_TITLE = 'Find out what your gym equipment is worth'
const DEFAULT_LEDE = 'Search over 1,000 commercial fitness products and get an estimated current used value in just a few simple steps.'

function TrustIcon() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" fill="none">
      <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" />
      <path d="M4.75 8.1 6.9 10.2 11.25 5.8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/**
 * Shared equipment valuation search used on the homepage and Equipment Values.
 * Instance-specific ids/copy are passed via props so multiple mounts cannot collide.
 */
export default function HomeEquipmentValuator({
  idPrefix = 'home-valuator',
  eyebrow = DEFAULT_EYEBROW,
  title = DEFAULT_TITLE,
  lede = DEFAULT_LEDE,
  trustPoints = DEFAULT_TRUST_POINTS,
  contained = false,
  className = '',
} = {}) {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [selectedProduct, setSelectedProduct] = useState(null)

  const titleId = `${idPrefix}-title`
  const inputId = `${idPrefix}-search`

  function goToValuator({ product = selectedProduct, queryText = query } = {}) {
    const productKey = product?.canonical_product_key || null
    navigate(buildValuationHref({
      productKey,
      query: productKey ? null : queryText,
    }))
  }

  function handleSubmit(event) {
    event.preventDefault()
    goToValuator()
  }

  const sectionClassName = [
    'home-valuator',
    contained ? 'home-valuator--contained' : '',
    className,
  ].filter(Boolean).join(' ')

  const card = (
    <div className="home-valuator__card">
      <div className="home-valuator__copy">
        <p className="home-valuator__eyebrow">{eyebrow}</p>
        <h2 id={titleId} className="home-valuator__title">
          {title}
        </h2>
        <p className="home-valuator__lede">{lede}</p>
      </div>

      <div className="home-valuator__action">
        <form className="home-valuator__form" onSubmit={handleSubmit}>
          <label className="visually-hidden" htmlFor={inputId}>
            Search brand or model
          </label>
          <CanonicalEquipmentAutocomplete
            id={inputId}
            value={query}
            onChange={setQuery}
            selectedProduct={selectedProduct}
            onSelectedProductChange={setSelectedProduct}
            placeholder="Search brand or model..."
            inputClassName="home-valuator__input"
            resultLimit={6}
            debounceMs={250}
            onSubmit={({ product }) => {
              if (product) {
                setSelectedProduct(product)
                setQuery(getEquipmentProductDisplayName(product))
                goToValuator({ product, queryText: getEquipmentProductDisplayName(product) })
              } else {
                goToValuator({ product: null, queryText: query })
              }
            }}
          />
          <button type="submit" className="home-valuator__submit">
            Value equipment
          </button>
        </form>

        <ul className="home-valuator__trust">
          {trustPoints.map((point) => (
            <li key={point}>
              <span className="home-valuator__trust-icon">
                <TrustIcon />
              </span>
              <span>{point}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )

  return (
    <section className={sectionClassName} aria-labelledby={titleId}>
      {contained ? card : (
        <div className="home-section__inner">
          {card}
        </div>
      )}
    </section>
  )
}
