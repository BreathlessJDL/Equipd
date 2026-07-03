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
  composeBuyerDeliveryDetailsAddedDynamicData,
  composeBuyerProtectionStartedDynamicData,
  composeCollectionConfirmedDynamicData,
  composeCourierDispatchedDynamicData,
  composeDeliveryConfirmedDynamicData,
  composeMarketplaceEmailSubject,
  composeNewOrderReceivedDynamicData,
  composeOfferAcceptedDynamicData,
  composeCounterOfferAcceptedSellerDynamicData,
  composeOfferReceivedDynamicData,
  composeCounterOfferReceivedDynamicData,
  composePaymentSuccessfulDynamicData,
  getMarketplaceUserName,
  normalizeMarketplaceEmailPayload,
  reserveEmailLog,
} from '../supabase/functions/_shared/marketplaceEmailCore.js'
import { buildSendGridPayload } from '../supabase/functions/_shared/transactionalEmailCore.js'
import { getTemplateEnvVarName } from '../supabase/functions/_shared/emailTemplateConfig.js'
import {
  buildFulfilmentTestDynamicData,
  FULFILMENT_EMAIL_TEMPLATE_KEYS,
} from './fulfilmentEmailTestData.mjs'
import {
  buildRemainingTestDynamicData,
  REMAINING_EMAIL_TEMPLATE_KEYS,
} from './remainingEmailTestData.mjs'

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

const buyerProfileWithUsername = {
  username: 'jamesgym',
  display_name: 'James Carter',
  email: 'jlinnell95@gmail.com',
}

const sellerProfileWithUsername = {
  username: 'sarahlifts',
  display_name: 'Sarah Mitchell',
  email: 'info.jdlclothing@example.com',
}

assert(
  getMarketplaceUserName(buyerProfileWithUsername) === 'jamesgym',
  'getMarketplaceUserName prefers username over display name and email',
)
assert(
  getMarketplaceUserName(sellerProfileWithUsername) === 'sarahlifts',
  'getMarketplaceUserName uses seller username',
)
assert(
  getMarketplaceUserName({ display_name: 'James Carter' }, { email: 'jlinnell95@gmail.com' }) ===
    'James Carter',
  'getMarketplaceUserName falls back to display name before email',
)
assert(
  getMarketplaceUserName({}, { email: 'jlinnell95@gmail.com' }) === 'jlinnell95',
  'getMarketplaceUserName falls back to email local-part last',
)

assert(
  buildMarketplaceEmailIdempotencyKey('offer_received', {
    offerId: 'off-1',
    sellerId: 'seller-1',
  }) === 'offer_received:off-1:seller-1',
  'offer_received idempotency key',
)
assert(
  buildMarketplaceEmailIdempotencyKey('counter_offer_received', {
    offerId: 'counter-1',
    recipientUserId: 'buyer-1',
  }) === 'counter_offer_received:counter-1:buyer-1',
  'counter_offer_received idempotency key',
)
assert(
  getTemplateEnvVarName('counter_offer_received') === 'SENDGRID_TEMPLATE_COUNTER_OFFER_RECEIVED',
  'counter_offer_received maps to SENDGRID_TEMPLATE_COUNTER_OFFER_RECEIVED',
)

function isActiveCounterOffer(offer) {
  return offer?.status === 'pending' && offer?.parent_offer_id != null
}

function getOfferDisplayStatus(offer) {
  if (isActiveCounterOffer(offer)) {
    return { label: 'Counter offer', variant: 'counter' }
  }
  return { label: offer?.status ?? 'pending', variant: offer?.status ?? 'pending' }
}

assert(
  isActiveCounterOffer({
    status: 'pending',
    parent_offer_id: 'parent-1',
    direction: 'seller_to_buyer',
  }),
  'isActiveCounterOffer true for pending counter chain offer',
)
assert(
  !isActiveCounterOffer({
    status: 'pending',
    direction: 'buyer_to_seller',
  }),
  'isActiveCounterOffer false for initial buyer offer',
)
assert(
  getOfferDisplayStatus({
    status: 'pending',
    parent_offer_id: 'parent-1',
    direction: 'seller_to_buyer',
  }).label === 'Counter offer',
  'getOfferDisplayStatus labels counter offers',
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
  buyerProfile: buyerProfileWithUsername,
  sellerProfile: sellerProfileWithUsername,
})

assert(
  buyerPaymentData.recipient_first_name === 'jamesgym',
  'payment_successful recipient_first_name uses username',
)
assert(
  buyerPaymentData.seller_name === 'sarahlifts',
  'payment_successful seller_name uses username',
)
assert(
  !buyerPaymentData.body.includes('jlinnell95'),
  'payment_successful body does not use email local-part for buyer',
)
assert(
  !buyerPaymentData.body.includes('info.jdlclothing'),
  'payment_successful body does not use seller email local-part',
)

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
  buyerProfile: buyerProfileWithUsername,
  sellerProfile: sellerProfileWithUsername,
})

assert(
  sellerOrderData.recipient_first_name === 'sarahlifts',
  'new_order_received recipient_first_name uses username',
)
assert(
  sellerOrderData.buyer_name === 'jamesgym',
  'new_order_received buyer_name uses username',
)
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
  buyerProfile: buyerProfileWithUsername,
  sellerProfile: sellerProfileWithUsername,
})

assert(offerReceivedData.cta_url.includes('/hub?section=selling&tab=offers'), 'offer_received CTA URL')
assert(
  offerReceivedData.recipient_first_name === 'sarahlifts',
  'offer_received recipient_first_name uses seller username',
)
assert(
  offerReceivedData.buyer_name === 'jamesgym',
  'offer_received buyer_name uses buyer username',
)
assert(
  !offerReceivedData.body.includes('jlinnell95'),
  'offer_received body does not use email local-part',
)
assert(
  !offerReceivedData.body.includes('info.jdlclothing'),
  'offer_received body does not use seller email local-part',
)

const offerAcceptedData = composeOfferAcceptedDynamicData({
  baseUrl,
  offer: { id: 'off-2', amount_pence: 42500 },
  listing: { title: 'Rogue Ohio Bar', price_pence: 49500 },
  buyerProfile: buyerProfileWithUsername,
  sellerProfile: sellerProfileWithUsername,
})

assert(
  offerAcceptedData.recipient_first_name === 'jamesgym',
  'offer_accepted recipient_first_name uses buyer username',
)
assert(
  offerAcceptedData.seller_name === 'sarahlifts',
  'offer_accepted seller_name uses seller username',
)
assert(
  offerAcceptedData.title === 'Your offer was accepted',
  'offer_accepted buyer title is context-aware',
)
assert(
  offerAcceptedData.body.includes('The seller accepted your offer on'),
  'offer_accepted buyer body names seller acceptance',
)
assert(
  offerAcceptedData.body.includes('Buyer Protection fee'),
  'offer_accepted buyer body includes Buyer Protection fee',
)
assert(
  !offerAcceptedData.body.includes("You'll receive"),
  'offer_accepted buyer body excludes seller payout copy',
)
assert(
  !offerAcceptedData.seller_service_fee,
  'offer_accepted buyer dynamic data excludes seller_service_fee',
)

const counterAcceptedSellerData = composeCounterOfferAcceptedSellerDynamicData({
  baseUrl,
  offer: { id: 'counter-accepted-1', amount_pence: 17500, direction: 'seller_to_buyer' },
  listing: { title: 'Rogue Ohio Bar', price_pence: 49500 },
  buyerProfile: buyerProfileWithUsername,
  sellerProfile: sellerProfileWithUsername,
})

assert(
  counterAcceptedSellerData.recipient_first_name === 'sarahlifts',
  'counter accepted seller email uses seller username',
)
assert(
  counterAcceptedSellerData.title === 'Your counter offer was accepted',
  'counter accepted seller title is context-aware',
)
assert(
  counterAcceptedSellerData.body.includes('The buyer accepted your counter offer on'),
  'counter accepted seller body names buyer acceptance',
)
assert(
  counterAcceptedSellerData.body.includes('Seller Service Fee'),
  'counter accepted seller body includes Seller Service Fee',
)
assert(
  counterAcceptedSellerData.body.includes("You'll receive"),
  'counter accepted seller body includes net payout',
)
assert(
  !counterAcceptedSellerData.body.includes('Buyer Protection'),
  'counter accepted seller body excludes buyer protection copy',
)
assert(
  counterAcceptedSellerData.cta_url.includes('/hub?section=selling&tab=offers&offerId=counter-accepted-1'),
  'counter accepted seller CTA URL',
)
assert(
  buildMarketplaceEmailIdempotencyKey('offer_accepted', {
    offerId: 'off-2',
    recipientUserId: 'buyer-1',
  }) === 'offer_accepted:off-2:buyer-1',
  'offer_accepted idempotency key uses recipientUserId',
)
assert(
  buildMarketplaceEmailIdempotencyKey('offer_accepted', {
    offerId: 'counter-accepted-1',
    recipientUserId: 'seller-1',
  }) === 'offer_accepted:counter-accepted-1:seller-1',
  'offer_accepted seller idempotency key uses recipientUserId',
)

const sellerCounterData = composeCounterOfferReceivedDynamicData({
  baseUrl,
  offer: { id: 'counter-1', amount_pence: 17500, direction: 'seller_to_buyer' },
  listing: { title: 'Rogue Ohio Bar', price_pence: 49500 },
  buyerProfile: buyerProfileWithUsername,
  sellerProfile: sellerProfileWithUsername,
})

assert(
  sellerCounterData.recipient_first_name === 'jamesgym',
  'counter_offer_received seller counter notifies buyer username',
)
assert(
  sellerCounterData.sender_name === 'sarahlifts',
  'counter_offer_received seller counter sender_name uses seller username',
)
assert(
  sellerCounterData.cta_url.includes('/hub?section=offers&offerId=counter-1'),
  'counter_offer_received buyer CTA URL',
)
assert(
  sellerCounterData.subject === 'New counter offer on Rogue Ohio Bar',
  'counter_offer_received subject includes listing title',
)

const buyerCounterData = composeCounterOfferReceivedDynamicData({
  baseUrl,
  offer: { id: 'counter-2', amount_pence: 16000, direction: 'buyer_to_seller' },
  listing: { title: 'Rogue Ohio Bar', price_pence: 49500 },
  buyerProfile: buyerProfileWithUsername,
  sellerProfile: sellerProfileWithUsername,
})

assert(
  buyerCounterData.recipient_first_name === 'sarahlifts',
  'counter_offer_received buyer counter notifies seller username',
)
assert(
  buyerCounterData.cta_url.includes('/hub?section=selling&tab=offers&offerId=counter-2'),
  'counter_offer_received seller CTA URL',
)

assert(
  offerReceivedData.subject === 'You have a new offer on Rogue Ohio Bar',
  'offer_received subject includes listing title',
)
assert(
  offerAcceptedData.subject === 'Your offer on Rogue Ohio Bar was accepted',
  'offer_accepted subject includes listing title',
)
assert(
  counterAcceptedSellerData.subject === 'Your counter offer on Rogue Ohio Bar was accepted',
  'counter accepted seller subject includes listing title',
)
assert(
  composeMarketplaceEmailSubject('offer_accepted', 'Rogue Ohio Bar', { recipientRole: 'buyer' }) ===
    'Your offer on Rogue Ohio Bar was accepted',
  'composeMarketplaceEmailSubject offer_accepted buyer',
)
assert(
  composeMarketplaceEmailSubject('offer_accepted', 'Rogue Ohio Bar', { recipientRole: 'seller' }) ===
    'Your counter offer on Rogue Ohio Bar was accepted',
  'composeMarketplaceEmailSubject offer_accepted seller',
)
assert(
  buyerPaymentData.subject === 'Payment confirmed for Test listing',
  'payment_successful subject includes listing title',
)
assert(
  sellerOrderData.subject === "You've sold Test listing",
  'new_order_received subject includes listing title',
)
assert(
  composeMarketplaceEmailSubject('offer_received', 'Rogue Ohio Bar') ===
    'You have a new offer on Rogue Ohio Bar',
  'composeMarketplaceEmailSubject offer_received',
)
assert(
  composeMarketplaceEmailSubject('new_order_received', 'Bench Press') === "You've sold Bench Press",
  'composeMarketplaceEmailSubject new_order_received',
)

const sendGridPayload = buildSendGridPayload({
  recipients: ['buyer@example.com'],
  templateId: 'd-test',
  dynamicTemplateData: buyerPaymentData,
  from: { email: 'notifications@equipd.co.uk', name: 'Equipd' },
})
assert(
  sendGridPayload.subject === buyerPaymentData.subject,
  'buildSendGridPayload sets top-level subject from dynamic data',
)
assert(
  sendGridPayload.personalizations[0].subject === buyerPaymentData.subject,
  'buildSendGridPayload sets personalization subject from dynamic data',
)
assert(
  sendGridPayload.personalizations[0].dynamic_template_data.subject === buyerPaymentData.subject,
  'buildSendGridPayload keeps subject in dynamic_template_data',
)

const counterOfferSendGridPayload = buildSendGridPayload({
  recipients: ['buyer@example.com'],
  templateId: 'd-test',
  dynamicTemplateData: sellerCounterData,
  from: { email: 'notifications@equipd.co.uk', name: 'Equipd' },
})
assert(
  counterOfferSendGridPayload.subject === 'New counter offer on Rogue Ohio Bar',
  'counter_offer_received buildSendGridPayload top-level subject',
)
assert(
  counterOfferSendGridPayload.personalizations[0].subject === 'New counter offer on Rogue Ohio Bar',
  'counter_offer_received buildSendGridPayload personalization subject',
)
assert(
  counterOfferSendGridPayload.personalizations[0].dynamic_template_data.subject ===
    'New counter offer on Rogue Ohio Bar',
  'counter_offer_received buildSendGridPayload dynamic_template_data subject',
)

assert(
  normalizeMarketplaceEmailPayload({ offerId: 'offer-uuid-1' }).offerId === 'offer-uuid-1',
  'offer_received works with offerId',
)
assert(
  normalizeMarketplaceEmailPayload({ offer_id: 'offer-uuid-1' }).offerId === 'offer-uuid-1',
  'offer_received works with offer_id',
)
assert(
  normalizeMarketplaceEmailPayload({ offerId: 'offer-uuid-2' }).offerId === 'offer-uuid-2',
  'offer_accepted works with offerId',
)
assert(
  normalizeMarketplaceEmailPayload({ offer_id: 'offer-uuid-2' }).offerId === 'offer-uuid-2',
  'offer_accepted works with offer_id',
)
assert(
  normalizeMarketplaceEmailPayload({ orderId: 'ord-1' }).orderId === 'ord-1',
  'order email works with orderId',
)
assert(
  normalizeMarketplaceEmailPayload({ order_id: 'ord-1' }).orderId === 'ord-1',
  'order email works with order_id',
)
assert(
  normalizeMarketplaceEmailPayload({ paymentId: 'pay-1' }).paymentId === 'pay-1',
  'order email works with paymentId',
)
assert(
  normalizeMarketplaceEmailPayload({ payment_id: 'pay-1' }).paymentId === 'pay-1',
  'order email works with payment_id',
)
assert(
  normalizeMarketplaceEmailPayload({ listingId: 'list-1' }).listingId === 'list-1',
  'payload works with listingId',
)
assert(
  normalizeMarketplaceEmailPayload({ listing_id: 'list-1' }).listingId === 'list-1',
  'payload works with listing_id',
)

const fulfilmentOrderId = '33333333-3333-3333-3333-333333333333'
const fulfilmentOrderBase = {
  id: fulfilmentOrderId,
  order_type: 'collection',
  dispute_window_hours: 24,
  payout_release_at: '2026-06-29T13:30:00.000Z',
  collection_confirmed_at: '2026-06-28T13:30:00.000Z',
  courier_evidence_submitted_at: '2026-06-28T12:00:00.000Z',
  courier_delivered_at: '2026-06-28T14:00:00.000Z',
  courier_name: 'Dave',
  courier_company: 'APC Overnight',
  courier_buyer_tracking_reference: 'APC123',
}

const deliveryDetailsData = composeBuyerDeliveryDetailsAddedDynamicData({
  baseUrl,
  order: { ...fulfilmentOrderBase, order_type: 'seller_delivery' },
  listing: { title: 'Rogue Ohio Bar' },
  buyerProfile: buyerProfileWithUsername,
  sellerProfile: sellerProfileWithUsername,
  deliveryDetails: { delivery_contact_name: 'James Carter' },
})

assert(
  deliveryDetailsData.recipient_first_name === 'sarahlifts',
  'buyer_delivery_details_added uses seller username',
)
assert(
  deliveryDetailsData.buyer_name === 'jamesgym',
  'buyer_delivery_details_added uses buyer username',
)
assert(
  deliveryDetailsData.cta_url === `${baseUrl}/orders/${fulfilmentOrderId}`,
  'buyer_delivery_details_added CTA URL',
)
assert(
  buildMarketplaceEmailIdempotencyKey('buyer_delivery_details_added', {
    orderId: fulfilmentOrderId,
    sellerId: 'seller-1',
  }) === `buyer_delivery_details_added:${fulfilmentOrderId}:seller-1`,
  'buyer_delivery_details_added idempotency key',
)

const collectionSellerData = composeCollectionConfirmedDynamicData({
  baseUrl,
  order: fulfilmentOrderBase,
  listing: { title: 'Rogue Ohio Bar' },
  buyerProfile: buyerProfileWithUsername,
  sellerProfile: sellerProfileWithUsername,
  recipientRole: 'seller',
})

const collectionBuyerData = composeCollectionConfirmedDynamicData({
  baseUrl,
  order: fulfilmentOrderBase,
  listing: { title: 'Rogue Ohio Bar' },
  buyerProfile: buyerProfileWithUsername,
  sellerProfile: sellerProfileWithUsername,
  recipientRole: 'buyer',
})

assert(
  collectionSellerData.counterparty_name === 'jamesgym',
  'collection_confirmed seller email uses buyer username',
)
assert(
  collectionBuyerData.body.includes('You confirmed collection'),
  'collection_confirmed buyer email confirms collection',
)
assert(
  !collectionBuyerData.body.toLowerCase().includes('payout'),
  'collection_confirmed buyer email avoids payout copy',
)
assert(
  buildMarketplaceEmailIdempotencyKey('collection_confirmed', {
    orderId: fulfilmentOrderId,
    recipientUserId: 'buyer-1',
  }) === `collection_confirmed:${fulfilmentOrderId}:buyer-1`,
  'collection_confirmed idempotency key',
)

const courierDispatchedData = composeCourierDispatchedDynamicData({
  baseUrl,
  order: { ...fulfilmentOrderBase, order_type: 'buyer_courier' },
  listing: { title: 'Rogue Ohio Bar' },
  buyerProfile: buyerProfileWithUsername,
  sellerProfile: sellerProfileWithUsername,
})

assert(
  courierDispatchedData.recipient_first_name === 'jamesgym',
  'courier_dispatched uses buyer username',
)
assert(
  courierDispatchedData.seller_name === 'sarahlifts',
  'courier_dispatched uses seller username',
)
assert(
  !Object.prototype.hasOwnProperty.call(courierDispatchedData, 'seller_service_fee'),
  'courier_dispatched excludes seller_service_fee',
)
assert(
  composeMarketplaceEmailSubject('courier_dispatched', 'Rogue Ohio Bar') ===
    'Rogue Ohio Bar is on its way',
  'courier_dispatched subject',
)

const deliverySellerData = composeDeliveryConfirmedDynamicData({
  baseUrl,
  order: { ...fulfilmentOrderBase, order_type: 'buyer_courier' },
  listing: { title: 'Rogue Ohio Bar' },
  buyerProfile: buyerProfileWithUsername,
  sellerProfile: sellerProfileWithUsername,
  recipientRole: 'seller',
})

assert(
  deliverySellerData.buyer_tracking_reference === 'APC123',
  'delivery_confirmed seller email includes tracking reference',
)

const protectionData = composeBuyerProtectionStartedDynamicData({
  baseUrl,
  order: fulfilmentOrderBase,
  listing: { title: 'Rogue Ohio Bar' },
  buyerProfile: buyerProfileWithUsername,
})

assert(
  protectionData.protection_hours === '24',
  'buyer_protection_started includes protection hours',
)
assert(
  protectionData.protection_ends_at.includes('2026'),
  'buyer_protection_started formats protection end time',
)
assert(
  !protectionData.body.toLowerCase().includes('seller service fee'),
  'buyer_protection_started avoids seller fee copy',
)
assert(
  buildMarketplaceEmailIdempotencyKey('buyer_protection_started', {
    orderId: fulfilmentOrderId,
    buyerId: 'buyer-1',
  }) === `buyer_protection_started:${fulfilmentOrderId}:buyer-1`,
  'buyer_protection_started idempotency key',
)

assert(
  normalizeMarketplaceEmailPayload({ recipientRole: 'buyer' }).recipientRole === 'buyer',
  'payload works with recipientRole',
)
assert(
  normalizeMarketplaceEmailPayload({ recipient_role: 'seller' }).recipientRole === 'seller',
  'payload works with recipient_role',
)

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
      update(patch) {
        return {
          eq(_column, logId) {
            const entry = [...logs.values()].find((item) => item.id === logId)
            if (entry) {
              Object.assign(entry, patch)
            }
            return Promise.resolve({ error: null })
          },
        }
      },
    }
  },
}

for (const templateKey of FULFILMENT_EMAIL_TEMPLATE_KEYS) {
  const testData = buildFulfilmentTestDynamicData(templateKey, () => baseUrl)
  assert(testData?.subject?.trim(), `fulfilment test data subject populated for ${templateKey}`)
  assert(testData?.cta_url?.includes(fulfilmentOrderId), `fulfilment test data CTA for ${templateKey}`)
}

for (const templateKey of REMAINING_EMAIL_TEMPLATE_KEYS) {
  const testData = buildRemainingTestDynamicData(templateKey, () => baseUrl, { recipientRole: 'buyer' })
  assert(testData?.subject?.trim(), `remaining test data subject populated for ${templateKey}`)
  if (testData?.order_id && testData.cta_url?.includes(testData.order_id)) {
    assert(true, `remaining test data CTA for ${templateKey}`)
  } else if (!testData?.order_id || templateKey === 'seller_onboarding_required') {
    assert(Boolean(testData?.cta_url), `remaining test data CTA for ${templateKey}`)
  } else {
    assert(false, `remaining test data CTA for ${templateKey}`)
  }
}

const payoutData = buildRemainingTestDynamicData('payout_released', () => baseUrl)
assert(payoutData.seller_service_fee === '£8.50', 'payout_released includes seller service fee')
assert(payoutData.seller_net_payout === '£416.50', 'payout_released includes net payout')

const reviewBuyerData = buildRemainingTestDynamicData('review_available', () => baseUrl)
assert(!/seller service fee|you'll receive/i.test(reviewBuyerData.body), 'review_available avoids seller payout copy')

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

  logs.set('counter_offer_received:counter-failed:buyer-1', {
    id: 'log-failed',
    idempotency_key: 'counter_offer_received:counter-failed:buyer-1',
    status: 'failed',
    template_key: 'counter_offer_received',
  })

  const retry = await reserveEmailLog(mockAdmin, {
    template_key: 'counter_offer_received',
    idempotency_key: 'counter_offer_received:counter-failed:buyer-1',
    status: 'pending',
  })
  assert(retry.action === 'send', 'failed email log reservation retries send')
  assert(retry.retry === true, 'failed email log reservation marks retry')
}

await runAsyncTests()

console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed > 0 ? 1 : 0)
