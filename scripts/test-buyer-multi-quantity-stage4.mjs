import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import {
  calculateTotalOfferPence,
  clampOfferQuantity,
  formatPenceAsOfferInput,
  getOfferUnitAmountPence,
  parseOfferQuantityInput,
  parseUnitOfferPence,
  validateBuyerOfferAmount,
  validateBuyerUnitOfferAmount,
} from '../src/lib/offerQuantity.js'

const root = new URL('../', import.meta.url)
const read = (path) => readFile(new URL(path, root), 'utf8')

assert.equal(getOfferUnitAmountPence(220000, 4), 55000)
assert.equal(getOfferUnitAmountPence(220001, 4), null)
assert.equal(getOfferUnitAmountPence(59500, 1), 59500)
assert.equal(validateBuyerOfferAmount(220000, 59500, 4), null)
assert.match(validateBuyerOfferAmount(220001, 59500, 4), /divide evenly/)
assert.match(validateBuyerOfferAmount(240000, 59500, 4), /asking price/)
assert.match(validateBuyerOfferAmount(0, 59500, 1), /divide evenly/)
assert.match(validateBuyerOfferAmount(220000, 59500, 4.5), /divide evenly/)
assert.equal(clampOfferQuantity(0, 6), 1)
assert.equal(clampOfferQuantity(7, 6), 6)
assert.equal(clampOfferQuantity(3.5, 6), 1)
assert.equal(clampOfferQuantity(4, 6), 4)

assert.equal(parseUnitOfferPence('500'), 50000)
assert.equal(parseUnitOfferPence('500.00'), 50000)
assert.equal(parseUnitOfferPence(''), null)
assert.equal(calculateTotalOfferPence(50000, 3), 150000)
assert.equal(calculateTotalOfferPence(50000, 1), 50000)
assert.equal(formatPenceAsOfferInput(150000), '1500.00')
assert.equal(validateBuyerUnitOfferAmount(50000, 59500), null)
assert.match(validateBuyerUnitOfferAmount(60000, 59500), /asking price/)
assert.match(validateBuyerUnitOfferAmount(0, 59500), /greater than zero/)

assert.deepEqual(parseOfferQuantityInput('3', 6), { quantity: 3, error: null })
assert.deepEqual(parseOfferQuantityInput('7', 6), {
  quantity: 6,
  error: 'Only 6 items are available.',
})
assert.match(parseOfferQuantityInput('3.5', 6).error, /whole number/)
assert.match(parseOfferQuantityInput('0', 6).error, /at least 1/)

const [
  migration,
  checkout,
  webhook,
  offerModal,
  counterModal,
  offers,
  orders,
  payments,
  messageCard,
  hubCard,
  orderBreakdown,
  emailCore,
  listingSummary,
  listingDetailPage,
  listingDetailCss,
  checkoutSummary,
  adminOrders,
  checkoutCommerce,
] = await Promise.all([
  read('supabase/migrations/20260721223000_buyer_multi_quantity_transactions.sql'),
  read('supabase/functions/stripe-create-checkout/index.ts'),
  read('supabase/functions/stripe-webhook/index.ts'),
  read('src/components/listing/MakeOfferModal.jsx'),
  read('src/components/messages/CounterOfferModal.jsx'),
  read('src/lib/offers.js'),
  read('src/lib/orders.js'),
  read('src/lib/payments.js'),
  read('src/components/messages/MessageOfferCard.jsx'),
  read('src/components/hub/HubOfferCard.jsx'),
  read('src/components/OrderFinancialBreakdown.jsx'),
  read('supabase/functions/_shared/marketplaceEmailCore.js'),
  read('src/components/listing/ListingItemSummary.jsx'),
  read('src/pages/ListingDetailPage.jsx'),
  read('src/components/ListingDetail.css'),
  read('src/components/PaymentCheckoutSummary.jsx'),
  read('src/pages/AdminOrdersPage.jsx'),
  read('supabase/functions/_shared/checkoutCommerce.ts'),
])

assert.ok(migration.includes('create_buyer_offer'))
assert.ok(migration.includes('attach_checkout_session'))
assert.ok(migration.includes("Order reservation is not active"))
assert.ok(!migration.includes("Listing is not reserved for payment"))
assert.ok(migration.includes('p_quantity integer'))
assert.ok(migration.includes('p_total_amount_pence integer'))
assert.ok(migration.includes('p_total_amount_pence % p_quantity'))
assert.ok(migration.includes('p_quantity > v_listing.quantity_available'))
assert.ok(migration.includes('p_total_amount_pence / p_quantity > v_listing.price_pence'))
assert.ok(migration.includes('guard_offer_quantity_immutable'))
assert.ok(migration.includes('guard_order_commercial_snapshot_immutable'))
assert.ok(migration.includes('quantity_available = quantity_available - v_offer.quantity'))
assert.ok(migration.includes('quantity_reserved = quantity_reserved + v_offer.quantity'))
assert.ok(migration.includes('order_refund_is_explicitly_full'))
assert.ok(migration.includes('partial_refund_pending'))
assert.ok(migration.includes("'no_restock'::public.order_inventory_state"))

assert.ok(!checkout.includes("payment.listing?.status !== 'reserved'"))
assert.match(checkout, /orderRow\.inventory_state !== 'reserved'/)
assert.match(checkout, /buildCheckoutLineItems\(commerceSnapshot/)
assert.match(checkout, /idempotencyKey: `equipd-checkout:/)
assert.match(checkout, /existingSession\.status === 'complete'/)
assert.match(checkoutCommerce, /itemSubtotalPence !== agreedUnitPricePence \* quantity/)
assert.match(checkoutCommerce, /quantity: snapshot\.quantity/)
assert.match(checkoutCommerce, /unit_amount: snapshot\.agreedUnitPricePence/)

assert.match(webhook, /session\.amount_total !== expectedTotal/)
assert.match(webhook, /session\.metadata\?\.quantity/)
assert.match(webhook, /legacyQuantityOneSession/)
assert.match(webhook, /mark_payment_captured_or_exception/)

assert.match(offerModal, /Offer per item/)
assert.match(offerModal, /Total offer/)
assert.match(offerModal, /make-offer-modal__quantity-input/)
assert.match(offerModal, /formatPenceAsOfferInput\(totalOfferPence\)/)
assert.match(offerModal, /quantity,\s*\n\s*\}\)/s)
assert.doesNotMatch(offerModal, /Total offer for/)
assert.match(counterModal, /Counter offer per item/)
assert.match(counterModal, /Total counter-offer/)
assert.match(counterModal, /Quantity: \{quantity\}/)
assert.doesNotMatch(counterModal, /Counter-offer amount/)

assert.match(offers, /p_quantity: quantity/)
assert.match(offers, /p_total_amount_pence: amountPence/)
assert.match(orders, /inventory_state/)
assert.match(orders, /agreed_unit_price_pence/)
assert.match(payments, /item_subtotal_pence/)
assert.match(messageCard, /per item/)
assert.match(messageCard, /Offer price/)
assert.match(messageCard, /message-offer-card__amount/)
assert.match(hubCard, /quantity=\{offer\.quantity \?\? 1\}/)
assert.match(orderBreakdown, /Item subtotal/)
assert.match(orderBreakdown, /Unit price/)
assert.match(emailCore, /'Offer per item'/)
assert.match(emailCore, /Quantity: quantity/)
assert.match(emailCore, /72 hours/)
assert.match(listingSummary, /Decrease selected quantity/)
assert.match(listingSummary, /Increase selected quantity/)
assert.match(listingSummary, /item subtotal/)
assert.match(listingDetailPage, /quantity=\{selectedQuantity\}/)
assert.match(listingDetailPage, /onQuantityChange=/)
assert.match(listingDetailCss, /listing-summary__quantity-stepper/)
assert.match(checkoutSummary, /Item subtotal/)
assert.match(adminOrders, /order\.quantity \?\? 1/)

console.log('buyer multi-quantity Stage 4 static/unit checks passed')
