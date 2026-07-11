import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import CanonicalEquipmentAutocomplete from '../CanonicalEquipmentAutocomplete'
import { getEquipmentProductDisplayName } from '../../lib/equipmentValuation'
import { buildValuationHref } from '../../lib/valuationNavigation'
import './HomeEquipmentValuator.css'

const TRUST_POINTS = [
  'Based on real market data',
  'Accurate, up-to-date valuations',
  'Takes less than 60 seconds',
]

function TrustIcon() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" fill="none">
      <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" />
      <path d="M4.75 8.1 6.9 10.2 11.25 5.8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export default function HomeEquipmentValuator() {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [selectedProduct, setSelectedProduct] = useState(null)

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

  return (
    <section className="home-valuator" aria-labelledby="home-valuator-title">
      <div className="home-section__inner">
        <div className="home-valuator__card">
          <div className="home-valuator__copy">
            <p className="home-valuator__eyebrow">Equipment valuator</p>
            <h2 id="home-valuator-title" className="home-valuator__title">
              Find out what your gym equipment is worth
            </h2>
            <p className="home-valuator__lede">
              Search over 1,000 commercial fitness products and get an estimated
              current used value in just a few simple steps.
            </p>
          </div>

          <div className="home-valuator__action">
            <form className="home-valuator__form" onSubmit={handleSubmit}>
              <label className="visually-hidden" htmlFor="home-valuator-search">
                Search brand or model
              </label>
              <CanonicalEquipmentAutocomplete
                id="home-valuator-search"
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
              {TRUST_POINTS.map((point) => (
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
      </div>
    </section>
  )
}
