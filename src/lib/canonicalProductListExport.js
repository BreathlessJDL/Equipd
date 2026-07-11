import { formatCanonicalProductCompletionLabel } from './equipmentResearchQueue.js'
import { deriveEquipmentProductBaselineSource } from './lifeFitnessSeriesBaselines.js'

function buildCanonicalProductPagePath(canonicalProductKey) {
  const key = String(canonicalProductKey ?? '').trim()
  if (!key) return null
  return `/equipment/${encodeURIComponent(key)}`
}

export const CANONICAL_PRODUCT_EXPORT_COLUMNS = [
  { key: 'rank', header: 'Rank', width: 8 },
  { key: 'canonicalProductName', header: 'Canonical product', width: 42 },
  { key: 'brand', header: 'Brand', width: 18 },
  { key: 'productFamily', header: 'Product family', width: 22 },
  { key: 'model', header: 'Model', width: 20 },
  { key: 'equipmentType', header: 'Equipment type', width: 18 },
  { key: 'canonicalProductKey', header: 'Canonical product key', width: 36 },
  { key: 'sourceRowCount', header: 'Source rows', width: 12 },
  { key: 'basePrice', header: 'Base price', width: 14 },
  { key: 'basePriceCurrency', header: 'Currency', width: 10 },
  { key: 'priceConfidence', header: 'Price confidence', width: 16 },
  { key: 'priceStatus', header: 'Price status', width: 14 },
  { key: 'baselineYear', header: 'Baseline year', width: 14 },
  { key: 'baselineSource', header: 'Baseline source', width: 18 },
  { key: 'productionStartYear', header: 'Production start', width: 16 },
  { key: 'productionEndYear', header: 'Production end', width: 16 },
  { key: 'lifecycleStatus', header: 'Lifecycle status', width: 16 },
  { key: 'completion', header: 'Completion', width: 16 },
  { key: 'completionReason', header: 'Completion notes', width: 48 },
  { key: 'status', header: 'Status', width: 14 },
  { key: 'productPageUrl', header: 'Product page URL', width: 48 },
]

function formatExportStatusLabel(status) {
  if (status === 'verified') return 'Verified'
  if (status === 'converted') return 'Converted from USD'
  if (status === 'needs_review') return 'Needs review'
  return 'Missing'
}

function formatExportValue(value) {
  if (value == null || value === '') return ''
  return value
}

function formatBasePrice(group) {
  if (group?.best_original_price == null) return ''
  const currency = (group.best_original_price_currency || 'GBP').toUpperCase()
  return Number(group.best_original_price)
}

export function buildCanonicalProductExportRows(groups = [], { origin = '' } = {}) {
  return groups.map((group) => {
    const product = group.product ?? {}
    const baselineSource = deriveEquipmentProductBaselineSource(product)
    const canonicalProductKey = product.canonical_product_key ?? ''
    const productPagePath = canonicalProductKey
      ? buildCanonicalProductPagePath(canonicalProductKey)
      : ''
    const productPageUrl = productPagePath && origin
      ? `${origin.replace(/\/$/, '')}${productPagePath}`
      : productPagePath

    return {
      rank: group.rank ?? '',
      canonicalProductName: group.primary_keyword || group.label || product.canonical_product_name || '',
      brand: product.brand ?? '',
      productFamily: product.product_family ?? '',
      model: product.model ?? '',
      equipmentType: product.equipment_type ?? '',
      canonicalProductKey,
      sourceRowCount: group.member_count ?? product.source_intelligence_row_ids?.length ?? 0,
      basePrice: formatBasePrice(group),
      basePriceCurrency: group.best_original_price != null
        ? (group.best_original_price_currency || 'GBP').toUpperCase()
        : '',
      priceConfidence: product.original_price_confidence ?? group.best_original_price_confidence ?? '',
      priceStatus: formatExportStatusLabel(group.priceStatus),
      baselineYear: group.baseline_manufacture_year ?? product.baseline_manufacture_year ?? '',
      baselineSource: baselineSource.label,
      productionStartYear: group.manufacture_start_year ?? product.production_start_year ?? '',
      productionEndYear: group.manufacture_end_year ?? product.production_end_year ?? '',
      lifecycleStatus: formatExportStatusLabel(group.lifecycleStatus),
      completion: group.completionLabel ?? formatCanonicalProductCompletionLabel(group.completionStatus),
      completionReason: group.completionReason ?? '',
      status: group.productStatus ?? product.status ?? '',
      productPageUrl,
    }
  })
}

function buildExportFilename({ prefix = 'equipd-canonical-products-top-100', date = new Date() } = {}) {
  const stamp = date.toISOString().slice(0, 10)
  return `${prefix}-${stamp}.xlsx`
}

export async function buildCanonicalProductExportWorkbook(groups = [], options = {}) {
  const { default: ExcelJS } = await import('exceljs')
  const rows = buildCanonicalProductExportRows(groups, options)
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'Equipd'
  workbook.created = new Date()

  const worksheet = workbook.addWorksheet('Canonical products', {
    views: [{ state: 'frozen', ySplit: 1 }],
  })

  worksheet.columns = CANONICAL_PRODUCT_EXPORT_COLUMNS.map((column) => ({
    header: column.header,
    key: column.key,
    width: column.width,
  }))

  const headerRow = worksheet.getRow(1)
  headerRow.font = { bold: true }
  headerRow.alignment = { vertical: 'middle' }

  for (const row of rows) {
    const values = {}
    for (const column of CANONICAL_PRODUCT_EXPORT_COLUMNS) {
      values[column.key] = formatExportValue(row[column.key])
    }
    worksheet.addRow(values)
  }

  worksheet.autoFilter = {
    from: 'A1',
    to: `${String.fromCharCode(64 + CANONICAL_PRODUCT_EXPORT_COLUMNS.length)}1`,
  }

  return workbook
}

export async function exportCanonicalProductListSpreadsheet(groups = [], options = {}) {
  const workbook = await buildCanonicalProductExportWorkbook(groups, options)
  const buffer = await workbook.xlsx.writeBuffer()
  const filename = options.filename ?? buildExportFilename(options)
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })

  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)

  return {
    filename,
    rowCount: groups.length,
  }
}

export { buildExportFilename as buildCanonicalProductExportFilename }
