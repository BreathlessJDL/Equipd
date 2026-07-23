/**
 * Google product category + Equipd product_type mappings.
 */

function normalizeWhitespace(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim()
}

function normalizeKey(value) {
  return normalizeWhitespace(value).toLowerCase()
}

/**
 * Broader Google taxonomy IDs — prefer safe parents over overfitted leaves.
 * @see https://support.google.com/merchants/answer/6324436
 */
export const GOOGLE_PRODUCT_CATEGORY_BY_TYPE = Object.freeze({
  treadmill: 'Sporting Goods > Exercise & Fitness > Cardio > Treadmills',
  treadmills: 'Sporting Goods > Exercise & Fitness > Cardio > Treadmills',
  'exercise bike': 'Sporting Goods > Exercise & Fitness > Cardio > Exercise Bikes',
  'exercise bikes': 'Sporting Goods > Exercise & Fitness > Cardio > Exercise Bikes',
  bike: 'Sporting Goods > Exercise & Fitness > Cardio > Exercise Bikes',
  'spin bike': 'Sporting Goods > Exercise & Fitness > Cardio > Exercise Bikes',
  'upright bike': 'Sporting Goods > Exercise & Fitness > Cardio > Exercise Bikes',
  'recumbent bike': 'Sporting Goods > Exercise & Fitness > Cardio > Exercise Bikes',
  rower: 'Sporting Goods > Exercise & Fitness > Cardio > Rowing Machines',
  'rowing machine': 'Sporting Goods > Exercise & Fitness > Cardio > Rowing Machines',
  'rowing machines': 'Sporting Goods > Exercise & Fitness > Cardio > Rowing Machines',
  elliptical: 'Sporting Goods > Exercise & Fitness > Cardio > Elliptical Trainers',
  'elliptical trainer': 'Sporting Goods > Exercise & Fitness > Cardio > Elliptical Trainers',
  'cross trainer': 'Sporting Goods > Exercise & Fitness > Cardio > Elliptical Trainers',
  stairclimber: 'Sporting Goods > Exercise & Fitness > Cardio',
  'stair climber': 'Sporting Goods > Exercise & Fitness > Cardio',
  climbmill: 'Sporting Goods > Exercise & Fitness > Cardio',
  stepmill: 'Sporting Goods > Exercise & Fitness > Cardio',
  'weight plate': 'Sporting Goods > Exercise & Fitness > Weight Lifting > Free Weights',
  'weight plates': 'Sporting Goods > Exercise & Fitness > Weight Lifting > Free Weights',
  dumbbell: 'Sporting Goods > Exercise & Fitness > Weight Lifting > Free Weights',
  dumbbells: 'Sporting Goods > Exercise & Fitness > Weight Lifting > Free Weights',
  barbell: 'Sporting Goods > Exercise & Fitness > Weight Lifting > Free Weights',
  kettlebell: 'Sporting Goods > Exercise & Fitness > Weight Lifting > Free Weights',
  bench: 'Sporting Goods > Exercise & Fitness > Weight Lifting > Weight Lifting Machines & Racks',
  rack: 'Sporting Goods > Exercise & Fitness > Weight Lifting > Weight Lifting Machines & Racks',
  'power rack': 'Sporting Goods > Exercise & Fitness > Weight Lifting > Weight Lifting Machines & Racks',
  'smith machine': 'Sporting Goods > Exercise & Fitness > Weight Lifting > Weight Lifting Machines & Racks',
  'cable machine': 'Sporting Goods > Exercise & Fitness > Weight Lifting > Weight Lifting Machines & Racks',
  'multi gym': 'Sporting Goods > Exercise & Fitness > Weight Lifting > Weight Lifting Machines & Racks',
  'strength machine': 'Sporting Goods > Exercise & Fitness > Weight Lifting > Weight Lifting Machines & Racks',
  'chest press': 'Sporting Goods > Exercise & Fitness > Weight Lifting > Weight Lifting Machines & Racks',
  'leg press': 'Sporting Goods > Exercise & Fitness > Weight Lifting > Weight Lifting Machines & Racks',
  'lat pulldown': 'Sporting Goods > Exercise & Fitness > Weight Lifting > Weight Lifting Machines & Racks',
  'abdominal crunch': 'Sporting Goods > Exercise & Fitness > Weight Lifting > Weight Lifting Machines & Racks',
  accessory: 'Sporting Goods > Exercise & Fitness',
  accessories: 'Sporting Goods > Exercise & Fitness',
})

export const DEFAULT_GOOGLE_PRODUCT_CATEGORY = 'Sporting Goods > Exercise & Fitness'

export function resolveEquipmentTypeLabel(listing, equipmentProduct = null) {
  return (
    normalizeWhitespace(equipmentProduct?.equipment_type)
    || normalizeWhitespace(equipmentProduct?.equipmentType)
    || normalizeWhitespace(listing?.category?.name)
    || normalizeWhitespace(listing?.equipment_type)
    || null
  )
}

export function mapGoogleProductCategory(listing, equipmentProduct = null) {
  const type = resolveEquipmentTypeLabel(listing, equipmentProduct)
  if (!type) return DEFAULT_GOOGLE_PRODUCT_CATEGORY
  const mapped = GOOGLE_PRODUCT_CATEGORY_BY_TYPE[normalizeKey(type)]
  return mapped || DEFAULT_GOOGLE_PRODUCT_CATEGORY
}

export function buildMerchantProductType(listing, equipmentProduct = null) {
  const parts = [
    'Gym Equipment',
    resolveEquipmentTypeLabel(listing, equipmentProduct),
    normalizeWhitespace(listing?.brand || equipmentProduct?.brand),
  ].filter(Boolean)
  return parts.join(' > ')
}

export function isMappedEquipmentType(type) {
  return Boolean(GOOGLE_PRODUCT_CATEGORY_BY_TYPE[normalizeKey(type)])
}
