#!/usr/bin/env node
/**
 * Bubble → Supabase test import (first 15 suitable live listings).
 *
 * Usage:
 *   BUBBLE_IMPORT_ALLOW=true node scripts/import-bubble-listings-test-batch.mjs
 *   BUBBLE_IMPORT_ALLOW=true node scripts/import-bubble-listings-test-batch.mjs --dry-run
 *
 * For the full production import, use scripts/import-bubble-listings.mjs
 */

import { existsSync, readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import {
  BUBBLE_TEST_PREFIX,
  printImportReport,
  runBubbleImport,
} from './lib/bubble-import.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const BATCH_LIMIT = 15

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
    throw new Error('Refusing to import: set BUBBLE_IMPORT_ALLOW=true.')
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY.')
  }
}

async function main() {
  loadEnvFile('.env.local')
  loadEnvFile('.env')

  const dryRun = process.argv.includes('--dry-run')
  if (!dryRun) assertImportAllowed()

  console.log(`Bubble test import — batch limit ${BATCH_LIMIT}${dryRun ? ' (dry run)' : ''}`)

  const report = await runBubbleImport({
    dryRun,
    slugPrefix: BUBBLE_TEST_PREFIX,
    limit: BATCH_LIMIT,
    removeTestBatch: false,
    onProgress: ({ slug, imagesUploaded }) => {
      console.log(`  imported ${slug} (${imagesUploaded} image(s))`)
    },
  })

  printImportReport(report, { title: 'Bubble test import report' })
}

main().catch((error) => {
  console.error(error.message || error)
  process.exit(1)
})
