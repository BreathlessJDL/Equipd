/**
 * Technogym console catalogue and product/year compatibility matrix.
 *
 * Curated rebuild (not commercialCardioConsoleCompat template backfill).
 *
 * Primary sources:
 * - https://www.technogym.com/my/newsroom/technogym-forty-years/ (Excite TV 2002; VisioWeb 2007)
 * - https://finance.yahoo.com/news/technogym-introduces-unity-tm-console-150000102.html (UNITY Jun 2013)
 * - https://www.technogym.com/vn/who-we-are/milestones/ (UNITY + Artis 2013)
 * - https://www.healthandfitness.org/technogym-the-evolution-of-an-ai-based-end-to-end-open-platform/ (UNITY 2013; Live 2020)
 * - https://apnews.com/pr-newswire/0617987d462642923d3271f39607c533 (Technogym Live Jul 2020)
 * - https://www.fitnesssuperstore.com/blogs/comparisons/technogym-console-comparisons
 * - https://www.technogym.com/gb/excite-range-new-entertainment-options/ (UNITY 3.0 / TV on Excite)
 *
 * Policy:
 * - Group Cycle / indoor cycles: no mappings.
 * - Residential (Personal / Forma / Myrun): no commercial mappings.
 * - Misclassified strength (benches, cable stations): no mappings.
 * - Named-console SKUs (VISIO WEB, DIGITAL TV, etc.): fixed to that generation.
 * - Generic Excite: LED factory + optional timeline; do not expose consoles before intro years.
 */

import {
  TECHNOGYM_CONSOLE_IMAGE_BASE,
  TECHNOGYM_CONSOLE_IMAGE_FILES,
} from './commercialCardioConsoleCompat.js'

export const TECHNOGYM_BRAND = 'Technogym'

const IMG = (key) => {
  const file = TECHNOGYM_CONSOLE_IMAGE_FILES[key]
  return file ? `${TECHNOGYM_CONSOLE_IMAGE_BASE}/${file}` : null
}

const SRC = {
  fortyYears: 'https://www.technogym.com/my/newsroom/technogym-forty-years/',
  unityLaunch: 'https://finance.yahoo.com/news/technogym-introduces-unity-tm-console-150000102.html',
  milestones: 'https://www.technogym.com/vn/who-we-are/milestones/',
  hfaTimeline:
    'https://www.healthandfitness.org/technogym-the-evolution-of-an-ai-based-end-to-end-open-platform/',
  liveLaunch: 'https://apnews.com/pr-newswire/0617987d462642923d3271f39607c533',
  consoleCompare: 'https://www.fitnesssuperstore.com/blogs/comparisons/technogym-console-comparisons',
  exciteEntertainment: 'https://www.technogym.com/gb/excite-range-new-entertainment-options/',
}

export const TECHNOGYM_CONSOLE_DEFS = [
  {
    console_key: 'led',
    console_name: 'LED',
    alternative_names: ['LED Console', 'Basic LED'],
    start_year: 2002,
    end_year: null,
    start_year_approximate: true,
    is_current: true,
    display_order: 10,
    confidence: 'high',
    image_url: IMG('led'),
    source_url: SRC.consoleCompare,
    notes: 'Base Excite LED console — cordless/basic, no TV/internet. Factory default across Excite generations.',
  },
  {
    console_key: 'visio',
    console_name: 'Visio',
    alternative_names: ['Visio Console'],
    start_year: 2005,
    end_year: 2007,
    start_year_approximate: true,
    end_year_approximate: true,
    is_current: false,
    display_order: 40,
    confidence: 'medium',
    image_url: IMG('visiovisioweb'),
    source_url: SRC.fortyYears,
    notes: 'Pre-VisioWeb Visio interface. Approximate; VisioWeb launched 2007 as web-connected successor.',
  },
  {
    console_key: 'visio_web',
    console_name: 'VisioWeb',
    alternative_names: ['Visio Web', 'Visioweb', 'VISIO WEB'],
    start_year: 2007,
    end_year: 2013,
    end_year_approximate: true,
    is_current: false,
    display_order: 50,
    confidence: 'high',
    image_url: IMG('visiovisioweb'),
    source_url: SRC.fortyYears,
    notes: 'VisioWeb — first web-connected Excite interface (2007 per Technogym). Approximate end as UNITY (2013) took over.',
  },
  {
    console_key: 'unity',
    console_name: 'UNITY',
    alternative_names: ['Unity', 'UNITY Console', 'Unity 2.0'],
    start_year: 2013,
    end_year: null,
    is_current: false,
    display_order: 60,
    confidence: 'high',
    image_url: IMG('unity'),
    source_url: SRC.unityLaunch,
    notes: 'UNITY Android open-platform console — announced June 2013 with Artis / Excite.',
  },
  {
    console_key: 'unity_3_0',
    console_name: 'UNITY 3.0',
    alternative_names: ['Unity 3.0', 'UNITY3', 'Artis UNITY'],
    start_year: 2014,
    end_year: null,
    start_year_approximate: true,
    is_current: false,
    display_order: 70,
    confidence: 'high',
    image_url: IMG('unity30'),
    source_url: SRC.exciteEntertainment,
    notes: 'UNITY 3.0 — later flat-glass UNITY generation used heavily on Artis and late Excite.',
  },
  {
    console_key: 'connect',
    console_name: 'Connect',
    alternative_names: ['Connect Console', 'Technogym Connect'],
    start_year: 2018,
    end_year: null,
    start_year_approximate: true,
    is_current: true,
    display_order: 80,
    confidence: 'medium',
    image_url: IMG('connect'),
    source_url: SRC.consoleCompare,
    notes: 'Connect — mid-tier digital Excite console (capacitive keypad family). Exact intro year approximate (~2018–2019); present on current Excite alongside LIVE.',
  },
  {
    console_key: 'live',
    console_name: 'LIVE',
    alternative_names: ['Live', 'Technogym Live', 'LIVE Console'],
    start_year: 2020,
    end_year: null,
    is_current: true,
    display_order: 90,
    confidence: 'high',
    image_url: IMG('live'),
    source_url: SRC.liveLaunch,
    notes: 'Technogym LIVE platform/console experience — announced July 2020.',
  },
  {
    console_key: 'live_10',
    console_name: 'LIVE 10',
    alternative_names: ['Live 10', 'LIVE10'],
    start_year: 2020,
    end_year: null,
    start_year_approximate: true,
    is_current: true,
    display_order: 100,
    confidence: 'high',
    image_url: IMG('live10'),
    source_url: SRC.liveLaunch,
    notes: 'LIVE 10 size/variant in LIVE family from ~2020. Treated as distinct optional console choice.',
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
  tier = 'base',
  modifier_percent = 0,
  confidence,
  source_url,
  notes,
}) {
  return {
    console_key,
    compatibility_type,
    available_from_year,
    available_to_year,
    from_year_approximate,
    to_year_approximate,
    is_default,
    display_order,
    tier,
    modifier_percent,
    confidence,
    source_url,
    notes,
  }
}

function fixed(consoleKey, from, {
  confidence = 'high',
  source_url,
  notes,
  approximate = false,
  to = null,
  tier = 'base',
  modifier_percent = 0,
} = {}) {
  return [
    row({
      console_key: consoleKey,
      compatibility_type: 'fixed',
      available_from_year: from,
      available_to_year: to,
      from_year_approximate: approximate,
      to_year_approximate: Boolean(to),
      is_default: true,
      display_order: 10,
      tier,
      modifier_percent,
      confidence,
      source_url,
      notes,
    }),
  ]
}

/** Generic Excite modular timeline (LED factory + optional generations). */
export function buildExciteModularMappings() {
  return [
    row({
      console_key: 'led',
      compatibility_type: 'factory',
      available_from_year: 2002,
      from_year_approximate: true,
      is_default: true,
      display_order: 10,
      confidence: 'high',
      source_url: SRC.consoleCompare,
      notes: 'Factory LED across Excite generations.',
    }),
    row({
      console_key: 'visio',
      compatibility_type: 'optional',
      available_from_year: 2005,
      available_to_year: 2007,
      from_year_approximate: true,
      to_year_approximate: true,
      display_order: 40,
      tier: 'mid',
      modifier_percent: 8,
      confidence: 'medium',
      source_url: SRC.fortyYears,
      notes: 'Optional Visio before VisioWeb (2007).',
    }),
    row({
      console_key: 'visio_web',
      compatibility_type: 'optional',
      available_from_year: 2007,
      available_to_year: 2013,
      to_year_approximate: true,
      display_order: 50,
      tier: 'mid',
      modifier_percent: 10,
      confidence: 'high',
      source_url: SRC.fortyYears,
      notes: 'Optional VisioWeb from 2007 until UNITY (~2013).',
    }),
    row({
      console_key: 'unity',
      compatibility_type: 'optional',
      available_from_year: 2013,
      available_to_year: null,
      display_order: 60,
      tier: 'mid',
      modifier_percent: 15,
      confidence: 'high',
      source_url: SRC.unityLaunch,
      notes: 'Optional UNITY from June 2013.',
    }),
    row({
      console_key: 'connect',
      compatibility_type: 'optional',
      available_from_year: 2018,
      available_to_year: null,
      from_year_approximate: true,
      display_order: 70,
      tier: 'mid',
      modifier_percent: 12,
      confidence: 'medium',
      source_url: SRC.consoleCompare,
      notes: 'Optional Connect on later Excite. Intro year approximate.',
    }),
    row({
      console_key: 'live',
      compatibility_type: 'optional',
      available_from_year: 2020,
      available_to_year: null,
      display_order: 80,
      tier: 'premium',
      modifier_percent: 24,
      confidence: 'high',
      source_url: SRC.liveLaunch,
      notes: 'Optional LIVE from July 2020 platform launch.',
    }),
    row({
      console_key: 'live_10',
      compatibility_type: 'optional',
      available_from_year: 2020,
      available_to_year: null,
      from_year_approximate: true,
      display_order: 90,
      tier: 'premium',
      modifier_percent: 26,
      confidence: 'high',
      source_url: SRC.liveLaunch,
      notes: 'Optional LIVE 10 variant from ~2020.',
    }),
  ]
}

export function buildArtisMappings() {
  return [
    row({
      console_key: 'unity_3_0',
      compatibility_type: 'factory',
      available_from_year: 2013,
      from_year_approximate: true,
      is_default: true,
      display_order: 10,
      tier: 'premium',
      modifier_percent: 20,
      confidence: 'high',
      source_url: SRC.milestones,
      notes: 'Artis launched with UNITY (2013); UNITY 3.0 is the primary Artis console generation in catalogue imagery.',
    }),
    row({
      console_key: 'live',
      compatibility_type: 'optional',
      available_from_year: 2020,
      display_order: 20,
      tier: 'premium',
      modifier_percent: 24,
      confidence: 'high',
      source_url: SRC.liveLaunch,
      notes: 'Optional LIVE on Artis from 2020.',
    }),
    row({
      console_key: 'live_10',
      compatibility_type: 'optional',
      available_from_year: 2020,
      from_year_approximate: true,
      display_order: 30,
      tier: 'premium',
      modifier_percent: 26,
      confidence: 'high',
      source_url: SRC.liveLaunch,
      notes: 'Optional LIVE 10 on Artis from ~2020.',
    }),
  ]
}

export function buildSkillRunMappings() {
  return [
    row({
      console_key: 'unity',
      compatibility_type: 'factory',
      available_from_year: 2016,
      from_year_approximate: true,
      is_default: true,
      display_order: 10,
      tier: 'mid',
      modifier_percent: 15,
      confidence: 'medium',
      source_url: SRC.consoleCompare,
      notes: 'Skill Run typically ships with UNITY-class console. Medium: confirm exact intro year per SKU.',
    }),
    row({
      console_key: 'live',
      compatibility_type: 'optional',
      available_from_year: 2020,
      display_order: 20,
      tier: 'premium',
      modifier_percent: 24,
      confidence: 'medium',
      source_url: SRC.liveLaunch,
      notes: 'Optional LIVE on later Skill Run. Medium pending sell-sheet confirmation.',
    }),
    row({
      console_key: 'live_10',
      compatibility_type: 'optional',
      available_from_year: 2020,
      from_year_approximate: true,
      display_order: 30,
      tier: 'premium',
      modifier_percent: 26,
      confidence: 'medium',
      source_url: SRC.liveLaunch,
      notes: 'Optional LIVE 10 on later Skill Run. Medium pending sell-sheet confirmation.',
    }),
  ]
}

function haystack(product) {
  return [
    product?.canonical_product_key,
    product?.canonical_product_name,
    product?.product_family,
    product?.model,
  ].map((value) => String(value ?? '').toLowerCase()).join(' ')
}

export function classifyTechnogymConsoleProduct(product) {
  const text = haystack(product)

  if (/\bgroup\s*cycle\b|\bindoor\s+bike\b|\bspin\b/.test(text)) {
    return { kind: 'unmapped', reason: 'Group Cycle / indoor cycle — no commercial console selector' }
  }
  if (/\bpersonal\b|\bforma\b|\bmyrun\b|\bmyline\b|\belement\s*\+/.test(text) && !/\bartis\b|\bexcite\b|\bskill\b/.test(text)) {
    // Personal/Forma/Myrun residential — but "RUN PERSONAL VISIO" is Excite personal visio variant
    if (!/\bvisio\b|\bexcite\b/.test(text)) {
      return { kind: 'unmapped', reason: 'Residential / home line — not commercial Excite matrix' }
    }
  }
  if (/\bcrunch\s*bench\b|\bab-?crunch\b|\bcrossover\s+cables\b/.test(text)) {
    return { kind: 'unmapped', reason: 'Strength / non-cardio misclassified product — no console map' }
  }
  if (/\bskillmill\b|\bskill\s*mill\b/.test(text)) {
    return { kind: 'unmapped', reason: 'Skillmill — console policy unclear; leave unmapped pending OEM' }
  }
  if (/\bartis\b/.test(text)) return { kind: 'artis' }
  if (/\bskill\s*run\b|\bskill-run\b/.test(text) || (/\bskill\b/.test(text) && /\brun\b/.test(text))) {
    return { kind: 'skill_run' }
  }

  // Named-console SKUs → fixed
  if (/\bvisio\s*web\b|\bvisioweb\b/.test(text)) {
    return { kind: 'fixed', console_key: 'visio_web', from: 2007, confidence: 'high', source_url: SRC.fortyYears }
  }
  // DIGITAL TV / DIGITAL model names → VisioWeb (TV / Digital TV masters removed).
  if (/\bdigital\s*tv\b|\bdigital\s*tvifi\b/.test(text)) {
    return {
      kind: 'fixed',
      console_key: 'visio_web',
      from: 2007,
      approximate: true,
      confidence: 'medium',
      source_url: SRC.consoleCompare,
      notes: 'Named DIGITAL TV SKU — mapped to VisioWeb after TV/Digital TV masters were removed.',
    }
  }
  if (/\bdigital\b/.test(text) && !/\bdigital\s*tv\b/.test(text)) {
    return {
      kind: 'fixed',
      console_key: 'visio_web',
      from: 2007,
      approximate: true,
      confidence: 'medium',
      source_url: SRC.consoleCompare,
      notes: 'Model encodes DIGITAL — mapped to VisioWeb after Digital TV master was removed.',
    }
  }
  if (/\bvisio\b/.test(text) && !/\bvisio\s*web\b|\bvisioweb\b/.test(text)) {
    return {
      kind: 'fixed',
      console_key: 'visio',
      from: 2005,
      approximate: true,
      confidence: 'medium',
      source_url: SRC.fortyYears,
    }
  }
  if (/\bunity\s*3/.test(text)) {
    return {
      kind: 'fixed',
      console_key: 'unity_3_0',
      from: 2014,
      approximate: true,
      confidence: 'high',
      source_url: SRC.exciteEntertainment,
    }
  }
  if (/\bunity\b/.test(text)) {
    return {
      kind: 'fixed',
      console_key: 'unity',
      from: 2013,
      confidence: 'high',
      source_url: SRC.unityLaunch,
    }
  }

  if (/\bexcite\b|\bjog\s*now\b|\brun\s*now\b|\bsynchro\b|\bvario\b|\bcrossover\b|\brecline\b|\bclimb\b|\bwave\b/.test(text)
    || /\b700i\b|\b500i\b|\b900i\b|\b1000\b/.test(text)) {
    return { kind: 'excite_modular' }
  }

  // Bare model names that are Excite family in catalogue (RUN NOW, VARIO, SYNCHRO, RECLINE, Climb)
  if (/^(technogym-)?(treadmill|cross-trainer|recumbent|upright|stepper|climber)/.test(String(product?.canonical_product_key ?? ''))
    && !/\bforma\b|\bpersonal\b|\bgroup\b|\bartis\b|\bskill\b|\belement\b|\bselection\b|\bmyline\b/.test(text)) {
    return { kind: 'excite_modular' }
  }

  return { kind: 'unmapped', reason: 'No confident commercial console family match' }
}

/**
 * Build compat map from approved cardio products.
 */
export function buildTechnogymCompatByProductKey(products) {
  const byKey = {}
  for (const product of products ?? []) {
    const key = product.canonical_product_key
    if (!key) continue
    const classified = classifyTechnogymConsoleProduct(product)

    if (classified.kind === 'unmapped') continue
    if (classified.kind === 'artis') {
      byKey[key] = buildArtisMappings()
      continue
    }
    if (classified.kind === 'skill_run') {
      byKey[key] = buildSkillRunMappings()
      continue
    }
    if (classified.kind === 'excite_modular') {
      byKey[key] = buildExciteModularMappings()
      continue
    }
    if (classified.kind === 'fixed') {
      byKey[key] = fixed(classified.console_key, classified.from, {
        confidence: classified.confidence,
        source_url: classified.source_url,
        approximate: classified.approximate,
        notes:
          classified.notes
          || `Named SKU encodes ${classified.console_key} — fixed console identity; selector hidden.`,
      })
    }
  }
  return byKey
}

export const TECHNOGYM_EXPLICITLY_UNMAPPED_PATTERNS = [
  'Group Cycle',
  'Forma / Personal / Myrun residential',
  'Skillmill',
  'Strength misclassified (benches / cable stations)',
]

export const TECHNOGYM_UNRESOLVED_PRODUCTS = [
  {
    name: 'Skillmill',
    key: 'technogym-non-motorised-treadmill-skill-line-skillmill',
    reason: 'Console/display policy unclear — not auto-mapped.',
  },
  {
    name: 'Connect intro year',
    key: null,
    reason: 'Connect mapped from ~2018 approximate — confirm OEM intro date.',
  },
  {
    name: 'TV / Visio exact cutovers',
    key: null,
    reason: 'Early TV/Visio years marked approximate/medium where OEM month not found.',
  },
]

/** Empty static map — seed builds from DB products via buildTechnogymCompatByProductKey. */
export const TECHNOGYM_COMPAT_BY_PRODUCT_KEY = {}
