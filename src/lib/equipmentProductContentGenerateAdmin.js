/**
 * Admin client for “Generate missing drafts” (stepped Edge Function runner).
 */

import { supabase } from './supabase'
import {
  buildGenerateMissingConfirmationSummary,
  chunkProductIds,
  emptyGenerateMissingProgress,
  applyGenerateMissingStepResult,
  GENERATE_MISSING_MAX_PER_STEP,
  GENERATE_MISSING_SCOPE,
  GENERATE_MISSING_SCOPE_LABELS,
  previewGenerateMissingFromAdminRows,
  summarizeGenerateMissingRun,
} from './equipmentProductContentGenerateMissing.js'

export {
  GENERATE_MISSING_SCOPE,
  GENERATE_MISSING_SCOPE_LABELS,
  GENERATE_MISSING_MAX_PER_STEP,
  previewGenerateMissingFromAdminRows,
  buildGenerateMissingConfirmationSummary,
  chunkProductIds,
  emptyGenerateMissingProgress,
  applyGenerateMissingStepResult,
  summarizeGenerateMissingRun,
}

async function invokeGenerateMissingStep(body) {
  if (!supabase) {
    throw new Error('Supabase is not configured.')
  }

  const { data, error } = await supabase.functions.invoke(
    'equipment-product-content-generate',
    { body },
  )

  if (error) {
    const message = error.message || 'Generate missing drafts step failed'
    throw new Error(message)
  }

  if (data?.error) {
    throw new Error(typeof data.error === 'string' ? data.error : 'Generate missing drafts step failed')
  }

  return data
}

/**
 * Run stepped generation for eligible product IDs (max 5 per Edge call).
 */
export async function runGenerateMissingDraftsBatch({
  productIds = [],
  dryRun = false,
  onProgress = null,
  shouldCancel = null,
} = {}) {
  const ids = [...new Set((productIds ?? []).map((id) => String(id)).filter(Boolean))]
  let progress = emptyGenerateMissingProgress(ids.length)
  const chunks = chunkProductIds(ids, GENERATE_MISSING_MAX_PER_STEP)

  onProgress?.(progress)

  for (const chunk of chunks) {
    if (shouldCancel?.()) {
      progress = { ...progress, cancelled: true }
      onProgress?.(progress)
      break
    }

    progress = {
      ...progress,
      processing: chunk.length,
      queued: Math.max(0, progress.total - progress.completed - chunk.length),
    }
    onProgress?.(progress)

    try {
      const step = await invokeGenerateMissingStep({
        product_ids: chunk,
        dry_run: dryRun,
      })

      progress = applyGenerateMissingStepResult(progress, {
        created: step.created,
        skipped: step.skipped,
        failed: step.failed,
        failures: step.failures ?? [],
      })
    } catch (error) {
      progress = applyGenerateMissingStepResult(progress, {
        created: 0,
        skipped: 0,
        failed: chunk.length,
        failures: chunk.map((productId) => ({
          product_id: productId,
          name: productId,
          reason: error instanceof Error ? error.message : String(error),
        })),
      })
    }

    onProgress?.(progress)
  }

  return progress
}
