import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import EquipmentDepreciationGraph from '../components/equipment/EquipmentDepreciationGraph'
import ValuationStepper, {
  VALUATION_STEPPER_STEPS,
} from '../components/valuation/ValuationStepper'
import { usePageMeta } from '../hooks/usePageMeta'
import { buildSocialOpenGraph } from '../lib/socialPreview'
import EquipmentValuationDetailsFields, {
  shouldResetConsoleForYearChange,
} from '../components/equipment/EquipmentValuationDetailsFields'
import {
  buildEquipmentProductPagePath,
  fetchEquipmentProductByKey,
} from '../lib/equipmentProducts'
import { resolveEquipmentProductImageUrl } from '../lib/equipmentProductImages'
import {
  getValuationSearchIndex,
  getValuationConsoleModifiers,
  getProductConsoleOptionsCached,
  prefetchProductConsoleOptions,
  prefetchValuationSearchIndex,
} from '../lib/valuationCatalogCache'
import { getDefaultCompatibleConsoleName } from '../lib/consoleCompatibility'
import { buildCreateListingFromValuationPath } from '../lib/createListingFromEquipment'
import { formatEquipmentProductSearchSuggestion } from '../lib/equipmentProductSearch'
import {
  VALUATION_CONDITION_OPTIONS,
  INSUFFICIENT_VALUATION_MESSAGE,
  buildValuationExplanationLines,
  buildEquipmentDepreciationGraphDataFromProduct,
  calculateEquipmentProductValuation,
  formatProductProductionYears,
  getProductManufacturedFromYear,
  MANUFACTURED_FROM_LABEL,
  PRODUCTION_YEARS_LABEL,
  parseSelectedManufactureYear,
  formatValuationMoney,
  formatValuationRange,
  getEquipmentProductCompletionStatus,
  getEquipmentProductDisplayName,
  getEquipmentProductSlug,
  getDefaultProductManufactureYear,
  resolveManufactureYearSelectValue,
  productHasValuationBaselineYear,
  productHasValuationRrp,
  resolveValuationSearchMatches,
  shouldClearSelectedValuationProduct,
  shouldValuationProductPageLinkStopSelection,
  buildValuationEstimateDisclaimer,
  buildValuationGraphCaption,
} from '../lib/equipmentValuation'
import {
  formatCanonicalSuggestionYears,
  resolveValuationProductFromCatalog,
  VALUATION_DETAILS_STEP,
} from '../lib/valuationNavigation'
import {
  VALUATION_PROGRESS_ANCHOR_ID,
  VALUATION_SELECTED_PRODUCT_ANCHOR_ID,
  cancelValuationAnchorScroll,
  cancelValuationPreviewHighlightTimer,
  scheduleValuationPreviewHighlight,
  scrollToSelectedProduct,
  scrollToValuationProgress,
} from '../lib/scrollToValuationAnchor'
import { supabase } from '../lib/supabase'

import './ValuationPage.css'

const RESULT_DISPLAY_LIMIT = 25

const POPULAR_BRANDS = [
  { name: 'Technogym', logo: '/brand-logos/technogym.png' },
  { name: 'Life Fitness', logo: '/brand-logos/life-fitness.png' },
  { name: 'Matrix', logo: '/brand-logos/matrix-fitness.png', query: 'Matrix' },
  { name: 'Concept2', logo: '/brand-logos/concept2.png' },
  { name: 'Hammer Strength', logo: '/brand-logos/hammer-strength.png' },
]

function formatProductYearsLabel(product) {
  const productionYears = formatProductProductionYears(product)
  if (productionYears) return productionYears

  const suggestionYears = formatCanonicalSuggestionYears(product)
  if (suggestionYears) {
    return suggestionYears.endsWith('+')
      ? `${suggestionYears.slice(0, -1)} – Present`
      : suggestionYears.replace('-', ' – ')
  }

  const start = Number(product?.production_start_year)
    || Number(product?.baseline_manufacture_year)
  if (Number.isFinite(start)) return `${start} – Present`
  return null
}

function ProductThumb({ product, className = '', size = 72 }) {
  const imageUrl = resolveEquipmentProductImageUrl(product, supabase)
  const label = getEquipmentProductDisplayName(product)

  if (!imageUrl) {
    return (
      <span
        className={`valuation-page__thumb valuation-page__thumb--placeholder ${className}`.trim()}
        style={{ width: size, height: size }}
        aria-hidden="true"
      />
    )
  }

  return (
    <span
      className={`valuation-page__thumb ${className}`.trim()}
      style={{ width: size, height: size }}
    >
      <img
        src={imageUrl}
        alt=""
        width={size}
        height={size}
        className="valuation-page__thumb-image"
        loading="lazy"
        decoding="async"
      />
      <span className="visually-hidden">{label}</span>
    </span>
  )
}

function OptionGroup({ name, options, value, onChange, className = '' }) {
  return (
    <div className={`valuation-page__option-grid ${className}`.trim()} role="group" aria-label={name}>
      {options.map((option) => {
        const selected = value === option.value
        return (
          <button
            key={option.value}
            type="button"
            className={`valuation-page__option${selected ? ' valuation-page__option--selected' : ''}`}
            aria-pressed={selected}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}

function ProductFacts({ product, currency }) {
  const yearsLabel = formatProductYearsLabel(product)
  const suggestion = formatEquipmentProductSearchSuggestion(product)
  const equipmentType = suggestion.equipmentType || product.equipment_type
  const hasRrp = productHasValuationRrp(product)

  return (
    <div className="valuation-page__preview-meta">
      {equipmentType ? (
        <span className="valuation-page__type-pill">{equipmentType}</span>
      ) : null}
      <div
        className={[
          'valuation-page__rrp-badge',
          hasRrp ? '' : 'valuation-page__rrp-badge--missing',
        ].filter(Boolean).join(' ')}
      >
        <span className="valuation-page__rrp-label">Original RRP</span>
        <strong className="valuation-page__rrp-value">
          {hasRrp
            ? formatValuationMoney(product.original_base_price, currency)
            : 'Missing'}
        </strong>
      </div>
      {yearsLabel ? (
        <p className="valuation-page__years">
          <span className="valuation-page__years-label">{PRODUCTION_YEARS_LABEL}</span>
          <span className="valuation-page__years-value">{yearsLabel}</span>
        </p>
      ) : (
        <p className="valuation-page__years">
          <span className="valuation-page__years-label">{MANUFACTURED_FROM_LABEL}</span>
          <span className="valuation-page__years-value">
            {productHasValuationBaselineYear(product)
              ? String(getProductManufacturedFromYear(product))
              : 'Missing'}
          </span>
        </p>
      )}
    </div>
  )
}

function ProductSummaryCard({
  product,
  currency,
  onChangeProduct = null,
}) {
  const suggestion = formatEquipmentProductSearchSuggestion(product)
  const completion = getEquipmentProductCompletionStatus(product)
  const productPagePath = buildEquipmentProductPagePath(product.canonical_product_key)
  const modelName = suggestion.model || getEquipmentProductDisplayName(product)

  return (
    <aside className="valuation-page__preview-card valuation-page__preview-card--filled">
      <div className="valuation-page__preview-media">
        <ProductThumb product={product} size={148} className="valuation-page__thumb--preview" />
      </div>

      <div className="valuation-page__preview-copy">
        <p className="valuation-page__preview-brand">
          {suggestion.brand || product.brand}
        </p>
        <h3 className="valuation-page__preview-title">{modelName}</h3>
        {suggestion.series ? (
          <p className="valuation-page__preview-series">{suggestion.series}</p>
        ) : null}
      </div>

      <ProductFacts product={product} currency={currency} />

      {!completion.canValue ? (
        <p className="valuation-page__warning" role="status">
          {INSUFFICIENT_VALUATION_MESSAGE}
        </p>
      ) : null}

      <div className="valuation-page__preview-actions">
        {productPagePath ? (
          <Link to={productPagePath} className="valuation-page__text-link">
            View full product page
          </Link>
        ) : null}
        {onChangeProduct ? (
          <button
            type="button"
            className="valuation-page__button valuation-page__button--secondary valuation-page__button--compact"
            onClick={onChangeProduct}
          >
            Change product
          </button>
        ) : null}
      </div>
    </aside>
  )
}

function ProductResultRow({ product, selected, onSelect, currency }) {
  const productPagePath = buildEquipmentProductPagePath(product.canonical_product_key)
  const suggestion = formatEquipmentProductSearchSuggestion(product)
  const yearsLabel = formatProductYearsLabel(product)
  const modelName = suggestion.model || getEquipmentProductDisplayName(product)
  const equipmentType = suggestion.equipmentType || product.equipment_type

  return (
    <div
      role="option"
      tabIndex={0}
      aria-selected={selected}
      className={[
        'valuation-page__result-row',
        selected ? 'valuation-page__result-row--selected' : '',
      ].filter(Boolean).join(' ')}
      onClick={() => onSelect(product)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onSelect(product)
        }
      }}
    >
      <ProductThumb product={product} size={64} />
      <div className="valuation-page__result-body">
        <p className="valuation-page__result-brand">
          {suggestion.brand || product.brand}
        </p>
        <p className="valuation-page__result-title">{modelName}</p>
        <div className="valuation-page__result-meta">
          {equipmentType ? <span>{equipmentType}</span> : null}
          {yearsLabel ? <span>{yearsLabel}</span> : null}
          <span>
            {productHasValuationRrp(product)
              ? `Original RRP ${formatValuationMoney(product.original_base_price, currency)}`
              : 'RRP missing'}
          </span>
        </div>
        {productPagePath ? (
          <Link
            to={productPagePath}
            className="valuation-page__result-link"
            onClick={shouldValuationProductPageLinkStopSelection}
          >
            View product page
          </Link>
        ) : null}
      </div>
      <span className="valuation-page__result-arrow" aria-hidden="true">
        <svg viewBox="0 0 20 20" width="18" height="18" fill="none">
          <path
            d="M7.5 4.5 13 10l-5.5 5.5"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
    </div>
  )
}

function EmptyPreview() {
  return (
    <aside className="valuation-page__preview-card valuation-page__preview-card--empty">
      <div className="valuation-page__preview-empty-art" aria-hidden="true">
        <svg viewBox="0 0 120 88" width="120" height="88" fill="none">
          <rect x="18" y="18" width="84" height="52" rx="12" fill="currentColor" opacity="0.08" />
          <circle cx="44" cy="42" r="10" stroke="currentColor" strokeWidth="2" opacity="0.35" />
          <path
            d="M34 58h52M58 34h24M58 42h16"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            opacity="0.35"
          />
        </svg>
      </div>
      <h3 className="valuation-page__preview-empty-title">Select a product to continue</h3>
      <p className="valuation-page__preview-empty-copy">
        Search for your equipment and choose the closest matching model.
      </p>
    </aside>
  )
}

function ValuationPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const location = useLocation()
  const productKeyParam = searchParams.get('product')?.trim()
    || searchParams.get('model')?.trim()
  const initialQueryParam = searchParams.get('q')?.trim() || ''
  const stepParam = searchParams.get('step')?.trim() || ''
  const routedProduct = location.state?.product
    && location.state.product?.canonical_product_key === productKeyParam
    ? location.state.product
    : null

  const [step, setStep] = useState(
    productKeyParam && stepParam !== 'product' ? VALUATION_DETAILS_STEP : 'product',
  )
  const [products, setProducts] = useState([])
  const [modifiers, setModifiers] = useState([])
  const [productConsoleOptions, setProductConsoleOptions] = useState([])
  const [catalogLoading, setCatalogLoading] = useState(true)
  const [catalogError, setCatalogError] = useState(null)

  const [searchQuery, setSearchQuery] = useState(initialQueryParam)
  const [selectedProduct, setSelectedProduct] = useState(routedProduct)
  const [prefillLoading, setPrefillLoading] = useState(Boolean(productKeyParam) && !routedProduct)
  const [prefillError, setPrefillError] = useState(null)

  const [condition, setCondition] = useState('Good')
  const [actualManufactureYear, setActualManufactureYear] = useState('')
  const [consoleName, setConsoleName] = useState('')
  const [formError, setFormError] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [valuation, setValuation] = useState(null)

  const currentYear = new Date().getFullYear()
  const prefilledProductKeyRef = useRef(null)
  const ignorePrefillRef = useRef(false)
  const prevStepRef = useRef(null)
  const [previewHighlight, setPreviewHighlight] = useState(false)

  usePageMeta({
    title: 'Instant Equipment Valuation',
    description:
      'Estimate the used market value of eligible gym equipment on Equipd, then buy or sell on the UK marketplace.',
    canonicalPath: '/valuation',
    openGraph: buildSocialOpenGraph({
      title: 'Instant Equipment Valuation | Equipd',
      description:
        'Estimate the used market value of eligible gym equipment on Equipd, then buy or sell on the UK marketplace.',
      url: 'https://www.equipd.co.uk/valuation',
      fallbackImage: true,
    }),
  })

  // Keep the progress timeline visible under the sticky header after stage changes.
  // Skip empty Product first paint; still scroll for deep-linked Details/Estimate.
  // prevStepRef also absorbs React Strict Mode remounts (same step → no re-scroll).
  useEffect(() => {
    const previousStep = prevStepRef.current
    if (previousStep === step) return undefined
    prevStepRef.current = step

    const isInitialProductLanding = previousStep == null && step === 'product'
    if (isInitialProductLanding) return undefined

    cancelValuationPreviewHighlightTimer()
    scrollToValuationProgress({
      behavior: previousStep == null ? 'auto' : 'smooth',
      extraOffset: 12,
    })

    return () => {
      cancelValuationAnchorScroll()
    }
  }, [step])

  /**
   * Shared action for homepage product entry and in-page continue CTA.
   * Resets stale inputs and advances to the equipment-details step.
   */
  const startValuationForProduct = useCallback((product) => {
    if (!product) return
    setSelectedProduct(product)
    setSearchQuery(getEquipmentProductDisplayName(product))
    setCondition('Good')
    setConsoleName('')
    setActualManufactureYear(resolveManufactureYearSelectValue(
      product,
      getDefaultProductManufactureYear(product),
    ))
    setFormError(null)
    setPrefillError(null)
    setValuation(null)
    setStep(VALUATION_DETAILS_STEP)
  }, [])

  // Revalidate compact search rows into authoritative product details in the background.
  useEffect(() => {
    const key = selectedProduct?.canonical_product_key
    if (!key) return undefined
    // Compact index rows omit confidence / source fields — refresh once by key.
    if (selectedProduct?.original_price_confidence != null || selectedProduct?.baseline_source != null) {
      return undefined
    }

    let cancelled = false
    async function revalidate() {
      const result = await fetchEquipmentProductByKey(key)
      if (cancelled || result.error || !result.product) return
      if (result.product.canonical_product_key !== key) return
      setSelectedProduct((current) => (
        current?.canonical_product_key === key ? { ...current, ...result.product } : current
      ))
    }
    revalidate()
    return () => { cancelled = true }
  }, [selectedProduct?.canonical_product_key, selectedProduct?.original_price_confidence, selectedProduct?.baseline_source])

  useEffect(() => {
    prefetchValuationSearchIndex()
  }, [])

  useEffect(() => {
    let cancelled = false

    async function loadCatalog() {
      setCatalogLoading(true)
      setCatalogError(null)

      const [productsResult, modifiersResult] = await Promise.all([
        getValuationSearchIndex(),
        getValuationConsoleModifiers(),
      ])

      if (cancelled) return

      if (productsResult.error) {
        setProducts([])
        setCatalogError(productsResult.error)
      } else {
        setProducts(productsResult.products ?? [])
      }

      setModifiers(modifiersResult.modifiers ?? [])
      setCatalogLoading(false)
    }

    loadCatalog()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (ignorePrefillRef.current) {
      if (!productKeyParam) {
        ignorePrefillRef.current = false
      }
      prefilledProductKeyRef.current = null
      setPrefillLoading(false)
      return undefined
    }

    if (!productKeyParam) {
      prefilledProductKeyRef.current = null
      setPrefillLoading(false)
      return undefined
    }

    let cancelled = false

    async function prefillProduct() {
      if (
        prefilledProductKeyRef.current === productKeyParam
        && selectedProduct?.canonical_product_key === productKeyParam
      ) {
        setPrefillLoading(false)
        return
      }

      // Fast path: product already passed via router state from homepage search.
      if (
        routedProduct
        && routedProduct.canonical_product_key === productKeyParam
      ) {
        if (!cancelled) {
          prefilledProductKeyRef.current = productKeyParam
          startValuationForProduct(routedProduct)
          setPrefillLoading(false)
          prefetchProductConsoleOptions(routedProduct.id)
        }
        return
      }

      setPrefillLoading(true)
      setPrefillError(null)

      // Prefer catalogue product when loaded so selection IDs stay aligned.
      const catalogProduct = resolveValuationProductFromCatalog(products, productKeyParam)
      if (catalogProduct) {
        if (!cancelled) {
          prefilledProductKeyRef.current = productKeyParam
          startValuationForProduct(catalogProduct)
          setPrefillLoading(false)
        }
        return
      }

      // Do not block details on the full catalogue — fetch the product by key
      // in parallel while the catalogue continues loading in the background.
      const result = await fetchEquipmentProductByKey(productKeyParam)
      if (cancelled) return

      if (result.error) {
        // Catalogue may still resolve the product; keep waiting if it is loading.
        if (catalogLoading) return
        prefilledProductKeyRef.current = null
        setPrefillError(result.error)
        setSelectedProduct(null)
        setStep('product')
        setPrefillLoading(false)
        return
      }

      if (result.notFound || !result.product) {
        if (catalogLoading) return
        prefilledProductKeyRef.current = null
        setPrefillError(new Error('We could not find that equipment product.'))
        setSelectedProduct(null)
        setStep('product')
        setPrefillLoading(false)
        return
      }

      prefilledProductKeyRef.current = productKeyParam
      startValuationForProduct(result.product)
      setPrefillLoading(false)
    }

    prefillProduct()
    return () => { cancelled = true }
  }, [
    productKeyParam,
    products,
    catalogLoading,
    routedProduct,
    selectedProduct?.canonical_product_key,
    startValuationForProduct,
  ])

  useEffect(() => {
    if (!selectedProduct?.id) {
      setProductConsoleOptions([])
      return undefined
    }

    let cancelled = false

    async function loadConsoleOptions() {
      const result = await getProductConsoleOptionsCached(selectedProduct.id)
      if (cancelled) return
      const options = result.options ?? []
      setProductConsoleOptions(options)
      setActualManufactureYear((previous) => {
        const nextYear = resolveManufactureYearSelectValue(selectedProduct, previous, {
          console_compatibility: options,
        })
        const defaultConsole = getDefaultCompatibleConsoleName({
          productConsoleOptions: options,
          manufactureYear: parseSelectedManufactureYear(nextYear),
        })
        setConsoleName(defaultConsole)
        return nextYear
      })
    }

    loadConsoleOptions()
    return () => { cancelled = true }
  }, [selectedProduct?.id])

  const searchState = useMemo(
    () => resolveValuationSearchMatches(products, searchQuery),
    [products, searchQuery],
  )

  const matchCount = searchState.hasQuery
    ? (searchState.scoredMatches.length || searchState.matches.length)
    : 0

  const displayMatches = useMemo(
    () => (searchState.scoredMatches.length
      ? searchState.scoredMatches.map((entry) => entry.product)
      : searchState.matches).slice(0, RESULT_DISPLAY_LIMIT),
    [searchState.matches, searchState.scoredMatches],
  )
  const showNoMatch = searchState.showNoMatch

  useEffect(() => {
    if (!import.meta.env.DEV || !searchState.hasQuery) return

    const rows = (searchState.diagnostics ?? []).map((entry) => ({
      canonical_product_name: entry.product?.canonical_product_name ?? '',
      brandMatched: entry.brandMatched,
      equipmentIntentMatched: entry.equipmentIntentMatched,
      score: entry.score,
      excludedReason: entry.excludedReason ?? '',
      willUpdate: entry.included,
    }))

    if (rows.length) {
      console.table(rows)
    }
  }, [searchQuery, searchState.diagnostics, searchState.hasQuery])

  useEffect(() => {
    // Only clear stale selections while actively searching on the product step.
    // Never clear URL-driven details entry against an unloaded catalogue.
    if (step !== 'product') return
    if (productKeyParam) return
    if (catalogLoading || !products.length) return
    if (!selectedProduct) return
    if (shouldClearSelectedValuationProduct(selectedProduct, products, searchQuery)) {
      setSelectedProduct(null)
    }
  }, [products, searchQuery, selectedProduct, step, catalogLoading, productKeyParam])

  useEffect(() => {
    if (!selectedProduct) return
    if (shouldResetConsoleForYearChange({
      manufactureYear: actualManufactureYear,
      consoleName,
      productConsoleOptions,
    })) {
      const next = getDefaultCompatibleConsoleName({
        productConsoleOptions,
        manufactureYear: parseSelectedManufactureYear(actualManufactureYear),
      })
      setConsoleName(next)
    }
  }, [actualManufactureYear, consoleName, productConsoleOptions, selectedProduct])

  const selectedCompletion = selectedProduct
    ? getEquipmentProductCompletionStatus(selectedProduct)
    : null

  const explanationLines = valuation?.ok
    ? buildValuationExplanationLines(valuation, selectedProduct?.original_base_price_currency ?? 'GBP')
    : []

  const valuationUsesConsole = Boolean(
    valuation?.ok
    && (
      valuation.console_name
      || valuation.console_key
      || (Number(valuation.console_modifier_percent) || 0) !== 0
    ),
  )

  const valuationDisclaimer = buildValuationEstimateDisclaimer({
    includeConsole: valuationUsesConsole,
  })

  const depreciationGraphData = useMemo(() => {
    if (!selectedProduct || !valuation?.ok) return null
    return buildEquipmentDepreciationGraphDataFromProduct(selectedProduct, {
      current_year: currentYear,
      condition: valuation.condition,
      depreciation_year_used: valuation.depreciation_year_used,
      console_name: consoleName || null,
      console_key: consoleName || null,
      modifiers,
      product_console_options: productConsoleOptions,
    })
  }, [selectedProduct, valuation, currentYear, consoleName, modifiers, productConsoleOptions])

  const valuationGraphCaption = depreciationGraphData
    ? buildValuationGraphCaption({
      startYear: depreciationGraphData.startYear,
      includeConsole: valuationUsesConsole,
    })
    : null

  function handleSelectProduct(product) {
    if (!product) return
    const alreadySelected = selectedProduct?.id === product.id
    setSelectedProduct(product)
    setValuation(null)
    setFormError(null)
    setPrefillError(null)
    if (product?.id) {
      prefetchProductConsoleOptions(product.id)
    }

    // Avoid erratic re-jumps when tapping the same result again.
    if (alreadySelected) return

    const isCompactViewport = typeof window !== 'undefined'
      && typeof window.matchMedia === 'function'
      && window.matchMedia('(max-width: 1023px)').matches

    if (!isCompactViewport) return

    scrollToSelectedProduct({ behavior: 'smooth', extraOffset: 16 })
    scheduleValuationPreviewHighlight(setPreviewHighlight)
  }

  function handleClearSelectedProduct() {
    setSelectedProduct(null)
    setValuation(null)
    setFormError(null)
    setPreviewHighlight(false)
    cancelValuationPreviewHighlightTimer()
    const input = document.getElementById('valuation-product-search')
    input?.focus?.()
  }

  function handleContinueWithProduct(product = selectedProduct) {
    if (typeof document !== 'undefined') {
      document.activeElement?.blur?.()
    }
    if (product?.id) {
      prefetchProductConsoleOptions(product.id)
    }
    startValuationForProduct(product)
    if (product?.canonical_product_key) {
      const next = new URLSearchParams()
      next.set('product', product.canonical_product_key)
      next.set('step', VALUATION_DETAILS_STEP)
      setSearchParams(next, { replace: true, state: { product } })
    }
  }

  function handleBrandShortcut(brand) {
    const query = brand.query || brand.name
    setSearchQuery(query)
    setSelectedProduct(null)
    setValuation(null)
    const input = document.getElementById('valuation-product-search')
    input?.focus?.()
  }

  function handleChangeProduct() {
    setStep('product')
    setValuation(null)
    setFormError(null)
    const next = new URLSearchParams()
    if (searchQuery.trim()) next.set('q', searchQuery.trim())
    setSearchParams(next, { replace: true })
  }

  function handleSubmitDetails(event) {
    event.preventDefault()
    setFormError(null)

    if (!selectedProduct) {
      setFormError('Select an equipment product to continue.')
      setStep('product')
      return
    }

    if (!selectedCompletion?.canValue) {
      setValuation(calculateEquipmentProductValuation(selectedProduct, { current_year: currentYear }))
      setStep('results')
      return
    }

    const parsedActualYear = parseSelectedManufactureYear(actualManufactureYear)

    setSubmitting(true)

    const result = calculateEquipmentProductValuation(selectedProduct, {
      condition,
      actual_manufacture_year: parsedActualYear,
      console_name: consoleName || null,
      console_key: consoleName || null,
      current_year: currentYear,
      modifiers,
      product_console_options: productConsoleOptions,
    })

    setValuation(result)
    setSubmitting(false)
    setStep('results')
  }

  function handleStartOver() {
    // Block URL-driven prefill while search params catch up with local reset.
    ignorePrefillRef.current = true
    prefilledProductKeyRef.current = null
    setSearchParams({}, { replace: true })
    setStep('product')
    setSelectedProduct(null)
    setSearchQuery('')
    setCondition('Good')
    setActualManufactureYear('')
    setConsoleName('')
    setProductConsoleOptions([])
    setValuation(null)
    setFormError(null)
    setPrefillError(null)
    setPrefillLoading(false)
    setSubmitting(false)
  }

  const selectedDisplayName = getEquipmentProductDisplayName(selectedProduct)
  const selectedSlug = getEquipmentProductSlug(selectedProduct)
  const currency = selectedProduct?.original_base_price_currency ?? 'GBP'
  const selectedSuggestion = selectedProduct
    ? formatEquipmentProductSearchSuggestion(selectedProduct)
    : null

  const createListingPath = useMemo(() => {
    if (!selectedProduct || !valuation) return '/sell'
    return buildCreateListingFromValuationPath({
      product: selectedProduct,
      valuation,
      condition,
      manufactureYear: parseSelectedManufactureYear(actualManufactureYear),
      consoleName: consoleName || null,
      displayName: selectedDisplayName,
    })
  }, [
    actualManufactureYear,
    condition,
    consoleName,
    selectedDisplayName,
    selectedProduct,
    valuation,
  ])

  const similarBrowsePath = selectedSuggestion?.brand
    ? `/browse?brand=${encodeURIComponent(selectedSuggestion.brand)}`
    : '/browse'

  return (
    <div
      className={[
        'valuation-page',
        step === 'details' ? 'valuation-page--details' : '',
        step === 'results' ? 'valuation-page--results' : '',
      ].filter(Boolean).join(' ')}
    >
      <header className="valuation-page__hero">
        <div className="valuation-page__hero-pattern" aria-hidden="true" />
        <div className="valuation-page__hero-watermark" aria-hidden="true">
          <svg viewBox="0 0 280 140" width="280" height="140" fill="none">
            <path
              d="M18 108 C52 104 68 78 96 72 C128 64 146 92 178 86 C208 80 228 48 262 42"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              opacity="0.55"
            />
            <path
              d="M18 108 C52 104 68 78 96 72 C128 64 146 92 178 86 C208 80 228 48 262 42 V122 H18 Z"
              fill="currentColor"
              opacity="0.08"
            />
            <circle cx="96" cy="72" r="4" fill="currentColor" opacity="0.35" />
            <circle cx="178" cy="86" r="4" fill="currentColor" opacity="0.35" />
            <circle cx="262" cy="42" r="4.5" fill="currentColor" opacity="0.45" />
          </svg>
        </div>
        <div className="valuation-page__hero-inner">
          <p className="valuation-page__eyebrow">Instant equipment valuation</p>
          <h1 className="valuation-page__title">Value your equipment in seconds</h1>
          <p className="valuation-page__intro">
            Search thousands of commercial and home gym products, add a few details and get an
            instant estimated market value.
          </p>
        </div>
      </header>

      <div className="valuation-page__shell">
        <div
          id={VALUATION_PROGRESS_ANCHOR_ID}
          className="valuation-page__progress-anchor"
        >
          <ValuationStepper
            steps={VALUATION_STEPPER_STEPS}
            currentStepId={step}
            className="valuation-page__stepper"
          />
        </div>

        {prefillLoading || (catalogLoading && !selectedProduct && Boolean(productKeyParam)) ? (
          <section className="valuation-page__panel">
            <p className="valuation-page__status">Loading equipment details…</p>
          </section>
        ) : null}

        {!prefillLoading && !productKeyParam && catalogLoading && !selectedProduct ? (
          <section className="valuation-page__panel">
            <p className="valuation-page__status">Loading catalogue…</p>
          </section>
        ) : null}

        {!prefillLoading && catalogError ? (
          <section className="valuation-page__panel">
            <p className="valuation-page__error" role="alert">
              {catalogError.message || 'Unable to load equipment catalogue.'}
            </p>
          </section>
        ) : null}

        {!prefillLoading && !catalogLoading && !catalogError && step === 'product' ? (
          <div
            className={[
              'valuation-page__workspace',
              selectedProduct ? 'valuation-page__workspace--selected' : '',
            ].filter(Boolean).join(' ')}
          >
            <section
              className={[
                'valuation-page__panel',
                'valuation-page__panel--search',
                selectedProduct ? 'valuation-page__panel--search-selected' : '',
              ].filter(Boolean).join(' ')}
            >
              <h2 className="valuation-page__panel-title">1. Search for your equipment</h2>

              {prefillError ? (
                <p className="valuation-page__error" role="alert">{prefillError.message}</p>
              ) : null}

              <div className="valuation-page__search-shell">
                <div className="valuation-page__field valuation-page__search-field">
                  <label className="valuation-page__label" htmlFor="valuation-product-search">
                    Search
                  </label>
                  <input
                    id="valuation-product-search"
                    type="search"
                    className="valuation-page__input"
                    placeholder="Search by brand, model or product"
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    autoComplete="off"
                  />
                  <p className="valuation-page__hint">
                    Start typing to see matching products.
                  </p>
                </div>

                <div className="valuation-page__brands" aria-label="Popular brands">
                  <p className="valuation-page__brands-label">Popular brands</p>
                  <div className="valuation-page__brand-row">
                    {POPULAR_BRANDS.map((brand) => (
                      <button
                        key={brand.name}
                        type="button"
                        className="valuation-page__brand-chip"
                        onClick={() => handleBrandShortcut(brand)}
                      >
                        <img
                          src={brand.logo}
                          alt=""
                          width={96}
                          height={40}
                          className="valuation-page__brand-logo"
                          loading="lazy"
                          decoding="async"
                        />
                        <span className="valuation-page__brand-name">{brand.name}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {displayMatches.length > 0 ? (
                  <div className="valuation-page__results">
                    <div className="valuation-page__results-header">
                      <h3 className="valuation-page__results-heading">
                        <span className="valuation-page__results-heading--browse">
                          Results ({matchCount})
                        </span>
                        {selectedProduct ? (
                          <span className="valuation-page__results-heading--selected">
                            Selected product
                          </span>
                        ) : null}
                      </h3>
                    </div>
                    <div
                      className="valuation-page__matches"
                      role="listbox"
                      aria-label="Matching products"
                    >
                      {displayMatches.map((product) => (
                        <ProductResultRow
                          key={product.id}
                          product={product}
                          selected={selectedProduct?.id === product.id}
                          onSelect={handleSelectProduct}
                          currency={product.original_base_price_currency ?? 'GBP'}
                        />
                      ))}
                    </div>
                    {selectedProduct ? (
                      <button
                        type="button"
                        className="valuation-page__text-link valuation-page__show-results"
                        onClick={handleClearSelectedProduct}
                      >
                        Show all results again
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </div>

              {showNoMatch ? (
                <div className="valuation-page__empty">
                  <p>No matching products. Try a different search or list your item manually.</p>
                  <div className="valuation-page__actions">
                    <Link to="/sell" className="valuation-page__link-button valuation-page__link-button--primary">
                      List on Equipd
                    </Link>
                  </div>
                </div>
              ) : null}
            </section>

            <div
              id={VALUATION_SELECTED_PRODUCT_ANCHOR_ID}
              className="valuation-page__preview-rail valuation-page__selected-product-anchor"
            >
              {selectedProduct ? (
                <div
                  className={[
                    'valuation-page__preview-sticky',
                    previewHighlight ? 'valuation-page__preview-sticky--highlight' : '',
                  ].filter(Boolean).join(' ')}
                >
                  <ProductSummaryCard
                    product={selectedProduct}
                    currency={currency}
                    onChangeProduct={handleClearSelectedProduct}
                  />
                  <button
                    type="button"
                    className="valuation-page__button valuation-page__button--primary valuation-page__continue"
                    onClick={() => handleContinueWithProduct(selectedProduct)}
                  >
                    Continue to details
                  </button>
                  <p className="valuation-page__reassure">No personal details required</p>
                </div>
              ) : (
                <EmptyPreview />
              )}
            </div>
          </div>
        ) : null}

        {!prefillLoading && !catalogError && step === 'details' && selectedProduct ? (
          <div className="valuation-page__workspace">
            <section className="valuation-page__panel valuation-page__panel--details">
              <div className="valuation-page__details-header">
                <h2 className="valuation-page__panel-title">2. Equipment details</h2>
              </div>

              <form className="valuation-page__details-form" onSubmit={handleSubmitDetails}>
                <EquipmentValuationDetailsFields
                  product={selectedProduct}
                  productConsoleOptions={productConsoleOptions}
                  manufactureYear={actualManufactureYear}
                  onManufactureYearChange={setActualManufactureYear}
                  consoleName={consoleName}
                  onConsoleNameChange={setConsoleName}
                  currentYear={currentYear}
                  disabled={!selectedCompletion?.canValue}
                  manufactureYearId="valuation-actual-year"
                  consoleId="valuation-console"
                />

                <div className="valuation-page__field">
                  <span className="valuation-page__label">Condition</span>
                  <OptionGroup
                    name="Condition"
                    options={VALUATION_CONDITION_OPTIONS}
                    value={condition}
                    onChange={setCondition}
                    className="valuation-page__option-grid--conditions"
                  />
                </div>

                {formError ? (
                  <p className="valuation-page__error" role="alert">{formError}</p>
                ) : null}

                <div className="valuation-page__actions valuation-page__details-actions">
                  <button
                    type="submit"
                    className="valuation-page__button valuation-page__button--primary"
                    disabled={submitting}
                  >
                    {submitting ? 'Calculating…' : selectedCompletion?.canValue ? 'Calculate valuation' : 'Continue'}
                  </button>
                </div>
              </form>
            </section>

            <div className="valuation-page__preview-rail">
              <div className="valuation-page__preview-sticky">
                <ProductSummaryCard
                  product={selectedProduct}
                  currency={currency}
                  onChangeProduct={handleChangeProduct}
                />
              </div>
            </div>
          </div>
        ) : null}

        {!prefillLoading && step === 'results' && selectedProduct && valuation ? (
          <section className="valuation-page__panel valuation-page__panel--results">
            <div className="valuation-page__results-hero">
              <p className="valuation-page__eyebrow valuation-page__eyebrow--inline">Your estimate</p>
              <h2 className="valuation-page__panel-title">{selectedDisplayName}</h2>
              {valuation.ok ? (
                <p className="valuation-page__results-context">
                  {[
                    valuation.depreciation_year_used
                      ? `Year ${valuation.depreciation_year_used}`
                      : null,
                    valuation.condition || condition,
                  ].filter(Boolean).join(' · ')}
                </p>
              ) : null}
            </div>

            {valuation.ok ? (
              <div className="valuation-page__results-layout">
                <div className="valuation-page__results-primary">
                  <div className="valuation-page__range-grid" role="group" aria-label="Valuation estimate range">
                    <div className="valuation-page__range-card">
                      <span>Low</span>
                      <strong>{formatValuationMoney(valuation.estimated_low, currency)}</strong>
                    </div>
                    <div className="valuation-page__range-card valuation-page__range-card--mid">
                      <span>Mid estimate</span>
                      <strong>{formatValuationMoney(valuation.estimated_mid, currency)}</strong>
                    </div>
                    <div className="valuation-page__range-card">
                      <span>High</span>
                      <strong>{formatValuationMoney(valuation.estimated_high, currency)}</strong>
                    </div>
                  </div>

                  <p className="valuation-page__results-range">
                    Estimated range:{' '}
                    {formatValuationRange(valuation.estimated_low, valuation.estimated_high, currency)}
                  </p>

                  <dl className="valuation-page__summary-dl valuation-page__summary-dl--compact">
                    {explanationLines.map((line) => (
                      <div key={line.label} className="valuation-page__summary-row">
                        <dt>{line.label}</dt>
                        <dd>{line.value}</dd>
                      </div>
                    ))}
                  </dl>

                  <dl className="valuation-page__glance" aria-label="Valuation summary">
                    <div className="valuation-page__glance-row">
                      <dt>Original RRP</dt>
                      <dd>{formatValuationMoney(valuation.original_base_price, currency)}</dd>
                    </div>
                    <div className="valuation-page__glance-row valuation-page__glance-row--emphasis">
                      <dt>Current estimate</dt>
                      <dd>{formatValuationMoney(valuation.estimated_mid, currency)}</dd>
                    </div>
                  </dl>
                </div>

                <div className="valuation-page__results-secondary">
                  {depreciationGraphData ? (
                    <EquipmentDepreciationGraph
                      graphData={depreciationGraphData}
                      currency={currency}
                      caption={valuationGraphCaption}
                      className="equipment-depreciation-graph--valuation"
                    />
                  ) : null}

                  <aside className="valuation-page__disclaimer valuation-page__disclaimer--info" aria-label="Valuation disclaimer">
                    <span className="valuation-page__disclaimer-icon" aria-hidden="true">
                      <svg viewBox="0 0 20 20" width="18" height="18" fill="none">
                        <circle cx="10" cy="10" r="8.25" stroke="currentColor" strokeWidth="1.5" />
                        <path d="M10 9v4.25" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                        <circle cx="10" cy="6.5" r="0.9" fill="currentColor" />
                      </svg>
                    </span>
                    <p>{valuationDisclaimer}</p>
                  </aside>
                </div>
              </div>
            ) : (
              <div className="valuation-page__insufficient">
                <p className="valuation-page__panel-lead">
                  {INSUFFICIENT_VALUATION_MESSAGE}
                </p>
                <ProductFacts product={selectedProduct} currency={currency} />
              </div>
            )}

            <div className="valuation-page__actions valuation-page__actions--results">
              <Link
                to={createListingPath}
                className="valuation-page__link-button valuation-page__link-button--primary"
              >
                List on Equipd
              </Link>
              {selectedSlug && valuation.ok ? (
                <Link
                  to={buildEquipmentProductPagePath(selectedSlug)}
                  className="valuation-page__link-button valuation-page__link-button--secondary"
                >
                  View product information
                </Link>
              ) : null}
              <Link
                to={similarBrowsePath}
                className="valuation-page__link-button valuation-page__link-button--secondary"
              >
                Browse similar equipment
              </Link>
              <button
                type="button"
                className="valuation-page__button valuation-page__button--secondary"
                onClick={handleStartOver}
              >
                Start another valuation
              </button>
            </div>
          </section>
        ) : null}
      </div>
    </div>
  )
}

export default ValuationPage
