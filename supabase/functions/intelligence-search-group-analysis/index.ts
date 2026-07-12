import { requireAdmin } from '../_shared/admin-auth.ts'
import { handleCors, errorResponse, jsonResponse } from '../_shared/cors.ts'
import {
  analyzeEquipmentSearchGroups,
  type SearchGroupEquipmentRow,
} from '../_shared/intelligenceEbaySearchGroups.ts'
import { getSupabaseAdmin } from '../_shared/supabase-admin.ts'

const SUPABASE_MAX_PAGE_SIZE = 1000

type SearchGroupAnalysisRequest = {
  brand?: string
  include_groups?: boolean
}

async function fetchAllSearchGroupRows(brand?: string | null) {
  const admin = getSupabaseAdmin()
  const allRows: SearchGroupEquipmentRow[] = []
  let from = 0
  let totalCount = 0

  while (true) {
    const to = from + SUPABASE_MAX_PAGE_SIZE - 1
    let query = admin
      .from('equipment_intelligence')
      .select('id, brand, series, model, equipment_type, category, slug, manufacture_year', {
        count: 'exact',
      })
      .order('id', { ascending: true })
      .range(from, to)

    if (brand?.trim()) {
      query = query.eq('brand', brand.trim())
    }

    const { data, error, count } = await query

    if (error) {
      throw new Error(error.message)
    }

    if (totalCount === 0) {
      totalCount = count ?? 0
    }

    const page = (data ?? []) as SearchGroupEquipmentRow[]
    allRows.push(...page)

    if (page.length === 0 || allRows.length >= totalCount) {
      break
    }

    from += SUPABASE_MAX_PAGE_SIZE
  }

  return { rows: allRows, total_count: totalCount }
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
    const body = (await req.json().catch(() => ({}))) as SearchGroupAnalysisRequest
    const brand = body.brand?.trim() || null
    const includeGroups = body.include_groups === true

    const { rows, total_count } = await fetchAllSearchGroupRows(brand)
    const analysis = analyzeEquipmentSearchGroups(rows)

    return jsonResponse({
      search_type: 'ebay_search_group_analysis',
      brand_filter: brand,
      total_in_table: total_count,
      report: {
        total_equipment_rows: analysis.total_equipment_rows,
        unique_descriptor_groups: analysis.unique_descriptor_groups,
        unique_primary_keywords: analysis.unique_primary_keywords,
        current_apify_searches_required: analysis.current_apify_searches_required,
        deduped_apify_searches_required: analysis.deduped_apify_searches_required,
        apify_search_savings: analysis.apify_search_savings,
        apify_search_savings_percent: analysis.apify_search_savings_percent,
        largest_descriptor_groups: analysis.largest_descriptor_groups,
        largest_keyword_groups: analysis.largest_keyword_groups,
      },
      descriptor_groups: includeGroups ? analysis.descriptor_groups : undefined,
      keyword_groups: includeGroups ? analysis.keyword_groups : undefined,
    })
  } catch (error) {
    console.error('intelligence-search-group-analysis failed', error)
    return errorResponse(
      error instanceof Error ? error.message : 'Search group analysis failed',
      500,
    )
  }
})
