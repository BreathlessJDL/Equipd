#!/usr/bin/env node
/**
 * Validate valuation page polish: stepper, reset, console, no calc/index changes.
 *
 *   node scripts/test-valuation-page-polish.mjs [baseUrl]
 */
import assert from 'node:assert/strict'
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { chromium } from 'playwright-core'

const baseUrl = (process.argv[2] ?? 'http://127.0.0.1:5173').replace(/\/$/, '')
const outDir = join(process.cwd(), 'reports', 'valuation-page-polish')
mkdirSync(outDir, { recursive: true })

const pageSource = readFileSync('src/pages/ValuationPage.jsx', 'utf8')
const stepperCss = readFileSync('src/components/valuation/ValuationStepper.css', 'utf8')
const pageCss = readFileSync('src/pages/ValuationPage.css', 'utf8')

assert.match(pageSource, /calculateEquipmentProductValuation/, 'valuation calc unchanged')
assert.match(pageSource, /getValuationSearchIndex/, 'search index unchanged')
assert.match(pageSource, /setSearchParams\(\{\},\s*\{\s*replace:\s*true\s*\}\)/, 'start over clears URL params')
assert.match(pageSource, /setProductConsoleOptions\(\[\]\)/, 'start over clears console options')
assert.match(pageSource, /EquipmentValuationDetailsFields/, 'details fields (incl. console) preserved')
assert.match(stepperCss, /valuation-stepper__track/, 'stepper uses track/connectors')
assert.match(pageCss, /valuation-page__hero-watermark/, 'hero watermark present')
assert.match(pageCss, /valuation-page__rrp-badge/, 'premium RRP badge present')
assert.match(pageCss, /\.valuation-page__brand-logo[\s\S]*height:\s*2\.05rem/, 'brand logos enlarged')

const browser = await chromium.launch({ headless: true, channel: 'msedge' })
const summary = { outDir, screenshots: {}, checks: {} }

async function dismissCookies(page) {
  const accept = page.getByRole('button', { name: /Accept all|Accept necessary/i }).first()
  if (await accept.count()) await accept.click({ timeout: 2500 }).catch(() => {})
}

async function waitReady(page) {
  await page.waitForSelector('#valuation-product-search', { timeout: 45000 })
  await page.waitForFunction(() => {
    const status = document.querySelector('.valuation-page__status')
    return !status || !/Loading catalogue/i.test(status.textContent || '')
  }, { timeout: 45000 })
}

for (const viewport of [
  { name: 'desktop', width: 1440, height: 1100 },
  { name: 'mobile', width: 390, height: 900 },
]) {
  const page = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height } })
  await page.goto(`${baseUrl}/valuation`, { waitUntil: 'networkidle', timeout: 90000 })
  await dismissCookies(page)
  await waitReady(page)

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  )
  assert.equal(overflow, false, `${viewport.name}: no overflow`)

  const stepperMetrics = await page.evaluate(() => {
    const steps = [...document.querySelectorAll('.valuation-stepper__step')]
    const markers = steps.map((step) => step.querySelector('.valuation-stepper__marker')?.getBoundingClientRect())
    const labels = steps.map((step) => step.querySelector('.valuation-stepper__label')?.getBoundingClientRect())
    const connectors = [...document.querySelectorAll('.valuation-stepper__connector')]
      .map((el) => el.getBoundingClientRect())
    const markerCentersY = markers.map((r) => (r.top + r.bottom) / 2)
    const ySpread = Math.max(...markerCentersY) - Math.min(...markerCentersY)
    const labelBelow = labels.every((label, i) => label.top >= markers[i].bottom - 1)
    const connectorThroughLabel = connectors.some((c) => labels.some((l) => (
      c.top < l.bottom && c.bottom > l.top && c.left < l.right && c.right > l.left
    )))
    return { ySpread, labelBelow, connectorThroughLabel, connectorCount: connectors.length }
  })
  assert.ok(stepperMetrics.ySpread < 2, `${viewport.name}: markers aligned (${stepperMetrics.ySpread})`)
  assert.equal(stepperMetrics.labelBelow, true, `${viewport.name}: labels below markers`)
  assert.equal(stepperMetrics.connectorThroughLabel, false, `${viewport.name}: connectors miss labels`)

  await page.screenshot({ path: join(outDir, `step1-${viewport.width}.png`) })

  await page.fill('#valuation-product-search', 'Life Fitness E3')
  await page.waitForSelector('.valuation-page__result-row', { timeout: 15000 })
  await page.locator('.valuation-page__result-row').first().click()
  await page.waitForSelector('.valuation-page__preview-card--filled', { timeout: 5000 })
  // Allow console options to prefetch for the selected product before advancing.
  await page.waitForTimeout(900)
  await page.getByRole('button', { name: /Continue to details/i }).click()
  await page.waitForSelector('.valuation-page__panel--details', { timeout: 15000 })
  await page.waitForSelector('.valuation-page__field--console, #valuation-console', { timeout: 15000 })
  const hasConsole = await page.locator('.valuation-page__field--console, #valuation-console').count()
  assert.ok(hasConsole > 0, `${viewport.name}: console section restored for E3`)

  const logoHeight = await page.evaluate(() => {
    // Go back visually check brand logos on step1 — capture from current DOM if present later.
    return null
  })
  void logoHeight

  await page.screenshot({ path: join(outDir, `step2-${viewport.width}.png`) })

  const yearSelect = page.locator('#valuation-actual-year')
  if (await yearSelect.count()) {
    const options = await yearSelect.locator('option').allTextContents()
    const usable = options.map((o) => o.trim()).filter((o) => /^\d{4}/.test(o))
    if (usable.length) await yearSelect.selectOption({ label: usable[0] })
  }
  await page.getByRole('button', { name: /Calculate valuation|Continue/i }).click()
  await page.waitForSelector('.valuation-page__panel--results', { timeout: 15000 })
  await page.screenshot({ path: join(outDir, `step3-${viewport.width}.png`) })

  await page.getByRole('button', { name: /Start another valuation/i }).click()
  await waitReady(page)
  await page.waitForTimeout(300)

  const resetState = await page.evaluate(() => {
    const input = document.querySelector('#valuation-product-search')
    return {
      step: document.querySelector('.valuation-stepper__step--current .valuation-stepper__label')?.textContent?.trim(),
      query: input?.value || '',
      emptyPreview: Boolean(document.querySelector('.valuation-page__preview-card--empty')),
      selectedRows: document.querySelectorAll('.valuation-page__result-row--selected').length,
      url: window.location.pathname + window.location.search,
      hasEstimate: document.querySelectorAll('.valuation-page__range-card--mid').length,
      hasDetails: document.querySelectorAll('.valuation-page__panel--details').length,
    }
  })

  assert.equal(resetState.step, 'Product', `${viewport.name}: reset to product step`)
  assert.equal(resetState.query, '', `${viewport.name}: search cleared`)
  assert.equal(resetState.emptyPreview, true, `${viewport.name}: empty preview restored`)
  assert.equal(resetState.selectedRows, 0, `${viewport.name}: no selected result`)
  assert.equal(resetState.url, '/valuation', `${viewport.name}: clean url`)
  assert.equal(resetState.hasEstimate, 0, `${viewport.name}: estimate cleared`)
  assert.equal(resetState.hasDetails, 0, `${viewport.name}: details cleared`)

  await page.screenshot({ path: join(outDir, `reset-${viewport.width}.png`) })

  // Brand logo size on fresh step 1
  const brandLogoH = await page.evaluate(() => {
    const logo = document.querySelector('.valuation-page__brand-logo')
    return logo ? Math.round(logo.getBoundingClientRect().height) : 0
  })
  assert.ok(brandLogoH >= 26, `${viewport.name}: brand logo height ${brandLogoH}px`)

  summary.checks[viewport.name] = { stepperMetrics, resetState, brandLogoH, hasConsole }
  summary.screenshots[viewport.name] = {
    step1: join(outDir, `step1-${viewport.width}.png`),
    step2: join(outDir, `step2-${viewport.width}.png`),
    step3: join(outDir, `step3-${viewport.width}.png`),
    reset: join(outDir, `reset-${viewport.width}.png`),
  }

  await page.close()
}

await browser.close()
writeFileSync(join(outDir, 'results.json'), JSON.stringify(summary, null, 2))
console.log(JSON.stringify(summary, null, 2))
console.log('PASS: valuation page polish')
