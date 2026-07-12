function normalizeEbaySoldPrice(value) {
  if (value === null || value === undefined || value === '') return null

  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value <= 0 || value >= 500_000) return null
    return Math.round(value)
  }

  const raw = String(value).trim()
  if (!raw) return null

  if ((/[$€]|\busd\b|\beur\b/i.test(raw)) && !(/£|\bgbp\b/i.test(raw))) {
    return null
  }

  const numericPart = raw
    .replace(/£|\bgbp\b/gi, '')
    .replace(/,/g, '')
    .trim()

  const amount = Number(numericPart)
  if (!Number.isFinite(amount) || amount <= 0 || amount >= 500_000) return null
  return Math.round(amount)
}

function parseGbpSoldPriceText(raw) {
  const haystack = String(raw ?? '')
  if (
    haystack.includes('$') ||
    haystack.includes('USD') ||
    haystack.includes('€') ||
    haystack.includes('EUR')
  ) {
    return null
  }

  const match = haystack.match(/£\s*([\d,]+(?:\.\d{1,2})?)/i)
  if (!match?.[1]) return null

  return normalizeEbaySoldPrice(match[1])
}

function resolveApifyEbaySoldPrice(item) {
  const currency = String(item.soldCurrency ?? 'GBP').trim().toUpperCase()
  const isGbp = currency === 'GBP' || currency === ''

  if (!isGbp) {
    return { price: null, structured_price_raw: null, price_source: null }
  }

  const fields = [
    { value: item.totalPrice, source: 'totalPrice' },
    { value: item.soldPrice, source: 'soldPrice' },
    { value: item.price, source: 'price' },
  ]

  for (const field of fields) {
    if (field.value === null || field.value === undefined || field.value === '') continue

    const price = normalizeEbaySoldPrice(field.value)
    if (price === null) continue

    return {
      price,
      structured_price_raw:
        typeof field.value === 'string' || typeof field.value === 'number'
          ? field.value
          : String(field.value),
      price_source: field.source,
    }
  }

  return { price: null, structured_price_raw: null, price_source: null }
}

function assertEqual(actual, expected, label) {
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

console.log('test-ebay-sold-price passed')
