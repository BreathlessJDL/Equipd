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
  refund_completed: 'SENDGRID_TEMPLATE_REFUND_COMPLETED',
  case_closed: 'SENDGRID_TEMPLATE_CASE_CLOSED',
  payout_released: 'SENDGRID_TEMPLATE_PAYOUT_RELEASED',
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
  dispute_opened: ['title', 'preheader', 'body'],
  refund_completed: ['title', 'preheader', 'body'],
  case_closed: ['title', 'preheader', 'body'],
  payout_released: ['title', 'preheader', 'body'],
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
