import { useEffect, useMemo, useState } from 'react'
import BrandCard from '../components/BrandCard'
import JsonLd from '../components/JsonLd'
import PageBreadcrumbs from '../components/PageBreadcrumbs'
import BreadcrumbSchema from '../components/seo/BreadcrumbSchema'
import { usePageMeta } from '../hooks/usePageMeta'
import {
  buildBrandCollectionJsonLd,
  fetchBrandDirectory,
  listBrandLogoAssetPaths,
} from '../lib/brandCatalogue'
import { buildBrandsIndexBreadcrumbSchema } from '../lib/breadcrumbStructuredData'
import './BrandsPage.css'

function formatStatNumber(value) {
  return new Intl.NumberFormat('en-GB').format(Number(value) || 0)
}

export default function BrandsPage() {
  const [directory, setDirectory] = useState({ brands: [], featured: [], byLetter: {} })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')

  usePageMeta({
    title: 'Gym Equipment Value Guides by Brand | Equipd',
    description:
      'Explore used gym equipment values by brand, including original RRPs, production years, compatible consoles and current marketplace listings.',
    canonicalPath: '/brands',
  })

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      const result = await fetchBrandDirectory()
      if (cancelled) return
      if (result.error && !result.brands.length) {
        setError(result.error.message || 'Unable to load brands.')
        setDirectory({ brands: [], featured: [], byLetter: {} })
      } else {
        setDirectory(result)
      }
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return undefined
    let cancelled = false

    async function reportMissingLogos() {
      const assets = listBrandLogoAssetPaths()
      const missing = []
      await Promise.all(assets.map(async (asset) => {
        try {
          const response = await fetch(asset.logoPath, { method: 'HEAD' })
          if (!response.ok) missing.push(asset.logoPath)
        } catch {
          missing.push(asset.logoPath)
        }
      }))
      if (!cancelled && missing.length) {
        console.warn('[BrandsPage] Missing brand logo assets:', missing)
      }
    }

    reportMissingLogos()
    return () => { cancelled = true }
  }, [])

  const query = search.trim().toLowerCase()

  const filteredFeatured = useMemo(() => {
    if (!query) return directory.featured
    return directory.featured.filter((brand) => brand.displayName.toLowerCase().includes(query))
  }, [directory.featured, query])

  const filteredByLetter = useMemo(() => {
    const letters = Object.keys(directory.byLetter || {}).sort()
    const next = {}
    for (const letter of letters) {
      const brands = (directory.byLetter[letter] || []).filter((brand) => (
        !query || brand.displayName.toLowerCase().includes(query)
      ))
      if (brands.length) next[letter] = brands
    }
    return next
  }, [directory.byLetter, query])

  const brandCount = directory.brands.length
  const modelCount = useMemo(
    () => directory.brands.reduce((sum, brand) => sum + (Number(brand.productCount) || 0), 0),
    [directory.brands],
  )

  const jsonLd = useMemo(
    () => buildBrandCollectionJsonLd(directory.brands),
    [directory.brands],
  )
  const breadcrumbSchema = useMemo(() => buildBrandsIndexBreadcrumbSchema(), [])

  return (
    <div className="brands-page">
      <JsonLd data={jsonLd} />
      <BreadcrumbSchema schema={breadcrumbSchema} />
      <div className="brands-page__inner">
        <PageBreadcrumbs
          items={[
            { label: 'Home', to: '/' },
            { label: 'Equipment Values' },
          ]}
        />

        <header className="brands-page__hero">
          <div className="brands-page__hero-copy">
            <p className="brands-page__eyebrow">Equipment value guides</p>
            <h1 className="brands-page__title">Explore gym equipment by brand</h1>
            <p className="brands-page__lede">
              Find estimated used values, original RRPs, production years and console
              information across leading fitness manufacturers.
            </p>
          </div>

          <div className="brands-page__hero-aside">
            <label className="brands-page__search">
              <span className="visually-hidden">Search equipment brands</span>
              <span className="brands-page__search-icon" aria-hidden="true">
                <svg viewBox="0 0 20 20" width="18" height="18" fill="none">
                  <circle cx="8.5" cy="8.5" r="5.5" stroke="currentColor" strokeWidth="1.6" />
                  <path d="M12.5 12.5 16 16" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                </svg>
              </span>
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search equipment brands"
                autoComplete="off"
              />
            </label>

            <ul className="brands-page__stats" aria-label="Catalogue coverage">
              <li className="brands-page__stat">
                <span className="brands-page__stat-icon" aria-hidden="true">
                  <svg viewBox="0 0 20 20" width="16" height="16" fill="none">
                    <path d="M3.5 16.5V7.5L10 3.5l6.5 4v9" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
                    <path d="M7.5 16.5v-4h5v4" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
                  </svg>
                </span>
                <span>
                  <strong>{formatStatNumber(brandCount)}</strong>
                  {' '}
                  Brands
                </span>
              </li>
              <li className="brands-page__stat">
                <span className="brands-page__stat-icon" aria-hidden="true">
                  <svg viewBox="0 0 20 20" width="16" height="16" fill="none">
                    <path d="M4 7.5h2.5v5H4V7.5Zm9.5 0H16v5h-2.5V7.5ZM6.5 9.5h7v1h-7v-1Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
                  </svg>
                </span>
                <span>
                  <strong>{formatStatNumber(modelCount)}</strong>
                  {' '}
                  Equipment models
                </span>
              </li>
              <li className="brands-page__stat">
                <span className="brands-page__stat-icon" aria-hidden="true">
                  <svg viewBox="0 0 20 20" width="16" height="16" fill="none">
                    <rect x="4" y="3.5" width="12" height="13" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
                    <path d="M7 7.5h6M7 10.5h6M7 13.5h4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                  </svg>
                </span>
                <span>Used value guides</span>
              </li>
            </ul>
          </div>
        </header>

        {loading ? <p className="brands-page__status">Loading value guides…</p> : null}
        {error ? <p className="brands-page__error">{error}</p> : null}

        {!loading && !error ? (
          <>
            {filteredFeatured.length ? (
              <section className="brands-page__section" aria-labelledby="featured-brands-title">
                <div className="brands-page__section-intro">
                  <h2 id="featured-brands-title" className="brands-page__section-title">
                    Featured brands
                  </h2>
                  <p className="brands-page__section-lede">
                    Explore the manufacturers with the largest equipment coverage on Equipd.
                  </p>
                </div>
                <div className="brands-page__grid">
                  {filteredFeatured.map((brand, index) => (
                    <BrandCard key={brand.slug} brand={brand} priority={index < 3} />
                  ))}
                </div>
              </section>
            ) : null}

            <section className="brands-page__section brands-page__section--az" aria-labelledby="all-brands-title">
              <div className="brands-page__section-intro">
                <h2 id="all-brands-title" className="brands-page__section-title">All brands A–Z</h2>
                <p className="brands-page__section-lede">
                  Browse the full brand directory.
                </p>
              </div>

              {Object.keys(filteredByLetter).length === 0 ? (
                <p className="brands-page__status">No brands match your search.</p>
              ) : (
                Object.keys(filteredByLetter).sort().map((letter) => (
                  <div key={letter} className="brands-page__letter-group">
                    <h3 className="brands-page__letter">{letter}</h3>
                    <div className="brands-page__az-grid">
                      {filteredByLetter[letter].map((brand) => (
                        <BrandCard key={brand.slug} brand={brand} compact />
                      ))}
                    </div>
                  </div>
                ))
              )}
            </section>
          </>
        ) : null}
      </div>
    </div>
  )
}
