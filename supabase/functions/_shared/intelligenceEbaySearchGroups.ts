import {
  buildEbaySoldSearchQuery,
  normalizeEbaySearchBrand,
  stripModelYearRange,
} from './intelligenceEbaySoldSearch.ts'
import {
  normalizeWhitespace,
  type EquipmentIntelligenceRow,
} from './intelligenceMarketSearch.ts'

export type SearchGroupEquipmentRow = EquipmentIntelligenceRow & {
  manufacture_year?: number | null
}

export type SearchGroupDescriptor = {
  group_key: string
  label: string
  brand: string
  series: string | null
  model: string
  equipment_type: string | null
  primary_keyword: string
  keyword_key: string
}

export type SearchGroupMember = {
  equipment_id: string
  slug: string
  manufacture_year?: number | null
  raw_model: string
}

export type SearchGroupCluster = SearchGroupDescriptor & {
  members: SearchGroupMember[]
  member_count: number
}

export type SearchGroupAnalysis = {
  total_equipment_rows: number
  unique_descriptor_groups: number
  unique_primary_keywords: number
  current_apify_searches_required: number
  deduped_apify_searches_required: number
  apify_search_savings: number
  apify_search_savings_percent: number
  largest_descriptor_groups: Array<{
    label: string
    member_count: number
    primary_keyword: string
    equipment_ids: string[]
  }>
  largest_keyword_groups: Array<{
    primary_keyword: string
    member_count: number
    labels: string[]
    equipment_ids: string[]
  }>
  descriptor_groups: SearchGroupCluster[]
  keyword_groups: Array<SearchGroupCluster & { labels: string[] }>
}

export function normalizeEquipmentForSearchGroup(
  equipment: SearchGroupEquipmentRow,
): SearchGroupEquipmentRow {
  return {
    ...equipment,
    model: stripModelYearRange(equipment.model ?? ''),
  }
}

export function buildSearchGroupDescriptor(
  equipment: SearchGroupEquipmentRow,
): SearchGroupDescriptor {
  const normalized = normalizeEquipmentForSearchGroup(equipment)
  const brand = normalizeEbaySearchBrand(normalized.brand ?? '')
  const series = normalizeWhitespace(normalized.series ?? '') || null
  const model = normalizeWhitespace(normalized.model ?? '')
  const equipmentType = normalizeWhitespace(normalized.equipment_type ?? '') || null
  const primaryKeyword = buildEbaySoldSearchQuery(normalized)

  const groupKey = [brand, series ?? '', model, equipmentType ?? '']
    .map((value) => value.toLowerCase())
    .join('\u0001')

  const label = [brand, series, model, equipmentType].filter(Boolean).join(' ')

  return {
    group_key: groupKey,
    label,
    brand,
    series,
    model,
    equipment_type: equipmentType,
    primary_keyword: primaryKeyword,
    keyword_key: primaryKeyword.toLowerCase(),
  }
}

export function buildSearchGroupMember(
  equipment: SearchGroupEquipmentRow,
): SearchGroupMember {
  return {
    equipment_id: equipment.id,
    slug: equipment.slug,
    manufacture_year: equipment.manufacture_year ?? null,
    raw_model: equipment.model,
  }
}

export function analyzeEquipmentSearchGroups(
  rows: SearchGroupEquipmentRow[],
): SearchGroupAnalysis {
  const descriptorMap = new Map<string, SearchGroupCluster>()
  const keywordMap = new Map<string, SearchGroupCluster & { labels: Set<string> }>()

  for (const row of rows) {
    const descriptor = buildSearchGroupDescriptor(row)
    const member = buildSearchGroupMember(row)

    const descriptorCluster = descriptorMap.get(descriptor.group_key)
    if (descriptorCluster) {
      descriptorCluster.members.push(member)
      descriptorCluster.member_count += 1
    } else {
      descriptorMap.set(descriptor.group_key, {
        ...descriptor,
        members: [member],
        member_count: 1,
      })
    }

    const keywordCluster = keywordMap.get(descriptor.keyword_key)
    if (keywordCluster) {
      keywordCluster.members.push(member)
      keywordCluster.member_count += 1
      keywordCluster.labels.add(descriptor.label)
    } else {
      keywordMap.set(descriptor.keyword_key, {
        ...descriptor,
        labels: new Set([descriptor.label]),
        members: [member],
        member_count: 1,
      })
    }
  }

  const descriptorGroups = [...descriptorMap.values()]
    .sort((left, right) => {
      if (right.member_count !== left.member_count) {
        return right.member_count - left.member_count
      }
      return left.label.localeCompare(right.label)
    })

  const keywordGroups = [...keywordMap.values()]
    .map((group) => ({
      ...group,
      labels: [...group.labels].sort((a, b) => a.localeCompare(b)),
    }))
    .sort((left, right) => {
      if (right.member_count !== left.member_count) {
        return right.member_count - left.member_count
      }
      return left.primary_keyword.localeCompare(right.primary_keyword)
    })

  const totalRows = rows.length
  const uniqueDescriptorGroups = descriptorGroups.length
  const uniquePrimaryKeywords = keywordGroups.length
  const dedupedSearches = uniquePrimaryKeywords
  const savings = Math.max(0, totalRows - dedupedSearches)
  const savingsPercent = totalRows > 0
    ? Math.round((savings / totalRows) * 1000) / 10
    : 0

  return {
    total_equipment_rows: totalRows,
    unique_descriptor_groups: uniqueDescriptorGroups,
    unique_primary_keywords: uniquePrimaryKeywords,
    current_apify_searches_required: totalRows,
    deduped_apify_searches_required: dedupedSearches,
    apify_search_savings: savings,
    apify_search_savings_percent: savingsPercent,
    largest_descriptor_groups: descriptorGroups.slice(0, 25).map((group) => ({
      label: group.label,
      member_count: group.member_count,
      primary_keyword: group.primary_keyword,
      equipment_ids: group.members.map((member) => member.equipment_id),
    })),
    largest_keyword_groups: keywordGroups.slice(0, 25).map((group) => ({
      primary_keyword: group.primary_keyword,
      member_count: group.member_count,
      labels: group.labels,
      equipment_ids: group.members.map((member) => member.equipment_id),
    })),
    descriptor_groups: descriptorGroups,
    keyword_groups: keywordGroups,
  }
}

export function buildKeywordSearchGroups(
  rows: SearchGroupEquipmentRow[],
): Array<SearchGroupCluster & { labels: string[] }> {
  return analyzeEquipmentSearchGroups(rows).keyword_groups
}
