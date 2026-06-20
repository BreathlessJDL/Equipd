import type { SupabaseClient } from 'npm:@supabase/supabase-js@2'
import type Stripe from 'npm:stripe@17.7.0'
import { isConnectAccountReady } from './stripe.ts'

type OrderRow = {
  id: string
  payment_id: string
  listing_id: string
  buyer_id: string
  seller_id: string
  seller_net_pence: number
  payout_status: string
  stripe_transfer_id: string | null
  payment: {
    status: string
    stripe_charge_id: string | null
  } | null
  listing: {
    status: string
  } | null
  seller: {
    stripe_account_id: string | null
    stripe_onboarding_complete: boolean | null
  } | null
}

export type ReleaseOrderPayoutResult = {
  order_id: string
  payout_status: string
  stripe_transfer_id: string | null
  listing_status: string | null
  released: boolean
  skipped?: string
}

export async function releaseOrderPayout(
  admin: SupabaseClient,
  stripe: Stripe,
  orderId: string,
): Promise<ReleaseOrderPayoutResult> {
  const { data: order, error: orderError } = await admin
    .from('orders')
    .select(
      `
      id,
      payment_id,
      listing_id,
      buyer_id,
      seller_id,
      seller_net_pence,
      payout_status,
      stripe_transfer_id,
      payment:payments!inner(status, stripe_charge_id),
      listing:listings!inner(status),
      seller:profiles!orders_seller_id_fkey(stripe_account_id, stripe_onboarding_complete)
    `,
    )
    .eq('id', orderId)
    .single()

  if (orderError || !order) {
    throw new Error(orderError?.message ?? 'Order not found')
  }

  const row = order as OrderRow

  if (row.payout_status === 'paid') {
    return {
      order_id: row.id,
      payout_status: row.payout_status,
      stripe_transfer_id: row.stripe_transfer_id,
      listing_status: row.listing?.status ?? null,
      released: true,
      skipped: 'already_paid',
    }
  }

  if (!['ready', 'failed'].includes(row.payout_status)) {
    return {
      order_id: row.id,
      payout_status: row.payout_status,
      stripe_transfer_id: row.stripe_transfer_id,
      listing_status: row.listing?.status ?? null,
      released: false,
      skipped: `payout_status_${row.payout_status}`,
    }
  }

  const chargeId = row.payment?.stripe_charge_id
  const accountId = row.seller?.stripe_account_id

  if (!chargeId) {
    throw new Error('Payment charge is not available for payout release')
  }

  if (!accountId || !row.seller?.stripe_onboarding_complete) {
    throw new Error('Seller payout setup is not complete')
  }

  const account = await stripe.accounts.retrieve(accountId)

  if (!isConnectAccountReady(account)) {
    throw new Error('Seller Stripe account is not ready for payouts')
  }

  const { error: processingError } = await admin.rpc('mark_order_payout_processing', {
    p_order_id: orderId,
  })

  if (processingError) {
    throw new Error(processingError.message)
  }

  let transfer: Stripe.Transfer

  try {
    transfer = await stripe.transfers.create(
      {
        amount: row.seller_net_pence,
        currency: 'gbp',
        destination: accountId,
        source_transaction: chargeId,
        metadata: {
          order_id: row.id,
          payment_id: row.payment_id,
          listing_id: row.listing_id,
          seller_id: row.seller_id,
          buyer_id: row.buyer_id,
        },
      },
      {
        idempotencyKey: `equipd-release-order-${orderId}`,
      },
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Stripe transfer failed'

    const { error: failedError } = await admin.rpc('mark_order_payout_failed', {
      p_order_id: orderId,
    })

    if (failedError) {
      console.error('mark_order_payout_failed failed', orderId, failedError.message)
    }

    throw new Error(message)
  }

  const { data: releasedOrder, error: releasedError } = await admin.rpc(
    'mark_order_payout_released',
    {
      p_order_id: orderId,
      p_stripe_transfer_id: transfer.id,
    },
  )

  if (releasedError) {
    console.error('mark_order_payout_released failed after transfer', orderId, transfer.id, releasedError.message)
    throw new Error(releasedError.message)
  }

  const { data: listing } = await admin
    .from('listings')
    .select('status')
    .eq('id', row.listing_id)
    .single()

  return {
    order_id: orderId,
    payout_status: releasedOrder?.payout_status ?? 'paid',
    stripe_transfer_id: transfer.id,
    listing_status: listing?.status ?? null,
    released: true,
  }
}

export async function releaseReadyOrdersForSeller(
  admin: SupabaseClient,
  stripe: Stripe,
  sellerId: string,
): Promise<ReleaseOrderPayoutResult[]> {
  const { data: orders, error } = await admin
    .from('orders')
    .select('id')
    .eq('seller_id', sellerId)
    .eq('fulfilment_status', 'buyer_confirmed')
    .in('payout_status', ['ready', 'failed'])

  if (error) {
    throw error
  }

  const results: ReleaseOrderPayoutResult[] = []

  for (const order of orders ?? []) {
    try {
      results.push(await releaseOrderPayout(admin, stripe, order.id))
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Payout release failed'
      console.error('releaseOrderPayout failed', order.id, message)
      results.push({
        order_id: order.id,
        payout_status: 'failed',
        stripe_transfer_id: null,
        listing_status: null,
        released: false,
        skipped: message,
      })
    }
  }

  return results
}
