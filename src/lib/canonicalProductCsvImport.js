/**
 * Authoritative canonical product CSV import for Equipment Intelligence.
 *
 * Upserts equipment_products by slug (= canonical_product_key).
 * Non-blank CSV values overwrite canonical fields used by valuation.
 * Blank CSV values do not erase existing data.
 * Does not use automatic intelligence → product promotion.
 */

import {
  buildManufactureYearDropdownOptions,
  calculateEquipmentProductValuation,
} from './equipmentValuation.js'
import {
  buildCanonicalProductDisplayName,
  getCanonicalDisplayNameSeriesWarning,
} from './canonicalProductDisplayName.js'

export const CANONICAL_CSV_IMPORT_SOURCE = 'canonical_csv_import'

export const PRODUCT_STATUS = Object.freeze({
  PENDING: 'pending',
  APPROVED: 'approved',
  EXCLUDED: 'excluded',
  NEEDS_REVIEW: 'needs_review',
})

const CANONICAL_PRODUCT_SELECT_FIELDS = [
  'id',
  'brand',
  'product_family',
  'model',
  'equipment_type',
  'canonical_product_name',
  'canonical_product_key',
  'baseline_manufacture_year',
  'production_start_year',
  'production_end_year',
  'original_base_price',
  'original_base_price_currency',
  'original_price_source',
  'baseline_source',
  'original_price_confidence',
  'lifecycle_confidence',
  'status',
  'image_status',
  'created_at',
  'updated_at',
].join(', ')

function parseCsvLine(line) {
  const cells = []
  let current = ''
  let inQuotes = false

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index]
    const next = line[index + 1]

    if (inQuotes) {
      if (char === '"' && next === '"') {
        current += '"'
        index += 1
      } else if (char === '"') {
        inQuotes = false
      } else {
        current += char
      }
      continue
    }

    if (char === '"') {
      inQuotes = true
      continue
    }

    if (char === ',') {
      cells.push(current)
      current = ''
      continue
    }

    current += char
  }

  cells.push(current)
  return cells
}

export const CANONICAL_PRODUCT_CSV_COLUMNS = [
  'brand',
  'series',
  'model',
  'category',
  'equipment_type',
  'baseline_manufacture_year',
  'production_end_year',
  'original_rrp',
  'estimated_trade_in_value',
  'market_observations',
  'confidence',
  'currency',
  'slug',
  'approval_status',
]

export const SAMPLE_CANONICAL_PRODUCT_CSV = `brand,series,model,category,equipment_type,baseline_manufacture_year,production_end_year,original_rrp,estimated_trade_in_value,market_observations,confidence,currency,slug,approval_status
Concept2,Indoor Rower,Model D,Rowing Machines,Rowers,2018,,1200,650,1850;1950;2100,Medium,GBP,concept2-model-d,approved
Life Fitness,95 Series,95Ti,Treadmills,Treadmill,2015,2020,8500,2200,"[{""price"":2200,""source"":""Dealer"",""confidence"":85}]",High,GBP,life-fitness-95ti,pending`

export const CANONICAL_CSV_GUIDANCE = [
  'Upload or paste a canonical product CSV. Rows are upserted by slug.',
  'Non-blank values update the canonical product directly, including original RRP and baseline manufacture year.',
  'Blank values do not overwrite existing data. Images can be added separately after import.',
].join(' ')

export const CANONICAL_CSV_ROW_ACTION = Object.freeze({
  CREATE: 'create',
  UPDATE: 'update',
  UNCHANGED: 'unchanged',
  FAIL: 'fail',
})

const SUPPORTED_CURRENCIES = new Set(['GBP', 'USD', 'EUR'])

const CONFIDENCE_TO_SCORE = {
  low: 40,
  medium: 70,
  high: 90,
}

const APPROVAL_STATUS_ALIASES = {
  pending: PRODUCT_STATUS.PENDING,
  approved: PRODUCT_STATUS.APPROVED,
  needs_review: PRODUCT_STATUS.NEEDS_REVIEW,
  'needs-review': PRODUCT_STATUS.NEEDS_REVIEW,
  excluded: PRODUCT_STATUS.EXCLUDED,
}

const CSV_HEADER_ALIASES = {
  brand: 'brand',
  series: 'series',
  model: 'model',
  category: 'category',
  equipment_type: 'equipment_type',
  equipmenttype: 'equipment_type',
  type: 'equipment_type',
  baseline_manufacture_year: 'baseline_manufacture_year',
  baselinemanufactureyear: 'baseline_manufacture_year',
  manufacture_year: 'manufacture_year',
  manufactureyear: 'manufacture_year',
  year: 'manufacture_year',
  production_end_year: 'production_end_year',
  productionendyear: 'production_end_year',
  original_rrp: 'original_rrp',
  originalrrp: 'original_rrp',
  rrp: 'original_rrp',
  original_base_price: 'original_rrp',
  estimated_trade_in_value: 'estimated_trade_in_value',
  estimatedtradeinvalue: 'estimated_trade_in_value',
  trade_in: 'estimated_trade_in_value',
  trade_in_value: 'estimated_trade_in_value',
  market_observations: 'market_observations',
  marketobservations: 'market_observations',
  observations: 'market_observations',
  confidence: 'confidence',
  currency: 'currency',
  slug: 'slug',
  approval_status: 'approval_status',
  approvalstatus: 'approval_status',
  status: 'approval_status',
}

function blankToNull(value) {
  if (value == null) return null
  const trimmed = String(value).trim()
  return trimmed === '' ? null : trimmed
}

function normalizeCsvHeader(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_')
}

function parseOptionalNumber(value) {
  const raw = blankToNull(value)
  if (raw == null) return { value: null, error: null }
  const cleaned = String(raw).replace(/[£$,\s]/g, '')
  const number = Number(cleaned)
  if (!Number.isFinite(number)) return { value: null, error: 'must be a number' }
  return { value: number, error: null }
}

function parseFourDigitYear(value, { required = false } = {}) {
  const raw = blankToNull(value)
  if (raw == null) {
    return required
      ? { value: null, error: 'required four-digit year' }
      : { value: null, error: null }
  }
  if (!/^\d{4}$/.test(raw)) {
    return { value: null, error: 'must be a four-digit year' }
  }
  const year = Number(raw)
  const current = new Date().getFullYear()
  if (year < 1970 || year > current + 1) {
    return { value: null, error: `must be between 1970 and ${current + 1}` }
  }
  return { value: year, error: null }
}

function parseMarketObservationsField(value, currency = 'GBP') {
  const raw = blankToNull(value)
  if (raw == null) return { value: null, error: null }

  if (raw.startsWith('[')) {
    try {
      const parsed = JSON.parse(raw)
      if (!Array.isArray(parsed)) {
        return { value: null, error: 'must be a JSON array' }
      }
      return { value: parsed, error: null }
    } catch {
      return { value: null, error: 'must be valid JSON array' }
    }
  }

  if (raw.includes(';')) {
    const prices = raw
      .split(';')
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => Number(String(part).replace(/[£$,\s]/g, '')))
      .filter((price) => Number.isFinite(price) && price >= 0)

    if (prices.length === 0) {
      return { value: null, error: 'semicolon list must include at least one price' }
    }

    return {
      value: prices.map((price) => ({
        price,
        currency,
        source: 'import',
        confidence: 70,
      })),
      error: null,
    }
  }

  const singlePrice = Number(String(raw).replace(/[£$,\s]/g, ''))
  if (Number.isFinite(singlePrice) && singlePrice >= 0) {
    return {
      value: [{ price: singlePrice, currency, source: 'import', confidence: 70 }],
      error: null,
    }
  }

  return { value: null, error: 'must be blank, JSON array, or semicolon-separated prices' }
}

function isValidSlug(slug) {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)
}

function mapConfidenceToScore(label) {
  return CONFIDENCE_TO_SCORE[String(label).toLowerCase()] ?? null
}

function formatMoney(value, currency = 'GBP') {
  if (value == null || value === '') return 'blank'
  const amount = Number(value)
  if (!Number.isFinite(amount)) return String(value)
  try {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: currency || 'GBP',
      maximumFractionDigits: 0,
    }).format(amount)
  } catch {
    return `${currency} ${amount}`
  }
}

function formatPreviewValue(field, value, currency = 'GBP') {
  if (value == null || value === '') return 'blank'
  if (field === 'original_rrp' || field === 'original_base_price' || field === 'estimated_trade_in_value') {
    return formatMoney(value, currency)
  }
  return String(value)
}

export function buildCanonicalProductName({ brand, series, model }) {
  return buildCanonicalProductDisplayName({ brand, series, model })
}

export function parseCanonicalProductCsv(csvText) {
  const lines = String(csvText ?? '')
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line) => line.trim() !== '')

  if (lines.length === 0) {
    return { rows: [], headers: [], warnings: [], error: 'CSV is empty.' }
  }

  const headerCells = parseCsvLine(lines[0]).map((cell) => normalizeCsvHeader(cell))
  const mappedHeaders = headerCells.map((header) => CSV_HEADER_ALIASES[header] ?? header)
  const warnings = []

  if (mappedHeaders.includes('manufacture_year') && !mappedHeaders.includes('baseline_manufacture_year')) {
    warnings.push(
      'manufacture_year is deprecated; it is accepted as an alias for baseline_manufacture_year. Prefer baseline_manufacture_year.',
    )
  }

  const requiredHeaders = ['brand', 'model', 'slug', 'original_rrp', 'equipment_type']
  const hasBaselineHeader = mappedHeaders.includes('baseline_manufacture_year')
    || mappedHeaders.includes('manufacture_year')
  if (!hasBaselineHeader) {
    requiredHeaders.push('baseline_manufacture_year')
  }

  const missingRequired = requiredHeaders.filter((header) => !mappedHeaders.includes(header))
  if (missingRequired.length > 0) {
    return {
      rows: [],
      headers: mappedHeaders,
      warnings,
      error: `Missing required column(s): ${missingRequired.join(', ')}.`,
    }
  }

  const rows = []
  for (let i = 1; i < lines.length; i += 1) {
    const cells = parseCsvLine(lines[i])
    const raw = Object.fromEntries(CANONICAL_PRODUCT_CSV_COLUMNS.map((key) => [key, '']))
    mappedHeaders.forEach((header, index) => {
      if (!header) return
      if (header === 'manufacture_year') {
        if (!raw.baseline_manufacture_year) {
          raw.baseline_manufacture_year = cells[index] ?? ''
        }
        raw.manufacture_year = cells[index] ?? ''
        return
      }
      if (Object.prototype.hasOwnProperty.call(raw, header) || header === 'manufacture_year') {
        raw[header] = cells[index] ?? ''
      }
    })

    const usedDeprecatedManufactureYear = mappedHeaders.includes('manufacture_year')
      && !mappedHeaders.includes('baseline_manufacture_year')
      && Boolean(blankToNull(raw.baseline_manufacture_year))

    rows.push({
      lineNumber: i + 1,
      raw,
      usedDeprecatedManufactureYear,
    })
  }

  return { rows, headers: mappedHeaders, warnings, error: null }
}

export function normalizeCanonicalProductCsvRow(row) {
  const raw = row?.raw ?? row ?? {}
  const errors = []
  const warnings = []

  if (row?.usedDeprecatedManufactureYear || blankToNull(raw.manufacture_year)) {
    warnings.push('manufacture_year is deprecated; prefer baseline_manufacture_year')
  }

  const brand = blankToNull(raw.brand)
  const series = blankToNull(raw.series)
  const model = blankToNull(raw.model)
  const category = blankToNull(raw.category)
  const equipmentType = blankToNull(raw.equipment_type)
  const slug = blankToNull(raw.slug)?.toLowerCase() ?? null
  const currencyProvided = blankToNull(raw.currency)
  const currency = currencyProvided ? currencyProvided.toUpperCase() : null
  const confidenceProvided = blankToNull(raw.confidence)
  const approvalProvided = blankToNull(raw.approval_status)?.toLowerCase() ?? null

  if (!slug) {
    errors.push('slug is required')
  } else if (!isValidSlug(slug)) {
    errors.push('slug must be lowercase letters, numbers, and hyphens')
  }

  if (currency && !SUPPORTED_CURRENCIES.has(currency)) {
    errors.push(`currency must be one of ${[...SUPPORTED_CURRENCIES].join(', ')}`)
  }

  let confidenceLabel = null
  let confidenceScore = null
  if (confidenceProvided) {
    confidenceLabel = confidenceProvided
    confidenceScore = mapConfidenceToScore(confidenceLabel)
    if (confidenceScore == null) {
      errors.push('confidence must be Low, Medium or High')
    }
  }

  let approvalStatus = null
  if (approvalProvided) {
    approvalStatus = APPROVAL_STATUS_ALIASES[approvalProvided]
    if (!approvalStatus) {
      errors.push('approval_status must be pending, approved, needs_review, or excluded')
    }
  }

  const observationCurrency = currency || 'GBP'
  const baseline = parseFourDigitYear(
    raw.baseline_manufacture_year || raw.manufacture_year,
    { required: false },
  )
  if (baseline.error) errors.push(`baseline_manufacture_year ${baseline.error}`)

  const endYear = parseFourDigitYear(raw.production_end_year, { required: false })
  if (endYear.error) errors.push(`production_end_year ${endYear.error}`)
  if (
    baseline.value != null
    && endYear.value != null
    && endYear.value < baseline.value
  ) {
    errors.push('production_end_year must not be earlier than baseline_manufacture_year')
  }

  const rrp = parseOptionalNumber(raw.original_rrp)
  if (rrp.error) errors.push(`original_rrp ${rrp.error}`)
  else if (rrp.value != null && rrp.value <= 0) errors.push('original_rrp must be a positive number')

  const tradeIn = parseOptionalNumber(raw.estimated_trade_in_value)
  if (tradeIn.error) errors.push(`estimated_trade_in_value ${tradeIn.error}`)
  else if (tradeIn.value != null && tradeIn.value < 0) {
    errors.push('estimated_trade_in_value must be blank or a non-negative number')
  }

  const observations = parseMarketObservationsField(raw.market_observations, observationCurrency)
  if (observations.error) errors.push(`market_observations ${observations.error}`)

  const normalised = {
    brand,
    series,
    model,
    category,
    equipment_type: equipmentType,
    baseline_manufacture_year: baseline.value,
    production_end_year: endYear.value,
    original_rrp: rrp.value,
    estimated_trade_in_value: tradeIn.value,
    market_observations: observations.value,
    confidence: confidenceLabel,
    confidence_score: confidenceScore,
    currency,
    slug,
    approval_status: approvalStatus,
    canonical_product_name: buildCanonicalProductName({ brand, series, model }),
    product_family: series,
  }

  const seriesWarning = getCanonicalDisplayNameSeriesWarning({ brand, series, model })
  if (seriesWarning) warnings.push(seriesWarning)

  return {
    lineNumber: row?.lineNumber ?? null,
    raw,
    normalised,
    valid: errors.length === 0,
    errors,
    warnings,
  }
}

export function validateCanonicalProductCsvRows(parsedRows = []) {
  const validated = parsedRows.map((row) => normalizeCanonicalProductCsvRow(row))
  const slugCounts = new Map()
  for (const row of validated) {
    const slug = row.normalised?.slug
    if (!slug) continue
    slugCounts.set(slug, (slugCounts.get(slug) || 0) + 1)
  }
  for (const row of validated) {
    const slug = row.normalised?.slug
    if (slug && slugCounts.get(slug) > 1) {
      row.errors.push('slug is duplicated within this CSV')
      row.valid = false
    }
  }
  return {
    rows: validated,
    validCount: validated.filter((row) => row.valid).length,
    invalidCount: validated.filter((row) => !row.valid).length,
  }
}

function valuesEqual(left, right) {
  if (left == null && right == null) return true
  if (left == null || right == null) return false
  return String(left) === String(right)
}

export function buildCanonicalFieldChanges(existing, normalised) {
  const currency = normalised.currency || existing?.original_base_price_currency || 'GBP'
  const specs = [
    {
      key: 'brand',
      label: 'Brand',
      current: existing?.brand ?? null,
      next: normalised.brand,
    },
    {
      key: 'product_family',
      label: 'Series',
      current: existing?.product_family ?? null,
      next: normalised.product_family,
    },
    {
      key: 'model',
      label: 'Model',
      current: existing?.model ?? null,
      next: normalised.model,
    },
    {
      key: 'equipment_type',
      label: 'Equipment type',
      current: existing?.equipment_type ?? null,
      next: normalised.equipment_type,
    },
    {
      key: 'baseline_manufacture_year',
      label: 'Baseline manufacture year',
      current: existing?.baseline_manufacture_year ?? null,
      next: normalised.baseline_manufacture_year,
    },
    {
      key: 'production_end_year',
      label: 'Production end year',
      current: existing?.production_end_year ?? null,
      next: normalised.production_end_year,
    },
    {
      key: 'original_base_price',
      label: 'Original RRP',
      current: existing?.original_base_price ?? null,
      next: normalised.original_rrp,
    },
    {
      key: 'original_base_price_currency',
      label: 'Currency',
      current: existing?.original_base_price_currency ?? null,
      next: normalised.currency,
    },
    {
      key: 'status',
      label: 'Approval status',
      current: existing?.status ?? null,
      next: normalised.approval_status,
    },
  ]

  const changes = []
  for (const spec of specs) {
    if (spec.next == null || spec.next === '') continue
    if (valuesEqual(spec.current, spec.next)) continue
    changes.push({
      key: spec.key,
      label: spec.label,
      from: formatPreviewValue(spec.key, spec.current, currency),
      to: formatPreviewValue(spec.key, spec.next, currency),
      currentValue: spec.current,
      nextValue: spec.next,
      summary: `${spec.label}: ${formatPreviewValue(spec.key, spec.current, currency)} → ${formatPreviewValue(spec.key, spec.next, currency)}`,
    })
  }
  return changes
}

function createRequiredFieldErrors(normalised) {
  const errors = []
  if (!normalised.slug) errors.push('slug is required')
  if (!normalised.brand) errors.push('brand is required')
  if (!normalised.model) errors.push('model is required')
  if (!normalised.equipment_type) errors.push('equipment_type is required')
  if (normalised.baseline_manufacture_year == null) {
    errors.push('baseline_manufacture_year is required for new products')
  }
  if (normalised.original_rrp == null) {
    errors.push('original_rrp is required for new products')
  }
  if (!normalised.currency) {
    errors.push('currency is required for new products')
  }
  if (normalised.confidence_score == null) {
    errors.push('confidence is required for new products')
  }
  if (!normalised.approval_status) {
    errors.push('approval_status is required for new products')
  }
  return errors
}

export function buildCanonicalCsvImportPlan(validatedRows = [], existingBySlug = new Map()) {
  return validatedRows.map((row) => {
    if (!row.valid || !row.normalised?.slug) {
      return {
        ...row,
        action: CANONICAL_CSV_ROW_ACTION.FAIL,
        existing: null,
        changes: [],
        changeSummaries: row.errors?.length ? row.errors : ['slug is required'],
      }
    }

    const existing = existingBySlug.get(row.normalised.slug) ?? null

    if (!existing) {
      const createErrors = createRequiredFieldErrors(row.normalised)
      if (createErrors.length) {
        return {
          ...row,
          valid: false,
          errors: [...(row.errors || []), ...createErrors],
          action: CANONICAL_CSV_ROW_ACTION.FAIL,
          existing: null,
          changes: [],
          changeSummaries: createErrors,
        }
      }
    }

    const changes = buildCanonicalFieldChanges(existing, row.normalised)
    let action = CANONICAL_CSV_ROW_ACTION.UNCHANGED
    if (!existing) action = CANONICAL_CSV_ROW_ACTION.CREATE
    else if (changes.length > 0) action = CANONICAL_CSV_ROW_ACTION.UPDATE

    return {
      ...row,
      action,
      existing,
      changes,
      changeSummaries: changes.map((change) => change.summary),
    }
  })
}

function buildInsertPayload(normalised) {
  return {
    brand: normalised.brand,
    product_family: normalised.product_family,
    model: normalised.model,
    equipment_type: normalised.equipment_type,
    canonical_product_name: normalised.canonical_product_name,
    canonical_product_key: normalised.slug,
    baseline_manufacture_year: normalised.baseline_manufacture_year,
    production_start_year: normalised.baseline_manufacture_year,
    production_end_year: normalised.production_end_year,
    original_base_price: normalised.original_rrp,
    original_base_price_currency: normalised.currency || 'GBP',
    original_price_confidence: normalised.confidence_score,
    lifecycle_confidence: normalised.confidence_score,
    original_price_source: CANONICAL_CSV_IMPORT_SOURCE,
    baseline_source: CANONICAL_CSV_IMPORT_SOURCE,
    status: normalised.approval_status || PRODUCT_STATUS.PENDING,
    source_intelligence_row_ids: [],
    image_status: 'missing',
  }
}

function buildUpdatePatch(existing, normalised) {
  const patch = { updated_at: new Date().toISOString() }
  const apply = (column, next, { sourceColumn = null } = {}) => {
    if (next == null || next === '') return
    if (valuesEqual(existing?.[column], next)) return
    patch[column] = next
    if (sourceColumn) patch[sourceColumn] = CANONICAL_CSV_IMPORT_SOURCE
  }

  apply('brand', normalised.brand)
  apply('product_family', normalised.product_family)
  apply('model', normalised.model)
  apply('equipment_type', normalised.equipment_type)
  apply('canonical_product_name', normalised.canonical_product_name)
  apply('baseline_manufacture_year', normalised.baseline_manufacture_year, {
    sourceColumn: 'baseline_source',
  })
  apply('production_end_year', normalised.production_end_year)
  apply('original_base_price', normalised.original_rrp, {
    sourceColumn: 'original_price_source',
  })
  apply('original_base_price_currency', normalised.currency)
  apply('original_price_confidence', normalised.confidence_score)
  apply('lifecycle_confidence', normalised.confidence_score)
  apply('status', normalised.approval_status)

  if (normalised.baseline_manufacture_year != null) {
    if (
      existing?.production_start_year == null
      || valuesEqual(existing?.production_start_year, existing?.baseline_manufacture_year)
    ) {
      patch.production_start_year = normalised.baseline_manufacture_year
    }
  }

  return patch
}

/** Exported for tests — insert shape written to equipment_products. */
export { buildInsertPayload as buildCanonicalCsvInsertPayload, buildUpdatePatch as buildCanonicalCsvUpdatePatch }

async function getSupabaseClient() {
  const module = await import('./supabase.js')
  return {
    isConfigured: Boolean(module.isSupabaseConfigured && module.supabase),
    supabase: module.supabase,
  }
}

async function notifyCanonicalImportIndexNow(payload) {
  try {
    const { notifyIndexNowForEquipmentChange } = await import('./indexNowNotify.js')
    notifyIndexNowForEquipmentChange(payload)
  } catch {
    // IndexNow is best-effort; never block canonical import.
  }
}

async function fetchProductsBySlugs(slugs = []) {
  const { isConfigured, supabase } = await getSupabaseClient()
  const unique = [...new Set(slugs.filter(Boolean))]
  const map = new Map()
  if (!isConfigured) return { map, error: null }

  for (let i = 0; i < unique.length; i += 80) {
    const chunk = unique.slice(i, i + 80)
    const { data, error } = await supabase
      .from('equipment_products')
      .select(CANONICAL_PRODUCT_SELECT_FIELDS)
      .in('canonical_product_key', chunk)
    if (error) return { map, error }
    for (const row of data ?? []) {
      map.set(String(row.canonical_product_key), row)
    }
  }
  return { map, error: null }
}

export async function prepareCanonicalProductCsvImport(csvText) {
  const parsed = parseCanonicalProductCsv(csvText)
  if (parsed.error) {
    return { plan: null, parseWarnings: parsed.warnings, error: parsed.error }
  }

  const validation = validateCanonicalProductCsvRows(parsed.rows)
  const validSlugs = validation.rows
    .filter((row) => row.valid)
    .map((row) => row.normalised.slug)

  const fetched = await fetchProductsBySlugs(validSlugs)
  if (fetched.error) {
    return { plan: null, parseWarnings: parsed.warnings, error: fetched.error.message || String(fetched.error) }
  }

  const planRows = buildCanonicalCsvImportPlan(validation.rows, fetched.map)
  return {
    plan: {
      rows: planRows,
      warnings: parsed.warnings,
      createCount: planRows.filter((row) => row.action === CANONICAL_CSV_ROW_ACTION.CREATE).length,
      updateCount: planRows.filter((row) => row.action === CANONICAL_CSV_ROW_ACTION.UPDATE).length,
      unchangedCount: planRows.filter((row) => row.action === CANONICAL_CSV_ROW_ACTION.UNCHANGED).length,
      failCount: planRows.filter((row) => row.action === CANONICAL_CSV_ROW_ACTION.FAIL).length,
    },
    parseWarnings: parsed.warnings,
    error: null,
  }
}

function buildRpcArgs(normalised, { forUpdate = false } = {}) {
  const args = {
    p_canonical_product_key: normalised.slug,
  }

  const setIfPresent = (param, value) => {
    if (value == null || value === '') return
    args[param] = value
  }

  setIfPresent('p_brand', normalised.brand)
  setIfPresent('p_product_family', normalised.product_family)
  setIfPresent('p_model', normalised.model)
  setIfPresent('p_equipment_type', normalised.equipment_type)
  setIfPresent('p_canonical_product_name', normalised.canonical_product_name)
  setIfPresent('p_baseline_manufacture_year', normalised.baseline_manufacture_year)
  if (!forUpdate) {
    setIfPresent('p_production_start_year', normalised.baseline_manufacture_year)
  } else if (normalised.baseline_manufacture_year != null) {
    // Let the SQL function align production_start_year only when it tracks the old baseline.
    // Do not force-overwrite a deliberately different production start.
  }
  setIfPresent('p_production_end_year', normalised.production_end_year)
  setIfPresent('p_original_base_price', normalised.original_rrp)
  setIfPresent('p_original_base_price_currency', normalised.currency)
  setIfPresent('p_original_price_confidence', normalised.confidence_score)
  setIfPresent('p_lifecycle_confidence', normalised.confidence_score)
  setIfPresent('p_status', normalised.approval_status)

  if (normalised.baseline_manufacture_year != null) {
    args.p_baseline_source = CANONICAL_CSV_IMPORT_SOURCE
  }
  if (normalised.original_rrp != null) {
    args.p_original_price_source = CANONICAL_CSV_IMPORT_SOURCE
  }

  // Creates must send currency even if callers omit it after defaults elsewhere.
  if (!forUpdate && args.p_original_base_price_currency == null) {
    args.p_original_base_price_currency = 'GBP'
  }

  return args
}

export async function applyCanonicalProductCsvImport(plan, { onProgress = null } = {}) {
  if (!plan) return { created: [], updated: [], unchanged: [], failed: [], error: 'No import plan.' }

  const { isConfigured, supabase } = await getSupabaseClient()
  if (!isConfigured) {
    return { created: [], updated: [], unchanged: [], failed: [], error: 'Supabase is not configured.' }
  }

  const created = []
  const updated = []
  const unchanged = []
  const failed = []
  const actionable = (plan.rows || []).filter((row) => (
    row.action === CANONICAL_CSV_ROW_ACTION.CREATE
    || row.action === CANONICAL_CSV_ROW_ACTION.UPDATE
  ))

  for (const row of plan.rows || []) {
    if (row.action === CANONICAL_CSV_ROW_ACTION.UNCHANGED) unchanged.push(row)
    if (row.action === CANONICAL_CSV_ROW_ACTION.FAIL) {
      failed.push({ ...row, error: row.errors?.join('; ') || 'Validation failed' })
    }
  }

  for (let index = 0; index < actionable.length; index += 1) {
    const row = actionable[index]
    onProgress?.({ completed: index, total: actionable.length, slug: row.normalised.slug })

    try {
      const forUpdate = row.action === CANONICAL_CSV_ROW_ACTION.UPDATE
      if (forUpdate) {
        const patch = buildUpdatePatch(row.existing, row.normalised)
        const keys = Object.keys(patch).filter((key) => key !== 'updated_at')
        if (!keys.length) {
          unchanged.push(row)
          continue
        }
      }

      const { data, error } = await supabase.rpc(
        'admin_upsert_canonical_product_csv',
        buildRpcArgs(row.normalised, { forUpdate }),
      )
      if (error) throw error

      await notifyCanonicalImportIndexNow({
        previous: forUpdate ? row.existing : null,
        next: data,
        action: forUpdate ? 'update' : 'create',
        includeBrandDirectory: !forUpdate,
        source: 'canonicalProductCsvImport',
      })

      if (forUpdate) updated.push({ ...row, product: data })
      else created.push({ ...row, product: data })
    } catch (error) {
      failed.push({
        ...row,
        error: error?.message || String(error),
      })
    }
  }

  onProgress?.({ completed: actionable.length, total: actionable.length })

  return {
    created,
    updated,
    unchanged,
    failed,
    error: null,
  }
}

/** Pure helper for tests: valuation result from imported-shaped product. */
export function valuationFromCanonicalCsvNormalised(normalised) {
  const product = {
    original_base_price: normalised.original_rrp,
    original_base_price_currency: normalised.currency,
    baseline_manufacture_year: normalised.baseline_manufacture_year,
    production_start_year: normalised.baseline_manufacture_year,
    production_end_year: normalised.production_end_year,
    original_price_confidence: normalised.confidence_score,
    lifecycle_confidence: normalised.confidence_score,
    brand: normalised.brand,
  }
  return {
    product,
    valuation: calculateEquipmentProductValuation(product),
    yearOptions: buildManufactureYearDropdownOptions(product),
  }
}
