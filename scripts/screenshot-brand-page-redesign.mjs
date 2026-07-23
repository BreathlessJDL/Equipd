/**
 * Brand valuation page visual validation screenshots.
 * Usage: PREVIEW_URL=http://127.0.0.1:5174 node scripts/screenshot-brand-page-redesign.mjs
 */
import { chromium } from '@playwright/test'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const OUT = join(process.cwd(), 'debug-screenshots', 'brand-page-redesign')
mkdirSync(OUT, { recursive: true })

const base = process.env.PREVIEW_URL || 'http://127.0.0.1:5174'

const pages = [
  { slug: 'life-fitness', label: 'life-fitness' },
  { slug: 'concept2', label: 'concept2-few-series' },
  { slug: 'hammer-strength', label: 'hammer-strength' },
]

const viewports = [
  { name: 'desktop-1440', width: 1440, height: 900 },
  { name: 'mobile-390', width: 390, height: 844 },
]

async function dismissCookies(page) {
  const accept = page.getByRole('button', { name: /Accept all/i })
  if (await accept.count()) {
    await accept.click({ timeout: 2000 }).catch(() => {})
    await page.waitForTimeout(200)
  }
}

async function capture(page, path) {
  await dismissCookies(page)
  await page.waitForSelector('.brand-page__title', { timeout: 60000 })
  await page.waitForFunction(() => {
    const loading = document.querySelector('.brand-page__status')
    return !loading || !/Loading equipment values/i.test(loading.textContent || '')
  }, { timeout: 60000 })
  await page.waitForTimeout(600)
  await page.screenshot({ path, fullPage: true })
}

async function checkOverflow(page) {
  return page.evaluate(() => {
    const doc = document.documentElement
    return {
      scrollWidth: doc.scrollWidth,
      clientWidth: doc.clientWidth,
      overflow: doc.scrollWidth > doc.clientWidth + 1,
    }
  })
}

async function main() {
  const browser = await chromium.launch({ headless: true })
  const results = []

  try {
    for (const route of pages) {
      for (const vp of viewports) {
        const context = await browser.newContext({
          viewport: { width: vp.width, height: vp.height },
        })
        const page = await context.newPage()
        const url = `${base}/brands/${route.slug}`
        const started = Date.now()
        const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 })
        await capture(page, join(OUT, `${route.label}-${vp.name}.png`))
        const overflow = await checkOverflow(page)
        const hasCatalogueDump = await page.locator('#all-models').count()
        const popularCount = await page.locator('.brand-page__section [aria-labelledby="brand-popular-title"] .equipment-value-card, #brand-popular-title').count()
        const popularCards = await page.locator('.equipment-value-card').count()
        const seriesCards = await page.locator('.brand-page__series-card').count()
        const faqCount = await page.locator('.brand-page__faq-item').count()
        const marketplace = await page.locator('#brand-listings-title').count()
        const title = await page.locator('.brand-page__title').first().textContent().catch(() => null)

        results.push({
          route: route.slug,
          viewport: vp.name,
          status: response?.status() || null,
          loadMs: Date.now() - started,
          title: title?.trim() || null,
          overflow: overflow.overflow,
          catalogueOpenOnLoad: hasCatalogueDump > 0,
          popularCards,
          seriesCards,
          faqCount,
          marketplacePresent: marketplace > 0,
          popularHeadingPresent: popularCount > 0,
        })
        await context.close()
      }
    }
  } finally {
    await browser.close()
  }

  writeFileSync(join(OUT, 'results.json'), JSON.stringify(results, null, 2))
  console.log(JSON.stringify(results, null, 2))
  console.log(`Wrote screenshots to ${OUT}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
