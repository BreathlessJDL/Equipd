/** Shared visual variants for Equipd outlined icons (Hub + Notifications). */
export const EQUIPD_ICON_VARIANT = {
  NEW_OFFER: 'new-offer',
  COUNTER_OFFER: 'counter-offer',
  OFFER_ACCEPTED: 'offer-accepted',
  OFFER_DECLINED: 'offer-declined',
  COLLECTION_CONFIRMED: 'collection-confirmed',
  ITEM_DISPATCHED: 'item-dispatched',
  DELIVERY_CONFIRMED: 'delivery-confirmed',
  PAYOUT_PAYMENT: 'payout-payment',
  SUPPORT_DISPUTE: 'support-dispute',
  REVIEW_RECEIVED: 'review-received',
  SELLING_STORE: 'selling-store',
  SELLING_HAND_COINS: 'selling-hand-coins',
  MY_LISTINGS: 'my-listings',
  BUYING_BAG: 'buying-bag',
  SAVED_HEART: 'saved-heart',
  MESSAGES: 'messages',
  SETTINGS: 'settings',
  DRAFTS: 'drafts',
  DEFAULT: 'default',
}

export const HUB_SUMMARY_ICON_VARIANT = {
  buying: EQUIPD_ICON_VARIANT.BUYING_BAG,
  selling: EQUIPD_ICON_VARIANT.SELLING_HAND_COINS,
  'active-listings': EQUIPD_ICON_VARIANT.MY_LISTINGS,
  'offers-received': EQUIPD_ICON_VARIANT.NEW_OFFER,
  'offers-made': EQUIPD_ICON_VARIANT.COUNTER_OFFER,
  'orders-in-progress': EQUIPD_ICON_VARIANT.COLLECTION_CONFIRMED,
  'sales-in-progress': EQUIPD_ICON_VARIANT.ITEM_DISPATCHED,
  'saved-listings': EQUIPD_ICON_VARIANT.SAVED_HEART,
}

export const HUB_ATTENTION_ICON_VARIANT = {
  'offers-received': EQUIPD_ICON_VARIANT.NEW_OFFER,
  'buyer-pay': EQUIPD_ICON_VARIANT.PAYOUT_PAYMENT,
  'seller-awaiting-pay': EQUIPD_ICON_VARIANT.PAYOUT_PAYMENT,
  'buyer-collection': EQUIPD_ICON_VARIANT.COLLECTION_CONFIRMED,
  'courier-evidence': EQUIPD_ICON_VARIANT.ITEM_DISPATCHED,
  disputes: EQUIPD_ICON_VARIANT.SUPPORT_DISPUTE,
  'payout-setup': EQUIPD_ICON_VARIANT.PAYOUT_PAYMENT,
  'pending-reviews': EQUIPD_ICON_VARIANT.REVIEW_RECEIVED,
}
