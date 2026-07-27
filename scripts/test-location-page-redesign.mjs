#!/usr/bin/env node
import { chromium } from 'playwright-core'

const baseUrl = (process.argv[2] ?? 'http://localhost:5173').replace(/\/$/, '')
const browser = await chromium.launch({ headless: true, channel: 'msedge' })

async function inspectLocation(page, slug) {
  await page.goto(`${baseUrl}/listings/${slug}`, { waitUntil: 'networkidle', timeout: 45000 })
  return page.evaluate(() => {
    const hero = document.querySelector('.location-page__hero')
    const nearby = document.querySelector('.location-page__nearby')
    const layout = document.querySelector('.location-page__layout')
    const main = document.querySelector('.location-page__main')
    const sidebar = document.querySelector('.location-page__sidebar')
    const preview = document.querySelector('.location-page__preview')
    const badge = document.querySelector('.location-page__mobile-badge')
    const previewStyle = preview ? getComputedStyle(preview) : null
    const badgeStyle = badge ? getComputedStyle(badge) : null
    const heroBottom = hero ? hero.getBoundingClientRect().bottom : 0
    const listingsTop = main ? main.getBoundingClientRect().top : 0
    return {
      hasMap: Boolean(document.querySelector('.listing-browse__map-placeholder')),
      hasHero: Boolean(hero),
      heroHasListingCards: Boolean(hero?.querySelector('.listing-card')),
      heroHasNearbyPills: Boolean(hero?.querySelector('.location-page__nearby-pill, .location-page__area-pill')),
      heroHasPreview: Boolean(preview),
      previewVisible: Boolean(preview && previewStyle?.display !== 'none'),
      previewCity: document.querySelector('.location-page__preview-card-city')?.textContent?.trim() ?? null,
      previewHasPrices: /£/.test(document.querySelector('.location-page__preview')?.textContent || ''),
      previewHasEquipmentIcons: Boolean(
        document.querySelector(
          '.location-page__preview-equipment, .location-page__preview-browser, .location-page__preview-chip',
        ),
      ),
      previewPinCount: document.querySelectorAll('.location-page__preview-pin, .location-page__preview-art .location-page__preview-pin').length,
      previewAriaHidden:
        document.querySelector('.location-page__preview')?.getAttribute('aria-hidden') === 'true',
      eyebrow: document.querySelector('.location-page__eyebrow')?.textContent?.trim() ?? null,
      heroIntro: document.querySelector('.location-page__lead')?.textContent?.trim() ?? null,
      h1: document.getElementById('location-page-title')?.textContent?.trim() ?? null,
      h1Count: document.querySelectorAll('h1').length,
      mobileBadge: badge?.textContent?.replace(/\s+/g, ' ').trim() ?? null,
      mobileBadgeVisible: Boolean(badge && badgeStyle?.display !== 'none'),
      previewCount: document.querySelector('.location-page__preview-card-count')?.textContent?.trim() ?? null,
      resultsTitle: document.querySelector('.location-page__results-title')?.textContent?.trim() ?? null,
      primaryCta: document.querySelector('.location-page__btn--primary')?.textContent?.trim() ?? null,
      secondaryCtaHref: document.querySelector('.location-page__btn--secondary')?.getAttribute('href') ?? null,
      hasNearbySection: Boolean(nearby),
      nearbyLinks: [...document.querySelectorAll('.location-page__nearby-pill')].map((el) => ({
        text: el.textContent?.trim(),
        href: el.getAttribute('href'),
      })),
      hasTrustSidebar: Boolean(sidebar),
      guideItems: document.querySelectorAll('.location-page__guide-item').length,
      hasSellerSection: Boolean(document.querySelector('.location-page__seller')),
      listingCards: document.querySelectorAll('.listing-card').length,
      listingsId: main?.id ?? null,
      heroHeight: hero ? Math.round(hero.getBoundingClientRect().height) : 0,
      heroListingsGap: Math.round(listingsTop - heroBottom),
      sidebarOrder: [...(layout?.children ?? [])].map((el) => el.className),
      title: document.title,
      canonical: document.querySelector('link[rel="canonical"]')?.getAttribute('href') ?? null,
      description: document.querySelector('meta[name="description"]')?.getAttribute('content') ?? null,
      robots: document.querySelector('meta[name="robots"]')?.getAttribute('content') ?? null,
      overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    }
  })
}

const desktop = await browser.newPage({ viewport: { width: 1440, height: 900 } })
const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } })

const desktopLeeds = await inspectLocation(desktop, 'leeds')
const mobileLeeds = await inspectLocation(mobile, 'leeds')

await desktop.close()
await mobile.close()
await browser.close()

console.log(JSON.stringify({ desktopLeeds, mobileLeeds }, null, 2))

const sharedOk = (state) =>
  !state.hasMap &&
  state.hasHero &&
  !state.heroHasListingCards &&
  !state.heroHasNearbyPills &&
  state.heroHasPreview &&
  state.previewCity === 'Leeds' &&
  !state.previewHasPrices &&
  !state.previewHasEquipmentIcons &&
  state.previewPinCount === 1 &&
  state.previewAriaHidden === true &&
  state.eyebrow === 'Gym equipment near you' &&
  Boolean(state.heroIntro?.includes('West Yorkshire') || state.heroIntro?.includes('40 miles')) &&
  state.h1 === 'Used gym equipment in Leeds' &&
  state.h1Count === 1 &&
  Boolean(state.previewCount?.includes('listing')) &&
  Boolean(state.resultsTitle?.includes('in and around Leeds')) &&
  state.primaryCta === 'Browse Leeds listings' &&
  state.secondaryCtaHref === '/valuation' &&
  state.hasNearbySection &&
  state.nearbyLinks.length >= 3 &&
  state.nearbyLinks.every((link) => link.href) &&
  state.nearbyLinks.some((link) => link.href === '/listings/leeds?area=Wakefield') &&
  !state.nearbyLinks.some((link) => link.href?.startsWith('/browse')) &&
  state.hasTrustSidebar &&
  state.guideItems === 3 &&
  state.hasSellerSection &&
  state.listingsId === 'location-listings' &&
  state.heroListingsGap < 120 &&
  state.sidebarOrder[0]?.includes('location-page__main') &&
  state.sidebarOrder[1]?.includes('location-page__sidebar') &&
  state.title.includes('Leeds') &&
  state.canonical?.includes('/listings/leeds') &&
  Boolean(state.description?.includes('40 miles')) &&
  state.robots?.includes('index') &&
  !state.overflow

const desktopOk =
  sharedOk(desktopLeeds) &&
  desktopLeeds.previewVisible === true &&
  desktopLeeds.mobileBadgeVisible === false

const mobileOk =
  sharedOk(mobileLeeds) &&
  mobileLeeds.previewVisible === false &&
  mobileLeeds.mobileBadgeVisible === true &&
  Boolean(mobileLeeds.mobileBadge?.includes('Leeds')) &&
  Boolean(mobileLeeds.mobileBadge?.includes('listing')) &&
  mobileLeeds.heroHeight < 520

if (!desktopOk || !mobileOk) {
  console.error('FAIL: location page redesign checks', { desktopOk, mobileOk })
  process.exitCode = 1
} else {
  console.log('PASS: location page redesign structure')
}
