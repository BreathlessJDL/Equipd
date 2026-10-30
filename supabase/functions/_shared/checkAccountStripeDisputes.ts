import type { SupabaseClient } from 'npm:@supabase/supabase-js@2'
import { getStripe } from './stripe.ts'
import {
  isOpenStripeDispute,
} from './accountDeletionStripeDisputes.js'

const MAX_PAYMENT_ROWS = 80

type StripeCheck = {
  ok: boolean
  openCount: number
  error?: string
}

function uniqueTexts(values: Array<string | null | undefined>) {
  return [...new Set(values.map((value) => String(value ?? '').trim()).filter(Boolean))]
}

async function countOpenDisputesForRefs(
  paymentIntents: string[],
  chargeIds: string[],
  stripeAccount?: string | null,
) {
  const stripe = getStripe()
  const requestOptions = stripeAccount ? { stripeAccount } : undefined
  let openCount = 0
  const seen = new Set<string>()

  for (const paymentIntent of paymentIntents) {
    const list = await stripe.disputes.list(
      { payment_intent: paymentIntent, limit: 20 },
      requestOptions,
    )
    for (const dispute of list.data) {
      if (!seen.has(dispute.id) && isOpenStripeDispute(dispute)) {
        seen.add(dispute.id)
        openCount += 1
      }
    }
  }

  for (const chargeId of chargeIds) {
    const list = await stripe.disputes.list(
      { charge: chargeId, limit: 20 },
      requestOptions,
    )
    for (const dispute of list.data) {
      if (!seen.has(dispute.id) && isOpenStripeDispute(dispute)) {
        seen.add(dispute.id)
        openCount += 1
      }
    }
  }

  return openCount
}

export async function checkAccountStripeDisputes(
  admin: SupabaseClient,
  userId: string,
): Promise<StripeCheck> {
  try {
    const { data: payments, error } = await admin
      .from('payments')
      .select('stripe_charge_id, stripe_payment_intent_id')
      .or(`buyer_id.eq.${userId},seller_id.eq.${userId}`)
      .limit(MAX_PAYMENT_ROWS)

    if (error) {
      return { ok: false, openCount: 0, error: error.message }
    }

    const paymentIntents = uniqueTexts((payments ?? []).map((row) => row.stripe_payment_intent_id))
    const chargeIds = uniqueTexts((payments ?? []).map((row) => row.stripe_charge_id))

    const { data: profile, error: profileError } = await admin
      .from('profiles')
      .select('stripe_account_id')
      .eq('id', userId)
      .maybeSingle()

    if (profileError) {
      return { ok: false, openCount: 0, error: profileError.message }
    }

    const connectAccountId = typeof profile?.stripe_account_id === 'string'
      ? profile.stripe_account_id.trim()
      : ''

    if (!paymentIntents.length && !chargeIds.length && !connectAccountId) {
      return { ok: true, openCount: 0 }
    }

    let openCount = 0
    if (paymentIntents.length || chargeIds.length) {
      openCount += await countOpenDisputesForRefs(paymentIntents, chargeIds)
    }
    if (connectAccountId) {
      openCount += await countOpenDisputesForRefs(paymentIntents, chargeIds, connectAccountId)
    }

    return { ok: true, openCount }
  } catch (error) {
    return {
      ok: false,
      openCount: 0,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}
