/**
 * Price Guide calculation helpers for market observations (GBP amounts, not pence).
 */

function toFiniteNumbers(values) {
  return (values ?? [])
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value))
}

export function average(values) {
  const numbers = toFiniteNumbers(values)
  if (numbers.length === 0) return null
  return numbers.reduce((sum, value) => sum + value, 0) / numbers.length
}

export function median(values) {
  const numbers = toFiniteNumbers(values).sort((left, right) => left - right)
  if (numbers.length === 0) return null

  const mid = Math.floor(numbers.length / 2)
  if (numbers.length % 2 === 0) {
    return (numbers[mid - 1] + numbers[mid]) / 2
  }

  return numbers[mid]
}

export function minMax(values) {
  const numbers = toFiniteNumbers(values)
  if (numbers.length === 0) {
    return { min: null, max: null }
  }

  return {
    min: Math.min(...numbers),
    max: Math.max(...numbers),
  }
}

/**
 * Simple IQR outlier filter. Returns original values when sample is too small.
 */
export function removePriceOutliers(values) {
  const numbers = toFiniteNumbers(values).sort((left, right) => left - right)
  if (numbers.length < 4) return numbers

  const q1 = median(numbers.slice(0, Math.floor(numbers.length / 2)))
  const q3 = median(numbers.slice(Math.ceil(numbers.length / 2)))
  if (q1 == null || q3 == null) return numbers

  const iqr = q3 - q1
  if (iqr <= 0) return numbers

  const lower = q1 - 1.5 * iqr
  const upper = q3 + 1.5 * iqr
  const filtered = numbers.filter((value) => value >= lower && value <= upper)

  return filtered.length > 0 ? filtered : numbers
}

export function formatGbpPrice(amount, { fallback = '—' } = {}) {
  if (amount == null || !Number.isFinite(Number(amount))) return fallback

  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Number(amount))
}

export function summarizeObservationPrices(observations) {
  const prices = toFiniteNumbers((observations ?? []).map((row) => row?.observed_price))
  const cleaned = removePriceOutliers(prices)
  const { min, max } = minMax(prices)

  return {
    count: prices.length,
    average: average(cleaned),
    median: median(cleaned),
    min,
    max,
  }
}

/**
 * Group observations by rounded age in years.
 * Returns rows sorted by age ascending.
 */
export function groupObservationsByAge(observations) {
  const groups = new Map()

  for (const observation of observations ?? []) {
    const ageRaw = Number(observation?.estimated_age_years)
    if (!Number.isFinite(ageRaw) || ageRaw < 0) continue

    const ageYears = Math.round(ageRaw)
    const price = Number(observation?.observed_price)
    if (!Number.isFinite(price)) continue

    const existing = groups.get(ageYears) ?? { ageYears, prices: [] }
    existing.prices.push(price)
    groups.set(ageYears, existing)
  }

  return Array.from(groups.values())
    .map((group) => ({
      ageYears: group.ageYears,
      count: group.prices.length,
      averagePrice: average(group.prices),
    }))
    .sort((left, right) => left.ageYears - right.ageYears)
}

export function buildDepreciationEstimate(estimatedOriginalRrp, averageObservedPrice) {
  const rrp = Number(estimatedOriginalRrp)
  if (!Number.isFinite(rrp) || rrp <= 0) return null

  const average = Number(averageObservedPrice)
  const hasAverage = Number.isFinite(average) && average > 0
  const retainedPercent = hasAverage ? (average / rrp) * 100 : null
  const depreciatedPercent =
    retainedPercent != null ? Math.max(0, 100 - retainedPercent) : null

  return {
    originalRrp: rrp,
    averageObservedPrice: hasAverage ? average : null,
    retainedPercent,
    depreciatedPercent,
  }
}

export function isEmptyJsonObject(value) {
  if (value == null) return true
  if (typeof value !== 'object' || Array.isArray(value)) return true
  return Object.keys(value).length === 0
}

export function formatSpecLabel(key) {
  return String(key)
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

export function formatSpecValue(value) {
  if (value == null) return '—'
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : '—'
  }
  if (Array.isArray(value)) {
    return value.length > 0 ? value.map(formatSpecValue).join(', ') : '—'
  }
  if (typeof value === 'object') {
    return Object.entries(value)
      .map(([key, nested]) => `${formatSpecLabel(key)}: ${formatSpecValue(nested)}`)
      .join('; ')
  }
  return String(value)
}

export function jsonObjectEntries(value) {
  if (isEmptyJsonObject(value)) return []
  return Object.entries(value)
}
