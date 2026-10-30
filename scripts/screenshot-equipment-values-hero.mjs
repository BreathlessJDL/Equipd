import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { chromium } from 'playwright-core'

const ROOT = process.cwd()
const outDir = path.join(ROOT, 'reports', 'equipment-values-hero')
const baseUrl = process.argv[2] ?? 'http://localhost:5175/'
const VIEWPORTS = [
  { name: '375', width: 375, height: 844 },
  { name: '390', width: 390, height: 844 },
  { name: '430', width: 430, height: 932 },
  { name: '768', width: 768, height: 1024 },
  { name: '1280', width: 1280, height: 900 },
  { name: '1920', width: 1920, height: 1080 },
]

await mkdir(outDir, { recursive: true })
const browser = await chromium.launch({ channel: 'msedge' })

for (const viewport of VIEWPORTS) {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
  })
  const page = await context.newPage()
  await page.goto(new URL('/brands', baseUrl).href, {
    waitUntil: 'networkidle',
    timeout: 45000,
  })
  await page.waitForSelector('.equipment-values-hero', { timeout: 20000 })
  const acceptCookies = page.getByRole('button', { name: /Accept all/i })
  if (await acceptCookies.count()) {
    await acceptCookies.click()
    await page.waitForTimeout(200)
  }
  await page.waitForTimeout(400)

  const overflow = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
    heroHeight: document.querySelector('.equipment-values-hero')?.getBoundingClientRect().height ?? null,
    pictureCount: document.querySelectorAll('.equipment-values-hero picture').length,
    imgCount: document.querySelectorAll('.equipment-values-hero img').length,
    visibleHeading: [...document.querySelectorAll('h1, h2')].map((el) => el.textContent.trim()),
    currentSrc: document.querySelector('.equipment-values-hero img')?.currentSrc ?? null,
  }))

  const fileName = `hero-${viewport.name}.png`
  await page.screenshot({
    path: path.join(outDir, fileName),
    fullPage: false,
  })
  console.log(`Saved ${fileName}`, JSON.stringify(overflow))
  await context.close()
}

const interaction = await browser.newContext({ viewport: { width: 1280, height: 900 } })
const page = await interaction.newPage()
await page.goto(new URL('/brands', baseUrl).href, { waitUntil: 'networkidle', timeout: 45000 })
await page.waitForSelector('#brands-valuator-search', { timeout: 20000 })
const acceptCookies = page.getByRole('button', { name: /Accept all/i })
if (await acceptCookies.count()) {
  await acceptCookies.click()
  await page.waitForTimeout(200)
}

await page.fill('#brands-valuator-search', 'Skillmill')
await page.waitForTimeout(800)
const suggestionVisible = await page.locator('.canonical-autocomplete__dropdown, [role="listbox"]').count()
await page.screenshot({
  path: path.join(outDir, 'hero-1280-autocomplete.png'),
  fullPage: false,
})
console.log('Saved hero-1280-autocomplete.png suggestions=', suggestionVisible)

await page.keyboard.press('Enter')
await page.waitForTimeout(1200)
console.log('after-submit-url', page.url())

await interaction.close()
await browser.close()
console.log(`Screenshots saved to ${outDir}`)
