/**
 * Product-image identity extraction and conflict checks.
 * Exact model/family identity outranks brand, equipment type, and source quality.
 */

export const MATRIX_MODERN_FAMILIES = Object.freeze([
  { id: 'onyx', labels: ['onyx', 'onyx collection'], generation: 'modern' },
  { id: 'lifestyle', labels: ['lifestyle', 'lifestyle series'], generation: 'modern' },
  { id: 'endurance', labels: ['endurance', 'endurance series'], generation: 'modern' },
  { id: 'performance_plus', labels: ['performance plus', 'performance+'], generation: 'modern' },
  { id: 'performance', labels: ['performance series', 'performance'], generation: 'modern' },
])

export const MATRIX_DIGIT_MODEL_CODES = Object.freeze([
  'A3x', 'A5x', 'A7x', 'A7xe',
  'E3x', 'E5x', 'E7x', 'E7xe',
  'U3x', 'U5x', 'U7x', 'U7xe',
  'R3x', 'R5x', 'R7x', 'R7xe',
  'C3x', 'C5x', 'C7x', 'C7xe',
  'T1', 'T3', 'T5', 'T7', 'T50', 'T70',
  'S3x', 'S5x', 'S7x',
  'H3x', 'H5x', 'H7x',
])

/** Explicit same-product aliases only. Empty by default — never invent aliases. */
export const MATRIX_IDENTITY_ALIASES = Object.freeze({
  // Example only if ever needed: 'a5': ['a5x'] — do NOT add without evidence
})

export const LIFE_FITNESS_SERIES = Object.freeze([
  { id: 'integrity', labels: ['integrity', 'integrity series'] },
  { id: 'elevation', labels: ['elevation', 'elevation series'] },
  { id: 'silver_line', labels: ['silver line', 'silverline', 'silver series'] },
  { id: 'hammer_strength', labels: ['hammer strength'] },
  { id: 'pro1', labels: ['pro 1', 'pro1'] },
])

export const TECHNOGYM_LINES = Object.freeze([
  // Specific generations first — identity-sensitive; do not collapse across these.
  { id: 'selection_personal', labels: ['selection personal', 'selection-personal'] },
  { id: 'selection_pro', labels: ['selection pro', 'selection-pro'] },
  { id: 'selection_700', labels: ['selection 700', 'selection-700', 'selection700'] },
  { id: 'selection_900', labels: ['selection 900', 'selection-900', 'selection900'] },
  { id: 'selection_line', labels: ['selection line', 'selection-line', 'selectionline'] },
  { id: 'biostrength', labels: ['biostrength', 'bio strength'] },
  { id: 'pure_strength', labels: ['pure strength', 'pure-strength', 'purestrength'] },
  { id: 'skillrun', labels: ['skillrun', 'skill run'] },
  { id: 'skillrow', labels: ['skillrow', 'skill row'] },
  { id: 'skillbike', labels: ['skillbike', 'skill bike'] },
  { id: 'skillmill', labels: ['skillmill', 'skill mill'] },
  { id: 'skill_line', labels: ['skill line', 'skillline'] },
  { id: 'excite_plus', labels: ['excite+', 'excite plus'] },
  { id: 'excite', labels: ['excite'] },
  { id: 'artis', labels: ['artis'] },
  { id: 'element_plus', labels: ['element+', 'element plus'] },
  { id: 'element', labels: ['element'] },
  { id: 'kinesis', labels: ['kinesis'] },
  { id: 'unity', labels: ['unity'] },
  { id: 'personal', labels: ['personal'] },
  { id: 'strength', labels: ['strength'] },
  // Generic "selection" last — only when no specific generation/family was found.
  { id: 'selection', labels: ['selection'] },
])

/** Generations that must never be treated as interchangeable without explicit proof. */
export const TECHNOGYM_IDENTITY_SENSITIVE_LINES = Object.freeze([
  'selection_personal',
  'selection_pro',
  'selection_700',
  'selection_900',
  'selection_line',
  'selection',
  'biostrength',
  'pure_strength',
  'personal',
  'unity',
  'strength',
  'excite',
  'excite_plus',
  'artis',
  'element',
  'element_plus',
  'skill_line',
  'skillrun',
  'skillrow',
  'skillbike',
  'skillmill',
  'kinesis',
])

export const PRECOR_SERIES = Object.freeze([
  { id: 'discovery', labels: ['discovery', 'discovery series', 'discover series', 'discover-series', 'dbr', 'dpl', 'dsl'] },
  { id: 'experience', labels: ['experience', 'experience series'] },
  { id: 'icarian', labels: ['icarian'] },
  { id: 'vitality', labels: ['vitality', 's-line', 's line', 's-line/vitality', 's-line vitality', 's line vitality'] },
  { id: 'resolute', labels: ['resolute', 'resolute series'] },
  { id: 'c_line', labels: ['c-line', 'c line', 'c-line strength'] },
])

/** Model labels too generic to prove exact product identity alone. */
const GENERIC_MODEL_IDENTITY_TOKENS = Object.freeze(new Set([
  'seated', 'prone', 'flat', 'glute', 'converging', 'diverging', 'olympic',
  'adjustable', 'multi', 'press', 'curl', 'extension', 'row', 'pull',
  'crunch', 'raise', 'fly', 'hip', 'leg', 'arm', 'chest', 'back', 'shoulder',
  'abdominal', 'triceps', 'biceps', 'lat', 'pec', 'calf', 'torso', 'rotary',
  'dip', 'chin', 'assist', 'rack', 'bench', 'trainer',
]))

export const PULSE_SERIES = Object.freeze([
  { id: 'classic', labels: ['classic', 'classic series', 'classic strength'] },
  { id: 'premium', labels: ['premium', 'premium series', 'premium strength'] },
  { id: 'club_line', labels: ['club line', 'club-line', 'clubline'] },
  { id: 'series_2', labels: ['series 2', 'series2', 'series-2'] },
  { id: 'series_3', labels: ['series 3', 'series3', 'series-3'] },
  // Strength G/H ranges only — do not encode cardio SKUs (220G/240G) here.
  { id: 'g_range', labels: ['g-range', 'g range', 'g-range strength', 'g series', 'g-series', 'g strength'] },
  { id: 'h_range', labels: ['h-range', 'h range', 'h-range strength', 'h series', 'h-series', 'h strength'] },
  { id: 'f_st', labels: ['f-st', 'fst', 'f st'] },
  { id: 'fusion', labels: ['fusion'] },
])

/**
 * Verified same-product naming aliases for Pulse (official site vs catalogue).
 * Keys and values are compact identity forms (lowercase alphanumeric).
 */
export const PULSE_PRODUCT_NAME_ALIASES = Object.freeze({
  ucycle: ['fusionucycle', 'uprightcycle', 'uprightbike'],
  rcycle: ['fusionrcycle', 'recumbentcycle', 'recumbentbike'],
  xtrainer: ['fusionxtrainer', 'fusionxtrain', 'ellipticaltrainer', 'xtrain'],
  ltrain: ['fusionltrain', 'lateraltrainer'],
  fusionrun: ['fusionruntreadmill', 'runtreadmill'],
  fusionstep: ['independentstepper', 'stepindependentstepper', 'standingseatedstepper'],
  pacestepper: ['pacestep', 'pacest'],
  pursuituprightcycle: ['pursuitupright', 'pursuitcycle', 'pursuit'],
  performrecumbentcycle: ['performrecumbent', 'performcycle', 'perform'],
  ascentlowimpact: ['ascenttreadmill', 'ascentlow', 'ascent'],
  extremeellipticaltrainer: ['extremeelliptical', 'extreme'],
})

/** Catalogue H-range maps onto current Pulse site Classic / Club Line / Premium pages. */
export const PULSE_SERIES_EQUIVALENCE = Object.freeze({
  h_range: Object.freeze(['h_range', 'club_line', 'classic', 'premium']),
})

/** Cardio base frames — these are model codes, not G-range strength. */
const PULSE_CARDIO_BASE_CODES = Object.freeze(new Set([
  '220G', '240G', '250G', '260G', '270G', '280G',
  '220F', '220FST', '240F', '240FST', '250F', '250FST', '260F', '260FST', '280F', '280FST',
]))

/**
 * Pulse Fitness model / SKU tokens (220G, 240G, F-ST, strength 305G/599H, etc.).
 */
function extractPulseModelCodes(text) {
  const found = []
  const value = String(text ?? '')
  const patterns = [
    /(?:^|[^a-z0-9])(220[\s\-]?g)(?=[^a-z0-9]|$)/gi,
    /(?:^|[^a-z0-9])(240[\s\-]?g)(?=[^a-z0-9]|$)/gi,
    /(?:^|[^a-z0-9])(250[\s\-]?g)(?=[^a-z0-9]|$)/gi,
    /(?:^|[^a-z0-9])(260[\s\-]?g)(?=[^a-z0-9]|$)/gi,
    /(?:^|[^a-z0-9])(270[\s\-]?g)(?=[^a-z0-9]|$)/gi,
    /(?:^|[^a-z0-9])(280[\s\-]?g)(?=[^a-z0-9]|$)/gi,
    /(?:^|[^a-z0-9])(220[\s\-]?f(?:[\s\-]?st)?)(?=[^a-z0-9]|$)/gi,
    /(?:^|[^a-z0-9])(240[\s\-]?f(?:[\s\-]?st)?)(?=[^a-z0-9]|$)/gi,
    /(?:^|[^a-z0-9])(250[\s\-]?f(?:[\s\-]?st)?)(?=[^a-z0-9]|$)/gi,
    /(?:^|[^a-z0-9])(260[\s\-]?f(?:[\s\-]?st)?)(?=[^a-z0-9]|$)/gi,
    /(?:^|[^a-z0-9])(280[\s\-]?f(?:[\s\-]?st)?)(?=[^a-z0-9]|$)/gi,
    /(?:^|[^a-z0-9])(220[\s\-]?i)(?=[^a-z0-9]|$)/gi,
    // Console/config shorthand on cardio families (G-1 / G-3), not strength ranges.
    /(?:^|[^a-z0-9])((?:g|h)[\s\-]?\d)(?=[^a-z0-9]|$)/gi,
    // Strength station model numbers (305G, 599H) — exclude cardio bases via filter below.
    /(?:^|[^a-z0-9])(\d{3}[\s\-]?[gh])(?=[^a-z0-9]|$)/gi,
  ]
  for (const pattern of patterns) {
    for (const match of value.matchAll(pattern)) {
      const normalized = match[1].replace(/[\s-]+/g, '').toUpperCase()
      if (!found.some((code) => code.toLowerCase() === normalized.toLowerCase())) {
        found.push(normalized)
      }
    }
  }
  return found
}

function pulseSeriesEquivalent(targetSeries, candidateSeries) {
  const target = new Set(targetSeries || [])
  const candidate = new Set(candidateSeries || [])
  if (!target.size || !candidate.size) return { matches: [], conflicts: [] }

  const matches = []
  const conflicts = []
  for (const series of candidate) {
    let matched = target.has(series)
    if (!matched) {
      for (const targetId of target) {
        const equivalent = PULSE_SERIES_EQUIVALENCE[targetId] || [targetId]
        if (equivalent.includes(series)) {
          matched = true
          break
        }
      }
    }
    if (matched) matches.push(series)
    else conflicts.push(series)
  }
  return { matches: [...new Set(matches)], conflicts: [...new Set(conflicts)] }
}

function normalizePulseMarketingName(value) {
  return normalizeWhitespace(value)
    .replace(/['’]/g, '')
    .replace(/\b(\d+)["”]/g, '$1 inch')
}

function pulseAliasKeysFromText(text) {
  const compact = compactIdentityKey(normalizePulseMarketingName(text))
  const keys = []
  for (const [canonical, aliases] of Object.entries(PULSE_PRODUCT_NAME_ALIASES)) {
    if (compact.includes(canonical) || aliases.some((alias) => compact.includes(alias))) {
      keys.push(canonical)
    }
  }
  return keys
}

const CONFIDENCE_CAPS = Object.freeze({
  exact_model_or_family: 100,
  verified_alias: 95,
  family_only: 70,
  brand_and_type_only: 40,
  conflict: 0,
})

function normalizeWhitespace(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim()
}

export function normalizeIdentityText(value) {
  return normalizeWhitespace(value)
    .replace(/[\u2018\u2019\u201A\u201B]/g, "'")
    .replace(/[\u201C\u201D\u201E\u201F]/g, '"')
    .replace(/[–—]/g, '-')
    .toLowerCase()
}

function compactIdentityKey(value) {
  return normalizeIdentityText(value)
    .replace(/\+/g, ' plus ')
    .replace(/[^a-z0-9]+/g, '')
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Whole-token / boundary-aware match. Avoids A5 matching A5x, T5 matching T50,
 * and "performance" matching inside "performance plus".
 */
export function identityTokenPresent(haystack, token) {
  const needle = normalizeIdentityText(token)
  if (!needle) return false
  const text = normalizeIdentityText(haystack)
  if (!text) return false

  const phrasePattern = new RegExp(
    `(?:^|[^a-z0-9])${escapeRegExp(needle).replace(/\s+/g, '[\\s+_\\-]+')}(?:[^a-z0-9]|$)`,
    'i',
  )
  if (phrasePattern.test(text)) return true

  const compactNeedle = compactIdentityKey(needle)
  const compactText = compactIdentityKey(text)
  if (compactNeedle.length < 2 || !compactText.includes(compactNeedle)) return false

  if (/^[a-z]?\d{1,2}[a-z]{0,2}$/i.test(compactNeedle)) {
    const pattern = new RegExp(`(?:^|[^a-z0-9])${escapeRegExp(compactNeedle)}(?:[^a-z0-9]|$)`, 'i')
    return pattern.test(compactText)
  }

  if (compactNeedle === 'performance') {
    return /(?:^|[^a-z0-9])performance(?!plus)(?:[^a-z0-9]|$)/i.test(compactText)
  }

  const pattern = new RegExp(`(?:^|[^a-z0-9])${escapeRegExp(compactNeedle)}(?:[^a-z0-9]|$)`, 'i')
  return pattern.test(compactText)
}

function candidateHaystack(candidate = {}) {
  return [
    candidate.title,
    candidate.snippet,
    candidate.source,
    candidate.sourceUrl,
    candidate.link,
    candidate.imageUrl,
    candidate.original,
    candidate.thumbnail,
    candidate.alt,
    candidate.pageTitle,
    candidate.metadata,
    // Intentionally omit searchQuery — it repeats the target product and falsely
    // invents model/series matches on unrelated manufacturer pages.
  ].filter(Boolean).join(' ')
}

function productHaystack(product = {}) {
  return [
    product.brand,
    product.product_family,
    product.series,
    product.model,
    product.canonical_product_name,
    product.canonical_product_key,
    product.equipment_type,
  ].filter(Boolean).join(' ')
}

function detectLabelSet(text, definitions) {
  const found = []
  for (const def of definitions) {
    const labels = [...(def.labels || [])].sort((a, b) => b.length - a.length)
    // Bare "performance" must not fire when "performance plus" is present.
    if (def.id === 'performance') {
      if (identityTokenPresent(text, 'performance plus') || identityTokenPresent(text, 'performance+')) {
        continue
      }
    }
    if (labels.some((label) => identityTokenPresent(text, label))) {
      found.push(def.id)
    }
  }
  return found
}

function extractMatrixModelCodes(text) {
  const found = []
  const sorted = [...MATRIX_DIGIT_MODEL_CODES].sort((a, b) => b.length - a.length)
  for (const code of sorted) {
    if (identityTokenPresent(text, code)) found.push(code)
  }
  // Also catch generic letter+digits+x forms not in the static list
  const extras = [...String(text ?? '').matchAll(/(?:^|[^a-z0-9])([a-z]\d{1,2}x(?:e|i)?)(?=[^a-z0-9]|$)/gi)]
  for (const match of extras) {
    const normalized = match[1].charAt(0).toUpperCase() + match[1].slice(1).toLowerCase()
    if (!found.some((code) => code.toLowerCase() === normalized.toLowerCase())) {
      found.push(normalized)
    }
  }
  // Standalone T1/T3/T5/T7/T50/T70 already covered; also bare Tn without x
  const tCodes = [...String(text ?? '').matchAll(/(?:^|[^a-z0-9])(t(?:1|3|5|7|50|70))(?=[^a-z0-9]|$)/gi)]
  for (const match of tCodes) {
    const normalized = match[1].toUpperCase()
    if (!found.some((code) => code.toLowerCase() === normalized.toLowerCase())) {
      found.push(normalized)
    }
  }
  return found
}

/**
 * Precor commercial model / SKU codes (Experience cardio + Discovery strength).
 * Distinct codes must never auto-approve against each other (TRM811 ≠ TRM731).
 */
function extractPrecorModelCodes(text) {
  const found = []
  const value = String(text ?? '')
  const patterns = [
    // Experience / Resolute style: TRM835, EFX883, AMT865, RBK815, UBK885, CLM835
    /(?:^|[^a-z0-9])((?:trm|efx|amt|rbk|ubk|clm)[\s\-]*\d{2,4}i?)(?=[^a-z0-9]|$)/gi,
    // Older Experience digit models: 956i, 966i, C846i, C932, C946
    /(?:^|[^a-z0-9])(c[\s\-]*\d{3,4}i?)(?=[^a-z0-9]|$)/gi,
    /(?:^|[^a-z0-9])(\d{3,4}i)(?=[^a-z0-9]|$)/gi,
    // Discovery / Vitality / Resolute SKUs: DBR0412, DPL0601, DSL0505, VBR6312, RSL0310
    /(?:^|[^a-z0-9])((?:dbr|dpl|dsl|vbr|vsl|rsl|ic)[\s\-]*\d{3,4})(?=[^a-z0-9]|$)/gi,
  ]
  for (const pattern of patterns) {
    for (const match of value.matchAll(pattern)) {
      const normalized = match[1].replace(/[\s-]+/g, '').toUpperCase()
      if (!found.some((code) => code.toLowerCase() === normalized.toLowerCase())) {
        found.push(normalized)
      }
    }
  }
  return found
}

function normalizeComparableModelCode(code) {
  return String(code || '').toLowerCase().replace(/[^a-z0-9]/g, '')
}

function resolveMatrixAliases(codes = []) {
  const expanded = new Set(codes.map((code) => code.toLowerCase()))
  for (const code of codes) {
    const aliases = MATRIX_IDENTITY_ALIASES[code.toLowerCase()] || []
    for (const alias of aliases) expanded.add(String(alias).toLowerCase())
  }
  return [...expanded]
}

function brandsAreCompatible(targetBrandKey, candidateBrandKey) {
  if (!targetBrandKey || !candidateBrandKey) return true
  if (targetBrandKey === candidateBrandKey) return true
  // Allow Matrix Fitness vs Matrix, Pulse Fitness vs Pulse
  const targetCore = targetBrandKey.replace(/fitness$/, '')
  const candidateCore = candidateBrandKey.replace(/fitness$/, '')
  if (targetCore === candidateCore) return true
  // Hammer Strength catalogue pages often live under Life Fitness ownership/domains.
  const pair = [targetBrandKey, candidateBrandKey].sort().join('|')
  if (pair === 'hammerstrength|lifefitness') return true
  return false
}

function detectBrandFromText(text) {
  const value = String(text ?? '')
  if (/\bmatrix(?:fitness|\s+fitness)?\b/i.test(value) || /matrixfitness\.com/i.test(value)) {
    return 'Matrix Fitness'
  }
  // Prefer Hammer Strength when named explicitly (owned by Life Fitness, distinct catalogue brand).
  if (/\bhammer\s*strength\b/i.test(value) || /hammerstrength\.com/i.test(value)) {
    return 'Hammer Strength'
  }
  if (/\blife\s*fitness\b/i.test(value) || /lifefitness\.com/i.test(value)) {
    return 'Life Fitness'
  }
  if (/\btechnogym\b/i.test(value) || /technogym\.com/i.test(value)) return 'Technogym'
  if (/\bprecor\b/i.test(value) || /precor\.com/i.test(value)) return 'Precor'
  if (/\bpulse(?:\s+fitness)?\b/i.test(value) || /pulsefitness\.com/i.test(value)) return 'Pulse Fitness'
  if (/\bcybex\b/i.test(value) || /cybexintl\.com/i.test(value)) return 'Cybex'
  return null
}

export function extractProductImageIdentity(source, { kind = 'product' } = {}) {
  const text = kind === 'candidate' ? candidateHaystack(source) : productHaystack(source)
  const brand = normalizeWhitespace(source?.brand)
    || detectBrandFromText(text)

  const brandKey = compactIdentityKey(brand)
  const matrixFamilies = detectLabelSet(text, MATRIX_MODERN_FAMILIES)
  // Prefer performance_plus over performance when both match
  const families = matrixFamilies.includes('performance_plus')
    ? matrixFamilies.filter((id) => id !== 'performance')
    : matrixFamilies

  const isMatrix = brandKey.includes('matrix') || /\bmatrix/.test(normalizeIdentityText(text))
  const isPrecor = brandKey.includes('precor') || /\bprecor/.test(normalizeIdentityText(text))
  const isPulse = brandKey.includes('pulse') || /\bpulse/.test(normalizeIdentityText(text))
  const modelCodes = isMatrix
    ? extractMatrixModelCodes(text)
    : isPrecor
      ? extractPrecorModelCodes(text)
      : isPulse
        ? extractPulseModelCodes(text)
        : []

  const lifeFitnessSeries = detectLabelSet(text, LIFE_FITNESS_SERIES)
  let technogymLines = detectLabelSet(text, TECHNOGYM_LINES)
  let precorSeries = detectLabelSet(text, PRECOR_SERIES)
  let pulseSeries = detectLabelSet(text, PULSE_SERIES)

  // Collapse generic Technogym labels when a more specific generation/family is present.
  if (technogymLines.some((line) => line.startsWith('selection_') && line !== 'selection')) {
    technogymLines = technogymLines.filter((line) => line !== 'selection')
  }
  if (technogymLines.includes('selection_personal')) {
    technogymLines = technogymLines.filter((line) => line !== 'personal')
  }
  if (technogymLines.includes('pure_strength') || technogymLines.includes('biostrength')) {
    technogymLines = technogymLines.filter((line) => line !== 'strength')
  }
  if (technogymLines.includes('excite_plus')) {
    technogymLines = technogymLines.filter((line) => line !== 'excite')
  }
  if (technogymLines.includes('element_plus')) {
    technogymLines = technogymLines.filter((line) => line !== 'element')
  }
  if (technogymLines.some((line) => line.startsWith('skill'))) {
    // Keep specific skill* ids; drop vague skill_line only when a concrete skill product matched.
    if (technogymLines.some((line) => ['skillrun', 'skillrow', 'skillbike', 'skillmill'].includes(line))) {
      technogymLines = technogymLines.filter((line) => line !== 'skill_line')
    }
  }

  // URL/path forms: /selection-700-chest-press_...
  if (/\bselection[\s\-_]?700\b/i.test(text) && !technogymLines.includes('selection_700')) {
    technogymLines = [...technogymLines.filter((line) => line !== 'selection'), 'selection_700']
  }
  if (/\bselection[\s\-_]?900\b/i.test(text) && !technogymLines.includes('selection_900')) {
    technogymLines = [...technogymLines.filter((line) => line !== 'selection'), 'selection_900']
  }

  // Precor Discovery SKU prefixes (DBR / DPL / DSL) are strong series signals.
  if (/\b(dbr|dpl|dsl)\d/i.test(text) && !precorSeries.includes('discovery')) {
    precorSeries = [...precorSeries, 'discovery']
  }

  // F-ST is a cardio console generation, not G/H strength.
  if (/\bf[\s\-]?st\b|\b\d{3}[\s\-]?f(?:[\s\-]?st)?\b/i.test(text) && !pulseSeries.includes('f_st')) {
    pulseSeries = [...pulseSeries, 'f_st']
  }

  // Strength G/H model numbers (305G / 599H). Never treat cardio bases (220G/240G) as G-range.
  const strengthGCodes = modelCodes.filter((code) => (
    /^\d{3}G$/i.test(code) && !PULSE_CARDIO_BASE_CODES.has(code.toUpperCase())
  ))
  const strengthHCodes = modelCodes.filter((code) => /^\d{3}H$/i.test(code))
  if (strengthGCodes.length && !pulseSeries.includes('g_range')) {
    pulseSeries = [...pulseSeries, 'g_range']
  }
  if (strengthHCodes.length && !pulseSeries.includes('h_range')) {
    pulseSeries = [...pulseSeries, 'h_range']
  }

  // Drop accidental g_range when the only G codes present are cardio bases.
  if (pulseSeries.includes('g_range') && !/\bg[\s\-]?range\b|\bg[\s\-]?series\b|\bg[\s\-]?strength\b/i.test(text)) {
    const hasStrengthGLabel = strengthGCodes.length > 0
    if (!hasStrengthGLabel) {
      pulseSeries = pulseSeries.filter((series) => series !== 'g_range')
    }
  }

  // Club Line / Classic / Premium on official pages are H-range equivalents for matching,
  // but keep their own labels; equivalence is applied during compare.

  let equipmentType = normalizeWhitespace(source?.equipment_type) || null
  if (!equipmentType) {
    if (/\bascent\s+trainer\b/i.test(text)) equipmentType = 'Ascent Trainer'
    else if (/\bclimb\s*mill\b/i.test(text)) equipmentType = 'ClimbMill'
    else if (/\btreadmill\b/i.test(text)) equipmentType = 'Treadmill'
    else if (/\belliptical\b|\bcross\s*trainer\b/i.test(text)) equipmentType = 'Elliptical'
    else if (/\brecumbent\b/i.test(text)) equipmentType = 'Recumbent Bike'
    else if (/\bupright\b/i.test(text)) equipmentType = 'Upright Bike'
    else if (/\bleg\s*curl\b/i.test(text)) equipmentType = 'Leg Curl'
    else if (/\bcalf\s*(press|raise)\b/i.test(text)) equipmentType = 'Calf Press'
    else if (/\bleg\s*extension\b/i.test(text)) equipmentType = 'Leg Extension'
    else if (/\bleg\s*press\b/i.test(text)) equipmentType = 'Leg Press'
    else if (/\bchest\s*press\b/i.test(text)) equipmentType = 'Chest Press'
    else if (/\bshoulder\s*press\b/i.test(text)) equipmentType = 'Shoulder Press'
    else if (/\blat\s*pull/i.test(text)) equipmentType = 'Lat Pulldown'
    else if (/\bseated\s*row\b|\brow\s*machine\b/i.test(text)) equipmentType = 'Row Machine'
    else if (/\barm\s*curl\b|\bbiceps?\s*curl\b/i.test(text)) equipmentType = 'Biceps Curl'
    else if (/\btriceps?\b/i.test(text)) equipmentType = 'Triceps Machine'
    else if (/\babdominal\b|\bab\s*crunch\b/i.test(text)) equipmentType = 'Abdominal Machine'
    else if (/\bhip\s*abduct/i.test(text)) equipmentType = 'Hip Abductor/Adductor'
    else if (/\brotary\s*torso\b/i.test(text)) equipmentType = 'Rotary Torso'
    else if (/\brotary\s*hip\b/i.test(text)) equipmentType = 'Rotary Hip'
    else if (/\bpec\s*(fly|deck)\b|\brear\s*delt\b/i.test(text)) equipmentType = 'Pec Fly'
    else if (/\bglute\b/i.test(text)) equipmentType = 'Glute Machine'
    else if (/\bback\s*extension\b/i.test(text)) equipmentType = 'Back Extension'
    else if (/\bchin[\s\-]*dip\s*assist|assisted\s+(chin|dip)/i.test(text)) equipmentType = 'Assist Machine'
    else if (/\bseated\s*dip\b|\bdip\s*machine\b/i.test(text)) equipmentType = 'Dip Machine'
    else if (/\bbench\b/i.test(text)) equipmentType = 'Bench'
    else if (/\brack\b|\bsmith\b/i.test(text)) equipmentType = 'Rack/Smith Machine'
  }

  const series = normalizeWhitespace(source?.product_family || source?.series) || families[0] || null
  const generation = families.length
    ? 'modern'
    : (modelCodes.length ? 'historic_digit' : null)

  return {
    brand,
    family: families[0] || lifeFitnessSeries[0] || technogymLines[0] || precorSeries[0] || pulseSeries[0] || null,
    families,
    series,
    modelCodes,
    equipmentType,
    generation,
    aliases: resolveMatrixAliases(modelCodes),
    lifeFitnessSeries,
    technogymLines,
    precorSeries,
    pulseSeries,
    rawText: text,
  }
}

function isDistinctiveModelIdentityToken(model) {
  const text = normalizeIdentityText(model)
  if (!text) return false
  const compact = compactIdentityKey(text)
  if (compact.length < 6) return false
  const words = text.split(/\s+/).filter(Boolean)
  if (words.length >= 2) return true
  if (GENERIC_MODEL_IDENTITY_TOKENS.has(text)) return false
  // Single-token model codes like A5x / TRM885 are distinctive.
  if (/^[a-z]?\d{1,4}[a-z]{0,3}$/i.test(compact)) return true
  if (/^[a-z]{1,3}\d+[a-z]*$/i.test(compact)) return true
  return compact.length >= 8
}

function expandPulseComparableModelCodes(codes = []) {
  const expanded = new Set(codes.map((code) => normalizeComparableModelCode(code)))
  for (const code of [...expanded]) {
    const fst = code.match(/^(\d{3})fst$/)
    if (fst) expanded.add(`${fst[1]}f`)
    const bareF = code.match(/^(\d{3})f$/)
    if (bareF) expanded.add(`${bareF[1]}fst`)
  }
  return expanded
}

function extractTechnogymGenerationNumerals(text) {
  const found = new Set()
  const value = String(text ?? '')
  for (const match of value.matchAll(/\b(?:selection[\s\-_]?)?(700|900)\b/gi)) {
    found.add(match[1])
  }
  return found
}

function codesConflict(targetCodes, candidateCodes) {
  const target = expandPulseComparableModelCodes(targetCodes)
  for (const code of targetCodes || []) {
    for (const alias of (MATRIX_IDENTITY_ALIASES[normalizeComparableModelCode(code)] || [])) {
      target.add(normalizeComparableModelCode(alias))
    }
  }
  const candidate = expandPulseComparableModelCodes(candidateCodes)
  if (!target.size || !candidate.size) return []

  const conflicts = []
  for (const code of candidate) {
    if (target.has(code)) continue
    // Candidate-only console shorthand (G3) is not a conflict when a shared cardio base matched.
    if (/^[gh]\d$/.test(code) && [...target].some((entry) => /^(220|240|250|260|270|280)g$/.test(entry))) {
      continue
    }
    // Strength station SKUs (305G / 599H) on manufacturer pages should not conflict with catalogue
    // products that only carry series labels (H-range / G-range) and no numeric station code.
    // Cardio bases (220G / 240G / 220F) always conflict when they differ.
    const isCardioBase = /^(220|240|250|260|270|280)[gf](?:st)?$/.test(code)
      || [...target].some((entry) => /^(220|240|250|260|270|280)[gf](?:st)?$/.test(entry))
    if (/^\d{3}[gh]$/.test(code) && !isCardioBase) {
      const targetStrength = [...target].filter((entry) => /^\d{3}[gh]$/.test(entry) && !/^(220|240|250|260|270|280)/.test(entry))
      if (!targetStrength.length) continue
    }
    conflicts.push(code)
  }
  return conflicts
}

function familiesConflict(targetFamilies, candidateFamilies) {
  const target = new Set(targetFamilies)
  const candidate = new Set(candidateFamilies)
  if (!target.size || !candidate.size) return []
  const conflicts = []
  for (const family of candidate) {
    if (!target.has(family)) conflicts.push(family)
  }
  // Special: performance vs performance_plus already handled by extraction preference,
  // but if target is performance and candidate is performance_plus (or reverse), conflict.
  if (target.has('performance') && candidate.has('performance_plus')) {
    if (!conflicts.includes('performance_plus')) conflicts.push('performance_plus')
  }
  if (target.has('performance_plus') && candidate.has('performance') && !candidate.has('performance_plus')) {
    if (!conflicts.includes('performance')) conflicts.push('performance')
  }
  return conflicts
}

function pulseEquipmentTypesCompatible(targetType, candidateType, targetText = '', candidateText = '') {
  const targetKey = compactIdentityKey(targetType)
  const candidateKey = compactIdentityKey(candidateType)
  if (!targetKey || !candidateKey) return true
  if (targetKey === candidateKey) return true

  const elliptical = new Set(['elliptical', 'crosstrainer', 'crosstrain'])
  if (elliptical.has(targetKey) && elliptical.has(candidateKey)) return true

  const stepper = new Set(['stepper', 'stepperstairclimber', 'stairclimber'])
  if (stepper.has(targetKey) && stepper.has(candidateKey)) return true

  const bikeKeys = new Set(['exercisebike', 'uprightbike', 'recumbentbike', 'bike', 'indoorcycle'])
  if (bikeKeys.has(targetKey) && bikeKeys.has(candidateKey)) {
    const targetUpright = /\bu[\s\-]?cycle\b|\bupright\b|\bpursuit/i.test(targetText)
    const targetRecumbent = /\br[\s\-]?cycle\b|\brecumbent\b|\bperform/i.test(targetText)
    const candidateUpright = candidateKey.includes('upright')
      || /\bu[\s\-]?cycle\b|\bupright\b/i.test(candidateText)
    const candidateRecumbent = candidateKey.includes('recumbent')
      || /\br[\s\-]?cycle\b|\brecumbent\b/i.test(candidateText)
    if (targetUpright && candidateRecumbent) return false
    if (targetRecumbent && candidateUpright) return false
    return true
  }

  return false
}

/**
 * Compare target product identity vs candidate identity.
 */
export function compareProductIdentity(targetSource, candidateSource) {
  const target = targetSource?.family != null && Array.isArray(targetSource?.modelCodes)
    ? targetSource
    : extractProductImageIdentity(targetSource, { kind: 'product' })
  const candidate = candidateSource?.family != null && Array.isArray(candidateSource?.modelCodes)
    ? candidateSource
    : extractProductImageIdentity(candidateSource, { kind: 'candidate' })

  const conflicts = []
  const matched = []

  const targetBrandKey = compactIdentityKey(target.brand)
  const candidateBrandKey = compactIdentityKey(candidate.brand)
  if (targetBrandKey && candidateBrandKey && !brandsAreCompatible(targetBrandKey, candidateBrandKey)) {
    conflicts.push({ type: 'brand', token: candidate.brand })
  }

  const familyConflicts = familiesConflict(target.families || [], candidate.families || [])
  for (const family of familyConflicts) {
    conflicts.push({ type: 'family', token: family })
  }
  for (const family of (candidate.families || [])) {
    if ((target.families || []).includes(family)) matched.push({ type: 'family', token: family })
  }

  // Modern family target vs historic digit code in candidate (or reverse)
  if ((target.families || []).length && (candidate.modelCodes || []).length) {
    for (const code of candidate.modelCodes) {
      conflicts.push({ type: 'model_code_vs_modern_family', token: code })
    }
  }
  if ((candidate.families || []).length && (target.modelCodes || []).length) {
    for (const family of candidate.families) {
      conflicts.push({ type: 'modern_family_vs_digit_model', token: family })
    }
  }

  const codeConflicts = codesConflict(target.modelCodes || [], candidate.modelCodes || [])
  for (const code of codeConflicts) {
    conflicts.push({ type: 'model_code', token: code })
  }
  for (const code of (candidate.modelCodes || [])) {
    if ((target.modelCodes || []).some((entry) => (
      expandPulseComparableModelCodes([entry]).has(normalizeComparableModelCode(code))
    ))) {
      matched.push({ type: 'model_code', token: code })
    }
  }

  // Life Fitness / Technogym / Precor / Pulse series conflicts
  const lfConflicts = familiesConflict(target.lifeFitnessSeries || [], candidate.lifeFitnessSeries || [])
  for (const series of lfConflicts) conflicts.push({ type: 'life_fitness_series', token: series })
  const tgConflicts = familiesConflict(target.technogymLines || [], candidate.technogymLines || [])
  for (const line of tgConflicts) conflicts.push({ type: 'technogym_line', token: line })
  for (const line of (candidate.technogymLines || [])) {
    if ((target.technogymLines || []).includes(line)) {
      matched.push({ type: 'family', token: line })
    }
  }
  // Life Fitness / Hammer Strength series matches also count as family evidence.
  for (const series of (candidate.lifeFitnessSeries || [])) {
    if ((target.lifeFitnessSeries || []).includes(series)) {
      matched.push({ type: 'family', token: series })
    }
  }

  const precorConflicts = familiesConflict(target.precorSeries || [], candidate.precorSeries || [])
  for (const series of precorConflicts) conflicts.push({ type: 'precor_series', token: series })
  const pulseEquivalence = pulseSeriesEquivalent(target.pulseSeries || [], candidate.pulseSeries || [])
  for (const series of pulseEquivalence.conflicts) {
    // Fusion / Series 2-3 console trim labels are not hard conflicts against a matching model code.
    if (['fusion', 'series_2', 'series_3'].includes(series) && (target.modelCodes || []).length) {
      continue
    }
    if (['fusion', 'series_2', 'series_3'].includes(series)
      && (target.pulseSeries || []).some((entry) => ['fusion', 'series_2', 'series_3'].includes(entry))
      && !(candidate.pulseSeries || []).some((entry) => ['g_range', 'h_range', 'f_st', 'classic', 'premium', 'club_line'].includes(entry))) {
      continue
    }
    conflicts.push({ type: 'pulse_series', token: series })
  }

  // Also treat Precor/Pulse series matches as family matches for evidence.
  for (const series of (candidate.precorSeries || [])) {
    if ((target.precorSeries || []).includes(series)) matched.push({ type: 'family', token: series })
  }
  for (const series of pulseEquivalence.matches) {
    matched.push({ type: 'family', token: series })
  }
  for (const series of (candidate.pulseSeries || [])) {
    if ((target.pulseSeries || []).includes(series)
      && !matched.some((entry) => entry.type === 'family' && entry.token === series)) {
      matched.push({ type: 'family', token: series })
    }
  }

  // Verified Pulse product-name aliases (Fusion U-Cycle ↔ U-Cycle, Pace' ↔ Pace, etc.).
  const targetAliasKeys = pulseAliasKeysFromText([
    targetSource?.canonical_product_name,
    targetSource?.model,
    target.rawText,
  ].filter(Boolean).join(' '))
  const candidateAliasKeys = pulseAliasKeysFromText(candidate.rawText || '')
  const pulseAliasHit = targetAliasKeys.some((key) => candidateAliasKeys.includes(key))
  if (pulseAliasHit) {
    matched.push({ type: 'pulse_alias', token: targetAliasKeys.find((key) => candidateAliasKeys.includes(key)) })
  }

  // Equipment type hard conflict when both sides have a type and they differ.
  const targetType = compactIdentityKey(target.equipmentType)
  const candidateType = compactIdentityKey(candidate.equipmentType)
  const targetTextForType = [
    targetSource?.canonical_product_name,
    targetSource?.model,
    targetSource?.product_family,
    target.rawText,
  ].filter(Boolean).join(' ')
  if (targetType && candidateType && targetType !== candidateType) {
    const compatible = pulseEquipmentTypesCompatible(
      target.equipmentType,
      candidate.equipmentType,
      targetTextForType,
      candidate.rawText || '',
    )
    if (!compatible) {
      conflicts.push({ type: 'equipment_type', token: candidate.equipmentType })
    }
  }

  // Abductor vs Adductor are distinct machines even when equipment_type is shared.
  const targetText = [
    targetSource?.canonical_product_name,
    targetSource?.model,
    targetSource?.product_family,
    target.rawText,
  ].filter(Boolean).join(' ')
  const targetAbductor = /\babductor\b/i.test(targetText)
  const targetAdductor = /\badductor\b/i.test(targetText)
  const candidateAbductor = /\babductor\b/i.test(candidate.rawText || '')
  const candidateAdductor = /\badductor\b/i.test(candidate.rawText || '')
  if (targetAbductor && !targetAdductor && candidateAdductor && !candidateAbductor) {
    conflicts.push({ type: 'model_variant', token: 'adductor' })
  }
  if (targetAdductor && !targetAbductor && candidateAbductor && !candidateAdductor) {
    conflicts.push({ type: 'model_variant', token: 'abductor' })
  }

  // Numeric generation labels (700 / 900) are identity-sensitive when either side uses them.
  const targetGen = extractTechnogymGenerationNumerals(targetText)
  const candidateGen = extractTechnogymGenerationNumerals(candidate.rawText || '')
  if (targetGen.size && candidateGen.size) {
    for (const gen of candidateGen) {
      if (!targetGen.has(gen)) conflicts.push({ type: 'generation', token: gen })
      else matched.push({ type: 'generation', token: gen })
    }
  }

  // Assisted chin/dip machines are not seated dips.
  if (/\bseated\s+dip\b/i.test(targetText) && /chin[\s\-]*dip\s*assist|assisted\s+chin/i.test(candidate.rawText || '')) {
    conflicts.push({ type: 'model_variant', token: 'chin_dip_assist' })
  }

  // Multi-station / package pages are not single-station product identity.
  if (!/\b(station|multi[\s\-]?gym|jungle|package|set)\b/i.test(targetText)
    && /\b(\d+\s*piece|multi[\s\-]?gym|jungle\s*gym|strength\s*set)\b/i.test(candidate.rawText || '')) {
    conflicts.push({ type: 'model_variant', token: 'multi_station_package' })
  }

  const hasConflict = conflicts.length > 0

  const exactFamily = matched.some((entry) => entry.type === 'family')
  const exactModel = matched.some((entry) => entry.type === 'model_code')
  const pulseAliasMatched = matched.some((entry) => entry.type === 'pulse_alias')
  const modelText = normalizeWhitespace(targetSource?.model)
  const modelIsDistinctive = isDistinctiveModelIdentityToken(modelText)
  const modelMention = modelIsDistinctive && identityTokenPresent(candidate.rawText, modelText)
  // Pulse strength stations often use generic single-word models (Abdominal, Glute).
  // Series match + station token is enough when no SKU is present.
  const pulseStrengthSeries = (target.pulseSeries || []).some((series) => (
    ['g_range', 'h_range', 'classic', 'premium', 'club_line'].includes(series)
  ))
  const pulseStationMention = Boolean(
    modelText
    && identityTokenPresent(candidate.rawText, modelText)
    && pulseStrengthSeries
    && exactFamily,
  )
  const normalizedCanonical = normalizePulseMarketingName(targetSource?.canonical_product_name || '')
  const canonicalMention = identityTokenPresent(candidate.rawText, targetSource?.canonical_product_name)
    || (normalizedCanonical && identityTokenPresent(candidate.rawText, normalizedCanonical))
  const softPulseSeriesOnly = (target.pulseSeries || []).every((series) => (
    ['fusion', 'series_2', 'series_3', 'f_st'].includes(series)
  ))
  const seriesRequired = Boolean(
    (target.precorSeries || []).length
    || ((target.pulseSeries || []).length && !softPulseSeriesOnly)
    || (target.lifeFitnessSeries || []).length
    || (target.technogymLines || []).length
    || (target.families || []).length,
  )
  // Exact model/SKU codes prove identity even when catalogue series labels differ from the live site.
  const seriesSatisfied = exactFamily || !seriesRequired || exactModel || pulseAliasMatched
  // When the product carries an explicit model/SKU code, only that code proves exact identity.
  const requiresModelCode = (target.modelCodes || []).length > 0

  const exactIdentity = !hasConflict && seriesSatisfied && (
    exactModel
    || pulseAliasMatched && (exactModel || modelMention || pulseStationMention || !requiresModelCode)
    || (!requiresModelCode && exactFamily && modelMention)
    || (!requiresModelCode && exactFamily && pulseStationMention)
    || (!requiresModelCode && canonicalMention)
    || (!requiresModelCode && modelMention && seriesSatisfied)
  )

  let evidenceLevel = 'brand_type_only'
  if (hasConflict) evidenceLevel = 'conflict'
  else if (
    exactModel
    || (!requiresModelCode && ((exactFamily && (modelMention || pulseStationMention)) || canonicalMention))
    || (pulseAliasMatched && exactModel)
    || (pulseAliasMatched && !requiresModelCode && (modelMention || pulseStationMention || exactFamily))
  ) {
    evidenceLevel = 'exact'
  } else if (exactFamily || pulseAliasMatched) evidenceLevel = 'family'
  else if (exactIdentity) evidenceLevel = 'exact'

  return {
    target,
    candidate,
    hasConflict,
    conflicts,
    matched,
    exactIdentity,
    evidenceLevel,
    maxConfidence: hasConflict
      ? CONFIDENCE_CAPS.conflict
      : evidenceLevel === 'exact'
        ? CONFIDENCE_CAPS.exact_model_or_family
        : evidenceLevel === 'family'
          ? CONFIDENCE_CAPS.family_only
          : CONFIDENCE_CAPS.brand_and_type_only,
  }
}

export function applyIdentityConfidenceCap(score, identityResult) {
  const capped = Math.min(Number(score) || 0, identityResult?.maxConfidence ?? CONFIDENCE_CAPS.brand_and_type_only)
  return Math.max(0, capped)
}

export function buildIdentityScoreBreakdown(identityResult, {
  domainScore = 0,
  qualityScore = 0,
} = {}) {
  const exactBrand = identityResult?.target?.brand && identityResult?.candidate?.brand ? 10 : 0
  const exactEquipmentType = identityResult?.target?.equipmentType
    && identityResult?.candidate?.equipmentType
    && compactIdentityKey(identityResult.target.equipmentType) === compactIdentityKey(identityResult.candidate.equipmentType)
    ? 15
    : 0
  const exactFamily = identityResult?.matched?.some((entry) => entry.type === 'family') ? 40 : 0
  const exactModel = identityResult?.matched?.some((entry) => entry.type === 'model_code') ? 30 : 0
  const trustedDomain = Math.max(0, Math.min(10, Number(domainScore) > 0 ? 5 : 0))
  const conflictPenalty = identityResult?.hasConflict ? -100 : 0
  const raw = exactBrand + exactEquipmentType + exactFamily + exactModel + trustedDomain + qualityScore + conflictPenalty
  const finalScore = applyIdentityConfidenceCap(raw, identityResult)

  return {
    exactBrand,
    exactEquipmentType,
    exactFamily,
    exactModel,
    trustedDomain,
    qualityScore,
    conflictPenalty,
    rawScore: raw,
    finalScore,
    decision: identityResult?.hasConflict
      ? 'rejected'
      : identityResult?.evidenceLevel === 'exact'
        ? 'eligible_exact'
        : identityResult?.evidenceLevel === 'family'
          ? 'needs_review'
          : 'insufficient_identity',
    evidenceLevel: identityResult?.evidenceLevel,
    conflicts: identityResult?.conflicts ?? [],
    matched: identityResult?.matched ?? [],
  }
}

/**
 * Hard gate used before download/scoring continuation.
 */
export function evaluateImageCandidateIdentity(product, candidate) {
  const identityResult = compareProductIdentity(product, candidate)
  const breakdown = buildIdentityScoreBreakdown(identityResult)

  if (identityResult.hasConflict) {
    return {
      eligible: false,
      score: 0,
      status: 'rejected',
      reason: 'conflicting_product_identity',
      conflicts: identityResult.conflicts,
      identityResult,
      breakdown,
    }
  }

  return {
    eligible: true,
    score: breakdown.finalScore,
    status: identityResult.evidenceLevel === 'exact'
      ? 'eligible'
      : identityResult.evidenceLevel === 'family'
        ? 'needs_review'
        : 'insufficient_identity',
    reason: null,
    conflicts: [],
    identityResult,
    breakdown,
  }
}

/**
 * Required identity tokens that must survive in every search query variant.
 */
export function requiredIdentityQueryTokens(product) {
  const identity = extractProductImageIdentity(product, { kind: 'product' })
  const tokens = []

  for (const family of identity.families || []) {
    if (family === 'performance_plus') tokens.push('Performance Plus')
    else if (family === 'onyx') tokens.push('Onyx')
    else if (family === 'endurance') tokens.push('Endurance')
    else if (family === 'lifestyle') tokens.push('Lifestyle')
    else if (family === 'performance') tokens.push('Performance')
  }

  for (const code of identity.modelCodes || []) {
    // Console shorthand G1/G2/G3 is too brittle for required query retention when a base SKU exists.
    if (/^[gh]\d$/i.test(code) && (identity.modelCodes || []).some((entry) => /^(220|240|250|260|270|280)g$/i.test(entry))) {
      continue
    }
    tokens.push(code)
  }

  for (const series of identity.lifeFitnessSeries || []) {
    const def = LIFE_FITNESS_SERIES.find((entry) => entry.id === series)
    if (def?.labels?.[0]) tokens.push(titleCase(def.labels[0]))
  }

  for (const line of identity.technogymLines || []) {
    const def = TECHNOGYM_LINES.find((entry) => entry.id === line)
    if (def?.labels?.[0]) tokens.push(titleCase(def.labels[0]))
  }

  for (const series of identity.precorSeries || []) {
    const def = PRECOR_SERIES.find((entry) => entry.id === series)
    if (def?.labels?.[0]) tokens.push(titleCase(def.labels[0]))
  }

  // Pulse: prefer concrete model/SKU codes. Only keep hard series labels (G/H/F-ST/Classic/etc.).
  // Soft labels like Fusion / Series 2 are useful in queries but must not block fallback variants.
  const pulseHardSeries = (identity.pulseSeries || []).filter((series) => {
    if (!['g_range', 'h_range', 'f_st', 'classic', 'premium', 'club_line'].includes(series)) return false
    // F-ST is already implied by 220FST / 240FST model codes.
    if (series === 'f_st' && (identity.modelCodes || []).some((code) => /f(?:st)?$/i.test(code))) return false
    return true
  })
  for (const series of pulseHardSeries) {
    const def = PULSE_SERIES.find((entry) => entry.id === series)
    if (def?.labels?.[0]) tokens.push(titleCase(def.labels[0]))
  }

  return [...new Set(tokens)]
}

function titleCase(value) {
  return normalizeWhitespace(value)
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

export function queryRetainsRequiredIdentity(query, product) {
  const required = requiredIdentityQueryTokens(product)
  if (!required.length) return true
  return required.every((token) => identityTokenPresent(query, token))
}

export function filterQueriesToRetainIdentity(queries, product) {
  const required = requiredIdentityQueryTokens(product)
  if (!required.length) return queries
  const retained = queries.filter((query) => queryRetainsRequiredIdentity(query, product))
  if (retained.length) return retained

  // Rebuild a safe canonical query rather than allowing a stripped fallback.
  const brand = normalizeWhitespace(product?.brand) || 'Equipment'
  const canonical = normalizeWhitespace(product?.canonical_product_name)
  if (canonical) return [canonical]
  return [[brand, ...required, product?.equipment_type].filter(Boolean).join(' ')]
}

export function canAutoApproveByIdentity(identityResult, {
  trustedSource = false,
  officialExactPage = false,
} = {}) {
  if (!identityResult || identityResult.hasConflict) return false
  if (identityResult.evidenceLevel === 'brand_type_only' || identityResult.evidenceLevel === 'family') {
    return false
  }
  if (identityResult.evidenceLevel !== 'exact') return false

  // Series-bound brands always require an explicit series/family match,
  // unless an exact model/SKU code already proves identity.
  const target = identityResult.target || {}
  const seriesBound = Boolean(
    (target.precorSeries || []).length
    || (target.pulseSeries || []).length
    || (target.lifeFitnessSeries || []).length
    || (target.technogymLines || []).length
    || (target.families || []).length,
  )
  const hasSeriesMatch = (identityResult.matched || []).some((entry) => entry.type === 'family')
  const hasModelCodeMatch = (identityResult.matched || []).some((entry) => entry.type === 'model_code')
  if (seriesBound && !hasSeriesMatch && !hasModelCodeMatch) return false

  // Explicit model/SKU codes must match before auto-approve (TRM811 ≠ TRM731).
  if ((target.modelCodes || []).length && !hasModelCodeMatch) return false

  if (officialExactPage && identityResult.exactIdentity) return true
  if (trustedSource && identityResult.exactIdentity) return true
  return false
}

export { CONFIDENCE_CAPS }
