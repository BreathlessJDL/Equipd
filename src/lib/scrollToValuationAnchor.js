/**
 * Header-aware scroll helpers for the Instant Equipment Valuation page.
 * Measures the live sticky site header rather than hardcoding offsets.
 */

export const VALUATION_PROGRESS_ANCHOR_ID = 'valuation-progress-anchor'
export const VALUATION_SELECTED_PRODUCT_ANCHOR_ID = 'selected-product-anchor'

const ALIGNMENT_TOLERANCE_PX = 18
const DEFAULT_EXTRA_OFFSET_PX = 12

let valuationScrollRafId = null
let valuationHighlightTimerId = null

export function cancelValuationAnchorScroll() {
  if (valuationScrollRafId != null) {
    window.cancelAnimationFrame(valuationScrollRafId)
    valuationScrollRafId = null
  }
}

export function cancelValuationPreviewHighlightTimer() {
  if (valuationHighlightTimerId != null) {
    window.clearTimeout(valuationHighlightTimerId)
    valuationHighlightTimerId = null
  }
}

export function getStickySiteHeaderHeight() {
  if (typeof document === 'undefined') return 0
  const header = document.querySelector('.global-site-header')
  return header ? Math.ceil(header.getBoundingClientRect().height) : 0
}

function resolveValuationAnchor(anchorId) {
  if (typeof document === 'undefined') return null
  return document.getElementById(anchorId)
}

function isValuationAnchorAligned(element, extraOffset) {
  const headerHeight = getStickySiteHeaderHeight()
  const offset = element.getBoundingClientRect().top - headerHeight - extraOffset
  return Math.abs(offset) <= ALIGNMENT_TOLERANCE_PX
}

function scrollValuationAnchorIntoView(element, { behavior, extraOffset }) {
  const headerHeight = getStickySiteHeaderHeight()
  const top = element.getBoundingClientRect().top + window.scrollY - headerHeight - extraOffset

  window.scrollTo({
    top: Math.max(0, top),
    left: 0,
    behavior,
  })
}

/**
 * Scroll so a valuation anchor sits just below the sticky site header.
 * One intentional scroll per call; cancels any in-flight valuation scroll first.
 */
export function scrollToValuationAnchor({
  anchorId,
  behavior = 'smooth',
  extraOffset = DEFAULT_EXTRA_OFFSET_PX,
} = {}) {
  if (!anchorId || typeof window === 'undefined') return

  cancelValuationAnchorScroll()

  valuationScrollRafId = window.requestAnimationFrame(() => {
    valuationScrollRafId = window.requestAnimationFrame(() => {
      valuationScrollRafId = null
      const element = resolveValuationAnchor(anchorId)
      if (!element) return
      scrollValuationAnchorIntoView(element, { behavior, extraOffset })

      // Correct once after smooth scroll settles if sticky header still overlaps.
      if (behavior === 'smooth') {
        window.setTimeout(() => {
          const latest = resolveValuationAnchor(anchorId)
          if (!latest) return
          if (isValuationAnchorAligned(latest, extraOffset)) return
          scrollValuationAnchorIntoView(latest, { behavior: 'auto', extraOffset })
        }, 420)
      }
    })
  })
}

export function scrollToValuationProgress(options = {}) {
  scrollToValuationAnchor({
    anchorId: VALUATION_PROGRESS_ANCHOR_ID,
    ...options,
  })
}

export function scrollToSelectedProduct(options = {}) {
  scrollToValuationAnchor({
    anchorId: VALUATION_SELECTED_PRODUCT_ANCHOR_ID,
    ...options,
  })
}

export function scheduleValuationPreviewHighlight(setHighlight, durationMs = 1400) {
  cancelValuationPreviewHighlightTimer()
  setHighlight(true)
  valuationHighlightTimerId = window.setTimeout(() => {
    valuationHighlightTimerId = null
    setHighlight(false)
  }, durationMs)
}

export function isSelectedProductAnchorBelowFold(extraOffset = DEFAULT_EXTRA_OFFSET_PX) {
  const element = resolveValuationAnchor(VALUATION_SELECTED_PRODUCT_ANCHOR_ID)
  if (!element) return false
  const headerHeight = getStickySiteHeaderHeight()
  const top = element.getBoundingClientRect().top
  return top > window.innerHeight * 0.45 || top < headerHeight + extraOffset
}
