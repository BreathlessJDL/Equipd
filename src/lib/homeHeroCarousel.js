import { BROWSE_PATH, BRANDS_PATH } from './sellGymEquipmentPage.js'
import { buildBrowseNavPath } from './browseSearchNavigation.js'
import { CARDIO_CATEGORY_SLUGS } from './landingCategorySlugs.js'

export const HOME_HERO_ROTATE_MS = 5000
export const HOME_HERO_TRANSITION_MS = 480
export const HOME_HERO_MOBILE_MEDIA = '(max-width: 767px)'

export const CARDIO_EQUIPMENT_BROWSE_PATH = buildBrowseNavPath({
  categorySlugs: CARDIO_CATEGORY_SLUGS,
})

function designReferenceSrc(fileName) {
  return `/design-reference/${encodeURI(fileName)}`
}

export const COAT_RACK_HERO_BANNER = Object.freeze({
  src: designReferenceSrc('Your Gym, Not a Coat Rack 2.png'),
  width: 2171,
  height: 471,
  mobileSrc: designReferenceSrc('Turn Your Gym Into Cash mobile 3.png'),
  mobileWidth: 1645,
  mobileHeight: 956,
  alt: "Your gym shouldn't be a coat rack. Turn it into cash on Equipd.",
  href: '/listings/new',
  label: 'Sell now',
})

export const HOME_GYM_HERO_BANNER = Object.freeze({
  src: designReferenceSrc('build your home gym banner 8.png'),
  width: 2172,
  height: 536,
  mobileSrc: designReferenceSrc('Build Your Home Gym for Less Mobile.png'),
  mobileWidth: 1672,
  mobileHeight: 941,
  alt: 'Build your home gym for less. Find quality used gym equipment from sellers across the UK.',
  href: BROWSE_PATH,
  label: 'Browse equipment',
})

export const VALUATION_HERO_BANNER = Object.freeze({
  src: designReferenceSrc('Gym Equipment Valuation Landing Page 4.png'),
  width: 2172,
  height: 413,
  mobileSrc: designReferenceSrc('Gym Equipment Valuation Hero Banner Mobile.png'),
  mobileWidth: 1672,
  mobileHeight: 941,
  alt: 'Find the value of your gym equipment. Get an estimated resale value based on the model, original pricing and equipment-specific adjustments.',
  href: BRANDS_PATH,
  label: 'Value now',
})

export const CARDIO_HERO_BANNER = Object.freeze({
  src: designReferenceSrc('find your next cardio 3.png'),
  width: 2171,
  height: 494,
  mobileSrc: designReferenceSrc('Find Your Next Cardio Setup Mobile.png'),
  mobileWidth: 1672,
  mobileHeight: 941,
  alt: 'Find your next cardio setup. Explore used treadmills, bikes, rowers and more from sellers across the UK.',
  href: CARDIO_EQUIPMENT_BROWSE_PATH,
  label: 'Browse cardio equipment',
})

export const LOGGED_OUT_HOME_HERO_SLIDES = Object.freeze([
  Object.freeze({ id: 'coat-rack', type: 'coat-rack' }),
  Object.freeze({ id: 'home-gym', type: 'image-cta', banner: HOME_GYM_HERO_BANNER }),
  Object.freeze({ id: 'valuation', type: 'image-cta', banner: VALUATION_HERO_BANNER }),
])

export const LOGGED_IN_HOME_HERO_SLIDES = Object.freeze([
  Object.freeze({ id: 'cardio', type: 'image-cta', banner: CARDIO_HERO_BANNER }),
  Object.freeze({ id: 'valuation', type: 'image-cta', banner: VALUATION_HERO_BANNER }),
])

export function getHomeHeroSlides(isLoggedIn) {
  return isLoggedIn ? LOGGED_IN_HOME_HERO_SLIDES : LOGGED_OUT_HOME_HERO_SLIDES
}
