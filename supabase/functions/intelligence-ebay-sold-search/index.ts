import { requireAdmin } from '../_shared/admin-auth.ts'
import { handleCors, errorResponse, jsonResponse } from '../_shared/cors.ts'
import {
  collectEbaySoldCandidates,
  getDefaultApifyEbaySoldActorId,
  type EbaySoldCalibrationSummary,
  type EbaySoldCandidate,
  type EbaySoldSearchProvider,
} from '../_shared/intelligenceEbaySoldSearch.ts'
import { getSupabaseAdmin } from '../_shared/supabase-admin.ts'

type EbaySoldSearchRequest = {
  equipment_id?: string
  custom_keyword?: string
}

type EbayKeywordAttempt = {
  keyword: string
  dataset_count: number
}

type EbaySoldSearchResponse = {
  search_type: 'ebay_sold'
  equipment: {
    id: string
    brand: string
    series: string | null
    model: string
    slug: string
    equipment_type: string | null
  }
  query_run: string
  ebay_url: string
  raw_result_count: number
  candidates: EbaySoldCandidate[]
  accepted_count: number
  review_count: number
  rejected_count: number
  provider: EbaySoldSearchProvider
  actor_id: string | null
  dataset_item_count: number | null
  apify_input: Record<string, unknown> | null
  keyword_attempts: EbayKeywordAttempt[]
  final_keyword: string | null
  calibration_summary: EbaySoldCalibrationSummary | null
  message: string | null
}

function resolveEbaySoldProvider(): EbaySoldSearchProvider | Response {
  const provider = Deno.env.get('EBAY_SOLD_SEARCH_PROVIDER')?.trim().toLowerCase() || 'direct'

  if (provider === 'direct' || provider === 'apify') {
    return provider
  }

  return errorResponse(
    `EBAY_SOLD_SEARCH_PROVIDER "${provider}" is not supported. Use direct or apify.`,
    500,
  )
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

  const providerResult = resolveEbaySoldProvider()
  if (providerResult instanceof Response) {
    return providerResult
  }
  const provider = providerResult

  if (provider === 'apify' && !Deno.env.get('APIFY_TOKEN')?.trim()) {
    return errorResponse('APIFY_TOKEN is not configured', 500)
  }

  try {
    const body = (await req.json()) as EbaySoldSearchRequest
    const equipmentId = body.equipment_id?.trim()
    const customKeyword = body.custom_keyword?.trim() || undefined

    if (!equipmentId) {
      return errorResponse('equipment_id is required', 400)
    }

    const admin = getSupabaseAdmin()
    const { data: equipment, error: equipmentError } = await admin
      .from('equipment_intelligence')
      .select('id, brand, series, model, slug, equipment_type, category, original_rrp')
      .eq('id', equipmentId)
      .maybeSingle()

    if (equipmentError) {
      console.error('intelligence-ebay-sold-search equipment lookup failed', equipmentError.message)
      return errorResponse(equipmentError.message, 500)
    }

    if (!equipment) {
      return errorResponse('Equipment intelligence record not found', 404)
    }

    let searchResult

    try {
      searchResult = await collectEbaySoldCandidates(equipment, provider, {
        token: provider === 'apify' ? Deno.env.get('APIFY_TOKEN')!.trim() : undefined,
        actorId: provider === 'apify' ? getDefaultApifyEbaySoldActorId() : undefined,
        customKeyword,
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'eBay sold search request failed'
      return errorResponse(message, 502)
    }

    let message: string | null = null
    if (searchResult.raw_result_count === 0) {
      message =
        provider === 'apify'
          ? `No Apify dataset items returned for actor ${searchResult.actor_id ?? getDefaultApifyEbaySoldActorId()}.`
          : `No eBay sold result cards found. URL tried: ${searchResult.ebay_url}`
    } else if (searchResult.accepted_count === 0 && searchResult.review_count === 0) {
      message = 'No usable eBay sold candidates found. Review rejected results below.'
    } else if (searchResult.accepted_count === 0) {
      message = 'No auto-accepted candidates. Review candidates may need manual approval.'
    }

    const response: EbaySoldSearchResponse = {
      search_type: 'ebay_sold',
      equipment: {
        id: equipment.id,
        brand: equipment.brand,
        series: equipment.series,
        model: equipment.model,
        slug: equipment.slug,
        equipment_type: equipment.equipment_type,
      },
      query_run: searchResult.query_run,
      ebay_url: searchResult.ebay_url,
      raw_result_count: searchResult.raw_result_count,
      candidates: searchResult.candidates,
      accepted_count: searchResult.accepted_count,
      review_count: searchResult.review_count,
      rejected_count: searchResult.rejected_count,
      provider: searchResult.provider,
      actor_id: searchResult.actor_id ?? null,
      dataset_item_count: searchResult.dataset_item_count ?? null,
      apify_input: searchResult.apify_input ?? null,
      keyword_attempts: searchResult.keyword_attempts ?? [],
      final_keyword: searchResult.final_keyword ?? searchResult.query_run ?? null,
      calibration_summary: searchResult.calibration_summary ?? null,
      message,
    }

    return jsonResponse(response)
  } catch (error) {
    console.error('intelligence-ebay-sold-search failed', error)
    return errorResponse(
      error instanceof Error ? error.message : 'eBay sold search failed',
      500,
    )
  }
})
