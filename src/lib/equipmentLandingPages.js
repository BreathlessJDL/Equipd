/**
 * Build CategoryLandingPage content for equipment-type SEO landings.
 */

import { buildBrowseNavPath } from './browseSearchNavigation.js'
import {
  BUY_USED_GYM_EQUIPMENT_PATH,
  BUY_USED_GYM_EQUIPMENT_OG_IMAGE,
} from './buyUsedGymEquipmentPage.js'
import { LANDING_PATHS } from './landingPagePaths.js'
import { SELL_GYM_EQUIPMENT_PATH, VALUATION_PATH, BRANDS_PATH } from './sellGymEquipmentPage.js'
import { buildCategoryLandingSeoDocument } from './categoryLandingSeo.js'
import { EQUIPMENT_LANDING_COPY } from './equipmentLandingCopy.js'
import {
  EQUIPMENT_LANDING_DEFS_VALIDATED,
  EQUIPMENT_LANDING_PATHS,
  EQUIPMENT_LANDING_PATH_SET,
  getEquipmentLandingDef,
} from './equipmentLandingDefs.js'

function buildBrowsePath(def) {
  return buildBrowseNavPath({
    rating: def.rating,
    categorySlugs: def.categorySlugs || [],
    search: def.search || '',
  })
}

function clusterExploreLinks(def) {
  const siblings = EQUIPMENT_LANDING_DEFS_VALIDATED.filter(
    (other) => other.cluster === def.cluster && other.id !== def.id,
  ).slice(0, 4)

  const links = [
    {
      label: def.parentName,
      description: 'Back to the parent category hub',
      to: def.parentPath,
    },
    ...siblings.map((other) => ({
      label: EQUIPMENT_LANDING_COPY[other.id]?.h1 || other.id,
      description: EQUIPMENT_LANDING_COPY[other.id]?.listingsLead?.slice(0, 90) || 'Related equipment',
      to: other.path,
    })),
    {
      label: 'Buy Used Gym Equipment',
      description: 'How buying on Equipd works',
      to: BUY_USED_GYM_EQUIPMENT_PATH,
    },
    {
      label: 'Sell Gym Equipment',
      description: 'List surplus equipment for sale',
      to: SELL_GYM_EQUIPMENT_PATH,
    },
    {
      label: 'Equipment Valuation',
      description: 'Free Instant Valuation tool',
      to: VALUATION_PATH,
    },
    {
      label: 'Equipment Brands',
      description: 'Equipment values by brand',
      to: BRANDS_PATH,
    },
  ]

  if (def.cluster.startsWith('commercial')) {
    links.splice(1, 0, {
      label: 'Home Gym Equipment',
      description: 'Home-rated fitness equipment',
      to: LANDING_PATHS.homeGym,
    })
  } else {
    links.splice(1, 0, {
      label: 'Commercial Gym Equipment',
      description: 'Facility-grade fitness equipment',
      to: LANDING_PATHS.commercialGym,
    })
  }

  return Object.freeze(links.slice(0, 8))
}

/**
 * @param {import('./equipmentLandingDefs.js').EquipmentLandingDef} def
 */
export function buildEquipmentLandingContent(def) {
  const copy = EQUIPMENT_LANDING_COPY[def.id]
  if (!copy) {
    throw new Error(`Missing EQUIPMENT_LANDING_COPY for ${def.id}`)
  }

  const browsePath = buildBrowsePath(def)
  const isCommercial = def.rating === 'full_commercial'

  return Object.freeze({
    idPrefix: def.id,
    prerenderId: def.id,
    path: def.path,
    metaTitle: copy.metaTitle,
    pageTitle: copy.metaTitle,
    metaDescription: copy.metaDescription,
    ogImage: Object.freeze({
      ...BUY_USED_GYM_EQUIPMENT_OG_IMAGE,
      alt: `Equipd marketplace for ${copy.h1.toLowerCase()} in the UK`,
    }),
    breadcrumbs: Object.freeze([
      { name: def.parentName, item: def.parentPath },
      { name: copy.h1, item: def.path },
    ]),
    schemaAbout: copy.schemaAbout,
    significantLinks: Object.freeze([
      def.parentPath,
      browsePath,
      BUY_USED_GYM_EQUIPMENT_PATH,
      SELL_GYM_EQUIPMENT_PATH,
      VALUATION_PATH,
      BRANDS_PATH,
      isCommercial ? LANDING_PATHS.homeGym : LANDING_PATHS.commercialGym,
      isCommercial ? LANDING_PATHS.refurbishedCommercial : LANDING_PATHS.refurbishedHome,
    ]),
    eyebrow: copy.eyebrow,
    h1: copy.h1,
    lead: copy.lead,
    primaryCta: Object.freeze({
      to: browsePath,
      label: copy.midCtaLabel || `Browse ${copy.h1}`,
    }),
    secondaryCta: Object.freeze({
      to: VALUATION_PATH,
      label: 'Value Your Equipment',
    }),
    searchLabel: copy.searchLabel,
    heroTrustItems: copy.heroTrustItems,
    listingFilter: Object.freeze({
      rating: def.rating,
      categorySlugs: def.categorySlugs || [],
      search: def.search || '',
      searchIn: def.searchIn || undefined,
      excludeTitleIncludes: def.excludeTitleIncludes || undefined,
    }),
    browsePath,
    listingsNote: 'Live marketplace',
    listingsHeading: copy.listingsHeading,
    listingsLead: copy.listingsLead,
    listingsCta: copy.listingsCta,
    listingsEmpty:
      def.search
        ? `Few listings match this exact search right now. Browse related ${isCommercial ? 'commercial' : 'home'} equipment or check back soon.`
        : undefined,
    categoryNote: 'Browse by type',
    categoryHeading: copy.categoryHeading,
    categoryLead: copy.categoryLead,
    categories: def.neighborCategories,
    brandNote: 'Trusted manufacturers',
    brandHeading: 'Shop by brand',
    brandLead: copy.brandLead,
    featuredBrandSlugs: def.featuredBrandSlugs,
    benefitsHeading: copy.benefitsHeading,
    benefits: copy.benefits,
    valuationEyebrow: copy.valuationEyebrow,
    valuationHeading: copy.valuationHeading,
    valuationCopy: copy.valuationCopy,
    valuationSteps: copy.valuationSteps,
    guideNote: copy.guideNote || 'Buying guide',
    guideHeading: copy.guideHeading,
    guideIntro: copy.guideIntro,
    guideSections: copy.guideSections,
    faqNote: copy.faqNote || 'Common questions',
    faqIntro: copy.faqIntro,
    faqItems: copy.faqItems,
    midCtaHeading: copy.midCtaHeading,
    midCtaLead: copy.midCtaLead,
    midCtaLabel: copy.midCtaLabel,
    exploreNote: 'Keep exploring',
    exploreHeading: 'Explore more',
    exploreLead: copy.exploreLead,
    exploreLinks: clusterExploreLinks(def),
  })
}

export const EQUIPMENT_LANDING_CONTENTS = Object.freeze(
  Object.fromEntries(
    EQUIPMENT_LANDING_DEFS_VALIDATED.map((def) => [def.id, buildEquipmentLandingContent(def)]),
  ),
)

export const EQUIPMENT_LANDING_CONTENT_LIST = Object.freeze(
  EQUIPMENT_LANDING_DEFS_VALIDATED.map((def) => EQUIPMENT_LANDING_CONTENTS[def.id]),
)

export function getEquipmentLandingContent(idOrPath) {
  const def = getEquipmentLandingDef(idOrPath)
  return def ? EQUIPMENT_LANDING_CONTENTS[def.id] : null
}

export function buildAllEquipmentLandingSeoDocuments() {
  return EQUIPMENT_LANDING_CONTENT_LIST.map((content) =>
    buildCategoryLandingSeoDocument(content),
  )
}

export {
  EQUIPMENT_LANDING_PATHS,
  EQUIPMENT_LANDING_PATH_SET,
  EQUIPMENT_LANDING_DEFS_VALIDATED,
  getEquipmentLandingDef,
}
