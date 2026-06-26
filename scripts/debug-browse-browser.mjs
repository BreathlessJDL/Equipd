#!/usr/bin/env node
import { chromium } from 'playwright-core'

const baseUrl = process.argv[2] ?? 'http://localhost:5173'
const browseUrl = `${baseUrl.replace(/\/$/, '')}/browse`

const browser = await chromium.launch({ headless: true, channel: 'msedge' })
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })

const supabaseRequests = []

page.on('request', (request) => {
  const url = request.url()
  if (url.includes('supabase.co/rest/v1/listings') || url.includes('search_listings_with_distance')) {
    supabaseRequests.push({ method: request.method(), url })
  }
})

page.on('response', async (response) => {
  const url = response.url()
  if (!url.includes('supabase.co/rest/v1/listings') && !url.includes('search_listings_with_distance')) {
    return
  }

  try {
    const body = await response.json()
    const sample = Array.isArray(body) ? body[0] : body?.[0] ?? body
    supabaseRequests.push({
      status: response.status(),
      url: url.slice(0, 120) + '...',
      isArray: Array.isArray(body),
      count: Array.isArray(body) ? body.length : null,
      firstListingImages: sample?.listing_images ?? sample?.primary_image_storage_path ?? null,
      firstSlug: sample?.slug ?? null,
    })
  } catch {
    supabaseRequests.push({ status: response.status(), url, parseError: true })
  }
})

const consoleLogs = []
page.on('console', (msg) => {
  const text = msg.text()
  if (text.includes('[browse-debug]') || text.toLowerCase().includes('supabase')) {
    consoleLogs.push(text)
  }
})

await page.goto(browseUrl, { waitUntil: 'networkidle', timeout: 45000 })
await page.waitForSelector('.listing-card, .listing-browse__message', { timeout: 15000 }).catch(() => null)
await page.waitForTimeout(2000)

const dom = await page.evaluate(() => {
  const cards = [...document.querySelectorAll('.listing-card')]
  const placeholders = [...document.querySelectorAll('.listing-card__image--placeholder')]
  const imgs = [...document.querySelectorAll('img.listing-card__image')]
  const error = document.querySelector('.listing-browse__message--error')?.textContent?.trim() ?? null
  const loading = document.querySelector('.listing-browse__message')?.textContent?.trim() ?? null
  return {
    cardCount: cards.length,
    placeholderCount: placeholders.length,
    imgCount: imgs.length,
    firstPlaceholderText: placeholders[0]?.textContent?.trim() ?? null,
    firstImgSrc: imgs[0]?.src?.slice(0, 120) ?? null,
    error,
    loading,
    bodyText: document.body?.innerText?.slice(0, 200) ?? null,
  }
})

console.log('=== Browser browse debug ===')
console.log('URL:', browseUrl)
console.log('DOM:', JSON.stringify(dom, null, 2))
console.log('Supabase network captures:', JSON.stringify(supabaseRequests, null, 2))
console.log('Console logs:', consoleLogs)

await browser.close()
