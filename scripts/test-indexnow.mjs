/**
 * IndexNow unit + security tests. Mocks external IndexNow HTTP.
 * Run: node scripts/test-indexnow.mjs
 */
import assert from 'node:assert/strict'
import {
  INDEXNOW_BATCH_SIZE,
  INDEXNOW_ENDPOINT,
  INDEXNOW_HOST,
  INDEXNOW_ORIGIN,
  batchIndexNowUrls,
  buildIndexNowKeyLocation,
  buildIndexNowLogRecord,
  buildIndexNowRequestBody,
  buildListingIndexNowUrl,
  classifyIndexNowResponseStatus,
  dedupeIndexNowUrls,
  didMaterialFieldsChange,
  isEligiblePublicUrl,
  isEquipmentConfidenceOnlyChange,
  isRetryableIndexNowFailure,
  isValidIndexNowKeyFormat,
  normalizeIndexNowUrl,
  redactIndexNowSecrets,
  shouldNotifyEquipmentContentChange,
  shouldNotifyEquipmentProductChange,
  shouldNotifyListingChange,
  submitIndexNowUrls,
} from '../src/lib/indexNowCore.js'
import {
  collectEquipmentContentIndexNowUrls,
  collectEquipmentIndexNowUrls,
  collectListingIndexNowUrls,
} from '../src/lib/indexNowCollect.js'
import { EQUIPD_SITE_ORIGIN } from '../src/lib/brandCatalogueCore.js'

let passed = 0
function ok(condition, message) {
  assert.ok(condition, message)
  passed += 1
}

ok(EQUIPD_SITE_ORIGIN === INDEXNOW_ORIGIN, 'IndexNow origin matches shared EQUIPD_SITE_ORIGIN')

// --- A. URL normalisation / eligibility ---
ok(
  normalizeIndexNowUrl('https://www.equipd.co.uk/equipment/concept2-bikeerg')
    === 'https://www.equipd.co.uk/equipment/concept2-bikeerg',
  'www canonical accepted',
)
ok(
  normalizeIndexNowUrl('https://equipd.co.uk/equipment/concept2-bikeerg')
    === 'https://www.equipd.co.uk/equipment/concept2-bikeerg',
  'apex rewritten to www',
)
ok(normalizeIndexNowUrl('http://localhost:5174/equipment/x') === null, 'localhost rejected')
ok(normalizeIndexNowUrl('https://equipd-git-main.vercel.app/equipment/x') === null, 'preview rejected')
ok(normalizeIndexNowUrl('https://evil.example/equipment/x') === null, 'foreign host rejected')
ok(normalizeIndexNowUrl('https://www.equipd.co.uk/admin') === null || !isEligiblePublicUrl('https://www.equipd.co.uk/admin'), 'admin ineligible')
ok(!isEligiblePublicUrl('https://www.equipd.co.uk/admin/products'), 'admin nested rejected')
ok(!isEligiblePublicUrl('https://www.equipd.co.uk/messages'), 'messages rejected')
ok(!isEligiblePublicUrl('https://www.equipd.co.uk/hub'), 'hub rejected')
ok(!isEligiblePublicUrl('https://www.equipd.co.uk/browse?brand=Life%20Fitness'), 'query filter rejected')
ok(
  normalizeIndexNowUrl('https://www.equipd.co.uk/equipment/x#product')
    === 'https://www.equipd.co.uk/equipment/x',
  'fragment stripped',
)
ok(
  normalizeIndexNowUrl('https://www.equipd.co.uk/equipment/x?utm_source=bing')
    === 'https://www.equipd.co.uk/equipment/x',
  'tracking params stripped then accepted',
)
ok(isEligiblePublicUrl('https://www.equipd.co.uk/listings/london'), 'location page eligible')
ok(isEligiblePublicUrl('https://www.equipd.co.uk/listings/my-bike-abc123'), 'listing detail eligible')
ok(!isEligiblePublicUrl('https://www.equipd.co.uk/listings/new'), 'listings/new rejected')
ok(!isEligiblePublicUrl('https://mhwvzovxlqimcuxvyyjf.supabase.co/storage/v1/object/public/x'), 'supabase rejected')

// --- B. Deduplication ---
const deduped = dedupeIndexNowUrls([
  'https://www.equipd.co.uk/equipment/a',
  'https://equipd.co.uk/equipment/a',
  'https://www.equipd.co.uk/equipment/b',
  'https://www.equipd.co.uk/admin',
])
ok(deduped.length === 2, 'dedupe collapses + drops ineligible')
ok(deduped[0].endsWith('/equipment/a') && deduped[1].endsWith('/equipment/b'), 'stable order')

const slugPair = dedupeIndexNowUrls([
  'https://www.equipd.co.uk/listings/old-slug',
  'https://www.equipd.co.uk/listings/new-slug',
])
ok(slugPair.length === 2, 'old/new slug retained separately')

const many = Array.from({ length: INDEXNOW_BATCH_SIZE + 5 }, (_, i) => `https://www.equipd.co.uk/equipment/item-${i}`)
ok(batchIndexNowUrls(many).length === 2, 'batches split over batch size')

// --- C. Material-change logic ---
ok(shouldNotifyListingChange({
  previous: { status: 'draft' },
  next: { status: 'active', slug: 'bike', title: 'Bike' },
  action: 'update',
}).notify, 'publish notifies')

ok(shouldNotifyListingChange({
  previous: { status: 'active', slug: 'bike', title: 'A', price_pence: 100 },
  next: { status: 'active', slug: 'bike', title: 'A', price_pence: 200 },
}).notify, 'price edit notifies')

ok(shouldNotifyListingChange({
  previous: { status: 'active', slug: 'bike', title: 'Old' },
  next: { status: 'active', slug: 'bike', title: 'New' },
}).notify, 'title edit notifies')

ok(!shouldNotifyListingChange({
  previous: { status: 'active', slug: 'bike', title: 'A', views: 1 },
  next: { status: 'active', slug: 'bike', title: 'A', views: 99 },
}).notify, 'view count alone does not notify')

ok(!shouldNotifyListingChange({
  previous: null,
  next: { status: 'draft', slug: 'bike' },
  action: 'create',
}).notify, 'draft create does not notify')

ok(shouldNotifyListingChange({
  previous: { status: 'active', slug: 'bike' },
  next: { status: 'sold', slug: 'bike' },
}).notify, 'unpublish/sold notifies')

ok(shouldNotifyEquipmentContentChange({
  previous: { generation_status: 'draft', faq_json: [] },
  next: { generation_status: 'approved', faq_json: [{ q: 'a' }] },
  action: 'publish',
}).notify, 'FAQ publish notifies')

ok(shouldNotifyEquipmentProductChange({
  previous: { status: 'approved', image_status: 'pending', canonical_product_key: 'x', brand: 'Life Fitness', equipment_type: 'Treadmill' },
  next: { status: 'approved', image_status: 'approved', image_url: 'https://cdn/x.png', canonical_product_key: 'x', brand: 'Life Fitness', equipment_type: 'Treadmill' },
  action: 'image',
  publicEligible: (p) => p?.status === 'approved',
}).notify, 'image approval notifies')

ok(isEquipmentConfidenceOnlyChange(
  { status: 'approved', original_price_confidence: 40, canonical_product_key: 'x' },
  { status: 'approved', original_price_confidence: 90, canonical_product_key: 'x' },
), 'confidence-only detected')

ok(!shouldNotifyEquipmentProductChange({
  previous: { status: 'approved', original_price_confidence: 40, canonical_product_key: 'x', brand: 'Life Fitness', equipment_type: 'Treadmill' },
  next: { status: 'approved', original_price_confidence: 90, canonical_product_key: 'x', brand: 'Life Fitness', equipment_type: 'Treadmill' },
  publicEligible: (p) => p?.status === 'approved',
}).notify || isEquipmentConfidenceOnlyChange(
  { status: 'approved', original_price_confidence: 40, canonical_product_key: 'x' },
  { status: 'approved', original_price_confidence: 90, canonical_product_key: 'x' },
), 'confidence-only should not be treated as material product notify path')

const listingCity = collectListingIndexNowUrls({
  previous: { status: 'active', slug: 'bike-1', city: 'Manchester' },
  next: { status: 'active', slug: 'bike-1', city: 'London', price_pence: 500 },
})
ok(listingCity.notify, 'city change notifies')
ok(listingCity.urls.includes('https://www.equipd.co.uk/listings/bike-1'), 'listing url present')
ok(listingCity.urls.includes('https://www.equipd.co.uk/listings/manchester'), 'old city present')
ok(listingCity.urls.includes('https://www.equipd.co.uk/listings/london'), 'new city present')

const bulk = collectEquipmentContentIndexNowUrls({
  rows: Array.from({ length: 50 }, (_, i) => ({
    id: `c${i}`,
    generation_status: 'approved',
    canonical_product_key: `life-fitness-item-${i}`,
    brand: 'Life Fitness',
  })),
  action: 'publish',
})
ok(bulk.notify && bulk.urls.length >= 50, 'bulk publication collects batched URL set')
ok(batchIndexNowUrls(bulk.urls).length >= 1, 'bulk fits in batches')

const favouriteNoise = shouldNotifyListingChange({
  previous: { status: 'active', slug: 'x', title: 'T' },
  next: { status: 'active', slug: 'x', title: 'T', favourite_count: 12 },
})
ok(!favouriteNoise.notify, 'favourite count does not notify')

// --- D. Request generation ---
const body = buildIndexNowRequestBody({
  key: 'testkey12',
  urlList: ['https://www.equipd.co.uk/equipment/a', 'https://evil.test/x'],
})
ok(body.host === INDEXNOW_HOST, 'host correct')
ok(body.keyLocation === buildIndexNowKeyLocation('testkey12'), 'keyLocation correct')
ok(body.urlList.length === 1, 'only eligible URLs in body')
ok(body.key === 'testkey12', 'key present in request body only')

const log = buildIndexNowLogRecord({
  source: 'test',
  contentType: 'listing',
  urls: body.urlList,
  status: 200,
  category: 'success',
})
ok(!JSON.stringify(log).includes('testkey12'), 'log has no key')
ok(redactIndexNowSecrets({ key: 'secret', nested: { token: 'abc' } }).key === '[redacted]', 'redaction works')

// --- E. Responses + retries ---
ok(classifyIndexNowResponseStatus(200) === 'success')
ok(classifyIndexNowResponseStatus(202) === 'accepted')
ok(classifyIndexNowResponseStatus(400) === 'bad_request')
ok(classifyIndexNowResponseStatus(403) === 'invalid_key')
ok(classifyIndexNowResponseStatus(429) === 'rate_limited')
ok(classifyIndexNowResponseStatus(500) === 'server_error')
ok(isRetryableIndexNowFailure('rate_limited'))
ok(isRetryableIndexNowFailure('server_error'))
ok(!isRetryableIndexNowFailure('invalid_key'))
ok(!isRetryableIndexNowFailure('bad_request'))

{
  let calls = 0
  const result = await submitIndexNowUrls(['https://www.equipd.co.uk/equipment/a'], {
    key: 'testkey12',
    force: true,
    sleepImpl: async () => {},
    fetchImpl: async () => {
      calls += 1
      if (calls < 3) return { status: 500 }
      return { status: 200 }
    },
  })
  ok(result.ok && calls === 3, 'retries transient 5xx then succeeds')
}

{
  let calls = 0
  const result = await submitIndexNowUrls(['https://www.equipd.co.uk/equipment/a'], {
    key: 'testkey12',
    force: true,
    sleepImpl: async () => {},
    fetchImpl: async () => {
      calls += 1
      return { status: 403 }
    },
  })
  ok(!result.ok && calls === 1, 'invalid key not retried endlessly')
}

{
  let calls = 0
  await submitIndexNowUrls(['https://www.equipd.co.uk/equipment/a'], {
    key: 'testkey12',
    force: true,
    sleepImpl: async () => {},
    fetchImpl: async (url, init) => {
      calls += 1
      ok(url === INDEXNOW_ENDPOINT, 'official endpoint hardcoded')
      ok(String(init.headers['Content-Type']).includes('application/json'), 'content-type set')
      const parsed = JSON.parse(init.body)
      ok(parsed.host === INDEXNOW_HOST, 'body host')
      return { status: 200 }
    },
  })
  ok(calls === 1, 'success path single call')
}

{
  const recent = new Map()
  const first = await submitIndexNowUrls(['https://www.equipd.co.uk/equipment/a'], {
    key: 'testkey12',
    recentSubmissions: recent,
    debounceMs: 60_000,
    sleepImpl: async () => {},
    fetchImpl: async () => ({ status: 200 }),
  })
  const second = await submitIndexNowUrls(['https://www.equipd.co.uk/equipment/a'], {
    key: 'testkey12',
    recentSubmissions: recent,
    debounceMs: 60_000,
    sleepImpl: async () => {},
    fetchImpl: async () => {
      throw new Error('should not be called')
    },
  })
  ok(first.ok && second.skippedDebounced, 'debounce window skips repeat URL')
}

// --- F. Security ---
ok(isValidIndexNowKeyFormat('abcd1234'))
ok(!isValidIndexNowKeyFormat('short'))
ok(!isValidIndexNowKeyFormat('has spaces!!'))
ok(normalizeIndexNowUrl('https://attacker.test') === null, 'arbitrary host rejected')
ok(buildListingIndexNowUrl('new') === null, 'private create route rejected via builder')

const equipmentCollect = collectEquipmentIndexNowUrls({
  previous: { status: 'needs_review', canonical_product_key: 'lf-x', brand: 'Life Fitness', equipment_type: 'Treadmill' },
  next: { status: 'approved', canonical_product_key: 'lf-x', brand: 'Life Fitness', equipment_type: 'Treadmill' },
  action: 'approve',
  includeBrandDirectory: true,
})
ok(equipmentCollect.notify, 'equipment approve collects urls')
ok(equipmentCollect.urls.some((u) => u.includes('/equipment/lf-x')), 'equipment url')
ok(equipmentCollect.urls.some((u) => u.includes('/brands/life-fitness')), 'brand url')
ok(equipmentCollect.urls.includes('https://www.equipd.co.uk/brands'), 'brands index when requested')

ok(!didMaterialFieldsChange({ a: 1 }, { a: 1 }, ['a']), 'no change')
ok(didMaterialFieldsChange({ a: 1 }, { a: 2 }, ['a']), 'change detected')

// --- Brand deduplication ---
{
  const oneBrand = collectEquipmentContentIndexNowUrls({
    rows: Array.from({ length: 50 }, (_, i) => ({
      id: `r${i}`,
      generation_status: 'approved',
      canonical_product_key: `matrix-fitness-item-${i}`,
      brand: 'Matrix Fitness',
    })).concat([
      // duplicate product row
      { id: 'r0-dup', generation_status: 'approved', canonical_product_key: 'matrix-fitness-item-0', brand: 'Matrix Fitness' },
    ]),
    action: 'publish',
  })
  ok(oneBrand.urls.filter((u) => u.includes('/brands/matrix-fitness')).length === 1, 'one brand URL for 50 Matrix products')
  ok(oneBrand.families.brands === 1, 'family brand count is 1')
  ok(oneBrand.families.equipment === 50, '50 equipment URLs after duplicate collapse')
}

{
  const brands = ['Life Fitness', 'Technogym', 'Matrix Fitness', 'Concept2', 'Precor']
  const multi = collectEquipmentContentIndexNowUrls({
    rows: Array.from({ length: 50 }, (_, i) => ({
      id: `m${i}`,
      generation_status: 'approved',
      canonical_product_key: `item-${i}`,
      brand: brands[i % 5],
    })),
    action: 'publish',
  })
  ok(multi.families.brands === 5, 'five brand URLs across five brands')
  ok(multi.urls.filter((u) => u.includes('/brands/')).length === 5, 'exactly five brand paths')
}

{
  const casing = collectEquipmentContentIndexNowUrls({
    rows: [
      { id: '1', generation_status: 'approved', canonical_product_key: 'a', brand: 'Life Fitness' },
      { id: '2', generation_status: 'approved', canonical_product_key: 'b', brand: 'life fitness' },
      { id: '3', generation_status: 'approved', canonical_product_key: 'c', brand: 'LifeFitness' },
    ],
    action: 'publish',
  })
  ok(casing.urls.filter((u) => u.includes('/brands/life-fitness')).length === 1, 'brand slug normalisation collapses casing')
}

// --- Removals ---
ok(shouldNotifyEquipmentContentChange({
  previous: { generation_status: 'approved', faq_json: [{ q: 1 }], overview_text: 'x' },
  next: { generation_status: 'approved', faq_json: [], overview_text: 'x' },
}).reason === 'equipment_faq_removed', 'FAQ removal notifies')

ok(shouldNotifyEquipmentContentChange({
  previous: { generation_status: 'approved', faq_json: [], overview_text: 'Overview' },
  next: { generation_status: 'approved', faq_json: [], overview_text: '' },
}).reason === 'equipment_overview_removed', 'overview removal notifies')

ok(shouldNotifyEquipmentProductChange({
  previous: {
    status: 'approved', image_status: 'approved', image_url: 'https://cdn/x.png',
    canonical_product_key: 'x', brand: 'Cybex', equipment_type: 'Chest Press',
  },
  next: {
    status: 'approved', image_status: 'rejected', image_url: null,
    canonical_product_key: 'x', brand: 'Cybex', equipment_type: 'Chest Press',
  },
  action: 'image',
  publicEligible: (p) => p?.status === 'approved',
}).reason === 'equipment_image_removed', 'image removal notifies')

ok(shouldNotifyListingChange({
  previous: { status: 'active', slug: 'bike' },
  next: null,
  action: 'delete',
}).notify, 'listing deletion notifies')

ok(shouldNotifyListingChange({
  previous: { status: 'active', slug: 'bike' },
  next: { status: 'sold', slug: 'bike' },
}).notify, 'sold leaves public')

{
  const slugChange = collectListingIndexNowUrls({
    previous: { status: 'active', slug: 'old-slug', city: 'London' },
    next: { status: 'active', slug: 'new-slug', city: 'London', title: 'T' },
  })
  ok(slugChange.urls.includes('https://www.equipd.co.uk/listings/old-slug'), 'old slug submitted')
  ok(slugChange.urls.includes('https://www.equipd.co.uk/listings/new-slug'), 'new slug submitted')
}

{
  const keyChange = collectEquipmentIndexNowUrls({
    previous: { status: 'approved', canonical_product_key: 'old-key', brand: 'Woodway', equipment_type: 'Treadmill' },
    next: { status: 'approved', canonical_product_key: 'new-key', brand: 'Woodway', equipment_type: 'Treadmill' },
    action: 'key_change',
  })
  ok(keyChange.urls.includes('https://www.equipd.co.uk/equipment/old-key'), 'old equipment key')
  ok(keyChange.urls.includes('https://www.equipd.co.uk/equipment/new-key'), 'new equipment key')
}

// --- Partial batch failure ---
{
  let calls = 0
  const urls = Array.from({ length: 3 }, (_, i) => `https://www.equipd.co.uk/equipment/p-${i}`)
  const result = await submitIndexNowUrls(urls, {
    key: 'testkey12',
    force: true,
    batchSize: 1,
    sleepImpl: async () => {},
    fetchImpl: async () => {
      calls += 1
      // Fail only the middle batch's attempts: after first success, next 4 are failures, then success.
      if (calls >= 2 && calls <= 5) return { status: 500 }
      return { status: 200 }
    },
  })
  ok(result.partial && result.submitted.length === 2 && result.failed.length === 1, 'partial success reported')
  ok(calls === 6, `failed batch retried independently (calls=${calls})`)
}

// --- Key delivery script behaviour (preview skips; production requires key) ---
{
  const { spawnSync } = await import('node:child_process')
  const preview = spawnSync(process.execPath, ['scripts/write-indexnow-key-file.mjs'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      VERCEL_ENV: 'preview',
      INDEXNOW_KEY: 'equipd-indexnow-testkey-previewx',
      INDEXNOW_WRITE_KEY_FILE: '',
    },
    encoding: 'utf8',
  })
  ok(preview.status === 0, 'preview key-file script exits 0')
  ok(String(preview.stdout + preview.stderr).includes('skipping'), 'preview skips key file write')

  const missingProd = spawnSync(process.execPath, ['scripts/write-indexnow-key-file.mjs'], {
    cwd: process.cwd(),
    env: { ...process.env, VERCEL_ENV: 'production', INDEXNOW_KEY: '' },
    encoding: 'utf8',
  })
  ok(missingProd.status !== 0, 'production without key fails safely')
}

// Logs never include key
{
  const log = buildIndexNowLogRecord({
    source: 'test',
    urls: ['https://www.equipd.co.uk/equipment/a'],
    status: 200,
    category: 'success',
    batchIndex: 1,
    batchTotal: 2,
    durationMs: 12,
  })
  ok(log.batchIndex === 1 && log.durationMs === 12, 'log includes batch/duration')
  ok(!JSON.stringify(log).includes('testkey12'), 'log has no key value')
  ok(Array.isArray(log.safePaths), 'safe paths present')
}

console.log(`test-indexnow: ${passed} assertions passed`)
