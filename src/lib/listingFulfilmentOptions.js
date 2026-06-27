/** Persisted in delivery_notes when in-person collection is enabled. */
export const FULFILMENT_COLLECTION_MARKER = 'In-person collection available'

/** Persisted in delivery_notes when seller delivery is enabled. */
export const FULFILMENT_SELLER_DELIVERY_MARKER = 'Seller can personally deliver'

/** Persisted in delivery_notes when buyer-arranged courier is enabled. */
export const FULFILMENT_BUYER_COURIER_MARKER =
  'Buyer can arrange a courier or collection service'

export const LISTING_DELIVERY_OPTION_IDS = [
  'collection',
  'seller_delivery',
  'buyer_courier',
]

export function buildDeliveryFields(form) {
  const options = form.deliveryOptions ?? []
  const hasCollection = options.includes('collection')
  const hasSellerDelivery = options.includes('seller_delivery')
  const hasBuyerCourier = options.includes('buyer_courier')
  const notes = []

  if (hasCollection) {
    notes.push(FULFILMENT_COLLECTION_MARKER)
  }

  if (hasSellerDelivery) {
    notes.push(FULFILMENT_SELLER_DELIVERY_MARKER)
  }

  if (hasBuyerCourier) {
    notes.push(FULFILMENT_BUYER_COURIER_MARKER)
  }

  if (form.deliveryNotes?.trim()) {
    notes.push(form.deliveryNotes.trim())
  }

  return {
    collection_available: hasCollection || hasBuyerCourier,
    courier_available: hasSellerDelivery || hasBuyerCourier,
    delivery_notes: notes.length ? notes.join('. ') : null,
  }
}

export function inferDeliveryOptionsFromListing(listing) {
  const notes = listing.delivery_notes?.toLowerCase() ?? ''
  const opts = []

  const hasCollectionMarker = notes.includes(FULFILMENT_COLLECTION_MARKER.toLowerCase())
  const hasBuyerCourierMarker = notes.includes('buyer can arrange')
  const hasSellerDeliveryMarker =
    notes.includes('seller delivery') ||
    notes.includes('seller can personally') ||
    (listing.seller_delivery_radius_miles != null &&
      Number(listing.seller_delivery_radius_miles) > 0)

  if (hasBuyerCourierMarker) {
    opts.push('buyer_courier')
  }

  if (hasSellerDeliveryMarker) {
    opts.push('seller_delivery')
  }

  if (hasCollectionMarker) {
    opts.push('collection')
  } else if (listing.collection_available !== false) {
    // Legacy listings saved before explicit collection marker
    if (!listing.courier_available) {
      opts.push('collection')
    } else if (
      listing.courier_available &&
      hasSellerDeliveryMarker &&
      !hasBuyerCourierMarker
    ) {
      // collection + seller delivery (both flags true, no buyer courier)
      opts.push('collection')
    }
  }

  if (opts.length === 0 && listing.courier_available) {
    opts.push('buyer_courier')
  }

  return [...new Set(opts)]
}
