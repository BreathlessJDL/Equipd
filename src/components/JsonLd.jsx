import { useEffect } from 'react'

/**
 * Injects JSON-LD script tags for the current page.
 * Accepts a single object or an array of graph nodes.
 */
export default function JsonLd({ data }) {
  useEffect(() => {
    if (!data) return undefined

    const nodes = Array.isArray(data) ? data.filter(Boolean) : [data]
    const created = nodes.map((node) => {
      const script = document.createElement('script')
      script.type = 'application/ld+json'
      script.setAttribute('data-equipd-jsonld', 'true')
      script.text = JSON.stringify(node)
      document.head.appendChild(script)
      return script
    })

    return () => {
      for (const script of created) script.remove()
    }
  }, [data])

  return null
}
