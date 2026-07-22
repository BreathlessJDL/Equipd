export const MIN_LISTING_QUANTITY = 1
export const MAX_LISTING_QUANTITY = 999

export function getListingQuantityMinimumTotal(listing) {
  const reserved = Number(listing?.quantity_reserved ?? 0)
  const sold = Number(listing?.quantity_sold ?? 0)
  return Math.max(MIN_LISTING_QUANTITY, reserved + sold)
}

export function getListingQuantityMinimumNote(listing) {
  const reserved = Number(listing?.quantity_reserved ?? 0)
  const sold = Number(listing?.quantity_sold ?? 0)
  const minimumTotal = getListingQuantityMinimumTotal(listing)

  if (minimumTotal <= MIN_LISTING_QUANTITY && reserved === 0 && sold === 0) {
    return null
  }

  if (sold > 0) {
    return `This listing has reserved or sold items, so the quantity cannot be reduced below ${minimumTotal}.`
  }

  if (reserved > 0) {
    return `This listing has ${reserved} reserved ${reserved === 1 ? 'item' : 'items'}, so the quantity cannot be reduced below ${reserved}.`
  }

  return null
}

export function canSubmitListingQuantityUpdate({ newTotal, listing }) {
  const quantity = parseListingQuantity(newTotal)
  if (quantity == null) return false

  const minimumTotal = getListingQuantityMinimumTotal(listing)
  if (quantity < minimumTotal) return false

  return quantity !== listing.quantity_total
}

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
