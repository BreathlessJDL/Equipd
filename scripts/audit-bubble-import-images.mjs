#!/usr/bin/env node
/**
 * Audit Bubble import image coverage and test source URL fetchability.
 *
 * Usage:
 *   node scripts/audit-bubble-import-images.mjs
 *   node scripts/audit-bubble-import-images.mjs --write-report
 */

import { createClient } from '@supabase/supabase-js'
import { existsSync, readFileSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import {
  classifyImageUrl,
  collectImageUrls,
  DEFAULT_CSV_PATH,
  parseCsv,
  urlHash,
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

async function testFetch(url, strategy) {
  const headers = { Accept: 'image/*,*/*' }
  if (strategy.referer) headers.Referer = strategy.referer
  if (strategy.userAgent) headers['User-Agent'] = strategy.userAgent

  try {
    const response = await fetch(strategy.url ?? url, { redirect: 'follow', headers })
    const contentType = response.headers.get('content-type') ?? ''
    const buffer = Buffer.from(await response.arrayBuffer())
    return {
      ok: response.ok && buffer.length > 100,
      status: response.status,
      contentType,
      bytes: buffer.length,
      error: null,
    }
  } catch (error) {
    return { ok: false, status: 0, contentType: '', bytes: 0, error: error.message }
  }
}

const FETCH_STRATEGIES = [
  { name: 'plain', userAgent: 'EquipdBubbleImport/1.0' },
  {
    name: 'browser',
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    referer: 'https://equipd.co.uk/',
  },
  {
    name: 'version-live-prefix',
    transform: (url) =>
      url.replace('https://equipd.co.uk/fileupload/', 'https://equipd.co.uk/version-live/fileupload/'),
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    referer: 'https://equipd.co.uk/',
  },
]

async function main() {
  loadEnvFile('.env.local')
  loadEnvFile('.env')

  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const supabase = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const records = parseCsv(readFileSync(DEFAULT_CSV_PATH, 'utf8'))
  const slugToCsvUrls = new Map()
  for (const row of records) {
    const slug = (row.URL_Slug ?? '').trim()
    if (!slug) continue
    slugToCsvUrls.set(slug, collectImageUrls(row))
  }

  const { data: listings, error } = await supabase
    .from('listings')
    .select('id, slug, title, source, listing_images(id, storage_path, sort_order)')
    .eq('source', 'import')
    .eq('status', 'active')
    .order('slug')

  if (error) throw error

  const coverage = { zero: [], one: [], twoPlus: [] }
  let totalCsvUrls = 0
  let totalDbImages = 0
  let missingUrlCount = 0
  const missingByPattern = new Map()
  const missingUrls = []

  for (const listing of listings ?? []) {
    const count = listing.listing_images?.length ?? 0
    totalDbImages += count
    const csvUrls = slugToCsvUrls.get(listing.slug) ?? []
    totalCsvUrls += csvUrls.length

    const existingHashes = new Set(
      (listing.listing_images ?? [])
        .map((img) => img.storage_path.match(/bubble-([a-f0-9]{10})/)?.[1])
        .filter(Boolean),
    )

    for (const sourceUrl of csvUrls) {
      if (!existingHashes.has(urlHash(sourceUrl))) {
        missingUrlCount += 1
        const pattern = classifyImageUrl(sourceUrl)
        missingByPattern.set(pattern, (missingByPattern.get(pattern) ?? 0) + 1)
        missingUrls.push({ slug: listing.slug, title: listing.title, url: sourceUrl, pattern })
      }
    }

    const entry = { slug: listing.slug, title: listing.title, count, csvUrlCount: csvUrls.length }
    if (count === 0) coverage.zero.push(entry)
    else if (count === 1) coverage.one.push(entry)
    else coverage.twoPlus.push(entry)
  }

  const urlFetchSamples = {}
  for (const pattern of ['equipd.co.uk/fileupload', 'equipd.co.uk/version-live/fileupload', 'cdn.bubble.io']) {
    const sample = missingUrls.find((item) => item.pattern === pattern)?.url
    if (!sample) continue
    urlFetchSamples[pattern] = {}
    for (const strategy of FETCH_STRATEGIES) {
      const targetUrl = strategy.transform ? strategy.transform(sample) : sample
      urlFetchSamples[pattern][strategy.name] = await testFetch(sample, { ...strategy, url: targetUrl })
    }
  }

  const report = {
    generatedAt: new Date().toISOString(),
    activeImportListings: listings?.length ?? 0,
    coverageCounts: {
      zeroImages: coverage.zero.length,
      oneImage: coverage.one.length,
      twoPlusImages: coverage.twoPlus.length,
      totalDbImages,
      totalCsvSourceUrls: totalCsvUrls,
      missingSourceUrls: missingUrlCount,
    },
    missingByPattern: Object.fromEntries(missingByPattern),
    listingsWithZeroImages: coverage.zero,
    listingsWithOneImage: coverage.one,
    urlFetchSamples,
    recoverability: {
      'cdn.bubble.io':
        'Partially recoverable — open CDN URLs work; HTTP 403 means object deleted/private in Bubble S3.',
      'equipd.co.uk/fileupload':
        'Not recoverable via script from this environment — TLS/connection failures or server 500; URLs are Bubble-hosted file paths, not public CDN.',
      'equipd.co.uk/version-live/fileupload': 'Same as equipd.co.uk/fileupload.',
    },
    repairPlan: {
      bubbleExportFields: ['images', 'imagestext', 'cover_image', 'image'],
      recommendation:
        'Re-export from Bubble with cdn.bubble.io URLs in image columns, or bulk-download from Bubble File Manager / Data > All Equipment, then run a local folder-to-slug upload pass.',
      mappingKey: 'URL_Slug column matches listings.slug; image hash stored as bubble-{sha1}.ext in listing-images bucket.',
    },
    missingUrls,
  }

  console.log('=== Bubble import image audit ===\n')
  console.log(`Active import listings: ${report.activeImportListings}`)
  console.log(`Listings with 0 images: ${report.coverageCounts.zeroImages}`)
  console.log(`Listings with 1 image: ${report.coverageCounts.oneImage}`)
  console.log(`Listings with 2+ images: ${report.coverageCounts.twoPlusImages}`)
  console.log(`Total DB images: ${report.coverageCounts.totalDbImages}`)
  console.log(`Missing CSV source URLs: ${report.coverageCounts.missingSourceUrls}`)
  console.log('\nMissing URLs by pattern:')
  for (const [pattern, count] of Object.entries(report.missingByPattern).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${pattern}: ${count}`)
  }

  console.log('\nURL fetch sample results:')
  for (const [pattern, strategies] of Object.entries(urlFetchSamples)) {
    console.log(`  ${pattern}:`)
    for (const [name, result] of Object.entries(strategies)) {
      console.log(
        `    ${name}: ${result.ok ? 'OK' : 'FAIL'} status=${result.status} bytes=${result.bytes} ${result.error ?? result.contentType}`,
      )
    }
  }

  if (process.argv.includes('--write-report')) {
    const reportPath = join(ROOT, 'bubble-image-audit-report.json')
    writeFileSync(reportPath, JSON.stringify(report, null, 2))
    console.log(`\nWrote ${reportPath}`)
  }
}

main().catch((error) => {
  console.error(error.message || error)
  process.exit(1)
})
