import { chromium } from 'playwright-core'

const baseUrl = process.argv[2] ?? 'http://localhost:5175/'
const browser = await chromium.launch({ channel: 'msedge' })
const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage()

async function openBrands() {
  await page.goto(new URL('/brands', baseUrl).href, { waitUntil: 'networkidle', timeout: 45000 })
  const accept = page.getByRole('button', { name: /Accept all/i })
  if (await accept.count()) {
    await accept.click()
    await page.waitForTimeout(200)
  }
  await page.waitForSelector('#brands-valuator-search', { timeout: 20000 })
}

await openBrands()
await page.fill('#brands-valuator-search', 'Skillmill')
await page.waitForTimeout(700)
await page.getByRole('button', { name: 'Find value' }).click()
await page.waitForTimeout(1500)
const findValueUrl = page.url()
console.log('find-value-url', findValueUrl)
if (!findValueUrl.includes('/valuation')) {
  throw new Error(`Find value did not navigate to valuation: ${findValueUrl}`)
}

await openBrands()
await page.getByRole('link', { name: 'Technogym Skillmill' }).click()
await page.waitForTimeout(1500)
const chipUrl = page.url()
console.log('chip-url', chipUrl)
if (!chipUrl.includes('/valuation') || !chipUrl.includes('technogym-non-motorised-treadmill-skill-line-skillmill')) {
  throw new Error(`Popular search did not open Skillmill valuation: ${chipUrl}`)
}

await openBrands()
await page.fill('#brands-valuator-search', 'Skillmill')
await page.waitForSelector('[role="option"]', { timeout: 8000 })
await page.locator('[role="option"]').first().click()
await page.waitForTimeout(1500)
const optionUrl = page.url()
console.log('option-url', optionUrl)
if (!optionUrl.includes('/valuation')) {
  throw new Error(`Autocomplete option did not navigate to valuation: ${optionUrl}`)
}

await browser.close()
console.log('equipment-values-hero-nav: ok')
