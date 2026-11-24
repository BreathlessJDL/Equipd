import { useId, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import CanonicalEquipmentAutocomplete from '../CanonicalEquipmentAutocomplete'
import {
  BRAND_VALUATIONS_ANCHOR_ID,
  filterCatalogByBrandSlug,
} from '../../lib/brandPageCurated'
import { buildEquipmentProductPagePath } from '../../lib/equipmentProducts'
import { getEquipmentProductDisplayName, resolveValuationSearchMatches } from '../../lib/equipmentValuation'
import { getValuationSearchIndex } from '../../lib/valuationCatalogCache'
import './BrandPageValuationSearch.css'

function equipmentHrefForProduct(product) {
  if (product?.href) return product.href
  const key = product?.canonical_product_key || product?.canonicalProductKey
  return key ? buildEquipmentProductPagePath(key) : null
}

export default function BrandPageValuationSearch({
  brand,
  modelCount = 0,
  popularProducts = [],
}) {
  const navigate = useNavigate()
  const inputId = useId()
  const [query, setQuery] = useState('')
  const [selectedProduct, setSelectedProduct] = useState(null)
  const [status, setStatus] = useState('')
  const displayName = brand.displayName
  const shortcuts = []
  const seenShortcutLabels = new Set()
  for (const product of popularProducts) {
    if (shortcuts.length >= 4) break
    const href = equipmentHrefForProduct(product)
    const label = getEquipmentProductDisplayName(product) || product.displayName
    if (!href || !label || seenShortcutLabels.has(label)) continue
    if (label.trim().toLowerCase() === displayName.trim().toLowerCase()) continue
    seenShortcutLabels.add(label)
    shortcuts.push(product)
  }

  async function goToProduct(product) {
    const href = equipmentHrefForProduct(product)
    if (!href) return false
    navigate(href)
    return true
  }

  async function handleFind(event) {
    event.preventDefault()
    if (selectedProduct) {
      await goToProduct(selectedProduct)
      return
    }

    const trimmed = query.trim()
    if (trimmed.length < 2) {
      setStatus(`Enter a ${displayName} model name to find its valuation.`)
      document.getElementById(inputId)?.focus()
      return
    }

    const result = await getValuationSearchIndex()
    const catalog = filterCatalogByBrandSlug(result.products || [], brand.slug)
    const resolved = resolveValuationSearchMatches(catalog, trimmed)
    const ranked = resolved.scoredMatches?.length
      ? resolved.scoredMatches.map((entry) => entry.product)
      : resolved.matches
    const top = resolved.strongMatch || ranked[0]

    if (ranked.length === 1 || resolved.strongMatch) {
      await goToProduct(top)
      return
    }
    if (ranked.length > 1) {
      setStatus(`${ranked.length} matching ${displayName} models. Choose a suggestion to open its valuation.`)
      document.getElementById(inputId)?.focus()
      return
    }
    setStatus(`No matching ${displayName} models found. Try a shorter model name.`)
  }

  const countLabel = modelCount === 1
    ? `1 ${displayName} model covered`
    : `${Number(modelCount || 0).toLocaleString('en-GB')} ${displayName} models covered`

  return (
    <section
      id={BRAND_VALUATIONS_ANCHOR_ID}
      className="brand-page-valuations"
      aria-labelledby="brand-valuations-heading"
    >
      <p className="brand-page-valuations__eyebrow">Equipment valuations</p>
      <h2 id="brand-valuations-heading" className="brand-page-valuations__heading">
        {`How much is your ${displayName} worth?`}
      </h2>
      <p className="brand-page-valuations__lede">
        {`Search your ${displayName} model to discover its estimated second-hand value, original retail price and production year.`}
      </p>

      <form className="brand-page-valuations__form" onSubmit={handleFind}>
        <label className="visually-hidden" htmlFor={inputId}>
          {`Search ${displayName} models`}
        </label>
        <div className="brand-page-valuations__search">
          <CanonicalEquipmentAutocomplete
            id={inputId}
            value={query}
            onChange={(next) => {
              setQuery(next)
              setStatus('')
            }}
            selectedProduct={selectedProduct}
            onSelectedProductChange={setSelectedProduct}
            brandSlug={brand.slug}
            placeholder={`Search ${displayName} models...`}
            inputClassName="brand-page-valuations__input"
            showImages={false}
            resultLimit={8}
            onSubmit={({ product, source }) => {
              if (product) {
                void goToProduct(product)
                return
              }
              if (source === 'no-results') {
                setStatus(`No matching ${displayName} models found. Try a shorter model name.`)
              }
            }}
          />
          <button type="submit" className="brand-page-valuations__submit">
            Find valuation
          </button>
        </div>
      </form>

      {status ? (
        <p className="brand-page-valuations__status" role="status">{status}</p>
      ) : null}

      {modelCount > 0 ? (
        <p className="brand-page-valuations__count">{countLabel}</p>
      ) : null}

      {shortcuts.length ? (
        <ul className="brand-page-valuations__shortcuts" aria-label={`Popular ${displayName} models`}>
          {shortcuts.map((product) => (
            <li key={product.id || product.canonicalProductKey || product.href}>
              <Link to={equipmentHrefForProduct(product)} className="brand-page-valuations__shortcut">
                {getEquipmentProductDisplayName(product) || product.displayName}
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  )
}
