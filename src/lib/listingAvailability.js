/**
 * Stage 3 display-only availability.
 *
 * Returns the publicly displayable available quantity, or null when no
 * availability line should be shown. Fail-safe: a missing or malformed
 * quantity field never advertises stock, and quantity-1 listings render
 * exactly as before.
 */
export function getDisplayableAvailableQuantity(listing) {
  const available = Number(listing?.quantity_available)

  if (!Number.isSafeInteger(available) || available <= 1) {
    return null
  }

  return available
}
