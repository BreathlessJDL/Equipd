/**
 * Unit tests for Equipment Intelligence V2 evidence helpers.
 */

const IN_QUERY_CHUNK_SIZE = 100

function chunkArray(items, chunkSize = IN_QUERY_CHUNK_SIZE) {
  if (!Array.isArray(items) || items.length === 0) return []
  const size = Math.max(1, Math.floor(chunkSize))
  const chunks = []
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size))
  }
  return chunks
}

function dedupeRowsById(rows = []) {
  return [...new Map(rows.map((row) => [row.id, row])).values()]
}

const EVIDENCE_VERIFIED_CONFIDENCE_THRESHOLD = 90

const EVIDENCE_SOURCE_TYPES = [
  { id: 'manufacturer_pdf', defaultConfidence: 100 },
  { id: 'official_website', defaultConfidence: 95 },
  { id: 'dealer_catalogue', defaultConfidence: 90 },
  { id: 'dealer_product_page', defaultConfidence: 80 },
  { id: 'trade_publication', defaultConfidence: 70 },
  { id: 'forum_estimate', defaultConfidence: 50 },
  { id: 'manual_estimate', defaultConfidence: 40 },
]

function getDefaultConfidenceForSourceType(sourceType) {
  const match = EVIDENCE_SOURCE_TYPES.find((entry) => entry.id === sourceType)
  return match?.defaultConfidence ?? 40
}

function deriveEvidenceStatus({
  bestValuePresent = false,
  confidence = null,
  sourceCount = 0,
}) {
  if (!bestValuePresent && sourceCount === 0) return 'missing'
  if (!bestValuePresent && sourceCount > 0) return 'needs_review'

  const numericConfidence = Number(confidence)
  if (Number.isFinite(numericConfidence) && numericConfidence >= EVIDENCE_VERIFIED_CONFIDENCE_THRESHOLD) {
    return 'verified'
  }

  return 'needs_review'
}

function derivePriceEvidenceStatus(equipment, priceSourceCount = 0) {
  const EVIDENCE_VERIFIED_CONFIDENCE_THRESHOLD = 90
  const EQUIPD_DEFAULT_VALUATION_CURRENCY = 'GBP'
  const hasPrice = Number.isFinite(Number(equipment?.best_original_price))
    && Number(equipment.best_original_price) > 0

  if (!hasPrice && priceSourceCount === 0) return 'missing'
  if (!hasPrice && priceSourceCount > 0) return 'needs_review'

  const currency = (
    equipment?.best_original_price_currency
    || equipment?.currency
    || ''
  ).toUpperCase()

  if (currency && currency !== EQUIPD_DEFAULT_VALUATION_CURRENCY) {
    return 'needs_review'
  }

  const numericConfidence = Number(equipment?.best_original_price_confidence)
  if (Number.isFinite(numericConfidence) && numericConfidence >= EVIDENCE_VERIFIED_CONFIDENCE_THRESHOLD) {
    return 'verified'
  }

  return 'needs_review'
}

function isNonGbpResearchPrice(recommendation) {
  const currency = (
    recommendation?.source_original_currency
    || recommendation?.currency
  )?.toUpperCase()
  return Boolean(currency && currency !== 'GBP')
}

function deriveResearchPriceReviewStatus(recommendation) {
  const EVIDENCE_VERIFIED_CONFIDENCE_THRESHOLD = 90
  const sourcePrice = Number(
    recommendation?.source_original_price ?? recommendation?.original_new_price,
  )
  if (!Number.isFinite(sourcePrice) || sourcePrice <= 0) {
    return 'missing'
  }

  if (recommendation?.price_review_status === 'converted') {
    return 'converted'
  }

  const sourceCurrency = (
    recommendation?.source_original_currency
    || recommendation?.currency
    || ''
  ).toUpperCase()
  const convertedGbp = Number(recommendation?.converted_original_price_gbp)
  if (sourceCurrency === 'USD'
    && Number.isFinite(convertedGbp)
    && convertedGbp > 0) {
    return 'converted'
  }

  if (isNonGbpResearchPrice(recommendation)) {
    return 'needs_review'
  }

  const confidence = Number(recommendation?.price_confidence ?? recommendation?.confidence)
  if (Number.isFinite(confidence) && confidence >= EVIDENCE_VERIFIED_CONFIDENCE_THRESHOLD) {
    return 'verified'
  }

  return 'needs_review'
}

function buildResearchApproveUpdate(recommendation, now = '2026-01-01T00:00:00.000Z') {
  const EQUIPD_DEFAULT_VALUATION_CURRENCY = 'GBP'
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
  const hasPrice = Number.isFinite(sourcePrice) && sourcePrice > 0
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
      update.original_rrp = sourcePrice
      update.currency = resolvedCurrency
      update.best_original_price = sourcePrice
      update.best_original_price_currency = resolvedCurrency
    }

    update.best_original_price_confidence = Number.isFinite(priceConfidence)
      ? Math.trunc(priceConfidence)
      : null
    update.best_original_price_updated_at = now
  }

  return update
}

function deriveLifecycleEvidenceStatus(equipment, lifecycleSourceCount = 0) {
  const hasLifecycleYears = equipment?.manufacture_start_year != null
    || equipment?.manufacture_end_year != null

  return deriveEvidenceStatus({
    bestValuePresent: hasLifecycleYears,
    confidence: equipment?.manufacture_year_confidence,
    sourceCount: lifecycleSourceCount,
  })
}

function formatManufactureYearRange(equipment) {
  const start = equipment?.manufacture_start_year
  const end = equipment?.manufacture_end_year

  if (start != null && end != null) {
    if (start === end) return String(start)
    return `${start}–${end}`
  }

  if (start != null) return `${start}–`
  if (end != null) return `–${end}`
  return '—'
}

function getResearchOfficialPriceDetails(recommendation) {
  const currency = (
    recommendation?.source_original_currency
    || recommendation?.currency
    || ''
  ).toUpperCase()
  const price = Number(
    recommendation?.source_original_price ?? recommendation?.original_new_price,
  )
  const convertedGbp = Number(recommendation?.converted_original_price_gbp)
  const hasPrice = Number.isFinite(price) && price > 0
  const hasSuggestedGbp = Number.isFinite(convertedGbp) && convertedGbp > 0

  return {
    currency,
    price: hasPrice ? price : null,
    convertedGbp: hasSuggestedGbp ? convertedGbp : null,
    isOfficialUsd: currency === 'USD' && hasPrice && hasSuggestedGbp,
    reviewReason: currency === 'USD' && hasPrice && hasSuggestedGbp
      ? 'Official manufacturer price, converted from USD.'
      : null,
    usdReviewWarning: currency === 'USD' && hasPrice && hasSuggestedGbp
      ? 'Official price is USD — converted GBP requires review.'
      : null,
  }
}

function assert(condition, label) {
  if (!condition) throw new Error(label)
}

assert(EVIDENCE_SOURCE_TYPES.length === 7, 'expected seven evidence source types')
assert(getDefaultConfidenceForSourceType('manufacturer_pdf') === 100, 'manufacturer PDF default')
assert(getDefaultConfidenceForSourceType('official_website') === 95, 'official website default')
assert(getDefaultConfidenceForSourceType('dealer_catalogue') === 90, 'dealer catalogue default')
assert(getDefaultConfidenceForSourceType('dealer_product_page') === 80, 'dealer product page default')
assert(getDefaultConfidenceForSourceType('trade_publication') === 70, 'trade publication default')
assert(getDefaultConfidenceForSourceType('forum_estimate') === 50, 'forum estimate default')
assert(getDefaultConfidenceForSourceType('manual_estimate') === 40, 'manual estimate default')

assert(
  deriveEvidenceStatus({ bestValuePresent: false, sourceCount: 0 }) === 'missing',
  'no sources and no best value should be missing',
)
assert(
  deriveEvidenceStatus({ bestValuePresent: true, confidence: EVIDENCE_VERIFIED_CONFIDENCE_THRESHOLD }) === 'verified',
  'best value at verified threshold should be verified',
)
assert(
  deriveEvidenceStatus({ bestValuePresent: true, confidence: 70 }) === 'needs_review',
  'best value below threshold should need review',
)
assert(
  deriveEvidenceStatus({ bestValuePresent: false, sourceCount: 2 }) === 'needs_review',
  'sources without best value should need review',
)

assert(
  derivePriceEvidenceStatus({ best_original_price: 5000, best_original_price_confidence: 95 }, 1) === 'verified',
  'price evidence with high confidence should be verified',
)
assert(
  derivePriceEvidenceStatus({ best_original_price: null }, 0) === 'missing',
  'missing price evidence should be missing',
)

assert(
  derivePriceEvidenceStatus({
    best_original_price: 7500,
    best_original_price_currency: 'USD',
    best_original_price_confidence: 95,
  }, 1) === 'needs_review',
  'USD price with high confidence should still need review',
)

assert(
  derivePriceEvidenceStatus({
    best_original_price: 7500,
    best_original_price_currency: 'GBP',
    best_original_price_confidence: 95,
  }, 1) === 'verified',
  'GBP price with high confidence should be verified',
)

assert(
  deriveResearchPriceReviewStatus({
    original_new_price: 9995,
    source_original_price: 9995,
    source_original_currency: 'USD',
    converted_original_price_gbp: 7496,
    currency: 'USD',
    price_confidence: 95,
    price_review_status: 'converted',
  }) === 'converted',
  'USD research recommendation with conversion should be converted',
)

assert(
  deriveResearchPriceReviewStatus({
    original_new_price: 7544,
    source_original_price: 7544,
    source_original_currency: 'GBP',
    converted_original_price_gbp: 7544,
    currency: 'GBP',
    price_confidence: 95,
  }) === 'verified',
  'GBP research recommendation with high confidence should be verified',
)

assert(
  deriveLifecycleEvidenceStatus({
    manufacture_start_year: 2015,
    manufacture_end_year: 2018,
    manufacture_year_confidence: 95,
  }, 1) === 'verified',
  'lifecycle evidence with high confidence should be verified',
)
assert(
  deriveLifecycleEvidenceStatus({}, 0) === 'missing',
  'missing lifecycle evidence should be missing',
)

assert(
  formatManufactureYearRange({ manufacture_start_year: 2015, manufacture_end_year: 2018 }) === '2015–2018',
  'year range should format as start–end',
)
assert(
  formatManufactureYearRange({ manufacture_start_year: 2020, manufacture_end_year: 2020 }) === '2020',
  'same start/end year should format as single year',
)

assert(IN_QUERY_CHUNK_SIZE === 100, 'in-query chunk size should be 100')
assert(chunkArray([]).length === 0, 'empty array should produce no chunks')
assert(chunkArray([1, 2, 3], 2).length === 2, 'should split into two chunks')
assert(chunkArray([1, 2, 3], 2)[0].length === 2, 'first chunk should have two items')
assert(chunkArray([1, 2, 3], 2)[1].length === 1, 'second chunk should have one item')
assert(
  dedupeRowsById([{ id: 'a' }, { id: 'b' }, { id: 'a', brand: 'x' }]).length === 2,
  'dedupe should keep last row per id',
)
assert(
  dedupeRowsById([{ id: 'a' }, { id: 'b' }, { id: 'a', brand: 'x' }]).find((row) => row.id === 'a').brand === 'x',
  'dedupe should prefer later duplicate',
)

const officialUsdDetails = getResearchOfficialPriceDetails({
  original_new_price: 4995,
  currency: 'USD',
  source_original_price: 4995,
  source_original_currency: 'USD',
  converted_original_price_gbp: 3746,
  conversion_method: 'server_usd_gbp_exchange_rate',
  exchange_rate_used: 0.75,
})
assert(officialUsdDetails.isOfficialUsd === true, 'USD official price details should flag review')
assert(
  officialUsdDetails.usdReviewWarning === 'Official price is USD — converted GBP requires review.',
  'USD official price should include review warning',
)
assert(
  officialUsdDetails.reviewReason === 'Official manufacturer price, converted from USD.',
  'USD official price should include review reason',
)

const usdApproveUpdate = buildResearchApproveUpdate({
  original_new_price: 4367,
  source_original_price: 4367,
  source_original_currency: 'USD',
  converted_original_price_gbp: 3275,
  currency: 'USD',
  price_confidence: 95,
})
assert(usdApproveUpdate.original_rrp === 4367, 'USD approve should keep source amount on original_rrp')
assert(usdApproveUpdate.currency === 'USD', 'USD approve should keep USD on original_rrp currency')
assert(usdApproveUpdate.best_original_price === 3275, 'USD approve should store converted GBP valuation')
assert(
  usdApproveUpdate.best_original_price_currency === 'GBP',
  'USD approve should store GBP on best_original_price_currency',
)
assert(
  !(usdApproveUpdate.best_original_price_currency === 'GBP' && usdApproveUpdate.best_original_price === 4367),
  '$4367 USD must never be stored as £4367 GBP',
)

function patchPriorityGroupAfterEquipmentUpdate(group, equipmentId, equipmentPatch) {
  if (!group?.equipment_ids?.includes(equipmentId)) {
    return group
  }

  const patch = equipmentPatch ?? {}
  const priceSourceCount = group.priceSourceCount ?? 0
  let updated = { ...group }

  const hasNewPrice = Number(patch.best_original_price) > 0
  const currentPriceConfidence = Number(group.best_original_price_confidence ?? 0)
  const newPriceConfidence = Number(patch.best_original_price_confidence ?? 0)
  const shouldUpdatePrice = hasNewPrice && (
    equipmentId === group.representative_equipment_id
    || newPriceConfidence >= currentPriceConfidence
    || !(Number(group.best_original_price) > 0)
  )

  if (shouldUpdatePrice) {
    updated = {
      ...updated,
      best_original_price: patch.best_original_price,
      best_original_price_currency: patch.best_original_price_currency,
      best_original_price_confidence: patch.best_original_price_confidence,
      priceStatus: derivePriceEvidenceStatus({
        best_original_price: patch.best_original_price,
        best_original_price_currency: patch.best_original_price_currency,
        best_original_price_confidence: patch.best_original_price_confidence,
        currency: patch.currency,
      }, priceSourceCount),
    }
  }

  return updated
}

function patchPriorityGroupsAfterEquipmentUpdate(groups, equipmentId, equipmentPatch) {
  return (groups ?? []).map((group) => patchPriorityGroupAfterEquipmentUpdate(
    group,
    equipmentId,
    equipmentPatch,
  ))
}

const sampleGroups = [
  {
    keyword_key: 'life-fitness-95ti',
    equipment_ids: ['eq-1', 'eq-2'],
    representative_equipment_id: 'eq-1',
    best_original_price: null,
    best_original_price_confidence: null,
    priceSourceCount: 0,
    priceStatus: 'missing',
  },
]

const patchedGroups = patchPriorityGroupsAfterEquipmentUpdate(sampleGroups, 'eq-1', {
  best_original_price: 4995,
  best_original_price_currency: 'GBP',
  best_original_price_confidence: 95,
  currency: 'GBP',
})
assert(
  patchedGroups[0].best_original_price === 4995,
  'local group patch should update best original price without full table reload',
)
assert(
  patchedGroups[0].priceStatus === 'verified',
  'local group patch should update price status when confidence is high',
)
assert(
  patchPriorityGroupsAfterEquipmentUpdate(sampleGroups, 'eq-99', { best_original_price: 100 })[0].best_original_price == null,
  'local group patch should ignore unrelated equipment ids',
)

console.log('equipment intelligence evidence tests passed')
