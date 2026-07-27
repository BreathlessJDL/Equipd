/**
 * Screenshots + overflow validation for redesigned location marketplace pages.
 *
 *   $env:PREVIEW_URL='http://127.0.0.1:4192'; node scripts/screenshot-location-page-redesign.mjs
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { chromium } from 'playwright'

const base = (process.env.PREVIEW_URL || 'http://127.0.0.1:5173').replace(/\/$/, '')
const outDir = join(process.cwd(), 'reports', 'location-page-redesign')
mkdirSync(outDir, { recursive: true })

const viewports = [
  { name: 'mobile-390', width: 390, height: 844 },
  { name: 'tablet-768', width: 768, height: 1024 },
  { name: 'laptop-1024', width: 1024, height: 900 },
  { name: 'desktop-1440', width: 1440, height: 900 },
]

async function dismissCookies(page) {
  const accept = page.getByRole('button', { name: /Accept all|Accept necessary/i }).first()
  if (await accept.count()) {
    await accept.click({ timeout: 2500 }).catch(() => {})
  }
}

const browser = await chromium.launch()
const results = []

for (const vp of viewports) {
  const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } })
  await page.goto(`${base}/listings/leeds`, { waitUntil: 'networkidle', timeout: 90000 })
  await dismissCookies(page)
  await page.waitForSelector('#location-page-title', { timeout: 30000 })
  await page.waitForTimeout(400)

  const metrics = await page.evaluate(() => {
    const hero = document.querySelector('.location-page__hero')
    const main = document.querySelector('#location-listings')
    return {
      overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      h1: document.getElementById('location-page-title')?.textContent?.trim() || '',
      heroHeight: hero ? Math.round(hero.getBoundingClientRect().height) : 0,
      hasPreview: Boolean(document.querySelector('.location-page__preview')),
      previewCity: document.querySelector('.location-page__preview-location-label')?.textContent?.trim() || '',
      previewAriaHidden:
        document.querySelector('.location-page__preview')?.getAttribute('aria-hidden') === 'true',
      previewHasRealListingCopy: /£|Technogym|Concept|Send offer/i.test(
        document.querySelector('.location-page__preview')?.textContent || '',
      ),
      listingsBelowHero: Boolean(
        hero && main && main.getBoundingClientRect().top >= hero.getBoundingClientRect().bottom - 2,
      ),
      nearbyAfterListings: (() => {
        const nearby = document.querySelector('.location-page__nearby')
        if (!hero || !nearby || !main) return false
        return nearby.getBoundingClientRect().top >= main.getBoundingClientRect().top
      })(),
      countBadge: document.querySelector('.location-page__count-badge')?.textContent?.trim() || '',
      canonical: document.querySelector('link[rel="canonical"]')?.getAttribute('href') || '',
      filtersPresent: Boolean(document.querySelector('.location-page__toolbar')),
    }
  })

  await page.screenshot({ path: join(outDir, `${vp.name}-full.png`), fullPage: true })
  await page.locator('.location-page__hero').screenshot({ path: join(outDir, `${vp.name}-hero.png`) })

  results.push({ viewport: vp.name, ...metrics })
  await page.close()
}

await browser.close()
writeFileSync(join(outDir, 'results.json'), JSON.stringify({ base, results }, null, 2))

for (const row of results) {
  if (row.overflow) throw new Error(`${row.viewport}: horizontal overflow`)
  if (row.h1 !== 'Used gym equipment in Leeds') throw new Error(`${row.viewport}: bad H1`)
  if (!row.listingsBelowHero) throw new Error(`${row.viewport}: listings not below hero`)
  if (!row.hasPreview) throw new Error(`${row.viewport}: missing marketplace preview`)
  if (row.previewCity !== 'Leeds') throw new Error(`${row.viewport}: preview city not dynamic`)
  if (!row.previewAriaHidden) throw new Error(`${row.viewport}: preview should be aria-hidden`)
  if (row.previewHasRealListingCopy) throw new Error(`${row.viewport}: preview has real listing copy`)
  if (!row.nearbyAfterListings) throw new Error(`${row.viewport}: nearby not after listings`)
  if (!row.countBadge.includes('listing')) throw new Error(`${row.viewport}: missing count badge`)
  if (!row.canonical.includes('/listings/leeds')) throw new Error(`${row.viewport}: canonical`)
  if (!row.filtersPresent) throw new Error(`${row.viewport}: filters missing`)
  if (row.viewport === 'desktop-1440' && (row.heroHeight < 280 || row.heroHeight > 420)) {
    throw new Error(`${row.viewport}: hero height ${row.heroHeight} outside 280–420px`)
  }
}

console.log(JSON.stringify({ outDir, results }, null, 2))
console.log('screenshot-location-page-redesign: ok')
