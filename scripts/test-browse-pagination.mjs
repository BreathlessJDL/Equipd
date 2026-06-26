#!/usr/bin/env node
/**
 * Verify browse pagination via listings_public_browse.
 */

import { createClient } from '@supabase/supabase-js'
import { existsSync, readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const PAGE_SIZE = 24
const PUBLIC_BROWSE = 'listings_public_browse'
const CARD_FIELDS =
  'id, slug, listing_images(id, storage_path, sort_order)'

function loadEnvFile(relativePath) {
  const path = join(ROOT, relativePath)
  if (!existsSync(path)) return
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const index = trimmed.indexOf('=')
    if (index === -1) continue
    const key = trimmed.slice(0, index).trim()
    const value = trimmed.slice(index + 1).trim().replace(/^['"]|['"]$/g, '')
    if (!process.env[key]) process.env[key] = value
  }
}

function hasImage(listing) {
  return Boolean(listing.listing_images?.[0]?.storage_path)
}

async function fetchPage(client, { offset, search = '' } = {}) {
  let query = client
    .from(PUBLIC_BROWSE)
    .select(CARD_FIELDS)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .order('sort_order', { ascending: true, foreignTable: 'listing_images' })
    .limit(1, { foreignTable: 'listing_images' })
    .range(offset, offset + PAGE_SIZE - 1)

  const trimmed = search.trim()
  if (trimmed) {
    const term = `%${trimmed}%`
    query = query.or(`title.ilike.${term},brand.ilike.${term},model.ilike.${term}`)
  }

  const { data, error } = await query
  if (error) throw error
  return data ?? []
}

async function main() {
  loadEnvFile('.env.local')
  const url = process.env.VITE_SUPABASE_URL
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY
  const client = createClient(url, anonKey)

  const page1 = await fetchPage(client, { offset: 0 })
  const page2 = await fetchPage(client, { offset: 24 })
  const page3 = await fetchPage(client, { offset: 48 })
  const filtered = await fetchPage(client, { offset: 0, search: 'life fitness' })

  const all = [...page1, ...page2, ...page3]
  const unique = new Set(all.map((row) => row.id))

  console.log('Page 1:', page1.length)
  console.log('Page 2:', page2.length)
  console.log('Page 3:', page3.length)
  console.log('Total loaded:', all.length, 'unique:', unique.size)
  console.log('All have images:', all.every(hasImage))
  console.log('Filtered "life fitness" page 1:', filtered.length)

  const ok =
    page1.length === 24 &&
    page2.length === 24 &&
    page3.length === 6 &&
    all.length === 54 &&
    unique.size === 54 &&
    all.every(hasImage)

  if (!ok) {
    console.error('FAIL: browse pagination counts did not match expected 24 + 24 + 6 = 54')
    process.exitCode = 1
    return
  }

  console.log('PASS: browse pagination returns 24, 48, then 54 unique image-backed listings')
}

main().catch((error) => {
  console.error(error.message || error)
  process.exit(1)
})
