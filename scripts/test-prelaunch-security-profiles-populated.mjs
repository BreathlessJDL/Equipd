#!/usr/bin/env node
/** Probe profiles with populated sensitive fields */
import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
for (const line of readFileSync(join(ROOT, '.env.local'), 'utf8').split('\n')) {
  const t = line.trim()
  if (!t || t.startsWith('#')) continue
  const i = t.indexOf('=')
  if (i === -1) continue
  process.env[t.slice(0, i).trim()] = t.slice(i + 1).trim().replace(/^['"]|['"]$/g, '')
}

const url = process.env.VITE_SUPABASE_URL.replace(/\/+$/, '')
const anonKey = process.env.VITE_SUPABASE_ANON_KEY
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const admin = createClient(url, serviceKey, { auth: { persistSession: false } })
const anon = createClient(url, anonKey, { auth: { persistSession: false } })

const FIELDS = 'id, stripe_account_id, is_admin, latitude, longitude, stripe_onboarding_complete'

const { data: all } = await admin
  .from('profiles')
  .select(FIELDS)
  .or('stripe_account_id.not.is.null,latitude.not.is.null,is_admin.eq.true')
  .limit(5)

console.log('Profiles with populated sensitive data (service role):')
console.log(JSON.stringify(all, null, 2))

for (const profile of all ?? []) {
  const { data, error } = await anon.from('profiles').select(FIELDS).eq('id', profile.id).maybeSingle()
  console.log(`\nAnon read for ${profile.id}:`)
  console.log(JSON.stringify({ error: error?.message ?? null, data }, null, 2))
}
