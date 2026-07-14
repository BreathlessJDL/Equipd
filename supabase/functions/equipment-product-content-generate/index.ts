import { requireAdmin } from '../_shared/admin-auth.ts'
import { handleCors, errorResponse, jsonResponse } from '../_shared/cors.ts'
import { generateMissingDraftsForProductIds } from '../_shared/equipmentProductContentGenerate.ts'
import { getSupabaseAdmin } from '../_shared/supabase-admin.ts'

type GenerateRequest = {
  product_ids?: string[]
  dry_run?: boolean
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

  try {
    const body = (await req.json()) as GenerateRequest
    const productIds = Array.isArray(body.product_ids)
      ? body.product_ids.filter((id) => typeof id === 'string' && id.trim())
      : []

    if (!productIds.length) {
      return errorResponse('product_ids is required', 400)
    }
    if (productIds.length > 5) {
      return errorResponse('product_ids cannot exceed 5 per step', 400)
    }

    const dryRun = body.dry_run === true
    const openAiApiKey = Deno.env.get('OPENAI_API_KEY')?.trim()
    const openAiModel = Deno.env.get('OPENAI_MODEL')?.trim() || 'gpt-4o-mini'

    if (!dryRun && !openAiApiKey) {
      return errorResponse('OPENAI_API_KEY is not configured', 500)
    }

    const admin = getSupabaseAdmin()
    const result = await generateMissingDraftsForProductIds(admin, {
      productIds,
      dryRun,
      openAiApiKey,
      openAiModel,
    })

    return jsonResponse({
      ok: true,
      dry_run: dryRun,
      created: result.created,
      skipped: result.skipped,
      failed: result.failed,
      results: result.results,
      failures: result.results
        .filter((row) => row.status === 'failed')
        .map((row) => ({
          product_id: row.product_id,
          name: row.name,
          reason: row.reason,
        })),
    })
  } catch (error) {
    console.error('equipment-product-content-generate failed', error)
    return errorResponse(
      error instanceof Error ? error.message : 'Generate missing drafts failed',
      500,
    )
  }
})
