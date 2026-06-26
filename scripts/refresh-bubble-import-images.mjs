#!/usr/bin/env node
/**
 * Refresh missing Bubble import images without touching listings or existing images.
 *
 * Usage:
 *   BUBBLE_IMPORT_ALLOW=true node scripts/refresh-bubble-import-images.mjs
 *   BUBBLE_IMPORT_ALLOW=true node scripts/refresh-bubble-import-images.mjs --dry-run
 *   BUBBLE_IMPORT_ALLOW=true node scripts/refresh-bubble-import-images.mjs --force-redownload
 */

import { existsSync, readFileSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { printImportReport, runBubbleImport } from './lib/bubble-import.mjs'

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
    throw new Error('Set BUBBLE_IMPORT_ALLOW=true before refreshing images.')
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY.')
  }
}

async function main() {
  loadEnvFile('.env.local')
  loadEnvFile('.env')

  const args = new Set(process.argv.slice(2))
  const dryRun = args.has('--dry-run')
  const forceRedownload = args.has('--force-redownload')

  if (!dryRun) assertImportAllowed()

  console.log(
    `Bubble image refresh — missing images only${forceRedownload ? ' (FORCE re-download all)' : ''}${dryRun ? ' (dry run)' : ''}`,
  )

  const report = await runBubbleImport({
    dryRun,
    imagesOnly: true,
    forceRedownload,
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

  if (report.imageRecovery) {
    console.log('\n--- Phase A recovery ---')
    console.log(`Recovered: ${report.imageRecovery.recovered}`)
    console.log(`Listings still imageless: ${report.imageRecovery.imagelessListings ?? 'n/a'}`)
    console.log(`Private (needs signed URL): ${report.imageRecovery.privateNeedsSignedUrl}`)
    console.log(`Other failures: ${report.imageRecovery.otherFailures}`)
  }

  if (!dryRun) {
    const reportPath = join(ROOT, 'bubble-image-refresh-report.json')
    writeFileSync(reportPath, JSON.stringify(report, null, 2))
    console.log(`\nWrote ${reportPath}`)
  }
}

main().catch((error) => {
  console.error(error.message || error)
  process.exit(1)
})
