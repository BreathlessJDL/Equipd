import { useEffect } from 'react'
import {
  SITE_SCHEMA_ATTR,
  WEBSITE_SCHEMA_KEY,
  buildWebsiteSchema,
} from '../../lib/siteStructuredData'

/**
 * Ensures a single WebSite JSON-LD block exists in document.head.
 * Skips injection when prerender/build already placed the script.
 */
export default function WebsiteSchema() {
  useEffect(() => {
    const selector = `script[${SITE_SCHEMA_ATTR}="${WEBSITE_SCHEMA_KEY}"]`
    if (document.head.querySelector(selector)) return undefined

    const script = document.createElement('script')
    script.type = 'application/ld+json'
    script.setAttribute(SITE_SCHEMA_ATTR, WEBSITE_SCHEMA_KEY)
    script.text = JSON.stringify(buildWebsiteSchema())
    document.head.appendChild(script)

    return () => {
      script.remove()
    }
  }, [])

  return null
}
