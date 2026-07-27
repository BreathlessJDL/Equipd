import { EQUIPD_SITE_ORIGIN } from './brandCatalogueCore.js'
import { BUYER_PROTECTION_HELP_PATH } from './trustMessaging.js'
import { buildLocationPageBreadcrumbSchema } from './breadcrumbStructuredData.js'

/**
 * Local marketplace hubs.
 *
 * centre.latitude / centre.longitude are approximate city-centre coordinates
 * (standard geographic town centres; used for the 40-mile eligible listing radius).
 * Do not fall back to text-only matching when a centre is missing — fix the config.
 */
export const LOCATION_HUB_RADIUS_MILES = 40
/** Exact metre equivalent of 40 miles for documentation / future PostGIS use. */
export const LOCATION_HUB_RADIUS_METRES = 64373.76

export const LOCATION_PAGES = {
  leeds: {
    slug: 'leeds',
    name: 'Leeds',
    regionLabel: 'West Yorkshire',
    centre: { latitude: 53.8008, longitude: -1.5491 },
    heading: 'Used gym equipment in Leeds',
    heroIntro:
      'Browse second-hand commercial and home gym equipment from sellers across Leeds and West Yorkshire.',
    intro:
      'Browse second-hand gym kit from sellers across Leeds and nearby West Yorkshire towns. Pick up locally and save on delivery.',
    metaDescription:
      'Browse used commercial and home gym equipment for sale in Leeds and within 40 miles. Search local listings, make offers and buy with confidence on Equipd.',
    areas: ['Leeds', 'Wakefield', 'Bradford', 'Huddersfield', 'York', 'Harrogate'],
  },
  manchester: {
    slug: 'manchester',
    name: 'Manchester',
    regionLabel: 'Greater Manchester',
    centre: { latitude: 53.4808, longitude: -2.2426 },
    heading: 'Used gym equipment in Manchester',
    heroIntro:
      'Browse second-hand commercial and home gym equipment from sellers across Manchester and Greater Manchester.',
    intro:
      'Find pre-owned weights, racks, and cardio gear from sellers in Greater Manchester and surrounding towns.',
    metaDescription:
      'Browse used commercial and home gym equipment for sale in Manchester and within 40 miles. Search local listings and buy with confidence on Equipd.',
    areas: ['Manchester', 'Salford', 'Bolton', 'Stockport', 'Oldham', 'Rochdale'],
  },
  birmingham: {
    slug: 'birmingham',
    name: 'Birmingham',
    regionLabel: 'the West Midlands',
    centre: { latitude: 52.4862, longitude: -1.8904 },
    heading: 'Used gym equipment in Birmingham',
    heroIntro:
      'Browse second-hand commercial and home gym equipment from sellers across Birmingham and the West Midlands.',
    intro:
      'Shop used gym equipment listed by sellers across Birmingham and the West Midlands commuter belt.',
    metaDescription:
      'Browse used commercial and home gym equipment for sale in Birmingham and within 40 miles. Search local listings and buy with confidence on Equipd.',
    areas: ['Birmingham', 'Wolverhampton', 'Coventry', 'Solihull', 'Walsall', 'Dudley'],
  },
  london: {
    slug: 'london',
    name: 'London',
    regionLabel: 'nearby towns',
    centre: { latitude: 51.5074, longitude: -0.1278 },
    heading: 'Used gym equipment in London',
    heroIntro:
      'Browse second-hand commercial and home gym equipment from sellers in London and within 40 miles.',
    intro:
      'Discover used home and commercial gym equipment from sellers across London and nearby towns.',
    metaDescription:
      'Browse used commercial and home gym equipment for sale in London and within 40 miles. Search local listings and buy with confidence on Equipd.',
    areas: ['London', 'Croydon', 'Wembley', 'Stratford', 'Watford', 'Romford'],
  },
  sheffield: {
    slug: 'sheffield',
    name: 'Sheffield',
    regionLabel: 'South Yorkshire',
    centre: { latitude: 53.3811, longitude: -1.4701 },
    heading: 'Used gym equipment in Sheffield',
    heroIntro:
      'Browse second-hand commercial and home gym equipment from sellers across Sheffield and South Yorkshire.',
    intro:
      'Browse second-hand gym kit from sellers across Sheffield and South Yorkshire.',
    metaDescription:
      'Browse used commercial and home gym equipment for sale in Sheffield and within 40 miles. Search local listings and buy with confidence on Equipd.',
    areas: ['Sheffield', 'Rotherham', 'Barnsley', 'Doncaster', 'Chesterfield'],
  },
  bristol: {
    slug: 'bristol',
    name: 'Bristol',
    regionLabel: 'the South West',
    centre: { latitude: 51.4545, longitude: -2.5879 },
    heading: 'Used gym equipment in Bristol',
    heroIntro:
      'Browse second-hand commercial and home gym equipment from sellers in Bristol and within 40 miles.',
    intro:
      'Find pre-owned weights, racks, and cardio gear from sellers in Bristol and the South West.',
    metaDescription:
      'Browse used commercial and home gym equipment for sale in Bristol and within 40 miles. Search local listings and buy with confidence on Equipd.',
    areas: ['Bristol', 'Bath', 'Weston-super-Mare', 'Gloucester', 'Swindon'],
  },
  liverpool: {
    slug: 'liverpool',
    name: 'Liverpool',
    regionLabel: 'Merseyside',
    centre: { latitude: 53.4084, longitude: -2.9916 },
    heading: 'Used gym equipment in Liverpool',
    heroIntro:
      'Browse second-hand commercial and home gym equipment from sellers across Liverpool and Merseyside.',
    intro:
      'Shop used gym equipment listed by sellers across Liverpool and Merseyside.',
    metaDescription:
      'Browse used commercial and home gym equipment for sale in Liverpool and within 40 miles. Search local listings and buy with confidence on Equipd.',
    areas: ['Liverpool', 'Wirral', 'St Helens', 'Southport', 'Warrington'],
  },
  newcastle: {
    slug: 'newcastle',
    name: 'Newcastle',
    regionLabel: 'the North East',
    centre: { latitude: 54.9783, longitude: -1.6178 },
    heading: 'Used gym equipment in Newcastle',
    heroIntro:
      'Browse second-hand commercial and home gym equipment from sellers in Newcastle and within 40 miles.',
    intro:
      'Discover used gym equipment from sellers across Newcastle and the North East.',
    metaDescription:
      'Browse used commercial and home gym equipment for sale in Newcastle and within 40 miles. Search local listings and buy with confidence on Equipd.',
    areas: ['Newcastle', 'Gateshead', 'Sunderland', 'Durham', 'Middlesbrough'],
  },
  glasgow: {
    slug: 'glasgow',
    name: 'Glasgow',
    regionLabel: 'central Scotland',
    centre: { latitude: 55.8642, longitude: -4.2518 },
    heading: 'Used gym equipment in Glasgow',
    heroIntro:
      'Browse second-hand commercial and home gym equipment from sellers in Glasgow and within 40 miles.',
    intro:
      'Browse second-hand gym kit from sellers across Glasgow and central Scotland.',
    metaDescription:
      'Browse used commercial and home gym equipment for sale in Glasgow and within 40 miles. Search local listings and buy with confidence on Equipd.',
    areas: ['Glasgow', 'Paisley', 'East Kilbride', 'Hamilton', 'Stirling'],
  },
  cardiff: {
    slug: 'cardiff',
    name: 'Cardiff',
    regionLabel: 'South Wales',
    centre: { latitude: 51.4816, longitude: -3.1791 },
    heading: 'Used gym equipment in Cardiff',
    heroIntro:
      'Browse second-hand commercial and home gym equipment from sellers across Cardiff and South Wales.',
    intro:
      'Find pre-owned gym equipment from sellers across Cardiff and South Wales.',
    metaDescription:
      'Browse used commercial and home gym equipment for sale in Cardiff and within 40 miles. Search local listings and buy with confidence on Equipd.',
    areas: ['Cardiff', 'Newport', 'Swansea', 'Bridgend', 'Barry'],
  },
}

export const LOCATION_SLUGS = Object.keys(LOCATION_PAGES)

export const LOCATION_BUYING_GUIDE_ITEMS = Object.freeze([
  {
    title: 'Buy locally',
    body: 'Inspect and collect quality equipment from sellers across {city} and nearby towns.',
  },
  {
    title: 'Pay securely',
    body: 'Complete eligible purchases through Equipd with secure Stripe payments.',
  },
  {
    title: 'Stay protected',
    body: 'Buyer Protection covers eligible purchases for 24 hours after confirmed collection or delivery.',
  },
])

export function getLocationPage(slug) {
  return LOCATION_PAGES[slug] ?? null
}

/**
 * Hub search centre + 40-mile radius for eligible local listings.
 * Throws if centre coordinates are missing (do not silently fall back to text matching).
 */
export function getLocationHubSearch(region) {
  if (!region) return null
  const latitude = Number(region.centre?.latitude)
  const longitude = Number(region.centre?.longitude)
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    throw new Error(
      `[locations] Missing centre coordinates for local hub "${region.slug || region.name}". Add centre.latitude / centre.longitude to LOCATION_PAGES.`,
    )
  }
  return {
    latitude,
    longitude,
    radiusMiles: LOCATION_HUB_RADIUS_MILES,
  }
}

/**
 * Areas used for optional text narrowing within the hub radius.
 * Default hub view is radius-only (empty array).
 */
export function getLocationHubQueryAreas(region, selectedArea = null) {
  if (!region) return []
  return selectedArea ? [selectedArea] : []
}

export const LOCATION_AREA_PARAM = 'area'

export function formatLocationAreas(areas = []) {
  if (areas.length === 0) return ''
  if (areas.length === 1) return areas[0]
  if (areas.length === 2) return `${areas[0]} and ${areas[1]}`

  return `${areas.slice(0, -1).join(', ')}, and ${areas[areas.length - 1]}`
}

function normalizeAreaName(areaName) {
  return areaName.trim().toLowerCase()
}

function findAreaInRegion(region, areaName) {
  if (!region || !areaName) return null

  const normalized = normalizeAreaName(areaName)
  return region.areas.find((area) => normalizeAreaName(area) === normalized) ?? null
}

/** Nearby towns/areas for a location hub, excluding the primary city. */
export function getLocationNearbyAreas(region) {
  if (!region?.areas?.length) return []
  return region.areas.filter(
    (area) => normalizeAreaName(area) !== normalizeAreaName(region.name),
  )
}

/** City-level location page slug for an area name, if one exists. */
export function getLocationSlugForArea(areaName) {
  const normalized = normalizeAreaName(areaName)
  if (!normalized) return null

  return (
    LOCATION_SLUGS.find((slug) => normalizeAreaName(LOCATION_PAGES[slug].name) === normalized) ??
    null
  )
}

export function parseLocationAreaParam(searchParams, region) {
  const raw = searchParams.get(LOCATION_AREA_PARAM)
  if (!raw?.trim() || !region) return null

  return findAreaInRegion(region, raw)
}

export function buildLocationPagePath(slug) {
  return `/listings/${slug}`
}

export function buildLocationPageMeta(region, selectedArea = null) {
  if (!region) return null
  const displayName = selectedArea ?? region.name
  return {
    title: `${displayName} Gym Equipment | Equipd`,
    description: selectedArea
      ? `Browse used commercial and home gym equipment for sale near ${selectedArea} in the ${region.name} area. Search local listings and buy with confidence on Equipd.`
      : region.metaDescription,
    canonicalPath: buildLocationPagePath(region.slug),
    robotsContent: 'index, follow',
  }
}

function fillCityCopy(template, cityName) {
  return String(template).replaceAll('{city}', cityName)
}

/**
 * Resolved view model for a location page, optionally narrowed to one nearby area.
 */
export function resolveLocationView(region, selectedArea = null) {
  const displayName = selectedArea ?? region.name
  const nearbyAreas = getLocationNearbyAreas(region)
  const regionLabel = region.regionLabel || 'nearby towns'
  const hubSearch = getLocationHubSearch(region)

  const heroIntro = selectedArea
    ? `Browse second-hand commercial and home gym equipment from sellers in ${selectedArea} within 40 miles of ${region.name}.`
    : region.heroIntro

  return {
    slug: region.slug,
    regionName: region.name,
    regionLabel,
    centre: hubSearch,
    hubRadiusMiles: LOCATION_HUB_RADIUS_MILES,
    name: displayName,
    heading: selectedArea ? `Used gym equipment in ${selectedArea}` : region.heading,
    headingPrefix: 'Used gym equipment in ',
    headingAccent: displayName,
    intro: region.intro,
    heroIntro,
    metaDescription: region.metaDescription,
    areas: region.areas,
    nearbyAreas,
    /** Radius query areas — empty on hub view; single town when ?area= is set. */
    filterAreas: getLocationHubQueryAreas(region, selectedArea),
    selectedArea,
    areaScopeText: selectedArea ? selectedArea : `${region.name} and within 40 miles`,
    browseCtaLabel: `Browse ${displayName} listings`,
    guideHeading: `Buying gym equipment around ${displayName}`,
    nearbyHeading: `Explore gym equipment near ${region.name}`,
    guideItems: LOCATION_BUYING_GUIDE_ITEMS.map((item) => ({
      title: item.title,
      body: fillCityCopy(item.body, displayName),
    })),
    seoBody:
      `Browse pre-owned treadmills, spin bikes, rowers, weights, racks and commercial gym kit from sellers ${
        selectedArea
          ? `in ${selectedArea}`
          : `in ${region.name} and within 40 miles`
      } — with collection, seller delivery, or buyer-arranged courier options.`,
    sellerNearbyText:
      region.areas.length > 1 ? formatLocationAreas(region.areas.slice(1)) : region.name,
  }
}

export function isAreaPillActive(areaName, locationView) {
  const normalized = normalizeAreaName(areaName)
  if (locationView.selectedArea) {
    return normalized === normalizeAreaName(locationView.selectedArea)
  }

  return normalized === normalizeAreaName(locationView.regionName)
}

/**
 * In-location navigation for nearby-area pills (never routes to /browse).
 */
export function getAreaNavigationHref(areaName, regionSlug) {
  const dedicatedSlug = getLocationSlugForArea(areaName)
  if (dedicatedSlug && dedicatedSlug !== regionSlug) {
    return `/listings/${dedicatedSlug}`
  }

  const region = LOCATION_PAGES[regionSlug]
  if (!region) return `/listings/${regionSlug}`

  if (normalizeAreaName(areaName) === normalizeAreaName(region.name)) {
    return `/listings/${regionSlug}`
  }

  const matchedArea = findAreaInRegion(region, areaName)
  if (!matchedArea) return `/listings/${regionSlug}`

  return `/listings/${regionSlug}?${LOCATION_AREA_PARAM}=${encodeURIComponent(matchedArea)}`
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/**
 * Lightweight crawlable shell for location hubs (listings remain client-fetched).
 */
export function buildLocationPageSeoDocument(region) {
  if (!region) return null
  const view = resolveLocationView(region)
  const meta = buildLocationPageMeta(region)
  const path = buildLocationPagePath(region.slug)
  const pageUrl = `${EQUIPD_SITE_ORIGIN}${path}`

  const nearbyLinks = view.nearbyAreas
    .map((area) => {
      const href = getAreaNavigationHref(area, region.slug)
      return `<li><a href="${escapeHtml(href)}">${escapeHtml(area)}</a></li>`
    })
    .join('\n      ')

  const guideItems = view.guideItems
    .map(
      (item, index) =>
        `<li><strong>${index + 1}. ${escapeHtml(item.title)}</strong> ${escapeHtml(item.body)}</li>`,
    )
    .join('\n      ')

  const bodyHtml = `
<article class="seo-prerender location-listings-seo">
  <nav aria-label="Breadcrumb"><p><a href="/">Home</a> <span aria-hidden="true">/</span> ${escapeHtml(region.name)}</p></nav>
  <header>
    <p>Gym equipment near you</p>
    <h1>${escapeHtml(view.heading)}</h1>
    <p>${escapeHtml(view.heroIntro)}</p>
    <p><a href="#location-listings">${escapeHtml(view.browseCtaLabel)}</a> · <a href="/valuation">Get a free valuation</a></p>
  </header>
  <section id="location-listings" aria-labelledby="seo-location-listings-heading">
    <h2 id="seo-location-listings-heading">Listings in ${escapeHtml(region.name)}</h2>
    <p>Live local listings load on this page. Browse filters and sorting are available in the Equipd marketplace.</p>
  </section>
  <aside aria-labelledby="seo-location-guide-heading">
    <h2 id="seo-location-guide-heading">${escapeHtml(view.guideHeading)}</h2>
    <ol>${guideItems}</ol>
    <p><a href="${escapeHtml(BUYER_PROTECTION_HELP_PATH)}">Learn more about Buyer Protection</a></p>
  </aside>
  <section aria-labelledby="seo-location-nearby-heading">
    <h2 id="seo-location-nearby-heading">${escapeHtml(view.nearbyHeading)}</h2>
    <ul>${nearbyLinks}</ul>
  </section>
  <section aria-labelledby="seo-location-about-heading">
    <h2 id="seo-location-about-heading">Buying used gym equipment in ${escapeHtml(region.name)}</h2>
    <p>${escapeHtml(view.seoBody)}</p>
    <p>${escapeHtml(region.intro)}</p>
  </section>
</article>`

  return {
    path,
    title: meta.title,
    description: meta.description,
    canonicalPath: path,
    robots: meta.robotsContent,
    bodyHtml,
    jsonLd: [
      {
        '@context': 'https://schema.org',
        '@type': 'WebPage',
        '@id': `${pageUrl}#webpage`,
        url: pageUrl,
        name: meta.title,
        description: meta.description,
        isPartOf: { '@id': `${EQUIPD_SITE_ORIGIN}/#website` },
      },
      buildLocationPageBreadcrumbSchema(region),
    ].filter(Boolean),
  }
}

export function buildAllLocationPageSeoDocuments() {
  return LOCATION_SLUGS.map((slug) => buildLocationPageSeoDocument(LOCATION_PAGES[slug])).filter(
    Boolean,
  )
}
