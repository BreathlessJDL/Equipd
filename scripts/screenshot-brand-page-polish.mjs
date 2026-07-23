/**
 * Brand page visual polish screenshots (after state).
 * Usage: $env:PREVIEW_URL='http://127.0.0.1:5174'; node scripts/screenshot-brand-page-polish.mjs
 */
import { chromium } from '@playwright/test'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const OUT = join(process.cwd(), 'debug-screenshots', 'brand-page-polish', 'after')
mkdirSync(OUT, { recursive: true })

const base = process.env.PREVIEW_URL || 'http://127.0.0.1:5174'

const viewports = [
  { name: 'desktop-1440', width: 1440, height: 900 },
  { name: 'tablet-768', width: 768, height: 1024 },
  { name: 'mobile-390', width: 390, height: 844 },
]

async function dismissCookies(page) {
  const accept = page.getByRole('button', { name: /Accept all/i })
  if (await accept.count()) {
    await accept.click({ timeout: 2000 }).catch(() => {})
    await page.waitForTimeout(200)
  }
}

async function main() {
  const browser = await chromium.launch({ headless: true })
  const results = []

  try {
    for (const vp of viewports) {
      const context = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
      })
      const page = await context.newPage()
      await page.goto(`${base}/brands/life-fitness`, {
        waitUntil: 'domcontentloaded',
        timeout: 60000,
      })
      await dismissCookies(page)
      await page.waitForSelector('.brand-page__title', { timeout: 60000 })
      await page.waitForSelector('.equipment-value-card', { timeout: 60000 })
      await page.waitForTimeout(700)

      const heroBox = await page.locator('.brand-page__hero').boundingBox()
      const seriesTop = await page.locator('#brand-series-title').boundingBox()
      const path = join(OUT, `life-fitness-${vp.name}.png`)
      await page.screenshot({ path, fullPage: true })
      await page.screenshot({
        path: join(OUT, `life-fitness-${vp.name}-viewport.png`),
        fullPage: false,
      })

      results.push({
        viewport: vp.name,
        heroHeight: heroBox?.height ?? null,
        seriesOffsetY: seriesTop?.y ?? null,
        overflow: await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1),
        screenshot: path,
      })
      await context.close()
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
