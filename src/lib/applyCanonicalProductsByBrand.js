/**
 * Shared canonical product promotion for CLI and CSV import.
 *
 * Applies the same audit/grouping rules to one or more brands and upserts
 * rows into equipment_products. Never auto-approves when approveSafe is false.
 */

import {
  buildBrandCanonicalWorkflowReport,
  buildCanonicalProductAuditReport,
  buildCanonicalProductAuditPayload,
  PRODUCT_STATUS,
  summariseSourceYearFields,
  summarizeEquipmentProductCounts,
} from './intelligenceCanonicalProducts.js'

export const CANONICAL_APPLY_BRAND_ALIASES = {
  Matrix: 'Matrix Fitness',
  'Matrix Fitness': 'Matrix Fitness',
  'Star Trac': 'Star Trac',
}

export const INTELLIGENCE_CANONICAL_APPLY_FIELDS = [
  'id',
  'brand',
  'series',
  'model',
  'equipment_type',
  'slug',
  'product_family',
  'original_rrp',
  'currency',
  'confidence',
  'manufacture_year',
  'best_original_price',
  'best_original_price_confidence',
  'best_original_price_currency',
  'baseline_manufacture_year',
  'manufacture_start_year',
  'manufacture_end_year',
  'variant_name',
  'core_product_group_status',
  'core_product_group_confidence',
].join(', ')

export const EQUIPMENT_PRODUCT_APPLY_FIELDS = [
  'id',
  'brand',
  'product_family',
  'model',
  'equipment_type',
  'canonical_product_name',
  'canonical_product_key',
  'source_intelligence_row_ids',
  'status',
  'original_base_price',
  'original_base_price_currency',
  'original_price_confidence',
  'original_price_source',
  'baseline_manufacture_year',
  'production_start_year',
  'production_end_year',
  'review_notes',
].join(', ')

export function brandsFromValidatedImportRows(validatedRows = []) {
  const brands = new Set()
  for (const row of validatedRows) {
    const brand = String(row?.normalised?.brand ?? row?.brand ?? '').trim()
    if (brand) brands.add(resolveCanonicalApplyBrandName(brand))
  }
  return [...brands].sort((left, right) => left.localeCompare(right))
}

export function resolveCanonicalApplyBrandName(brand, availableBrands = []) {
  const trimmed = String(brand ?? '').trim()
  if (!trimmed) return trimmed
  if (CANONICAL_APPLY_BRAND_ALIASES[trimmed]) return CANONICAL_APPLY_BRAND_ALIASES[trimmed]
  const exact = availableBrands.find((entry) => entry.toLowerCase() === trimmed.toLowerCase())
  return exact || trimmed
}

/** Candidate keys that may exist from pre-plus slugification. */
export function deriveLegacyPlusKeyCandidates(canonicalProductKey) {
  const key = String(canonicalProductKey ?? '').trim()
  if (!key) return []
  if (!key.includes('-plus-') && !key.endsWith('-plus')) return []

  const candidates = new Set()
  const withoutEmbedded = key.replace(/-plus-/g, '-')
  if (withoutEmbedded !== key) candidates.add(withoutEmbedded)
  const withoutSuffix = key.replace(/-plus$/g, '')
  if (withoutSuffix !== key) candidates.add(withoutSuffix)
  return [...candidates].filter(Boolean)
}

/**
 * Detect when applying would insert plus-keyed products while legacy (pre-plus)
 * keys already exist for the same brand — risk of duplicates.
 */
export function detectLegacyPlusKeyRisk({
  auditProducts = [],
  existingProducts = [],
} = {}) {
  const existingByKey = new Map(
    existingProducts
      .filter((product) => product?.canonical_product_key)
      .map((product) => [product.canonical_product_key, product]),
  )

  const collisions = []
  for (const product of auditProducts) {
    const nextKey = product?.canonical_product_key
    if (!nextKey) continue
    if (existingByKey.has(nextKey)) continue

    for (const legacyKey of deriveLegacyPlusKeyCandidates(nextKey)) {
      const legacy = existingByKey.get(legacyKey)
      if (!legacy) continue
      collisions.push({
        proposedKey: nextKey,
        legacyKey,
        proposedName: product.canonical_product_name,
        legacyName: legacy.canonical_product_name,
      })
    }
  }

  return {
    hasRisk: collisions.length > 0,
    collisions,
    warning: collisions.length
      ? `Legacy plus-key risk: ${collisions.length} proposed key(s) would create duplicates alongside pre-plus keys. Promotion skipped for this brand; run a dedicated key migration before re-applying.`
      : null,
  }
}

export async function fetchIntelligenceRowsForCanonicalApply(supabase, brandFilter) {
  const pageSize = 1000
  let from = 0
  const rows = []

  while (true) {
    let query = supabase
      .from('equipment_intelligence')
      .select(INTELLIGENCE_CANONICAL_APPLY_FIELDS)
      .order('brand')
      .order('model')
      .range(from, from + pageSize - 1)

    if (brandFilter) {
      query = query.ilike('brand', brandFilter)
    }

    const { data, error } = await query
    if (error) throw error
    if (!data?.length) break

    rows.push(...data)
    if (data.length < pageSize) break
    from += pageSize
  }

  return rows
}

export async function fetchEquipmentProductsForCanonicalApply(supabase, brandFilter) {
  const pageSize = 1000
  let from = 0
  const rows = []

  while (true) {
    let query = supabase
      .from('equipment_products')
      .select(EQUIPMENT_PRODUCT_APPLY_FIELDS)
      .order('canonical_product_name')
      .range(from, from + pageSize - 1)

    if (brandFilter) {
      query = query.ilike('brand', brandFilter)
    }

    const { data, error } = await query
    if (error) throw error
    if (!data?.length) break

    rows.push(...data)
    if (data.length < pageSize) break
    from += pageSize
  }

  return rows
}

/**
 * Direct table upsert used by the CLI (service role). Preserves approved /
 * excluded rows and only fills missing price/year fields on update.
 */
export async function upsertCanonicalProductDirect(supabase, product) {
  const { data: existing, error: existingError } = await supabase
    .from('equipment_products')
    .select('id, status, source_intelligence_row_ids, original_base_price, original_price_confidence, baseline_manufacture_year, production_start_year, production_end_year, review_notes')
    .eq('canonical_product_key', product.canonical_product_key)
    .maybeSingle()

  if (existingError) {
    return { action: null, product: null, error: existingError }
  }

  const mergedIds = [
    ...new Set([
      ...(existing?.source_intelligence_row_ids ?? []),
      ...(product.source_intelligence_row_ids ?? []),
    ]),
  ]

  if (existing?.status === PRODUCT_STATUS.APPROVED) {
    const { data, error } = await supabase
      .from('equipment_products')
      .update({ source_intelligence_row_ids: mergedIds })
      .eq('id', existing.id)
      .select(EQUIPMENT_PRODUCT_APPLY_FIELDS)
      .maybeSingle()
    return { action: 'updated', product: data, error }
  }

  const reviewNotes = product.review_reasons?.length
    ? product.review_reasons.join('; ')
    : null

  const row = {
    brand: product.brand,
    product_family: product.product_family || null,
    model: product.model,
    equipment_type: product.equipment_type || null,
    canonical_product_name: product.canonical_product_name,
    canonical_product_key: product.canonical_product_key,
    baseline_manufacture_year: product.baseline_manufacture_year ?? null,
    production_start_year: product.production_start_year ?? null,
    production_end_year: product.production_end_year ?? null,
    original_base_price: product.original_base_price ?? null,
    original_base_price_currency: product.original_base_price_currency ?? 'GBP',
    original_price_confidence: product.original_price_confidence ?? null,
    lifecycle_confidence: null,
    source_intelligence_row_ids: mergedIds,
    status: existing?.status === PRODUCT_STATUS.EXCLUDED
      ? PRODUCT_STATUS.EXCLUDED
      : (product.status ?? PRODUCT_STATUS.PENDING),
    review_notes: reviewNotes,
  }

  if (existing?.id) {
    const { data, error } = await supabase
      .from('equipment_products')
      .update({
        source_intelligence_row_ids: mergedIds,
        status: existing.status === PRODUCT_STATUS.EXCLUDED ? PRODUCT_STATUS.EXCLUDED : row.status,
        review_notes: reviewNotes ?? existing.review_notes,
        baseline_manufacture_year: existing.baseline_manufacture_year ?? row.baseline_manufacture_year,
        production_start_year: existing.production_start_year ?? row.production_start_year,
        production_end_year: existing.production_end_year ?? row.production_end_year,
        original_base_price: existing.original_base_price ?? row.original_base_price,
        original_price_confidence: existing.original_price_confidence ?? row.original_price_confidence,
      })
      .eq('id', existing.id)
      .select(EQUIPMENT_PRODUCT_APPLY_FIELDS)
      .maybeSingle()
    return { action: 'updated', product: data, error }
  }

  const { data, error } = await supabase
    .from('equipment_products')
    .insert(row)
    .select(EQUIPMENT_PRODUCT_APPLY_FIELDS)
    .maybeSingle()

  return { action: 'inserted', product: data, error }
}

/**
 * Browser/admin RPC upsert via admin_upsert_equipment_product_audit.
 * Tracks insert vs update by looking up the key first.
 */
export async function upsertCanonicalProductViaAuditRpc(supabase, product, {
  upsertRpc,
} = {}) {
  if (typeof upsertRpc !== 'function') {
    throw new Error('upsertRpc is required for audit RPC upserts.')
  }

  const { data: existing, error: existingError } = await supabase
    .from('equipment_products')
    .select('id, status, canonical_product_key')
    .eq('canonical_product_key', product.canonical_product_key)
    .maybeSingle()

  if (existingError) {
    return { action: null, product: null, error: existingError }
  }

  const result = await upsertRpc(product)
  if (result.error) {
    return { action: null, product: null, error: result.error }
  }

  return {
    action: existing?.id ? 'updated' : 'inserted',
    product: result.data ?? null,
    error: null,
    existedApproved: existing?.status === PRODUCT_STATUS.APPROVED,
  }
}

function emptyYearStats(extra = {}) {
  return {
    sourceRowsWithManufactureYear: 0,
    sourceRowsWithVerifiedBaseline: 0,
    sourceRowsWithoutVerifiedBaseline: 0,
    canonicalBaselinesPopulated: 0,
    canonicalBaselinesLeftBlank: 0,
    existingBaselinesPreserved: 0,
    allowManufactureYearAsBaseline: false,
    ...extra,
  }
}

function emptyBrandResult(brand, extra = {}) {
  return {
    brand,
    skipped: false,
    sourceRowCount: 0,
    suggestedCanonicalProducts: 0,
    canonicalProductCount: 0,
    productsInserted: 0,
    productsUpdated: 0,
    productsFailed: 0,
    pending: 0,
    needsReview: 0,
    approved: 0,
    excluded: 0,
    duplicateRowsCollapsed: 0,
    ambiguous: 0,
    warnings: [],
    errors: [],
    countNote: null,
    yearStats: emptyYearStats(),
    ...extra,
  }
}

function tallyYearOutcome(yearStats, { existingYear, proposedYear, action }) {
  const hadExisting = existingYear != null
  const proposed = proposedYear ?? null

  if (hadExisting) {
    yearStats.existingBaselinesPreserved += 1
    return
  }

  if (proposed != null && (action === 'inserted' || action === 'updated')) {
    yearStats.canonicalBaselinesPopulated += 1
    return
  }

  yearStats.canonicalBaselinesLeftBlank += 1
}

/**
 * Apply canonical upserts for one brand.
 *
 * Note: approveSafe / repair / rebuildNames are intentionally ignored here.
 * Those operational steps remain CLI-only (see apply-canonical-products-by-brand.mjs).
 * Automatic CSV import must always call with:
 *   apply: true, allowManufactureYearAsBaseline: false
 */
export async function applyCanonicalProductsForBrand(supabase, brand, {
  apply = true,
  allowPlusKeyRisk = false,
  allowManufactureYearAsBaseline = false,
  upsertProduct = null,
  onProgress = null,
} = {}) {
  const resolvedBrand = resolveCanonicalApplyBrandName(brand)
  onProgress?.({ brand: resolvedBrand, phase: 'loading' })

  const [intelligenceRows, equipmentProducts] = await Promise.all([
    fetchIntelligenceRowsForCanonicalApply(supabase, resolvedBrand),
    fetchEquipmentProductsForCanonicalApply(supabase, resolvedBrand),
  ])

  const sourceYearStats = summariseSourceYearFields(intelligenceRows)
  const yearStats = emptyYearStats({
    sourceRowsWithManufactureYear: sourceYearStats.withManufactureYear,
    sourceRowsWithVerifiedBaseline: sourceYearStats.withVerifiedBaseline,
    sourceRowsWithoutVerifiedBaseline: sourceYearStats.withoutVerifiedBaseline,
    allowManufactureYearAsBaseline: Boolean(allowManufactureYearAsBaseline),
  })

  const audit = buildCanonicalProductAuditReport(intelligenceRows, {
    brandFilter: resolvedBrand,
    allowManufactureYearAsBaseline,
  })
  const workflow = buildBrandCanonicalWorkflowReport(audit, {
    equipmentProducts,
    intelligenceRows,
  })

  const plusRisk = detectLegacyPlusKeyRisk({
    auditProducts: audit.products,
    existingProducts: equipmentProducts,
  })

  const yearWarning = (!allowManufactureYearAsBaseline
    && sourceYearStats.withManufactureYear > 0
    && sourceYearStats.withoutVerifiedBaseline > 0)
    ? `${sourceYearStats.withManufactureYear} source row(s) included a manufacture year, but ${sourceYearStats.withoutVerifiedBaseline} did not include a verified first-release year. Their canonical baseline manufacture year was left unchanged or blank for review.`
    : null

  if (plusRisk.hasRisk && !allowPlusKeyRisk) {
    return emptyBrandResult(resolvedBrand, {
      skipped: true,
      sourceRowCount: intelligenceRows.length,
      suggestedCanonicalProducts: audit.suggested_canonical_products ?? audit.products.length,
      canonicalProductCount: equipmentProducts.length,
      duplicateRowsCollapsed: workflow.duplicate_rows_collapsed ?? 0,
      ambiguous: workflow.ambiguous_products ?? 0,
      warnings: [
        ...(yearWarning ? [yearWarning] : []),
        plusRisk.warning,
        ...plusRisk.collisions.slice(0, 5).map((collision) => (
          `${collision.proposedName}: proposed key "${collision.proposedKey}" vs legacy "${collision.legacyKey}"`
        )),
      ],
      plusKeyRisk: plusRisk,
      workflow,
      yearStats,
      countNote: explainSourceCanonicalCountDelta({
        sourceRowCount: intelligenceRows.length,
        canonicalCount: equipmentProducts.length,
        suggestedCanonicalProducts: audit.suggested_canonical_products ?? audit.products.length,
        duplicateRowsCollapsed: workflow.duplicate_rows_collapsed ?? 0,
        ambiguous: workflow.ambiguous_products ?? 0,
        skipped: true,
      }),
    })
  }

  const suggested = audit.suggested_canonical_products ?? audit.products.length
  const result = emptyBrandResult(resolvedBrand, {
    sourceRowCount: intelligenceRows.length,
    suggestedCanonicalProducts: suggested,
    duplicateRowsCollapsed: workflow.duplicate_rows_collapsed ?? 0,
    ambiguous: workflow.ambiguous_products ?? 0,
    workflow,
    yearStats,
    warnings: [
      ...(yearWarning ? [yearWarning] : []),
      ...(plusRisk.hasRisk
        ? [`Plus-key risk override enabled for ${resolvedBrand}.`, plusRisk.warning]
        : []),
      ...(allowManufactureYearAsBaseline
        ? [`UNSAFE: manufacture_year may be used as baseline for ${resolvedBrand}.`]
        : []),
    ],
  })

  if (!apply) {
    const counts = summarizeEquipmentProductCounts(equipmentProducts)
    result.pending = counts.pending
    result.needsReview = counts.needs_review
    result.approved = counts.approved
    result.excluded = counts.excluded
    result.canonicalProductCount = equipmentProducts.length
    for (const product of audit.products) {
      const existing = equipmentProducts.find(
        (entry) => entry.canonical_product_key === product.canonical_product_key,
      )
      tallyYearOutcome(result.yearStats, {
        existingYear: existing?.baseline_manufacture_year,
        proposedYear: product.baseline_manufacture_year,
        action: existing ? 'updated' : 'inserted',
      })
    }
    result.countNote = explainSourceCanonicalCountDelta({
      sourceRowCount: intelligenceRows.length,
      canonicalCount: equipmentProducts.length,
      suggestedCanonicalProducts: suggested,
      duplicateRowsCollapsed: result.duplicateRowsCollapsed,
      ambiguous: result.ambiguous,
    })
    return result
  }

  const upsert = typeof upsertProduct === 'function'
    ? upsertProduct
    : (product) => upsertCanonicalProductDirect(supabase, product)

  const existingByKey = new Map(
    equipmentProducts
      .filter((product) => product?.canonical_product_key)
      .map((product) => [product.canonical_product_key, product]),
  )

  onProgress?.({
    brand: resolvedBrand,
    phase: 'upserting',
    total: audit.products.length,
    completed: 0,
  })

  for (let index = 0; index < audit.products.length; index += 1) {
    const product = audit.products[index]
    const existingBefore = existingByKey.get(product.canonical_product_key)
    const upsertResult = await upsert(product)
    if (upsertResult.error) {
      result.productsFailed += 1
      result.errors.push({
        key: product.canonical_product_key,
        message: upsertResult.error.message || String(upsertResult.error),
      })
    } else if (upsertResult.action === 'inserted') {
      result.productsInserted += 1
      tallyYearOutcome(result.yearStats, {
        existingYear: existingBefore?.baseline_manufacture_year,
        proposedYear: product.baseline_manufacture_year,
        action: 'inserted',
      })
    } else {
      result.productsUpdated += 1
      tallyYearOutcome(result.yearStats, {
        existingYear: existingBefore?.baseline_manufacture_year,
        proposedYear: product.baseline_manufacture_year,
        action: 'updated',
      })
    }

    if (index % 10 === 0 || index === audit.products.length - 1) {
      onProgress?.({
        brand: resolvedBrand,
        phase: 'upserting',
        total: audit.products.length,
        completed: index + 1,
      })
    }
  }

  const finalProducts = await fetchEquipmentProductsForCanonicalApply(supabase, resolvedBrand)
  const counts = summarizeEquipmentProductCounts(finalProducts)
  result.pending = counts.pending
  result.needsReview = counts.needs_review
  result.approved = counts.approved
  result.excluded = counts.excluded
  result.canonicalProductCount = finalProducts.length
  result.countNote = explainSourceCanonicalCountDelta({
    sourceRowCount: intelligenceRows.length,
    canonicalCount: finalProducts.length,
    suggestedCanonicalProducts: suggested,
    duplicateRowsCollapsed: result.duplicateRowsCollapsed,
    ambiguous: result.ambiguous,
  })

  return result
}

export function explainSourceCanonicalCountDelta({
  sourceRowCount = 0,
  canonicalCount = 0,
  suggestedCanonicalProducts = 0,
  duplicateRowsCollapsed = 0,
  ambiguous = 0,
  skipped = false,
} = {}) {
  if (skipped) {
    return 'Promotion skipped for this brand; existing canonical count is unchanged.'
  }
  if (sourceRowCount === canonicalCount && duplicateRowsCollapsed === 0) {
    return null
  }
  if (sourceRowCount === suggestedCanonicalProducts && suggestedCanonicalProducts === canonicalCount) {
    return null
  }
  const parts = []
  if (duplicateRowsCollapsed > 0) {
    parts.push(`${duplicateRowsCollapsed} source row(s) collapsed into fewer canonical products (legitimate duplicate reduction)`)
  }
  if (ambiguous > 0) {
    parts.push(`${ambiguous} ambiguous product group(s) need review`)
  }
  if (suggestedCanonicalProducts !== canonicalCount) {
    parts.push(
      `suggested ${suggestedCanonicalProducts} canonical product(s) vs ${canonicalCount} existing after apply`,
    )
  } else if (sourceRowCount !== canonicalCount) {
    parts.push(
      `${sourceRowCount} source row(s) map to ${canonicalCount} canonical product(s)`,
    )
  }
  return parts.length ? parts.join('; ') : null
}

/**
 * Promote one or more brands into equipment_products.
 *
 * Automatic CSV import should call with:
 *   { apply: true, allowManufactureYearAsBaseline: false }
 */
export async function applyCanonicalProductsForBrands({
  brands = [],
  supabase,
  apply = true,
  approveSafe = false,
  repair = false,
  rebuildNames = false,
  allowPlusKeyRisk = false,
  allowManufactureYearAsBaseline = false,
  upsertProduct = null,
  onProgress = null,
} = {}) {
  if (!supabase) {
    throw new Error('supabase client is required.')
  }

  // Automatic import and shared apply never approve, repair, or rebuild names.
  // Those remain CLI-only operational steps.
  if (approveSafe || repair || rebuildNames) {
    throw new Error(
      'approveSafe, repair, and rebuildNames are not supported by applyCanonicalProductsForBrands. Use the CLI script for those operations.',
    )
  }

  const uniqueBrands = [...new Set(
    (brands ?? [])
      .map((brand) => resolveCanonicalApplyBrandName(brand))
      .filter(Boolean),
  )].sort((left, right) => left.localeCompare(right))

  const brandResults = []
  for (const brand of uniqueBrands) {
    onProgress?.({ brand, phase: 'brand-start', brandsTotal: uniqueBrands.length, brandsCompleted: brandResults.length })
    const brandResult = await applyCanonicalProductsForBrand(supabase, brand, {
      apply,
      allowPlusKeyRisk,
      allowManufactureYearAsBaseline,
      upsertProduct,
      onProgress,
    })
    brandResults.push(brandResult)
    onProgress?.({
      brand,
      phase: 'brand-complete',
      brandsTotal: uniqueBrands.length,
      brandsCompleted: brandResults.length,
      brandResult,
    })
  }

  return summariseCanonicalPromotionResults(brandResults)
}

export function summariseCanonicalPromotionResults(brandResults = []) {
  const summary = {
    brands: brandResults.map((result) => result.brand),
    brandsProcessed: brandResults.filter((result) => !result.skipped).length,
    brandsSkipped: brandResults.filter((result) => result.skipped).length,
    sourceRowCount: 0,
    canonicalProductCount: 0,
    suggestedCanonicalProducts: 0,
    productsInserted: 0,
    productsUpdated: 0,
    productsFailed: 0,
    pending: 0,
    needsReview: 0,
    approved: 0,
    excluded: 0,
    duplicateRowsCollapsed: 0,
    ambiguous: 0,
    warnings: [],
    errors: [],
    countNotes: [],
    yearStats: emptyYearStats(),
    brandResults,
    ok: true,
  }

  for (const result of brandResults) {
    summary.sourceRowCount += result.sourceRowCount || 0
    summary.canonicalProductCount += result.canonicalProductCount || 0
    summary.suggestedCanonicalProducts += result.suggestedCanonicalProducts || 0
    summary.productsInserted += result.productsInserted || 0
    summary.productsUpdated += result.productsUpdated || 0
    summary.productsFailed += result.productsFailed || 0
    summary.pending += result.pending || 0
    summary.needsReview += result.needsReview || 0
    summary.approved += result.approved || 0
    summary.excluded += result.excluded || 0
    summary.duplicateRowsCollapsed += result.duplicateRowsCollapsed || 0
    summary.ambiguous += result.ambiguous || 0
    summary.warnings.push(...(result.warnings ?? []))
    summary.errors.push(...(result.errors ?? []))
    if (result.countNote) {
      summary.countNotes.push(`${result.brand}: ${result.countNote}`)
    }

    const years = result.yearStats ?? emptyYearStats()
    summary.yearStats.sourceRowsWithManufactureYear += years.sourceRowsWithManufactureYear || 0
    summary.yearStats.sourceRowsWithVerifiedBaseline += years.sourceRowsWithVerifiedBaseline || 0
    summary.yearStats.sourceRowsWithoutVerifiedBaseline += years.sourceRowsWithoutVerifiedBaseline || 0
    summary.yearStats.canonicalBaselinesPopulated += years.canonicalBaselinesPopulated || 0
    summary.yearStats.canonicalBaselinesLeftBlank += years.canonicalBaselinesLeftBlank || 0
    summary.yearStats.existingBaselinesPreserved += years.existingBaselinesPreserved || 0
    if (years.allowManufactureYearAsBaseline) {
      summary.yearStats.allowManufactureYearAsBaseline = true
    }
  }

  summary.ok = summary.productsFailed === 0 && summary.errors.length === 0
  summary.hasWarnings = summary.warnings.length > 0 || summary.brandsSkipped > 0
  return summary
}

export function buildImportYearPromotionWarning(yearStats = emptyYearStats(), {
  allowManufactureYearAsBaseline = false,
} = {}) {
  if (allowManufactureYearAsBaseline || yearStats.allowManufactureYearAsBaseline) {
    return null
  }
  const withManufacture = yearStats.sourceRowsWithManufactureYear || 0
  const withoutVerified = yearStats.sourceRowsWithoutVerifiedBaseline || 0
  if (withManufacture <= 0 || withoutVerified <= 0) return null
  return (
    `${withManufacture} source row(s) included a manufacture year, but ${withoutVerified} did not include a verified first-release year. Their canonical baseline manufacture year was left unchanged or blank for review.`
  )
}

export function buildProductsPathForImportedBrands(brands = []) {
  const unique = [...new Set((brands ?? []).filter(Boolean))]
  if (unique.length === 1) {
    return `/admin/intelligence/products?brand=${encodeURIComponent(unique[0])}`
  }
  if (unique.length > 1 && unique.length <= 3) {
    return `/admin/intelligence/products?search=${encodeURIComponent(unique.join(' '))}`
  }
  return '/admin/intelligence/products'
}

export { buildCanonicalProductAuditPayload }
