#!/usr/bin/env node
/**
 * Remove QA CAROUSEL SEED reviews and synthetic marketplace rows.
 *
 * Usage:
 *   QA_CAROUSEL_SEED_CONFIRM=true node scripts/cleanup-qa-carousel-reviews.mjs
 *
 * Does not delete real reviews, listings, or admin accounts.
 */

import { existsSync, readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import {
  assertQaCarouselServiceRole,
  createQaCarouselAdminClient,
  QA_CAROUSEL_SEED_CONFIRM_ENV,
  resetQaCarouselReviews,
} from './seed-qa-carousel-reviews.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

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

async function main() {
  loadEnvFile('.env.local')

  assertQaCarouselServiceRole({ requireConfirm: true })
  const supabase = createQaCarouselAdminClient()
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL

  console.log(`Target: ${url}`)
  console.log(`Requires ${QA_CAROUSEL_SEED_CONFIRM_ENV}=true\n`)

  await resetQaCarouselReviews(supabase)
  console.log('\nQA carousel cleanup complete.')
}

main().catch((error) => {
  console.error(error.message ?? error)
  process.exit(1)
})
