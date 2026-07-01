#!/usr/bin/env node
/**
 * Unit tests for marketplace transactional email composition and idempotency helpers.
 *
 * Usage:
 *   node scripts/test-marketplace-email.mjs
 */

import {
  assertBuyerEmailSafe,
  buildMarketplaceEmailIdempotencyKey,
  composeNewOrderReceivedDynamicData,
  composeOfferReceivedDynamicData,
  composePaymentSuccessfulDynamicData,
  reserveEmailLog,
} from '../supabase/functions/_shared/marketplaceEmailCore.js'

let passed = 0
let failed = 0

function assert(condition, message) {
  if (!condition) {
    failed += 1
    console.error(`FAIL: ${message}`)
    return
  }
  passed += 1
  console.log(`ok: ${message}`)
}

const baseUrl = 'https://equipd.co.uk'

assert(
  buildMarketplaceEmailIdempotencyKey('offer_received', {
    offerId: 'off-1',
    sellerId: 'seller-1',
  }) === 'offer_received:off-1:seller-1',
  'offer_received idempotency key',
)

assert(
  buildMarketplaceEmailIdempotencyKey('payment_successful', {
    orderId: 'ord-1',
    buyerId: 'buyer-1',
  }) === 'payment_successful:ord-1:buyer-1',
  'payment_successful idempotency key',
)

const buyerPaymentData = composePaymentSuccessfulDynamicData({
  baseUrl,
  order: {
    id: '11111111-1111-1111-1111-111111111111',
    buyer_total_pence: 43725,
    amount_pence: 42500,
    item_price_pence: 42500,
  },
  listing: { title: 'Test listing' },
  buyerProfile: { display_name: 'James Carter' },
  sellerProfile: { display_name: 'Sarah Mitchell' },
})

assert(
  !Object.prototype.hasOwnProperty.call(buyerPaymentData, 'seller_service_fee'),
  'buyer payment email excludes seller_service_fee field',
)
assert(
  !Object.prototype.hasOwnProperty.call(buyerPaymentData, 'seller_net_payout'),
  'buyer payment email excludes seller_net_payout field',
)
assert(
  !/seller service fee|you'll receive|payout/i.test(buyerPaymentData.body),
  'buyer payment email body excludes seller fee/payout copy',
)

try {
  assertBuyerEmailSafe({
    ...buyerPaymentData,
    seller_service_fee: '£8.50',
  })
  assert(false, 'assertBuyerEmailSafe should throw for seller_service_fee')
} catch {
  assert(true, 'assertBuyerEmailSafe rejects seller_service_fee')
}

const sellerOrderData = composeNewOrderReceivedDynamicData({
  baseUrl,
  order: {
    id: '22222222-2222-2222-2222-222222222222',
    amount_pence: 42500,
    item_price_pence: 42500,
    seller_service_fee_pence: 850,
    seller_net_pence: 41650,
  },
  listing: { title: 'Test listing' },
  buyerProfile: { display_name: 'James Carter' },
  sellerProfile: { display_name: 'Sarah Mitchell' },
})

assert(
  sellerOrderData.seller_service_fee === '£8.50',
  'seller order email includes seller_service_fee',
)
assert(
  sellerOrderData.seller_net_payout === '£416.50',
  'seller order email includes seller_net_payout',
)
assert(
  /Seller Service Fee/.test(sellerOrderData.body),
  'seller order email body mentions Seller Service Fee',
)

const offerReceivedData = composeOfferReceivedDynamicData({
  baseUrl,
  offer: { id: 'off-1', amount_pence: 42500 },
  listing: { title: 'Rogue Ohio Bar', price_pence: 49500 },
  buyerProfile: { display_name: 'James Carter' },
  sellerProfile: { display_name: 'Sarah Mitchell' },
})

assert(offerReceivedData.cta_url.includes('/hub?section=selling&tab=offers'), 'offer_received CTA URL')

const logs = new Map()

const mockAdmin = {
  from(table) {
    if (table !== 'transactional_email_log') {
      throw new Error(`Unexpected table ${table}`)
    }

    return {
      insert(row) {
        return {
          select() {
            return {
              async maybeSingle() {
                if (logs.has(row.idempotency_key)) {
                  return {
                    data: null,
                    error: { code: '23505', message: 'duplicate key value' },
                  }
                }
                const id = `log-${logs.size + 1}`
                logs.set(row.idempotency_key, { id, ...row, status: row.status ?? 'pending' })
                return { data: { id, status: 'pending' }, error: null }
              },
            }
          },
        }
      },
      select() {
        return {
          eq(_column, idempotencyKey) {
            return {
              async maybeSingle() {
                const existing = [...logs.values()].find((entry) => entry.idempotency_key === idempotencyKey)
                return {
                  data: existing
                    ? {
                        id: existing.id,
                        status: existing.status,
                        provider_message_id: existing.provider_message_id ?? null,
                      }
                    : null,
                  error: null,
                }
              },
            }
          },
        }
      },
      update() {
        return {
          eq() {
            return Promise.resolve({ error: null })
          },
        }
      },
    }
  },
}

async function runAsyncTests() {
  const first = await reserveEmailLog(mockAdmin, {
    template_key: 'offer_received',
    idempotency_key: 'offer_received:off-1:seller-1',
    status: 'pending',
  })
  assert(first.action === 'send', 'first email log reservation sends')

  const second = await reserveEmailLog(mockAdmin, {
    template_key: 'offer_received',
    idempotency_key: 'offer_received:off-1:seller-1',
    status: 'pending',
  })
  assert(second.action === 'skip', 'duplicate offer_received idempotency key skips second send')
}

await runAsyncTests()

console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed > 0 ? 1 : 0)
