import {
  normalizeEbaySoldPrice,
  parseGbpSoldPriceText,
  resolveApifyEbaySoldPrice,
} from './intelligenceEbaySoldPrice.ts'

function assertEqual<T>(actual: T, expected: T, label: string) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${expected}, got ${actual}`)
  }
}

assertEqual(normalizeEbaySoldPrice('3500.00'), 3500, '3500.00 string')
assertEqual(normalizeEbaySoldPrice('336.00'), 336, '336.00 string')
assertEqual(normalizeEbaySoldPrice('3,500.00'), 3500, '3,500.00 string')
assertEqual(normalizeEbaySoldPrice(3500), 3500, '3500 number')
assertEqual(normalizeEbaySoldPrice('£3,500.00'), 3500, '£3,500.00 string')
assertEqual(parseGbpSoldPriceText('£3,500.00'), 3500, 'parse £3,500.00')
assertEqual(parseGbpSoldPriceText('£3500.00'), 3500, 'parse £3500.00')

const resolved = resolveApifyEbaySoldPrice({
  totalPrice: '3500.00',
  soldPrice: '350.00',
  soldCurrency: 'GBP',
})
assertEqual(resolved.price, 3500, 'Apify prefers totalPrice')
assertEqual(resolved.price_source, 'totalPrice', 'Apify price source')

const soldOnly = resolveApifyEbaySoldPrice({
  soldPrice: 336,
  soldCurrency: 'GBP',
})
assertEqual(soldOnly.price, 336, 'Apify soldPrice fallback')
assertEqual(soldOnly.price_source, 'soldPrice', 'Apify soldPrice source')

console.log('intelligenceEbaySoldPrice tests passed')
