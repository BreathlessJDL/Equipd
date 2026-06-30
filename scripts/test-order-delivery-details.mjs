#!/usr/bin/env node

import {
  canBuyerEditDeliveryDetails,
  hasBuyerSubmittedDeliveryDetails,
  normalizeOrderDeliveryDetails,
} from '../src/lib/orderDeliveryDetails.js'
import { ORDER_FULFILMENT_STATUSES, ORDER_TYPES } from '../src/lib/orders.js'

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function testNormalizeOrderDeliveryDetails() {
  const normalized = normalizeOrderDeliveryDetails({
    order_id: 'order-1',
    buyer_delivery_address: '10 High Street',
    delivery_contact_name: 'Alex Buyer',
    delivery_contact_phone: '07700900123',
    delivery_notes: 'Side gate',
    delivery_details_submitted_at: '2026-01-02T10:00:00Z',
    created_at: '2026-01-01T10:00:00Z',
    updated_at: '2026-01-02T10:00:00Z',
  })

  assert(normalized.buyerDeliveryAddress === '10 High Street', 'Expected address')
  assert(normalized.deliveryContactName === 'Alex Buyer', 'Expected contact name')
  assert(normalized.deliveryContactPhone === '07700900123', 'Expected contact phone')
  assert(normalized.deliveryNotes === 'Side gate', 'Expected notes')
  console.log('PASS: normalizeOrderDeliveryDetails')
}

function testHasBuyerSubmittedDeliveryDetails() {
  assert(
    hasBuyerSubmittedDeliveryDetails({
      buyerDeliveryAddress: '10 High Street',
      deliveryContactName: 'Alex',
      deliveryContactPhone: '07700900123',
    }),
    'Expected complete details to count as submitted',
  )

  assert(
    hasBuyerSubmittedDeliveryDetails({
      buyerDeliveryAddress: '10 High Street',
      updatedAt: '2026-01-01T10:00:00Z',
    }),
    'Expected legacy address-only row to count as submitted',
  )

  assert(
    !hasBuyerSubmittedDeliveryDetails({
      buyerDeliveryAddress: '',
    }),
    'Expected empty details to be unsubmitted',
  )

  console.log('PASS: hasBuyerSubmittedDeliveryDetails')
}

function testCanBuyerEditDeliveryDetails() {
  const awaitingOrder = {
    order_type: ORDER_TYPES.SELLER_DELIVERY,
    fulfilment_status: ORDER_FULFILMENT_STATUSES.AWAITING_SELLER_DELIVERY,
    collected_at: null,
  }

  assert(canBuyerEditDeliveryDetails(awaitingOrder), 'Buyer should edit while awaiting delivery')

  assert(
    !canBuyerEditDeliveryDetails({
      ...awaitingOrder,
      fulfilment_status: ORDER_FULFILMENT_STATUSES.COLLECTED,
      collected_at: '2026-01-03T10:00:00Z',
    }),
    'Buyer should not edit after handover',
  )

  console.log('PASS: canBuyerEditDeliveryDetails')
}

function main() {
  testNormalizeOrderDeliveryDetails()
  testHasBuyerSubmittedDeliveryDetails()
  testCanBuyerEditDeliveryDetails()
  console.log('All order delivery details helper tests passed.')
}

main()
