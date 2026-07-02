import { resolveAppBaseUrl } from '../supabase/functions/_shared/transactionalEmailCore.js'
import {
  composeCaseClosedNoRefundDynamicData,
  composeCollectionArrangedDynamicData,
  composeDisputeOpenedDynamicData,
  composeEmailChangedDynamicData,
  composeEvidenceRequestedDynamicData,
  composePasswordChangedDynamicData,
  composePayoutReleasedDynamicData,
  composeRefundCompletedCaseClosedDynamicData,
  composeRefundPendingDynamicData,
  composeReturnAuthorisedDynamicData,
  composeReviewAvailableDynamicData,
  composeReviewReceivedDynamicData,
  composeSellerOnboardingRequiredDynamicData,
  composeWelcomeDynamicData,
} from '../supabase/functions/_shared/marketplaceEmailComposePhase5.js'
import {
  assertBuyerEmailSafe,
  formatOrderReference,
  formatPricePence,
  getMarketplaceRecipientName,
  getMarketplaceUserName,
} from '../supabase/functions/_shared/marketplaceEmailCore.js'

const SELLER_SERVICE_FEE_RATE = 0.02

function calculateSellerServiceFee(itemPricePence) {
  if (!itemPricePence || itemPricePence <= 0) return 0
  return Math.round(itemPricePence * SELLER_SERVICE_FEE_RATE)
}

function calculateSellerNetPayout(itemPricePence) {
  if (!itemPricePence || itemPricePence <= 0) return 0
  return Math.max(0, itemPricePence - calculateSellerServiceFee(itemPricePence))
}

export const REMAINING_EMAIL_TEMPLATE_KEYS = [
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

export function isRemainingEmailTemplateKey(templateKey) {
  return REMAINING_EMAIL_TEMPLATE_KEYS.includes(templateKey)
}

export const REMAINING_TEST_BUYER_PROFILE = {
  username: 'jamesgym',
  display_name: 'James Carter',
  email: 'buyer.test@example.com',
}

export const REMAINING_TEST_SELLER_PROFILE = {
  username: 'sarahlifts',
  display_name: 'Sarah Mitchell',
  email: 'seller.test@example.com',
}

export const REMAINING_TEST_LISTING = { title: 'Rogue Ohio Bar — 20kg' }

export const REMAINING_TEST_ORDER_ID = '33333333-3333-3333-3333-333333333333'

const helpers = {
  formatOrderReference,
  formatPricePence,
  getMarketplaceUserName,
  getMarketplaceRecipientName,
  assertBuyerEmailSafe,
  calculateSellerServiceFee,
  calculateSellerNetPayout,
}

const orderBase = {
  id: REMAINING_TEST_ORDER_ID,
  amount_pence: 42500,
  item_price_pence: 42500,
  seller_service_fee_pence: 850,
  seller_net_pence: 41650,
  payout_status: 'paid',
  fulfilment_status: 'completed',
}

/**
 * Build production-parity dynamic_template_data for manual SendGrid tests.
 */
export function buildRemainingTestDynamicData(templateKey, getEnv = (key) => process.env[key] ?? '', options = {}) {
  const baseUrl = resolveAppBaseUrl(getEnv)
  const order = orderBase
  const listing = REMAINING_TEST_LISTING
  const buyerProfile = REMAINING_TEST_BUYER_PROFILE
  const sellerProfile = REMAINING_TEST_SELLER_PROFILE
  const baseArgs = { baseUrl, order, listing, buyerProfile, sellerProfile, helpers }
  const recipientRole = options.recipientRole ?? 'buyer'

  switch (templateKey) {
    case 'dispute_opened':
      return composeDisputeOpenedDynamicData({ ...baseArgs, recipientRole: options.recipientRole ?? 'seller' })
    case 'evidence_requested':
      return composeEvidenceRequestedDynamicData({
        ...baseArgs,
        recipientProfile: recipientRole === 'seller' ? sellerProfile : buyerProfile,
      })
    case 'return_authorised':
      return composeReturnAuthorisedDynamicData({ ...baseArgs, recipientRole })
    case 'collection_arranged':
      return composeCollectionArrangedDynamicData({
        ...baseArgs,
        recipientRole,
        collectionDate: '5 Jul 2026',
      })
    case 'refund_pending':
      return composeRefundPendingDynamicData({ ...baseArgs, recipientRole })
    case 'refund_completed_case_closed':
      return composeRefundCompletedCaseClosedDynamicData({ ...baseArgs, recipientRole })
    case 'case_closed_no_refund':
      return composeCaseClosedNoRefundDynamicData({ ...baseArgs, recipientRole })
    case 'review_available':
      return composeReviewAvailableDynamicData(baseArgs)
    case 'review_received':
      return composeReviewReceivedDynamicData({
        baseUrl,
        order,
        listing,
        reviewerProfile: buyerProfile,
        reviewedProfile: sellerProfile,
        review: { rating: 5 },
        helpers,
      })
    case 'payout_released':
      return composePayoutReleasedDynamicData({ baseUrl, order, listing, sellerProfile, helpers })
    case 'seller_onboarding_required':
      return composeSellerOnboardingRequiredDynamicData({ baseUrl, order, listing, sellerProfile, helpers })
    case 'welcome':
      return composeWelcomeDynamicData({ baseUrl, profile: buyerProfile, helpers })
    case 'email_changed':
      return composeEmailChangedDynamicData({
        baseUrl,
        profile: buyerProfile,
        newEmail: 'new.email@example.com',
        helpers,
      })
    case 'password_changed':
      return composePasswordChangedDynamicData({ baseUrl, profile: buyerProfile, helpers })
    default:
      return null
  }
}
