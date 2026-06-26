#!/usr/bin/env node
/**
 * Full Bubble → Supabase listing import.
 *
 * Replaces the bubble-test-* batch with production Bubble URL_Slug values.
 * Idempotent: upserts on slug for source=import listings only.
 *
 * Usage:
 *   BUBBLE_IMPORT_ALLOW=true node scripts/import-bubble-listings.mjs
 *   BUBBLE_IMPORT_ALLOW=true node scripts/import-bubble-listings.mjs --dry-run
 *   BUBBLE_IMPORT_ALLOW=true node scripts/import-bubble-listings.mjs --refresh-images
 *     (alias: only downloads missing images; does not delete existing images)
 *   BUBBLE_IMPORT_ALLOW=true node scripts/refresh-bubble-import-images.mjs
 *   BUBBLE_IMPORT_ALLOW=true node scripts/import-bubble-listings.mjs --keep-test-batch
 *
 * Env (.env.local):
 *   VITE_SUPABASE_URL or SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   BUBBLE_IMPORT_ALLOW=true
 */

import { existsSync, readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import {
  printImportReport,
  runBubbleImport,
} from './lib/bubble-import.mjs'

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

function assertImportAllowed() {
  if (process.env.BUBBLE_IMPORT_ALLOW !== 'true') {
    throw new Error(
      'Refusing to import: set BUBBLE_IMPORT_ALLOW=true in your environment.\n' +
        'This script only touches listings and listing_images.',
    )
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY.')
  }

  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  if (!url) {
    throw new Error('Missing SUPABASE_URL or VITE_SUPABASE_URL.')
  }
}

async function main() {
  loadEnvFile('.env.local')
  loadEnvFile('.env')

  const args = new Set(process.argv.slice(2))
  const dryRun = args.has('--dry-run')
  const refreshImages = args.has('--refresh-images')
  const keepTestBatch = args.has('--keep-test-batch')

  if (!dryRun && !refreshImages) assertImportAllowed()

  if (refreshImages) {
    console.log('Bubble image refresh — missing images only (listings unchanged)')
    const report = await runBubbleImport({
      dryRun,
      imagesOnly: true,
      forceRedownload: false,
      removeTestBatch: false,
      onProgress: ({ slug, imagesUploaded, imagesAttempted, index, total }) => {
        if (imagesAttempted > 0 || imagesUploaded > 0) {
          console.log(
            `  [${index}/${total}] ${slug} — attempted ${imagesAttempted}, uploaded ${imagesUploaded}`,
          )
        }
      },
    })
    printImportReport(report, { title: 'Bubble image refresh report' })
    return
  }

  if (!dryRun) assertImportAllowed()

  console.log('Bubble full import — all suitable active listings')
  if (!keepTestBatch && !dryRun) {
    console.log('Will remove bubble-test-* listings before import (production slugs).')
  }

  const report = await runBubbleImport({
    dryRun,
    slugPrefix: '',
    limit: null,
    removeTestBatch: !keepTestBatch && !dryRun,
    onProgress: ({ slug, imagesUploaded, index, total }) => {
      console.log(`  [${index}/${total}] ${slug} (${imagesUploaded} new image(s))`)
    },
  })

  printImportReport(report, { title: 'Bubble full import report' })
}

main().catch((error) => {
  console.error(error.message || error)
  process.exit(1)
})
