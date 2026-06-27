import { useCallback, useEffect, useRef } from 'react'
import { cancelBrowseAnchorScroll, scrollToBrowseAnchor } from '../lib/scrollToBrowseAnchor'

/**
 * Request a scroll to the browse filters/results area after the next URL sync.
 * Browse filter changes debounce before updating search params, which can reset scroll.
 */
export function useBrowseScrollAfterFilterChange(searchParamsKey) {
  const pendingRef = useRef(false)

  const cancelBrowseScrollRequest = useCallback(() => {
    pendingRef.current = false
    cancelBrowseAnchorScroll()
  }, [])

  const requestBrowseScroll = useCallback(() => {
    pendingRef.current = true
    scrollToBrowseAnchor()
  }, [])

  useEffect(() => {
    if (!pendingRef.current) return

    pendingRef.current = false
    scrollToBrowseAnchor()
  }, [searchParamsKey])

  return { requestBrowseScroll, cancelBrowseScrollRequest }
}
