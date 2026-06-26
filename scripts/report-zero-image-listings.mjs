#!/usr/bin/env node
/**
 * Report zero-image Bubble import listings with per-field CSV URLs and fetch status.
 */

import { createClient } from '@supabase/supabase-js'
import { existsSync, readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { DEFAULT_CSV_PATH, parseCsv } from './lib/bubble-import.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const LIMIT = Number.parseInt(process.env.REPORT_LIMIT ?? '10', 10)

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

function normalizeImageUrl(raw) {
  const trimmed = (raw ?? '').trim()
  if (!trimmed) return null
  if (trimmed.startsWith('//')) return `https:${trimmed}`
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  return `https://${trimmed}`
}

function splitField(field) {
  if (!field?.trim()) return []
  return field
    .split(',')
    .map((part) => normalizeImageUrl(part))
    .filter(Boolean)
}

function urlPrefix(url) {
  if (url.startsWith('https://equipd.co.uk/version-live/fileupload/')) {
    return 'https://equipd.co.uk/version-live/fileupload/'
  }
  if (url.startsWith('https://equipd.co.uk/fileupload/')) {
    return 'https://equipd.co.uk/fileupload/'
  }
  if (url.includes('cdn.bubble.io')) return 'https://cdn.bubble.io/'
  return '(other)'
}

async function probeUrl(url) {
  const candidates = [url]
  if (
    url.includes('equipd.co.uk/fileupload/') &&
    !url.includes('version-live/fileupload/')
  ) {
    candidates.push(
      url.replace('equipd.co.uk/fileupload/', 'equipd.co.uk/version-live/fileupload/'),
    )
  }

  const strategies = [
    {
      userAgent: 'EquipdBubbleImport/1.0 (+https://equipd.co.uk)',
      referer: null,
    },
    {
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      referer: 'https://equipd.co.uk/',
    },
  ]

  let lastReason = 'unknown'

  for (const candidate of candidates) {
    for (const strategy of strategies) {
      try {
        const headers = { Accept: 'image/*,*/*' }
        if (strategy.userAgent) headers['User-Agent'] = strategy.userAgent
        if (strategy.referer) headers.Referer = strategy.referer

        const response = await fetch(candidate, { redirect: 'follow', headers })
        if (response.ok) {
          const buffer = Buffer.from(await response.arrayBuffer())
          if (buffer.length > 100) return { failed: false, reason: null }
        }
        lastReason = `HTTP ${response.status}`
      } catch {
        lastReason = 'fetch failed'
      }
    }
  }

  return { failed: true, reason: lastReason }
}

async function main() {
  loadEnvFile('.env.local')
  loadEnvFile('.env')

  const records = parseCsv(readFileSync(DEFAULT_CSV_PATH, 'utf8'))
  const slugToCsv = new Map()
  for (let index = 0; index < records.length; index += 1) {
    const slug = (records[index].URL_Slug ?? '').trim()
    if (slug) slugToCsv.set(slug, { row: records[index], rowNumber: index + 2 })
  }

  const supabase = createClient(
    process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )

  const { data: listings, error } = await supabase
    .from('listings')
    .select('slug, title, listing_images(id)')
    .eq('source', 'import')
    .eq('status', 'active')
    .order('slug')

  if (error) throw error

  const zeroImage = (listings ?? []).filter((listing) => !(listing.listing_images?.length ?? 0))

  const preferredSlugs = [
    'concept2-rowers-huddersfield',
    'bowflex-crosstrainers-harrogate',
    'peloton-treadmills-york',
    'nordictrack-treadmills-sheffield',
    'technogym-crosstrainers-presteigne',
    'life-fitness-treadmills-bury-st-edmunds',
    'matrix-fitness-rowers-harrogate',
    'water-rower-rowers-leeds',
    'bodypower-treadmills-manchester',
    'stages-cycling-spin-bikes-leeds',
  ]

  const selected = []
  for (const slug of preferredSlugs) {
    if (zeroImage.some((listing) => listing.slug === slug)) selected.push(slug)
  }
  for (const listing of zeroImage) {
    if (selected.length >= LIMIT) break
    if (!selected.includes(listing.slug)) selected.push(listing.slug)
  }

  console.log(`Zero-image import listings in DB: ${zeroImage.length}`)
  console.log(`Reporting first ${Math.min(LIMIT, selected.length)}:\n`)

  for (const slug of selected.slice(0, LIMIT)) {
    const listing = zeroImage.find((entry) => entry.slug === slug)
    const csv = slugToCsv.get(slug)
    const row = csv?.row ?? {}

    const fields = {
      cover_image: row.cover_image ?? '',
      image: row.image ?? '',
      images: row.images ?? '',
      imagestext: row.imagestext ?? '',
    }

    const fieldUrls = Object.fromEntries(
      Object.entries(fields).map(([name, value]) => [name, splitField(value)]),
    )

    const allUrls = [
      ...new Set([
        ...fieldUrls.cover_image,
        ...fieldUrls.image,
        ...fieldUrls.images,
        ...fieldUrls.imagestext,
      ]),
    ]

    const urlResults = []
    for (const imageUrl of allUrls) {
      const probe = await probeUrl(imageUrl)
      urlResults.push({ url: imageUrl, ...probe, prefix: urlPrefix(imageUrl) })
    }

    console.log('='.repeat(80))
    console.log(`CSV row: ${csv?.rowNumber ?? 'NOT FOUND'}`)
    console.log(`Title: ${listing?.title ?? row.title ?? '(unknown)'}`)
    console.log(`Slug: ${slug}`)
    console.log('')

    for (const [fieldName, urls] of Object.entries(fieldUrls)) {
      console.log(`${fieldName}:`)
      if (!urls.length) {
        console.log('  (empty)')
      } else {
        for (const imageUrl of urls) console.log(`  ${imageUrl}`)
      }
    }

    console.log('')
    console.log('URL fetch results (all unique URLs across fields):')
    if (!urlResults.length) {
      console.log('  (no URLs in CSV — nothing to fetch)')
    } else {
      for (const result of urlResults) {
        console.log(`  Prefix: ${result.prefix}`)
        console.log(`  URL: ${result.url}`)
        console.log(`  Failed: ${result.failed ? 'yes' : 'no'}`)
        if (result.failed) console.log(`  Why: ${result.reason}`)
        console.log('')
      }
    }
  }
}

main().catch((error) => {
  console.error(error.message || error)
  process.exit(1)
})
