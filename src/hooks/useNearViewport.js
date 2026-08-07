import { useEffect, useRef, useState } from 'react'

/**
 * Flips to true once the observed element gets close to the viewport, then stops
 * observing. Used to defer below-fold work without changing layout.
 */
export function useNearViewport({ rootMargin = '400px' } = {}) {
  const ref = useRef(null)
  // Without IntersectionObserver there is no way to detect proximity, so treat
  // the content as always needed rather than never rendering it.
  const [isNear, setIsNear] = useState(() => typeof IntersectionObserver !== 'function')

  useEffect(() => {
    if (isNear) return undefined

    const element = ref.current
    if (!element) return undefined

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setIsNear(true)
          observer.disconnect()
        }
      },
      { rootMargin },
    )

    observer.observe(element)
    return () => observer.disconnect()
  }, [isNear, rootMargin])

  return [ref, isNear]
}
