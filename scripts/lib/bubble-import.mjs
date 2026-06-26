/**
 * Shared Bubble CSV → Supabase listing import logic.
 */

import { createClient } from '@supabase/supabase-js'
import { createHash } from 'crypto'
import { existsSync, readFileSync } from 'fs'
import { dirname, extname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

const ROOT = join(__dirname, '..', '..')

export const BUBBLE_TEST_PREFIX = 'bubble-test-'
export const DEFAULT_SELLER_EMAIL = 'jlinnell95@gmail.com'
export const DEFAULT_CSV_PATH = join(
  ROOT,
  'public/design-reference/export_All-Equipment-modified_2026-06-24_17-49-37.csv',
)

const LISTING_IMAGES_BUCKET = 'listing-images'
const MAX_IMAGES_PER_LISTING = 8
const MAX_IMAGE_BYTES = 5 * 1024 * 1024

export const BUBBLE_APP_ID = '5ead97c147914e5891081ccfd2f7b613'
export const BUBBLE_CDN_ORIGIN = `https://${BUBBLE_APP_ID}.cdn.bubble.io`

const MIME_BY_EXT = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
}

export const BUBBLE_TYPE_TO_CATEGORY_SLUG = {
  Treadmills: 'treadmill',
  Crosstrainers: 'crosstrainers',
  'Upright Bikes': 'upright-bikes',
  'Recumbent Bikes': 'recumbent-bikes',
  'Spin Bikes': 'spin-bikes',
  Stairclimbers: 'stairclimbers',
  'Upper Body Bikes': 'upper-body-bikes',
  'Assault Bikes': 'assault-bike',
  'Plate Loaded Machine': 'plate-loaded-machine',
  'Plate Loaded Machines': 'plate-loaded-machine',
  'Pin Loaded Machine': 'pin-loaded-machine',
  'Pin Loaded Machines': 'pin-loaded-machine',
  'Multi-gyms': 'multi-gyms',
  'Multi Gyms': 'multi-gyms',
  'Multi-gym': 'multi-gyms',
  Rowers: 'rowers',
  'Dual Cable Pulley': 'dual-cable-pulley',
  'Squat Racks': 'squat-rack',
  Skierg: 'skierg',
  Functional: 'functional',
  Benches: 'bench',
  Dumbbells: 'dumbbells',
  'Weight Plates': 'weight-plates',
  Barbells: 'barbells',
  Other: 'other',
}

const UK_CITY_COORDINATES = {
  'Leeds, UK': { latitude: 53.8008, longitude: -1.5491, location_name: 'Leeds', city: 'Leeds', county: 'West Yorkshire' },
  'Sheffield, UK': { latitude: 53.3811, longitude: -1.4701, location_name: 'Sheffield', city: 'Sheffield', county: 'South Yorkshire' },
  'London, UK': { latitude: 51.5074, longitude: -0.1278, location_name: 'London', city: 'London', county: 'Greater London' },
  'Lincoln, UK': { latitude: 53.2307, longitude: -0.5406, location_name: 'Lincoln', city: 'Lincoln', county: 'Lincolnshire' },
  'Middlesbrough, UK': { latitude: 54.5742, longitude: -1.235, location_name: 'Middlesbrough', city: 'Middlesbrough', county: 'North Yorkshire' },
  'Shrewsbury, UK': { latitude: 52.7107, longitude: -2.7521, location_name: 'Shrewsbury', city: 'Shrewsbury', county: 'Shropshire' },
  'Halifax, UK': { latitude: 53.725, longitude: -1.865, location_name: 'Halifax', city: 'Halifax', county: 'West Yorkshire' },
  'Surrey, UK': { latitude: 51.2715, longitude: -0.3415, location_name: 'Surrey', city: 'Surrey', county: 'Surrey' },
  'Solihull, UK': { latitude: 52.4118, longitude: -1.7776, location_name: 'Solihull', city: 'Solihull', county: 'West Midlands' },
  'Penrith, UK': { latitude: 54.6641, longitude: -2.7548, location_name: 'Penrith', city: 'Penrith', county: 'Cumbria' },
  'Bradford, UK': { latitude: 53.7959, longitude: -1.7594, location_name: 'Bradford', city: 'Bradford', county: 'West Yorkshire' },
  'Hull, UK': { latitude: 53.7457, longitude: -0.3367, location_name: 'Hull', city: 'Hull', county: 'East Yorkshire' },
  'Castleford, UK': { latitude: 53.7248, longitude: -1.352, location_name: 'Castleford', city: 'Castleford', county: 'West Yorkshire' },
  'Manchester, UK': { latitude: 53.4808, longitude: -2.2426, location_name: 'Manchester', city: 'Manchester', county: 'Greater Manchester' },
  'Birmingham, UK': { latitude: 52.4862, longitude: -1.8904, location_name: 'Birmingham', city: 'Birmingham', county: 'West Midlands' },
  'Bristol, UK': { latitude: 51.4545, longitude: -2.5879, location_name: 'Bristol', city: 'Bristol', county: 'Bristol' },
  'Glasgow, UK': { latitude: 55.8642, longitude: -4.2518, location_name: 'Glasgow', city: 'Glasgow', county: 'Glasgow' },
  'Edinburgh, UK': { latitude: 55.9533, longitude: -3.1883, location_name: 'Edinburgh', city: 'Edinburgh', county: 'Edinburgh' },
  'Cardiff, UK': { latitude: 51.4816, longitude: -3.1791, location_name: 'Cardiff', city: 'Cardiff', county: 'Cardiff' },
  'Liverpool, UK': { latitude: 53.4084, longitude: -2.9916, location_name: 'Liverpool', city: 'Liverpool', county: 'Merseyside' },
  'Newcastle upon Tyne, UK': { latitude: 54.9783, longitude: -1.6178, location_name: 'Newcastle upon Tyne', city: 'Newcastle upon Tyne', county: 'Tyne and Wear' },
  'Nottingham, UK': { latitude: 52.9548, longitude: -1.1581, location_name: 'Nottingham', city: 'Nottingham', county: 'Nottinghamshire' },
  'Southampton, UK': { latitude: 50.9097, longitude: -1.4044, location_name: 'Southampton', city: 'Southampton', county: 'Hampshire' },
  'York, UK': { latitude: 53.959, longitude: -1.0815, location_name: 'York', city: 'York', county: 'North Yorkshire' },
  'Wakefield, UK': { latitude: 53.6833, longitude: -1.4977, location_name: 'Wakefield', city: 'Wakefield', county: 'West Yorkshire' },
}

export function parseCsv(content) {
  const rows = []
  let row = []
  let field = ''
  let inQuotes = false

  for (let i = 0; i < content.length; i += 1) {
    const char = content[i]
    const next = content[i + 1]

    if (inQuotes) {
      if (char === '"' && next === '"') {
        field += '"'
        i += 1
      } else if (char === '"') {
        inQuotes = false
      } else {
        field += char
      }
      continue
    }

    if (char === '"') {
      inQuotes = true
    } else if (char === ',') {
      row.push(field)
      field = ''
    } else if (char === '\n') {
      row.push(field)
      field = ''
      if (row.length > 1 || row[0] !== '') {
        rows.push(row)
      }
      row = []
    } else if (char !== '\r') {
      field += char
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field)
    rows.push(row)
  }

  if (!rows.length) return []

  const headers = rows[0]
  return rows.slice(1).map((values) => {
    const record = {}
    headers.forEach((header, index) => {
      record[header] = values[index] ?? ''
    })
    return record
  })
}

function slugify(text) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
}

function mapCondition(value) {
  const normalized = (value ?? '').trim().toLowerCase()
  if (normalized === 'like new' || normalized === 'like_new') return 'like_new'
  if (normalized === 'new') return 'new'
  if (normalized === 'for parts' || normalized === 'poor') return 'poor'
  if (normalized === 'fair') return 'fair'
  return 'good'
}

function mapRating(value) {
  const normalized = (value ?? '').trim().toLowerCase()
  if (normalized === 'home use') return 'home_use'
  if (normalized === 'light commercial') return 'light_commercial'
  if (normalized === 'full commercial') return 'full_commercial'
  return null
}

export function mapCategorySlug(row) {
  const type = (row.type ?? '').trim()
  if (BUBBLE_TYPE_TO_CATEGORY_SLUG[type]) return BUBBLE_TYPE_TO_CATEGORY_SLUG[type]

  const categoryOption = (row.category_option ?? '').trim()
  if (BUBBLE_TYPE_TO_CATEGORY_SLUG[categoryOption]) return BUBBLE_TYPE_TO_CATEGORY_SLUG[categoryOption]

  const slug = slugify(type || categoryOption)
  return slug || null
}

function parseYesNo(value, defaultValue = false) {
  const normalized = (value ?? '').trim().toLowerCase()
  if (normalized === 'yes' || normalized === 'true' || normalized === '1') return true
  if (normalized === 'no' || normalized === 'false' || normalized === '0') return false
  return defaultValue
}

function parsePricePence(value) {
  const cleaned = String(value ?? '')
    .replace(/[£,]/g, '')
    .trim()
  const pounds = Number.parseFloat(cleaned)
  if (!Number.isFinite(pounds) || pounds <= 0) return null
  return Math.round(pounds * 100)
}

function parseQuantity(value) {
  const qty = Number.parseInt(String(value ?? '').trim(), 10)
  return Number.isFinite(qty) ? qty : 0
}

function isObviousTestListing(row) {
  const title = (row.title ?? '').trim().toLowerCase()
  const description = (row.description ?? '').trim().toLowerCase()

  if (!title || title === 'test' || /^test(\s+listing)?\b/.test(title)) return true
  if (description === 'test') return true
  if (title.includes('qr code test')) return true

  return false
}

export function evaluateRow(row, rowNumber, categoryMap = null) {
  const reasons = []

  const title = (row.title ?? '').trim()
  if (!title) reasons.push('missing title')
  if (title.length < 3) reasons.push('title too short')
  if (title.length > 120) reasons.push('title too long (will truncate)')

  const quantity = parseQuantity(row.quantity_available)
  if (quantity < 1) reasons.push(`quantity_available=${row.quantity_available || '0'} (sold/unavailable)`)

  if (isObviousTestListing(row)) reasons.push('obvious test listing')

  const pricePence = parsePricePence(row.price)
  if (!pricePence) reasons.push(`invalid price "${row.price}"`)

  const categorySlug = mapCategorySlug(row)
  if (!categorySlug) {
    reasons.push(`unknown category type "${row.type}"`)
  } else if (categoryMap && !categoryMap[categorySlug]) {
    reasons.push(`category not in database: "${row.type}" → ${categorySlug}`)
  }

  const skip = reasons.some((reason) =>
    /missing title|too short|quantity_available|obvious test|invalid price|unknown category|category not in database/.test(
      reason,
    ),
  )

  return {
    rowNumber,
    skip,
    reasons,
    title,
    pricePence,
    categorySlug,
    quantity,
  }
}

function normalizeImageUrl(raw) {
  const trimmed = (raw ?? '').trim()
  if (!trimmed) return null
  if (trimmed.startsWith('//')) return `https:${trimmed}`
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  return `https://${trimmed}`
}

/** Map Bubble CSV / custom-domain file URLs to the app CDN origin (path is deterministic). */
export function resolveBubbleImageUrl(raw) {
  const url = normalizeImageUrl(raw)
  if (!url) return null

  const fileuploadMatch = url.match(
    /^https:\/\/equipd\.co\.uk\/(?:version-live\/)?fileupload\/(.+)$/i,
  )
  if (fileuploadMatch) {
    return `${BUBBLE_CDN_ORIGIN}/${fileuploadMatch[1]}`
  }

  if (/cdn\.bubble\.io/i.test(url)) {
    return url.split('?')[0]
  }

  return url
}

export function collectImageUrls(row) {
  const fields = [row.images, row.imagestext, row.cover_image, row.image]
  const urls = []

  for (const field of fields) {
    if (!field?.trim()) continue
    for (const part of field.split(',')) {
      const url = normalizeImageUrl(part)
      if (url && !urls.includes(url)) urls.push(url)
    }
  }

  return urls.slice(0, MAX_IMAGES_PER_LISTING)
}

function buildDeliveryNotes(row) {
  const parts = [row.Delivery_type, row.delivery_method, row.delivery_class]
    .map((value) => (value ?? '').trim())
    .filter(Boolean)

  return parts.length ? parts.join(' · ') : null
}

function inferCourierAvailable(row) {
  if (parseYesNo(row.courier_collection_allowed, false)) return true

  const deliveryText = [row.Delivery_type, row.delivery_method, row.delivery_class, row.description]
    .join(' ')
    .toLowerCase()

  return /pallet|courier|delivery|2-man|parcel/.test(deliveryText)
}

export function resolveLocationCoords(location) {
  const trimmed = (location ?? '').trim()
  if (!trimmed) return {}

  if (UK_CITY_COORDINATES[trimmed]) return UK_CITY_COORDINATES[trimmed]

  const cityPart = trimmed.split(',')[0]?.trim()
  const match = Object.entries(UK_CITY_COORDINATES).find(([key]) =>
    key.toLowerCase().startsWith(cityPart.toLowerCase()),
  )

  if (match) return match[1]

  const partial = Object.entries(UK_CITY_COORDINATES).find(([key]) => {
    const keyCity = key.split(',')[0].toLowerCase()
    return cityPart.toLowerCase().includes(keyCity) || keyCity.includes(cityPart.toLowerCase())
  })

  return partial ? partial[1] : {}
}

export function buildImportSlug(bubbleSlug, title, location, usedSlugs, slugPrefix = '') {
  let base = (bubbleSlug ?? '').trim().replace(/^-+/, '')
  if (!base) {
    const locationPart = slugify((location ?? '').split(',')[0] ?? '')
    base = slugify(`${title}-${locationPart}`)
  }

  let slug = `${slugPrefix}${base}`.replace(/-+$/g, '')
  if (!slug || slug === slugPrefix) {
    slug = `${slugPrefix}${slugify(title)}`
  }

  let candidate = slug
  let suffix = 2
  while (usedSlugs.has(candidate)) {
    candidate = `${slug}-${suffix}`
    suffix += 1
  }

  usedSlugs.add(candidate)
  return candidate
}

function truncateTitle(title) {
  const trimmed = title.trim()
  if (trimmed.length <= 120) return trimmed
  return trimmed.slice(0, 117).trimEnd() + '...'
}

async function findSellerId(supabase) {
  let page = 1
  const perPage = 200

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage })
    if (error) throw error

    const users = data?.users ?? []
    const match = users.find(
      (user) => user.email?.toLowerCase() === DEFAULT_SELLER_EMAIL.toLowerCase(),
    )
    if (match) return match.id

    if (users.length < perPage) break
    page += 1
  }

  throw new Error(`Could not find seller profile for ${DEFAULT_SELLER_EMAIL}`)
}

async function fetchCategoryMap(supabase) {
  const { data, error } = await supabase.from('categories').select('id, slug, name')
  if (error) throw error
  return Object.fromEntries((data ?? []).map((row) => [row.slug, row]))
}

async function fetchBrandMap(supabase) {
  const { data, error } = await supabase.from('brands').select('id, slug, name')
  if (error) throw error

  const byName = new Map()
  for (const brand of data ?? []) {
    byName.set(brand.name.toLowerCase(), brand)
  }
  return byName
}

function resolveBrandId(brandName, brandMap) {
  const trimmed = (brandName ?? '').trim()
  if (!trimmed) return { brandId: null, brandText: null, unmatched: false }
  const match = brandMap.get(trimmed.toLowerCase())
  return {
    brandId: match?.id ?? null,
    brandText: trimmed,
    unmatched: !match,
  }
}

function buildImageUrlCandidates(url) {
  const candidates = []
  const add = (value) => {
    if (value && !candidates.includes(value)) candidates.push(value)
  }

  const resolved = resolveBubbleImageUrl(url)
  add(resolved)

  add(url)

  try {
    add(decodeURI(url))
  } catch {
    // ignore invalid escape sequences
  }

  if (resolved && resolved !== url) {
    try {
      add(decodeURI(resolved))
    } catch {
      // ignore invalid escape sequences
    }
  }

  if (/equipd\.co\.uk\/fileupload\//i.test(url) && !/version-live\/fileupload/i.test(url)) {
    add(url.replace(/equipd\.co\.uk\/fileupload\//i, 'equipd.co.uk/version-live/fileupload/'))
  }

  return candidates
}

export function classifyImageUrl(url) {
  if (/cdn\.bubble\.io/i.test(url)) return 'cdn.bubble.io'
  if (/equipd\.co\.uk\/version-live\/fileupload/i.test(url)) return 'equipd.co.uk/version-live/fileupload'
  if (/equipd\.co\.uk\/fileupload/i.test(url)) return 'equipd.co.uk/fileupload'
  if (/equipd\.co\.uk/i.test(url)) return 'equipd.co.uk/other'
  return 'other'
}

const IMAGE_FETCH_STRATEGIES = [
  {
    name: 'browser-equipd',
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    referer: 'https://equipd.co.uk/',
  },
  {
    name: 'browser-bubble',
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    referer: 'https://equipd.co.uk/version-live/',
  },
  {
    name: 'import-default',
    userAgent: 'EquipdBubbleImport/1.0 (+https://equipd.co.uk)',
    referer: null,
  },
]

function classifyImageFetchError(error, status) {
  if (status === 403 || /HTTP 403\b/.test(error?.message ?? '')) {
    return 'private-needs-signed-url'
  }
  if (status === 0 || /fetch failed/i.test(error?.message ?? '')) {
    return 'fetch-failed'
  }
  return 'other-failure'
}

async function fetchImageBytes(url, strategy) {
  const headers = { Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8' }
  if (strategy.userAgent) headers['User-Agent'] = strategy.userAgent
  if (strategy.referer) headers.Referer = strategy.referer

  let response
  try {
    response = await fetch(url, { redirect: 'follow', headers })
  } catch (error) {
    const fetchError = new Error(error.message || String(error))
    fetchError.status = 0
    fetchError.classification = classifyImageFetchError(error, 0)
    throw fetchError
  }

  if (!response.ok) {
    const httpError = new Error(`HTTP ${response.status}`)
    httpError.status = response.status
    httpError.classification = classifyImageFetchError(null, response.status)
    throw httpError
  }

  const contentType = response.headers.get('content-type')?.split(';')[0]?.trim() ?? ''
  const buffer = Buffer.from(await response.arrayBuffer())

  if (buffer.length > MAX_IMAGE_BYTES) {
    throw new Error(`image too large (${buffer.length} bytes)`)
  }

  if (buffer.length < 100) {
    throw new Error('response too small to be an image')
  }

  let extension = extname(new URL(response.url || url).pathname).toLowerCase()
  if (!MIME_BY_EXT[extension]) {
    if (contentType === 'image/png') extension = '.png'
    else if (contentType === 'image/webp') extension = '.webp'
    else extension = '.jpg'
  }

  const mimeType = MIME_BY_EXT[extension] ?? contentType
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(mimeType)) {
    throw new Error(`unsupported content type ${mimeType || '(unknown)'}`)
  }

  return { buffer, extension, mimeType }
}

async function downloadImage(url) {
  const candidates = buildImageUrlCandidates(url)
  const errors = []
  let sawPrivate = false

  for (const candidate of candidates) {
    for (const strategy of IMAGE_FETCH_STRATEGIES) {
      try {
        return await fetchImageBytes(candidate, strategy)
      } catch (error) {
        if (error.classification === 'private-needs-signed-url') sawPrivate = true
        errors.push({
          candidate,
          strategy: strategy.name,
          message: error.message || String(error),
          classification: error.classification ?? 'other-failure',
          status: error.status ?? null,
        })
      }
    }
  }

  const finalError = new Error(
    sawPrivate ? 'private-needs-signed-url' : errors[errors.length - 1]?.message ?? 'all fetch strategies failed',
  )
  finalError.classification = sawPrivate ? 'private-needs-signed-url' : errors[errors.length - 1]?.classification ?? 'fetch-failed'
  finalError.attempts = errors
  throw finalError
}

function urlHash(url) {
  return createHash('sha1').update(url).digest('hex').slice(0, 10)
}

export { urlHash }

async function uploadListingImages(
  supabase,
  { listingId, sellerId, imageUrls, forceRedownload = false },
) {
  if (!imageUrls.length) return { uploaded: 0, failures: [], skipped: false, attempted: 0 }

  const { data: existingImages, error: existingError } = await supabase
    .from('listing_images')
    .select('storage_path, sort_order')
    .eq('listing_id', listingId)
    .order('sort_order', { ascending: true })

  if (existingError) throw existingError

  const existingHashes = new Set(
    (existingImages ?? [])
      .map((image) => image.storage_path.match(/bubble-([a-f0-9]{10})/)?.[1])
      .filter(Boolean),
  )

  let nextSortOrder =
    existingImages?.length > 0
      ? Math.max(...existingImages.map((image) => image.sort_order)) + 1
      : 0

  if (forceRedownload && existingImages?.length) {
    const { error: deleteError } = await supabase
      .from('listing_images')
      .delete()
      .eq('listing_id', listingId)
    if (deleteError) throw deleteError
    existingHashes.clear()
    nextSortOrder = 0
  }

  let uploaded = 0
  let attempted = 0
  const failures = []

  for (const url of imageUrls) {
    const hash = urlHash(url)
    if (!forceRedownload && existingHashes.has(hash)) continue

    attempted += 1
    try {
      const { buffer, extension, mimeType } = await downloadImage(url)
      const fileName = `bubble-${hash}${extension}`
      const storagePath = `${sellerId}/${listingId}/${fileName}`

      const { error: uploadError } = await supabase.storage
        .from(LISTING_IMAGES_BUCKET)
        .upload(storagePath, buffer, {
          contentType: mimeType,
          upsert: true,
        })

      if (uploadError) throw uploadError

      const sortOrder = forceRedownload ? uploaded : nextSortOrder
      const { error: insertError } = await supabase.from('listing_images').insert({
        listing_id: listingId,
        storage_path: storagePath,
        sort_order: sortOrder,
      })

      if (insertError) {
        if (/duplicate key|unique constraint/i.test(insertError.message)) {
          existingHashes.add(hash)
          continue
        }
        throw insertError
      }

      uploaded += 1
      if (!forceRedownload) nextSortOrder += 1
      existingHashes.add(hash)
    } catch (error) {
      failures.push({
        url,
        resolvedUrl: resolveBubbleImageUrl(url),
        pattern: classifyImageUrl(url),
        classification: error.classification ?? classifyImageFetchError(error, error.status),
        error: error.message || String(error),
      })
    }
  }

  return {
    uploaded,
    attempted,
    failures,
    skipped: uploaded === 0 && failures.length === 0 && existingHashes.size > 0,
  }
}

export async function removeTestBatchListings(supabase) {
  const { data, error } = await supabase
    .from('listings')
    .select('id, slug')
    .like('slug', `${BUBBLE_TEST_PREFIX}%`)
    .eq('source', 'import')

  if (error) throw error
  if (!data?.length) return { removed: 0, slugs: [] }

  const { error: deleteError } = await supabase
    .from('listings')
    .delete()
    .like('slug', `${BUBBLE_TEST_PREFIX}%`)
    .eq('source', 'import')

  if (deleteError) throw deleteError

  return { removed: data.length, slugs: data.map((row) => row.slug) }
}

async function upsertImportListing(supabase, listingRow) {
  const { data: existing, error: existingError } = await supabase
    .from('listings')
    .select('id, source, slug')
    .eq('slug', listingRow.slug)
    .maybeSingle()

  if (existingError) throw existingError

  if (existing && existing.source !== 'import') {
    return {
      ok: false,
      reason: `slug already used by ${existing.source} listing`,
      existingId: existing.id,
    }
  }

  const { data: upserted, error } = await supabase
    .from('listings')
    .upsert(listingRow, { onConflict: 'slug' })
    .select('id, slug')
    .single()

  if (error) throw error
  return { ok: true, data: upserted }
}

export function summarizeImageRecovery(imageFailures, { imagesImported = 0, imageCoverage = null } = {}) {
  let privateNeedsSignedUrl = 0
  let otherFailures = 0

  for (const item of imageFailures ?? []) {
    for (const failure of item.failures ?? []) {
      if (failure.classification === 'private-needs-signed-url') {
        privateNeedsSignedUrl += 1
      } else {
        otherFailures += 1
      }
    }
  }

  return {
    recovered: imagesImported,
    privateNeedsSignedUrl,
    otherFailures,
    imagelessListings: imageCoverage?.zero ?? null,
  }
}

async function summarizeImageCoverage(supabase) {
  const { data: listings, error } = await supabase
    .from('listings')
    .select('id, slug, listing_images(id)')
    .eq('source', 'import')
    .eq('status', 'active')

  if (error) throw error

  const coverage = { zero: 0, one: 0, twoPlus: 0, totalImages: 0 }
  for (const listing of listings ?? []) {
    const count = listing.listing_images?.length ?? 0
    coverage.totalImages += count
    if (count === 0) coverage.zero += 1
    else if (count === 1) coverage.one += 1
    else coverage.twoPlus += 1
  }

  return coverage
}

export function prepareImportRows(records, { categoryMap, slugPrefix = '', limit = null }) {
  const skippedRows = []
  const manualReview = []
  const selectedRows = []
  const usedSlugs = new Set()
  const unmatchedCategories = new Map()
  const locationsWithoutCoordinates = []

  for (let index = 0; index < records.length; index += 1) {
    const row = records[index]
    const evaluation = evaluateRow(row, index + 2, categoryMap)

    if (evaluation.skip) {
      skippedRows.push({
        rowNumber: evaluation.rowNumber,
        title: row.title || '(no title)',
        slug: row.URL_Slug || '',
        reasons: evaluation.reasons,
      })

      const categoryReason = evaluation.reasons.find((reason) => reason.startsWith('category not in database'))
      if (categoryReason) {
        const bubbleType = (row.type ?? '').trim() || '(empty)'
        unmatchedCategories.set(bubbleType, (unmatchedCategories.get(bubbleType) ?? 0) + 1)
      }
      continue
    }

    const location = (row.Location_Geo ?? row['user:location'] ?? '').trim()
    const importSlug = buildImportSlug(row.URL_Slug, evaluation.title, location, usedSlugs, slugPrefix)
    const imageUrls = collectImageUrls(row)
    const coords = resolveLocationCoords(location)
    const brandName = (row.Brand ?? '').trim()

    if (location && !coords.latitude) {
      locationsWithoutCoordinates.push({
        rowNumber: evaluation.rowNumber,
        title: evaluation.title,
        location,
        slug: importSlug,
      })
    }

    const entry = {
      rowNumber: evaluation.rowNumber,
      bubbleSlug: row.URL_Slug,
      importSlug,
      row,
      evaluation,
      imageUrls,
      location,
      coords,
      brandName,
    }

    if (evaluation.reasons.includes('title too long (will truncate)')) {
      manualReview.push({
        rowNumber: evaluation.rowNumber,
        title: evaluation.title,
        slug: importSlug,
        reason: 'title truncated to 120 characters',
      })
    }

    if (!imageUrls.length) {
      manualReview.push({
        rowNumber: evaluation.rowNumber,
        title: evaluation.title,
        slug: importSlug,
        reason: 'no usable image URLs',
      })
    }

    if (!location) {
      manualReview.push({
        rowNumber: evaluation.rowNumber,
        title: evaluation.title,
        slug: importSlug,
        reason: 'missing location',
      })
    }

    selectedRows.push(entry)
    if (limit != null && selectedRows.length >= limit) break
  }

  return {
    skippedRows,
    manualReview,
    selectedRows,
    unmatchedCategories: [...unmatchedCategories.entries()].map(([bubbleType, count]) => ({
      bubbleType,
      count,
    })),
    unmatchedBrands: [],
    locationsWithoutCoordinates,
  }
}

export async function runBubbleImport({
  csvPath = DEFAULT_CSV_PATH,
  dryRun = false,
  imagesOnly = false,
  forceRedownload = false,
  slugPrefix = '',
  limit = null,
  removeTestBatch = false,
  onProgress = null,
} = {}) {
  if (!existsSync(csvPath)) {
    throw new Error(`CSV not found: ${csvPath}`)
  }

  const records = parseCsv(readFileSync(csvPath, 'utf8'))
  const headers = records.length ? Object.keys(records[0]) : []

  let categoryMap = null
  let brandMap = null
  let supabase = null

  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  if (process.env.SUPABASE_SERVICE_ROLE_KEY && url) {
    supabase = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    categoryMap = await fetchCategoryMap(supabase)
    if (!dryRun) {
      brandMap = await fetchBrandMap(supabase)
    }
  }

  const prepared = prepareImportRows(records, { categoryMap, slugPrefix, limit })

  const report = {
    totalCsvRows: records.length,
    csvColumns: headers,
    mode: imagesOnly ? 'images-only' : limit != null ? 'test' : 'full',
    slugPrefix: slugPrefix || '(production Bubble URL_Slug)',
    skippedRows: prepared.skippedRows,
    selectedCount: prepared.selectedRows.length,
    unmatchedCategories: prepared.unmatchedCategories,
    unmatchedBrands: prepared.unmatchedBrands,
    locationsWithoutCoordinates: prepared.locationsWithoutCoordinates,
    manualReview: prepared.manualReview,
    sellerEmail: DEFAULT_SELLER_EMAIL,
    testBatchRemoved: null,
    listingsImported: 0,
    listingsSkippedSlugConflict: 0,
    imagesImported: 0,
    imageFailures: [],
    slugConflicts: [],
    imageCoverage: null,
    dryRun,
  }

  if (dryRun) {
    report.selectedRows = prepared.selectedRows.map((entry) => ({
      rowNumber: entry.rowNumber,
      title: entry.evaluation.title,
      importSlug: entry.importSlug,
      imageCount: entry.imageUrls.length,
    }))
    if (!categoryMap) {
      report.warning =
        'Dry run without Supabase credentials — category DB validation skipped. Re-run with service role for accurate counts.'
    }
    return report
  }

  if (!supabase) {
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY for import.')
  }

  brandMap = await fetchBrandMap(supabase)

  const unmatchedBrandNames = new Set()
  for (const entry of prepared.selectedRows) {
    const { unmatched, brandText } = resolveBrandId(entry.brandName, brandMap)
    if (unmatched && brandText) unmatchedBrandNames.add(brandText)
  }
  report.unmatchedBrands = [...unmatchedBrandNames].sort().map((name) => ({ name }))

  const sellerId = await findSellerId(supabase)

  if (removeTestBatch && !imagesOnly) {
    report.testBatchRemoved = await removeTestBatchListings(supabase)
    console.log(`Removed ${report.testBatchRemoved.removed} test-batch listing(s).`)
  }

  const listingBySlug = new Map()
  if (imagesOnly) {
    const { data: existingListings, error: existingListingsError } = await supabase
      .from('listings')
      .select('id, slug, seller_id')
      .eq('source', 'import')
      .eq('status', 'active')

    if (existingListingsError) throw existingListingsError
    for (const listing of existingListings ?? []) {
      listingBySlug.set(listing.slug, listing)
    }
  }

  let imagesImported = 0
  let imagesAttempted = 0
  const imageFailures = []
  const manualReview = [...prepared.manualReview]
  let listingsProcessed = 0

  for (const entry of prepared.selectedRows) {
    const { row, evaluation, importSlug, imageUrls, location, coords } = entry

    let listingId
    let listingSellerId = sellerId

    if (imagesOnly) {
      const existing = listingBySlug.get(importSlug)
      if (!existing) {
        manualReview.push({
          rowNumber: entry.rowNumber,
          title: evaluation.title,
          slug: importSlug,
          reason: 'listing not found in database for image refresh',
        })
        continue
      }
      listingId = existing.id
      listingSellerId = existing.seller_id
      listingsProcessed += 1
    } else {
      const category = categoryMap[evaluation.categorySlug]
      const { brandId, brandText } = resolveBrandId(row.Brand, brandMap)
      const collectionAvailable = parseYesNo(row.collection_available, true)
      const courierAvailable = inferCourierAvailable(row)

      const listingRow = {
        seller_id: sellerId,
        category_id: category.id,
        brand_id: brandId,
        slug: importSlug,
        brand: brandText,
        title: truncateTitle(evaluation.title),
        description: (row.description ?? '').trim() || null,
        price_pence: evaluation.pricePence,
        condition: mapCondition(row.condition),
        rating: mapRating(row.rating),
        location: location || null,
        collection_available: collectionAvailable,
        courier_available: courierAvailable,
        delivery_notes: buildDeliveryNotes(row),
        status: 'active',
        source: 'import',
        published_at: new Date().toISOString(),
        ...coords,
      }

      const upsertResult = await upsertImportListing(supabase, listingRow)
      if (!upsertResult.ok) {
        report.listingsSkippedSlugConflict += 1
        report.slugConflicts.push({
          rowNumber: entry.rowNumber,
          title: evaluation.title,
          slug: importSlug,
          reason: upsertResult.reason,
        })
        manualReview.push({
          rowNumber: entry.rowNumber,
          title: evaluation.title,
          slug: importSlug,
          reason: upsertResult.reason,
        })
        continue
      }

      report.listingsImported += 1
      listingId = upsertResult.data.id
      listingsProcessed += 1
    }

    const imageResult = await uploadListingImages(supabase, {
      listingId,
      sellerId: listingSellerId,
      imageUrls,
      forceRedownload,
    })

    imagesImported += imageResult.uploaded
    imagesAttempted += imageResult.attempted
    if (imageResult.failures?.length) {
      imageFailures.push({
        slug: importSlug,
        title: evaluation.title,
        failures: imageResult.failures,
      })
      manualReview.push({
        rowNumber: entry.rowNumber,
        title: evaluation.title,
        slug: importSlug,
        reason: `image upload failures: ${imageResult.failures.length}`,
      })
    }

    if (onProgress) {
      onProgress({
        slug: importSlug,
        imagesUploaded: imageResult.uploaded,
        imagesAttempted: imageResult.attempted,
        index: listingsProcessed,
        total: prepared.selectedRows.length,
      })
    }
  }

  report.imagesImported = imagesImported
  report.imagesAttempted = imagesAttempted
  report.imageFailures = imageFailures
  report.manualReview = manualReview
  report.imageCoverage = await summarizeImageCoverage(supabase)
  report.imageRecovery = summarizeImageRecovery(imageFailures, {
    imagesImported,
    imageCoverage: report.imageCoverage,
  })

  if (!imagesOnly) {
    const { count: activeImportCount, error: countError } = await supabase
      .from('listings')
      .select('*', { count: 'exact', head: true })
      .eq('source', 'import')
      .eq('status', 'active')
      .not('slug', 'like', `${BUBBLE_TEST_PREFIX}%`)

    if (!countError) {
      report.activeImportListingsInDb = activeImportCount
    }
  }

  return report
}

export function printImportReport(report, { title = 'Bubble import report' } = {}) {
  console.log(`\n=== ${title} ===\n`)
  console.log(`Total CSV rows: ${report.totalCsvRows}`)
  console.log(`Mode: ${report.mode}`)
  console.log(`Slug strategy: ${report.slugPrefix}`)
  console.log(`Seller: ${report.sellerEmail} (all listings)`)

  if (report.testBatchRemoved) {
    console.log(`Test batch removed: ${report.testBatchRemoved.removed} listing(s)`)
  }

  console.log(`\nActive listings imported this run: ${report.listingsImported}`)
  if (report.activeImportListingsInDb != null) {
    console.log(`Active import listings in database: ${report.activeImportListingsInDb}`)
  }
  console.log(`Images imported this run: ${report.imagesImported ?? 0}`)
  if (report.imagesAttempted != null) {
    console.log(`Image URLs attempted this run: ${report.imagesAttempted}`)
  }
  if (report.imageCoverage) {
    console.log('\nImage coverage (active import listings):')
    console.log(`  0 images: ${report.imageCoverage.zero}`)
    console.log(`  1 image: ${report.imageCoverage.one}`)
    console.log(`  2+ images: ${report.imageCoverage.twoPlus}`)
    console.log(`  total images in DB: ${report.imageCoverage.totalImages}`)
  }
  if (report.imageRecovery) {
    console.log('\nImage recovery summary:')
    console.log(`  images recovered this run: ${report.imageRecovery.recovered}`)
    console.log(`  listings still with 0 images: ${report.imageRecovery.imagelessListings ?? 'n/a'}`)
    console.log(`  private-needs-signed-url: ${report.imageRecovery.privateNeedsSignedUrl}`)
    console.log(`  other failures: ${report.imageRecovery.otherFailures}`)
  }
  console.log(`Skipped rows: ${report.skippedRows.length}`)
  if (report.listingsSkippedSlugConflict) {
    console.log(`Slug conflicts (non-import): ${report.listingsSkippedSlugConflict}`)
  }

  if (report.skippedRows.length) {
    console.log('\nSkipped rows:')
    for (const skipped of report.skippedRows) {
      console.log(`  row ${skipped.rowNumber}: ${skipped.title} — ${skipped.reasons.join('; ')}`)
    }
  }

  if (report.unmatchedCategories?.length) {
    console.log('\nCategories not matched (rows skipped):')
    for (const item of report.unmatchedCategories) {
      console.log(`  ${item.bubbleType}: ${item.count} row(s)`)
    }
  }

  if (report.unmatchedBrands?.length) {
    console.log('\nBrands not matched (imported with brand text only):')
    for (const item of report.unmatchedBrands) {
      console.log(`  ${item.name}`)
    }
  }

  if (report.locationsWithoutCoordinates?.length) {
    console.log(`\nLocations without coordinates: ${report.locationsWithoutCoordinates.length}`)
    for (const item of report.locationsWithoutCoordinates.slice(0, 25)) {
      console.log(`  row ${item.rowNumber}: ${item.location} (${item.title})`)
    }
    if (report.locationsWithoutCoordinates.length > 25) {
      console.log(`  … and ${report.locationsWithoutCoordinates.length - 25} more`)
    }
  }

  if (report.manualReview?.length) {
    console.log('\nManual review items:')
    for (const item of report.manualReview) {
      console.log(`  row ${item.rowNumber}: ${item.title} — ${item.reason}`)
    }
  }

  if (report.imageFailures?.length) {
    console.log('\nImage failures:')
    const failuresByPattern = new Map()
    const failuresByClassification = new Map()
    for (const item of report.imageFailures) {
      for (const failure of item.failures) {
        const pattern = failure.pattern ?? 'unknown'
        failuresByPattern.set(pattern, (failuresByPattern.get(pattern) ?? 0) + 1)
        const classification = failure.classification ?? 'unknown'
        failuresByClassification.set(
          classification,
          (failuresByClassification.get(classification) ?? 0) + 1,
        )
      }
      console.log(
        `  ${item.slug}: ${item.failures.map((failure) => `[${failure.classification ?? 'unknown'}] ${failure.error}`).join('; ')}`,
      )
    }
    if (failuresByClassification.size) {
      console.log('\nImage failures by classification:')
      for (const [classification, count] of [...failuresByClassification.entries()].sort(
        (a, b) => b[1] - a[1],
      )) {
        console.log(`  ${classification}: ${count}`)
      }
    }
    if (failuresByPattern.size) {
      console.log('\nImage failures by URL pattern:')
      for (const [pattern, count] of [...failuresByPattern.entries()].sort((a, b) => b[1] - a[1])) {
        console.log(`  ${pattern}: ${count}`)
      }
    }
  }
}
