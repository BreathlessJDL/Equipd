#!/usr/bin/env node
/**
 * Apply rowers category migration and print verification.
 *
 * Usage:
 *   BUBBLE_IMPORT_ALLOW=true node scripts/apply-rowers-category.mjs
 */

import { createClient } from '@supabase/supabase-js'
import { existsSync, readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

const ROWER_SLUG_PATTERN = '%-rowers-%'

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

async function main() {
  loadEnvFile('.env.local')
  loadEnvFile('.env')

  if (process.env.BUBBLE_IMPORT_ALLOW !== 'true') {
    throw new Error('Set BUBBLE_IMPORT_ALLOW=true')
  }

  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const supabase = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data: beforeCategory } = await supabase
    .from('categories')
    .select('id, slug, name')
    .eq('slug', 'rowers')
    .maybeSingle()

  const categoriesAdded = beforeCategory ? 0 : 1

  const { data: rowersCategory, error: upsertError } = await supabase
    .from('categories')
    .upsert({ name: 'Rowers', slug: 'rowers', sort_order: 145 }, { onConflict: 'slug' })
    .select('id, slug, name')
    .single()

  if (upsertError) throw upsertError

  const { data: otherCategory, error: otherError } = await supabase
    .from('categories')
    .select('id')
    .eq('slug', 'other')
    .single()

  if (otherError) throw otherError

  const { data: toRecategorise, error: listError } = await supabase
    .from('listings')
    .select('id, slug, title')
    .eq('source', 'import')
    .eq('category_id', otherCategory.id)
    .like('slug', ROWER_SLUG_PATTERN)

  if (listError) throw listError

  if (toRecategorise?.length) {
    const { error: updateError } = await supabase
      .from('listings')
      .update({ category_id: rowersCategory.id })
      .eq('source', 'import')
      .eq('category_id', otherCategory.id)
      .like('slug', ROWER_SLUG_PATTERN)

    if (updateError) throw updateError
  }

  const { data: rowerListings, error: verifyError } = await supabase
    .from('listings')
    .select('slug, title, category:categories(slug, name)')
    .like('slug', ROWER_SLUG_PATTERN)
    .order('slug')

  if (verifyError) throw verifyError

  const { count: otherImportCount, error: otherCountError } = await supabase
    .from('listings')
    .select('*', { count: 'exact', head: true })
    .eq('source', 'import')
    .eq('category_id', otherCategory.id)
    .like('slug', ROWER_SLUG_PATTERN)

  if (otherCountError) throw otherCountError

  console.log('=== Rowers category migration ===\n')
  console.log(`Categories added: ${categoriesAdded}`)
  console.log(`Listings recategorised: ${toRecategorise?.length ?? 0}`)
  console.log(`Rower listings now on rowers category: ${rowerListings?.filter((l) => l.category?.slug === 'rowers').length ?? 0}`)
  console.log(`Import rowers still on other: ${otherImportCount ?? 0}\n`)

  console.log('Affected listings:')
  for (const listing of rowerListings ?? []) {
    console.log(`  ${listing.slug} — ${listing.title} [${listing.category?.slug}]`)
  }

  const anonKey = process.env.VITE_SUPABASE_ANON_KEY
  if (anonKey) {
    const anon = createClient(url, anonKey)
    const { data: browseRows, error: browseError } = await anon
      .from('listings')
      .select('id, slug, title, category:categories(slug)')
      .eq('status', 'active')
      .eq('category_id', rowersCategory.id)
      .order('slug')

    console.log('\n=== Verification ===')
    console.log(`Browse filter (category=rowers): ${browseError ? browseError.message : `${browseRows?.length ?? 0} active listing(s)`}`)
    if (!browseError && browseRows?.length) {
      console.log(`  Sample slugs: ${browseRows.slice(0, 3).map((row) => row.slug).join(', ')}`)
    }
  }
}

main().catch((error) => {
  console.error(error.message || error)
  process.exit(1)
})
