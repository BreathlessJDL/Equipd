#!/usr/bin/env node
/**
 * Spot-check all location hubs for shared architecture + dynamic values.
 *
 *   node scripts/test-all-location-hubs.mjs http://127.0.0.1:5173
 */
import { chromium } from 'playwright-core'
import { LOCATION_PAGES, LOCATION_SLUGS } from '../src/lib/locations.js'

const baseUrl = (process.argv[2] ?? 'http://127.0.0.1:5173').replace(/\/$/, '')
const browser = await chromium.launch({ headless: true, channel: 'msedge' })
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
const results = []

for (const slug of LOCATION_SLUGS) {
  const region = LOCATION_PAGES[slug]
  await page.goto(`${baseUrl}/listings/${slug}`, { waitUntil: 'networkidle', timeout: 60000 })
  const state = await page.evaluate((expectedName) => {
    const badge = document.querySelector('.location-page__count-badge')?.textContent?.trim() || ''
    const previewCount =
      document.querySelector('.location-page__preview-card-count')?.textContent?.trim() || ''
    const gridTitle = document.querySelector('.location-page__results-title')?.textContent?.trim() || ''
    const previewCountValue = Number((previewCount.match(/(\d+)\s+listings?/) || [])[1] || 0)
    const gridCount = Number((gridTitle.match(/(\d+)\s+listings?/) || [])[1] || 0)
    return {
      h1: document.getElementById('location-page-title')?.textContent?.trim() || '',
      previewCity: document.querySelector('.location-page__preview-card-city')?.textContent?.trim() || '',
      previewAriaHidden:
        document.querySelector('.location-page__preview')?.getAttribute('aria-hidden') === 'true',
      legacyPreview: Boolean(
        document.querySelector(
          '.location-page__preview-browser, .location-page__preview-chip, .location-page__preview-equipment',
        ),
      ),
      pinOnly: document.querySelectorAll('.location-page__preview-pin').length === 1,
      primaryCta: document.querySelector('.location-page__btn--primary')?.textContent?.trim() || '',
      secondaryHref: document.querySelector('.location-page__btn--secondary')?.getAttribute('href') || '',
      badge,
      previewCount,
      gridTitle,
      previewCountValue,
      gridCount,
      cards: document.querySelectorAll('.listing-card').length,
      canonical: document.querySelector('link[rel="canonical"]')?.getAttribute('href') || '',
      description: document.querySelector('meta[name="description"]')?.getAttribute('content') || '',
      overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      expectedName,
    }
  }, region.name)

  const expectedTitle =
    state.gridCount === 1
      ? `1 listing in and around ${region.name}`
      : state.gridCount === 0
        ? ''
        : `${state.gridCount} listings in and around ${region.name}`

  const ok =
    state.h1 === `Used gym equipment in ${region.name}` &&
    state.previewCity === region.name &&
    state.previewAriaHidden &&
    !state.legacyPreview &&
    state.pinOnly &&
    state.primaryCta === `Browse ${region.name} listings` &&
    state.secondaryHref === '/valuation' &&
    state.canonical.includes(`/listings/${slug}`) &&
    state.description.includes('40 miles') &&
    !state.overflow &&
    !state.badge &&
    state.previewCountValue === state.gridCount &&
    state.cards === state.gridCount &&
    state.gridTitle === expectedTitle

  results.push({ slug, ok, ...state })
  if (!ok) console.error('FAIL', slug, state)
}

await browser.close()
console.log(JSON.stringify({ baseUrl, results }, null, 2))
if (results.some((row) => !row.ok)) {
  process.exitCode = 1
} else {
  console.log('PASS: all location hubs')
}
