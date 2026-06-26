import { handleCors, errorResponse, jsonResponse } from '../_shared/cors.ts'
import { releaseDueOrderPayouts } from '../_shared/release-order-payout.ts'
import { getStripe } from '../_shared/stripe.ts'
import { getSupabaseAdmin } from '../_shared/supabase-admin.ts'

function isAuthorizedCronRequest(req: Request): boolean {
  const cronSecret = Deno.env.get('CRON_SECRET')?.trim()

  if (!cronSecret) {
    return false
  }

  const authHeader = req.headers.get('Authorization')?.trim() ?? ''
  return authHeader === `Bearer ${cronSecret}`
}

Deno.serve(async (req) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  if (req.method !== 'POST') {
    return errorResponse('Method not allowed', 405)
  }

  if (!isAuthorizedCronRequest(req)) {
    return errorResponse('Unauthorized', 401)
  }

  try {
    const admin = getSupabaseAdmin()
    const stripe = getStripe()
    const result = await releaseDueOrderPayouts(admin, stripe)

    return jsonResponse(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Due payout release failed'
    console.error('stripe-release-due-payouts failed', message, err)
    return errorResponse(message, 500)
  }
})
