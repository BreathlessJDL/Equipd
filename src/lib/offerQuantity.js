export const OFFER_EXCEEDS_ASKING_PRICE_ERROR =
  'Offers cannot be higher than the asking price.'

export function clampOfferQuantity(quantity, quantityAvailable) {
  const available = Number(quantityAvailable)
  const max = Number.isSafeInteger(available) ? Math.min(999, Math.max(1, available)) : 1
  const requested = Number(quantity)
  return Math.min(max, Math.max(1, Number.isSafeInteger(requested) ? requested : 1))
}

export function parseOfferQuantityInput(rawValue, quantityAvailable) {
  const raw = String(rawValue ?? '').trim()
  if (!raw) {
    return { quantity: null, error: 'Enter a quantity.' }
  }
  if (raw.includes('.') || raw.includes(',')) {
    return { quantity: null, error: 'Quantity must be a whole number.' }
  }
  const parsed = Number.parseInt(raw, 10)
  if (!Number.isSafeInteger(parsed)) {
    return { quantity: null, error: 'Enter a valid quantity.' }
  }
  if (parsed < 1) {
    return { quantity: null, error: 'Quantity must be at least 1.' }
  }
  const max = clampOfferQuantity(quantityAvailable, quantityAvailable)
  if (parsed > max) {
    return {
      quantity: max,
      error: `Only ${max} ${max === 1 ? 'item is' : 'items are'} available.`,
    }
  }
  return { quantity: parsed, error: null }
}

export function parseUnitOfferPence(unitInput) {
  const raw = String(unitInput ?? '').trim()
  if (!raw) return null
  const parsed = Number.parseFloat(raw)
  if (!Number.isFinite(parsed) || parsed <= 0) return null
  return Math.round(parsed * 100)
}

export function calculateTotalOfferPence(unitOfferPence, quantity = 1) {
  const unit = Number(unitOfferPence)
  const count = Number(quantity)
  if (!Number.isSafeInteger(unit) || unit <= 0) return null
  if (!Number.isSafeInteger(count) || count < 1) return null
  return unit * count
}

export function getOfferUnitAmountPence(amountPence, quantity = 1) {
  const total = Number(amountPence)
  const count = Number(quantity)
  if (!Number.isSafeInteger(total) || total <= 0) return null
  if (!Number.isSafeInteger(count) || count < 1 || total % count !== 0) return null
  return total / count
}

export function validateBuyerUnitOfferAmount(unitOfferPence, listingPricePence) {
  const unit = Number(unitOfferPence)
  if (!Number.isSafeInteger(unit) || unit <= 0) {
    return 'Enter a valid offer per item greater than zero.'
  }
  if (
    listingPricePence != null &&
    Number.isFinite(listingPricePence) &&
    unit > listingPricePence
  ) {
    return OFFER_EXCEEDS_ASKING_PRICE_ERROR
  }
  return null
}

export function validateBuyerOfferAmount(amountPence, listingPricePence, quantity = 1) {
  const unitAmountPence = getOfferUnitAmountPence(amountPence, quantity)

  if (unitAmountPence == null) {
    return 'The total offer must divide evenly by the selected quantity.'
  }

  if (
    listingPricePence != null &&
    Number.isFinite(listingPricePence) &&
    unitAmountPence > listingPricePence
  ) {
    return OFFER_EXCEEDS_ASKING_PRICE_ERROR
  }

  return null
}

export function formatPenceAsOfferInput(amountPence) {
  return (amountPence / 100).toFixed(2)
}
