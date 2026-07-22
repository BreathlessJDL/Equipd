import {
  buildCheckoutLineItems,
  resolveCheckoutCommerceSnapshot,
} from './checkoutCommerce.ts'

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message)
}

function baseRows() {
  const payment = {
    id: 'payment-1',
    buyer_id: 'buyer-1',
    seller_id: 'seller-1',
    listing_id: 'listing-1',
    quantity: 4,
    listing_unit_price_pence: 59500,
    agreed_unit_price_pence: 55000,
    item_subtotal_pence: 220000,
    amount_pence: 220000,
    buyer_protection_fee_pence: 11000,
    buyer_total_pence: 231000,
  }
  const order = {
    payment_id: 'payment-1',
    buyer_id: 'buyer-1',
    seller_id: 'seller-1',
    listing_id: 'listing-1',
    quantity: 4,
    listing_unit_price_pence: 59500,
    agreed_unit_price_pence: 55000,
    item_subtotal_pence: 220000,
    amount_pence: 220000,
    buyer_protection_fee_pence: 11000,
    buyer_total_pence: 231000,
  }
  return { payment, order }
}

Deno.test('multi-quantity checkout uses authoritative unit amount and quantity', () => {
  const { payment, order } = baseRows()
  const snapshot = resolveCheckoutCommerceSnapshot(payment, order)
  const lineItems = buildCheckoutLineItems(snapshot, 'Quantity listing')

  assert(snapshot.quantity === 4, 'quantity snapshot changed')
  assert(snapshot.agreedUnitPricePence === 55000, 'unit snapshot changed')
  assert(snapshot.itemSubtotalPence === 220000, 'subtotal snapshot changed')
  assert(lineItems[0].quantity === 4, 'Stripe item quantity is not four')
  assert(lineItems[0].price_data.unit_amount === 55000, 'Stripe unit amount is not authoritative')
  assert(lineItems[1].quantity === 1, 'Buyer Protection must remain per order')
  assert(lineItems[1].price_data.unit_amount === 11000, 'Buyer Protection fee changed')
})

Deno.test('quantity-one checkout preserves the existing line-item shape', () => {
  const { payment, order } = baseRows()
  Object.assign(payment, {
    quantity: 1,
    agreed_unit_price_pence: 55000,
    item_subtotal_pence: 55000,
    amount_pence: 55000,
    buyer_protection_fee_pence: 5000,
    buyer_total_pence: 60000,
  })
  Object.assign(order, {
    quantity: 1,
    agreed_unit_price_pence: 55000,
    item_subtotal_pence: 55000,
    amount_pence: 55000,
    buyer_protection_fee_pence: 5000,
    buyer_total_pence: 60000,
  })

  const lineItems = buildCheckoutLineItems(
    resolveCheckoutCommerceSnapshot(payment, order),
    'Single listing',
  )
  assert(lineItems[0].quantity === 1, 'quantity-one checkout changed')
  assert(lineItems[0].price_data.unit_amount === 55000, 'quantity-one price changed')
})

Deno.test('checkout rejects mismatched subtotal and payment snapshots', () => {
  const { payment, order } = baseRows()
  order.item_subtotal_pence = 220001
  let subtotalRejected = false
  try {
    resolveCheckoutCommerceSnapshot(payment, order)
  } catch (error) {
    subtotalRejected = error instanceof Error && error.message === 'Order pricing snapshot is invalid'
  }
  assert(subtotalRejected, 'invalid unit × quantity subtotal was accepted')

  const rows = baseRows()
  rows.payment.quantity = 3
  let paymentRejected = false
  try {
    resolveCheckoutCommerceSnapshot(rows.payment, rows.order)
  } catch (error) {
    paymentRejected =
      error instanceof Error && error.message === 'Payment and order snapshots do not match'
  }
  assert(paymentRejected, 'payment/order quantity mismatch was accepted')
})

Deno.test('checkout rejects invalid quantities and prices above listing snapshot', () => {
  const invalidQuantity = baseRows()
  invalidQuantity.order.quantity = 0
  let quantityRejected = false
  try {
    resolveCheckoutCommerceSnapshot(invalidQuantity.payment, invalidQuantity.order)
  } catch (error) {
    quantityRejected = error instanceof Error && error.message === 'Order quantity is invalid'
  }
  assert(quantityRejected, 'zero quantity was accepted')

  const priceCeiling = baseRows()
  priceCeiling.order.agreed_unit_price_pence = 60000
  priceCeiling.order.item_subtotal_pence = 240000
  priceCeiling.order.amount_pence = 240000
  let ceilingRejected = false
  try {
    resolveCheckoutCommerceSnapshot(priceCeiling.payment, priceCeiling.order)
  } catch (error) {
    ceilingRejected = error instanceof Error && error.message === 'Order pricing snapshot is invalid'
  }
  assert(ceilingRejected, 'price above listing snapshot was accepted')
})
