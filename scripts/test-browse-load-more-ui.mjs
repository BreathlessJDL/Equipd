#!/usr/bin/env node
import { chromium } from 'playwright-core'

const baseUrl = process.argv[2] ?? 'http://localhost:5173'
const browser = await chromium.launch({ headless: true, channel: 'msedge' })
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })

await page.goto(`${baseUrl}/browse`, { waitUntil: 'networkidle', timeout: 45000 })
await page.waitForSelector('.listing-card', { timeout: 15000 })

async function countState() {
  return page.evaluate(() => ({
    cards: document.querySelectorAll('.listing-card').length,
    placeholders: document.querySelectorAll('.listing-card__image--placeholder').length,
    imgs: document.querySelectorAll('img.listing-card__image').length,
    hasButton: Boolean(document.querySelector('.listing-browse__load-more-button')),
    buttonText: document.querySelector('.listing-browse__load-more-button')?.textContent?.trim() ?? null,
  }))
}

const step1 = await countState()
await page.click('.listing-browse__load-more-button')
await page.waitForFunction(() => document.querySelectorAll('.listing-card').length >= 48, null, {
  timeout: 15000,
})
const step2 = await countState()

if (step2.hasButton) {
  await page.click('.listing-browse__load-more-button')
  await page.waitForFunction(() => document.querySelectorAll('.listing-card').length >= 54, null, {
    timeout: 15000,
  })
}
const step3 = await countState()

console.log(JSON.stringify({ step1, step2, step3 }, null, 2))
await browser.close()

const ok =
  step1.cards === 24 &&
  step1.imgs === 24 &&
  step1.placeholders === 0 &&
  step2.cards === 48 &&
  step2.imgs === 48 &&
  step3.cards === 54 &&
  step3.imgs === 54 &&
  step3.placeholders === 0 &&
  !step3.hasButton

if (!ok) process.exitCode = 1
else console.log('PASS: Load more UI reached 54 cards with images')
