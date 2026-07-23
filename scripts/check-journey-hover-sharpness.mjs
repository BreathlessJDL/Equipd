import { readFileSync } from 'node:fs'
import { chromium } from '@playwright/test'
import {
  buildSellGymEquipmentSeoDocument,
  SELL_JOURNEY_STEPS,
} from '../src/lib/sellGymEquipmentPage.js'
import {
  buildBuyUsedGymEquipmentSeoDocument,
  BUY_JOURNEY_STEPS,
} from '../src/lib/buyUsedGymEquipmentPage.js'

function assert(condition, label) {
  if (!condition) throw new Error(label)
}

const sellCss = readFileSync('src/pages/SellGymEquipmentPage.css', 'utf8')
const buyCss = readFileSync('src/pages/BuyUsedGymEquipmentPage.css', 'utf8')
const sellJsx = readFileSync('src/pages/SellGymEquipmentPage.jsx', 'utf8')
const buyJsx = readFileSync('src/pages/BuyUsedGymEquipmentPage.jsx', 'utf8')
const sellDoc = buildSellGymEquipmentSeoDocument()
const buyDoc = buildBuyUsedGymEquipmentSeoDocument()

for (const [name, css] of [
  ['sell', sellCss],
  ['buy', buyCss],
]) {
  assert(css.includes('scale(1.05)'), `${name}: hover scale 1.05`)
  assert(!css.includes('scale(1.22)'), `${name}: no 1.22`)
  assert(css.includes(`:hover .${name}-page__step-image`), `${name}: scales image`)
  assert(css.includes('object-fit: contain'), `${name}: object-fit contain`)
  assert(css.includes('backface-visibility: hidden'), `${name}: backface`)
}

for (const [name, jsx] of [
  ['sell', sellJsx],
  ['buy', buyJsx],
]) {
  assert(jsx.includes('srcSet={imageSrc}'), `${name}: desktop full webp`)
  assert(jsx.includes('media="(max-width: 767px)"'), `${name}: mobile media`)
  assert(!jsx.includes('800w, ${imageSrc} 1536w'), `${name}: no 800w desktop candidate`)
}

for (const step of SELL_JOURNEY_STEPS) {
  assert(
    sellDoc.bodyHtml.includes(`srcset="${step.imageSrc}"`),
    `sell prerender full ${step.step}`,
  )
  assert(
    !sellDoc.bodyHtml.includes(`${step.imageSrcMobile} 800w`),
    `sell no 800w dens ${step.step}`,
  )
}
for (const step of BUY_JOURNEY_STEPS) {
  assert(
    buyDoc.bodyHtml.includes(`srcset="${step.imageSrc}"`),
    `buy prerender full ${step.step}`,
  )
  assert(
    !buyDoc.bodyHtml.includes(`${step.imageSrcMobile} 800w`),
    `buy no 800w dens ${step.step}`,
  )
}

console.log('static assertions: ok')

const base = (process.env.PREVIEW_URL || 'http://127.0.0.1:4179').replace(/\/$/, '')
const browser = await chromium.launch()

async function check(path) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  await page.goto(`${base}${path}`, { waitUntil: 'networkidle' })
  const accept = page.getByRole('button', { name: /Accept all/i }).first()
  if (await accept.count()) await accept.click().catch(() => {})
  await page.waitForTimeout(400)

  const info = await page.evaluate(() => {
    const imgs = [...document.querySelectorAll('[class*="step-image"]')]
    return imgs.map((img) => ({
      src: img.currentSrc || img.src,
      nw: img.naturalWidth,
      overflow: getComputedStyle(img.closest('[class*="step-frame"]')).overflow,
    }))
  })

  await page.locator('[class*="__step"]').first().hover()
  await page.waitForTimeout(280)
  const hovered = await page.evaluate(() => {
    const img = document.querySelector('[class*="step-image"]')
    return getComputedStyle(img).transform
  })

  const overflowX = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  )

  await page.close()
  return { path, info, hovered, overflowX }
}

const sell = await check('/sell-gym-equipment')
const buy = await check('/buy-used-gym-equipment')
console.log(JSON.stringify({ sell, buy }, null, 2))

for (const row of [sell, buy]) {
  assert(!row.overflowX, `${row.path}: horizontal overflow`)
  for (const img of row.info) {
    assert(!img.src.includes('-800.'), `${row.path}: low-res ${img.src}`)
    assert(img.nw >= 1400, `${row.path}: naturalWidth ${img.nw}`)
    assert(img.overflow === 'hidden', `${row.path}: frame overflow ${img.overflow}`)
  }
  assert(row.hovered.includes('matrix'), `${row.path}: hover transform missing (${row.hovered})`)
}

await browser.close()
console.log('live desktop source + hover: ok')
