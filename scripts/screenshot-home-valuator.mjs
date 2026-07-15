/**
 * Capture homepage Equipment Valuator screenshots for visual verification.
 * Usage: node scripts/screenshot-home-valuator.mjs [baseUrl]
 */
import { chromium } from '@playwright/test'
import fs from 'node:fs/promises'
import path from 'node:path'

const baseUrl = process.argv[2] || 'http://127.0.0.1:5174'
const outDir = path.resolve('debug-screenshots/home-valuator')

async function waitForDropdown(page) {
  await page.waitForSelector('.canonical-autocomplete__dropdown', { timeout: 15000 })
}

async function main() {
  await fs.mkdir(outDir, { recursive: true })
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })

  await page.goto(baseUrl, { waitUntil: 'networkidle' })
  await page.waitForSelector('.home-valuator')
  await page.locator('.home-valuator').scrollIntoViewIfNeeded()
  await page.waitForTimeout(400)
  await page.locator('.home-valuator').screenshot({
    path: path.join(outDir, '01-closed.png'),
  })

  const input = page.locator('#home-valuator-search')
  await input.click()
  await input.fill('Life Fitness 95T')
  await waitForDropdown(page)
  await page.waitForSelector('.canonical-autocomplete__option', { timeout: 15000 })
  await page.waitForTimeout(300)
  await page.locator('.home-valuator').screenshot({
    path: path.join(outDir, '02-autocomplete-results.png'),
  })

  await input.fill('zzzz-no-match-equipd-xyz')
  await waitForDropdown(page)
  await page.waitForSelector('.canonical-autocomplete__empty', { timeout: 15000 })
  await page.waitForTimeout(300)
  await page.locator('.home-valuator').screenshot({
    path: path.join(outDir, '03-no-results.png'),
  })

  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(baseUrl, { waitUntil: 'networkidle' })
  await page.waitForSelector('.home-valuator')
  await page.locator('.home-valuator').scrollIntoViewIfNeeded()
  await input.click()
  await input.fill('Technogym Excite')
  await waitForDropdown(page)
  await page.waitForSelector('.canonical-autocomplete__option, .canonical-autocomplete__empty', {
    timeout: 15000,
  })
  await page.waitForTimeout(300)
  await page.locator('.home-valuator').screenshot({
    path: path.join(outDir, '04-mobile-autocomplete.png'),
  })

  // Navigation checks
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto(baseUrl, { waitUntil: 'networkidle' })
  await input.click()
  await input.fill('Life Fitness 95T')
  await waitForDropdown(page)
  await page.waitForSelector('.canonical-autocomplete__option')
  const firstOption = page.locator('.canonical-autocomplete__option').first()
  const firstTitle = (await firstOption.locator('.canonical-autocomplete__option-title').textContent())?.trim()
  await firstOption.dispatchEvent('mousedown')
  await page.waitForURL(/\/valuation\?product=/)
  const productUrl = page.url()
  console.log('selected suggestion navigated to:', productUrl)
  console.log('selected title:', firstTitle)

  await page.goto(baseUrl, { waitUntil: 'networkidle' })
  await input.fill('Life Fit')
  await page.locator('.home-valuator__submit').click()
  await page.waitForURL(/\/valuation\?q=/)
  console.log('typed query navigated to:', page.url())

  await page.goto(baseUrl, { waitUntil: 'networkidle' })
  await page.locator('.home-valuator__submit').click()
  await page.waitForURL(/\/valuation\/?$/)
  console.log('empty submit navigated to:', page.url())

  await browser.close()
  console.log(`Screenshots written to ${outDir}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
