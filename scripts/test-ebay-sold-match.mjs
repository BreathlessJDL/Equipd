/**
 * Regression tests for strict eBay strong model code matching.
 */

const LIFE_FITNESS_95TI_DETECT = [
  /\b95\s*-?\s*Ti\b/i,
  /\bT\s*-?\s*95\s*i\b/i,
]

const LIFE_FITNESS_95T_DETECT = [
  /\b95\s*-?\s*T(?!\s*i)\b/i,
  /\bT\s*-?\s*95\b(?!\s*i\b)/i,
]

const PROFILES = [
  {
    canonical: '95Ti',
    aliases: ['95Ti', '95 Ti', '95-Ti', '95TI', 'T95i', 'T 95i', 'T-95i'],
    detect: LIFE_FITNESS_95TI_DETECT,
    match: LIFE_FITNESS_95TI_DETECT,
  },
  {
    canonical: '95T',
    aliases: ['95T', '95 T', '95-T', 'T95'],
    detect: LIFE_FITNESS_95T_DETECT,
    match: LIFE_FITNESS_95T_DETECT,
  },
  {
    canonical: 'T5',
    detect: [/\bT\s*5\b/i],
    match: [/\bT\s*5\b/i],
  },
  {
    canonical: 'T3',
    detect: [/\bT\s*3\b/i],
    match: [/\bT\s*3\b/i],
  },
]

function findProfile(haystack) {
  for (const profile of PROFILES) {
    if (profile.detect.some((pattern) => pattern.test(haystack))) {
      return profile
    }
  }
  return null
}

function extractStrongModelCode(model, series = '', equipmentType = '') {
  const combined = [series, model, equipmentType].filter(Boolean).join(' ')
  const profile = findProfile(combined)
  return profile?.canonical ?? null
}

function strongModelCodeMatchesText(canonical, text) {
  const profile = PROFILES.find((entry) => entry.canonical === canonical)
  if (!profile) return false
  return profile.match.some((pattern) => pattern.test(text))
}

function assert(condition, label) {
  if (!condition) throw new Error(label)
}

assert(extractStrongModelCode('95T') === '95T', 'detect 95T')
assert(extractStrongModelCode('95Ti') === '95Ti', 'detect 95Ti before generic 95T')

assert(
  strongModelCodeMatchesText('95T', 'Life Fitness 95T Treadmill'),
  '95T accepts 95T title',
)
assert(
  strongModelCodeMatchesText('95T', 'Life Fitness 95T treadmill'),
  '95T accepts lowercase treadmill title',
)
assert(
  strongModelCodeMatchesText('95T', 'Life Fitness 95-T treadmill'),
  '95T accepts 95-T title',
)
assert(
  !strongModelCodeMatchesText('95T', 'Life Fitness 95 Ti Treadmill'),
  '95T rejects 95 Ti title',
)
assert(
  !strongModelCodeMatchesText('95T', 'Life Fitness T95i Commercial Treadmill'),
  '95T rejects T95i title',
)
assert(
  strongModelCodeMatchesText('95Ti', 'Life Fitness 95 Ti Treadmill'),
  '95Ti accepts 95 Ti title',
)
assert(
  strongModelCodeMatchesText('95Ti', 'Life Fitness T95i Commercial Treadmill'),
  '95Ti accepts T95i title',
)
assert(
  !strongModelCodeMatchesText('95T', 'Life Fitness T3 Treadmill'),
  '95T rejects T3 title',
)
assert(
  !strongModelCodeMatchesText('95T', 'Life Fitness T5 Treadmill'),
  '95T rejects T5 title',
)
assert(
  !strongModelCodeMatchesText('95T', 'Life Fitness Treadmill'),
  '95T rejects generic treadmill title',
)

console.log('test-ebay-sold-match passed')
