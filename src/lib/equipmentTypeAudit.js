const FIELD_WEIGHTS = {
  canonical_product_name: 3,
  model: 2,
  product_family: 1,
}

const BROAD_KEYWORDS = new Set([
  'chest',
  'run',
  'bike',
  'row',
  'smith',
  'dip',
  'fly',
  'hip',
  'squat',
  'calf',
  'stair',
  'amt',
])

export const EQUIPMENT_TYPE_AUDIT_RULES = [
  {
    equipmentType: 'Adaptive Motion Trainer',
    keywords: ['Adaptive Motion Trainer', 'AMT'],
    priority: 10,
  },
  {
    equipmentType: 'Recumbent Bike',
    keywords: ['Recumbent'],
    priority: 20,
  },
  {
    equipmentType: 'Stair Climber',
    keywords: ['Stair Climber', 'Stair'],
    priority: 30,
  },
  {
    equipmentType: 'Cross Trainer',
    keywords: ['Cross Trainer', 'Crosstrainer', 'Elliptical'],
    priority: 40,
  },
  {
    equipmentType: 'Treadmill',
    keywords: ['Treadmill'],
    patterns: [/\bRun\b/i],
    priority: 50,
  },
  {
    equipmentType: 'Upright Bike',
    keywords: ['Upright Bike', 'Bike'],
    excludeKeywords: ['Recumbent'],
    priority: 60,
  },
  {
    equipmentType: 'Stepper',
    keywords: ['Stepper'],
    priority: 70,
  },
  {
    equipmentType: 'Climber',
    keywords: ['Climber'],
    excludeKeywords: ['Stair'],
    priority: 80,
  },
  {
    equipmentType: 'Strength',
    keywords: [
      'Abdominal',
      'Ab Crunch',
      'Abductor',
      'Adductor',
      'Arm Curl',
      'Back Extension',
      'Biceps',
      'Butterfly',
      'Calf',
      'Chest Press',
      'Incline Press',
      'Lat Pulldown',
      'Leg Curl',
      'Leg Extension',
      'Leg Press',
      'Low Row',
      'Multi Press',
      'Pec Fly',
      'Pulldown',
      'Pullover',
      'Shoulder Press',
      'Hack Squat',
      'Chest',
      'Dip',
      'Fly',
      'Glute',
      'Hip',
      'Row',
      'Shrug',
      'Smith',
      'Squat',
      'Triceps',
    ],
    priority: 90,
  },
]

const EQUIPMENT_TYPE_ALIASES = new Map([
  ['crosstrainers', 'cross trainer'],
  ['crosstrainer', 'cross trainer'],
  ['upright bikes', 'upright bike'],
  ['indoor bike', 'upright bike'],
  ['exercise bike', 'upright bike'],
  ['recumbent bikes', 'recumbent bike'],
  ['stairclimber', 'stair climber'],
  ['stair climbers', 'stair climber'],
  ['stairclimbers', 'stair climber'],
  ['stepper/stair climber', 'stepper'],
  ['selectorised strength', 'strength'],
  ['plate loaded strength', 'strength'],
  ['strength machine', 'strength'],
  ['non-motorised treadmill', 'treadmill'],
])

function normalizeWhitespace(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim()
}

export function normalizeEquipmentType(value) {
  const normalized = normalizeWhitespace(value).toLowerCase()
  if (!normalized) return ''
  return EQUIPMENT_TYPE_ALIASES.get(normalized) ?? normalized
}

export function equipmentTypesEquivalent(left, right) {
  return normalizeEquipmentType(left) === normalizeEquipmentType(right)
}

function buildProductSearchText(product) {
  return [
    product?.canonical_product_name,
    product?.product_family,
    product?.model,
  ]
    .map((value) => normalizeWhitespace(value))
    .filter(Boolean)
    .join(' ')
}

function keywordMatchesField(keyword, fieldValue) {
  const haystack = normalizeWhitespace(fieldValue)
  if (!haystack) return false
  if (keyword.length <= 3) {
    const pattern = new RegExp(`\\b${escapeRegExp(keyword)}\\b`, 'i')
    return pattern.test(haystack)
  }
  return haystack.toLowerCase().includes(keyword.toLowerCase())
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function ruleIsExcluded(rule, searchText) {
  for (const keyword of rule.excludeKeywords ?? []) {
    if (searchText.toLowerCase().includes(keyword.toLowerCase())) return true
  }
  return false
}

function scoreKeywordMatch({ keyword, field, fieldWeight }) {
  let score = 40 * fieldWeight
  if (keyword.length >= 12) score += 35
  else if (keyword.length >= 8) score += 25
  else if (keyword.length >= 5) score += 15
  else if (BROAD_KEYWORDS.has(keyword.toLowerCase())) score += 5
  else score += 10
  if (field === 'canonical_product_name') score += 10
  return Math.min(100, score)
}

function confidenceLabel(score) {
  if (score >= 80) return 'High'
  if (score >= 55) return 'Medium'
  return 'Low'
}

function findRuleMatch(product, rule) {
  const searchText = buildProductSearchText(product)
  if (ruleIsExcluded(rule, searchText)) return null

  const keywords = [...rule.keywords].sort((left, right) => right.length - left.length)
  const fields = [
    ['canonical_product_name', product?.canonical_product_name],
    ['model', product?.model],
    ['product_family', product?.product_family],
  ]

  let bestMatch = null

  for (const keyword of keywords) {
    for (const [field, fieldValue] of fields) {
      if (!keywordMatchesField(keyword, fieldValue)) continue
      const score = scoreKeywordMatch({
        keyword,
        field,
        fieldWeight: FIELD_WEIGHTS[field],
      })
      if (!bestMatch || score > bestMatch.score) {
        bestMatch = {
          equipmentType: rule.equipmentType,
          keyword,
          field,
          score,
          confidence: confidenceLabel(score),
        }
      }
    }
  }

  for (const pattern of rule.patterns ?? []) {
    for (const [field, fieldValue] of fields) {
      const haystack = normalizeWhitespace(fieldValue)
      if (!haystack || !pattern.test(haystack)) continue
      const score = scoreKeywordMatch({
        keyword: pattern.source,
        field,
        fieldWeight: FIELD_WEIGHTS[field],
      })
      if (!bestMatch || score > bestMatch.score) {
        bestMatch = {
          equipmentType: rule.equipmentType,
          keyword: pattern.source,
          field,
          score,
          confidence: confidenceLabel(score),
        }
      }
    }
  }

  return bestMatch
}

export function inferEquipmentTypeFromProduct(product) {
  const orderedRules = [...EQUIPMENT_TYPE_AUDIT_RULES].sort((left, right) => left.priority - right.priority)

  for (const rule of orderedRules) {
    const match = findRuleMatch(product, rule)
    if (match) return match
  }

  return null
}

export function auditEquipmentProductType(product) {
  const inference = inferEquipmentTypeFromProduct(product)
  const currentType = normalizeWhitespace(product?.equipment_type) || null
  const suggestedType = inference?.equipmentType ?? null

  if (!suggestedType) {
    return {
      product,
      currentType,
      suggestedType: null,
      confidence: null,
      matchedKeyword: null,
      matchedField: null,
      hasDifference: false,
    }
  }

  return {
    product,
    currentType,
    suggestedType,
    confidence: inference.confidence,
    matchedKeyword: inference.keyword,
    matchedField: inference.field,
    hasDifference: !equipmentTypesEquivalent(currentType, suggestedType),
  }
}

export function auditEquipmentProductTypes(products = []) {
  const rows = products.map(auditEquipmentProductType)
  const differences = rows.filter((row) => row.hasDifference)
  return {
    rows,
    differences,
    summary: {
      productsChecked: products.length,
      withSuggestion: rows.filter((row) => row.suggestedType).length,
      differences: differences.length,
      noRuleMatch: rows.filter((row) => !row.suggestedType).length,
    },
  }
}

export function buildEquipmentTypeAuditRow(row) {
  return {
    brand: row.product?.brand ?? '',
    canonicalProductName: row.product?.canonical_product_name ?? '',
    productFamily: row.product?.product_family ?? '',
    model: row.product?.model ?? '',
    currentType: row.currentType ?? '',
    suggestedType: row.suggestedType ?? '',
    confidence: row.confidence ?? '',
    matchedKeyword: row.matchedKeyword ?? '',
    matchedField: row.matchedField ?? '',
  }
}

export function serializeEquipmentTypeAuditCsv(rows = []) {
  const header = [
    'brand',
    'canonical_product_name',
    'product_family',
    'model',
    'current_type',
    'suggested_type',
    'confidence',
    'matched_keyword',
    'matched_field',
  ]
  const lines = [header.join(',')]

  for (const row of rows) {
    const entry = buildEquipmentTypeAuditRow(row)
    lines.push([
      entry.brand,
      entry.canonicalProductName,
      entry.productFamily,
      entry.model,
      entry.currentType,
      entry.suggestedType,
      entry.confidence,
      entry.matchedKeyword,
      entry.matchedField,
    ].map(csvEscape).join(','))
  }

  return `${lines.join('\n')}\n`
}

function csvEscape(value) {
  const text = String(value ?? '')
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`
  return text
}
