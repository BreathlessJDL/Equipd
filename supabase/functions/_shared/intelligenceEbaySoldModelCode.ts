import { normalizeWhitespace } from './intelligenceMarketSearch.ts'

export type StrongModelProfile = {
  canonical: string
  aliases: string[]
  detectPatterns: RegExp[]
  matchPatterns: RegExp[]
}

export type StrongModelDetection = {
  canonical: string
  allowed_aliases: string[]
}

const LIFE_FITNESS_95TI_DETECT = [
  /\b95\s*-?\s*Ti\b/i,
  /\bT\s*-?\s*95\s*i\b/i,
]

const LIFE_FITNESS_95T_DETECT = [
  /\b95\s*-?\s*T(?!\s*i)\b/i,
  /\bT\s*-?\s*95\b(?!\s*i\b)/i,
]

const LIFE_FITNESS_95TI_MATCH = [...LIFE_FITNESS_95TI_DETECT]

const LIFE_FITNESS_95T_MATCH = [...LIFE_FITNESS_95T_DETECT]

const STRONG_MODEL_PROFILES: StrongModelProfile[] = [
  {
    canonical: 'IC7',
    aliases: ['IC7', 'IC 7', 'IC-7'],
    detectPatterns: [/\bIC\s*-?\s*7\b/i],
    matchPatterns: [/\bIC\s*-?\s*7\b/i],
  },
  {
    canonical: 'IC6',
    aliases: ['IC6', 'IC 6', 'IC-6'],
    detectPatterns: [/\bIC\s*-?\s*6\b/i],
    matchPatterns: [/\bIC\s*-?\s*6\b/i],
  },
  {
    canonical: '95Ti',
    aliases: ['95Ti', '95 Ti', '95-Ti', '95TI', 'T95i', 'T 95i', 'T-95i'],
    detectPatterns: LIFE_FITNESS_95TI_DETECT,
    matchPatterns: LIFE_FITNESS_95TI_MATCH,
  },
  {
    canonical: '95Xi',
    aliases: ['95Xi', '95 Xi', '95XI'],
    detectPatterns: [/\b95\s*Xi\b/i],
    matchPatterns: [/\b95\s*Xi\b/i],
  },
  {
    canonical: '97Ti',
    aliases: ['97Ti', '97 Ti', '97TI'],
    detectPatterns: [/\b97\s*Ti\b/i],
    matchPatterns: [/\b97\s*Ti\b/i],
  },
  {
    canonical: 'T7xi',
    aliases: ['T7xi', 'T7 xi', 'T7XI'],
    detectPatterns: [/\bT\s*7\s*xi\b/i],
    matchPatterns: [/\bT\s*7\s*xi\b/i],
  },
  {
    canonical: '95T',
    aliases: ['95T', '95 T', '95-T', 'T95'],
    detectPatterns: LIFE_FITNESS_95T_DETECT,
    matchPatterns: LIFE_FITNESS_95T_MATCH,
  },
  {
    canonical: '95Ri',
    aliases: ['95Ri', '95 Ri', '95-RI', '95RI'],
    detectPatterns: [/\b95\s*-?\s*Ri\b/i],
    matchPatterns: [/\b95\s*-?\s*Ri\b/i],
  },
  {
    canonical: 'T5',
    aliases: ['T5', 'T 5'],
    detectPatterns: [/\bT\s*5\b/i],
    matchPatterns: [/\bT\s*5\b/i],
  },
  {
    canonical: 'T3',
    aliases: ['T3', 'T 3'],
    detectPatterns: [/\bT\s*3\b/i],
    matchPatterns: [/\bT\s*3\b/i],
  },
  {
    canonical: 'EFX 835',
    aliases: ['EFX 835', 'EFX835', 'EFX-835'],
    detectPatterns: [/\bEFX\s*-?\s*835\b/i],
    matchPatterns: [/\bEFX\s*-?\s*835\b/i],
  },
  {
    canonical: '770A',
    aliases: ['770A', '770 A'],
    detectPatterns: [/\b770\s*A\b/i],
    matchPatterns: [/\b770\s*A\b/i],
  },
  {
    canonical: 'model d',
    aliases: ['Model D', 'Model d', 'model d'],
    detectPatterns: [/\bModel\s+D\b/i],
    matchPatterns: [/\bModel\s+D\b/i],
  },
  {
    canonical: 'pm5',
    aliases: ['PM5', 'pm5'],
    detectPatterns: [/\bPM\s*5\b/i],
    matchPatterns: [/\bPM\s*5\b/i],
  },
  {
    canonical: 'skillbike',
    aliases: ['Skillbike', 'SkillBike', 'skillbike'],
    detectPatterns: [/\bSkill\s*Bike\b/i, /\bSkillbike\b/i],
    matchPatterns: [/\bSkill\s*Bike\b/i, /\bSkillbike\b/i],
  },
  {
    canonical: 'skillmill',
    aliases: ['Skillmill', 'SkillMill', 'skillmill'],
    detectPatterns: [/\bSkill\s*Mill\b/i, /\bSkillmill\b/i],
    matchPatterns: [/\bSkill\s*Mill\b/i, /\bSkillmill\b/i],
  },
  {
    canonical: 'powermill',
    aliases: ['PowerMill', 'Powermill', 'powermill'],
    detectPatterns: [/\bPower\s*Mill\b/i, /\bPowermill\b/i],
    matchPatterns: [/\bPower\s*Mill\b/i, /\bPowermill\b/i],
  },
]

const PROFILE_BY_CANONICAL = new Map(
  STRONG_MODEL_PROFILES.map((profile) => [profile.canonical.toLowerCase(), profile]),
)

function stripModelYearRange(model: string): string {
  return normalizeWhitespace(String(model ?? '').replace(/\(\s*\d{4}\s*[-–]\s*\d{4}\s*\)/gi, ''))
}

function normalizeCombinedHaystack(
  model: string,
  series: string,
  equipmentType: string,
): string {
  return stripModelYearRange([series, model, equipmentType].filter(Boolean).join(' '))
}

function profileMatchesText(profile: StrongModelProfile, text: string): boolean {
  return profile.detectPatterns.some((pattern) => pattern.test(text))
}

function findProfileInText(haystack: string): StrongModelProfile | null {
  for (const profile of STRONG_MODEL_PROFILES) {
    if (profileMatchesText(profile, haystack)) {
      return profile
    }
  }
  return null
}

function extractGenericAlphanumericModelCode(model: string): StrongModelDetection | null {
  const stripped = stripModelYearRange(model).trim()
  const compact = stripped.replace(/\s+/g, '')
  const match = compact.match(/^(\d{2})([A-Za-z]{1,3})$/)
  if (!match) return null

  const [, digits, suffix] = match
  const canonical = `${digits}${suffix}`
  return {
    canonical,
    allowed_aliases: [
      canonical,
      `${digits} ${suffix}`,
      `${digits}-${suffix}`,
      canonical.toUpperCase(),
      canonical.toLowerCase(),
    ],
  }
}

function genericModelCodePattern(canonical: string): RegExp | null {
  const compact = canonical.replace(/\s+/g, '')
  const match = compact.match(/^(\d{2})([A-Za-z]{1,3})$/i)
  if (!match) return null

  const [, digits, suffix] = match
  return new RegExp(`\\b${digits}\\s*-?\\s*${suffix}\\b`, 'i')
}

export function detectModelTokensInTitle(text: string): string[] {
  const found: string[] = []

  for (const profile of STRONG_MODEL_PROFILES) {
    if (profileMatchesText(profile, text)) {
      found.push(profile.canonical)
    }
  }

  return found
}

export function extractStrongModelDetection(
  model: string,
  series: string,
  equipmentType = '',
): StrongModelDetection | null {
  const combined = normalizeCombinedHaystack(model, series, equipmentType)
  const profile = findProfileInText(combined)
  if (profile) {
    return {
      canonical: profile.canonical,
      allowed_aliases: [...profile.aliases],
    }
  }

  return extractGenericAlphanumericModelCode(model)
}

export function extractStrongModelCode(
  model: string,
  series: string,
  equipmentType = '',
): string | null {
  return extractStrongModelDetection(model, series, equipmentType)?.canonical ?? null
}

export function getAllowedModelAliases(canonical: string): string[] {
  const profile = PROFILE_BY_CANONICAL.get(canonical.toLowerCase())
  return profile ? [...profile.aliases] : [canonical]
}

export function strongModelCodeMatchesText(canonical: string, text: string): boolean {
  return matchStrongModelCode(canonical, text).matched
}

export function getModelCodeMismatchReason(
  expectedCanonical: string,
  title: string,
): string | null {
  if (matchStrongModelCode(expectedCanonical, title).matched) return null

  const detected = detectModelTokensInTitle(title)
  const conflicting = detected.filter(
    (code) => code.toLowerCase() !== expectedCanonical.toLowerCase(),
  )

  if (conflicting.length > 0) {
    return `Different model code detected: expected ${expectedCanonical}, found ${conflicting.join(', ')}`
  }

  return `Missing expected model code: ${expectedCanonical}`
}

export function matchStrongModelCode(
  canonical: string,
  text: string,
): { matched: boolean; matched_alias: string | null } {
  const profile = PROFILE_BY_CANONICAL.get(canonical.toLowerCase())
  if (profile) {
    const aliasesBySpecificity = [...profile.aliases].sort(
      (left, right) => aliasSpecificityScore(right) - aliasSpecificityScore(left),
    )

    for (const alias of aliasesBySpecificity) {
      const pattern = aliasToMatchPattern(alias)
      if (pattern?.test(text)) {
        return { matched: true, matched_alias: alias }
      }
    }

    if (profile.matchPatterns.some((pattern) => pattern.test(text))) {
      return { matched: true, matched_alias: profile.aliases[0] ?? canonical }
    }
  }

  const genericPattern = genericModelCodePattern(canonical)
  if (genericPattern?.test(text)) {
    return { matched: true, matched_alias: canonical }
  }

  return { matched: false, matched_alias: null }
}

function aliasSpecificityScore(alias: string): number {
  const compact = alias.replace(/[-\s]/g, '').toLowerCase()
  let score = alias.length
  if (alias.includes('-')) score += 2
  if (/\s/.test(alias)) score += 1
  if (compact.startsWith('t95')) score += 4
  if (compact.endsWith('ti')) score += 3
  return score
}

function aliasToMatchPattern(alias: string): RegExp | null {
  const normalized = alias.trim()
  if (!normalized) return null

  const compact = normalized.replace(/\s+/g, '').replace(/-/g, '').toLowerCase()

  if (normalized === 'T-95i') {
    return /\bT-95i\b/i
  }
  if (normalized === 'T 95i') {
    return /\bT\s+95\s*i\b/i
  }
  if (compact === 't95i') {
    return /\bT95i\b/i
  }
  if (compact === 't95') {
    return /\bT\s*-?\s*95\b(?!\s*i\b)/i
  }
  if (normalized === '95-Ti') {
    return /\b95-Ti\b/i
  }
  if (normalized === '95-T') {
    return /\b95-T(?!\s*i)\b/i
  }
  if (normalized === '95 Ti') {
    return /\b95\s+Ti\b/i
  }
  if (compact === '95ti') {
    return /\b95Ti\b/i
  }
  if (normalized === '95 T') {
    return /\b95\s+T(?!\s*i)\b/i
  }
  if (compact === '95t') {
    return /\b95T\b/i
  }

  if (/^ic\s*-?\s*\d+$/i.test(normalized.replace(/\s+/g, ' '))) {
    const digits = normalized.replace(/[^0-9]/g, '')
    return new RegExp(`\\bIC\\s*-?\\s*${digits}\\b`, 'i')
  }

  const escaped = normalized
    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    .replace(/\s+/g, '\\s+')

  return new RegExp(`\\b${escaped}\\b`, 'i')
}
