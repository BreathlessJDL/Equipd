import { resolveAppBaseUrl } from '../supabase/functions/_shared/transactionalEmailCore.js'
import {
  composeBuyerDeliveryDetailsAddedDynamicData,
  composeBuyerProtectionStartedDynamicData,
  composeCollectionConfirmedDynamicData,
  composeCourierDispatchedDynamicData,
  composeDeliveryConfirmedDynamicData,
} from '../supabase/functions/_shared/marketplaceEmailCore.js'

/** Fulfilment templates that can be exercised without marketplace DB writes. */
export const FULFILMENT_EMAIL_TEMPLATE_KEYS = [
  'buyer_delivery_details_added',
  'collection_confirmed',
  'courier_dispatched',
  'delivery_confirmed',
  'buyer_protection_started',
]

export function isFulfilmentEmailTemplateKey(templateKey) {
  return FULFILMENT_EMAIL_TEMPLATE_KEYS.includes(templateKey)
}

/** Stable mock profiles — usernames match production compose behaviour in tests. */
export const FULFILMENT_TEST_BUYER_PROFILE = {
  username: 'jamesgym',
  display_name: 'James Carter',
  email: 'buyer.test@example.com',
}

export const FULFILMENT_TEST_SELLER_PROFILE = {
  username: 'sarahlifts',
  display_name: 'Sarah Mitchell',
  email: 'seller.test@example.com',
}

export const FULFILMENT_TEST_LISTING = {
  title: 'Rogue Ohio Bar — 20kg',
}

export const FULFILMENT_TEST_ORDER_ID = '33333333-3333-3333-3333-333333333333'

const fulfilmentOrderBase = {
  id: FULFILMENT_TEST_ORDER_ID,
  order_type: 'collection',
  dispute_window_hours: 24,
  payout_release_at: '2026-06-29T13:30:00.000Z',
  collection_confirmed_at: '2026-06-28T13:30:00.000Z',
  courier_evidence_submitted_at: '2026-06-28T12:00:00.000Z',
  courier_delivered_at: '2026-06-28T14:00:00.000Z',
  courier_name: 'Dave',
  courier_company: 'APC Overnight',
  courier_buyer_tracking_reference: 'APC123456',
}

/**
 * Build production-parity dynamic_template_data for manual SendGrid tests.
 * Does not read or write marketplace tables.
 */
export function buildFulfilmentTestDynamicData(templateKey, getEnv = (key) => process.env[key] ?? '') {
  const baseUrl = resolveAppBaseUrl(getEnv)
  const order = fulfilmentOrderBase
  const listing = FULFILMENT_TEST_LISTING
  const buyerProfile = FULFILMENT_TEST_BUYER_PROFILE
  const sellerProfile = FULFILMENT_TEST_SELLER_PROFILE

  switch (templateKey) {
    case 'buyer_delivery_details_added':
      return composeBuyerDeliveryDetailsAddedDynamicData({
        baseUrl,
        order: { ...order, order_type: 'seller_delivery' },
        listing,
        buyerProfile,
        sellerProfile,
        deliveryDetails: { delivery_contact_name: 'James Carter' },
      })
    case 'collection_confirmed':
      return composeCollectionConfirmedDynamicData({
        baseUrl,
        order,
        listing,
        buyerProfile,
        sellerProfile,
        recipientRole: 'seller',
      })
    case 'courier_dispatched':
      return composeCourierDispatchedDynamicData({
        baseUrl,
        order: { ...order, order_type: 'buyer_courier' },
        listing,
        buyerProfile,
        sellerProfile,
      })
    case 'delivery_confirmed':
      return composeDeliveryConfirmedDynamicData({
        baseUrl,
        order: { ...order, order_type: 'buyer_courier' },
        listing,
        buyerProfile,
        sellerProfile,
        recipientRole: 'seller',
      })
    case 'buyer_protection_started':
      return composeBuyerProtectionStartedDynamicData({
        baseUrl,
        order,
        listing,
        buyerProfile,
      })
    default:
      return null
  }
}
