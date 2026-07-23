/**
 * Valuation landing page SEO document for build-time prerender.
 * Keep FAQ absent — the live page has no FAQ section.
 */

import { EQUIPD_SITE_ORIGIN } from './brandCatalogueCore.js'
import { buildBreadcrumbSchema } from './breadcrumbStructuredData.js'
import { buildSocialOpenGraph } from './socialPreview.js'

export const VALUATION_PAGE_PATH = '/valuation'

export const VALUATION_PAGE_TITLE = 'Instant Equipment Valuation | Equipd'

export const VALUATION_PAGE_DESCRIPTION =
  "Estimate the used market value of eligible gym equipment on Equipd, then buy or sell on the UK marketplace."

export function buildValuationPageBreadcrumbSchema() {
  return buildBreadcrumbSchema(
    [
      { name: 'Home', path: '/' },
      { name: 'Equipment Valuation', path: VALUATION_PAGE_PATH },
    ],
    { canonicalUrl: `${EQUIPD_SITE_ORIGIN}${VALUATION_PAGE_PATH}` },
  )
}

export function buildValuationSeoDocument() {
  const path = VALUATION_PAGE_PATH
  const title = VALUATION_PAGE_TITLE
  const description = VALUATION_PAGE_DESCRIPTION
  const canonicalUrl = `${EQUIPD_SITE_ORIGIN}${path}`

  const bodyHtml = `
<article class="seo-prerender" data-equipd-seo-prerender="valuation">
  <nav aria-label="Breadcrumb">
    <ol>
      <li><a href="/">Home</a></li>
      <li>Equipment Valuation</li>
    </ol>
  </nav>
  <header>
    <h1>Instant Equipment Valuation</h1>
    <p>${description}</p>
  </header>
  <p>
    <a href="/brands">Browse equipment values by brand</a>
    · <a href="/browse">View current marketplace listings</a>
    · <a href="/sell-gym-equipment">Sell gym equipment</a>
  </p>
</article>`.trim()

  return {
    path,
    title,
    description,
    canonicalPath: path,
    robots: 'index, follow',
    openGraph: buildSocialOpenGraph({
      title,
      description,
      url: canonicalUrl,
      fallbackImage: true,
    }),
    jsonLd: [buildValuationPageBreadcrumbSchema()].filter(Boolean),
    bodyHtml,
  }
}
