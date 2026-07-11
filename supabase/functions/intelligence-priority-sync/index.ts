import { requireAdmin } from '../_shared/admin-auth.ts'
import { handleCors, errorResponse, jsonResponse } from '../_shared/cors.ts'
import {
  rankSearchGroupsByPriority,
  type PriorityEquipmentInput,
} from '../_shared/intelligencePrioritySync.ts'
import { getSupabaseAdmin } from '../_shared/supabase-admin.ts'

const SUPABASE_MAX_PAGE_SIZE = 1000

type PrioritySyncRequest = {
  limit?: number
}

async function fetchAllPriorityRows() {
  const admin = getSupabaseAdmin()
  const allRows: PriorityEquipmentInput[] = []
  let from = 0
  let totalCount = 0

  while (true) {
    const to = from + SUPABASE_MAX_PAGE_SIZE - 1
    const { data, error, count } = await admin
      .from('equipment_intelligence')
      .select('id, brand, series, model, equipment_type, category, slug', { count: 'exact' })
      .order('id', { ascending: true })
      .range(from, to)

    if (error) {
      throw new Error(error.message)
    }

    if (totalCount === 0) {
      totalCount = count ?? 0
    }

    const page = data ?? []
    allRows.push(...page.map((row) => ({
      id: row.id,
      brand: row.brand,
      series: row.series,
      model: row.model,
      equipment_type: row.equipment_type,
      category: row.category,
      slug: row.slug,
    })))

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
    const body = (await req.json().catch(() => ({}))) as PrioritySyncRequest
    const limit = Math.min(Math.max(1, Math.floor(body.limit ?? 50)), 200)

    const { rows, total_count } = await fetchAllPriorityRows()
    const top = rankSearchGroupsByPriority(rows, limit)
    const equipmentIds = [...new Set(top.flatMap((entry) => entry.equipment_ids))]
    const totalEquipmentRowsSelected = top.reduce((sum, entry) => sum + entry.member_count, 0)

    return jsonResponse({
      search_type: 'priority_sync_ranking',
      ranking_mode: 'search_groups',
      total_scored: rows.length,
      total_in_table: total_count,
      total_unique_search_groups: top.length,
      total_equipment_rows_selected: totalEquipmentRowsSelected,
      apify_searches_required: top.length,
      limit,
      top,
      equipment_ids: equipmentIds,
      search_group_keys: top.map((entry) => entry.keyword_key),
    })
  } catch (error) {
    console.error('intelligence-priority-sync failed', error)
    return errorResponse(
      error instanceof Error ? error.message : 'Priority sync ranking failed',
      500,
    )
  }
})
