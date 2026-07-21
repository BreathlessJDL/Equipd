import { useEffect } from 'react'
import {
  syncWebPageSchemaInDocument,
  WEBPAGE_SCHEMA_KEY,
} from '../../lib/sellGymEquipmentPage.js'
import { SITE_SCHEMA_ATTR } from '../../lib/siteStructuredData.js'

/**
 * Keeps a single WebPage JSON-LD script in document.head for marketing pages.
 * Removes it on unmount so SPA navigation does not leave stale page schema.
 */
export default function WebPageSchema({ schema = null }) {
  const serialized = schema ? JSON.stringify(schema) : ''

  useEffect(() => {
    if (typeof document === 'undefined') return undefined

    const nextSchema = serialized ? JSON.parse(serialized) : null
    syncWebPageSchemaInDocument(document, nextSchema)

    return () => {
      const selector = `script[${SITE_SCHEMA_ATTR}="${WEBPAGE_SCHEMA_KEY}"]`
      for (const node of document.head.querySelectorAll(selector)) {
        node.remove()
      }
    }
  }, [serialized])

  return null
}
