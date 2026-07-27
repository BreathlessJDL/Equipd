/**
 * Screenshots + overflow validation for compact mobile location marketplace heroes.
 *
 *   $env:PREVIEW_URL='http://127.0.0.1:5173'; node scripts/screenshot-location-mobile-hero.mjs
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { chromium } from 'playwright-core'

const base = (process.env.PREVIEW_URL || 'http://127.0.0.1:5173').replace(/\/$/, '')
const outDir = join(process.cwd(), 'reports', 'location-mobile-hero')
mkdirSync(outDir, { recursive: true })

const viewports = [
  { name: '320', width: 320, height: 720 },
  { name: '375', width: 375, height: 812 },
  { name: '390', width: 390, height: 844 },
  { name: '430', width: 430, height: 932 },
  { name: '768', width: 768, height: 1024 },
  { name: '1440', width: 1440, height: 900 },
]

const cities = ['leeds', 'birmingham', 'newcastle']

async function dismissCookies(page) {
  const accept = page.getByRole('button', { name: /Accept all|Accept necessary/i }).first()
  if (await accept.count()) {
    await accept.click({ timeout: 2500 }).catch(() => {})
  }
}

async function metrics(page) {
  return page.evaluate(() => {
    const hero = document.querySelector('.location-page__hero')
    const preview = document.querySelector('.location-page__preview')
    const badge = document.querySelector('.location-page__mobile-badge')
    const main = document.querySelector('#location-listings')
    const previewStyle = preview ? getComputedStyle(preview) : null
    const badgeStyle = badge ? getComputedStyle(badge) : null
    const previewVisible = Boolean(preview && previewStyle?.display !== 'none' && previewStyle?.visibility !== 'hidden')
    const badgeVisible = Boolean(badge && badgeStyle?.display !== 'none' && badgeStyle?.visibility !== 'hidden')
    return {
      overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      h1: document.getElementById('location-page-title')?.textContent?.trim() || '',
      heroHeight: hero ? Math.round(hero.getBoundingClientRect().height) : 0,
      previewVisible,
      previewAriaHidden: preview?.getAttribute('aria-hidden') === 'true',
      badgeVisible,
      badgeText: badge?.textContent?.replace(/\s+/g, ' ').trim() || '',
      previewCount: document.querySelector('.location-page__preview-card-count')?.textContent?.trim() || '',
      resultsTitle: document.querySelector('.location-page__results-title')?.textContent?.trim() || '',
      primaryCta: document.querySelector('.location-page__btn--primary')?.textContent?.trim() || '',
      listingsTop: main ? Math.round(main.getBoundingClientRect().top) : null,
      heroBottom: hero ? Math.round(hero.getBoundingClientRect().bottom) : null,
      heroListingsGap:
        hero && main ? Math.round(main.getBoundingClientRect().top - hero.getBoundingClientRect().bottom) : null,
      canonical: document.querySelector('link[rel="canonical"]')?.getAttribute('href') || '',
      description: document.querySelector('meta[name="description"]')?.getAttribute('content') || '',
    }
  })
}

const browser = await chromium.launch({ channel: 'msedge' })
const results = []

for (const city of cities) {
  for (const vp of viewports) {
    const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } })
    await page.goto(`${base}/listings/${city}`, { waitUntil: 'networkidle', timeout: 90000 })
    await dismissCookies(page)
    await page.waitForSelector('#location-page-title', { timeout: 30000 })
    await page.waitForTimeout(500)

    const data = await metrics(page)
    const isCompact = vp.width < 900
    const fileBase = `${city}-${vp.name}`

    await page.screenshot({ path: join(outDir, `${fileBase}-top.png`), fullPage: false })
    if (isCompact || vp.width === 1440) {
      await page.locator('.location-page__hero').screenshot({ path: join(outDir, `${fileBase}-hero.png`) })
    }

    const checks = {
      noOverflow: !data.overflow,
      h1Present: Boolean(data.h1),
      previewHiddenOnCompact: isCompact ? !data.previewVisible : data.previewVisible,
      badgeShownOnCompact: isCompact ? data.badgeVisible : !data.badgeVisible,
      badgeHasCity: isCompact ? data.badgeText.toLowerCase().includes(city === 'newcastle' ? 'newcastle' : city) : true,
      badgeHasListingWord: isCompact ? /listing/i.test(data.badgeText) : true,
      heroShorterOnMobile: !isCompact || data.heroHeight < 520,
      listingsSoon: !isCompact || (data.heroListingsGap != null && data.heroListingsGap < 80),
      seoUnchanged: Boolean(data.canonical?.includes(`/listings/${city}`)),
      radiusCopy: Boolean(data.description?.includes('40 miles') || data.resultsTitle?.includes('in and around')),
    }

    results.push({ city, viewport: vp.name, width: vp.width, ...data, checks })
    await page.close()
  }
}

await browser.close()

const failures = results.filter((r) => Object.values(r.checks).some((v) => v !== true))
writeFileSync(join(outDir, 'results.json'), JSON.stringify({ results, failures }, null, 2))
console.log(JSON.stringify({ outDir, pass: failures.length === 0, failureCount: failures.length, results }, null, 2))
if (failures.length) process.exitCode = 1
