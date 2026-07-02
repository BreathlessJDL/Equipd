import { appUrl, detailRowsHtml } from './emailFormatting.js'

function layoutFields(baseUrl, fields) {
  return {
    tagline: 'The UK marketplace for used gym equipment.',
    secondary_text: 'Visit the Help Centre',
    secondary_url: appUrl(baseUrl, '/help'),
    ...fields,
  }
}

export const PHASE5_CASE_EMAIL_EVENT_KEYS = new Set([
  'dispute_opened',
  'evidence_requested',
  'return_authorised',
  'collection_arranged',
  'refund_pending',
  'refund_completed_case_closed',
  'case_closed_no_refund',
])

export const PHASE5_DUAL_RECIPIENT_EVENT_KEYS = new Set([
  'dispute_opened',
  'return_authorised',
  'collection_arranged',
  'refund_pending',
  'refund_completed_case_closed',
  'case_closed_no_refund',
])

export const PHASE5_ORDER_EMAIL_EVENT_KEYS = new Set([
  'review_available',
  'review_received',
  'payout_released',
  'seller_onboarding_required',
])

export const PHASE5_ACCOUNT_EMAIL_EVENT_KEYS = new Set([
  'welcome',
  'email_changed',
  'password_changed',
])

export function composePhase5EmailSubject(eventKey, listingTitle, options = {}) {
  const title = listingTitle?.trim() || 'your listing'
  const itemTitle = listingTitle?.trim() || 'your item'
  const { recipientRole } = options

  switch (eventKey) {
    case 'dispute_opened':
      return recipientRole === 'buyer'
        ? `Your dispute for ${itemTitle} has been opened`
        : `Buyer reported a problem with ${title}`
    case 'evidence_requested':
      return `More evidence needed for ${itemTitle}`
    case 'return_authorised':
      return `Return authorised for ${itemTitle}`
    case 'collection_arranged':
      return `Return collection arranged for ${itemTitle}`
    case 'refund_pending':
      return `Refund approved for ${itemTitle}`
    case 'refund_completed_case_closed':
      return `Refund completed for ${itemTitle}`
    case 'case_closed_no_refund':
      return `Case closed for ${itemTitle}`
    case 'review_available':
      return `Leave a review for ${itemTitle}`
    case 'review_received':
      return `You received a review on ${itemTitle}`
    case 'payout_released':
      return `Payout released for ${title}`
    case 'seller_onboarding_required':
      return `Complete payout setup for ${title}`
    case 'welcome':
      return 'Welcome to Equipd'
    case 'email_changed':
      return 'Your Equipd email address was updated'
    case 'password_changed':
      return 'Your Equipd password was updated'
    default:
      return ''
  }
}

export function composeDisputeOpenedDynamicData({
  baseUrl,
  order,
  listing,
  buyerProfile,
  sellerProfile,
  recipientRole,
  helpers,
}) {
  const listingTitle = listing?.title?.trim() || 'your item'
  const orderNumber = helpers.formatOrderReference(order.id)
  const buyerName = helpers.getMarketplaceUserName(buyerProfile, { fallback: 'The buyer' })
  const sellerName = helpers.getMarketplaceUserName(sellerProfile, { fallback: 'The seller' })
  const isBuyer = recipientRole === 'buyer'
  const recipientProfile = isBuyer ? buyerProfile : sellerProfile
  const counterpartyName = isBuyer ? sellerName : buyerName
  const recipientFirstName = helpers.getMarketplaceRecipientName(recipientProfile, { fallback: 'there' })

  const body = isBuyer
    ? `
    <p>Hi ${recipientFirstName},</p>
    <p>Your dispute for <strong>${listingTitle}</strong> has been opened. Equipd will review the issue before any payout is released.</p>
    ${detailRowsHtml({ 'Order number': orderNumber, Seller: counterpartyName })}
    <p>Open the order to upload evidence and follow case updates.</p>
  `.trim()
    : `
    <p>Hi ${recipientFirstName},</p>
    <p><strong>${counterpartyName}</strong> has reported a problem with <strong>${listingTitle}</strong>.</p>
    ${detailRowsHtml({ 'Order number': orderNumber, Buyer: counterpartyName })}
    <p>Payout is on hold while Equipd reviews the issue. Open the order for case updates.</p>
  `.trim()

  const dynamicData = layoutFields(baseUrl, {
    subject: composePhase5EmailSubject('dispute_opened', listingTitle, { recipientRole }),
    preheader: isBuyer
      ? `Your dispute for ${listingTitle} has been opened.`
      : `Buyer reported a problem with ${listingTitle}.`,
    title: isBuyer ? 'Dispute opened' : 'Buyer reported a problem',
    subtitle: 'A Buyer Protection case has been opened.',
    body,
    cta_text: 'View order',
    cta_url: appUrl(baseUrl, `/orders/${order.id}`),
    recipient_first_name: recipientFirstName,
    listing_title: listingTitle,
    order_id: order.id,
    order_number: orderNumber,
    counterparty_name: counterpartyName,
  })

  if (isBuyer) {
    helpers.assertBuyerEmailSafe(dynamicData)
  }

  return dynamicData
}

export function composeEvidenceRequestedDynamicData({
  baseUrl,
  order,
  listing,
  recipientProfile,
  helpers,
}) {
  const listingTitle = listing?.title?.trim() || 'your item'
  const orderNumber = helpers.formatOrderReference(order.id)
  const recipientFirstName = helpers.getMarketplaceRecipientName(recipientProfile, { fallback: 'there' })

  const body = `
    <p>Hi ${recipientFirstName},</p>
    <p>Equipd needs more evidence from you for <strong>${listingTitle}</strong> before this case can be resolved.</p>
    ${detailRowsHtml({ 'Order number': orderNumber })}
    <p>Upload supporting photos or documents in your order case as soon as you can.</p>
  `.trim()

  const dynamicData = layoutFields(baseUrl, {
    subject: composePhase5EmailSubject('evidence_requested', listingTitle),
    preheader: `More evidence needed for ${listingTitle}.`,
    title: 'More evidence needed',
    subtitle: 'Equipd has requested additional information.',
    body,
    cta_text: 'View case',
    cta_url: appUrl(baseUrl, `/orders/${order.id}`),
    recipient_first_name: recipientFirstName,
    listing_title: listingTitle,
    order_id: order.id,
    order_number: orderNumber,
  })

  helpers.assertBuyerEmailSafe(dynamicData)
  return dynamicData
}

export function composeReturnAuthorisedDynamicData({
  baseUrl,
  order,
  listing,
  buyerProfile,
  sellerProfile,
  recipientRole,
  helpers,
}) {
  const listingTitle = listing?.title?.trim() || 'your item'
  const orderNumber = helpers.formatOrderReference(order.id)
  const buyerName = helpers.getMarketplaceUserName(buyerProfile, { fallback: 'The buyer' })
  const sellerName = helpers.getMarketplaceUserName(sellerProfile, { fallback: 'The seller' })
  const isBuyer = recipientRole === 'buyer'
  const recipientProfile = isBuyer ? buyerProfile : sellerProfile
  const counterpartyName = isBuyer ? sellerName : buyerName
  const recipientFirstName = helpers.getMarketplaceRecipientName(recipientProfile, { fallback: 'there' })

  const body = isBuyer
    ? `
    <p>Hi ${recipientFirstName},</p>
    <p>Equipd has authorised a return for <strong>${listingTitle}</strong>.</p>
    ${detailRowsHtml({ 'Order number': orderNumber, Seller: counterpartyName })}
    <p>The seller must arrange and pay for collection within 7 calendar days. Make the equipment reasonably available for collection.</p>
  `.trim()
    : `
    <p>Hi ${recipientFirstName},</p>
    <p>Equipd has authorised a return for <strong>${listingTitle}</strong>.</p>
    ${detailRowsHtml({ 'Order number': orderNumber, Buyer: counterpartyName })}
    <p>You must arrange and pay for collection within 7 calendar days. The buyer will make the equipment reasonably available.</p>
  `.trim()

  const dynamicData = layoutFields(baseUrl, {
    subject: composePhase5EmailSubject('return_authorised', listingTitle),
    preheader: `Return authorised for ${listingTitle}.`,
    title: 'Return authorised',
    subtitle: 'Next steps for equipment collection.',
    body,
    cta_text: 'View case',
    cta_url: appUrl(baseUrl, `/orders/${order.id}`),
    recipient_first_name: recipientFirstName,
    listing_title: listingTitle,
    order_id: order.id,
    order_number: orderNumber,
    counterparty_name: counterpartyName,
  })

  if (isBuyer) {
    helpers.assertBuyerEmailSafe(dynamicData)
  }

  return dynamicData
}

export function composeCollectionArrangedDynamicData({
  baseUrl,
  order,
  listing,
  buyerProfile,
  sellerProfile,
  recipientRole,
  collectionDate,
  helpers,
}) {
  const listingTitle = listing?.title?.trim() || 'your item'
  const orderNumber = helpers.formatOrderReference(order.id)
  const isBuyer = recipientRole === 'buyer'
  const recipientProfile = isBuyer ? buyerProfile : sellerProfile
  const recipientFirstName = helpers.getMarketplaceRecipientName(recipientProfile, { fallback: 'there' })
  const collection_date = collectionDate?.trim() || '—'

  const body = `
    <p>Hi ${recipientFirstName},</p>
    <p>Return collection has been arranged for <strong>${listingTitle}</strong>.</p>
    ${detailRowsHtml({ 'Order number': orderNumber, 'Collection date': collection_date })}
    <p>${isBuyer ? 'Please make the equipment available for collection on the agreed date.' : 'Collect the equipment on the agreed date and confirm handover in the order.'}</p>
  `.trim()

  const dynamicData = layoutFields(baseUrl, {
    subject: composePhase5EmailSubject('collection_arranged', listingTitle),
    preheader: `Return collection arranged for ${listingTitle}.`,
    title: 'Return collection arranged',
    subtitle: 'Collection details are confirmed.',
    body,
    cta_text: 'View case',
    cta_url: appUrl(baseUrl, `/orders/${order.id}`),
    recipient_first_name: recipientFirstName,
    listing_title: listingTitle,
    order_id: order.id,
    order_number: orderNumber,
    collection_date,
  })

  if (isBuyer) {
    helpers.assertBuyerEmailSafe(dynamicData)
  }

  return dynamicData
}

export function composeRefundPendingDynamicData({
  baseUrl,
  order,
  listing,
  buyerProfile,
  sellerProfile,
  recipientRole,
  helpers,
}) {
  const listingTitle = listing?.title?.trim() || 'your item'
  const orderNumber = helpers.formatOrderReference(order.id)
  const isBuyer = recipientRole === 'buyer'
  const recipientProfile = isBuyer ? buyerProfile : sellerProfile
  const recipientFirstName = helpers.getMarketplaceRecipientName(recipientProfile, { fallback: 'there' })

  const body = isBuyer
    ? `
    <p>Hi ${recipientFirstName},</p>
    <p>A refund for <strong>${listingTitle}</strong> has been approved and is being processed.</p>
    ${detailRowsHtml({ 'Order number': orderNumber })}
    <p>Funds will return according to your payment provider timelines. No further action is required unless Equipd contacts you.</p>
  `.trim()
    : `
    <p>Hi ${recipientFirstName},</p>
    <p>A refund for <strong>${listingTitle}</strong> has been approved and is being processed.</p>
    ${detailRowsHtml({ 'Order number': orderNumber })}
    <p>Payout for this order is on hold while the refund is processed. Open the order for case updates.</p>
  `.trim()

  const dynamicData = layoutFields(baseUrl, {
    subject: composePhase5EmailSubject('refund_pending', listingTitle),
    preheader: `Refund approved for ${listingTitle} — processing.`,
    title: 'Refund approved',
    subtitle: 'Your refund is being processed.',
    body,
    cta_text: 'View case',
    cta_url: appUrl(baseUrl, `/orders/${order.id}`),
    recipient_first_name: recipientFirstName,
    listing_title: listingTitle,
    order_id: order.id,
    order_number: orderNumber,
  })

  if (isBuyer) {
    helpers.assertBuyerEmailSafe(dynamicData)
  }

  return dynamicData
}

export function composeRefundCompletedCaseClosedDynamicData({
  baseUrl,
  order,
  listing,
  buyerProfile,
  sellerProfile,
  recipientRole,
  helpers,
}) {
  const listingTitle = listing?.title?.trim() || 'your item'
  const orderNumber = helpers.formatOrderReference(order.id)
  const isBuyer = recipientRole === 'buyer'
  const recipientProfile = isBuyer ? buyerProfile : sellerProfile
  const recipientFirstName = helpers.getMarketplaceRecipientName(recipientProfile, { fallback: 'there' })

  const body = isBuyer
    ? `
    <p>Hi ${recipientFirstName},</p>
    <p>The refund for <strong>${listingTitle}</strong> has been completed and your Buyer Protection case is now closed.</p>
    ${detailRowsHtml({ 'Order number': orderNumber })}
    <p>Funds should appear according to your payment provider timelines. Open the order if you need the full case history.</p>
  `.trim()
    : `
    <p>Hi ${recipientFirstName},</p>
    <p>The refund for <strong>${listingTitle}</strong> has been completed and the Buyer Protection case is now closed.</p>
    ${detailRowsHtml({ 'Order number': orderNumber })}
    <p>Open the order for the full case outcome and history.</p>
  `.trim()

  const dynamicData = layoutFields(baseUrl, {
    subject: composePhase5EmailSubject('refund_completed_case_closed', listingTitle),
    preheader: `Refund completed and case closed for ${listingTitle}.`,
    title: 'Refund completed',
    subtitle: 'Your case has been closed.',
    body,
    cta_text: 'View order',
    cta_url: appUrl(baseUrl, `/orders/${order.id}`),
    recipient_first_name: recipientFirstName,
    listing_title: listingTitle,
    order_id: order.id,
    order_number: orderNumber,
  })

  if (isBuyer) {
    helpers.assertBuyerEmailSafe(dynamicData)
  }

  return dynamicData
}

export function composeCaseClosedNoRefundDynamicData({
  baseUrl,
  order,
  listing,
  buyerProfile,
  sellerProfile,
  recipientRole,
  helpers,
}) {
  const listingTitle = listing?.title?.trim() || 'your item'
  const orderNumber = helpers.formatOrderReference(order.id)
  const isBuyer = recipientRole === 'buyer'
  const recipientProfile = isBuyer ? buyerProfile : sellerProfile
  const recipientFirstName = helpers.getMarketplaceRecipientName(recipientProfile, { fallback: 'there' })

  const body = `
    <p>Hi ${recipientFirstName},</p>
    <p>Your Buyer Protection case for <strong>${listingTitle}</strong> has been closed.</p>
    ${detailRowsHtml({ 'Order number': orderNumber })}
    <p>No refund was issued for this case. Open the order for the full outcome and any next steps.</p>
  `.trim()

  const dynamicData = layoutFields(baseUrl, {
    subject: composePhase5EmailSubject('case_closed_no_refund', listingTitle),
    preheader: `Case closed for ${listingTitle}.`,
    title: 'Case closed',
    subtitle: 'This case has been resolved.',
    body,
    cta_text: 'View order',
    cta_url: appUrl(baseUrl, `/orders/${order.id}`),
    recipient_first_name: recipientFirstName,
    listing_title: listingTitle,
    order_id: order.id,
    order_number: orderNumber,
  })

  if (isBuyer) {
    helpers.assertBuyerEmailSafe(dynamicData)
  }

  return dynamicData
}

export function composeReviewAvailableDynamicData({
  baseUrl,
  order,
  listing,
  buyerProfile,
  sellerProfile,
  helpers,
}) {
  const listingTitle = listing?.title?.trim() || 'your item'
  const orderNumber = helpers.formatOrderReference(order.id)
  const sellerName = helpers.getMarketplaceUserName(sellerProfile, { fallback: 'The seller' })
  const recipientFirstName = helpers.getMarketplaceRecipientName(buyerProfile, { fallback: 'there' })

  const body = `
    <p>Hi ${recipientFirstName},</p>
    <p>Your order for <strong>${listingTitle}</strong> is complete.</p>
    ${detailRowsHtml({ 'Order number': orderNumber, Seller: sellerName })}
    <p>Leave a review to help other buyers and recognise a great seller experience.</p>
  `.trim()

  const dynamicData = layoutFields(baseUrl, {
    subject: composePhase5EmailSubject('review_available', listingTitle),
    preheader: `Leave a review for ${listingTitle}.`,
    title: 'Leave a review',
    subtitle: 'Your order is complete.',
    body,
    cta_text: 'Leave review',
    cta_url: appUrl(baseUrl, `/orders/${order.id}`),
    recipient_first_name: recipientFirstName,
    listing_title: listingTitle,
    order_id: order.id,
    order_number: orderNumber,
    seller_name: sellerName,
  })

  helpers.assertBuyerEmailSafe(dynamicData)
  return dynamicData
}

export function composeReviewReceivedDynamicData({
  baseUrl,
  order,
  listing,
  reviewerProfile,
  reviewedProfile,
  review,
  helpers,
}) {
  const listingTitle = listing?.title?.trim() || 'your item'
  const orderNumber = helpers.formatOrderReference(order.id)
  const reviewerName = helpers.getMarketplaceUserName(reviewerProfile, { fallback: 'An Equipd member' })
  const recipientFirstName = helpers.getMarketplaceRecipientName(reviewedProfile, { fallback: 'there' })
  const reviewRating = String(review?.rating ?? '—')

  const body = `
    <p>Hi ${recipientFirstName},</p>
    <p><strong>${reviewerName}</strong> left you a <strong>${reviewRating}-star</strong> review on <strong>${listingTitle}</strong>.</p>
    ${detailRowsHtml({ 'Order number': orderNumber, Rating: `${reviewRating} stars` })}
    <p>Open the order to read the full review.</p>
  `.trim()

  const dynamicData = layoutFields(baseUrl, {
    subject: composePhase5EmailSubject('review_received', listingTitle),
    preheader: `${reviewerName} left you a review on ${listingTitle}.`,
    title: 'You received a review',
    subtitle: 'Someone reviewed your completed order.',
    body,
    cta_text: 'View review',
    cta_url: appUrl(baseUrl, `/orders/${order.id}`),
    recipient_first_name: recipientFirstName,
    listing_title: listingTitle,
    order_id: order.id,
    order_number: orderNumber,
    reviewer_name: reviewerName,
    review_rating: reviewRating,
  })

  helpers.assertBuyerEmailSafe(dynamicData)
  return dynamicData
}

export function composePayoutReleasedDynamicData({
  baseUrl,
  order,
  listing,
  sellerProfile,
  helpers,
}) {
  const listingTitle = listing?.title?.trim() || 'your listing'
  const orderNumber = helpers.formatOrderReference(order.id)
  const recipientFirstName = helpers.getMarketplaceRecipientName(sellerProfile, { fallback: 'there' })
  const sellerServiceFeePence =
    order.seller_service_fee_pence ?? helpers.calculateSellerServiceFee(order.item_price_pence ?? order.amount_pence)
  const sellerNetPence =
    order.seller_net_pence ?? helpers.calculateSellerNetPayout(order.item_price_pence ?? order.amount_pence)
  const sellerServiceFee = helpers.formatPricePence(sellerServiceFeePence)
  const sellerNetPayout = helpers.formatPricePence(sellerNetPence)

  const body = `
    <p>Hi ${recipientFirstName},</p>
    <p>Your payout for <strong>${listingTitle}</strong> has been released.</p>
    ${detailRowsHtml({
      'Order number': orderNumber,
      'Seller Service Fee': sellerServiceFee,
      "You'll receive": sellerNetPayout,
    })}
    <p>Funds are on the way to your connected payout account. Open the order for full details.</p>
  `.trim()

  return layoutFields(baseUrl, {
    subject: composePhase5EmailSubject('payout_released', listingTitle),
    preheader: `Payout released for ${listingTitle}.`,
    title: 'Payout released',
    subtitle: 'Your seller payout has been released.',
    body,
    cta_text: 'View order',
    cta_url: appUrl(baseUrl, `/orders/${order.id}`),
    recipient_first_name: recipientFirstName,
    listing_title: listingTitle,
    order_id: order.id,
    order_number: orderNumber,
    seller_service_fee: sellerServiceFee,
    seller_net_payout: sellerNetPayout,
  })
}

export function composeSellerOnboardingRequiredDynamicData({
  baseUrl,
  order,
  listing,
  sellerProfile,
  helpers,
}) {
  const listingTitle = listing?.title?.trim() || 'your listing'
  const orderNumber = helpers.formatOrderReference(order.id)
  const recipientFirstName = helpers.getMarketplaceRecipientName(sellerProfile, { fallback: 'there' })

  const body = `
    <p>Hi ${recipientFirstName},</p>
    <p>You have a paid order for <strong>${listingTitle}</strong>, but your payout account setup is not complete.</p>
    <p>Complete Stripe Connect onboarding in your Hub so Equipd can release your payout when the order completes.</p>
  `.trim()

  return layoutFields(baseUrl, {
    subject: composePhase5EmailSubject('seller_onboarding_required', listingTitle),
    preheader: `Complete payout setup to receive funds for ${listingTitle}.`,
    title: 'Complete payout setup',
    subtitle: 'Stripe Connect onboarding is required.',
    body,
    cta_text: 'Complete setup',
    cta_url: appUrl(baseUrl, '/hub?section=selling&tab=payouts'),
    recipient_first_name: recipientFirstName,
    listing_title: listingTitle,
    order_id: order.id,
    order_number: orderNumber,
  })
}

export function composeWelcomeDynamicData({ baseUrl, profile, helpers }) {
  const recipientFirstName = helpers.getMarketplaceRecipientName(profile, { fallback: 'there' })

  const body = `
    <p>Hi ${recipientFirstName},</p>
    <p>Welcome to Equipd — the UK marketplace for used gym equipment.</p>
    <p>Browse listings, make offers, and buy or sell with Buyer Protection on every order.</p>
  `.trim()

  const dynamicData = layoutFields(baseUrl, {
    subject: composePhase5EmailSubject('welcome'),
    preheader: 'Welcome to Equipd.',
    title: 'Welcome to Equipd',
    subtitle: 'Your account is ready.',
    body,
    cta_text: 'Start browsing',
    cta_url: appUrl(baseUrl, '/browse'),
    recipient_first_name: recipientFirstName,
  })

  helpers.assertBuyerEmailSafe(dynamicData)
  return dynamicData
}

export function composeEmailChangedDynamicData({ baseUrl, profile, newEmail, helpers }) {
  const recipientFirstName = helpers.getMarketplaceRecipientName(profile, { fallback: 'there' })
  const email = newEmail?.trim() || 'your new email address'

  const body = `
    <p>Hi ${recipientFirstName},</p>
    <p>Your Equipd account email address was changed to <strong>${email}</strong>.</p>
    <p>If you did not make this change, contact Equipd Support immediately.</p>
  `.trim()

  const dynamicData = layoutFields(baseUrl, {
    subject: composePhase5EmailSubject('email_changed'),
    preheader: 'Your Equipd email address was updated.',
    title: 'Email address updated',
    subtitle: 'Your sign-in email has changed.',
    body,
    cta_text: 'Account settings',
    cta_url: appUrl(baseUrl, '/settings'),
    recipient_first_name: recipientFirstName,
    new_email: email,
  })

  helpers.assertBuyerEmailSafe(dynamicData)
  return dynamicData
}

export function composePasswordChangedDynamicData({ baseUrl, profile, helpers }) {
  const recipientFirstName = helpers.getMarketplaceRecipientName(profile, { fallback: 'there' })

  const body = `
    <p>Hi ${recipientFirstName},</p>
    <p>Your Equipd account password was changed successfully.</p>
    <p>If you did not make this change, reset your password and contact Equipd Support immediately.</p>
  `.trim()

  const dynamicData = layoutFields(baseUrl, {
    subject: composePhase5EmailSubject('password_changed'),
    preheader: 'Your Equipd password was updated.',
    title: 'Password updated',
    subtitle: 'Your account password has changed.',
    body,
    cta_text: 'Account settings',
    cta_url: appUrl(baseUrl, '/settings'),
    recipient_first_name: recipientFirstName,
  })

  helpers.assertBuyerEmailSafe(dynamicData)
  return dynamicData
}

export function buildPhase5IdempotencyKey(eventKey, parts) {
  switch (eventKey) {
    case 'dispute_opened':
      return `dispute_opened:${parts.disputeId}:${parts.recipientUserId}`
    case 'evidence_requested':
      return `evidence_requested:${parts.disputeId}:${parts.recipientUserId}:${parts.caseUpdateId}`
    case 'return_authorised':
      return `return_authorised:${parts.disputeId}:${parts.recipientUserId}`
    case 'collection_arranged':
      return `collection_arranged:${parts.disputeId}:${parts.recipientUserId}`
    case 'refund_pending':
      return `refund_pending:${parts.disputeId}:${parts.recipientUserId}`
    case 'refund_completed_case_closed':
      return `refund_completed_case_closed:${parts.disputeId}:${parts.recipientUserId}`
    case 'case_closed_no_refund':
      return `case_closed_no_refund:${parts.disputeId}:${parts.recipientUserId}`
    case 'review_available':
      return `review_available:${parts.orderId}:${parts.buyerId}`
    case 'review_received':
      return `review_received:${parts.reviewId}:${parts.reviewedUserId}`
    case 'payout_released':
      return `payout_released:${parts.orderId}:${parts.sellerId}`
    case 'seller_onboarding_required':
      return `seller_onboarding_required:${parts.orderId}:${parts.sellerId}`
    case 'welcome':
      return `welcome:${parts.userId}`
    case 'email_changed':
      return `email_changed:${parts.userId}:${parts.newEmail}`
    case 'password_changed':
      return `password_changed:${parts.userId}:${parts.changedAt}`
    default:
      return `${eventKey}:${parts.entityId ?? 'unknown'}`
  }
}
