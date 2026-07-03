import {
  buildSellerBusinessProfileUrl,
  STRIPE_BUSINESS_PROFILE_PRODUCT_DESCRIPTION,
} from '../_shared/sellerShopUrl.ts'
import { handleCors, errorResponse, jsonResponse } from '../_shared/cors.ts'
import {
  isStripeInvalidConnectAccountError,
  resetSellerStripeConnectOnboarding,
} from '../_shared/stripe-connect-account.ts'
import { getAppBaseUrl, getStripe } from '../_shared/stripe.ts'
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
    const appBaseUrl = getAppBaseUrl()

    const { data: profile, error: profileError } = await admin
      .from('profiles')
      .select('id, username, stripe_account_id, stripe_onboarding_complete')
      .eq('id', user.id)
      .single()

    if (profileError || !profile) {
      return errorResponse('Profile not found', 404)
    }

    const businessProfile = {
      url: buildSellerBusinessProfileUrl(profile, appBaseUrl),
      product_description: STRIPE_BUSINESS_PROFILE_PRODUCT_DESCRIPTION,
    }

    let accountId = profile.stripe_account_id

    if (accountId) {
      try {
        await stripe.accounts.update(accountId, {
          business_profile: businessProfile,
        })
      } catch (err) {
        if (isStripeInvalidConnectAccountError(err)) {
          await resetSellerStripeConnectOnboarding(admin, user.id, { notify: false })
          accountId = null
          console.warn(
            'stripe-connect-onboard cleared invalid Connect account before creating live account',
            user.id,
          )
        } else {
          throw err
        }
      }
    }

    if (!accountId) {
      const { data: authUser, error: authError } = await admin.auth.admin.getUserById(user.id)

      if (authError) {
        return errorResponse(authError.message, 500)
      }

      const account = await stripe.accounts.create({
        type: 'express',
        country: 'GB',
        email: authUser.user?.email ?? undefined,
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        business_profile: businessProfile,
        metadata: {
          equipd_user_id: user.id,
        },
      })

      accountId = account.id

      const { error: syncError } = await admin.rpc('sync_seller_stripe_onboarding', {
        p_seller_id: user.id,
        p_stripe_account_id: accountId,
        p_onboarding_complete: false,
      })

      if (syncError) {
        return errorResponse(syncError.message, 500)
      }
    }

    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      type: 'account_onboarding',
      refresh_url: `${appBaseUrl}/settings?stripe=refresh`,
      return_url: `${appBaseUrl}/settings?stripe=return`,
    })

    if (!accountLink.url) {
      return errorResponse('Failed to create Stripe onboarding link', 500)
    }

    return jsonResponse({ url: accountLink.url })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Connect onboarding failed'
    console.error(message)
    return errorResponse(message, 500)
  }
})
