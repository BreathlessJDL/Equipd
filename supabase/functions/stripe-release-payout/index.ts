import { handleCors, errorResponse, jsonResponse } from '../_shared/cors.ts'
import { releaseOrderPayout } from '../_shared/release-order-payout.ts'
import { getStripe } from '../_shared/stripe.ts'
import { getAuthenticatedUser, getSupabaseAdmin } from '../_shared/supabase-admin.ts'

type ReleaseRequest = {
  order_id?: string
}

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

    const body = (await req.json()) as ReleaseRequest
    const orderId = body.order_id?.trim()

    if (!orderId) {
      return errorResponse('order_id is required', 400)
    }

    const admin = getSupabaseAdmin()
    const stripe = getStripe()

    const { data: order, error: orderError } = await admin
      .from('orders')
      .select('id, buyer_id, seller_id')
      .eq('id', orderId)
      .single()

    if (orderError || !order) {
      return errorResponse(orderError?.message ?? 'Order not found', 404)
    }

    if (order.buyer_id !== user.id && order.seller_id !== user.id) {
      return errorResponse('Only the buyer or seller can release payout for this order', 403)
    }

    const result = await releaseOrderPayout(admin, stripe, orderId)

    return jsonResponse(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Payout release failed'
    console.error('stripe-release-payout failed', message, err)
    return errorResponse(message, 500)
  }
})
