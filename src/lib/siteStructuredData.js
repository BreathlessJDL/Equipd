/**
 * Site-wide Schema.org JSON-LD (Organization + WebSite).
 * Reuses EQUIPD_SITE_ORIGIN so all public SEO signals share one www canonical.
 */

import { EQUIPD_SITE_ORIGIN } from './brandCatalogueCore.js'

/** @deprecated Prefer EQUIPD_SITE_ORIGIN — kept as an alias for schema call sites. */
export const EQUIPD_SCHEMA_ORIGIN = EQUIPD_SITE_ORIGIN

export const EQUIPD_ORGANIZATION_ID = `${EQUIPD_SITE_ORIGIN}/#organization`

export const EQUIPD_ORGANIZATION_NAME = 'Equipd'

export const EQUIPD_ORGANIZATION_DESCRIPTION =
  "Equipd is the UK marketplace for buying and selling used gym equipment, with tools to value eligible kit."

/** Official production logo (deployed under /public/email). */
export const EQUIPD_ORGANIZATION_LOGO_PATH = '/email/equipd-full-logo.png'

export const EQUIPD_SUPPORT_EMAIL = 'support@equipd.co.uk'

/**
 * Known public social profile URLs from project configuration.
 * Leave empty rather than inventing profiles.
 */
export const EQUIPD_SAME_AS = Object.freeze([])

export const SITE_SCHEMA_ATTR = 'data-equipd-schema'
export const ORGANIZATION_SCHEMA_KEY = 'organization'
export const WEBSITE_SCHEMA_KEY = 'website'

/** Real site search used by the global header → browse listings. */
export const EQUIPD_SEARCH_URL_TEMPLATE =
  `${EQUIPD_SCHEMA_ORIGIN}/browse?search={search_term_string}`

export function absoluteSchemaUrl(path = '/') {
  if (!path) return EQUIPD_SCHEMA_ORIGIN
  if (String(path).startsWith('http')) return String(path)
  return `${EQUIPD_SCHEMA_ORIGIN}${path.startsWith('/') ? path : `/${path}`}`
}

export function buildOrganizationSchema({
  sameAs = EQUIPD_SAME_AS,
  includeContactPoint = true,
} = {}) {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': EQUIPD_ORGANIZATION_ID,
    name: EQUIPD_ORGANIZATION_NAME,
    url: EQUIPD_SCHEMA_ORIGIN,
    logo: absoluteSchemaUrl(EQUIPD_ORGANIZATION_LOGO_PATH),
    description: EQUIPD_ORGANIZATION_DESCRIPTION,
    areaServed: 'United Kingdom',
  }

  const profiles = (Array.isArray(sameAs) ? sameAs : [])
    .map((entry) => String(entry ?? '').trim())
    .filter(Boolean)

  if (profiles.length) {
    schema.sameAs = profiles
  }

  if (includeContactPoint && EQUIPD_SUPPORT_EMAIL) {
    schema.contactPoint = {
      '@type': 'ContactPoint',
      email: EQUIPD_SUPPORT_EMAIL,
      contactType: 'customer support',
      areaServed: 'GB',
      availableLanguage: 'English',
    }
  }

  return schema
}

export function buildWebsiteSchema({
  organizationId = EQUIPD_ORGANIZATION_ID,
} = {}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${EQUIPD_SCHEMA_ORIGIN}/#website`,
    name: EQUIPD_ORGANIZATION_NAME,
    url: EQUIPD_SCHEMA_ORIGIN,
    publisher: {
      '@id': organizationId,
    },
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: EQUIPD_SEARCH_URL_TEMPLATE,
      },
      'query-input': 'required name=search_term_string',
    },
  }
}

export function buildSiteStructuredDataGraph(options = {}) {
  return [
    buildOrganizationSchema(options),
    buildWebsiteSchema(options),
  ]
}

function escapeJsonForHtmlScript(value) {
  return JSON.stringify(value).replace(/</g, '\\u003c')
}

export function renderJsonLdScriptTag(schemaKey, data) {
  if (!data || !schemaKey) return ''
  return [
    `<script type="application/ld+json" ${SITE_SCHEMA_ATTR}="${schemaKey}">`,
    escapeJsonForHtmlScript(data),
    '</script>',
  ].join('')
}

export function renderSiteStructuredDataScriptTags(options = {}) {
  const [organization, website] = buildSiteStructuredDataGraph(options)
  return [
    renderJsonLdScriptTag(ORGANIZATION_SCHEMA_KEY, organization),
    renderJsonLdScriptTag(WEBSITE_SCHEMA_KEY, website),
  ].join('\n    ')
}

/**
 * Idempotently inject Organization + WebSite JSON-LD into an HTML document string.
 */
export function injectSiteStructuredDataIntoHtml(html, options = {}) {
  if (!html || typeof html !== 'string') return html

  const hasOrganization = html.includes(`${SITE_SCHEMA_ATTR}="${ORGANIZATION_SCHEMA_KEY}"`)
  const hasWebsite = html.includes(`${SITE_SCHEMA_ATTR}="${WEBSITE_SCHEMA_KEY}"`)
  if (hasOrganization && hasWebsite) return html

  const tags = []
  if (!hasOrganization) {
    tags.push(renderJsonLdScriptTag(ORGANIZATION_SCHEMA_KEY, buildOrganizationSchema(options)))
  }
  if (!hasWebsite) {
    tags.push(renderJsonLdScriptTag(WEBSITE_SCHEMA_KEY, buildWebsiteSchema(options)))
  }

  const block = tags.join('\n    ')
  if (/<\/head>/i.test(html)) {
    return html.replace(/<\/head>/i, `    ${block}\n  </head>`)
  }
  return `${block}\n${html}`
}
