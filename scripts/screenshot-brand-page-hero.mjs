import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { chromium } from 'playwright-core'

const ROOT = process.cwd()
const outDir = path.join(ROOT, 'reports', 'brand-page-hero')
const baseUrl = process.argv[2] ?? 'http://localhost:5175/'
const brands = [
  { slug: 'life-fitness', label: 'life-fitness' },
  { slug: 'technogym', label: 'technogym' },
  { slug: 'horizon-fitness', label: 'horizon-fitness' },
  { slug: 'peloton', label: 'peloton' },
]
const viewports = [
  { name: '1280', width: 1280, height: 900 },
  { name: '1920', width: 1920, height: 1080 },
]

await mkdir(outDir, { recursive: true })
const browser = await chromium.launch({ channel: 'msedge' })

for (const brand of brands) {
  for (const viewport of viewports) {
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
    })
    const page = await context.newPage()
    await page.goto(new URL(`/brands/${brand.slug}`, baseUrl).href, {
      waitUntil: 'networkidle',
      timeout: 60000,
    })
    await page.waitForSelector('.brand-page-hero', { timeout: 30000 })
    const accept = page.getByRole('button', { name: /Accept all/i })
    if (await accept.count()) {
      await accept.click()
      await page.waitForTimeout(200)
    }
    const metrics = await page.evaluate(() => {
      const hero = document.querySelector('.brand-page-hero')
      const title = document.querySelector('.brand-page-hero__title')
      const h1 = document.querySelector('.brand-page-hero h1')
      const stats = [...document.querySelectorAll('.brand-page-hero__stat')].map((el) => el.textContent.trim())
      const overflowX = document.documentElement.scrollWidth - document.documentElement.clientWidth
      const bg = getComputedStyle(hero).backgroundImage
      return {
        visibleTitle: title?.textContent.trim() || null,
        seoH1: h1?.textContent.trim() || null,
        stats,
        overflowX,
        hasBackground: bg.includes('Soft'),
      }
    })
    const fileName = `${brand.label}-${viewport.name}.png`
    await page.screenshot({ path: path.join(outDir, fileName), fullPage: false })
    console.log(fileName, JSON.stringify(metrics))
    await context.close()
  }
}

const searchContext = await browser.newContext({ viewport: { width: 1280, height: 900 } })
const searchPage = await searchContext.newPage()
await searchPage.goto(new URL('/brands/life-fitness', baseUrl).href, {
  waitUntil: 'networkidle',
  timeout: 60000,
})
await searchPage.waitForSelector('.brand-page-hero__search-input', { timeout: 30000 })
const acceptCookies = searchPage.getByRole('button', { name: /Accept all/i })
if (await acceptCookies.count()) {
  await acceptCookies.click()
  await searchPage.waitForTimeout(200)
}
await searchPage.fill('.brand-page-hero__search-input', 'treadmill')
await searchPage.waitForTimeout(400)
await searchPage.screenshot({
  path: path.join(outDir, 'life-fitness-1280-search.png'),
  fullPage: false,
})
const suggestionCount = await searchPage.locator('.brand-page-hero__search-suggestions li').count()
console.log('life-fitness-1280-search suggestions=', suggestionCount)

await searchPage.getByRole('link', { name: /Browse Life Fitness listings/i }).click()
await searchPage.waitForTimeout(1200)
console.log('browse-cta-url', searchPage.url())

await searchContext.close()
await browser.close()
console.log(`Screenshots saved to ${outDir}`)
