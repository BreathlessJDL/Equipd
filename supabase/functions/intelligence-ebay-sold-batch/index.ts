import { requireAdmin } from '../_shared/admin-auth.ts'
import { handleCors, errorResponse, jsonResponse } from '../_shared/cors.ts'
import {
  BATCH_SYNC_DEFAULTS,
  runBatchSyncStep,
  type BatchRowSyncResult,
  type BatchSyncConfig,
} from '../_shared/intelligenceEbaySoldBatch.ts'
import { getSupabaseAdmin } from '../_shared/supabase-admin.ts'

type BatchSyncRequest = {
  brand?: string
  max_rows?: number
  processed_count?: number
  cursor_id?: string | null
  dry_run?: boolean
  days_to_scrape?: number
  count_per_model?: number
  min_observations_skip?: number
  target_observations?: number
  min_auto_save_confidence?: number
  search_group_keys?: string[]
  dedupe_search_groups?: boolean
  prior_rows?: BatchRowSyncResult[]
  equipment_ids?: string[]
}

Deno.serve(async (req) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  if (req.method !== 'POST') {
    return errorResponse('Method not allowed', 405)
  }

  const adminResult = await requireAdmin(req)
  if (adminResult instanceof Response) {
    return adminResult
  }

  const apifyToken = Deno.env.get('APIFY_TOKEN')?.trim()
  if (!apifyToken) {
    return errorResponse('APIFY_TOKEN is not configured', 500)
  }

  try {
    const body = (await req.json()) as BatchSyncRequest

    const equipmentIds = Array.isArray(body.equipment_ids)
      ? body.equipment_ids.filter((id) => typeof id === 'string' && id.trim())
      : null
    const searchGroupKeys = Array.isArray(body.search_group_keys)
      ? body.search_group_keys.filter((key) => typeof key === 'string' && key.trim())
      : null

    const config: BatchSyncConfig = {
      brand: body.brand?.trim() || BATCH_SYNC_DEFAULTS.brand,
      maxRows: searchGroupKeys?.length
        ? searchGroupKeys.length
        : equipmentIds?.length
          ? equipmentIds.length
          : body.max_rows,
      processedCount: body.processed_count,
      cursorId: body.cursor_id ?? null,
      equipmentIds,
      searchGroupKeys,
      dedupeSearchGroups: body.dedupe_search_groups === true,
      dryRun: body.dry_run === true,
      daysToScrape: body.days_to_scrape ?? BATCH_SYNC_DEFAULTS.daysToScrape,
      countPerModel: body.count_per_model ?? BATCH_SYNC_DEFAULTS.countPerModel,
      minObservationsToSkip: body.min_observations_skip ?? BATCH_SYNC_DEFAULTS.minObservationsToSkip,
      targetObservations: body.target_observations ?? BATCH_SYNC_DEFAULTS.targetObservations,
      minAutoSaveConfidence: body.min_auto_save_confidence ?? BATCH_SYNC_DEFAULTS.minAutoSaveConfidence,
    }

    if (!equipmentIds?.length) {
      if (!config.maxRows || config.maxRows < 1) {
        return errorResponse('max_rows must be at least 1', 400)
      }

      if (config.maxRows > 500) {
        return errorResponse('max_rows cannot exceed 500 per batch session', 400)
      }
    } else if (equipmentIds.length > 500) {
      return errorResponse('equipment_ids cannot exceed 500 per batch session', 400)
    }

    const admin = getSupabaseAdmin()
    const priorRows = Array.isArray(body.prior_rows) ? body.prior_rows : []

    const result = await runBatchSyncStep(admin, config, apifyToken, priorRows)

    return jsonResponse({
      search_type: 'ebay_sold_batch',
      provider: 'apify',
      dry_run: config.dryRun === true,
      config: {
        brand: config.brand,
        max_rows: result.max_rows,
        equipment_ids: equipmentIds,
        search_group_keys: searchGroupKeys,
        days_to_scrape: config.daysToScrape,
        count_per_model: config.countPerModel,
        min_observations_skip: config.minObservationsToSkip,
        target_observations: config.targetObservations,
        min_auto_save_confidence: config.minAutoSaveConfidence,
        dedupe_search_groups: config.dedupeSearchGroups === true,
      },
      ...result,
    })
  } catch (error) {
    console.error('intelligence-ebay-sold-batch failed', error)
    return errorResponse(
      error instanceof Error ? error.message : 'Batch eBay sold sync failed',
      500,
    )
  }
})
