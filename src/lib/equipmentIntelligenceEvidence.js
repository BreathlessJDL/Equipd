import { isSupabaseConfigured, supabase } from './supabase'
import { persistCanonicalProductResearchApproval } from './equipmentProducts.js'
import { fetchPrioritySyncRanking } from './intelligenceMarketSearch'
import {
  BASELINE_MANUFACTURE_YEAR_SOURCE,
  buildBaselineManufactureYearPatch,
  buildResearchApprovedBaselineFields,
  deriveBaselineManufactureYearStatus,
  formatBaselineManufactureYearSource,
  formatBaselineManufactureYearStatus,
  getDepreciationManufactureYear,
} from './baselineManufactureYear'

export const EVIDENCE_VERIFIED_CONFIDENCE_THRESHOLD = 90
export const EQUIPD_DEFAULT_VALUATION_CURRENCY = 'GBP'

export const EVIDENCE_SOURCE_TYPES = [
  {
    id: 'manufacturer_pdf',
    label: 'Official manufacturer PDF / price list',
    defaultConfidence: 100,
  },
  {
    id: 'official_website',
    label: 'Official website / archive',
    defaultConfidence: 95,
  },
  {
    id: 'dealer_catalogue',
    label: 'Dealer / distributor catalogue',
    defaultConfidence: 90,
  },
  {
    id: 'dealer_product_page',
    label: 'Dealer product page',
    defaultConfidence: 80,
  },
  {
    id: 'trade_publication',
    label: 'Trade publication',
    defaultConfidence: 70,
  },
  {
    id: 'forum_estimate',
    label: 'Forum / manual estimate',
    defaultConfidence: 50,
  },
  {
    id: 'manual_estimate',
    label: 'Manual estimate',
    defaultConfidence: 40,
  },
]

const EVIDENCE_EQUIPMENT_FIELDS = `
  id,
  brand,
  series,
  model,
  slug,
  equipment_type,
  manufacture_year,
  original_rrp,
  currency,
  best_original_price,
  best_original_price_currency,
  best_original_price_confidence,
  best_original_price_source_id,
  best_original_price_updated_at,
  manufacture_start_year,
  manufacture_end_year,
  manufacture_year_confidence,
  manufacture_year_source_id,
  lifecycle_updated_at,
  baseline_manufacture_year,
  baseline_manufacture_year_confidence,
  baseline_manufacture_year_source,
  baseline_manufacture_year_updated_at
`.replace(/\s+/g, ' ').trim()

const PRICE_SOURCE_FIELDS = `
  id,
  equipment_id,
  price,
  currency,
  price_year,
  source_type,
  source_name,
  source_url,
  confidence,
  notes,
  created_at,
  updated_at
`.replace(/\s+/g, ' ').trim()

export const IN_QUERY_CHUNK_SIZE = 100

export function chunkArray(items, chunkSize = IN_QUERY_CHUNK_SIZE) {
  if (!Array.isArray(items) || items.length === 0) return []
  const size = Math.max(1, Math.floor(chunkSize))
  const chunks = []
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size))
  }
  return chunks
}

export function dedupeRowsById(rows = []) {
  return [...new Map(rows.map((row) => [row.id, row])).values()]
}

function formatInQueryChunkError(label, chunkIndex, chunkCount, chunkIds, totalIds, error) {
  const idRangeStart = chunkIndex * IN_QUERY_CHUNK_SIZE + 1
  const idRangeEnd = idRangeStart + chunkIds.length - 1
  const chunkLabel = `${chunkIndex + 1}/${chunkCount}`
  const message = error?.message || 'Request failed'
  return new Error(
    `${label} query chunk ${chunkLabel} failed (equipment IDs ${idRangeStart}-${idRangeEnd} of ${totalIds}): ${message}`,
  )
}

async function selectInIdChunks({ table, select, column, ids, label }) {
  const chunks = chunkArray(ids)
  const merged = []

  for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex += 1) {
    const chunkIds = chunks[chunkIndex]
    const { data, error } = await supabase
      .from(table)
      .select(select)
      .in(column, chunkIds)

    if (error) {
      return {
        data: null,
        error: formatInQueryChunkError(label, chunkIndex, chunks.length, chunkIds, ids.length, error),
      }
    }

    merged.push(...(data ?? []))
  }

  return { data: merged, error: null }
}

const LIFECYCLE_SOURCE_FIELDS = `
  id,
  equipment_id,
  manufacture_start_year,
  manufacture_end_year,
  source_type,
  source_name,
  source_url,
  confidence,
  notes,
  created_at,
  updated_at
`.replace(/\s+/g, ' ').trim()

export function getDefaultConfidenceForSourceType(sourceType) {
  const match = EVIDENCE_SOURCE_TYPES.find((entry) => entry.id === sourceType)
  return match?.defaultConfidence ?? 40
}

export function getSourceTypeLabel(sourceType) {
  const match = EVIDENCE_SOURCE_TYPES.find((entry) => entry.id === sourceType)
  return match?.label ?? sourceType ?? '—'
}

export function deriveEvidenceStatus({
  bestValuePresent = false,
  confidence = null,
  sourceCount = 0,
}) {
  if (!bestValuePresent && sourceCount === 0) {
    return 'missing'
  }

  if (!bestValuePresent && sourceCount > 0) {
    return 'needs_review'
  }

  const numericConfidence = Number(confidence)
  if (Number.isFinite(numericConfidence) && numericConfidence >= EVIDENCE_VERIFIED_CONFIDENCE_THRESHOLD) {
    return 'verified'
  }

  return 'needs_review'
}

export function derivePriceEvidenceStatus(equipment, priceSourceCount = 0) {
  const hasPrice = Number.isFinite(Number(equipment?.best_original_price))
    && Number(equipment.best_original_price) > 0

  if (!hasPrice && priceSourceCount === 0) {
    return 'missing'
  }

  if (!hasPrice && priceSourceCount > 0) {
    return 'needs_review'
  }

  const currency = (
    equipment?.best_original_price_currency
    || equipment?.currency
    || ''
  ).toUpperCase()

  if (currency && currency !== EQUIPD_DEFAULT_VALUATION_CURRENCY) {
    return 'needs_review'
  }

  return deriveEvidenceStatus({
    bestValuePresent: hasPrice,
    confidence: equipment?.best_original_price_confidence,
    sourceCount: priceSourceCount,
  })
}

export function deriveLifecycleEvidenceStatus(equipment, lifecycleSourceCount = 0) {
  const hasBaselineYear = equipment?.baseline_manufacture_year != null
  const hasProductionPeriod = equipment?.manufacture_start_year != null
    || equipment?.manufacture_end_year != null

  if (hasBaselineYear) {
    const baselineStatus = deriveBaselineManufactureYearStatus(equipment)
    if (baselineStatus === 'verified') {
      return 'verified'
    }
    if (baselineStatus === 'estimated') {
      return 'needs_review'
    }
  }

  return deriveEvidenceStatus({
    bestValuePresent: hasBaselineYear || hasProductionPeriod,
    confidence: equipment?.baseline_manufacture_year_confidence
      ?? equipment?.manufacture_year_confidence,
    sourceCount: lifecycleSourceCount,
  })
}

export function patchPriorityGroupAfterEquipmentUpdate(group, equipmentId, equipmentPatch) {
  if (!group?.equipment_ids?.includes(equipmentId)) {
    return group
  }

  const patch = equipmentPatch ?? {}
  const priceSourceCount = group.priceSourceCount ?? 0
  const lifecycleSourceCount = group.lifecycleSourceCount ?? 0
  let updated = { ...group }

  const hasNewPrice = Number(patch.best_original_price) > 0
  const currentPriceConfidence = Number(group.best_original_price_confidence ?? 0)
  const newPriceConfidence = Number(patch.best_original_price_confidence ?? 0)
  const shouldUpdatePrice = hasNewPrice && (
    equipmentId === group.representative_equipment_id
    || newPriceConfidence >= currentPriceConfidence
    || !(Number(group.best_original_price) > 0)
  )

  if (shouldUpdatePrice) {
    const priceEquipment = {
      best_original_price: patch.best_original_price,
      best_original_price_currency: patch.best_original_price_currency,
      best_original_price_confidence: patch.best_original_price_confidence,
      currency: patch.currency,
    }
    updated = {
      ...updated,
      best_original_price: patch.best_original_price,
      best_original_price_currency: patch.best_original_price_currency,
      best_original_price_confidence: patch.best_original_price_confidence,
      priceStatus: derivePriceEvidenceStatus(priceEquipment, priceSourceCount),
    }
  }

  const hasLifecycleUpdate = patch.baseline_manufacture_year != null
    || patch.manufacture_start_year != null
    || patch.manufacture_end_year != null

  if (hasLifecycleUpdate) {
    const lifecycleEquipment = {
      baseline_manufacture_year: patch.baseline_manufacture_year ?? group.baseline_manufacture_year,
      baseline_manufacture_year_confidence: patch.baseline_manufacture_year_confidence
        ?? group.baseline_manufacture_year_confidence,
      baseline_manufacture_year_source: patch.baseline_manufacture_year_source
        ?? group.baseline_manufacture_year_source,
      manufacture_start_year: patch.manufacture_start_year ?? group.manufacture_start_year,
      manufacture_end_year: patch.manufacture_end_year ?? group.manufacture_end_year,
      manufacture_year_confidence: patch.manufacture_year_confidence ?? group.manufacture_year_confidence,
    }
    updated = {
      ...updated,
      ...lifecycleEquipment,
      lifecycleStatus: deriveLifecycleEvidenceStatus(lifecycleEquipment, lifecycleSourceCount),
    }
  }

  return updated
}

export function patchPriorityGroupsAfterEquipmentUpdate(groups, equipmentId, equipmentPatch) {
  if (!Array.isArray(groups) || !equipmentId) {
    return groups ?? []
  }

  return groups.map((group) => patchPriorityGroupAfterEquipmentUpdate(
    group,
    equipmentId,
    equipmentPatch,
  ))
}

export {
  deriveBaselineManufactureYearStatus,
  formatBaselineManufactureYearSource,
  formatBaselineManufactureYearStatus,
  getDepreciationManufactureYear,
}

export function formatEvidenceStatusLabel(status) {
  if (status === 'verified') return 'Verified'
  if (status === 'converted') return 'Converted from USD'
  if (status === 'needs_review') return 'Needs review'
  return 'Missing'
}

export function formatBestOriginalPrice(equipment) {
  const price = Number(equipment?.best_original_price)
  if (!Number.isFinite(price) || price <= 0) return '—'

  const currency = equipment?.best_original_price_currency || equipment?.currency
  if (!currency) return `${price.toLocaleString('en-GB')} (currency unknown)`

  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(price)
}

export function formatManufactureYearRange(equipment) {
  const start = equipment?.manufacture_start_year
  const end = equipment?.manufacture_end_year

  if (start != null && end != null) {
    if (start === end) return String(start)
    return `${start}–${end}`
  }

  if (start != null) return `${start}–`
  if (end != null) return `–${end}`
  return '—'
}

export function formatBaselineManufactureYear(equipment) {
  const year = equipment?.baseline_manufacture_year
  return year != null ? String(year) : '—'
}

function emptyEquipmentEvidence(equipmentId) {
  return {
    equipment: null,
    priceSources: [],
    lifecycleSources: [],
    priceSourceCount: 0,
    lifecycleSourceCount: 0,
    priceStatus: 'missing',
    lifecycleStatus: 'missing',
    error: new Error('Supabase is not configured.'),
  }
}

export async function fetchPriorityEvidenceGroups(limit = 100, queueScanLimit = 200) {
  const priorityResult = await fetchPrioritySyncRanking(queueScanLimit)
  if (priorityResult.error) {
    return { groups: [], allRankedGroups: [], totalScored: 0, error: priorityResult.error }
  }

  const topGroups = priorityResult.data?.top ?? []
  const displayGroups = topGroups.slice(0, limit)
  const equipmentIds = [...new Set(topGroups.flatMap((group) => group.equipment_ids ?? []))]

  if (!isSupabaseConfigured || !supabase || equipmentIds.length === 0) {
    return {
      groups: topGroups.map((group) => ({
        ...group,
        representative_equipment_id: group.equipment_ids?.[0] ?? null,
        priceStatus: 'missing',
        lifecycleStatus: 'missing',
        best_original_price: null,
        manufacture_start_year: null,
        manufacture_end_year: null,
        baseline_manufacture_year: null,
      })),
      totalScored: priorityResult.data?.total_scored ?? 0,
      error: equipmentIds.length === 0 ? null : new Error('Supabase is not configured.'),
    }
  }

  const { data: equipmentRows, error: equipmentError } = await selectInIdChunks({
    table: 'equipment_intelligence',
    select: EVIDENCE_EQUIPMENT_FIELDS,
    column: 'id',
    ids: equipmentIds,
    label: 'equipment_intelligence',
  })

  if (equipmentError) {
    return { groups: [], allRankedGroups: [], totalScored: 0, error: equipmentError }
  }

  const equipmentById = new Map(dedupeRowsById(equipmentRows).map((row) => [row.id, row]))

  const { data: priceCounts, error: priceCountError } = await selectInIdChunks({
    table: 'equipment_price_sources',
    select: 'equipment_id',
    column: 'equipment_id',
    ids: equipmentIds,
    label: 'equipment_price_sources',
  })

  if (priceCountError) {
    return { groups: [], allRankedGroups: [], totalScored: 0, error: priceCountError }
  }

  const { data: lifecycleCounts, error: lifecycleCountError } = await selectInIdChunks({
    table: 'equipment_lifecycle_sources',
    select: 'equipment_id',
    column: 'equipment_id',
    ids: equipmentIds,
    label: 'equipment_lifecycle_sources',
  })

  if (lifecycleCountError) {
    return { groups: [], allRankedGroups: [], totalScored: 0, error: lifecycleCountError }
  }

  const priceCountByEquipment = new Map()
  for (const row of priceCounts ?? []) {
    priceCountByEquipment.set(row.equipment_id, (priceCountByEquipment.get(row.equipment_id) ?? 0) + 1)
  }

  const lifecycleCountByEquipment = new Map()
  for (const row of lifecycleCounts ?? []) {
    lifecycleCountByEquipment.set(
      row.equipment_id,
      (lifecycleCountByEquipment.get(row.equipment_id) ?? 0) + 1,
    )
  }

  const enrichPriorityGroup = (group) => {
    const memberEquipment = (group.equipment_ids ?? [])
      .map((id) => equipmentById.get(id))
      .filter(Boolean)

    const representative = memberEquipment[0] ?? null
    const priceSourceCount = (group.equipment_ids ?? []).reduce(
      (sum, id) => sum + (priceCountByEquipment.get(id) ?? 0),
      0,
    )
    const lifecycleSourceCount = (group.equipment_ids ?? []).reduce(
      (sum, id) => sum + (lifecycleCountByEquipment.get(id) ?? 0),
      0,
    )

    const bestPriceEquipment = memberEquipment
      .filter((row) => Number(row.best_original_price) > 0)
      .sort((left, right) => (
        Number(right.best_original_price_confidence ?? 0)
        - Number(left.best_original_price_confidence ?? 0)
      ))[0] ?? representative

    const bestLifecycleEquipment = memberEquipment
      .filter((row) => row.baseline_manufacture_year != null
        || row.manufacture_start_year != null
        || row.manufacture_end_year != null)
      .sort((left, right) => (
        Number(right.baseline_manufacture_year_confidence
          ?? right.manufacture_year_confidence ?? 0)
        - Number(left.baseline_manufacture_year_confidence
          ?? left.manufacture_year_confidence ?? 0)
      ))[0] ?? representative

    return {
      ...group,
      representative_equipment_id: representative?.id ?? group.equipment_ids?.[0] ?? null,
      best_original_price: bestPriceEquipment?.best_original_price ?? null,
      best_original_price_currency: bestPriceEquipment?.best_original_price_currency ?? null,
      best_original_price_confidence: bestPriceEquipment?.best_original_price_confidence ?? null,
      baseline_manufacture_year: bestLifecycleEquipment?.baseline_manufacture_year ?? null,
      baseline_manufacture_year_confidence: bestLifecycleEquipment?.baseline_manufacture_year_confidence ?? null,
      baseline_manufacture_year_source: bestLifecycleEquipment?.baseline_manufacture_year_source ?? null,
      manufacture_start_year: bestLifecycleEquipment?.manufacture_start_year ?? null,
      manufacture_end_year: bestLifecycleEquipment?.manufacture_end_year ?? null,
      manufacture_year_confidence: bestLifecycleEquipment?.manufacture_year_confidence ?? null,
      priceSourceCount,
      lifecycleSourceCount,
      priceStatus: derivePriceEvidenceStatus(bestPriceEquipment, priceSourceCount),
      lifecycleStatus: deriveLifecycleEvidenceStatus(bestLifecycleEquipment, lifecycleSourceCount),
    }
  }

  const groups = displayGroups.map(enrichPriorityGroup)

  return {
    groups,
    allRankedGroups: topGroups.map(enrichPriorityGroup),
    totalScored: priorityResult.data?.total_scored ?? 0,
    error: null,
  }
}

export async function fetchEquipmentEvidenceDetail(equipmentId) {
  if (!isSupabaseConfigured || !supabase) {
    return emptyEquipmentEvidence(equipmentId)
  }

  const [equipmentResult, priceResult, lifecycleResult] = await Promise.all([
    supabase
      .from('equipment_intelligence')
      .select(EVIDENCE_EQUIPMENT_FIELDS)
      .eq('id', equipmentId)
      .maybeSingle(),
    supabase
      .from('equipment_price_sources')
      .select(PRICE_SOURCE_FIELDS)
      .eq('equipment_id', equipmentId)
      .order('confidence', { ascending: false })
      .order('updated_at', { ascending: false }),
    supabase
      .from('equipment_lifecycle_sources')
      .select(LIFECYCLE_SOURCE_FIELDS)
      .eq('equipment_id', equipmentId)
      .order('confidence', { ascending: false })
      .order('updated_at', { ascending: false }),
  ])

  if (equipmentResult.error) {
    return {
      equipment: null,
      priceSources: [],
      lifecycleSources: [],
      priceSourceCount: 0,
      lifecycleSourceCount: 0,
      priceStatus: 'missing',
      lifecycleStatus: 'missing',
      error: equipmentResult.error,
    }
  }

  if (priceResult.error) {
    return {
      equipment: equipmentResult.data,
      priceSources: [],
      lifecycleSources: [],
      priceSourceCount: 0,
      lifecycleSourceCount: 0,
      priceStatus: 'missing',
      lifecycleStatus: 'missing',
      error: priceResult.error,
    }
  }

  if (lifecycleResult.error) {
    return {
      equipment: equipmentResult.data,
      priceSources: priceResult.data ?? [],
      lifecycleSources: [],
      priceSourceCount: priceResult.data?.length ?? 0,
      lifecycleSourceCount: 0,
      priceStatus: 'missing',
      lifecycleStatus: 'missing',
      error: lifecycleResult.error,
    }
  }

  const equipment = equipmentResult.data
  const priceSources = priceResult.data ?? []
  const lifecycleSources = lifecycleResult.data ?? []

  return {
    equipment,
    priceSources,
    lifecycleSources,
    priceSourceCount: priceSources.length,
    lifecycleSourceCount: lifecycleSources.length,
    priceStatus: derivePriceEvidenceStatus(equipment, priceSources.length),
    lifecycleStatus: deriveLifecycleEvidenceStatus(equipment, lifecycleSources.length),
    error: null,
  }
}

async function invokeEvidenceRpc(functionName, params) {
  if (!isSupabaseConfigured || !supabase) {
    return { data: null, error: new Error('Supabase is not configured.') }
  }

  const { data, error } = await supabase.rpc(functionName, params)
  return { data, error }
}

export async function upsertPriceSource(payload) {
  return invokeEvidenceRpc('admin_upsert_equipment_price_source', {
    p_payload: payload,
  })
}

export async function deletePriceSource(sourceId) {
  return invokeEvidenceRpc('admin_delete_equipment_price_source', {
    p_source_id: sourceId,
  })
}

export async function setBestPriceSource(equipmentId, sourceId) {
  return invokeEvidenceRpc('admin_set_best_equipment_price_source', {
    p_equipment_id: equipmentId,
    p_source_id: sourceId,
  })
}

export async function recalculateBestPriceSource(equipmentId) {
  return invokeEvidenceRpc('admin_recalculate_equipment_price_best', {
    p_equipment_id: equipmentId,
  })
}

export async function upsertLifecycleSource(payload) {
  return invokeEvidenceRpc('admin_upsert_equipment_lifecycle_source', {
    p_payload: payload,
  })
}

export async function deleteLifecycleSource(sourceId) {
  return invokeEvidenceRpc('admin_delete_equipment_lifecycle_source', {
    p_source_id: sourceId,
  })
}

export async function setBestLifecycleSource(equipmentId, sourceId) {
  return invokeEvidenceRpc('admin_set_best_equipment_lifecycle_source', {
    p_equipment_id: equipmentId,
    p_source_id: sourceId,
  })
}

export async function recalculateBestLifecycleSource(equipmentId) {
  return invokeEvidenceRpc('admin_recalculate_equipment_lifecycle_best', {
    p_equipment_id: equipmentId,
  })
}

export function buildEmptyPriceSourceForm(equipmentId) {
  return {
    id: '',
    equipment_id: equipmentId,
    price: '',
    currency: 'GBP',
    price_year: '',
    source_type: 'manual_estimate',
    source_name: '',
    source_url: '',
    confidence: String(getDefaultConfidenceForSourceType('manual_estimate')),
    notes: '',
    mark_as_best: false,
  }
}

export function buildEmptyLifecycleSourceForm(equipmentId, equipment = null) {
  return {
    id: '',
    equipment_id: equipmentId,
    baseline_manufacture_year: equipment?.baseline_manufacture_year != null
      ? String(equipment.baseline_manufacture_year)
      : '',
    manufacture_start_year: equipment?.manufacture_start_year != null
      ? String(equipment.manufacture_start_year)
      : '',
    manufacture_end_year: equipment?.manufacture_end_year != null
      ? String(equipment.manufacture_end_year)
      : '',
    source_type: 'manual_estimate',
    source_name: '',
    source_url: '',
    confidence: equipment?.baseline_manufacture_year_confidence != null
      ? String(equipment.baseline_manufacture_year_confidence)
      : equipment?.manufacture_year_confidence != null
        ? String(equipment.manufacture_year_confidence)
        : String(getDefaultConfidenceForSourceType('manual_estimate')),
    notes: '',
    mark_as_best: false,
  }
}

export function priceSourceToForm(source) {
  return {
    id: source?.id ?? '',
    equipment_id: source?.equipment_id ?? '',
    price: source?.price != null ? String(source.price) : '',
    currency: source?.currency || 'GBP',
    price_year: source?.price_year != null ? String(source.price_year) : '',
    source_type: source?.source_type || 'manual_estimate',
    source_name: source?.source_name || '',
    source_url: source?.source_url || '',
    confidence: source?.confidence != null ? String(source.confidence) : '',
    notes: source?.notes || '',
    mark_as_best: false,
  }
}

export function lifecycleSourceToForm(source, equipment = null) {
  return {
    id: source?.id ?? '',
    equipment_id: source?.equipment_id ?? '',
    baseline_manufacture_year: equipment?.baseline_manufacture_year != null
      ? String(equipment.baseline_manufacture_year)
      : '',
    manufacture_start_year: source?.manufacture_start_year != null
      ? String(source.manufacture_start_year)
      : '',
    manufacture_end_year: source?.manufacture_end_year != null
      ? String(source.manufacture_end_year)
      : '',
    source_type: source?.source_type || 'manual_estimate',
    source_name: source?.source_name || '',
    source_url: source?.source_url || '',
    confidence: source?.confidence != null ? String(source.confidence) : '',
    notes: source?.notes || '',
    mark_as_best: false,
  }
}

export function buildPriceSourcePayload(form) {
  return {
    id: form.id || undefined,
    equipment_id: form.equipment_id,
    price: Number(form.price),
    currency: form.currency || 'GBP',
    price_year: form.price_year ? Number(form.price_year) : null,
    source_type: form.source_type,
    source_name: form.source_name || null,
    source_url: form.source_url || null,
    confidence: form.confidence ? Number(form.confidence) : null,
    notes: form.notes || null,
  }
}

export function buildLifecycleSourcePayload(form) {
  return {
    id: form.id || undefined,
    equipment_id: form.equipment_id,
    manufacture_start_year: form.manufacture_start_year
      ? Number(form.manufacture_start_year)
      : null,
    manufacture_end_year: form.manufacture_end_year
      ? Number(form.manufacture_end_year)
      : null,
    source_type: form.source_type,
    source_name: form.source_name || null,
    source_url: form.source_url || null,
    confidence: form.confidence ? Number(form.confidence) : null,
    notes: form.notes || null,
  }
}

export async function updateEquipmentBaselineManufactureYear(
  equipmentId,
  { year, confidence },
) {
  if (!isSupabaseConfigured || !supabase) {
    return { data: null, error: new Error('Supabase is not configured.') }
  }

  const patch = buildBaselineManufactureYearPatch({
    year,
    confidence,
    source: BASELINE_MANUFACTURE_YEAR_SOURCE.ADMIN_LIFECYCLE_SOURCE,
  })

  if (!patch) {
    return { data: null, error: new Error('Baseline manufacture year is required.') }
  }

  const { data, error } = await supabase
    .from('equipment_intelligence')
    .update({
      ...patch,
      updated_at: new Date().toISOString(),
    })
    .eq('id', equipmentId)
    .select(`
      id,
      baseline_manufacture_year,
      baseline_manufacture_year_confidence,
      baseline_manufacture_year_source,
      baseline_manufacture_year_updated_at
    `)
    .maybeSingle()

  return { data, error }
}

export async function saveManualPriceEvidence(form, { markAsBest = false } = {}) {
  const upsertResult = await upsertPriceSource(buildPriceSourcePayload(form))
  if (upsertResult.error) {
    return upsertResult
  }

  const sourceId = upsertResult.data?.source_id
  if (markAsBest && sourceId) {
    const bestResult = await setBestPriceSource(form.equipment_id, sourceId)
    if (bestResult.error) {
      return bestResult
    }
  }

  return upsertResult
}

export async function saveManualLifecycleEvidence(form, { markAsBest = false } = {}) {
  const hasLifecycleYears = Boolean(form.manufacture_start_year || form.manufacture_end_year)
  const hasBaselineYear = Boolean(form.baseline_manufacture_year)

  if (!hasLifecycleYears && !hasBaselineYear) {
    return {
      data: null,
      error: new Error('Enter a baseline year and/or production start/end years.'),
    }
  }

  let sourceId = null

  if (hasLifecycleYears) {
    const upsertResult = await upsertLifecycleSource(buildLifecycleSourcePayload(form))
    if (upsertResult.error) {
      return upsertResult
    }
    sourceId = upsertResult.data?.source_id

    if (markAsBest && sourceId) {
      const bestResult = await setBestLifecycleSource(form.equipment_id, sourceId)
      if (bestResult.error) {
        return bestResult
      }
    }
  }

  if (hasBaselineYear) {
    const baselineResult = await updateEquipmentBaselineManufactureYear(form.equipment_id, {
      year: form.baseline_manufacture_year,
      confidence: form.confidence,
    })
    if (baselineResult.error) {
      return baselineResult
    }
  }

  return { data: { source_id: sourceId }, error: null }
}

export function formatResearchProductionPeriod(recommendation) {
  return formatManufactureYearRange({
    manufacture_start_year: recommendation?.production_start_year
      ?? recommendation?.baseline_manufacture_year,
    manufacture_end_year: recommendation?.production_end_year,
  })
}

export function formatResearchOriginalPrice(recommendation) {
  const details = getResearchOfficialPriceDetails(recommendation)
  if (details.isOfficialUsd && details.convertedGbp) {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: EQUIPD_DEFAULT_VALUATION_CURRENCY,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(details.convertedGbp)
  }

  const price = Number(
    recommendation?.source_original_price ?? recommendation?.original_new_price,
  )
  if (!Number.isFinite(price) || price <= 0) return '—'

  const currency = (
    recommendation?.source_original_currency
    || recommendation?.currency
  )
  if (!currency) return `${price.toLocaleString('en-GB')} (currency unknown)`

  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(price)
}

export function getResearchValuationPriceGbp(recommendation) {
  const convertedGbp = Number(recommendation?.converted_original_price_gbp)
  if (Number.isFinite(convertedGbp) && convertedGbp > 0) {
    return convertedGbp
  }

  const sourceCurrency = (
    recommendation?.source_original_currency
    || recommendation?.currency
    || ''
  ).toUpperCase()
  const sourcePrice = Number(
    recommendation?.source_original_price ?? recommendation?.original_new_price,
  )

  if (sourceCurrency === EQUIPD_DEFAULT_VALUATION_CURRENCY
    && Number.isFinite(sourcePrice)
    && sourcePrice > 0) {
    return sourcePrice
  }

  return null
}

export function isNonGbpResearchPrice(recommendation) {
  const currency = (
    recommendation?.source_original_currency
    || recommendation?.currency
  )?.toUpperCase()
  return Boolean(currency && currency !== EQUIPD_DEFAULT_VALUATION_CURRENCY)
}

export function getResearchOfficialPriceDetails(recommendation) {
  const currency = (
    recommendation?.source_original_currency
    || recommendation?.currency
    || ''
  ).toUpperCase()
  const price = Number(
    recommendation?.source_original_price ?? recommendation?.original_new_price,
  )
  const convertedGbp = Number(recommendation?.converted_original_price_gbp)
  const exchangeRate = Number(recommendation?.exchange_rate_used)
  const hasPrice = Number.isFinite(price) && price > 0
  const hasSuggestedGbp = Number.isFinite(convertedGbp) && convertedGbp > 0
  const isOfficialUsd = currency === 'USD' && hasPrice && hasSuggestedGbp

  return {
    currency,
    price: hasPrice ? price : null,
    convertedGbp: hasSuggestedGbp ? convertedGbp : null,
    exchangeRate: Number.isFinite(exchangeRate) && exchangeRate > 0 ? exchangeRate : null,
    exchangeRateDate: recommendation?.exchange_rate_date || null,
    conversionMethod: recommendation?.conversion_method || null,
    conversionNotes: recommendation?.conversion_notes || null,
    isOfficialUsd,
    reviewReason: isOfficialUsd
      ? 'Official manufacturer price, converted from USD.'
      : null,
    usdReviewWarning: isOfficialUsd
      ? 'Official price is USD — converted GBP requires review.'
      : null,
  }
}

export function formatResearchOfficialSourcePrice(recommendation) {
  const details = getResearchOfficialPriceDetails(recommendation)
  if (!details.price || !details.currency) return '—'

  const formatted = new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: details.currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(details.price)

  return `${formatted} ${details.currency}`
}

export function formatResearchSuggestedGbpEquivalent(recommendation) {
  const details = getResearchOfficialPriceDetails(recommendation)
  if (!details.convertedGbp) return '—'

  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: EQUIPD_DEFAULT_VALUATION_CURRENCY,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(details.convertedGbp)
}

export function getResearchPriceCurrencyDebug(researchMeta) {
  return researchMeta?.debug_log?.price_currency_debug
    ?? researchMeta?.price_currency_debug
    ?? null
}

export function deriveResearchPriceReviewStatus(recommendation) {
  const sourcePrice = Number(
    recommendation?.source_original_price ?? recommendation?.original_new_price,
  )
  if (!Number.isFinite(sourcePrice) || sourcePrice <= 0) {
    return 'missing'
  }

  if (recommendation?.price_review_status === 'converted') {
    return 'converted'
  }

  const sourceCurrency = (
    recommendation?.source_original_currency
    || recommendation?.currency
    || ''
  ).toUpperCase()
  const convertedGbp = Number(recommendation?.converted_original_price_gbp)
  if (sourceCurrency === 'USD'
    && Number.isFinite(convertedGbp)
    && convertedGbp > 0) {
    return 'converted'
  }

  if (isNonGbpResearchPrice(recommendation)) {
    return 'needs_review'
  }

  const confidence = Number(recommendation?.price_confidence ?? recommendation?.confidence)
  if (Number.isFinite(confidence) && confidence >= EVIDENCE_VERIFIED_CONFIDENCE_THRESHOLD) {
    return 'verified'
  }

  return 'needs_review'
}

export function formatResearchHitEvidenceSummary(source = {}) {
  const parts = []

  if (source.price_evidence_kind === 'rrp_evidence') {
    parts.push(
      source.historical_rrp_price != null
        ? `RRP evidence (£${Number(source.historical_rrp_price).toLocaleString('en-GB')})`
        : 'RRP evidence',
    )
    if (source.ignored_used_prices?.length) {
      parts.push('Used price ignored')
    }
  } else if (source.price_evidence_kind === 'used_price_only') {
    parts.push('Used price ignored')
  }

  if (source.lifecycle_evidence_kind === 'lifecycle_evidence') {
    parts.push('Lifecycle evidence')
  }

  if (source.source_fetch_status === 'failed') {
    parts.push('Fetch failed')
  } else if (source.source_fetch_status === 'snippet_only') {
    parts.push('Snippet only')
  }

  return parts.length > 0 ? parts.join(' · ') : '—'
}

export function formatResearchSourceTypeLabel(sourceType) {
  switch (sourceType) {
    case 'manufacturer_pdf':
      return 'Official manufacturer PDF'
    case 'manufacturer_website':
      return 'Official manufacturer website'
    case 'official_distributor':
      return 'Official distributor'
    case 'dealer_catalogue':
      return 'Dealer catalogue'
    case 'dealer_historical_reference':
      return 'Dealer historical reference'
    case 'marketplace_resale':
      return 'Marketplace / resale'
    case 'archived_website':
      return 'Archived website'
    case 'specialist_support':
      return 'Specialist support / parts company'
    default:
      return 'Other'
  }
}

export function mapSearchHitsToResearchSources(searchHits = []) {
  return searchHits
    .map((hit) => ({
      title: hit?.title || hit?.url,
      domain: hit?.domain || '',
      url: hit?.url,
      source_type: hit?.source_type || 'other',
    }))
    .filter((source) => source.url)
}

export function getResearchAiInputSources(researchMeta) {
  if (researchMeta?.ai_input_sources?.length) {
    return researchMeta.ai_input_sources
  }

  if (researchMeta?.debug_log?.ranked_sources?.length) {
    return researchMeta.debug_log.ranked_sources.map((source) => ({
      title: source.title,
      domain: source.domain || '',
      url: source.url,
      source_type: source.source_type || 'other',
    }))
  }

  return mapSearchHitsToResearchSources(researchMeta?.search_hits)
}

export function getResearchPriceInputSources(researchMeta) {
  if (researchMeta?.price_input_sources?.length) {
    return researchMeta.price_input_sources
  }

  if (researchMeta?.debug_log?.price_input_sources?.length) {
    return researchMeta.debug_log.price_input_sources
  }

  return []
}

export function getResearchLifecycleInputSources(researchMeta) {
  if (researchMeta?.lifecycle_input_sources?.length) {
    return researchMeta.lifecycle_input_sources
  }

  if (researchMeta?.debug_log?.lifecycle_input_sources?.length) {
    return researchMeta.debug_log.lifecycle_input_sources
  }

  return []
}

export function getResearchAiCitedSources(recommendation) {
  if (recommendation?.supporting_sources?.length) {
    return recommendation.supporting_sources
  }

  return (recommendation?.supporting_urls ?? [])
    .filter(Boolean)
    .map((url) => ({
      title: url,
      domain: '',
      url,
      source_type: 'other',
    }))
}

export function getCurrentResearchSnapshot(equipment) {
  if (!equipment) {
    return {
      originalPriceLabel: '—',
      productionPeriodLabel: '—',
      baselineYearLabel: '—',
      hasOriginalPrice: false,
      hasProductionPeriod: false,
      hasBaselineYear: false,
    }
  }

  const hasOriginalPrice = Number.isFinite(Number(equipment.best_original_price ?? equipment.original_rrp))
    && Number(equipment.best_original_price ?? equipment.original_rrp) > 0
  const hasProductionPeriod = equipment.manufacture_start_year != null
    || equipment.manufacture_end_year != null
  const hasBaselineYear = equipment.baseline_manufacture_year != null

  return {
    originalPriceLabel: hasOriginalPrice
      ? formatBestOriginalPrice({
        best_original_price: equipment.best_original_price ?? equipment.original_rrp,
        best_original_price_currency: equipment.best_original_price_currency ?? equipment.currency,
        currency: equipment.currency,
      })
      : '—',
    productionPeriodLabel: formatManufactureYearRange(equipment),
    baselineYearLabel: formatBaselineManufactureYear(equipment),
    hasOriginalPrice,
    hasProductionPeriod,
    hasBaselineYear,
  }
}

export function buildResearchApprovalDiff(currentEquipment, recommendation) {
  const current = getCurrentResearchSnapshot(currentEquipment)
  const suggestedPrice = formatResearchOriginalPrice(recommendation)
  const suggestedPeriod = formatResearchProductionPeriod(recommendation)

  const priceOverwrite = current.hasOriginalPrice
    && recommendation?.original_new_price != null
  const productionOverwrite = current.hasProductionPeriod
    && (recommendation?.production_start_year != null
      || recommendation?.production_end_year != null)

  const priceChanged = priceOverwrite
    && Number(currentEquipment?.best_original_price ?? currentEquipment?.original_rrp)
      !== Number(getResearchValuationPriceGbp(recommendation) ?? recommendation.original_new_price)

  const productionChanged = productionOverwrite
    && (
      currentEquipment?.manufacture_start_year !== recommendation?.production_start_year
      || currentEquipment?.manufacture_end_year !== recommendation?.production_end_year
    )

  let priceDifferenceLabel = null
  if (priceOverwrite && priceChanged) {
    const currentPrice = Number(currentEquipment?.best_original_price ?? currentEquipment?.original_rrp)
    const suggestedPrice = Number(
      getResearchValuationPriceGbp(recommendation) ?? recommendation.original_new_price,
    )
    const delta = suggestedPrice - currentPrice
    const currency = EQUIPD_DEFAULT_VALUATION_CURRENCY
    const formattedDelta = new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(Math.abs(delta))
    priceDifferenceLabel = delta === 0
      ? 'No change'
      : `${formattedDelta} ${delta > 0 ? 'higher' : 'lower'}`
  }

  let productionDifferenceLabel = null
  if (productionOverwrite && productionChanged) {
    productionDifferenceLabel = `${current.productionPeriodLabel} → ${suggestedPeriod}`
  }

  return {
    current,
    suggested: {
      originalPriceLabel: suggestedPrice,
      productionPeriodLabel: suggestedPeriod,
      priceConfidence: recommendation?.price_confidence ?? recommendation?.confidence ?? null,
      productionConfidence: recommendation?.production_confidence ?? recommendation?.confidence ?? null,
      overallConfidence: recommendation?.confidence ?? null,
      priceCurrency: recommendation?.currency ?? null,
      priceReviewStatus: deriveResearchPriceReviewStatus(recommendation),
    },
    nonGbpCurrencyWarning: isNonGbpResearchPrice(recommendation),
    priceChanged,
    productionChanged,
    priceDifferenceLabel,
    productionDifferenceLabel,
    showDiff: priceOverwrite || productionOverwrite,
  }
}

export function getResearchSourceIdentityScores(researchMeta) {
  return researchMeta?.debug_log?.source_identity_scores ?? []
}

export function formatResearchIdentityLevel(level) {
  switch (level) {
    case 'exact': return 'Exact'
    case 'possibly_related': return 'Possibly related'
    case 'weak': return 'Weak'
    case 'reject': return 'Reject'
    default: return level || '—'
  }
}

export function getResearchStructuredPriceEvidence(researchMeta) {
  return researchMeta?.debug_log?.structured_price_evidence
    ?? researchMeta?.structured_price_evidence
    ?? []
}

export function getResearchV3Metadata(researchMeta, recommendation) {
  return recommendation?.v3_metadata
    ?? researchMeta?.debug_log?.v3_metadata
    ?? null
}

export function getResearchStructuredLifecycleEvidence(researchMeta) {
  return researchMeta?.debug_log?.structured_lifecycle_evidence
    ?? researchMeta?.structured_lifecycle_evidence
    ?? []
}

export function isFastResearchMode(researchMeta, recommendation = null) {
  return researchMeta?.research_engine === 'fast'
    || researchMeta?.debug_log?.research_engine === 'fast'
    || recommendation?.v3_metadata?.research_engine === 'fast'
}

export function getResearchFastSourceHits(researchMeta) {
  return researchMeta?.debug_log?.fast_source_hits ?? []
}

export function formatLifecycleEvidenceType(type) {
  switch (type) {
    case 'launch': return 'Launch'
    case 'introduced': return 'Introduced'
    case 'production_period': return 'Production period'
    case 'discontinued': return 'Discontinued'
    case 'console_timeline': return 'Console timeline'
    case 'present': return 'Present'
    default: return type || 'Lifecycle'
  }
}

export function getResearchV3TrustedSourceSummary(researchMeta) {
  return researchMeta?.debug_log?.v3_trusted_source_summary ?? []
}

export function getResearchLifecycleQueryDebug(researchMeta) {
  return researchMeta?.debug_log?.v3_lifecycle_query_debug ?? []
}

export function getResearchTargetedLifecycleQueries(researchMeta) {
  return researchMeta?.debug_log?.v3_targeted_lifecycle_queries ?? []
}

export function formatTrustedSourceSummaryEntry(entry) {
  if (!entry) return '—'
  const parts = []
  if (entry.hits_returned > 0) parts.push(`${entry.hits_returned} hit${entry.hits_returned === 1 ? '' : 's'}`)
  if (entry.snippet_price_signals) parts.push('snippet price')
  if (entry.structured_evidence_count > 0) {
    parts.push(`${entry.structured_evidence_count} evidence`)
  }
  if (entry.evidence_labels?.length) {
    parts.push(entry.evidence_labels.join(', '))
  }
  if (entry.page_fetched) parts.push('page read')
  return parts.length > 0 ? parts.join(' · ') : 'no evidence'
}

export function buildResearchTargetPayload(queueEntry, product = null) {
  if (!queueEntry) return null

  const resolvedProduct = product ?? queueEntry.product ?? null
  const canonicalIdentity = resolvedProduct ? {
    brand: resolvedProduct.brand,
    product_family: resolvedProduct.product_family ?? null,
    model: resolvedProduct.model,
    equipment_type: resolvedProduct.equipment_type ?? null,
    canonical_product_name: resolvedProduct.canonical_product_name,
  } : null

  return {
    dedupe_eligible: Boolean(queueEntry.dedupeEligible),
    core_product_key: queueEntry.coreProductKey ?? queueEntry.canonicalProductKey ?? null,
    canonical_product_key: queueEntry.canonicalProductKey ?? null,
    product_id: queueEntry.productId ?? resolvedProduct?.id ?? null,
    member_count: queueEntry.memberCount ?? queueEntry.sourceRowCount ?? 1,
    price_scope: queueEntry.dedupeEligible ? 'base_machine' : 'variant_specific',
    canonical_identity: canonicalIdentity,
  }
}

const ADMIN_VERIFIED_PRICE_CONFIDENCE = 90

function isAdminVerifiedPriceRow(equipment) {
  const confidence = Number(equipment?.best_original_price_confidence)
  const price = Number(equipment?.best_original_price ?? equipment?.original_rrp)
  return Number.isFinite(price) && price > 0
    && Number.isFinite(confidence)
    && confidence >= ADMIN_VERIFIED_PRICE_CONFIDENCE
}

export function buildResearchApproveUpdate(recommendation, now = new Date().toISOString()) {
  const sourceCurrency = (
    recommendation?.source_original_currency
    || recommendation?.currency
  )?.toUpperCase()
  const sourcePrice = Number(
    recommendation?.source_original_price ?? recommendation?.original_new_price,
  )
  const convertedGbp = Number(recommendation?.converted_original_price_gbp)
  const priceConfidence = Number(
    recommendation?.price_confidence ?? recommendation?.confidence,
  )
  const productionConfidence = Number(
    recommendation?.production_confidence ?? recommendation?.confidence,
  )
  const hasPrice = Number.isFinite(sourcePrice) && sourcePrice > 0
  const hasStartYear = recommendation?.production_start_year != null
  const hasEndYear = recommendation?.production_end_year != null

  const update = {
    updated_at: now,
  }

  if (hasPrice) {
    if (sourceCurrency === 'USD') {
      const valuationGbp = Number.isFinite(convertedGbp) && convertedGbp > 0
        ? convertedGbp
        : null
      if (!valuationGbp) {
        throw new Error('USD research price is missing a converted GBP valuation.')
      }
      update.original_rrp = sourcePrice
      update.currency = 'USD'
      update.best_original_price = valuationGbp
      update.best_original_price_currency = EQUIPD_DEFAULT_VALUATION_CURRENCY
    } else {
      const resolvedCurrency = sourceCurrency || EQUIPD_DEFAULT_VALUATION_CURRENCY
      const valuationGbp = resolvedCurrency === EQUIPD_DEFAULT_VALUATION_CURRENCY
        ? sourcePrice
        : (Number.isFinite(convertedGbp) && convertedGbp > 0 ? convertedGbp : null)

      update.original_rrp = sourcePrice
      update.currency = resolvedCurrency
      update.best_original_price = valuationGbp ?? sourcePrice
      update.best_original_price_currency = valuationGbp != null
        ? EQUIPD_DEFAULT_VALUATION_CURRENCY
        : resolvedCurrency
    }

    update.best_original_price_confidence = Number.isFinite(priceConfidence) && priceConfidence > 0
      ? Math.trunc(priceConfidence)
      : null
    update.best_original_price_updated_at = now

    if (recommendation?.v3_metadata?.price_scope === 'base_machine') {
      update.base_original_price = sourcePrice
    }
  }

  if (hasStartYear || hasEndYear) {
    update.manufacture_start_year = hasStartYear
      ? Math.trunc(Number(recommendation.production_start_year))
      : null
    update.manufacture_end_year = hasEndYear
      ? Math.trunc(Number(recommendation.production_end_year))
      : null
    update.manufacture_year_confidence = Number.isFinite(productionConfidence)
      ? Math.trunc(productionConfidence)
      : null
    update.lifecycle_updated_at = now

    if (hasStartYear) {
      update.manufacture_year = Math.trunc(Number(recommendation.production_start_year))
    }

    const baselineFields = buildResearchApprovedBaselineFields(recommendation, now)
    if (baselineFields) {
      Object.assign(update, baselineFields)
    }
  }

  return update
}

export async function approveEquipmentResearchRecommendation(
  equipmentId,
  recommendation,
  {
    groupWriteback = null,
    canonicalProductId = null,
    researchMeta = null,
  } = {},
) {
  if (!isSupabaseConfigured || !supabase) {
    return { data: null, product: null, error: new Error('Supabase is not configured.') }
  }

  let update
  try {
    update = buildResearchApproveUpdate(recommendation)
  } catch (error) {
    return { data: null, product: null, error }
  }

  const { data: currentRow, error: currentError } = await supabase
    .from('equipment_intelligence')
    .select('id, best_original_price, best_original_price_confidence, original_rrp, baseline_manufacture_year, baseline_manufacture_year_source, variant_name, core_product_group_status')
    .eq('id', equipmentId)
    .maybeSingle()

  if (currentError) {
    return { data: null, product: null, error: currentError }
  }

  if (currentRow && isAdminVerifiedPriceRow(currentRow)) {
    delete update.original_rrp
    delete update.currency
    delete update.best_original_price
    delete update.best_original_price_currency
    delete update.best_original_price_confidence
    delete update.best_original_price_updated_at
    delete update.base_original_price
  }

  if (currentRow?.baseline_manufacture_year != null
    && ['verified', 'manual', 'admin'].includes(String(currentRow.baseline_manufacture_year_source ?? '').toLowerCase())) {
    delete update.baseline_manufacture_year
    delete update.baseline_manufacture_year_confidence
    delete update.baseline_manufacture_year_source
  }

  const hasIntelligenceFields = Object.keys(update).length > 1
  if (!hasIntelligenceFields && !canonicalProductId) {
    return {
      data: null,
      product: null,
      error: new Error('Recommendation did not include a price or production years to save.'),
    }
  }

  let product = null
  if (canonicalProductId) {
    const productResult = await persistCanonicalProductResearchApproval(
      canonicalProductId,
      recommendation,
      { researchMeta },
    )
    if (productResult.error) {
      return { data: null, product: null, error: productResult.error }
    }
    product = productResult.data
  }

  let data = null
  if (hasIntelligenceFields) {
    const intelligenceResult = await supabase
      .from('equipment_intelligence')
      .update(update)
      .eq('id', equipmentId)
      .select('id, original_rrp, currency, manufacture_year, best_original_price, best_original_price_currency, best_original_price_confidence, base_original_price, manufacture_start_year, manufacture_end_year, baseline_manufacture_year, baseline_manufacture_year_confidence, baseline_manufacture_year_source, manufacture_year_confidence')
      .maybeSingle()

    if (intelligenceResult.error) {
      return { data: null, product: null, error: intelligenceResult.error }
    }
    data = intelligenceResult.data
  }

  if (groupWriteback?.dedupeEligible && groupWriteback.memberIds?.length > 1) {
    const memberIds = groupWriteback.memberIds.filter((memberId) => memberId !== equipmentId)
    if (memberIds.length > 0) {
      const { data: members, error: membersError } = await supabase
        .from('equipment_intelligence')
        .select('id, best_original_price, best_original_price_confidence, original_rrp, variant_name, core_product_group_status')
        .in('id', memberIds)

      if (membersError) {
        return { data, product: null, error: membersError }
      }

      const safePropagation = {
        base_original_price: update.base_original_price ?? update.original_rrp ?? null,
        original_rrp: update.original_rrp ?? null,
        currency: update.currency ?? null,
        best_original_price: update.best_original_price ?? null,
        best_original_price_currency: update.best_original_price_currency ?? null,
        best_original_price_confidence: update.best_original_price_confidence ?? null,
        best_original_price_updated_at: update.best_original_price_updated_at ?? null,
        manufacture_start_year: update.manufacture_start_year,
        manufacture_end_year: update.manufacture_end_year,
        manufacture_year_confidence: update.manufacture_year_confidence,
        lifecycle_updated_at: update.lifecycle_updated_at,
        updated_at: update.updated_at,
      }

      for (const member of members ?? []) {
        if (isAdminVerifiedPriceRow(member)) continue
        if (member.core_product_group_status === 'excluded') continue

        const memberUpdate = { ...safePropagation }
        if (member.variant_name) {
          delete memberUpdate.best_original_price
          delete memberUpdate.best_original_price_currency
          delete memberUpdate.best_original_price_confidence
          delete memberUpdate.best_original_price_updated_at
        }

        await supabase
          .from('equipment_intelligence')
          .update(memberUpdate)
          .eq('id', member.id)
      }
    }
  }

  return { data, product, error: null }
}
