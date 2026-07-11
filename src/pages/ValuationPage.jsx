import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import EquipmentDepreciationGraph from '../components/equipment/EquipmentDepreciationGraph'
import { usePageMeta } from '../hooks/usePageMeta'
import EquipmentValuationDetailsFields, {
  shouldResetConsoleForYearChange,
} from '../components/equipment/EquipmentValuationDetailsFields'
import {
  buildEquipmentProductPagePath,
  fetchDedupedApprovedCanonicalProducts,
  fetchConsoleModifiers,
  fetchEquipmentProductByKey,
  fetchProductConsoleOptions,
} from '../lib/equipmentProducts'
import { getDefaultCompatibleConsoleName } from '../lib/consoleCompatibility'
import { buildCreateListingFromValuationPath } from '../lib/createListingFromEquipment'
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
  resolveValuationProductFromCatalog,
  VALUATION_DETAILS_STEP,
} from '../lib/valuationNavigation'

import './ValuationPage.css'

const STEPS = [
  { id: 'product', label: '1. Product' },
  { id: 'details', label: '2. Details' },
  { id: 'results', label: '3. Estimate' },
]

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

function CompletionBadge({ product }) {
  const completion = getEquipmentProductCompletionStatus(product)
  return (
    <span
      className={`valuation-page__completion valuation-page__completion--${completion.status}`}
    >
      {completion.label}
    </span>
  )
}

function ProductSummary({ product, currency }) {
  const completion = getEquipmentProductCompletionStatus(product)
  const manufacturedFromYear = getProductManufacturedFromYear(product)
  const productionYears = formatProductProductionYears(product)

  return (
    <div className="valuation-page__product-summary">
      <dl className="valuation-page__summary-dl">
        <div className="valuation-page__summary-row">
          <dt>Estimated original RRP</dt>
          <dd>
            {productHasValuationRrp(product)
              ? formatValuationMoney(product.original_base_price, currency)
              : 'Missing'}
          </dd>
        </div>
        {productionYears ? (
          <div className="valuation-page__summary-row">
            <dt>{PRODUCTION_YEARS_LABEL}</dt>
            <dd>{productionYears}</dd>
          </div>
        ) : (
          <div className="valuation-page__summary-row">
            <dt>{MANUFACTURED_FROM_LABEL}</dt>
            <dd>
              {productHasValuationBaselineYear(product)
                ? String(manufacturedFromYear)
                : 'Missing'}
            </dd>
          </div>
        )}
      </dl>
      {!completion.canValue ? (
        <p className="valuation-page__warning" role="status">
          {INSUFFICIENT_VALUATION_MESSAGE}
        </p>
      ) : null}
    </div>
  )
}

function ProductCard({ product, onSelect, currency }) {
  const productPagePath = buildEquipmentProductPagePath(product.canonical_product_key)

  return (
    <div
      role="button"
      tabIndex={0}
      className="valuation-page__match-card"
      onClick={() => onSelect(product)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onSelect(product)
        }
      }}
    >
      <p className="valuation-page__match-brand">{product.brand}</p>
      <p className="valuation-page__match-title">{getEquipmentProductDisplayName(product)}</p>
      <div className="valuation-page__match-meta">
        {product.equipment_type ? (
          <span className="valuation-page__chip">{product.equipment_type}</span>
        ) : null}
        <CompletionBadge product={product} />
      </div>
      <p className="valuation-page__match-price">
        {productHasValuationRrp(product)
          ? formatValuationMoney(product.original_base_price, currency)
          : 'RRP missing'}
        {product.baseline_manufacture_year ? ` · ${product.baseline_manufacture_year}` : ''}
      </p>
      {productPagePath ? (
        <Link
          to={productPagePath}
          className="valuation-page__match-link"
          onClick={shouldValuationProductPageLinkStopSelection}
        >
          View product page
        </Link>
      ) : null}
    </div>
  )
}

function ValuationPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const productKeyParam = searchParams.get('product')?.trim()
    || searchParams.get('model')?.trim()
  const initialQueryParam = searchParams.get('q')?.trim() || ''
  const stepParam = searchParams.get('step')?.trim() || ''

  const [step, setStep] = useState(
    productKeyParam && stepParam !== 'product' ? VALUATION_DETAILS_STEP : 'product',
  )
  const [products, setProducts] = useState([])
  const [modifiers, setModifiers] = useState([])
  const [productConsoleOptions, setProductConsoleOptions] = useState([])
  const [catalogLoading, setCatalogLoading] = useState(true)
  const [catalogError, setCatalogError] = useState(null)

  const [searchQuery, setSearchQuery] = useState(initialQueryParam)
  const [selectedProduct, setSelectedProduct] = useState(null)
  const [prefillLoading, setPrefillLoading] = useState(Boolean(productKeyParam))
  const [prefillError, setPrefillError] = useState(null)

  const [condition, setCondition] = useState('Good')
  const [actualManufactureYear, setActualManufactureYear] = useState('')
  const [consoleName, setConsoleName] = useState('')
  const [formError, setFormError] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [valuation, setValuation] = useState(null)

  const currentYear = new Date().getFullYear()
  const prefilledProductKeyRef = useRef(null)

  usePageMeta({
    title: 'Instant Equipment Valuation',
    description: 'Find the estimated market value of your gym equipment in just a few steps.',
    canonicalPath: '/valuation',
  })

  /**
   * Shared action for homepage product entry and in-page product-card selection.
   * Resets stale inputs and advances to the equipment-details step.
   */
  const startValuationForProduct = useCallback((product) => {
    if (!product) return
    setSelectedProduct(product)
    setSearchQuery(getEquipmentProductDisplayName(product))
    setCondition('Good')
    setConsoleName('')
    setProductConsoleOptions([])
    setActualManufactureYear(resolveManufactureYearSelectValue(
      product,
      getDefaultProductManufactureYear(product),
    ))
    setFormError(null)
    setPrefillError(null)
    setValuation(null)
    setStep(VALUATION_DETAILS_STEP)
  }, [])

  useEffect(() => {
    let cancelled = false

    async function loadCatalog() {
      setCatalogLoading(true)
      setCatalogError(null)

      const [productsResult, modifiersResult] = await Promise.all([
        fetchDedupedApprovedCanonicalProducts(),
        fetchConsoleModifiers(),
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

      // Wait for catalogue before falling back to a direct key fetch.
      if (catalogLoading) {
        return
      }

      const result = await fetchEquipmentProductByKey(productKeyParam)
      if (cancelled) return

      if (result.error) {
        prefilledProductKeyRef.current = null
        setPrefillError(result.error)
        setSelectedProduct(null)
        setStep('product')
        setPrefillLoading(false)
        return
      }

      if (result.notFound || !result.product) {
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
  }, [productKeyParam, products, catalogLoading, selectedProduct?.canonical_product_key, startValuationForProduct])

  const searchState = useMemo(
    () => resolveValuationSearchMatches(products, searchQuery),
    [products, searchQuery],
  )

  const displayMatches = useMemo(
    () => (searchState.scoredMatches.length
      ? searchState.scoredMatches.map((entry) => entry.product)
      : searchState.matches),
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
    if (!selectedProduct?.id) {
      setProductConsoleOptions([])
      return undefined
    }

    let cancelled = false

    async function loadConsoleOptions() {
      const result = await fetchProductConsoleOptions(selectedProduct.id)
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

  function handleContinueWithProduct(product = selectedProduct) {
    startValuationForProduct(product)
    if (product?.canonical_product_key) {
      const next = new URLSearchParams()
      next.set('product', product.canonical_product_key)
      next.set('step', VALUATION_DETAILS_STEP)
      setSearchParams(next, { replace: true })
    }
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
    setStep('product')
    setSelectedProduct(null)
    setSearchQuery('')
    setCondition('Good')
    setActualManufactureYear('')
    setConsoleName('')
    setValuation(null)
    setFormError(null)
    setSearchParams({}, { replace: true })
  }

  const selectedDisplayName = getEquipmentProductDisplayName(selectedProduct)
  const selectedSlug = getEquipmentProductSlug(selectedProduct)
  const stepIndex = STEPS.findIndex((entry) => entry.id === step)
  const currency = selectedProduct?.original_base_price_currency ?? 'GBP'

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

  return (
    <div
      className={[
        'valuation-page',
        step === 'details' ? 'valuation-page--details' : '',
        step === 'results' ? 'valuation-page--results' : '',
      ].filter(Boolean).join(' ')}
    >
      <header className="valuation-page__hero">
        <div className="valuation-page__hero-inner">
          <p className="valuation-page__eyebrow">Instant valuation</p>
          <h1 className="valuation-page__title">Instant Equipment Valuation</h1>
          <p className="valuation-page__intro">
            Find the estimated market value of your gym equipment in just a few steps.
          </p>
        </div>
      </header>

      <div className="valuation-page__steps" aria-label="Valuation steps">
        {STEPS.map((entry, index) => (
          <span
            key={entry.id}
            className={[
              'valuation-page__step-pill',
              entry.id === step ? 'valuation-page__step-pill--active' : '',
              index < stepIndex ? 'valuation-page__step-pill--done' : '',
            ].filter(Boolean).join(' ')}
          >
            {entry.label}
          </span>
        ))}
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
        <section className="valuation-page__panel">
          <h2 className="valuation-page__panel-title">Select product</h2>
          <p className="valuation-page__panel-lead">
            {products.length} approved products available.
          </p>

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
                placeholder="Brand or product name, e.g. Technogym Excite Run 700"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                autoComplete="off"
              />
              <p className="valuation-page__hint">
                Start typing to see matching products. Click a product to continue.
              </p>
            </div>

            {displayMatches.length > 0 ? (
              <div className="valuation-page__matches" role="listbox" aria-label="Matching products">
                {displayMatches.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    onSelect={handleContinueWithProduct}
                    currency={product.original_base_price_currency ?? 'GBP'}
                  />
                ))}
              </div>
            ) : null}
          </div>

          {showNoMatch ? (
            <div className="valuation-page__empty">
              <p>No matching approved products. Try a different search or list your item manually.</p>
              <div className="valuation-page__actions">
                <Link to="/sell" className="valuation-page__link-button valuation-page__link-button--primary">
                  List on Equipd
                </Link>
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      {!prefillLoading && !catalogError && step === 'details' && selectedProduct ? (
        <section className="valuation-page__panel valuation-page__panel--details">
          <div className="valuation-page__details-header">
            <h2 className="valuation-page__panel-title">Equipment details</h2>
            <button
              type="button"
              className="valuation-page__button valuation-page__button--secondary valuation-page__button--compact"
              onClick={handleChangeProduct}
            >
              Change product
            </button>
          </div>

          <div className="valuation-page__details-layout">
            <div className="valuation-page__details-summary">
              <div className="valuation-page__selected-model">
                <span className="valuation-page__hint">Selected</span>
                <strong>{selectedDisplayName}</strong>
              </div>
              <ProductSummary product={selectedProduct} currency={currency} />
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
          </div>
        </section>
      ) : null}

      {!prefillLoading && step === 'results' && selectedProduct && valuation ? (
        <section className="valuation-page__panel valuation-page__panel--results">
          <h2 className="valuation-page__panel-title">{selectedDisplayName}</h2>

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
              <ProductSummary product={selectedProduct} currency={currency} />
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
                Product guide
              </Link>
            ) : null}
            <button
              type="button"
              className="valuation-page__button valuation-page__button--secondary"
              onClick={handleStartOver}
            >
              Value another
            </button>
          </div>
        </section>
      ) : null}
    </div>
  )
}

export default ValuationPage
