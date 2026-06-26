#!/usr/bin/env node
import { chromium } from 'playwright-core'

const baseUrl = (process.argv[2] ?? 'http://localhost:5173').replace(/\/$/, '')

async function inspectLocation(page) {
  return page.evaluate(() => ({
    pathname: window.location.pathname,
    search: window.location.search,
    scrollY: Math.round(window.scrollY),
    title: document.getElementById('location-page-title')?.textContent?.trim() ?? null,
    resultsTitle: document.querySelector('.location-page__results-title')?.textContent?.trim() ?? null,
    filterBanner: document.querySelector('.location-page__area-filter-text')?.textContent?.trim() ?? null,
    resetLink: document.querySelector('.location-page__area-filter-reset')?.textContent?.trim() ?? null,
    activePill: document
      .querySelector('.location-page__area-pill--current')
      ?.textContent?.trim() ?? null,
  }))
}

async function runViewport(browser, { name, width, height }) {
  const page = await browser.newPage({ viewport: { width, height } })

  await page.goto(`${baseUrl}/listings/leeds`, { waitUntil: 'networkidle', timeout: 45000 })
  await page.waitForSelector('.location-page__area-pill', { timeout: 15000 })
  await page.evaluate(() => window.scrollTo(0, 1200))
  await page.waitForTimeout(200)

  await page.click('.location-page__area-pill:text("Wakefield")')
  await page.waitForURL('**/listings/leeds?area=Wakefield', { timeout: 10000 })
  await page.waitForTimeout(400)
  const leedsWakefield = await inspectLocation(page)

  await page.goto(`${baseUrl}/listings/leeds`, { waitUntil: 'networkidle', timeout: 45000 })
  await page.evaluate(() => window.scrollTo(0, 1200))
  await page.waitForTimeout(200)
  await page.click('.location-page__area-pill:text("Bradford")')
  await page.waitForURL('**/listings/leeds?area=Bradford', { timeout: 10000 })
  await page.waitForTimeout(400)
  const leedsBradford = await inspectLocation(page)

  if (leedsBradford.resetLink) {
    await page.click('.location-page__area-filter-reset')
    await page.waitForURL('**/listings/leeds', { timeout: 10000 })
    await page.waitForTimeout(300)
  }
  const leedsReset = await inspectLocation(page)

  await page.close()
  return { name, leedsWakefield, leedsBradford, leedsReset }
}

const browser = await chromium.launch({ headless: true, channel: 'msedge' })
const desktop = await runViewport(browser, { name: 'desktop', width: 1280, height: 900 })
const mobile = await runViewport(browser, { name: 'mobile', width: 390, height: 844 })
await browser.close()

console.log(JSON.stringify({ desktop, mobile }, null, 2))

function viewportOk(viewport) {
  const { leedsWakefield, leedsBradford, leedsReset } = viewport
  return (
    leedsWakefield.scrollY <= 80 &&
    leedsWakefield.title === 'Used gym equipment in Wakefield' &&
    leedsWakefield.activePill === 'Wakefield' &&
    leedsWakefield.filterBanner === 'Showing listings near Wakefield' &&
    leedsWakefield.resultsTitle?.includes('Wakefield') &&
    leedsBradford.scrollY <= 80 &&
    leedsBradford.title === 'Used gym equipment in Bradford' &&
    leedsBradford.activePill === 'Bradford' &&
    leedsBradford.filterBanner === 'Showing listings near Bradford' &&
    leedsBradford.resultsTitle?.includes('Bradford') &&
    leedsReset.activePill === 'Leeds' &&
    !leedsReset.filterBanner
  )
}

if (!viewportOk(desktop) || !viewportOk(mobile)) {
  console.error('FAIL: location area filter UX')
  process.exitCode = 1
} else {
  console.log('PASS: area pills scroll to top, show filter banner, and reset works')
}
