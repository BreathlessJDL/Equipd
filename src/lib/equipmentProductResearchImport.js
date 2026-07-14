/**
 * Apply researched product CSV updates (admin client).
 */

import { isSupabaseConfigured, supabase } from './supabase.js'
import { EQUIPMENT_PRODUCT_FIELDS, updateEquipmentProduct } from './equipmentProducts.js'
import {
  buildResearchImportPlan,
  buildResearchUpdatePayload,
  parseResearchCsv,
  RESEARCH_IMPORT_MAX_ROWS,
} from './equipmentProductResearchCsv.js'

function emptyApplyResult(error = null) {
  return {
    updated: [],
    unchanged: [],
    failed: [],
    fieldUpdateCount: 0,
    brandsAffected: [],
    batchId: null,
    error,
  }
}

async function fetchProductsByIds(ids = []) {
  const unique = [...new Set(ids.filter(Boolean))]
  const map = new Map()
  for (let i = 0; i < unique.length; i += 80) {
    const chunk = unique.slice(i, i + 80)
    const { data, error } = await supabase
      .from('equipment_products')
      .select(EQUIPMENT_PRODUCT_FIELDS)
      .in('id', chunk)
    if (error) return { map, error }
    for (const row of data ?? []) map.set(String(row.id), row)
  }
  return { map, error: null }
}

export async function buildResearchImportPlanFromCsvText(csvText, {
  filename = null,
} = {}) {
  const parsed = parseResearchCsv(csvText)
  if (parsed.error) {
    return { plan: null, error: parsed.error }
  }
  if (!parsed.rows.length) {
    return { plan: null, error: new Error('CSV has no data rows.') }
  }
  if (parsed.rows.length > RESEARCH_IMPORT_MAX_ROWS) {
    return {
      plan: null,
      error: new Error(`CSV exceeds maximum of ${RESEARCH_IMPORT_MAX_ROWS} rows.`),
    }
  }

  if (!isSupabaseConfigured || !supabase) {
    return { plan: null, error: new Error('Supabase is not configured.') }
  }

  const ids = parsed.rows.map((row) => String(row.product_id || '').trim()).filter(Boolean)
  const { map, error } = await fetchProductsByIds(ids)
  if (error) return { plan: null, error }

  const built = buildResearchImportPlan(parsed.rows, map)
  const batchId = `research-${Date.now().toString(36)}`
  for (const entry of built.plans) {
    entry.filename = filename
    entry.batchId = batchId
  }

  return {
    plan: {
      ...built,
      filename,
      batchId,
      headers: parsed.headers,
    },
    error: null,
  }
}

export async function applyResearchImportPlan(plan, {
  onProgress = null,
} = {}) {
  if (!plan) return emptyApplyResult(new Error('No import plan.'))
  if (!isSupabaseConfigured || !supabase) {
    return emptyApplyResult(new Error('Supabase is not configured.'))
  }

  const updated = []
  const unchanged = []
  const failed = []
  let fieldUpdateCount = 0
  const brands = new Set()
  const updatePlans = (plan.plans || []).filter((entry) => entry.action === 'update')

  for (const entry of plan.plans || []) {
    if (entry.action === 'unchanged') {
      unchanged.push(entry)
    }
  }

  for (let index = 0; index < updatePlans.length; index += 1) {
    const entry = updatePlans[index]
    onProgress?.({
      completed: index,
      total: updatePlans.length,
      productId: entry.product_id,
    })

    try {
      const { data: existing, error: existingError } = await supabase
        .from('equipment_products')
        .select(EQUIPMENT_PRODUCT_FIELDS)
        .eq('id', entry.product_id)
        .maybeSingle()

      if (existingError) throw existingError
      if (!existing) throw new Error('product not found at apply time')

      const { patch, clearFields, reviewNotes } = buildResearchUpdatePayload(entry, existing)

      // Never pass status — preserves approved/needs_review/excluded/pending.
      const rpcFields = {
        productFamily: Object.prototype.hasOwnProperty.call(patch, 'product_family')
          ? patch.product_family
          : undefined,
        model: Object.prototype.hasOwnProperty.call(patch, 'model') ? patch.model : undefined,
        equipmentType: Object.prototype.hasOwnProperty.call(patch, 'equipment_type')
          ? patch.equipment_type
          : undefined,
        baselineManufactureYear: Object.prototype.hasOwnProperty.call(patch, 'baseline_manufacture_year')
          ? patch.baseline_manufacture_year
          : undefined,
        productionStartYear: Object.prototype.hasOwnProperty.call(patch, 'production_start_year')
          ? patch.production_start_year
          : undefined,
        productionEndYear: Object.prototype.hasOwnProperty.call(patch, 'production_end_year')
          ? patch.production_end_year
          : undefined,
        originalBasePrice: Object.prototype.hasOwnProperty.call(patch, 'original_base_price')
          ? patch.original_base_price
          : undefined,
        originalBasePriceCurrency: Object.prototype.hasOwnProperty.call(patch, 'original_base_price_currency')
          ? patch.original_base_price_currency
          : undefined,
        originalPriceConfidence: Object.prototype.hasOwnProperty.call(patch, 'original_price_confidence')
          ? patch.original_price_confidence
          : undefined,
        originalPriceSource: patch.original_price_source,
        baselineSource: patch.baseline_source,
        originalPriceSourceUrl: Object.prototype.hasOwnProperty.call(patch, 'original_price_source_url')
          ? patch.original_price_source_url
          : undefined,
        reviewNotes,
      }

      // Drop undefined keys so updateEquipmentProduct only sends intended fields.
      const cleaned = {}
      for (const [key, value] of Object.entries(rpcFields)) {
        if (value !== undefined) cleaned[key] = value
      }

      const { data, error } = await updateEquipmentProduct(entry.product_id, cleaned)
      if (error) throw error

      if (clearFields.length) {
        const clearPatch = { updated_at: new Date().toISOString() }
        for (const field of clearFields) clearPatch[field] = null
        const { error: clearError } = await supabase
          .from('equipment_products')
          .update(clearPatch)
          .eq('id', entry.product_id)
        if (clearError) throw clearError
      }

      fieldUpdateCount += entry.fieldChanges.length
      brands.add(entry.brand)
      updated.push({
        ...entry,
        product: data,
      })
    } catch (error) {
      failed.push({
        ...entry,
        error: error?.message || String(error),
      })
    }
  }

  onProgress?.({
    completed: updatePlans.length,
    total: updatePlans.length,
  })

  return {
    updated,
    unchanged,
    failed,
    fieldUpdateCount,
    brandsAffected: [...brands].sort(),
    batchId: plan.batchId,
    error: null,
  }
}
