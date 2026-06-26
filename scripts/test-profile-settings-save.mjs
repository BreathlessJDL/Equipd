#!/usr/bin/env node
/**
 * Diagnose Settings profile save using app profile helpers.
 * Run: node scripts/test-profile-settings-save.mjs
 */

import { existsSync, readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const DEV_EMAIL = 'dev-seller-leeds@equipd.dev'
const DEV_PASSWORD = 'EquipdDevSeed123!'

function loadEnvFile(relativePath) {
  const path = join(ROOT, relativePath)
  if (!existsSync(path)) return

  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const index = trimmed.indexOf('=')
    if (index === -1) continue
    const key = trimmed.slice(0, index).trim()
    const value = trimmed.slice(index + 1).trim().replace(/^['"]|['"]$/g, '')
    process.env[key] = value
  }
}

function log(label, value) {
  console.log(`${label}:`, typeof value === 'string' ? value : JSON.stringify(value, null, 2))
}

loadEnvFile('.env.local')

const url = process.env.VITE_SUPABASE_URL?.replace(/\/+$/, '').replace(/\/rest\/v1$/i, '')
const anonKey = process.env.VITE_SUPABASE_ANON_KEY

const { supabase } = await import('../src/lib/supabase.js')
await supabase.auth.signInWithPassword({ email: DEV_EMAIL, password: DEV_PASSWORD })
const userId = (await supabase.auth.getUser()).data.user.id

const { fetchProfile, updateProfile, supportsUsername, supportsProfileLocationColumns } =
  await import('../src/lib/profiles.js')
const { uploadProfileImage } = await import('../src/lib/profileImages.js')
const { buildProfileLocationPayload } = await import('../src/lib/listingLocation.js')

log('supportsUsername', await supportsUsername())
log('supportsProfileLocationColumns', await supportsProfileLocationColumns())

const { data: profile, error: fetchError } = await fetchProfile(userId, { email: DEV_EMAIL })
log('fetchProfile', fetchError?.message || 'ok', profile?.username)

const testUsername = `app_${Date.now().toString(36).slice(-6)}`
const locationPayload = buildProfileLocationPayload({
  locationPlace: null,
  locationText: profile?.location || '',
})

const { data: updated, error: updateError } = await updateProfile(userId, {
  username: testUsername,
  avatar_url: profile?.avatar_url || null,
  location: locationPayload.location,
  city: locationPayload.city,
  county: locationPayload.county,
  postcode: locationPayload.postcode,
  latitude: locationPayload.latitude,
  longitude: locationPayload.longitude,
})

log('updateProfile (settings payload)', updateError?.message || 'ok', updated?.username)

const blob = new Blob(['fake'], { type: 'image/jpeg' })
const upload = await uploadProfileImage({ userId, file: blob })
log('uploadProfileImage', upload.error?.message || upload.data?.publicUrl)

await updateProfile(userId, { username: profile?.username ?? null })
