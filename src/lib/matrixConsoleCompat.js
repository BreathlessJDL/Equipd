/**
 * Matrix Fitness console catalogue and product/year compatibility matrix.
 *
 * Architecture (approved 2026-07-10):
 * - One canonical product per historic digit base (T1, T3, T5, T7, E3, …).
 * - Manufacture year filters factory console options.
 * - Digit models did NOT continue into the modular era under those names —
 *   do NOT attach LED / Premium LED / Touch / Touch XL to digit bases.
 * - *5xe mappings held for manual review (not auto-mapped).
 * - Modern modular consoles (LED / Premium LED / Touch / Touch XL) map
 *   explicitly to Lifestyle / Endurance / Performance / Performance Plus.
 * - Touch XL only on treadmills and ClimbMills.
 * - Onyx uses fixed Onyx 32"/22" touchscreen masters — never modular LED/Touch.
 *
 * Primary sources:
 * - https://content.johnsonfit.com/inc/uploaded_media/09479aec1bb4f1a49466388e6f30afa5/owners_guide/e579c7a6f962e02fc7421b1081bd6eb0.pdf
 * - https://www.fitnesssuperstore.com/pages/matrix-console-comparisons-reviews-3x-5x-7xe-7xi
 * - https://clubsolutionsmagazine.com/2020/11/matrix-fitness-introduces-new-cardio-portfolio/
 * - https://assets.johnsonhealthtech.com/m/7a8c81508df7bda6/original/mx25_brochure_na_vertical_market_digital_sprds_v8-pdf.pdf
 */

import { MATRIX_CONSOLE_IMAGE_BASE, MATRIX_CONSOLE_IMAGE_FILES } from './commercialCardioConsoleCompat.js'

export const MATRIX_BRAND = 'Matrix Fitness'

/** Stable console_key → valuation modifier percent / tier. */
export const MATRIX_CONSOLE_MODIFIER_BY_KEY = Object.freeze({
  led_1x: { modifier_percent: 0, tier: 'base' },
  led_3x: { modifier_percent: 0, tier: 'base' },
  led_5x: { modifier_percent: 0, tier: 'base' },
  led_7x: { modifier_percent: 0, tier: 'base' },
  xe: { modifier_percent: 10, tier: 'mid' },
  '7xe': { modifier_percent: 15, tier: 'mid' },
  '7xi': { modifier_percent: 25, tier: 'premium' },
  led: { modifier_percent: 0, tier: 'base' },
  premium_led: { modifier_percent: 8, tier: 'mid' },
  touch: { modifier_percent: 15, tier: 'mid' },
  touch_xl: { modifier_percent: 25, tier: 'premium' },
  onyx_32: { modifier_percent: 30, tier: 'premium' },
  onyx_22: { modifier_percent: 25, tier: 'premium' },
  xr: { modifier_percent: 0, tier: 'base' },
  xer: { modifier_percent: 15, tier: 'mid' },
  xir: { modifier_percent: 25, tier: 'premium' },
  xur: { modifier_percent: 25, tier: 'premium' },
})

export function getMatrixConsoleModifier(consoleKey) {
  return MATRIX_CONSOLE_MODIFIER_BY_KEY[consoleKey] ?? null
}

const LED_IMG = `${MATRIX_CONSOLE_IMAGE_BASE}/${MATRIX_CONSOLE_IMAGE_FILES.led}`
const TOUCH_IMG = `${MATRIX_CONSOLE_IMAGE_BASE}/${MATRIX_CONSOLE_IMAGE_FILES.touch}`
const TOUCH_XL_IMG = `${MATRIX_CONSOLE_IMAGE_BASE}/${MATRIX_CONSOLE_IMAGE_FILES.touchxl}`

export const MATRIX_CONSOLE_DEFS = [
  // --- Historic commercial (digit-series era) ---
  {
    console_key: 'led_1x',
    console_name: 'LED',
    alternative_names: ['1x LED', '1x Console', 'Alphanumeric LED', 'T1x Console'],
    start_year: 2008,
    end_year: 2018,
    start_year_approximate: true,
    end_year_approximate: true,
    is_current: false,
    display_order: 10,
    confidence: 'high',
    image_url: LED_IMG,
    source_url: 'https://content.johnsonfit.com/inc/uploaded_media/0e2a16946c611b70bd064c2c4215cb49/owners_guide/4fe359d13c3d08b9b905e0fa4789363b.pdf',
    notes: 'Historic commercial entry LED. Factory option on digit-1 bases within year window. Not modern modular LED. Public label: LED.',
    family: 'commercial_historic',
  },
  {
    console_key: 'led_3x',
    console_name: 'LED',
    alternative_names: ['3x LED', '3x Console', 'Dot-matrix LED', 'T3x Console'],
    start_year: 2008,
    end_year: 2018,
    start_year_approximate: true,
    end_year_approximate: true,
    is_current: false,
    display_order: 20,
    confidence: 'high',
    image_url: LED_IMG,
    source_url: 'https://content.johnsonfit.com/inc/uploaded_media/09479aec1bb4f1a49466388e6f30afa5/sell_sheet/ab92a3d7631f2522f0285a53259aade5.pdf',
    notes: 'Historic commercial 3x LED. Factory option on digit-3 bases within year window. Public label: LED.',
    family: 'commercial_historic',
  },
  {
    console_key: 'led_5x',
    console_name: 'LED',
    alternative_names: ['5x LED', '5x Console', '5x Dot-Matrix LED'],
    start_year: 2009,
    end_year: 2018,
    start_year_approximate: true,
    end_year_approximate: true,
    is_current: false,
    display_order: 30,
    confidence: 'high',
    image_url: LED_IMG,
    source_url: 'https://www.fitnesssuperstore.com/pages/matrix-console-comparisons-reviews-3x-5x-7xe-7xi',
    notes: 'Historic commercial 5x LED. Factory option on digit-5 bases within year window. Public label: LED.',
    family: 'commercial_historic',
  },
  {
    console_key: 'led_7x',
    console_name: 'LED',
    alternative_names: ['7x LED', '7x Console', '7x LED Console'],
    start_year: 2009,
    end_year: 2018,
    start_year_approximate: true,
    end_year_approximate: true,
    is_current: false,
    display_order: 40,
    confidence: 'high',
    image_url: LED_IMG,
    source_url: 'https://www.fitnesssuperstore.com/pages/matrix-console-comparisons-reviews-3x-5x-7xe-7xi',
    notes: 'Historic commercial 7x non-touch LED. Factory option on digit-7 bases within year window. Public label: LED.',
    family: 'commercial_historic',
  },
  {
    console_key: 'xe',
    console_name: 'XE',
    alternative_names: ['xe', 'xe Console', '1xe Console', '3xe Console', '7" LCD', '15.6" LCD'],
    start_year: 2009,
    end_year: 2016,
    start_year_approximate: true,
    end_year_approximate: true,
    is_current: false,
    display_order: 50,
    confidence: 'high',
    image_url: TOUCH_IMG,
    source_url: 'https://content.johnsonfit.com/inc/uploaded_media/09479aec1bb4f1a49466388e6f30afa5/owners_guide/e579c7a6f962e02fc7421b1081bd6eb0.pdf',
    notes: 'Historic xe entertainment LCD. Factory option on digit-1 and digit-3 bases within year window. Public label: XE.',
    family: 'commercial_historic',
  },
  {
    console_key: '7xe',
    console_name: '7XE',
    alternative_names: ['7xe', '7xe Console', '15" Touch Screen LCD'],
    start_year: 2010,
    end_year: 2019,
    start_year_approximate: true,
    end_year_approximate: true,
    is_current: false,
    display_order: 60,
    confidence: 'high',
    image_url: TOUCH_IMG,
    source_url: 'https://www.fitnesssuperstore.com/pages/matrix-console-comparisons-reviews-3x-5x-7xe-7xi',
    notes: 'Historic 7xe ~15" touch. Factory on digit-7 bases. *5xe → 7xe held (not auto-mapped). Public label: 7XE.',
    family: 'commercial_historic',
  },
  {
    console_key: '7xi',
    console_name: '7XI',
    alternative_names: ['7xi', '7xi Console', '16" Projective Capacitive Touch'],
    start_year: 2012,
    end_year: 2019,
    start_year_approximate: true,
    end_year_approximate: true,
    is_current: false,
    display_order: 70,
    confidence: 'high',
    image_url: TOUCH_IMG,
    source_url: 'https://www.fitnesssuperstore.com/pages/matrix-console-comparisons-reviews-3x-5x-7xe-7xi',
    notes: 'Historic 7xi capacitive touch. Factory option on digit-7 bases (OEM-documented). Public label: 7XI.',
    family: 'commercial_historic',
  },

  // --- Modern commercial modular (2020+ Lifestyle / Endurance / Performance) ---
  // Explicit product mappings only. Never map onto historic digit bases.
  {
    console_key: 'led',
    console_name: 'LED',
    alternative_names: ['LED Console', 'Standard LED'],
    start_year: 2020,
    end_year: null,
    start_year_approximate: true,
    is_current: true,
    display_order: 100,
    confidence: 'high',
    image_url: LED_IMG,
    source_url: 'https://assets.johnsonhealthtech.com/m/7a8c81508df7bda6/original/mx25_brochure_na_vertical_market_digital_sprds_v8-pdf.pdf',
    notes: 'Modern modular LED. Map to Lifestyle/Endurance/Performance/Performance Plus cardio. Not for historic digit bases or Onyx.',
    family: 'commercial_modular',
  },
  {
    console_key: 'premium_led',
    console_name: 'Premium LED',
    alternative_names: ['LED Premium', 'Premium LED Console', '8,000 Pixel LED'],
    start_year: 2020,
    end_year: null,
    start_year_approximate: true,
    is_current: true,
    display_order: 110,
    confidence: 'high',
    image_url: LED_IMG,
    source_url: 'https://assets.johnsonhealthtech.com/m/7a8c81508df7bda6/original/mx25_brochure_na_vertical_market_digital_sprds_v8-pdf.pdf',
    notes: 'Modern modular Premium LED. Map to Lifestyle/Endurance/Performance/Performance Plus cardio. Not for Onyx.',
    family: 'commercial_modular',
  },
  {
    console_key: 'touch',
    console_name: 'Touch',
    alternative_names: ['Touch Console', '16" Touch'],
    start_year: 2020,
    end_year: null,
    start_year_approximate: true,
    is_current: true,
    display_order: 120,
    confidence: 'high',
    image_url: TOUCH_IMG,
    source_url: 'https://assets.johnsonhealthtech.com/m/7a8c81508df7bda6/original/mx25_brochure_na_vertical_market_digital_sprds_v8-pdf.pdf',
    notes: 'Modern modular 16" Touch. Map to Lifestyle/Endurance/Performance/Performance Plus cardio. Not for historic digit bases or Onyx.',
    family: 'commercial_modular',
  },
  {
    console_key: 'touch_xl',
    console_name: 'Touch XL',
    alternative_names: ['Touch XL Console', '22" Touch XL'],
    start_year: 2020,
    end_year: null,
    start_year_approximate: true,
    is_current: true,
    display_order: 130,
    confidence: 'high',
    image_url: TOUCH_XL_IMG,
    source_url: 'https://assets.johnsonhealthtech.com/m/7a8c81508df7bda6/original/mx25_brochure_na_vertical_market_digital_sprds_v8-pdf.pdf',
    notes: 'Modern modular 22" Touch XL. Treadmills and ClimbMills only. Not for bikes/ellipticals/steppers/ascent or Onyx.',
    family: 'commercial_modular',
  },

  // --- Onyx Collection fixed immersive consoles (2024+) ---
  {
    console_key: 'onyx_32',
    console_name: 'Onyx 32" Touchscreen',
    alternative_names: ['Onyx 32"', 'Onyx MAX 32"', 'Onyx Treadmill Console'],
    start_year: 2024,
    end_year: null,
    start_year_approximate: false,
    is_current: true,
    display_order: 140,
    confidence: 'high',
    image_url: null,
    source_url: 'https://www.manualslib.com/guide/4242108/matrix-onyx-fitness-console-user-manual.html',
    notes: 'Onyx Collection fixed 32" immersive touchscreen. Treadmill only. Not modular Touch XL.',
    family: 'commercial_onyx',
  },
  {
    console_key: 'onyx_22',
    console_name: 'Onyx 22" Touchscreen',
    alternative_names: ['Onyx 22"', 'Onyx XL 22"', 'Onyx Collection Console'],
    start_year: 2024,
    end_year: null,
    start_year_approximate: false,
    is_current: true,
    display_order: 150,
    confidence: 'high',
    image_url: null,
    source_url: 'https://www.manualslib.com/guide/4242108/matrix-onyx-fitness-console-user-manual.html',
    notes: 'Onyx Collection fixed 22" immersive touchscreen. ClimbMill / Ascent / bikes. Not modular Touch XL.',
    family: 'commercial_onyx',
  },

  // --- Home (Matrix Home Fitness) — never map to commercial catalogue products ---
  {
    console_key: 'xr',
    console_name: 'XR',
    alternative_names: ['XR Console', '8.5" LCD'],
    start_year: 2018,
    end_year: null,
    start_year_approximate: true,
    is_current: true,
    display_order: 200,
    confidence: 'high',
    image_url: null,
    source_url: 'https://matrixhomefitness.com/blogs/blog/how-to-pick-the-perfect-console',
    notes: 'HOME ONLY — 8.5" LCD. Do not map to commercial digit or modular products.',
    family: 'home',
  },
  {
    console_key: 'xer',
    console_name: 'XER',
    alternative_names: ['XER Console', '10" Touchscreen'],
    start_year: 2018,
    end_year: null,
    start_year_approximate: true,
    is_current: true,
    display_order: 210,
    confidence: 'high',
    image_url: null,
    source_url: 'https://matrixhomefitness.com/blogs/blog/how-to-pick-the-perfect-console',
    notes: 'HOME ONLY — 10" entry touchscreen. Not commercial xe/7xe.',
    family: 'home',
  },
  {
    console_key: 'xir',
    console_name: 'XIR',
    alternative_names: ['XIR Console', '16" Home Touch'],
    start_year: 2018,
    end_year: null,
    start_year_approximate: true,
    is_current: true,
    display_order: 220,
    confidence: 'high',
    image_url: null,
    source_url: 'https://matrixhomefitness.com/blogs/blog/how-to-pick-the-perfect-console',
    notes: 'HOME ONLY — 16" home touchscreen. Not commercial Touch.',
    family: 'home',
  },
  {
    console_key: 'xur',
    console_name: 'XUR',
    alternative_names: ['XUR Console', '22" Home Touch'],
    start_year: 2019,
    end_year: null,
    start_year_approximate: true,
    is_current: true,
    display_order: 230,
    confidence: 'high',
    image_url: null,
    source_url: 'https://matrixhomefitness.com/blogs/blog/how-to-pick-the-perfect-console',
    notes: 'HOME ONLY — 22" home touchscreen. Not commercial Touch XL.',
    family: 'home',
  },
]

/** Products intentionally left unmapped (manual review). */
export const MATRIX_UNRESOLVED_PRODUCTS = [
  {
    name: 'S-Drive',
    key: 'matrix-fitness-treadmill-s-drive-treadmill',
    reason: 'Speciality non-motorised / curved drive product — console options not confirmed; do not invent mappings.',
  },
  {
    name: 'Krankcycle',
    key: 'matrix-fitness-exercise-bike-krankcycle-krankcycle',
    reason: 'Upper-body cycle; console policy unclear — leave unmapped.',
  },
  {
    name: 'CXC / CXM / CXP Indoor Bikes',
    key: null,
    reason: 'Studio/spin indoor bikes — no commercial digit/modular console selector.',
  },
]

const HISTORIC_SOURCE =
  'https://content.johnsonfit.com/inc/uploaded_media/09479aec1bb4f1a49466388e6f30afa5/owners_guide/e579c7a6f962e02fc7421b1081bd6eb0.pdf'

const COMPARISON_SOURCE =
  'https://www.fitnesssuperstore.com/pages/matrix-console-comparisons-reviews-3x-5x-7xe-7xi'

const MODULAR_SOURCE =
  'https://fitnesscore-ner.com/news_articles/fitness-equipment-cardio-console/'

const ONYX_CONSOLE_SOURCE =
  'https://www.manualslib.com/guide/4242108/matrix-onyx-fitness-console-user-manual.html'

const LETTER_META = {
  T: { label: 'Treadmill', equipment_type: 'Treadmill', key: (base) => `matrix-fitness-treadmill-${base.toLowerCase()}-treadmill` },
  E: { label: 'Elliptical', equipment_type: 'Cross Trainer', key: (base) => `matrix-fitness-cross-trainer-${base.toLowerCase()}-elliptical` },
  A: { label: 'Ascent', equipment_type: null, key: (base) => `matrix-fitness-${base.toLowerCase()}-ascent` },
  C: { label: 'Climbmill', equipment_type: 'Stepper/Stair Climber', key: (base) => `matrix-fitness-stepper-stair-climber-${base.toLowerCase()}-climbmill` },
  S: { label: 'Stepper', equipment_type: 'Stepper/Stair Climber', key: (base) => `matrix-fitness-stepper-stair-climber-${base.toLowerCase()}-stepper` },
  U: { label: 'Upright Bike', equipment_type: 'Exercise Bike', key: (base) => `matrix-fitness-exercise-bike-${base.toLowerCase()}-upright-bike` },
  R: { label: 'Recumbent Bike', equipment_type: 'Recumbent Bike', key: (base) => `matrix-fitness-exercise-bike-${base.toLowerCase()}-recumbent-bike` },
  H: { label: 'Hybrid Bike', equipment_type: 'Exercise Bike', key: (base) => `matrix-fitness-exercise-bike-${base.toLowerCase()}-hybrid-bike` },
}

const CONSOLE_YEAR_BY_KEY = Object.fromEntries(
  MATRIX_CONSOLE_DEFS.map((def) => [
    def.console_key,
    {
      from: def.start_year ?? 2008,
      to: def.end_year ?? null,
      fromApprox: Boolean(def.start_year_approximate),
      toApprox: Boolean(def.end_year_approximate),
    },
  ]),
)

function normalizeText(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim()
}

/**
 * Parse Matrix digit SKU or base family: T1x, T1xe, T1, E5xe, …
 * Returns { letter, digit, base, suffix } where suffix is 'x'|'xe'|'xi'|null for bare base.
 */
export function parseMatrixDigitIdentity(product) {
  const familyCompact = String(product?.product_family ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')

  let match = familyCompact.match(/^([tearcuhsv])(\d)(xe|xi|x)?$/i)
  if (!match) {
    const compact = [
      product?.product_family,
      product?.model,
      product?.canonical_product_name,
    ].map((value) => String(value ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '')).join('')
    match = compact.match(/(?:^|[^a-z])([tearcuhsv])(\d)(xe|xi|x)?(?=[a-z]|$)/i)
  }
  if (!match) return null

  const letter = match[1].toUpperCase()
  if (!LETTER_META[letter]) return null
  const digit = match[2]
  const suffix = match[3] ? match[3].toLowerCase() : null
  return {
    letter,
    digit,
    base: `${letter}${digit}`,
    suffix,
  }
}

/**
 * @deprecated Prefer parseMatrixDigitIdentity — kept for tests / callers expecting console tier from suffix SKUs.
 */
export function parseMatrixHistoricConsoleTier(product) {
  const identity = parseMatrixDigitIdentity(product)
  if (!identity?.suffix) return null
  return tierFromDigitSuffix(identity.digit, identity.suffix)
}

function tierFromDigitSuffix(digit, suffix) {
  if (suffix === 'xi') {
    return { console_key: '7xi', tierLabel: `${digit}xi`, digit, suffix }
  }
  if (suffix === 'xe') {
    if (digit === '1' || digit === '3') {
      return { console_key: 'xe', tierLabel: `${digit}xe`, digit, suffix }
    }
    return { console_key: '7xe', tierLabel: `${digit}xe`, digit, suffix }
  }
  const keyByDigit = {
    1: 'led_1x',
    3: 'led_3x',
    5: 'led_5x',
    7: 'led_7x',
  }
  const console_key = keyByDigit[digit]
  if (!console_key) return null
  return { console_key, tierLabel: `${digit}x`, digit, suffix }
}

function factoryMapping(consoleKey, {
  confidence = 'high',
  source_url = HISTORIC_SOURCE,
  notes,
  display_order = 10,
  is_default = false,
} = {}) {
  const years = CONSOLE_YEAR_BY_KEY[consoleKey] ?? {
    from: 2008,
    to: 2018,
    fromApprox: true,
    toApprox: true,
  }
  const modifier = getMatrixConsoleModifier(consoleKey)
  return {
    console_key: consoleKey,
    compatibility_type: 'factory',
    available_from_year: years.from,
    available_to_year: years.to,
    from_year_approximate: years.fromApprox,
    to_year_approximate: years.toApprox,
    is_default,
    display_order,
    tier: modifier?.tier ?? 'base',
    modifier_percent: Number(modifier?.modifier_percent ?? 0),
    confidence,
    source_url,
    notes,
  }
}

/**
 * Year-filtered factory consoles for a digit base (T1, T5, E7, …).
 * No modern modular consoles. No *5xe → 7xe.
 */
export function buildMatrixBaseConsoleMappings(base) {
  const match = String(base ?? '').match(/^([TEARCUHS])(\d)$/i)
  if (!match) return []
  const digit = match[2]
  const rows = []

  const ledKey = { 1: 'led_1x', 3: 'led_3x', 5: 'led_5x', 7: 'led_7x' }[digit]
  if (ledKey) {
    rows.push(factoryMapping(ledKey, {
      display_order: 10,
      is_default: true,
      source_url: digit === '1' || digit === '3' ? HISTORIC_SOURCE : COMPARISON_SOURCE,
      notes: `Historic ${digit}x LED on Matrix ${base}. Year-filtered factory option. Not modern modular LED.`,
    }))
  }

  if (digit === '1' || digit === '3') {
    rows.push(factoryMapping('xe', {
      display_order: 20,
      source_url: HISTORIC_SOURCE,
      notes: `Historic xe console on Matrix ${base}. Year-filtered factory option.`,
    }))
  }

  if (digit === '7') {
    rows.push(factoryMapping('7xe', {
      display_order: 20,
      source_url: COMPARISON_SOURCE,
      notes: `Historic 7xe on Matrix ${base}. Year-filtered factory option.`,
    }))
    rows.push(factoryMapping('7xi', {
      display_order: 30,
      source_url: COMPARISON_SOURCE,
      notes: `Historic 7xi on Matrix ${base} (OEM-documented). Year-filtered factory option.`,
    }))
  }

  return rows
}

export function isMatrixOnyxProduct(product) {
  const family = normalizeText(product?.product_family).toLowerCase()
  const name = normalizeText(product?.canonical_product_name).toLowerCase()
  const model = normalizeText(product?.model).toLowerCase()
  return family.includes('onyx') || name.includes('onyx') || model.includes('onyx')
}

export function isMatrixModernModularProduct(product) {
  if (isMatrixOnyxProduct(product)) return false
  if (parseMatrixDigitIdentity(product)) return false
  const family = normalizeText(product?.product_family).toLowerCase()
  return (
    family.includes('lifestyle')
    || family.includes('endurance')
    || family.includes('performance')
  )
}

function matrixEquipmentSupportsTouchXl(product) {
  const type = normalizeText(product?.equipment_type).toLowerCase()
  const name = normalizeText(product?.canonical_product_name).toLowerCase()
  const model = normalizeText(product?.model).toLowerCase()
  const hay = `${type} ${name} ${model}`
  return /\btreadmill\b/.test(hay) || /\bclimbmill\b/.test(hay)
}

function isMatrixPerformanceHybrid(product) {
  const type = normalizeText(product?.equipment_type).toLowerCase()
  const name = normalizeText(product?.canonical_product_name).toLowerCase()
  const model = normalizeText(product?.model).toLowerCase()
  return type.includes('hybrid') || name.includes('hybrid') || model.includes('hybrid')
}

/**
 * Modern modular factory options for Lifestyle / Endurance / Performance / Performance Plus.
 * Touch XL only on treadmills and ClimbMills. LED is default.
 */
export function buildMatrixModernModularConsoleMappings(product) {
  if (!isMatrixModernModularProduct(product)) return []

  const confidence = isMatrixPerformanceHybrid(product) ? 'medium' : 'high'
  const familyLabel = normalizeText(product?.product_family) || 'modern Matrix'
  const typeLabel = normalizeText(product?.equipment_type) || 'cardio'
  const includeTouchXl = matrixEquipmentSupportsTouchXl(product)

  const rows = [
    factoryMapping('led', {
      confidence,
      display_order: 10,
      is_default: true,
      source_url: MODULAR_SOURCE,
      notes: `Modern modular LED on ${familyLabel} ${typeLabel}. Factory option from 2020. Explicit product mapping — not brand-wide.`,
    }),
    factoryMapping('premium_led', {
      confidence,
      display_order: 20,
      source_url: MODULAR_SOURCE,
      notes: `Modern modular Premium LED on ${familyLabel} ${typeLabel}. Factory option from 2020.`,
    }),
    factoryMapping('touch', {
      confidence,
      display_order: 30,
      source_url: MODULAR_SOURCE,
      notes: `Modern modular 16" Touch on ${familyLabel} ${typeLabel}. Factory option from 2020.`,
    }),
  ]

  if (includeTouchXl) {
    rows.push(factoryMapping('touch_xl', {
      confidence,
      display_order: 40,
      source_url: MODULAR_SOURCE,
      notes: `Modern modular 22" Touch XL on ${familyLabel} ${typeLabel}. OEM-supported on treadmills and ClimbMills only.`,
    }))
  }

  return rows
}

/**
 * Onyx fixed immersive console — never modular LED / Premium LED / Touch / Touch XL.
 */
export function buildMatrixOnyxFixedConsoleMappings(product) {
  if (!isMatrixOnyxProduct(product)) return []

  const type = normalizeText(product?.equipment_type).toLowerCase()
  const name = normalizeText(product?.canonical_product_name).toLowerCase()
  const isTreadmill = type.includes('treadmill') || name.includes('treadmill')
  const consoleKey = isTreadmill ? 'onyx_32' : 'onyx_22'
  const years = CONSOLE_YEAR_BY_KEY[consoleKey] ?? {
    from: 2024,
    to: null,
    fromApprox: false,
    toApprox: false,
  }

  return [{
    console_key: consoleKey,
    compatibility_type: 'fixed',
    available_from_year: years.from,
    available_to_year: years.to,
    from_year_approximate: years.fromApprox,
    to_year_approximate: years.toApprox,
    is_default: true,
    display_order: 10,
    tier: getMatrixConsoleModifier(consoleKey)?.tier ?? 'premium',
    modifier_percent: Number(getMatrixConsoleModifier(consoleKey)?.modifier_percent ?? 0),
    confidence: 'high',
    source_url: ONYX_CONSOLE_SOURCE,
    notes: isTreadmill
      ? 'Onyx Treadmill fixed 32" immersive touchscreen. Auto-apply; hide selector. Not modular Touch XL.'
      : 'Onyx fixed 22" immersive touchscreen. Auto-apply; hide selector. Not modular Touch XL.',
  }]
}

export function buildMatrixBaseProductIdentity(base) {
  const match = String(base ?? '').match(/^([TEARCUHS])(\d)$/i)
  if (!match) return null
  const letter = match[1].toUpperCase()
  const digit = match[2]
  const meta = LETTER_META[letter]
  if (!meta) return null
  const baseKey = `${letter}${digit}`
  return {
    base: baseKey,
    letter,
    digit,
    product_family: baseKey,
    canonical_product_name: `Matrix ${baseKey} ${meta.label}`,
    canonical_product_key: meta.key(baseKey),
    equipment_type: meta.equipment_type,
    timeline_end_year: digit === '7' ? 2019 : 2018,
  }
}

function isExcludedSpecialty(product) {
  const key = product?.canonical_product_key
  if (MATRIX_UNRESOLVED_PRODUCTS.some((entry) => entry.key && entry.key === key)) return true
  const hay = [
    product?.product_family,
    product?.model,
    product?.canonical_product_name,
  ].join(' ').toLowerCase()
  return /\bcxc\b|\bcxm\b|\bcxp\b|indoor\s+bike|krankcycle|s-?drive\b/i.test(hay)
}

function isHeldFiveXe(identity) {
  return identity?.digit === '5' && identity?.suffix === 'xe'
}

function sourceCount(product) {
  return (product?.source_intelligence_row_ids ?? []).length
}

function pickKeeper(members) {
  const ranked = [...members].sort((a, b) => {
    const aX = a.identity.suffix === 'x' ? 1 : 0
    const bX = b.identity.suffix === 'x' ? 1 : 0
    if (aX !== bX) return bX - aX
    const sourceDiff = sourceCount(b.product) - sourceCount(a.product)
    if (sourceDiff !== 0) return sourceDiff
    const priceA = Number(a.product.original_base_price)
    const priceB = Number(b.product.original_base_price)
    const aHas = Number.isFinite(priceA) && priceA > 0
    const bHas = Number.isFinite(priceB) && priceB > 0
    if (aHas && bHas && priceA !== priceB) return priceA - priceB
    return String(a.product.canonical_product_key).localeCompare(String(b.product.canonical_product_key))
  })
  return ranked[0]
}

function unionSourceIds(products) {
  return [...new Set(products.flatMap((product) => product.source_intelligence_row_ids ?? []))]
}

/**
 * Build consolidation plan: fold suffix SKUs into digit base products.
 * *5xe rows are held (not folded). Specialty products excluded.
 */
export function buildMatrixBaseConsolidationPlan(products = []) {
  const byBase = new Map()
  const held = []
  const skipped = []

  for (const product of products) {
    if (String(product.status).toLowerCase() === 'excluded') continue
    if (isExcludedSpecialty(product)) {
      skipped.push({ product, reason: 'specialty_unmapped' })
      continue
    }

    const identity = parseMatrixDigitIdentity(product)
    if (!identity) {
      skipped.push({ product, reason: 'not_digit_series' })
      continue
    }

    if (isHeldFiveXe(identity)) {
      held.push({
        product,
        identity,
        suggested_console_key: '7xe',
        reason: '*5xe held for manual review — not folded into digit-5 base; no auto console mapping.',
        confidence: 'medium',
      })
      continue
    }

    // Bare base already (T1) or suffix SKU (T1x) — both group under base
    const list = byBase.get(identity.base) ?? []
    list.push({ product, identity })
    byBase.set(identity.base, list)
  }

  const groups = []
  for (const [base, members] of [...byBase.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const target = buildMatrixBaseProductIdentity(base)
    const keeperEntry = pickKeeper(members)
    const duplicates = members.filter((entry) => entry.product.id !== keeperEntry.product.id)
    const alreadyBase = keeperEntry.identity.suffix == null
      && keeperEntry.product.canonical_product_key === target.canonical_product_key

    groups.push({
      base,
      target,
      keeper: keeperEntry.product,
      members: members.map((entry) => entry.product),
      duplicates: duplicates.map((entry) => entry.product),
      needsRename: !alreadyBase
        || keeperEntry.product.canonical_product_name !== target.canonical_product_name
        || keeperEntry.product.product_family !== target.product_family,
      console_mappings: buildMatrixBaseConsoleMappings(base),
      aggregated_source_intelligence_row_ids: unionSourceIds(members.map((entry) => entry.product)),
      aliases: members.map((entry) => entry.product.canonical_product_name),
    })
  }

  return {
    groups,
    held,
    skipped,
    summary: {
      base_count: groups.length,
      merge_duplicate_count: groups.reduce((n, group) => n + group.duplicates.length, 0),
      held_5xe_count: held.length,
      mapping_row_count: groups.reduce((n, group) => n + group.console_mappings.length, 0),
    },
  }
}

/**
 * Build product_key → console mappings for Matrix cardio products.
 * Digit bases: historic year-filtered factory options.
 * Modern series: modular LED / Premium LED / Touch (/ Touch XL where supported).
 * Onyx: fixed Onyx 32"/22" touchscreen only.
 * *5xe omitted.
 */
export function buildMatrixCompatByProductKey(products) {
  const byKey = {}
  for (const product of products ?? []) {
    const key = product.canonical_product_key
    if (!key) continue
    if (isExcludedSpecialty(product)) continue

    if (isMatrixOnyxProduct(product)) {
      byKey[key] = buildMatrixOnyxFixedConsoleMappings(product)
      continue
    }

    if (isMatrixModernModularProduct(product)) {
      byKey[key] = buildMatrixModernModularConsoleMappings(product)
      continue
    }

    const identity = parseMatrixDigitIdentity(product)
    if (!identity) continue
    if (isHeldFiveXe(identity)) continue

    byKey[key] = buildMatrixBaseConsoleMappings(identity.base)
  }
  return byKey
}

/** Products that parse to *5xe — held, not auto-approved. */
export function listMatrixHeldForReview(products) {
  const held = []
  for (const product of products ?? []) {
    const key = product.canonical_product_key
    if (!key) continue
    if (isExcludedSpecialty(product)) continue
    const identity = parseMatrixDigitIdentity(product)
    if (!identity || !isHeldFiveXe(identity)) continue
    held.push({
      key,
      name: product.canonical_product_name,
      suggested_console_key: '7xe',
      reason: '*5xe held for manual review — not auto-mapped and not folded into digit-5 base.',
      confidence: 'medium',
    })
  }
  return held
}

export function getMatrixBaseTimelineEndYear(base) {
  return buildMatrixBaseProductIdentity(base)?.timeline_end_year ?? null
}
