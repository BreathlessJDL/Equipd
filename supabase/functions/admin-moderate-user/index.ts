import { handleCors, errorResponse, jsonResponse } from '../_shared/cors.ts'
import { requireAdmin } from '../_shared/admin-auth.ts'
import { getSupabaseAdmin } from '../_shared/supabase-admin.ts'

type Body = {
  userId?: string
  reason?: string | null
  action?: 'suspend' | 'unsuspend'
}

/** ~100 years — supported GoTrue ban_duration format. */
const AUTH_BAN_DURATION = '876000h'
/** Official value to clear ban_duration / banned_until. */
const AUTH_UNBAN_DURATION = 'none'

Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  if (req.method !== 'POST') {
    return errorResponse('Method not allowed', 405)
  }

  const adminGate = await requireAdmin(req)
  if (adminGate instanceof Response) return adminGate

  let body: Body
  try {
    body = await req.json()
  } catch {
    return errorResponse('Invalid JSON body', 400)
  }

  const userId = typeof body.userId === 'string' ? body.userId.trim() : ''
  const action = body.action === 'unsuspend' ? 'unsuspend' : 'suspend'
  const reason = typeof body.reason === 'string' ? body.reason.trim() : ''

  if (!userId) return errorResponse('userId is required', 400)

  const { authHeader } = adminGate
  const url = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  if (!url || !anonKey) return errorResponse('Supabase auth credentials are not configured', 500)

  // Application suspension/unsuspension via SECURITY DEFINER RPCs as the admin caller.
  const userClient = (await import('npm:@supabase/supabase-js@2')).createClient(url, anonKey, {
    global: { headers: { Authorization: authHeader } },
  })

  const rpcName = action === 'unsuspend' ? 'admin_unsuspend_user' : 'admin_suspend_user'
  const { data, error } = await userClient.rpc(rpcName, {
    p_user_id: userId,
    p_reason: reason || null,
  })

  if (error) {
    return errorResponse(error.message || `Could not ${action} user`, 400)
  }

  // Defence-in-depth Auth ban/unban. Must not roll back application suspension state.
  // Already-issued access JWTs remain cryptographically valid until expiry; marketplace
  // mutations are still blocked by DB triggers / Edge checks on is_suspended.
  let authBanWarning: string | null = null
  try {
    const admin = getSupabaseAdmin()
    const { error: authError } = await admin.auth.admin.updateUserById(userId, {
      ban_duration: action === 'suspend' ? AUTH_BAN_DURATION : AUTH_UNBAN_DURATION,
    })

    if (authError) {
      authBanWarning =
        action === 'suspend'
          ? `User is application-suspended, but Auth ban failed: ${authError.message}`
          : `User is application-unsuspended, but clearing Auth ban failed: ${authError.message}`
      console.error(authBanWarning)
    }
  } catch (authException) {
    const message =
      authException instanceof Error ? authException.message : String(authException)
    authBanWarning =
      action === 'suspend'
        ? `User is application-suspended, but Auth ban failed: ${message}`
        : `User is application-unsuspended, but clearing Auth ban failed: ${message}`
    console.error(authBanWarning)
  }

  return jsonResponse({
    ok: true,
    action,
    result: data,
    authBanApplied: !authBanWarning,
    warning: authBanWarning,
  })
})
