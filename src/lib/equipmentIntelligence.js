import { parseCsvLine } from './marketObservationImport'
import { isSupabaseConfigured, supabase } from './supabase'

const EQUIPMENT_INTELLIGENCE_FIELDS = `
  id,
  brand,
  series,
  model,
  category,
  equipment_type,
  manufacture_year,
  original_rrp,
  estimated_trade_in_value,
  market_observations,
  confidence,
  currency,
  slug,
  last_market_sync_at,
  market_sync_status,
  market_sync_notes,
  created_at,
  updated_at
`.replace(/\s+/g, ' ').trim()

const MARKET_SYNC_STATS_FIELDS = `
  brand,
  category,
  equipment_type,
  market_sync_status,
  market_observations,
  last_market_sync_at
`.replace(/\s+/g, ' ').trim()

const MARKET_SYNC_ROW_FIELDS = `
  id,
  brand,
  series,
  model,
  slug,
  estimated_trade_in_value,
  currency,
  market_observations,
  last_market_sync_at,
  market_sync_status
`.replace(/\s+/g, ' ').trim()

const MARKET_SYNC_STATUS_OPTIONS = ['not_synced', 'pending', 'synced', 'failed']

/** PostgREST returns at most this many rows per request unless paginated. */
const SUPABASE_MAX_PAGE_SIZE = 1000

export const EQUIPMENT_INTELLIGENCE_PAGE_SIZE = 100

async function fetchAllInBatches(buildQuery, pageSize = SUPABASE_MAX_PAGE_SIZE) {
  const allRows = []
  let from = 0
  let totalCount = null

  while (true) {
    const to = from + pageSize - 1
    const { data, error, count } = await buildQuery().range(from, to)

    if (error) {
      return { data: null, count: 0, error }
    }

    if (totalCount == null) {
      totalCount = count ?? 0
    }

    const page = data ?? []
    allRows.push(...page)

    if (page.length === 0 || allRows.length >= totalCount) {
      break
    }

    from += pageSize
  }

  return { data: allRows, count: totalCount ?? allRows.length, error: null }
}

function appendEquipmentSearchFilter(query, search) {
  const trimmed = String(search ?? '').trim()
  if (!trimmed) return query

  const pattern = `%${trimmed.replace(/[%_]/g, '\\$&')}%`
  return query.or(
    [
      `brand.ilike.${pattern}`,
      `series.ilike.${pattern}`,
      `model.ilike.${pattern}`,
      `category.ilike.${pattern}`,
      `equipment_type.ilike.${pattern}`,
      `slug.ilike.${pattern}`,
      `confidence.ilike.${pattern}`,
    ].join(','),
  )
}

export function formatEquipmentIntelligenceRange({
  page = 1,
  pageSize = EQUIPMENT_INTELLIGENCE_PAGE_SIZE,
  totalCount = 0,
  visibleCount = 0,
}) {
  const total = Number(totalCount) || 0
  const visible = Number(visibleCount) || 0

  if (total === 0 || visible === 0) {
    return '0 records'
  }

  const start = (page - 1) * pageSize + 1
  const end = Math.min(start + visible - 1, total)

  if (total === 1) {
    return '1 record'
  }

  if (start === end) {
    return `Showing ${start.toLocaleString('en-GB')} of ${total.toLocaleString('en-GB')} records`
  }

  return `Showing ${start.toLocaleString('en-GB')}–${end.toLocaleString('en-GB')} of ${total.toLocaleString('en-GB')} records`
}

function uniqueSorted(values) {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b))
}

function hasMarketObservations(record) {
  return getObservationCount(record) > 0
}

function isNeverSynced(record) {
  return record?.last_market_sync_at == null
}

function isSyncedInLast30Days(record, thirtyDaysAgo) {
  if (!record?.last_market_sync_at) return false
  return new Date(record.last_market_sync_at) >= thirtyDaysAgo
}

function getThirtyDaysAgo() {
  const date = new Date()
  date.setDate(date.getDate() - 30)
  return date
}

export function formatMarketSyncStatus(status) {
  const value = String(status ?? 'not_synced').trim() || 'not_synced'
  return value
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

export function formatLastMarketSyncAt(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

function notConfiguredError() {
  return new Error('Supabase is not configured.')
}

export function getEquipmentIntelligenceDisplayName(record) {
  if (!record) return ''
  const brand = String(record.brand ?? '').replace(/\s+/g, ' ').trim()
  const series = String(record.series ?? '').replace(/\s+/g, ' ').trim()
  const model = String(record.model ?? '').replace(/\s+/g, ' ').trim()
  const seriesKey = series.toLowerCase().replace(/[^a-z0-9]+/g, '')
  const modelKey = model.toLowerCase().replace(/[^a-z0-9]+/g, '')
  const parts = []
  if (brand) parts.push(brand)
  if (series && seriesKey !== modelKey) parts.push(series)
  if (model) parts.push(model)
  return parts.join(' ')
}

export function getObservationCount(record) {
  const observations = record?.market_observations
  return Array.isArray(observations) ? observations.length : 0
}

export function formatTradeInValue(record) {
  const value = Number(record?.estimated_trade_in_value)
  if (!Number.isFinite(value)) return '—'

  const currency = record?.currency || 'GBP'
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

function matchesSearchQuery(record, query) {
  const normalized = query.trim().toLowerCase()
  if (!normalized) return true

  const haystack = [
    record.brand,
    record.series,
    record.model,
    record.category,
    record.equipment_type,
    record.slug,
    record.confidence,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()

  if (haystack.includes(normalized)) return true

  const tokens = normalized.split(/\s+/).filter(Boolean)
  return tokens.every((token) => haystack.includes(token))
}

export async function fetchEquipmentBySlug(slug) {
  const trimmed = slug?.trim()
  if (!trimmed) {
    return { data: null, error: null, notFound: true }
  }

  if (!isSupabaseConfigured || !supabase) {
    return { data: null, error: notConfiguredError(), notFound: false }
  }

  const { data, error } = await supabase
    .from('equipment_intelligence')
    .select(EQUIPMENT_INTELLIGENCE_FIELDS)
    .eq('slug', trimmed)
    .maybeSingle()

  if (error) {
    return { data: null, error, notFound: false }
  }

  if (!data) {
    return { data: null, error: null, notFound: true }
  }

  return { data, error: null, notFound: false }
}

export async function fetchEquipmentByBrand(brand) {
  const trimmed = brand?.trim()
  if (!trimmed) {
    return { data: [], error: null }
  }

  if (!isSupabaseConfigured || !supabase) {
    return { data: null, error: notConfiguredError() }
  }

  const { data, error } = await supabase
    .from('equipment_intelligence')
    .select(EQUIPMENT_INTELLIGENCE_FIELDS)
    .eq('brand', trimmed)
    .order('model', { ascending: true })

  if (error) {
    return { data: null, error }
  }

  return { data: data ?? [], error: null }
}

export async function fetchEquipmentByCategory(category) {
  const trimmed = category?.trim()
  if (!trimmed) {
    return { data: [], error: null }
  }

  if (!isSupabaseConfigured || !supabase) {
    return { data: null, error: notConfiguredError() }
  }

  const { data, error } = await supabase
    .from('equipment_intelligence')
    .select(EQUIPMENT_INTELLIGENCE_FIELDS)
    .eq('category', trimmed)
    .order('brand', { ascending: true })
    .order('model', { ascending: true })

  if (error) {
    return { data: null, error }
  }

  return { data: data ?? [], error: null }
}

export async function fetchEquipmentIntelligenceCount() {
  if (!isSupabaseConfigured || !supabase) {
    return { count: 0, error: notConfiguredError() }
  }

  const { count, error } = await supabase
    .from('equipment_intelligence')
    .select('id', { count: 'exact', head: true })

  if (error) {
    return { count: 0, error }
  }

  return { count: count ?? 0, error: null }
}

export async function fetchEquipmentIntelligenceFilterOptions() {
  if (!isSupabaseConfigured || !supabase) {
    return { brands: [], categories: [], error: notConfiguredError() }
  }

  const buildQuery = () =>
    supabase
      .from('equipment_intelligence')
      .select('brand, category', { count: 'exact' })
      .order('brand', { ascending: true })
      .order('category', { ascending: true })

  const { data, error } = await fetchAllInBatches(buildQuery)

  if (error) {
    return { brands: [], categories: [], error }
  }

  const rows = data ?? []
  return {
    brands: uniqueSorted(rows.map((row) => row.brand)),
    categories: uniqueSorted(rows.map((row) => row.category)),
    error: null,
  }
}

export async function fetchEquipmentIntelligencePage({
  page = 1,
  pageSize = EQUIPMENT_INTELLIGENCE_PAGE_SIZE,
  search = '',
  brand = '',
  category = '',
} = {}) {
  if (!isSupabaseConfigured || !supabase) {
    return { data: null, count: 0, error: notConfiguredError() }
  }

  const safePage = Math.max(1, Number(page) || 1)
  const safePageSize = Math.max(1, Math.min(SUPABASE_MAX_PAGE_SIZE, Number(pageSize) || EQUIPMENT_INTELLIGENCE_PAGE_SIZE))
  const from = (safePage - 1) * safePageSize
  const to = from + safePageSize - 1

  let query = supabase
    .from('equipment_intelligence')
    .select(EQUIPMENT_INTELLIGENCE_FIELDS, { count: 'exact' })
    .order('brand', { ascending: true })
    .order('model', { ascending: true })
    .range(from, to)

  if (brand?.trim()) {
    query = query.eq('brand', brand.trim())
  }

  if (category?.trim()) {
    query = query.eq('category', category.trim())
  }

  query = appendEquipmentSearchFilter(query, search)

  const { data, error, count } = await query

  if (error) {
    return { data: null, count: 0, error }
  }

  return {
    data: data ?? [],
    count: count ?? 0,
    page: safePage,
    pageSize: safePageSize,
    error: null,
  }
}

/** @deprecated Prefer fetchEquipmentIntelligencePage — unbounded selects are capped at 1000 rows. */
export async function searchEquipment(query = '') {
  const result = await fetchEquipmentIntelligencePage({
    page: 1,
    pageSize: SUPABASE_MAX_PAGE_SIZE,
    search: query,
  })

  if (result.error) {
    return { data: null, error: result.error }
  }

  return { data: result.data ?? [], error: null, count: result.count }
}

export async function updateEquipmentIntelligence(id, fields) {
  if (!id) {
    return { data: null, error: new Error('Record id is required.') }
  }

  if (!isSupabaseConfigured || !supabase) {
    return { data: null, error: notConfiguredError() }
  }

  const { data, error } = await supabase
    .from('equipment_intelligence')
    .update(fields)
    .eq('id', id)
    .select(EQUIPMENT_INTELLIGENCE_FIELDS)
    .maybeSingle()

  if (error) {
    return { data: null, error }
  }

  return { data, error: null }
}

export async function deleteEquipmentIntelligence(id) {
  if (!id) {
    return { success: false, error: new Error('Record id is required.') }
  }

  if (!isSupabaseConfigured || !supabase) {
    return { success: false, error: notConfiguredError() }
  }

  const { data, error } = await supabase.rpc('admin_delete_equipment_intelligence', {
    p_id: id,
  })

  if (error) {
    return { success: false, error }
  }

  return { success: Boolean(data), error: null }
}

export async function deleteEquipmentIntelligenceRecords(ids = []) {
  const uniqueIds = [...new Set((ids ?? []).filter(Boolean))]
  if (uniqueIds.length === 0) {
    return { deletedCount: 0, error: new Error('No records selected.') }
  }

  const results = await Promise.all(uniqueIds.map((id) => deleteEquipmentIntelligence(id)))
  const error = results.find((result) => result.error)?.error ?? null
  const deletedCount = results.filter((result) => result.success).length

  return { deletedCount, error }
}

export async function deleteAllEquipmentIntelligence() {
  if (!isSupabaseConfigured || !supabase) {
    return { deletedCount: 0, error: notConfiguredError() }
  }

  const { data, error } = await supabase.rpc('admin_delete_all_equipment_intelligence')

  if (error) {
    return { deletedCount: 0, error }
  }

  return { deletedCount: Number(data) || 0, error: null }
}

export const EQUIPMENT_INTELLIGENCE_CSV_COLUMNS = [
  'brand',
  'series',
  'model',
  'category',
  'equipment_type',
  'manufacture_year',
  'original_rrp',
  'estimated_trade_in_value',
  'market_observations',
  'confidence',
  'currency',
  'slug',
]

export const SAMPLE_EQUIPMENT_INTELLIGENCE_CSV = `brand,series,model,category,equipment_type,manufacture_year,original_rrp,estimated_trade_in_value,market_observations,confidence,currency,slug
Concept2,Indoor Rower,Model D,Rowing Machines,Rowers,2018,1200,650,1850;1950;2100,Medium,GBP,concept2-model-d
Life Fitness,95 Series,95Ti,Treadmills,Treadmill,2015,8500,2200,"[{""price"":2200,""source"":""Dealer"",""confidence"":85}]",High,GBP,life-fitness-95ti`

/** Guidance shown in the import UI. manufacture_year is source metadata, not a verified baseline. */
export const EQUIPMENT_INTELLIGENCE_CSV_YEAR_GUIDANCE = [
  'manufacture_year = year associated with the source record or observed generation (not automatically used as the product baseline).',
  'Verified first-release years live on equipment_intelligence as baseline_manufacture_year / manufacture_start_year (set via research workflows, not this CSV).',
  'Automatic product promotion leaves baseline_manufacture_year blank unless a verified first-release field is already present on the source row.',
  'Do not overload manufacture_year with earliest-release or pricing-year semantics.',
].join(' ')

const CSV_HEADER_ALIASES = {
  brand: 'brand',
  series: 'series',
  model: 'model',
  category: 'category',
  equipment_type: 'equipment_type',
  equipmenttype: 'equipment_type',
  type: 'equipment_type',
  manufacture_year: 'manufacture_year',
  manufactureyear: 'manufacture_year',
  year: 'manufacture_year',
  original_rrp: 'original_rrp',
  originalrrp: 'original_rrp',
  rrp: 'original_rrp',
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

function createEmptyCsvRow() {
  return Object.fromEntries(EQUIPMENT_INTELLIGENCE_CSV_COLUMNS.map((key) => [key, '']))
}

function parseOptionalNumber(value) {
  const raw = blankToNull(value)
  if (raw == null) return { value: null, error: null }

  const cleaned = String(raw).replace(/[£$,\s]/g, '')
  const number = Number(cleaned)
  if (!Number.isFinite(number)) {
    return { value: null, error: 'must be a number' }
  }
  return { value: number, error: null }
}

function parseOptionalInteger(value) {
  const parsed = parseOptionalNumber(value)
  if (parsed.error) return parsed
  if (parsed.value == null) return { value: null, error: null }
  if (!Number.isInteger(parsed.value)) {
    return { value: null, error: 'must be an integer' }
  }
  return parsed
}

function parseMarketObservationsField(value, currency = 'GBP') {
  const raw = blankToNull(value)
  if (raw == null) {
    return { value: null, update: false, error: null }
  }

  if (raw.startsWith('[')) {
    try {
      const parsed = JSON.parse(raw)
      if (!Array.isArray(parsed)) {
        return { value: null, update: false, error: 'must be a JSON array' }
      }
      return { value: parsed, update: true, error: null }
    } catch {
      return { value: null, update: false, error: 'must be valid JSON array' }
    }
  }

  if (raw.includes(';')) {
    const prices = raw
      .split(';')
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => Number(String(part).replace(/[£$,\s]/g, '')))
      .filter((price) => Number.isFinite(price) && price > 0)

    if (prices.length === 0) {
      return { value: null, update: false, error: 'semicolon list must include at least one price' }
    }

    return {
      value: prices.map((price) => ({
        price,
        currency,
        source: 'import',
        confidence: 70,
      })),
      update: true,
      error: null,
    }
  }

  try {
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) {
      return { value: parsed, update: true, error: null }
    }
  } catch {
    // fall through
  }

  const singlePrice = Number(String(raw).replace(/[£$,\s]/g, ''))
  if (Number.isFinite(singlePrice) && singlePrice > 0) {
    return {
      value: [{ price: singlePrice, currency, source: 'import', confidence: 70 }],
      update: true,
      error: null,
    }
  }

  return { value: null, update: false, error: 'must be blank, JSON array, or semicolon-separated prices' }
}

export function parseEquipmentIntelligenceCsv(csvText) {
  const lines = String(csvText ?? '')
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line) => line.trim() !== '')

  if (lines.length === 0) {
    return { rows: [], error: 'CSV is empty.' }
  }

  const headerCells = parseCsvLine(lines[0]).map((cell) => normalizeCsvHeader(cell))
  const mappedHeaders = headerCells.map((header) => CSV_HEADER_ALIASES[header] ?? header)

  const requiredHeaders = ['brand', 'model', 'slug']
  const missingRequired = requiredHeaders.filter((header) => !mappedHeaders.includes(header))
  if (missingRequired.length > 0) {
    return {
      rows: [],
      error: `CSV must include columns: ${missingRequired.join(', ')}`,
    }
  }

  const rows = lines.slice(1).map((line, index) => {
    const cells = parseCsvLine(line)
    const row = createEmptyCsvRow()

    mappedHeaders.forEach((key, cellIndex) => {
      if (!EQUIPMENT_INTELLIGENCE_CSV_COLUMNS.includes(key)) return
      row[key] = cells[cellIndex] ?? ''
    })

    return {
      ...row,
      _sourceLine: index + 2,
    }
  })

  return { rows, error: null }
}

export function validateEquipmentIntelligenceRow(row, rowNumber) {
  const errors = []

  const brand = blankToNull(row?.brand)
  const model = blankToNull(row?.model)
  const slug = blankToNull(row?.slug)

  if (!brand) errors.push('brand is required')
  if (!model) errors.push('model is required')
  if (!slug) errors.push('slug is required')

  const manufactureYear = parseOptionalInteger(row?.manufacture_year)
  if (manufactureYear.error) errors.push(`manufacture_year ${manufactureYear.error}`)

  const originalRrp = parseOptionalNumber(row?.original_rrp)
  if (originalRrp.error) errors.push(`original_rrp ${originalRrp.error}`)

  const tradeIn = parseOptionalNumber(row?.estimated_trade_in_value)
  if (tradeIn.error) errors.push(`estimated_trade_in_value ${tradeIn.error}`)

  const currency = blankToNull(row?.currency) || 'GBP'
  const confidence = blankToNull(row?.confidence) || 'Low'
  const observations = parseMarketObservationsField(row?.market_observations, currency)
  if (observations.error) errors.push(`market_observations ${observations.error}`)

  const normalised = {
    brand,
    series: blankToNull(row?.series),
    model,
    category: blankToNull(row?.category),
    equipment_type: blankToNull(row?.equipment_type),
    manufacture_year: manufactureYear.value,
    original_rrp: originalRrp.value,
    estimated_trade_in_value: tradeIn.value,
    confidence,
    currency,
    slug,
    market_observations: observations.value,
    update_market_observations: observations.update,
  }

  return {
    rowNumber,
    valid: errors.length === 0,
    errors,
    input: row,
    normalised,
    observationCount: observations.update && Array.isArray(observations.value)
      ? observations.value.length
      : 0,
  }
}

function isCsvRowEffectivelyEmpty(row) {
  return EQUIPMENT_INTELLIGENCE_CSV_COLUMNS.every((key) => blankToNull(row?.[key]) == null)
}

export function validateEquipmentIntelligenceRows(rows) {
  const results = (rows ?? [])
    .map((row, index) => ({ row, index }))
    .filter(({ row }) => !isCsvRowEffectivelyEmpty(row))
    .map(({ row, index }) =>
      validateEquipmentIntelligenceRow(row, row._sourceLine ?? index + 1),
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

export async function fetchMarketSyncStats() {
  if (!isSupabaseConfigured || !supabase) {
    return {
      stats: null,
      filterOptions: null,
      error: notConfiguredError(),
    }
  }

  const buildQuery = () =>
    supabase
      .from('equipment_intelligence')
      .select(MARKET_SYNC_STATS_FIELDS, { count: 'exact' })
      .order('brand', { ascending: true })
      .order('model', { ascending: true })

  const { data, error } = await fetchAllInBatches(buildQuery)

  if (error) {
    return { stats: null, filterOptions: null, error }
  }

  const rows = data ?? []
  const thirtyDaysAgo = getThirtyDaysAgo()

  let withObservations = 0
  let neverSynced = 0
  let syncedLast30Days = 0

  for (const row of rows) {
    if (hasMarketObservations(row)) withObservations += 1
    if (isNeverSynced(row)) neverSynced += 1
    if (isSyncedInLast30Days(row, thirtyDaysAgo)) syncedLast30Days += 1
  }

  const statusesFromData = rows.map((row) => row.market_sync_status)
  const marketSyncStatuses = uniqueSorted([
    ...MARKET_SYNC_STATUS_OPTIONS,
    ...statusesFromData,
  ])

  return {
    stats: {
      total: rows.length,
      withObservations,
      missingObservations: rows.length - withObservations,
      neverSynced,
      syncedLast30Days,
    },
    filterOptions: {
      brands: uniqueSorted(rows.map((row) => row.brand)),
      categories: uniqueSorted(rows.map((row) => row.category)),
      equipmentTypes: uniqueSorted(rows.map((row) => row.equipment_type)),
      marketSyncStatuses,
    },
    error: null,
  }
}

export async function fetchMarketSyncRows(filters = {}) {
  if (!isSupabaseConfigured || !supabase) {
    return { data: null, error: notConfiguredError() }
  }

  const brand = filters.brand?.trim()
  const category = filters.category?.trim()
  const equipmentType = filters.equipment_type?.trim()
  const marketSyncStatus = filters.market_sync_status?.trim()

  const buildQuery = () => {
    let query = supabase
      .from('equipment_intelligence')
      .select(MARKET_SYNC_ROW_FIELDS, { count: 'exact' })
      .order('brand', { ascending: true })
      .order('model', { ascending: true })

    if (brand) query = query.eq('brand', brand)
    if (category) query = query.eq('category', category)
    if (equipmentType) query = query.eq('equipment_type', equipmentType)
    if (marketSyncStatus) query = query.eq('market_sync_status', marketSyncStatus)

    return query
  }

  const { data, count, error } = await fetchAllInBatches(buildQuery)

  if (error) {
    return { data: null, totalCount: 0, error }
  }

  let rows = data ?? []

  if (filters.onlyMissingObservations) {
    rows = rows.filter((row) => !hasMarketObservations(row))
  }

  return { data: rows, totalCount: count ?? rows.length, error: null }
}

export async function importEquipmentIntelligenceRows(validatedRows) {
  if (!isSupabaseConfigured || !supabase) {
    return {
      insertedCount: 0,
      updatedCount: 0,
      error: notConfiguredError(),
    }
  }

  const payload = (validatedRows ?? [])
    .filter((row) => row.valid)
    .map((row) => ({
      brand: row.normalised.brand,
      series: row.normalised.series,
      model: row.normalised.model,
      category: row.normalised.category,
      equipment_type: row.normalised.equipment_type,
      manufacture_year: row.normalised.manufacture_year,
      original_rrp: row.normalised.original_rrp,
      estimated_trade_in_value: row.normalised.estimated_trade_in_value,
      confidence: row.normalised.confidence,
      currency: row.normalised.currency,
      slug: row.normalised.slug,
      market_observations: row.normalised.market_observations,
      update_market_observations: row.normalised.update_market_observations,
    }))

  if (payload.length === 0) {
    return {
      insertedCount: 0,
      updatedCount: 0,
      error: new Error('No valid rows to import.'),
    }
  }

  const { data, error } = await supabase.rpc('admin_upsert_equipment_intelligence', {
    p_rows: payload,
  })

  if (error) {
    return { insertedCount: 0, updatedCount: 0, error }
  }

  return {
    insertedCount: Number(data?.inserted) || 0,
    updatedCount: Number(data?.updated) || 0,
    error: null,
  }
}
