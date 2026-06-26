import { useEffect } from 'react'
import { useLocation, useNavigationType } from 'react-router-dom'

/**
 * Scrolls the window to the top on internal route changes.
 * Skips hash-only navigation (anchors) and POP (back/forward) so preserved
 * scroll restoration (e.g. Hub) still works.
 */
function ScrollToTop() {
  const { pathname, hash } = useLocation()
  const navigationType = useNavigationType()

  useEffect(() => {
    if (navigationType === 'POP') return
    if (hash) return

    window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
  }, [pathname, hash, navigationType])

  return null
}

export default ScrollToTop
