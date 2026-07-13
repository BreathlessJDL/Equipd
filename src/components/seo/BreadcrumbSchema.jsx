import { useEffect } from 'react'
import {
  BREADCRUMB_SCHEMA_KEY,
  SITE_SCHEMA_ATTR,
  syncBreadcrumbSchemaInDocument,
} from '../../lib/breadcrumbStructuredData'

/**
 * Keeps a single BreadcrumbList JSON-LD script in document.head for the
 * current public page. Removes it on unmount so SPA navigation to private
 * or non-hierarchical routes does not leave stale breadcrumbs.
 *
 * @param {{ schema?: object | null }} props
 */
export default function BreadcrumbSchema({ schema = null }) {
  const serialized = schema ? JSON.stringify(schema) : ''

  useEffect(() => {
    if (typeof document === 'undefined') return undefined

    const nextSchema = serialized ? JSON.parse(serialized) : null
    syncBreadcrumbSchemaInDocument(document, nextSchema)

    return () => {
      const selector = `script[${SITE_SCHEMA_ATTR}="${BREADCRUMB_SCHEMA_KEY}"]`
      for (const node of document.head.querySelectorAll(selector)) {
        node.remove()
      }
    }
  }, [serialized])

  return null
}
