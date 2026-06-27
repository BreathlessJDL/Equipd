import { EQUIPD_ICON_VARIANT } from './equipdIconVariants'

/** Empty-state copy for Hub subsection tabs and panels. */
export const HUB_EMPTY_STATES = {
  buyingOffers: {
    variant: EQUIPD_ICON_VARIANT.BUYING_BAG,
    title: 'No pending offers',
    description: 'When you make an offer on a listing it will appear here while awaiting the seller’s response.',
    actionLabel: 'Browse equipment',
    actionTo: '/browse',
  },
  buyingAwaitingPayment: {
    variant: EQUIPD_ICON_VARIANT.PAYOUT_PAYMENT,
    title: 'Nothing awaiting payment',
    description: 'Accepted offers that still need payment will show up here.',
  },
  buyingInProgress: {
    variant: EQUIPD_ICON_VARIANT.COLLECTION_CONFIRMED,
    title: 'No purchases in progress',
    description: 'Orders you are waiting to collect or receive will appear here.',
  },
  buyingCompleted: {
    variant: EQUIPD_ICON_VARIANT.OFFER_ACCEPTED,
    title: 'No completed purchases',
    description: 'Finished purchases will be listed here for your records.',
  },
  buyingCancelled: {
    variant: EQUIPD_ICON_VARIANT.OFFER_DECLINED,
    title: 'No cancelled purchases',
    description: 'Withdrawn or declined offers and cancelled orders appear here.',
  },
  sellingOffers: {
    variant: EQUIPD_ICON_VARIANT.NEW_OFFER,
    title: 'No offers received',
    description: 'When buyers make offers on your listings they will appear here.',
    actionLabel: 'View your listings',
    actionTo: '/hub?section=listings&tab=active',
  },
  sellingAwaitingPayment: {
    variant: EQUIPD_ICON_VARIANT.PAYOUT_PAYMENT,
    title: 'Nothing awaiting payment',
    description: 'Accepted sales waiting for the buyer to pay will show here.',
  },
  sellingActive: {
    variant: EQUIPD_ICON_VARIANT.ITEM_DISPATCHED,
    title: 'No active sales',
    description: 'Sales in progress — collection, delivery, or confirmation — will appear here.',
  },
  sellingSold: {
    variant: EQUIPD_ICON_VARIANT.OFFER_ACCEPTED,
    title: 'No completed sales',
    description: 'Completed sales and archived sold listings will show here.',
  },
  sellingCancelled: {
    variant: EQUIPD_ICON_VARIANT.OFFER_DECLINED,
    title: 'No cancelled sales',
    description: 'Declined offers and cancelled sales will appear here.',
  },
  listingsActive: {
    variant: EQUIPD_ICON_VARIANT.MY_LISTINGS,
    title: 'No active listings',
    description: 'Live listings you are selling on Equipd will appear here.',
    actionLabel: 'Create a listing',
    actionTo: '/listings/new',
  },
  listingsDraft: {
    variant: EQUIPD_ICON_VARIANT.DRAFTS,
    title: 'No draft listings',
    description: 'Save a listing as a draft and finish it when you are ready to publish.',
    actionLabel: 'Create a listing',
    actionTo: '/listings/new',
  },
  listingsReserved: {
    variant: EQUIPD_ICON_VARIANT.COLLECTION_CONFIRMED,
    title: 'No reserved listings',
    description: 'Listings with accepted offers or active orders will show here.',
  },
  listingsSold: {
    variant: EQUIPD_ICON_VARIANT.OFFER_ACCEPTED,
    title: 'No sold listings',
    description: 'Listings marked as sold will be archived here.',
  },
  myOffers: {
    variant: EQUIPD_ICON_VARIANT.COUNTER_OFFER,
    title: 'No offers made yet',
    description: 'Make an offer on equipment you want to buy and track responses here.',
    actionLabel: 'Browse equipment',
    actionTo: '/browse',
  },
  ordersPurchasesInProgress: {
    variant: EQUIPD_ICON_VARIANT.COLLECTION_CONFIRMED,
    title: 'No purchases in progress',
    description: 'Orders you are waiting to collect or receive will appear here.',
  },
  ordersPurchasesCompleted: {
    variant: EQUIPD_ICON_VARIANT.OFFER_ACCEPTED,
    title: 'No completed purchases',
    description: 'Finished purchase orders will be listed here.',
  },
  ordersSalesInProgress: {
    variant: EQUIPD_ICON_VARIANT.ITEM_DISPATCHED,
    title: 'No sales in progress',
    description: 'Active sales you are fulfilling will show here.',
  },
  ordersSalesCompleted: {
    variant: EQUIPD_ICON_VARIANT.OFFER_ACCEPTED,
    title: 'No completed sales',
    description: 'Finished sales orders will be listed here.',
  },
  saved: {
    variant: EQUIPD_ICON_VARIANT.SAVED_HEART,
    title: 'No saved listings',
    description: 'Save equipment you like while browsing and come back to it later.',
    actionLabel: 'Browse equipment',
    actionTo: '/browse',
  },
  reviewsReceived: {
    variant: EQUIPD_ICON_VARIANT.REVIEW_RECEIVED,
    title: 'No reviews received',
    description: 'Feedback from buyers and sellers after completed orders will appear here.',
  },
  reviewsLeft: {
    variant: EQUIPD_ICON_VARIANT.REVIEW_RECEIVED,
    title: 'No reviews left',
    description: 'Reviews you leave after completed orders will show here.',
  },
  reviewsPending: {
    variant: EQUIPD_ICON_VARIANT.REVIEW_RECEIVED,
    title: 'No reviews pending',
    description: 'Completed orders waiting for your feedback will appear here.',
  },
  summaryAttention: {
    variant: EQUIPD_ICON_VARIANT.OFFER_ACCEPTED,
    title: 'All caught up',
    description: 'Nothing needs your attention right now.',
  },
}
