import { extractStrongModelCode } from './intelligenceEbaySoldModelCode.ts'
import { buildKeywordSearchGroups } from './intelligenceEbaySearchGroups.ts'

export type PriorityEquipmentInput = {
  id: string
  brand: string
  series?: string | null
  model: string
  equipment_type?: string | null
  category?: string | null
  slug?: string | null
}

export type PriorityScoreBreakdown = {
  brand: number
  equipment: number
  model: number
  penalty: number
}

export type PrioritySyncRankEntry = {
  rank: number
  equipment_id: string
  brand: string
  model: string
  series: string | null
  equipment_type: string | null
  popularity_score: number
  reason: string
  score_breakdown: PriorityScoreBreakdown
}

export type PrioritySearchGroupRankEntry = {
  rank: number
  primary_keyword: string
  keyword_key: string
  label: string
  labels: string[]
  member_count: number
  equipment_ids: string[]
  brand: string
  model: string
  series: string | null
  equipment_type: string | null
  popularity_score: number
  reason: string
  score_breakdown: PriorityScoreBreakdown
}

const POPULAR_BRAND_SCORES: Array<{ pattern: RegExp; score: number; label: string }> = [
  { pattern: /\blife\s*fitness\b/i, score: 40, label: 'Life Fitness' },
  { pattern: /\btechnogym\b/i, score: 38, label: 'Technogym' },
  { pattern: /\bconcept\s*2\b/i, score: 36, label: 'Concept2' },
  { pattern: /\bmatrix\b/i, score: 32, label: 'Matrix' },
  { pattern: /\bprecor\b/i, score: 32, label: 'Precor' },
  { pattern: /\bhammer\s*strength\b/i, score: 30, label: 'Hammer Strength' },
  { pattern: /\bcybex\b/i, score: 30, label: 'Cybex' },
  { pattern: /\bstair\s*master\b/i, score: 28, label: 'StairMaster' },
  { pattern: /\bassault\s*fitness\b/i, score: 26, label: 'Assault Fitness' },
  { pattern: /\bwattbike\b/i, score: 26, label: 'Wattbike' },
]

const POPULAR_EQUIPMENT_SCORES: Array<{ pattern: RegExp; score: number; label: string }> = [
  { pattern: /\btreadmill\b/i, score: 25, label: 'treadmill' },
  { pattern: /\brower\b|\browing\s*machine\b/i, score: 24, label: 'rower' },
  { pattern: /\bindoor\s*bike\b|\bspin\s*bike\b|\bexercise\s*bike\b|\bcycle\b/i, score: 22, label: 'indoor bike' },
  { pattern: /\bair\s*bike\b|\bassault\s*bike\b/i, score: 22, label: 'air bike' },
  { pattern: /\bski\s*erg\b/i, score: 20, label: 'ski erg' },
  { pattern: /\bstair\s*climber\b|\bstepper\b|\bstep\s*mill\b|\bpowermill\b/i, score: 20, label: 'stair climber' },
  { pattern: /\bcross\s*trainer\b|\belliptical\b/i, score: 18, label: 'cross trainer' },
  { pattern: /\bfunctional\s*trainer\b|\bcable\s*machine\b|\bmulti\s*gym\b/i, score: 16, label: 'functional trainer' },
]

const STRONG_MODEL_SCORES: Array<{ pattern: RegExp; score: number; label: string }> = [
  { pattern: /\b95\s*-?\s*ti\b/i, score: 30, label: '95Ti' },
  { pattern: /\b95\s*-?\s*t(?!\s*i)\b/i, score: 30, label: '95T' },
  { pattern: /\b95\s*-?\s*xi\b/i, score: 28, label: '95Xi' },
  { pattern: /\b97\s*-?\s*ti\b/i, score: 26, label: '97Ti' },
  { pattern: /\b95\s*-?\s*ri\b/i, score: 24, label: '95Ri' },
  { pattern: /\bt\s*-?\s*7\s*xi\b/i, score: 26, label: 'T7xi' },
  { pattern: /\bmodel\s*d\b/i, score: 30, label: 'Model D' },
  { pattern: /\bpm\s*5\b/i, score: 28, label: 'PM5' },
  { pattern: /\bskill\s*mill\b|\bskillmill\b/i, score: 28, label: 'SkillMill' },
  { pattern: /\bskill\s*bike\b|\bskillbike\b/i, score: 26, label: 'SkillBike' },
  { pattern: /\befx\s*-?\s*835\b/i, score: 24, label: 'EFX 835' },
  { pattern: /\bic\s*-?\s*7\b/i, score: 22, label: 'IC7' },
  { pattern: /\bic\s*-?\s*6\b/i, score: 20, label: 'IC6' },
  { pattern: /\b770\s*a\b/i, score: 18, label: '770A' },
  { pattern: /\bt\s*-?\s*5\b/i, score: 18, label: 'T5' },
  { pattern: /\bt\s*-?\s*3\b/i, score: 16, label: 'T3' },
]

const PENALTY_PATTERNS: Array<{ pattern: RegExp; score: number; label: string }> = [
  { pattern: /\bconsole\s*only\b|\bdisplay\s*only\b|\bscreen\s*only\b/i, score: 30, label: 'console-only listing' },
  { pattern: /\breplacement\b|\bspare\b|\bspares\b/i, score: 28, label: 'replacement/spare part' },
  { pattern: /\battachment\b|\battachments\b|\baccessor/i, score: 24, label: 'accessory/attachment' },
  { pattern: /\broller\b|\bbelt\s*only\b|\bmotor\b|\bcontroller\b|\bpcb\b/i, score: 26, label: 'component/part' },
  { pattern: /\bpart\s*number\b|\bpart\s*no\b|\boem\s*part\b/i, score: 24, label: 'part number listing' },
  { pattern: /\bunity\s*console\b|\bdiscover\s*se\b|\btrack\s*connect\b/i, score: 14, label: 'obscure console variant' },
  { pattern: /\bconsole\s*variant\b|\bconsole\s*upgrade\b|\bretrofit\b/i, score: 12, label: 'console variant' },
  { pattern: /\bled\s*console\b|\bsl\s*console\b|\bse\s*console\b/i, score: 10, label: 'console suffix variant' },
  { pattern: /\bpad\b|\bstrap\b|\bgrip\b|\bhandle\b|\bcable\b|\badapter\b/i, score: 18, label: 'small accessory' },
]

function normalizeText(...parts: Array<string | null | undefined>): string {
  return parts
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function scoreFromPatterns(
  text: string,
  patterns: Array<{ pattern: RegExp; score: number; label: string }>,
  pick: 'max' | 'sum' = 'max',
): { score: number; reasons: string[] } {
  const matches: Array<{ score: number; label: string }> = []

  for (const entry of patterns) {
    if (entry.pattern.test(text)) {
      matches.push({ score: entry.score, label: entry.label })
    }
  }

  if (matches.length === 0) {
    return { score: 0, reasons: [] }
  }

  if (pick === 'sum') {
    const score = matches.reduce((sum, match) => sum + match.score, 0)
    return {
      score,
      reasons: matches.map((match) => `${match.label} −${match.score}`),
    }
  }

  const best = matches.reduce((top, match) => (match.score > top.score ? match : top))
  return {
    score: best.score,
    reasons: [`${best.label} +${best.score}`],
  }
}

export function scoreEquipmentPriority(row: PriorityEquipmentInput): {
  popularity_score: number
  reason: string
  score_breakdown: PriorityScoreBreakdown
} {
  const combined = normalizeText(row.brand, row.series, row.model, row.equipment_type, row.category, row.slug)
  const brandText = normalizeText(row.brand)
  const equipmentText = normalizeText(row.equipment_type, row.category, row.series, row.model)
  const modelText = normalizeText(row.model, row.series)

  const brandMatch = scoreFromPatterns(brandText, POPULAR_BRAND_SCORES)
  const equipmentMatch = scoreFromPatterns(equipmentText, POPULAR_EQUIPMENT_SCORES)

  const strongFromProfile = extractStrongModelCode(
    row.model ?? '',
    row.series ?? '',
    row.equipment_type ?? '',
  )
  const modelPatternMatch = scoreFromPatterns(modelText, STRONG_MODEL_SCORES)
  const modelScore = Math.max(
    modelPatternMatch.score,
    strongFromProfile ? 20 : 0,
  )
  const modelReasons = [...modelPatternMatch.reasons]
  if (strongFromProfile && modelPatternMatch.score === 0) {
    modelReasons.push(`strong model ${strongFromProfile} +20`)
  } else if (strongFromProfile && modelPatternMatch.score > 0) {
    modelReasons[0] = modelPatternMatch.reasons[0] ?? `strong model ${strongFromProfile}`
  }

  const penaltyMatch = scoreFromPatterns(combined, PENALTY_PATTERNS, 'sum')
  const penalty = penaltyMatch.score

  const popularity_score = Math.max(
    0,
    brandMatch.score + equipmentMatch.score + modelScore - penalty,
  )

  const reasonParts = [
    ...brandMatch.reasons,
    ...equipmentMatch.reasons,
    ...modelReasons,
    ...penaltyMatch.reasons,
  ]

  const reason = reasonParts.length > 0
    ? reasonParts.join('; ')
    : 'No strong popularity signals'

  return {
    popularity_score,
    reason,
    score_breakdown: {
      brand: brandMatch.score,
      equipment: equipmentMatch.score,
      model: modelScore,
      penalty,
    },
  }
}

export function rankEquipmentByPriority(
  rows: PriorityEquipmentInput[],
  limit = 50,
): PrioritySyncRankEntry[] {
  const ranked = rows
    .map((row) => {
      const scored = scoreEquipmentPriority(row)
      return {
        equipment_id: row.id,
        brand: row.brand,
        model: row.model,
        series: row.series ?? null,
        equipment_type: row.equipment_type ?? null,
        popularity_score: scored.popularity_score,
        reason: scored.reason,
        score_breakdown: scored.score_breakdown,
      }
    })
    .sort((left, right) => {
      if (right.popularity_score !== left.popularity_score) {
        return right.popularity_score - left.popularity_score
      }
      return `${left.brand} ${left.model}`.localeCompare(`${right.brand} ${right.model}`)
    })
    .slice(0, limit)
    .map((entry, index) => ({
      rank: index + 1,
      ...entry,
    }))

  return ranked
}

function scoreSearchGroupMembers(
  rows: PriorityEquipmentInput[],
  equipmentIds: string[],
): {
  popularity_score: number
  reason: string
  score_breakdown: PriorityScoreBreakdown
  representative: PriorityEquipmentInput
} {
  const members = rows.filter((row) => equipmentIds.includes(row.id))
  const fallback = members[0] ?? {
    id: equipmentIds[0] ?? '',
    brand: '',
    model: '',
  }

  let best = {
    popularity_score: 0,
    reason: 'No strong popularity signals',
    score_breakdown: { brand: 0, equipment: 0, model: 0, penalty: 0 } as PriorityScoreBreakdown,
    representative: fallback,
  }

  for (const member of members) {
    const scored = scoreEquipmentPriority(member)
    if (scored.popularity_score > best.popularity_score) {
      best = {
        ...scored,
        representative: member,
      }
    }
  }

  return best
}

export function rankSearchGroupsByPriority(
  rows: PriorityEquipmentInput[],
  limit = 50,
): PrioritySearchGroupRankEntry[] {
  const groups = buildKeywordSearchGroups(
    rows.map((row) => ({
      ...row,
      slug: row.slug ?? row.id,
    })),
  )

  const ranked = groups
    .map((group) => {
      const equipmentIds = group.members.map((member) => member.equipment_id)
      const scored = scoreSearchGroupMembers(rows, equipmentIds)

      return {
        primary_keyword: group.primary_keyword,
        keyword_key: group.keyword_key,
        label: group.labels[0] ?? group.primary_keyword,
        labels: group.labels,
        member_count: group.member_count,
        equipment_ids: equipmentIds,
        brand: scored.representative.brand,
        model: scored.representative.model,
        series: scored.representative.series ?? null,
        equipment_type: scored.representative.equipment_type ?? null,
        popularity_score: scored.popularity_score,
        reason: scored.reason,
        score_breakdown: scored.score_breakdown,
      }
    })
    .sort((left, right) => {
      if (right.popularity_score !== left.popularity_score) {
        return right.popularity_score - left.popularity_score
      }
      if (right.member_count !== left.member_count) {
        return right.member_count - left.member_count
      }
      return left.primary_keyword.localeCompare(right.primary_keyword)
    })
    .slice(0, limit)
    .map((entry, index) => ({
      rank: index + 1,
      ...entry,
    }))

  return ranked
}
