/**
 * Shared category slug sets for SEO landing page filters.
 * Every slug must exist in LISTING_CATEGORY_OPTIONS.
 */

export const CARDIO_CATEGORY_SLUGS = Object.freeze([
  'treadmill',
  'crosstrainers',
  'upright-bikes',
  'recumbent-bikes',
  'spin-bikes',
  'stairclimbers',
  'upper-body-bikes',
  'assault-bike',
  'skierg',
  'rowers',
])

export const STRENGTH_CATEGORY_SLUGS = Object.freeze([
  'plate-loaded-machine',
  'pin-loaded-machine',
  'squat-rack',
  'functional',
  'bench',
  'dumbbells',
  'weight-plates',
  'barbells',
  'dual-cable-pulley',
  'multi-gyms',
])

/** Home strength focuses on the kit home buyers typically search for. */
export const HOME_STRENGTH_CATEGORY_SLUGS = Object.freeze([
  'dumbbells',
  'bench',
  'multi-gyms',
  'squat-rack',
  'pin-loaded-machine',
  'plate-loaded-machine',
  'functional',
  'dual-cable-pulley',
  'weight-plates',
  'barbells',
])

/** Home cardio — core machines without facility-only climbers as primary focus. */
export const HOME_CARDIO_CATEGORY_SLUGS = Object.freeze([
  'treadmill',
  'crosstrainers',
  'upright-bikes',
  'recumbent-bikes',
  'spin-bikes',
  'rowers',
  'assault-bike',
  'skierg',
])
