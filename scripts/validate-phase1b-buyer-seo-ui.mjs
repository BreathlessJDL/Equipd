/**
 * Visual validation for Phase 1B buyer SEO brand pages (+ Concept2 regression).
 * Usage: PREVIEW_URL=http://127.0.0.1:4173 node scripts/validate-phase1b-buyer-seo-ui.mjs
 */
import { chromium } from '@playwright/test'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const OUT = join(process.cwd(), 'debug-screenshots', 'phase1b-buyer-seo')
mkdirSync(OUT, { recursive: true })

const base = process.env.PREVIEW_URL || 'http://127.0.0.1:4173'

const viewports = [
  { name: '1440', width: 1440, height: 900 },
  { name: '1024', width: 1024, height: 768 },
  { name: '430', width: 430, height: 932 },
  { name: '390', width: 390, height: 844 },
]

const brands = [
  {
    slug: 'concept2',
    h1: 'Used Concept2 Equipment for Sale',
    expectListings: true,
  },
  {
    slug: 'wattbike',
    h1: 'Used Wattbikes for Sale',
    expectEmptyMarketplace: true,
  },
  {
    slug: 'cybex',
    h1: 'Used Cybex Equipment for Sale',
    expectEmptyMarketplace: true,
    expectGroups: true,
  },
  {
    slug: 'life-fitness',
    h1: 'Used Life Fitness Equipment for Sale',
    expectListings: true,
    expectGroups: true,
  },
  {
    slug: 'hammer-strength',
    h1: 'Used Hammer Strength Equipment for Sale',
  },
]

const EXPECTED_ORDER = [
  'hero',
  'listings',
  'models',
  'buying',
  'categories',
  'values',
  'about',
]

async function dismissCookies(page) {
  const accept = page.getByRole('button', { name: /Accept all/i })
  if (await accept.count()) {
    await accept.click({ timeout: 2000 }).catch(() => {})
    await page.waitForTimeout(200)
  }
}

async function sectionOrder(page) {
  return page.evaluate(() => {
    const points = [
      { id: 'hero', el: document.querySelector('.brand-page__hero') },
      { id: 'listings', el: document.querySelector('#brand-listings-title, #brand-listings-empty-title') },
      { id: 'models', el: document.querySelector('#brand-models-title') },
      { id: 'buying', el: document.querySelector('#brand-buying-title') },
      { id: 'categories', el: document.querySelector('#brand-related-cats-title') },
      { id: 'values', el: document.querySelector('#brand-popular-title') },
      { id: 'about', el: document.querySelector('#brand-about-title') },
    ]
    return points
      .filter((entry) => entry.el)
      .map((entry) => {
        const rect = entry.el.getBoundingClientRect()
        const top = rect.top + window.scrollY
        return { id: entry.id, top, text: entry.el.textContent?.trim().slice(0, 80) || '' }
      })
      .sort((a, b) => a.top - b.top)
  })
}

async function main() {
  const browser = await chromium.launch({ headless: true })
  const results = []
  const consoleErrors = []

  try {
    for (const brand of brands) {
      for (const vp of viewports) {
        const context = await browser.newContext({
          viewport: { width: vp.width, height: vp.height },
        })
        const page = await context.newPage()
        page.on('pageerror', (error) => {
          consoleErrors.push({ brand: brand.slug, viewport: vp.name, message: error.message })
        })
        page.on('console', (msg) => {
          if (msg.type() === 'error') {
            consoleErrors.push({ brand: brand.slug, viewport: vp.name, message: msg.text() })
          }
        })

        const url = `${base}/brands/${brand.slug}`
        await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 })
        await dismissCookies(page)
        await page.waitForSelector('h1', { timeout: 15000 })

        const h1 = await page.locator('h1').first().innerText()
        const overflowX = await page.evaluate(() => {
          const doc = document.documentElement
          return doc.scrollWidth > doc.clientWidth + 1
        })
        const order = await sectionOrder(page)
        const orderIds = order.map((entry) => entry.id)
        const orderOk = EXPECTED_ORDER.every((id, index) => {
          const at = orderIds.indexOf(id)
          if (at === -1) return false
          return index === 0 || orderIds.indexOf(EXPECTED_ORDER[index - 1]) < at
        })

        const hasGroups = brand.expectGroups
          ? (await page.locator('.brand-page__model-group-title').count()) >= 2
          : true
        const hasEmpty = brand.expectEmptyMarketplace
          ? (await page.locator('#brand-listings-empty-title').count()) === 1
          : true
        const hasCards = brand.expectListings
          ? (await page.locator('.listing-card, [class*="ListingCard"], a[href^="/listings/"]').count()) > 0
            || (await page.locator('#brand-listings-title').count()) === 1
          : true

        const shot = join(OUT, `${brand.slug}-${vp.name}.png`)
        await page.screenshot({ path: shot, fullPage: true })

        results.push({
          brand: brand.slug,
          viewport: vp.name,
          h1,
          h1Ok: h1.trim() === brand.h1,
          overflowX,
          orderIds,
          orderOk,
          hasGroups,
          hasEmpty,
          hasCards,
          shot,
        })

        await context.close()
      }
    }
  } finally {
    await browser.close()
  }

  const summary = { results, consoleErrors }
  writeFileSync(join(OUT, 'summary.json'), JSON.stringify(summary, null, 2))

  const failures = results.filter((row) => (
    !row.h1Ok || row.overflowX || !row.orderOk || !row.hasGroups || !row.hasEmpty || !row.hasCards
  ))
  console.log(JSON.stringify({
    ok: failures.length === 0 && consoleErrors.length === 0,
    checked: results.length,
    failures: failures.length,
    consoleErrors: consoleErrors.length,
    failureSample: failures.slice(0, 8),
    out: OUT,
  }, null, 2))

  if (failures.length || consoleErrors.length) process.exit(1)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
