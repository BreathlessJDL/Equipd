import {
  getAutoFulfilmentMethod,
  isValidFulfilmentMethodForListing,
  listingRequiresFulfilmentSelection,
} from './fulfilmentMethods'
import { getOfferOrder, setOrderFulfilmentMethod } from './orders'
import { createCheckoutSession, getStripeApiErrorMessage } from './stripe-api'

export async function startCheckoutForAcceptedOffer({
  payment,
  listing,
  offer,
  selectedOrderType = null,
  buyerProfile = null,
}) {
  if (!payment?.id) {
    return { url: null, error: new Error('Payment is not ready for checkout.') }
  }

  const order = getOfferOrder(offer)
  const persistedOrderType = order?.order_type ?? null
  const orderType =
    selectedOrderType ?? persistedOrderType ?? getAutoFulfilmentMethod(listing, { buyerProfile })

  if (!orderType && listingRequiresFulfilmentSelection(listing)) {
    return {
      url: null,
      error: new Error('Select how you will receive this item before paying.'),
    }
  }

  if (!orderType) {
    return {
      url: null,
      error: new Error('Select how you will receive this item before paying.'),
    }
  }

  if (!isValidFulfilmentMethodForListing(listing, orderType, { buyerProfile })) {
    return {
      url: null,
      error: new Error('Selected fulfilment method is not available for this listing.'),
    }
  }

  const needsPersist = !persistedOrderType || orderType !== persistedOrderType
  if (needsPersist) {
    const { error: setMethodError } = await setOrderFulfilmentMethod(payment.id, orderType)

    if (setMethodError) {
      return { url: null, error: setMethodError }
    }
  }

  const { url, error } = await createCheckoutSession(payment.id)

  if (error) {
    return { url: null, error }
  }

  if (!url) {
    return { url: null, error: new Error('Could not start checkout.') }
  }

  return { url, error: null }
}

export function getCheckoutErrorMessage(error) {
  return getStripeApiErrorMessage(error)
}
