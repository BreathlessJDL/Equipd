#!/usr/bin/env node
import { chromium } from 'playwright-core'

const baseUrl = process.argv[2] ?? 'http://localhost:5173'
const browser = await chromium.launch({ headless: true, channel: 'msedge' })
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })

await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle', timeout: 45000 })

async function recentSectionState() {
  return page.evaluate(() => {
    const section = document.querySelector('.home-recent')
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
    const browseResults = document.getElementById('browse-results')
    const rect = browseResults?.getBoundingClientRect()
  return {
      browseResultsTop: rect ? Math.round(rect.top) : null,
      scrollY: Math.round(window.scrollY),
    }
  })
}

await page.waitForSelector('.home-recent .listing-card', { timeout: 15000 })

const recent1 = await recentSectionState()
const browse1 = await browseSectionState()

if (browse1.hasButton) {
  await page.click('.home-browse .listing-browse__load-more-button')
  await page.waitForFunction(
    () => document.querySelectorAll('.home-browse .listing-card').length >= 48,
    null,
    { timeout: 15000 },
  )
}

const browse2 = await browseSectionState()

if (browse2.hasButton) {
  await page.click('.home-browse .listing-browse__load-more-button')
  await page.waitForFunction(
    () => document.querySelectorAll('.home-browse .listing-card').length >= 54,
    null,
    { timeout: 15000 },
  )
}

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
  const browseResults = document.getElementById('browse-results')
  const rect = browseResults?.getBoundingClientRect()
  return {
    browseResultsTop: rect ? Math.round(rect.top) : null,
    scrollY: Math.round(window.scrollY),
  }
})

await mobilePage.close()

const result = {
  recent1,
  browse1,
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

const browseOk =
  browse1.exists &&
  browse1.cards === 24 &&
  browse1.imgs === 24 &&
  browse1.placeholders === 0 &&
  browse3.cards === 54 &&
  browse3.imgs === 54 &&
  browse3.placeholders === 0 &&
  !browse3.hasButton

const categoryScrollOk =
  desktopCategoryScroll.browseResultsTop !== null &&
  desktopCategoryScroll.browseResultsTop <= 120 &&
  mobileCategoryScroll.browseResultsTop !== null &&
  mobileCategoryScroll.browseResultsTop <= 120

if (!recentOk || !browseOk || !categoryScrollOk) process.exitCode = 1
else {
  console.log(
    'PASS: Home recent has no load more (10 cards); browse load more works; category nav scrolls to results',
  )
}
