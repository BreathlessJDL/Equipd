import { isSupabaseConfigured, supabase } from './supabase.js'
import {
  buildCoreProductAuditReport,
  buildCoreProductGroupingPayload,
  buildCoreProductGroupExplanation,
  buildCoreProductGroupApprovalPayload,
  buildCoreProductGroups,
  buildCoreProductKeyFromFields,
  buildCoreProductName,
  buildPossibleRelatedClusters,
  CORE_PRODUCT_GROUP_STATUS,
  deriveCoreProductFields,
  expandCoreProductResearchTargets,
  isApprovableCoreProductGroup,
  isResearchDedupeEligibleGroup,
} from './intelligenceCoreProductGrouping.js'

export const CORE_PRODUCT_FIELDS_MINIMAL = [
  'id',
  'brand',
  'series',
  'model',
  'equipment_type',
  'slug',
  'best_original_price',
  'best_original_price_confidence',
  'best_original_price_currency',
  'baseline_manufacture_year',
  'baseline_manufacture_year_confidence',
  'baseline_manufacture_year_source',
  'manufacture_start_year',
  'manufacture_end_year',
].join(', ')

export const CORE_PRODUCT_FIELDS = `${CORE_PRODUCT_FIELDS_MINIMAL}, core_product_name, core_product_key, product_family, variant_type, variant_name, is_base_product, core_product_group_status, core_product_group_confidence, base_original_price, console_modifier_price, original_rrp, currency`

export async function fetchEquipmentIntelligenceForCoreProducts() {
  if (!isSupabaseConfigured || !supabase) {
    return { rows: [], error: new Error('Supabase is not configured.') }
  }

  const pageSize = 1000
  let from = 0
  const rows = []
  let selectFields = CORE_PRODUCT_FIELDS

  while (true) {
    const { data, error } = await supabase
      .from('equipment_intelligence')
      .select(selectFields)
      .order('brand')
      .order('model')
      .range(from, from + pageSize - 1)

    if (error?.message?.includes('core_product')) {
      if (selectFields !== CORE_PRODUCT_FIELDS_MINIMAL) {
        selectFields = CORE_PRODUCT_FIELDS_MINIMAL
        from = 0
        rows.length = 0
        continue
      }
      return { rows: [], error }
    }

    if (error) {
      return { rows: [], error }
    }

    if (!data?.length) break
    rows.push(...data)
    if (data.length < pageSize) break
    from += pageSize
  }

  return { rows, error: null }
}

export function buildCoreProductReviewData(rows = []) {
  const enrichedRows = rows.map((row) => ({
    ...row,
    suggested: deriveCoreProductFields(row),
  }))
  const groups = buildCoreProductGroups(enrichedRows)
  const audit = buildCoreProductAuditReport(enrichedRows)
  return { groups, audit, rows: enrichedRows }
}

export async function applySuggestedCoreProductGrouping(rows = []) {
  if (!isSupabaseConfigured || !supabase) {
    return { updated: 0, error: new Error('Supabase is not configured.') }
  }

  let updated = 0
  for (const row of rows) {
    const payload = buildCoreProductGroupingPayload(row)
    const { error } = await supabase
      .from('equipment_intelligence')
      .update(payload)
      .eq('id', row.id)
      .is('core_product_key', null)

    if (error) {
      return { updated, error }
    }
    updated += 1
  }

  return { updated, error: null }
}

export async function approveCoreProductGroup({
  coreProductKey,
  representativeEquipmentId,
  coreProductName = null,
}) {
  if (!isSupabaseConfigured || !supabase) {
    return { data: null, error: new Error('Supabase is not configured.') }
  }

  const { data, error } = await supabase.rpc('admin_approve_core_product_group', {
    p_core_product_key: coreProductKey,
    p_representative_equipment_id: representativeEquipmentId,
    p_core_product_name: coreProductName,
  })

  return { data, error }
}

export async function persistAndApproveCoreProductGroup({
  coreProductKey,
  representativeEquipmentId,
  members = [],
}) {
  if (!isSupabaseConfigured || !supabase) {
    return { data: null, error: new Error('Supabase is not configured.') }
  }

  const payload = members.map((member) => ({
    equipment_id: member.equipmentId,
    core_product_name: member.coreProductName ?? null,
    core_product_key: member.coreProductKey ?? coreProductKey,
    product_family: member.productFamily ?? null,
    variant_type: member.variantType ?? null,
    variant_name: member.variantName ?? null,
    core_product_group_confidence: member.coreProductGroupConfidence ?? null,
  }))

  const { data, error } = await supabase.rpc('admin_persist_and_approve_core_product_group', {
    p_core_product_key: coreProductKey,
    p_representative_equipment_id: representativeEquipmentId,
    p_members: payload,
  })

  return { data, error }
}

export async function bulkApproveCoreProductGroups(groups = []) {
  if (!isSupabaseConfigured || !supabase || !groups.length) {
    return {
      approved: 0,
      skipped: 0,
      skippedAlreadyApproved: 0,
      failures: [],
      error: null,
    }
  }

  let approved = 0
  let skipped = 0
  let skippedAlreadyApproved = 0
  const failures = []

  for (const group of groups) {
    if (group.group_status === CORE_PRODUCT_GROUP_STATUS.APPROVED) {
      skipped += 1
      skippedAlreadyApproved += 1
      continue
    }

    if (!isApprovableCoreProductGroup(group)) {
      skipped += 1
      continue
    }

    const payload = buildCoreProductGroupApprovalPayload(group)
    if (!payload.representativeEquipmentId || !payload.coreProductKey) {
      skipped += 1
      continue
    }

    const result = await persistAndApproveCoreProductGroup(payload)
    if (result.error) {
      failures.push({ coreProductKey: group.core_product_key, error: result.error })
      continue
    }
    approved += 1
  }

  return {
    approved,
    skipped,
    skippedAlreadyApproved,
    failures,
    error: failures.length && approved === 0 ? failures[0].error : null,
  }
}

export async function markCoreProductMembersNotDuplicate(equipmentIds = []) {
  if (!isSupabaseConfigured || !supabase) {
    return { data: null, error: new Error('Supabase is not configured.') }
  }

  const { data, error } = await supabase.rpc('admin_mark_core_product_members_not_duplicate', {
    p_equipment_ids: equipmentIds,
  })

  return { data, error }
}

export async function excludeCoreProductMember(equipmentId) {
  if (!isSupabaseConfigured || !supabase) {
    return { error: new Error('Supabase is not configured.') }
  }

  const { error } = await supabase.rpc('admin_exclude_core_product_member', {
    p_equipment_id: equipmentId,
  })

  return { error }
}

export async function updateCoreProductMember({
  equipmentId,
  coreProductName,
  coreProductKey,
  productFamily,
  variantType,
  variantName,
  isBaseProduct,
  coreProductGroupConfidence,
}) {
  if (!isSupabaseConfigured || !supabase) {
    return { data: null, error: new Error('Supabase is not configured.') }
  }

  const { data, error } = await supabase.rpc('admin_update_core_product_member', {
    p_equipment_id: equipmentId,
    p_core_product_name: coreProductName ?? null,
    p_core_product_key: coreProductKey ?? null,
    p_product_family: productFamily ?? null,
    p_variant_type: variantType ?? null,
    p_variant_name: variantName ?? null,
    p_is_base_product: isBaseProduct ?? null,
    p_core_product_group_confidence: coreProductGroupConfidence ?? null,
  })

  return { data, error }
}

export {
  buildCoreProductAuditReport,
  buildCoreProductGroupApprovalPayload,
  buildCoreProductGroupExplanation,
  buildCoreProductGroups,
  buildCoreProductKeyFromFields,
  buildCoreProductName,
  buildPossibleRelatedClusters,
  deriveCoreProductFields,
  expandCoreProductResearchTargets,
  isApprovableCoreProductGroup,
  isResearchDedupeEligibleGroup,
}
