import { getSupabaseAdmin } from './supabase-admin.ts'
import { sendMarketplaceEmail as sendMarketplaceEmailCore } from './marketplaceEmailCore.js'
import { sendTransactionalEmail } from './transactionalEmail.ts'

function getEnv(key: string): string {
  return Deno.env.get(key) ?? ''
}

function log(message: string, detail?: string) {
  if (detail) {
    console.error(message, detail)
    return
  }
  console.error(message)
}

export type MarketplaceEmailPayload = {
  offerId?: string
  orderId?: string
}

export async function sendMarketplaceEmail(
  eventKey: string,
  payload: MarketplaceEmailPayload,
) {
  const admin = getSupabaseAdmin()

  return sendMarketplaceEmailCore(eventKey, payload, {
    getEnv,
    admin,
    log,
    sendTransactionalEmailFn: sendTransactionalEmail,
  })
}

export async function sendPaymentCapturedMarketplaceEmails(orderId: string) {
  const buyerResult = await sendMarketplaceEmail('payment_successful', { orderId })
  const sellerResult = await sendMarketplaceEmail('new_order_received', { orderId })

  return { buyerResult, sellerResult }
}
