#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
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

const admin = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})
const listingId = 'cce2b633-6203-4204-b9d3-b2ca681f4f09'
const slug = 'test-listing-title-c8e92a10'

for (const [table, field, value] of [
  ['listings', 'slug', slug],
  ['listing_fulfilment_private', 'listing_id', listingId],
  ['listing_images', 'listing_id', listingId],
]) {
  const { count, error } = await admin.from(table).select('*', { count: 'exact', head: true }).eq(field, value)
  console.log(table, { count, error: error?.message })
}
