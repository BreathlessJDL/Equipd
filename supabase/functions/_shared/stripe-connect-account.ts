import type { SupabaseClient } from 'npm:@supabase/supabase-js@2'
import type Stripe from 'npm:stripe@17.7.0'

/**
 * True when Stripe rejects a Connect account because it does not exist in the
 * current API mode (e.g. test account ID used with live secret key).
 */
export function isStripeInvalidConnectAccountError(err: unknown): boolean {
  if (!err || typeof err !== 'object') {
    return false
  }

  const stripeErr = err as Stripe.errors.StripeError & {
    code?: string
    param?: string
  }

  const message = (stripeErr.message ?? '').toLowerCase()
  const code = stripeErr.code ?? ''

  if (code === 'resource_missing') {
    return true
  }

  if (message.includes('no such account')) {
    return true
  }

  if (message.includes('does not exist')) {
    return true
  }

  if (message.includes('a similar object exists in test mode')) {
    return true
  }

  if (message.includes('a similar object exists in live mode')) {
    return true
  }

  if (message.includes('was created in test mode')) {
    return true
  }

  if (message.includes('was created in live mode')) {
    return true
  }

  return false
}

export type ResetSellerStripeConnectResult = {
  seller_id: string
  orders_reverted: number
  notified: boolean
}

export async function resetSellerStripeConnectOnboarding(
  admin: SupabaseClient,
  sellerId: string,
  { notify = true }: { notify?: boolean } = {},
): Promise<ResetSellerStripeConnectResult> {
  const { data, error } = await admin.rpc('reset_seller_stripe_connect_onboarding', {
    p_seller_id: sellerId,
    p_notify: notify,
  })

  if (error) {
    throw error
  }

  const result = (data ?? {}) as ResetSellerStripeConnectResult

  return {
    seller_id: result.seller_id ?? sellerId,
    orders_reverted: result.orders_reverted ?? 0,
    notified: result.notified ?? notify,
  }
}
