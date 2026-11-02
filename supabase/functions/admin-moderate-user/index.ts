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

function rpcStatus(message: string): number {
  const lowered = message.toLowerCase()
  if (
    lowered.includes('admin access required') ||
    lowered.includes('authentication required') ||
    lowered.includes('only be performed by the server')
  ) {
    return 403
  }
  return 400
}

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

  // Application suspension must use the service-role client so the profile
  // privilege trigger recognises a trusted server write. The caller's JWT is
  // only used in requireAdmin above; never forwarded into the RPC.
  const admin = getSupabaseAdmin()
  const rpcName = action === 'unsuspend' ? 'admin_unsuspend_user' : 'admin_suspend_user'
  const { data, error } = await admin.rpc(rpcName, {
    p_user_id: userId,
    p_reason: reason || null,
    p_admin_id: adminGate.user.id,
  })

  if (error) {
    const message = error.message || `Could not ${action} user`
    return errorResponse(message, rpcStatus(message))
  }

  // Defence-in-depth Auth ban/unban after a successful profile write.
  // Already-issued access JWTs remain cryptographically valid until expiry;
  // marketplace mutations are still blocked by DB triggers / Edge checks on
  // is_suspended. Auth failures must not roll back application state.
  let authBanWarning: string | null = null
  try {
    const { error: authError } = await admin.auth.admin.updateUserById(userId, {
      ban_duration: action === 'suspend' ? AUTH_BAN_DURATION : AUTH_UNBAN_DURATION,
    })

    if (authError) {
      authBanWarning =
        action === 'suspend'
          ? `Incomplete: the Equipd profile is suspended, but the Auth ban failed (${authError.message}). Retry Suspend to finish the Auth ban; the profile and audit record will not be duplicated.`
          : `Incomplete: the Equipd profile is unsuspended, but clearing the Auth ban failed (${authError.message}). Retry Unsuspend to finish Auth; the profile and audit record will not be duplicated.`
      console.error(authBanWarning)
    }
  } catch (authException) {
    const message =
      authException instanceof Error ? authException.message : String(authException)
    authBanWarning =
      action === 'suspend'
        ? `Incomplete: the Equipd profile is suspended, but the Auth ban failed (${message}). Retry Suspend to finish the Auth ban; the profile and audit record will not be duplicated.`
        : `Incomplete: the Equipd profile is unsuspended, but clearing the Auth ban failed (${message}). Retry Unsuspend to finish Auth; the profile and audit record will not be duplicated.`
    console.error(authBanWarning)
  }

  const rpcResult =
    data && typeof data === 'object' ? (data as { alreadyApplied?: boolean }) : null

  return jsonResponse({
    ok: !authBanWarning,
    partial: Boolean(authBanWarning),
    action,
    result: data,
    alreadyApplied: rpcResult?.alreadyApplied === true,
    authBanApplied: !authBanWarning,
    warning: authBanWarning,
  })
})
