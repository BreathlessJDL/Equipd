/**
 * Unit tests for USD → GBP misconversion detection/fix helpers.
 */

import {
  USD_TO_GBP_RESEARCH_EXCHANGE_RATE,
  assessUsdGbpMisconversionRow,
  buildUsdGbpFixPatch,
  convertUsdToGbpResearch,
} from './fix-usd-gbp-conversion-rows.mjs'

function assert(condition, label) {
  if (!condition) throw new Error(label)
}

assert(convertUsdToGbpResearch(4367) === 3275, '4367 USD should convert to 3275 GBP at 0.75')

const misconverted = assessUsdGbpMisconversionRow({
  currency: 'USD',
  best_original_price_currency: 'GBP',
  original_rrp: 4367,
  best_original_price: 4367,
})
assert(misconverted.affected === true, '4367 copied as GBP should be affected')
assert(misconverted.expectedConverted === 3275, 'expected converted GBP should be 3275')
assert(
  !(misconverted.expectedConverted === 4367),
  '$4367 USD must never remain stored as £4367 GBP',
)

const alreadyConverted = assessUsdGbpMisconversionRow({
  currency: 'USD',
  best_original_price_currency: 'GBP',
  original_rrp: 4367,
  best_original_price: 3275,
})
assert(alreadyConverted.affected === false, 'already converted row should be skipped')
assert(alreadyConverted.reason === 'already_converted', 'should report already converted')

const gbpRow = assessUsdGbpMisconversionRow({
  currency: 'GBP',
  best_original_price_currency: 'GBP',
  original_rrp: 7500,
  best_original_price: 7500,
})
assert(gbpRow.affected === false, 'native GBP rows should be untouched')

const patch = buildUsdGbpFixPatch(misconverted)
assert(patch.best_original_price === 3275, 'fix patch should set converted GBP valuation')
assert(patch.best_original_price_currency === 'GBP', 'fix patch should keep GBP valuation currency')
assert(patch.original_rrp == null, 'fix patch should not overwrite original_rrp')

console.log('usd gbp conversion fix tests passed')
