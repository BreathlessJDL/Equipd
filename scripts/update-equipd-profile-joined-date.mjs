#!/usr/bin/env node
/**
 * Set Equipd account profile joined date to August 2025.
 * Run: node scripts/update-equipd-profile-joined-date.mjs
 */

import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')

function loadEnvFile(filename) {
  const filePath = path.join(root, filename)
  if (!fs.existsSync(filePath)) return

  for (const line of fs.readFileSync(filePath, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const index = trimmed.indexOf('=')
    if (index === -1) continue
    const key = trimmed.slice(0, index).trim()
    const value = trimmed.slice(index + 1).trim()
    if (!process.env[key]) process.env[key] = value
  }
}

loadEnvFile('.env.local')
loadEnvFile('.env')

const url = process.env.VITE_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !serviceKey) {
  console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(url, serviceKey)
const joinedAt = '2025-08-15T12:00:00+00:00'

const { data: before, error: readError } = await supabase
  .from('profiles')
  .select('id, username, created_at')
  .ilike('username', 'equipd')
  .maybeSingle()

if (readError) {
  console.error('Failed to read Equipd profile:', readError.message)
  process.exit(1)
}

if (!before) {
  console.error('Equipd profile not found')
  process.exit(1)
}

const { error: updateError } = await supabase
  .from('profiles')
  .update({ created_at: joinedAt })
  .eq('id', before.id)

if (updateError) {
  console.error('Failed to update Equipd profile:', updateError.message)
  process.exit(1)
}

const { data: after } = await supabase
  .from('profiles')
  .select('id, username, created_at')
  .eq('id', before.id)
  .maybeSingle()

console.log('Updated Equipd profile joined date')
console.log('Before:', before.created_at)
console.log('After:', after?.created_at)
