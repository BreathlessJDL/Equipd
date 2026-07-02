/**
 * SendGrid dynamic template keys → environment variable names.
 * Keep in sync with emails/templateConfig.js (re-export).
 *
 * Each env var holds the SendGrid template ID (e.g. d-xxxxxxxx).
 */

export const EMAIL_TEMPLATE_KEYS = {
  master_test: 'SENDGRID_TEMPLATE_MASTER_TEST',
  offer_received: 'SENDGRID_TEMPLATE_OFFER_RECEIVED',
  offer_accepted: 'SENDGRID_TEMPLATE_OFFER_ACCEPTED',
  payment_successful: 'SENDGRID_TEMPLATE_PAYMENT_SUCCESSFUL',
  new_order_received: 'SENDGRID_TEMPLATE_NEW_ORDER_RECEIVED',
  buyer_delivery_details_added: 'SENDGRID_TEMPLATE_BUYER_DELIVERY_DETAILS_ADDED',
  collection_confirmed: 'SENDGRID_TEMPLATE_COLLECTION_CONFIRMED',
  courier_dispatched: 'SENDGRID_TEMPLATE_COURIER_DISPATCHED',
  delivery_confirmed: 'SENDGRID_TEMPLATE_DELIVERY_CONFIRMED',
  buyer_protection_started: 'SENDGRID_TEMPLATE_BUYER_PROTECTION_STARTED',
  dispute_opened: 'SENDGRID_TEMPLATE_DISPUTE_OPENED',
  evidence_requested: 'SENDGRID_TEMPLATE_EVIDENCE_REQUESTED',
  return_authorised: 'SENDGRID_TEMPLATE_RETURN_AUTHORISED',
  collection_arranged: 'SENDGRID_TEMPLATE_COLLECTION_ARRANGED',
  refund_pending: 'SENDGRID_TEMPLATE_REFUND_PENDING',
  refund_completed_case_closed: 'SENDGRID_TEMPLATE_REFUND_COMPLETED_CASE_CLOSED',
  case_closed_no_refund: 'SENDGRID_TEMPLATE_CASE_CLOSED_NO_REFUND',
  review_available: 'SENDGRID_TEMPLATE_REVIEW_AVAILABLE',
  review_received: 'SENDGRID_TEMPLATE_REVIEW_RECEIVED',
  payout_released: 'SENDGRID_TEMPLATE_PAYOUT_RELEASED',
  seller_onboarding_required: 'SENDGRID_TEMPLATE_SELLER_ONBOARDING_REQUIRED',
  welcome: 'SENDGRID_TEMPLATE_WELCOME',
  email_changed: 'SENDGRID_TEMPLATE_EMAIL_CHANGED',
  password_changed: 'SENDGRID_TEMPLATE_PASSWORD_CHANGED',
}

/** Required dynamic_template_data fields per template (expand as templates are built). */
const LAYOUT_REQUIRED_FIELDS = ['subject', 'preheader', 'title', 'body', 'cta_text', 'cta_url']

/** Fields used server-side to compose body HTML (also sent if useful for SendGrid analytics). */
export const EMAIL_TEMPLATE_CONTENT_FIELDS = {
  offer_received: [
    'recipient_first_name',
    'buyer_name',
    'listing_title',
    'offer_amount',
    'listing_price',
    'offer_id',
  ],
  offer_accepted: [
    'recipient_first_name',
    'seller_name',
    'listing_title',
    'offer_amount',
    'payment_deadline',
    'offer_id',
  ],
  payment_successful: [
    'recipient_first_name',
    'order_id',
    'order_number',
    'listing_title',
    'order_total',
    'seller_name',
  ],
  new_order_received: [
    'recipient_first_name',
    'order_id',
    'order_number',
    'listing_title',
    'order_total',
    'buyer_name',
  ],
  buyer_delivery_details_added: [
    'recipient_first_name',
    'buyer_name',
    'listing_title',
    'order_id',
    'order_number',
    'delivery_contact_name',
  ],
  collection_confirmed: [
    'recipient_first_name',
    'listing_title',
    'order_id',
    'order_number',
    'counterparty_name',
    'fulfilment_label',
  ],
  courier_dispatched: [
    'recipient_first_name',
    'listing_title',
    'order_id',
    'order_number',
    'seller_name',
    'courier_name',
    'courier_company',
  ],
  delivery_confirmed: [
    'recipient_first_name',
    'listing_title',
    'order_id',
    'order_number',
    'counterparty_name',
    'buyer_tracking_reference',
  ],
  buyer_protection_started: [
    'recipient_first_name',
    'listing_title',
    'order_id',
    'order_number',
    'protection_hours',
    'protection_ends_at',
  ],
  dispute_opened: [
    'recipient_first_name',
    'listing_title',
    'order_id',
    'order_number',
    'counterparty_name',
  ],
  evidence_requested: ['recipient_first_name', 'listing_title', 'order_id', 'order_number'],
  return_authorised: [
    'recipient_first_name',
    'listing_title',
    'order_id',
    'order_number',
    'counterparty_name',
  ],
  collection_arranged: [
    'recipient_first_name',
    'listing_title',
    'order_id',
    'order_number',
    'collection_date',
  ],
  refund_pending: ['recipient_first_name', 'listing_title', 'order_id', 'order_number'],
  refund_completed_case_closed: [
    'recipient_first_name',
    'listing_title',
    'order_id',
    'order_number',
  ],
  case_closed_no_refund: ['recipient_first_name', 'listing_title', 'order_id', 'order_number'],
  review_available: [
    'recipient_first_name',
    'listing_title',
    'order_id',
    'order_number',
    'seller_name',
  ],
  review_received: [
    'recipient_first_name',
    'listing_title',
    'order_id',
    'order_number',
    'reviewer_name',
    'review_rating',
  ],
  payout_released: [
    'recipient_first_name',
    'listing_title',
    'order_id',
    'order_number',
    'seller_service_fee',
    'seller_net_payout',
  ],
  seller_onboarding_required: [
    'recipient_first_name',
    'listing_title',
    'order_id',
    'order_number',
  ],
  welcome: ['recipient_first_name'],
  email_changed: ['recipient_first_name', 'new_email'],
  password_changed: ['recipient_first_name'],
}

export const EMAIL_TEMPLATE_REQUIRED_FIELDS = {
  master_test: ['title', 'preheader', 'body'],
  offer_received: LAYOUT_REQUIRED_FIELDS,
  offer_accepted: LAYOUT_REQUIRED_FIELDS,
  payment_successful: LAYOUT_REQUIRED_FIELDS,
  new_order_received: LAYOUT_REQUIRED_FIELDS,
  buyer_delivery_details_added: LAYOUT_REQUIRED_FIELDS,
  collection_confirmed: LAYOUT_REQUIRED_FIELDS,
  courier_dispatched: LAYOUT_REQUIRED_FIELDS,
  delivery_confirmed: LAYOUT_REQUIRED_FIELDS,
  buyer_protection_started: LAYOUT_REQUIRED_FIELDS,
  dispute_opened: LAYOUT_REQUIRED_FIELDS,
  evidence_requested: LAYOUT_REQUIRED_FIELDS,
  return_authorised: LAYOUT_REQUIRED_FIELDS,
  collection_arranged: LAYOUT_REQUIRED_FIELDS,
  refund_pending: LAYOUT_REQUIRED_FIELDS,
  refund_completed_case_closed: LAYOUT_REQUIRED_FIELDS,
  case_closed_no_refund: LAYOUT_REQUIRED_FIELDS,
  review_available: LAYOUT_REQUIRED_FIELDS,
  review_received: LAYOUT_REQUIRED_FIELDS,
  payout_released: LAYOUT_REQUIRED_FIELDS,
  seller_onboarding_required: LAYOUT_REQUIRED_FIELDS,
  welcome: LAYOUT_REQUIRED_FIELDS,
  email_changed: LAYOUT_REQUIRED_FIELDS,
  password_changed: LAYOUT_REQUIRED_FIELDS,
}

export function listEmailTemplateKeys() {
  return Object.keys(EMAIL_TEMPLATE_KEYS)
}

export function isEmailTemplateKey(value) {
  return typeof value === 'string' && value in EMAIL_TEMPLATE_KEYS
}

export function getTemplateEnvVarName(templateKey) {
  return EMAIL_TEMPLATE_KEYS[templateKey] ?? null
}
