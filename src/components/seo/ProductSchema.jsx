import { useEffect } from 'react'
import {
  PRODUCT_SCHEMA_KEY,
  SITE_SCHEMA_ATTR,
  syncProductSchemaInDocument,
} from '../../lib/productPageStructuredData'

/**
 * Keeps a single Product JSON-LD script in document.head for eligible
 * equipment guide pages. Removes it on unmount so SPA navigation does not
 * leave stale Product schema on ineligible routes.
 *
 * @param {{ schema?: object | null }} props
 */
export default function ProductSchema({ schema = null }) {
  const serialized = schema ? JSON.stringify(schema) : ''

  useEffect(() => {
    if (typeof document === 'undefined') return undefined

    const nextSchema = serialized ? JSON.parse(serialized) : null
    syncProductSchemaInDocument(document, nextSchema)

    return () => {
      const selector = `script[${SITE_SCHEMA_ATTR}="${PRODUCT_SCHEMA_KEY}"]`
      for (const node of document.head.querySelectorAll(selector)) {
        node.remove()
      }
    }
  }, [serialized])

  return null
}
