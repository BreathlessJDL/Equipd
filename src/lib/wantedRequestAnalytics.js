import { trackEvent } from './analytics'
import { WANTED_REQUEST_ANALYTICS_EVENTS } from './wantedRequestConstants'

/**
 * @param {string} eventName
 * @param {Record<string, unknown>} [params]
 */
export function trackWantedRequestEvent(eventName, params = {}) {
  return trackEvent(eventName, {
    ...params,
    feature: 'wanted_request',
  })
}

export function trackWantedRequestCtaViewed(params) {
  return trackWantedRequestEvent(WANTED_REQUEST_ANALYTICS_EVENTS.CTA_VIEWED, params)
}

export function trackWantedRequestCtaClicked(params) {
  return trackWantedRequestEvent(WANTED_REQUEST_ANALYTICS_EVENTS.CTA_CLICKED, params)
}

export function trackWantedRequestModalOpened(params) {
  return trackWantedRequestEvent(WANTED_REQUEST_ANALYTICS_EVENTS.MODAL_OPENED, params)
}

export function trackWantedRequestValidationFailed(params) {
  return trackWantedRequestEvent(WANTED_REQUEST_ANALYTICS_EVENTS.FORM_VALIDATION_FAILED, params)
}

export function trackWantedRequestUiCompleted(params) {
  return trackWantedRequestEvent(WANTED_REQUEST_ANALYTICS_EVENTS.UI_COMPLETED, params)
}
