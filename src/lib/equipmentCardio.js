import { normalizeEquipmentTypeKey } from './equipmentTypeRepair.js'

function normalizeText(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim()
}

function normalizeModelKey(value) {
  return normalizeText(value).toLowerCase().replace(/[^a-z0-9]/g, '')
}

/** Canonical equipment types that support console variants. */
export const CARDIO_EQUIPMENT_TYPES = new Set([
  'treadmill',
  'non-motorised treadmill',
  'cross trainer',
  'crosstrainer',
  'elliptical',
  'exercise bike',
  'indoor bike',
  'upright bike',
  'recumbent bike',
  'spin bike',
  'studio cycle',
  'stepper',
  'stepper/stair climber',
  'stair climber',
  'climber',
  'arc trainer',
  'adaptive motion trainer',
  'rower',
  'rowers',
  'rowing machine',
  'indoor cycle',
  'bike',
])

/** Model identity hints when equipment_type is missing or generic. */
export const CARDIO_MODEL_KEYS = new Set([
  'treadmill',
  'crosstrainer',
  'elliptical',
  'exercisebike',
  'uprightbike',
  'recumbentbike',
  'recumbent',
  'stepper',
  'stairclimber',
  'climber',
  'arctrainer',
  'powermill',
  'flexstrider',
  'summittrainer',
  'rower',
  'rowingmachine',
  'indoorcycle',
  'lifecycle',
  'ascent',
  'ascenttrainer',
  'climbmill',
])

const STRENGTH_EQUIPMENT_TYPES = new Set([
  'abdominal machine',
  'back extension',
  'bench',
  'biceps curl',
  'cable machine',
  'cable / functional trainer',
  'chest press',
  'glute machine',
  'hip abductor/adductor',
  'lat pulldown',
  'leg curl',
  'leg extension',
  'leg press',
  'plate loaded strength',
  'rack',
  'rack/smith machine',
  'selectorised strength',
  'shoulder press',
  'strength machine',
  'triceps machine',
  'functional trainer',
  'smith machine',
  'multi gym',
  'free weights',
  'accessories',
  'accessory',
])

const STRENGTH_MODEL_PATTERNS = [
  /\bchest\s+press\b/i,
  /\bleg\s+press\b/i,
  /\blat\s+pulldown\b/i,
  /\bshoulder\s+press\b/i,
  /\bpec\s+(?:fly|deck)\b/i,
  /\bhack\s+squat\b/i,
  /\bsmith\s+machine\b/i,
  /\bcable\s+(?:cross|station)\b/i,
  /\bplate\s+loaded\b/i,
  /\bselectori[sz]ed\b/i,
  /\bbench\s+press\b/i,
  /\babdominal\b/i,
  /\bbiceps\b/i,
  /\btriceps\b/i,
]

const CARDIO_ROW_PATTERNS = [
  /\brower\b/i,
  /\browing\s+machine\b/i,
  /\bgx\s+row\b/i,
  /\bindoor\s+row\b/i,
]

export function isStrengthEquipmentProduct(product) {
  const equipmentType = normalizeEquipmentTypeKey(product?.equipment_type)
  if (equipmentType === 'row machine') {
    const haystack = `${normalizeText(product?.model)} ${normalizeText(product?.canonical_product_name)}`
    if (CARDIO_ROW_PATTERNS.some((pattern) => pattern.test(haystack))) return false
    return true
  }
  if (equipmentType && STRENGTH_EQUIPMENT_TYPES.has(equipmentType)) return true

  const modelText = normalizeText(product?.model)
  const nameText = normalizeText(product?.canonical_product_name)
  const haystack = `${modelText} ${nameText}`

  return STRENGTH_MODEL_PATTERNS.some((pattern) => pattern.test(haystack))
}

export function isSpinBikeIndoorCycleProduct(product) {
  if (!product) return false

  const haystack = [
    product.equipment_type,
    product.model,
    product.canonical_product_name,
    product.product_family,
  ].map(normalizeText).join(' ')

  const spinBikePatterns = [
    /\bspin\s*bike\b/i,
    /\bspinning\s*bike\b/i,
    /\bindoor\s+bike\b/i,
    /\bindoor\s+cycle\b/i,
    /\bstudio\s+bike\b/i,
    /\bgroup\s+cycle\b/i,
    /\bgroup\s+exercise\s+bike\b/i,
    /\bic\s*bike\b/i,
    /\bic[1-8]\b/i,
  ]

  return spinBikePatterns.some((pattern) => pattern.test(haystack))
}

export function supportsProductConsoleOptions(product) {
  return isCardioEquipmentProduct(product) && !isSpinBikeIndoorCycleProduct(product)
}

export function isCardioEquipmentProduct(product) {
  if (!product) return false
  // Spin / indoor bikes are cardio even when catalogue type uses “Indoor Bike”.
  if (isSpinBikeIndoorCycleProduct(product)) return true
  if (isStrengthEquipmentProduct(product)) return false

  const equipmentType = normalizeEquipmentTypeKey(product?.equipment_type)
  if (equipmentType === 'row machine') {
    const haystack = `${normalizeText(product?.model)} ${normalizeText(product?.canonical_product_name)}`
    return CARDIO_ROW_PATTERNS.some((pattern) => pattern.test(haystack))
  }
  if (equipmentType && CARDIO_EQUIPMENT_TYPES.has(equipmentType)) return true

  const modelKey = normalizeModelKey(product?.model)
  if (modelKey && CARDIO_MODEL_KEYS.has(modelKey)) return true

  const nameKey = normalizeModelKey(product?.canonical_product_name)
  for (const cardioKey of CARDIO_MODEL_KEYS) {
    if (nameKey.includes(cardioKey)) return true
  }

  return false
}
