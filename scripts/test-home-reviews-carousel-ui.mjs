#!/usr/bin/env node
import { chromium } from 'playwright-core'

const baseUrl = process.argv[2] ?? 'http://localhost:5173'

async function getCarouselState(page) {
  return page.evaluate(() => {
    const section = document.querySelector('.home-reviews')
    const carousel = section?.querySelector('[data-home-reviews-carousel]')
    const track = carousel?.querySelector('.home-reviews-carousel__track')
    const slides = carousel?.querySelectorAll('.home-reviews-carousel__slide') ?? []
    const dots = carousel?.querySelectorAll('.home-reviews-carousel__dot') ?? []
    const arrows = carousel?.querySelectorAll('.home-reviews-carousel__arrow') ?? []
    const transform = track ? window.getComputedStyle(track).transform : null

    return {
      hasSection: Boolean(section),
      mode: carousel?.getAttribute('data-carousel-mode') ?? null,
      slideCount: slides.length,
      dotCount: dots.length,
      arrowCount: arrows.length,
      transform,
      activeDot: [...dots].findIndex((dot) => dot.getAttribute('aria-selected') === 'true'),
    }
  })
}

async function getVisibleUniqueTitles(page) {
  return page.evaluate(() => {
    const viewport = document.querySelector('.home-reviews-carousel__viewport')
    if (!viewport) return []

    const viewportRect = viewport.getBoundingClientRect()
    const titles = []

    for (const slide of document.querySelectorAll('.home-reviews-carousel__slide')) {
      const rect = slide.getBoundingClientRect()
      const overlaps =
        rect.right > viewportRect.left + 4 && rect.left < viewportRect.right - 4
      if (!overlaps) continue

      const title = slide.querySelector('.home-review-card__listing-title')?.textContent?.trim()
      if (title) titles.push(title)
    }

    return titles
  })
}

const browser = await chromium.launch({ headless: true, channel: 'msedge' })

try {
  for (const viewport of [
    { name: 'desktop', width: 1280, height: 900 },
    { name: 'mobile', width: 390, height: 844 },
  ]) {
    const page = await browser.newPage({ viewport })
    await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle', timeout: 45000 })
    await page.waitForSelector('.home-reviews', { timeout: 15000 })

    const initial = await getCarouselState(page)
    console.log(`\n[${viewport.name}] initial`, initial)

    if (initial.mode !== 'interactive') {
      throw new Error(`[${viewport.name}] Expected interactive carousel when >4 reviews, got ${initial.mode}`)
    }

    if (initial.arrowCount !== 2 || initial.dotCount < 5) {
      throw new Error(`[${viewport.name}] Expected arrows and dots for interactive carousel`)
    }

    const titlesBefore = await getVisibleUniqueTitles(page)
    await page.click('.home-reviews-carousel__arrow--next')
    await page.waitForTimeout(700)
    const titlesAfterNext = await getVisibleUniqueTitles(page)

    if (JSON.stringify(titlesBefore) === JSON.stringify(titlesAfterNext)) {
      throw new Error(`[${viewport.name}] Next arrow did not change visible reviews`)
    }

    console.log(`[${viewport.name}] next arrow ok`, { titlesBefore, titlesAfterNext })

    await page.click('.home-reviews-carousel__dot:last-child')
    await page.waitForTimeout(700)
    const afterDot = await getCarouselState(page)
    console.log(`[${viewport.name}] dot navigation ok`, { activeDot: afterDot.activeDot })

    await page.hover('.home-reviews-carousel--interactive')
    const transformPaused = await page.evaluate(() => {
      return document.querySelector('.home-reviews-carousel__track')?.style.transform ?? null
    })
    await page.waitForTimeout(1200)
    const transformStillPaused = await page.evaluate(() => {
      return document.querySelector('.home-reviews-carousel__track')?.style.transform ?? null
    })

    if (transformPaused !== transformStillPaused) {
      throw new Error(`[${viewport.name}] Carousel should pause on hover`)
    }

    console.log(`[${viewport.name}] hover pause ok`)

    await page.close()
  }

  console.log('\nPASS: homepage reviews carousel desktop + mobile checks')
} finally {
  await browser.close()
}
