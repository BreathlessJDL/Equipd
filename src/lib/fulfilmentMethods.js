import { inferDeliveryOptionsFromListing } from './listings'
import { ORDER_TYPES } from './orders'
import {
  evaluateSellerDeliveryAvailability,
  getSellerDeliveryDisabledReason,
  listingOffersSellerDelivery,
  SELLER_DELIVERY_UNAVAILABLE_COPY,
} from './sellerDeliveryRadius'

export const FULFILMENT_OPTION_TO_ORDER_TYPE = {
  collection: ORDER_TYPES.COLLECTION,
  buyer_courier: ORDER_TYPES.BUYER_COURIER,
  seller_delivery: ORDER_TYPES.SELLER_DELIVERY,
}

export const FULFILMENT_METHOD_LABELS = {
  [ORDER_TYPES.COLLECTION]: 'Collection',
  [ORDER_TYPES.BUYER_COURIER]: 'Buyer courier',
  [ORDER_TYPES.SELLER_DELIVERY]: 'Seller delivery',
}

export const FULFILMENT_METHOD_DESCRIPTIONS = {
  [ORDER_TYPES.COLLECTION]: 'Pick up from the seller',
  [ORDER_TYPES.SELLER_DELIVERY]: 'Seller delivers to you',
  [ORDER_TYPES.BUYER_COURIER]: 'Arrange your own courier',
}

function isListingOwner(listing, viewerUserId) {
  return Boolean(viewerUserId && listing?.seller_id && listing.seller_id === viewerUserId)
}

function buildSellerDeliveryOption(listing, buyerProfile, { forBuyerSelection = false } = {}) {
  let evaluation

  try {
    evaluation = evaluateSellerDeliveryAvailability(listing, buyerProfile)
  } catch (error) {
    console.error('[fulfilment] evaluateSellerDeliveryAvailability failed', error)

    if (!listingOffersSellerDelivery(listing)) {
      return null
    }

    return {
      orderType: ORDER_TYPES.SELLER_DELIVERY,
      label: FULFILMENT_METHOD_LABELS[ORDER_TYPES.SELLER_DELIVERY],
      disabled: true,
      disabledReason: SELLER_DELIVERY_UNAVAILABLE_COPY,
    }
  }

  if (!evaluation.offered) {
    return null
  }

  if (!forBuyerSelection) {
    return {
      orderType: ORDER_TYPES.SELLER_DELIVERY,
      label: FULFILMENT_METHOD_LABELS[ORDER_TYPES.SELLER_DELIVERY],
      disabled: false,
    }
  }

  if (evaluation.available) {
    return {
      orderType: ORDER_TYPES.SELLER_DELIVERY,
      label: FULFILMENT_METHOD_LABELS[ORDER_TYPES.SELLER_DELIVERY],
      disabled: false,
    }
  }

  return {
    orderType: ORDER_TYPES.SELLER_DELIVERY,
    label: FULFILMENT_METHOD_LABELS[ORDER_TYPES.SELLER_DELIVERY],
    disabled: true,
    disabledReason: getSellerDeliveryDisabledReason(evaluation),
  }
}

export function getAvailableFulfilmentMethods(listing, context = {}) {
  if (!listing) return []

  try {
    const optionIds = inferDeliveryOptionsFromListing(listing)
    const { buyerProfile, viewerUserId, forBuyerSelection = false } = context
    const ownerViewingListing = isListingOwner(listing, viewerUserId) && !forBuyerSelection

    return optionIds
      .map((optionId) => FULFILMENT_OPTION_TO_ORDER_TYPE[optionId])
      .filter(Boolean)
      .filter((orderType) => {
        if (orderType !== ORDER_TYPES.SELLER_DELIVERY) return true
        if (ownerViewingListing) return true
        if (!forBuyerSelection) return listingOffersSellerDelivery(listing)

        try {
          return evaluateSellerDeliveryAvailability(listing, buyerProfile).available
        } catch (error) {
          console.error('[fulfilment] seller delivery availability check failed', error)
          return false
        }
      })
  } catch (error) {
    console.error('[fulfilment] getAvailableFulfilmentMethods failed', error)
    return []
  }
}

export function getAvailableFulfilmentMethodOptions(listing, context = {}) {
  if (!listing) return []

  try {
    const optionIds = inferDeliveryOptionsFromListing(listing)
    const { buyerProfile, forBuyerSelection = false } = context

    return optionIds
      .map((optionId) => {
        const orderType = FULFILMENT_OPTION_TO_ORDER_TYPE[optionId]
        if (!orderType) return null

        if (orderType === ORDER_TYPES.SELLER_DELIVERY) {
          return buildSellerDeliveryOption(listing, buyerProfile, { forBuyerSelection })
        }

        return {
          orderType,
          label: FULFILMENT_METHOD_LABELS[orderType] ?? orderType,
          disabled: false,
        }
      })
      .filter(Boolean)
  } catch (error) {
    console.error('[fulfilment] getAvailableFulfilmentMethodOptions failed', error)
    return []
  }
}

export function listingRequiresFulfilmentSelection(listing, context = {}) {
  const selectable = getAvailableFulfilmentMethodOptions(listing, {
    ...context,
    forBuyerSelection: true,
  }).filter((option) => !option.disabled)

  return selectable.length > 1
}

export function getAutoFulfilmentMethod(listing, context = {}) {
  const methods = getAvailableFulfilmentMethods(listing, {
    ...context,
    forBuyerSelection: true,
  })

  return methods.length === 1 ? methods[0] : null
}

export function isValidFulfilmentMethodForListing(listing, orderType, context = {}) {
  if (!orderType || !listing) return false

  const offeredOrderTypes = inferDeliveryOptionsFromListing(listing)
    .map((optionId) => FULFILMENT_OPTION_TO_ORDER_TYPE[optionId])
    .filter(Boolean)

  if (!offeredOrderTypes.includes(orderType)) {
    return false
  }

  if (orderType !== ORDER_TYPES.SELLER_DELIVERY) {
    return true
  }

  if (!listingOffersSellerDelivery(listing)) {
    return false
  }

  const { buyerProfile, persistedOrderType = null } = context

  if (persistedOrderType === ORDER_TYPES.SELLER_DELIVERY) {
    return true
  }

  try {
    return evaluateSellerDeliveryAvailability(listing, buyerProfile).available
  } catch (error) {
    console.error('[fulfilment] isValidFulfilmentMethodForListing seller delivery check failed', error)
    return true
  }
}

export function orderNeedsFulfilmentSelection(order, listing, context = {}) {
  if (order?.order_type) return false
  return listingRequiresFulfilmentSelection(listing, context)
}

export function getFulfilmentMethodErrorMessage(error) {
  if (!error) return 'Something went wrong. Please try again.'

  const message = error.message ?? ''

  if (
    message.includes('Seller delivery is not available')
    || message.includes('not available for your location')
  ) {
    return 'Seller delivery is unavailable for your location.'
  }

  if (message.includes('Add your location before selecting seller delivery')) {
    return 'Add your location to check seller delivery.'
  }

  return error.message || 'Something went wrong. Please try again.'
}
