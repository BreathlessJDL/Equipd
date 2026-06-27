#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
for (const line of readFileSync(path.join(ROOT, '.env.local'), 'utf8').split('\n')) {
  const t = line.trim()
  if (!t || t.startsWith('#')) continue
  const i = t.indexOf('=')
  if (i < 0) continue
  const k = t.slice(0, i).trim()
  const v = t.slice(i + 1).trim().replace(/^['"]|['"]$/g, '')
  if (!process.env[k]) process.env[k] = v
}

const admin = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
)

const sellerId = '11111111-1111-4111-8111-111111111101'

const { data: profile } = await admin.from('profiles').select('id, display_name, username, location').eq('id', sellerId).maybeSingle()
const { data: listings } = await admin.from('listings').select('id, title, slug, status').eq('seller_id', sellerId)

async function browseQuery(filters) {
  const { data, error } = await admin.from('listings_public_browse').select('id, title, slug, status').match(filters)
  if (error?.code === '42P01') return null
  if (error) throw error
  return data
}

const browseJames = await browseQuery({ seller_id: sellerId })
const searchCourier = await admin.from('listings').select('id, title, status').eq('status', 'active').ilike('title', '%Collection + courier%')

console.log('Profile:', profile)
console.log('Remaining James Porter listings:', listings)
console.log('James Porter active browse listings:', browseJames)
console.log('Active Collection + courier matches:', searchCourier.data)
