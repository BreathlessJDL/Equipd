import { useEffect, useRef } from 'react'
import { useNavigationType } from 'react-router-dom'

const HUB_SCROLL_KEY = 'equipd:hub-scroll-y'
const HUB_MOBILE_MAX_WIDTH = 900

let hubScrollRestoreSuppressed = false

function isMobileHubViewport() {
  if (typeof window === 'undefined') return false
  return window.matchMedia(`(max-width: ${HUB_MOBILE_MAX_WIDTH}px)`).matches
}

function readSavedScrollY() {
  try {
    const saved = window.sessionStorage.getItem(HUB_SCROLL_KEY)
    if (saved == null) return null

    const scrollY = Number(saved)
    return Number.isFinite(scrollY) && scrollY >= 0 ? scrollY : null
  } catch {
    return null
  }
}

function writeSavedScrollY(scrollY) {
  try {
    window.sessionStorage.setItem(HUB_SCROLL_KEY, String(Math.max(0, Math.round(scrollY))))
  } catch {
    // Ignore storage failures (private mode, quota, etc.).
  }
}

export function resetHubScrollPosition() {
  hubScrollRestoreSuppressed = true

  try {
    window.sessionStorage.removeItem(HUB_SCROLL_KEY)
  } catch {
    // Ignore storage failures (private mode, quota, etc.).
  }

  window.scrollTo({ top: 0, left: 0 })
}

export function scrollHubToTop() {
  resetHubScrollPosition()
}

export function useHubScrollRestoration({ enabled = true, ready = false }) {
  const navigationType = useNavigationType()
  const pendingRestoreRef = useRef(null)
  const hasRestoredRef = useRef(false)
  const saveEnabled = enabled && !isMobileHubViewport()
  const shouldRestoreOnMount = saveEnabled && navigationType === 'POP'

  useEffect(() => {
    if (!saveEnabled) return undefined

    if (shouldRestoreOnMount) {
      pendingRestoreRef.current = readSavedScrollY()
      hasRestoredRef.current = false
    }

    function saveScroll() {
      writeSavedScrollY(window.scrollY)
    }

    let ticking = false

    function onScroll() {
      if (ticking) return
      ticking = true
      window.requestAnimationFrame(() => {
        saveScroll()
        ticking = false
      })
    }

    function onVisibilityChange() {
      if (document.visibilityState === 'hidden') {
        saveScroll()
      }
    }

    function onPageShow(event) {
      if (!event.persisted) return

      const savedScrollY = readSavedScrollY()
      if (savedScrollY == null) return

      window.requestAnimationFrame(() => {
        window.scrollTo({ top: savedScrollY, left: 0 })
      })
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    document.addEventListener('visibilitychange', onVisibilityChange)
    window.addEventListener('pageshow', onPageShow)

    return () => {
      window.removeEventListener('scroll', onScroll)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.removeEventListener('pageshow', onPageShow)
      saveScroll()
    }
  }, [saveEnabled, shouldRestoreOnMount])

  useEffect(() => {
    if (!shouldRestoreOnMount || !ready || hasRestoredRef.current) return

    if (hubScrollRestoreSuppressed) {
      hubScrollRestoreSuppressed = false
      pendingRestoreRef.current = null
      hasRestoredRef.current = true
      return
    }

    const savedScrollY = pendingRestoreRef.current
    pendingRestoreRef.current = null

    if (savedScrollY == null) {
      hasRestoredRef.current = true
      return
    }

    hasRestoredRef.current = true

    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        window.scrollTo({ top: savedScrollY, left: 0 })
      })
    })
  }, [shouldRestoreOnMount, ready])
}
