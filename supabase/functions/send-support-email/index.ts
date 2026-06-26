import { handleCors, errorResponse, jsonResponse } from '../_shared/cors.ts'
import { sendSupportEmail, type SupportEmailPayload } from '../_shared/supportEmail.ts'

function isSupportEmailPayload(value: unknown): value is SupportEmailPayload {
  if (!value || typeof value !== 'object') return false

  const payload = value as SupportEmailPayload
  const eventType = payload.eventType

  return (
    (eventType === 'support_request' ||
      eventType === 'buyer_protection_dispute' ||
      eventType === 'trust_safety_report' ||
      eventType === 'general_support') &&
    payload.metadata !== null &&
    typeof payload.metadata === 'object' &&
    !Array.isArray(payload.metadata)
  )
}

Deno.serve(async (req) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  if (req.method !== 'POST') {
    return errorResponse('Method not allowed', 405)
  }

  const webhookSecret = Deno.env.get('SUPPORT_EMAIL_WEBHOOK_SECRET')

  if (!webhookSecret) {
    console.error('send-support-email: SUPPORT_EMAIL_WEBHOOK_SECRET is not configured')
    return errorResponse('SUPPORT_EMAIL_WEBHOOK_SECRET is not configured', 500)
  }

  const providedSecret = req.headers.get('x-support-email-secret')

  if (!providedSecret || providedSecret !== webhookSecret) {
    return errorResponse('Unauthorized', 401)
  }

  try {
    const payload = await req.json()

    if (!isSupportEmailPayload(payload)) {
      return errorResponse('Invalid support email payload', 400)
    }

    await sendSupportEmail(payload)

    return jsonResponse({ ok: true })
  } catch (error) {
    console.error('send-support-email failed', error)
    return errorResponse(error instanceof Error ? error.message : 'Failed to send support email', 500)
  }
})
