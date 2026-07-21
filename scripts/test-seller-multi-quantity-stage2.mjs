import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  MAX_LISTING_QUANTITY,
  MIN_LISTING_QUANTITY,
  parseListingQuantity,
} from '../src/lib/listingQuantity.js'
import { emptyListingForm, isCreateListingFormDirty } from '../src/lib/createListingForm.js'

assert.equal(MIN_LISTING_QUANTITY, 1)
assert.equal(MAX_LISTING_QUANTITY, 999)
assert.equal(parseListingQuantity('1'), 1)
assert.equal(parseListingQuantity('6'), 6)
assert.equal(parseListingQuantity('999'), 999)

for (const invalid of ['', '0', '1000', '1.5', '1e2', '-1', 'six', null, undefined]) {
  assert.equal(parseListingQuantity(invalid), null, `expected ${String(invalid)} to be invalid`)
}

assert.equal(emptyListingForm.quantity, '1')
assert.equal(isCreateListingFormDirty({ ...emptyListingForm }), false)
assert.equal(isCreateListingFormDirty({ ...emptyListingForm, quantity: '6' }), true)

const listingsSource = readFileSync(
  new URL('../src/lib/listings.js', import.meta.url),
  'utf8',
)
const createStart = listingsSource.indexOf('export async function createListing(')
const createEnd = listingsSource.indexOf(
  'export async function updateListingQuantity(',
  createStart,
)
assert.notEqual(createStart, -1)
assert.notEqual(createEnd, -1)

const createListingSource = listingsSource.slice(createStart, createEnd)
assert.equal(
  (createListingSource.match(/\.insert\(/g) ?? []).length,
  1,
  'listing creation must perform exactly one insert',
)
assert.match(createListingSource, /quantity_total:\s*quantity/)
assert.match(createListingSource, /status:\s*fields\.status/)
assert.doesNotMatch(createListingSource, /updateListingQuantity\(/)
assert.doesNotMatch(createListingSource, /\.rpc\(/)
assert.doesNotMatch(createListingSource, /\.update\(/)

console.log('PASS: atomic seller multi-quantity creation and validation tests')
