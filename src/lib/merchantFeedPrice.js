/**
 * Merchant feed price policy for Buyer Protection.
 *
 * Decision (Stage 8 — do not change marketplace fees):
 * - Feed `price` = seller listing asking price (matches landing primary price + Offer schema)
 * - Unavoidable Buyer Protection fee is submitted via `shipping` (UK-required shipping slot)
 *   per Google guidance that merchant service/processing fees not included in price should
 *   be bundled into shipping settings/attribute — NOT silently added into price.
 * - Checkout total at asking price ≈ price + shipping(BP fee)
 * - Offer-mediated purchase remains an unresolved Google policy question (documented)
 */

import {
  calculateBuyerProtectionFee,
  calculateBuyerCheckoutTotals,
  normalizeListingPricePence,
} from './buyerProtection.js'

export const MERCHANT_FEED_CURRENCY = 'GBP'

export const MERCHANT_PRICE_POLICY = Object.freeze({
  mode: 'listing_price_plus_buyer_protection_as_shipping',
  listingPriceSource: 'listing.price_pence',
  offerSchemaAligned: true,
  buyerProtectionInShipping: true,
  doNotSubmitUntilReviewed: true,
})

export function formatMerchantPriceFromPence(pence) {
  const normalized = normalizeListingPricePence(pence)
  if (normalized == null) return null
  const pounds = normalized / 100
  const amount = Number.isInteger(pounds) ? pounds.toFixed(2) : pounds.toFixed(2)
  return `${amount} ${MERCHANT_FEED_CURRENCY}`
}

/**
 * @returns {{
 *   itemPricePence: number,
 *   buyerProtectionFeePence: number,
 *   buyerTotalPence: number,
 *   price: string,
 *   shippingPrice: string,
 *   policy: typeof MERCHANT_PRICE_POLICY,
 * } | null}
 */
export function buildMerchantPriceFields(listing) {
  const itemPricePence = normalizeListingPricePence(listing?.price_pence)
  if (itemPricePence == null) return null

  const totals = calculateBuyerCheckoutTotals(itemPricePence)
  const price = formatMerchantPriceFromPence(totals.itemPricePence)
  const shippingPrice = formatMerchantPriceFromPence(totals.buyerProtectionFeePence)
  if (!price || !shippingPrice) return null

  return {
    itemPricePence: totals.itemPricePence,
    buyerProtectionFeePence: totals.buyerProtectionFeePence,
    buyerTotalPence: totals.buyerTotalPence,
    price,
    shippingPrice,
    shippingCountry: 'GB',
    policy: MERCHANT_PRICE_POLICY,
  }
}

export function assertMerchantPriceConsistency(listing) {
  const fields = buildMerchantPriceFields(listing)
  if (!fields) return { ok: false, reason: 'missing_price' }

  const fee = calculateBuyerProtectionFee(fields.itemPricePence)
  if (fee !== fields.buyerProtectionFeePence) {
    return { ok: false, reason: 'fee_mismatch' }
  }
  if (fields.itemPricePence + fields.buyerProtectionFeePence !== fields.buyerTotalPence) {
    return { ok: false, reason: 'total_mismatch' }
  }
  if (!/^\d+\.\d{2} GBP$/.test(fields.price)) {
    return { ok: false, reason: 'price_format' }
  }
  if (!/^\d+\.\d{2} GBP$/.test(fields.shippingPrice)) {
    return { ok: false, reason: 'shipping_format' }
  }
  return { ok: true, fields }
}
