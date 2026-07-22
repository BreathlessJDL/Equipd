#!/usr/bin/env node
/**
 * Verify archived test listings are invisible to anonymous marketplace clients.
 * Uses the anon key so results match homepage/browse/search/brand/location/API.
 */

import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

function loadEnvFile(relativePath) {
  if (!existsSync(relativePath)) return
  for (const line of readFileSync(relativePath, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/)
    if (!match) continue
    let value = match[2]
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (!process.env[match[1]]) process.env[match[1]] = value
  }
}

loadEnvFile('.env.local')
loadEnvFile('.env')

const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
const anonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY

if (!url || !anonKey) {
  console.error('Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY.')
  process.exit(1)
}

const anon = createClient(url, anonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const ARCHIVED_IDS = [
  'c954bdbe-79de-4c67-b07b-3ced634a431c',
  'd56b044c-e48e-4dcd-a32e-0905e6748b03',
  'cd6b9b21-55a0-448b-b6c2-2651a45b3690',
  '833fcfdc-5267-4127-a225-16e18aded2b3',
  '4f98c8ce-9103-4133-bd9a-9bff7dfeca12',
  'bcd72dd9-45c1-4257-95a8-ce9bfe1393f8',
  'c59a0b37-ea70-43e5-bfda-11316e92bcdc',
  'b1b2e322-0f74-4cad-8a34-03ec5e712448',
  '075bc2b4-7c72-4e96-8d71-c373a24b19f2',
  '7c7e9330-b632-4dbd-9bab-5548de8f508e',
]

async function main() {
  const failures = []

  // 1. Direct anon fetch by id (covers listing detail pages / API responses).
  const { data: directRows, error: directError } = await anon
    .from('listings')
    .select('id, title, status')
    .in('id', ARCHIVED_IDS)
  if (directError) throw new Error(`direct: ${directError.message}`)
  if (directRows.length > 0) {
    failures.push({ check: 'anon direct id fetch', visible: directRows })
  }

  // 2. Public browse view (homepage / browse / brand / location surfaces).
  const { data: browseRows, error: browseError } = await anon
    .from('listings_public_browse')
    .select('id, title')
    .in('id', ARCHIVED_IDS)
  if (browseError) throw new Error(`browse view: ${browseError.message}`)
  if (browseRows.length > 0) {
    failures.push({ check: 'listings_public_browse by id', visible: browseRows })
  }

  // 3. Search-style title queries an anonymous client would run.
  const searchTerms = ['test', 'qa', 'dummy', 'sample']
  const searchHits = []
  for (const term of searchTerms) {
    const { data, error } = await anon
      .from('listings_public_browse')
      .select('id, title')
      .ilike('title', `%${term}%`)
    if (error) throw new Error(`search '${term}': ${error.message}`)
    for (const row of data) {
      // Word-boundary confirmation to ignore incidental substrings.
      if (new RegExp(`\\b${term}\\b`, 'i').test(row.title)) {
        searchHits.push({ term, ...row })
      }
    }
  }
  if (searchHits.length > 0) {
    failures.push({ check: 'anon title search', visible: searchHits })
  }

  // 4. Full browse scan: no publicly visible listing with a test-pattern title.
  const { data: allBrowse, error: allError } = await anon
    .from('listings_public_browse')
    .select('id, title')
  if (allError) throw new Error(`full browse: ${allError.message}`)
  const patternHits = allBrowse.filter((row) =>
    /\b(test|testing|qa|dummy|sample)\b/i.test(row.title || ''),
  )
  if (patternHits.length > 0) {
    failures.push({ check: 'full public browse scan', visible: patternHits })
  }

  const report = {
    verified_at: new Date().toISOString(),
    archived_ids_checked: ARCHIVED_IDS.length,
    publicly_visible_listings_total: allBrowse.length,
    passed: failures.length === 0,
    failures,
  }

  mkdirSync('reports/test-listing-cleanup', { recursive: true })
  writeFileSync(
    'reports/test-listing-cleanup/verification.json',
    JSON.stringify(report, null, 2),
  )
  console.log(JSON.stringify(report, null, 2))
  if (failures.length > 0) process.exit(1)
}

main().catch((error) => {
  console.error(`FAIL: ${error.message}`)
  process.exit(1)
})
