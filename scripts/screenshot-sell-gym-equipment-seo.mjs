/**
 * Desktop screenshots for sell-gym-equipment SEO pass (no hover asserts).
 */
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { chromium } from '@playwright/test'

const outDir = join(process.cwd(), 'reports', 'sell-gym-equipment-page')
mkdirSync(outDir, { recursive: true })

async function dismissCookieBanner(page) {
  const accept = page.getByRole('button', { name: /accept all/i })
  if (await accept.count()) {
    await accept.first().click({ timeout: 2000 }).catch(() => {})
  }
}

async function waitForJourneyImages(page) {
  await page.waitForSelector('.sell-page__step-image')
  const steps = page.locator('.sell-page__step')
  const count = await steps.count()
  for (let index = 0; index < count; index += 1) {
    await steps.nth(index).scrollIntoViewIfNeeded()
  }
  await page.evaluate(async () => {
    const images = [...document.querySelectorAll('.sell-page__step-image')]
    await Promise.all(
      images.map((img) => {
        if (img.complete && img.naturalWidth > 0) return Promise.resolve()
        return new Promise((resolve) => {
          img.addEventListener('load', resolve, { once: true })
          img.addEventListener('error', resolve, { once: true })
        })
      }),
    )
  })
  await page.locator('.sell-page__h1').scrollIntoViewIfNeeded()
}

const browser = await chromium.launch()
const page = await browser.newPage({ deviceScaleFactor: 1 })

for (const viewport of [
  { width: 1920, height: 1080, file: 'desktop-1920.png' },
  { width: 1440, height: 900, file: 'desktop-1440.png' },
]) {
  await page.setViewportSize({ width: viewport.width, height: viewport.height })
  await page.goto('http://127.0.0.1:5175/sell-gym-equipment', { waitUntil: 'networkidle' })
  await dismissCookieBanner(page)
  await waitForJourneyImages(page)
  await page.screenshot({ path: join(outDir, viewport.file), fullPage: true })
  console.log(`wrote ${viewport.file}`)
}

await browser.close()
