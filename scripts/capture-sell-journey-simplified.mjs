import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { chromium } from 'playwright'

const baseUrl = process.env.SELL_PAGE_URL || 'http://127.0.0.1:4181/sell-gym-equipment'
const outDir = join(process.cwd(), 'reports', 'sell-journey-simplified')
mkdirSync(outDir, { recursive: true })

const viewports = [
  { name: 'mobile-390', width: 390, height: 844 },
  { name: 'tablet-768', width: 768, height: 1024 },
  { name: 'laptop-1024', width: 1024, height: 900 },
  { name: 'desktop-1440', width: 1440, height: 900 },
]

const browser = await chromium.launch()
const page = await browser.newPage()
const results = []

for (const vp of viewports) {
  await page.setViewportSize({ width: vp.width, height: vp.height })
  await page.goto(baseUrl, { waitUntil: 'networkidle' })
  await page.evaluate(() => {
    document.querySelector('.sell-page__journey-section')?.scrollIntoView({ block: 'start' })
  })
  await page.waitForTimeout(300)

  const metrics = await page.evaluate(() => {
    const frames = [...document.querySelectorAll('.sell-page__step-frame')]
    const imgs = [...document.querySelectorAll('.sell-page__step-image')]
    const steps = [...document.querySelectorAll('.sell-page__step')]
    const section = document.querySelector('.sell-page__journey-section')
    const overflow = document.documentElement.scrollWidth > document.documentElement.clientWidth + 1

    return {
      frameCount: frames.length,
      frameHeights: frames.map((el) => Math.round(el.getBoundingClientRect().height)),
      frameWidths: frames.map((el) => Math.round(el.getBoundingClientRect().width)),
      cardHeights: steps.map((el) => Math.round(el.getBoundingClientRect().height)),
      imageNatural: imgs.map((img) => ({
        src: img.currentSrc || img.src,
        nw: img.naturalWidth,
        nh: img.naturalHeight,
        objectFit: getComputedStyle(img).objectFit,
      })),
      aspectRatio: frames[0] ? getComputedStyle(frames[0]).aspectRatio : null,
      sectionOverflowX: section ? getComputedStyle(section).overflowX : null,
      pageHorizontalOverflow: overflow,
    }
  })

  await page.locator('.sell-page__journey-section').screenshot({
    path: join(outDir, `${vp.name}-journey.png`),
  })

  const equalFrames = metrics.frameHeights.every((h) => h === metrics.frameHeights[0])
  results.push({ viewport: vp.name, equalFrames, ...metrics })
}

await browser.close()
console.log(JSON.stringify({ baseUrl, outDir, results }, null, 2))

for (const row of results) {
  if (row.frameCount !== 4) throw new Error(`${row.viewport}: expected 4 frames`)
  if (!row.equalFrames) throw new Error(`${row.viewport}: unequal frame heights`)
  if (row.pageHorizontalOverflow) throw new Error(`${row.viewport}: horizontal overflow`)
  for (const img of row.imageNatural) {
    if (!img.src.includes('/images/sell/step-')) throw new Error(`${row.viewport}: unexpected src ${img.src}`)
    if (img.objectFit !== 'contain') throw new Error(`${row.viewport}: object-fit ${img.objectFit}`)
    if (!img.nw || !img.nh) throw new Error(`${row.viewport}: image not loaded`)
  }
}
