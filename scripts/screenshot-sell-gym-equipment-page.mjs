import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { chromium } from '@playwright/test'

const outDir = join(process.cwd(), 'reports', 'sell-gym-equipment-page')
mkdirSync(outDir, { recursive: true })

const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900, file: 'desktop-1440.png' },
  { name: 'laptop', width: 1024, height: 800, file: 'desktop-1024.png' },
  { name: 'tablet', width: 768, height: 1024, file: 'tablet-768.png' },
  { name: 'mobile-430', width: 430, height: 932, file: 'mobile-430.png' },
  { name: 'mobile', width: 390, height: 844, file: 'mobile-390.png' },
]

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
    await Promise.all(images.map((img) => {
      if (img.complete && img.naturalWidth > 0) return Promise.resolve()
      return new Promise((resolve) => {
        img.addEventListener('load', resolve, { once: true })
        img.addEventListener('error', resolve, { once: true })
      })
    }))
  })
  await page.locator('.sell-page__h1').scrollIntoViewIfNeeded()
}

async function assertNoOverflow(page, label) {
  const overflow = await page.evaluate(() => {
    const doc = document.documentElement
    return {
      scrollWidth: doc.scrollWidth,
      clientWidth: doc.clientWidth,
      overflows: doc.scrollWidth > doc.clientWidth + 1,
    }
  })
  if (overflow.overflows) {
    throw new Error(
      `${label} horizontal overflow: scrollWidth=${overflow.scrollWidth} clientWidth=${overflow.clientWidth}`,
    )
  }
}

async function assertImagesFullyVisible(page, label) {
  const report = await page.evaluate(() => {
    const steps = [...document.querySelectorAll('.sell-page__step')]
    const viewportWidth = document.documentElement.clientWidth
    return steps.map((step, index) => {
      const frame = step.querySelector('.sell-page__step-frame')
      const img = step.querySelector('.sell-page__step-image')
      const rect = frame.getBoundingClientRect()
      const style = getComputedStyle(img)
      return {
        index: index + 1,
        left: Math.round(rect.left),
        right: Math.round(rect.right),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
        objectFit: style.objectFit,
        outsideLeft: rect.left < -1,
        outsideRight: rect.right > viewportWidth + 1,
      }
    })
  })

  for (const step of report) {
    if (step.objectFit !== 'contain') {
      throw new Error(`${label}: step ${step.index} object-fit is ${step.objectFit}, expected contain`)
    }
    if (step.outsideLeft || step.outsideRight) {
      throw new Error(
        `${label}: step ${step.index} frame outside viewport (left=${step.left}, right=${step.right})`,
      )
    }
  }

  return report
}

async function assertSubtleHover(page) {
  const frames = page.locator('.sell-page__step-frame')
  const count = await frames.count()
  if (count !== 4) throw new Error(`expected 4 journey frames, found ${count}`)
  if (await page.locator('.sell-page__step-hover-preview').count()) {
    throw new Error('large floating hover preview should not exist')
  }
  if (await page.getByRole('dialog').count()) {
    throw new Error('lightbox dialog should not exist')
  }

  const sizes = await page.evaluate(() => {
    const frames = [...document.querySelectorAll('.sell-page__step-frame')]
    const hero = document.querySelector('.sell-page__hero')
    const heroVisual = document.querySelector('.sell-page__hero-visual')
    return {
      frames: frames.map((el) => ({
        w: Math.round(el.getBoundingClientRect().width),
        h: Math.round(el.getBoundingClientRect().height),
        objectFit: getComputedStyle(el.querySelector('.sell-page__step-image')).objectFit,
      })),
      heroH: Math.round(hero.getBoundingClientRect().height),
      heroVisualW: Math.round(heroVisual.getBoundingClientRect().width),
      gridW: Math.round(document.querySelector('.sell-page__journey').getBoundingClientRect().width),
    }
  })

  for (const frame of sizes.frames) {
    if (frame.objectFit !== 'contain') {
      throw new Error(`journey object-fit is ${frame.objectFit}`)
    }
    if (frame.w < 280) {
      throw new Error(`journey frame too narrow: ${frame.w}`)
    }
    if (frame.h < 150) {
      throw new Error(`journey frame too short: ${frame.h}`)
    }
  }

  const step = page.locator('.sell-page__step').nth(1)
  await step.hover()
  await page.waitForTimeout(200)
  const scale = await page.locator('.sell-page__step-frame').nth(1).evaluate((el) => {
    const matrix = new DOMMatrixReadOnly(getComputedStyle(el).transform)
    return matrix.a
  })
  if (scale < 1.18 || scale > 1.26) {
    throw new Error(`expected hover scale ~1.22, got ${scale}`)
  }
  await page.mouse.move(0, 0)
}

const browser = await chromium.launch()
const page = await browser.newPage({
  deviceScaleFactor: 1,
})

for (const viewport of VIEWPORTS) {
  await page.setViewportSize({ width: viewport.width, height: viewport.height })
  await page.goto('http://127.0.0.1:5175/sell-gym-equipment', { waitUntil: 'networkidle' })
  await dismissCookieBanner(page)
  await waitForJourneyImages(page)
  await assertNoOverflow(page, viewport.name)
  await assertImagesFullyVisible(page, viewport.name)
  await page.screenshot({
    path: join(outDir, viewport.file),
    fullPage: true,
  })
}

await page.setViewportSize({ width: 1440, height: 900 })
await page.goto('http://127.0.0.1:5175/sell-gym-equipment', { waitUntil: 'networkidle' })
await dismissCookieBanner(page)
await waitForJourneyImages(page)
await assertSubtleHover(page)
await page.screenshot({ path: join(outDir, 'desktop-1440.png'), fullPage: true })
await page.screenshot({ path: join(outDir, 'desktop.png'), fullPage: true })

await page.setViewportSize({ width: 1920, height: 1080 })
await page.goto('http://127.0.0.1:5175/sell-gym-equipment', { waitUntil: 'networkidle' })
await dismissCookieBanner(page)
await waitForJourneyImages(page)
await assertNoOverflow(page, 'desktop-1920')
await page.screenshot({ path: join(outDir, 'desktop-1920.png'), fullPage: true })

await page.setViewportSize({ width: 390, height: 844 })
await page.goto('http://127.0.0.1:5175/sell-gym-equipment', { waitUntil: 'networkidle' })
await dismissCookieBanner(page)
await waitForJourneyImages(page)
await page.screenshot({ path: join(outDir, 'mobile-390.png'), fullPage: true })
await page.screenshot({ path: join(outDir, 'mobile.png'), fullPage: true })

await browser.close()
console.log(`Wrote screenshots to ${outDir}`)
console.log('Overflow, visibility and subtle-hover checks passed')
