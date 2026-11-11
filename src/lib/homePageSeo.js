/**
 * Homepage SEO document — crawlable Recently Added listings without changing
 * homepage title, canonical or logged-in React behaviour.
 */

import { BUY_USED_GYM_EQUIPMENT_PATH } from './buyUsedGymEquipmentPage.js'
import { EQUIPD_SITE_ORIGIN } from './brandCatalogueCore.js'
import { HOME_RECENT_LISTINGS_PAGE_SIZE } from './constants.js'
import {
  buildListingItemListElement,
  mapLandingListingsForSeo,
  renderLandingListingsHtml,
  selectPublicLandingListings,
} from './landingListingSeo.js'
import { DEFAULT_PAGE_DESCRIPTION, DEFAULT_PAGE_TITLE } from './pageTitles.js'
import { BROWSE_PATH } from './sellGymEquipmentPage.js'
import {
  EQUIPD_DEFAULT_SOCIAL_IMAGE_ALT,
  EQUIPD_DEFAULT_SOCIAL_IMAGE_PATH,
  buildSocialOpenGraph,
} from './socialPreview.js'

export const HOME_PAGE_PATH = '/'
export const HOME_RECENT_LISTINGS_EMPTY =
  'No live listings are available right now. Check back soon or browse used gym equipment.'

export const HOME_SOCIAL_TITLE = 'Buy & Sell Used Gym Equipment'
export const HOME_SOCIAL_DESCRIPTION = 'Home & Commercial Equipment Across the UK'
export const HOME_SOCIAL_IMAGE = Object.freeze({
  src: EQUIPD_DEFAULT_SOCIAL_IMAGE_PATH,
  width: 1200,
  height: 630,
  alt: EQUIPD_DEFAULT_SOCIAL_IMAGE_ALT,
})

export function selectHomeRecentListings(
  listings = [],
  { limit = HOME_RECENT_LISTINGS_PAGE_SIZE } = {},
) {
  return selectPublicLandingListings(listings, {}, { limit })
}

export function buildHomePageOpenGraph() {
  return buildSocialOpenGraph({
    title: HOME_SOCIAL_TITLE,
    description: HOME_SOCIAL_DESCRIPTION,
    url: `${EQUIPD_SITE_ORIGIN}/`,
    image: HOME_SOCIAL_IMAGE.src,
    imageWidth: HOME_SOCIAL_IMAGE.width,
    imageHeight: HOME_SOCIAL_IMAGE.height,
    imageAlt: HOME_SOCIAL_IMAGE.alt,
    fallbackImage: false,
  })
}

export function buildHomePageSeoDocument({ listings = [] } = {}) {
  const selected = selectHomeRecentListings(listings)
  const bodyHtml = `
<article class="seo-prerender" data-equipd-seo-prerender="home">
  <header>
    <h1>Buy, Sell &amp; Value Used Gym Equipment</h1>
    <p>${DEFAULT_PAGE_DESCRIPTION}</p>
    <p>
      <a href="${BUY_USED_GYM_EQUIPMENT_PATH}">Buy used gym equipment</a>
      · <a href="${BROWSE_PATH}">Browse listings</a>
    </p>
  </header>
  <section aria-labelledby="seo-home-recent-heading">
    <h2 id="seo-home-recent-heading">Recently Added</h2>
    ${renderLandingListingsHtml({
      listings: selected,
      emptyMessage: HOME_RECENT_LISTINGS_EMPTY,
      textOnly: true,
    })}
    <p><a href="${BROWSE_PATH}">View all</a></p>
  </section>
</article>`.trim()

  return {
    path: HOME_PAGE_PATH,
    title: DEFAULT_PAGE_TITLE,
    description: DEFAULT_PAGE_DESCRIPTION,
    canonicalPath: HOME_PAGE_PATH,
    robots: 'index, follow, max-image-preview:large',
    openGraph: buildHomePageOpenGraph(),
    jsonLd: [
      {
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        '@id': `${EQUIPD_SITE_ORIGIN}/#recent-listings`,
        url: `${EQUIPD_SITE_ORIGIN}/`,
        name: 'Recently Added',
        isPartOf: { '@id': `${EQUIPD_SITE_ORIGIN}/#website` },
        mainEntity: {
          '@type': 'ItemList',
          itemListElement: buildListingItemListElement(selected),
        },
      },
    ],
    bodyHtml,
    crawlerOnlyBody: true,
  }
}

export function mapHomeRecentListingsForSeo(listings = []) {
  return mapLandingListingsForSeo(selectHomeRecentListings(listings))
}
