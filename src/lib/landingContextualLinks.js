/**
 * Contextual internal-link enrichment for SEO landing copy.
 * Applies natural phrase → path rules once per paragraph/FAQ answer.
 */

import { linkifyText } from './linkedCopy.js'
import { LANDING_PATHS } from './landingPagePaths.js'
import { getBrandPagePath } from './brandCatalogueCore.js'
import {
  BUY_USED_GYM_EQUIPMENT_PATH,
} from './buyUsedGymEquipmentPage.js'
import {
  BRANDS_PATH,
  SELL_GYM_EQUIPMENT_PATH,
  VALUATION_PATH,
} from './sellGymEquipmentPage.js'

const CORE = Object.freeze([
  { phrase: 'Buy Used Gym Equipment', to: BUY_USED_GYM_EQUIPMENT_PATH },
  { phrase: 'Buy Gym Equipment guide', to: BUY_USED_GYM_EQUIPMENT_PATH, label: 'Buy Used Gym Equipment guide' },
  { phrase: 'Sell Gym Equipment', to: SELL_GYM_EQUIPMENT_PATH },
  { phrase: 'sell gym equipment', to: SELL_GYM_EQUIPMENT_PATH },
  { phrase: 'Instant Valuation', to: VALUATION_PATH },
  { phrase: 'free Instant Valuation', to: VALUATION_PATH },
  { phrase: 'free valuation tool', to: VALUATION_PATH },
  { phrase: 'Equipment Values', to: BRANDS_PATH },
])

const HUBS = Object.freeze([
  { phrase: 'Commercial Gym Equipment', to: LANDING_PATHS.commercialGym },
  { phrase: 'Home Gym Equipment', to: LANDING_PATHS.homeGym },
  { phrase: 'Home Gym Equipment page', to: LANDING_PATHS.homeGym, label: 'Home Gym Equipment page' },
  { phrase: 'Commercial Cardio Equipment', to: LANDING_PATHS.commercialCardio },
  { phrase: 'commercial cardio equipment', to: LANDING_PATHS.commercialCardio },
  { phrase: 'Commercial Strength Equipment', to: LANDING_PATHS.commercialStrength },
  { phrase: 'commercial strength equipment', to: LANDING_PATHS.commercialStrength },
  { phrase: 'Home Cardio Equipment', to: LANDING_PATHS.homeCardio },
  { phrase: 'home cardio equipment', to: LANDING_PATHS.homeCardio },
  { phrase: 'Home Strength Equipment', to: LANDING_PATHS.homeStrength },
  { phrase: 'home strength equipment', to: LANDING_PATHS.homeStrength },
  {
    phrase: 'Refurbished Commercial Gym Equipment',
    to: LANDING_PATHS.refurbishedCommercial,
  },
  {
    phrase: 'refurbished commercial gym equipment',
    to: LANDING_PATHS.refurbishedCommercial,
  },
  {
    phrase: 'Refurbished Home Gym Equipment',
    to: LANDING_PATHS.refurbishedHome,
  },
  {
    phrase: 'refurbished home gym equipment',
    to: LANDING_PATHS.refurbishedHome,
  },
])

const COMMERCIAL_CARDIO_INTENT = Object.freeze([
  { phrase: 'Used Commercial Treadmills', to: '/used-commercial-treadmills' },
  { phrase: 'commercial treadmills', to: '/used-commercial-treadmills' },
  { phrase: 'Commercial Treadmills', to: '/used-commercial-treadmills' },
  { phrase: 'Used Commercial Exercise Bikes', to: '/used-commercial-exercise-bikes' },
  { phrase: 'commercial exercise bikes', to: '/used-commercial-exercise-bikes' },
  { phrase: 'Used Commercial Cross Trainers', to: '/used-commercial-cross-trainers' },
  { phrase: 'commercial cross trainers', to: '/used-commercial-cross-trainers' },
  { phrase: 'Used Commercial Rowing Machines', to: '/used-commercial-rowing-machines' },
  { phrase: 'commercial rowing machines', to: '/used-commercial-rowing-machines' },
  { phrase: 'Used Commercial Stair Climbers', to: '/used-commercial-stair-climbers' },
  { phrase: 'stair climbers', to: '/used-commercial-stair-climbers' },
  { phrase: 'Used Commercial Indoor Cycles', to: '/used-commercial-indoor-cycles' },
  { phrase: 'indoor cycles', to: '/used-commercial-indoor-cycles' },
])

const COMMERCIAL_STRENGTH_INTENT = Object.freeze([
  { phrase: 'Used Functional Trainers', to: '/used-functional-trainers' },
  { phrase: 'functional trainers', to: '/used-functional-trainers' },
  { phrase: 'Used Smith Machines', to: '/used-smith-machines' },
  { phrase: 'smith machines', to: '/used-smith-machines' },
  { phrase: 'Used Power Racks', to: '/used-power-racks' },
  { phrase: 'power racks', to: '/used-power-racks' },
  { phrase: 'squat racks', to: '/used-power-racks' },
  { phrase: 'Used Cable Machines', to: '/used-cable-machines' },
  { phrase: 'cable machines', to: '/used-cable-machines' },
  { phrase: 'Used Leg Press Machines', to: '/used-leg-press-machines' },
  { phrase: 'leg press', to: '/used-leg-press-machines' },
  { phrase: 'Used Plate Loaded Machines', to: '/used-plate-loaded-machines' },
  { phrase: 'plate-loaded machines', to: '/used-plate-loaded-machines' },
  { phrase: 'Used Pin Loaded Machines', to: '/used-pin-loaded-machines' },
  { phrase: 'pin-loaded machines', to: '/used-pin-loaded-machines' },
  { phrase: 'Used Commercial Benches', to: '/used-commercial-benches' },
  { phrase: 'commercial benches', to: '/used-commercial-benches' },
  { phrase: 'Used Commercial Dumbbells', to: '/used-commercial-dumbbells' },
  { phrase: 'commercial dumbbells', to: '/used-commercial-dumbbells' },
])

const HOME_CARDIO_INTENT = Object.freeze([
  { phrase: 'Home Treadmills', to: '/home-treadmills' },
  { phrase: 'home treadmills', to: '/home-treadmills' },
  { phrase: 'Home Exercise Bikes', to: '/home-exercise-bikes' },
  { phrase: 'home exercise bikes', to: '/home-exercise-bikes' },
  { phrase: 'Home Cross Trainers', to: '/home-cross-trainers' },
  { phrase: 'home cross trainers', to: '/home-cross-trainers' },
  { phrase: 'Home Rowing Machines', to: '/home-rowing-machines' },
  { phrase: 'home rowing machines', to: '/home-rowing-machines' },
])

const HOME_STRENGTH_INTENT = Object.freeze([
  { phrase: 'Home Multi Gyms', to: '/home-multi-gyms' },
  { phrase: 'Home Multi-Gyms', to: '/home-multi-gyms' },
  { phrase: 'multi gyms', to: '/home-multi-gyms' },
  { phrase: 'Home Dumbbells', to: '/home-dumbbells' },
  { phrase: 'Home Weight Benches', to: '/home-weight-benches' },
  { phrase: 'weight benches', to: '/home-weight-benches' },
  { phrase: 'Home Power Racks', to: '/home-power-racks' },
  { phrase: 'Home Power Rack', to: '/home-power-racks', label: 'Home Power Rack' },
  { phrase: 'home power racks', to: '/home-power-racks' },
])

const BRAND_RULES = Object.freeze([
  { phrase: 'Technogym', to: getBrandPagePath('technogym'), label: 'Technogym' },
  { phrase: 'Life Fitness', to: getBrandPagePath('life-fitness'), label: 'Life Fitness' },
  { phrase: 'Matrix', to: getBrandPagePath('matrix-fitness'), label: 'Matrix' },
  { phrase: 'Precor', to: getBrandPagePath('precor'), label: 'Precor' },
  { phrase: 'Concept2', to: getBrandPagePath('concept2'), label: 'Concept2' },
  { phrase: 'Wattbike', to: getBrandPagePath('wattbike'), label: 'Wattbike' },
  { phrase: 'Cybex', to: getBrandPagePath('cybex'), label: 'Cybex' },
  { phrase: 'Hammer Strength', to: getBrandPagePath('hammer-strength'), label: 'Hammer Strength' },
  { phrase: 'NordicTrack', to: getBrandPagePath('nordictrack'), label: 'NordicTrack' },
  { phrase: 'Bowflex', to: getBrandPagePath('bowflex'), label: 'Bowflex' },
])

export const LINK_RULES = Object.freeze({
  commercialGym: Object.freeze([
    ...CORE,
    ...HUBS,
    ...COMMERCIAL_CARDIO_INTENT,
    ...COMMERCIAL_STRENGTH_INTENT,
    ...BRAND_RULES,
  ]),
  homeGym: Object.freeze([
    ...CORE,
    ...HUBS,
    ...HOME_CARDIO_INTENT,
    ...HOME_STRENGTH_INTENT,
    ...BRAND_RULES,
  ]),
  commercialCardio: Object.freeze([
    ...CORE,
    ...HUBS,
    ...COMMERCIAL_CARDIO_INTENT,
    ...BRAND_RULES,
  ]),
  commercialStrength: Object.freeze([
    ...CORE,
    ...HUBS,
    ...COMMERCIAL_STRENGTH_INTENT,
    ...BRAND_RULES,
  ]),
  homeCardio: Object.freeze([
    ...CORE,
    ...HUBS,
    ...HOME_CARDIO_INTENT,
    ...BRAND_RULES,
  ]),
  homeStrength: Object.freeze([
    ...CORE,
    ...HUBS,
    ...HOME_STRENGTH_INTENT,
    ...BRAND_RULES,
  ]),
  refurbishedCommercial: Object.freeze([
    ...CORE,
    ...HUBS,
    ...COMMERCIAL_CARDIO_INTENT,
    ...COMMERCIAL_STRENGTH_INTENT,
  ]),
  refurbishedHome: Object.freeze([
    ...CORE,
    ...HUBS,
    ...HOME_CARDIO_INTENT,
    ...HOME_STRENGTH_INTENT,
  ]),
  buy: Object.freeze([
    ...CORE,
    ...HUBS,
    ...COMMERCIAL_CARDIO_INTENT.slice(0, 4),
    ...HOME_CARDIO_INTENT.slice(0, 4),
    ...BRAND_RULES.slice(0, 4),
  ]),
})

/**
 * @param {unknown} value
 * @param {{ phrase: string, to: string, label?: string }[]} rules
 */
function enrichValue(value, rules) {
  if (typeof value !== 'string') return value
  return linkifyText(value, rules)
}

/**
 * Enrich guide sections + FAQ items with contextual internal links.
 * @param {object} content
 * @param {{ phrase: string, to: string, label?: string }[]} rules
 */
export function enrichLandingContentLinks(content, rules) {
  if (!content || !rules?.length) return content

  const guideSections = (content.guideSections || []).map((section) => ({
    ...section,
    paragraphs: (section.paragraphs || []).map((paragraph) => enrichValue(paragraph, rules)),
  }))

  const faqItems = (content.faqItems || []).map((item) => ({
    ...item,
    answer: enrichValue(item.answer, rules),
  }))

  return {
    ...content,
    lead: enrichValue(content.lead, rules),
    guideIntro: enrichValue(content.guideIntro, rules),
    categoryLead: enrichValue(content.categoryLead, rules),
    brandLead: enrichValue(content.brandLead, rules),
    valuationCopy: enrichValue(content.valuationCopy, rules),
    listingsLead: enrichValue(content.listingsLead, rules),
    exploreLead: enrichValue(content.exploreLead, rules),
    guideSections,
    faqItems,
  }
}

/**
 * Enrich a guide-sections array in place for dedicated hub modules.
 */
export function enrichGuideSections(sections, rules) {
  return Object.freeze(
    (sections || []).map((section) =>
      Object.freeze({
        ...section,
        paragraphs: Object.freeze(
          (section.paragraphs || []).map((paragraph) => enrichValue(paragraph, rules)),
        ),
      }),
    ),
  )
}

/**
 * Enrich FAQ items for dedicated hub modules.
 */
export function enrichFaqItems(items, rules) {
  return Object.freeze(
    (items || []).map((item) =>
      Object.freeze({
        ...item,
        answer: enrichValue(item.answer, rules),
      }),
    ),
  )
}

/**
 * Equipment-page rules: parent hub + siblings + core + a few brands.
 */
export function buildEquipmentLinkRules(def, neighborPaths = []) {
  const rules = [
    ...CORE,
    { phrase: def.parentName, to: def.parentPath },
    {
      phrase: def.rating === 'full_commercial' ? 'Commercial Gym Equipment' : 'Home Gym Equipment',
      to: def.rating === 'full_commercial' ? LANDING_PATHS.commercialGym : LANDING_PATHS.homeGym,
    },
    {
      phrase:
        def.rating === 'full_commercial'
          ? 'Refurbished Commercial Gym Equipment'
          : 'Refurbished Home Gym Equipment',
      to:
        def.rating === 'full_commercial'
          ? LANDING_PATHS.refurbishedCommercial
          : LANDING_PATHS.refurbishedHome,
    },
  ]

  for (const neighbor of def.neighborCategories || []) {
    if (neighbor.to && neighbor.label && !neighbor.to.includes('/browse')) {
      rules.push({ phrase: neighbor.label, to: neighbor.to })
    }
  }

  for (const path of neighborPaths) {
    // already covered via neighbor labels
    void path
  }

  // Cluster-specific intent phrases
  if (def.cluster === 'commercial-cardio') rules.push(...COMMERCIAL_CARDIO_INTENT)
  if (def.cluster === 'commercial-strength') rules.push(...COMMERCIAL_STRENGTH_INTENT)
  if (def.cluster === 'home-cardio') rules.push(...HOME_CARDIO_INTENT)
  if (def.cluster === 'home-strength') rules.push(...HOME_STRENGTH_INTENT)

  for (const slug of (def.featuredBrandSlugs || []).slice(0, 4)) {
    const brandRule = BRAND_RULES.find((rule) => rule.to === getBrandPagePath(slug))
    if (brandRule) rules.push(brandRule)
  }

  // Always offer parent + valuation + sell phrases that appear often in guides.
  rules.push(
    { phrase: 'Commercial Cardio Equipment', to: LANDING_PATHS.commercialCardio },
    { phrase: 'Commercial Strength Equipment', to: LANDING_PATHS.commercialStrength },
    { phrase: 'Home Cardio Equipment', to: LANDING_PATHS.homeCardio },
    { phrase: 'Home Strength Equipment', to: LANDING_PATHS.homeStrength },
    { phrase: 'free Instant Valuation', to: VALUATION_PATH },
    { phrase: 'Instant Valuation', to: VALUATION_PATH },
    { phrase: 'free valuation', to: VALUATION_PATH, label: 'free Instant Valuation' },
    { phrase: 'Equipment Values', to: BRANDS_PATH },
    { phrase: 'Sell Gym Equipment', to: SELL_GYM_EQUIPMENT_PATH },
    { phrase: 'Buy Used Gym Equipment', to: BUY_USED_GYM_EQUIPMENT_PATH },
  )

  // De-dupe by phrase and skip self-links
  const seen = new Set()
  return rules.filter((rule) => {
    if (rule.to === def.path) return false
    const key = rule.phrase.toLowerCase()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}
