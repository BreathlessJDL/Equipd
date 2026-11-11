import { useEffect, useMemo, useState } from 'react'
import BrandCard from '../components/BrandCard'
import EquipmentValuesHero from '../components/brands/EquipmentValuesHero'
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
import { getEquipdDefaultSocialImageUrl } from '../lib/socialPreview'
import './BrandsPage.css'

export default function BrandsPage() {
  const [directory, setDirectory] = useState({ brands: [], featured: [], byLetter: {} })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  usePageMeta({
    title: 'Used Gym Equipment Values by Brand',
    description:
      'Browse Equipd equipment value guides by brand. Explore used values, original RRPs, production years and current marketplace listings across major gym equipment manufacturers.',
    canonicalPath: '/brands',
    openGraph: {
      'og:title': 'Used Gym Equipment Values by Brand | Equipd',
      'og:description':
        'Browse Equipd equipment value guides by brand. Explore used values, original RRPs, production years and current marketplace listings.',
      'og:url': 'https://www.equipd.co.uk/brands',
      'og:image': getEquipdDefaultSocialImageUrl(),
      'twitter:card': 'summary_large_image',
      'twitter:title': 'Used Gym Equipment Values by Brand | Equipd',
      'twitter:description':
        'Browse Equipd equipment value guides by brand. Explore used values, original RRPs, production years and current marketplace listings.',
      'twitter:image': getEquipdDefaultSocialImageUrl(),
    },
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

  const featuredBrands = directory.featured
  const brandsByLetter = directory.byLetter || {}
  const directoryLetters = Object.keys(brandsByLetter).sort()

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

        <h1 className="visually-hidden">Used Gym Equipment Values by Brand</h1>

        <EquipmentValuesHero />

        {loading ? <p className="brands-page__status brands-page__status--after-hero">Loading value guides…</p> : null}
        {error ? <p className="brands-page__error brands-page__status--after-hero">{error}</p> : null}

        {!loading && !error ? (
          <>
            {featuredBrands.length ? (
              <section
                className="brands-page__section brands-page__section--after-hero"
                aria-labelledby="featured-brands-title"
              >
                <div className="brands-page__section-intro">
                  <h2 id="featured-brands-title" className="brands-page__section-title">
                    Featured brands
                  </h2>
                  <p className="brands-page__section-lede">
                    Explore the manufacturers with the largest equipment coverage on Equipd.
                  </p>
                </div>
                <div className="brands-page__grid">
                  {featuredBrands.map((brand, index) => (
                    <BrandCard key={brand.slug} brand={brand} priority={index < 3} />
                  ))}
                </div>
              </section>
            ) : null}

            <section
              className={`brands-page__section brands-page__section--az${featuredBrands.length ? '' : ' brands-page__section--after-hero'}`}
              aria-labelledby="all-brands-title"
            >
              <div className="brands-page__section-intro">
                <h2 id="all-brands-title" className="brands-page__section-title">All brands A–Z</h2>
                <p className="brands-page__section-lede">
                  Browse the full brand directory.
                </p>
              </div>

              {directoryLetters.length === 0 ? (
                <p className="brands-page__status">No brands are available yet.</p>
              ) : (
                directoryLetters.map((letter) => (
                  <div key={letter} className="brands-page__letter-group">
                    <h3 className="brands-page__letter">{letter}</h3>
                    <div className="brands-page__az-grid">
                      {brandsByLetter[letter].map((brand) => (
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
