/**
 * Report-only instrumentation for research CSV import.
 * Does not change import / apply behaviour — classifies each CSV row after planning.
 */

import {
  RESEARCH_CSV_HEADERS,
  RESEARCH_IMPORT_ROW_CATEGORY,
  buildResearchImportRejectionCsv,
  classifyResearchImportRejectionMessage,
  summarizeResearchImportClassifications,
} from './equipmentProductResearchCsv.js'

function normalizeWhitespace(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim()
}

const EXPECTED_RESEARCHED_HEADERS = RESEARCH_CSV_HEADERS.filter((header) => (
  header.startsWith('researched_')
  || ['price_source_url', 'year_source_url', 'secondary_source_url', 'research_notes'].includes(header)
))

/**
 * Detect CSV header problems that cause mass "no changes" outcomes.
 * Report-only — does not change import behaviour.
 */
export function diagnoseResearchImportCsvHeaders(headers = []) {
  const present = new Set((headers || []).map((h) => String(h || '').trim()))
  const missingResearched = EXPECTED_RESEARCHED_HEADERS.filter((h) => !present.has(h))
  return {
    headerCount: present.size,
    missingResearchedHeaders: missingResearched,
    missingAllResearchedInputColumns: missingResearched.length === EXPECTED_RESEARCHED_HEADERS.length,
    hasAnyResearchedHeader: EXPECTED_RESEARCHED_HEADERS.some((h) => present.has(h)),
  }
}

/**
 * Classify every CSV row into exactly one category based on the existing plan outcome.
 * Import plans/errors are the source of truth; this only explains them.
 *
 * @param {object[]} csvRows
 * @param {{ plans?: object[], errors?: object[] }} planResult
 * @param {{ headers?: string[] }} options
 */
export function classifyResearchImportPlanRows(csvRows = [], planResult = {}, options = {}) {
  const plans = planResult.plans || []
  const errors = planResult.errors || []
  const headers = options.headers
    || (csvRows[0] ? Object.keys(csvRows[0]).filter((k) => k !== '__line') : [])
  const headerDiagnosis = diagnoseResearchImportCsvHeaders(headers)
  const planByLine = new Map(plans.map((plan) => [plan.line, plan]))

  /** @type {Map<number, object[]>} */
  const errorsByLine = new Map()
  for (const error of errors) {
    const line = Number(error.line) || 0
    if (!errorsByLine.has(line)) errorsByLine.set(line, [])
    errorsByLine.get(line).push(error)
  }

  const seenKeys = new Map()
  const classifications = []

  for (const row of csvRows) {
    const line = row.__line || 0
    const productId = normalizeWhitespace(row.product_id)
    const key = normalizeWhitespace(row.canonical_product_key)
    const brand = normalizeWhitespace(row.brand)
    const plan = planByLine.get(line)
    const rowErrors = errorsByLine.get(line) || []

    let firstKeyLine = null
    if (key) {
      if (seenKeys.has(key)) firstKeyLine = seenKeys.get(key)
      else seenKeys.set(key, line)
    }

    if (plan?.action === 'update') {
      classifications.push({
        line,
        product_id: plan.product_id,
        canonical_product_key: plan.canonical_product_key,
        brand: plan.brand,
        category: RESEARCH_IMPORT_ROW_CATEGORY.VALID_UPDATE,
        rejection_reason: firstKeyLine
          ? `Valid update (note: canonical_product_key also appears on line ${firstKeyLine}; importer does not reject duplicate keys)`
          : '',
        rawRow: row,
        importer_action: 'update',
      })
      continue
    }

    if (plan?.action === 'unchanged') {
      let rejectionReason = 'No researched_* values differ from current product data (blank or same values)'
      if (headerDiagnosis.missingAllResearchedInputColumns) {
        rejectionReason = 'CSV is missing all researched_* / source URL input columns — importer only updates researched_* fields, so filling current-value columns has no effect'
      } else if (!headerDiagnosis.hasAnyResearchedHeader) {
        rejectionReason = 'CSV is missing researched_* input columns — importer only reads researched_* fields'
      }
      if (firstKeyLine) {
        rejectionReason += `; note: canonical_product_key also appears on line ${firstKeyLine}`
      }
      classifications.push({
        line,
        product_id: plan.product_id,
        canonical_product_key: plan.canonical_product_key,
        brand: plan.brand,
        category: RESEARCH_IMPORT_ROW_CATEGORY.NO_CHANGES,
        rejection_reason: rejectionReason,
        rawRow: row,
        importer_action: 'unchanged',
      })
      continue
    }

    const primary = rowErrors[0]
    if (!primary) {
      if (firstKeyLine && productId) {
        classifications.push({
          line,
          product_id: productId,
          canonical_product_key: key,
          brand,
          category: RESEARCH_IMPORT_ROW_CATEGORY.DUPLICATE_CANONICAL_KEY,
          rejection_reason: `duplicate canonical_product_key "${key}" also on line ${firstKeyLine}`,
          rawRow: row,
        })
        continue
      }
      classifications.push({
        line,
        product_id: productId || null,
        canonical_product_key: key || null,
        brand: brand || null,
        category: RESEARCH_IMPORT_ROW_CATEGORY.VALIDATION_ERROR,
        rejection_reason: 'Row was not accepted and produced no explicit error message',
        rawRow: row,
      })
      continue
    }

    const category = classifyResearchImportRejectionMessage(primary.message)
    const extra = rowErrors.length > 1
      ? ` (+${rowErrors.length - 1} more: ${rowErrors.slice(1).map((e) => e.message).join('; ')})`
      : ''

    classifications.push({
      line,
      product_id: primary.product_id || productId || null,
      canonical_product_key: key || null,
      brand: brand || null,
      category,
      rejection_reason: `${primary.message}${extra}`,
      rawRow: row,
      all_error_messages: rowErrors.map((e) => e.message),
    })
  }

  const acceptedKeyCounts = new Map()
  for (const entry of classifications) {
    if (
      entry.category !== RESEARCH_IMPORT_ROW_CATEGORY.VALID_UPDATE
      && entry.category !== RESEARCH_IMPORT_ROW_CATEGORY.NO_CHANGES
    ) continue
    const k = normalizeWhitespace(entry.canonical_product_key || entry.rawRow?.canonical_product_key)
    if (!k) continue
    acceptedKeyCounts.set(k, (acceptedKeyCounts.get(k) || 0) + 1)
  }
  const duplicateKeyGroups = [...acceptedKeyCounts.entries()].filter(([, count]) => count > 1)

  const classificationSummary = summarizeResearchImportClassifications(classifications)
  classificationSummary.headerDiagnosis = headerDiagnosis
  classificationSummary.duplicateCanonicalKeyGroupsAmongAccepted = duplicateKeyGroups.length
  classificationSummary.duplicateCanonicalKeyExtraRowsAmongAccepted = duplicateKeyGroups.reduce(
    (sum, [, count]) => sum + (count - 1),
    0,
  )

  if (headerDiagnosis.missingAllResearchedInputColumns) {
    classificationSummary.text += `\n\nRoot cause: the uploaded CSV has ${headerDiagnosis.headerCount} columns and is missing every researched_* / source URL input column. The importer never reads current-value columns (baseline_manufacture_year, original_base_price, etc.), so edited current values are ignored and every row classifies as “No changes detected”.`
  } else if (headerDiagnosis.missingResearchedHeaders.length) {
    classificationSummary.text += `\n\nNote: missing researched headers: ${headerDiagnosis.missingResearchedHeaders.join(', ')}`
  }
  if (duplicateKeyGroups.length) {
    classificationSummary.text += `\n\nNote: ${duplicateKeyGroups.length} canonical key(s) appear more than once among accepted rows (${classificationSummary.duplicateCanonicalKeyExtraRowsAmongAccepted} extra row(s)). The importer does not currently reject duplicate keys.`
  }

  return {
    classifications,
    classificationSummary,
    rejectionCsv: buildResearchImportRejectionCsv(classifications),
    headerDiagnosis,
  }
}

/**
 * Attach classification report onto an existing import plan object (mutates for convenience).
 */
export function attachResearchImportClassificationReport(plan, csvRows = []) {
  if (!plan) return plan
  const report = classifyResearchImportPlanRows(csvRows, plan, { headers: plan.headers })
  plan.classifications = report.classifications
  plan.classificationSummary = report.classificationSummary
  plan.rejectionCsv = report.rejectionCsv
  plan.headerDiagnosis = report.headerDiagnosis
  return plan
}
