#!/usr/bin/env node
import { chromium } from 'playwright-core'

const baseUrl = process.argv[2] ?? 'http://localhost:5173'
const PAGE_SIZE = 24
const browser = await chromium.launch({ headless: true, channel: 'msedge' })
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })

await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle', timeout: 45000 })

async function recentSectionState() {
  return page.evaluate(() => {
    const section = document.querySelector('.home-recent')
    if (!section) return { exists: false }

    const cards = section.querySelectorAll('.listing-card:not(.listing-card-skeleton)')
    const placeholders = section.querySelectorAll(
      '.listing-card:not(.listing-card-skeleton) .listing-card__image--placeholder',
    )
    const imgs = section.querySelectorAll('img.listing-card__image')
    const button = section.querySelector('.listing-browse__load-more-button')

    return {
      exists: true,
      cards: cards.length,
      placeholders: placeholders.length,
      imgs: imgs.length,
      hasButton: Boolean(button),
      buttonText: button?.textContent?.trim() ?? null,
    }
  })
}

async function browseSectionState() {
  return page.evaluate(() => {
    const section = document.querySelector('.home-browse')
    if (!section) return { exists: false }

    const cards = section.querySelectorAll('.listing-card')
    const placeholders = section.querySelectorAll('.listing-card__image--placeholder')
    const imgs = section.querySelectorAll('img.listing-card__image')
    const button = section.querySelector('.listing-browse__load-more-button')

    return {
      exists: true,
      cards: cards.length,
      placeholders: placeholders.length,
      imgs: imgs.length,
      hasButton: Boolean(button),
      buttonText: button?.textContent?.trim() ?? null,
    }
  })
}

async function categoryScrollState() {
  return page.evaluate(() => {
    const header = document.querySelector('.global-site-header')
    const browseFilters = document.getElementById('browse-filters-anchor')
    const headerBottom = header ? Math.round(header.getBoundingClientRect().bottom) : 0
    const filtersTop = browseFilters ? Math.round(browseFilters.getBoundingClientRect().top) : null
    return {
      filtersTop,
      headerBottom,
      scrollY: Math.round(window.scrollY),
    }
  })
}

await page.waitForSelector('.home-recent .listing-card:not(.listing-card-skeleton)', { timeout: 15000 })

const recent1 = await recentSectionState()

// The browse grid loads as it approaches the viewport, so scroll to it first.
await page.evaluate(() => {
  document.querySelector('.home-browse')?.scrollIntoView({ block: 'start' })
})
await page.waitForSelector('.home-browse .listing-card', { timeout: 15000 })

const browse1 = await browseSectionState()

// The catalogue grows over time, so wait for the grid to settle after each
// click rather than for a fixed total.
async function loadNextBrowsePage(previousCount) {
  await page.click('.home-browse .listing-browse__load-more-button')
  await page.waitForFunction(
    (count) => {
      const section = document.querySelector('.home-browse')
      if (!section) return false
      const grew = section.querySelectorAll('.listing-card').length > count
      const exhausted = !section.querySelector('.listing-browse__load-more-button')
      return grew || exhausted
    },
    previousCount,
    { timeout: 15000 },
  )
}

if (browse1.hasButton) await loadNextBrowsePage(browse1.cards)

const browse2 = await browseSectionState()

if (browse2.hasButton) await loadNextBrowsePage(browse2.cards)

const browse3 = await browseSectionState()

await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle', timeout: 45000 })
await page.waitForSelector('.category-text-nav__link', { timeout: 15000 })
await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
await page.waitForTimeout(300)

const treadmillLink = page.locator('.category-text-nav__link', { hasText: 'Treadmills' }).first()
await treadmillLink.click()
await page.waitForTimeout(800)

const desktopCategoryScroll = await categoryScrollState()

const mobilePage = await browser.newPage({ viewport: { width: 390, height: 844 } })
await mobilePage.goto(`${baseUrl}/`, { waitUntil: 'networkidle', timeout: 45000 })
await mobilePage.waitForSelector('.category-text-nav__link', { timeout: 15000 })
await mobilePage.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
await mobilePage.waitForTimeout(300)

const mobileTreadmill = mobilePage.locator('.category-text-nav__link', { hasText: 'Treadmills' }).first()
await mobileTreadmill.click()
await mobilePage.waitForTimeout(800)

const mobileCategoryScroll = await mobilePage.evaluate(() => {
  const header = document.querySelector('.global-site-header')
  const browseFilters = document.getElementById('browse-filters-anchor')
  const headerBottom = header ? Math.round(header.getBoundingClientRect().bottom) : 0
  const filtersTop = browseFilters ? Math.round(browseFilters.getBoundingClientRect().top) : null
  return {
    filtersTop,
    headerBottom,
    scrollY: Math.round(window.scrollY),
  }
})

await mobilePage.close()

const result = {
  recent1,
  browse1,
  browse2,
  browse3,
  desktopCategoryScroll,
  mobileCategoryScroll,
}
console.log(JSON.stringify(result, null, 2))

await browser.close()

const recentOk =
  recent1.exists &&
  recent1.cards === 10 &&
  recent1.imgs === 10 &&
  recent1.placeholders === 0 &&
  !recent1.hasButton

// A page still offering "Load more" must be exactly full; the final page is a
// partial one with the button gone. Asserting the shape rather than a fixed
// total keeps this stable as listings are added.
function browsePageOk(state, pageNumber, previous) {
  if (!state.exists) return false
  if (state.imgs !== state.cards || state.placeholders !== 0) return false
  if (state.hasButton) return state.cards === PAGE_SIZE * pageNumber
  if (!previous) return state.cards < PAGE_SIZE
  return state.cards > previous.cards && state.cards < PAGE_SIZE * pageNumber
}

const browseOk =
  browsePageOk(browse1, 1, null) &&
  browsePageOk(browse2, 2, browse1) &&
  browsePageOk(browse3, 3, browse2)

const categoryScrollOk =
  desktopCategoryScroll.filtersTop !== null &&
  desktopCategoryScroll.filtersTop >= desktopCategoryScroll.headerBottom - 4 &&
  desktopCategoryScroll.filtersTop <= desktopCategoryScroll.headerBottom + 24 &&
  mobileCategoryScroll.filtersTop !== null &&
  mobileCategoryScroll.filtersTop >= mobileCategoryScroll.headerBottom - 4 &&
  mobileCategoryScroll.filtersTop <= mobileCategoryScroll.headerBottom + 24

if (!recentOk || !browseOk || !categoryScrollOk) process.exitCode = 1
else {
  console.log(
    `PASS: Home recent has no load more (10 cards); browse load more paginates ${browse1.cards} -> ${browse2.cards} -> ${browse3.cards}; category nav scrolls to filters`,
  )
}
