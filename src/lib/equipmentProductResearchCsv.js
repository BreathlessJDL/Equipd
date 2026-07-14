/**
 * Round-trip research CSV export/import for Intelligence Products.
 * Export: current values + empty researched_* columns.
 * Import: match by product_id (verify key); blank researched_* = no change.
 */

export const RESEARCH_CLEAR_TOKEN = '__CLEAR__'

export const RESEARCH_EXPORT_SCOPE = Object.freeze({
  ALL_MATCHING: 'all_matching',
  SELECTED: 'selected',
  CURRENT_PAGE: 'current_page',
})

export const RESEARCH_MISSING_FIELD = Object.freeze({
  PRODUCT_FAMILY: 'product_family',
  MODEL: 'model',
  CATEGORY: 'category',
  EQUIPMENT_TYPE: 'equipment_type',
  BASELINE_MANUFACTURE_YEAR: 'baseline_manufacture_year',
  PRODUCTION_START_YEAR: 'production_start_year',
  PRODUCTION_END_YEAR: 'production_end_year',
  ORIGINAL_BASE_PRICE: 'original_base_price',
  CURRENCY: 'currency',
  APPROVED_IMAGE: 'approved_image',
  APPROVED_CONTENT: 'approved_content',
  SOURCE_ROWS: 'source_rows',
  IDENTITY_REVIEW: 'identity_review',
})

export const RESEARCH_PRIORITY = Object.freeze({
  HIGH: 'High',
  MEDIUM: 'Medium',
  LOW: 'Low',
})

/** Ordered CSV headers for export. */
export const RESEARCH_CSV_HEADERS = Object.freeze([
  'product_id',
  'canonical_product_key',
  'current_canonical_product_name',
  'brand',
  'product_family',
  'model',
  'category',
  'equipment_type',
  'baseline_manufacture_year',
  'production_start_year',
  'production_end_year',
  'original_base_price',
  'currency',
  'status',
  'price_confidence',
  'completion_status',
  'review_notes',
  'has_approved_image',
  'has_draft_content',
  'has_approved_content',
  'source_row_count',
  'missing_fields',
  'research_priority',
  'research_reason',
  'researched_product_family',
  'researched_model',
  'researched_category',
  'researched_equipment_type',
  'researched_baseline_manufacture_year',
  'researched_production_start_year',
  'researched_production_end_year',
  'researched_original_base_price',
  'researched_currency',
  'researched_price_confidence',
  'price_source_url',
  'year_source_url',
  'secondary_source_url',
  'research_notes',
  'recommended_action',
  'researched_image_source_url',
  'image_research_notes',
  'market_observations',
  'historical_price_notes',
  'generation_notes',
])

export const RESEARCH_IMPORT_MAX_ROWS = 5000
export const RESEARCH_EXPORT_MAX_ROWS = 10000

const CURRENT_YEAR = new Date().getUTCFullYear()
const MIN_YEAR = 1970
const MAX_YEAR = CURRENT_YEAR + 1
const MAX_PRICE = 500_000
const MAX_TEXT = 4000

const CONFIDENCE_LABEL_TO_NUMBER = Object.freeze({
  high: 90,
  medium: 70,
  low: 40,
})

const CONFIDENCE_NUMBER_TO_LABEL = (value) => {
  const n = Number(value)
  if (!Number.isFinite(n)) return ''
  if (n >= 85) return 'High'
  if (n >= 55) return 'Medium'
  if (n > 0) return 'Low'
  return ''
}

function normalizeWhitespace(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim()
}

function hasPositivePrice(product) {
  return Number(product?.original_base_price) > 0
}

function hasValidBaselineYear(product) {
  const year = Number(product?.baseline_manufacture_year)
  return Number.isInteger(year) && year >= MIN_YEAR && year <= MAX_YEAR
}

function hasApprovedImage(product) {
  const status = String(product?.image_status ?? '').toLowerCase()
  return status === 'approved' && Boolean(product?.image_url || product?.image_storage_path)
}

function contentStatus(product) {
  return String(
    product?.content_generation_status
    ?? product?.content?.generation_status
    ?? '',
  ).toLowerCase()
}

export function deriveResearchMissingFields(product) {
  const missing = []
  if (!normalizeWhitespace(product?.product_family)) missing.push(RESEARCH_MISSING_FIELD.PRODUCT_FAMILY)
  if (!normalizeWhitespace(product?.model)) missing.push(RESEARCH_MISSING_FIELD.MODEL)
  if (!normalizeWhitespace(product?.equipment_type)) missing.push(RESEARCH_MISSING_FIELD.EQUIPMENT_TYPE)
  if (!hasValidBaselineYear(product)) missing.push(RESEARCH_MISSING_FIELD.BASELINE_MANUFACTURE_YEAR)
  if (!Number.isInteger(Number(product?.production_start_year))) {
    missing.push(RESEARCH_MISSING_FIELD.PRODUCTION_START_YEAR)
  }
  if (!hasPositivePrice(product)) missing.push(RESEARCH_MISSING_FIELD.ORIGINAL_BASE_PRICE)
  if (hasPositivePrice(product) && !normalizeWhitespace(product?.original_base_price_currency || product?.currency)) {
    missing.push(RESEARCH_MISSING_FIELD.CURRENCY)
  }
  if (!hasApprovedImage(product)) missing.push(RESEARCH_MISSING_FIELD.APPROVED_IMAGE)
  if (contentStatus(product) !== 'approved') missing.push(RESEARCH_MISSING_FIELD.APPROVED_CONTENT)
  const sourceCount = Number(product?.source_row_count ?? product?.source_intelligence_row_ids?.length ?? 0)
  if (!(sourceCount > 0)) missing.push(RESEARCH_MISSING_FIELD.SOURCE_ROWS)
  const status = String(product?.status ?? '').toLowerCase()
  const notes = String(product?.review_notes ?? '')
  if (
    status === 'needs_review'
    || /identity|ambiguous|research required|needs research/i.test(notes)
  ) {
    missing.push(RESEARCH_MISSING_FIELD.IDENTITY_REVIEW)
  }
  return missing
}

export function deriveResearchPriority(product, missingFields = deriveResearchMissingFields(product)) {
  const set = new Set(missingFields)
  const status = String(product?.status ?? '').toLowerCase()
  const reasons = []

  if (set.has(RESEARCH_MISSING_FIELD.IDENTITY_REVIEW) || status === 'needs_review') {
    reasons.push('identity or needs_review')
  }
  if (set.has(RESEARCH_MISSING_FIELD.ORIGINAL_BASE_PRICE)) reasons.push('missing price')
  if (set.has(RESEARCH_MISSING_FIELD.BASELINE_MANUFACTURE_YEAR)) reasons.push('missing baseline year')
  if (set.has(RESEARCH_MISSING_FIELD.EQUIPMENT_TYPE)) reasons.push('missing equipment type')
  if (
    status === 'approved'
    && (set.has(RESEARCH_MISSING_FIELD.ORIGINAL_BASE_PRICE)
      || set.has(RESEARCH_MISSING_FIELD.BASELINE_MANUFACTURE_YEAR))
  ) {
    reasons.push('approved product missing critical valuation data')
  }

  if (reasons.length) {
    return {
      priority: RESEARCH_PRIORITY.HIGH,
      reason: reasons.join('; '),
    }
  }

  if (
    set.has(RESEARCH_MISSING_FIELD.PRODUCTION_START_YEAR)
    || set.has(RESEARCH_MISSING_FIELD.PRODUCT_FAMILY)
    || set.has(RESEARCH_MISSING_FIELD.MODEL)
    || set.has(RESEARCH_MISSING_FIELD.APPROVED_CONTENT)
    || (Number(product?.original_price_confidence) > 0 && Number(product.original_price_confidence) < 55)
  ) {
    return {
      priority: RESEARCH_PRIORITY.MEDIUM,
      reason: 'incomplete family/model/year detail or content',
    }
  }

  if (set.has(RESEARCH_MISSING_FIELD.APPROVED_IMAGE) || set.size > 0) {
    return {
      priority: RESEARCH_PRIORITY.LOW,
      reason: 'image or non-critical metadata gaps',
    }
  }

  return {
    priority: RESEARCH_PRIORITY.LOW,
    reason: 'filtered inclusion',
  }
}

export function isResearchExportEligible(product) {
  const missing = deriveResearchMissingFields(product)
  if (missing.length > 0) return true
  const completion = String(product?.completion_status ?? '').toLowerCase()
  if (completion && completion !== 'complete') return true
  return String(product?.status ?? '').toLowerCase() === 'needs_review'
}

/**
 * Escape a CSV cell. Formula injection: prefix apostrophe for free-text that
 * starts with = @ or with +-/ when not a plain number (Bike+ is fine — starts with B).
 */
export function sanitizeCsvCell(value, { numeric = false } = {}) {
  if (value == null) return ''
  let text = String(value)
  if (numeric) {
    text = text.trim()
  } else {
    const trimmedStart = text.replace(/^\s+/, '')
    const first = trimmedStart[0]
    if (first === '=' || first === '@') {
      text = `'${text}`
    } else if ((first === '+' || first === '-') && !/^[+-]?\d+(\.\d+)?$/.test(trimmedStart.trim())) {
      text = `'${text}`
    }
  }
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`
  }
  return text
}

export function buildResearchCsvFilename({
  scope = RESEARCH_EXPORT_SCOPE.ALL_MATCHING,
  brand = '',
  date = new Date(),
} = {}) {
  const ymd = date.toISOString().slice(0, 10)
  if (scope === RESEARCH_EXPORT_SCOPE.SELECTED) {
    return `equipd-product-research-selected-${ymd}.csv`
  }
  const brandSlug = normalizeWhitespace(brand)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  if (brandSlug && scope === RESEARCH_EXPORT_SCOPE.ALL_MATCHING) {
    return `equipd-product-research-${brandSlug}-${ymd}.csv`
  }
  return `equipd-product-research-export-${ymd}.csv`
}

export function mapProductToResearchExportRow(product) {
  const missing = deriveResearchMissingFields(product)
  const { priority, reason } = deriveResearchPriority(product, missing)
  const content = contentStatus(product)

  return {
    product_id: product.id,
    canonical_product_key: product.canonical_product_key ?? '',
    current_canonical_product_name: product.canonical_product_name ?? '',
    brand: product.brand ?? '',
    product_family: product.product_family ?? '',
    model: product.model ?? '',
    category: '',
    equipment_type: product.equipment_type ?? '',
    baseline_manufacture_year: product.baseline_manufacture_year ?? '',
    production_start_year: product.production_start_year ?? '',
    production_end_year: product.production_end_year ?? '',
    original_base_price: product.original_base_price ?? '',
    currency: product.original_base_price_currency ?? '',
    status: product.status ?? '',
    price_confidence: CONFIDENCE_NUMBER_TO_LABEL(product.original_price_confidence),
    completion_status: product.completion_status ?? '',
    review_notes: product.review_notes ?? '',
    has_approved_image: hasApprovedImage(product) ? 'yes' : 'no',
    has_draft_content: content === 'draft' ? 'yes' : 'no',
    has_approved_content: content === 'approved' ? 'yes' : 'no',
    source_row_count: Number(product.source_row_count ?? product.source_intelligence_row_ids?.length ?? 0),
    missing_fields: missing.join('|'),
    research_priority: priority,
    research_reason: reason,
    researched_product_family: '',
    researched_model: '',
    researched_category: '',
    researched_equipment_type: '',
    researched_baseline_manufacture_year: '',
    researched_production_start_year: '',
    researched_production_end_year: '',
    researched_original_base_price: '',
    researched_currency: '',
    researched_price_confidence: '',
    price_source_url: '',
    year_source_url: '',
    secondary_source_url: '',
    research_notes: '',
    recommended_action: '',
    researched_image_source_url: '',
    image_research_notes: '',
    market_observations: '',
    historical_price_notes: '',
    generation_notes: '',
  }
}

export function buildResearchCsvContent(products = []) {
  const rows = products.map(mapProductToResearchExportRow)
  const lines = [
    RESEARCH_CSV_HEADERS.join(','),
    ...rows.map((row) => RESEARCH_CSV_HEADERS.map((header) => {
      const numeric = [
        'baseline_manufacture_year',
        'production_start_year',
        'production_end_year',
        'original_base_price',
        'source_row_count',
      ].includes(header)
      return sanitizeCsvCell(row[header], { numeric })
    }).join(',')),
  ]
  // UTF-8 BOM for Excel
  return `\uFEFF${lines.join('\r\n')}\r\n`
}

export function summarizeResearchExport(products = []) {
  const brands = new Set()
  const statusCounts = {}
  let missingPrices = 0
  let missingBaselines = 0
  let identityReview = 0
  let missingImages = 0
  let missingContent = 0

  for (const product of products) {
    if (product.brand) brands.add(product.brand)
    const status = product.status || 'unknown'
    statusCounts[status] = (statusCounts[status] || 0) + 1
    const missing = deriveResearchMissingFields(product)
    if (missing.includes(RESEARCH_MISSING_FIELD.ORIGINAL_BASE_PRICE)) missingPrices += 1
    if (missing.includes(RESEARCH_MISSING_FIELD.BASELINE_MANUFACTURE_YEAR)) missingBaselines += 1
    if (missing.includes(RESEARCH_MISSING_FIELD.IDENTITY_REVIEW)) identityReview += 1
    if (missing.includes(RESEARCH_MISSING_FIELD.APPROVED_IMAGE)) missingImages += 1
    if (missing.includes(RESEARCH_MISSING_FIELD.APPROVED_CONTENT)) missingContent += 1
  }

  return {
    total: products.length,
    brands: [...brands].sort(),
    statusCounts,
    missingPrices,
    missingBaselines,
    identityReview,
    missingImages,
    missingContent,
  }
}

export function downloadResearchCsv(content, filename) {
  if (typeof document === 'undefined') return
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

function parseCsvLine(line) {
  const cells = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i]
    if (inQuotes) {
      if (char === '"') {
        if (line[i + 1] === '"') {
          current += '"'
          i += 1
        } else {
          inQuotes = false
        }
      } else {
        current += char
      }
    } else if (char === '"') {
      inQuotes = true
    } else if (char === ',') {
      cells.push(current)
      current = ''
    } else {
      current += char
    }
  }
  cells.push(current)
  return cells
}

export function parseResearchCsv(text) {
  const raw = String(text ?? '').replace(/^\uFEFF/, '')
  const lines = raw.split(/\r?\n/).filter((line) => line.length > 0)
  if (!lines.length) return { headers: [], rows: [], error: new Error('CSV is empty.') }

  const headers = parseCsvLine(lines[0]).map((header) => header.trim())
  const rows = []
  for (let i = 1; i < lines.length; i += 1) {
    const cells = parseCsvLine(lines[i])
    const row = { __line: i + 1 }
    headers.forEach((header, index) => {
      row[header] = cells[index] ?? ''
    })
    rows.push(row)
  }
  return { headers, rows, error: null }
}

function stripFormulaEscape(value) {
  const text = String(value ?? '')
  if (text.startsWith("'") && /^'[=+\-@]/.test(text)) return text.slice(1)
  return text
}

function parseResearchedCell(raw) {
  const text = stripFormulaEscape(raw)
  if (text == null) return { kind: 'blank' }
  const trimmed = String(text).trim()
  if (!trimmed) return { kind: 'blank' }
  if (trimmed === RESEARCH_CLEAR_TOKEN) return { kind: 'clear' }
  return { kind: 'value', value: trimmed }
}

function parseYearValue(raw, fieldLabel) {
  const cell = parseResearchedCell(raw)
  if (cell.kind === 'blank') return { kind: 'blank' }
  if (cell.kind === 'clear') return { kind: 'clear' }
  const year = Number(cell.value)
  if (!Number.isInteger(year) || year < MIN_YEAR || year > MAX_YEAR) {
    return { kind: 'error', error: `${fieldLabel} must be an integer between ${MIN_YEAR} and ${MAX_YEAR}` }
  }
  return { kind: 'value', value: year }
}

function parsePriceValue(raw) {
  const cell = parseResearchedCell(raw)
  if (cell.kind === 'blank') return { kind: 'blank' }
  if (cell.kind === 'clear') return { kind: 'clear' }
  const cleaned = cell.value.replace(/£/g, '').replace(/,/g, '')
  const price = Number(cleaned)
  if (!Number.isFinite(price) || price <= 0 || price > MAX_PRICE) {
    return { kind: 'error', error: `price must be greater than 0 and at most ${MAX_PRICE}` }
  }
  return { kind: 'value', value: price }
}

function parseConfidenceValue(raw) {
  const cell = parseResearchedCell(raw)
  if (cell.kind === 'blank') return { kind: 'blank' }
  if (cell.kind === 'clear') return { kind: 'clear' }
  const key = cell.value.toLowerCase()
  if (CONFIDENCE_LABEL_TO_NUMBER[key] != null) {
    return { kind: 'value', value: CONFIDENCE_LABEL_TO_NUMBER[key], label: cell.value }
  }
  const asNumber = Number(cell.value)
  if (Number.isInteger(asNumber) && asNumber >= 0 && asNumber <= 100) {
    return { kind: 'value', value: asNumber, label: CONFIDENCE_NUMBER_TO_LABEL(asNumber) || String(asNumber) }
  }
  return { kind: 'error', error: 'price confidence must be Low, Medium, High, or 0-100' }
}

function parseUrlValue(raw, fieldLabel) {
  const cell = parseResearchedCell(raw)
  if (cell.kind === 'blank') return { kind: 'blank' }
  if (cell.kind === 'clear') return { kind: 'clear' }
  try {
    const url = new URL(cell.value)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return { kind: 'error', error: `${fieldLabel} must be http or https` }
    }
    return { kind: 'value', value: url.toString() }
  } catch {
    return { kind: 'error', error: `${fieldLabel} is not a valid URL` }
  }
}

function parseTextValue(raw, fieldLabel) {
  const cell = parseResearchedCell(raw)
  if (cell.kind === 'blank') return { kind: 'blank' }
  if (cell.kind === 'clear') return { kind: 'clear' }
  if (cell.value.length > MAX_TEXT) {
    return { kind: 'error', error: `${fieldLabel} exceeds ${MAX_TEXT} characters` }
  }
  return { kind: 'value', value: cell.value }
}

const UPDATABLE_FIELDS = [
  {
    researched: 'researched_product_family',
    productField: 'product_family',
    label: 'product_family',
    parse: (raw) => parseTextValue(raw, 'product_family'),
  },
  {
    researched: 'researched_model',
    productField: 'model',
    label: 'model',
    parse: (raw) => parseTextValue(raw, 'model'),
  },
  {
    researched: 'researched_equipment_type',
    productField: 'equipment_type',
    label: 'equipment_type',
    parse: (raw) => parseTextValue(raw, 'equipment_type'),
  },
  {
    researched: 'researched_baseline_manufacture_year',
    productField: 'baseline_manufacture_year',
    label: 'baseline_manufacture_year',
    parse: (raw) => parseYearValue(raw, 'baseline_manufacture_year'),
  },
  {
    researched: 'researched_production_start_year',
    productField: 'production_start_year',
    label: 'production_start_year',
    parse: (raw) => parseYearValue(raw, 'production_start_year'),
  },
  {
    researched: 'researched_production_end_year',
    productField: 'production_end_year',
    label: 'production_end_year',
    parse: (raw) => parseYearValue(raw, 'production_end_year'),
  },
  {
    researched: 'researched_original_base_price',
    productField: 'original_base_price',
    label: 'original_base_price',
    parse: parsePriceValue,
  },
  {
    researched: 'researched_currency',
    productField: 'original_base_price_currency',
    label: 'currency',
    parse: (raw) => {
      const cell = parseResearchedCell(raw)
      if (cell.kind === 'blank') return { kind: 'blank' }
      if (cell.kind === 'clear') return { kind: 'clear' }
      const currency = cell.value.toUpperCase()
      if (!/^[A-Z]{3}$/.test(currency)) {
        return { kind: 'error', error: 'currency must be a 3-letter ISO code such as GBP' }
      }
      return { kind: 'value', value: currency }
    },
  },
  {
    researched: 'researched_price_confidence',
    productField: 'original_price_confidence',
    label: 'price_confidence',
    parse: parseConfidenceValue,
  },
]

/**
 * Build an import plan for researched updates.
 * @param {object[]} csvRows
 * @param {Map<string, object>} productsById
 */
export function buildResearchImportPlan(csvRows = [], productsById = new Map()) {
  const plans = []
  const errors = []
  const seenIds = new Set()

  if (csvRows.length > RESEARCH_IMPORT_MAX_ROWS) {
    return {
      plans: [],
      errors: [{
        line: 0,
        product_id: null,
        message: `CSV exceeds maximum of ${RESEARCH_IMPORT_MAX_ROWS} rows`,
      }],
      summary: emptyImportSummary(),
    }
  }

  for (const row of csvRows) {
    const line = row.__line || 0
    const productId = normalizeWhitespace(row.product_id)
    const key = normalizeWhitespace(row.canonical_product_key)
    const brand = normalizeWhitespace(row.brand)

    if (!productId) {
      errors.push({ line, product_id: null, message: 'product_id is required', rawRow: row })
      continue
    }
    if (seenIds.has(productId)) {
      errors.push({
        line,
        product_id: productId,
        message: 'duplicate product_id in CSV',
        rawRow: row,
      })
      continue
    }
    seenIds.add(productId)

    const product = productsById.get(productId) || productsById.get(String(productId))
    if (!product) {
      errors.push({ line, product_id: productId, message: 'product not found', rawRow: row })
      continue
    }
    if (key && product.canonical_product_key !== key) {
      errors.push({
        line,
        product_id: productId,
        message: `ID/key mismatch: CSV key "${key}" vs stored "${product.canonical_product_key}"`,
        rawRow: row,
      })
      continue
    }
    if (brand && normalizeWhitespace(product.brand).toLowerCase() !== brand.toLowerCase()) {
      errors.push({
        line,
        product_id: productId,
        message: `brand mismatch: CSV "${brand}" vs stored "${product.brand}"`,
        rawRow: row,
      })
      continue
    }

    const categoryCell = parseResearchedCell(row.researched_category)
    const fieldChanges = []
    const rowErrors = []

    if (categoryCell.kind === 'value' || categoryCell.kind === 'clear') {
      rowErrors.push({
        line,
        product_id: productId,
        message: 'researched_category is not stored on equipment_products; use researched_equipment_type',
        rawRow: row,
      })
    }

    for (const field of UPDATABLE_FIELDS) {
      const parsed = field.parse(row[field.researched])
      if (parsed.kind === 'blank') continue
      if (parsed.kind === 'error') {
        rowErrors.push({ line, product_id: productId, message: parsed.error, rawRow: row })
        continue
      }
      const current = product[field.productField]
      if (parsed.kind === 'clear') {
        if (current == null || current === '') continue
        fieldChanges.push({
          field: field.label,
          productField: field.productField,
          current,
          next: null,
          action: 'clear',
        })
        continue
      }
      const same = String(current ?? '') === String(parsed.value ?? '')
      if (same) continue
      fieldChanges.push({
        field: field.label,
        productField: field.productField,
        current: current ?? null,
        next: parsed.value,
        action: 'update',
      })
    }

    // URL / notes (notes append; URLs map to existing columns)
    const priceUrl = parseUrlValue(row.price_source_url, 'price_source_url')
    if (priceUrl.kind === 'error') {
      rowErrors.push({ line, product_id: productId, message: priceUrl.error, rawRow: row })
    } else if (priceUrl.kind === 'value' && priceUrl.value !== (product.original_price_source_url ?? null)) {
      fieldChanges.push({
        field: 'original_price_source_url',
        productField: 'original_price_source_url',
        current: product.original_price_source_url ?? null,
        next: priceUrl.value,
        action: 'update',
      })
    }

    const yearUrl = parseUrlValue(row.year_source_url, 'year_source_url')
    if (yearUrl.kind === 'error') {
      rowErrors.push({ line, product_id: productId, message: yearUrl.error, rawRow: row })
    }

    const secondaryUrl = parseUrlValue(row.secondary_source_url, 'secondary_source_url')
    if (secondaryUrl.kind === 'error') {
      rowErrors.push({ line, product_id: productId, message: secondaryUrl.error, rawRow: row })
    }

    const researchNotes = parseTextValue(row.research_notes, 'research_notes')
    if (researchNotes.kind === 'error') {
      rowErrors.push({ line, product_id: productId, message: researchNotes.error, rawRow: row })
    }

    // Year order validation with proposed values
    const nextStart = fieldChanges.find((c) => c.productField === 'production_start_year')?.next
      ?? product.production_start_year
    const nextEnd = fieldChanges.find((c) => c.productField === 'production_end_year')?.next
      ?? product.production_end_year
    if (
      nextStart != null
      && nextEnd != null
      && Number.isFinite(Number(nextStart))
      && Number.isFinite(Number(nextEnd))
      && Number(nextEnd) < Number(nextStart)
    ) {
      rowErrors.push({
        line,
        product_id: productId,
        message: 'production_end_year cannot precede production_start_year',
        rawRow: row,
      })
    }

    const nextPrice = fieldChanges.find((c) => c.productField === 'original_base_price')?.next
    const nextCurrency = fieldChanges.find((c) => c.productField === 'original_base_price_currency')?.next
    if (nextPrice != null && !(nextCurrency || product.original_base_price_currency)) {
      rowErrors.push({
        line,
        product_id: productId,
        message: 'currency required when researched price is supplied',
        rawRow: row,
      })
    }

    if (rowErrors.length) {
      errors.push(...rowErrors)
      continue
    }

    const imageUrl = parseUrlValue(row.researched_image_source_url, 'researched_image_source_url')
    const imageNotes = parseTextValue(row.image_research_notes, 'image_research_notes')
    const warnings = []
    if (imageUrl.kind === 'value' || imageNotes.kind === 'value') {
      warnings.push('image research fields are ignored by this importer (separate image workflow)')
    }

    const criticalChangeOnApproved = String(product.status).toLowerCase() === 'approved'
      && fieldChanges.some((c) => [
        'original_base_price',
        'baseline_manufacture_year',
        'equipment_type',
      ].includes(c.productField))

    plans.push({
      line,
      product_id: productId,
      canonical_product_key: product.canonical_product_key,
      brand: product.brand,
      status: product.status,
      action: fieldChanges.length ? 'update' : 'unchanged',
      fieldChanges,
      warnings,
      criticalChangeOnApproved,
      researchNotes: researchNotes.kind === 'value' ? researchNotes.value : null,
      yearSourceUrl: yearUrl.kind === 'value' ? yearUrl.value : null,
      secondarySourceUrl: secondaryUrl.kind === 'value' ? secondaryUrl.value : null,
      rawRow: row,
    })
  }

  return {
    plans,
    errors,
    summary: summarizeImportPlans(plans, errors, csvRows.length),
  }
}

function emptyImportSummary() {
  return {
    rowsRead: 0,
    validUpdates: 0,
    unchanged: 0,
    warnings: 0,
    errors: 0,
    identityConflicts: 0,
    fieldChangeCount: 0,
  }
}

function summarizeImportPlans(plans, errors, rowsRead = 0) {
  const failedProductIds = new Set(
    errors.map((error) => error.product_id).filter(Boolean),
  )
  return {
    rowsRead,
    validUpdates: plans.filter((p) => p.action === 'update').length,
    unchanged: plans.filter((p) => p.action === 'unchanged').length,
    warnings: plans.reduce((sum, p) => sum + (p.warnings?.length || 0), 0),
    errors: errors.length,
    failedRows: failedProductIds.size + errors.filter((e) => !e.product_id).length,
    identityConflicts: errors.filter((e) => /ID\/key mismatch|brand mismatch/i.test(e.message)).length,
    fieldChangeCount: plans.reduce((sum, p) => sum + (p.fieldChanges?.length || 0), 0),
  }
}

export function buildResearchImportAuditNote({
  filename,
  fieldChanges = [],
  researchNotes = null,
  yearSourceUrl = null,
  secondarySourceUrl = null,
  batchId = null,
} = {}) {
  const stamp = new Date().toISOString().slice(0, 10)
  const parts = [
    `[research_import ${stamp}]`,
    batchId ? `batch=${batchId}` : null,
    filename ? `file=${filename}` : null,
    fieldChanges.map((c) => `${c.field}: ${formatAuditValue(c.current)} → ${formatAuditValue(c.next)}`).join('; '),
    researchNotes ? `notes=${researchNotes}` : null,
    yearSourceUrl ? `year_source=${yearSourceUrl}` : null,
    secondarySourceUrl ? `secondary_source=${secondarySourceUrl}` : null,
  ].filter(Boolean)
  return parts.join(' ')
}

function formatAuditValue(value) {
  if (value == null || value === '') return '∅'
  return String(value)
}

/**
 * Build RPC/direct update payload from a plan entry. Does not set status.
 */
export function buildResearchUpdatePayload(plan, existingProduct) {
  const patch = {}
  const clearFields = []

  for (const change of plan.fieldChanges || []) {
    if (change.action === 'clear') {
      clearFields.push(change.productField)
    } else {
      patch[change.productField] = change.next
    }
  }

  if (patch.original_base_price != null) {
    patch.original_price_source = 'manual_import'
  }
  if (patch.baseline_manufacture_year != null) {
    patch.baseline_source = 'manual_import'
  }

  const audit = buildResearchImportAuditNote({
    filename: plan.filename,
    fieldChanges: plan.fieldChanges,
    researchNotes: plan.researchNotes,
    yearSourceUrl: plan.yearSourceUrl,
    secondarySourceUrl: plan.secondarySourceUrl,
    batchId: plan.batchId,
  })

  const existingNotes = normalizeWhitespace(existingProduct?.review_notes)
  let reviewNotes = existingNotes
  if (audit) {
    reviewNotes = existingNotes ? `${existingNotes}\n${audit}` : audit
  }
  if (plan.criticalChangeOnApproved) {
    const flag = `[research_import attention] critical valuation fields updated while product remained approved`
    reviewNotes = reviewNotes ? `${reviewNotes}\n${flag}` : flag
  }

  return { patch, clearFields, reviewNotes }
}

export function buildResearchImportErrorCsv(errors = [], plans = []) {
  const headers = [
    'line',
    'product_id',
    'canonical_product_key',
    'brand',
    'error',
    'research_notes',
    'researched_product_family',
    'researched_model',
    'researched_equipment_type',
    'researched_baseline_manufacture_year',
    'researched_production_start_year',
    'researched_production_end_year',
    'researched_original_base_price',
    'researched_currency',
    'researched_price_confidence',
    'price_source_url',
    'year_source_url',
    'secondary_source_url',
  ]
  const lines = [headers.join(',')]
  for (const error of errors) {
    const plan = plans.find((p) => p.product_id === error.product_id)
    const raw = error.rawRow || plan?.rawRow || {}
    lines.push([
      error.line ?? '',
      error.product_id || raw.product_id || '',
      raw.canonical_product_key || '',
      raw.brand || '',
      error.message || error.error || '',
      raw.research_notes || '',
      raw.researched_product_family || '',
      raw.researched_model || '',
      raw.researched_equipment_type || '',
      raw.researched_baseline_manufacture_year || '',
      raw.researched_production_start_year || '',
      raw.researched_production_end_year || '',
      raw.researched_original_base_price || '',
      raw.researched_currency || '',
      raw.researched_price_confidence || '',
      raw.price_source_url || '',
      raw.year_source_url || '',
      raw.secondary_source_url || '',
    ].map((cell) => sanitizeCsvCell(cell)).join(','))
  }
  return `\uFEFF${lines.join('\r\n')}\r\n`
}

/** Describe active list filters for clipboard / UI. */
export function formatResearchFilterSummary({
  brand = '',
  status = '',
  completion = '',
  attention = '',
  equipmentType = '',
  search = '',
  scope = RESEARCH_EXPORT_SCOPE.ALL_MATCHING,
  totalMatching = null,
  selectedCount = null,
  pageCount = null,
} = {}) {
  const lines = [
    `Scope: ${scope}`,
    brand ? `Brand: ${brand}` : 'Brand: all',
    status ? `Status: ${status}` : 'Status: all',
    completion ? `Completion: ${completion}` : 'Completion: all',
    attention && attention !== 'all' ? `Attention: ${attention}` : 'Attention: all',
    equipmentType ? `Equipment type: ${equipmentType}` : 'Equipment type: all',
    search ? `Search: ${search}` : 'Search: (none)',
  ]
  if (totalMatching != null) lines.push(`Matching products: ${totalMatching}`)
  if (selectedCount != null) lines.push(`Selected: ${selectedCount}`)
  if (pageCount != null) lines.push(`Current page: ${pageCount}`)
  return lines.join('\n')
}
