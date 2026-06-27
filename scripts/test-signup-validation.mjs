#!/usr/bin/env node
/**
 * Signup validation integration checks (username RPC + password RPC).
 * Run: node scripts/test-signup-validation.mjs
 */

import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import {
  validatePassword,
  validatePasswordWithServer,
} from '../src/lib/passwordPolicy.js'

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
const anonKey = process.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY')
  process.exit(1)
}

const supabase = createClient(url, anonKey)

let passed = 0
let failed = 0

function assert(condition, label) {
  if (condition) {
    passed += 1
    console.log(`PASS ${label}`)
    return
  }

  failed += 1
  console.error(`FAIL ${label}`)
}

const validPassword = 'EquipdTest1!'

const passwordRpc = await supabase.rpc('validate_signup_password', {
  p_password: validPassword,
})
assert(!passwordRpc.error, 'validate_signup_password RPC is available')
assert(passwordRpc.data?.valid === true, 'RPC accepts valid password')

const shortPasswordRpc = await supabase.rpc('validate_signup_password', {
  p_password: 'short1!A',
})
assert(shortPasswordRpc.data?.valid === false, 'RPC rejects short password')
assert(
  shortPasswordRpc.data?.error === 'Password must be at least 10 characters.',
  'RPC returns specific short-password error',
)

const serverValidation = await validatePasswordWithServer(supabase, validPassword)
assert(serverValidation.valid, 'validatePasswordWithServer accepts valid password')

const serverInvalid = await validatePasswordWithServer(supabase, 'EquipdTest1')
assert(!serverInvalid.valid, 'validatePasswordWithServer rejects missing special char')
assert(
  serverInvalid.error === 'At least one special character.',
  'validatePasswordWithServer returns specific requirement error',
)

const takenUsername = await supabase.rpc('is_username_available', {
  p_username: 'Equipd',
})
assert(!takenUsername.error, 'is_username_available RPC is available')
assert(takenUsername.data === false, 'Equipd username is taken (case-insensitive)')

const takenVariant = await supabase.rpc('is_username_available', {
  p_username: 'EQUIPD',
})
assert(takenVariant.data === false, 'EQUIPD matches Equipd case-insensitively')

const freeUsername = await supabase.rpc('is_username_available', {
  p_username: `freeuser${Date.now()}`,
})
assert(freeUsername.data === true, 'unused username is available')

assert(
  validatePassword(validPassword).valid === serverValidation.valid,
  'client and server agree on valid password',
)

console.log(`\n${passed}/${passed + failed} checks passed`)

if (failed > 0) {
  process.exit(1)
}
