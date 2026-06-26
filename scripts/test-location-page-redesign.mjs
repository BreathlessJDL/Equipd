#!/usr/bin/env node
import { chromium } from 'playwright-core'

const baseUrl = (process.argv[2] ?? 'http://localhost:5173').replace(/\/$/, '')
const browser = await chromium.launch({ headless: true, channel: 'msedge' })

async function inspectLocation(page, slug) {
  await page.goto(`${baseUrl}/listings/${slug}`, { waitUntil: 'networkidle', timeout: 45000 })
  return page.evaluate(() => ({
    hasMap: Boolean(document.querySelector('.listing-browse__map-placeholder')),
    hasHero: Boolean(document.querySelector('.location-page__hero')),
    hasAreaPills: document.querySelectorAll('.location-page__area-pill').length,
    areaLinks: [...document.querySelectorAll('.location-page__area-pill')].map((el) => ({
      text: el.textContent?.trim(),
      href: el.getAttribute('href'),
      current: el.getAttribute('aria-current'),
    })),
    hasTrustSidebar: Boolean(document.querySelector('.location-page__sidebar')),
    hasSellerSection: Boolean(document.querySelector('.location-page__seller')),
    hasEmptyCta: Boolean(document.querySelector('.location-page__empty-cta')),
    listingCards: document.querySelectorAll('.listing-card').length,
    sidebarOrder: [...document.querySelector('.location-page__layout')?.children ?? []].map(
      (el) => el.className,
    ),
  }))
}

const desktop = await browser.newPage({ viewport: { width: 1280, height: 900 } })
const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } })

const desktopLeeds = await inspectLocation(desktop, 'leeds')
const mobileLeeds = await inspectLocation(mobile, 'leeds')

await desktop.close()
await mobile.close()
await browser.close()

console.log(JSON.stringify({ desktopLeeds, mobileLeeds }, null, 2))

const ok = (state) =>
  !state.hasMap &&
  state.hasHero &&
  state.hasAreaPills >= 3 &&
  state.areaLinks?.length >= 3 &&
  state.areaLinks.every((link) => link.href) &&
  state.areaLinks.some((link) => link.href === '/listings/leeds' && link.current) &&
  state.areaLinks.some((link) => link.href === '/listings/leeds?area=Wakefield') &&
  !state.areaLinks.some((link) => link.href?.startsWith('/browse')) &&
  state.hasTrustSidebar &&
  state.hasSellerSection &&
  state.sidebarOrder[0]?.includes('location-page__main') &&
  state.sidebarOrder[1]?.includes('location-page__sidebar')

if (!ok(desktopLeeds) || !ok(mobileLeeds)) {
  console.error('FAIL: location page redesign checks')
  process.exitCode = 1
} else {
  console.log('PASS: location page redesign structure')
}
