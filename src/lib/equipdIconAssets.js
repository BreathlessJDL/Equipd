/**
 * PNG icon assets for Hub summary cards and notification/event types.
 * Source artwork: public/design-reference/
 */

export const EQUIPD_ICON_ASSETS = {
  buying: '/equipd-icons/buying-icon.png',
  selling: '/equipd-icons/selling-icon.png',
  orderInProgress: '/equipd-icons/order-in-progress-icon.png',
  buyerPayment: '/equipd-icons/buyer-payment-icon.png',
  collectionConfirmed: '/equipd-icons/collection-confirmed-icon.png',
}

export function getEquipdIconAssetSrc(key) {
  return EQUIPD_ICON_ASSETS[key] ?? null
}
