import { requireAdmin } from '../_shared/admin-auth.ts'
import { handleCors, errorResponse, jsonResponse } from '../_shared/cors.ts'
import {
  collectMarketSearchCandidates,
  formatNoResultsMessage,
  type MarketSearchCandidate,
} from '../_shared/intelligenceMarketSearch.ts'
import { getSupabaseAdmin } from '../_shared/supabase-admin.ts'

type MarketSearchRequest = {
  equipment_id?: string
}

type MarketSearchResponse = {
  search_type: 'brave'
  equipment: {
    id: string
    brand: string
    series: string | null
    model: string
    slug: string
    equipment_type: string | null
  }
  queries_run: string[]
  raw_result_count: number
  deduped_result_count: number
  pages_fetched: number
  pages_failed: number
  prices_found: number
  page_fetch_failures: Array<{ url: string; error: string }>
  candidates: MarketSearchCandidate[]
  accepted_count: number
  rejected_count: number
  message: string | null
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

  const braveApiKey = Deno.env.get('BRAVE_SEARCH_API_KEY')?.trim()
  if (!braveApiKey) {
    return errorResponse(
      'BRAVE_SEARCH_API_KEY is not configured. Add it to Supabase Edge Function secrets before running market search.',
      500,
    )
  }

  try {
    const body = (await req.json()) as MarketSearchRequest
    const equipmentId = body.equipment_id?.trim()

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
      console.error('intelligence-market-search equipment lookup failed', equipmentError.message)
      return errorResponse(equipmentError.message, 500)
    }

    if (!equipment) {
      return errorResponse('Equipment intelligence record not found', 404)
    }

    let searchResult

    try {
      searchResult = await collectMarketSearchCandidates(equipment, braveApiKey)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Brave Search request failed'
      return errorResponse(message, 502)
    }

    let message: string | null = null
    if (searchResult.raw_result_count === 0) {
      message = formatNoResultsMessage(searchResult.queries_run)
    } else if (searchResult.accepted_count === 0) {
      message = 'No usable candidates found. Review rejected results or try again later.'
    }

    const response: MarketSearchResponse = {
      search_type: 'brave',
      equipment: {
        id: equipment.id,
        brand: equipment.brand,
        series: equipment.series,
        model: equipment.model,
        slug: equipment.slug,
        equipment_type: equipment.equipment_type,
      },
      queries_run: searchResult.queries_run,
      raw_result_count: searchResult.raw_result_count,
      deduped_result_count: searchResult.deduped_result_count,
      pages_fetched: searchResult.pages_fetched,
      pages_failed: searchResult.pages_failed,
      prices_found: searchResult.prices_found,
      page_fetch_failures: searchResult.page_fetch_failures,
      candidates: searchResult.candidates,
      accepted_count: searchResult.accepted_count,
      rejected_count: searchResult.rejected_count,
      message,
    }

    return jsonResponse(response)
  } catch (error) {
    console.error('intelligence-market-search failed', error)
    return errorResponse(
      error instanceof Error ? error.message : 'Market search failed',
      500,
    )
  }
})
