import OrganizationSchema from './OrganizationSchema'
import WebsiteSchema from './WebsiteSchema'

/**
 * Site-wide Schema.org Organization + WebSite JSON-LD for public pages.
 */
export default function SiteStructuredData() {
  return (
    <>
      <OrganizationSchema />
      <WebsiteSchema />
    </>
  )
}
