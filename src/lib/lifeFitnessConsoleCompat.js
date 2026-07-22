/**
 * Life Fitness console catalogue and product/year compatibility matrix.
 *
 * Curated rebuild (not commercialCardioConsoleCompat template backfill).
 *
 * Primary sources:
 * - https://support.lifefitness.com/hc/en-us/articles/1500006307842-Life-Fitness-Integrity-Cardio-Series-Introduction
 * - https://support.lifefitness.com/hc/en-us/articles/10249158664983-Life-Fitness-Discover-SE4-Console-Introduction
 * - https://support.lifefitness.com/hc/en-us/articles/14335936804503-Life-Fitness-Planet-Fitness-C-SL-Console-Comparison
 * - https://www.lifefitness.com/en-us/catalog/cardio/consoles/sl-console
 * - https://www.lifefitness.com/en-us/catalog/cardio/consoles/se4-console
 * - https://www.fitnesssuperstore.com/pages/life-fitness-elevation-series-console-comparisons
 * - https://www.fitnesssuperstore.com/pages/life-fitness-classic-series-console-comparisons
 *
 * Policy:
 * - Indoor bikes (IC*) and Gx Indoor Bike: no console mappings (hide selector).
 * - Silver Line 93/95: fixed integrated LED only — not Elevation Achieve/Engage/Inspire.
 * - Gx Row: fixed LED (medium) — not Elevation entertainment set.
 * - Integrity / Elevation: factory + optional by OEM year windows.
 * - Home cardio (T3, T5, F3, E1/E3/E5, C1/C3, RS1/RS3): GO / TRACK / TRACK CONNECT timeline by year.
 * - Home fixed/no-console/legacy (Row HX, G2/G4/G7, X1/X3/X5, R1/R3): no selector.
 */

import {
  LIFE_FITNESS_CONSOLE_IMAGE_BASE,
  LIFE_FITNESS_CONSOLE_IMAGE_FILES,
} from './commercialCardioConsoleCompat.js'

export const LIFE_FITNESS_BRAND = 'Life Fitness'

/**
 * Canonical Discover / Integrity console value hierarchy (least → most valuable).
 *
 * Research basis:
 * - Achieve < Inspire < Engage (Elevation pre-Discover; Fitness Superstore compare)
 * - Discover SI (2012, ~10") < SE (2012, 16–19") < ST (2017 tablet) < SE3 (2016 streaming)
 *   < SE3HD (2017 HD) < SE4 (2022 flagship)
 * - Integrity: C/SL base → X mid LED → ST → SE3HD → SE4
 *
 * User-confirmed Discover order: SI → SE → ST → SE3 → SE3HD → SE4
 */
export const LIFE_FITNESS_CONSOLE_MODIFIER_BY_KEY = Object.freeze({
  led: { modifier_percent: 0, tier: 'base' },
  achieve: { modifier_percent: 0, tier: 'base' },
  inspire: { modifier_percent: 6, tier: 'mid' },
  engage: { modifier_percent: 10, tier: 'mid' },
  discover_si: { modifier_percent: 10, tier: 'mid' },
  discover_se: { modifier_percent: 15, tier: 'mid' },
  st: { modifier_percent: 18, tier: 'mid' },
  discover_se3: { modifier_percent: 22, tier: 'mid' },
  discover_se3hd: { modifier_percent: 26, tier: 'premium' },
  discover_se4: { modifier_percent: 30, tier: 'premium' },
  integrity_c: { modifier_percent: 0, tier: 'base' },
  integrity_sl: { modifier_percent: 0, tier: 'base' },
  integrity_x: { modifier_percent: 10, tier: 'mid' },
  go: { modifier_percent: 0, tier: 'base' },
  track: { modifier_percent: 6, tier: 'mid' },
  track_connect: { modifier_percent: 12, tier: 'mid' },
  track_connect_2: { modifier_percent: 15, tier: 'premium' },
})

export function getLifeFitnessConsoleModifier(consoleKey) {
  return LIFE_FITNESS_CONSOLE_MODIFIER_BY_KEY[consoleKey] ?? null
}

const IMG = (key) => {
  const file = LIFE_FITNESS_CONSOLE_IMAGE_FILES[key]
  return file ? `${LIFE_FITNESS_CONSOLE_IMAGE_BASE}/${file}` : null
}

const SRC = {
  integrityIntro:
    'https://support.lifefitness.com/hc/en-us/articles/1500006307842-Life-Fitness-Integrity-Cardio-Series-Introduction',
  se4Intro:
    'https://support.lifefitness.com/hc/en-us/articles/10249158664983-Life-Fitness-Discover-SE4-Console-Introduction',
  cVsSl:
    'https://support.lifefitness.com/hc/en-us/articles/14335936804503-Life-Fitness-Planet-Fitness-C-SL-Console-Comparison',
  elevationCompare:
    'https://www.fitnesssuperstore.com/pages/life-fitness-elevation-series-console-comparisons',
  classicCompare:
    'https://www.fitnesssuperstore.com/pages/life-fitness-classic-series-console-comparisons',
  slProduct: 'https://www.lifefitness.com/en-us/catalog/cardio/consoles/sl-console',
  se4Product: 'https://www.lifefitness.com/en-us/catalog/cardio/consoles/se4-console',
  homeTrackConnect:
    'https://www.lifefitness.com/en-us/catalog/home/consoles',
}

export const LIFE_FITNESS_CONSOLE_DEFS = [
  {
    console_key: 'led',
    console_name: 'LED',
    alternative_names: ['Standard LED', '93/95 Series LED'],
    start_year: 2000,
    end_year: null,
    start_year_approximate: true,
    is_current: false,
    display_order: 5,
    confidence: 'high',
    image_url: null,
    source_url: SRC.classicCompare,
    notes: 'Integrated LED family for Silver Line 93/95 and similar legacy frames. Not interchangeable with Elevation Discover consoles.',
  },
  {
    console_key: 'achieve',
    console_name: 'Achieve',
    alternative_names: ['Achieve Console'],
    start_year: 2008,
    end_year: 2015,
    start_year_approximate: true,
    end_year_approximate: true,
    is_current: false,
    display_order: 10,
    confidence: 'high',
    image_url: IMG('achieve'),
    source_url: SRC.elevationCompare,
    notes: 'Elevation-era base LED/message-center console (~2008–2015). Not for Silver Line 93/95.',
  },
  {
    console_key: 'engage',
    console_name: 'Engage',
    alternative_names: ['Engage Console'],
    start_year: 2008,
    end_year: 2012,
    start_year_approximate: true,
    end_year_approximate: true,
    is_current: false,
    display_order: 20,
    confidence: 'high',
    image_url: IMG('engage'),
    source_url: SRC.elevationCompare,
    notes: 'Elevation-era large touchscreen entertainment console (~2008–2012).',
  },
  {
    console_key: 'inspire',
    console_name: 'Inspire',
    alternative_names: ['Inspire Console'],
    start_year: 2008,
    end_year: 2012,
    start_year_approximate: true,
    end_year_approximate: true,
    is_current: false,
    display_order: 30,
    confidence: 'high',
    image_url: IMG('inspire'),
    source_url: SRC.elevationCompare,
    notes: 'Elevation-era mid touchscreen console (~2008–2012).',
  },
  {
    console_key: 'discover_si',
    console_name: 'Discover SI',
    alternative_names: ['SI', 'Discover SI Console'],
    start_year: 2010,
    end_year: null,
    start_year_approximate: true,
    is_current: false,
    display_order: 40,
    confidence: 'high',
    image_url: IMG('discoversi'),
    source_url: SRC.elevationCompare,
    notes: 'Discover SI (~10") on Elevation Discover generation.',
  },
  {
    console_key: 'discover_se',
    console_name: 'Discover SE',
    alternative_names: ['SE', 'Discover SE Console'],
    start_year: 2012,
    end_year: null,
    start_year_approximate: true,
    is_current: false,
    display_order: 50,
    confidence: 'high',
    image_url: IMG('discoverse'),
    source_url: SRC.elevationCompare,
    notes: 'Discover SE touchscreen on Elevation Discover generation.',
  },
  {
    console_key: 'st',
    console_name: 'Discover ST',
    alternative_names: ['ST', 'ST Console', 'Discover ST Console'],
    start_year: 2017,
    end_year: null,
    is_current: true,
    display_order: 55,
    confidence: 'high',
    image_url: IMG('st'),
    source_url: SRC.integrityIntro,
    notes: 'Discover ST tablet console — Integrity from June 2017; also on late Elevation. Value tier between SE and SE3.',
  },
  {
    console_key: 'discover_se3',
    console_name: 'Discover SE3',
    alternative_names: ['SE3', 'Discover SE3 Console'],
    start_year: 2016,
    end_year: null,
    start_year_approximate: true,
    is_current: false,
    display_order: 60,
    confidence: 'high',
    image_url: IMG('discoverse3'),
    source_url: SRC.elevationCompare,
    notes: 'Discover SE3 with streaming apps (Netflix/Hulu) — IHRSA 2016 launch; precedes SE3HD.',
  },
  {
    console_key: 'discover_se3hd',
    console_name: 'Discover SE3HD',
    alternative_names: ['SE3HD', 'SE3 HD', 'Discover SE3 HD'],
    start_year: 2017,
    end_year: null,
    is_current: false,
    display_order: 70,
    confidence: 'high',
    image_url: IMG('discoverse3hd'),
    source_url: SRC.integrityIntro,
    notes: 'Discover SE3HD — documented on Integrity bases from June 2017 launch; also used on late Elevation.',
  },
  {
    console_key: 'integrity_c',
    console_name: 'Integrity C',
    alternative_names: ['C Console', 'Integrity C Console'],
    start_year: 2017,
    end_year: null,
    is_current: false,
    display_order: 90,
    confidence: 'high',
    image_url: IMG('integrityc'),
    source_url: SRC.integrityIntro,
    notes: 'Integrity C LED console — factory/base option on Integrity from June 2017. Preceded SL as simple LED.',
  },
  {
    console_key: 'integrity_x',
    console_name: 'Integrity X',
    alternative_names: ['X Console', 'Integrity X Console'],
    start_year: 2017,
    end_year: null,
    is_current: false,
    display_order: 100,
    confidence: 'high',
    image_url: IMG('integrityx'),
    source_url: SRC.integrityIntro,
    notes: 'Integrity X ~7" touchscreen — optional on Integrity from June 2017.',
  },
  {
    console_key: 'integrity_sl',
    console_name: 'Integrity SL',
    alternative_names: ['SL', 'SL Console', 'Integrity SL Console'],
    start_year: 2021,
    end_year: null,
    is_current: true,
    display_order: 110,
    confidence: 'high',
    image_url: IMG('integritysl'),
    source_url: SRC.integrityIntro,
    notes: 'Integrity SL smart LED — LF support: Integrity bases updated 19 May 2021 for SL compatibility. Not for Elevation bases.',
  },
  {
    console_key: 'discover_se4',
    console_name: 'Discover SE4',
    alternative_names: ['SE4', 'Discover SE4 Console', 'Integrity SE4'],
    start_year: 2022,
    end_year: null,
    is_current: true,
    display_order: 120,
    confidence: 'high',
    image_url: IMG('discoverse4'),
    source_url: SRC.se4Intro,
    notes: 'Discover SE4 — first install 9 Dec 2022. Integrity D bases updated for SE4 9 Dec 2023 (LF support).',
  },
  // --- Home console family (GO / TRACK / TRACK CONNECT) — never map to commercial Integrity/Elevation ---
  {
    console_key: 'go',
    console_name: 'GO',
    alternative_names: ['GO Console', 'Life Fitness GO'],
    start_year: 2011,
    end_year: null,
    start_year_approximate: false,
    is_current: true,
    display_order: 200,
    confidence: 'high',
    image_url: IMG('go'),
    source_url: SRC.homeTrackConnect,
    notes: 'HOME ONLY — GO base console on Life Fitness home cardio. Not commercial Integrity/Elevation.',
    family: 'home',
  },
  {
    console_key: 'track',
    console_name: 'TRACK',
    alternative_names: ['TRACK Console', 'Life Fitness TRACK'],
    start_year: 2011,
    end_year: 2015,
    start_year_approximate: false,
    end_year_approximate: false,
    is_current: false,
    display_order: 210,
    confidence: 'high',
    image_url: IMG('track'),
    source_url: SRC.homeTrackConnect,
    notes: 'HOME ONLY — TRACK console (~2011–2015). Not commercial Discover.',
    family: 'home',
  },
  {
    console_key: 'track_connect',
    console_name: 'TRACK CONNECT',
    alternative_names: ['Track Connect', 'TRACK CONNECT Console'],
    start_year: 2016,
    end_year: 2021,
    start_year_approximate: false,
    end_year_approximate: false,
    is_current: false,
    display_order: 220,
    confidence: 'high',
    image_url: IMG('trackconnect'),
    source_url: SRC.homeTrackConnect,
    notes: 'HOME ONLY — TRACK CONNECT (~2016–2021). Not commercial Discover SE.',
    family: 'home',
  },
  {
    console_key: 'track_connect_2',
    console_name: 'TRACK CONNECT 2.0',
    alternative_names: ['Track Connect 2.0', 'TRACK CONNECT 2', 'Track Connect 2'],
    start_year: 2022,
    end_year: null,
    start_year_approximate: false,
    is_current: true,
    display_order: 230,
    confidence: 'high',
    image_url: IMG('trackconnect20'),
    source_url: SRC.homeTrackConnect,
    notes: 'HOME ONLY — TRACK CONNECT 2.0 from 2022. Not commercial Discover SE4.',
    family: 'home',
  },
]

function row({
  console_key,
  compatibility_type,
  available_from_year,
  available_to_year = null,
  from_year_approximate = false,
  to_year_approximate = false,
  is_default = false,
  display_order,
  tier = null,
  modifier_percent = null,
  confidence,
  source_url,
  notes,
}) {
  const modifier = getLifeFitnessConsoleModifier(console_key)
  return {
    console_key,
    compatibility_type,
    available_from_year,
    available_to_year,
    from_year_approximate,
    to_year_approximate,
    is_default,
    display_order,
    tier: tier ?? modifier?.tier ?? 'base',
    modifier_percent: modifier_percent ?? modifier?.modifier_percent ?? 0,
    confidence,
    source_url,
    notes,
  }
}

/** Elevation Series — Achieve/Engage/Inspire then Discover generations. */
export function buildElevationMappings() {
  return [
    row({
      console_key: 'achieve',
      compatibility_type: 'factory',
      available_from_year: 2008,
      available_to_year: 2015,
      from_year_approximate: true,
      to_year_approximate: true,
      is_default: false,
      display_order: 10,


      confidence: 'high',
      source_url: SRC.elevationCompare,
      notes: 'Factory Elevation Achieve-era console (~2008–2015). Default only when it is the sole year-matched factory option (pre-Discover SI).',
    }),
    row({
      console_key: 'inspire',
      compatibility_type: 'optional',
      available_from_year: 2008,
      available_to_year: 2012,
      from_year_approximate: true,
      to_year_approximate: true,
      display_order: 20,


      confidence: 'high',
      source_url: SRC.elevationCompare,
      notes: 'Optional Inspire on Elevation (~2008–2012).',
    }),
    row({
      console_key: 'engage',
      compatibility_type: 'optional',
      available_from_year: 2008,
      available_to_year: 2012,
      from_year_approximate: true,
      to_year_approximate: true,
      display_order: 30,


      confidence: 'high',
      source_url: SRC.elevationCompare,
      notes: 'Optional Engage entertainment console on Elevation (~2008–2012).',
    }),
    row({
      console_key: 'discover_si',
      compatibility_type: 'factory',
      available_from_year: 2010,
      available_to_year: null,
      from_year_approximate: true,
      is_default: true,
      display_order: 40,


      confidence: 'high',
      source_url: SRC.elevationCompare,
      notes: 'Discover SI becomes primary Elevation factory option from ~2010 (overlaps late Achieve window by year filter).',
    }),
    row({
      console_key: 'discover_se',
      compatibility_type: 'optional',
      available_from_year: 2012,
      available_to_year: null,
      from_year_approximate: true,
      display_order: 50,
      confidence: 'high',
      source_url: SRC.elevationCompare,
      notes: 'Optional Discover SE on Elevation from ~2012.',
    }),
    row({
      console_key: 'st',
      compatibility_type: 'optional',
      available_from_year: 2017,
      available_to_year: null,
      display_order: 55,
      confidence: 'medium',
      source_url: SRC.elevationCompare,
      notes: 'Discover ST on late Elevation — value tier between SE and SE3.',
    }),
    row({
      console_key: 'discover_se3',
      compatibility_type: 'optional',
      available_from_year: 2016,
      available_to_year: null,
      from_year_approximate: true,
      display_order: 60,
      confidence: 'high',
      source_url: SRC.elevationCompare,
      notes: 'Optional Discover SE3 on Elevation from ~2016 (streaming generation).',
    }),
    row({
      console_key: 'discover_se3hd',
      compatibility_type: 'optional',
      available_from_year: 2017,
      available_to_year: null,
      display_order: 70,
      confidence: 'high',
      source_url: SRC.elevationCompare,
      notes: 'Optional Discover SE3HD on late Elevation from ~2017.',
    }),
  ]
}

/**
 * Integrity Series — OEM LF support timeline:
 * 2017-06: C, X, ST, SE3HD
 * 2021-05: SL
 * 2022-12 SE4 console; 2023-12 Integrity D bases for SE4
 */
export function buildIntegrityMappings() {
  return [
    row({
      console_key: 'integrity_c',
      compatibility_type: 'factory',
      available_from_year: 2017,
      available_to_year: 2020,
      is_default: true,
      display_order: 10,


      confidence: 'high',
      source_url: SRC.integrityIntro,
      notes: 'Factory Integrity C from June 2017 launch through 2020. SL becomes factory base from May 2021.',
    }),
    row({
      console_key: 'integrity_x',
      compatibility_type: 'optional',
      available_from_year: 2017,
      available_to_year: null,
      display_order: 20,


      confidence: 'high',
      source_url: SRC.integrityIntro,
      notes: 'Optional Integrity X from June 2017 Integrity introduction.',
    }),
    row({
      console_key: 'st',
      compatibility_type: 'optional',
      available_from_year: 2017,
      available_to_year: null,
      display_order: 30,


      confidence: 'high',
      source_url: SRC.integrityIntro,
      notes: 'Optional Discover ST from June 2017 Integrity introduction.',
    }),
    row({
      console_key: 'discover_se3hd',
      compatibility_type: 'optional',
      available_from_year: 2017,
      available_to_year: null,
      display_order: 40,


      confidence: 'high',
      source_url: SRC.integrityIntro,
      notes: 'Optional Discover SE3HD from June 2017 Integrity introduction.',
    }),
    row({
      console_key: 'integrity_sl',
      compatibility_type: 'factory',
      available_from_year: 2021,
      available_to_year: null,
      is_default: true,
      display_order: 50,


      confidence: 'high',
      source_url: SRC.integrityIntro,
      notes: 'Factory Integrity SL from 19 May 2021 base update (LF support).',
    }),
    row({
      console_key: 'discover_se4',
      compatibility_type: 'optional',
      available_from_year: 2022,
      available_to_year: null,
      display_order: 60,


      confidence: 'high',
      source_url: SRC.se4Intro,
      notes: 'Optional Discover SE4 from Dec 2022 console launch; Integrity D base update Dec 2023.',
    }),
  ]
}

export function buildSilverLineFixedLed() {
  return [
    row({
      console_key: 'led',
      compatibility_type: 'fixed',
      available_from_year: 2000,
      available_to_year: null,
      from_year_approximate: true,
      is_default: true,
      display_order: 10,
      confidence: 'high',
      source_url: SRC.classicCompare,
      notes: 'Silver Line 93/95 uses integrated series LED — not Elevation Achieve/Engage/Inspire. Selector hidden (fixed).',
    }),
  ]
}

export function buildGxRowFixedLed() {
  return [
    row({
      console_key: 'led',
      compatibility_type: 'fixed',
      available_from_year: 2010,
      available_to_year: null,
      from_year_approximate: true,
      is_default: true,
      display_order: 10,
      confidence: 'medium',
      source_url: SRC.classicCompare,
      notes: 'Gx Row — no Elevation entertainment console set. Fixed basic LED/monitor assumption; medium pending OEM rower sheet.',
    }),
  ]
}

const ELEVATION_KEYS = [
  'life-fitness-exercise-bike-elevation-recumbent-bike',
  'life-fitness-elevation-series-flexstrider',
  'life-fitness-elevation-series-powermill',
  'life-fitness-cross-trainer-elevation-crosstrainer',
  'life-fitness-exercise-bike-elevation-upright-bike',
  'life-fitness-treadmill-elevation-treadmill',
]

const INTEGRITY_KEYS = [
  'life-fitness-integrity-series-powermill',
  'life-fitness-exercise-bike-integrity-series-bike',
  'life-fitness-recumbent-bike-integrity-series-recumbent',
  'life-fitness-treadmill-integrity-series-treadmill',
  'life-fitness-cross-trainer-integrity-series-crosstrainer',
]

/** Silver Line 93/95 — single fixed OEM console; no valuation selector. */
export const SILVER_LINE_KEYS = Object.freeze([
  'life-fitness-stepper-stair-climber-silver-line-95si-stepper',
  'life-fitness-exercise-bike-silver-line-93ci-upright-bike',
  'life-fitness-exercise-bike-silver-line-95ci-upright-bike',
  'life-fitness-treadmill-silver-line-95ti',
  'life-fitness-cross-trainer-silver-line-93xi-crosstrainer',
  'life-fitness-cross-trainer-silver-line-95xi-crosstrainer',
  'life-fitness-exercise-bike-silver-line-93ri-recumbent-bike',
  'life-fitness-treadmill-silver-line-93ti',
  'life-fitness-exercise-bike-silver-line-95ri-recumbent-bike',
  'life-fitness-silver-line-93li-summit-trainer',
  'life-fitness-stepper-stair-climber-silver-line-93si-stepper',
  'life-fitness-silver-line-95li-summit-trainer',
])

/** Explicitly unmapped — delete any prior rows; hide selector. */
export const LIFE_FITNESS_EXPLICITLY_UNMAPPED = [
  { key: 'life-fitness-exercise-bike-indoor-bikes-ic2', reason: 'Indoor cycle — no commercial cardio console selector' },
  { key: 'life-fitness-exercise-bike-indoor-bikes-ic4', reason: 'Indoor cycle — no commercial cardio console selector' },
  { key: 'life-fitness-exercise-bike-indoor-bikes-ic5', reason: 'Indoor cycle — no commercial cardio console selector' },
  { key: 'life-fitness-exercise-bike-indoor-bikes-ic6', reason: 'Indoor cycle — no commercial cardio console selector' },
  { key: 'life-fitness-exercise-bike-indoor-bikes-ic7', reason: 'Indoor cycle — no commercial cardio console selector' },
  { key: 'life-fitness-exercise-bike-gx-indoor-bike', reason: 'Indoor cycle — no commercial cardio console selector' },
  ...SILVER_LINE_KEYS.map((key) => ({
    key,
    reason: 'Silver Line — single fixed console; no selector or console modifier',
  })),
]

export const LIFE_FITNESS_UNRESOLVED_PRODUCTS = [
  {
    name: 'Gx Row',
    key: 'life-fitness-row-machine-gx-row',
    reason: 'Mapped fixed LED at medium confidence — confirm OEM rower display options.',
  },
  {
    name: 'Elevation ST option',
    key: null,
    reason: 'ST on Elevation marked medium — confirm per-frame sell sheets.',
  },
]

export const LIFE_FITNESS_COMPAT_BY_PRODUCT_KEY = {
  ...Object.fromEntries(ELEVATION_KEYS.map((key) => [key, buildElevationMappings()])),
  ...Object.fromEntries(INTEGRITY_KEYS.map((key) => [key, buildIntegrityMappings()])),
  // Silver Line intentionally unmapped — see SILVER_LINE_KEYS / LIFE_FITNESS_EXPLICITLY_UNMAPPED
  'life-fitness-row-machine-gx-row': buildGxRowFixedLed(),
}

// --- Life Fitness home console timeline ---

const LIFE_FITNESS_HOME_INTERCHANGEABLE = Object.freeze([
  'T3', 'T5', 'F3', 'E1', 'E3', 'E5', 'C1', 'C3', 'RS1', 'RS3',
])

const LIFE_FITNESS_HOME_NO_CONSOLE = Object.freeze(['G2', 'G4', 'G7'])
const LIFE_FITNESS_HOME_LEGACY = Object.freeze(['X1', 'X3', 'X5', 'R1', 'R3'])

function normalizeLfText(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim()
}

function lifeFitnessHomeHaystack(product = {}) {
  return [
    product.model,
    product.product_family,
    product.canonical_product_name,
    product.canonical_product_key,
  ].map(normalizeLfText).filter(Boolean).join(' ')
}

export function isLifeFitnessCommercialSeriesProduct(product = {}) {
  const hay = lifeFitnessHomeHaystack(product).toLowerCase()
  return (
    /\bintegrity\b/.test(hay)
    || /\belevation\b/.test(hay)
    || /\bsilver\s*line\b/.test(hay)
    || /\bgx\b/.test(hay)
    || /\bic\d\b/.test(hay)
  )
}

function matchHomeToken(hay, token) {
  const escaped = String(token).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`(?:^|[^A-Za-z0-9])${escaped}(?:[^A-Za-z0-9]|$)`, 'i').test(hay)
}

/**
 * Classify Life Fitness home catalogue products for console timeline mapping.
 * Returns null when the product is not part of the home range under this brief.
 *
 * @returns {{ kind: 'interchangeable'|'fixed'|'no_console'|'legacy', base: string } | null}
 */
export function parseLifeFitnessHomeIdentity(product = {}) {
  const brandKey = String(product?.brand ?? '').toLowerCase().replace(/[^a-z0-9]/g, '')
  if (brandKey && brandKey !== 'lifefitness') return null
  if (isLifeFitnessCommercialSeriesProduct(product)) return null

  const hay = lifeFitnessHomeHaystack(product)
  if (!hay) return null

  if (/\brow\s*hx\b/i.test(hay) || (/\bhx\b/i.test(hay) && /\brow/i.test(hay))) {
    return { kind: 'fixed', base: 'Row HX' }
  }

  // Longer tokens first (RS1/RS3 before shorter codes)
  for (const base of ['RS1', 'RS3', 'T3', 'T5', 'F3', 'E1', 'E3', 'E5', 'C1', 'C3']) {
    if (matchHomeToken(hay, base)) {
      return { kind: 'interchangeable', base }
    }
  }

  for (const base of LIFE_FITNESS_HOME_NO_CONSOLE) {
    if (matchHomeToken(hay, base)) {
      return { kind: 'no_console', base }
    }
  }

  for (const base of LIFE_FITNESS_HOME_LEGACY) {
    if (matchHomeToken(hay, base)) {
      return { kind: 'legacy', base }
    }
  }

  return null
}

/**
 * Home interchangeable timeline.
 * 2000–2010: no mapping rows → base valuation, selector hidden.
 * 2011–2015: GO + TRACK
 * 2016–2021: GO + TRACK CONNECT
 * 2022+: GO + TRACK CONNECT 2.0
 */
export function buildLifeFitnessHomeConsoleMappings() {
  return [
    row({
      console_key: 'go',
      compatibility_type: 'factory',
      available_from_year: 2011,
      available_to_year: null,
      is_default: true,
      display_order: 10,
      confidence: 'high',
      source_url: SRC.homeTrackConnect,
      notes: 'Home GO factory console from 2011. Pre-2011 years have no selectable consoles (base valuation).',
    }),
    row({
      console_key: 'track',
      compatibility_type: 'optional',
      available_from_year: 2011,
      available_to_year: 2015,
      display_order: 20,
      confidence: 'high',
      source_url: SRC.homeTrackConnect,
      notes: 'Home TRACK optional console 2011–2015.',
    }),
    row({
      console_key: 'track_connect',
      compatibility_type: 'optional',
      available_from_year: 2016,
      available_to_year: 2021,
      display_order: 30,
      confidence: 'high',
      source_url: SRC.homeTrackConnect,
      notes: 'Home TRACK CONNECT optional console 2016–2021.',
    }),
    row({
      console_key: 'track_connect_2',
      compatibility_type: 'optional',
      available_from_year: 2022,
      available_to_year: null,
      display_order: 40,
      confidence: 'high',
      source_url: SRC.homeTrackConnect,
      notes: 'Home TRACK CONNECT 2.0 optional console from 2022.',
    }),
  ]
}

/**
 * Discover home products among approved Life Fitness rows and build compat + skip report.
 */
export function buildLifeFitnessHomeConsolePlan(products = []) {
  const byKey = {}
  const skipped = []
  const mapped = []

  for (const product of products ?? []) {
    const key = product?.canonical_product_key
    if (!key) continue
    if (String(product.status).toLowerCase() === 'excluded') continue
    if (LIFE_FITNESS_COMPAT_BY_PRODUCT_KEY[key]) continue
    if (LIFE_FITNESS_EXPLICITLY_UNMAPPED.some((entry) => entry.key === key)) continue

    const identity = parseLifeFitnessHomeIdentity(product)
    if (!identity) continue

    if (identity.kind === 'interchangeable') {
      const mappings = buildLifeFitnessHomeConsoleMappings()
      byKey[key] = mappings
      mapped.push({
        key,
        name: product.canonical_product_name,
        base: identity.base,
        kind: identity.kind,
        mapping_count: mappings.length,
      })
      continue
    }

    skipped.push({
      key,
      name: product.canonical_product_name,
      base: identity.base,
      kind: identity.kind,
      reason: identity.kind === 'fixed'
        ? 'Fixed / non-interchangeable console — no selector; base valuation'
        : identity.kind === 'no_console'
          ? 'No console — no selector; base valuation'
          : 'Legacy home product — base configuration only; no console selector',
    })
  }

  return {
    byKey,
    mapped,
    skipped,
    summary: {
      mapped_product_count: mapped.length,
      skipped_product_count: skipped.length,
      mapping_row_count: Object.values(byKey).reduce((n, rows) => n + rows.length, 0),
    },
  }
}
