#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js'
import { existsSync, readFileSync } from 'fs'
import { join } from 'path'

const ROOT = join(import.meta.dirname, '..')
const DEV_PASSWORD = 'EquipdDev2026!'

function loadEnv() {
  const path = join(ROOT, '.env.local')
  if (!existsSync(path)) return
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const index = trimmed.indexOf('=')
    if (index === -1) continue
    const key = trimmed.slice(0, index)
    const value = trimmed.slice(index + 1).replace(/^['"]|['"]$/g, '')
    if (!process.env[key]) process.env[key] = value
  }
}

async function signInAdmin(adminClient, supabaseUrl, anonKey, email, password) {
  const authed = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const passwordAttempt = await authed.auth.signInWithPassword({ email, password })
  if (!passwordAttempt.error && passwordAttempt.data.session?.access_token) {
    return passwordAttempt.data.session.access_token
  }

  const { data: profile, error: profileError } = await adminClient
    .from('profiles')
    .select('id')
    .eq('is_admin', true)
    .limit(1)
    .maybeSingle()

  if (profileError || !profile?.id) {
    throw new Error(passwordAttempt.error?.message ?? profileError?.message ?? 'no admin profile')
  }

  const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
    type: 'magiclink',
    email,
  })
  if (linkError) throw linkError

  const otp = linkData.properties.email_otp
  const { data: otpData, error: otpError } = await authed.auth.verifyOtp({
    email,
    token: otp,
    type: 'email',
  })
  if (otpError || !otpData.session?.access_token) {
    throw new Error(otpError?.message ?? 'OTP sign-in failed')
  }
  return otpData.session.access_token
}

async function main() {
  loadEnv()
  const equipmentId = process.argv[2] ?? '433f33f9-f2b1-494b-9749-bcee9618226d'
  const engine = process.argv[3] ?? 'v3'

  const supabaseUrl = process.env.VITE_SUPABASE_URL?.replace(/\/+$/, '')
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const adminEmail = process.env.ADMIN_TEST_EMAIL
  const adminPassword = process.env.ADMIN_TEST_PASSWORD || DEV_PASSWORD

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const token = await signInAdmin(adminClient, supabaseUrl, anonKey, adminEmail, adminPassword)
  const started = Date.now()

  const response = await fetch(`${supabaseUrl}/functions/v1/intelligence-equipment-research`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: anonKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      equipment_id: equipmentId,
      research_engine: engine,
    }),
  })

  const text = await response.text()
  const elapsed = Date.now() - started

  console.log(`status: ${response.status}`)
  console.log(`elapsed_ms: ${elapsed}`)
  console.log(`response_bytes: ${text.length}`)

  try {
    const body = JSON.parse(text)
    if (body.debug_log?.timings) {
      console.log('timings:', JSON.stringify(body.debug_log.timings, null, 2))
    }
    if (body.debug_log?.progress_log) {
      console.log('progress_log:', body.debug_log.progress_log.join(' -> '))
    }
    if (body.error) console.log('error:', body.error)
    if (body.code) console.log('code:', body.code)
    if (body.message) console.log('message:', body.message)
  } catch {
    console.log(text.slice(0, 4000))
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
