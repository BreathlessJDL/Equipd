export type ApifyEbayPriceFields = {
  totalPrice?: unknown
  soldPrice?: unknown
  price?: unknown
  soldCurrency?: unknown
}

export type ResolvedEbaySoldPrice = {
  price: number | null
  structured_price_raw: string | number | null
  price_source: 'totalPrice' | 'soldPrice' | 'price' | 'text' | null
}

export function normalizeEbaySoldPrice(value: unknown): number | null {
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

export function resolveApifyEbaySoldPrice(item: ApifyEbayPriceFields): ResolvedEbaySoldPrice {
  const currency = String(item.soldCurrency ?? 'GBP').trim().toUpperCase()
  const isGbp = currency === 'GBP' || currency === ''

  if (!isGbp) {
    return { price: null, structured_price_raw: null, price_source: null }
  }

  const fields: Array<{ value: unknown; source: 'totalPrice' | 'soldPrice' | 'price' }> = [
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

export function parseGbpSoldPriceText(raw: string): number | null {
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
