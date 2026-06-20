import Stripe from 'npm:stripe@17.7.0'

let stripeClient: Stripe | null = null

export function getStripe(): Stripe {
  const secretKey = Deno.env.get('STRIPE_SECRET_KEY')

  if (!secretKey) {
    throw new Error('STRIPE_SECRET_KEY is not configured')
  }

  if (!stripeClient) {
    stripeClient = new Stripe(secretKey, {
      httpClient: Stripe.createFetchHttpClient(),
    })
  }

  return stripeClient
}

export function getAppBaseUrl(): string {
  const baseUrl = Deno.env.get('APP_BASE_URL')?.replace(/\/+$/, '')

  if (!baseUrl) {
    throw new Error('APP_BASE_URL is not configured')
  }

  return baseUrl
}

export function isConnectAccountReady(account: Stripe.Account): boolean {
  return Boolean(
    account.charges_enabled &&
      account.payouts_enabled &&
      account.details_submitted,
  )
}

export function checkoutSessionExpiresAt(paymentExpiresAt: string): number {
  const paymentExpiresMs = new Date(paymentExpiresAt).getTime()
  const maxSessionMs = Date.now() + 24 * 60 * 60 * 1000 - 60 * 1000
  const minSessionMs = Date.now() + 30 * 60 * 1000

  return Math.floor(Math.max(minSessionMs, Math.min(paymentExpiresMs, maxSessionMs)) / 1000)
}
