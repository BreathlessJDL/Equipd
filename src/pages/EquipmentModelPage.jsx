import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import JsonLd from '../components/JsonLd'
import BreadcrumbSchema from '../components/seo/BreadcrumbSchema'
import { usePageMeta } from '../hooks/usePageMeta'
import {
  buildEquipmentPageSeoBundle,
  buildFactualOverviewFallback,
  getApprovedEquipmentImage,
} from '../lib/equipmentPageSeo'
import {
  excludeBreadcrumbSchemas,
  findBreadcrumbSchemas,
} from '../lib/breadcrumbStructuredData'
import {
  fetchEquipmentProductPageData,
  fetchRelatedPublicEquipmentProducts,
} from '../lib/equipmentProducts'
import { getBrandPagePath, getBrandSlug } from '../lib/brandCatalogueCore'
import EquipmentConsoleVariantCards from '../components/equipment/EquipmentConsoleVariantCards'
import RelatedEquipmentCard from '../components/equipment/RelatedEquipmentCard'
import {
  EquipmentProductAboutSection,
  EquipmentProductFaqSection,
} from '../components/equipment/EquipmentProductContentSections'
import '../components/equipment/EquipmentProductContentSections.css'
import EquipmentProductValuationCard from '../components/equipment/EquipmentProductValuationCard'
import { shouldResetConsoleForYearChange } from '../components/equipment/EquipmentValuationDetailsFields'
import {
  fetchEquipmentProductPageContent,
  isDraftProductContentPubliclyVisible,
  resolveEquipmentProductPageContent,
} from '../lib/equipmentProductContentPage'
import {
  buildProductConsoleImageMap,
} from '../lib/productConsoleOptions'
import {
  getCompatibleConsoleOptions,
  getDefaultCompatibleConsoleName,
  shouldShowConsoleEvidence,
} from '../lib/consoleCompatibility'
import { supportsProductConsoleOptions } from '../lib/equipmentCardio'
import { resolveEquipmentProductImageDisplayUrl, productHasDisplayableImage } from '../lib/equipmentProductImages'
import { supabase } from '../lib/supabase'
import {
  buildEquipmentDepreciationGraphDataFromProduct,
  calculateEquipmentProductValuation,
  formatValuationMoney,
  getEquipmentProductCompletionStatus,
  getEquipmentProductDisplayName,
  getDefaultProductManufactureYear,
  getProductManufacturedFromYear,
  formatProductProductionYears,
  MANUFACTURED_FROM_LABEL,
  PRODUCTION_YEARS_LABEL,
  parseSelectedManufactureYear,
  productHasValuationBaselineYear,
  productHasValuationRrp,
  resolveManufactureYearSelectValue,
  VALUATION_ESTIMATE_DISCLAIMER,
} from '../lib/equipmentValuation'
import './EquipmentModelPage.css'

const EquipmentDepreciationGraph = lazy(() => import('../components/equipment/EquipmentDepreciationGraph'))

function resolveDefaultConsoleName({
  productConsoleOptions = [],
  manufactureYear,
}) {
  const selectedYear = parseSelectedManufactureYear(manufactureYear)
  if (selectedYear == null) return ''
  return getDefaultCompatibleConsoleName({
    productConsoleOptions,
    manufactureYear: selectedYear,
  })
}

function resolveConsoleCompatForYear({
  productConsoleOptions = [],
  manufactureYear,
}) {
  const selectedYear = parseSelectedManufactureYear(manufactureYear)
  if (selectedYear == null) {
    return getCompatibleConsoleOptions({
      manufactureYear: null,
      options: productConsoleOptions,
      audience: 'public',
    })
  }
  return getCompatibleConsoleOptions({
    productId: productConsoleOptions[0]?.product_id ?? null,
    manufactureYear: selectedYear,
    options: productConsoleOptions,
    audience: 'public',
  })
}

function StatusBlock({ title, children }) {
  return (
    <div className="equipment-model-page">
      <div className="equipment-model-page__status">
        <h1>{title}</h1>
        {children}
        <Link
          to="/valuation"
          className="equipment-model-page__cta equipment-model-page__cta--secondary equipment-model-page__status-link"
        >
          Try valuation
        </Link>
      </div>
    </div>
  )
}

function hasDisplayableEquipmentType(equipmentType) {
  const text = String(equipmentType ?? '').trim()
  return Boolean(text) && text.toLowerCase() !== 'unknown'
}

function buildOverviewRows(product, { currency, manufacturedFromYear, productionYears, displayName }) {
  if (!product) return []

  const rows = [
    { label: 'Brand', value: product.brand },
    { label: 'Model', value: product.model || displayName },
  ]

  if (productHasValuationRrp(product)) {
    rows.push({
      label: 'Estimated original RRP',
      value: formatValuationMoney(product.original_base_price, currency),
    })
  }

  if (productionYears) {
    rows.push({
      label: PRODUCTION_YEARS_LABEL,
      value: productionYears,
    })
  } else if (productHasValuationBaselineYear(product) && manufacturedFromYear != null) {
    rows.push({
      label: MANUFACTURED_FROM_LABEL,
      value: String(manufacturedFromYear),
    })
  }

  return rows
}

function EquipmentModelPage() {
  const { canonical_product_key: canonicalProductKey } = useParams()
  const showDraftAndStaleContent = isDraftProductContentPubliclyVisible()
  const [product, setProduct] = useState(null)
  const [productConsoleOptions, setProductConsoleOptions] = useState([])
  const [consoleVariants, setConsoleVariants] = useState([])
  const [modifiers, setModifiers] = useState([])
  const [pageContent, setPageContent] = useState(null)
  const [relatedEntries, setRelatedEntries] = useState([])
  const [actualManufactureYear, setActualManufactureYear] = useState('')
  const [consoleName, setConsoleName] = useState('')
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [error, setError] = useState(null)

  const displayName = getEquipmentProductDisplayName(product)
  const currency = product?.original_base_price_currency ?? 'GBP'
  const currentYear = new Date().getFullYear()
  const completion = product ? getEquipmentProductCompletionStatus(product) : null
  const showConsoleVariants = supportsProductConsoleOptions(product)
  const selectedManufactureYear = parseSelectedManufactureYear(actualManufactureYear)
  const filteredConsoleVariants = useMemo(() => {
    if (!productConsoleOptions.length || selectedManufactureYear == null) return []
    const compat = getCompatibleConsoleOptions({
      manufactureYear: selectedManufactureYear,
      options: productConsoleOptions,
      audience: 'public',
    })
    return (compat.displayOptions ?? compat.options).map((option) => option.label)
  }, [productConsoleOptions, selectedManufactureYear])
  const consoleImageUrlByName = useMemo(
    () => buildProductConsoleImageMap(productConsoleOptions),
    [productConsoleOptions],
  )
  const productImageUrl = useMemo(
    () => resolveEquipmentProductImageDisplayUrl(product, supabase, { warn: import.meta.env.DEV }),
    [product],
  )
  const showApprovedImageResolveFailure = import.meta.env.DEV
    && productHasDisplayableImage(product)
    && !productImageUrl

  const hasConsoleOptions = showConsoleVariants && (
    productConsoleOptions.length > 0 || consoleVariants.length > 0
  )

  const seoBundle = useMemo(() => {
    if (!product) return null
    return buildEquipmentPageSeoBundle(product, {
      seoTitle: pageContent?.seo?.title || null,
      seoDescription: pageContent?.seo?.description || null,
      hasConsoleOptions,
      brandSlug: product.brand ? getBrandSlug(product.brand) : null,
      brandDisplayName: product.brand,
      imageUrl: getApprovedEquipmentImage(product) || productImageUrl,
    })
  }, [product, pageContent?.seo?.title, pageContent?.seo?.description, hasConsoleOptions, productImageUrl])

  usePageMeta({
    title: seoBundle?.titleForHook || (notFound ? 'Product not found' : 'Equipment product'),
    description: seoBundle?.description
      || (notFound
        ? 'This equipment product could not be found on Equipd.'
        : 'Equipment product guide on Equipd.'),
    canonicalPath: seoBundle?.canonicalPath || null,
    noIndex: loading || notFound || error || Boolean(seoBundle && !seoBundle.indexability.indexable),
    openGraph: seoBundle?.openGraph || null,
  })

  const pageJsonLd = useMemo(
    () => (seoBundle?.jsonLd ? excludeBreadcrumbSchemas(seoBundle.jsonLd) : null),
    [seoBundle],
  )
  const breadcrumbSchema = useMemo(() => {
    if (!seoBundle?.jsonLd || seoBundle?.indexability?.indexable === false) return null
    return findBreadcrumbSchemas(seoBundle.jsonLd)[0] || null
  }, [seoBundle])

  useEffect(() => {
    if (loading) return

    let cancelled = false

    async function loadContent() {
      if (!product?.id) {
        setPageContent(null)
        return
      }

      const contentResult = await fetchEquipmentProductPageContent(product.id, {
        showDraftAndStale: showDraftAndStaleContent,
      })

      if (cancelled) return

      const resolved = resolveEquipmentProductPageContent({
        contentRow: contentResult.content,
        showDraftAndStale: showDraftAndStaleContent,
      })

      setPageContent(resolved)
    }

    loadContent()
    return () => { cancelled = true }
  }, [
    loading,
    product?.canonical_product_key,
    product?.id,
    showDraftAndStaleContent,
  ])

  useEffect(() => {
    if (loading || !product) {
      setRelatedEntries([])
      return undefined
    }

    let cancelled = false
    async function loadRelated() {
      const result = await fetchRelatedPublicEquipmentProducts(product, { limit: 6 })
      if (cancelled) return
      setRelatedEntries(result.related ?? [])
    }
    loadRelated()
    return () => { cancelled = true }
  }, [loading, product])

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)
      setNotFound(false)
      setRelatedEntries([])
      setPageContent(null)

      const result = await fetchEquipmentProductPageData(canonicalProductKey)
      if (cancelled) return

      if (result.notFound) {
        setProduct(null)
        setNotFound(true)
        setLoading(false)
        return
      }

      if (result.error) {
        setProduct(null)
        setError(result.error)
        setLoading(false)
        return
      }

      setProduct(result.product)
      setProductConsoleOptions(result.productConsoleOptions ?? [])
      setConsoleVariants(result.consoleVariants ?? [])
      setModifiers(result.modifiers ?? [])
      const defaultYear = resolveManufactureYearSelectValue(
        result.product,
        getDefaultProductManufactureYear(result.product),
        { console_compatibility: result.productConsoleOptions ?? [] },
      )
      setActualManufactureYear(defaultYear)
      setConsoleName(resolveDefaultConsoleName({
        productConsoleOptions: result.productConsoleOptions ?? [],
        manufactureYear: defaultYear,
      }))
      setLoading(false)
    }

    load()
    return () => { cancelled = true }
  }, [canonicalProductKey])

  const productValuation = useMemo(() => {
    if (!product) return null
    return calculateEquipmentProductValuation(product, {
      condition: 'Good',
      current_year: currentYear,
      actual_manufacture_year: selectedManufactureYear,
      console_name: consoleName || null,
      console_key: consoleName || null,
      modifiers,
      product_console_options: productConsoleOptions,
    })
  }, [product, currentYear, selectedManufactureYear, consoleName, modifiers, productConsoleOptions])

  useEffect(() => {
    if (!product) return

    const defaultConsole = resolveDefaultConsoleName({
      productConsoleOptions,
      manufactureYear: actualManufactureYear,
    })

    if (!defaultConsole) {
      if (consoleName) setConsoleName('')
      return
    }

    if (
      !consoleName
      || shouldResetConsoleForYearChange({
        product,
        manufactureYear: actualManufactureYear,
        consoleName,
        productConsoleOptions,
      })
    ) {
      setConsoleName(defaultConsole)
    }
  }, [actualManufactureYear, consoleName, product, productConsoleOptions])

  const consoleCompat = resolveConsoleCompatForYear({
    productConsoleOptions,
    manufactureYear: actualManufactureYear,
  })
  const showConsoleField = showConsoleVariants && shouldShowConsoleEvidence(consoleCompat)

  const depreciationGraphData = useMemo(() => {
    if (!product || !productValuation?.ok) return null
    return buildEquipmentDepreciationGraphDataFromProduct(product, {
      current_year: currentYear,
      condition: 'Good',
      depreciation_year_used: productValuation.depreciation_year_used,
      console_name: consoleName || null,
      console_key: consoleName || null,
      modifiers,
      product_console_options: productConsoleOptions,
    })
  }, [product, productValuation, currentYear, consoleName, modifiers, productConsoleOptions])

  const manufacturedFromYear = getProductManufacturedFromYear(product)
  const productionYears = formatProductProductionYears(product)
  const overviewRows = buildOverviewRows(product, {
    currency,
    manufacturedFromYear,
    productionYears,
    displayName,
  })

  const valuationUrl = product?.canonical_product_key
    ? `/valuation?product=${encodeURIComponent(product.canonical_product_key)}`
    : '/valuation'
  const showGeneratedAbout = Boolean(pageContent?.content?.overview_text)
  const showFallbackAbout = Boolean(product) && !showGeneratedAbout
  const showGeneratedFaqs = pageContent?.faqs?.length > 0
  const brandSlug = product?.brand ? getBrandSlug(product.brand) : null
  const brandPath = brandSlug ? getBrandPagePath(brandSlug) : null
  const internalLinks = seoBundle?.internalLinks || []

  if (loading) {
    return (
      <StatusBlock title="Loading equipment product">
        <p>Fetching product details…</p>
      </StatusBlock>
    )
  }

  if (notFound) {
    return (
      <StatusBlock title="Product not found">
        <p>
          No approved product found for <code>{canonicalProductKey}</code>.
        </p>
        <Link to="/valuation" className="equipment-model-page__cta equipment-model-page__cta--primary">
          Search valuation catalogue
        </Link>
      </StatusBlock>
    )
  }

  if (error || !product) {
    return (
      <StatusBlock title="Unable to load product">
        <p>{error?.message || 'Something went wrong. Please try again.'}</p>
      </StatusBlock>
    )
  }

  return (
    <article className="equipment-model-page">
      <JsonLd data={pageJsonLd} />
      <BreadcrumbSchema schema={breadcrumbSchema} />
      <div className="equipment-model-page__layout">
        <nav className="equipment-model-page__breadcrumb" aria-label="Breadcrumb">
          <Link to="/">Home</Link>
          <span aria-hidden="true">/</span>
          <Link to="/brands">Equipment Values</Link>
          {brandPath ? (
            <>
              <span aria-hidden="true">/</span>
              <Link to={brandPath}>{product.brand}</Link>
            </>
          ) : null}
          <span aria-hidden="true">/</span>
          <span>{displayName}</span>
        </nav>

        <div className="equipment-model-page__media">
          {productImageUrl ? (
            <>
              <img
                src={productImageUrl}
                alt={displayName}
                className="equipment-model-page__image"
                width={800}
                height={800}
                loading="eager"
                fetchPriority="high"
                decoding="async"
              />
              <p className="equipment-model-page__image-note" role="note">
                <svg
                  className="equipment-model-page__image-note-icon"
                  viewBox="0 0 16 16"
                  width="14"
                  height="14"
                  fill="none"
                  aria-hidden="true"
                >
                  <circle cx="8" cy="8" r="6.25" stroke="currentColor" strokeWidth="1.25" />
                  <path
                    d="M8 7.25v4M8 5.25h.01"
                    stroke="currentColor"
                    strokeWidth="1.35"
                    strokeLinecap="round"
                  />
                </svg>
                <span>
                  Representative product image. Equipment appearance may vary depending on the
                  manufacture year, console configuration or production revision.
                </span>
              </p>
            </>
          ) : (
            <div className="equipment-model-page__image-placeholder" aria-hidden="true">
              <span>Product image coming soon</span>
              {showApprovedImageResolveFailure ? (
                <p className="equipment-model-page__image-debug">
                  Approved image exists but could not resolve URL — check console.
                </p>
              ) : null}
            </div>
          )}
        </div>

        <header className="equipment-model-page__identity">
          <p className="equipment-model-page__brand">{product.brand}</p>
          <h1 className="equipment-model-page__title">{displayName}</h1>
          {hasDisplayableEquipmentType(product.equipment_type) ? (
            <p className="equipment-model-page__equipment-type">{product.equipment_type}</p>
          ) : null}
        </header>

        <div className="equipment-model-page__valuation">
          <EquipmentProductValuationCard
            product={product}
            valuation={productValuation}
            currency={currency}
            manufactureYear={actualManufactureYear}
            onManufactureYearChange={setActualManufactureYear}
            consoleName={consoleName}
            onConsoleNameChange={setConsoleName}
            productConsoleOptions={productConsoleOptions}
            currentYear={currentYear}
            valuationUrl={valuationUrl}
            canValue={completion?.canValue}
            showConsoleField={showConsoleField}
          />
        </div>

        <section
          className="equipment-model-page__overview"
          aria-labelledby="equipment-overview-title"
        >
          <h2 id="equipment-overview-title" className="equipment-model-page__section-title">
            Overview
          </h2>
          <dl className="equipment-model-page__overview-list">
            {overviewRows.map((row) => (
              <div key={row.label} className="equipment-model-page__overview-row">
                <dt>{row.label}</dt>
                <dd>{row.value}</dd>
              </div>
            ))}
          </dl>
        </section>

        {showGeneratedAbout ? (
          <div className="equipment-model-page__generated-about">
            <EquipmentProductAboutSection
              overviewText={pageContent.content.overview_text}
              contentBadgeLabel={pageContent.contentBadgeLabel}
            />
          </div>
        ) : null}

        {showFallbackAbout ? (
          <section
            className="equipment-model-page__generated-about"
            aria-labelledby="equipment-about-fallback-title"
          >
            <h2 id="equipment-about-fallback-title" className="equipment-model-page__section-title">
              Product information
            </h2>
            <p>{buildFactualOverviewFallback(product)}</p>
          </section>
        ) : null}

        {showConsoleVariants && filteredConsoleVariants.length > 0 ? (
          <div className="equipment-model-page__consoles">
            <EquipmentConsoleVariantCards
              variants={filteredConsoleVariants}
              imageUrlByName={consoleImageUrlByName}
              brandName={product.brand}
              mode={consoleCompat.fixedOnly || filteredConsoleVariants.length === 1 ? 'fixed' : 'compare'}
              integrated={Boolean(consoleCompat.fixedOnly)}
            />
          </div>
        ) : null}

        {depreciationGraphData ? (
          <div className="equipment-model-page__graph">
            <Suspense fallback={<p className="equipment-model-page__graph-fallback">Loading value chart…</p>}>
              <EquipmentDepreciationGraph
                graphData={depreciationGraphData}
                currency={currency}
              />
            </Suspense>
          </div>
        ) : null}

        {showGeneratedFaqs ? (
          <div className="equipment-model-page__generated-faq">
            <EquipmentProductFaqSection
              faqs={pageContent.faqs}
              contentBadgeLabel={pageContent.contentBadgeLabel}
            />
          </div>
        ) : null}

        {relatedEntries.length > 0 ? (
          <section
            className="equipment-model-page__related"
            aria-labelledby="equipment-related-title"
          >
            <h2 id="equipment-related-title" className="equipment-model-page__section-title">
              Related equipment
            </h2>
            <ul className="equipment-model-page__related-grid">
              {relatedEntries.map((entry, index) => (
                <li key={entry.href} className="equipment-model-page__related-item">
                  <RelatedEquipmentCard
                    product={entry.product}
                    href={entry.href}
                    name={entry.name}
                    priority={index < 4}
                  />
                </li>
              ))}
            </ul>
            {internalLinks.length > 0 ? (
              <nav
                className="equipment-model-page__explore-block"
                aria-labelledby="equipment-explore-title"
              >
                <p id="equipment-explore-title" className="equipment-model-page__explore-label">
                  Explore more
                </p>
                <ul className="equipment-model-page__explore-links">
                  {internalLinks.map((link) => (
                    <li key={link.href}>
                      <Link to={link.href} className="equipment-model-page__explore-link">
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            ) : null}
          </section>
        ) : internalLinks.length > 0 ? (
          <nav
            className="equipment-model-page__explore equipment-model-page__explore-block"
            aria-labelledby="equipment-explore-title-solo"
          >
            <p id="equipment-explore-title-solo" className="equipment-model-page__explore-label">
              Explore more
            </p>
            <ul className="equipment-model-page__explore-links">
              {internalLinks.map((link) => (
                <li key={link.href}>
                  <Link to={link.href} className="equipment-model-page__explore-link">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ) : null}

        <p className="equipment-model-page__disclaimer">
          {VALUATION_ESTIMATE_DISCLAIMER}
        </p>
      </div>
    </article>
  )
}

export default EquipmentModelPage
