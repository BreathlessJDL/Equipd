import { useEffect } from 'react'
import {
  FAQ_SCHEMA_KEY,
  SITE_SCHEMA_ATTR,
  syncFaqPageSchemaInDocument,
} from '../../lib/faqPageStructuredData'

/**
 * Keeps a single FAQPage JSON-LD script in document.head for eligible
 * equipment guide pages. Removes it on unmount so SPA navigation does not
 * leave stale FAQ schema on ineligible routes.
 *
 * @param {{ schema?: object | null }} props
 */
export default function FaqPageSchema({ schema = null }) {
  const serialized = schema ? JSON.stringify(schema) : ''

  useEffect(() => {
    if (typeof document === 'undefined') return undefined

    const nextSchema = serialized ? JSON.parse(serialized) : null
    syncFaqPageSchemaInDocument(document, nextSchema)

    return () => {
      const selector = `script[${SITE_SCHEMA_ATTR}="${FAQ_SCHEMA_KEY}"]`
      for (const node of document.head.querySelectorAll(selector)) {
        node.remove()
      }
    }
  }, [serialized])

  return null
}
