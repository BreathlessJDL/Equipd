import { chromium } from '@playwright/test'
import { join } from 'node:path'
import { writeFileSync } from 'node:fs'

const base = (process.env.PREVIEW_URL || 'http://127.0.0.1:4179').replace(/\/$/, '')
const outDir = join(process.cwd(), 'reports', 'buy-used-gym-equipment-page')

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
await page.goto(`${base}/buy-used-gym-equipment`, { waitUntil: 'networkidle' })
const accept = page.getByRole('button', { name: /Accept all/i }).first()
if (await accept.count()) await accept.click().catch(() => {})

await page.locator('#buy-benefits-heading').scrollIntoViewIfNeeded()
await page.locator('.buy-page__benefits-section').screenshot({
  path: join(outDir, 'desktop-1440-benefits.png'),
})
await page.locator('.buy-page__journey-section').screenshot({
  path: join(outDir, 'desktop-1440-journey.png'),
})

const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } })
await mobile.goto(`${base}/buy-used-gym-equipment`, { waitUntil: 'networkidle' })
if (await mobile.getByRole('button', { name: /Accept all/i }).count()) {
  await mobile.getByRole('button', { name: /Accept all/i }).first().click().catch(() => {})
}
await mobile.screenshot({ path: join(outDir, 'mobile-390-full.png'), fullPage: true })
await page.screenshot({ path: join(outDir, 'desktop-1440-full.png'), fullPage: true })

const marks = await page.locator('.buy-page__benefit-mark').allTextContents()
const iconsLeft = await page.locator('.buy-page__benefit-icon, svg.buy-page__benefit-icon').count()
const heroSrc = await page.locator('.buy-page__hero-artwork-image').getAttribute('src')
const stepSrcs = await page.locator('.buy-page__step-image').evaluateAll((imgs) =>
  imgs.map((img) => img.currentSrc || img.src),
)

const summary = { marks, iconsLeft, heroSrc, stepSrcs }
writeFileSync(join(outDir, 'polish-check.json'), JSON.stringify(summary, null, 2))
console.log(JSON.stringify(summary, null, 2))

if (marks.join('') !== '123') throw new Error(`expected numbered markers 1/2/3, got ${marks}`)
if (iconsLeft !== 0) throw new Error('benefit icons still present')
if (!heroSrc?.includes('buy-used-gym-equipment-marketplace')) throw new Error('hero asset missing')
for (const src of stepSrcs) {
  if (!/\/images\/buy\/step-[1-4]/.test(src)) throw new Error(`unexpected step src ${src}`)
}

await browser.close()
