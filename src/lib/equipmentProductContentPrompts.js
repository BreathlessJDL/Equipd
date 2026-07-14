import { isCardioEquipmentProduct, isStepperCardioProductIdentity } from './equipmentCardio.js'
import { normalizeEquipmentTypeKey } from './equipmentTypeRepair.js'
import {
  CONTENT_USAGE_SEGMENT,
  resolveProductContentUsageSegment,
} from './equipmentProductContentGenerateMissing.js'

function normalizeText(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim()
}

export const PRODUCT_CONTENT_CATEGORIES = {
  CARDIO: 'cardio',
  SELECTORISED_STRENGTH: 'selectorised_strength',
  PLATE_LOADED: 'plate_loaded',
  FUNCTIONAL: 'functional',
  BENCHES_RACKS: 'benches_racks_accessories',
}

export const OVERVIEW_WORD_MIN = 55
export const OVERVIEW_WORD_MAX = 140
export const OVERVIEW_WORD_PREFERRED_MIN = 70
export const OVERVIEW_WORD_PREFERRED_MAX = 120

const PLATE_LOADED_EQUIPMENT_TYPES = new Set([
  'plate loaded strength',
])

const FUNCTIONAL_EQUIPMENT_TYPES = new Set([
  'functional trainer',
  'cable machine',
  'cable / functional trainer',
  'multi gym',
])

const BENCHES_RACKS_EQUIPMENT_TYPES = new Set([
  'bench',
  'rack',
  'rack/smith machine',
  'smith machine',
  'accessories',
  'accessory',
  'free weights',
])

const SELECTORISED_EQUIPMENT_TYPES = new Set([
  'selectorised strength',
  'chest press',
  'shoulder press',
  'leg extension',
  'leg curl',
  'lat pulldown',
  'abdominal machine',
  'biceps curl',
  'triceps machine',
  'glute machine',
  'hip abductor/adductor',
  'back extension',
  'row machine',
  'strength machine',
  'leg press',
])

const PLATE_LOADED_TEXT_PATTERNS = [
  /\bplate\s+loaded\b/i,
  /\bplate-loaded\b/i,
  /\bhammer\s+strength\b/i,
  /\bmts\b/i,
]

const INTELLIGENCE_CATEGORY_HINTS = {
  cardio: PRODUCT_CONTENT_CATEGORIES.CARDIO,
  'selectorised strength': PRODUCT_CONTENT_CATEGORIES.SELECTORISED_STRENGTH,
  'plate loaded strength': PRODUCT_CONTENT_CATEGORIES.PLATE_LOADED,
  'plate loaded': PRODUCT_CONTENT_CATEGORIES.PLATE_LOADED,
  functional: PRODUCT_CONTENT_CATEGORIES.FUNCTIONAL,
  'cable / functional trainer': PRODUCT_CONTENT_CATEGORIES.FUNCTIONAL,
  benches: PRODUCT_CONTENT_CATEGORIES.BENCHES_RACKS,
  racks: PRODUCT_CONTENT_CATEGORIES.BENCHES_RACKS,
  accessories: PRODUCT_CONTENT_CATEGORIES.BENCHES_RACKS,
}

function buildProductHaystack(product = {}) {
  return [
    product.equipment_type,
    product.model,
    product.product_family,
    product.canonical_product_name,
    product.brand,
  ].map(normalizeText).join(' ').toLowerCase()
}

/**
 * Technogym Crossover / Excite Crossover is a commercial cardio cross trainer
 * (elliptical). LLMs often misread "Crossover" as a cable crossover strength machine.
 */
export const TECHNOGYM_CROSSOVER_CARDIO_PROMPT_CONTEXT = [
  '## Protected product identity (critical)',
  '',
  'This product is a commercial cardio cross trainer (elliptical).',
  'It is NOT a cable crossover, functional trainer or strength machine.',
  'Never describe pulleys, cables, weight stacks, selectorised resistance, pin-loaded mechanisms or strength exercises.',
  'Describe it only as commercial cardio / cross trainer / elliptical equipment.',
].join('\n')

/**
 * Detect Technogym Crossover cardio products (not cable-crossover strength machines).
 * Matches: Technogym Crossover, Technogym Excite Crossover, Excite Crossover.
 * Excludes Selection/Element cable machines and models named "Crossover Cables".
 */
export function isTechnogymCrossoverCardioProduct(product = {}) {
  const brand = normalizeText(product?.brand).toLowerCase()
  const model = normalizeText(product?.model).toLowerCase()
  const family = normalizeText(product?.product_family).toLowerCase()
  const canonical = normalizeText(product?.canonical_product_name).toLowerCase()
  const equipmentType = normalizeText(product?.equipment_type).toLowerCase()
  const haystack = [brand, family, model, canonical].filter(Boolean).join(' ')

  if (!haystack) return false

  // Exclude cable-crossover strength / functional machines
  if (/\bcable\s+crossover\b/i.test(haystack)) return false
  if (/\bcrossover\s+cables?\b/i.test(model) || /\bcrossover\s+cables?\b/i.test(haystack)) return false
  if (/\bselection\b/i.test(family) || /\bselection\b/i.test(canonical)) return false
  if (/\belement\b/i.test(family) || /\belement\b/i.test(canonical)) return false
  if (/\bcable\s+machine\b/i.test(equipmentType) && !/\bexcite\b/i.test(haystack)) return false

  const isTechnogymBrand = brand === 'technogym' || /\btechnogym\b/i.test(haystack)
  if (!isTechnogymBrand && !/\bexcite\s*\+?\s*crossover\b/i.test(haystack)) return false
  if (!/\bcrossover\b/i.test(haystack)) return false

  // Excite Crossover cardio (Excite, Excite +, Excite 2016, etc.) — even if miscategorised
  if (/\bexcite\b/i.test(haystack)) return true

  // Bare Technogym Crossover when typed as cardio, or exact Technogym Crossover naming
  if (/cross\s*trainer|elliptical|crosstrainer/i.test(equipmentType)) return true
  if (/^technogym\s+crossover$/i.test(canonical) || /^crossover$/i.test(model)) return true

  return false
}

function matchesPlateLoadedText(haystack) {
  return PLATE_LOADED_TEXT_PATTERNS.some((pattern) => pattern.test(haystack))
}

function resolveIntelligenceCategoryHint(intelligenceRows = []) {
  for (const row of intelligenceRows) {
    const key = normalizeEquipmentTypeKey(row?.category)
    if (INTELLIGENCE_CATEGORY_HINTS[key]) {
      return INTELLIGENCE_CATEGORY_HINTS[key]
    }
  }
  return null
}

export function resolveProductContentCategory(product, { intelligenceRows = [] } = {}) {
  const equipmentType = normalizeEquipmentTypeKey(product?.equipment_type)
  const haystack = buildProductHaystack(product)
  const intelligenceHint = resolveIntelligenceCategoryHint(intelligenceRows)

  // Force cardio for Technogym Crossover before strength/cable heuristics can misroute it.
  if (isTechnogymCrossoverCardioProduct(product)) {
    return PRODUCT_CONTENT_CATEGORIES.CARDIO
  }

  if (isStepperCardioProductIdentity(product) || isCardioEquipmentProduct(product)) {
    return PRODUCT_CONTENT_CATEGORIES.CARDIO
  }

  if (
    PLATE_LOADED_EQUIPMENT_TYPES.has(equipmentType)
    || matchesPlateLoadedText(haystack)
  ) {
    return PRODUCT_CONTENT_CATEGORIES.PLATE_LOADED
  }

  if (FUNCTIONAL_EQUIPMENT_TYPES.has(equipmentType)) {
    return PRODUCT_CONTENT_CATEGORIES.FUNCTIONAL
  }

  if (BENCHES_RACKS_EQUIPMENT_TYPES.has(equipmentType)) {
    return PRODUCT_CONTENT_CATEGORIES.BENCHES_RACKS
  }

  if (SELECTORISED_EQUIPMENT_TYPES.has(equipmentType)) {
    return PRODUCT_CONTENT_CATEGORIES.SELECTORISED_STRENGTH
  }

  if (intelligenceHint) {
    return intelligenceHint
  }

  if (/\bcable\b|\bfunctional\b|\bmulti\s+gym\b/i.test(haystack)) {
    return PRODUCT_CONTENT_CATEGORIES.FUNCTIONAL
  }

  if (/\bbench\b|\brack\b|\bsmith\b|\baccessory\b|\baccessories\b/i.test(haystack)) {
    return PRODUCT_CONTENT_CATEGORIES.BENCHES_RACKS
  }

  if (
    /\bpress\b|\bcurl\b|\bextension\b|\bpulldown\b|\babdominal\b|\bglute\b/i.test(haystack)
  ) {
    return PRODUCT_CONTENT_CATEGORIES.SELECTORISED_STRENGTH
  }

  // Last-resort cardio identity from equipment_type / name before the strength default.
  if (
    /\btreadmill\b|\bcross\s*trainer\b|\belliptical\b|\bindoor\s+bike\b|\bexercise\s+bike\b|\bspin\s*bike\b|\bstudio\s+cycle\b|\bindoor\s+cycle\b|\brower\b|\browing\b|\bstepper\b|\bstair\s*climber\b/i
      .test(haystack)
  ) {
    return PRODUCT_CONTENT_CATEGORIES.CARDIO
  }

  return PRODUCT_CONTENT_CATEGORIES.SELECTORISED_STRENGTH
}

export function sourceAllowsConsoleMentions(sourcePayload = null) {
  const category = sourcePayload?.equipment_category
  const consoleOptions = sourcePayload?.console_options ?? []
  return category === PRODUCT_CONTENT_CATEGORIES.CARDIO && consoleOptions.length > 0
}

const SHARED_CONTENT_RULES = `You write concise product overviews for Equipd, a UK fitness equipment valuation platform.

Tone: professional fitness catalogue / buyer guide copy — factual and specific.

You are an experienced fitness equipment specialist. You are NOT an AI inventing unique copy, a salesperson, or a manufacturer writing hype.

## Length (critical)

- Preferred: 70–120 words
- Absolute minimum: 55 words
- Absolute maximum: 140 words
- One or two short paragraphs are both fine. Do not force two paragraphs.
- Stop once useful known facts are covered. Do not add filler to reach a word count.
- If there are only four useful facts, write four useful sentences.

## Family consistency

Do NOT force every overview to be unique. Products in the same family should share most wording; only change equipment-specific terms (model name, movement type).

## Source data rules

- Use only facts in the provided JSON source payload.
- Do not invent specifications, mechanics, features, biomechanics, warranties, pricing, subscription services, touchscreen sizes, incline ranges, resistance levels, or connectivity.
- If a field is null or missing, omit it — do not guess.
- Prefer "manufactured from around {year}" when a start/baseline year is known.
- Do not claim continuous production ("in production since", "manufactured since") unless production_end_year is present and supports that claim.
- Do not invent a production end year.
- Mention original_base_price only when present. Never invent RRP or valuation figures.
- Mention consoles only when equipment_category is cardio AND console_options is a non-empty array.

## Usage segment (critical)

Check source payload field usage_segment:

- commercial: commercial / club equipment wording is allowed when supported by identity.
- home_use: this is consumer / home connected fitness equipment. Do NOT claim commercial construction, commercial gym use, gym-floor suitability, continuous club use, selectorised commercial mechanics, heavy-duty commercial frames, or commercial servicing expectations unless that exact wording is present in source data (it normally will not be). Describe home fitness / connected fitness positioning accurately from known identity only.

## Overview structure

Usually cover, briefly:

1. Identification — brand, model, family/range, equipment category, manufacture year if known
2. Product context — usage segment positioning; intended exercise/movement where obvious from equipment_type; known console names for cardio only; estimated original RRP if available
3. Used-value context — manufacture year, condition; console configuration only for cardio with console_options

Do not:
- Mention Equipd
- Explain how buyers make decisions
- Restate every field shown elsewhere on the page
- Pad with generic fitness filler

## Valuation factors by category

Cardio with console_options:
- Manufacture year, condition, console configuration

Selectorised / plate-loaded / functional / benches / racks / accessories:
- Manufacture year, overall condition, exact model and series, original RRP
- Completeness only if supported by source data
- NEVER mention console configuration or consoles

Home-use cardio (usage_segment = home_use):
- Manufacture year, condition, model identity
- Connected fitness / subscription features only if present in source data
- Never invent Peloton App, iFIT, or screen specifications

## Banned filler (never use)

focusing on functionality, effective workouts, targeted solution, accommodate various users,
diverse needs of users, meet the demands, known for its reliability, known for its performance,
reliable platform, ease of operation, user engagement, ensuring that,
understanding these elements is essential, collectively contribute, make informed evaluations,
assessing the machine's worth, potential buyers can evaluate, based on its specifications and condition,
informed decisions, valuable insights, robust design, practical choice, reliable option,
user-friendly, regular use, reliability and performance

Also never use marketing hype: industry-leading, world-class, best-in-class, revolutionary,
cutting-edge, state-of-the-art, award-winning, unmatched, unrivalled

Acceptable natural language (commercial segment):
- commercial treadmill, commercial strength machine, premium commercial equipment
- part of the Integrity Series, part of the Element range
- manufactured from around 2012
- designed for commercial fitness facilities

Acceptable natural language (home_use segment):
- home treadmill, home exercise bike, connected home fitness equipment
- manufactured from around 2014
- popular home connected fitness model (only if identity supports it — do not invent popularity claims beyond model identity)

## Desired tone examples

Selectorised (commercial):
"The Technogym Element Chest Press is a commercial selectorised strength machine from the Element range, manufactured from around 2012. It was developed for chest-focused strength training and formed part of Technogym’s wider Element circuit. Its estimated original RRP was approximately £4,995. The manufacture year, exact model and overall condition are the main factors affecting its current used market value."

Cardio with consoles (commercial):
"The Life Fitness Integrity Series Treadmill is a premium commercial treadmill manufactured from around 2017. It forms part of the Integrity cardio range and was available with several console configurations, including Integrity SL, Integrity C, ST, Discover SE3 HD and Discover SE4. The estimated original RRP was approximately £20,100. Manufacture year, condition and console configuration can all significantly affect its current used value."

Home bike (home_use):
"The Peloton Bike is a home indoor exercise bike manufactured from around 2014. It is a connected home fitness product identified by its Bike model line. Its estimated original RRP was approximately £1,500. Manufacture year and overall condition are the main factors affecting its current used market value."

## seo_title (max 60 characters)

"{Brand} {Model} used value guide" style. Include brand and model.

## seo_meta_description (120–160 characters)

Product name, RRP if known, manufacture year if known, valuation context. Factual.

## faqs (2–4 items)

Useful FAQs grounded in source data only. Console FAQs only when console_options is non-empty. Never write "None recorded" console answers.

## Output format

Respond with JSON only:
{
  "overview_text": "string",
  "seo_title": "string",
  "seo_meta_description": "string",
  "faqs": [{ "question": "string", "answer": "string" }]
}`

const HOME_USE_CONTENT_RULES = `## Home-use segment rules (mandatory)

usage_segment is home_use.

Do NOT claim:
- commercial construction
- commercial gym use / club use
- gym-floor suitability
- selectorised commercial strength mechanics (unless equipment_type truly is selectorised strength)
- heavy-duty commercial frames
- commercial servicing expectations
- continuous high-traffic club use

Do describe:
- home fitness equipment identity from brand/model/type
- connected fitness only when source data supports it
- valuation factors from known year / RRP / condition context only

Never invent subscription plans, screen sizes, incline ranges, resistance specs, or apps.`

const CATEGORY_OVERVIEW_GUIDANCE = {
  [PRODUCT_CONTENT_CATEGORIES.CARDIO]: `## Category: Cardio

Write a concise cardio overview (preferred 70–120 words; max 140).

- Identify brand, model, family/series, and cardio type from equipment_type exactly.
- Ground identity in the provided fields: brand, product_family, model, equipment_type, usage_segment.
- If equipment_type is an indoor bike / exercise bike / studio cycle / indoor cycle: describe it as a home indoor cycling bike when usage_segment is home_use. Do NOT describe bikes as strength equipment, selectorised machines, weight-stack products, cable machines, multi-gyms, cross trainers, or treadmills.
- If equipment_type is a treadmill: do not describe it as a bike, rower, or strength machine.
- If equipment_type is a rower / rowing machine: do not describe it as a treadmill, bike, or cross trainer.
- If equipment_type is a cross trainer / elliptical: do not describe it as a cable crossover or strength crossover.
- If equipment_type is a stepper / stair climber / climber: describe it as cardio stair / step equipment. Do NOT describe steppers as selectorised strength, pin-loaded, plate-loaded, weight-stack or strength-station machines.
- Respect usage_segment for commercial vs home wording.
- Use "manufactured from around {year}" when a year is known.
- List console names only if console_options is non-empty in source.
- Mention estimated original RRP if present. If original_base_price is null, do not invent an RRP.
- Close with used-value factors: manufacture year, condition, and console configuration only when consoles exist.
- Do not invent treadmill features, resistance levels, screen sizes, apps, subscriptions, or running surfaces.`,

  [PRODUCT_CONTENT_CATEGORIES.SELECTORISED_STRENGTH]: `## Category: Selectorised strength

Write a concise selectorised strength overview (preferred 70–120 words; max 140).

- Identify as selectorised strength from the known family/range.
- State the obvious movement from the equipment type (e.g. chest press, shoulder press) without inventing biomechanics.
- Use "manufactured from around {year}" when known.
- Mention estimated original RRP if present.
- Used-value factors: manufacture year, exact model/series, overall condition. Never mention consoles.
- Reuse family wording across Element / similar ranges — only the movement name changes.
- Only use commercial facility wording when usage_segment is commercial.`,

  [PRODUCT_CONTENT_CATEGORIES.PLATE_LOADED]: `## Category: Plate-loaded strength

Write a concise plate-loaded overview (preferred 70–120 words; max 140).

- Identify brand, model, family, plate-loaded positioning.
- Manufacture year and RRP if known.
- Used-value factors: manufacture year, exact model/series, condition. Never mention consoles.
- Do not invent plate capacities or frame specs.
- Only use commercial facility wording when usage_segment is commercial.`,

  [PRODUCT_CONTENT_CATEGORIES.FUNCTIONAL]: `## Category: Functional / cable equipment

Write a concise functional/cable overview (preferred 70–120 words; max 140).

- Identify brand, model, family, cable/functional positioning.
- Manufacture year and RRP if known.
- Used-value factors: manufacture year, exact model/series, condition. Never mention consoles.
- Do not invent pulley layouts or attachments.
- Only use commercial facility wording when usage_segment is commercial.`,

  [PRODUCT_CONTENT_CATEGORIES.BENCHES_RACKS]: `## Category: Benches, racks and accessories

Write a concise free-weight area overview (preferred 70–120 words; max 140).

- Identify brand, model, family, bench/rack/accessory positioning.
- Manufacture year and RRP if known.
- Used-value factors: manufacture year, exact model/series, condition. Never mention consoles.
- Only use commercial facility wording when usage_segment is commercial.`,
}

export function buildProductContentSystemPrompt(category, { sourcePayload = null } = {}) {
  const resolvedCategory = CATEGORY_OVERVIEW_GUIDANCE[category]
    ? category
    : PRODUCT_CONTENT_CATEGORIES.SELECTORISED_STRENGTH

  const usageSegment = sourcePayload?.usage_segment
    || resolveProductContentUsageSegment(sourcePayload ?? {})

  const parts = [
    SHARED_CONTENT_RULES,
    '',
    CATEGORY_OVERVIEW_GUIDANCE[resolvedCategory],
  ]

  if (usageSegment === CONTENT_USAGE_SEGMENT.HOME_USE) {
    parts.push('', HOME_USE_CONTENT_RULES)
  }

  if (isTechnogymCrossoverCardioProduct(sourcePayload ?? {})) {
    parts.push('', TECHNOGYM_CROSSOVER_CARDIO_PROMPT_CONTEXT)
  }

  return parts.join('\n')
}

export function buildProductContentUserPrompt(sourcePayload, category = sourcePayload?.equipment_category) {
  const resolvedCategory = category || PRODUCT_CONTENT_CATEGORIES.SELECTORISED_STRENGTH
  const allowsConsoles = sourceAllowsConsoleMentions({
    ...sourcePayload,
    equipment_category: resolvedCategory,
  })
  const protectedCrossover = isTechnogymCrossoverCardioProduct(sourcePayload ?? {})

  return [
    `Write a concise catalogue-style overview for this ${resolvedCategory.replace(/_/g, ' ')} product.`,
    '',
    ...(protectedCrossover
      ? [
          TECHNOGYM_CROSSOVER_CARDIO_PROMPT_CONTEXT,
          '',
        ]
      : []),
    'Preferred length about 80–100 words (absolute range 55–140). Stop when useful facts are covered — no filler.',
    'If source data is sparse, still reach at least 55 words using brand, family, commercial positioning, known year/RRP and valuation factors only.',
    'Keep wording consistent with other products in the same family.',
    'Do not mention Equipd in overview_text.',
    allowsConsoles
      ? 'Consoles may be mentioned because this is cardio with console_options in source.'
      : 'Do not mention consoles or console configuration for this product.',
    '',
    'Source data (JSON):',
    JSON.stringify(sourcePayload, null, 2),
  ].join('\n')
}
