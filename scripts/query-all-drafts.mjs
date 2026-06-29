#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

function loadEnvFile(path) {
  if (!existsSync(path)) return
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const index = trimmed.indexOf('=')
    if (index === -1) continue
    process.env[trimmed.slice(0, index).trim()] = trimmed
      .slice(index + 1)
      .trim()
      .replace(/^['"]|['"]$/g, '')
  }
}

loadEnvFile('.env.local')
const admin = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

const { data: drafts } = await admin
  .from('listings')
  .select('slug, title, status, seller_id, updated_at')
  .eq('status', 'draft')
  .order('updated_at', { ascending: false })
  .limit(20)

console.log('Draft listings in DB:', drafts?.length ?? 0)
for (const row of drafts ?? []) {
  console.log(`- ${row.slug} | ${row.status} | ${row.title}`)
}

const { data: profiles } = await admin
  .from('profiles')
  .select('id, display_name, username')
  .in('id', [...new Set((drafts ?? []).map((d) => d.seller_id))])

console.log('\nSellers with drafts:', profiles)
