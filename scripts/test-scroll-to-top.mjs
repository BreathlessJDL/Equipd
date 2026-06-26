#!/usr/bin/env node
import { chromium } from 'playwright-core'

const baseUrl = (process.argv[2] ?? 'http://localhost:5173').replace(/\/$/, '')

async function scrollState(page) {
  return page.evaluate(() => ({
    scrollY: Math.round(window.scrollY),
    pathname: window.location.pathname,
  }))
}

async function runViewport(browser, { name, width, height }) {
  const page = await browser.newPage({ viewport: { width, height } })
  const results = []

  await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle', timeout: 45000 })
  await page.evaluate(() => window.scrollTo(0, 1200))
  await page.waitForTimeout(200)

  await page.click('footer a[href="/about"]')
  await page.waitForURL('**/about', { timeout: 10000 })
  await page.waitForTimeout(200)
  results.push({ step: 'home -> about', ...(await scrollState(page)) })

  await page.evaluate(() => window.scrollTo(0, 900))
  await page.waitForTimeout(200)
  await page.click('footer a[href="/help"]')
  await page.waitForURL('**/help', { timeout: 10000 })
  await page.waitForTimeout(200)
  results.push({ step: 'about -> help', ...(await scrollState(page)) })

  await page.evaluate(() => window.scrollTo(0, 800))
  await page.waitForTimeout(200)
  await page.click('footer a[href="/browse"]')
  await page.waitForURL('**/browse', { timeout: 10000 })
  await page.waitForTimeout(200)
  results.push({ step: 'help -> browse', ...(await scrollState(page)) })

  await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle', timeout: 45000 })
  await page.evaluate(() => window.scrollTo(0, 1500))
  await page.waitForTimeout(200)
  const firstListing = page.locator('.home-browse .listing-card a').first()
  if (await firstListing.count()) {
    await firstListing.click()
    await page.waitForURL('**/listings/**', { timeout: 10000 })
    await page.waitForTimeout(200)
    results.push({ step: 'home browse -> listing', ...(await scrollState(page)) })
  }

  await page.close()
  return { name, width, height, results }
}

const browser = await chromium.launch({ headless: true, channel: 'msedge' })
const desktop = await runViewport(browser, { name: 'desktop', width: 1280, height: 900 })
const mobile = await runViewport(browser, { name: 'mobile', width: 390, height: 844 })
await browser.close()

console.log(JSON.stringify({ desktop, mobile }, null, 2))

function viewportOk(viewport) {
  return viewport.results.every((entry) => entry.scrollY === 0)
}

if (!viewportOk(desktop) || !viewportOk(mobile)) {
  console.error('FAIL: route navigation did not reset scroll to top')
  process.exitCode = 1
} else {
  console.log('PASS: route changes reset scroll to top on desktop and mobile')
}
