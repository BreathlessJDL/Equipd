import { CORE_PRODUCT_GROUP_STATUS } from './intelligenceCoreProductGrouping.js'

function normalizeWhitespace(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim()
}

function normalizeToken(value) {
  return normalizeWhitespace(value).toLowerCase()
}

export function buildCanonicalProductDisplayIdentityKey(product) {
  return [
    normalizeToken(product?.brand),
    normalizeToken(product?.equipment_type),
    normalizeWhitespace(product?.canonical_product_name).toLowerCase(),
  ].join('::')
}

function buildApprovedMultiMemberCoreGroupIndex(intelligenceRowsById = new Map()) {
  const groups = new Map()

  for (const row of intelligenceRowsById.values()) {
    if (row.core_product_group_status !== CORE_PRODUCT_GROUP_STATUS.APPROVED) continue
    const coreProductKey = String(row.core_product_key ?? '').trim()
    if (!coreProductKey) continue

    if (!groups.has(coreProductKey)) {
      groups.set(coreProductKey, {
        coreProductKey,
        memberRowIds: new Set(),
        representativeRowId: null,
      })
    }

    const group = groups.get(coreProductKey)
    group.memberRowIds.add(row.id)
    if (row.is_base_product) {
      group.representativeRowId = row.id
    }
  }

  for (const [coreProductKey, group] of groups) {
    if (group.memberRowIds.size < 2) {
      groups.delete(coreProductKey)
      continue
    }
    if (!group.representativeRowId) {
      group.representativeRowId = [...group.memberRowIds][0]
    }
  }

  return groups
}

function scoreRepresentativeCandidate(product, intelligenceRowsById = new Map()) {
  const sourceIds = product?.source_intelligence_row_ids ?? []
  const hasBaseProduct = sourceIds.some((id) => intelligenceRowsById.get(id)?.is_base_product)
  const sourceCount = sourceIds.length
  const keyLength = String(product?.canonical_product_key ?? '').length

  return { hasBaseProduct, sourceCount, keyLength }
}

function compareRepresentativeCandidates(left, right, intelligenceRowsById = new Map()) {
  const leftScore = scoreRepresentativeCandidate(left, intelligenceRowsById)
  const rightScore = scoreRepresentativeCandidate(right, intelligenceRowsById)

  if (leftScore.hasBaseProduct !== rightScore.hasBaseProduct) {
    return leftScore.hasBaseProduct ? -1 : 1
  }
  if (leftScore.sourceCount !== rightScore.sourceCount) {
    return rightScore.sourceCount - leftScore.sourceCount
  }
  if (leftScore.keyLength !== rightScore.keyLength) {
    return leftScore.keyLength - rightScore.keyLength
  }
  return String(left.canonical_product_key).localeCompare(String(right.canonical_product_key))
}

function pickRepresentativeCanonicalProduct(candidates = [], group, intelligenceRowsById = new Map()) {
  if (!candidates.length) return null
  if (candidates.length === 1) return candidates[0]

  const withRepresentativeRow = candidates.find((product) => (
    (product.source_intelligence_row_ids ?? []).includes(group.representativeRowId)
  ))
  if (withRepresentativeRow) return withRepresentativeRow

  const matchingCoreKey = candidates.find(
    (product) => product.canonical_product_key === group.coreProductKey,
  )
  if (matchingCoreKey) return matchingCoreKey

  return [...candidates].sort(
    (left, right) => compareRepresentativeCandidates(left, right, intelligenceRowsById),
  )[0]
}

function mergeCanonicalProductSiblings(representative, siblings = [], {
  groupKey = null,
  representativeIntelligenceRowId = null,
} = {}) {
  const sourceIds = new Set(representative.source_intelligence_row_ids ?? [])
  for (const sibling of siblings) {
    for (const id of sibling.source_intelligence_row_ids ?? []) {
      sourceIds.add(id)
    }
  }

  const collapsedVariantProductIds = siblings.map((product) => product.id).filter(Boolean)

  return {
    ...representative,
    source_intelligence_row_ids: [...sourceIds],
    collapsed_variant_product_ids: collapsedVariantProductIds,
    collapsed_variant_count: collapsedVariantProductIds.length,
    core_product_group_key: groupKey ?? representative.core_product_group_key ?? null,
    representative_intelligence_row_id: representativeIntelligenceRowId
      ?? representative.representative_intelligence_row_id
      ?? null,
    display_identity_key: buildCanonicalProductDisplayIdentityKey(representative),
  }
}

function mergeCanonicalProductsForGroup(representative, siblings = [], group) {
  return mergeCanonicalProductSiblings(representative, siblings, {
    groupKey: group.coreProductKey,
    representativeIntelligenceRowId: group.representativeRowId,
  })
}

function dedupeCanonicalProductsByCanonicalKey(products = []) {
  const seenKeys = new Set()
  const deduped = []

  for (const product of products) {
    const canonicalKey = String(product.canonical_product_key ?? '').trim()
    if (!canonicalKey) {
      deduped.push(product)
      continue
    }
    if (seenKeys.has(canonicalKey)) continue
    seenKeys.add(canonicalKey)
    deduped.push(product)
  }

  return deduped
}

/**
 * Collapse separate canonical products that share the same public display identity.
 * Fixes cases where console-specific canonical_product_key values were approved separately.
 */
export function dedupeCanonicalProductsByDisplayIdentity(
  products = [],
  intelligenceRowsById = new Map(),
) {
  const groups = new Map()

  for (const product of products) {
    const identityKey = buildCanonicalProductDisplayIdentityKey(product)
    if (!identityKey.endsWith('::')) {
      if (!groups.has(identityKey)) groups.set(identityKey, [])
      groups.get(identityKey).push(product)
    }
  }

  const deduped = []
  const consumedProductIds = new Set()

  for (const [, candidates] of groups) {
    if (candidates.length < 2) continue

    const representative = [...candidates].sort(
      (left, right) => compareRepresentativeCandidates(left, right, intelligenceRowsById),
    )[0]
    const siblings = candidates.filter((product) => product.id !== representative.id)

    for (const product of candidates) {
      consumedProductIds.add(product.id)
    }

    deduped.push(mergeCanonicalProductSiblings(representative, siblings, {
      groupKey: buildCanonicalProductDisplayIdentityKey(representative),
    }))
  }

  for (const product of products) {
    if (!consumedProductIds.has(product.id)) {
      deduped.push(product)
    }
  }

  return deduped
}

/**
 * Collapse approved multi-member core product groups to their representative product.
 */
export function dedupeCanonicalProductsByApprovedCoreGroups(
  products = [],
  intelligenceRowsById = new Map(),
) {
  const approvedGroups = buildApprovedMultiMemberCoreGroupIndex(intelligenceRowsById)
  const consumedProductIds = new Set()
  const deduped = []
  const processedCoreKeys = new Set()

  for (const group of approvedGroups.values()) {
    if (processedCoreKeys.has(group.coreProductKey)) continue

    const candidates = products.filter((product) => {
      if (consumedProductIds.has(product.id)) return false
      const sourceIds = product.source_intelligence_row_ids ?? []
      return sourceIds.some((id) => group.memberRowIds.has(id))
    })

    if (!candidates.length) continue

    const representative = pickRepresentativeCanonicalProduct(candidates, group, intelligenceRowsById)
    if (!representative) continue

    const siblings = candidates.filter((product) => product.id !== representative.id)
    for (const product of candidates) {
      consumedProductIds.add(product.id)
    }
    processedCoreKeys.add(group.coreProductKey)
    deduped.push(mergeCanonicalProductsForGroup(representative, siblings, group))
  }

  for (const product of products) {
    if (!consumedProductIds.has(product.id)) {
      deduped.push(product)
    }
  }

  return deduped
}

/**
 * Full workflow dedupe used by Top 100 and downstream canonical product queues.
 * Order: approved core groups -> display identity -> canonical key safety net.
 */
export function dedupeCanonicalProductsForWorkflow(
  products = [],
  intelligenceRowsById = new Map(),
) {
  const approved = products.filter((product) => product?.status === 'approved')

  const afterCoreGroups = dedupeCanonicalProductsByApprovedCoreGroups(approved, intelligenceRowsById)
  const afterDisplayIdentity = dedupeCanonicalProductsByDisplayIdentity(
    afterCoreGroups,
    intelligenceRowsById,
  )
  return dedupeCanonicalProductsByCanonicalKey(afterDisplayIdentity)
}

export function analyzeCanonicalProductDedupe(
  products = [],
  intelligenceRowsById = new Map(),
) {
  const approved = products.filter((product) => product?.status === 'approved')
  const afterCoreGroups = dedupeCanonicalProductsByApprovedCoreGroups(approved, intelligenceRowsById)
  const afterDisplayIdentity = dedupeCanonicalProductsByDisplayIdentity(
    afterCoreGroups,
    intelligenceRowsById,
  )
  const afterWorkflow = dedupeCanonicalProductsByCanonicalKey(afterDisplayIdentity)

  return {
    rawApproved: approved.length,
    afterCoreGroups: afterCoreGroups.length,
    afterDisplayIdentity: afterDisplayIdentity.length,
    afterWorkflow: afterWorkflow.length,
    products: afterWorkflow,
  }
}
