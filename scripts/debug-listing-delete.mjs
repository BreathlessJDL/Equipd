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

const listingId = 'cce2b633-6203-4204-b9d3-b2ca681f4f09'
const authed = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
})

const { data: auth, error: authError } = await authed.auth.signInWithPassword({
  email: 'dev-seller-leeds@equipd.dev',
  password: 'EquipdDevSeed123!',
})
console.log('auth', auth?.user?.id, authError?.message)

const { data: canRead, error: readError } = await authed
  .from('listing_fulfilment_private')
  .select('*')
  .eq('listing_id', listingId)
console.log('read fulfilment', canRead, readError?.message)

const { data: deleted, error: delError } = await authed
  .from('listing_fulfilment_private')
  .delete()
  .eq('listing_id', listingId)
  .select()
console.log('delete fulfilment', deleted, delError?.message)

const admin = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

const { data: adminDel, error: adminDelError } = await admin
  .from('listing_fulfilment_private')
  .delete()
  .eq('listing_id', listingId)
  .select()
console.log('admin delete fulfilment', adminDel, adminDelError?.message)

const { data: listingDel, error: listingDelError } = await authed
  .from('listings')
  .delete()
  .eq('id', listingId)
  .select()
console.log('delete listing', listingDel, listingDelError?.message)
