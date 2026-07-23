/**
 * Build one Google Merchant product entry from an eligible listing.
 */

import { classifyMerchantListingEligibility } from './merchantEligibility.js'
import {
  buildMerchantExternalSellerId,
  buildMerchantProductId,
} from './merchantFeedIdentity.js'
import { buildMerchantPriceFields } from './merchantFeedPrice.js'
import {
  buildMerchantFeedDescription,
  buildMerchantFeedTitle,
  mapListingConditionToMerchant,
} from './merchantFeedContent.js'
import {
  buildMerchantProductType,
  mapGoogleProductCategory,
} from './merchantFeedCategories.js'

/**
 * @returns {object|null} Feed item fields, or null when ineligible
 */
export function buildMerchantFeedItem(listing, {
  equipmentProduct = null,
  sellerProfile = null,
} = {}) {
  const classification = classifyMerchantListingEligibility(listing, { equipmentProduct })
  if (!classification.eligible) {
    return {
      eligible: false,
      reasons: classification.reasons,
      item: null,
      classification,
    }
  }

  const id = buildMerchantProductId(listing)
  const externalSellerId = buildMerchantExternalSellerId(listing)
  const priceFields = buildMerchantPriceFields(listing)
  if (!id || !externalSellerId || !priceFields) {
    return {
      eligible: false,
      reasons: classification.reasons.concat(['build_failed']),
      item: null,
      classification,
    }
  }

  const images = classification.images
  const item = {
    id,
    title: buildMerchantFeedTitle(listing, equipmentProduct),
    description: buildMerchantFeedDescription(listing, equipmentProduct),
    link: classification.canonicalUrl,
    image_link: images[0],
    additional_image_link: images.slice(1, 10),
    availability: 'in_stock',
    price: priceFields.price,
    condition: mapListingConditionToMerchant(listing.condition),
    brand: classification.identifierDecision.brand || undefined,
    gtin: classification.identifierDecision.gtin || undefined,
    mpn: classification.identifierDecision.mpn || undefined,
    identifier_exists: classification.identifierDecision.identifierExists || undefined,
    google_product_category: mapGoogleProductCategory(listing, equipmentProduct),
    product_type: buildMerchantProductType(listing, equipmentProduct),
    shipping: {
      country: 'GB',
      price: priceFields.shippingPrice,
    },
    shipping_label: classification.fulfilment.shippingLabel,
    adult: 'no',
    external_seller_id: externalSellerId,
    custom_label_0: classification.fulfilment.mode,
    custom_label_1: classification.identifierDecision.decision,
    // Internal diagnostics (stripped before XML)
    _meta: {
      listingId: listing.id,
      slug: listing.slug,
      itemPricePence: priceFields.itemPricePence,
      buyerProtectionFeePence: priceFields.buyerProtectionFeePence,
      buyerTotalPence: priceFields.buyerTotalPence,
      sellerUsername: sellerProfile?.username || null,
    },
  }

  return {
    eligible: true,
    reasons: [],
    item,
    classification,
  }
}

export function stripMerchantFeedItemPrivateMeta(item) {
  if (!item) return null
  const { _meta, ...publicItem } = item
  return publicItem
}
