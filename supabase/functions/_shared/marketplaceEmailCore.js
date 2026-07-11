import { appUrl, detailRowsHtml, normalizeEmailSubject } from './emailFormatting.js'
import { enrichDynamicData, isDryRunMode, sendTransactionalEmail } from './transactionalEmailCore.js'
import { isEmailTemplateKey } from './emailTemplateConfig.js'
import {
  PHASE5_ACCOUNT_EMAIL_EVENT_KEYS,
  PHASE5_CASE_EMAIL_EVENT_KEYS,
  PHASE5_DUAL_RECIPIENT_EVENT_KEYS,
  PHASE5_ORDER_EMAIL_EVENT_KEYS,
  buildPhase5IdempotencyKey,
  composeCaseClosedNoRefundDynamicData,
  composeCollectionArrangedDynamicData,
  composeDisputeOpenedDynamicData,
  composeEmailChangedDynamicData,
  composeEvidenceRequestedDynamicData,
  composePasswordChangedDynamicData,
  composePayoutReleasedDynamicData,
  composePhase5EmailSubject,
  composeRefundCompletedCaseClosedDynamicData,
  composeRefundPendingDynamicData,
  composeReturnAuthorisedDynamicData,
  composeReviewAvailableDynamicData,
  composeReviewReceivedDynamicData,
  composeSellerOnboardingRequiredDynamicData,
  composeWelcomeDynamicData,
} from './marketplaceEmailComposePhase5.js'

const SELLER_SERVICE_FEE_RATE = 0.02

function calculateSellerServiceFee(itemPricePence) {
  if (!itemPricePence || itemPricePence <= 0) {
    return 0
  }

  return Math.round(itemPricePence * SELLER_SERVICE_FEE_RATE)
}

function calculateSellerNetPayout(itemPricePence) {
  if (!itemPricePence || itemPricePence <= 0) {
    return 0
  }

  return Math.max(0, itemPricePence - calculateSellerServiceFee(itemPricePence))
}

const BUYER_PROTECTION_FEE_MIN_PENCE = 500
const BUYER_PROTECTION_FEE_MAX_PENCE = 25000
const BUYER_PROTECTION_FEE_RATE = 0.05

function calculateBuyerProtectionFee(itemPricePence) {
  if (!itemPricePence || itemPricePence <= 0) {
    return 0
  }

  const rawFee = Math.round(itemPricePence * BUYER_PROTECTION_FEE_RATE)

  return Math.min(
    BUYER_PROTECTION_FEE_MAX_PENCE,
    Math.max(BUYER_PROTECTION_FEE_MIN_PENCE, rawFee),
  )
}

export const MARKETPLACE_EMAIL_EVENT_KEYS = [
  'offer_received',
  'counter_offer_received',
  'offer_accepted',
  'payment_successful',
  'new_order_received',
  'buyer_delivery_details_added',
  'collection_confirmed',
  'courier_dispatched',
  'delivery_confirmed',
  'buyer_protection_started',
  'dispute_opened',
  'evidence_requested',
  'return_authorised',
  'collection_arranged',
  'refund_pending',
  'refund_completed_case_closed',
  'case_closed_no_refund',
  'review_available',
  'review_received',
  'payout_released',
  'seller_onboarding_required',
  'welcome',
  'email_changed',
  'password_changed',
]

const FULFILMENT_ORDER_EVENT_KEYS = new Set([
  'buyer_delivery_details_added',
  'collection_confirmed',
  'courier_dispatched',
  'delivery_confirmed',
  'buyer_protection_started',
])

const DUAL_RECIPIENT_EVENT_KEYS = new Set([
  'collection_confirmed',
  'delivery_confirmed',
  ...PHASE5_DUAL_RECIPIENT_EVENT_KEYS,
])

const PAYMENT_DEADLINE_LABEL = '48 hours'

const SELLER_ONLY_DYNAMIC_KEYS = new Set([
  'seller_service_fee',
  'seller_net_payout',
])

function readPayloadId(payload, camelKey, snakeKey) {
  const value = payload?.[camelKey] ?? payload?.[snakeKey]
  if (value === undefined || value === null) {
    return undefined
  }

  const trimmed = String(value).trim()
  return trimmed || undefined
}

/** Accept camelCase or snake_case IDs from pg_net payloads and Edge Function callers. */
export function normalizeMarketplaceEmailPayload(payload = {}) {
  return {
    ...payload,
    offerId: readPayloadId(payload, 'offerId', 'offer_id'),
    orderId: readPayloadId(payload, 'orderId', 'order_id'),
    paymentId: readPayloadId(payload, 'paymentId', 'payment_id'),
    listingId: readPayloadId(payload, 'listingId', 'listing_id'),
    recipientRole: readPayloadId(payload, 'recipientRole', 'recipient_role'),
    disputeId: readPayloadId(payload, 'disputeId', 'dispute_id'),
    caseUpdateId: readPayloadId(payload, 'caseUpdateId', 'case_update_id'),
    reviewId: readPayloadId(payload, 'reviewId', 'review_id'),
    userId: readPayloadId(payload, 'userId', 'user_id'),
    newEmail: readPayloadId(payload, 'newEmail', 'new_email'),
    collectionDate: readPayloadId(payload, 'collectionDate', 'collection_date'),
    changedAt: readPayloadId(payload, 'changedAt', 'changed_at'),
  }
}

async function resolveOrderIdForPayload(admin, payload) {
  const normalized = normalizeMarketplaceEmailPayload(payload)
  if (normalized.orderId) {
    return normalized.orderId
  }

  if (!normalized.paymentId || !admin) {
    return undefined
  }

  const { data, error } = await admin
    .from('orders')
    .select('id')
    .eq('payment_id', normalized.paymentId)
    .maybeSingle()

  if (error) {
    return undefined
  }

  return data?.id
}

export function buildMarketplaceEmailIdempotencyKey(eventKey, parts) {
  switch (eventKey) {
    case 'offer_received':
      return `offer_received:${parts.offerId}:${parts.sellerId}`
    case 'counter_offer_received':
      return `counter_offer_received:${parts.offerId}:${parts.recipientUserId}`
    case 'offer_accepted':
      return `offer_accepted:${parts.offerId}:${parts.recipientUserId}`
    case 'payment_successful':
      return `payment_successful:${parts.orderId}:${parts.buyerId}`
    case 'new_order_received':
      return `new_order_received:${parts.orderId}:${parts.sellerId}`
    case 'buyer_delivery_details_added':
      return `buyer_delivery_details_added:${parts.orderId}:${parts.sellerId}`
    case 'collection_confirmed':
      return `collection_confirmed:${parts.orderId}:${parts.recipientUserId}`
    case 'courier_dispatched':
      return `courier_dispatched:${parts.orderId}:${parts.buyerId}`
    case 'delivery_confirmed':
      return `delivery_confirmed:${parts.orderId}:${parts.recipientUserId}`
    case 'buyer_protection_started':
      return `buyer_protection_started:${parts.orderId}:${parts.buyerId}`
    default:
      return buildPhase5IdempotencyKey(eventKey, parts)
  }
}

export function formatOrderReference(orderId) {
  if (!orderId) return ''
  return String(orderId).replace(/-/g, '').slice(0, 8).toUpperCase()
}

export function formatProtectionEndsAt(isoDate) {
  if (!isoDate) return '—'

  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Europe/London',
  }).format(new Date(isoDate))
}

function fulfilmentLabelForOrderType(orderType) {
  return orderType === 'seller_delivery' ? 'handover' : 'collection'
}

function fulfilmentLabelTitleCase(orderType) {
  return orderType === 'seller_delivery' ? 'Handover' : 'Collection'
}

export function formatPricePence(pence) {
  if (pence == null || Number.isNaN(Number(pence))) {
    return '—'
  }

  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(pence) / 100)
}

export function getMarketplaceUserName(profile, { email, fallback = 'Equipd member' } = {}) {
  const username = profile?.username?.trim()
  if (username) {
    return username
  }

  const displayName = profile?.display_name?.trim()
  if (displayName) {
    return displayName
  }

  const emailValue = email ?? profile?.email
  const emailPrefix = emailValue?.split('@')[0]?.trim()
  if (emailPrefix) {
    return emailPrefix
  }

  return fallback
}

/** @deprecated Use getMarketplaceUserName */
export function getProfileDisplayName(profile, fallback = 'Equipd member') {
  return getMarketplaceUserName(profile, { fallback })
}

/** Greeting / recipient_first_name uses the same identity priority as buyer_name / seller_name. */
export function getMarketplaceRecipientName(profile, options = {}) {
  return getMarketplaceUserName(profile, options)
}

export function assertBuyerEmailSafe(dynamicData) {
  for (const key of SELLER_ONLY_DYNAMIC_KEYS) {
    if (dynamicData[key] !== undefined) {
      throw new Error(`Buyer email dynamic data must not include ${key}`)
    }
  }

  const body = String(dynamicData.body ?? '')
  const forbidden = /seller service fee|you'll receive|seller_net_payout|seller payout/i
  if (forbidden.test(body)) {
    throw new Error('Buyer email body must not mention seller fee or payout')
  }
}

function layoutFields(baseUrl, fields) {
  const subject = fields.subject ? normalizeEmailSubject(fields.subject) : fields.subject

  return {
    tagline: 'The UK marketplace for used gym equipment.',
    secondary_text: 'Visit the Help Centre',
    secondary_url: appUrl(baseUrl, '/help'),
    ...fields,
    ...(subject ? { subject } : {}),
  }
}

export function composeMarketplaceEmailSubject(eventKey, listingTitle, { recipientRole, orderType } = {}) {
  const title = listingTitle?.trim() || 'your listing'
  const itemTitle = listingTitle?.trim() || 'your item'

  switch (eventKey) {
    case 'offer_received':
      return normalizeEmailSubject(`You have a new offer on ${title}`)
    case 'counter_offer_received':
      return normalizeEmailSubject(`New counter offer on ${title}`)
    case 'offer_accepted':
      if (recipientRole === 'seller') {
        return normalizeEmailSubject(`Your counter offer on ${title} was accepted`)
      }
      return normalizeEmailSubject(`Your offer on ${title} was accepted`)
    case 'payment_successful':
      return normalizeEmailSubject(`Payment confirmed for ${title}`)
    case 'new_order_received':
      return normalizeEmailSubject(`You've sold ${title}`)
    case 'buyer_delivery_details_added':
      return `Delivery details added for ${title}`
    case 'collection_confirmed': {
      const label = fulfilmentLabelTitleCase(orderType)
      if (recipientRole === 'buyer') {
        return `You confirmed ${label.toLowerCase()} for ${itemTitle}`
      }
      return `${label} confirmed for ${itemTitle}`
    }
    case 'courier_dispatched':
      return `${itemTitle} is on its way`
    case 'delivery_confirmed':
      if (recipientRole === 'buyer') {
        return `You confirmed delivery for ${itemTitle}`
      }
      return `Delivery confirmed for ${itemTitle}`
    case 'buyer_protection_started':
      return `Buyer Protection started for ${itemTitle}`
    default:
      return composePhase5EmailSubject(eventKey, listingTitle, { recipientRole, orderType })
  }
}

export function composeOfferReceivedDynamicData({ baseUrl, offer, listing, buyerProfile, sellerProfile }) {
  const buyerName = getMarketplaceUserName(buyerProfile, { fallback: 'A buyer' })
  const listingTitle = listing?.title?.trim() || 'your listing'
  const offerAmount = formatPricePence(offer.amount_pence)
  const listingPrice = formatPricePence(listing?.price_pence)
  const recipientFirstName = getMarketplaceRecipientName(sellerProfile, { fallback: 'there' })

  const body = `
    <p>Hi ${recipientFirstName},</p>
    <p><strong>${buyerName}</strong> has made an offer on <strong>${listingTitle}</strong>.</p>
    ${detailRowsHtml({
      Offer: offerAmount,
      'Asking price': listingPrice,
      Buyer: buyerName,
    })}
    <p>You can accept, decline, or counter in My Hub. Offers are not binding until you accept.</p>
  `.trim()

  return layoutFields(baseUrl, {
    subject: composeMarketplaceEmailSubject('offer_received', listingTitle),
    preheader: `${buyerName} offered ${offerAmount} on your ${listingTitle} listing.`,
    title: 'New offer on your listing',
    subtitle: 'Review and respond when you are ready.',
    body,
    cta_text: 'View offer',
    cta_url: appUrl(baseUrl, '/hub?section=selling&tab=offers'),
    recipient_first_name: recipientFirstName,
    buyer_name: buyerName,
    listing_title: listingTitle,
    offer_amount: offerAmount,
    listing_price: listingPrice,
    offer_id: offer.id,
  })
}

export function composeCounterOfferReceivedDynamicData({
  baseUrl,
  offer,
  listing,
  buyerProfile,
  sellerProfile,
}) {
  const listingTitle = listing?.title?.trim() || 'your listing'
  const offerAmount = formatPricePence(offer.amount_pence)
  const listingPrice = formatPricePence(listing?.price_pence)
  const isSellerCounter = offer.direction === 'seller_to_buyer'
  const senderProfile = isSellerCounter ? sellerProfile : buyerProfile
  const recipientProfile = isSellerCounter ? buyerProfile : sellerProfile
  const senderName = getMarketplaceUserName(senderProfile, {
    fallback: isSellerCounter ? 'The seller' : 'A buyer',
  })
  const recipientFirstName = getMarketplaceRecipientName(recipientProfile, { fallback: 'there' })
  const hubPath = isSellerCounter
    ? `/hub?section=offers&offerId=${offer.id}`
    : `/hub?section=selling&tab=offers&offerId=${offer.id}`

  const body = `
    <p>Hi ${recipientFirstName},</p>
    <p><strong>${senderName}</strong> sent a counter offer on <strong>${listingTitle}</strong>.</p>
    ${detailRowsHtml({
      'Counter offer': offerAmount,
      'Asking price': listingPrice,
      From: senderName,
    })}
    <p>Review the counter offer in My Hub to accept, decline, or respond.</p>
  `.trim()

  return layoutFields(baseUrl, {
    subject: composeMarketplaceEmailSubject('counter_offer_received', listingTitle),
    preheader: `${senderName} countered with ${offerAmount} on ${listingTitle}.`,
    title: 'New counter offer',
    subtitle: 'Review and respond when you are ready.',
    body,
    cta_text: 'View counter offer',
    cta_url: appUrl(baseUrl, hubPath),
    recipient_first_name: recipientFirstName,
    sender_name: senderName,
    listing_title: listingTitle,
    offer_amount: offerAmount,
    listing_price: listingPrice,
    offer_id: offer.id,
  })
}

export function composeOfferAcceptedDynamicData({ baseUrl, offer, listing, buyerProfile, sellerProfile }) {
  const sellerName = getMarketplaceUserName(sellerProfile, { fallback: 'The seller' })
  const listingTitle = listing?.title?.trim() || 'your listing'
  const offerAmount = formatPricePence(offer.amount_pence)
  const buyerProtectionFeePence = calculateBuyerProtectionFee(offer.amount_pence)
  const buyerProtectionFee = formatPricePence(buyerProtectionFeePence)
  const buyerTotal = formatPricePence(offer.amount_pence + buyerProtectionFeePence)
  const recipientFirstName = getMarketplaceRecipientName(buyerProfile, { fallback: 'there' })
  const subject = composeMarketplaceEmailSubject('offer_accepted', listingTitle, {
    recipientRole: 'buyer',
  })

  const body = `
    <p>Hi ${recipientFirstName},</p>
    <p>The seller accepted your offer on <strong>${listingTitle}</strong>.</p>
    ${detailRowsHtml({
      'Your offer': offerAmount,
      'Buyer Protection fee': buyerProtectionFee,
      'Total to pay': buyerTotal,
      Seller: sellerName,
      'Pay within': PAYMENT_DEADLINE_LABEL,
    })}
    <p>Complete payment to secure the item. If payment is not completed in time, the offer may be cancelled.</p>
  `.trim()

  const dynamicData = layoutFields(baseUrl, {
    subject,
    preheader: `The seller accepted your ${offerAmount} offer on ${listingTitle}. Pay within ${PAYMENT_DEADLINE_LABEL}.`,
    title: 'Your offer was accepted',
    subtitle: 'Complete payment to secure your purchase.',
    body,
    cta_text: 'Complete payment',
    cta_url: appUrl(baseUrl, '/hub?section=buying&tab=awaiting_payment'),
    recipient_first_name: recipientFirstName,
    seller_name: sellerName,
    listing_title: listingTitle,
    offer_amount: offerAmount,
    payment_deadline: PAYMENT_DEADLINE_LABEL,
    offer_id: offer.id,
  })

  assertBuyerEmailSafe(dynamicData)

  return dynamicData
}

export function composeCounterOfferAcceptedSellerDynamicData({
  baseUrl,
  offer,
  listing,
  buyerProfile,
  sellerProfile,
}) {
  const buyerName = getMarketplaceUserName(buyerProfile, { fallback: 'The buyer' })
  const listingTitle = listing?.title?.trim() || 'your listing'
  const offerAmount = formatPricePence(offer.amount_pence)
  const sellerServiceFeePence = calculateSellerServiceFee(offer.amount_pence)
  const sellerNetPence = calculateSellerNetPayout(offer.amount_pence)
  const sellerServiceFee = formatPricePence(sellerServiceFeePence)
  const sellerNetPayout = formatPricePence(sellerNetPence)
  const recipientFirstName = getMarketplaceRecipientName(sellerProfile, { fallback: 'there' })
  const subject = composeMarketplaceEmailSubject('offer_accepted', listingTitle, {
    recipientRole: 'seller',
  })

  const body = `
    <p>Hi ${recipientFirstName},</p>
    <p>The buyer accepted your counter offer on <strong>${listingTitle}</strong>.</p>
    ${detailRowsHtml({
      'Counter offer': offerAmount,
      Buyer: buyerName,
      'Seller Service Fee': sellerServiceFee,
      "You'll receive": sellerNetPayout,
    })}
    <p>The buyer now has ${PAYMENT_DEADLINE_LABEL} to complete payment. You will be notified when payment is received.</p>
  `.trim()

  return layoutFields(baseUrl, {
    subject,
    preheader: `${buyerName} accepted your ${offerAmount} counter offer on ${listingTitle}.`,
    title: 'Your counter offer was accepted',
    subtitle: 'Waiting for the buyer to complete payment.',
    body,
    cta_text: 'View offer',
    cta_url: appUrl(baseUrl, `/hub?section=selling&tab=offers&offerId=${offer.id}`),
    recipient_first_name: recipientFirstName,
    buyer_name: buyerName,
    listing_title: listingTitle,
    offer_amount: offerAmount,
    seller_service_fee: sellerServiceFee,
    seller_net_payout: sellerNetPayout,
    offer_id: offer.id,
  })
}

export function composePaymentSuccessfulDynamicData({
  baseUrl,
  order,
  listing,
  buyerProfile,
  sellerProfile,
}) {
  const listingTitle = listing?.title?.trim() || 'your item'
  const orderNumber = formatOrderReference(order.id)
  const orderTotal = formatPricePence(order.buyer_total_pence ?? order.amount_pence)
  const sellerName = getMarketplaceUserName(sellerProfile, { fallback: 'The seller' })
  const recipientFirstName = getMarketplaceRecipientName(buyerProfile, { fallback: 'there' })

  const body = `
    <p>Hi ${recipientFirstName},</p>
    <p>Your payment for <strong>${listingTitle}</strong> was successful. Your order is confirmed.</p>
    ${detailRowsHtml({
      'Order number': orderNumber,
      Total: orderTotal,
      Seller: sellerName,
    })}
    <p>Follow the next steps in your order to arrange collection or delivery with the seller.</p>
  `.trim()

  const dynamicData = layoutFields(baseUrl, {
    subject: composeMarketplaceEmailSubject('payment_successful', listingTitle),
    preheader: `Payment confirmed for order ${orderNumber} — ${listingTitle}.`,
    title: 'Payment successful',
    subtitle: 'Your order is confirmed.',
    body,
    cta_text: 'View order',
    cta_url: appUrl(baseUrl, `/orders/${order.id}`),
    recipient_first_name: recipientFirstName,
    order_id: order.id,
    order_number: orderNumber,
    listing_title: listingTitle,
    order_total: orderTotal,
    seller_name: sellerName,
  })

  assertBuyerEmailSafe(dynamicData)
  return dynamicData
}

export function composeNewOrderReceivedDynamicData({
  baseUrl,
  order,
  listing,
  buyerProfile,
  sellerProfile,
}) {
  const listingTitle = listing?.title?.trim() || 'your listing'
  const orderNumber = formatOrderReference(order.id)
  const saleAmount = formatPricePence(order.item_price_pence ?? order.amount_pence)
  const buyerName = getMarketplaceUserName(buyerProfile, { fallback: 'The buyer' })
  const recipientFirstName = getMarketplaceRecipientName(sellerProfile, { fallback: 'there' })
  const sellerServiceFeePence =
    order.seller_service_fee_pence ?? calculateSellerServiceFee(order.item_price_pence ?? order.amount_pence)
  const sellerNetPence =
    order.seller_net_pence ?? calculateSellerNetPayout(order.item_price_pence ?? order.amount_pence)
  const sellerServiceFee = formatPricePence(sellerServiceFeePence)
  const sellerNetPayout = formatPricePence(sellerNetPence)

  const body = `
    <p>Hi ${recipientFirstName},</p>
    <p><strong>${buyerName}</strong> has paid for <strong>${listingTitle}</strong>. You have a new order to fulfil.</p>
    ${detailRowsHtml({
      'Order number': orderNumber,
      'Sale amount': saleAmount,
      Buyer: buyerName,
      'Seller Service Fee': sellerServiceFee,
      "You'll receive": sellerNetPayout,
    })}
    <p>Open the order to confirm handover details and complete the next fulfilment steps.</p>
  `.trim()

  return layoutFields(baseUrl, {
    subject: composeMarketplaceEmailSubject('new_order_received', listingTitle),
    preheader: `New paid order ${orderNumber} — ${buyerName} bought your ${listingTitle}.`,
    title: 'New order received',
    subtitle: 'A buyer has paid for your listing.',
    body,
    cta_text: 'View order',
    cta_url: appUrl(baseUrl, `/orders/${order.id}`),
    recipient_first_name: recipientFirstName,
    order_id: order.id,
    order_number: orderNumber,
    listing_title: listingTitle,
    order_total: saleAmount,
    buyer_name: buyerName,
    seller_service_fee: sellerServiceFee,
    seller_net_payout: sellerNetPayout,
  })
}

export function composeBuyerDeliveryDetailsAddedDynamicData({
  baseUrl,
  order,
  listing,
  buyerProfile,
  sellerProfile,
  deliveryDetails,
}) {
  const listingTitle = listing?.title?.trim() || 'your listing'
  const orderNumber = formatOrderReference(order.id)
  const buyerName = getMarketplaceUserName(buyerProfile, { fallback: 'The buyer' })
  const recipientFirstName = getMarketplaceRecipientName(sellerProfile, { fallback: 'there' })
  const deliveryContactName =
    deliveryDetails?.delivery_contact_name?.trim() || buyerName

  const body = `
    <p>Hi ${recipientFirstName},</p>
    <p><strong>${buyerName}</strong> has submitted delivery details for <strong>${listingTitle}</strong>.</p>
    ${detailRowsHtml({
      'Order number': orderNumber,
      'Delivery contact': deliveryContactName,
      Buyer: buyerName,
    })}
    <p>Review the details in your order and arrange delivery when you are ready.</p>
  `.trim()

  return layoutFields(baseUrl, {
    subject: composeMarketplaceEmailSubject('buyer_delivery_details_added', listingTitle),
    preheader: `${buyerName} added delivery details for ${listingTitle}.`,
    title: 'Delivery details added',
    subtitle: 'The buyer has submitted delivery information.',
    body,
    cta_text: 'View order',
    cta_url: appUrl(baseUrl, `/orders/${order.id}`),
    recipient_first_name: recipientFirstName,
    buyer_name: buyerName,
    listing_title: listingTitle,
    order_id: order.id,
    order_number: orderNumber,
    delivery_contact_name: deliveryContactName,
  })
}

export function composeCollectionConfirmedDynamicData({
  baseUrl,
  order,
  listing,
  buyerProfile,
  sellerProfile,
  recipientRole,
}) {
  const listingTitle = listing?.title?.trim() || 'your item'
  const orderNumber = formatOrderReference(order.id)
  const buyerName = getMarketplaceUserName(buyerProfile, { fallback: 'The buyer' })
  const sellerName = getMarketplaceUserName(sellerProfile, { fallback: 'The seller' })
  const fulfilmentLabel = fulfilmentLabelTitleCase(order.order_type)
  const fulfilmentVerb = fulfilmentLabelForOrderType(order.order_type)
  const isBuyer = recipientRole === 'buyer'
  const recipientProfile = isBuyer ? buyerProfile : sellerProfile
  const counterpartyName = isBuyer ? sellerName : buyerName
  const recipientFirstName = getMarketplaceRecipientName(recipientProfile, { fallback: 'there' })

  const body = isBuyer
    ? `
    <p>Hi ${recipientFirstName},</p>
    <p>You confirmed ${fulfilmentVerb} for <strong>${listingTitle}</strong>.</p>
    ${detailRowsHtml({
      'Order number': orderNumber,
      Seller: counterpartyName,
    })}
    <p>Your Buyer Protection window is now active. Open the order for full details.</p>
  `.trim()
    : `
    <p>Hi ${recipientFirstName},</p>
    <p><strong>${counterpartyName}</strong> has confirmed ${fulfilmentVerb} for <strong>${listingTitle}</strong>.</p>
    ${detailRowsHtml({
      'Order number': orderNumber,
      Buyer: counterpartyName,
    })}
    <p>Payout is held during the Buyer Protection window. Open the order for full details.</p>
  `.trim()

  const dynamicData = layoutFields(baseUrl, {
    subject: composeMarketplaceEmailSubject('collection_confirmed', listingTitle, {
      recipientRole,
      orderType: order.order_type,
    }),
    preheader: isBuyer
      ? `You confirmed ${fulfilmentVerb} for ${listingTitle}.`
      : `${fulfilmentLabel} confirmed for ${listingTitle} (order ${orderNumber}).`,
    title: `${fulfilmentLabel} confirmed`,
    subtitle: isBuyer
      ? 'Your Buyer Protection window has started.'
      : 'The buyer confirmed receipt of the item.',
    body,
    cta_text: 'View order',
    cta_url: appUrl(baseUrl, `/orders/${order.id}`),
    recipient_first_name: recipientFirstName,
    listing_title: listingTitle,
    order_id: order.id,
    order_number: orderNumber,
    counterparty_name: counterpartyName,
    fulfilment_label: fulfilmentLabel,
  })

  if (isBuyer) {
    assertBuyerEmailSafe(dynamicData)
  }

  return dynamicData
}

export function composeCourierDispatchedDynamicData({
  baseUrl,
  order,
  listing,
  buyerProfile,
  sellerProfile,
}) {
  const listingTitle = listing?.title?.trim() || 'your item'
  const orderNumber = formatOrderReference(order.id)
  const sellerName = getMarketplaceUserName(sellerProfile, { fallback: 'The seller' })
  const recipientFirstName = getMarketplaceRecipientName(buyerProfile, { fallback: 'there' })
  const courierName = order.courier_name?.trim() || '—'
  const courierCompany = order.courier_company?.trim() || '—'

  const body = `
    <p>Hi ${recipientFirstName},</p>
    <p><strong>${sellerName}</strong> has dispatched <strong>${listingTitle}</strong> via courier. Your item is now in transit.</p>
    ${detailRowsHtml({
      'Order number': orderNumber,
      Seller: sellerName,
      Courier: courierName,
      Company: courierCompany,
    })}
    <p>Confirm delivery in your order once the item arrives to start your Buyer Protection window.</p>
  `.trim()

  const dynamicData = layoutFields(baseUrl, {
    subject: composeMarketplaceEmailSubject('courier_dispatched', listingTitle),
    preheader: `${listingTitle} is on its way — courier handover submitted.`,
    title: 'Your order is on its way',
    subtitle: 'The seller has dispatched your item via courier.',
    body,
    cta_text: 'View order',
    cta_url: appUrl(baseUrl, `/orders/${order.id}`),
    recipient_first_name: recipientFirstName,
    listing_title: listingTitle,
    order_id: order.id,
    order_number: orderNumber,
    seller_name: sellerName,
    courier_name: courierName,
    courier_company: courierCompany,
  })

  assertBuyerEmailSafe(dynamicData)
  return dynamicData
}

export function composeDeliveryConfirmedDynamicData({
  baseUrl,
  order,
  listing,
  buyerProfile,
  sellerProfile,
  recipientRole,
}) {
  const listingTitle = listing?.title?.trim() || 'your item'
  const orderNumber = formatOrderReference(order.id)
  const buyerName = getMarketplaceUserName(buyerProfile, { fallback: 'The buyer' })
  const sellerName = getMarketplaceUserName(sellerProfile, { fallback: 'The seller' })
  const isBuyer = recipientRole === 'buyer'
  const recipientProfile = isBuyer ? buyerProfile : sellerProfile
  const counterpartyName = isBuyer ? sellerName : buyerName
  const recipientFirstName = getMarketplaceRecipientName(recipientProfile, { fallback: 'there' })
  const buyerTrackingReference = order.courier_buyer_tracking_reference?.trim() || '—'

  const detailRows = isBuyer
    ? { 'Order number': orderNumber, Seller: counterpartyName }
    : {
        'Order number': orderNumber,
        Buyer: counterpartyName,
        'Tracking reference': buyerTrackingReference,
      }

  const body = isBuyer
    ? `
    <p>Hi ${recipientFirstName},</p>
    <p>You confirmed delivery of <strong>${listingTitle}</strong>.</p>
    ${detailRowsHtml(detailRows)}
    <p>Your Buyer Protection window is now active. Open the order for full details.</p>
  `.trim()
    : `
    <p>Hi ${recipientFirstName},</p>
    <p><strong>${counterpartyName}</strong> has confirmed delivery of <strong>${listingTitle}</strong>.</p>
    ${detailRowsHtml(detailRows)}
    <p>Payout is held during the Buyer Protection window. Open the order for full details.</p>
  `.trim()

  const dynamicData = layoutFields(baseUrl, {
    subject: composeMarketplaceEmailSubject('delivery_confirmed', listingTitle, { recipientRole }),
    preheader: isBuyer
      ? `You confirmed delivery for ${listingTitle}.`
      : `Delivery confirmed for ${listingTitle} (order ${orderNumber}).`,
    title: 'Delivery confirmed',
    subtitle: isBuyer
      ? 'Your Buyer Protection window has started.'
      : 'The buyer confirmed receipt of the item.',
    body,
    cta_text: 'View order',
    cta_url: appUrl(baseUrl, `/orders/${order.id}`),
    recipient_first_name: recipientFirstName,
    listing_title: listingTitle,
    order_id: order.id,
    order_number: orderNumber,
    counterparty_name: counterpartyName,
    buyer_tracking_reference: buyerTrackingReference,
  })

  if (isBuyer) {
    assertBuyerEmailSafe(dynamicData)
  }

  return dynamicData
}

export function composeBuyerProtectionStartedDynamicData({
  baseUrl,
  order,
  listing,
  buyerProfile,
}) {
  const listingTitle = listing?.title?.trim() || 'your item'
  const orderNumber = formatOrderReference(order.id)
  const recipientFirstName = getMarketplaceRecipientName(buyerProfile, { fallback: 'there' })
  const protectionHours = String(order.dispute_window_hours ?? 24)
  const protectionEndsAt = formatProtectionEndsAt(order.payout_release_at)

  const body = `
    <p>Hi ${recipientFirstName},</p>
    <p>Your <strong>${protectionHours}-hour</strong> Buyer Protection window for <strong>${listingTitle}</strong> has started.</p>
    ${detailRowsHtml({
      'Order number': orderNumber,
      'Protection ends': protectionEndsAt,
    })}
    <p>If something is not right with your order, open a case before the window ends.</p>
  `.trim()

  const dynamicData = layoutFields(baseUrl, {
    subject: composeMarketplaceEmailSubject('buyer_protection_started', listingTitle),
    preheader: `Buyer Protection started for ${listingTitle} — ends ${protectionEndsAt}.`,
    title: 'Buyer Protection started',
    subtitle: 'Your protection window is now active.',
    body,
    cta_text: 'View order',
    cta_url: appUrl(baseUrl, `/orders/${order.id}`),
    recipient_first_name: recipientFirstName,
    listing_title: listingTitle,
    order_id: order.id,
    order_number: orderNumber,
    protection_hours: protectionHours,
    protection_ends_at: protectionEndsAt,
  })

  assertBuyerEmailSafe(dynamicData)
  return dynamicData
}

export async function resolveUserEmail(admin, userId) {
  const { data, error } = await admin.auth.admin.getUserById(userId)
  if (error) {
    return { email: null, error: error.message }
  }
  const email = data?.user?.email?.trim() || null
  return { email, error: email ? null : 'User email not found' }
}

async function fetchProfile(admin, userId) {
  const { data } = await admin
    .from('profiles')
    .select('id, username, display_name')
    .eq('id', userId)
    .maybeSingle()
  return data
}

function profileNeedsEmailFallback(profile) {
  return !profile?.username?.trim() && !profile?.display_name?.trim()
}

/** Load participant profiles once per email compose, with auth email only when needed for fallback. */
export async function loadMarketplaceParticipants(admin, userIds) {
  const ids = [...new Set(userIds.filter(Boolean))]
  if (ids.length === 0) {
    return {}
  }

  const profileRows = await Promise.all(ids.map((id) => fetchProfile(admin, id)))
  const participants = {}

  await Promise.all(
    ids.map(async (id, index) => {
      const profile = profileRows[index]
      let email = null

      if (!profile || profileNeedsEmailFallback(profile)) {
        const resolved = await resolveUserEmail(admin, id)
        email = resolved.email
      }

      participants[id] = profile ? { ...profile, email } : { id, email }
    }),
  )

  return participants
}

async function loadOfferContext(admin, offerId) {
  const { data: offer, error } = await admin
    .from('offers')
    .select('id, listing_id, buyer_id, seller_id, amount_pence, status, direction, parent_offer_id')
    .eq('id', offerId)
    .maybeSingle()

  if (error || !offer) {
    return { ok: false, error: error?.message || 'Offer not found' }
  }

  const [{ data: listing }, participants] = await Promise.all([
    admin.from('listings').select('id, title, price_pence').eq('id', offer.listing_id).maybeSingle(),
    loadMarketplaceParticipants(admin, [offer.buyer_id, offer.seller_id]),
  ])

  return {
    ok: true,
    offer,
    listing,
    buyerProfile: participants[offer.buyer_id],
    sellerProfile: participants[offer.seller_id],
  }
}

async function loadOrderContext(admin, orderId) {
  const { data: order, error } = await admin
    .from('orders')
    .select(
      'id, listing_id, buyer_id, seller_id, amount_pence, item_price_pence, buyer_total_pence, seller_service_fee_pence, seller_net_pence, order_type, dispute_window_hours, payout_release_at, payout_status, fulfilment_status, courier_name, courier_company, courier_buyer_tracking_reference, collection_confirmed_at, courier_evidence_submitted_at, courier_delivered_at',
    )
    .eq('id', orderId)
    .maybeSingle()

  if (error || !order) {
    return { ok: false, error: error?.message || 'Order not found' }
  }

  const [{ data: listing }, participants] = await Promise.all([
    admin.from('listings').select('id, title, price_pence').eq('id', order.listing_id).maybeSingle(),
    loadMarketplaceParticipants(admin, [order.buyer_id, order.seller_id]),
  ])

  return {
    ok: true,
    order,
    listing,
    buyerProfile: participants[order.buyer_id],
    sellerProfile: participants[order.seller_id],
  }
}

async function loadOrderDeliveryDetails(admin, orderId) {
  const { data } = await admin
    .from('order_delivery_details')
    .select('delivery_contact_name, delivery_contact_phone, buyer_delivery_address, delivery_details_submitted_at')
    .eq('order_id', orderId)
    .maybeSingle()

  return data
}

const phase5Helpers = {
  formatOrderReference,
  formatPricePence,
  getMarketplaceUserName,
  getMarketplaceRecipientName,
  assertBuyerEmailSafe,
  calculateSellerServiceFee,
  calculateSellerNetPayout,
}

async function loadDisputeContext(admin, disputeId) {
  const { data: dispute, error } = await admin
    .from('order_disputes')
    .select('id, order_id, buyer_id, seller_id, listing_id, status')
    .eq('id', disputeId)
    .maybeSingle()

  if (error || !dispute) {
    return { ok: false, error: error?.message || 'Dispute not found' }
  }

  const orderContext = await loadOrderContext(admin, dispute.order_id)
  if (!orderContext.ok) {
    return orderContext
  }

  return {
    ok: true,
    dispute,
    ...orderContext,
  }
}

async function loadReviewContext(admin, reviewId) {
  const { data: review, error } = await admin
    .from('reviews')
    .select('id, order_id, reviewer_user_id, reviewed_user_id, rating, review_text')
    .eq('id', reviewId)
    .maybeSingle()

  if (error || !review) {
    return { ok: false, error: error?.message || 'Review not found' }
  }

  const orderContext = await loadOrderContext(admin, review.order_id)
  if (!orderContext.ok) {
    return orderContext
  }

  const participants = await loadMarketplaceParticipants(admin, [
    review.reviewer_user_id,
    review.reviewed_user_id,
  ])

  return {
    ok: true,
    review,
    reviewerProfile: participants[review.reviewer_user_id],
    reviewedProfile: participants[review.reviewed_user_id],
    ...orderContext,
  }
}

async function loadUserProfileContext(admin, userId) {
  const participants = await loadMarketplaceParticipants(admin, [userId])
  const profile = participants[userId]
  if (!profile) {
    return { ok: false, error: 'User profile not found' }
  }

  return { ok: true, profile, userId }
}

async function loadSellerOnboardingContext(admin, orderId) {
  const orderContext = await loadOrderContext(admin, orderId)
  if (!orderContext.ok) {
    return orderContext
  }

  const { data: sellerProfile } = await admin
    .from('profiles')
    .select('id, username, display_name, stripe_onboarding_complete, stripe_account_id')
    .eq('id', orderContext.order.seller_id)
    .maybeSingle()

  if (sellerProfile?.stripe_onboarding_complete) {
    return { ok: false, skip: true, reason: 'seller_already_onboarded' }
  }

  return {
    ok: true,
    ...orderContext,
    sellerProfile: sellerProfile ?? orderContext.sellerProfile,
  }
}

function dualRecipientResult({
  eventKey,
  order,
  listing,
  buyerProfile,
  sellerProfile,
  recipientRole,
  dynamicDataBuilder,
  disputeId,
  caseUpdateId,
}) {
  const recipientUserId = recipientRole === 'buyer' ? order.buyer_id : order.seller_id
  const idempotencyParts = {
    orderId: order.id,
    recipientUserId,
    disputeId,
    caseUpdateId,
    buyerId: order.buyer_id,
    sellerId: order.seller_id,
  }

  return {
    ok: true,
    templateKey: eventKey,
    recipientUserId,
    relatedOrderId: order.id,
    relatedListingId: listing?.id ?? order.listing_id,
    idempotencyParts,
    dynamicData: dynamicDataBuilder(),
  }
}

export async function composeMarketplaceEmailDynamicData(eventKey, payload, getEnv) {
  const baseUrl = getEnv('APP_BASE_URL')?.trim() || getEnv('EQUIPD_APP_URL')?.trim() || 'https://equipd.co.uk'
  const normalizedPayload = normalizeMarketplaceEmailPayload(payload)
  const admin = normalizedPayload.admin

  if (eventKey === 'offer_received' || eventKey === 'offer_accepted' || eventKey === 'counter_offer_received') {
    const context = await loadOfferContext(admin, normalizedPayload.offerId)
    if (!context.ok) return context

    const { offer, listing, buyerProfile, sellerProfile } = context

    if (eventKey === 'counter_offer_received') {
      if (!offer.parent_offer_id) {
        return { ok: false, skip: true, reason: 'not_counter_offer' }
      }

      const isSellerCounter = offer.direction === 'seller_to_buyer'
      const recipientUserId = isSellerCounter ? offer.buyer_id : offer.seller_id

      return {
        ok: true,
        templateKey: eventKey,
        recipientUserId,
        relatedOfferId: offer.id,
        relatedListingId: offer.listing_id,
        idempotencyParts: { offerId: offer.id, recipientUserId },
        dynamicData: composeCounterOfferReceivedDynamicData({
          baseUrl,
          offer,
          listing,
          buyerProfile,
          sellerProfile,
        }),
      }
    }

    if (eventKey === 'offer_received') {
      if (offer.parent_offer_id) return { ok: false, skip: true, reason: 'counter_offer' }
      if ((offer.direction ?? 'buyer_to_seller') !== 'buyer_to_seller') {
        return { ok: false, skip: true, reason: 'not_buyer_to_seller' }
      }

      return {
        ok: true,
        templateKey: eventKey,
        recipientUserId: offer.seller_id,
        relatedOfferId: offer.id,
        relatedListingId: offer.listing_id,
        idempotencyParts: { offerId: offer.id, sellerId: offer.seller_id },
        dynamicData: composeOfferReceivedDynamicData({
          baseUrl,
          offer,
          listing,
          buyerProfile,
          sellerProfile,
        }),
      }
    }

    if (eventKey === 'offer_accepted') {
      if (offer.status !== 'accepted') {
        return { ok: false, skip: true, reason: 'offer_not_accepted' }
      }

      const direction = offer.direction ?? 'buyer_to_seller'
      if (direction !== 'buyer_to_seller' && direction !== 'seller_to_buyer') {
        return { ok: false, skip: true, reason: 'unsupported_offer_direction' }
      }

      if (direction === 'seller_to_buyer') {
        return {
          ok: true,
          templateKey: eventKey,
          recipientUserId: offer.seller_id,
          relatedOfferId: offer.id,
          relatedListingId: offer.listing_id,
          idempotencyParts: { offerId: offer.id, recipientUserId: offer.seller_id },
          dynamicData: composeCounterOfferAcceptedSellerDynamicData({
            baseUrl,
            offer,
            listing,
            buyerProfile,
            sellerProfile,
          }),
        }
      }

      return {
        ok: true,
        templateKey: eventKey,
        recipientUserId: offer.buyer_id,
        relatedOfferId: offer.id,
        relatedListingId: offer.listing_id,
        idempotencyParts: { offerId: offer.id, recipientUserId: offer.buyer_id },
        dynamicData: composeOfferAcceptedDynamicData({
          baseUrl,
          offer,
          listing,
          buyerProfile,
          sellerProfile,
        }),
      }
    }
  }

  if (eventKey === 'payment_successful' || eventKey === 'new_order_received') {
    const orderId = await resolveOrderIdForPayload(admin, normalizedPayload)
    if (!orderId) {
      return { ok: false, error: 'orderId or paymentId is required for order emails' }
    }

    const context = await loadOrderContext(admin, orderId)
    if (!context.ok) return context

    const { order, listing, buyerProfile, sellerProfile } = context

    if (eventKey === 'payment_successful') {
      const dynamicData = composePaymentSuccessfulDynamicData({
        baseUrl,
        order,
        listing,
        buyerProfile,
        sellerProfile,
      })

      return {
        ok: true,
        templateKey: eventKey,
        recipientUserId: order.buyer_id,
        relatedOrderId: order.id,
        relatedListingId: order.listing_id,
        idempotencyParts: { orderId: order.id, buyerId: order.buyer_id },
        dynamicData,
      }
    }

    return {
      ok: true,
      templateKey: eventKey,
      recipientUserId: order.seller_id,
      relatedOrderId: order.id,
      relatedListingId: order.listing_id,
      idempotencyParts: { orderId: order.id, sellerId: order.seller_id },
      dynamicData: composeNewOrderReceivedDynamicData({
        baseUrl,
        order,
        listing,
        buyerProfile,
        sellerProfile,
      }),
    }
  }

  if (FULFILMENT_ORDER_EVENT_KEYS.has(eventKey)) {
    const orderId = await resolveOrderIdForPayload(admin, normalizedPayload)
    if (!orderId) {
      return { ok: false, error: 'orderId is required for fulfilment emails' }
    }

    const context = await loadOrderContext(admin, orderId)
    if (!context.ok) return context

    const { order, listing, buyerProfile, sellerProfile } = context
    const recipientRole = normalizedPayload.recipientRole

    if (DUAL_RECIPIENT_EVENT_KEYS.has(eventKey)) {
      if (recipientRole !== 'buyer' && recipientRole !== 'seller') {
        return { ok: false, error: 'recipientRole must be buyer or seller' }
      }
    }

    if (eventKey === 'buyer_delivery_details_added') {
      if (order.order_type !== 'seller_delivery') {
        return { ok: false, skip: true, reason: 'not_seller_delivery_order' }
      }

      const deliveryDetails = await loadOrderDeliveryDetails(admin, orderId)
      if (!deliveryDetails?.delivery_details_submitted_at) {
        return { ok: false, skip: true, reason: 'delivery_details_not_submitted' }
      }

      return {
        ok: true,
        templateKey: eventKey,
        recipientUserId: order.seller_id,
        relatedOrderId: order.id,
        relatedListingId: order.listing_id,
        idempotencyParts: { orderId: order.id, sellerId: order.seller_id },
        dynamicData: composeBuyerDeliveryDetailsAddedDynamicData({
          baseUrl,
          order,
          listing,
          buyerProfile,
          sellerProfile,
          deliveryDetails,
        }),
      }
    }

    if (eventKey === 'collection_confirmed') {
      if (!order.collection_confirmed_at) {
        return { ok: false, skip: true, reason: 'collection_not_confirmed' }
      }

      const recipientUserId = recipientRole === 'buyer' ? order.buyer_id : order.seller_id

      return {
        ok: true,
        templateKey: eventKey,
        recipientUserId,
        relatedOrderId: order.id,
        relatedListingId: order.listing_id,
        idempotencyParts: { orderId: order.id, recipientUserId },
        dynamicData: composeCollectionConfirmedDynamicData({
          baseUrl,
          order,
          listing,
          buyerProfile,
          sellerProfile,
          recipientRole,
        }),
      }
    }

    if (eventKey === 'courier_dispatched') {
      if (order.order_type !== 'buyer_courier') {
        return { ok: false, skip: true, reason: 'not_buyer_courier_order' }
      }
      if (!order.courier_evidence_submitted_at) {
        return { ok: false, skip: true, reason: 'courier_not_dispatched' }
      }

      return {
        ok: true,
        templateKey: eventKey,
        recipientUserId: order.buyer_id,
        relatedOrderId: order.id,
        relatedListingId: order.listing_id,
        idempotencyParts: { orderId: order.id, buyerId: order.buyer_id },
        dynamicData: composeCourierDispatchedDynamicData({
          baseUrl,
          order,
          listing,
          buyerProfile,
          sellerProfile,
        }),
      }
    }

    if (eventKey === 'delivery_confirmed') {
      if (order.order_type !== 'buyer_courier') {
        return { ok: false, skip: true, reason: 'not_buyer_courier_order' }
      }
      if (!order.courier_delivered_at) {
        return { ok: false, skip: true, reason: 'delivery_not_confirmed' }
      }

      const recipientUserId = recipientRole === 'buyer' ? order.buyer_id : order.seller_id

      return {
        ok: true,
        templateKey: eventKey,
        recipientUserId,
        relatedOrderId: order.id,
        relatedListingId: order.listing_id,
        idempotencyParts: { orderId: order.id, recipientUserId },
        dynamicData: composeDeliveryConfirmedDynamicData({
          baseUrl,
          order,
          listing,
          buyerProfile,
          sellerProfile,
          recipientRole,
        }),
      }
    }

    if (eventKey === 'buyer_protection_started') {
      if (!order.payout_release_at) {
        return { ok: false, skip: true, reason: 'protection_not_started' }
      }

      return {
        ok: true,
        templateKey: eventKey,
        recipientUserId: order.buyer_id,
        relatedOrderId: order.id,
        relatedListingId: order.listing_id,
        idempotencyParts: { orderId: order.id, buyerId: order.buyer_id },
        dynamicData: composeBuyerProtectionStartedDynamicData({
          baseUrl,
          order,
          listing,
          buyerProfile,
        }),
      }
    }
  }

  if (PHASE5_CASE_EMAIL_EVENT_KEYS.has(eventKey)) {
    const normalized = normalizeMarketplaceEmailPayload(payload)
    const disputeId = normalized.disputeId
    if (!disputeId) {
      return { ok: false, error: 'disputeId is required for case emails' }
    }

    const context = await loadDisputeContext(admin, disputeId)
    if (!context.ok) return context

    const { dispute, order, listing, buyerProfile, sellerProfile } = context
    const recipientRole = normalized.recipientRole
    const baseArgs = {
      baseUrl,
      order,
      listing,
      buyerProfile,
      sellerProfile,
      helpers: phase5Helpers,
    }

    if (PHASE5_DUAL_RECIPIENT_EVENT_KEYS.has(eventKey)) {
      if (recipientRole !== 'buyer' && recipientRole !== 'seller') {
        return { ok: false, error: 'recipientRole must be buyer or seller' }
      }
    }

    if (eventKey === 'dispute_opened') {
      return dualRecipientResult({
        eventKey,
        order,
        listing,
        buyerProfile,
        sellerProfile,
        recipientRole,
        disputeId: dispute.id,
        dynamicDataBuilder: () =>
          composeDisputeOpenedDynamicData({ ...baseArgs, recipientRole }),
      })
    }

    if (eventKey === 'evidence_requested') {
      if (recipientRole !== 'buyer' && recipientRole !== 'seller') {
        return { ok: false, error: 'recipientRole must be buyer or seller' }
      }
      const recipientProfile = recipientRole === 'buyer' ? buyerProfile : sellerProfile
      const recipientUserId = recipientRole === 'buyer' ? order.buyer_id : order.seller_id

      return {
        ok: true,
        templateKey: eventKey,
        recipientUserId,
        relatedOrderId: order.id,
        relatedListingId: listing?.id ?? order.listing_id,
        idempotencyParts: {
          disputeId: dispute.id,
          recipientUserId,
          caseUpdateId: normalized.caseUpdateId ?? dispute.id,
        },
        dynamicData: composeEvidenceRequestedDynamicData({
          ...baseArgs,
          recipientProfile,
        }),
      }
    }

    if (eventKey === 'return_authorised') {
      return dualRecipientResult({
        eventKey,
        order,
        listing,
        buyerProfile,
        sellerProfile,
        recipientRole,
        disputeId: dispute.id,
        dynamicDataBuilder: () =>
          composeReturnAuthorisedDynamicData({ ...baseArgs, recipientRole }),
      })
    }

    if (eventKey === 'collection_arranged') {
      return dualRecipientResult({
        eventKey,
        order,
        listing,
        buyerProfile,
        sellerProfile,
        recipientRole,
        disputeId: dispute.id,
        dynamicDataBuilder: () =>
          composeCollectionArrangedDynamicData({
            ...baseArgs,
            recipientRole,
            collectionDate: normalized.collectionDate,
          }),
      })
    }

    if (eventKey === 'refund_pending') {
      return dualRecipientResult({
        eventKey,
        order,
        listing,
        buyerProfile,
        sellerProfile,
        recipientRole,
        disputeId: dispute.id,
        dynamicDataBuilder: () =>
          composeRefundPendingDynamicData({ ...baseArgs, recipientRole }),
      })
    }

    if (eventKey === 'refund_completed_case_closed') {
      return dualRecipientResult({
        eventKey,
        order,
        listing,
        buyerProfile,
        sellerProfile,
        recipientRole,
        disputeId: dispute.id,
        dynamicDataBuilder: () =>
          composeRefundCompletedCaseClosedDynamicData({ ...baseArgs, recipientRole }),
      })
    }

    if (eventKey === 'case_closed_no_refund') {
      return dualRecipientResult({
        eventKey,
        order,
        listing,
        buyerProfile,
        sellerProfile,
        recipientRole,
        disputeId: dispute.id,
        dynamicDataBuilder: () =>
          composeCaseClosedNoRefundDynamicData({ ...baseArgs, recipientRole }),
      })
    }
  }

  if (PHASE5_ORDER_EMAIL_EVENT_KEYS.has(eventKey)) {
    const normalized = normalizeMarketplaceEmailPayload(payload)

    if (eventKey === 'review_available') {
      const orderId = await resolveOrderIdForPayload(admin, normalized)
      if (!orderId) {
        return { ok: false, error: 'orderId is required for review_available' }
      }

      const context = await loadOrderContext(admin, orderId)
      if (!context.ok) return context

      const { order, listing, buyerProfile, sellerProfile } = context
      if (order.fulfilment_status !== 'completed') {
        return { ok: false, skip: true, reason: 'order_not_completed' }
      }

      return {
        ok: true,
        templateKey: eventKey,
        recipientUserId: order.buyer_id,
        relatedOrderId: order.id,
        relatedListingId: order.listing_id,
        idempotencyParts: { orderId: order.id, buyerId: order.buyer_id },
        dynamicData: composeReviewAvailableDynamicData({
          baseUrl,
          order,
          listing,
          buyerProfile,
          sellerProfile,
          helpers: phase5Helpers,
        }),
      }
    }

    if (eventKey === 'review_received') {
      if (!normalized.reviewId) {
        return { ok: false, error: 'reviewId is required for review_received' }
      }

      const context = await loadReviewContext(admin, normalized.reviewId)
      if (!context.ok) return context

      const { review, order, listing, reviewerProfile, reviewedProfile } = context

      return {
        ok: true,
        templateKey: eventKey,
        recipientUserId: review.reviewed_user_id,
        relatedOrderId: order.id,
        relatedListingId: order.listing_id,
        idempotencyParts: {
          reviewId: review.id,
          reviewedUserId: review.reviewed_user_id,
        },
        dynamicData: composeReviewReceivedDynamicData({
          baseUrl,
          order,
          listing,
          reviewerProfile,
          reviewedProfile,
          review,
          helpers: phase5Helpers,
        }),
      }
    }

    if (eventKey === 'payout_released') {
      const orderId = await resolveOrderIdForPayload(admin, normalized)
      if (!orderId) {
        return { ok: false, error: 'orderId is required for payout_released' }
      }

      const context = await loadOrderContext(admin, orderId)
      if (!context.ok) return context

      const { order, listing, sellerProfile } = context
      if (order.payout_status !== 'paid') {
        return { ok: false, skip: true, reason: 'payout_not_released' }
      }

      return {
        ok: true,
        templateKey: eventKey,
        recipientUserId: order.seller_id,
        relatedOrderId: order.id,
        relatedListingId: order.listing_id,
        idempotencyParts: { orderId: order.id, sellerId: order.seller_id },
        dynamicData: composePayoutReleasedDynamicData({
          baseUrl,
          order,
          listing,
          sellerProfile,
          helpers: phase5Helpers,
        }),
      }
    }

    if (eventKey === 'seller_onboarding_required') {
      const orderId = await resolveOrderIdForPayload(admin, normalized)
      if (!orderId) {
        return { ok: false, error: 'orderId is required for seller_onboarding_required' }
      }

      const context = await loadSellerOnboardingContext(admin, orderId)
      if (!context.ok) {
        if (context.skip) {
          return { ok: false, skip: true, reason: context.reason }
        }
        return context
      }

      const { order, listing, sellerProfile } = context

      return {
        ok: true,
        templateKey: eventKey,
        recipientUserId: order.seller_id,
        relatedOrderId: order.id,
        relatedListingId: order.listing_id,
        idempotencyParts: { orderId: order.id, sellerId: order.seller_id },
        dynamicData: composeSellerOnboardingRequiredDynamicData({
          baseUrl,
          order,
          listing,
          sellerProfile,
          helpers: phase5Helpers,
        }),
      }
    }
  }

  if (PHASE5_ACCOUNT_EMAIL_EVENT_KEYS.has(eventKey)) {
    const normalized = normalizeMarketplaceEmailPayload(payload)
    const userId = normalized.userId
    if (!userId) {
      return { ok: false, error: 'userId is required for account emails' }
    }

    const context = await loadUserProfileContext(admin, userId)
    if (!context.ok) return context

    if (eventKey === 'welcome') {
      return {
        ok: true,
        templateKey: eventKey,
        recipientUserId: userId,
        idempotencyParts: { userId },
        dynamicData: composeWelcomeDynamicData({
          baseUrl,
          profile: context.profile,
          helpers: phase5Helpers,
        }),
      }
    }

    if (eventKey === 'email_changed') {
      if (!normalized.newEmail) {
        return { ok: false, error: 'newEmail is required for email_changed' }
      }

      return {
        ok: true,
        templateKey: eventKey,
        recipientUserId: userId,
        idempotencyParts: { userId, newEmail: normalized.newEmail },
        dynamicData: composeEmailChangedDynamicData({
          baseUrl,
          profile: context.profile,
          newEmail: normalized.newEmail,
          helpers: phase5Helpers,
        }),
      }
    }

    if (eventKey === 'password_changed') {
      return {
        ok: true,
        templateKey: eventKey,
        recipientUserId: userId,
        idempotencyParts: {
          userId,
          changedAt: normalized.changedAt ?? new Date().toISOString(),
        },
        dynamicData: composePasswordChangedDynamicData({
          baseUrl,
          profile: context.profile,
          helpers: phase5Helpers,
        }),
      }
    }
  }

  return { ok: false, error: `Unsupported marketplace email event: ${eventKey}` }
}

export async function reserveEmailLog(admin, row) {
  const { data, error } = await admin
    .from('transactional_email_log')
    .insert(row)
    .select('id, status')
    .maybeSingle()

  if (!error) {
    return { action: 'send', logId: data.id }
  }

  if (error.code !== '23505') {
    return { action: 'error', error: error.message }
  }

  const { data: existing, error: fetchError } = await admin
    .from('transactional_email_log')
    .select('id, status, provider_message_id')
    .eq('idempotency_key', row.idempotency_key)
    .maybeSingle()

  if (fetchError) {
    return { action: 'error', error: fetchError.message }
  }

  if (existing?.status === 'failed' && existing.id) {
    const { error: retryError } = await admin
      .from('transactional_email_log')
      .update({
        status: 'pending',
        error_message: null,
        failed_at: null,
        sent_at: null,
        provider_message_id: null,
      })
      .eq('id', existing.id)

    if (retryError) {
      return { action: 'error', error: retryError.message }
    }

    return { action: 'send', logId: existing.id, retry: true }
  }

  return {
    action: 'skip',
    logId: existing?.id ?? null,
    reason: existing?.status ? `already_${existing.status}` : 'duplicate',
  }
}

async function finalizeEmailLog(admin, logId, patch) {
  if (!logId) return
  await admin.from('transactional_email_log').update(patch).eq('id', logId)
}

/**
 * @param {string} eventKey
 * @param {Record<string, unknown>} payload
 * @param {{ getEnv: Function, admin: object, log?: Function, sendTransactionalEmailFn?: Function }} deps
 */
export async function sendMarketplaceEmail(eventKey, payload, deps) {
  const log = deps.log ?? (() => {})
  const getEnv = deps.getEnv
  const admin = deps.admin
  const sendFn = deps.sendTransactionalEmailFn ?? sendTransactionalEmail

  try {
    if (!isEmailTemplateKey(eventKey)) {
      return { ok: false, error: `Unknown marketplace email event: ${eventKey}` }
    }

    if (!admin) {
      return { ok: false, error: 'Supabase admin client is required' }
    }

    const composed = await composeMarketplaceEmailDynamicData(eventKey, { ...payload, admin }, getEnv)

    if (!composed.ok) {
      if (composed.skip) {
        log('sendMarketplaceEmail skipped', `${eventKey}: ${composed.reason}`)
        return { ok: true, skipped: true, reason: composed.reason }
      }
      log('sendMarketplaceEmail compose failed', composed.error)
      return { ok: false, error: composed.error }
    }

    const idempotencyKey = buildMarketplaceEmailIdempotencyKey(
      eventKey,
      composed.idempotencyParts,
    )

    const reservation = await reserveEmailLog(admin, {
      template_key: composed.templateKey,
      recipient_user_id: composed.recipientUserId,
      related_order_id: composed.relatedOrderId ?? null,
      related_offer_id: composed.relatedOfferId ?? null,
      related_listing_id: composed.relatedListingId ?? null,
      status: 'pending',
      idempotency_key: idempotencyKey,
    })

    if (reservation.action === 'error') {
      log('sendMarketplaceEmail log reservation failed', reservation.error)
      return { ok: false, error: reservation.error }
    }

    if (reservation.action === 'skip') {
      log('sendMarketplaceEmail duplicate skipped', `${idempotencyKey} (${reservation.reason})`)
      return { ok: true, skipped: true, reason: reservation.reason, idempotencyKey }
    }

    const { email: recipientEmail, error: emailError } = await resolveUserEmail(
      admin,
      composed.recipientUserId,
    )

    if (!recipientEmail) {
      await finalizeEmailLog(admin, reservation.logId, {
        status: 'skipped',
        error_message: emailError || 'Recipient email missing',
        failed_at: new Date().toISOString(),
      })
      log('sendMarketplaceEmail skipped: missing recipient email', `${eventKey} user=${composed.recipientUserId}`)
      return { ok: true, skipped: true, reason: 'missing_recipient_email', idempotencyKey }
    }

    await finalizeEmailLog(admin, reservation.logId, {
      recipient_email: recipientEmail,
    })

    if (isDryRunMode(getEnv)) {
      const enriched = enrichDynamicData(composed.dynamicData, getEnv)
      await finalizeEmailLog(admin, reservation.logId, {
        status: 'skipped',
        error_message: 'Dry-run mode (SendGrid not configured or EMAIL_DRY_RUN enabled)',
        failed_at: null,
        sent_at: null,
      })
      log('sendMarketplaceEmail dry-run', JSON.stringify({ eventKey, to: recipientEmail, dynamicData: enriched }, null, 2))
      return { ok: true, dryRun: true, idempotencyKey, to: recipientEmail }
    }

    const sendResult = await sendFn({
      to: recipientEmail,
      templateKey: composed.templateKey,
      dynamicData: composed.dynamicData,
    })

    if (!sendResult.ok) {
      await finalizeEmailLog(admin, reservation.logId, {
        status: 'failed',
        error_message: sendResult.error || 'SendGrid send failed',
        failed_at: new Date().toISOString(),
      })
      log('sendMarketplaceEmail send failed', sendResult.error)
      return { ok: false, error: sendResult.error, idempotencyKey }
    }

    if (sendResult.dryRun) {
      await finalizeEmailLog(admin, reservation.logId, {
        status: 'skipped',
        error_message: 'Transactional sender dry-run',
      })
      return { ok: true, dryRun: true, idempotencyKey, to: recipientEmail }
    }

    await finalizeEmailLog(admin, reservation.logId, {
      status: 'sent',
      provider_message_id: sendResult.messageId ?? null,
      sent_at: new Date().toISOString(),
      error_message: null,
      failed_at: null,
    })

    return {
      ok: true,
      idempotencyKey,
      to: recipientEmail,
      messageId: sendResult.messageId,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    log('sendMarketplaceEmail unexpected error', message)
    return { ok: false, error: message }
  }
}
