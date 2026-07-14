import { isSupabaseConfigured, supabase } from './supabase.js'
import { notifyIndexNowForEquipmentChange } from './indexNowNotify.js'
import {
  buildCanonicalProductAuditPayload,
  buildCanonicalProductAuditReport,
  buildCanonicalProductsFromRows,
  buildHighConfidenceApprovalEvaluation,
  buildProductReviewMetadata,
  buildSafeApprovalCandidateIds,
  buildSingleSourceNeedsReviewCandidateIds,
  evaluateHighConfidenceApproval,
  evaluateSingleSourceApproval,
  formatProductReviewReasons,
  getDetectedConsoleFromRow,
  getProductReviewReasons,
  HIGH_CONFIDENCE_SKIP_REASON_LABELS,
  HIGH_CONFIDENCE_SKIP_REASONS,
  isManuallyBlockedProduct,
  isSafeApprovalCandidate,
  isSafeForBulkApprove,
  productHasBaselineYear,
  productHasRrp,
  PRODUCT_STATUS,
  REVIEW_REASON_LABELS,
  summarizeSkippedReasons,
} from './intelligenceCanonicalProducts.js'
import {
  applyCanonicalProductResearchProtection,
  buildCanonicalProductResearchApproveUpdate,
  hasCanonicalProductResearchFieldsToSave,
} from './equipmentCanonicalResearchApprove.js'
import { filterAndOrderKnownConsoleVariants } from './consoleModifierValuation.js'
import {
  buildActiveBrandNameSet,
  buildCanonicalProductDisplayGroups,
  filterCanonicalProductsForTop100Queue,
} from './equipmentResearchQueue.js'
import { dedupeCanonicalProductsForWorkflow } from './canonicalProductDedupe.js'
import {
  mapProductConsoleOptionsToAvailability,
} from './productConsoleOptions.js'
import { normalizeConsoleCompatOption } from './consoleCompatibility.js'
import {
  EQUIPMENT_PRODUCT_IMAGES_BUCKET,
  buildEquipmentProductImageImportMetadata,
  buildEquipmentProductImagePublicUrl,
  buildVersionedEquipmentProductImageStoragePath,
  EQUIPMENT_PRODUCT_IMAGE_STATUS,
  normalizeEquipmentProductImageStoragePath,
  BLOCKED_DEALER_IMAGE_REJECTION_REASON,
} from './equipmentProductImages.js'
import { selectRelatedEquipmentProducts } from './equipmentPageSeo.js'

export const EQUIPMENT_INTELLIGENCE_APPROVAL_FIELDS = 'id, brand, series, model, equipment_type, product_family, slug, variant_name, core_product_key, is_base_product, core_product_group_status, core_product_group_confidence, original_rrp, currency, best_original_price, best_original_price_confidence, baseline_manufacture_year, manufacture_start_year, manufacture_end_year'

/** Full product row — use for detail/edit, not catalogue browsing. */
export const EQUIPMENT_PRODUCT_FIELDS = [
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
  'original_price_source_url',
  'baseline_source',
  'original_price_confidence',
  'lifecycle_confidence',
  'source_intelligence_row_ids',
  'status',
  'review_notes',
  'image_url',
  'image_storage_path',
  'image_source_url',
  'image_source_domain',
  'image_confidence',
  'image_status',
  'image_failure_reason',
  'image_updated_at',
  'created_at',
  'updated_at',
].join(', ')

/**
 * Prefer fetchAdminEquipmentProductsPage for admin catalogue browsing.
 * This full-catalogue helper remains for research/export workflows only.
 */
const EQUIPMENT_PRODUCTS_PAGE_SIZE = 1000

async function fetchAllEquipmentProductRows({ approvedOnly = false } = {}) {
  if (!isSupabaseConfigured || !supabase) {
    return { products: [], error: new Error('Supabase is not configured.') }
  }

  const products = []
  let from = 0

  while (true) {
    let query = supabase
      .from('equipment_products')
      .select(EQUIPMENT_PRODUCT_FIELDS)
      .order('brand')
      .order('canonical_product_name')
      .range(from, from + EQUIPMENT_PRODUCTS_PAGE_SIZE - 1)

    if (approvedOnly) {
      query = query.eq('status', PRODUCT_STATUS.APPROVED)
    }

    const { data, error } = await query
    if (error) {
      return { products: [], error }
    }

    if (!data?.length) break
    products.push(...data)
    if (data.length < EQUIPMENT_PRODUCTS_PAGE_SIZE) break
    from += EQUIPMENT_PRODUCTS_PAGE_SIZE
  }

  return { products, error: null }
}

export async function fetchBrandNames() {
  if (!isSupabaseConfigured || !supabase) {
    return { brands: [], error: new Error('Supabase is not configured.') }
  }

  const { data, error } = await supabase
    .from('brands')
    .select('name')
    .order('name')

  return { brands: data ?? [], error }
}

function countTop100Brands(groups = [], brandName) {
  const target = String(brandName ?? '').trim().toLowerCase()
  if (!target) return 0
  return groups.filter((group) => String(group.product?.brand ?? '').trim().toLowerCase() === target).length
}

export async function fetchEquipmentProducts() {
  return fetchAllEquipmentProductRows({ approvedOnly: false })
}

export async function fetchApprovedEquipmentProducts() {
  return fetchAllEquipmentProductRows({ approvedOnly: true })
}

export async function fetchEquipmentProductByKey(canonicalProductKey) {
  const key = String(canonicalProductKey ?? '').trim()
  if (!key) {
    return { product: null, error: null, notFound: true }
  }

  if (!isSupabaseConfigured || !supabase) {
    return { product: null, error: new Error('Supabase is not configured.'), notFound: false }
  }

  const { data, error } = await supabase
    .from('equipment_products')
    .select(EQUIPMENT_PRODUCT_FIELDS)
    .eq('canonical_product_key', key)
    .eq('status', PRODUCT_STATUS.APPROVED)
    .maybeSingle()

  return {
    product: data ?? null,
    error,
    notFound: !data && !error,
  }
}

/**
 * Related approved public products for internal linking on product pages.
 * Uses the same public catalogue filter as brand pages / sitemap.
 */
export async function fetchRelatedPublicEquipmentProducts(product, { limit = 6 } = {}) {
  const key = String(product?.canonical_product_key ?? '').trim()
  if (!key) return { products: [], error: null }

  if (!isSupabaseConfigured || !supabase) {
    return { products: [], error: new Error('Supabase is not configured.') }
  }

  const brand = String(product?.brand ?? '').trim()
  const equipmentType = String(product?.equipment_type ?? '').trim()
  const max = Math.max(1, Math.min(24, Number(limit) || 6))

  let query = supabase
    .from('equipment_products')
    .select(EQUIPMENT_PRODUCT_FIELDS)
    .eq('status', PRODUCT_STATUS.APPROVED)
    .neq('canonical_product_key', key)
    .limit(Math.max(max * 8, 24))

  if (brand) {
    query = query.eq('brand', brand)
  } else if (equipmentType && equipmentType.toLowerCase() !== 'unknown') {
    query = query.eq('equipment_type', equipmentType)
  }

  const { data, error } = await query.order('canonical_product_name')
  if (error) return { products: [], error }

  const related = selectRelatedEquipmentProducts(product, data ?? [], { limit: max })
  return {
    products: related.map((entry) => entry.product),
    related,
    error: null,
  }
}

export function buildEquipmentProductPagePath(canonicalProductKey) {
  const key = String(canonicalProductKey ?? '').trim()
  if (!key) return null
  return `/equipment/${encodeURIComponent(key)}`
}

export { buildCreateListingFromEquipmentPath } from './createListingFromEquipment.js'

export function collectKnownConsoleVariants(product, sourceRows = [], modifiers = []) {
  const variants = new Set()
  const brandKey = String(product?.brand ?? '').toLowerCase()

  for (const row of sourceRows) {
    const variant = getDetectedConsoleFromRow(row)
    if (variant) variants.add(variant)
  }

  for (const entry of modifiers) {
    if (String(entry.brand ?? '').toLowerCase() === brandKey && entry.console_name) {
      variants.add(entry.console_name)
    }
  }

  return filterAndOrderKnownConsoleVariants(product?.brand, [...variants])
}

function mapCompatJoinRow(row) {
  const console = row.equipment_consoles ?? {}
  return normalizeConsoleCompatOption({
    id: row.id,
    product_id: row.product_id,
    console_id: row.console_id,
    console_key: console.console_key ?? row.console_key,
    console_name: console.console_name ?? row.console_name,
    alternative_names: console.alternative_names ?? [],
    available_from_year: row.available_from_year,
    available_to_year: row.available_to_year,
    from_year_approximate: row.from_year_approximate,
    to_year_approximate: row.to_year_approximate,
    compatibility_type: row.compatibility_type,
    is_default: row.is_default,
    display_order: row.display_order,
    sort_order: row.display_order,
    tier: row.tier,
    modifier_percent: row.modifier_percent,
    image_url: console.image_url ?? null,
    image_storage_path: console.image_storage_path ?? null,
    source_url: row.source_url ?? console.source_url ?? null,
    notes: row.notes ?? null,
    confidence: row.confidence ?? console.confidence ?? 'medium',
    is_active: row.is_active !== false && console.active !== false,
    brand: console.brand ?? null,
    release_year: row.available_from_year,
    retired_year: row.available_to_year,
  })
}

/** Prefer product_console_compat; fall back to legacy product_console_options. Never brand-wide. */
export async function fetchProductConsoleOptions(productId) {
  if (!productId) {
    return { options: [], source: null, error: null }
  }

  if (!isSupabaseConfigured || !supabase) {
    return { options: [], source: null, error: new Error('Supabase is not configured.') }
  }

  const compatResult = await supabase
    .from('product_console_compat')
    .select(`
      id,
      product_id,
      console_id,
      available_from_year,
      available_to_year,
      from_year_approximate,
      to_year_approximate,
      compatibility_type,
      is_default,
      display_order,
      tier,
      modifier_percent,
      source_url,
      notes,
      confidence,
      is_active,
      equipment_consoles (
        brand,
        console_key,
        console_name,
        alternative_names,
        image_url,
        image_storage_path,
        source_url,
        confidence,
        active,
        display_order
      )
    `)
    .eq('product_id', productId)
    .eq('is_active', true)
    .order('display_order')

  if (!compatResult.error && (compatResult.data?.length ?? 0) > 0) {
    return {
      options: (compatResult.data ?? []).map(mapCompatJoinRow),
      source: 'product_console_compat',
      error: null,
    }
  }

  // Table missing / not migrated yet — fall through to legacy
  const legacyMissing = compatResult.error
    && /relation|does not exist|Could not find the table/i.test(String(compatResult.error.message ?? ''))

  if (compatResult.error && !legacyMissing) {
    return { options: [], source: null, error: compatResult.error }
  }

  const { data, error } = await supabase
    .from('product_console_options')
    .select('id, product_id, console_key, console_name, release_year, retired_year, tier, modifier_percent, image_url, sort_order, is_active')
    .eq('product_id', productId)
    .eq('is_active', true)
    .order('sort_order')
    .order('console_name')

  return {
    options: (data ?? []).map((row) => normalizeConsoleCompatOption({
      ...row,
      compatibility_type: 'factory',
      available_from_year: row.release_year,
      available_to_year: row.retired_year,
      display_order: row.sort_order,
      confidence: 'medium',
    })),
    source: data?.length ? 'product_console_options' : null,
    error,
  }
}

export async function fetchEquipmentProductPageData(canonicalProductKey) {
  const productResult = await fetchEquipmentProductByKey(canonicalProductKey)
  if (!productResult.product) {
    return {
      ...productResult,
      sourceRows: [],
      consoleVariants: [],
      productConsoleOptions: [],
      consoleOptionsSource: null,
      modifiers: [],
      availability: [],
    }
  }

  const sourceIds = productResult.product.source_intelligence_row_ids ?? []
  const [rowsResult, modifiersResult, consoleOptionsResult] = await Promise.all([
    fetchEquipmentIntelligenceByIds(sourceIds),
    fetchConsoleModifiers(),
    fetchProductConsoleOptions(productResult.product.id),
  ])

  const modifiers = modifiersResult.modifiers ?? []
  const productConsoleOptions = consoleOptionsResult.options ?? []
  // Public pages never use brand-wide availability fallback.
  const availability = productConsoleOptions.length
    ? mapProductConsoleOptionsToAvailability(productResult.product, productConsoleOptions)
    : []
  const sourceRows = rowsResult.rows ?? []

  return {
    ...productResult,
    sourceRows,
    modifiers,
    availability,
    productConsoleOptions,
    consoleOptionsSource: consoleOptionsResult.source,
    consoleVariants: productConsoleOptions.length
      ? []
      : collectKnownConsoleVariants(productResult.product, sourceRows, modifiers),
    sourceRowsError: rowsResult.error,
    productConsoleOptionsError: consoleOptionsResult.error,
  }
}

export async function fetchCanonicalProductResearchView({ limit = 100 } = {}) {
  const productsResult = await fetchApprovedEquipmentProducts()
  if (productsResult.error) {
    return {
      groups: [],
      products: [],
      usesCanonicalProducts: false,
      totalScored: 0,
      top100Debug: null,
      error: productsResult.error,
    }
  }

  if (!productsResult.products.length) {
    return {
      groups: [],
      products: [],
      usesCanonicalProducts: false,
      totalScored: 0,
      top100Debug: null,
      error: null,
    }
  }

  const brandsResult = await fetchBrandNames()
  const activeBrands = buildActiveBrandNameSet({
    brands: brandsResult.brands ?? [],
    products: productsResult.products,
  })

  const dedupedResult = await fetchDedupedApprovedCanonicalProducts(productsResult.products)
  if (dedupedResult.error) {
    return {
      groups: [],
      products: [],
      usesCanonicalProducts: false,
      totalScored: 0,
      top100Debug: null,
      error: dedupedResult.error,
    }
  }

  const incompleteCandidates = filterCanonicalProductsForTop100Queue(dedupedResult.products, {
    activeBrands,
  })
  const groups = buildCanonicalProductDisplayGroups(dedupedResult.products, {
    limit,
    incompleteOnly: true,
    activeBrands,
  })

  const top100Debug = {
    loadedProducts: productsResult.products.length,
    dedupedProducts: dedupedResult.products.length,
    incompleteCandidates: incompleteCandidates.length,
    displayedRows: groups.length,
    woodway: countTop100Brands(groups, 'Woodway'),
    wattbike: countTop100Brands(groups, 'Wattbike'),
    firstBrands: groups.slice(0, 50).map((group) => group.product?.brand).filter(Boolean),
  }

  return {
    groups,
    products: dedupedResult.products,
    usesCanonicalProducts: true,
    totalScored: incompleteCandidates.length,
    top100Debug,
    error: null,
  }
}

export async function fetchConsoleModifiers() {
  if (!isSupabaseConfigured || !supabase) {
    return { modifiers: [], error: new Error('Supabase is not configured.') }
  }

  const { data, error } = await supabase
    .from('equipment_console_modifiers')
    .select('*')
    .order('brand')
    .order('console_name')

  return { modifiers: data ?? [], error }
}

export async function fetchConsoleAvailability() {
  if (!isSupabaseConfigured || !supabase) {
    return { availability: [], error: new Error('Supabase is not configured.') }
  }

  const { data, error } = await supabase
    .from('equipment_console_availability')
    .select('*')
    .order('brand')
    .order('release_year')
    .order('console_name')

  return { availability: data ?? [], error }
}

export async function fetchEquipmentIntelligenceByIds(ids = []) {
  if (!isSupabaseConfigured || !supabase || !ids.length) {
    return { rows: [], error: null }
  }

  const { data, error } = await supabase
    .from('equipment_intelligence')
    .select(EQUIPMENT_INTELLIGENCE_APPROVAL_FIELDS)
    .in('id', ids)

  return { rows: data ?? [], error }
}

async function loadIntelligenceRowsById(intelligenceIds = []) {
  const intelligenceRowsById = new Map()
  const chunkSize = 200

  for (let index = 0; index < intelligenceIds.length; index += chunkSize) {
    const chunk = intelligenceIds.slice(index, index + chunkSize)
    const result = await fetchEquipmentIntelligenceByIds(chunk)
    if (result.error) {
      return { intelligenceRowsById, error: result.error }
    }
    for (const row of result.rows) {
      intelligenceRowsById.set(row.id, row)
    }
  }

  return { intelligenceRowsById, error: null }
}

export async function fetchDedupedApprovedCanonicalProducts(products = null) {
  const productsResult = products
    ? { products, error: null }
    : await fetchApprovedEquipmentProducts()

  if (productsResult.error) {
    return { products: [], error: productsResult.error }
  }

  const approved = (productsResult.products ?? []).filter(
    (product) => product.status === PRODUCT_STATUS.APPROVED,
  )

  const intelligenceIds = [
    ...new Set(approved.flatMap((product) => product.source_intelligence_row_ids ?? [])),
  ]
  const { intelligenceRowsById, error } = await loadIntelligenceRowsById(intelligenceIds)
  if (error) {
    return {
      products: dedupeCanonicalProductsForWorkflow(approved, new Map()),
      error,
    }
  }

  return {
    products: dedupeCanonicalProductsForWorkflow(approved, intelligenceRowsById),
    error: null,
  }
}

export async function evaluateHighConfidenceApprovalCandidates(
  products = [],
  { minScore = 90 } = {},
) {
  const intelligenceIds = [
    ...new Set(products.flatMap((product) => product.source_intelligence_row_ids ?? [])),
  ]

  const { intelligenceRowsById, error } = await loadIntelligenceRowsById(intelligenceIds)
  if (error) {
    return {
      eligible: [],
      eligibleIds: [],
      eligibleIdSet: new Set(),
      skipped: [],
      summary: {
        eligibleCount: 0,
        pendingCount: 0,
        needsReviewCount: 0,
        skippedCount: 0,
        skippedByReason: {},
      },
      error,
    }
  }

  const evaluation = buildHighConfidenceApprovalEvaluation(
    products,
    intelligenceRowsById,
    { minScore },
  )

  return { ...evaluation, error: null }
}

export async function evaluateSafeApprovalCandidates(products = []) {
  const reviewableProducts = products.filter(
    (product) => [PRODUCT_STATUS.PENDING, PRODUCT_STATUS.NEEDS_REVIEW].includes(product.status)
      && (product.source_intelligence_row_ids?.length ?? 0) > 0,
  )

  const intelligenceIds = [
    ...new Set(reviewableProducts.flatMap((product) => product.source_intelligence_row_ids ?? [])),
  ]

  const { intelligenceRowsById, error } = await loadIntelligenceRowsById(intelligenceIds)
  if (error) {
    return {
      safeIds: [],
      safeIdSet: new Set(),
      singleSourceNeedsReviewIds: [],
      singleSourceNeedsReviewIdSet: new Set(),
      reviewReasonsByProductId: {},
      error,
    }
  }

  const safeIds = buildSafeApprovalCandidateIds(products, intelligenceRowsById)
  const singleSourceNeedsReviewIds = buildSingleSourceNeedsReviewCandidateIds(
    products,
    intelligenceRowsById,
  )

  return {
    safeIds,
    safeIdSet: new Set(safeIds),
    singleSourceNeedsReviewIds,
    singleSourceNeedsReviewIdSet: new Set(singleSourceNeedsReviewIds),
    reviewReasonsByProductId: buildProductReviewMetadata(products, intelligenceRowsById),
    error: null,
  }
}

export function buildCanonicalProductReviewData(rows = []) {
  const audit = buildCanonicalProductAuditReport(rows)
  return { audit, products: audit.products }
}

export async function upsertCanonicalProductFromAudit(product) {
  if (!isSupabaseConfigured || !supabase) {
    return { data: null, error: new Error('Supabase is not configured.') }
  }

  const payload = buildCanonicalProductAuditPayload(product)
  const { data, error } = await supabase.rpc('admin_upsert_equipment_product_audit', {
    p_canonical_product_key: payload.canonical_product_key,
    p_brand: payload.brand,
    p_product_family: payload.product_family,
    p_model: payload.model,
    p_equipment_type: payload.equipment_type,
    p_canonical_product_name: payload.canonical_product_name,
    p_source_intelligence_row_ids: payload.source_intelligence_row_ids,
    p_status: payload.status,
    p_baseline_manufacture_year: payload.baseline_manufacture_year,
    p_production_start_year: payload.production_start_year,
    p_production_end_year: payload.production_end_year,
    p_original_base_price: payload.original_base_price,
    p_original_base_price_currency: payload.original_base_price_currency,
    p_original_price_confidence: payload.original_price_confidence,
    p_lifecycle_confidence: payload.lifecycle_confidence,
    p_review_notes: payload.review_notes,
  })

  return { data, error }
}

export async function persistCanonicalProductResearchApproval(
  productId,
  recommendation,
  { researchMeta = null } = {},
) {
  if (!isSupabaseConfigured || !supabase) {
    return { data: null, error: new Error('Supabase is not configured.') }
  }
  if (!productId) {
    return { data: null, error: new Error('Canonical product id is required.') }
  }

  const { data: currentProduct, error: fetchError } = await supabase
    .from('equipment_products')
    .select(EQUIPMENT_PRODUCT_FIELDS)
    .eq('id', productId)
    .maybeSingle()

  if (fetchError) {
    return { data: null, error: fetchError }
  }
  if (!currentProduct) {
    return { data: null, error: new Error('Canonical equipment product not found.') }
  }

  let update
  try {
    update = buildCanonicalProductResearchApproveUpdate(recommendation, {
      researchMeta,
      existingReviewNotes: currentProduct.review_notes,
    })
  } catch (error) {
    return { data: null, error }
  }

  const protectedUpdate = applyCanonicalProductResearchProtection(currentProduct, update)
  if (!hasCanonicalProductResearchFieldsToSave(protectedUpdate)) {
    return {
      data: null,
      error: new Error('Recommendation did not include price or lifecycle fields to save on the canonical product.'),
    }
  }

  const { data, error } = await supabase
    .from('equipment_products')
    .update(protectedUpdate)
    .eq('id', productId)
    .select(EQUIPMENT_PRODUCT_FIELDS)
    .maybeSingle()

  return { data, error }
}

export async function approveEquipmentProduct(productId) {
  if (!isSupabaseConfigured || !supabase) {
    return { data: null, error: new Error('Supabase is not configured.') }
  }

  const { data: previous } = await supabase
    .from('equipment_products')
    .select(EQUIPMENT_PRODUCT_FIELDS)
    .eq('id', productId)
    .maybeSingle()

  const { data, error } = await supabase.rpc('admin_approve_equipment_product', {
    p_product_id: productId,
  })

  if (!error && data) {
    notifyIndexNowForEquipmentChange({
      previous,
      next: data,
      action: 'approve',
      includeBrandDirectory: true,
      source: 'approveEquipmentProduct',
    })
  }

  return { data, error }
}

export async function excludeEquipmentProduct(productId) {
  if (!isSupabaseConfigured || !supabase) {
    return { data: null, error: new Error('Supabase is not configured.') }
  }

  const { data: previous } = await supabase
    .from('equipment_products')
    .select(EQUIPMENT_PRODUCT_FIELDS)
    .eq('id', productId)
    .maybeSingle()

  const { data, error } = await supabase.rpc('admin_exclude_equipment_product', {
    p_product_id: productId,
  })

  if (!error) {
    notifyIndexNowForEquipmentChange({
      previous,
      next: data || (previous ? { ...previous, status: 'excluded' } : null),
      action: 'exclude',
      includeBrandDirectory: true,
      source: 'excludeEquipmentProduct',
    })
  }

  return { data, error }
}

export async function updateEquipmentProduct(productId, fields) {
  if (!isSupabaseConfigured || !supabase) {
    return { data: null, error: new Error('Supabase is not configured.') }
  }

  const { data: previous } = await supabase
    .from('equipment_products')
    .select(EQUIPMENT_PRODUCT_FIELDS)
    .eq('id', productId)
    .maybeSingle()

  const { data, error } = await supabase.rpc('admin_update_equipment_product', {
    p_product_id: productId,
    p_product_family: fields.productFamily ?? null,
    p_model: fields.model ?? null,
    p_equipment_type: fields.equipmentType ?? null,
    p_canonical_product_name: fields.canonicalProductName ?? null,
    p_baseline_manufacture_year: fields.baselineManufactureYear ?? null,
    p_production_start_year: fields.productionStartYear ?? null,
    p_production_end_year: fields.productionEndYear ?? null,
    p_original_base_price: fields.originalBasePrice ?? null,
    p_original_base_price_currency: fields.originalBasePriceCurrency ?? null,
    p_original_price_source: fields.originalPriceSource ?? null,
    p_original_price_confidence: fields.originalPriceConfidence ?? null,
    p_lifecycle_confidence: fields.lifecycleConfidence ?? null,
    p_baseline_source: fields.baselineSource ?? null,
    p_original_price_source_url: fields.originalPriceSourceUrl ?? null,
    p_status: fields.status ?? null,
    p_review_notes: fields.reviewNotes ?? null,
  })

  if (!error && data) {
    const previousKey = previous?.canonical_product_key
    const nextKey = data?.canonical_product_key
    notifyIndexNowForEquipmentChange({
      previous,
      next: data,
      action: previousKey && nextKey && previousKey !== nextKey ? 'key_change' : 'update',
      includeBrandDirectory: Boolean(previousKey && nextKey && previousKey !== nextKey),
      source: 'updateEquipmentProduct',
    })
  }

  return { data, error }
}

export async function updateEquipmentProductImage(productId, fields) {
  if (!isSupabaseConfigured || !supabase) {
    return { data: null, error: new Error('Supabase is not configured.') }
  }

  const { data, error } = await supabase.rpc('admin_update_equipment_product_image', {
    p_product_id: productId,
    p_image_url: fields.imageUrl !== undefined ? (fields.imageUrl ?? '') : null,
    p_image_storage_path: fields.imageStoragePath !== undefined ? (fields.imageStoragePath ?? '') : null,
    p_image_source_url: fields.imageSourceUrl !== undefined ? (fields.imageSourceUrl ?? '') : null,
    p_image_source_domain: fields.imageSourceDomain !== undefined ? (fields.imageSourceDomain ?? '') : null,
    p_image_confidence: fields.imageConfidence ?? null,
    p_image_status: fields.imageStatus ?? null,
    p_image_failure_reason: fields.imageFailureReason ?? null,
  })

  return { data, error }
}

export async function replaceEquipmentProductImage(productId, fields) {
  if (!isSupabaseConfigured || !supabase) {
    return { data: null, error: new Error('Supabase is not configured.') }
  }

  const { data, error } = await supabase.rpc('admin_replace_equipment_product_image', {
    p_product_id: productId,
    p_image_url: fields.imageUrl ?? null,
    p_image_storage_path: fields.imageStoragePath ?? null,
    p_image_source_url: fields.imageSourceUrl ?? null,
    p_image_source_domain: fields.imageSourceDomain ?? null,
    p_image_confidence: fields.imageConfidence ?? null,
    p_image_status: fields.imageStatus ?? null,
    p_image_failure_reason: fields.imageFailureReason ?? null,
  })

  return { data, error }
}

function buildHostedImageSyncFields(product) {
  const storagePath = normalizeEquipmentProductImageStoragePath(product?.image_storage_path)
  if (!storagePath || !supabase) return null

  const publicUrl = buildEquipmentProductImagePublicUrl(supabase, storagePath)
  if (!publicUrl) return null

  const currentUrl = String(product?.image_url ?? '').trim()
  if (currentUrl === publicUrl) return null

  return {
    imageUrl: publicUrl,
    imageStoragePath: storagePath,
    imageSourceUrl: product?.image_source_url ?? publicUrl,
    imageSourceDomain: product?.image_source_domain ?? null,
    imageConfidence: product?.image_confidence ?? null,
    imageStatus: product?.image_status ?? EQUIPMENT_PRODUCT_IMAGE_STATUS.APPROVED,
    imageFailureReason: null,
  }
}

async function syncHostedEquipmentProductImageFields(product) {
  const fields = buildHostedImageSyncFields(product)
  if (!fields || !product?.id) {
    return { data: product, error: null, synced: false }
  }

  const result = await updateEquipmentProductImage(product.id, fields)
  return { ...result, synced: !result.error }
}

export function buildEquipmentProductImageUpdateFields({
  imageUrl,
  imageStoragePath,
  imageSourceUrl,
  imageConfidence,
  failureReason = null,
}) {
  const metadata = buildEquipmentProductImageImportMetadata({
    imageUrl,
    storagePath: imageStoragePath,
    sourceUrl: imageSourceUrl,
    confidence: imageConfidence,
    failureReason,
  })

  return {
    imageUrl: metadata.image_url,
    imageStoragePath: metadata.image_storage_path,
    imageSourceUrl: metadata.image_source_url,
    imageSourceDomain: metadata.image_source_domain,
    imageConfidence: metadata.image_confidence,
    imageStatus: metadata.image_status,
    imageFailureReason: metadata.image_failure_reason,
  }
}

export async function approveEquipmentProductImage(productId) {
  if (!isSupabaseConfigured || !supabase) {
    return { data: null, error: new Error('Supabase is not configured.') }
  }

  const { data: previous } = await supabase
    .from('equipment_products')
    .select(EQUIPMENT_PRODUCT_FIELDS)
    .eq('id', productId)
    .maybeSingle()

  const { data, error } = await supabase.rpc('admin_approve_equipment_product_image', {
    p_product_id: productId,
  })

  if (error || !data) {
    return { data, error }
  }

  const syncResult = await syncHostedEquipmentProductImageFields(data)
  if (syncResult.error) {
    return { data, error: syncResult.error }
  }

  const next = syncResult.data ?? data
  notifyIndexNowForEquipmentChange({
    previous,
    next,
    action: 'image',
    source: 'approveEquipmentProductImage',
  })

  return { data: next, error: null }
}

export async function uploadAndReplaceEquipmentProductImageFile(product, file, {
  sourceUrl = null,
  imageConfidence = 90,
  approve = false,
} = {}) {
  const uploadResult = await uploadEquipmentProductImageFile(product, file)
  if (uploadResult.error) {
    return { data: null, uploadResult, error: uploadResult.error }
  }

  const fields = buildEquipmentProductImageUpdateFields({
    imageUrl: uploadResult.publicUrl,
    imageStoragePath: uploadResult.storagePath,
    imageSourceUrl: sourceUrl || uploadResult.publicUrl,
    imageConfidence,
  })

  const replaceResult = await replaceEquipmentProductImage(product.id, {
    imageUrl: fields.imageUrl,
    imageStoragePath: fields.imageStoragePath,
    imageSourceUrl: fields.imageSourceUrl,
    imageSourceDomain: fields.imageSourceDomain,
    imageConfidence: fields.imageConfidence,
    imageStatus: approve ? EQUIPMENT_PRODUCT_IMAGE_STATUS.APPROVED : fields.imageStatus,
    imageFailureReason: fields.imageFailureReason,
  })

  if (replaceResult.error) {
    return { data: null, uploadResult, error: replaceResult.error }
  }

  if (!approve) {
    return { data: replaceResult.data, uploadResult, error: null }
  }

  const approveResult = await approveEquipmentProductImage(product.id)
  return {
    data: approveResult.data,
    uploadResult,
    error: approveResult.error,
  }
}

export async function rejectEquipmentProductImage(productId, reason = null) {
  if (!isSupabaseConfigured || !supabase) {
    return { data: null, error: new Error('Supabase is not configured.') }
  }

  const { data: previous } = await supabase
    .from('equipment_products')
    .select(EQUIPMENT_PRODUCT_FIELDS)
    .eq('id', productId)
    .maybeSingle()

  const { data, error } = await supabase.rpc('admin_reject_equipment_product_image', {
    p_product_id: productId,
    p_reason: reason,
  })

  if (!error && data) {
    notifyIndexNowForEquipmentChange({
      previous,
      next: data,
      action: 'image',
      source: 'rejectEquipmentProductImage',
    })
  }

  return { data, error }
}

export async function bulkRejectBlockedEquipmentProductImages(products = [], {
  reason = null,
} = {}) {
  const { listProductsForImageCleanup, IMAGE_AUDIT_RISK } = await import('./equipmentProductImageAudit.js')
  const targets = listProductsForImageCleanup(products, { risk: IMAGE_AUDIT_RISK.BLOCKED })
    .filter((product) => product.image_status === 'suggested')
  const failures = []
  let rejected = 0

  for (const product of targets) {
    const result = await rejectEquipmentProductImage(
      product.id,
      reason ?? BLOCKED_DEALER_IMAGE_REJECTION_REASON,
    )
    if (result.error) {
      failures.push({ productId: product.id, error: result.error })
      continue
    }
    rejected += 1
  }

  return { rejected, failures, targets }
}

export async function suggestEquipmentProductImageFromSearch(productId) {
  if (!isSupabaseConfigured || !supabase) {
    return { data: null, error: new Error('Supabase is not configured.') }
  }

  const { data, error } = await supabase.functions.invoke('equipment-product-image-suggest', {
    body: { product_id: productId },
  })

  if (error) {
    return { data: null, error }
  }

  if (data?.error) {
    return { data: null, error: new Error(data.error) }
  }

  return { data, error: null }
}

export async function uploadEquipmentProductImageFile(product, file) {
  if (!isSupabaseConfigured || !supabase) {
    return { storagePath: null, publicUrl: null, error: new Error('Supabase is not configured.') }
  }

  const extension = file?.type?.includes('png')
    ? 'png'
    : file?.type?.includes('webp')
      ? 'webp'
      : 'jpg'
  const storagePath = buildVersionedEquipmentProductImageStoragePath(product, extension)

  const { error: uploadError } = await supabase.storage
    .from(EQUIPMENT_PRODUCT_IMAGES_BUCKET)
    .upload(storagePath, file, {
      contentType: file.type || 'image/jpeg',
      upsert: false,
    })

  if (uploadError) {
    return { storagePath: null, publicUrl: null, error: uploadError }
  }

  const { data } = supabase.storage
    .from(EQUIPMENT_PRODUCT_IMAGES_BUCKET)
    .getPublicUrl(storagePath)

  if (import.meta.env?.DEV) {
    console.debug('[equipment-product-image] Uploaded replacement image', {
      canonical_product_key: product?.canonical_product_key ?? null,
      storagePath,
      publicUrl: data?.publicUrl ?? null,
    })
  }

  return {
    storagePath,
    publicUrl: data?.publicUrl ?? null,
    error: null,
  }
}

export async function mergeEquipmentProducts(targetProductId, sourceProductIds = []) {
  if (!isSupabaseConfigured || !supabase) {
    return { data: null, error: new Error('Supabase is not configured.') }
  }

  const { data, error } = await supabase.rpc('admin_merge_equipment_products', {
    p_target_product_id: targetProductId,
    p_source_product_ids: sourceProductIds,
  })

  return { data, error }
}

export async function bulkApproveEquipmentProducts(productIds = [], { safeCandidatesOnly = false } = {}) {
  if (!isSupabaseConfigured || !supabase || !productIds.length) {
    return { approved: 0, skipped: 0, failures: [], error: null }
  }

  let approved = 0
  let skipped = 0
  const failures = []
  let safeIdSet = null

  if (safeCandidatesOnly) {
    const { data: products, error: productsError } = await supabase
      .from('equipment_products')
      .select(EQUIPMENT_PRODUCT_FIELDS)
      .in('id', productIds)

    if (productsError) return { approved, skipped, failures, error: productsError }

    const evaluation = await evaluateSafeApprovalCandidates(products ?? [])
    if (evaluation.error) return { approved, skipped, failures, error: evaluation.error }
    safeIdSet = evaluation.safeIdSet
  }

  for (const productId of productIds) {
    const { data: product, error: fetchError } = await supabase
      .from('equipment_products')
      .select('id, status')
      .eq('id', productId)
      .maybeSingle()

    if (fetchError) {
      failures.push({ productId, error: fetchError })
      continue
    }
    if (!product || (product.status !== PRODUCT_STATUS.PENDING && product.status !== PRODUCT_STATUS.NEEDS_REVIEW)) {
      skipped += 1
      continue
    }
    if (safeCandidatesOnly && !safeIdSet?.has(productId)) {
      skipped += 1
      continue
    }

    const { error } = await supabase.rpc('admin_approve_equipment_product', {
      p_product_id: productId,
    })
    if (error) {
      failures.push({ productId, error })
      continue
    }
    approved += 1
  }

  return {
    approved,
    skipped,
    failures,
    error: failures.length && approved === 0 ? failures[0].error : null,
  }
}

export async function bulkApproveSingleSourceNeedsReviewProducts(
  products = [],
) {
  if (!isSupabaseConfigured || !supabase || !products.length) {
    return { approved: 0, skipped: 0, error: null }
  }

  const evaluation = await evaluateSafeApprovalCandidates(products)
  if (evaluation.error) {
    return { approved: 0, skipped: products.length, error: evaluation.error }
  }

  let approved = 0
  let skipped = 0

  for (const productId of evaluation.singleSourceNeedsReviewIds) {
    const { data: product, error: fetchError } = await supabase
      .from('equipment_products')
      .select('id, status')
      .eq('id', productId)
      .maybeSingle()

    if (fetchError) return { approved, skipped, error: fetchError }
    if (!product || product.status !== PRODUCT_STATUS.NEEDS_REVIEW) {
      skipped += 1
      continue
    }

    const { error } = await supabase.rpc('admin_approve_equipment_product', {
      p_product_id: productId,
    })
    if (error) return { approved, skipped, error }
    approved += 1
  }

  skipped += products.filter((product) => (
    product.status === PRODUCT_STATUS.NEEDS_REVIEW
    && !evaluation.singleSourceNeedsReviewIdSet.has(product.id)
  )).length

  return { approved, skipped, error: null }
}

export async function bulkExcludeEquipmentProducts(productIds = []) {
  if (!isSupabaseConfigured || !supabase || !productIds.length) {
    return { excluded: 0, error: null }
  }

  let excluded = 0

  for (const productId of productIds) {
    const { error } = await supabase.rpc('admin_exclude_equipment_product', {
      p_product_id: productId,
    })
    if (error) return { excluded, error }
    excluded += 1
  }

  return { excluded, error: null }
}

export async function bulkApproveHighConfidenceProducts(
  products = [],
  { minScore = 90 } = {},
) {
  if (!isSupabaseConfigured || !supabase || !products.length) {
    return {
      approved: 0,
      skipped: 0,
      skippedByReason: {},
      skippedReasons: [],
      error: null,
    }
  }

  const evaluation = await evaluateHighConfidenceApprovalCandidates(products, { minScore })
  if (evaluation.error) {
    return {
      approved: 0,
      skipped: products.length,
      skippedByReason: evaluation.summary?.skippedByReason ?? {},
      skippedReasons: summarizeSkippedReasons(evaluation.summary?.skippedByReason ?? {}),
      error: evaluation.error,
    }
  }

  let approved = 0
  let skipped = evaluation.skipped.length

  for (const productId of evaluation.eligibleIds) {
    const { data: existing, error: fetchError } = await supabase
      .from('equipment_products')
      .select('id, status, original_base_price, original_price_confidence, baseline_manufacture_year, original_price_source')
      .eq('id', productId)
      .maybeSingle()

    if (fetchError) {
      return {
        approved,
        skipped,
        skippedByReason: evaluation.summary.skippedByReason,
        skippedReasons: summarizeSkippedReasons(evaluation.summary.skippedByReason),
        error: fetchError,
      }
    }

    if (!existing || existing.status === PRODUCT_STATUS.APPROVED || existing.status === PRODUCT_STATUS.EXCLUDED) {
      skipped += 1
      continue
    }

    const { error } = await supabase.rpc('admin_approve_equipment_product', {
      p_product_id: productId,
    })
    if (error) {
      return {
        approved,
        skipped,
        skippedByReason: evaluation.summary.skippedByReason,
        skippedReasons: summarizeSkippedReasons(evaluation.summary.skippedByReason),
        error,
      }
    }
    approved += 1
  }

  return {
    approved,
    skipped,
    skippedByReason: evaluation.summary.skippedByReason,
    skippedReasons: summarizeSkippedReasons(evaluation.summary.skippedByReason),
    pendingApproved: evaluation.summary.pendingCount,
    needsReviewApproved: evaluation.summary.needsReviewCount,
    error: null,
  }
}

const RESEARCH_IMPORT_PRODUCT_FIELDS = [
  'id',
  'brand',
  'canonical_product_name',
  'canonical_product_key',
  'original_base_price',
  'original_base_price_currency',
  'original_price_source',
  'original_price_source_url',
  'original_price_confidence',
  'baseline_manufacture_year',
  'baseline_source',
  'production_start_year',
  'production_end_year',
  'lifecycle_confidence',
  'source_intelligence_row_ids',
  'review_notes',
].join(', ')

const RESEARCH_IMPORT_INTELLIGENCE_FIELDS = [
  'id',
  'best_original_price',
  'best_original_price_currency',
  'best_original_price_confidence',
  'best_original_price_source_id',
  'baseline_manufacture_year',
  'baseline_manufacture_year_confidence',
  'baseline_manufacture_year_source',
].join(', ')

async function fetchResearchImportIntelligenceRows(ids = []) {
  if (!isSupabaseConfigured || !supabase || !ids.length) {
    return { rows: [], error: null }
  }

  const rows = []
  const chunkSize = 200
  for (let index = 0; index < ids.length; index += chunkSize) {
    const chunk = ids.slice(index, index + chunkSize)
    const { data, error } = await supabase
      .from('equipment_intelligence')
      .select(RESEARCH_IMPORT_INTELLIGENCE_FIELDS)
      .in('id', chunk)

    if (error) return { rows: [], error }
    rows.push(...(data ?? []))
  }

  return { rows, error: null }
}

export async function buildCanonicalProductResearchImportPlanFromFile(file, { force = false } = {}) {
  if (!file) {
    return { plan: null, error: new Error('Choose a spreadsheet file to import.') }
  }

  if (!isSupabaseConfigured || !supabase) {
    return { plan: null, error: new Error('Supabase is not configured.') }
  }

  const {
    buildImportPlanWithIntelligence,
    normalizeImportHeaderMap,
    parseResearchImportFile,
  } = await import('./canonicalProductResearchImport.js')

  const parsed = await parseResearchImportFile(file, { filename: file.name })
  const headerMap = normalizeImportHeaderMap(parsed.headers)

  const { data: products, error: productsError } = await supabase
    .from('equipment_products')
    .select(RESEARCH_IMPORT_PRODUCT_FIELDS)
    .order('canonical_product_name')

  if (productsError) {
    return { plan: null, error: productsError }
  }

  const intelligenceIds = [
    ...new Set((products ?? []).flatMap((product) => product.source_intelligence_row_ids ?? [])),
  ]
  const intelligenceResult = await fetchResearchImportIntelligenceRows(intelligenceIds)
  if (intelligenceResult.error) {
    return { plan: null, error: intelligenceResult.error }
  }

  const intelligenceRowsById = new Map(
    intelligenceResult.rows.map((row) => [row.id, row]),
  )

  const plan = buildImportPlanWithIntelligence(
    products ?? [],
    parsed.rows,
    headerMap,
    intelligenceRowsById,
    { force },
  )

  return { plan, error: null }
}

export async function applyCanonicalProductResearchImport(plan) {
  if (!isSupabaseConfigured || !supabase) {
    return { appliedProducts: 0, appliedIntelligenceRows: 0, failures: [], error: new Error('Supabase is not configured.') }
  }

  const { applyCanonicalProductImportPlan } = await import('./canonicalProductResearchImport.js')

  const result = await applyCanonicalProductImportPlan(plan, {
    applyProductUpdate: async (productId, update, snapshot) => {
      const { error } = await supabase
        .from('equipment_products')
        .update({ ...update, updated_at: new Date().toISOString() })
        .eq('id', productId)

      if (error) return { error }

      return {
        error: null,
        rollback: snapshot
          ? async () => {
            await supabase
              .from('equipment_products')
              .update({ ...snapshot, updated_at: new Date().toISOString() })
              .eq('id', productId)
          }
          : null,
      }
    },
    applyIntelligenceUpdate: async (rowId, patch) => {
      const { id, ...fields } = patch
      const { error } = await supabase
        .from('equipment_intelligence')
        .update(fields)
        .eq('id', rowId)
      return { error }
    },
  })

  return { ...result, error: null }
}

export {
  buildCanonicalProductAuditReport,
  buildCanonicalProductsFromRows,
  buildHighConfidenceApprovalEvaluation,
  buildProductReviewMetadata,
  buildSafeApprovalCandidateIds,
  buildSingleSourceNeedsReviewCandidateIds,
  evaluateHighConfidenceApproval,
  evaluateSingleSourceApproval,
  formatProductReviewReasons,
  getProductReviewReasons,
  HIGH_CONFIDENCE_SKIP_REASON_LABELS,
  HIGH_CONFIDENCE_SKIP_REASONS,
  isManuallyBlockedProduct,
  isSafeApprovalCandidate,
  isSafeForBulkApprove,
  productHasBaselineYear,
  productHasRrp,
  PRODUCT_STATUS,
  REVIEW_REASON_LABELS,
  summarizeSkippedReasons,
}
