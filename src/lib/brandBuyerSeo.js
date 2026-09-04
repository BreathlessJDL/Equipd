/**
 * Brand-specific buyer-intent SEO / content configuration.
 *
 * Default brand pages remain valuation-led. Brands listed here opt into
 * marketplace-first presentation without forking BrandPage.jsx.
 *
 * Phase 1A: Concept2 (benchmark — keep stable SEO; design template refined separately).
 * Phase 1B: Wattbike, Cybex, Life Fitness, Hammer Strength — same shared BrandPage template.
 */

import { LANDING_PATHS } from './landingPagePaths.js'
import { PHASE1B_BRAND_BUYER_SEO } from './brandBuyerSeoPhase1b.js'

/** @typedef {'buyer' | 'valuation'} BrandPageIntent */

/**
 * @typedef {object} BrandBuyerModelGroup
 * @property {string} id
 * @property {string} title
 * @property {string[]} keys
 */

/**
 * @typedef {object} BrandBuyerSeoConfig
 * @property {string} slug
 * @property {BrandPageIntent} intent
 * @property {string} h1
 * @property {string} metaTitle  Document title without "| Equipd"
 * @property {string} metaDescription
 * @property {string} lede
 * @property {{ label: string }} [heroCta]  Buyer hero primary link (brand browse)
 * @property {{ label: string }} [heroSecondaryCta]  Buyer hero secondary link (values/catalogue)
 * @property {string} [searchPlaceholder]
 * @property {string} [heroContextBody]  Right-column contextual copy under stats
 * @property {string} marketplaceHeading
 * @property {string} marketplaceHeadingEmpty
 * @property {string} marketplaceLede
 * @property {string} marketplaceLedeEmpty
 * @property {string} [modelsHeading]
 * @property {string} [modelsLede]
 * @property {string[]} [featuredModelKeys]
 * @property {BrandBuyerModelGroup[]} [modelGroups]
 * @property {Record<string, string>} [modelBlurbs]
 * @property {{ title: string, paragraphs?: string[], checkpoints?: { title: string, body: string }[] }} [buyingGuide]
 * @property {string} [valuesHeading]
 * @property {string} [valuesLede]
 * @property {{ title: string, paragraphs: string[] }} [about]
 * @property {{ to: string, label: string }[]} [categoryLinks]
 * @property {{ question: string, answer: string }[]} [faqItems]
 * @property {string} [collectionPageName]
 */

/** @type {Readonly<Record<string, BrandBuyerSeoConfig>>} */
export const BRAND_BUYER_SEO = Object.freeze({
  concept2: Object.freeze({
    slug: 'concept2',
    intent: 'buyer',
    h1: 'Used Concept2 Equipment for Sale',
    // Rower queries dominate GSC; catalogue is also rower-heavy (4 of 6 models).
    metaTitle: 'Used Concept2 Rowers & Gym Equipment for Sale',
    metaDescription: (
      'Browse used Concept2 equipment for sale on Equipd, including RowErg models, '
      + 'BikeErg and SkiErg. Check live UK marketplace listings and model value guides.'
    ),
    lede: (
      'Find used Concept2 equipment from UK sellers and research the models before you buy.'
    ),
    heroCta: Object.freeze({
      label: 'Browse Concept2 for sale',
    }),
    heroSecondaryCta: Object.freeze({
      label: 'Explore Concept2 values',
    }),
    searchPlaceholder: 'Search Concept2 equipment and models...',
    heroContextBody: (
      'Compare models, research values and buy with confidence from UK sellers on Equipd.'
    ),
    marketplaceHeading: 'Used Concept2 equipment for sale',
    marketplaceHeadingEmpty: 'Looking for used Concept2 equipment?',
    marketplaceLede: 'Live Concept2 listings from Equipd marketplace sellers in the UK.',
    marketplaceLedeEmpty: (
      'There are no matching Concept2 listings right now. Browse related equipment '
      + 'or request what you need — new Concept2 stock appears on Equipd as sellers list it.'
    ),
    modelsHeading: 'Explore Concept2 equipment',
    modelsLede: (
      'Research Concept2 models before you buy — compare RowErg Model C, D and E, '
      + 'Dynamic RowErg, BikeErg and SkiErg, then open a model guide for specs and values.'
    ),
    featuredModelKeys: Object.freeze([
      'concept2-rowers-rowerg-model-d',
      'concept2-rowers-rowerg-model-e',
      'concept2-rowers-rowerg-model-c',
      'concept2-rowers-dynamic-rowerg',
      'concept2-exercise-bike-bikeerg',
      'concept2-skierg-skierg',
    ]),
    modelBlurbs: Object.freeze({
      'concept2-rowers-rowerg-model-d': (
        'The widely used Concept2 RowErg Model D — the reference air rower for '
        + 'homes, clubs and commercial floors.'
      ),
      'concept2-rowers-rowerg-model-e': (
        'RowErg Model E sits higher off the floor with a front-facing monitor arm '
        + 'favoured in some club and rehab settings.'
      ),
      'concept2-rowers-rowerg-model-c': (
        'An earlier RowErg generation still widely searched by buyers looking for '
        + 'used Concept2 rowers.'
      ),
      'concept2-rowers-dynamic-rowerg': (
        'Dynamic RowErg uses a floating frame feel that differs from the classic '
        + 'stationary rail models.'
      ),
      'concept2-exercise-bike-bikeerg': (
        'BikeErg brings Concept2’s air-resistance training approach to an upright bike.'
      ),
      'concept2-skierg-skierg': (
        'SkiErg is Concept2’s standing upper-body ergometer, popular for conditioning '
        + 'alongside rowers.'
      ),
    }),
    buyingGuide: Object.freeze({
      title: 'What to check when buying used Concept2 equipment',
      checkpoints: Object.freeze([
        Object.freeze({
          title: 'Condition & wear',
          body: (
            'Inspect overall condition carefully: frame finish, footplates or pedals, '
            + 'handle/grip wear and any corrosion around fasteners. Ask how the machine '
            + 'was used — home, studio or commercial floors often show different wear patterns.'
          ),
        }),
        Object.freeze({
          title: 'RowErg mechanical checks',
          body: (
            'On RowErg machines, check the rail and seat rollers for smooth travel, the '
            + 'chain or drive for dryness or stretch, and that the handle returns cleanly.'
          ),
        }),
        Object.freeze({
          title: 'Monitor / electronics',
          body: (
            'Confirm the Performance Monitor powers on, records strokes and responds to '
            + 'buttons. Under load, check that metrics update normally before you pay.'
          ),
        }),
        Object.freeze({
          title: 'BikeErg / SkiErg checks',
          body: (
            'On BikeErg and SkiErg, test resistance through the range, listen for unusual '
            + 'noise from the flywheel, and confirm the monitor behaves normally under load.'
          ),
        }),
        Object.freeze({
          title: 'Collection, transport & parts',
          body: (
            'Concept2 machines are widely supported in the UK, which helps with common wear '
            + 'parts, but always confirm what is included (monitor, power supply, feet, tools) '
            + 'and agree collection or delivery before you pay through Equipd.'
          ),
        }),
      ]),
      paragraphs: Object.freeze([
        (
          'Inspect overall condition carefully: frame finish, footplates or pedals, '
          + 'handle/grip wear and any corrosion around fasteners. Ask how the machine '
          + 'was used — home, studio or commercial floors often show different wear patterns.'
        ),
        (
          'On RowErg machines, check the rail and seat rollers for smooth travel, the '
          + 'chain or drive for dryness or stretch, and that the handle returns cleanly. '
          + 'Confirm the Performance Monitor powers on, records strokes and responds to buttons.'
        ),
        (
          'On BikeErg and SkiErg, test resistance through the range, listen for unusual '
          + 'noise from the flywheel, and confirm the monitor behaves normally under load.'
        ),
        (
          'Concept2 machines are widely supported in the UK, which helps with common wear '
          + 'parts, but always confirm what is included (monitor, power supply, feet, tools) '
          + 'and agree collection or delivery before you pay through Equipd.'
        ),
      ]),
    }),
    valuesHeading: 'Research Concept2 equipment values',
    valuesLede: (
      'Open a model value guide to research original RRP, production information and '
      + 'estimated used values in context — live asking prices on marketplace listings above '
      + 'may differ from guide ranges.'
    ),
    about: Object.freeze({
      title: 'About used Concept2 equipment on Equipd',
      paragraphs: Object.freeze([
        (
          'Concept2 is best known for air-resistance rowing machines, alongside BikeErg '
          + 'and SkiErg. On Equipd you can browse used Concept2 equipment for sale from '
          + 'UK sellers, compare models in the catalogue, and use value guides when you '
          + 'want a sense of typical used pricing.'
        ),
        (
          'Equipd estimates used values from original RRP baselines, production years, '
          + 'condition and console options where mapped — then links you to live marketplace '
          + 'listings when sellers have Concept2 equipment listed.'
        ),
      ]),
    }),
    categoryLinks: Object.freeze([
      { to: '/used-commercial-rowing-machines', label: 'Used commercial rowing machines' },
      { to: '/home-rowing-machines', label: 'Home rowing machines' },
      { to: LANDING_PATHS.commercialCardio, label: 'Commercial cardio equipment' },
      { to: LANDING_PATHS.buy, label: 'Buy used gym equipment' },
    ]),
    faqItems: Object.freeze([
      {
        question: 'Can I buy used Concept2 equipment on Equipd?',
        answer: (
          'Yes. Equipd is a UK marketplace where sellers list used Concept2 equipment '
          + 'for sale. When listings are live they appear on this page and in browse '
          + 'results filtered by Concept2.'
        ),
      },
      {
        question: 'Which Concept2 models does Equipd cover?',
        answer: (
          'The Equipd catalogue currently includes Concept2 RowErg Model C, Model D and '
          + 'Model E, Dynamic RowErg, BikeErg and SkiErg — each with its own model page '
          + 'and value guide.'
        ),
      },
      {
        question: 'What should I check on a used Concept2 rower?',
        answer: (
          'Check the rail and seat rollers, chain or drive condition, handle return, '
          + 'footplates and that the Performance Monitor powers on and records correctly. '
          + 'Ask the seller about usage history and what accessories are included.'
        ),
      },
      {
        question: 'How are Concept2 equipment values estimated?',
        answer: (
          'Equipd estimates used values from the model’s original RRP, manufacture year, '
          + 'condition and (where relevant) console configuration. Live asking prices on '
          + 'marketplace listings may differ from the typical value range on a model guide.'
        ),
      },
      {
        question: 'Can I sell my Concept2 equipment on Equipd?',
        answer: (
          'Yes. You can create a listing from a valuation or from the sell flow. Equipd '
          + 'supports secure offers, handover tracking and seller payouts for eligible equipment.'
        ),
      },
    ]),
    collectionPageName: 'Used Concept2 Equipment for Sale',
  }),
  ...PHASE1B_BRAND_BUYER_SEO,
})

/**
 * @param {string | null | undefined} slug
 * @returns {BrandBuyerSeoConfig | null}
 */
export function getBrandBuyerSeoConfig(slug) {
  const key = String(slug || '').trim().toLowerCase()
  if (!key) return null
  return BRAND_BUYER_SEO[key] || null
}

/**
 * @param {string | null | undefined} slug
 * @returns {boolean}
 */
export function isBuyerIntentBrand(slug) {
  return getBrandBuyerSeoConfig(slug)?.intent === 'buyer'
}

/**
 * Flatten featured keys from either featuredModelKeys or modelGroups.
 * @param {BrandBuyerSeoConfig | null | undefined} config
 * @returns {string[]}
 */
export function getConfiguredBrandModelKeys(config) {
  if (!config) return []
  if (config.modelGroups?.length) {
    return config.modelGroups.flatMap((group) => group.keys || [])
  }
  return [...(config.featuredModelKeys || [])]
}

/**
 * Resolve products for the buyer "models" section in configured order.
 * @param {BrandBuyerSeoConfig | null | undefined} config
 * @param {Array<{ canonicalProductKey?: string, canonical_product_key?: string, href?: string, displayName?: string }>} products
 */
export function selectConfiguredBrandModels(config, products = []) {
  const keys = getConfiguredBrandModelKeys(config)
  if (!keys.length) return []
  const byKey = new Map(
    products
      .map((product) => {
        const key = product.canonicalProductKey || product.canonical_product_key
        return key ? [String(key), product] : null
      })
      .filter(Boolean),
  )
  return keys
    .map((key) => {
      const product = byKey.get(key)
      if (!product) return null
      return {
        product,
        blurb: config.modelBlurbs?.[key] || null,
      }
    })
    .filter(Boolean)
}

/**
 * Grouped model discovery for large catalogues (future Phase 1B brands).
 * Small catalogues return a single untitled group.
 * @param {BrandBuyerSeoConfig | null | undefined} config
 * @param {Array<object>} products
 */
export function selectConfiguredBrandModelGroups(config, products = []) {
  if (!config) return []
  const byKey = new Map(
    products
      .map((product) => {
        const key = product.canonicalProductKey || product.canonical_product_key
        return key ? [String(key), product] : null
      })
      .filter(Boolean),
  )

  function mapKeys(keys) {
    return (keys || [])
      .map((key) => {
        const product = byKey.get(key)
        if (!product) return null
        return {
          product,
          blurb: config.modelBlurbs?.[key] || null,
        }
      })
      .filter(Boolean)
  }

  if (config.modelGroups?.length) {
    return config.modelGroups
      .map((group) => ({
        id: group.id,
        title: group.title,
        items: mapKeys(group.keys),
      }))
      .filter((group) => group.items.length > 0)
  }

  const items = mapKeys(config.featuredModelKeys)
  return items.length ? [{ id: 'all', title: null, items }] : []
}

/**
 * Map live listings into prerender-safe summary rows (no card HTML).
 * @param {Array<{ title?: string, slug?: string, price_pence?: number, brand?: string }>} listings
 * @param {{ limit?: number }} [options]
 */
export function mapBrandListingsForSeo(listings = [], { limit = 6 } = {}) {
  return listings
    .filter((listing) => listing?.slug && listing?.title)
    .slice(0, limit)
    .map((listing) => ({
      title: String(listing.title).trim(),
      href: `/listings/${listing.slug}`,
      pricePence: Number.isFinite(Number(listing.price_pence)) ? Number(listing.price_pence) : null,
    }))
}
