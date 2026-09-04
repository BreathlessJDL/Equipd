/**
 * Pre-deploy visual validation for Concept2 buyer SEO page.
 * Usage: PREVIEW_URL=http://127.0.0.1:4173 node scripts/validate-concept2-buyer-seo-ui.mjs
 */
import { chromium } from '@playwright/test'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const OUT = join(process.cwd(), 'debug-screenshots', 'concept2-buyer-seo')
mkdirSync(OUT, { recursive: true })

const base = process.env.PREVIEW_URL || 'http://127.0.0.1:4173'

const viewports = [
  { name: '1440', width: 1440, height: 900 },
  { name: '1024', width: 1024, height: 768 },
  { name: '430', width: 430, height: 932 },
  { name: '390', width: 390, height: 844 },
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
    for (const vp of viewports) {
      const context = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
      })
      const page = await context.newPage()
      page.on('pageerror', (error) => {
        consoleErrors.push({ viewport: vp.name, message: error.message })
      })
      page.on('console', (msg) => {
        if (msg.type() === 'error') {
          consoleErrors.push({ viewport: vp.name, message: msg.text() })
        }
      })

      await page.goto(`${base}/brands/concept2`, {
        waitUntil: 'networkidle',
        timeout: 90000,
      })
      await dismissCookies(page)
      await page.waitForSelector('.brand-page__title', { timeout: 60000 })
      await page.waitForTimeout(900)

      const h1 = await page.locator('h1.brand-page__title').innerText()
      const order = await sectionOrder(page)
      const orderIds = order.map((entry) => entry.id)
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      )
      const listingCards = await page.locator('.brand-page__listings .listing-card, .listing-card-grid .listing-card').count()
      const usesSharedGrid = await page.locator('.brand-page__listings.listing-card-grid').count()
      const emptyHeading = await page.locator('#brand-listings-empty-title').count()
      const modelCards = await page.locator('.brand-model-card').count()
      const valueResearchCards = await page.locator('.brand-value-research-card').count()
      const typicalValue = await page.getByText('Typical value today').count()
      const seoPrerenderVisible = await page.evaluate(() => {
        const el = document.querySelector('[data-equipd-seo-prerender="brand"]')
        if (!el) return false
        const style = window.getComputedStyle(el)
        return style.display !== 'none' && style.visibility !== 'hidden' && el.offsetParent !== null
      })
      const browseCta = await page.getByRole('link', { name: /Browse Concept2 for sale/i }).count()
      const viewAll = await page.getByRole('link', { name: /View all listings|Browse Concept2/i }).count()
      const checkpoints = await page.locator('.brand-page__checkpoint').count()

      const path = join(OUT, `concept2-${vp.name}.png`)
      await page.screenshot({ path, fullPage: true })

      const expectedPresent = EXPECTED_ORDER.filter((id) => orderIds.includes(id))
      const orderOk = expectedPresent.every((id, index) => {
        const previous = expectedPresent[index - 1]
        if (!previous) return true
        return orderIds.indexOf(id) > orderIds.indexOf(previous)
      })

      results.push({
        viewport: vp.name,
        h1,
        orderIds,
        orderOk,
        overflow,
        listingCards,
        usesSharedGrid: usesSharedGrid > 0,
        emptyHeading: emptyHeading > 0,
        modelCards,
        valueResearchCards,
        typicalValue,
        seoPrerenderVisible,
        browseCta,
        viewAll,
        checkpoints,
        screenshot: path,
      })
      await context.close()
    }

    // Confirm Phase 1B brands are activated on the shared buyer template
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
    const page = await context.newPage()
    const expectedBuyerH1 = {
      wattbike: 'Used Wattbikes for Sale',
      cybex: 'Used Cybex Equipment for Sale',
      'life-fitness': 'Used Life Fitness Equipment for Sale',
      'hammer-strength': 'Used Hammer Strength Equipment for Sale',
    }
    for (const slug of Object.keys(expectedBuyerH1)) {
      await page.goto(`${base}/brands/${slug}`, { waitUntil: 'domcontentloaded', timeout: 90000 })
      await page.waitForSelector('.brand-page__title', { timeout: 60000 })
      results.push({
        regression: slug,
        title: await page.title(),
        h1: await page.locator('h1.brand-page__title').innerText(),
        expectedH1: expectedBuyerH1[slug],
      })
    }
    await context.close()
  } finally {
    await browser.close()
  }

  writeFileSync(join(OUT, 'results.json'), JSON.stringify({ results, consoleErrors }, null, 2))
  console.log(JSON.stringify({ results, consoleErrors }, null, 2))

  const concept2Fails = results.filter((row) => row.viewport && (
    !row.orderOk
    || row.overflow
    || row.seoPrerenderVisible
    || row.modelCards < 6
    || row.valueResearchCards < 6
    || row.typicalValue > 0
    || row.browseCta < 1
    || row.checkpoints < 4
    || row.usesSharedGrid === false
  ))
  const phase1bOk = results
    .filter((row) => row.regression)
    .every((row) => String(row.h1 || '').trim() === row.expectedH1)
  if (concept2Fails.length || consoleErrors.length || !phase1bOk) {
    console.error('VALIDATION_FAILED')
    process.exit(1)
  }
  console.log('VALIDATION_OK')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
