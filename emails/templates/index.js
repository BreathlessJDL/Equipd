import { offerReceivedTemplate } from './offerReceived.js'
import { counterOfferReceivedTemplate } from './counterOfferReceived.js'
import { offerAcceptedTemplate } from './offerAccepted.js'
import { paymentSuccessfulTemplate } from './paymentSuccessful.js'
import { newOrderReceivedTemplate } from './newOrderReceived.js'
import { buyerDeliveryDetailsAddedTemplate } from './buyerDeliveryDetailsAdded.js'
import { collectionConfirmedTemplate } from './collectionConfirmed.js'
import { courierDispatchedTemplate } from './courierDispatched.js'
import { deliveryConfirmedTemplate } from './deliveryConfirmed.js'
import { buyerProtectionStartedTemplate } from './buyerProtectionStarted.js'
import { disputeOpenedTemplate } from './disputeOpened.js'
import { evidenceRequestedTemplate } from './evidenceRequested.js'
import { returnAuthorisedTemplate } from './returnAuthorised.js'
import { collectionArrangedTemplate } from './collectionArranged.js'
import { refundPendingTemplate } from './refundPending.js'
import { refundCompletedCaseClosedTemplate } from './refundCompletedCaseClosed.js'
import { caseClosedNoRefundTemplate } from './caseClosedNoRefund.js'
import { reviewAvailableTemplate } from './reviewAvailable.js'
import { reviewReceivedTemplate } from './reviewReceived.js'
import { payoutReleasedTemplate } from './payoutReleased.js'
import { sellerOnboardingRequiredTemplate } from './sellerOnboardingRequired.js'
import { welcomeTemplate } from './welcome.js'
import { emailChangedTemplate } from './emailChanged.js'
import { passwordChangedTemplate } from './passwordChanged.js'
import { renderPlainTextEmail } from './shared.js'

/** Transactional templates built on the approved master layout. */
export const PHASE2_EMAIL_TEMPLATES = [
  offerReceivedTemplate,
  counterOfferReceivedTemplate,
  offerAcceptedTemplate,
  paymentSuccessfulTemplate,
  newOrderReceivedTemplate,
  buyerDeliveryDetailsAddedTemplate,
  collectionConfirmedTemplate,
  courierDispatchedTemplate,
  deliveryConfirmedTemplate,
  buyerProtectionStartedTemplate,
]

/** Phase 5: cases, reviews, payouts, and account emails. */
export const PHASE5_EMAIL_TEMPLATES = [
  disputeOpenedTemplate,
  evidenceRequestedTemplate,
  returnAuthorisedTemplate,
  collectionArrangedTemplate,
  refundPendingTemplate,
  refundCompletedCaseClosedTemplate,
  caseClosedNoRefundTemplate,
  reviewAvailableTemplate,
  reviewReceivedTemplate,
  payoutReleasedTemplate,
  sellerOnboardingRequiredTemplate,
  welcomeTemplate,
  emailChangedTemplate,
  passwordChangedTemplate,
]

export const ALL_EMAIL_TEMPLATES = [...PHASE2_EMAIL_TEMPLATES, ...PHASE5_EMAIL_TEMPLATES]

export const PHASE2_EMAIL_TEMPLATE_KEYS = PHASE2_EMAIL_TEMPLATES.map((template) => template.key)
export const PHASE5_EMAIL_TEMPLATE_KEYS = PHASE5_EMAIL_TEMPLATES.map((template) => template.key)

export function getPhase2Template(key) {
  return PHASE2_EMAIL_TEMPLATES.find((template) => template.key === key) ?? null
}

export function getPhase5Template(key) {
  return PHASE5_EMAIL_TEMPLATES.find((template) => template.key === key) ?? null
}

export function getEmailTemplate(key) {
  return ALL_EMAIL_TEMPLATES.find((template) => template.key === key) ?? null
}

export function buildPhase2PreviewData(templateKey, baseUrl) {
  const template = getPhase2Template(templateKey)
  if (!template) return null
  return template.buildPreviewData(baseUrl)
}

export function buildPhase5PreviewData(templateKey, baseUrl) {
  const template = getPhase5Template(templateKey)
  if (!template) return null
  return template.buildPreviewData(baseUrl)
}

export function buildEmailPreviewData(templateKey, baseUrl) {
  return buildPhase2PreviewData(templateKey, baseUrl) ?? buildPhase5PreviewData(templateKey, baseUrl)
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
  buyerDeliveryDetailsAddedTemplate,
  collectionConfirmedTemplate,
  courierDispatchedTemplate,
  deliveryConfirmedTemplate,
  buyerProtectionStartedTemplate,
  disputeOpenedTemplate,
  evidenceRequestedTemplate,
  returnAuthorisedTemplate,
  collectionArrangedTemplate,
  refundPendingTemplate,
  refundCompletedCaseClosedTemplate,
  caseClosedNoRefundTemplate,
  reviewAvailableTemplate,
  reviewReceivedTemplate,
  payoutReleasedTemplate,
  sellerOnboardingRequiredTemplate,
  welcomeTemplate,
  emailChangedTemplate,
  passwordChangedTemplate,
  renderPlainTextEmail,
}
