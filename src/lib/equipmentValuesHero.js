import { HOME_HERO_MOBILE_MEDIA } from './homeHeroCarousel.js'
import { buildValuationHref } from './valuationNavigation.js'

function designReferenceSrc(fileName) {
  return `/design-reference/${encodeURI(fileName)}`
}

export const EQUIPMENT_VALUES_HERO_MOBILE_MEDIA = HOME_HERO_MOBILE_MEDIA

export const EQUIPMENT_VALUES_HERO = Object.freeze({
  src: designReferenceSrc('Equipment Valuations Hero Banner Desktop.png'),
  width: 1918,
  height: 605,
  mobileSrc: designReferenceSrc('Equipment Valuations Hero Banner Mobile.png'),
  mobileWidth: 934,
  mobileHeight: 495,
  alt:
    'Find the value of your gym equipment. Get an estimated resale value based on the model, original pricing and equipment-specific adjustments. Illustrative Technogym Skillmill modelled estimate.',
})

/**
 * Popular model shortcuts that exist in the live catalogue.
 * Concept2 RowErg uses Model D — the most widely searched RowErg generation.
 */
export const EQUIPMENT_VALUES_POPULAR_SEARCHES = Object.freeze([
  {
    id: 'concept2-rowerg',
    label: 'Concept2 RowErg',
    productKey: 'concept2-rowers-rowerg-model-d',
  },
  {
    id: 'technogym-skillmill',
    label: 'Technogym Skillmill',
    productKey: 'technogym-non-motorised-treadmill-skill-line-skillmill',
  },
  {
    id: 'wattbike-atom',
    label: 'Wattbike Atom',
    productKey: 'wattbike-exercise-bike-atom-atom',
  },
].map((item) => Object.freeze({
  ...item,
  href: buildValuationHref({ productKey: item.productKey }),
})))
