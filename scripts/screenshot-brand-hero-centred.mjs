/**
 * Centred brand hero validation screenshots.
 * Usage: $env:PREVIEW_URL='http://127.0.0.1:5174'; node scripts/screenshot-brand-hero-centred.mjs
 */
import { chromium } from '@playwright/test'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const OUT = join(process.cwd(), 'debug-screenshots', 'brand-hero-centred')
mkdirSync(OUT, { recursive: true })

const base = process.env.PREVIEW_URL || 'http://127.0.0.1:5174'

const viewports = [
  { name: '1440', width: 1440, height: 900 },
  { name: '1024', width: 1024, height: 800 },
  { name: '390', width: 390, height: 844 },
]

const brands = ['life-fitness', 'technogym', 'concept2']

async function dismissCookies(page) {
  const accept = page.getByRole('button', { name: /Accept all/i })
  if (await accept.count()) {
    await accept.click({ timeout: 2000 }).catch(() => {})
    await page.waitForTimeout(150)
  }
}

async function main() {
  const browser = await chromium.launch({ headless: true })
  const results = []

  try {
    for (const brand of brands) {
      for (const vp of viewports) {
        const context = await browser.newContext({
          viewport: { width: vp.width, height: vp.height },
        })
        const page = await context.newPage()
        await page.goto(`${base}/brands/${brand}`, {
          waitUntil: 'domcontentloaded',
          timeout: 60000,
        })
        await dismissCookies(page)
        await page.waitForSelector('.brand-page__hero', { timeout: 60000 })
        await page.waitForSelector('.brand-page__title', { timeout: 60000 })
        await page.waitForTimeout(700)

        const metrics = await page.evaluate(() => {
          const pageInner = document.querySelector('.brand-page__inner')
          const hero = document.querySelector('.brand-page__hero')
          const series = document.querySelector('.brand-page__section')
          const logoWrap = document.querySelector('.brand-page__hero-logo-wrap')
          const search = document.querySelector('.brand-page__search-panel')
          const title = document.querySelector('.brand-page__title')
          const pageRect = pageInner?.getBoundingClientRect()
          const heroRect = hero?.getBoundingClientRect()
          const seriesRect = series?.getBoundingClientRect()
          const logoRect = logoWrap?.getBoundingClientRect()
          const searchRect = search?.getBoundingClientRect()
          const titleRect = title?.getBoundingClientRect()
          const pageCenter = pageRect ? pageRect.left + pageRect.width / 2 : null
          const heroCenter = heroRect ? heroRect.left + heroRect.width / 2 : null
          const titleCenter = titleRect ? titleRect.left + titleRect.width / 2 : null
          const searchCenter = searchRect ? searchRect.left + searchRect.width / 2 : null
          return {
            pageWidth: pageRect?.width ?? null,
            heroWidth: heroRect?.width ?? null,
            seriesWidth: seriesRect?.width ?? null,
            widthDeltaHeroVsPage: pageRect && heroRect
              ? Math.abs(pageRect.width - heroRect.width)
              : null,
            centerDeltaTitle: pageCenter != null && titleCenter != null
              ? Math.abs(pageCenter - titleCenter)
              : null,
            centerDeltaSearch: pageCenter != null && searchCenter != null
              ? Math.abs(pageCenter - searchCenter)
              : null,
            centerDeltaHero: pageCenter != null && heroCenter != null
              ? Math.abs(pageCenter - heroCenter)
              : null,
            logo: logoRect ? { w: logoRect.width, h: logoRect.height } : null,
            search: searchRect ? { w: searchRect.width, h: searchRect.height } : null,
            overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
          }
        })

        const file = `${brand}-${vp.name}.png`
        await page.screenshot({
          path: join(OUT, file),
          fullPage: false,
        })
        results.push({ brand, viewport: vp.name, file, ...metrics })
        await context.close()
      }
    }
  } finally {
    await browser.close()
  }

  writeFileSync(join(OUT, 'results.json'), JSON.stringify(results, null, 2))
  console.log(JSON.stringify(results, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
