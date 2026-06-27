export const BROWSE_FILTERS_ANCHOR_ID = 'browse-filters-anchor'
export const BROWSE_RESULTS_ANCHOR_ID = 'browse-results'

const ALIGNMENT_TOLERANCE_PX = 16
const URL_SYNC_RETRY_MS = 420

let browseAnchorRetryTimerId = null

export function cancelBrowseAnchorScroll() {
  if (browseAnchorRetryTimerId != null) {
    window.clearTimeout(browseAnchorRetryTimerId)
    browseAnchorRetryTimerId = null
  }
}

function getStickyHeaderHeight() {
  const header = document.querySelector('.global-site-header')
  return header ? Math.ceil(header.getBoundingClientRect().height) : 0
}

function resolveBrowseAnchor(anchorId, fallbackAnchorId) {
  return document.getElementById(anchorId) ?? document.getElementById(fallbackAnchorId)
}

function isBrowseAnchorAligned(element, extraOffset) {
  const headerHeight = getStickyHeaderHeight()
  const offset = element.getBoundingClientRect().top - headerHeight - extraOffset
  return Math.abs(offset) <= ALIGNMENT_TOLERANCE_PX
}

function scrollBrowseAnchorIntoView(element, { behavior, extraOffset }) {
  const headerHeight = getStickyHeaderHeight()
  const top = element.getBoundingClientRect().top + window.scrollY - headerHeight - extraOffset

  window.scrollTo({
    top: Math.max(0, top),
    left: 0,
    behavior,
  })
}

/**
 * Scroll so browse filters (or results fallback) sit just below the sticky site header.
 * Retries once after browse URL sync — filter changes debounce before updating search params,
 * which can otherwise reset scroll back to the top.
 */
export function scrollToBrowseAnchor({
  anchorId = BROWSE_FILTERS_ANCHOR_ID,
  fallbackAnchorId = BROWSE_RESULTS_ANCHOR_ID,
  behavior = 'smooth',
  extraOffset = 8,
  retryAfterMs = URL_SYNC_RETRY_MS,
} = {}) {
  cancelBrowseAnchorScroll()

  function run(scrollBehavior) {
    const element = resolveBrowseAnchor(anchorId, fallbackAnchorId)
    if (!element) return

    scrollBrowseAnchorIntoView(element, { behavior: scrollBehavior, extraOffset })
  }

  requestAnimationFrame(() => run(behavior))

  if (retryAfterMs <= 0) return

  browseAnchorRetryTimerId = window.setTimeout(() => {
    browseAnchorRetryTimerId = null

    const element = resolveBrowseAnchor(anchorId, fallbackAnchorId)
    if (!element) return
    if (isBrowseAnchorAligned(element, extraOffset)) return

    run('auto')
  }, retryAfterMs)
}
