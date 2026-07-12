import { useEffect } from 'react'
import {
  ORGANIZATION_SCHEMA_KEY,
  SITE_SCHEMA_ATTR,
  buildOrganizationSchema,
} from '../../lib/siteStructuredData'

/**
 * Ensures a single Organization JSON-LD block exists in document.head.
 * Skips injection when prerender/build already placed the script.
 */
export default function OrganizationSchema() {
  useEffect(() => {
    const selector = `script[${SITE_SCHEMA_ATTR}="${ORGANIZATION_SCHEMA_KEY}"]`
    if (document.head.querySelector(selector)) return undefined

    const script = document.createElement('script')
    script.type = 'application/ld+json'
    script.setAttribute(SITE_SCHEMA_ATTR, ORGANIZATION_SCHEMA_KEY)
    script.text = JSON.stringify(buildOrganizationSchema())
    document.head.appendChild(script)

    return () => {
      script.remove()
    }
  }, [])

  return null
}
