function normalizeWhitespace(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim()
}

export function normalizeEquipmentTypeKey(value) {
  return normalizeWhitespace(value).toLowerCase()
}

export const WRONG_CARDIO_EQUIPMENT_TYPES = new Set([
  'treadmill',
  'non-motorised treadmill',
  'exercise bike',
  'upright bike',
  'cross trainer',
  'crosstrainers',
  'stepper/stair climber',
  'stepper',
  'adaptive motion trainer',
])

export const PRESERVED_GRANULAR_STRENGTH_TYPES = new Set([
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
  'row machine',
  'selectorised strength',
  'shoulder press',
  'strength machine',
  'triceps machine',
])

export const GRANULAR_STRENGTH_TYPE_RULES = [
  {
    equipmentType: 'Abdominal Machine',
    keywords: ['Abdominal Crunch', 'Ab Crunch', 'Abdominal', 'Rotary Torso'],
  },
  {
    equipmentType: 'Biceps Curl',
    keywords: ['Arm Curl', 'Biceps Curl', 'Biceps', 'Preacher Curl'],
  },
  {
    equipmentType: 'Back Extension',
    keywords: ['Back Extension'],
  },
  {
    equipmentType: 'Hip Abductor/Adductor',
    keywords: ['Hip Abductor', 'Hip Adductor', 'Abductor', 'Adductor', 'Multi Hip'],
  },
  {
    equipmentType: 'Chest Press',
    keywords: ['Chest Press', 'Converging Chest', 'Incline Press', 'Pec Fly', 'Pec Deck', 'Butterfly', 'Multi Press'],
  },
  {
    equipmentType: 'Shoulder Press',
    keywords: ['Shoulder Press', 'Converging Shoulder', 'Lateral Raise', 'Lateral Deltoid'],
  },
  {
    equipmentType: 'Leg Press',
    keywords: ['Leg Press', 'Hack Squat', 'Calf Press', 'Seated Calf'],
  },
  {
    equipmentType: 'Leg Extension',
    keywords: ['Leg Extension'],
  },
  {
    equipmentType: 'Leg Curl',
    keywords: ['Leg Curl'],
  },
  {
    equipmentType: 'Lat Pulldown',
    keywords: ['Lat Pulldown', 'Diverging Lat Pull', 'Lat Pull', 'Pulldown', 'Long Pull'],
  },
  {
    equipmentType: 'Row Machine',
    keywords: ['Seated Row', 'Low Row', 'Diverging Seated Row'],
  },
  {
    equipmentType: 'Triceps Machine',
    keywords: ['Triceps', 'Tricep', 'Dip/Chin', 'Dip Chin', 'Chin/Dip', 'Chin & Dip'],
  },
  {
    equipmentType: 'Rack/Smith Machine',
    keywords: ['Smith Machine', 'Smith '],
  },
  {
    equipmentType: 'Glute Machine',
    keywords: ['Glute Drive', 'Glute'],
  },
  {
    equipmentType: 'Cable Machine',
    keywords: ['Cable Cross', 'Adjustable Pulley', 'DAP', 'Multi Pulley', 'Multi-Pulley'],
  },
]

function buildProductSearchText(product) {
  return [
    product?.canonical_product_name,
    product?.model,
    product?.product_family,
  ]
    .map((value) => normalizeWhitespace(value))
    .filter(Boolean)
    .join(' ')
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function keywordMatchesText(keyword, text) {
  const haystack = normalizeWhitespace(text)
  if (!haystack) return false
  if (keyword.length <= 4) {
    return new RegExp(`\\b${escapeRegExp(keyword)}\\b`, 'i').test(haystack)
  }
  return haystack.toLowerCase().includes(keyword.toLowerCase())
}

export function inferGranularStrengthType(product) {
  const fields = [
    ['canonical_product_name', product?.canonical_product_name],
    ['model', product?.model],
    ['product_family', product?.product_family],
  ]

  let bestMatch = null

  for (const rule of GRANULAR_STRENGTH_TYPE_RULES) {
    const keywords = [...rule.keywords].sort((left, right) => right.length - left.length)
    for (const keyword of keywords) {
      for (const [field, fieldValue] of fields) {
        if (!keywordMatchesText(keyword, fieldValue)) continue
        const score = keyword.length + (field === 'canonical_product_name' ? 10 : field === 'model' ? 5 : 0)
        if (!bestMatch || score > bestMatch.score) {
          bestMatch = {
            equipmentType: rule.equipmentType,
            keyword,
            field,
            score,
          }
        }
      }
    }
  }

  if (!bestMatch) return null

  return {
    equipmentType: bestMatch.equipmentType,
    keyword: bestMatch.keyword,
    field: bestMatch.field,
    confidence: 'High',
  }
}

function typesEquivalent(left, right) {
  return normalizeEquipmentTypeKey(left) === normalizeEquipmentTypeKey(right)
}

export function proposeEquipmentTypeRepair(product) {
  const currentType = normalizeWhitespace(product?.equipment_type) || null
  const normalizedCurrent = normalizeEquipmentTypeKey(currentType)
  const searchText = buildProductSearchText(product)

  const base = {
    product,
    currentType,
    proposedType: null,
    reason: null,
    confidence: null,
    matchedKeyword: null,
    willUpdate: false,
  }

  if (!currentType) return base

  if (PRESERVED_GRANULAR_STRENGTH_TYPES.has(normalizedCurrent)) {
    return base
  }

  if (
    normalizedCurrent === 'exercise bike'
    && /\brecumbent\b/i.test(searchText)
    && !typesEquivalent(currentType, 'Recumbent Bike')
  ) {
    return {
      ...base,
      proposedType: 'Recumbent Bike',
      reason: 'recumbent_product_labeled_exercise_bike',
      confidence: 'High',
      willUpdate: true,
    }
  }

  if (
    (normalizedCurrent === 'stepper/stair climber' || normalizedCurrent === 'stepper')
    && /\bclimber\b/i.test(searchText)
    && !/\bstair\b/i.test(searchText)
    && !typesEquivalent(currentType, 'Climber')
  ) {
    return {
      ...base,
      proposedType: 'Climber',
      reason: 'climber_product_labeled_stepper',
      confidence: 'High',
      willUpdate: true,
    }
  }

  if (!WRONG_CARDIO_EQUIPMENT_TYPES.has(normalizedCurrent)) {
    return base
  }

  const granular = inferGranularStrengthType(product)
  if (!granular || typesEquivalent(currentType, granular.equipmentType)) {
    return base
  }

  return {
    ...base,
    proposedType: granular.equipmentType,
    reason: 'wrong_cardio_type_for_strength_product',
    confidence: granular.confidence,
    matchedKeyword: granular.keyword,
    willUpdate: granular.confidence === 'High',
  }
}

export function auditEquipmentTypeRepairs(products = []) {
  const proposals = products.map(proposeEquipmentTypeRepair)
  const actionable = proposals.filter((proposal) => proposal.proposedType)
  const updates = proposals.filter((proposal) => proposal.willUpdate)

  return {
    proposals,
    actionable,
    updates,
    summary: {
      productsChecked: products.length,
      proposals: actionable.length,
      highConfidenceUpdates: updates.length,
    },
  }
}

export function buildEquipmentTypeRepairRow(proposal) {
  return {
    productName: proposal.product?.canonical_product_name ?? '',
    brand: proposal.product?.brand ?? '',
    currentType: proposal.currentType ?? '',
    proposedType: proposal.proposedType ?? '',
    reason: proposal.reason ?? '',
    confidence: proposal.confidence ?? '',
    willUpdate: proposal.willUpdate ? 'true' : 'false',
    matchedKeyword: proposal.matchedKeyword ?? '',
  }
}
