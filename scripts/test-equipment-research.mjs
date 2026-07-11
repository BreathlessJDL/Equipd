/**
 * Unit tests for equipment research approve payload shaping.
 */

const EQUIPD_DEFAULT_VALUATION_CURRENCY = 'GBP'
const USD_TO_GBP_RESEARCH_EXCHANGE_RATE = 0.75

function convertUsdToGbpResearch(usd) {
  return Math.round(usd * USD_TO_GBP_RESEARCH_EXCHANGE_RATE)
}

function formatResearchProductionPeriod(recommendation) {
  const start = recommendation?.production_start_year
  const end = recommendation?.production_end_year

  if (start != null && end != null) {
    if (start === end) return String(start)
    return `${start}–${end}`
  }

  if (start != null) return `${start}–`
  if (end != null) return `–${end}`
  return '—'
}

function buildResearchApproveUpdate(recommendation, now = '2026-01-01T00:00:00.000Z') {
  const sourceCurrency = (
    recommendation?.source_original_currency
    || recommendation?.currency
  )?.toUpperCase()
  const sourcePrice = Number(
    recommendation?.source_original_price ?? recommendation?.original_new_price,
  )
  const convertedGbp = Number(recommendation?.converted_original_price_gbp)
  const priceConfidence = Number(
    recommendation?.price_confidence ?? recommendation?.confidence,
  )
  const productionConfidence = Number(
    recommendation?.production_confidence ?? recommendation?.confidence,
  )
  const hasPrice = Number.isFinite(sourcePrice) && sourcePrice > 0
  const hasStartYear = recommendation?.production_start_year != null
  const hasEndYear = recommendation?.production_end_year != null

  const update = { updated_at: now }

  if (hasPrice) {
    if (sourceCurrency === 'USD') {
      const valuationGbp = Number.isFinite(convertedGbp) && convertedGbp > 0
        ? convertedGbp
        : null
      if (!valuationGbp) {
        throw new Error('USD research price is missing a converted GBP valuation.')
      }
      update.original_rrp = sourcePrice
      update.currency = 'USD'
      update.best_original_price = valuationGbp
      update.best_original_price_currency = EQUIPD_DEFAULT_VALUATION_CURRENCY
    } else {
      const resolvedCurrency = sourceCurrency || EQUIPD_DEFAULT_VALUATION_CURRENCY
      const valuationGbp = resolvedCurrency === EQUIPD_DEFAULT_VALUATION_CURRENCY
        ? sourcePrice
        : (Number.isFinite(convertedGbp) && convertedGbp > 0 ? convertedGbp : null)

      update.original_rrp = sourcePrice
      update.currency = resolvedCurrency
      update.best_original_price = valuationGbp ?? sourcePrice
      update.best_original_price_currency = valuationGbp != null
        ? EQUIPD_DEFAULT_VALUATION_CURRENCY
        : resolvedCurrency
    }

    update.best_original_price_confidence = Number.isFinite(priceConfidence)
      ? Math.trunc(priceConfidence)
      : null
    update.best_original_price_updated_at = now
  }

  if (hasStartYear || hasEndYear) {
    update.manufacture_start_year = hasStartYear
      ? Math.trunc(Number(recommendation.production_start_year))
      : null
    update.manufacture_end_year = hasEndYear
      ? Math.trunc(Number(recommendation.production_end_year))
      : null
    update.manufacture_year_confidence = Math.trunc(productionConfidence)
    update.lifecycle_updated_at = now

    if (hasStartYear) {
      update.manufacture_year = Math.trunc(Number(recommendation.production_start_year))
    }
  }

  return update
}

function assert(condition, label) {
  if (!condition) throw new Error(label)
}

const update = buildResearchApproveUpdate({
  original_new_price: 7500,
  source_original_price: 7500,
  source_original_currency: 'GBP',
  converted_original_price_gbp: 7500,
  currency: 'GBP',
  production_start_year: 2014,
  production_end_year: 2019,
  price_confidence: 92,
  production_confidence: 88,
  confidence: 88,
  reasoning: 'test',
  supporting_urls: [],
})

assert(update.original_rrp === 7500, 'approve should set original_rrp')
assert(update.best_original_price === 7500, 'approve should set best_original_price')
assert(update.best_original_price_currency === 'GBP', 'GBP approve should keep GBP valuation currency')
assert(update.best_original_price_confidence === 92, 'approve should use price_confidence')
assert(update.manufacture_start_year === 2014, 'approve should set manufacture_start_year')
assert(update.manufacture_end_year === 2019, 'approve should set manufacture_end_year')
assert(update.manufacture_year_confidence === 88, 'approve should use production_confidence')
assert(update.manufacture_year === 2014, 'approve should set legacy manufacture_year from start')

const usdUpdate = buildResearchApproveUpdate({
  original_new_price: 4367,
  source_original_price: 4367,
  source_original_currency: 'USD',
  converted_original_price_gbp: convertUsdToGbpResearch(4367),
  currency: 'USD',
  price_confidence: 95,
  confidence: 95,
})

assert(usdUpdate.currency === 'USD', 'approve should preserve USD on original_rrp currency')
assert(usdUpdate.original_rrp === 4367, 'approve should store USD source amount on original_rrp')
assert(
  usdUpdate.best_original_price === convertUsdToGbpResearch(4367),
  'approve should store converted GBP on best_original_price',
)
assert(
  usdUpdate.best_original_price_currency === 'GBP',
  'approve should store GBP on best_original_price_currency',
)
assert(
  usdUpdate.best_original_price !== 4367,
  '$4367 USD must never be stored as £4367 GBP on best_original_price',
)
assert(
  !(usdUpdate.best_original_price_currency === 'GBP' && usdUpdate.best_original_price === 4367),
  'USD amount must never be labelled as GBP valuation',
)

assert(
  formatResearchProductionPeriod({ production_start_year: 2014, production_end_year: 2019 }) === '2014–2019',
  'production period formatting',
)

console.log('equipment research tests passed')
