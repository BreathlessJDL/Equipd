import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createServer } from 'vite'
import {
  canSubmitListingQuantityUpdate,
  getListingQuantityMinimumNote,
  getListingQuantityMinimumTotal,
} from '../src/lib/listingQuantity.js'

assert.equal(getListingQuantityMinimumTotal({ quantity_reserved: 0, quantity_sold: 0 }), 1)
assert.equal(getListingQuantityMinimumTotal({ quantity_reserved: 2, quantity_sold: 0 }), 2)
assert.equal(getListingQuantityMinimumTotal({ quantity_reserved: 2, quantity_sold: 2 }), 4)

assert.equal(
  getListingQuantityMinimumNote({ quantity_reserved: 0, quantity_sold: 0 }),
  null,
)
assert.match(
  getListingQuantityMinimumNote({ quantity_reserved: 2, quantity_sold: 0 }),
  /2 reserved items/,
)
assert.match(
  getListingQuantityMinimumNote({ quantity_reserved: 2, quantity_sold: 2 }),
  /reserved or sold items/,
)

const listing = {
  id: 'listing-edit-quantity',
  quantity_total: 5,
  quantity_available: 3,
  quantity_reserved: 2,
  quantity_sold: 0,
  inventory_version: 4,
}

assert.equal(canSubmitListingQuantityUpdate({ newTotal: '5', listing }), false)
assert.equal(canSubmitListingQuantityUpdate({ newTotal: '6', listing }), true)
assert.equal(canSubmitListingQuantityUpdate({ newTotal: '1', listing }), false)
assert.equal(canSubmitListingQuantityUpdate({ newTotal: 'abc', listing }), false)

const vite = await createServer({
  appType: 'custom',
  logLevel: 'silent',
  server: { middlewareMode: true },
})

try {
  const { default: SellerInventoryEditor } = await vite.ssrLoadModule(
    '/src/components/listing/SellerInventoryEditor.jsx',
  )
  const { default: ListingForm } = await vite.ssrLoadModule('/src/components/ListingForm.jsx')

  const withReserved = renderToStaticMarkup(
    React.createElement(SellerInventoryEditor, {
      listing,
      onListingChange: () => {},
    }),
  )
  assert.match(withReserved, />Quantity</)
  assert.match(withReserved, /Quantity available for this listing/)
  assert.match(withReserved, /listing-form__input--boxed/)
  assert.match(withReserved, /listing-form__quantity-card/)
  assert.match(withReserved, /value="5"/)
  assert.match(withReserved, /2 reserved items/)
  assert.match(withReserved, /Update quantity/)
  assert.match(withReserved, /disabled=""[^>]*>\s*Update quantity|>\s*Update quantity/)
  assert.match(withReserved, /<button[^>]*disabled[^>]*>/)
  assert.doesNotMatch(withReserved, /listing-form__row/)
  assert.doesNotMatch(withReserved, /listing-form__input--underline/)
  assert.doesNotMatch(withReserved, /listing-form__row-label/)
  assert.doesNotMatch(withReserved, />Inventory</)
  assert.doesNotMatch(withReserved, /listing-inventory__summary/)

  const withoutReserved = renderToStaticMarkup(
    React.createElement(SellerInventoryEditor, {
      listing: {
        ...listing,
        quantity_total: 5,
        quantity_reserved: 0,
        quantity_sold: 0,
      },
      onListingChange: () => {},
    }),
  )
  assert.doesNotMatch(withoutReserved, /cannot be reduced below/)
  assert.match(withoutReserved, /value="5"/)

  const createListingQuantity = renderToStaticMarkup(
    React.createElement(ListingForm, {
      form: {
        title: '',
        categoryId: '',
        brand: '',
        model: '',
        condition: '',
        rating: '',
        price: '',
        quantity: '1',
        description: '',
        location: '',
        collectionAddress: '',
        deliveryOptions: [],
        deliveryNotes: '',
        sellerDeliveryRadiusMiles: '',
      },
      categories: [],
      onFieldChange: () => {},
      onSubmit: (event) => event.preventDefault(),
    }),
  )
  assert.match(createListingQuantity, /Quantity available/)
  assert.match(createListingQuantity, /listing-form__input--underline/)

  console.log('seller inventory editor UI checks passed')
} finally {
  await vite.close()
}
