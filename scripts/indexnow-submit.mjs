#!/usr/bin/env node
/**
 * Manual IndexNow submission CLI (dry-run by default).
 *
 * Examples:
 *   node scripts/indexnow-submit.mjs --url "https://www.equipd.co.uk/equipment/concept2-exercise-bike-bikeerg"
 *   node scripts/indexnow-submit.mjs --file changed-urls.txt --apply
 *   node scripts/indexnow-submit.mjs --sitemap
 *   node scripts/indexnow-submit.mjs --sitemap --apply
 *
 * Never prints the IndexNow key.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  INDEXNOW_ENDPOINT,
  INDEXNOW_HOST,
  INDEXNOW_ORIGIN,
  batchIndexNowUrls,
  buildIndexNowKeyLocation,
  buildIndexNowRequestBody,
  dedupeIndexNowUrls,
  isEligiblePublicUrl,
  isValidIndexNowKeyFormat,
  normalizeIndexNowUrl,
  submitIndexNowUrls,
  summarizeIndexNowUrlFamilies,
} from '../src/lib/indexNowCore.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')

function printUsage() {
  console.log(`Usage:
  node scripts/indexnow-submit.mjs [options]

Options:
  --url <url>               Submit one canonical www URL (repeatable)
  --file <path>             Read URLs from a text file (one per line)
  --sitemap [path|url]      Load URLs from sitemap (default: public/sitemap.xml or production)
  --equipment-approved      Alias that enables --sitemap auto
  --apply                   Actually submit (dry-run is the default)
  --dry-run                 Explicit dry-run (default)
  --json                    Print machine-readable summary
  --help                    Show help
`)
}

function parseArgs(argv) {
  const args = {
    urls: [],
    file: null,
    sitemap: null,
    apply: false,
    json: false,
    help: false,
    equipmentApproved: false,
  }

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i]
    if (token === '--help' || token === '-h') args.help = true
    else if (token === '--apply') args.apply = true
    else if (token === '--dry-run') args.apply = false
    else if (token === '--json') args.json = true
    else if (token === '--equipment-approved') args.equipmentApproved = true
    else if (token === '--url') {
      args.urls.push(argv[++i])
    } else if (token === '--file') {
      args.file = argv[++i]
    } else if (token === '--sitemap') {
      const next = argv[i + 1]
      if (next && !next.startsWith('--')) {
        args.sitemap = next
        i += 1
      } else {
        args.sitemap = 'auto'
      }
    } else {
      throw new Error(`Unknown argument: ${token}`)
    }
  }

  return args
}

async function loadSitemapUrls(target) {
  let xml
  if (target === 'auto') {
    const local = path.join(root, 'public', 'sitemap.xml')
    if (fs.existsSync(local)) {
      xml = fs.readFileSync(local, 'utf8')
    } else {
      const response = await fetch(`${INDEXNOW_ORIGIN}/sitemap.xml`)
      if (!response.ok) throw new Error(`Failed to fetch sitemap: ${response.status}`)
      xml = await response.text()
    }
  } else if (/^https?:\/\//i.test(target)) {
    const response = await fetch(target)
    if (!response.ok) throw new Error(`Failed to fetch sitemap: ${response.status}`)
    xml = await response.text()
  } else {
    xml = fs.readFileSync(path.resolve(target), 'utf8')
  }

  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1].trim())
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  if (args.help) {
    printUsage()
    return
  }

  const collected = [...args.urls]

  if (args.file) {
    const text = fs.readFileSync(path.resolve(args.file), 'utf8')
    collected.push(
      ...text
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith('#')),
    )
  }

  if (args.sitemap) {
    collected.push(...await loadSitemapUrls(args.sitemap))
  }

  if (args.equipmentApproved && !args.sitemap) {
    console.warn('[indexnow] --equipment-approved selects catalogue URLs via --sitemap; enabling sitemap auto')
    collected.push(...await loadSitemapUrls('auto'))
  }

  const normalizedInputs = collected
    .map((url) => normalizeIndexNowUrl(url) || url)
  const eligible = dedupeIndexNowUrls(collected).filter((url) => isEligiblePublicUrl(url))
  const duplicateCount = Math.max(0, collected.length - new Set(normalizedInputs).size)
  const excludedCount = Math.max(0, collected.length - eligible.length - duplicateCount)
  const batches = batchIndexNowUrls(eligible)
  const families = summarizeIndexNowUrlFamilies(eligible)
  const keyConfigured = isValidIndexNowKeyFormat(String(process.env.INDEXNOW_KEY ?? '').trim())

  const summary = {
    mode: args.apply ? 'apply' : 'dry-run',
    host: INDEXNOW_HOST,
    endpoint: INDEXNOW_ENDPOINT,
    keyFileUrl: keyConfigured
      ? buildIndexNowKeyLocation('[redacted]')
      : `${INDEXNOW_ORIGIN}/{INDEXNOW_KEY}.txt`,
    keyConfigured,
    totalSitemapOrInputUrls: collected.length,
    eligibleUrls: eligible.length,
    excludedUrls: excludedCount,
    duplicateCount,
    expectedBatches: batches.length,
    families,
    sampleUrls: eligible.slice(0, 10),
  }

  // Prefer explicit key-file URL pattern without revealing key.
  summary.keyFileUrl = `${INDEXNOW_ORIGIN}/{INDEXNOW_KEY}.txt`

  if (!args.apply) {
    if (args.json) {
      console.log(JSON.stringify(summary, null, 2))
    } else {
      console.log('IndexNow dry-run (pass --apply to submit)')
      console.log(`Total input/sitemap URLs: ${collected.length}`)
      console.log(`Eligible URLs: ${eligible.length}`)
      console.log(`Excluded URLs: ${excludedCount}`)
      console.log(`Duplicates collapsed: ${duplicateCount}`)
      console.log(`Expected batches: ${batches.length}`)
      console.log(`Families: ${JSON.stringify(families)}`)
      console.log(`Endpoint: ${INDEXNOW_ENDPOINT}`)
      console.log(`Key file URL: ${summary.keyFileUrl}`)
      console.log(`Key configured in env: ${keyConfigured}`)
      if (eligible.length) {
        console.log('Sample:')
        for (const url of eligible.slice(0, 10)) console.log(`  ${url}`)
      }
    }
    return
  }

  const key = String(process.env.INDEXNOW_KEY ?? '').trim()
  if (!isValidIndexNowKeyFormat(key)) {
    console.error('INDEXNOW_KEY is missing or invalid. Refusing to submit.')
    process.exit(1)
  }

  const result = await submitIndexNowUrls(eligible, {
    key,
    keyLocation: buildIndexNowKeyLocation(key),
    source: 'cli',
    contentType: args.sitemap ? 'sitemap' : 'manual',
    force: true,
    logger: {
      info: (label, record) => console.log(label, JSON.stringify(record)),
      error: (label, record) => console.error(label, JSON.stringify(record)),
    },
  })

  const shape = buildIndexNowRequestBody({
    key: 'REDACTED',
    keyLocation: buildIndexNowKeyLocation('REDACTED'),
    urlList: eligible.slice(0, 1),
  })
  shape.key = '[redacted]'
  shape.keyLocation = `${INDEXNOW_ORIGIN}/[redacted].txt`

  const output = {
    ...summary,
    ok: result.ok,
    partial: Boolean(result.partial),
    category: result.category,
    submittedCount: result.submitted.length,
    failedCount: result.failed?.length || 0,
    batches: result.batches,
    requestShape: shape,
  }

  if (args.json) {
    console.log(JSON.stringify(output, null, 2))
  } else {
    console.log(`IndexNow submit ${result.ok ? 'OK' : (result.partial ? 'PARTIAL' : 'FAILED')} category=${result.category}`)
    console.log(`Submitted: ${result.submitted.length} / ${eligible.length}`)
    for (const batch of result.batches) {
      console.log(
        `  batch ${batch.batchIndex}/${batch.batchTotal} urls=${batch.urlCount} status=${batch.status} category=${batch.category} attempts=${batch.attempts}`,
      )
    }
  }

  if (!result.ok) process.exit(1)
}

main().catch((error) => {
  console.error(error.message || error)
  process.exit(1)
})
