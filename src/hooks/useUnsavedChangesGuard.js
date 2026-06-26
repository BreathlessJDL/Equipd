import { useCallback, useEffect, useRef, useState } from 'react'
import { useBeforeUnload, useNavigate } from 'react-router-dom'

const BACK_NAVIGATION = '__BACK__'

function isModifiedClick(event) {
  return event.metaKey || event.ctrlKey || event.shiftKey || event.altKey
}

function getInternalPathname(href) {
  try {
    const url = new URL(href, window.location.href)
    if (url.origin !== window.location.origin) return null
    return `${url.pathname}${url.search}${url.hash}`
  } catch {
    return null
  }
}

/**
 * Blocks in-app navigation while `enabled` is true and shows a modal via `onBlock`.
 * Uses link-click capture and a history trap for the browser back button.
 * Pair with beforeunload (handled here) for tab close/refresh.
 */
export function useUnsavedChangesGuard({ enabled, onBlock }) {
  const navigate = useNavigate()
  const enabledRef = useRef(enabled)
  const onBlockRef = useRef(onBlock)
  const [pendingNavigation, setPendingNavigation] = useState(null)

  enabledRef.current = enabled
  onBlockRef.current = onBlock

  const blockNavigation = useCallback((target) => {
    setPendingNavigation(target)
    onBlockRef.current?.(target)
  }, [])

  const proceedPendingNavigation = useCallback(() => {
    const target = pendingNavigation
    setPendingNavigation(null)

    if (!target) return

    if (target === BACK_NAVIGATION) {
      window.history.go(-2)
      return
    }

    navigate(target)
  }, [navigate, pendingNavigation])

  const cancelPendingNavigation = useCallback(() => {
    setPendingNavigation(null)
  }, [])

  useBeforeUnload(
    useCallback(
      (event) => {
        if (!enabledRef.current) return
        event.preventDefault()
        event.returnValue = ''
      },
      [],
    ),
  )

  useEffect(() => {
    if (!enabled) return undefined

    function handleDocumentClick(event) {
      if (!enabledRef.current) return
      if (event.defaultPrevented) return
      if (event.button !== 0) return
      if (isModifiedClick(event)) return

      const anchor = event.target.closest('a[href]')
      if (!anchor) return
      if (anchor.getAttribute('target') === '_blank') return
      if (anchor.hasAttribute('download')) return

      const href = anchor.getAttribute('href')
      if (!href || href.startsWith('#')) return

      const pathname = getInternalPathname(href)
      if (!pathname) return

      const currentPath = `${window.location.pathname}${window.location.search}${window.location.hash}`
      if (pathname === currentPath) return

      event.preventDefault()
      event.stopPropagation()
      blockNavigation(pathname)
    }

    document.addEventListener('click', handleDocumentClick, true)

    return () => {
      document.removeEventListener('click', handleDocumentClick, true)
    }
  }, [enabled, blockNavigation])

  useEffect(() => {
    if (!enabled) return undefined

    const trapState = { __createListingUnsavedTrap: true }
    window.history.pushState(trapState, '')

    function handlePopState() {
      if (!enabledRef.current) return
      window.history.pushState(trapState, '')
      blockNavigation(BACK_NAVIGATION)
    }

    window.addEventListener('popstate', handlePopState)

    return () => {
      window.removeEventListener('popstate', handlePopState)
    }
  }, [enabled, blockNavigation])

  return {
    pendingNavigation,
    proceedPendingNavigation,
    cancelPendingNavigation,
    backNavigation: BACK_NAVIGATION,
  }
}
