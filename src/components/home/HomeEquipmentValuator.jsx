import { useEffect, useId, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import CanonicalEquipmentAutocomplete from '../CanonicalEquipmentAutocomplete'
import {
  buildEquipmentDepreciationGraphData,
  formatValuationMoney,
  getEquipmentProductDisplayName,
  pickDepreciationGraphYearTicks,
} from '../../lib/equipmentValuation'
import { buildEquipmentProductImagePublicUrl } from '../../lib/equipmentProductImages'
import { supabase } from '../../lib/supabase'
import { buildValuationHref } from '../../lib/valuationNavigation'
import {
  prefetchProductConsoleOptions,
  prefetchValuationSearchIndex,
} from '../../lib/valuationCatalogCache'
import './HomeEquipmentValuator.css'

const DEFAULT_EYEBROW = 'Equipment valuator'
const DEFAULT_TITLE = 'Find the value of your gym equipment'
const DEFAULT_LEDE = 'Instant market valuations based on thousands of listings, historical prices and current UK resale trends.'

const SHOWCASE_PRODUCT = {
  title: 'Technogym Skill Line Skillmill',
  imageStoragePath: 'technogym/technogym-non-motorised-treadmill-skill-line-skillmill.jpg',
  originalBasePrice: 7150,
  baselineManufactureYear: 2017,
  currentYear: 2026,
  changePct: 8,
}

/** Compact Y-axis labels, e.g. £0 / £2k / £8k. */
function formatCompactAxisMoney(amount) {
  const value = Number(amount)
  if (!Number.isFinite(value)) return '—'
  if (Math.abs(value) >= 1000) {
    const thousands = value / 1000
    const rounded = Number.isInteger(thousands) ? String(thousands) : thousands.toFixed(1).replace(/\.0$/, '')
    return `£${rounded}k`
  }
  return formatValuationMoney(value)
}

function buildSmoothLinePath(pointPositions) {
  if (!pointPositions.length) return ''
  if (pointPositions.length === 1) {
    return `M ${pointPositions[0].x.toFixed(2)} ${pointPositions[0].y.toFixed(2)}`
  }
  if (pointPositions.length === 2) {
    return pointPositions.map((point, index) => (
      `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`
    )).join(' ')
  }

  let path = `M ${pointPositions[0].x.toFixed(2)} ${pointPositions[0].y.toFixed(2)}`
  for (let index = 0; index < pointPositions.length - 1; index += 1) {
    const current = pointPositions[index]
    const next = pointPositions[index + 1]
    const controlX = (current.x + next.x) / 2
    path += ` C ${controlX.toFixed(2)} ${current.y.toFixed(2)}, ${controlX.toFixed(2)} ${next.y.toFixed(2)}, ${next.x.toFixed(2)} ${next.y.toFixed(2)}`
  }
  return path
}

function buildShowcaseChartModel() {
  const graph = buildEquipmentDepreciationGraphData({
    original_base_price: SHOWCASE_PRODUCT.originalBasePrice,
    baseline_manufacture_year: SHOWCASE_PRODUCT.baselineManufactureYear,
    current_year: SHOWCASE_PRODUCT.currentYear,
    condition: 'Good',
    brand: 'Technogym',
  })
  if (!graph?.points?.length) return null

  const width = 580
  const height = 258
  const plotLeft = 56
  const plotRight = width - 24
  const plotTop = 10
  const plotBottom = height - 32
  const plotWidth = plotRight - plotLeft
  const plotHeight = plotBottom - plotTop
  // Keep year labels clear of the y-axis values without hand-placing ticks.
  const axisPadX = 28
  const axisMax = 8000
  const startYear = graph.startYear
  const endYear = graph.endYear
  const yearSpan = Math.max(endYear - startYear, 1)

  function xForYear(year) {
    return plotLeft + axisPadX + (((year - startYear) / yearSpan) * (plotWidth - (axisPadX * 2)))
  }

  const pointPositions = graph.points.map((point) => ({
    year: point.year,
    value: point.value,
    x: xForYear(point.year),
    y: plotBottom - ((Math.max(point.value, 0) / axisMax) * plotHeight),
  }))

  const linePath = buildSmoothLinePath(pointPositions)
  const areaPath = linePath
    ? `${linePath} L ${pointPositions[pointPositions.length - 1].x} ${plotBottom} L ${pointPositions[0].x} ${plotBottom} Z`
    : ''

  const yTicks = [0, 2000, 4000, 6000, 8000].map((value) => ({
    value,
    y: plotBottom - ((value / axisMax) * plotHeight),
  }))

  const yearTicks = pickDepreciationGraphYearTicks(
    graph.timelineYears.filter((year) => Number.isInteger(year)),
  ).map((year) => ({
    year,
    x: xForYear(year),
  }))

  const currentPoint = pointPositions[pointPositions.length - 1]
  const currentEstimate = Math.round(graph.endValue ?? 787)

  return {
    width,
    height,
    plotLeft,
    plotRight,
    plotTop,
    plotBottom,
    linePath,
    areaPath,
    yTicks,
    yearTicks,
    currentPoint,
    currentEstimate,
  }
}

const SHOWCASE_CHART = buildShowcaseChartModel()
const SKILLMILL_IMAGE_URL = buildEquipmentProductImagePublicUrl(
  supabase,
  SHOWCASE_PRODUCT.imageStoragePath,
)

function ValuatorTrendIcon() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" fill="none">
      <path
        d="M2.5 11.5 6.1 7.9 8.4 10.2 13.5 4.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M10.25 4.5h3.25V7.75"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true" fill="none">
      <circle cx="8.5" cy="8.5" r="5.75" stroke="currentColor" strokeWidth="1.6" />
      <path d="m13.1 13.1 4.15 4.15" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}

function ShowcaseVisual({ chart, imageUrl }) {
  const gradientId = useId().replace(/:/g, '')
  if (!chart) return null

  return (
    <div className="home-valuator__visual" aria-hidden="true">
      <div className="home-valuator__graph">
        <svg
          className="home-valuator__graph-svg"
          viewBox={`0 0 ${chart.width} ${chart.height}`}
          role="presentation"
          focusable="false"
        >
          <defs>
            <linearGradient id={`home-valuator-area-${gradientId}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-orange)" stopOpacity="0.22" />
              <stop offset="100%" stopColor="var(--color-orange)" stopOpacity="0.02" />
            </linearGradient>
          </defs>

          {chart.yTicks.map((tick) => (
            <g key={tick.value}>
              <line
                x1={chart.plotLeft}
                y1={tick.y}
                x2={chart.plotRight}
                y2={tick.y}
                className="home-valuator__graph-grid"
              />
              <text
                x={chart.plotLeft - 10}
                y={tick.y + 4}
                className="home-valuator__graph-label home-valuator__graph-label--y"
              >
                {formatCompactAxisMoney(tick.value)}
              </text>
            </g>
          ))}

          {chart.yearTicks.map((tick) => (
            <text
              key={tick.year}
              x={tick.x}
              y={chart.plotBottom + 16}
              className="home-valuator__graph-label home-valuator__graph-label--x"
            >
              {tick.year}
            </text>
          ))}

          <path
            d={chart.areaPath}
            fill={`url(#home-valuator-area-${gradientId})`}
            className="home-valuator__graph-area"
          />
          <path d={chart.linePath} className="home-valuator__graph-line" />
          {chart.currentPoint ? (
            <circle
              cx={chart.currentPoint.x}
              cy={chart.currentPoint.y}
              r="5.5"
              className="home-valuator__graph-point"
            />
          ) : null}
        </svg>
      </div>

      <aside className="home-valuator__product-card">
        <div className="home-valuator__product-copy">
          <p className="home-valuator__product-title">{SHOWCASE_PRODUCT.title}</p>
          <p className="home-valuator__product-label">Current estimate</p>
          <div className="home-valuator__product-value-row">
            <p className="home-valuator__product-price">
              {formatValuationMoney(chart.currentEstimate)}
            </p>
            <span className="home-valuator__product-badge">
              <span aria-hidden="true">↑</span>
              {` ${SHOWCASE_PRODUCT.changePct}%`}
            </span>
          </div>
        </div>
        {imageUrl ? (
          <div className="home-valuator__product-media">
            <img
              src={imageUrl}
              alt=""
              className="home-valuator__product-image"
              width={96}
              height={96}
              loading="lazy"
              decoding="async"
            />
          </div>
        ) : null}
      </aside>
    </div>
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
  titleMobile = undefined,
  lede = DEFAULT_LEDE,
  titleAs = 'h2',
  contained = false,
  className = '',
  showShowcase = true,
} = {}) {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [selectedProduct, setSelectedProduct] = useState(null)

  useEffect(() => {
    let idleId = null
    let timeoutId = null

    function startPrefetch() {
      prefetchValuationSearchIndex()
    }

    if (typeof window !== 'undefined' && typeof window.requestIdleCallback === 'function') {
      idleId = window.requestIdleCallback(startPrefetch, { timeout: 1800 })
    } else {
      timeoutId = window.setTimeout(startPrefetch, 700)
    }

    return () => {
      if (idleId != null && typeof window.cancelIdleCallback === 'function') {
        window.cancelIdleCallback(idleId)
      }
      if (timeoutId != null) {
        window.clearTimeout(timeoutId)
      }
    }
  }, [])

  const titleId = `${idPrefix}-title`
  const inputId = `${idPrefix}-search`
  const TitleTag = titleAs === 'h1' ? 'h1' : 'h2'
  const resolvedTitleMobile = titleMobile === undefined ? null : titleMobile
  const usesResponsiveTitle = Boolean(resolvedTitleMobile)

  function goToValuator({ product = selectedProduct, queryText = query } = {}) {
    if (typeof document !== 'undefined') {
      document.activeElement?.blur?.()
    }
    if (product?.id) {
      prefetchProductConsoleOptions(product.id)
    }
    const productKey = product?.canonical_product_key || null
    navigate(buildValuationHref({
      productKey,
      query: productKey ? null : queryText,
    }), productKey ? { state: { product } } : undefined)
  }

  function handleSubmit(event) {
    event.preventDefault()
    goToValuator()
  }

  const sectionClassName = [
    'home-valuator',
    contained ? 'home-valuator--contained' : '',
    showShowcase ? 'home-valuator--with-showcase' : '',
    className,
  ].filter(Boolean).join(' ')

  const card = (
    <div className="home-valuator__card">
      <div className="home-valuator__main">
        <div className="home-valuator__copy">
          {eyebrow ? (
            <p className="home-valuator__eyebrow">
              <span className="home-valuator__eyebrow-icon">
                <ValuatorTrendIcon />
              </span>
              <span>{eyebrow}</span>
            </p>
          ) : null}
          <TitleTag id={titleId} className="home-valuator__title">
            {usesResponsiveTitle ? (
              <>
                <span className="home-valuator__title-text home-valuator__title-text--desktop">
                  {title}
                </span>
                <span className="home-valuator__title-text home-valuator__title-text--mobile">
                  {resolvedTitleMobile}
                </span>
              </>
            ) : (
              title
            )}
          </TitleTag>
          {lede ? <p className="home-valuator__lede">{lede}</p> : null}
        </div>

        <form className="home-valuator__form" onSubmit={handleSubmit}>
          <label className="visually-hidden" htmlFor={inputId}>
            Search by brand, model or product
          </label>
          <div className="home-valuator__search">
            <div className="home-valuator__search-field">
              <span className="home-valuator__search-icon" aria-hidden="true">
                <SearchIcon />
              </span>
              <CanonicalEquipmentAutocomplete
                id={inputId}
                value={query}
                onChange={setQuery}
                selectedProduct={selectedProduct}
                onSelectedProductChange={setSelectedProduct}
                placeholder="Search by brand, model or product..."
                inputClassName="home-valuator__input"
                resultLimit={10}
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
            </div>
            <button type="submit" className="home-valuator__submit">
              Value equipment
            </button>
          </div>
        </form>
      </div>

      {showShowcase ? (
        <ShowcaseVisual chart={SHOWCASE_CHART} imageUrl={SKILLMILL_IMAGE_URL} />
      ) : null}
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
