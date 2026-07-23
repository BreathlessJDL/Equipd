/**
 * IndexNow shared core (Node + Deno).
 * Eligibility, material-change decisions, batching, request building, retries.
 * Never logs the IndexNow key.
 */

export const INDEXNOW_HOST = 'www.equipd.co.uk'
export const INDEXNOW_ORIGIN = `https://${INDEXNOW_HOST}`
export const INDEXNOW_ENDPOINT = 'https://api.indexnow.org/indexnow'
export const INDEXNOW_MAX_URLS_PER_REQUEST = 10000
/** Practical default batch size well under the protocol limit. */
export const INDEXNOW_BATCH_SIZE = 100
export const INDEXNOW_MIN_BATCH_SIZE = 1
export const INDEXNOW_MAX_BATCH_SIZE = 500
/** Soft JSON body budget per request (bytes). */
export const INDEXNOW_MAX_BODY_BYTES = 120_000
/** Isolate-local only — not a global queue. Default off. */
export const INDEXNOW_DEBOUNCE_MS = 0
export const INDEXNOW_MAX_ATTEMPTS = 4
export const INDEXNOW_REQUEST_TIMEOUT_MS = 15_000
export const INDEXNOW_KEY_PATTERN = /^[a-zA-Z0-9-]{8,128}$/

/** @type {readonly string[]} */
export const INDEXNOW_PRIVATE_PREFIXES = Object.freeze([
  '/admin',
  '/hub',
  '/messages',
  '/notifications',
  '/checkout',
  '/orders',
  '/settings',
  '/login',
  '/signup',
  '/auth',
  '/account',
  '/api',
  '/functions',
])

const TRACKING_PARAMS = new Set([
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'gclid',
  'fbclid',
  'msclkid',
  'ref',
  'ref_src',
])

const LISTING_MATERIAL_FIELDS = Object.freeze([
  'title',
  'description',
  'price_pence',
  'condition',
  'category_id',
  'brand',
  'model',
  'location',
  'location_name',
  'city',
  'county',
  'postcode',
  'collection_available',
  'courier_available',
  'delivery_notes',
  'seller_delivery_radius_miles',
  'status',
  'slug',
])

const EQUIPMENT_MATERIAL_FIELDS = Object.freeze([
  'canonical_product_name',
  'canonical_product_key',
  'brand',
  'model',
  'equipment_type',
  'product_family',
  'status',
  'baseline_manufacture_year',
  'production_start_year',
  'production_end_year',
  'original_base_price',
  'original_base_price_currency',
  'image_url',
  'image_storage_path',
  'image_status',
])

const EQUIPMENT_CONTENT_MATERIAL_FIELDS = Object.freeze([
  'generation_status',
  'overview_text',
  'faq_json',
  'seo_meta_title',
  'seo_meta_description',
])

const PUBLIC_LISTING_STATUSES = new Set(['active'])

function hasMeaningfulText(value) {
  if (value == null) return false
  if (typeof value === 'string') return value.trim().length > 0
  if (Array.isArray(value)) return value.length > 0
  if (typeof value === 'object') return Object.keys(value).length > 0
  return Boolean(value)
}

function hasPublicImage(product) {
  const status = String(product?.image_status ?? '').toLowerCase()
  if (status && status !== 'approved') return false
  return hasMeaningfulText(product?.image_url) || hasMeaningfulText(product?.image_storage_path)
}

/**
 * @param {string} key
 * @returns {boolean}
 */
export function isValidIndexNowKeyFormat(key) {
  return INDEXNOW_KEY_PATTERN.test(String(key ?? ''))
}

/**
 * @param {string} key
 * @returns {string}
 */
export function buildIndexNowKeyLocation(key) {
  return `${INDEXNOW_ORIGIN}/${key}.txt`
}

/**
 * @param {string} pathOrUrl
 * @returns {string}
 */
export function hashUrlPathForLogs(pathOrUrl) {
  const raw = String(pathOrUrl ?? '')
  let hash = 2166136261
  for (let i = 0; i < raw.length; i += 1) {
    hash ^= raw.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return `u${(hash >>> 0).toString(16).padStart(8, '0')}`
}

/**
 * Normalize to a canonical www Equipd URL, or null if ineligible.
 * Apex equipd.co.uk is rewritten to www. Fragments and tracking params are stripped.
 * Non-canonical query filter states are rejected (except none — public paths must be clean).
 *
 * @param {string} input
 * @returns {string | null}
 */
export function normalizeIndexNowUrl(input) {
  const raw = String(input ?? '').trim()
  if (!raw) return null

  let url
  try {
    url = new URL(raw, INDEXNOW_ORIGIN)
  } catch {
    return null
  }

  if (url.protocol !== 'https:') return null
  if (url.username || url.password) return null
  if (url.hash) {
    url.hash = ''
  }

  const host = url.hostname.toLowerCase()
  if (host === 'equipd.co.uk') {
    url.hostname = INDEXNOW_HOST
  } else if (host !== INDEXNOW_HOST) {
    return null
  }

  // Reject tracking and all remaining query params for public canonical routes.
  if ([...url.searchParams.keys()].some((key) => TRACKING_PARAMS.has(key.toLowerCase()))) {
    for (const key of [...url.searchParams.keys()]) {
      if (TRACKING_PARAMS.has(key.toLowerCase())) url.searchParams.delete(key)
    }
  }
  if ([...url.searchParams.keys()].length > 0) {
    return null
  }

  let pathname = url.pathname.replace(/\/{2,}/g, '/')
  if (pathname.length > 1 && pathname.endsWith('/')) {
    pathname = pathname.slice(0, -1)
  }
  url.pathname = pathname || '/'

  return `${INDEXNOW_ORIGIN}${url.pathname === '/' ? '/' : url.pathname}`
}

/**
 * @param {string} url
 * @returns {boolean}
 */
export function isEligiblePublicUrl(url) {
  const normalized = normalizeIndexNowUrl(url)
  if (!normalized) return false

  let pathname
  try {
    pathname = new URL(normalized).pathname
  } catch {
    return false
  }

  const lower = pathname.toLowerCase()
  if (INDEXNOW_PRIVATE_PREFIXES.some((prefix) => lower === prefix || lower.startsWith(`${prefix}/`))) {
    return false
  }

  if (lower === '/') return true
  if (lower === '/brands' || lower.startsWith('/brands/')) return true
  if (lower.startsWith('/equipment/')) {
    const key = lower.slice('/equipment/'.length)
    return Boolean(key) && !key.includes('/')
  }
  if (lower.startsWith('/listings/')) {
    const slug = lower.slice('/listings/'.length)
    if (!slug || slug.includes('/')) return false
    if (slug === 'new') return false
    return true
  }
  if (lower === '/browse' || lower === '/valuation' || lower === '/about' || lower === '/help') {
    return true
  }
  if (lower.startsWith('/help/') && !lower.slice('/help/'.length).includes('/')) {
    return true
  }

  return false
}

/**
 * @param {string[]} urls
 * @returns {string[]}
 */
export function dedupeIndexNowUrls(urls = []) {
  const seen = new Set()
  const out = []
  for (const item of urls) {
    const normalized = normalizeIndexNowUrl(item)
    if (!normalized || !isEligiblePublicUrl(normalized)) continue
    if (seen.has(normalized)) continue
    seen.add(normalized)
    out.push(normalized)
  }
  // Deterministic order for stable batches and logs.
  out.sort((a, b) => a.localeCompare(b))
  return out
}

/**
 * @param {number} [batchSize]
 */
export function resolveIndexNowBatchSize(batchSize) {
  const raw = Number(batchSize)
  const value = Number.isFinite(raw) && raw > 0 ? raw : INDEXNOW_BATCH_SIZE
  return Math.max(
    INDEXNOW_MIN_BATCH_SIZE,
    Math.min(value, INDEXNOW_MAX_BATCH_SIZE, INDEXNOW_MAX_URLS_PER_REQUEST),
  )
}

/**
 * @param {string[]} urls
 * @param {number} [batchSize]
 * @returns {string[][]}
 */
export function batchIndexNowUrls(urls = [], batchSize = INDEXNOW_BATCH_SIZE) {
  const size = resolveIndexNowBatchSize(batchSize)
  const unique = dedupeIndexNowUrls(urls)
  const batches = []
  let current = []

  for (const url of unique) {
    const candidate = [...current, url]
    const estimated = JSON.stringify({
      host: INDEXNOW_HOST,
      key: 'x'.repeat(32),
      keyLocation: buildIndexNowKeyLocation('x'.repeat(32)),
      urlList: candidate,
    }).length

    if (
      current.length >= size
      || (current.length > 0 && estimated > INDEXNOW_MAX_BODY_BYTES)
    ) {
      batches.push(current)
      current = [url]
      continue
    }
    current = candidate
  }

  if (current.length) batches.push(current)
  return batches
}

/**
 * Classify URLs into route families for reports.
 * @param {string[]} urls
 */
export function summarizeIndexNowUrlFamilies(urls = []) {
  const summary = {
    equipment: 0,
    brands: 0,
    brandDirectory: 0,
    listings: 0,
    locations: 0,
    other: 0,
    total: 0,
  }
  const knownCities = new Set([
    'leeds', 'manchester', 'birmingham', 'london', 'sheffield',
    'bristol', 'liverpool', 'newcastle', 'glasgow', 'cardiff',
  ])

  for (const url of dedupeIndexNowUrls(urls)) {
    summary.total += 1
    let pathname = '/'
    try {
      pathname = new URL(url).pathname
    } catch {
      summary.other += 1
      continue
    }
    if (pathname.startsWith('/equipment/')) summary.equipment += 1
    else if (pathname === '/brands') summary.brandDirectory += 1
    else if (pathname.startsWith('/brands/')) summary.brands += 1
    else if (pathname.startsWith('/listings/')) {
      const slug = pathname.slice('/listings/'.length)
      if (knownCities.has(slug)) summary.locations += 1
      else summary.listings += 1
    } else summary.other += 1
  }
  return summary
}

/**
 * @param {{ key: string, urlList: string[], keyLocation?: string }} input
 */
export function buildIndexNowRequestBody({ key, urlList, keyLocation }) {
  const safeKey = String(key ?? '')
  const urls = dedupeIndexNowUrls(urlList)
  return {
    host: INDEXNOW_HOST,
    key: safeKey,
    keyLocation: keyLocation || buildIndexNowKeyLocation(safeKey),
    urlList: urls,
  }
}

/**
 * @param {unknown} value
 */
function normalizeComparable(value) {
  if (value == null) return null
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'number' || typeof value === 'boolean') return value
  return value
}

/**
 * @param {Record<string, unknown> | null | undefined} before
 * @param {Record<string, unknown> | null | undefined} after
 * @param {readonly string[]} fields
 */
export function didMaterialFieldsChange(before, after, fields) {
  const prev = before ?? {}
  const next = after ?? {}
  return fields.some((field) => normalizeComparable(prev[field]) !== normalizeComparable(next[field]))
}

/**
 * @param {string | null | undefined} status
 */
export function isPublicListingStatus(status) {
  return PUBLIC_LISTING_STATUSES.has(String(status ?? '').trim().toLowerCase())
}

/**
 * Decide whether a listing mutation should notify IndexNow.
 *
 * @param {{
 *   previous?: Record<string, unknown> | null,
 *   next?: Record<string, unknown> | null,
 *   action?: 'create' | 'update' | 'delete' | 'images',
 * }} input
 */
export function shouldNotifyListingChange({ previous = null, next = null, action = 'update' } = {}) {
  if (action === 'delete') {
    if (previous && isPublicListingStatus(previous.status)) {
      return { notify: true, reason: 'listing_deleted_while_public' }
    }
    return { notify: false, reason: 'listing_deleted_not_public' }
  }

  if (action === 'create') {
    if (next && isPublicListingStatus(next.status)) {
      return { notify: true, reason: 'listing_published' }
    }
    return { notify: false, reason: 'listing_created_as_draft' }
  }

  if (action === 'images') {
    if (next && isPublicListingStatus(next.status)) {
      return { notify: true, reason: 'listing_images_changed' }
    }
    return { notify: false, reason: 'listing_images_changed_not_public' }
  }

  const wasPublic = previous ? isPublicListingStatus(previous.status) : false
  const isPublic = next ? isPublicListingStatus(next.status) : false
  const nextStatus = String(next?.status ?? '').trim().toLowerCase()

  if (!wasPublic && isPublic) {
    return { notify: true, reason: 'listing_published' }
  }
  // Sold pages remain publicly readable (Stage 5). Treat as content change, not removal.
  if (wasPublic && nextStatus === 'sold') {
    return { notify: true, reason: 'listing_sold' }
  }
  if (wasPublic && !isPublic) {
    return { notify: true, reason: 'listing_unpublished' }
  }
  if (wasPublic && isPublic && didMaterialFieldsChange(previous, next, LISTING_MATERIAL_FIELDS)) {
    return { notify: true, reason: 'listing_material_update' }
  }

  return { notify: false, reason: 'listing_non_material_or_private' }
}

/**
 * @param {{
 *   previous?: Record<string, unknown> | null,
 *   next?: Record<string, unknown> | null,
 *   action?: 'approve' | 'exclude' | 'update' | 'image' | 'key_change',
 *   publicEligible?: (product: Record<string, unknown> | null | undefined) => boolean,
 * }} input
 */
export function shouldNotifyEquipmentProductChange({
  previous = null,
  next = null,
  action = 'update',
  publicEligible = () => true,
} = {}) {
  const wasPublic = previous ? publicEligible(previous) : false
  const isPublic = next ? publicEligible(next) : false

  if (action === 'approve' && isPublic) {
    return { notify: true, reason: 'equipment_approved' }
  }
  if (action === 'exclude') {
    if (wasPublic) {
      return { notify: true, reason: 'equipment_excluded' }
    }
    return { notify: false, reason: 'equipment_exclude_not_public' }
  }
  if (action === 'image') {
    if (!isPublic && !wasPublic) {
      return { notify: false, reason: 'equipment_image_not_public' }
    }
    if (didMaterialFieldsChange(previous, next, ['image_url', 'image_storage_path', 'image_status'])) {
      const imageRemoved = hasPublicImage(previous) && !hasPublicImage(next)
      if (imageRemoved) {
        return { notify: true, reason: 'equipment_image_removed' }
      }
      return { notify: true, reason: 'equipment_image_material_update' }
    }
    return { notify: false, reason: 'equipment_image_non_material' }
  }
  if (action === 'key_change' && (wasPublic || isPublic)) {
    return { notify: true, reason: 'equipment_canonical_key_changed' }
  }

  if (!wasPublic && isPublic) {
    return { notify: true, reason: 'equipment_became_public' }
  }
  if (wasPublic && !isPublic) {
    return { notify: true, reason: 'equipment_left_public' }
  }
  if ((wasPublic || isPublic) && didMaterialFieldsChange(previous, next, EQUIPMENT_MATERIAL_FIELDS)) {
    // Ignore confidence-only / research-meta-only if those are the only diffs handled above.
    const materialPublic = didMaterialFieldsChange(previous, next, [
      'canonical_product_name',
      'canonical_product_key',
      'brand',
      'model',
      'equipment_type',
      'product_family',
      'status',
      'baseline_manufacture_year',
      'production_start_year',
      'production_end_year',
      'original_base_price',
      'original_base_price_currency',
      'image_url',
      'image_storage_path',
      'image_status',
    ])
    if (materialPublic) {
      return { notify: true, reason: 'equipment_material_update' }
    }
  }

  return { notify: false, reason: 'equipment_non_material' }
}

/**
 * Confidence / research score changes alone must not notify.
 * @param {Record<string, unknown> | null | undefined} before
 * @param {Record<string, unknown> | null | undefined} after
 */
export function isEquipmentConfidenceOnlyChange(before, after) {
  const metaOnly = [
    'original_price_confidence',
    'lifecycle_confidence',
    'image_confidence',
    'review_notes',
    'baseline_source',
    'original_price_source',
    'original_price_source_url',
    'updated_at',
    'created_at',
  ]
  const changedMeta = didMaterialFieldsChange(before, after, metaOnly)
  const changedMaterial = didMaterialFieldsChange(before, after, EQUIPMENT_MATERIAL_FIELDS)
  return changedMeta && !changedMaterial
}

/**
 * @param {{
 *   previous?: Record<string, unknown> | null,
 *   next?: Record<string, unknown> | null,
 *   action?: 'publish' | 'update' | 'withdraw',
 * }} input
 */
export function shouldNotifyEquipmentContentChange({ previous = null, next = null, action = 'update' } = {}) {
  const wasApproved = String(previous?.generation_status ?? '').toLowerCase() === 'approved'
  const isApproved = String(next?.generation_status ?? '').toLowerCase() === 'approved'

  if (action === 'publish' && isApproved) {
    return { notify: true, reason: 'equipment_content_published' }
  }
  if (action === 'withdraw' && wasApproved) {
    return { notify: true, reason: 'equipment_content_withdrawn' }
  }
  if (wasApproved && !isApproved) {
    return { notify: true, reason: 'equipment_content_unapproved' }
  }
  if (isApproved && didMaterialFieldsChange(previous, next, EQUIPMENT_CONTENT_MATERIAL_FIELDS)) {
    const faqRemoved = hasMeaningfulText(previous?.faq_json) && !hasMeaningfulText(next?.faq_json)
    const overviewRemoved = hasMeaningfulText(previous?.overview_text) && !hasMeaningfulText(next?.overview_text)
    if (faqRemoved) return { notify: true, reason: 'equipment_faq_removed' }
    if (overviewRemoved) return { notify: true, reason: 'equipment_overview_removed' }
    return { notify: true, reason: 'equipment_content_material_update' }
  }
  return { notify: false, reason: 'equipment_content_non_material' }
}

/**
 * @param {string | null | undefined} slug
 */
export function buildListingIndexNowUrl(slug) {
  const value = String(slug ?? '').trim()
  if (!value || value === 'new') return null
  return normalizeIndexNowUrl(`${INDEXNOW_ORIGIN}/listings/${encodeURIComponent(value)}`)
}

/**
 * @param {string | null | undefined} canonicalProductKey
 */
export function buildEquipmentIndexNowUrl(canonicalProductKey) {
  const key = String(canonicalProductKey ?? '').trim()
  if (!key) return null
  return normalizeIndexNowUrl(`${INDEXNOW_ORIGIN}/equipment/${encodeURIComponent(key)}`)
}

/**
 * @param {string | null | undefined} brandSlug
 */
export function buildBrandIndexNowUrl(brandSlug) {
  const slug = String(brandSlug ?? '').trim()
  if (!slug) return normalizeIndexNowUrl(`${INDEXNOW_ORIGIN}/brands`)
  return normalizeIndexNowUrl(`${INDEXNOW_ORIGIN}/brands/${encodeURIComponent(slug)}`)
}

/**
 * @param {string | null | undefined} citySlug
 */
export function buildLocationIndexNowUrl(citySlug) {
  const slug = String(citySlug ?? '').trim()
  if (!slug) return null
  return normalizeIndexNowUrl(`${INDEXNOW_ORIGIN}/listings/${encodeURIComponent(slug)}`)
}

/**
 * Classify an IndexNow HTTP response.
 * @param {number} status
 */
export function classifyIndexNowResponseStatus(status) {
  const code = Number(status)
  if (code === 200) return 'success'
  if (code === 202) return 'accepted'
  if (code === 400) return 'bad_request'
  if (code === 403) return 'invalid_key'
  if (code === 422) return 'unprocessable'
  if (code === 429) return 'rate_limited'
  if (code >= 500) return 'server_error'
  if (code === 0) return 'network_error'
  return 'unknown'
}

/**
 * @param {string} category
 */
export function isRetryableIndexNowFailure(category) {
  return category === 'rate_limited'
    || category === 'server_error'
    || category === 'network_error'
    || category === 'timeout'
}

/**
 * @param {number} attempt 1-based
 */
export function indexNowBackoffMs(attempt) {
  const base = 400
  const exp = Math.min(8, Math.max(0, attempt - 1))
  const jitter = Math.floor(Math.random() * 200)
  return base * (2 ** exp) + jitter
}

/**
 * Redact secrets from log payloads.
 * @param {unknown} value
 * @param {string} [key]
 */
export function redactIndexNowSecrets(value, key = '') {
  if (key && /key|secret|token|authorization|service.role/i.test(key)) {
    return '[redacted]'
  }
  if (Array.isArray(value)) {
    return value.map((item) => redactIndexNowSecrets(item))
  }
  if (value && typeof value === 'object') {
    const out = {}
    for (const [entryKey, entryValue] of Object.entries(value)) {
      out[entryKey] = redactIndexNowSecrets(entryValue, entryKey)
    }
    return out
  }
  return value
}

/**
 * Build a safe diagnostic log object (no key, no full secrets).
 */
export function buildIndexNowLogRecord({
  source,
  contentType,
  urls = [],
  endpoint = INDEXNOW_ENDPOINT,
  status = null,
  category = null,
  attempt = 1,
  ok = false,
  errorMessage = null,
  batchIndex = null,
  batchTotal = null,
  durationMs = null,
} = {}) {
  const safePaths = urls.slice(0, 30).map((url) => {
    try {
      return new URL(url).pathname
    } catch {
      return hashUrlPathForLogs(url)
    }
  })
  return {
    timestamp: new Date().toISOString(),
    source: source || 'unknown',
    contentType: contentType || 'unknown',
    urlCount: urls.length,
    urlHashes: urls.slice(0, 50).map((url) => hashUrlPathForLogs(url)),
    safePaths,
    endpoint,
    responseStatus: status,
    category,
    attempt,
    batchIndex,
    batchTotal,
    durationMs,
    ok,
    errorMessage: errorMessage ? String(errorMessage).slice(0, 300) : null,
  }
}

/**
 * Submit URL batches to IndexNow with bounded retries.
 * Deduplicates before splitting. Failed batches do not re-send successful ones.
 *
 * @param {string[]} urls
 * @param {{
 *   key: string,
 *   keyLocation?: string,
 *   source?: string,
 *   contentType?: string,
 *   batchSize?: number,
 *   fetchImpl?: typeof fetch,
 *   sleepImpl?: (ms: number) => Promise<void>,
 *   nowImpl?: () => number,
 *   recentSubmissions?: Map<string, number>,
 *   debounceMs?: number,
 *   force?: boolean,
 *   logger?: { info?: Function, error?: Function },
 * }} options
 */
export async function submitIndexNowUrls(urls, options = {}) {
  const key = String(options.key ?? '')
  if (!isValidIndexNowKeyFormat(key)) {
    return {
      ok: false,
      category: 'invalid_key',
      submitted: [],
      failed: [],
      batches: [],
      error: 'INDEXNOW_KEY is missing or invalid',
    }
  }

  const fetchImpl = options.fetchImpl || globalThis.fetch
  const sleepImpl = options.sleepImpl || ((ms) => new Promise((resolve) => setTimeout(resolve, ms)))
  const nowImpl = options.nowImpl || Date.now
  const logger = options.logger || console
  const debounceMs = options.debounceMs ?? INDEXNOW_DEBOUNCE_MS
  const recent = options.recentSubmissions
  const envBatchSize = typeof Deno !== 'undefined' && Deno?.env?.get
    ? Deno.env.get('INDEXNOW_BATCH_SIZE')
    : (typeof process !== 'undefined' ? process.env?.INDEXNOW_BATCH_SIZE : undefined)
  const batchSize = resolveIndexNowBatchSize(
    options.batchSize ?? Number(envBatchSize || INDEXNOW_BATCH_SIZE),
  )

  let prepared = dedupeIndexNowUrls(urls)
  if (!options.force && recent && debounceMs > 0) {
    const now = nowImpl()
    prepared = prepared.filter((url) => {
      const last = recent.get(url)
      return !(typeof last === 'number' && now - last < debounceMs)
    })
  }

  if (!prepared.length) {
    return {
      ok: true,
      category: 'noop',
      submitted: [],
      failed: [],
      batches: [],
      skippedDebounced: true,
    }
  }

  const batches = batchIndexNowUrls(prepared, batchSize)
  const batchResults = []
  const submitted = []
  const failed = []

  for (let batchIndex = 0; batchIndex < batches.length; batchIndex += 1) {
    const batch = batches[batchIndex]
    const body = buildIndexNowRequestBody({
      key,
      keyLocation: options.keyLocation,
      urlList: batch,
    })

    let attempt = 1
    let finalCategory = 'unknown'
    let finalStatus = null
    let succeeded = false
    let lastError = null
    const startedAt = nowImpl()

    while (attempt <= INDEXNOW_MAX_ATTEMPTS) {
      const controller = typeof AbortController !== 'undefined' ? new AbortController() : null
      const timer = controller
        ? setTimeout(() => controller.abort(), INDEXNOW_REQUEST_TIMEOUT_MS)
        : null

      try {
        const response = await fetchImpl(INDEXNOW_ENDPOINT, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json; charset=utf-8',
          },
          body: JSON.stringify(body),
          signal: controller?.signal,
        })
        if (timer) clearTimeout(timer)

        finalStatus = response.status
        finalCategory = classifyIndexNowResponseStatus(response.status)
        const log = buildIndexNowLogRecord({
          source: options.source,
          contentType: options.contentType,
          urls: batch,
          status: finalStatus,
          category: finalCategory,
          attempt,
          batchIndex: batchIndex + 1,
          batchTotal: batches.length,
          durationMs: nowImpl() - startedAt,
          ok: finalCategory === 'success' || finalCategory === 'accepted',
        })
        logger.info?.('[indexnow]', log)

        if (finalCategory === 'success' || finalCategory === 'accepted') {
          succeeded = true
          submitted.push(...batch)
          if (recent) {
            const now = nowImpl()
            for (const url of batch) recent.set(url, now)
          }
          break
        }

        if (!isRetryableIndexNowFailure(finalCategory) || attempt >= INDEXNOW_MAX_ATTEMPTS) {
          break
        }
      } catch (error) {
        if (timer) clearTimeout(timer)
        lastError = error
        const aborted = error?.name === 'AbortError'
        finalCategory = aborted ? 'timeout' : 'network_error'
        finalStatus = 0
        logger.error?.('[indexnow]', buildIndexNowLogRecord({
          source: options.source,
          contentType: options.contentType,
          urls: batch,
          status: finalStatus,
          category: finalCategory,
          attempt,
          batchIndex: batchIndex + 1,
          batchTotal: batches.length,
          durationMs: nowImpl() - startedAt,
          ok: false,
          errorMessage: error?.message || String(error),
        }))
        if (!isRetryableIndexNowFailure(finalCategory) || attempt >= INDEXNOW_MAX_ATTEMPTS) {
          break
        }
      }

      await sleepImpl(indexNowBackoffMs(attempt))
      attempt += 1
    }

    if (!succeeded) failed.push(...batch)

    batchResults.push({
      batchIndex: batchIndex + 1,
      batchTotal: batches.length,
      urlCount: batch.length,
      ok: succeeded,
      category: finalCategory,
      status: finalStatus,
      attempts: Math.min(attempt, INDEXNOW_MAX_ATTEMPTS),
      durationMs: nowImpl() - startedAt,
      error: succeeded ? null : (lastError?.message || finalCategory),
    })
  }

  const allOk = batchResults.every((result) => result.ok)
  const anyOk = batchResults.some((result) => result.ok)
  const category = allOk
    ? 'success'
    : anyOk
      ? 'partial_success'
      : (batchResults.find((result) => !result.ok)?.category || 'unknown')

  return {
    ok: allOk,
    partial: anyOk && !allOk,
    category,
    submitted,
    failed,
    batches: batchResults,
    error: allOk ? null : 'One or more IndexNow batches failed',
  }
}

export const INDEXNOW_MATERIAL_FIELD_SETS = Object.freeze({
  listing: LISTING_MATERIAL_FIELDS,
  equipment: EQUIPMENT_MATERIAL_FIELDS,
  equipmentContent: EQUIPMENT_CONTENT_MATERIAL_FIELDS,
})
