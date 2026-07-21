export const MIN_LISTING_QUANTITY = 1
export const MAX_LISTING_QUANTITY = 999

export function parseListingQuantity(quantityInput) {
  const value = String(quantityInput ?? '').trim()
  if (!/^\d+$/.test(value)) return null

  const quantity = Number(value)
  if (
    !Number.isSafeInteger(quantity)
    || quantity < MIN_LISTING_QUANTITY
    || quantity > MAX_LISTING_QUANTITY
  ) {
    return null
  }

  return quantity
}
