#!/usr/bin/env node
/**
 * Ensures the profile-images storage bucket exists (service role required).
 * Storage RLS policies still require supabase/profile-images-storage.sql.
 *
 * Run: node scripts/ensure-profile-images-bucket.mjs
 */

import { createClient } from '@supabase/supabase-js'
import { existsSync, readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const PROFILE_IMAGES_BUCKET = 'profile-images'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

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
    if (!process.env[key]) process.env[key] = value
  }
}

loadEnvFile('.env.local')

const url = process.env.VITE_SUPABASE_URL?.replace(/\/+$/, '').replace(/\/rest\/v1$/i, '')
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !serviceRoleKey) {
  console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

const admin = createClient(url, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const { data: existing, error: listError } = await admin.storage.listBuckets()

if (listError) {
  console.error('Failed to list buckets:', listError.message)
  process.exit(1)
}

const bucketExists = existing?.some((bucket) => bucket.name === PROFILE_IMAGES_BUCKET)

if (bucketExists) {
  console.log(`Bucket "${PROFILE_IMAGES_BUCKET}" already exists.`)
  process.exit(0)
}

const { error: createError } = await admin.storage.createBucket(PROFILE_IMAGES_BUCKET, {
  public: true,
  fileSizeLimit: 5 * 1024 * 1024,
  allowedMimeTypes: ['image/jpeg', 'image/png'],
})

if (createError) {
  console.error('Failed to create bucket:', createError.message)
  process.exit(1)
}

console.log(`Created bucket "${PROFILE_IMAGES_BUCKET}".`)
console.log('Run supabase/profile-images-storage.sql in the Supabase SQL Editor for storage RLS policies.')
