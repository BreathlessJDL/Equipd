/**
 * Unit checks for site-wide Organization + WebSite JSON-LD.
 */

import {
  EQUIPD_ORGANIZATION_DESCRIPTION,
  EQUIPD_ORGANIZATION_ID,
  EQUIPD_SAME_AS,
  EQUIPD_SCHEMA_ORIGIN,
  EQUIPD_SEARCH_URL_TEMPLATE,
  ORGANIZATION_SCHEMA_KEY,
  WEBSITE_SCHEMA_KEY,
  buildOrganizationSchema,
  buildSiteStructuredDataGraph,
  buildWebsiteSchema,
  injectSiteStructuredDataIntoHtml,
  renderSiteStructuredDataScriptTags,
} from '../src/lib/siteStructuredData.js'
import { injectSeoIntoHtml } from '../src/lib/seoCataloguePrerender.js'

function assert(condition, label) {
  if (!condition) throw new Error(label)
}

const organization = buildOrganizationSchema()
assert(organization['@context'] === 'https://schema.org', 'org context')
assert(organization['@type'] === 'Organization', 'org type')
assert(organization['@id'] === EQUIPD_ORGANIZATION_ID, 'org id')
assert(organization.name === 'Equipd', 'org name')
assert(organization.url === EQUIPD_SCHEMA_ORIGIN, 'org url is www')
assert(organization.url.startsWith('https://www.'), 'org uses www host')
assert(organization.logo === `${EQUIPD_SCHEMA_ORIGIN}/email/equipd-full-logo.png`, 'org logo')
assert(organization.description === EQUIPD_ORGANIZATION_DESCRIPTION, 'org description')
assert(
  organization.description ===
    "Equipd is the UK's marketplace for buying, selling and valuing used gym equipment.",
  'org description exact marketplace wording',
)
assert(
  !organization.description.includes('commercial'),
  'org description is not limited to commercial',
)
assert(organization.areaServed === 'United Kingdom', 'org areaServed')
assert(organization.contactPoint?.email === 'support@equipd.co.uk', 'org contact')
assert(!('sameAs' in organization) || EQUIPD_SAME_AS.length > 0, 'no invented sameAs')

const website = buildWebsiteSchema()
assert(website['@type'] === 'WebSite', 'website type')
assert(website.url === EQUIPD_SCHEMA_ORIGIN, 'website url is www')
assert(website.url === 'https://www.equipd.co.uk', 'website exact www origin')
assert(website.publisher?.['@id'] === EQUIPD_ORGANIZATION_ID, 'website publisher ref')
assert(website.potentialAction?.['@type'] === 'SearchAction', 'search action')
assert(
  website.potentialAction.target.urlTemplate === EQUIPD_SEARCH_URL_TEMPLATE,
  'search url template',
)
assert(
  EQUIPD_SEARCH_URL_TEMPLATE === 'https://www.equipd.co.uk/browse?search={search_term_string}',
  'search uses real browse endpoint on www',
)
assert(!EQUIPD_SEARCH_URL_TEMPLATE.includes('localhost'), 'no localhost in search')
assert(!JSON.stringify(organization).includes('://equipd.co.uk/'), 'org json avoids non-www')
assert(!JSON.stringify(website).includes('://equipd.co.uk/'), 'website json avoids non-www')

const graph = buildSiteStructuredDataGraph()
assert(graph.length === 2, 'graph has org + website')
assert(graph[0]['@type'] === 'Organization', 'graph org first')
assert(graph[1]['@type'] === 'WebSite', 'graph website second')

const tags = renderSiteStructuredDataScriptTags()
assert(tags.includes(`data-equipd-schema="${ORGANIZATION_SCHEMA_KEY}"`), 'org script attr')
assert(tags.includes(`data-equipd-schema="${WEBSITE_SCHEMA_KEY}"`), 'website script attr')
assert(tags.includes('application/ld+json'), 'json-ld type')
assert((tags.match(/application\/ld\+json/g) || []).length === 2, 'exactly two scripts')

const template = `<!doctype html>
<html lang="en">
  <head>
    <title>Equipd</title>
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>`

const injected = injectSiteStructuredDataIntoHtml(template)
assert(injected.includes('Organization'), 'injected org')
assert(injected.includes('WebSite'), 'injected website')
assert(injected.includes('</head>'), 'keeps head close')
const reinjected = injectSiteStructuredDataIntoHtml(injected)
assert(
  (reinjected.match(/data-equipd-schema="organization"/g) || []).length === 1,
  'idempotent org',
)
assert(
  (reinjected.match(/data-equipd-schema="website"/g) || []).length === 1,
  'idempotent website',
)

const prerenderHtml = injectSeoIntoHtml(injected, {
  path: '/brands',
  title: 'Brands | Equipd',
  description: 'Brand guides',
  canonicalPath: '/brands',
  jsonLd: {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'Brands',
  },
  bodyHtml: '<article>Brands</article>',
})
assert(
  (prerenderHtml.match(/data-equipd-schema="organization"/g) || []).length === 1,
  'prerender keeps single org',
)
assert(
  (prerenderHtml.match(/data-equipd-schema="website"/g) || []).length === 1,
  'prerender keeps single website',
)
assert(prerenderHtml.includes('CollectionPage'), 'prerender page json-ld kept')

console.log('site structured data tests passed')
