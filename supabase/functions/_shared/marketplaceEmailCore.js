import { appUrl, detailRowsHtml } from '../../../emails/templates/shared.js'
import { enrichDynamicData, isDryRunMode, sendTransactionalEmail } from './transactionalEmailCore.js'
import { isEmailTemplateKey } from './emailTemplateConfig.js'

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

export const MARKETPLACE_EMAIL_EVENT_KEYS = [
  'offer_received',
  'offer_accepted',
  'payment_successful',
  'new_order_received',
]

const PAYMENT_DEADLINE_LABEL = '48 hours'

const SELLER_ONLY_DYNAMIC_KEYS = new Set([
  'seller_service_fee',
  'seller_net_payout',
])

export function buildMarketplaceEmailIdempotencyKey(eventKey, parts) {
  switch (eventKey) {
    case 'offer_received':
      return `offer_received:${parts.offerId}:${parts.sellerId}`
    case 'offer_accepted':
      return `offer_accepted:${parts.offerId}:${parts.buyerId}`
    case 'payment_successful':
      return `payment_successful:${parts.orderId}:${parts.buyerId}`
    case 'new_order_received':
      return `new_order_received:${parts.orderId}:${parts.sellerId}`
    default:
      return `${eventKey}:${parts.entityId ?? 'unknown'}`
  }
}

export function formatOrderReference(orderId) {
  if (!orderId) return ''
  return String(orderId).replace(/-/g, '').slice(0, 8).toUpperCase()
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

export function getProfileDisplayName(profile, fallback = 'Equipd member') {
  return (
    profile?.display_name?.trim() ||
    profile?.username?.trim() ||
    fallback
  )
}

export function getFirstName(profile, fallback = 'there') {
  const displayName = getProfileDisplayName(profile, fallback)
  return displayName.split(/\s+/)[0] || displayName
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
  return {
    tagline: 'The UK marketplace for used gym equipment.',
    secondary_text: 'Visit the Help Centre',
    secondary_url: appUrl(baseUrl, '/help'),
    ...fields,
  }
}

export function composeOfferReceivedDynamicData({ baseUrl, offer, listing, buyerProfile, sellerProfile }) {
  const buyerName = getProfileDisplayName(buyerProfile, 'A buyer')
  const listingTitle = listing?.title?.trim() || 'your listing'
  const offerAmount = formatPricePence(offer.amount_pence)
  const listingPrice = formatPricePence(listing?.price_pence)
  const recipientFirstName = getFirstName(sellerProfile, 'there')

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

export function composeOfferAcceptedDynamicData({ baseUrl, offer, listing, buyerProfile, sellerProfile }) {
  const sellerName = getProfileDisplayName(sellerProfile, 'The seller')
  const listingTitle = listing?.title?.trim() || 'your listing'
  const offerAmount = formatPricePence(offer.amount_pence)
  const recipientFirstName = getFirstName(buyerProfile, 'there')

  const detailRows = {
    'Your offer': offerAmount,
    Seller: sellerName,
    'Pay within': PAYMENT_DEADLINE_LABEL,
  }

  const body = `
    <p>Hi ${recipientFirstName},</p>
    <p><strong>${sellerName}</strong> accepted your offer on <strong>${listingTitle}</strong>.</p>
    ${detailRowsHtml(detailRows)}
    <p>Complete payment to secure the item. If payment is not completed in time, the offer may be cancelled.</p>
  `.trim()

  return layoutFields(baseUrl, {
    preheader: `${sellerName} accepted your ${offerAmount} offer. Complete payment within ${PAYMENT_DEADLINE_LABEL}.`,
    title: 'Offer accepted',
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
  const sellerName = getProfileDisplayName(sellerProfile, 'The seller')
  const recipientFirstName = getFirstName(buyerProfile, 'there')

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
  const buyerName = getProfileDisplayName(buyerProfile, 'The buyer')
  const recipientFirstName = getFirstName(sellerProfile, 'there')
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
    .select('id, display_name, username')
    .eq('id', userId)
    .maybeSingle()
  return data
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

  const [{ data: listing }, buyerProfile, sellerProfile] = await Promise.all([
    admin.from('listings').select('id, title, price_pence').eq('id', offer.listing_id).maybeSingle(),
    fetchProfile(admin, offer.buyer_id),
    fetchProfile(admin, offer.seller_id),
  ])

  return {
    ok: true,
    offer,
    listing,
    buyerProfile,
    sellerProfile,
  }
}

async function loadOrderContext(admin, orderId) {
  const { data: order, error } = await admin
    .from('orders')
    .select(
      'id, listing_id, buyer_id, seller_id, amount_pence, item_price_pence, buyer_total_pence, seller_service_fee_pence, seller_net_pence',
    )
    .eq('id', orderId)
    .maybeSingle()

  if (error || !order) {
    return { ok: false, error: error?.message || 'Order not found' }
  }

  const [{ data: listing }, buyerProfile, sellerProfile] = await Promise.all([
    admin.from('listings').select('id, title, price_pence').eq('id', order.listing_id).maybeSingle(),
    fetchProfile(admin, order.buyer_id),
    fetchProfile(admin, order.seller_id),
  ])

  return {
    ok: true,
    order,
    listing,
    buyerProfile,
    sellerProfile,
  }
}

export async function composeMarketplaceEmailDynamicData(eventKey, payload, getEnv) {
  const baseUrl = getEnv('APP_BASE_URL')?.trim() || getEnv('EQUIPD_APP_URL')?.trim() || 'https://equipd.co.uk'
  const admin = payload.admin

  if (eventKey === 'offer_received' || eventKey === 'offer_accepted') {
    const context = await loadOfferContext(admin, payload.offerId)
    if (!context.ok) return context

    const { offer, listing, buyerProfile, sellerProfile } = context

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

    if (offer.status !== 'accepted') {
      return { ok: false, skip: true, reason: 'offer_not_accepted' }
    }
    if ((offer.direction ?? 'buyer_to_seller') !== 'buyer_to_seller') {
      return { ok: false, skip: true, reason: 'not_buyer_to_seller' }
    }

    return {
      ok: true,
      templateKey: eventKey,
      recipientUserId: offer.buyer_id,
      relatedOfferId: offer.id,
      relatedListingId: offer.listing_id,
      idempotencyParts: { offerId: offer.id, buyerId: offer.buyer_id },
      dynamicData: composeOfferAcceptedDynamicData({
        baseUrl,
        offer,
        listing,
        buyerProfile,
        sellerProfile,
      }),
    }
  }

  if (eventKey === 'payment_successful' || eventKey === 'new_order_received') {
    const orderId = payload.orderId
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
