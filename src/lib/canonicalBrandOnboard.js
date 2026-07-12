import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  buildBrandCanonicalWorkflowReport,
  buildCanonicalProductAuditReport,
  productHasBaselineYear,
  productHasRrp,
  PRODUCT_STATUS,
} from './intelligenceCanonicalProducts.js'
import {
  buildActiveBrandNameSet,
  buildCanonicalProductDisplayGroups,
  filterCanonicalProductsForTop100Queue,
} from './equipmentResearchQueue.js'
import { inferGranularStrengthType } from './equipmentTypeRepair.js'

export const DEFAULT_ONBOARD_BRANDS = ['Concept2', 'Hammer Strength']

export const BRAND_CATALOGUE_FILES = {
  Concept2: 'data/catalogue/concept2-equipment-intelligence.csv',
  Woodway: 'data/catalogue/woodway-equipment-intelligence.csv',
  Wattbike: 'data/catalogue/wattbike-equipment-intelligence.csv',
}

const CATALOGUE_COLUMNS = [
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

function normalizeWhitespace(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim()
}

function parseCatalogueCsvLine(line) {
  const cells = []
  let current = ''
  let inQuotes = false

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index]
    if (char === '"') {
      if (inQuotes && line[index + 1] === '"') {
        current += '"'
        index += 1
      } else {
        inQuotes = !inQuotes
      }
      continue
    }
    if (char === ',' && !inQuotes) {
      cells.push(current)
      current = ''
      continue
    }
    current += char
  }

  cells.push(current)
  return cells
}

function parseOptionalNumber(value) {
  const text = normalizeWhitespace(value)
  if (!text) return { value: null, error: null }
  const number = Number(text.replace(/[£$,]/g, ''))
  if (!Number.isFinite(number)) return { value: null, error: 'must be a number' }
  return { value: number, error: null }
}

function parseOptionalInteger(value) {
  const parsed = parseOptionalNumber(value)
  if (parsed.error) return parsed
  if (parsed.value == null) return parsed
  return { value: Math.round(parsed.value), error: null }
}

function parseCatalogueCsv(csvText) {
  const lines = String(csvText ?? '')
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line) => line.trim() !== '')

  if (!lines.length) {
    throw new Error('Catalogue CSV is empty')
  }

  const headers = parseCatalogueCsvLine(lines[0]).map((cell) => normalizeWhitespace(cell).toLowerCase())
  const rows = lines.slice(1).map((line, index) => {
    const cells = parseCatalogueCsvLine(line)
    const row = {}
    headers.forEach((header, cellIndex) => {
      row[header] = cells[cellIndex] ?? ''
    })
    row._sourceLine = index + 2
    return row
  })

  return rows
}

export function loadPlannedIntelligenceCatalogue(brand, rootDir = process.cwd()) {
  const relativePath = BRAND_CATALOGUE_FILES[brand]
  if (!relativePath) return { rows: [], source: null }

  const absolutePath = join(rootDir, relativePath)
  const parsedRows = parseCatalogueCsv(readFileSync(absolutePath, 'utf8'))
  const rows = []

  for (const row of parsedRows) {
    const brandValue = normalizeWhitespace(row.brand)
    const model = normalizeWhitespace(row.model)
    const slug = normalizeWhitespace(row.slug)
    if (!brandValue || !model || !slug) {
      throw new Error(`${brand} catalogue row ${row._sourceLine} missing brand, model, or slug`)
    }

    const manufactureYear = parseOptionalInteger(row.manufacture_year)
    if (manufactureYear.error) {
      throw new Error(`${brand} catalogue row ${row._sourceLine}: manufacture_year ${manufactureYear.error}`)
    }

    const originalRrp = parseOptionalNumber(row.original_rrp)
    if (originalRrp.error) {
      throw new Error(`${brand} catalogue row ${row._sourceLine}: original_rrp ${originalRrp.error}`)
    }

    rows.push({
      id: `planned-${brand.toLowerCase().replace(/\s+/g, '-')}-${rows.length + 1}`,
      brand: brandValue,
      series: normalizeWhitespace(row.series) || null,
      model,
      equipment_type: normalizeWhitespace(row.equipment_type) || null,
      category: normalizeWhitespace(row.category) || null,
      original_rrp: originalRrp.value,
      baseline_manufacture_year: manufactureYear.value,
      manufacture_start_year: manufactureYear.value,
      currency: normalizeWhitespace(row.currency) || 'GBP',
      slug,
      best_original_price: originalRrp.value,
      best_original_price_confidence: normalizeWhitespace(row.confidence).toLowerCase() === 'high' ? 90 : 75,
      product_family: normalizeWhitespace(row.series) || null,
    })
  }

  return {
    source: relativePath,
    rows,
  }
}

function normalizeBrandKey(brand) {
  return normalizeWhitespace(brand).toLowerCase().replace(/[^a-z0-9]/g, '')
}

function proposeWoodwayCurveTypeRepair(row) {
  if (normalizeBrandKey(row.brand) !== 'woodway') return null
  const label = [row.series, row.model].filter(Boolean).join(' ').toLowerCase()
  if (!label.includes('curve')) return null
  if (normalizeWhitespace(row.equipment_type) === 'Non-Motorised Treadmill') return null
  return {
    id: row.id,
    model: row.model,
    before: row.equipment_type ?? null,
    after: 'Non-Motorised Treadmill',
    reason: 'Woodway Curve lineup is a non-motorised treadmill',
  }
}

function proposePulseFusionTypeRepair(row) {
  if (normalizeBrandKey(row.brand) !== 'pulsefitness') return null
  const label = [row.series, row.model].filter(Boolean).join(' ').toLowerCase()

  if (label.includes('fusion step') || (label.includes('fusion') && /\bstep\b/.test(label))) {
    if (normalizeWhitespace(row.equipment_type) === 'Stepper/Stair Climber') return null
    return {
      id: row.id,
      model: row.model,
      before: row.equipment_type ?? null,
      after: 'Stepper/Stair Climber',
      reason: 'Pulse Fusion Step lineup is a stair climber',
    }
  }

  if (label.includes('fusion x-train') || label.includes('fusion x-trainer')) {
    if (normalizeWhitespace(row.equipment_type) === 'Cross Trainer') return null
    return {
      id: row.id,
      model: row.model,
      before: row.equipment_type ?? null,
      after: 'Cross Trainer',
      reason: 'Pulse Fusion X-Train lineup is an elliptical trainer',
    }
  }

  if (label.includes('fusion l-train')) {
    if (normalizeWhitespace(row.equipment_type) === 'Cross Trainer') return null
    return {
      id: row.id,
      model: row.model,
      before: row.equipment_type ?? null,
      after: 'Cross Trainer',
      reason: 'Pulse Fusion L-Train lineup is a lateral elliptical trainer',
    }
  }

  return null
}

export function proposeIntelligenceEquipmentTypeRepairs(rows = []) {
  const repairsById = new Map()

  for (const row of rows) {
    const woodwayRepair = proposeWoodwayCurveTypeRepair(row)
    if (woodwayRepair) {
      repairsById.set(row.id, woodwayRepair)
      continue
    }

    const pulseRepair = proposePulseFusionTypeRepair(row)
    if (pulseRepair) {
      repairsById.set(row.id, pulseRepair)
      continue
    }

    const proposed = inferGranularStrengthType({
      brand: row.brand,
      model: row.model,
      canonical_product_name: (() => {
        const brand = normalizeWhitespace(row.brand)
        const series = normalizeWhitespace(row.series)
        const model = normalizeWhitespace(row.model)
        const seriesKey = series.toLowerCase().replace(/[^a-z0-9]+/g, '')
        const modelKey = model.toLowerCase().replace(/[^a-z0-9]+/g, '')
        return [brand, seriesKey && seriesKey !== modelKey ? series : null, model]
          .filter(Boolean)
          .join(' ')
      })(),
      equipment_type: row.equipment_type,
    })
    if (!proposed?.equipmentType) continue
    if (normalizeWhitespace(proposed.equipmentType) === normalizeWhitespace(row.equipment_type)) {
      continue
    }
    repairsById.set(row.id, {
      id: row.id,
      model: row.model,
      before: row.equipment_type ?? null,
      after: proposed.equipmentType,
      reason: proposed.keyword ? `matched "${proposed.keyword}"` : 'inferred from model name',
    })
  }

  return [...repairsById.values()]
}

export function intelligenceRowsToAuditProducts(audit) {
  return audit.products.map((product) => ({
    brand: product.brand,
    canonical_product_name: product.canonical_product_name,
    canonical_product_key: product.canonical_product_key,
    model: product.model,
    equipment_type: product.equipment_type,
    status: product.status,
    original_base_price: product.original_base_price,
    baseline_manufacture_year: product.baseline_manufacture_year,
    original_price_confidence: product.original_price_confidence,
    source_intelligence_row_ids: product.source_intelligence_row_ids,
    image_url: null,
    image_storage_path: null,
    image_status: 'missing',
  }))
}

export function projectTop100EligibilityAfterImport({
  brand,
  auditProducts = [],
  existingApprovedProducts = [],
  activeBrands = null,
  limit = 100,
} = {}) {
  const existingKeys = new Set(
    existingApprovedProducts.map((product) => product.canonical_product_key).filter(Boolean),
  )

  const projectedProducts = auditProducts
    .filter((product) => product.status !== PRODUCT_STATUS.EXCLUDED)
    .filter((product) => !existingKeys.has(product.canonical_product_key))
    .map((product) => ({
      id: `projected-${product.canonical_product_key}`,
      brand: product.brand,
      product_family: product.product_family ?? null,
      model: product.model,
      equipment_type: product.equipment_type ?? null,
      canonical_product_name: product.canonical_product_name,
      canonical_product_key: product.canonical_product_key,
      baseline_manufacture_year: product.baseline_manufacture_year ?? null,
      production_start_year: product.production_start_year ?? null,
      production_end_year: product.production_end_year ?? null,
      original_base_price: product.original_base_price ?? null,
      original_base_price_currency: product.original_base_price_currency ?? 'GBP',
      original_price_confidence: product.original_price_confidence ?? null,
      source_intelligence_row_ids: product.source_intelligence_row_ids ?? [],
      status: PRODUCT_STATUS.APPROVED,
      image_url: null,
      image_storage_path: null,
      image_status: 'missing',
    }))

  const mergedProducts = [...existingApprovedProducts, ...projectedProducts]
  const resolvedActiveBrands = buildActiveBrandNameSet({
    brands: activeBrands ? [...activeBrands].map((name) => ({ name })) : [],
    products: mergedProducts,
  })

  const globalIncompleteCandidates = filterCanonicalProductsForTop100Queue(mergedProducts, {
    activeBrands: resolvedActiveBrands,
  })
  const brandIncompleteCandidates = globalIncompleteCandidates.filter(
    (product) => normalizeWhitespace(product.brand) === normalizeWhitespace(brand),
  )
  const top100Groups = buildCanonicalProductDisplayGroups(mergedProducts, {
    limit,
    incompleteOnly: true,
    activeBrands: resolvedActiveBrands,
  })
  const brandTop100Groups = top100Groups.filter(
    (group) => normalizeWhitespace(group.product?.brand) === normalizeWhitespace(brand),
  )

  return {
    global_incomplete_candidates: globalIncompleteCandidates.length,
    brand_eligible_count: brandIncompleteCandidates.length,
    brand_in_top100_count: brandTop100Groups.length,
    brand_in_top100: brandTop100Groups.map((group) => ({
      rank: group.rank,
      canonical_product_name: group.primary_keyword,
      canonical_product_key: group.product?.canonical_product_key ?? null,
    })),
    projected_new_products: projectedProducts.length,
  }
}

export function buildBrandOnboardReport({
  brand,
  intelligenceRows = [],
  equipmentProducts = [],
  catalogueSource = null,
  plannedImport = false,
  existingApprovedProducts = [],
  activeBrands = null,
}) {
  const typeRepairs = proposeIntelligenceEquipmentTypeRepairs(intelligenceRows)
  const repairedRows = intelligenceRows.map((row) => {
    const repair = typeRepairs.find((entry) => entry.id === row.id)
    if (!repair) return row
    return { ...row, equipment_type: repair.after }
  })

  const audit = buildCanonicalProductAuditReport(repairedRows, { brandFilter: brand })
  const workflow = buildBrandCanonicalWorkflowReport(audit, {
    equipmentProducts,
    intelligenceRows: repairedRows,
  })

  const canonicalProducts = intelligenceRowsToAuditProducts(audit)
  const duplicatesMerged = audit.products
    .filter((product) => product.source_row_count > 1)
    .map((product) => ({
      canonical_product_name: product.canonical_product_name,
      canonical_product_key: product.canonical_product_key,
      source_row_count: product.source_row_count,
      source_models: product.source_rows.map((row) => row.model),
    }))

  const missingRrp = canonicalProducts
    .filter((product) => !productHasRrp(product))
    .map((product) => product.canonical_product_name)

  const missingManufactureYear = canonicalProducts
    .filter((product) => !productHasBaselineYear(product))
    .map((product) => product.canonical_product_name)

  const missingImages = canonicalProducts
    .filter((product) => !product.image_url && !product.image_storage_path)
    .map((product) => product.canonical_product_name)

  const needsManualReview = audit.products
    .filter((product) => product.status === PRODUCT_STATUS.NEEDS_REVIEW)
    .map((product) => ({
      canonical_product_name: product.canonical_product_name,
      canonical_product_key: product.canonical_product_key,
      review_reasons: product.review_reasons,
      source_models: product.source_rows.map((row) => row.model),
    }))

  const valuationReady = canonicalProducts.filter((product) => (
    productHasRrp(product) && productHasBaselineYear(product)
  ))
  const valuationIncomplete = canonicalProducts.filter((product) => (
    !productHasRrp(product) || !productHasBaselineYear(product)
  ))

  const top100Eligibility = projectTop100EligibilityAfterImport({
    brand,
    auditProducts: audit.products,
    existingApprovedProducts,
    activeBrands,
  })

  return {
    brand,
    planned_import: plannedImport,
    catalogue_source: catalogueSource,
    raw_intelligence: {
      count: intelligenceRows.length,
      rows: intelligenceRows.map((row) => ({
        model: row.model,
        series: row.series ?? null,
        equipment_type: row.equipment_type ?? null,
        slug: row.slug ?? null,
        original_rrp: row.original_rrp ?? row.best_original_price ?? null,
        baseline_manufacture_year: row.baseline_manufacture_year ?? null,
      })),
    },
    canonical_products: {
      count: audit.suggested_canonical_products,
      duplicates_collapsed: audit.duplicate_rows_collapsed,
      products: canonicalProducts.map((product) => ({
        canonical_product_name: product.canonical_product_name,
        canonical_product_key: product.canonical_product_key,
        equipment_type: product.equipment_type,
        status: product.status,
        original_base_price: product.original_base_price,
        baseline_manufacture_year: product.baseline_manufacture_year,
      })),
    },
    duplicates_merged: duplicatesMerged,
    missing_rrps: missingRrp,
    missing_manufacture_years: missingManufactureYear,
    missing_images: {
      count: missingImages.length,
      products: missingImages,
    },
    equipment_type_repairs: typeRepairs,
    products_needing_manual_review: needsManualReview,
    workflow_summary: {
      safe_approvals: workflow.safe_approvals,
      single_source_approvals: workflow.single_source_approvals,
      merge_clusters: workflow.merge_clusters,
      ambiguous_products: workflow.ambiguous_products,
    },
    valuation_ready: {
      complete: valuationReady.length,
      incomplete: valuationIncomplete.length,
      complete_products: valuationReady.map((product) => product.canonical_product_name),
      incomplete_products: valuationIncomplete.map((product) => product.canonical_product_name),
    },
    top100_eligibility: top100Eligibility,
  }
}

export function printBrandOnboardReport(report) {
  console.log(`\n${'='.repeat(72)}`)
  console.log(`Brand: ${report.brand}${report.planned_import ? ' (planned catalogue import)' : ''}`)
  console.log(`${'='.repeat(72)}`)
  if (report.catalogue_source) {
    console.log(`Catalogue source: ${report.catalogue_source}`)
  }
  console.log(`Raw intelligence rows:          ${report.raw_intelligence.count}`)
  console.log(`Canonical products:             ${report.canonical_products.count}`)
  console.log(`Duplicates collapsed:           ${report.canonical_products.duplicates_collapsed}`)
  console.log(`Duplicates merged (groups):     ${report.duplicates_merged.length}`)
  console.log(`Missing RRPs:                   ${report.missing_rrps.length}`)
  console.log(`Missing manufacture years:        ${report.missing_manufacture_years.length}`)
  console.log(`Missing images:                 ${report.missing_images.count}`)
  console.log(`Equipment type repairs needed:  ${report.equipment_type_repairs.length}`)
  console.log(`Manual review required:         ${report.products_needing_manual_review.length}`)
  console.log(`Valuation-ready products:       ${report.valuation_ready.complete}`)
  console.log(`Valuation incomplete:           ${report.valuation_ready.incomplete}`)
  console.log(`Safe auto-approvals:            ${report.workflow_summary.safe_approvals}`)
  console.log(`Single-source approvals:        ${report.workflow_summary.single_source_approvals}`)
  if (report.top100_eligibility) {
    console.log(`Top 100 eligible (brand):       ${report.top100_eligibility.brand_eligible_count}`)
    console.log(`Top 100 display rows (brand):   ${report.top100_eligibility.brand_in_top100_count}`)
    console.log(`Global incomplete candidates:   ${report.top100_eligibility.global_incomplete_candidates}`)
  }

  if (report.duplicates_merged.length) {
    console.log('\nDuplicates merged:')
    for (const group of report.duplicates_merged.slice(0, 10)) {
      console.log(`  - ${group.canonical_product_name} (${group.source_row_count} rows)`)
      console.log(`    models: ${group.source_models.join(' · ')}`)
    }
  }

  if (report.missing_rrps.length) {
    console.log('\nMissing RRP:')
    for (const name of report.missing_rrps.slice(0, 15)) {
      console.log(`  - ${name}`)
    }
    if (report.missing_rrps.length > 15) {
      console.log(`  ...and ${report.missing_rrps.length - 15} more`)
    }
  }

  if (report.missing_manufacture_years.length) {
    console.log('\nMissing manufacture year:')
    for (const name of report.missing_manufacture_years.slice(0, 15)) {
      console.log(`  - ${name}`)
    }
    if (report.missing_manufacture_years.length > 15) {
      console.log(`  ...and ${report.missing_manufacture_years.length - 15} more`)
    }
  }

  if (report.equipment_type_repairs.length) {
    console.log('\nEquipment type repairs (intelligence):')
    for (const repair of report.equipment_type_repairs.slice(0, 15)) {
      console.log(`  - ${repair.model}: ${repair.before ?? '—'} -> ${repair.after}`)
    }
    if (report.equipment_type_repairs.length > 15) {
      console.log(`  ...and ${report.equipment_type_repairs.length - 15} more`)
    }
  }

  if (report.products_needing_manual_review.length) {
    console.log('\nProducts needing manual review:')
    for (const product of report.products_needing_manual_review.slice(0, 15)) {
      console.log(`  - ${product.canonical_product_name}`)
      console.log(`    reasons: ${product.review_reasons.join('; ')}`)
    }
    if (report.products_needing_manual_review.length > 15) {
      console.log(`  ...and ${report.products_needing_manual_review.length - 15} more`)
    }
  }

  if (report.top100_eligibility?.brand_in_top100?.length) {
    console.log('\nTop 100 display ranks (brand):')
    for (const entry of report.top100_eligibility.brand_in_top100.slice(0, 12)) {
      console.log(`  - #${entry.rank} ${entry.canonical_product_name}`)
    }
    if (report.top100_eligibility.brand_in_top100.length > 12) {
      console.log(`  ...and ${report.top100_eligibility.brand_in_top100.length - 12} more`)
    }
  }

  if (report.canonical_products.products.length) {
    console.log('\nCanonical product examples:')
    for (const product of report.canonical_products.products.slice(0, 8)) {
      console.log(`  - ${product.canonical_product_name}`)
      console.log(`    key: ${product.canonical_product_key}`)
      console.log(`    type: ${product.equipment_type ?? '—'} | RRP: ${product.original_base_price ?? '—'} | year: ${product.baseline_manufacture_year ?? '—'}`)
    }
  }
}
