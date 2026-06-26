import { useEffect, useRef, useState } from 'react'

/** Fires once when the element enters the viewport. */
export function useInViewOnce({ rootMargin = '0px 0px -8% 0px', threshold = 0.12 } = {}) {
  const ref = useRef(null)
  const [inView, setInView] = useState(false)

  useEffect(() => {
    if (inView) return undefined

    const node = ref.current
    if (!node) return undefined

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return
        setInView(true)
        observer.disconnect()
      },
      { rootMargin, threshold },
    )

    observer.observe(node)

    return () => {
      observer.disconnect()
    }
  }, [inView, rootMargin, threshold])

  return { ref, inView }
}
