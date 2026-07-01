import { handleCors, errorResponse, jsonResponse } from '../_shared/cors.ts'
import { sendMarketplaceEmail } from '../_shared/marketplaceEmail.ts'
import {
  MARKETPLACE_EMAIL_EVENT_KEYS,
  normalizeMarketplaceEmailPayload,
} from '../_shared/marketplaceEmailCore.js'

const FULFILMENT_EMAIL_EVENT_KEYS = new Set([
  'buyer_delivery_details_added',
  'collection_confirmed',
  'courier_dispatched',
  'delivery_confirmed',
  'buyer_protection_started',
])

const DUAL_RECIPIENT_EVENT_KEYS = new Set(['collection_confirmed', 'delivery_confirmed'])

type MarketplaceEmailRequest = {
  eventKey: string
  payload?: Record<string, unknown>
}

function isMarketplaceEmailRequest(value: unknown): value is MarketplaceEmailRequest {
  if (!value || typeof value !== 'object') return false

  const body = value as MarketplaceEmailRequest
  return (
    typeof body.eventKey === 'string' &&
    MARKETPLACE_EMAIL_EVENT_KEYS.includes(body.eventKey) &&
    (body.payload === undefined ||
      (body.payload !== null && typeof body.payload === 'object' && !Array.isArray(body.payload)))
  )
}

Deno.serve(async (req) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  if (req.method !== 'POST') {
    return errorResponse('Method not allowed', 405)
  }

  const webhookSecret = Deno.env.get('MARKETPLACE_EMAIL_WEBHOOK_SECRET')

  if (!webhookSecret) {
    console.error('send-marketplace-email: MARKETPLACE_EMAIL_WEBHOOK_SECRET is not configured')
    return errorResponse('MARKETPLACE_EMAIL_WEBHOOK_SECRET is not configured', 500)
  }

  const providedSecret = req.headers.get('x-marketplace-email-secret')

  if (!providedSecret || providedSecret !== webhookSecret) {
    return errorResponse('Unauthorized', 401)
  }

  try {
    const body = await req.json()

    if (!isMarketplaceEmailRequest(body)) {
      return errorResponse('Invalid marketplace email payload', 400)
    }

    const payload = normalizeMarketplaceEmailPayload(body.payload ?? {})

    if (
      (body.eventKey === 'offer_received' || body.eventKey === 'offer_accepted') &&
      !payload.offerId
    ) {
      return errorResponse('offerId is required for offer emails', 400)
    }

    if (
      (body.eventKey === 'payment_successful' || body.eventKey === 'new_order_received') &&
      !payload.orderId &&
      !payload.paymentId
    ) {
      return errorResponse('orderId or paymentId is required for order emails', 400)
    }

    if (FULFILMENT_EMAIL_EVENT_KEYS.has(body.eventKey) && !payload.orderId) {
      return errorResponse('orderId is required for fulfilment emails', 400)
    }

    if (DUAL_RECIPIENT_EVENT_KEYS.has(body.eventKey)) {
      if (payload.recipientRole !== 'buyer' && payload.recipientRole !== 'seller') {
        return errorResponse('recipientRole must be buyer or seller', 400)
      }
    }

    const result = await sendMarketplaceEmail(body.eventKey, payload)

    if (!result.ok) {
      console.error('send-marketplace-email failed', body.eventKey, result.error)
      return jsonResponse({ ok: false, error: result.error, skipped: result.skipped ?? false }, 200)
    }

    return jsonResponse({
      ok: true,
      skipped: result.skipped ?? false,
      dryRun: result.dryRun ?? false,
      idempotencyKey: result.idempotencyKey ?? null,
      messageId: result.messageId ?? null,
    })
  } catch (error) {
    console.error('send-marketplace-email unhandled error', error)
    return errorResponse(
      error instanceof Error ? error.message : 'Failed to send marketplace email',
      500,
    )
  }
})
