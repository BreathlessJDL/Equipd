/**
 * /browse SEO document — Node-safe prerender for the marketplace index.
 */

import { BUY_EQUIPMENT_TYPES, BUY_USED_GYM_EQUIPMENT_OG_IMAGE, BUY_USED_GYM_EQUIPMENT_PATH } from './buyUsedGymEquipmentPage.js'
import { EQUIPD_SITE_ORIGIN } from './brandCatalogueCore.js'
import { buildBreadcrumbSchema } from './breadcrumbStructuredData.js'
import {
  LANDING_LISTINGS_SEO_LIMIT,
  buildListingItemListElement,
  mapLandingListingsForSeo,
  renderLandingListingsHtml,
  selectPublicLandingListings,
} from './landingListingSeo.js'
import { formatPageTitle } from './pageTitles.js'
import { BROWSE_PATH } from './sellGymEquipmentPage.js'
import { EQUIPD_ORGANIZATION_ID } from './siteStructuredData.js'

export { BROWSE_PATH }

export const BROWSE_PAGE_META_TITLE = 'Browse Used Gym Equipment for Sale'
export const BROWSE_PAGE_TITLE = formatPageTitle(BROWSE_PAGE_META_TITLE)
export const BROWSE_PAGE_META_DESCRIPTION =
  'Browse used gym equipment listed for sale across the UK on Equipd. Filter by brand, location and category to find home and commercial kit.'
export const BROWSE_PAGE_H1 = 'Browse used gym equipment for sale'
export const BROWSE_LISTINGS_EMPTY =
  'No live listings are available right now. Check back soon or request the equipment you need.'

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function absoluteUrl(path) {
  return `${EQUIPD_SITE_ORIGIN}${path}`
}

export function selectBrowsePageListings(listings = [], { limit = LANDING_LISTINGS_SEO_LIMIT } = {}) {
  return selectPublicLandingListings(listings, {}, { limit })
}

export function buildBrowsePageOpenGraph() {
  const pageUrl = absoluteUrl(BROWSE_PATH)
  const imageUrl = `${EQUIPD_SITE_ORIGIN}${BUY_USED_GYM_EQUIPMENT_OG_IMAGE.src}`
  return {
    'og:type': 'website',
    'og:site_name': 'Equipd',
    'og:locale': 'en_GB',
    'og:url': pageUrl,
    'og:title': BROWSE_PAGE_TITLE,
    'og:description': BROWSE_PAGE_META_DESCRIPTION,
    'og:image': imageUrl,
    'og:image:width': String(BUY_USED_GYM_EQUIPMENT_OG_IMAGE.width),
    'og:image:height': String(BUY_USED_GYM_EQUIPMENT_OG_IMAGE.height),
    'og:image:alt': BUY_USED_GYM_EQUIPMENT_OG_IMAGE.alt,
    'twitter:card': 'summary_large_image',
    'twitter:title': BROWSE_PAGE_TITLE,
    'twitter:description': BROWSE_PAGE_META_DESCRIPTION,
    'twitter:image': imageUrl,
  }
}

export function buildBrowsePageWebPageSchema() {
  const pageUrl = absoluteUrl(BROWSE_PATH)
  return {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    '@id': `${pageUrl}#webpage`,
    url: pageUrl,
    name: BROWSE_PAGE_TITLE,
    headline: BROWSE_PAGE_H1,
    description: BROWSE_PAGE_META_DESCRIPTION,
    inLanguage: 'en-GB',
    isPartOf: { '@id': `${EQUIPD_SITE_ORIGIN}/#website` },
    about: {
      '@type': 'Thing',
      name: 'Used gym equipment for sale',
    },
    publisher: { '@id': EQUIPD_ORGANIZATION_ID },
  }
}

export function buildBrowsePageCollectionSchema(listings = []) {
  const pageUrl = absoluteUrl(BROWSE_PATH)
  const selected = selectBrowsePageListings(listings)
  const listingItems = buildListingItemListElement(selected)
  const itemListElement = listingItems.length
    ? listingItems
    : BUY_EQUIPMENT_TYPES.map((category, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: category.label,
        url: `${EQUIPD_SITE_ORIGIN}${category.to}`,
      }))

  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    '@id': `${pageUrl}#collection`,
    url: pageUrl,
    name: BROWSE_PAGE_H1,
    description: BROWSE_PAGE_META_DESCRIPTION,
    isPartOf: { '@id': `${pageUrl}#webpage` },
    mainEntity: {
      '@type': 'ItemList',
      itemListElement,
    },
  }
}

export function buildBrowsePageSeoDocument({ listings = [] } = {}) {
  const selected = selectBrowsePageListings(listings)
  const typeLinks = BUY_EQUIPMENT_TYPES.map(
    (category) =>
      `<li><a href="${escapeHtml(category.to)}">${escapeHtml(category.label)}</a> — ${escapeHtml(category.description)}</li>`,
  ).join('')

  const bodyHtml = `
<article class="seo-prerender" data-equipd-seo-prerender="browse">
  <nav aria-label="Breadcrumb">
    <p><a href="/">Home</a> <span aria-hidden="true">/</span> Browse</p>
  </nav>
  <header>
    <h1>${escapeHtml(BROWSE_PAGE_H1)}</h1>
    <p>${escapeHtml(BROWSE_PAGE_META_DESCRIPTION)}</p>
    <p><a href="${BUY_USED_GYM_EQUIPMENT_PATH}">How buying on Equipd works</a></p>
  </header>
  <section aria-labelledby="seo-browse-listings-heading">
    <h2 id="seo-browse-listings-heading">Live marketplace listings</h2>
    ${renderLandingListingsHtml({ listings: selected, emptyMessage: BROWSE_LISTINGS_EMPTY })}
  </section>
  <section aria-labelledby="seo-browse-types-heading">
    <h2 id="seo-browse-types-heading">Browse by equipment type</h2>
    <ul>${typeLinks}</ul>
  </section>
</article>`.trim()

  return {
    path: BROWSE_PATH,
    title: BROWSE_PAGE_TITLE,
    description: BROWSE_PAGE_META_DESCRIPTION,
    canonicalPath: BROWSE_PATH,
    robots: 'index, follow, max-image-preview:large',
    openGraph: buildBrowsePageOpenGraph(),
    jsonLd: [
      buildBreadcrumbSchema(
        [
          { name: 'Home', item: '/' },
          { name: 'Browse', item: BROWSE_PATH },
        ],
        { canonicalUrl: BROWSE_PATH },
      ),
      buildBrowsePageWebPageSchema(),
      buildBrowsePageCollectionSchema(listings),
    ].filter(Boolean),
    bodyHtml,
  }
}

export function mapBrowseListingsForSeo(listings = []) {
  return mapLandingListingsForSeo(selectBrowsePageListings(listings))
}
