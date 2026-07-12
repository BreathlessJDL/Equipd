import {
  BASELINE_MANUFACTURE_YEAR_SOURCE,
  buildBaselineManufactureYearPatch,
  isProvisionalBaselineSource,
} from './baselineManufactureYear.js'
import { CANONICAL_ORIGINAL_PRICE_SOURCE } from './equipmentCanonicalResearchApprove.js'
import {
  isResearchApprovedBaselineNote,
  isSeriesDefaultBaselineNote,
} from './lifeFitnessSeriesBaselines.js'

export const IMPORT_SOURCE = 'manual_import'

export const IMPORT_ACTION = {
  UPDATE: 'UPDATE',
  SKIP: 'SKIP',
  CONFLICT: 'CONFLICT',
  NO_MATCH: 'NO_MATCH',
}

const PROTECTED_SOURCES = new Set([
  'manual',
  'manual_import',
  'admin',
  'admin_verified',
  'product_research_verified',
  CANONICAL_ORIGINAL_PRICE_SOURCE.AI_RESEARCH_APPROVED,
])

const OVERWRITABLE_SOURCES = new Set([
  '',
  'empty',
  'series_default',
  BASELINE_MANUFACTURE_YEAR_SOURCE.LIFE_FITNESS_SERIES_DEFAULT,
])

const HEADER_ALIASES = {
  canonical_product_key: [
    'canonical_product_key',
    'canonicalproductkey',
    'canonical product key',
  ],
  canonical_product_name: [
    'canonical_product_name',
    'canonicalproductname',
    'canonical product',
  ],
  brand: ['brand'],
  original_base_price: [
    'original_base_price',
    'baseprice',
    'base price',
    'rrp',
  ],
  original_base_price_currency: [
    'original_base_price_currency',
    'basepricecurrency',
    'currency',
  ],
  baseline_manufacture_year: [
    'baseline_manufacture_year',
    'baselineyear',
    'baseline year',
  ],
  production_start_year: [
    'production_start_year',
    'productionstartyear',
    'production start',
  ],
  production_end_year: [
    'production_end_year',
    'productionendyear',
    'production end',
  ],
  original_price_confidence: [
    'original_price_confidence',
    'priceconfidence',
    'price confidence',
  ],
  lifecycle_confidence: [
    'lifecycle_confidence',
    'lifecycleconfidence',
    'lifecycle confidence',
  ],
  review_notes: [
    'review_notes',
    'reviewnotes',
    'review notes',
    'completion notes',
    'completionreason',
  ],
  source_url: [
    'source_url',
    'sourceurl',
    'original_price_source_url',
    'originalpricesourceurl',
  ],
}

function normalizeWhitespace(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim()
}

function normalizeHeader(value) {
  return normalizeWhitespace(value).toLowerCase().replace(/[^a-z0-9]+/g, '')
}

function normalizeToken(value) {
  return normalizeWhitespace(value).toLowerCase()
}

function normalizeSource(value) {
  const source = normalizeWhitespace(value).toLowerCase()
  if (!source) return 'empty'
  if (source === CANONICAL_ORIGINAL_PRICE_SOURCE.AI_RESEARCH_APPROVED) {
    return 'product_research_verified'
  }
  return source
}

function parseInteger(value) {
  if (value == null || value === '') return null
  const parsed = Number.parseInt(String(value).trim(), 10)
  return Number.isFinite(parsed) ? parsed : null
}

function parseNumber(value) {
  if (value == null || value === '') return null
  const cleaned = String(value).replace(/[£$,]/g, '').trim()
  const parsed = Number(cleaned)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

function parseConfidence(value) {
  const parsed = parseInteger(value)
  if (parsed == null) return null
  return Math.max(0, Math.min(100, parsed))
}

export function normalizeImportHeaderMap(headers = []) {
  const map = {}
  for (const header of headers) {
    const normalized = normalizeHeader(header)
    if (!normalized) continue
    for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
      if (aliases.some((alias) => normalizeHeader(alias) === normalized)) {
        map[field] = header
      }
    }
  }
  return map
}

export function mapSpreadsheetRow(rawRow = {}, headerMap = {}) {
  const getValue = (field) => {
    const header = headerMap[field]
    if (!header) return null
    return rawRow[header]
  }

  const price = parseNumber(getValue('original_base_price'))
  const currency = normalizeWhitespace(getValue('original_base_price_currency')).toUpperCase() || null

  return {
    canonical_product_key: normalizeWhitespace(getValue('canonical_product_key')) || null,
    canonical_product_name: normalizeWhitespace(getValue('canonical_product_name')) || null,
    brand: normalizeWhitespace(getValue('brand')) || null,
    original_base_price: price,
    original_base_price_currency: currency,
    baseline_manufacture_year: parseInteger(getValue('baseline_manufacture_year')),
    production_start_year: parseInteger(getValue('production_start_year')),
    production_end_year: parseInteger(getValue('production_end_year')),
    original_price_confidence: parseConfidence(getValue('original_price_confidence')),
    lifecycle_confidence: parseConfidence(getValue('lifecycle_confidence')),
    review_notes: normalizeWhitespace(getValue('review_notes')) || null,
    source_url: normalizeWhitespace(getValue('source_url')) || null,
  }
}

export function parseCsvResearchImportText(csvText) {
  const lines = String(csvText ?? '').split(/\r?\n/).filter((line) => line.trim())
  if (!lines.length) return { headers: [], rows: [] }

  const headers = splitCsvLine(lines[0])
  const rows = lines.slice(1).map((line) => {
    const values = splitCsvLine(line)
    const row = {}
    headers.forEach((header, index) => {
      row[header] = values[index] ?? ''
    })
    return row
  })

  return { headers, rows }
}

function splitCsvLine(line) {
  const values = []
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
    } else if (char === ',') {
      values.push(current)
      current = ''
    } else {
      current += char
    }
  }

  values.push(current)
  return values
}

export async function parseResearchImportFile(filePathOrBuffer, { filename = '' } = {}) {
  if (typeof File !== 'undefined' && filePathOrBuffer instanceof File) {
    const buffer = await filePathOrBuffer.arrayBuffer()
    return parseResearchImportFile(buffer, { filename: filePathOrBuffer.name })
  }

  const lowerName = String(filename || filePathOrBuffer?.name || '').toLowerCase()

  if (typeof filePathOrBuffer === 'string' && lowerName.endsWith('.csv')) {
    const { readFileSync } = await import('node:fs')
    const text = readFileSync(filePathOrBuffer, 'utf8')
    return parseCsvResearchImportText(text)
  }

  if (typeof filePathOrBuffer === 'string' && lowerName.endsWith('.xlsx')) {
    const { readFileSync } = await import('node:fs')
    const { default: ExcelJS } = await import('exceljs')
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(readFileSync(filePathOrBuffer))
    return worksheetToImportRows(workbook.worksheets[0])
  }

  if (filePathOrBuffer instanceof ArrayBuffer || filePathOrBuffer?.buffer) {
    if (lowerName.endsWith('.csv')) {
      const text = new TextDecoder().decode(filePathOrBuffer)
      return parseCsvResearchImportText(text)
    }

    const { default: ExcelJS } = await import('exceljs')
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(filePathOrBuffer)
    return worksheetToImportRows(workbook.worksheets[0])
  }

  throw new Error('Unsupported import file type. Use .xlsx or .csv')
}

function worksheetToImportRows(worksheet) {
  if (!worksheet) return { headers: [], rows: [] }

  const headers = []
  const rows = []

  worksheet.eachRow((row, rowNumber) => {
    const values = row.values.slice(1).map((value) => (
      value == null ? '' : String(value)
    ))

    if (rowNumber === 1) {
      headers.push(...values)
      return
    }

    const record = {}
    headers.forEach((header, index) => {
      record[header] = values[index] ?? ''
    })
    rows.push(record)
  })

  return { headers, rows }
}

export function deriveCanonicalProductPriceSource(product) {
  if (product?.original_price_source) {
    return normalizeSource(product.original_price_source)
  }
  if (product?.original_base_price == null) return 'empty'
  return 'unknown'
}

export function deriveCanonicalProductBaselineSource(product) {
  if (product?.baseline_source) {
    return normalizeSource(product.baseline_source)
  }
  if (product?.baseline_manufacture_year == null) return 'empty'
  if (isSeriesDefaultBaselineNote(product?.review_notes)) return 'series_default'
  if (isResearchApprovedBaselineNote(product?.review_notes)) return 'product_research_verified'
  return 'unknown'
}

export function canOverwriteImportedValue({
  currentValue,
  currentSource,
  force = false,
}) {
  if (force) return true
  if (currentValue == null || currentValue === '') return true

  const source = normalizeSource(currentSource)
  if (OVERWRITABLE_SOURCES.has(source)) return true
  if (PROTECTED_SOURCES.has(source)) return false
  return source === 'unknown'
}

export function matchCanonicalProduct(products = [], importRow = {}) {
  const key = normalizeToken(importRow.canonical_product_key)
  if (key) {
    const byKey = products.filter((product) => (
      normalizeToken(product.canonical_product_key) === key
    ))
    if (byKey.length === 1) {
      return { product: byKey[0], matchMethod: 'canonical_product_key', ambiguous: false }
    }
    if (byKey.length > 1) {
      return { product: null, matchMethod: 'canonical_product_key', ambiguous: true }
    }
  }

  const brand = normalizeToken(importRow.brand)
  const name = normalizeToken(importRow.canonical_product_name)
  if (brand && name) {
    const byName = products.filter((product) => (
      normalizeToken(product.brand) === brand
      && normalizeToken(product.canonical_product_name) === name
    ))
    if (byName.length === 1) {
      return { product: byName[0], matchMethod: 'brand+canonical_product_name', ambiguous: false }
    }
    if (byName.length > 1) {
      return { product: null, matchMethod: 'brand+canonical_product_name', ambiguous: true }
    }
  }

  return { product: null, matchMethod: null, ambiguous: false }
}

function buildImportReviewNotes(existingNotes, incomingNotes, importedAt = new Date()) {
  const stamp = `[manual_import ${importedAt.toISOString().slice(0, 10)}]`
  const parts = [existingNotes, incomingNotes, stamp].filter(Boolean)
  const lines = []
  for (const part of parts) {
    for (const line of String(part).split('\n')) {
      const trimmed = line.trim()
      if (trimmed && !lines.includes(trimmed)) lines.push(trimmed)
    }
  }
  return lines.join('\n')
}

function evaluateImportedField({
  fieldName,
  currentValue,
  currentSource,
  nextValue,
  force,
}) {
  if (nextValue == null || nextValue === '') {
    return { apply: false, conflict: false }
  }

  const sameValue = Number.isFinite(Number(currentValue)) && Number.isFinite(Number(nextValue))
    ? Number(currentValue) === Number(nextValue)
    : String(currentValue ?? '') === String(nextValue ?? '')

  if (sameValue) {
    return { apply: false, conflict: false }
  }

  if (!canOverwriteImportedValue({ currentValue, currentSource, force })) {
    return { apply: false, conflict: true, reason: `${fieldName} protected (${currentSource || 'verified'})` }
  }

  return { apply: true, conflict: false }
}

export function buildCanonicalProductImportUpdate(product, importRow, {
  force = false,
  importedAt = new Date(),
} = {}) {
  const conflicts = []
  const update = {}
  const priceSource = deriveCanonicalProductPriceSource(product)
  const baselineSource = deriveCanonicalProductBaselineSource(product)

  const priceEval = evaluateImportedField({
    fieldName: 'original_base_price',
    currentValue: product.original_base_price,
    currentSource: priceSource,
    nextValue: importRow.original_base_price,
    force,
  })
  if (priceEval.conflict) conflicts.push(priceEval.reason)
  if (priceEval.apply) {
    update.original_base_price = importRow.original_base_price
    update.original_price_source = IMPORT_SOURCE
    if (importRow.original_base_price_currency) {
      update.original_base_price_currency = importRow.original_base_price_currency
    }
    if (importRow.original_price_confidence != null) {
      update.original_price_confidence = importRow.original_price_confidence
    }
    if (importRow.source_url) {
      update.original_price_source_url = importRow.source_url
    }
  }

  const baselineEval = evaluateImportedField({
    fieldName: 'baseline_manufacture_year',
    currentValue: product.baseline_manufacture_year,
    currentSource: baselineSource,
    nextValue: importRow.baseline_manufacture_year,
    force,
  })
  if (baselineEval.conflict) conflicts.push(baselineEval.reason)
  if (baselineEval.apply) {
    update.baseline_manufacture_year = importRow.baseline_manufacture_year
    update.baseline_source = IMPORT_SOURCE
    if (importRow.lifecycle_confidence != null) {
      update.lifecycle_confidence = importRow.lifecycle_confidence
    }
  }

  const productionStartEval = evaluateImportedField({
    fieldName: 'production_start_year',
    currentValue: product.production_start_year,
    currentSource: baselineSource,
    nextValue: importRow.production_start_year,
    force,
  })
  if (productionStartEval.conflict) conflicts.push(productionStartEval.reason)
  if (productionStartEval.apply) {
    update.production_start_year = importRow.production_start_year
  }

  const productionEndEval = evaluateImportedField({
    fieldName: 'production_end_year',
    currentValue: product.production_end_year,
    currentSource: baselineSource,
    nextValue: importRow.production_end_year,
    force,
  })
  if (productionEndEval.conflict) conflicts.push(productionEndEval.reason)
  if (productionEndEval.apply) {
    update.production_end_year = importRow.production_end_year
  }

  if (importRow.review_notes || Object.keys(update).length) {
    update.review_notes = buildImportReviewNotes(
      product.review_notes,
      importRow.review_notes,
      importedAt,
    )
  }

  return { update, conflicts }
}

export function canPropagateImportedBaselineToIntelligence(row) {
  if (row?.baseline_manufacture_year == null) return true
  const source = row?.baseline_manufacture_year_source
  if (!source) return false
  if (source === IMPORT_SOURCE) return false
  if (isProvisionalBaselineSource(source)) return true
  return false
}

export function canPropagateImportedPriceToIntelligence(row) {
  if (row?.best_original_price == null) return true
  if (row?.best_original_price_source_id) return false
  const confidence = Number(row?.best_original_price_confidence ?? 0)
  return confidence < 70
}

export function buildIntelligencePropagationPatches(product, update, intelligenceRows = []) {
  const patches = []

  for (const row of intelligenceRows) {
    const patch = { id: row.id }

    if (update.baseline_manufacture_year != null && canPropagateImportedBaselineToIntelligence(row)) {
      Object.assign(
        patch,
        buildBaselineManufactureYearPatch({
          year: update.baseline_manufacture_year,
          confidence: update.lifecycle_confidence ?? product.lifecycle_confidence ?? 80,
          source: BASELINE_MANUFACTURE_YEAR_SOURCE.MANUAL_IMPORT,
        }),
      )
    }

    if (update.original_base_price != null && canPropagateImportedPriceToIntelligence(row)) {
      patch.best_original_price = update.original_base_price
      patch.best_original_price_currency = update.original_base_price_currency
        ?? product.original_base_price_currency
        ?? 'GBP'
      patch.best_original_price_confidence = update.original_price_confidence
        ?? product.original_price_confidence
        ?? 80
    }

    if (Object.keys(patch).length > 1) {
      patches.push(patch)
    }
  }

  return patches
}

export function buildCanonicalProductImportPlan(
  products = [],
  parsedRows = [],
  headerMap = {},
  { force = false } = {},
) {
  const results = []
  const summary = {
    rowsRead: parsedRows.length,
    matched: 0,
    updated: 0,
    skipped: 0,
    conflicts: 0,
    noMatches: 0,
  }

  for (const [index, rawRow] of parsedRows.entries()) {
    const importRow = mapSpreadsheetRow(rawRow, headerMap)
    const hasImportData = [
      importRow.original_base_price,
      importRow.baseline_manufacture_year,
      importRow.production_start_year,
      importRow.production_end_year,
      importRow.review_notes,
    ].some((value) => value != null && value !== '')

    const match = matchCanonicalProduct(products, importRow)
    const baseResult = {
      rowNumber: index + 2,
      importRow,
      matchedProductId: match.product?.id ?? null,
      matchedProductName: match.product?.canonical_product_name ?? null,
      matchMethod: match.matchMethod,
      currentRrp: match.product?.original_base_price ?? null,
      newRrp: importRow.original_base_price,
      currentBaseline: match.product?.baseline_manufacture_year ?? null,
      newBaseline: importRow.baseline_manufacture_year,
      action: IMPORT_ACTION.NO_MATCH,
      reason: '',
      update: null,
      intelligencePatches: [],
    }

    if (!hasImportData) {
      results.push({
        ...baseResult,
        action: IMPORT_ACTION.SKIP,
        reason: 'No importable values in row',
      })
      summary.skipped += 1
      continue
    }

    if (match.ambiguous) {
      results.push({
        ...baseResult,
        action: IMPORT_ACTION.SKIP,
        reason: `Ambiguous ${match.matchMethod} match`,
      })
      summary.skipped += 1
      continue
    }

    if (!match.product) {
      results.push({
        ...baseResult,
        action: IMPORT_ACTION.NO_MATCH,
        reason: 'No matching canonical product',
      })
      summary.noMatches += 1
      continue
    }

    summary.matched += 1
    const { update, conflicts } = buildCanonicalProductImportUpdate(match.product, importRow, { force })

    if (conflicts.length) {
      results.push({
        ...baseResult,
        action: IMPORT_ACTION.CONFLICT,
        reason: conflicts.join('; '),
        update,
      })
      summary.conflicts += 1
      continue
    }

    if (!Object.keys(update).length) {
      results.push({
        ...baseResult,
        action: IMPORT_ACTION.SKIP,
        reason: 'Already up to date',
      })
      summary.skipped += 1
      continue
    }

    results.push({
      ...baseResult,
      action: IMPORT_ACTION.UPDATE,
      reason: match.matchMethod,
      update,
      productSnapshot: {
        original_base_price: match.product.original_base_price,
        original_base_price_currency: match.product.original_base_price_currency,
        original_price_confidence: match.product.original_price_confidence,
        original_price_source: match.product.original_price_source,
        original_price_source_url: match.product.original_price_source_url,
        baseline_manufacture_year: match.product.baseline_manufacture_year,
        baseline_source: match.product.baseline_source,
        production_start_year: match.product.production_start_year,
        production_end_year: match.product.production_end_year,
        lifecycle_confidence: match.product.lifecycle_confidence,
        review_notes: match.product.review_notes,
      },
    })
    summary.updated += 1
  }

  return { results, summary }
}

export function buildImportPlanWithIntelligence(
  products = [],
  parsedRows = [],
  headerMap = {},
  intelligenceRowsById = new Map(),
  options = {},
) {
  const plan = buildCanonicalProductImportPlan(products, parsedRows, headerMap, options)
  const productSourceIds = new Map(
    products.map((product) => [product.id, product.source_intelligence_row_ids ?? []]),
  )

  const enrichedResults = plan.results.map((result) => {
    if (result.action !== IMPORT_ACTION.UPDATE || !result.matchedProductId) {
      return { ...result, intelligencePatches: [] }
    }

    const sourceIds = productSourceIds.get(result.matchedProductId) ?? []
    const intelligenceRows = sourceIds
      .map((id) => intelligenceRowsById.get(id))
      .filter(Boolean)

    return {
      ...result,
      intelligencePatches: buildIntelligencePropagationPatches(
        products.find((product) => product.id === result.matchedProductId) ?? {},
        result.update,
        intelligenceRows,
      ),
    }
  })

  return {
    ...plan,
    results: enrichedResults,
  }
}

export function formatImportPlanRowLine(result) {
  return [
    result.matchedProductName || '—',
    `current_rrp=${result.currentRrp ?? '—'}`,
    `new_rrp=${result.newRrp ?? '—'}`,
    `current_baseline=${result.currentBaseline ?? '—'}`,
    `new_baseline=${result.newBaseline ?? '—'}`,
    result.action,
    result.reason || '—',
  ].join(' | ')
}

export async function applyCanonicalProductImportPlan(plan, {
  applyProductUpdate,
  applyIntelligenceUpdate,
  onFailure = null,
} = {}) {
  const failures = []
  let appliedProducts = 0
  let appliedIntelligenceRows = 0

  for (const result of plan.results) {
    if (result.action !== IMPORT_ACTION.UPDATE || !result.update || !result.matchedProductId) {
      continue
    }

    const snapshot = result.productSnapshot ?? null
    const productResult = await applyProductUpdate(result.matchedProductId, result.update, snapshot)
    if (productResult.error) {
      failures.push({
        productId: result.matchedProductId,
        productName: result.matchedProductName,
        stage: 'equipment_products',
        error: productResult.error,
      })
      if (typeof onFailure === 'function') onFailure(failures[failures.length - 1])
      continue
    }

    appliedProducts += 1
    let intelligenceFailed = false

    for (const patch of result.intelligencePatches ?? []) {
      const intelligenceResult = await applyIntelligenceUpdate(patch.id, patch)
      if (intelligenceResult.error) {
        intelligenceFailed = true
        if (snapshot && productResult.rollback) {
          await productResult.rollback()
        }
        failures.push({
          productId: result.matchedProductId,
          productName: result.matchedProductName,
          intelligenceRowId: patch.id,
          stage: 'equipment_intelligence',
          error: intelligenceResult.error,
        })
        if (typeof onFailure === 'function') onFailure(failures[failures.length - 1])
        break
      }
      appliedIntelligenceRows += 1
    }

    if (intelligenceFailed) {
      appliedProducts -= 1
    }
  }

  return {
    appliedProducts,
    appliedIntelligenceRows,
    failures,
  }
}
