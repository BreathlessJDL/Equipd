#!/usr/bin/env node
/**
 * Validate valuation page UX polish iteration.
 *
 *   node scripts/test-valuation-page-ux-polish.mjs [baseUrl]
 */
import assert from 'node:assert/strict'
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { chromium } from 'playwright-core'

const baseUrl = (process.argv[2] ?? 'http://127.0.0.1:5173').replace(/\/$/, '')
const outDir = join(process.cwd(), 'reports', 'valuation-page-ux-polish')
mkdirSync(outDir, { recursive: true })

const pageCss = readFileSync('src/pages/ValuationPage.css', 'utf8')
const stepperCss = readFileSync('src/components/valuation/ValuationStepper.css', 'utf8')
const pageSource = readFileSync('src/pages/ValuationPage.jsx', 'utf8')

assert.match(stepperCss, /\.valuation-stepper\s*\{[^}]*width:\s*100%/s, 'stepper spans full content width')
assert.doesNotMatch(stepperCss, /width:\s*min\(100%,\s*34rem\)/, 'compact stepper width removed')
assert.match(pageCss, /--valuation-hand/, 'handwritten font token present')
assert.match(pageCss, /font-family:\s*var\(--valuation-hand\)/, 'eyebrow uses handwritten font')
assert.match(pageCss, /padding-bottom:\s*0\.85rem/, 'brand scroller has space above scrollbar')
assert.doesNotMatch(
  pageCss,
  /\.valuation-page__preview-meta\s*\{[^}]*border-top:/s,
  'preview meta divider removed',
)
assert.match(pageSource, /scrollIntoView/, 'mobile selection scrolls preview into view')
assert.match(pageSource, /previewHighlight|preview-sticky--highlight/, 'preview highlight after selection')
assert.match(pageSource, /calculateEquipmentProductValuation/, 'valuation calc preserved')
assert.match(pageSource, /resolveValuationSearchMatches/, 'search ranking preserved')

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

// Desktop
{
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } })
  await page.goto(`${baseUrl}/valuation`, { waitUntil: 'networkidle', timeout: 90000 })
  await dismissCookies(page)
  await waitReady(page)

  const stepperWidth = await page.evaluate(() => {
    const shell = document.querySelector('.valuation-page__shell')
    const stepper = document.querySelector('.valuation-stepper')
    return {
      shell: shell ? Math.round(shell.getBoundingClientRect().width) : 0,
      stepper: stepper ? Math.round(stepper.getBoundingClientRect().width) : 0,
    }
  })
  assert.ok(
    stepperWidth.stepper / stepperWidth.shell >= 0.92,
    `desktop stepper nearly full width (${stepperWidth.stepper}/${stepperWidth.shell})`,
  )

  const eyebrow = await page.evaluate(() => {
    const el = document.querySelector('.valuation-page__eyebrow')
    const cs = getComputedStyle(el)
    return { font: cs.fontFamily, text: el?.textContent?.trim() }
  })
  assert.match(eyebrow.font, /Caveat/i, 'desktop eyebrow uses Caveat')
  assert.match(eyebrow.text || '', /Instant equipment valuation/i)

  await page.screenshot({ path: join(outDir, 'desktop-step1.png') })
  summary.screenshots.desktopStep1 = join(outDir, 'desktop-step1.png')
  await page.fill('#valuation-product-search', 'Life Fitness E3')
  await page.waitForSelector('.valuation-page__result-row')
  await page.locator('.valuation-page__result-row').first().click()
  await page.waitForSelector('.valuation-page__preview-card--filled')
  await page.screenshot({ path: join(outDir, 'desktop-step1-selected.png') })
  summary.screenshots.desktopSelected = join(outDir, 'desktop-step1-selected.png')
  summary.checks.desktop = { stepperWidth, eyebrow }
  await page.close()
}

// Mobile selection flow
{
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
  await page.goto(`${baseUrl}/valuation`, { waitUntil: 'networkidle', timeout: 90000 })
  await dismissCookies(page)
  await waitReady(page)
  await page.screenshot({ path: join(outDir, 'mobile-step1.png') })
  summary.screenshots.mobileStep1 = join(outDir, 'mobile-step1.png')

  await page.fill('#valuation-product-search', 'Life Fitness')
  await page.waitForSelector('.valuation-page__result-row')
  const rowCount = await page.locator('.valuation-page__result-row').count()
  assert.ok(rowCount > 1, 'mobile has multiple results before selection')
  const beforeScroll = await page.evaluate(() => window.scrollY)
  await page.locator('.valuation-page__result-row').first().click()
  await page.waitForSelector('.valuation-page__preview-card--filled')
  await page.waitForTimeout(900)

  const after = await page.evaluate(() => {
    const preview = document.querySelector('#valuation-selected-preview')
    const rect = preview?.getBoundingClientRect()
    const continueBtn = document.querySelector('.valuation-page__continue')
    const continueRect = continueBtn?.getBoundingClientRect()
    const hiddenRows = [...document.querySelectorAll('.valuation-page__result-row:not(.valuation-page__result-row--selected)')]
      .filter((el) => getComputedStyle(el).display === 'none').length
    const totalOtherRows = document.querySelectorAll('.valuation-page__result-row:not(.valuation-page__result-row--selected)').length
    return {
      scrollY: window.scrollY,
      previewTop: rect ? Math.round(rect.top) : null,
      previewInView: rect ? rect.top < window.innerHeight && rect.bottom > 0 : false,
      continueInView: continueRect
        ? continueRect.top < window.innerHeight && continueRect.bottom > 0
        : false,
      hiddenRows,
      totalOtherRows,
      workspaceSelected: document.querySelector('.valuation-page__workspace--selected') != null,
    }
  })

  assert.ok(after.scrollY >= beforeScroll || after.previewInView, 'mobile scrolled toward preview')
  assert.equal(after.previewInView, true, 'mobile preview visible after selection')
  assert.equal(after.continueInView, true, 'Continue CTA visible after selection')
  assert.equal(after.workspaceSelected, true, 'selected workspace state applied')
  assert.ok(after.totalOtherRows > 0, 'other results still in DOM')
  assert.equal(after.hiddenRows, after.totalOtherRows, 'non-selected results collapsed on mobile')

  await page.screenshot({ path: join(outDir, 'mobile-step1-selected.png') })
  summary.screenshots.mobileSelected = join(outDir, 'mobile-step1-selected.png')
  summary.checks.mobile = { beforeScroll, after, rowCount }
  await page.close()
}

await browser.close()
writeFileSync(join(outDir, 'results.json'), JSON.stringify(summary, null, 2))
console.log(JSON.stringify(summary, null, 2))
console.log('PASS: valuation page UX polish')
