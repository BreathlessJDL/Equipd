#!/usr/bin/env node
/**
 * Validate logged-out homepage section order:
 * mobile  → Hero → Recently Added → Browse → …
 * desktop → Hero → Recently Added → Browse → … (document order)
 *
 *   node scripts/test-homepage-mobile-section-order.mjs [baseUrl]
 */
import assert from 'node:assert/strict'
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { chromium } from 'playwright-core'

const baseUrl = (process.argv[2] ?? 'http://127.0.0.1:5173').replace(/\/$/, '')
const outDir = join(process.cwd(), 'reports', 'home-mobile-section-order')
mkdirSync(outDir, { recursive: true })

const css = readFileSync('src/components/home/HomePage.css', 'utf8')
const homepageSource = readFileSync('src/pages/HomePage.jsx', 'utf8')
assert.match(
  css,
  /@media \(max-width:\s*767px\)[\s\S]*\.home-page:not\(\.home-page--feed\)[\s\S]*\.home-recent[\s\S]*order:\s*2/,
  'mobile CSS keeps Recently Added after the hero',
)
assert.match(
  homepageSource,
  /Buy used commercial and home gym equipment from sellers across the UK/,
  'browse lead remains in homepage markup for SEO',
)
assert.match(
  css,
  /\.home-browse__lead\s*\{[^}]*display:\s*none/,
  'CSS hides the browse lead paragraph visually',
)

const browser = await chromium.launch({ headless: true, channel: 'msedge' })
const results = {}

async function dismissCookies(page) {
  const accept = page.getByRole('button', { name: /Accept all|Accept necessary/i }).first()
  if (await accept.count()) await accept.click({ timeout: 2500 }).catch(() => {})
}

async function measureOrder(page) {
  return page.evaluate(() => {
    const hero = document.querySelector('.home-hero')
    const recent = document.querySelector('.home-recent')
    const valuator = document.querySelector('.home-valuator')
    const browse = document.querySelector('.home-browse')
    const lead = document.querySelector('.home-browse__lead')
    const title = document.querySelector('.home-browse__title')
    const filters = document.querySelector('.home-browse .listing-browse__filters')
    const titleRect = title?.getBoundingClientRect()
    const filtersRect = filters?.getBoundingClientRect()
    const tops = [hero, recent, browse]
      .filter(Boolean)
      .map((el) => ({
        name: el.classList.contains('home-hero')
          ? 'hero'
          : el.classList.contains('home-recent')
            ? 'recent'
            : 'browse',
        top: Math.round(el.getBoundingClientRect().top + window.scrollY),
      }))
      .sort((a, b) => a.top - b.top || a.name.localeCompare(b.name))

    return {
      order: tops.map((item) => item.name),
      tops,
      hasValuator: Boolean(valuator),
      overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      hasFeedClass: document.querySelector('.home-page')?.classList.contains('home-page--feed') || false,
      leadInDom: Boolean(lead),
      leadDisplay: lead ? getComputedStyle(lead).display : null,
      titleToFiltersGap:
        titleRect && filtersRect
          ? Math.round(filtersRect.top - titleRect.bottom)
          : null,
    }
  })
}

for (const viewport of [
  { name: 'mobile-390', width: 390, height: 844, expect: ['hero', 'recent', 'browse'] },
  { name: 'mobile-375', width: 375, height: 812, expect: ['hero', 'recent', 'browse'] },
  { name: 'desktop-1280', width: 1280, height: 900, expect: ['hero', 'recent', 'browse'] },
]) {
  const page = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height } })
  await page.goto(baseUrl, { waitUntil: 'networkidle', timeout: 90000 })
  await dismissCookies(page)
  await page.waitForSelector('.home-hero', { timeout: 45000 })
  await page.waitForSelector('.home-recent', { timeout: 45000 })
  await page.waitForSelector('.home-browse', { timeout: 45000 })

  const metrics = await measureOrder(page)
  results[viewport.name] = metrics

  await page.screenshot({
    path: join(outDir, `${viewport.name}-top.png`),
    clip: { x: 0, y: 0, width: viewport.width, height: Math.min(viewport.height, 900) },
  })

  assert.equal(metrics.hasFeedClass, false, `${viewport.name}: logged-out home`)
  assert.equal(metrics.hasValuator, false, `${viewport.name}: standalone valuator is gone`)
  assert.equal(metrics.overflow, false, `${viewport.name}: no horizontal overflow`)
  assert.deepEqual(metrics.order, viewport.expect, `${viewport.name}: section order`)
  assert.equal(metrics.leadInDom, true, `${viewport.name}: browse lead stays in the DOM`)
  assert.equal(metrics.leadDisplay, 'none', `${viewport.name}: browse lead is hidden`)
  assert.ok(
    metrics.titleToFiltersGap >= 8 && metrics.titleToFiltersGap <= 32,
    `${viewport.name}: filters sit close under the heading (gap ${metrics.titleToFiltersGap}px)`,
  )

  await page.close()
}

await browser.close()
writeFileSync(join(outDir, 'results.json'), JSON.stringify({ outDir, results }, null, 2))
console.log(JSON.stringify({ outDir, results }, null, 2))
console.log('PASS: homepage mobile section order')
