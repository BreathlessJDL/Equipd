import Stripe from 'npm:stripe@17.7.0'
import { handleCors, errorResponse, jsonResponse } from '../_shared/cors.ts'
import { getStripe, isConnectAccountReady } from '../_shared/stripe.ts'
import { getSupabaseAdmin, syncSellerFromStripeAccount } from '../_shared/supabase-admin.ts'

const cryptoProvider = Stripe.createSubtleCryptoProvider()

Deno.serve(async (req) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  console.log('stripe-webhook received', {
    method: req.method,
    has_stripe_signature: Boolean(req.headers.get('stripe-signature')),
  })

  if (req.method !== 'POST') {
    return errorResponse('Method not allowed', 405)
  }

  try {
    const stripe = getStripe()
    const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')

    if (!webhookSecret) {
      console.error('stripe-webhook STRIPE_WEBHOOK_SECRET is not configured')
      return errorResponse('STRIPE_WEBHOOK_SECRET is not configured', 500)
    }

    const signature = req.headers.get('stripe-signature')

    if (!signature) {
      console.error('stripe-webhook missing stripe-signature header')
      return errorResponse('Missing Stripe signature', 400)
    }

    const body = await req.text()
    console.log('stripe-webhook raw body read', { byteLength: body.length })

    let event: Stripe.Event

    try {
      event = await stripe.webhooks.constructEventAsync(
        body,
        signature,
        webhookSecret,
        undefined,
        cryptoProvider,
      )
      console.log('stripe-webhook signature verified', {
        event_id: event.id,
        event_type: event.type,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Invalid webhook signature'
      console.error('stripe-webhook signature verification failed', message)
      return errorResponse(message, 400)
    }

    const admin = getSupabaseAdmin()

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        const paymentId = session.metadata?.payment_id

        console.log('stripe-webhook checkout.session.completed', {
          session_id: session.id,
          payment_status: session.payment_status,
          metadata_payment_id: paymentId ?? null,
        })

        if (!paymentId) {
          console.warn(
            'stripe-webhook checkout.session.completed missing payment_id metadata',
            session.id,
          )
          break
        }

        if (session.payment_status !== 'paid') {
          console.warn(
            'stripe-webhook checkout.session.completed ignored: payment_status is not paid',
            session.id,
            session.payment_status,
          )
          break
        }

        const paymentIntentId =
          typeof session.payment_intent === 'string'
            ? session.payment_intent
            : session.payment_intent?.id ?? null

        let chargeId: string | null = null

        if (paymentIntentId) {
          const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId)
          chargeId =
            typeof paymentIntent.latest_charge === 'string'
              ? paymentIntent.latest_charge
              : paymentIntent.latest_charge?.id ?? null
        }

        const { data: capturedPayment, error } = await admin.rpc('mark_payment_captured', {
          p_payment_id: paymentId,
          p_stripe_checkout_session_id: session.id,
          p_stripe_payment_intent_id: paymentIntentId,
          p_stripe_charge_id: chargeId,
        })

        if (error) {
          console.error('stripe-webhook mark_payment_captured failed', {
            payment_id: paymentId,
            session_id: session.id,
            payment_intent_id: paymentIntentId,
            charge_id: chargeId,
            error: error.message,
          })
          return errorResponse(`Failed to capture payment: ${error.message}`, 500)
        }

        console.log('stripe-webhook mark_payment_captured succeeded', {
          payment_id: paymentId,
          session_id: session.id,
          payment_intent_id: paymentIntentId,
          charge_id: chargeId,
          payment_status: capturedPayment?.status ?? null,
        })

        try {
          const { data: paidOrder, error: orderLookupError } = await admin
            .from('orders')
            .select('id')
            .eq('payment_id', paymentId)
            .maybeSingle()

          if (orderLookupError) {
            console.error(
              'stripe-webhook marketplace email order lookup failed',
              paymentId,
              orderLookupError.message,
            )
          } else if (paidOrder?.id) {
            const { sendPaymentCapturedMarketplaceEmails } = await import(
              '../_shared/marketplaceEmail.ts'
            )
            const emailResults = await sendPaymentCapturedMarketplaceEmails(paidOrder.id)
            console.log('stripe-webhook marketplace emails queued', {
              order_id: paidOrder.id,
              payment_successful: emailResults.buyerResult,
              new_order_received: emailResults.sellerResult,
            })
          }
        } catch (emailError) {
          const message =
            emailError instanceof Error ? emailError.message : 'Marketplace email send failed'
          console.error('stripe-webhook marketplace email send failed (non-blocking)', message)
        }

        break
      }

      case 'transfer.created': {
        const transfer = event.data.object as Stripe.Transfer
        const orderId = transfer.metadata?.order_id

        console.log('stripe-webhook transfer.created', {
          transfer_id: transfer.id,
          order_id: orderId ?? null,
        })

        if (!orderId) {
          break
        }

        const { data: order, error: orderError } = await admin
          .from('orders')
          .select('id, payout_status, stripe_transfer_id')
          .eq('id', orderId)
          .single()

        if (orderError || !order) {
          console.warn('stripe-webhook transfer.created order lookup failed', orderId, orderError?.message)
          break
        }

        if (order.payout_status === 'paid' && order.stripe_transfer_id === transfer.id) {
          break
        }

        if (order.payout_status !== 'processing') {
          console.warn(
            'stripe-webhook transfer.created ignored: unexpected payout_status',
            orderId,
            order.payout_status,
          )
          break
        }

        const { error: releasedError } = await admin.rpc('mark_order_payout_released', {
          p_order_id: orderId,
          p_stripe_transfer_id: transfer.id,
        })

        if (releasedError) {
          console.error('stripe-webhook mark_order_payout_released failed', orderId, releasedError.message)
          return errorResponse(`Failed to record payout release: ${releasedError.message}`, 500)
        }

        console.log('stripe-webhook transfer.created reconciled', orderId, transfer.id)
        break
      }

      case 'transfer.reversed': {
        const transfer = event.data.object as Stripe.Transfer
        const orderId = transfer.metadata?.order_id

        console.log('stripe-webhook transfer.reversed', {
          transfer_id: transfer.id,
          order_id: orderId ?? null,
        })

        if (!orderId) {
          break
        }

        const { error: failedError } = await admin.rpc('mark_order_payout_failed', {
          p_order_id: orderId,
        })

        if (failedError) {
          console.error('stripe-webhook mark_order_payout_failed failed', orderId, failedError.message)
        }

        break
      }

      case 'account.updated': {
        const account = event.data.object as Stripe.Account

        console.log('stripe-webhook account.updated', {
          account_id: account.id,
          charges_enabled: account.charges_enabled,
          payouts_enabled: account.payouts_enabled,
          details_submitted: account.details_submitted,
        })

        if (!isConnectAccountReady(account)) {
          console.log('stripe-webhook account.updated ignored: account not ready for payouts')
          break
        }

        try {
          await syncSellerFromStripeAccount(admin, account.id, true)
          console.log('stripe-webhook account.updated sync succeeded', account.id)
        } catch (syncError) {
          const message =
            syncError instanceof Error ? syncError.message : 'Seller sync failed'
          console.error('stripe-webhook account.updated sync failed', account.id, message)
          return errorResponse(message, 500)
        }

        break
      }

      default:
        console.log('stripe-webhook ignored unhandled event type', event.type, event.id)
        break
    }

    return jsonResponse({ received: true, event_type: event.type })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Webhook handler failed'
    console.error('stripe-webhook unhandled error', message, err)
    return errorResponse(message, 500)
  }
})
