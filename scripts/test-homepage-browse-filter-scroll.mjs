#!/usr/bin/env node
/**
 * Homepage browse filters must not jump to the hero.
 *
 *   node scripts/test-homepage-browse-filter-scroll.mjs [baseUrl]
 */
import { chromium } from 'playwright-core'

const baseUrl = (process.argv[2] ?? 'http://localhost:5173').replace(/\/$/, '')

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

const browser = await chromium.launch({ headless: true, channel: 'msedge' })
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })

try {
  await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle', timeout: 45000 })
  await page.locator('#browse').scrollIntoViewIfNeeded()
  await page.waitForTimeout(300)

  const before = await page.evaluate(() => ({
    y: Math.round(window.scrollY),
    pathname: window.location.pathname,
  }))
  assert(before.y > 200, `expected to be below the hero, got scrollY=${before.y}`)
  assert(before.pathname === '/', 'started on homepage')

  await page.getByRole('button', { name: 'Distance', exact: true }).click()
  await page.getByRole('button', { name: 'Enter a town or postcode' }).click()
  await page.waitForTimeout(250)

  const afterOpen = await page.evaluate(() => Math.round(window.scrollY))
  assert(
    Math.abs(afterOpen - before.y) < 80,
    `opening Distance jumped the page (before=${before.y}, after=${afterOpen})`,
  )

  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Category', exact: true }).click()
  const categoryOption = page.locator('.browse-filter-option-list__option').first()
  if (await categoryOption.count()) {
    await categoryOption.click()
    await page.waitForTimeout(400)
  }

  const afterFilter = await page.evaluate(() => ({
    y: Math.round(window.scrollY),
    href: window.location.href,
  }))
  assert(afterFilter.y > 200, `filter update scrolled to the top (scrollY=${afterFilter.y})`)
  assert(
    Math.abs(afterFilter.y - before.y) < 240,
    `filter update moved scroll too far (before=${before.y}, after=${afterFilter.y})`,
  )

  await page.locator('footer a[href="/about"]').click()
  await page.waitForURL('**/about', { timeout: 10000 })
  await page.waitForTimeout(200)
  const aboutY = await page.evaluate(() => Math.round(window.scrollY))
  assert(aboutY === 0, `normal navigation should still scroll to top, got ${aboutY}`)

  console.log('PASS: homepage Distance/filter URL updates keep browse scroll')
  console.log('PASS: /about navigation still resets to top')
} finally {
  await browser.close()
}
