import { handleCors, errorResponse, jsonResponse } from '../_shared/cors.ts'
import { releaseReadyOrdersForSeller } from '../_shared/release-order-payout.ts'
import {
  isStripeInvalidConnectAccountError,
  resetSellerStripeConnectOnboarding,
} from '../_shared/stripe-connect-account.ts'
import { getStripe, isConnectAccountReady } from '../_shared/stripe.ts'
import { getAuthenticatedUser, getSupabaseAdmin } from '../_shared/supabase-admin.ts'

Deno.serve(async (req) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  if (req.method !== 'POST') {
    return errorResponse('Method not allowed', 405)
  }

  try {
    const user = await getAuthenticatedUser(req)

    if (!user) {
      return errorResponse('Unauthorized', 401)
    }

    const admin = getSupabaseAdmin()
    const stripe = getStripe()

    const { data: profile, error: profileError } = await admin
      .from('profiles')
      .select('id, stripe_account_id, stripe_onboarding_complete')
      .eq('id', user.id)
      .single()

    if (profileError || !profile) {
      return errorResponse('Profile not found', 404)
    }

    if (!profile.stripe_account_id) {
      return jsonResponse({
        stripe_onboarding_complete: false,
        payments_promoted: 0,
      })
    }

    let account

    try {
      account = await stripe.accounts.retrieve(profile.stripe_account_id)
    } catch (err) {
      if (isStripeInvalidConnectAccountError(err)) {
        const reset = await resetSellerStripeConnectOnboarding(admin, user.id, {
          notify: false,
        })

        console.warn(
          'stripe-connect-sync cleared invalid Connect account',
          user.id,
          reset,
        )

        return jsonResponse({
          stripe_onboarding_complete: false,
          stripe_account_reset: true,
          payments_promoted: 0,
        })
      }

      throw err
    }

    const onboardingComplete = isConnectAccountReady(account)

    const { data: updatedProfile, error: syncError } = await admin.rpc(
      'sync_seller_stripe_onboarding',
      {
        p_seller_id: user.id,
        p_stripe_account_id: account.id,
        p_onboarding_complete: onboardingComplete,
      },
    )

    if (syncError) {
      return errorResponse(syncError.message, 500)
    }

    const isOnboarded = updatedProfile?.stripe_onboarding_complete ?? onboardingComplete

    if (isOnboarded) {
      const { error: promoteError } = await admin.rpc('promote_seller_payments_to_pending', {
        p_seller_id: user.id,
      })

      if (promoteError) {
        console.error('promote_seller_payments_to_pending failed', promoteError.message)
        return errorResponse(promoteError.message, 500)
      }

      try {
        const releaseResults = await releaseReadyOrdersForSeller(admin, stripe, user.id)
        console.log('stripe-connect-sync payout release results', releaseResults)
      } catch (releaseError) {
        const message =
          releaseError instanceof Error ? releaseError.message : 'Payout release failed'
        console.error('stripe-connect-sync payout release failed', message)
      }
    }

    return jsonResponse({
      stripe_onboarding_complete: isOnboarded,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Connect sync failed'
    console.error(message)
    return errorResponse(message, 500)
  }
})
