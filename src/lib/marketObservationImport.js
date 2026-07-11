import { isSupabaseConfigured, supabase } from './supabase'

export const SAMPLE_MARKET_OBSERVATION_CSV = `observed_price,estimated_age_years,condition,source_type,source_domain,confidence_score,notes
650,12,good,marketplace,ebay.co.uk,85,"Active listing, working condition"
500,15,fair,dealer,exampledealer.co.uk,75,"Older commercial unit"
800,10,refurbished,dealer,exampledealer.co.uk,90,"Refurbished with warranty"`

export const IMPORT_COLUMNS = [
  { key: 'observed_price', label: 'Price', required: true },
  { key: 'estimated_age_years', label: 'Age (years)', required: false },
  { key: 'condition', label: 'Condition', required: false },
  { key: 'source_type', label: 'Source type', required: false },
  { key: 'source_domain', label: 'Source domain', required: false },
  { key: 'confidence_score', label: 'Confidence', required: false },
  { key: 'notes', label: 'Notes', required: false },
  { key: 'observed_at', label: 'Observed at', required: false },
]

const CONDITION_ALIASES = {
  excellent: 'excellent',
  excellent_condition: 'excellent',
  good: 'good',
  fair: 'fair',
  poor: 'poor',
  faulty: 'faulty',
  broken: 'faulty',
  refurbished: 'refurbished',
  refurb: 'refurbished',
  unknown: 'unknown',
  n_a: 'unknown',
  na: 'unknown',
}

const SOURCE_TYPE_ALIASES = {
  marketplace: 'marketplace',
  market_place: 'marketplace',
  ebay: 'marketplace',
  gumtree: 'marketplace',
  facebook: 'marketplace',
  dealer: 'dealer',
  shop: 'dealer',
  auction: 'auction',
  liquidation: 'liquidation',
  liquidator: 'liquidation',
  equipd: 'equipd',
  user_submission: 'user_submission',
  user: 'user_submission',
  submission: 'user_submission',
  other: 'other',
}

const HEADER_ALIASES = {
  observed_price: 'observed_price',
  price: 'observed_price',
  price_gbp: 'observed_price',
  amount: 'observed_price',
  estimated_age_years: 'estimated_age_years',
  age: 'estimated_age_years',
  age_years: 'estimated_age_years',
  condition: 'condition',
  source_type: 'source_type',
  source: 'source_type',
  source_domain: 'source_domain',
  domain: 'source_domain',
  confidence_score: 'confidence_score',
  confidence: 'confidence_score',
  notes: 'notes',
  note: 'notes',
  observed_at: 'observed_at',
  date: 'observed_at',
  observed_date: 'observed_at',
}

export function createEmptyObservationRow() {
  return {
    observed_price: '',
    estimated_age_years: '',
    condition: '',
    source_type: '',
    source_domain: '',
    confidence_score: '',
    notes: '',
    observed_at: '',
  }
}

function blankToNull(value) {
  if (value == null) return null
  const trimmed = String(value).trim()
  return trimmed === '' ? null : trimmed
}

function normalizeKey(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_')
}

function normalizeCondition(value) {
  const raw = blankToNull(value)
  if (raw == null) return null
  const key = normalizeKey(raw)
  return CONDITION_ALIASES[key] ?? key
}

function normalizeSourceType(value) {
  const raw = blankToNull(value)
  if (raw == null) return null
  const key = normalizeKey(raw)
  return SOURCE_TYPE_ALIASES[key] ?? key
}

function parsePositiveNumber(value, { allowZero = false } = {}) {
  const raw = blankToNull(value)
  if (raw == null) return { value: null, error: null }

  const cleaned = String(raw).replace(/[£$,\s]/g, '')
  const number = Number(cleaned)
  if (!Number.isFinite(number)) {
    return { value: null, error: 'must be a number' }
  }
  if (allowZero ? number < 0 : number <= 0) {
    return { value: null, error: allowZero ? 'must be zero or positive' : 'must be a positive number' }
  }
  return { value: number, error: null }
}

function parseConfidence(value) {
  const raw = blankToNull(value)
  if (raw == null) return { value: null, error: null }

  const number = Number(String(raw).replace(/%/g, '').trim())
  if (!Number.isFinite(number)) {
    return { value: null, error: 'must be a number' }
  }
  if (number < 0 || number > 100) {
    return { value: null, error: 'must be between 0 and 100' }
  }
  return { value: number, error: null }
}

function parseObservedAt(value) {
  const raw = blankToNull(value)
  if (raw == null) return { value: null, error: null }

  const date = new Date(raw)
  if (Number.isNaN(date.getTime())) {
    return { value: null, error: 'must be a valid date' }
  }
  return { value: date.toISOString(), error: null }
}

/**
 * RFC4180-ish CSV line parser supporting quoted fields.
 */
export function parseCsvLine(line) {
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

export function parseCsvText(csvText) {
  const lines = String(csvText ?? '')
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line) => line.trim() !== '')

  if (lines.length === 0) {
    return { rows: [], error: 'CSV is empty.' }
  }

  const headerCells = parseCsvLine(lines[0]).map((cell) => normalizeKey(cell))
  const mappedHeaders = headerCells.map((header) => HEADER_ALIASES[header] ?? null)

  if (!mappedHeaders.includes('observed_price')) {
    return {
      rows: [],
      error: 'CSV must include an observed_price column.',
    }
  }

  const rows = lines.slice(1).map((line, index) => {
    const cells = parseCsvLine(line)
    const row = createEmptyObservationRow()

    mappedHeaders.forEach((key, cellIndex) => {
      if (!key) return
      row[key] = cells[cellIndex] ?? ''
    })

    return {
      ...row,
      _sourceLine: index + 2,
    }
  })

  return { rows, error: null }
}

export function validateObservationRow(row, rowNumber) {
  const errors = []

  const price = parsePositiveNumber(row.observed_price)
  if (blankToNull(row.observed_price) == null) {
    errors.push('observed_price is required')
  } else if (price.error) {
    errors.push(`observed_price ${price.error}`)
  }

  const age = parsePositiveNumber(row.estimated_age_years)
  if (age.error) {
    errors.push(`estimated_age_years ${age.error}`)
  }

  const confidence = parseConfidence(row.confidence_score)
  if (confidence.error) {
    errors.push(`confidence_score ${confidence.error}`)
  }

  const observedAt = parseObservedAt(row.observed_at)
  if (observedAt.error) {
    errors.push(`observed_at ${observedAt.error}`)
  }

  const condition = normalizeCondition(row.condition)
  const sourceType = normalizeSourceType(row.source_type)

  const normalised = {
    observed_price: price.value,
    estimated_age_years: age.value,
    condition,
    source_type: sourceType,
    source_domain: blankToNull(row.source_domain),
    confidence_score: confidence.value,
    notes: blankToNull(row.notes),
    observed_at: observedAt.value,
  }

  return {
    rowNumber,
    valid: errors.length === 0,
    errors,
    input: row,
    normalised,
  }
}

function isRowEffectivelyEmpty(row) {
  return IMPORT_COLUMNS.every((column) => blankToNull(row?.[column.key]) == null)
}

export function validateObservationRows(rows) {
  const results = (rows ?? [])
    .map((row, index) => ({ row, index }))
    .filter(({ row }) => !isRowEffectivelyEmpty(row))
    .map(({ row, index }) =>
      validateObservationRow(row, row._sourceLine ?? index + 1),
    )

  const validRows = results.filter((row) => row.valid)
  const invalidRows = results.filter((row) => !row.valid)

  return {
    results,
    validRows,
    invalidRows,
    validCount: validRows.length,
    invalidCount: invalidRows.length,
  }
}

export async function importMarketObservations(equipmentModelId, validatedRows) {
  if (!isSupabaseConfigured || !supabase) {
    return { insertedCount: 0, error: new Error('Supabase is not configured.') }
  }

  if (!equipmentModelId) {
    return { insertedCount: 0, error: new Error('Select an equipment model first.') }
  }

  const payload = (validatedRows ?? [])
    .filter((row) => row.valid)
    .map((row) => ({
      observed_price: row.normalised.observed_price,
      currency: 'GBP',
      estimated_age_years: row.normalised.estimated_age_years,
      condition: row.normalised.condition,
      source_type: row.normalised.source_type,
      source_domain: row.normalised.source_domain,
      confidence_score: row.normalised.confidence_score,
      notes: row.normalised.notes,
      observed_at: row.normalised.observed_at ?? new Date().toISOString(),
    }))

  if (payload.length === 0) {
    return { insertedCount: 0, error: new Error('No valid rows to import.') }
  }

  // Admin-only security definer RPC (is_admin check server-side).
  const { data, error } = await supabase.rpc('admin_import_market_observations', {
    p_equipment_model_id: equipmentModelId,
    p_rows: payload,
  })

  if (error) {
    return { insertedCount: 0, error }
  }

  return { insertedCount: Number(data) || 0, error: null }
}
