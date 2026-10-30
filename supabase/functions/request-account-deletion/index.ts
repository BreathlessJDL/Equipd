import { handleCors, errorResponse, jsonResponse } from '../_shared/cors.ts'
import { getAuthenticatedUser, getSupabaseAdmin } from '../_shared/supabase-admin.ts'
import { mergeDeletionEvaluation } from '../_shared/accountDeletionStripeDisputes.js'
import { checkAccountStripeDisputes } from '../_shared/checkAccountStripeDisputes.ts'
import { createClient, type User } from 'npm:@supabase/supabase-js@2'

const AUTH_BAN_DURATION = '876000h'
const CONFIRMATION_TEXT = 'DELETE'
const LISTING_IMAGES_BUCKET = 'listing-images'
/** Shelved indefinitely. Keep the implementation below; do not serve it to users. */
const ACCOUNT_DELETION_SHELVED = true

type Body = {
  password?: string
  confirmationText?: string
  evaluateOnly?: boolean
}

function hasPasswordIdentity(user: User): boolean {
  const identities = user.identities ?? []
  if (identities.some((identity) => identity.provider === 'email')) return true

  const providers = user.app_metadata?.providers
  if (Array.isArray(providers) && providers.includes('email')) return true

  return false
}

async function deleteStoragePaths(bucket: string, paths: string[]) {
  if (!paths.length) {
    return { attempted: 0, error: null as string | null }
  }

  const admin = getSupabaseAdmin()
  const { error } = await admin.storage.from(bucket).remove(paths)
  return {
    attempted: paths.length,
    error: error?.message ?? null,
  }
}

async function deleteProfileImages(userId: string) {
  const admin = getSupabaseAdmin()
  const { data: files, error } = await admin.storage.from('profile-images').list(userId, {
    limit: 100,
  })

  if (error) {
    console.error('profile-images list failed', error.message)
    return { attempted: 0, error: error.message }
  }

  const paths = (files ?? [])
    .map((file) => file?.name)
    .filter((name): name is string => Boolean(name))
    .map((name) => `${userId}/${name}`)

  return deleteStoragePaths('profile-images', paths)
}

async function cleanupAccountMedia(userId: string) {
  const admin = getSupabaseAdmin()
  const { data, error } = await admin.rpc('list_account_media_cleanup_targets', {
    p_user_id: userId,
  })

  if (error) {
    console.error('list_account_media_cleanup_targets failed', error.message)
    return {
      listingImagePaths: [],
      listingImages: { attempted: 0, error: error.message },
      profileImages: await deleteProfileImages(userId),
    }
  }

  const listingImagePaths = Array.isArray(data?.listingImagePaths)
    ? data.listingImagePaths.filter((path: unknown): path is string => typeof path === 'string' && path.length > 0)
    : []

  const listingImages = await deleteStoragePaths(LISTING_IMAGES_BUCKET, listingImagePaths)
  const profileImages = await deleteProfileImages(userId)

  const cleanup = {
    listingImagePaths,
    listingImages,
    profileImages,
    retainMessageAttachments: true,
    retainOrderEvidence: true,
    retainSoldListingImages: true,
  }

  const { error: recordError } = await admin.rpc('record_account_media_cleanup', {
    p_user_id: userId,
    p_cleanup: cleanup,
  })
  if (recordError) {
    console.error('record_account_media_cleanup failed', recordError.message)
  }

  return cleanup
}

async function unlinkOAuthIdentities(userId: string) {
  const admin = getSupabaseAdmin()
  const { data, error } = await admin.auth.admin.getUserById(userId)
  if (error) {
    return { unlinked: [] as string[], error: error.message }
  }

  const identities = data.user?.identities ?? []
  const unlinked: string[] = []
  const failures: string[] = []

  for (const identity of identities) {
    if (!identity?.id || identity.provider === 'email') continue

    const { error: unlinkError } = await admin.auth.admin.deleteIdentity({
      id: identity.id,
      user_id: userId,
      identity_id: identity.identity_id ?? identity.id,
      provider: identity.provider,
      identity_data: identity.identity_data ?? {},
    } as never)

    if (unlinkError) {
      const fallback = await unlinkIdentityViaGoTrue(userId, identity.identity_id ?? identity.id)
      if (fallback) {
        failures.push(`${identity.provider}: ${fallback}`)
      } else {
        unlinked.push(identity.provider)
      }
    } else {
      unlinked.push(identity.provider)
    }
  }

  return {
    unlinked,
    error: failures.length ? failures.join('; ') : null,
  }
}

async function unlinkIdentityViaGoTrue(userId: string, identityId: string) {
  const url = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !serviceRoleKey || !identityId) {
    return 'OAuth unlink is not configured'
  }

  try {
    const response = await fetch(
      `${url}/auth/v1/admin/users/${userId}/identities/${identityId}`,
      {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${serviceRoleKey}`,
          apikey: serviceRoleKey,
        },
      },
    )
    if (!response.ok) {
      const text = await response.text()
      return text || `HTTP ${response.status}`
    }
    return null
  } catch (error) {
    return error instanceof Error ? error.message : String(error)
  }
}

async function evaluateDeletionWithStripe(userId: string) {
  const admin = getSupabaseAdmin()
  const { data: sqlEvaluation, error: evaluationError } = await admin.rpc(
    'evaluate_account_deletion',
    { p_user_id: userId },
  )

  if (evaluationError) {
    return {
      evaluation: null,
      error: evaluationError.message || 'Could not check whether this account can be deleted.',
    }
  }

  const stripeCheck = await checkAccountStripeDisputes(admin, userId)
  if (!stripeCheck.ok) {
    console.error('account deletion stripe dispute check failed', stripeCheck.error)
  }

  return {
    evaluation: mergeDeletionEvaluation(sqlEvaluation, stripeCheck),
    error: null,
  }
}

function blockedDeletionResponse(evaluation: Record<string, unknown> | null) {
  const blockers = Array.isArray(evaluation?.blockers) ? evaluation.blockers : []
  const firstMessage = blockers[0]?.message
  return jsonResponse(
    {
      error:
        firstMessage ||
        'This account cannot be deleted yet. Finish open orders, disputes, refunds or payouts first, or contact Equipd support.',
      evaluation,
    },
    409,
  )
}

async function lockAuthAccount(user: User) {
  const admin = getSupabaseAdmin()
  const deletedEmail = `deleted+${user.id.replace(/-/g, '')}@users.invalid`

  const { error: authUpdateError } = await admin.auth.admin.updateUserById(user.id, {
    email: deletedEmail,
    email_confirm: true,
    ban_duration: AUTH_BAN_DURATION,
    user_metadata: {
      ...(user.user_metadata ?? {}),
      display_name: 'Deleted account',
      username: null,
      account_deleted: true,
    },
  })

  if (authUpdateError) {
    return authUpdateError
  }

  try {
    await admin.auth.admin.signOut(user.id, 'global')
  } catch (signOutError) {
    console.error(
      'account deletion sign-out failed',
      signOutError instanceof Error ? signOutError.message : String(signOutError),
    )
  }

  return null
}

Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  if (ACCOUNT_DELETION_SHELVED) {
    return errorResponse('Account deletion is not available.', 410)
  }

  if (req.method !== 'POST') {
    return errorResponse('Method not allowed', 405)
  }

  const user = await getAuthenticatedUser(req)
  if (!user?.id || !user.email) {
    return errorResponse('Authentication required', 401)
  }

  if (typeof user.app_metadata?.impersonated_by === 'string' && user.app_metadata.impersonated_by) {
    return errorResponse('Unavailable while logged in as another user.', 403)
  }

  let body: Body
  try {
    body = await req.json()
  } catch {
    return errorResponse('Invalid JSON body', 400)
  }

  const password = typeof body.password === 'string' ? body.password : ''
  const confirmationText =
    typeof body.confirmationText === 'string' ? body.confirmationText.trim() : ''
  const evaluateOnly = body.evaluateOnly === true

  if (evaluateOnly) {
    const { evaluation, error: evaluationError } = await evaluateDeletionWithStripe(user.id)
    if (evaluationError) {
      return errorResponse(evaluationError, 500)
    }
    return jsonResponse({ ok: true, evaluation })
  }

  if (confirmationText !== CONFIRMATION_TEXT) {
    return errorResponse(`Type ${CONFIRMATION_TEXT} to confirm account deletion.`, 400)
  }

  const admin = getSupabaseAdmin()
  const { data: profile, error: profileError } = await admin
    .from('profiles')
    .select('id, deleted_at, deletion_requested_at')
    .eq('id', user.id)
    .maybeSingle()

  if (profileError) {
    console.error('account deletion profile load failed', profileError.message)
    return errorResponse('Could not load your account for deletion.', 500)
  }

  const alreadyAnonymised = Boolean(profile?.deleted_at)

  if (!alreadyAnonymised) {
    if (!hasPasswordIdentity(user)) {
      return errorResponse(
        'This account uses social sign-in and cannot be deleted from Settings yet. Contact Equipd support to close it.',
        400,
      )
    }

    if (!password) {
      return errorResponse('Enter your current password to delete your account.', 400)
    }

    const url = Deno.env.get('SUPABASE_URL')
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
    if (!url || !anonKey) {
      return errorResponse('Supabase auth credentials are not configured', 500)
    }

    const passwordClient = createClient(url, anonKey)
    const { error: passwordError } = await passwordClient.auth.signInWithPassword({
      email: user.email,
      password,
    })

    if (passwordError) {
      return errorResponse('Current password is incorrect.', 401)
    }

    try {
      await passwordClient.auth.signOut({ scope: 'local' })
    } catch {
      // The extra password-check session is best-effort cleanup.
    }
  }

  try {
    if (!alreadyAnonymised) {
      const { evaluation, error: evaluationError } = await evaluateDeletionWithStripe(user.id)
      if (evaluationError) {
        return errorResponse(evaluationError, 500)
      }
      if (!evaluation?.allowed) {
        return blockedDeletionResponse(evaluation)
      }

      const { data: beginResult, error: beginError } = await admin.rpc('begin_account_deletion', {
        p_user_id: user.id,
      })

      if (beginError) {
        console.error('begin_account_deletion failed', beginError.message)
        return errorResponse(beginError.message || 'Could not start account deletion.', 400)
      }

      if (beginResult?.ok === false) {
        const blockers = Array.isArray(beginResult?.evaluation?.blockers)
          ? beginResult.evaluation.blockers
          : []
        const firstMessage = blockers[0]?.message
        return jsonResponse(
          {
            error:
              firstMessage ||
              'This account cannot be deleted yet. Finish open orders, disputes, refunds or payouts first, or contact Equipd support.',
            evaluation: beginResult?.evaluation,
          },
          409,
        )
      }

      const { data: anonymizeResult, error: anonymizeError } = await admin.rpc(
        'anonymize_deleted_account',
        { p_user_id: user.id },
      )

      if (anonymizeError) {
        console.error('anonymize_deleted_account failed', anonymizeError.message)
        await admin.rpc('abort_account_deletion_pending', { p_user_id: user.id })
        return errorResponse(anonymizeError.message || 'Could not delete your account.', 400)
      }

      if (!anonymizeResult?.ok) {
        await admin.rpc('abort_account_deletion_pending', { p_user_id: user.id })
        const blockers = Array.isArray(anonymizeResult?.evaluation?.blockers)
          ? anonymizeResult.evaluation.blockers
          : []
        const firstMessage = blockers[0]?.message
        return jsonResponse(
          {
            error:
              firstMessage ||
              'This account cannot be deleted yet. Finish open orders, disputes, refunds or payouts first, or contact Equipd support.',
            evaluation: anonymizeResult?.evaluation,
          },
          409,
        )
      }
    }

    await cleanupAccountMedia(user.id)

    const authUpdateError = await lockAuthAccount(user)
    if (authUpdateError) {
      console.error('account deletion auth update failed', authUpdateError.message)
      return errorResponse(
        'Your marketplace profile was closed. Sign-in could not be fully disabled. Please try again, or contact Equipd support.',
        500,
      )
    }

    const oauth = await unlinkOAuthIdentities(user.id)
    if (oauth.error) {
      console.error('account deletion oauth unlink failed', oauth.error)
    }

    return jsonResponse({
      ok: true,
      message: 'Your account has been deleted.',
      oauthUnlinked: oauth.unlinked,
    })
  } catch (error) {
    console.error(
      'account deletion failed',
      error instanceof Error ? error.message : String(error),
    )
    return errorResponse('Could not delete your account. Please try again.', 500)
  }
})
