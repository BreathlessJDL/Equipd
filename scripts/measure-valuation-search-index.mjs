/**
 * Measure compact valuation search-index load + local query timing in the browser.
 */
import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { gzipSync } from 'node:zlib'
import { chromium } from 'playwright'
import { resolveValuationSearchMatches } from '../src/lib/equipmentValuation.js'
import { VALUATION_SEARCH_INDEX_PATH } from '../src/lib/valuationSearchIndex.js'

const indexPath = join(process.cwd(), 'public', VALUATION_SEARCH_INDEX_PATH.replace(/^\//, ''))
if (!existsSync(indexPath)) {
  throw new Error('Missing public search index. Run npm run generate:valuation-search-index first.')
}

const raw = readFileSync(indexPath)
const payload = JSON.parse(raw.toString('utf8'))
const gzipBytes = gzipSync(raw).length

const query = 'life fitness treadmill'
const t0 = performance.now()
const matches = resolveValuationSearchMatches(payload.products, query)
const localQueryMs = performance.now() - t0

const baseUrl = process.env.BASE_URL || 'http://127.0.0.1:4182'

const browser = await chromium.launch()
const context = await browser.newContext()
const page = await context.newPage()
await page.setViewportSize({ width: 390, height: 844 })

const requestLog = []
page.on('request', (request) => {
  const url = request.url()
  if (
    url.includes('valuation-search-index')
    || url.includes('equipment_products')
    || url.includes('equipment_intelligence')
  ) {
    requestLog.push({
      url,
      type: url.includes('valuation-search-index')
        ? 'search-index'
        : url.includes('equipment_intelligence')
          ? 'intelligence'
          : 'equipment_products',
    })
  }
})

const responseSizes = []
page.on('response', async (response) => {
  const url = response.url()
  if (!url.includes('valuation-search-index')) return
  try {
    const body = await response.body()
    responseSizes.push({
      url,
      status: response.status(),
      bytes: body.length,
      encoded: response.headers()['content-encoding'] || null,
    })
  } catch {
    // ignore closed responses
  }
})

await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded' })
await page.evaluate(() => {
  try { sessionStorage.clear() } catch {}
})

// Cold: focus immediately and type before idle prefetch can finish.
const input = page.locator('.home-valuator__input, .canonical-autocomplete__input').first()
const coldStarted = Date.now()
await input.click()
await input.fill('li')
await page.waitForSelector('.canonical-autocomplete__option', { timeout: 10000 })
const coldMs = Date.now() - coldStarted
const coldLoadingText = await page.locator('.canonical-autocomplete__message').allTextContents()

const beforeWarmRequests = requestLog.length
const warmStarted = Date.now()
await input.fill('life fitness tread')
await page.waitForSelector('.canonical-autocomplete__option', { timeout: 5000 })
const warmMs = Date.now() - warmStarted
const warmOptionCount = await page.locator('.canonical-autocomplete__option').count()
const afterWarmRequests = requestLog.length

// Prefetch wait path: reload, wait 2s, then focus.
await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded' })
await page.evaluate(() => {
  try { sessionStorage.clear() } catch {}
})
await page.waitForTimeout(2000)
const prefetchedStarted = Date.now()
await input.click()
await input.fill('matrix tread')
await page.waitForSelector('.canonical-autocomplete__option', { timeout: 5000 })
const prefetchedMs = Date.now() - prefetchedStarted

await browser.close()

const report = {
  indexRawBytes: raw.length,
  indexRawKB: Math.round(raw.length / 1024),
  indexGzipKB: Math.round(gzipBytes / 1024),
  productCount: payload.products?.length ?? 0,
  localQueryMs: Number(localQueryMs.toFixed(2)),
  localMatchCount: matches.matches.length,
  coldFirstSuggestionMs: coldMs,
  coldLoadingMessages: coldLoadingText,
  warmFirstSuggestionMs: warmMs,
  warmOptionCount,
  warmExtraNetworkRequests: afterWarmRequests - beforeWarmRequests,
  prefetchedFocusFirstSuggestionMs: prefetchedMs,
  requestLog,
  responseSizes,
  fullCatalogueRequests: requestLog.filter((entry) => entry.type !== 'search-index').length,
  searchIndexRequests: requestLog.filter((entry) => entry.type === 'search-index').length,
}

mkdirSync(join(process.cwd(), 'reports'), { recursive: true })
writeFileSync(
  join(process.cwd(), 'reports', 'valuation-search-index-timing.json'),
  JSON.stringify(report, null, 2),
)
console.log(JSON.stringify(report, null, 2))
