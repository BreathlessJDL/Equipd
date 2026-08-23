#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

function loadEnvFile(filename) {
  const filePath = join(ROOT, filename)
  if (!existsSync(filePath)) return
  for (const line of readFileSync(filePath, 'utf8').split('\n')) {
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

function isMissingRpc(error) {
  return Boolean(error?.message && /could not find the function|schema cache/i.test(error.message))
}

async function main() {
  const supabaseUrl = process.env.VITE_SUPABASE_URL
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const adminEmail = process.env.ADMIN_TEST_EMAIL
  const adminPassword = process.env.ADMIN_TEST_PASSWORD

  if (!supabaseUrl || !anonKey || !serviceKey || !adminEmail || !adminPassword) {
    console.log('test-admin-messages-live: skipped (missing env)')
    return
  }

  const authedAdmin = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const signIn = await authedAdmin.auth.signInWithPassword({ email: adminEmail, password: adminPassword })
  if (signIn.error) {
    console.log(`test-admin-messages-live: skipped (${signIn.error.message})`)
    return
  }

  const { error } = await authedAdmin.rpc('admin_list_conversations', {
    p_query: null,
    p_limit: 1,
    p_offset: 0,
  })

  if (isMissingRpc(error)) {
    console.log('test-admin-messages-live: skipped (admin RPCs not applied yet)')
    return
  }

  if (error) throw new Error(error.message)
  console.log('test-admin-messages-live: admin_list_conversations reachable')
}

main().catch((error) => {
  console.error(error.message || error)
  process.exit(1)
})
