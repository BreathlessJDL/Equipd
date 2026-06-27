#!/usr/bin/env node
/**
 * Compare popular category nav slugs against DB category slugs.
 * Usage: node scripts/verify-category-nav-slugs.mjs
 */

import { createClient } from '@supabase/supabase-js'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  POPULAR_CATEGORY_NAV_ITEMS,
  resolvePopularNavTarget,
} from '../src/lib/popularCategoryNav.js'
import { MOBILE_MENU_CATEGORIES } from '../src/lib/mobileMenuCategories.js'
import { parseBrowseFiltersFromSearchParams } from '../src/lib/browseFilters.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')

function loadEnvFile(relativePath) {
  const envPath = path.join(ROOT, relativePath)
  if (!existsSync(envPath)) return
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const index = trimmed.indexOf('=')
    if (index === -1) continue
    const key = trimmed.slice(0, index).trim()
    const value = trimmed.slice(index + 1).trim().replace(/^['"]|['"]$/g, '')
    if (!process.env[key]) process.env[key] = value
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

loadEnvFile('.env.local')

const admin = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
)

const { data: categories, error } = await admin
  .from('categories')
  .select('id, name, slug')
  .order('name')

if (error) throw error

const dbBySlug = new Map((categories ?? []).map((c) => [c.slug, c]))
const categoryItems = POPULAR_CATEGORY_NAV_ITEMS.filter((item) => item.type === 'category')
const ratingItems = POPULAR_CATEGORY_NAV_ITEMS.filter((item) => item.type === 'rating')

function verifySlugSource(source, items) {
  const results = []

  for (const item of items) {
    const slug = item.slug
    const dbMatch = dbBySlug.get(slug)
    const parsed = parseBrowseFiltersFromSearchParams(
      new URLSearchParams(`category=${slug}`),
      categories ?? [],
    )
    const status = dbMatch && parsed.categoryId === dbMatch.id ? 'OK' : 'MISSING'

    results.push({ source, label: item.label, slug, status, dbMatch: dbMatch?.name ?? null })
  }

  return results
}

console.log('DB categories:', categories?.length ?? 0)
console.log('')

const popularResults = verifySlugSource('popular-nav', categoryItems)
const mobileResults = verifySlugSource('mobile-menu', MOBILE_MENU_CATEGORIES)

console.log('=== Popular category nav ===')
for (const row of popularResults) {
  console.log(row)
}

console.log('\n=== Mobile menu categories ===')
for (const row of mobileResults) {
  console.log(row)
}

console.log('\n=== Rating nav items ===')
for (const item of ratingItems) {
  const target = resolvePopularNavTarget(item, categories ?? [])
  const parsed = parseBrowseFiltersFromSearchParams(
    new URLSearchParams(`rating=${item.rating}`),
    categories ?? [],
  )
  assert(parsed.rating === item.rating, `Rating parse failed for ${item.label}`)
  console.log({ label: item.label, href: target.href, parsedRating: parsed.rating, status: 'OK' })
}

console.log('\n=== Rowers ===')
console.log('Popular nav:', categoryItems.some((i) => i.slug === 'rowers') ? 'present' : 'not used')
console.log('Mobile menu:', MOBILE_MENU_CATEGORIES.some((i) => i.slug === 'rowers') ? 'present' : 'not used')
console.log('DB:', dbBySlug.get('rowers') ?? 'missing')

console.log('\n=== Active listing counts (filter sanity) ===')
for (const item of [...categoryItems, ...ratingItems]) {
  const target = resolvePopularNavTarget(item, categories ?? [])
  if (item.type === 'category') {
    const { count } = await admin
      .from('listings')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active')
      .eq('category_id', target.categoryId)
    console.log(`${item.label}: ${count ?? 0} active listings`)
  } else {
    const { count } = await admin
      .from('listings')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active')
      .eq('rating', item.rating)
    console.log(`${item.label}: ${count ?? 0} active listings`)
  }
}

const allResults = [...popularResults, ...mobileResults]
const mismatches = allResults.filter((row) => row.status !== 'OK')

console.log('\n=== Summary ===')
console.log({
  popularNavOk: popularResults.filter((r) => r.status === 'OK').length,
  mobileMenuOk: mobileResults.filter((r) => r.status === 'OK').length,
  mismatches: mismatches.length,
})

if (mismatches.length > 0) {
  console.error('\nMISMATCHES:', mismatches)
  process.exitCode = 1
} else {
  console.log('\nAll category nav slugs match DB and parse correctly.')
}
