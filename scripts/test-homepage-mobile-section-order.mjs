#!/usr/bin/env node
/**
 * Validate logged-out homepage section order:
 * mobile  → Hero → Recently Added → Equipment Valuator → …
 * desktop → Hero → Equipment Valuator → Recently Added → … (unchanged)
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
assert.match(
  css,
  /@media \(max-width:\s*767px\)[\s\S]*\.home-page:not\(\.home-page--feed\)[\s\S]*\.home-recent[\s\S]*order:\s*2/,
  'mobile CSS reorders Recently Added before valuator',
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
    const tops = [hero, recent, valuator, browse]
      .filter(Boolean)
      .map((el) => ({
        name: el.classList.contains('home-hero')
          ? 'hero'
          : el.classList.contains('home-recent')
            ? 'recent'
            : el.classList.contains('home-valuator')
              ? 'valuator'
              : 'browse',
        top: Math.round(el.getBoundingClientRect().top + window.scrollY),
      }))
      .sort((a, b) => a.top - b.top || a.name.localeCompare(b.name))

    return {
      order: tops.map((item) => item.name),
      tops,
      overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      hasFeedClass: document.querySelector('.home-page')?.classList.contains('home-page--feed') || false,
    }
  })
}

for (const viewport of [
  { name: 'mobile-390', width: 390, height: 844, expect: ['hero', 'recent', 'valuator', 'browse'] },
  { name: 'mobile-375', width: 375, height: 812, expect: ['hero', 'recent', 'valuator', 'browse'] },
  { name: 'desktop-1280', width: 1280, height: 900, expect: ['hero', 'valuator', 'recent', 'browse'] },
]) {
  const page = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height } })
  await page.goto(baseUrl, { waitUntil: 'networkidle', timeout: 90000 })
  await dismissCookies(page)
  await page.waitForSelector('.home-hero', { timeout: 45000 })
  await page.waitForSelector('.home-recent', { timeout: 45000 })
  await page.waitForSelector('.home-valuator', { timeout: 45000 })

  const metrics = await measureOrder(page)
  results[viewport.name] = metrics

  await page.screenshot({
    path: join(outDir, `${viewport.name}-top.png`),
    clip: { x: 0, y: 0, width: viewport.width, height: Math.min(viewport.height, 900) },
  })

  assert.equal(metrics.hasFeedClass, false, `${viewport.name}: logged-out home`)
  assert.equal(metrics.overflow, false, `${viewport.name}: no horizontal overflow`)
  assert.deepEqual(metrics.order, viewport.expect, `${viewport.name}: section order`)

  await page.close()
}

await browser.close()
writeFileSync(join(outDir, 'results.json'), JSON.stringify({ outDir, results }, null, 2))
console.log(JSON.stringify({ outDir, results }, null, 2))
console.log('PASS: homepage mobile section order')
