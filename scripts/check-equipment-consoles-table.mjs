#!/usr/bin/env node
/**
 * Apply equipment_consoles migration SQL via Postgres connection if DATABASE_URL is set,
 * otherwise print instructions.
 *
 * Prefer: supabase db push / dashboard SQL editor for the migration file.
 * This helper can also upsert Concept2 after tables exist.
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createClient } from '@supabase/supabase-js'

function loadEnv() {
  const path = join(process.cwd(), '.env.local')
  const text = readFileSync(path, 'utf8')
  const env = {}
  for (const line of text.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const idx = trimmed.indexOf('=')
    if (idx === -1) continue
    env[trimmed.slice(0, idx)] = trimmed.slice(idx + 1)
  }
  return env
}

async function main() {
  const env = loadEnv()
  const supabase = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY || env.VITE_SUPABASE_ANON_KEY)

  const { error } = await supabase.from('equipment_consoles').select('id').limit(1)
  if (error) {
    console.error('equipment_consoles not available yet.')
    console.error(error.message)
    console.error('Apply supabase/migrations/20260710220000_equipment_consoles_compat.sql then re-run seed.')
    process.exitCode = 2
    return
  }

  console.log('equipment_consoles is available.')
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
