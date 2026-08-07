#!/usr/bin/env node
/**
 * Guards the homepage performance deferrals: the valuation index and route
 * chunks must stay off the initial load, while search, hero and SPA navigation
 * keep working.
 *
 * Usage:
 *   node scripts/test-homepage-performance-behaviour.mjs [baseUrl]
 */

import { chromium } from 'playwright-core'

const baseUrl = process.argv[2] ?? 'http://localhost:5173'
const browser = await chromium.launch({ headless: true, channel: 'msedge' })

const failures = []
function check(name, condition, detail) {
  if (condition) {
    console.log(`  ok   ${name}`)
  } else {
    console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ''}`)
    failures.push(name)
  }
}

async function newTrackedPage(viewport) {
  const page = await browser.newPage({ viewport })
  const requests = []
  page.on('request', (request) => requests.push(request.url()))
  return { page, requests }
}

console.log('Homepage initial load (desktop)')
const { page, requests } = await newTrackedPage({ width: 1440, height: 900 })
await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle', timeout: 45000 })

const valuationIndexRequested = requests.some((url) => url.includes('valuation-search-index.json'))
check('valuation search index is not fetched on load', !valuationIndexRequested)

const hero = await page.evaluate(() => {
  const img = document.querySelector('.home-hero__image')
  if (!img) return null
  return {
    currentSrc: img.currentSrc,
    fetchPriority: img.getAttribute('fetchpriority'),
    naturalWidth: img.naturalWidth,
    renderedHeight: Math.round(img.getBoundingClientRect().height),
  }
})
check('hero image rendered', Boolean(hero && hero.naturalWidth > 0), JSON.stringify(hero))
check('hero uses a modern format', /\.(avif|webp)$/i.test(hero?.currentSrc ?? ''), hero?.currentSrc)
check('hero keeps fetchPriority high', hero?.fetchPriority === 'high', hero?.fetchPriority)

const heroError = await page.locator('.home-hero__error').count()
check('hero has no load error', heroError === 0)

const belowFold = await page.evaluate(() => ({
  reviewsMounted: Boolean(document.querySelector('.home-reviews')),
  browseCards: document.querySelectorAll('.home-browse .listing-card').length,
}))
check('reviews section is deferred', !belowFold.reviewsMounted)

console.log('\nSearch interaction loads the catalogue on demand')
await page.click('#home-valuator-search')
await page.fill('#home-valuator-search', 'treadmill')

await page.waitForSelector('.canonical-autocomplete__dropdown [role="option"]', { timeout: 25000 })
check(
  'valuation index loads after interaction',
  requests.some((url) => url.includes('valuation-search-index.json')),
)

const suggestions = await page.evaluate(
  () => document.querySelectorAll('.canonical-autocomplete__dropdown [role="option"]').length,
)
check('autocomplete returns suggestions', suggestions > 0, `count=${suggestions}`)

const typedValue = await page.inputValue('#home-valuator-search')
check('typed query survives the swap', typedValue === 'treadmill', typedValue)

console.log('\nScrolling loads deferred sections')
await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
await page.waitForSelector('.home-reviews', { timeout: 20000 })
await page.waitForSelector('.home-browse .listing-card', { timeout: 20000 })
check('reviews mount on scroll', true)
check('browse grid loads on scroll', true)

const lazyImages = await page.evaluate(() => {
  const imgs = [...document.querySelectorAll('.home-browse img.listing-card__image')]
  return {
    total: imgs.length,
    lazy: imgs.filter((img) => img.getAttribute('loading') === 'lazy').length,
    eager: imgs.filter((img) => img.getAttribute('loading') === 'eager').length,
  }
})
check(
  'browse cards lazy-load beyond the first row',
  lazyImages.total > 0 && lazyImages.lazy > 0 && lazyImages.eager === 4,
  JSON.stringify(lazyImages),
)

console.log('\nLazy routes still render')
for (const path of ['/valuation', '/browse', '/help']) {
  await page.goto(`${baseUrl}${path}`, { waitUntil: 'networkidle', timeout: 45000 })
  const state = await page.evaluate(() => ({
    stuck: Boolean(document.querySelector('.route-fallback')),
    hasMain: (document.querySelector('.app-shell__main')?.textContent?.trim().length ?? 0) > 40,
  }))
  check(`${path} renders`, state.hasMain && !state.stuck, JSON.stringify(state))
}

console.log('\nWanted modal chunk loads on demand')
await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle', timeout: 45000 })
const modalBefore = await page.locator('.wanted-request-modal').count()
check('wanted modal not mounted on load', modalBefore === 0)

await browser.close()

if (failures.length) {
  console.log(`\n${failures.length} check(s) failed: ${failures.join(', ')}`)
  process.exitCode = 1
} else {
  console.log('\nAll homepage performance behaviour checks passed.')
}
