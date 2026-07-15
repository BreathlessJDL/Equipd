#!/usr/bin/env node
/**
 * Analyze duplicate eBay search groups across equipment_intelligence.
 * Usage: node scripts/analyze-ebay-search-groups.mjs [--brand "Life Fitness"]
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

function loadEnv() {
  const path = join(process.cwd(), '.env.local')
  const text = readFileSync(path, 'utf8')
  const env = {}
  for (const line of text.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const idx = trimmed.indexOf('=')
    if (idx === -1) continue
    env[trimmed.slice(0, idx)] = trimmed.slice(idx + 1)
  }
  return env
}

function normalizeWhitespace(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim()
}

function stripModelYearRange(model) {
  return normalizeWhitespace(
    String(model ?? '').replace(/\(\s*\d{4}\s*[-–]\d{4}\s*\)/gi, ''),
  )
}

function normalizeEbaySearchBrand(brand) {
  const normalized = normalizeWhitespace(brand)
  if (!normalized) return ''
  const key = normalized.toLowerCase().replace(/[^a-z0-9]/g, '')
  if (key === 'concept2' || key === 'conceptii') return 'Concept2'
  return normalized
}

function buildPrimaryKeyword(row) {
  const brand = normalizeEbaySearchBrand(row.brand ?? '')
  const series = normalizeWhitespace(row.series ?? '')
  const model = stripModelYearRange(row.model ?? '')
  return [brand, series, model].filter(Boolean).join(' ')
}

function buildSearchGroupDescriptor(row) {
  const brand = normalizeEbaySearchBrand(row.brand ?? '')
  const series = normalizeWhitespace(row.series ?? '') || null
  const model = stripModelYearRange(row.model ?? '')
  const equipmentType = normalizeWhitespace(row.equipment_type ?? '') || null
  const primaryKeyword = buildPrimaryKeyword(row)

  const groupKey = [brand, series ?? '', model, equipmentType ?? '']
    .map((value) => value.toLowerCase())
    .join('\u0001')

  const label = [brand, series, model, equipmentType].filter(Boolean).join(' ')

  return {
    group_key: groupKey,
    label,
    primary_keyword: primaryKeyword,
    keyword_key: primaryKeyword.toLowerCase(),
  }
}

function analyzeEquipmentSearchGroups(rows) {
  const descriptorMap = new Map()
  const keywordMap = new Map()

  for (const row of rows) {
    const descriptor = buildSearchGroupDescriptor(row)
    const member = {
      equipment_id: row.id,
      slug: row.slug,
      manufacture_year: row.manufacture_year ?? null,
      raw_model: row.model,
    }

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

  const descriptorGroups = [...descriptorMap.values()].sort((left, right) => {
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
  const dedupedSearches = keywordGroups.length
  const savings = Math.max(0, totalRows - dedupedSearches)
  const savingsPercent = totalRows > 0
    ? Math.round((savings / totalRows) * 1000) / 10
    : 0

  return {
    total_equipment_rows: totalRows,
    unique_descriptor_groups: descriptorGroups.length,
    unique_primary_keywords: keywordGroups.length,
    current_apify_searches_required: totalRows,
    deduped_apify_searches_required: dedupedSearches,
    apify_search_savings: savings,
    apify_search_savings_percent: savingsPercent,
    largest_descriptor_groups: descriptorGroups.slice(0, 25),
    largest_keyword_groups: keywordGroups.slice(0, 25),
  }
}

const SUPABASE_MAX_PAGE_SIZE = 1000
const brandArgIndex = process.argv.indexOf('--brand')
const brandFilter = brandArgIndex >= 0 ? process.argv[brandArgIndex + 1]?.trim() : null

const env = loadEnv()
const admin = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

async function fetchAllRows() {
  const allRows = []
  let from = 0
  let totalCount = 0

  while (true) {
    const to = from + SUPABASE_MAX_PAGE_SIZE - 1
    let query = admin
      .from('equipment_intelligence')
      .select('id, brand, series, model, equipment_type, slug, manufacture_year', {
        count: 'exact',
      })
      .order('id', { ascending: true })
      .range(from, to)

    if (brandFilter) {
      query = query.eq('brand', brandFilter)
    }

    const { data, error, count } = await query
    if (error) throw new Error(error.message)

    if (totalCount === 0) totalCount = count ?? 0

    const page = data ?? []
    allRows.push(...page)

    if (page.length === 0 || allRows.length >= totalCount) break
    from += SUPABASE_MAX_PAGE_SIZE
  }

  return { rows: allRows, totalCount }
}

function formatGroupLine(group) {
  return `- ${group.label} (${group.member_count} rows) — keyword: "${group.primary_keyword}"`
}

function formatKeywordLine(group) {
  const label = group.labels.length === 1
    ? group.labels[0]
    : `${group.labels[0]} (+${group.labels.length - 1} descriptor variant${group.labels.length > 2 ? 's' : ''})`
  return `- ${label} (${group.member_count} rows) — keyword: "${group.primary_keyword}"`
}

const { rows, totalCount } = await fetchAllRows()
const analysis = analyzeEquipmentSearchGroups(rows)

console.log('')
console.log('eBay Search Group Analysis')
if (brandFilter) {
  console.log(`Brand filter: ${brandFilter}`)
}
console.log('')
console.log(`Total equipment rows: ${analysis.total_equipment_rows}`)
console.log(`Rows in table count: ${totalCount}`)
console.log(`Unique descriptor groups (brand + series + model + type): ${analysis.unique_descriptor_groups}`)
console.log(`Unique search groups (primary keyword): ${analysis.unique_primary_keywords}`)
console.log('')
console.log('Apify cost estimate:')
console.log(`- Current (1 search per row): ${analysis.current_apify_searches_required}`)
console.log(`- After deduplicating search groups: ${analysis.deduped_apify_searches_required}`)
console.log(`- Estimated savings: ${analysis.apify_search_savings} searches (${analysis.apify_search_savings_percent}%)`)
console.log('')
console.log('Largest duplicate descriptor groups:')
for (const group of analysis.largest_descriptor_groups.slice(0, 15)) {
  if (group.member_count <= 1) break
  console.log(formatGroupLine(group))
}
console.log('')
console.log('Largest duplicate keyword groups (Apify dedupe):')
for (const group of analysis.largest_keyword_groups.slice(0, 15)) {
  if (group.member_count <= 1) break
  console.log(formatKeywordLine(group))
}
console.log('')
