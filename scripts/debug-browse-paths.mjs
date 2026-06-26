#!/usr/bin/env node
import { chromium } from 'playwright-core'

const base = process.argv[2] ?? 'http://localhost:5173'
const paths = [
  '/browse',
  '/browse?lat=53.8&lng=-1.55&radius=uk',
  '/browse?sort=nearest&lat=53.8&lng=-1.55',
]

const browser = await chromium.launch({ headless: true, channel: 'msedge' })

for (const path of paths) {
  const page = await browser.newPage()
  const captures = []
  page.on('response', async (response) => {
    const url = response.url()
    if (!url.includes('listings') && !url.includes('search_listings_with_distance')) return
    try {
      const body = await response.json()
      const sample = Array.isArray(body) ? body[0] : null
      captures.push({
        kind: url.includes('rpc') ? 'rpc' : 'rest',
        count: Array.isArray(body) ? body.length : null,
        images: sample?.listing_images ?? sample?.primary_image_storage_path ?? null,
      })
    } catch { /* ignore */ }
  })

  await page.goto(`${base}${path}`, { waitUntil: 'networkidle', timeout: 45000 })
  await page.waitForTimeout(3000)
  const dom = await page.evaluate(() => ({
    cards: document.querySelectorAll('.listing-card').length,
    placeholders: document.querySelectorAll('.listing-card__image--placeholder').length,
    imgs: document.querySelectorAll('img.listing-card__image').length,
  }))
  console.log(path, dom, captures)
  await page.close()
}

await browser.close()
