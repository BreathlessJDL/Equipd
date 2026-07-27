#!/usr/bin/env node
/**
 * Validate compact mobile homepage valuator (Option 3).
 *
 *   node scripts/test-home-valuator-compact-mobile.mjs [baseUrl]
 */
import assert from 'node:assert/strict'
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { chromium } from 'playwright-core'

const baseUrl = (process.argv[2] ?? 'http://127.0.0.1:5173').replace(/\/$/, '')
const outDir = join(process.cwd(), 'reports', 'home-valuator-compact')
mkdirSync(outDir, { recursive: true })

const css = readFileSync('src/components/home/HomeEquipmentValuator.css', 'utf8')
assert.match(css, /\.home-valuator--compact-mobile/, 'compact modifier present')
assert.match(
  css,
  /@media \(max-width:\s*767px\)[\s\S]*\.home-valuator--compact-mobile[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\)\s+auto/,
  'compact search is one row',
)

const browser = await chromium.launch({ headless: true, channel: 'msedge' })
const results = {}

async function dismissCookies(page) {
  const accept = page.getByRole('button', { name: /Accept all|Accept necessary/i }).first()
  if (await accept.count()) await accept.click({ timeout: 2500 }).catch(() => {})
}

for (const viewport of [
  { name: 'mobile-320', width: 320, height: 720 },
  { name: 'mobile-375', width: 375, height: 812 },
  { name: 'mobile-390', width: 390, height: 844 },
  { name: 'desktop-1280', width: 1280, height: 900 },
]) {
  const page = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height } })
  await page.goto(baseUrl, { waitUntil: 'networkidle', timeout: 90000 })
  await dismissCookies(page)
  await page.waitForSelector('.home-valuator', { timeout: 45000 })

  const metrics = await page.evaluate(() => {
    const root = document.querySelector('.home-valuator')
    const card = document.querySelector('.home-valuator__card')
    const title = document.querySelector('.home-valuator__title')
    const lede = document.querySelector('.home-valuator__lede')
    const eyebrow = document.querySelector('.home-valuator__eyebrow')
    const submit = document.querySelector('.home-valuator__submit')
    const search = document.querySelector('.home-valuator__search')
    const field = document.querySelector('.home-valuator__search-field')
    const visual = document.querySelector('.home-valuator__visual')
    const headingIcon = document.querySelector('.home-valuator__heading-icon')
    const cs = (el) => (el ? getComputedStyle(el) : null)
    return {
      overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      cardHeight: card ? Math.round(card.getBoundingClientRect().height) : null,
      title: title?.textContent?.replace(/\s+/g, ' ').trim() || '',
      lede: lede?.textContent?.replace(/\s+/g, ' ').trim() || '',
      eyebrowDisplay: cs(eyebrow)?.display || null,
      ledeDisplay: cs(lede)?.display || null,
      headingIconDisplay: cs(headingIcon)?.display || null,
      visualDisplay: cs(visual)?.display || null,
      searchDisplay: cs(search)?.display || null,
      searchColumns: cs(search)?.gridTemplateColumns || null,
      fieldWidth: field ? Math.round(field.getBoundingClientRect().width) : null,
      submitWidth: submit ? Math.round(submit.getBoundingClientRect().width) : null,
      searchWidth: search ? Math.round(search.getBoundingClientRect().width) : null,
      submitLabelDesktop: cs(document.querySelector('.home-valuator__submit-label--desktop'))?.display || null,
      submitLabelMobile: cs(document.querySelector('.home-valuator__submit-label--mobile'))?.display || null,
      hasCompactClass: root?.classList.contains('home-valuator--compact-mobile') || false,
      visibleTitle:
        document.querySelector('.home-valuator__title-text--mobile')?.textContent?.trim() ||
        title?.textContent?.trim() ||
        '',
      desktopTitle:
        document.querySelector('.home-valuator__title-text--desktop')?.textContent?.trim() || '',
      placeholderFontSize: (() => {
        const input = document.querySelector('.home-valuator__input')
        if (!input) return null
        // Probe computed placeholder size via a temporary clone when supported.
        return getComputedStyle(input, '::placeholder').fontSize || getComputedStyle(input).fontSize
      })(),
      inputFontSize: cs(document.querySelector('.home-valuator__input'))?.fontSize || null,
      inputHeight: document.querySelector('.home-valuator__input')
        ? Math.round(document.querySelector('.home-valuator__input').getBoundingClientRect().height)
        : null,
    }
  })

  await page.locator('.home-valuator').screenshot({
    path: join(outDir, `${viewport.name}.png`),
  })

  results[viewport.name] = metrics

  if (viewport.width <= 767) {
    assert.equal(metrics.hasCompactClass, true, `${viewport.name}: compact class`)
    assert.equal(metrics.overflow, false, `${viewport.name}: no overflow`)
    assert.equal(metrics.visibleTitle, 'Value your equipment', `${viewport.name}: compact title`)
    assert.equal(metrics.ledeDisplay, 'none', `${viewport.name}: subtitle removed`)
    assert.equal(metrics.eyebrowDisplay, 'none', `${viewport.name}: eyebrow hidden`)
    assert.notEqual(metrics.headingIconDisplay, 'none', `${viewport.name}: heading icon visible`)
    assert.equal(metrics.visualDisplay, 'none', `${viewport.name}: showcase hidden`)
    assert.ok(metrics.cardHeight <= 150, `${viewport.name}: card height ${metrics.cardHeight}`)
    assert.ok(metrics.fieldWidth > metrics.submitWidth, `${viewport.name}: input wider than CTA`)
    assert.ok(
      metrics.fieldWidth / metrics.searchWidth >= 0.7,
      `${viewport.name}: input ~75%+ of row`,
    )
    assert.ok(
      Number.parseFloat(metrics.placeholderFontSize) <= 14.5,
      `${viewport.name}: placeholder ~14px or smaller (got ${metrics.placeholderFontSize})`,
    )
    assert.ok(
      Number.parseFloat(metrics.inputFontSize) >= 15.5,
      `${viewport.name}: entered text stays ~16px (got ${metrics.inputFontSize})`,
    )
    assert.equal(metrics.submitLabelDesktop, 'none', `${viewport.name}: desktop CTA label hidden`)
    assert.match(metrics.submitLabelMobile, /flex/, `${viewport.name}: mobile arrow CTA`)
  } else {
    assert.equal(metrics.overflow, false, `${viewport.name}: no overflow`)
    assert.equal(
      metrics.desktopTitle,
      'Find the value of your gym equipment',
      `${viewport.name}: desktop title`,
    )
    assert.notEqual(metrics.eyebrowDisplay, 'none', `${viewport.name}: desktop eyebrow visible`)
    assert.equal(metrics.headingIconDisplay, 'none', `${viewport.name}: heading icon hidden on desktop`)
    assert.notEqual(metrics.visualDisplay, 'none', `${viewport.name}: showcase visible on desktop`)
    assert.notEqual(metrics.submitLabelDesktop, 'none', `${viewport.name}: desktop CTA text`)
    assert.equal(metrics.submitLabelMobile, 'none', `${viewport.name}: mobile arrow hidden on desktop`)
  }

  await page.close()
}

await browser.close()
writeFileSync(join(outDir, 'results.json'), JSON.stringify({ baseUrl, results }, null, 2))
console.log(JSON.stringify({ outDir, results }, null, 2))
console.log('PASS: home valuator compact mobile')
