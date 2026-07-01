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
  dispute_opened: 'SENDGRID_TEMPLATE_DISPUTE_OPENED',
  refund_completed: 'SENDGRID_TEMPLATE_REFUND_COMPLETED',
  case_closed: 'SENDGRID_TEMPLATE_CASE_CLOSED',
  payout_released: 'SENDGRID_TEMPLATE_PAYOUT_RELEASED',
}

/** Required dynamic_template_data fields per template (expand as templates are built). */
export const EMAIL_TEMPLATE_REQUIRED_FIELDS = {
  master_test: ['title', 'preheader', 'body'],
  offer_received: ['title', 'preheader', 'body'],
  offer_accepted: ['title', 'preheader', 'body'],
  payment_successful: ['title', 'preheader', 'body'],
  new_order_received: ['title', 'preheader', 'body'],
  buyer_delivery_details_added: ['title', 'preheader', 'body'],
  collection_confirmed: ['title', 'preheader', 'body'],
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
