import { useEffect, useRef } from 'react'
import { useLocation, useNavigationType } from 'react-router-dom'
import { shouldResetWindowScrollOnRouteChange } from '../../lib/scrollToTop'

/**
 * Scrolls the window to the top on internal route changes.
 * Skips hash-only navigation, back/forward (POP), and same-path search
 * updates so homepage browse filters do not jump to the hero.
 */
function ScrollToTop() {
  const { pathname, hash } = useLocation()
  const navigationType = useNavigationType()
  const previousPathnameRef = useRef(pathname)

  useEffect(() => {
    const previousPathname = previousPathnameRef.current
    previousPathnameRef.current = pathname

    if (
      !shouldResetWindowScrollOnRouteChange({
        previousPathname,
        nextPathname: pathname,
        hash,
        navigationType,
      })
    ) {
      return
    }

    window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
  }, [pathname, hash, navigationType])

  return null
}

export default ScrollToTop
