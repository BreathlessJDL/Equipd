import { handleCors, errorResponse, jsonResponse } from '../_shared/cors.ts'
import { resolveBuyerCheckoutAmounts } from '../_shared/buyer-protection.ts'
import {
  buildCheckoutLineItems,
  resolveCheckoutCommerceSnapshot,
} from '../_shared/checkoutCommerce.ts'
import { checkoutSessionExpiresAt, getAppBaseUrl, getStripe } from '../_shared/stripe.ts'
import { getAuthenticatedUser, getSupabaseAdmin } from '../_shared/supabase-admin.ts'

type CheckoutRequest = {
  payment_id?: string
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

    const body = (await req.json()) as CheckoutRequest
    const paymentId = body.payment_id?.trim()

    if (!paymentId) {
      return errorResponse('payment_id is required', 400)
    }

    const admin = getSupabaseAdmin()
    const stripe = getStripe()
    const appBaseUrl = getAppBaseUrl()

    const { data: payment, error: paymentError } = await admin
      .from('payments')
      .select(
        `
        id,
        offer_id,
        listing_id,
        buyer_id,
        seller_id,
        status,
        amount_pence,
        buyer_protection_fee_pence,
        buyer_total_pence,
        quantity,
        listing_unit_price_pence,
        agreed_unit_price_pence,
        item_subtotal_pence,
        expires_at,
        updated_at,
        stripe_checkout_session_id,
        offer:offers!inner(id, status),
        listing:listings!inner(id, title, status, collection_available, courier_available, delivery_notes)
      `,
      )
      .eq('id', paymentId)
      .single()

    if (paymentError || !payment) {
      console.error('stripe-create-checkout payment lookup failed', paymentError?.message, paymentId)
      return errorResponse(paymentError?.message ?? 'Payment not found', 404)
    }

    if (payment.buyer_id !== user.id) {
      return errorResponse('Only the buyer can pay for this offer', 403)
    }

    const offer = Array.isArray(payment.offer) ? payment.offer[0] : payment.offer
    const listing = Array.isArray(payment.listing) ? payment.listing[0] : payment.listing

    if (!offer || !listing) {
      return errorResponse('Payment commerce relationships are incomplete', 500)
    }

    if (payment.status !== 'pending') {
      return errorResponse('Payment is not ready for checkout', 400)
    }

    if (new Date(payment.expires_at).getTime() <= Date.now()) {
      return errorResponse('Payment window has expired', 400)
    }

    if (offer?.status !== 'accepted') {
      return errorResponse('Offer must be accepted before payment', 400)
    }

    const { data: orderRow, error: orderError } = await admin
      .from('orders')
      .select(
        `
        id,
        payment_id,
        buyer_id,
        seller_id,
        listing_id,
        quantity,
        listing_unit_price_pence,
        agreed_unit_price_pence,
        item_subtotal_pence,
        amount_pence,
        buyer_protection_fee_pence,
        buyer_total_pence,
        inventory_state,
        order_type,
        fulfilment_status
      `,
      )
      .eq('payment_id', paymentId)
      .maybeSingle()

    if (orderError || !orderRow) {
      console.error('stripe-create-checkout order lookup failed', orderError?.message, paymentId)
      return errorResponse(orderError?.message ?? 'Order not found for payment', 404)
    }

    if (!orderRow.order_type) {
      return errorResponse('Select a fulfilment method before checkout', 400)
    }

    if (
      orderRow.inventory_state !== 'reserved'
      || orderRow.fulfilment_status !== 'awaiting_payment'
    ) {
      return errorResponse('Order reservation is not active', 400)
    }

    let commerceSnapshot
    try {
      commerceSnapshot = resolveCheckoutCommerceSnapshot(payment, orderRow)
    } catch (snapshotError) {
      const message =
        snapshotError instanceof Error ? snapshotError.message : 'Checkout snapshot is invalid'
      return errorResponse(message, 500)
    }

    const {
      quantity,
      agreedUnitPricePence,
      itemSubtotalPence,
      buyerProtectionFeePence,
      buyerTotalPence,
    } = commerceSnapshot

    const { data: allowedTypes, error: typesError } = await admin.rpc('get_listing_order_types', {
      p_listing_id: payment.listing_id,
    })

    if (typesError) {
      console.error('stripe-create-checkout fulfilment validation failed', typesError.message)
      return errorResponse(typesError.message, 500)
    }

    if (!allowedTypes?.includes(orderRow.order_type)) {
      return errorResponse('Selected fulfilment method is not available for this listing', 400)
    }

    if (payment.stripe_checkout_session_id) {
      const existingSession = await stripe.checkout.sessions.retrieve(
        payment.stripe_checkout_session_id,
      )

      if (existingSession.status === 'open' && existingSession.url) {
        return jsonResponse({ url: existingSession.url })
      }

      if (existingSession.status === 'complete') {
        return errorResponse('Payment is already processing', 409)
      }
    }

    const checkoutAmounts = resolveBuyerCheckoutAmounts(payment)

    if (
      checkoutAmounts.itemPricePence !== itemSubtotalPence
      || checkoutAmounts.buyerProtectionFeePence !== buyerProtectionFeePence
      || checkoutAmounts.buyerTotalPence !== buyerTotalPence
    ) {
      return errorResponse('Authoritative checkout totals do not match', 500)
    }

    const idempotencyVersion = new Date(payment.updated_at).getTime()
    const session = await stripe.checkout.sessions.create(
      {
        mode: 'payment',
        currency: 'gbp',
        line_items: buildCheckoutLineItems(commerceSnapshot, listing.title),
        metadata: {
          payment_id: payment.id,
          offer_id: payment.offer_id,
          listing_id: payment.listing_id,
          buyer_id: payment.buyer_id,
          seller_id: payment.seller_id,
          order_id: orderRow.id,
          order_type: orderRow.order_type,
          quantity: String(quantity),
          agreed_unit_price_pence: String(agreedUnitPricePence),
          item_subtotal_pence: String(itemSubtotalPence),
          buyer_protection_fee_pence: String(buyerProtectionFeePence),
          buyer_total_pence: String(buyerTotalPence),
        },
        success_url: `${appBaseUrl}/orders/${orderRow.id}?payment=success&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${appBaseUrl}/hub?payment=cancelled`,
        expires_at: checkoutSessionExpiresAt(payment.expires_at),
      },
      {
        idempotencyKey: `equipd-checkout:${payment.id}:${idempotencyVersion}`,
      },
    )

    if (!session.url) {
      return errorResponse('Failed to create checkout session', 500)
    }

    const { error: attachError } = await admin.rpc('attach_checkout_session', {
      p_payment_id: payment.id,
      p_buyer_id: user.id,
      p_stripe_checkout_session_id: session.id,
    })

    if (attachError) {
      console.error(
        'stripe-create-checkout attach_checkout_session failed',
        attachError.message,
        payment.id,
      )
      return errorResponse(attachError.message, 500)
    }

    return jsonResponse({ url: session.url })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Checkout session failed'
    console.error('stripe-create-checkout failed', message, err)
    return errorResponse(message, 500)
  }
})
