import type { SupabaseClient } from 'npm:@supabase/supabase-js@2'
import {
  buildKeywordSearchGroups,
  type SearchGroupEquipmentRow,
} from './intelligenceEbaySearchGroups.ts'
import {
  classifyEbaySoldRawListings,
  collectEbaySoldCandidates,
  fetchApifySoldRawListings,
  getDefaultApifyEbaySoldActorId,
  type EbaySoldCandidate,
} from './intelligenceEbaySoldSearch.ts'
import type { EquipmentIntelligenceRow } from './intelligenceMarketSearch.ts'

export const BATCH_SYNC_DEFAULTS = {
  brand: 'Life Fitness',
  daysToScrape: 90,
  countPerModel: 10,
  minObservationsToSkip: 5,
  targetObservations: 10,
  minAutoSaveConfidence: 90,
  provider: 'apify' as const,
}

export type MarketObservation = {
  price: number
  currency?: string
  source?: string | null
  url?: string | null
  confidence?: number | null
  condition?: string | null
  sold?: boolean | null
  observed_at?: string
  title?: string | null
}

export type BatchReviewCandidateLog = {
  title: string
  url: string | null
  price: number | null
  confidence: number
  reason: string
}

export type BatchRowSyncResult = {
  equipment_id: string
  brand: string
  series: string | null
  model: string
  slug: string
  status: 'synced' | 'skipped' | 'dry_run' | 'failed' | 'no_candidates'
  observations_before: number
  observations_added: number
  observations_after: number
  accepted_count: number
  review_count: number
  rejected_count: number
  auto_saved_count: number
  skipped_duplicate_count: number
  review_candidates: BatchReviewCandidateLog[]
  keyword_used: string | null
  error_message: string | null
  synced_at: string | null
}

export type BatchSyncConfig = {
  brand?: string
  maxRows?: number
  processedCount?: number
  cursorId?: string | null
  equipmentIds?: string[] | null
  searchGroupKeys?: string[] | null
  dedupeSearchGroups?: boolean
  dryRun?: boolean
  daysToScrape?: number
  countPerModel?: number
  minObservationsToSkip?: number
  targetObservations?: number
  minAutoSaveConfidence?: number
}

export type BatchSyncStepResult = {
  row: BatchRowSyncResult | null
  rows?: BatchRowSyncResult[]
  search_group?: {
    primary_keyword: string
    member_count: number
    labels: string[]
  } | null
  processed_count: number
  max_rows: number
  total_eligible: number
  complete: boolean
  next_cursor_id: string | null
  summary: {
    synced: number
    skipped: number
    failed: number
    dry_run: number
    observations_added: number
    auto_saved: number
    review_logged: number
    rejected: number
  }
}

type EquipmentBatchRow = EquipmentIntelligenceRow & {
  market_observations?: MarketObservation[] | null
}

function normalizeObservation(observation: MarketObservation): MarketObservation | null {
  const price = Number(observation?.price)
  if (!Number.isFinite(price) || price <= 0) return null

  return {
    price,
    currency: observation.currency || 'GBP',
    source: observation.source ?? null,
    url: observation.url?.trim() || null,
    confidence: Number.isFinite(Number(observation.confidence))
      ? Math.trunc(Number(observation.confidence))
      : null,
    condition: observation.condition ?? null,
    sold: observation.sold ?? null,
    observed_at: observation.observed_at || new Date().toISOString(),
    title: observation.title?.trim() || null,
  }
}

export function getObservationDedupKey(observation: MarketObservation): string {
  const url = observation.url?.trim()
  if (url) return `url:${url.toLowerCase()}`

  const source = observation.source || 'unknown'
  const title = observation.title?.trim().toLowerCase() || ''
  const soldAt = observation.observed_at || ''
  const price = Number(observation.price)

  return `fallback:${source}|${title}|${soldAt}|${price}`
}

export function dedupeObservations(observations: MarketObservation[]): MarketObservation[] {
  const seen = new Set<string>()
  const result: MarketObservation[] = []

  for (const raw of observations) {
    const normalized = normalizeObservation(raw)
    if (!normalized) continue

    const key = getObservationDedupKey(normalized)
    if (seen.has(key)) continue
    seen.add(key)
    result.push(normalized)
  }

  return result
}

export function candidateToObservation(candidate: EbaySoldCandidate): MarketObservation | null {
  const price = Number(candidate.price)
  if (!Number.isFinite(price) || price <= 0) return null

  return {
    price,
    currency: candidate.currency || 'GBP',
    source: 'ebay_sold',
    url: candidate.url?.trim() || null,
    confidence: Number.isFinite(Number(candidate.confidence))
      ? Math.trunc(Number(candidate.confidence))
      : null,
    condition: candidate.condition || null,
    sold: true,
    observed_at: candidate.sold_at || new Date().toISOString(),
    title: candidate.title?.trim() || null,
  }
}

export function isAutoSaveCandidate(
  candidate: EbaySoldCandidate,
  minConfidence = BATCH_SYNC_DEFAULTS.minAutoSaveConfidence,
): boolean {
  if (candidate.status !== 'accepted') return false

  const confidence = Number(candidate.confidence)
  if (!Number.isFinite(confidence) || confidence < minConfidence) return false

  if (!Number.isFinite(Number(candidate.price)) || Number(candidate.price) <= 0) return false

  const breakdown = candidate.score_breakdown
  if (breakdown?.parts_accessory_hard_reject) return false
  if (breakdown?.wrong_model_hard_reject) return false

  if ((candidate.parts_terms_detected?.length ?? 0) > 0) return false

  return true
}

export function buildReviewCandidateLog(candidate: EbaySoldCandidate): BatchReviewCandidateLog {
  return {
    title: candidate.title,
    url: candidate.url?.trim() || null,
    price: Number.isFinite(Number(candidate.price)) ? Number(candidate.price) : null,
    confidence: Number(candidate.confidence) || 0,
    reason: candidate.reason,
  }
}

export function selectBatchAutoSaveCandidates(
  candidates: EbaySoldCandidate[],
  existingObservations: MarketObservation[],
  options: {
    minConfidence?: number
    targetObservations?: number
    maxNewObservations?: number
  } = {},
): {
  autoSave: MarketObservation[]
  review: BatchReviewCandidateLog[]
  accepted_count: number
  review_count: number
  rejected_count: number
  skipped_duplicate_count: number
} {
  const minConfidence = options.minConfidence ?? BATCH_SYNC_DEFAULTS.minAutoSaveConfidence
  const targetObservations = options.targetObservations ?? BATCH_SYNC_DEFAULTS.targetObservations
  const existingKeys = new Set(existingObservations.map((obs) => getObservationDedupKey(obs)))

  const accepted_count = candidates.filter((c) => c.status === 'accepted').length
  const review_count = candidates.filter((c) => c.status === 'review').length
  const rejected_count = candidates.filter((c) => c.status === 'rejected').length

  const autoSave: MarketObservation[] = []
  const review: BatchReviewCandidateLog[] = []
  let skipped_duplicate_count = 0

  const slotsRemaining = Math.max(0, targetObservations - existingObservations.length)
  const maxNew = options.maxNewObservations ?? slotsRemaining

  for (const candidate of candidates) {
    if (candidate.status === 'review') {
      review.push(buildReviewCandidateLog(candidate))
      continue
    }

    if (!isAutoSaveCandidate(candidate, minConfidence)) {
      continue
    }

    const observation = candidateToObservation(candidate)
    if (!observation) continue

    const key = getObservationDedupKey(observation)
    if (existingKeys.has(key)) {
      skipped_duplicate_count += 1
      continue
    }

    if (autoSave.length >= maxNew) {
      continue
    }

    existingKeys.add(key)
    autoSave.push(observation)
  }

  return {
    autoSave,
    review,
    accepted_count,
    review_count,
    rejected_count,
    skipped_duplicate_count,
  }
}

function buildSyncNotes(
  autoSavedCount: number,
  reviewCount: number,
  reviewTitles: string[],
): string {
  const parts = [`Batch eBay sync: saved ${autoSavedCount} accepted observation(s)`]
  if (reviewCount > 0) {
    parts.push(`${reviewCount} review candidate(s) logged`)
    if (reviewTitles.length > 0) {
      parts.push(`Review: ${reviewTitles.slice(0, 3).join('; ')}`)
    }
  }
  return parts.join('. ')
}

async function finishBatchRowFromCandidates(
  admin: SupabaseClient,
  equipment: EquipmentBatchRow,
  config: BatchSyncConfig,
  options: {
    candidates: EbaySoldCandidate[]
    keyword_used: string | null
    existingObservations: MarketObservation[]
    syncedAt: string
    baseResult: BatchRowSyncResult
  },
): Promise<BatchRowSyncResult> {
  const {
    candidates,
    keyword_used,
    existingObservations,
    syncedAt,
    baseResult,
  } = options
  const targetObservations = config.targetObservations ?? BATCH_SYNC_DEFAULTS.targetObservations
  const dryRun = config.dryRun === true

  const selection = selectBatchAutoSaveCandidates(
    candidates,
    existingObservations,
    {
      minConfidence: config.minAutoSaveConfidence ?? BATCH_SYNC_DEFAULTS.minAutoSaveConfidence,
      targetObservations,
    },
  )

  const rowResult: BatchRowSyncResult = {
    ...baseResult,
    status: selection.autoSave.length > 0 ? 'synced' : 'no_candidates',
    accepted_count: selection.accepted_count,
    review_count: selection.review_count,
    rejected_count: selection.rejected_count,
    auto_saved_count: selection.autoSave.length,
    skipped_duplicate_count: selection.skipped_duplicate_count,
    review_candidates: selection.review,
    keyword_used,
    synced_at: syncedAt,
  }

  if (dryRun) {
    return {
      ...rowResult,
      status: 'dry_run',
      observations_added: selection.autoSave.length,
      observations_after: existingObservations.length + selection.autoSave.length,
      synced_at: syncedAt,
    }
  }

  if (selection.autoSave.length === 0) {
    if (selection.review.length > 0) {
      await admin
        .from('equipment_intelligence')
        .update({
          market_sync_status: 'synced',
          market_sync_notes: buildSyncNotes(0, selection.review.length, selection.review.map((r) => r.title)),
          last_market_sync_at: syncedAt,
          updated_at: syncedAt,
        })
        .eq('id', equipment.id)
    }

    return rowResult
  }

  const merged = dedupeObservations([...existingObservations, ...selection.autoSave])

  const { error: updateError } = await admin
    .from('equipment_intelligence')
    .update({
      market_observations: merged,
      market_sync_status: 'synced',
      market_sync_notes: buildSyncNotes(
        selection.autoSave.length,
        selection.review.length,
        selection.review.map((r) => r.title),
      ),
      last_market_sync_at: syncedAt,
      updated_at: syncedAt,
    })
    .eq('id', equipment.id)

  if (updateError) {
    throw new Error(updateError.message)
  }

  return {
    ...rowResult,
    observations_added: selection.autoSave.length,
    observations_after: merged.length,
  }
}

function buildSkippedBatchRowResult(
  equipment: EquipmentBatchRow,
  existingObservations: MarketObservation[],
  minObservationsToSkip: number,
  syncedAt: string,
): BatchRowSyncResult {
  return {
    equipment_id: equipment.id,
    brand: equipment.brand,
    series: equipment.series,
    model: equipment.model,
    slug: equipment.slug,
    status: 'skipped',
    observations_before: existingObservations.length,
    observations_added: 0,
    observations_after: existingObservations.length,
    accepted_count: 0,
    review_count: 0,
    rejected_count: 0,
    auto_saved_count: 0,
    skipped_duplicate_count: 0,
    review_candidates: [],
    keyword_used: null,
    error_message: `Already has ${existingObservations.length} observations (skip threshold ${minObservationsToSkip})`,
    synced_at: syncedAt,
  }
}

function buildFailedBatchRowResult(
  equipment: EquipmentBatchRow,
  existingObservations: MarketObservation[],
  message: string,
  syncedAt: string,
): BatchRowSyncResult {
  return {
    equipment_id: equipment.id,
    brand: equipment.brand,
    series: equipment.series,
    model: equipment.model,
    slug: equipment.slug,
    status: 'failed',
    observations_before: existingObservations.length,
    observations_added: 0,
    observations_after: existingObservations.length,
    accepted_count: 0,
    review_count: 0,
    rejected_count: 0,
    auto_saved_count: 0,
    skipped_duplicate_count: 0,
    review_candidates: [],
    keyword_used: null,
    error_message: message,
    synced_at: syncedAt,
  }
}

export async function processBatchEquipmentRow(
  admin: SupabaseClient,
  equipment: EquipmentBatchRow,
  config: BatchSyncConfig,
  apifyToken: string,
): Promise<BatchRowSyncResult> {
  const existingObservations = dedupeObservations(
    Array.isArray(equipment.market_observations) ? equipment.market_observations : [],
  )
  const minObservationsToSkip = config.minObservationsToSkip ?? BATCH_SYNC_DEFAULTS.minObservationsToSkip
  const dryRun = config.dryRun === true
  const syncedAt = new Date().toISOString()

  const baseResult: BatchRowSyncResult = {
    equipment_id: equipment.id,
    brand: equipment.brand,
    series: equipment.series,
    model: equipment.model,
    slug: equipment.slug,
    status: 'no_candidates',
    observations_before: existingObservations.length,
    observations_added: 0,
    observations_after: existingObservations.length,
    accepted_count: 0,
    review_count: 0,
    rejected_count: 0,
    auto_saved_count: 0,
    skipped_duplicate_count: 0,
    review_candidates: [],
    keyword_used: null,
    error_message: null,
    synced_at: null,
  }

  if (existingObservations.length >= minObservationsToSkip) {
    return buildSkippedBatchRowResult(
      equipment,
      existingObservations,
      minObservationsToSkip,
      syncedAt,
    )
  }

  try {
    const searchResult = await collectEbaySoldCandidates(equipment, 'apify', {
      token: apifyToken,
      actorId: getDefaultApifyEbaySoldActorId(),
      daysToScrape: config.daysToScrape ?? BATCH_SYNC_DEFAULTS.daysToScrape,
      count: config.countPerModel ?? BATCH_SYNC_DEFAULTS.countPerModel,
    })

    return await finishBatchRowFromCandidates(admin, equipment, config, {
      candidates: searchResult.candidates,
      keyword_used: searchResult.final_keyword ?? searchResult.query_run ?? null,
      existingObservations,
      syncedAt,
      baseResult,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Batch row sync failed'

    if (!dryRun) {
      await admin
        .from('equipment_intelligence')
        .update({
          market_sync_status: 'failed',
          market_sync_notes: `Batch eBay sync failed: ${message}`,
          last_market_sync_at: syncedAt,
          updated_at: syncedAt,
        })
        .eq('id', equipment.id)
    }

    return {
      ...baseResult,
      status: 'failed',
      error_message: message,
      synced_at: syncedAt,
    }
  }
}

export async function processBatchSearchGroup(
  admin: SupabaseClient,
  equipmentRows: EquipmentBatchRow[],
  config: BatchSyncConfig,
  apifyToken: string,
  representative: SearchGroupEquipmentRow,
): Promise<BatchRowSyncResult[]> {
  const minObservationsToSkip = config.minObservationsToSkip ?? BATCH_SYNC_DEFAULTS.minObservationsToSkip
  const dryRun = config.dryRun === true
  const syncedAt = new Date().toISOString()

  const rowStates = equipmentRows.map((equipment) => {
    const existingObservations = dedupeObservations(
      Array.isArray(equipment.market_observations) ? equipment.market_observations : [],
    )

    return {
      equipment,
      existingObservations,
      baseResult: {
        equipment_id: equipment.id,
        brand: equipment.brand,
        series: equipment.series,
        model: equipment.model,
        slug: equipment.slug,
        status: 'no_candidates' as const,
        observations_before: existingObservations.length,
        observations_added: 0,
        observations_after: existingObservations.length,
        accepted_count: 0,
        review_count: 0,
        rejected_count: 0,
        auto_saved_count: 0,
        skipped_duplicate_count: 0,
        review_candidates: [],
        keyword_used: null,
        error_message: null,
        synced_at: null,
      },
    }
  })

  const skippedResults = rowStates
    .filter((state) => state.existingObservations.length >= minObservationsToSkip)
    .map((state) => buildSkippedBatchRowResult(
      state.equipment,
      state.existingObservations,
      minObservationsToSkip,
      syncedAt,
    ))

  const activeStates = rowStates.filter(
    (state) => state.existingObservations.length < minObservationsToSkip,
  )

  if (activeStates.length === 0) {
    return skippedResults
  }

  try {
    const rawFetch = await fetchApifySoldRawListings(representative, {
      token: apifyToken,
      actorId: getDefaultApifyEbaySoldActorId(),
      daysToScrape: config.daysToScrape ?? BATCH_SYNC_DEFAULTS.daysToScrape,
      count: config.countPerModel ?? BATCH_SYNC_DEFAULTS.countPerModel,
    })

    const keywordUsed = rawFetch.final_keyword ?? rawFetch.query_run ?? null
    const activeResults: BatchRowSyncResult[] = []

    for (const state of activeStates) {
      try {
        const candidates = classifyEbaySoldRawListings(
          state.equipment,
          rawFetch.raw_listings,
        )

        const result = await finishBatchRowFromCandidates(admin, state.equipment, config, {
          candidates,
          keyword_used: keywordUsed,
          existingObservations: state.existingObservations,
          syncedAt,
          baseResult: state.baseResult,
        })

        activeResults.push(result)
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Batch row sync failed'

        if (!dryRun) {
          await admin
            .from('equipment_intelligence')
            .update({
              market_sync_status: 'failed',
              market_sync_notes: `Batch eBay sync failed: ${message}`,
              last_market_sync_at: syncedAt,
              updated_at: syncedAt,
            })
            .eq('id', state.equipment.id)
        }

        activeResults.push(buildFailedBatchRowResult(
          state.equipment,
          state.existingObservations,
          message,
          syncedAt,
        ))
      }
    }

    const resultById = new Map(
      [...skippedResults, ...activeResults].map((row) => [row.equipment_id, row]),
    )

    return equipmentRows
      .map((equipment) => resultById.get(equipment.id))
      .filter((row): row is BatchRowSyncResult => row !== undefined)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Batch search group sync failed'

    const failedResults = activeStates.map((state) => {
      if (!dryRun) {
        void admin
          .from('equipment_intelligence')
          .update({
            market_sync_status: 'failed',
            market_sync_notes: `Batch eBay sync failed: ${message}`,
            last_market_sync_at: syncedAt,
            updated_at: syncedAt,
          })
          .eq('id', state.equipment.id)
      }

      return buildFailedBatchRowResult(
        state.equipment,
        state.existingObservations,
        message,
        syncedAt,
      )
    })

    const resultById = new Map(
      [...skippedResults, ...failedResults].map((row) => [row.equipment_id, row]),
    )

    return equipmentRows
      .map((equipment) => resultById.get(equipment.id))
      .filter((row): row is BatchRowSyncResult => row !== undefined)
  }
}

const BATCH_EQUIPMENT_SELECT = 'id, brand, series, model, slug, equipment_type, category, original_rrp, market_observations'
const SUPABASE_MAX_PAGE_SIZE = 1000

export async function fetchAllBatchEquipmentRows(
  admin: SupabaseClient,
  options: { brand?: string; equipmentIds?: string[] | null },
): Promise<EquipmentBatchRow[]> {
  const equipmentIds = options.equipmentIds?.filter(Boolean) ?? null

  if (equipmentIds && equipmentIds.length > 0) {
    const { data, error } = await admin
      .from('equipment_intelligence')
      .select(BATCH_EQUIPMENT_SELECT)
      .in('id', equipmentIds)

    if (error) {
      throw new Error(error.message)
    }

    const byId = new Map(
      ((data ?? []) as EquipmentBatchRow[]).map((row) => [row.id, row]),
    )

    return equipmentIds
      .map((id) => byId.get(id))
      .filter((row): row is EquipmentBatchRow => row !== undefined)
  }

  const brand = options.brand?.trim() || BATCH_SYNC_DEFAULTS.brand
  const allRows: EquipmentBatchRow[] = []
  let from = 0
  let totalCount = 0

  while (true) {
    const to = from + SUPABASE_MAX_PAGE_SIZE - 1
    const { data, error, count } = await admin
      .from('equipment_intelligence')
      .select(BATCH_EQUIPMENT_SELECT, { count: 'exact' })
      .eq('brand', brand)
      .order('id', { ascending: true })
      .range(from, to)

    if (error) {
      throw new Error(error.message)
    }

    if (totalCount === 0) {
      totalCount = count ?? 0
    }

    const page = (data ?? []) as EquipmentBatchRow[]
    allRows.push(...page)

    if (page.length === 0 || allRows.length >= totalCount) {
      break
    }

    from += SUPABASE_MAX_PAGE_SIZE
  }

  return allRows
}

export async function fetchBatchEquipmentByIds(
  admin: SupabaseClient,
  equipmentIds: string[],
): Promise<EquipmentBatchRow[]> {
  return fetchAllBatchEquipmentRows(admin, { equipmentIds })
}

export function buildBatchSearchGroups(
  rows: EquipmentBatchRow[],
): ReturnType<typeof buildKeywordSearchGroups> {
  return buildKeywordSearchGroups(rows)
}

export async function countEligibleBatchRows(
  admin: SupabaseClient,
  brand: string,
): Promise<number> {
  const { count, error } = await admin
    .from('equipment_intelligence')
    .select('id', { count: 'exact', head: true })
    .eq('brand', brand)

  if (error) {
    throw new Error(error.message)
  }

  return count ?? 0
}

export async function fetchBatchEquipmentById(
  admin: SupabaseClient,
  equipmentId: string,
): Promise<EquipmentBatchRow | null> {
  const { data, error } = await admin
    .from('equipment_intelligence')
    .select('id, brand, series, model, slug, equipment_type, category, original_rrp, market_observations')
    .eq('id', equipmentId)
    .maybeSingle()

  if (error) {
    throw new Error(error.message)
  }

  return (data as EquipmentBatchRow | null) ?? null
}

export async function fetchNextBatchEquipmentRow(
  admin: SupabaseClient,
  brand: string,
  cursorId: string | null,
): Promise<EquipmentBatchRow | null> {
  let query = admin
    .from('equipment_intelligence')
    .select('id, brand, series, model, slug, equipment_type, category, original_rrp, market_observations')
    .eq('brand', brand)
    .order('id', { ascending: true })
    .limit(1)

  if (cursorId) {
    query = query.gt('id', cursorId)
  }

  const { data, error } = await query

  if (error) {
    throw new Error(error.message)
  }

  return (data?.[0] as EquipmentBatchRow | undefined) ?? null
}

export function summarizeBatchRows(rows: BatchRowSyncResult[]): BatchSyncStepResult['summary'] {
  return {
    synced: rows.filter((row) => row.status === 'synced').length,
    skipped: rows.filter((row) => row.status === 'skipped').length,
    failed: rows.filter((row) => row.status === 'failed').length,
    dry_run: rows.filter((row) => row.status === 'dry_run').length,
    observations_added: rows.reduce((sum, row) => sum + row.observations_added, 0),
    auto_saved: rows.reduce((sum, row) => sum + row.auto_saved_count, 0),
    review_logged: rows.reduce((sum, row) => sum + row.review_count, 0),
    rejected: rows.reduce((sum, row) => sum + row.rejected_count, 0),
  }
}

export async function runBatchSyncStep(
  admin: SupabaseClient,
  config: BatchSyncConfig,
  apifyToken: string,
  priorRows: BatchRowSyncResult[] = [],
): Promise<BatchSyncStepResult> {
  const brand = config.brand?.trim() || BATCH_SYNC_DEFAULTS.brand
  const equipmentIds = config.equipmentIds?.filter(Boolean) ?? null
  const usingPriorityList = Boolean(equipmentIds && equipmentIds.length > 0)
  const dedupeSearchGroups = config.dedupeSearchGroups === true
  const processedCount = Math.max(0, config.processedCount ?? 0)
  const cursorId = config.cursorId ?? null

  if (dedupeSearchGroups) {
    const sourceRows = await fetchAllBatchEquipmentRows(admin, {
      brand: usingPriorityList ? undefined : brand,
      equipmentIds,
    })
    const builtGroups = buildBatchSearchGroups(sourceRows)
    const searchGroupKeys = config.searchGroupKeys?.filter(Boolean) ?? null

    const groups = searchGroupKeys?.length
      ? searchGroupKeys
        .map((keywordKey) => builtGroups.find((group) => group.keyword_key === keywordKey))
        .filter((group): group is NonNullable<typeof group> => group !== undefined)
      : builtGroups

    const maxRows = Math.max(
      1,
      searchGroupKeys?.length
        ? searchGroupKeys.length
        : usingPriorityList
          ? groups.length
          : Math.min(config.maxRows ?? 25, groups.length),
    )
    const totalEligible = groups.length

    if (processedCount >= maxRows || processedCount >= groups.length) {
      return {
        row: null,
        rows: [],
        search_group: null,
        processed_count: processedCount,
        max_rows: maxRows,
        total_eligible: totalEligible,
        complete: true,
        next_cursor_id: null,
        summary: summarizeBatchRows(priorRows),
      }
    }

    const group = groups[processedCount]
    const memberIds = group.members.map((member) => member.equipment_id)
    const memberRows = await fetchBatchEquipmentByIds(admin, memberIds)
    const rows = await processBatchSearchGroup(
      admin,
      memberRows,
      config,
      apifyToken,
      group,
    )
    const allRows = [...priorRows, ...rows]
    const nextProcessed = processedCount + 1
    const complete = nextProcessed >= maxRows || nextProcessed >= groups.length

    return {
      row: rows[0] ?? null,
      rows,
      search_group: {
        primary_keyword: group.primary_keyword,
        member_count: group.member_count,
        labels: group.labels,
      },
      processed_count: nextProcessed,
      max_rows: maxRows,
      total_eligible: totalEligible,
      complete,
      next_cursor_id: complete ? null : group.keyword_key,
      summary: summarizeBatchRows(allRows),
    }
  }

  const maxRows = Math.max(
    1,
    usingPriorityList ? equipmentIds!.length : (config.maxRows ?? 25),
  )

  const totalEligible = usingPriorityList
    ? equipmentIds!.length
    : await countEligibleBatchRows(admin, brand)

  if (processedCount >= maxRows) {
    return {
      row: null,
      processed_count: processedCount,
      max_rows: maxRows,
      total_eligible: totalEligible,
      complete: true,
      next_cursor_id: null,
      summary: summarizeBatchRows(priorRows),
    }
  }

  const equipment = usingPriorityList
    ? await fetchBatchEquipmentById(admin, equipmentIds![processedCount])
    : await fetchNextBatchEquipmentRow(admin, brand, cursorId)

  if (!equipment) {
    return {
      row: null,
      processed_count: processedCount,
      max_rows: maxRows,
      total_eligible: totalEligible,
      complete: true,
      next_cursor_id: null,
      summary: summarizeBatchRows(priorRows),
    }
  }

  const row = await processBatchEquipmentRow(admin, equipment, config, apifyToken)
  const allRows = [...priorRows, row]
  const nextProcessed = processedCount + 1
  const complete = nextProcessed >= maxRows

  return {
    row,
    processed_count: nextProcessed,
    max_rows: maxRows,
    total_eligible: totalEligible,
    complete,
    next_cursor_id: complete ? null : equipment.id,
    summary: summarizeBatchRows(allRows),
  }
}
