import { useEffect, useState } from 'react'
import { getOneRowListingCapacity } from '../lib/oneRowListingCapacity'

function estimateRailWidth(viewportWidth) {
  const gutter = Math.min(80, Math.max(32, viewportWidth * 0.034))
  const maxRail = 104 * 16
  return Math.min(Math.max(viewportWidth - 2 * gutter, 0), maxRail)
}

function readRootFontSize() {
  if (typeof window === 'undefined') return 16
  return Number.parseFloat(getComputedStyle(document.documentElement).fontSize) || 16
}

/**
 * Observe a listings row container and return how many cards fit in one row.
 * @param {{ current: Element | null }} containerRef
 * @param {{ enabled?: boolean, capacityOptions?: { mobileCapacity?: number, gapRem?: number } }} [options]
 */
export function useOneRowListingCapacity(
  containerRef,
  { enabled = true, capacityOptions = {} } = {},
) {
  const mobileCapacity = capacityOptions.mobileCapacity ?? 2
  const gapRem = capacityOptions.gapRem ?? 1

  const [capacity, setCapacity] = useState(() => {
    if (typeof window === 'undefined') return 4
    const viewportWidth = window.innerWidth
    return getOneRowListingCapacity(estimateRailWidth(viewportWidth), viewportWidth, {
      rootFontSizePx: 16,
      mobileCapacity,
      gapRem,
    })
  })

  useEffect(() => {
    if (!enabled) return undefined

    const update = () => {
      const node = containerRef?.current
      const viewportWidth = window.innerWidth
      const width = node?.clientWidth || estimateRailWidth(viewportWidth)
      setCapacity(
        getOneRowListingCapacity(width, viewportWidth, {
          rootFontSizePx: readRootFontSize(),
          mobileCapacity,
          gapRem,
        }),
      )
    }

    update()

    const node = containerRef?.current
    let observer
    if (node && typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(update)
      observer.observe(node)
    }

    window.addEventListener('resize', update)
    return () => {
      observer?.disconnect()
      window.removeEventListener('resize', update)
    }
  }, [containerRef, enabled, mobileCapacity, gapRem])

  return capacity
}
