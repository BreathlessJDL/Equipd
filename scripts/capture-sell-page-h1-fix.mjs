import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { chromium } from 'playwright'

const baseUrl = process.env.SELL_PAGE_URL || 'http://127.0.0.1:4173/sell-gym-equipment'
const outDir = join(process.cwd(), 'reports', 'sell-page-h1-fix')
mkdirSync(outDir, { recursive: true })

const viewports = [
  { name: 'desktop-1440', width: 1440, height: 900 },
  { name: 'desktop-1920', width: 1920, height: 1080 },
  { name: 'mobile-390', width: 390, height: 844 },
]

const browser = await chromium.launch()
const page = await browser.newPage()

const results = []

for (const vp of viewports) {
  await page.setViewportSize({ width: vp.width, height: vp.height })
  await page.goto(baseUrl, { waitUntil: 'networkidle' })

  const metrics = await page.evaluate(() => {
    const h1 = document.querySelector('.sell-page__h1')
    if (!h1) return { error: 'missing h1' }

    const style = getComputedStyle(h1)
    const rect = h1.getBoundingClientRect()
    const range = document.createRange()
    range.selectNodeContents(h1)
    const textRects = [...range.getClientRects()]

    return {
      textContent: h1.textContent?.trim(),
      innerText: h1.innerText?.trim(),
      whiteSpace: style.whiteSpace,
      overflow: style.overflow,
      lineHeight: style.lineHeight,
      fontSize: style.fontSize,
      boxWidth: rect.width,
      boxHeight: rect.height,
      textLineCount: textRects.length,
      textVisible: h1.offsetParent !== null && rect.width > 0 && rect.height > 0,
      heroOverflowX: getComputedStyle(document.querySelector('.sell-page__hero') || document.body).overflowX,
    }
  })

  await page.locator('.sell-page__hero').screenshot({
    path: join(outDir, `${vp.name}-hero.png`),
  })

  results.push({ viewport: vp.name, ...metrics })
}

await browser.close()

console.log(JSON.stringify({ baseUrl, outDir, results }, null, 2))

const expected = 'With Equipd'
for (const row of results) {
  if (row.textContent !== expected) {
    console.error(`textContent mismatch at ${row.viewport}: ${row.textContent}`)
    process.exit(1)
  }
  if (row.whiteSpace === 'nowrap') {
    console.error(`nowrap still applied at ${row.viewport}`)
    process.exit(1)
  }
}
