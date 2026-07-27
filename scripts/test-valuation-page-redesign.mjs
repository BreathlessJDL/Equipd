#!/usr/bin/env node
/**
 * Validate redesigned /valuation two-column flow.
 *
 *   node scripts/test-valuation-page-redesign.mjs [baseUrl]
 */
import assert from 'node:assert/strict'
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { performance } from 'node:perf_hooks'
import { chromium } from 'playwright-core'
import {
  calculateEquipmentProductValuation,
  resolveValuationSearchMatches,
} from '../src/lib/equipmentValuation.js'

const baseUrl = (process.argv[2] ?? 'http://127.0.0.1:5173').replace(/\/$/, '')
const outDir = join(process.cwd(), 'reports', 'valuation-page-redesign')
mkdirSync(outDir, { recursive: true })

const pageSource = readFileSync('src/pages/ValuationPage.jsx', 'utf8')
const pageCss = readFileSync('src/pages/ValuationPage.css', 'utf8')
const stepperSource = readFileSync('src/components/valuation/ValuationStepper.jsx', 'utf8')

assert.match(pageSource, /ValuationStepper/, 'page uses shared stepper')
assert.match(stepperSource, /aria-label="Valuation progress"/, 'stepper is accessible')
assert.match(pageSource, /Continue to details/, 'step 1 continue CTA present')
assert.match(pageSource, /Select a product to continue/, 'empty preview copy present')
assert.doesNotMatch(pageSource, /estimated used market|Estimated mid|depreciation percentage/i)
assert.match(pageSource, /getValuationSearchIndex/, 'fast search index still used')
assert.match(pageSource, /calculateEquipmentProductValuation/, 'existing valuation calc still used')
assert.match(pageSource, /resolveValuationSearchMatches/, 'existing ranking still used')
assert.match(pageCss, /--valuation-max:\s*86rem/, 'wide content rail')
assert.match(pageCss, /grid-template-columns:\s*minmax\(0,\s*1\.12fr\)/, 'desktop two-column proportions')
assert.doesNotMatch(pageSource, /function CompletionBadge/, 'internal completion badge removed from customer UI')

const indexPath = join(process.cwd(), 'public', 'data', 'valuation-search-index.json')
assert.equal(existsSync(indexPath), true, 'valuation search index exists')
const index = JSON.parse(readFileSync(indexPath, 'utf8'))
const products = index.products ?? index.items ?? []
assert.ok(products.length > 100, `search index has products (got ${products.length})`)

// Warm the search path once before timing so module init is excluded.
resolveValuationSearchMatches(products, 'Technogym')
const warmSearchStart = performance.now()
const lifeFitnessMatches = resolveValuationSearchMatches(products, 'Life Fitness')
const warmSearchMs = performance.now() - warmSearchStart
assert.ok(lifeFitnessMatches.matches.length > 0, 'Life Fitness search returns ranked matches')
assert.ok(warmSearchMs < 120, `warm search stays fast (${warmSearchMs.toFixed(1)}ms)`)

const sampleProduct = lifeFitnessMatches.matches[0]
assert.ok(sampleProduct, 'sample product available')
assert.ok(!('estimated_mid' in (sampleProduct || {})), 'search rows do not include estimates')

const calc = calculateEquipmentProductValuation(sampleProduct, {
  condition: 'Good',
  actual_manufacture_year: sampleProduct.baseline_manufacture_year || 2018,
  current_year: 2026,
})
assert.equal(typeof calc?.ok, 'boolean', 'valuation calculation returns result object')

const browser = await chromium.launch({ headless: true, channel: 'msedge' })
const results = {
  searchWarmMs: Number(warmSearchMs.toFixed(2)),
  matchCount: lifeFitnessMatches.matches.length,
  calcOk: Boolean(calc?.ok),
  screenshots: {},
  flows: {},
}

async function dismissCookies(page) {
  const accept = page.getByRole('button', { name: /Accept all|Accept necessary/i }).first()
  if (await accept.count()) await accept.click({ timeout: 2500 }).catch(() => {})
}

async function waitForSearchReady(page) {
  await page.waitForSelector('#valuation-product-search', { timeout: 45000 })
  await page.waitForFunction(() => {
    const status = document.querySelector('.valuation-page__status')
    return !status || !/Loading catalogue/i.test(status.textContent || '')
  }, { timeout: 45000 })
}

async function captureStage(page, name, width) {
  const path = join(outDir, `${name}-${width}.png`)
  await page.screenshot({ path, fullPage: false })
  results.screenshots[`${name}-${width}`] = path
}

for (const viewport of [
  { name: 'desktop', width: 1440, height: 1100 },
  { name: 'laptop', width: 1024, height: 900 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'mobile', width: 390, height: 844 },
]) {
  const page = await browser.newPage({
    viewport: { width: viewport.width, height: viewport.height },
  })
  await page.goto(`${baseUrl}/valuation`, { waitUntil: 'networkidle', timeout: 90000 })
  await dismissCookies(page)
  await waitForSearchReady(page)

  const shellWidth = await page.evaluate(() => {
    const shell = document.querySelector('.valuation-page__shell')
    return shell ? Math.round(shell.getBoundingClientRect().width) : 0
  })
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  )
  assert.equal(overflow, false, `${viewport.name}: no horizontal overflow on empty state`)
  if (viewport.width >= 1440) {
    assert.ok(shellWidth >= 1200, `${viewport.name}: wide shell (${shellWidth}px)`)
  }

  const h1 = await page.locator('h1.valuation-page__title').textContent()
  assert.match(h1 || '', /Value your equipment in seconds/i)

  const emptyPreview = page.getByRole('heading', { name: /Select a product to continue/i })
  assert.equal(await emptyPreview.count(), 1, `${viewport.name}: empty preview visible`)
  assert.equal(
    await page.locator('.valuation-page__range-card--mid').count(),
    0,
    `${viewport.name}: no estimate shown at step 1 empty`,
  )

  const runFullFlow = viewport.name === 'desktop' || viewport.name === 'mobile'
  if (!runFullFlow) {
    await captureStage(page, 'step1-empty', viewport.width)
    results.flows[viewport.name] = { shellWidth, overflow }
    await page.close()
    continue
  }

  await captureStage(page, 'step1-empty', viewport.width)

  await page.fill('#valuation-product-search', 'Life Fitness')
  await page.waitForSelector('.valuation-page__result-row', { timeout: 15000 })
  const resultCountLabel = await page.locator('.valuation-page__results-heading').textContent()
  assert.match(resultCountLabel || '', /Results \(\d+\)/)

  const firstResult = page.locator('.valuation-page__result-row').first()
  await firstResult.focus()
  await page.keyboard.press('Enter')
  await page.waitForSelector('.valuation-page__result-row--selected', { timeout: 5000 })
  await page.waitForSelector('.valuation-page__preview-card--filled', { timeout: 5000 })

  assert.equal(
    await page.locator('.valuation-page__range-card--mid').count(),
    0,
    `${viewport.name}: no estimate after product select`,
  )
  const selectedAnnounced = await page.evaluate(() => {
    const selected = document.querySelector('.valuation-page__result-row--selected')
    return selected?.getAttribute('aria-selected') === 'true'
  })
  assert.equal(selectedAnnounced, true, `${viewport.name}: selected result announced`)

  const previewHasFakeValue = await page.evaluate(() => {
    const preview = document.querySelector('.valuation-page__preview-card--filled')
    const text = preview?.textContent || ''
    return /estimated mid|used market|£\d{2,}/i.test(text) && /estimate/i.test(text)
  })
  // Preview may show RRP (£…) but must not claim an estimated used value.
  const previewClaimsEstimate = await page.evaluate(() => {
    const preview = document.querySelector('.valuation-page__preview-card--filled')
    return /estimated|market value|depreciation/i.test(preview?.textContent || '')
  })
  assert.equal(previewClaimsEstimate, false, `${viewport.name}: preview has no estimate claims`)
  void previewHasFakeValue

  await captureStage(page, 'step1-selected', viewport.width)

  await page.getByRole('button', { name: /Continue to details/i }).click()
  await page.waitForSelector('.valuation-page__panel--details', { timeout: 15000 })
  assert.ok(
    await page.locator('.valuation-page__preview-card--filled').count(),
    `${viewport.name}: selected product preserved on details`,
  )
  await captureStage(page, 'step2-details', viewport.width)

  const yearSelect = page.locator('#valuation-actual-year')
  if (await yearSelect.count()) {
    const options = await yearSelect.locator('option').allTextContents()
    const usable = options.map((o) => o.trim()).filter((o) => /^\d{4}/.test(o))
    if (usable.length) await yearSelect.selectOption({ label: usable[0] })
  }

  await page.getByRole('button', { name: /Calculate valuation|Continue/i }).click()
  await page.waitForSelector('.valuation-page__panel--results', { timeout: 15000 })

  const scrolledNearTop = await page.evaluate(() => window.scrollY < 220)
  assert.equal(scrolledNearTop, true, `${viewport.name}: scrolled toward top after estimate`)

  if (calc.ok) {
    assert.ok(
      await page.locator('.valuation-page__range-card--mid').count(),
      `${viewport.name}: estimate range rendered`,
    )
  }

  const listCta = page.getByRole('link', { name: /List on Equipd/i })
  assert.equal(await listCta.count(), 1)
  const listHref = await listCta.getAttribute('href')
  assert.match(listHref || '', /source=valuation/)
  assert.match(listHref || '', /productId=|equipment=/)

  await captureStage(page, 'step3-estimate', viewport.width)

  results.flows[viewport.name] = {
    shellWidth,
    overflow,
    resultCountLabel,
    listHref,
    scrolledNearTop,
  }

  await page.close()
}

// Lighthouse (best-effort; skip cleanly if unavailable)
let lighthouseSummary = null
try {
  const { default: lighthouse } = await import('lighthouse')
  const { default: chromeLauncher } = await import('chrome-launcher')
  const chrome = await chromeLauncher.launch({ chromeFlags: ['--headless=new'] })
  const lh = await lighthouse(`${baseUrl}/valuation`, {
    port: chrome.port,
    output: 'json',
    onlyCategories: ['performance', 'accessibility', 'seo'],
    formFactor: 'desktop',
    screenEmulation: { disabled: true },
  })
  await chrome.kill()
  lighthouseSummary = {
    performance: lh.lhr.categories.performance?.score,
    accessibility: lh.lhr.categories.accessibility?.score,
    seo: lh.lhr.categories.seo?.score,
  }
  writeFileSync(join(outDir, 'lighthouse.json'), JSON.stringify(lh.lhr, null, 2))
} catch (error) {
  lighthouseSummary = {
    skipped: true,
    reason: error?.message || String(error),
  }
}

await browser.close()

const summary = {
  outDir,
  searchWarmMs: results.searchWarmMs,
  matchCount: results.matchCount,
  calcOk: results.calcOk,
  flows: results.flows,
  screenshots: results.screenshots,
  lighthouse: lighthouseSummary,
  assumptions: [
    'Recently searched chips omitted (no prior client history feature).',
    'Product prose summary omitted when not present on search-index rows.',
    'Browse similar uses /browse?brand= when brand is known.',
  ],
}

writeFileSync(join(outDir, 'results.json'), JSON.stringify(summary, null, 2))
console.log(JSON.stringify(summary, null, 2))
console.log('PASS: valuation page redesign')
