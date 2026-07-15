import { chromium } from '@playwright/test'
import fs from 'node:fs/promises'

await fs.mkdir('debug-screenshots', { recursive: true })
const browser = await chromium.launch()

async function measure(width) {
  const page = await browser.newPage({ viewport: { width, height: 900 } })
  await page.goto(
    'http://127.0.0.1:5174/valuation?product=life-fitness-treadmill-silver-line-95ti&step=details',
    { waitUntil: 'networkidle', timeout: 60000 },
  )
  const btn = page.locator('.valuation-page__details-form button[type=submit]').first()
  if (await btn.count()) {
    await btn.click()
    await page.waitForTimeout(1200)
  }
  await page.locator('.equipment-depreciation-graph').scrollIntoViewIfNeeded()
  await page.waitForTimeout(400)
  const wrap = page.locator('.equipment-depreciation-graph__chart-wrap')
  const svg = page.locator('.equipment-depreciation-graph__svg')
  const wrapBox = await wrap.boundingBox()
  const svgBox = await svg.boundingBox()
  const viewBox = await svg.getAttribute('viewBox')
  const par = await svg.getAttribute('preserveAspectRatio')
  console.log(width, JSON.stringify({ wrapBox, svgBox, viewBox, par }))
  await page.locator('.equipment-depreciation-graph').screenshot({
    path: `debug-screenshots/depreciation-graph-mobile-${width}.png`,
  })
  await page.close()
}

for (const width of [360, 390, 400, 430]) {
  await measure(width)
}

await browser.close()
