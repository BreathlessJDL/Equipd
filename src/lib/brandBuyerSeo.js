/**
 * Brand-specific buyer-intent SEO / content configuration.
 *
 * Default brand pages remain valuation-led. Brands listed here opt into
 * marketplace-first presentation without forking BrandPage.jsx.
 *
 * Only Concept2 is enabled in Phase 1A. Add Wattbike / Cybex / Life Fitness /
 * Hammer Strength later by extending BRAND_BUYER_SEO — do not scatter
 * slug conditionals through the page component.
 */

import { LANDING_PATHS } from './landingPagePaths.js'

/** @typedef {'buyer' | 'valuation'} BrandPageIntent */

/**
 * @typedef {object} BrandBuyerSeoConfig
 * @property {string} slug
 * @property {BrandPageIntent} intent
 * @property {string} h1
 * @property {string} metaTitle  Document title without "| Equipd"
 * @property {string} metaDescription
 * @property {string} lede
 * @property {string} marketplaceHeading
 * @property {string} marketplaceHeadingEmpty
 * @property {string} marketplaceLede
 * @property {string} marketplaceLedeEmpty
 * @property {string} [modelsHeading]
 * @property {string} [modelsLede]
 * @property {string[]} [featuredModelKeys]
 * @property {Record<string, string>} [modelBlurbs]
 * @property {{ title: string, paragraphs: string[] }} [buyingGuide]
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
      'Find used Concept2 equipment on Equipd — browse live marketplace listings, '
      + 'compare RowErg, BikeErg and SkiErg models, and check estimated used values '
      + 'before you buy.'
    ),
    marketplaceHeading: 'Used Concept2 equipment for sale',
    marketplaceHeadingEmpty: 'Looking for used Concept2 equipment?',
    marketplaceLede: 'Live Concept2 listings from Equipd marketplace sellers in the UK.',
    marketplaceLedeEmpty: (
      'There are no matching Concept2 listings right now. Browse related equipment '
      + 'or request what you need — new Concept2 stock appears on Equipd as sellers list it.'
    ),
    modelsHeading: 'Concept2 models on Equipd',
    modelsLede: (
      'Equipd’s Concept2 catalogue covers the machines buyers look for most: '
      + 'RowErg Model C, D and E, Dynamic RowErg, BikeErg and SkiErg.'
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
        'The widely used Concept2 RowErg Model D — the model most UK buyers mean '
        + 'when they search for a used Concept2 rower.'
      ),
      'concept2-rowers-rowerg-model-e': (
        'RowErg Model E sits higher than the Model D, which some buyers prefer for '
        + 'easier mounting and facility floors.'
      ),
      'concept2-rowers-rowerg-model-c': (
        'Earlier RowErg Model C machines still appear on the used market and share '
        + 'the familiar Concept2 rowing feel.'
      ),
      'concept2-rowers-dynamic-rowerg': (
        'Dynamic RowErg uses a moving footplate design for a different rowing feel '
        + 'compared with the standard RowErg.'
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
 * Resolve products for the buyer "models" section in configured order.
 * @param {BrandBuyerSeoConfig | null | undefined} config
 * @param {Array<{ canonicalProductKey?: string, canonical_product_key?: string, href?: string, displayName?: string }>} products
 */
export function selectConfiguredBrandModels(config, products = []) {
  if (!config?.featuredModelKeys?.length) return []
  const byKey = new Map(
    products
      .map((product) => {
        const key = product.canonicalProductKey || product.canonical_product_key
        return key ? [String(key), product] : null
      })
      .filter(Boolean),
  )
  return config.featuredModelKeys
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
