import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { usePageMeta } from '../hooks/usePageMeta'
import { fetchEquipmentModels } from '../lib/equipmentModels'
import './PriceGuidePage.css'

function matchesSearch(model, query) {
  if (!query) return true
  const haystack = [model.brand, model.model, model.model_family, model.category, model.slug]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
  return haystack.includes(query)
}

function PriceGuidePage() {
  const [models, setModels] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')
  const [brandFilter, setBrandFilter] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')

  usePageMeta({
    title: 'Price Guide',
    description:
      'Browse used gym equipment price guides on Equipd — valuations, depreciation and maintenance information by model.',
  })

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)

      const result = await fetchEquipmentModels()
      if (cancelled) return

      if (result.error) {
        setModels([])
        setError(result.error)
        setLoading(false)
        return
      }

      setModels(result.data ?? [])
      setLoading(false)
    }

    load()

    return () => {
      cancelled = true
    }
  }, [])

  const brands = useMemo(() => {
    return Array.from(new Set(models.map((model) => model.brand).filter(Boolean))).sort((a, b) =>
      a.localeCompare(b),
    )
  }, [models])

  const categories = useMemo(() => {
    return Array.from(new Set(models.map((model) => model.category).filter(Boolean))).sort((a, b) =>
      a.localeCompare(b),
    )
  }, [models])

  const filteredModels = useMemo(() => {
    const query = search.trim().toLowerCase()

    return models.filter((model) => {
      if (brandFilter && model.brand !== brandFilter) return false
      if (categoryFilter && model.category !== categoryFilter) return false
      return matchesSearch(model, query)
    })
  }, [models, search, brandFilter, categoryFilter])

  return (
    <div className="price-guide-page">
      <header className="price-guide-page__hero">
        <div className="price-guide-page__hero-inner">
          <p className="price-guide-page__eyebrow">Equipd Price Guide</p>
          <h1 className="price-guide-page__title">Used gym equipment values</h1>
          <p className="price-guide-page__intro">
            Explore model price guides with market observations, depreciation context, maintenance
            notes and links to sell or request a valuation.
          </p>
        </div>
      </header>

      <div className="price-guide-page__controls">
        <div className="price-guide-page__filters">
          <label className="visually-hidden" htmlFor="price-guide-search">
            Search equipment models
          </label>
          <input
            id="price-guide-search"
            type="search"
            className="price-guide-page__search"
            placeholder="Search brand, model or category"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />

          <label className="visually-hidden" htmlFor="price-guide-brand">
            Filter by brand
          </label>
          <select
            id="price-guide-brand"
            className="price-guide-page__select"
            value={brandFilter}
            onChange={(event) => setBrandFilter(event.target.value)}
          >
            <option value="">All brands</option>
            {brands.map((brand) => (
              <option key={brand} value={brand}>
                {brand}
              </option>
            ))}
          </select>

          <label className="visually-hidden" htmlFor="price-guide-category">
            Filter by category
          </label>
          <select
            id="price-guide-category"
            className="price-guide-page__select"
            value={categoryFilter}
            onChange={(event) => setCategoryFilter(event.target.value)}
          >
            <option value="">All categories</option>
            {categories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </div>

        {!loading && !error ? (
          <p className="price-guide-page__count">
            {filteredModels.length === 1
              ? '1 model'
              : `${filteredModels.length} models`}
          </p>
        ) : null}
      </div>

      {loading ? (
        <div className="price-guide-page__status">Loading equipment models…</div>
      ) : null}

      {!loading && error ? (
        <div className="price-guide-page__status" role="alert">
          {error.message || 'Unable to load the price guide. Please try again.'}
        </div>
      ) : null}

      {!loading && !error && filteredModels.length === 0 ? (
        <div className="price-guide-page__empty">
          No equipment models match your search. Try a different brand, category or keyword.
        </div>
      ) : null}

      {!loading && !error && filteredModels.length > 0 ? (
        <div className="price-guide-page__grid">
          {filteredModels.map((model) => (
            <Link
              key={model.id}
              to={`/equipment/${model.slug}`}
              className="price-guide-page__card"
            >
              <p className="price-guide-page__card-brand">{model.brand}</p>
              <h2 className="price-guide-page__card-title">{model.model}</h2>
              <div className="price-guide-page__card-meta">
                {model.category ? (
                  <span className="price-guide-page__card-chip">{model.category}</span>
                ) : null}
                {model.model_family ? (
                  <span className="price-guide-page__card-chip">{model.model_family}</span>
                ) : null}
              </div>
              <p className="price-guide-page__card-cta">View price guide →</p>
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  )
}

export default PriceGuidePage
