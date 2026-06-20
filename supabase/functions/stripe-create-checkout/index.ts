import { handleCors, errorResponse, jsonResponse } from '../_shared/cors.ts'
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
        expires_at,
        stripe_checkout_session_id,
        offer:offers!inner(id, status),
        listing:listings!inner(id, title, status)
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

    if (payment.status !== 'pending') {
      return errorResponse('Payment is not ready for checkout', 400)
    }

    if (new Date(payment.expires_at).getTime() <= Date.now()) {
      return errorResponse('Payment window has expired', 400)
    }

    if (payment.offer?.status !== 'accepted') {
      return errorResponse('Offer must be accepted before payment', 400)
    }

    if (payment.listing?.status !== 'reserved') {
      return errorResponse('Listing is not reserved for payment', 400)
    }

    if (payment.stripe_checkout_session_id) {
      const existingSession = await stripe.checkout.sessions.retrieve(
        payment.stripe_checkout_session_id,
      )

      if (existingSession.status === 'open' && existingSession.url) {
        return jsonResponse({ url: existingSession.url })
      }
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      currency: 'gbp',
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: 'gbp',
            unit_amount: payment.amount_pence,
            product_data: {
              name: payment.listing.title,
              description: `Accepted offer on ${payment.listing.title}`,
            },
          },
        },
      ],
      metadata: {
        payment_id: payment.id,
        offer_id: payment.offer_id,
        listing_id: payment.listing_id,
        buyer_id: payment.buyer_id,
        seller_id: payment.seller_id,
      },
      success_url: `${appBaseUrl}/hub?payment=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appBaseUrl}/hub?payment=cancelled`,
      expires_at: checkoutSessionExpiresAt(payment.expires_at),
    })

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
