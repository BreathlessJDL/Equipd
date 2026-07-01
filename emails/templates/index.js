import { offerReceivedTemplate } from './offerReceived.js'
import { offerAcceptedTemplate } from './offerAccepted.js'
import { paymentSuccessfulTemplate } from './paymentSuccessful.js'
import { newOrderReceivedTemplate } from './newOrderReceived.js'
import { renderPlainTextEmail } from './shared.js'

/** Phase 2 transactional templates built on the approved master layout. */
export const PHASE2_EMAIL_TEMPLATES = [
  offerReceivedTemplate,
  offerAcceptedTemplate,
  paymentSuccessfulTemplate,
  newOrderReceivedTemplate,
]

export const PHASE2_EMAIL_TEMPLATE_KEYS = PHASE2_EMAIL_TEMPLATES.map((template) => template.key)

export function getPhase2Template(key) {
  return PHASE2_EMAIL_TEMPLATES.find((template) => template.key === key) ?? null
}

export function buildPhase2PreviewData(templateKey, baseUrl) {
  const template = getPhase2Template(templateKey)
  if (!template) return null
  return template.buildPreviewData(baseUrl)
}

export function buildPhase2SendGridPlainText(templateKey) {
  const template = getPhase2Template(templateKey)
  if (!template) return null
  return template.buildSendGridPlainText()
}

export {
  offerReceivedTemplate,
  offerAcceptedTemplate,
  paymentSuccessfulTemplate,
  newOrderReceivedTemplate,
  renderPlainTextEmail,
}
