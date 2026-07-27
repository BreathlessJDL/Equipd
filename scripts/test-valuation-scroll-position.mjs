#!/usr/bin/env node
/**
 * Validate valuation page scroll positioning.
 *
 *   node scripts/test-valuation-scroll-position.mjs [baseUrl]
 */
import assert from 'node:assert/strict'
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { chromium } from 'playwright-core'

const baseUrl = (process.argv[2] ?? 'http://127.0.0.1:5173').replace(/\/$/, '')
const outDir = join(process.cwd(), 'reports', 'valuation-scroll-position')
mkdirSync(outDir, { recursive: true })

const pageSource = readFileSync('src/pages/ValuationPage.jsx', 'utf8')
const scrollUtil = readFileSync('src/lib/scrollToValuationAnchor.js', 'utf8')

assert.match(scrollUtil, /getStickySiteHeaderHeight/, 'measures sticky header height')
assert.match(scrollUtil, /VALUATION_PROGRESS_ANCHOR_ID/, 'progress anchor id exported')
assert.match(scrollUtil, /VALUATION_SELECTED_PRODUCT_ANCHOR_ID/, 'selected product anchor id exported')
assert.match(pageSource, /valuation-progress-anchor|VALUATION_PROGRESS_ANCHOR_ID/, 'progress anchor wired')
assert.match(pageSource, /selected-product-anchor|VALUATION_SELECTED_PRODUCT_ANCHOR_ID/, 'product anchor wired')
assert.match(pageSource, /scrollToValuationProgress/, 'stage scroll uses helper')
assert.match(pageSource, /scrollToSelectedProduct/, 'selection scroll uses helper')
assert.doesNotMatch(pageSource, /scrollIntoView/, 'raw scrollIntoView removed from page')
assert.match(pageSource, /calculateEquipmentProductValuation/, 'valuation logic preserved')

const browser = await chromium.launch({ headless: true, channel: 'msedge' })
const summary = { outDir, screenshots: {}, checks: {} }

async function dismissCookies(page) {
  const accept = page.getByRole('button', { name: /Accept all|Accept necessary/i }).first()
  if (await accept.count()) await accept.click({ timeout: 2500 }).catch(() => {})
}

async function waitReady(page) {
  await page.waitForSelector('#valuation-progress-anchor', { timeout: 45000 })
  await page.waitForFunction(() => {
    const status = document.querySelector('.valuation-page__status')
    return !status || !/Loading catalogue/i.test(status.textContent || '')
  }, { timeout: 45000 }).catch(() => {})
}

function measureVisibility(page) {
  return page.evaluate(() => {
    const header = document.querySelector('.global-site-header')
    const headerBottom = header ? header.getBoundingClientRect().bottom : 0
    const progress = document.getElementById('valuation-progress-anchor')
    const selected = document.getElementById('selected-product-anchor')
    const continueBtn = document.querySelector('.valuation-page__continue')
    const detailsTitle = document.querySelector('.valuation-page__panel--details .valuation-page__panel-title')

    function pack(el) {
      if (!el) return null
      const r = el.getBoundingClientRect()
      return {
        top: Math.round(r.top),
        bottom: Math.round(r.bottom),
        fullyBelowHeader: r.top >= headerBottom - 1,
        inViewport: r.bottom > headerBottom && r.top < window.innerHeight,
      }
    }

    return {
      headerBottom: Math.round(headerBottom),
      scrollY: Math.round(window.scrollY),
      progress: pack(progress),
      selected: pack(selected),
      continueBtn: pack(continueBtn),
      detailsTitle: pack(detailsTitle),
    }
  })
}

for (const viewport of [
  { name: 'mobile-390', width: 390, height: 844 },
  { name: 'mobile-430', width: 430, height: 900 },
  { name: 'tablet-768', width: 768, height: 1024 },
  { name: 'desktop-1024', width: 1024, height: 900 },
  { name: 'desktop-1440', width: 1440, height: 1100 },
]) {
  const page = await browser.newPage({
    viewport: { width: viewport.width, height: viewport.height },
  })
  await page.goto(`${baseUrl}/valuation`, { waitUntil: 'networkidle', timeout: 90000 })
  await dismissCookies(page)
  await waitReady(page)
  await page.waitForTimeout(300)

  const openState = await measureVisibility(page)
  assert.ok(openState.progress?.inViewport, `${viewport.name}: progress visible on open`)
  assert.equal(openState.progress?.fullyBelowHeader, true, `${viewport.name}: progress below header on open`)

  if (viewport.width <= 1023) {
    await page.fill('#valuation-product-search', 'Life Fitness')
    await page.waitForSelector('.valuation-page__result-row', { timeout: 15000 })
    await page.locator('.valuation-page__result-row').first().click()
    await page.waitForSelector('#selected-product-anchor .valuation-page__preview-card--filled', {
      timeout: 10000,
    })
    await page.waitForTimeout(1100)
    const selectedState = await measureVisibility(page)
    assert.equal(
      selectedState.selected?.fullyBelowHeader,
      true,
      `${viewport.name}: selected card top below header (top=${selectedState.selected?.top}, header=${selectedState.headerBottom})`,
    )
    assert.ok(selectedState.selected?.inViewport, `${viewport.name}: selected card in viewport`)
    assert.ok(selectedState.continueBtn?.inViewport, `${viewport.name}: continue CTA in viewport`)

    if (viewport.name === 'mobile-390') {
      await page.screenshot({ path: join(outDir, 'mobile-selected.png') })
      summary.screenshots.mobileSelected = join(outDir, 'mobile-selected.png')
    }

    await page.getByRole('button', { name: /Continue to details/i }).click()
  } else {
    await page.fill('#valuation-product-search', 'Life Fitness E3')
    await page.waitForSelector('.valuation-page__result-row', { timeout: 15000 })
    await page.locator('.valuation-page__result-row').first().click()
    await page.waitForSelector('.valuation-page__preview-card--filled', { timeout: 10000 })
    await page.getByRole('button', { name: /Continue to details/i }).click()
  }

  await page.waitForSelector('.valuation-page__panel--details', { timeout: 15000 })
  await page.waitForTimeout(1100)
  const detailsState = await measureVisibility(page)
  assert.equal(
    detailsState.progress?.fullyBelowHeader,
    true,
    `${viewport.name}: progress fully visible on details (top=${detailsState.progress?.top}, header=${detailsState.headerBottom})`,
  )
  assert.ok(detailsState.progress?.inViewport, `${viewport.name}: progress in viewport on details`)
  assert.ok(
    detailsState.detailsTitle?.fullyBelowHeader,
    `${viewport.name}: details heading below header`,
  )

  if (viewport.name === 'mobile-390') {
    await page.screenshot({ path: join(outDir, 'mobile-details.png') })
    summary.screenshots.mobileDetails = join(outDir, 'mobile-details.png')
  }
  if (viewport.name === 'desktop-1440') {
    await page.goto(`${baseUrl}/valuation`, { waitUntil: 'networkidle', timeout: 90000 })
    await dismissCookies(page)
    await waitReady(page)
    await page.waitForTimeout(200)
    await page.screenshot({ path: join(outDir, 'desktop-open.png') })
    summary.screenshots.desktopOpen = join(outDir, 'desktop-open.png')

    await page.fill('#valuation-product-search', 'Life Fitness E3')
    await page.waitForSelector('.valuation-page__result-row')
    await page.locator('.valuation-page__result-row').first().click()
    await page.getByRole('button', { name: /Continue to details/i }).click()
    await page.waitForSelector('.valuation-page__panel--details')
    await page.waitForTimeout(1100)
    await page.screenshot({ path: join(outDir, 'desktop-details.png') })
    summary.screenshots.desktopDetails = join(outDir, 'desktop-details.png')
  }

  summary.checks[viewport.name] = { openState, detailsState }
  await page.close()
}

await browser.close()
writeFileSync(join(outDir, 'results.json'), JSON.stringify(summary, null, 2))
console.log(JSON.stringify(summary, null, 2))
console.log('PASS: valuation scroll position')
