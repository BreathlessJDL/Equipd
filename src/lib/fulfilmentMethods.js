import { inferDeliveryOptionsFromListing } from './listings'
import { ORDER_TYPES } from './orders'

export const FULFILMENT_OPTION_TO_ORDER_TYPE = {
  collection: ORDER_TYPES.COLLECTION,
  buyer_courier: ORDER_TYPES.BUYER_COURIER,
  seller_delivery: ORDER_TYPES.SELLER_DELIVERY,
}

export const FULFILMENT_METHOD_LABELS = {
  [ORDER_TYPES.COLLECTION]: 'I will collect this item',
  [ORDER_TYPES.BUYER_COURIER]: 'I will arrange a courier / collection service',
  [ORDER_TYPES.SELLER_DELIVERY]: 'Seller will deliver this item',
}

function isListingOwner(listing, viewerUserId) {
  return Boolean(viewerUserId && listing?.seller_id && listing.seller_id === viewerUserId)
}

function buildSellerDeliveryOption(listing, buyerProfile, { forBuyerSelection = false } = {}) {
  const evaluation = evaluateSellerDeliveryAvailability(listing, buyerProfile)

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

      return evaluateSellerDeliveryAvailability(listing, buyerProfile).available
    })
}

export function getAvailableFulfilmentMethodOptions(listing, context = {}) {
  if (!listing) return []

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
  if (!orderType) return false

  return getAvailableFulfilmentMethods(listing, {
    ...context,
    forBuyerSelection: true,
  }).includes(orderType)
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
