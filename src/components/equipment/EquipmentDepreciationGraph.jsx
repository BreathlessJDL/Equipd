import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import {
  formatValuationMoney,
  pickDepreciationGraphYearTicks,
} from '../../lib/equipmentValuation'
import './EquipmentDepreciationGraph.css'

const Y_AXIS_HEADROOM = 1.1
const Y_AXIS_LABEL_INSET = 12

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

function buildAreaPath(linePath, plotLeft, plotRight, plotBottom) {
  if (!linePath) return ''
  return `${linePath} L ${plotRight} ${plotBottom} L ${plotLeft} ${plotBottom} Z`
}

function chooseNiceStep(roughStep) {
  if (!Number.isFinite(roughStep) || roughStep <= 0) return 1

  const magnitude = 10 ** Math.floor(Math.log10(roughStep))
  const normalized = roughStep / magnitude

  if (normalized <= 1) return magnitude
  if (normalized <= 2) return 2 * magnitude
  if (normalized <= 5) return 5 * magnitude
  return 10 * magnitude
}

function computeAxisMaximum(dataMax, { compact = false } = {}) {
  const targetMax = Math.max(Number(dataMax) || 0, 1) * Y_AXIS_HEADROOM
  const maxTicks = compact ? 3 : 4
  const step = chooseNiceStep(targetMax / maxTicks)
  return Math.max(step, Math.ceil(targetMax / step) * step)
}

function buildYAxisTicks(axisMax, plotHeight, plotTop, plotBottom, {
  compact = false,
  minYTickSpacing = 40,
} = {}) {
  if (!Number.isFinite(axisMax) || axisMax <= 0) {
    return [{ value: 0, y: plotBottom }]
  }

  const maxTicks = compact ? 3 : 4
  const step = chooseNiceStep(axisMax / maxTicks)
  const rawTicks = []

  for (let value = 0; value <= axisMax; value += step) {
    rawTicks.push(value)
  }

  const uniqueTicks = [...new Set(rawTicks)].sort((left, right) => left - right)
  const valueSpan = Math.max(axisMax, 1)

  const ticksWithY = uniqueTicks.map((value) => ({
    value,
    y: plotBottom - ((value / valueSpan) * plotHeight),
  }))

  const filtered = ticksWithY.filter((tick, index, ticks) => {
    if (tick.y < plotTop - 0.5 || tick.y > plotBottom + 0.5) return false
    if (index === 0) return true
    return Math.abs(tick.y - ticks[index - 1].y) >= minYTickSpacing
  })

  return filtered.length ? filtered : [{ value: 0, y: plotBottom }]
}

function getYAxisLabelY(tickY, plotTop, plotBottom) {
  const minY = plotTop + Y_AXIS_LABEL_INSET
  const maxY = plotBottom - 6
  return Math.max(minY, Math.min(tickY, maxY))
}

function getYearLabelAnchor(index, total) {
  if (index === 0) return 'start'
  if (index === total - 1) return 'end'
  return 'middle'
}

function getYearLabelX(tick, index, total, plotLeft, plotRight) {
  if (index === 0) return Math.max(plotLeft, tick.x)
  if (index === total - 1) return Math.min(plotRight, tick.x)
  return tick.x
}

function getPlotMetrics(layout) {
  const plotLeft = layout.padding.left
  const plotRight = layout.width - layout.padding.right
  const plotTop = layout.padding.top
  const plotBottom = layout.height - layout.padding.bottom
  const plotWidth = Math.max(plotRight - plotLeft, 1)
  const plotHeight = Math.max(plotBottom - plotTop, 1)

  return { plotLeft, plotRight, plotTop, plotBottom, plotWidth, plotHeight }
}

/** Compact Y-axis labels, e.g. £0 / £5k / £10k. */
export function formatCompactAxisMoney(amount, currency = 'GBP') {
  const value = Number(amount)
  if (!Number.isFinite(value)) return '—'

  const symbol = currency === 'GBP' ? '£' : `${currency} `
  if (value === 0) return `${symbol}0`

  const abs = Math.abs(value)
  if (abs >= 1000) {
    const asK = value / 1000
    const rounded = Math.round(asK * 10) / 10
    const label = Number.isInteger(rounded) || Math.abs(rounded - Math.round(rounded)) < 0.05
      ? String(Math.round(rounded))
      : String(rounded)
    return `${symbol}${label}k`
  }

  return formatValuationMoney(value, currency)
}

function buildResponsiveLayout(containerSize, { compact = false } = {}) {
  const fallbackWidth = compact ? 360 : 720
  const fallbackHeight = compact ? 270 : 370
  const width = Math.max(Math.round(containerSize?.width || fallbackWidth), compact ? 240 : 320)
  const height = Math.max(
    Math.round(containerSize?.height || fallbackHeight),
    compact ? 240 : 300,
  )
  const narrow = width < 360

  return {
    width,
    height,
    padding: {
      top: compact ? 16 : 24,
      right: compact ? (narrow ? 10 : 14) : 28,
      bottom: compact ? (narrow ? 36 : 40) : 48,
      left: compact ? (narrow ? 42 : 48) : 58,
    },
    minYTickSpacing: Math.max(compact ? 26 : 36, Math.round(height * 0.09)),
    showCurrentLabel: !compact && width >= 420,
  }
}

function EquipmentDepreciationGraph({
  graphData,
  currency = 'GBP',
  caption = null,
  className = '',
}) {
  const reactId = useId().replace(/:/g, '')
  const clipPathId = `equipment-depreciation-graph-plot-clip-${reactId}`
  const areaFillId = `equipment-depreciation-graph-area-fill-${reactId}`
  const chartWrapRef = useRef(null)

  const [compactAxis, setCompactAxis] = useState(() => (
    typeof window !== 'undefined'
      ? window.matchMedia('(max-width: 720px)').matches
      : false
  ))
  const [containerSize, setContainerSize] = useState(null)
  const [activePoint, setActivePoint] = useState(null)

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 720px)')
    const handleChange = (event) => setCompactAxis(event.matches)
    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [])

  useLayoutEffect(() => {
    const node = chartWrapRef.current
    if (!node) return undefined

    const updateSize = () => {
      const width = Math.round(node.clientWidth)
      const height = Math.round(node.clientHeight)
      if (width < 1 || height < 1) return
      setContainerSize((previous) => (
        previous
        && previous.width === width
        && previous.height === height
          ? previous
          : { width, height }
      ))
    }

    updateSize()

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', updateSize)
      return () => window.removeEventListener('resize', updateSize)
    }

    const observer = new ResizeObserver(updateSize)
    observer.observe(node)
    return () => observer.disconnect()
  }, [compactAxis, Boolean(graphData?.points?.length)])

  const layout = useMemo(
    () => buildResponsiveLayout(containerSize, { compact: compactAxis }),
    [compactAxis, containerSize],
  )

  const chart = useMemo(() => {
    if (!graphData?.points?.length) return null

    const { points } = graphData
    const {
      plotLeft,
      plotRight,
      plotTop,
      plotBottom,
      plotWidth,
      plotHeight,
    } = getPlotMetrics(layout)

    const values = points.map((point) => point.value)
    const minValue = 0
    const dataMax = Math.max(...values)
    const axisMax = computeAxisMaximum(dataMax, { compact: compactAxis })
    const valueSpan = Math.max(axisMax - minValue, 1)

    const { startYear, endYear } = graphData
    const yearSpan = Math.max(endYear - startYear, 1)
    const yearToX = (year) => (
      points.length === 1
        ? plotLeft + plotWidth / 2
        : plotLeft + (((year - startYear) / yearSpan) * plotWidth)
    )

    const pointPositions = points.map((point) => {
      const x = yearToX(point.year)
      const y = plotBottom - (((point.value - minValue) / valueSpan) * plotHeight)
      return { ...point, x, y }
    })

    const yearTicks = pickDepreciationGraphYearTicks(
      graphData.timelineYears ?? [],
      { compact: compactAxis },
    ).filter((year) => year >= graphData.startYear && Number.isInteger(year))
    const yearTickPositions = yearTicks.map((year) => ({ year, x: yearToX(year) }))

    const yAxisTickPositions = buildYAxisTicks(
      axisMax,
      plotHeight,
      plotTop,
      plotBottom,
      {
        compact: compactAxis,
        minYTickSpacing: layout.minYTickSpacing,
      },
    )

    const linePath = buildSmoothLinePath(pointPositions)

    return {
      pointPositions,
      yearTickPositions,
      yAxisTickPositions,
      linePath,
      areaPath: buildAreaPath(linePath, plotLeft, plotRight, plotBottom),
      plotHeight,
      plotWidth,
      plotLeft,
      plotRight,
      plotTop,
      plotBottom,
      dataMax,
      axisMax,
      layout,
    }
  }, [compactAxis, graphData, layout])

  if (!chart) return null

  const { startYear, endYear } = graphData
  const currentPoint = chart.pointPositions.find((point) => point.highlightKind === 'current')
    || chart.pointPositions[chart.pointPositions.length - 1]
  const currentEstimateLabel = currentPoint
    ? formatValuationMoney(currentPoint.value, currency)
    : null
  const accessibleSummary = currentEstimateLabel
    ? `Estimated value declined from ${startYear} to a current estimate of ${currentEstimateLabel} in ${endYear}.`
    : `Estimated depreciation from ${startYear} to ${endYear}.`
  const resolvedCaption = caption
    || `Estimated depreciation from ${startYear} to today.`

  const currentLabelX = currentPoint
    ? Math.min(currentPoint.x + 12, chart.plotRight - 8)
    : 0
  const currentLabelY = currentPoint
    ? Math.max(currentPoint.y - 16, chart.plotTop + 14)
    : 0

  function activatePoint(point, event) {
    if (!point || !chartWrapRef.current) {
      setActivePoint(null)
      return
    }
    const bounds = chartWrapRef.current.getBoundingClientRect()
    const clientX = event?.clientX ?? bounds.left + (point.x / chart.layout.width) * bounds.width
    const clientY = event?.clientY ?? bounds.top + (point.y / chart.layout.height) * bounds.height
    setActivePoint({
      year: point.year,
      valueLabel: formatValuationMoney(point.value, currency),
      x: Math.min(Math.max(clientX - bounds.left, 12), bounds.width - 12),
      y: Math.min(Math.max(clientY - bounds.top - 12, 12), bounds.height - 12),
    })
  }

  const rootClassName = [
    'equipment-depreciation-graph',
    compactAxis ? 'equipment-depreciation-graph--compact' : '',
    className,
  ].filter(Boolean).join(' ')

  return (
    <div className={rootClassName}>
      <div className="equipment-depreciation-graph__header">
        <div className="equipment-depreciation-graph__heading">
          <h2 className="equipment-depreciation-graph__title">Estimated value over time</h2>
          <p className="equipment-depreciation-graph__subtitle">
            Estimated depreciation between {startYear} and {endYear}.
          </p>
        </div>
        {currentPoint ? (
          <div className="equipment-depreciation-graph__current-badge" aria-label="Current estimated value">
            <span className="equipment-depreciation-graph__current-label">Current estimated value</span>
            <strong>{currentEstimateLabel}</strong>
          </div>
        ) : null}
      </div>

      <div
        className="equipment-depreciation-graph__chart-wrap"
        ref={chartWrapRef}
        onPointerLeave={() => setActivePoint(null)}
      >
        <svg
          className="equipment-depreciation-graph__svg"
          viewBox={`0 0 ${chart.layout.width} ${chart.layout.height}`}
          role="img"
          aria-label={accessibleSummary}
          preserveAspectRatio="none"
        >
          <defs>
            <clipPath id={clipPathId}>
              <rect
                x={chart.plotLeft}
                y={chart.plotTop}
                width={chart.plotWidth}
                height={chart.plotHeight}
              />
            </clipPath>
            <linearGradient id={areaFillId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-orange)" stopOpacity="0.22" />
              <stop offset="100%" stopColor="var(--color-orange)" stopOpacity="0.02" />
            </linearGradient>
          </defs>

          {chart.yAxisTickPositions.map((tick) => (
            <g key={tick.value}>
              <line
                x1={chart.plotLeft}
                y1={tick.y}
                x2={chart.plotRight}
                y2={tick.y}
                className="equipment-depreciation-graph__grid-line"
              />
              <text
                x={chart.plotLeft - (compactAxis ? 8 : 10)}
                y={getYAxisLabelY(tick.y, chart.plotTop, chart.plotBottom)}
                dominantBaseline="middle"
                className="equipment-depreciation-graph__axis-label equipment-depreciation-graph__axis-label--y"
              >
                {formatCompactAxisMoney(tick.value, currency)}
              </text>
            </g>
          ))}

          <line
            x1={chart.plotLeft}
            y1={chart.plotBottom}
            x2={chart.plotRight}
            y2={chart.plotBottom}
            className="equipment-depreciation-graph__axis"
          />
          <line
            x1={chart.plotLeft}
            y1={chart.plotTop}
            x2={chart.plotLeft}
            y2={chart.plotBottom}
            className="equipment-depreciation-graph__axis"
          />

          {chart.yearTickPositions.map((tick, index) => (
            <text
              key={tick.year}
              x={getYearLabelX(
                tick,
                index,
                chart.yearTickPositions.length,
                chart.plotLeft,
                chart.plotRight,
              )}
              y={chart.layout.height - (compactAxis ? 12 : 18)}
              textAnchor={getYearLabelAnchor(index, chart.yearTickPositions.length)}
              className="equipment-depreciation-graph__axis-label equipment-depreciation-graph__axis-label--x"
            >
              {tick.year}
            </text>
          ))}

          <path
            d={chart.areaPath}
            className="equipment-depreciation-graph__area"
            fill={`url(#${areaFillId})`}
            clipPath={`url(#${clipPathId})`}
          />

          <path
            d={chart.linePath}
            className="equipment-depreciation-graph__line"
            clipPath={`url(#${clipPathId})`}
          />

          <g clipPath={`url(#${clipPathId})`}>
            {chart.pointPositions.map((point) => {
              const isCurrent = point.highlightKind === 'current'
              const radius = compactAxis
                ? (isCurrent ? 7 : point.highlighted ? 4.5 : 3.25)
                : (isCurrent ? 8.5 : point.highlighted ? 5 : 3.5)

              return (
                <circle
                  key={String(point.year)}
                  cx={point.x}
                  cy={point.y}
                  r={radius}
                  className={[
                    'equipment-depreciation-graph__point',
                    point.highlighted ? 'equipment-depreciation-graph__point--highlighted' : '',
                    isCurrent ? 'equipment-depreciation-graph__point--current' : '',
                    point.highlightKind === 'manufacture'
                      ? 'equipment-depreciation-graph__point--manufacture'
                      : '',
                  ].filter(Boolean).join(' ')}
                  onPointerEnter={(event) => activatePoint(point, event)}
                  onPointerDown={(event) => {
                    event.currentTarget.setPointerCapture?.(event.pointerId)
                    activatePoint(point, event)
                  }}
                  onFocus={() => activatePoint(point)}
                  tabIndex={0}
                  role="img"
                  aria-label={`${point.year}: ${formatValuationMoney(point.value, currency)}`}
                />
              )
            })}
          </g>

          {currentPoint && chart.layout.showCurrentLabel ? (
            <text
              x={currentLabelX}
              y={currentLabelY}
              className="equipment-depreciation-graph__current-point-label"
            >
              {currentEstimateLabel}
            </text>
          ) : null}
        </svg>

        {activePoint ? (
          <div
            className="equipment-depreciation-graph__tooltip"
            style={{
              left: `${activePoint.x}px`,
              top: `${activePoint.y}px`,
            }}
            role="status"
          >
            <span>{activePoint.year}</span>
            <strong>{activePoint.valueLabel}</strong>
          </div>
        ) : null}
      </div>

      <p className="equipment-depreciation-graph__caption">
        {resolvedCaption}
      </p>
    </div>
  )
}

export default EquipmentDepreciationGraph
