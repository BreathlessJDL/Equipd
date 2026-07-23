import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createServer } from 'vite'
import { MemoryRouter } from 'react-router-dom'

const vite = await createServer({
  appType: 'custom',
  logLevel: 'silent',
  server: { middlewareMode: true },
})

try {
  const [
    { default: ListingItemSummary },
    { default: MakeOfferModal },
    { default: CounterOfferModal },
    { default: PaymentCheckoutSummary },
    { default: MessageOfferCard },
    { calculateTotalOfferPence, formatPenceAsOfferInput, parseUnitOfferPence },
  ] = await Promise.all([
    vite.ssrLoadModule('/src/components/listing/ListingItemSummary.jsx'),
    vite.ssrLoadModule('/src/components/listing/MakeOfferModal.jsx'),
    vite.ssrLoadModule('/src/components/messages/CounterOfferModal.jsx'),
    vite.ssrLoadModule('/src/components/PaymentCheckoutSummary.jsx'),
    vite.ssrLoadModule('/src/components/messages/MessageOfferCard.jsx'),
    vite.ssrLoadModule('/src/lib/offerQuantity.js'),
  ])

  const listing = {
    id: 'listing-quantity-test',
    seller_id: 'seller-1',
    title: 'Quantity test listing',
    status: 'active',
    price_pence: 59500,
    quantity_available: 6,
    condition: 'good',
    collection_available: true,
    created_at: '2026-07-21T12:00:00.000Z',
  }

  const multiSummary = renderToStaticMarkup(
    React.createElement(
      MemoryRouter,
      null,
      React.createElement(ListingItemSummary, {
        listing,
        selectedQuantity: 4,
        onSelectedQuantityChange: () => {},
        actions: React.createElement('button', null, 'Make an offer'),
      }),
    ),
  )
  assert.match(multiSummary, /Decrease selected quantity/)
  assert.match(multiSummary, /Increase selected quantity/)
  assert.match(multiSummary, /listing-summary__quantity-input/)
  assert.match(multiSummary, /value="4"/)
  assert.match(multiSummary, /6 available/)
  assert.match(multiSummary, /£595 per item/)
  assert.match(multiSummary, /£2,380 item subtotal/)

  const quantityOneSummary = renderToStaticMarkup(
    React.createElement(
      MemoryRouter,
      null,
      React.createElement(ListingItemSummary, {
        listing: { ...listing, quantity_available: 1 },
        selectedQuantity: 1,
        onSelectedQuantityChange: () => {},
      }),
    ),
  )
  assert.doesNotMatch(quantityOneSummary, /Purchase quantity/)
  assert.doesNotMatch(quantityOneSummary, /item subtotal/)

  const offerModal = renderToStaticMarkup(
    React.createElement(MakeOfferModal, {
      open: true,
      listing,
      user: { id: 'buyer-1' },
      quantity: 3,
      onQuantityChange: () => {},
      onClose: () => {},
      onSubmitted: () => {},
    }),
  )
  assert.match(offerModal, /Offer per item/)
  assert.match(offerModal, /make-offer-modal__quantity-input/)
  assert.match(offerModal, /value="3"/)
  assert.match(offerModal, /6 available/)
  assert.doesNotMatch(offerModal, /Total offer for/)

  const offerModalWithUnitPrice = renderToStaticMarkup(
    React.createElement(MakeOfferModal, {
      open: true,
      listing,
      user: { id: 'buyer-1' },
      quantity: 3,
      onQuantityChange: () => {},
      onClose: () => {},
      onSubmitted: () => {},
    }),
  )
  assert.match(offerModalWithUnitPrice, /max="595\.00"/)

  const unitOfferPence = parseUnitOfferPence('500')
  const totalOfferPence = calculateTotalOfferPence(unitOfferPence, 3)
  assert.equal(totalOfferPence, 150000)
  assert.equal(formatPenceAsOfferInput(totalOfferPence), '1500.00')

  const counterModal = renderToStaticMarkup(
    React.createElement(CounterOfferModal, {
      open: true,
      listingPricePence: 59500,
      quantity: 3,
      onClose: () => {},
      onSubmit: () => {},
    }),
  )
  assert.match(counterModal, /Quantity: 3 items/)
  assert.match(counterModal, /Counter offer per item/)
  assert.doesNotMatch(counterModal, /Counter-offer amount/)

  const offerCard = renderToStaticMarkup(
    React.createElement(
      MemoryRouter,
      null,
      React.createElement(MessageOfferCard, {
        message: {
          id: 'message-1',
          sender_id: 'buyer-1',
          created_at: '2026-07-21T12:00:00.000Z',
          offer: {
            id: 'offer-1',
            amount_pence: 150000,
            quantity: 3,
            status: 'pending',
            listing: { slug: 'quantity-test', title: 'Quantity test listing' },
          },
        },
        conversation: {
          buyer_id: 'buyer-1',
          seller_id: 'seller-1',
        },
        user: { id: 'seller-1' },
      }),
    ),
  )
  assert.match(offerCard, /Offer for 3 items/)
  assert.match(offerCard, /Offer price/)
  assert.match(offerCard, /£1,500/)
  assert.match(offerCard, /£500 per item/)
  assert.doesNotMatch(offerCard, /Seller Service Fee/)
  assert.doesNotMatch(offerCard, /You'll receive/)
  assert.doesNotMatch(offerCard, /Buyer Protection/)

  const checkoutSummary = renderToStaticMarkup(
    React.createElement(PaymentCheckoutSummary, {
      payment: {
        amount_pence: 220000,
        quantity: 4,
        agreed_unit_price_pence: 55000,
        item_subtotal_pence: 220000,
        buyer_protection_fee_pence: 11000,
        buyer_total_pence: 231000,
      },
    }),
  )
  assert.match(checkoutSummary, /Unit price/)
  assert.match(checkoutSummary, /£550/)
  assert.match(checkoutSummary, /Quantity/)
  assert.match(checkoutSummary, /Item subtotal/)
  assert.match(checkoutSummary, /£2,200/)

  console.log('buyer multi-quantity UI render checks passed')
} finally {
  await vite.close()
}
