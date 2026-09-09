import { requireAdmin } from '../_shared/admin-auth.ts'
import { handleCors, errorResponse, jsonResponse } from '../_shared/cors.ts'
import { getSupabaseAdmin } from '../_shared/supabase-admin.ts'

const IMPERSONATION_TTL_MS = 60 * 60 * 1000

type StartBody = {
  targetUserId?: string
}

function readClientMeta(req: Request) {
  const forwarded = req.headers.get('x-forwarded-for')
  const ip = (forwarded?.split(',')[0] || req.headers.get('cf-connecting-ip') || '').trim() || null
  const userAgent = req.headers.get('user-agent')?.trim() || null
  return { ip, userAgent }
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
    let body: StartBody = {}
    try {
      body = (await req.json()) as StartBody
    } catch {
      return errorResponse('Invalid JSON body', 400)
    }

    const targetUserId = String(body.targetUserId || '').trim()
    if (!targetUserId) {
      return errorResponse('targetUserId is required', 400)
    }

    if (targetUserId === adminUser.id) {
      return errorResponse('Cannot impersonate yourself', 403)
    }

    const supabaseAdmin = getSupabaseAdmin()

    const { data: targetUserData, error: targetUserError } =
      await supabaseAdmin.auth.admin.getUserById(targetUserId)

    if (targetUserError || !targetUserData?.user) {
      return errorResponse('Target user not found', 404)
    }

    const targetAuthUser = targetUserData.user
    if (!targetAuthUser.email) {
      return errorResponse('Target user has no email; cannot start impersonation', 400)
    }

    const { data: targetProfile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('id, username, display_name, is_admin')
      .eq('id', targetUserId)
      .maybeSingle()

    if (profileError) {
      console.error('admin-impersonate-start profile lookup failed', profileError.message)
      return errorResponse('Could not load target profile', 500)
    }

    if (!targetProfile) {
      return errorResponse('Target user not found', 404)
    }

    if (targetProfile.is_admin === true) {
      return errorResponse('Cannot impersonate an admin account', 403)
    }

    const { data: adminAuthData, error: adminAuthError } =
      await supabaseAdmin.auth.admin.getUserById(adminUser.id)

    if (adminAuthError || !adminAuthData?.user?.email) {
      return errorResponse('Admin account email is required for session restoration', 500)
    }

    const adminEmail = adminAuthData.user.email
    const { ip, userAgent } = readClientMeta(req)
    const startedAt = new Date()
    const expiresAt = new Date(startedAt.getTime() + IMPERSONATION_TTL_MS)

    // Supersede any still-open sessions for this admin to avoid ambiguous binds.
    await supabaseAdmin
      .from('admin_impersonation_sessions')
      .update({
        ended_at: startedAt.toISOString(),
        metadata: { ended_reason: 'superseded' },
      })
      .eq('admin_user_id', adminUser.id)
      .is('ended_at', null)

    const { data: sessionRow, error: insertError } = await supabaseAdmin
      .from('admin_impersonation_sessions')
      .insert({
        admin_user_id: adminUser.id,
        impersonated_user_id: targetUserId,
        started_at: startedAt.toISOString(),
        expires_at: expiresAt.toISOString(),
        ip,
        user_agent: userAgent,
        metadata: {
          target_username: targetProfile.username,
          target_display_name: targetProfile.display_name,
        },
      })
      .select('id, started_at, expires_at')
      .single()

    if (insertError || !sessionRow) {
      console.error('admin-impersonate-start insert failed', insertError?.message)
      return errorResponse('Could not create impersonation session', 500)
    }

    const { data: customerLink, error: customerLinkError } =
      await supabaseAdmin.auth.admin.generateLink({
        type: 'magiclink',
        email: targetAuthUser.email,
      })

    if (customerLinkError || !customerLink?.properties?.hashed_token) {
      console.error('admin-impersonate-start customer link failed', customerLinkError?.message)
      await supabaseAdmin
        .from('admin_impersonation_sessions')
        .update({
          ended_at: new Date().toISOString(),
          metadata: { ended_reason: 'customer_link_failed' },
        })
        .eq('id', sessionRow.id)
      return errorResponse('Could not create customer session token', 500)
    }

    // Existence was validated above; refuse if Auth unexpectedly created a different user.
    if (customerLink.user?.id && customerLink.user.id !== targetUserId) {
      await supabaseAdmin
        .from('admin_impersonation_sessions')
        .update({
          ended_at: new Date().toISOString(),
          metadata: { ended_reason: 'user_mismatch' },
        })
        .eq('id', sessionRow.id)
      return errorResponse('Impersonation aborted: unexpected user created', 500)
    }

    const { data: restoreLink, error: restoreLinkError } =
      await supabaseAdmin.auth.admin.generateLink({
        type: 'magiclink',
        email: adminEmail,
      })

    if (restoreLinkError || !restoreLink?.properties?.hashed_token) {
      console.error('admin-impersonate-start restore link failed', restoreLinkError?.message)
      await supabaseAdmin
        .from('admin_impersonation_sessions')
        .update({
          ended_at: new Date().toISOString(),
          metadata: { ended_reason: 'restore_link_failed' },
        })
        .eq('id', sessionRow.id)
      return errorResponse('Could not create admin restoration token', 500)
    }

    if (restoreLink.user?.id && restoreLink.user.id !== adminUser.id) {
      await supabaseAdmin
        .from('admin_impersonation_sessions')
        .update({
          ended_at: new Date().toISOString(),
          metadata: { ended_reason: 'admin_mismatch' },
        })
        .eq('id', sessionRow.id)
      return errorResponse('Impersonation aborted: admin restoration identity mismatch', 500)
    }

    return jsonResponse({
      sessionId: sessionRow.id,
      expiresAt: sessionRow.expires_at,
      customerHashedToken: customerLink.properties.hashed_token,
      adminRestoreHashedToken: restoreLink.properties.hashed_token,
      target: {
        id: targetProfile.id,
        username: targetProfile.username,
        displayName: targetProfile.display_name,
        email: targetAuthUser.email,
      },
      adminUserId: adminUser.id,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Impersonation start failed'
    console.error('admin-impersonate-start unhandled', message)
    return errorResponse(message, 500)
  }
})
