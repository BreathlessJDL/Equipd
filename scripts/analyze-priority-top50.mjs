#!/usr/bin/env node
/**
 * Compare legacy top-50 equipment rows vs search-group priority ranking.
 * Usage: node scripts/analyze-priority-top50.mjs
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

function buildPrimaryKeyword(row) {
  const brand = normalizeWhitespace(row.brand ?? '')
  const series = normalizeWhitespace(row.series ?? '')
  const model = stripModelYearRange(row.model ?? '')
  return [brand, series, model].filter(Boolean).join(' ')
}

function buildGroups(rows) {
  const keywordMap = new Map()
  for (const row of rows) {
    const primaryKeyword = buildPrimaryKeyword(row)
    const keywordKey = primaryKeyword.toLowerCase()
    const cluster = keywordMap.get(keywordKey)
    if (cluster) {
      cluster.member_count += 1
      cluster.equipment_ids.push(row.id)
    } else {
      keywordMap.set(keywordKey, {
        primary_keyword: primaryKeyword,
        keyword_key: keywordKey,
        member_count: 1,
        equipment_ids: [row.id],
      })
    }
  }
  return [...keywordMap.values()]
}

function scoreRow(row) {
  const text = [row.brand, row.series, row.model, row.equipment_type, row.category, row.slug]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()

  let score = 0
  if (/\blife fitness\b/.test(text)) score += 40
  else if (/\btechnogym\b/.test(text)) score += 38
  else if (/\bconcept\s*2\b/.test(text)) score += 36
  else if (/\bmatrix\b/.test(text)) score += 32

  if (/\btreadmill\b/.test(text)) score += 25
  else if (/\brower\b|\browing machine\b/.test(text)) score += 24

  if (/\b95\s*-?\s*ti\b/.test(text)) score += 30
  else if (/\bmodel\s*d\b/.test(text)) score += 30
  else if (/\bskill\s*mill\b|\bskillmill\b/.test(text)) score += 28

  if (/\bconsole only\b|\breplacement\b|\bpart\b/.test(text)) score -= 20
  return Math.max(0, score)
}

const env = loadEnv()
const admin = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const allRows = []
let from = 0
while (true) {
  const to = from + 999
  const { data, error, count } = await admin
    .from('equipment_intelligence')
    .select('id, brand, series, model, equipment_type, category, slug', { count: 'exact' })
    .order('id', { ascending: true })
    .range(from, to)
  if (error) throw new Error(error.message)
  allRows.push(...(data ?? []))
  if ((data ?? []).length === 0 || allRows.length >= (count ?? 0)) break
  from += 1000
}

const scoredRows = allRows
  .map((row) => ({ ...row, popularity_score: scoreRow(row) }))
  .sort((a, b) => b.popularity_score - a.popularity_score || `${a.brand} ${a.model}`.localeCompare(`${b.brand} ${b.model}`))

const legacyTop50Rows = scoredRows.slice(0, 50)
const legacyGroups = buildGroups(legacyTop50Rows)

const allGroups = buildGroups(allRows)
  .map((group) => {
    const members = allRows.filter((row) => group.equipment_ids.includes(row.id))
    const bestScore = Math.max(...members.map((row) => scoreRow(row)))
    return { ...group, popularity_score: bestScore }
  })
  .sort((a, b) => b.popularity_score - a.popularity_score || b.member_count - a.member_count)

const newTop50Groups = allGroups.slice(0, 50)
const newEquipmentRows = newTop50Groups.reduce((sum, group) => sum + group.member_count, 0)

console.log('')
console.log('Priority Top 50 comparison')
console.log('')
console.log('LEGACY (top 50 equipment rows, dedupe on execution):')
console.log(`- Equipment rows selected: ${legacyTop50Rows.length}`)
console.log(`- Unique search groups from those rows: ${legacyGroups.length}`)
console.log(`- Apify searches with dedupe ON: ${legacyGroups.length}`)
console.log(`- Apify searches with dedupe OFF: ${legacyTop50Rows.length}`)
console.log('')
console.log('NEW (top 50 unique search groups):')
console.log(`- Unique search groups selected: ${newTop50Groups.length}`)
console.log(`- Equipment rows covered: ${newEquipmentRows}`)
console.log(`- Apify searches executed: ${newTop50Groups.length}`)
console.log('')
