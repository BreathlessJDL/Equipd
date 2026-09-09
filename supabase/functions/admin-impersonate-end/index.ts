import { requireAdmin } from '../_shared/admin-auth.ts'
import { handleCors, errorResponse, jsonResponse } from '../_shared/cors.ts'
import { getSupabaseAdmin } from '../_shared/supabase-admin.ts'

type EndBody = {
  sessionId?: string
  endedReason?: string
}

Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  if (req.method !== 'POST') {
    return errorResponse('Method not allowed', 405)
  }

  try {
    const adminResult = await requireAdmin(req)
    if (adminResult instanceof Response) return adminResult

    const { user: adminUser } = adminResult
    let body: EndBody = {}
    try {
      body = (await req.json()) as EndBody
    } catch {
      return errorResponse('Invalid JSON body', 400)
    }

    const sessionId = String(body.sessionId || '').trim()
    if (!sessionId) {
      return errorResponse('sessionId is required', 400)
    }

    const endedReason = String(body.endedReason || 'exited').trim() || 'exited'
    const supabaseAdmin = getSupabaseAdmin()

    const { data: row, error: loadError } = await supabaseAdmin
      .from('admin_impersonation_sessions')
      .select('id, admin_user_id, ended_at, metadata')
      .eq('id', sessionId)
      .maybeSingle()

    if (loadError) {
      console.error('admin-impersonate-end load failed', loadError.message)
      return errorResponse('Could not load impersonation session', 500)
    }

    if (!row) {
      return errorResponse('Impersonation session not found', 404)
    }

    if (row.admin_user_id !== adminUser.id) {
      return errorResponse('Impersonation session does not belong to this admin', 403)
    }

    if (row.ended_at) {
      return jsonResponse({ ok: true, alreadyEnded: true, sessionId: row.id })
    }

    const { error: updateError } = await supabaseAdmin
      .from('admin_impersonation_sessions')
      .update({
        ended_at: new Date().toISOString(),
        metadata: {
          ...(row.metadata && typeof row.metadata === 'object' ? row.metadata : {}),
          ended_reason: endedReason,
        },
      })
      .eq('id', row.id)
      .is('ended_at', null)

    if (updateError) {
      console.error('admin-impersonate-end update failed', updateError.message)
      return errorResponse('Could not end impersonation session', 500)
    }

    return jsonResponse({ ok: true, sessionId: row.id })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Impersonation end failed'
    console.error('admin-impersonate-end unhandled', message)
    return errorResponse(message, 500)
  }
})
