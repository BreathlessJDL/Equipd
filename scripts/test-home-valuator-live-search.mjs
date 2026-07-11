#!/usr/bin/env node
/**
 * Ranking checks for homepage valuator queries against the live approved catalogue.
 */
import assert from 'node:assert/strict'
import { createClient } from '@supabase/supabase-js'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { resolveValuationSearchMatches, getEquipmentProductDisplayName } from '../src/lib/equipmentValuation.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const LIMIT = 6

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

loadEnvFile('.env.local')
loadEnvFile('.env')

const supabaseUrl = (process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '')
  .replace(/\/+$/, '')
  .replace(/\/rest\/v1$/i, '')
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials in .env.local')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

function topNames(matches) {
  return matches.slice(0, LIMIT).map((p) => getEquipmentProductDisplayName(p))
}

function firstMatchIncludes(matches, needle) {
  const name = getEquipmentProductDisplayName(matches[0] || {}).toLowerCase()
  return name.includes(String(needle).toLowerCase())
}

const { data: products, error } = await supabase
  .from('equipment_products')
  .select('id, brand, model, equipment_type, canonical_product_name, canonical_product_key, production_start_year, production_end_year, baseline_manufacture_year, image_url, status, product_family')
  .eq('status', 'approved')
  .limit(2000)

if (error) {
  console.error(error)
  process.exit(1)
}

assert.ok((products?.length ?? 0) > 100, 'expected a populated approved catalogue')

const cases = [
  {
    query: 'Life Fitness 95T',
    assert: (matches) => {
      assert.ok(matches.length > 0)
      const limited = matches.slice(0, LIMIT)
      assert.ok(limited.length <= LIMIT)
      assert.ok(
        firstMatchIncludes(limited, '95T') || firstMatchIncludes(limited, '95t'),
        `expected 95T near top, got: ${topNames(limited).join(' | ')}`,
      )
    },
  },
  {
    query: 'Technogym Excite Run',
    assert: (matches) => {
      assert.ok(matches.length > 0)
      const hay = topNames(matches).join(' ').toLowerCase()
      assert.ok(hay.includes('excite') || hay.includes('run'), hay)
    },
  },
  {
    query: 'Matrix Performance Plus Treadmill',
    assert: (matches) => {
      assert.ok(matches.length > 0)
      const hay = topNames(matches).join(' ').toLowerCase()
      assert.ok(hay.includes('matrix'), hay)
    },
  },
  {
    query: 'Precor P82',
    assert: (matches) => {
      // Console-only queries may return zero model matches; do not fail hard.
      if (!matches.length) {
        console.log('    note: no Precor P82 model match in approved catalogue')
        return
      }
      const hay = topNames(matches).join(' ').toLowerCase()
      assert.ok(hay.includes('p82') || hay.includes('precor'), hay)
    },
  },
  {
    query: 'Concept2 PM5',
    assert: (matches) => {
      if (!matches.length) {
        console.log('    note: no Concept2 PM5 model match in approved catalogue')
        return
      }
      const hay = topNames(matches).join(' ').toLowerCase()
      assert.ok(hay.includes('concept') || hay.includes('pm5'), hay)
    },
  },
  {
    query: 'Life Fit',
    assert: (matches) => {
      assert.ok(matches.length > 0)
      assert.ok(matches.slice(0, LIMIT).length <= LIMIT)
    },
  },
  {
    query: 'Matrix',
    assert: (matches) => {
      assert.ok(matches.length > 0)
      assert.ok(matches.slice(0, LIMIT).every((p) => (
        /matrix/i.test(p.brand || '') || /matrix/i.test(getEquipmentProductDisplayName(p))
      )))
    },
  },
  {
    query: 'zzzz-invalid-equipd-xyz',
    assert: (matches, state) => {
      assert.equal(matches.length, 0)
      assert.equal(state.showNoMatch, true)
    },
  },
]

for (const testCase of cases) {
  const state = resolveValuationSearchMatches(products, testCase.query)
  const matches = (state.scoredMatches.length
    ? state.scoredMatches.map((entry) => entry.product)
    : state.matches)
  testCase.assert(matches, state)
  console.log(`ok  ${testCase.query} → ${matches.slice(0, LIMIT).length} shown (of ${matches.length})`)
  if (matches.length) {
    console.log(`    top: ${topNames(matches).slice(0, 3).join(' · ')}`)
  }
}

console.log('live homepage valuator ranking checks passed')
