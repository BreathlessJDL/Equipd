#!/usr/bin/env node
// Stage 3 (Option A) UI validation.
//
// Runs against a local preview of the production build. Production data is
// all quantity 1, so the quantity>1 rendering is validated by intercepting
// PostgREST responses in the browser and rewriting one listing's
// quantity_available to 6. No production data is read differently or written.
import { chromium } from 'playwright-core'

const baseUrl = process.argv[2] ?? 'http://localhost:4173'
const results = []
let failures = 0

function check(name, ok, detail = '') {
  results.push({ name, ok, detail })
  if (!ok) failures += 1
  console.log(`${ok ? 'PASS' : 'FAIL'}: ${name}${detail ? ` — ${detail}` : ''}`)
}

const browser = await chromium.launch({ headless: true, channel: 'msedge' })

async function newPage({ mobile = false } = {}) {
  return browser.newPage({
    viewport: mobile ? { width: 390, height: 844 } : { width: 1280, height: 900 },
  })
}

// --- 1. Quantity-1 parity: no availability elements anywhere today ---
{
  const page = await newPage()
  await page.goto(`${baseUrl}/browse`, { waitUntil: 'networkidle', timeout: 45000 })
  await page.waitForSelector('.listing-card', { timeout: 15000 })

  const counts = await page.evaluate(() => ({
    cards: document.querySelectorAll('.listing-card').length,
    availability: document.querySelectorAll(
      '.listing-card__availability, .listing-row__availability',
    ).length,
  }))

  check(
    `browse quantity-1 parity: ${counts.cards} cards, zero availability lines`,
    counts.cards > 0 && counts.availability === 0,
    JSON.stringify(counts),
  )

  const firstSlug = await page.evaluate(() => {
    const link = document.querySelector('.listing-card a.listing-card__body[href^="/listings/"], .listing-card a[href^="/listings/"]')
    return link ? new URL(link.href).pathname.split('/').pop() : null
  })

  if (firstSlug) {
    await page.goto(`${baseUrl}/listings/${firstSlug}`, {
      waitUntil: 'networkidle',
      timeout: 45000,
    })
    await page.waitForSelector('.listing-summary', { timeout: 15000 })
    const detailQuantityUi = await page
      .locator('.listing-summary__availability, .listing-summary__quantity')
      .count()
    check('detail quantity-1 parity: no availability or quantity block', detailQuantityUi === 0)
  } else {
    check(
      'detail quantity-1 parity: no availability or quantity block',
      false,
      'no listing link found',
    )
  }

  await page.close()
}

// --- 2. Quantity>1 browse card rendering (intercepted hydration response) ---
async function runBrowseInterceptCheck({ mobile }) {
  const page = await newPage({ mobile })
  let patchedId = null

  await page.route(/\/rest\/v1\/listings\?select=id%2Cquantity_available/, async (route) => {
    const response = await route.fetch()
    const rows = await response.json()
    if (Array.isArray(rows) && rows.length > 0) {
      patchedId = rows[0].id
      rows[0] = { ...rows[0], quantity_available: 6 }
    }
    await route.fulfill({ response, json: rows })
  })

  await page.goto(`${baseUrl}/browse`, { waitUntil: 'networkidle', timeout: 45000 })
  await page.waitForSelector('.listing-card', { timeout: 15000 })

  const state = await page.evaluate(() => {
    const lines = [...document.querySelectorAll('.listing-card__availability')]
    return {
      availabilityCount: lines.length,
      texts: lines.map((line) => line.textContent.replace(/\s+/g, ' ').trim()),
    }
  })

  const label = mobile ? 'mobile' : 'desktop'
  check(
    `browse ${label}: exactly one card shows availability`,
    patchedId != null && state.availabilityCount === 1,
    JSON.stringify(state),
  )
  check(
    `browse ${label}: availability text is "£X each · 6 available"`,
    state.texts.length === 1 && /^£[\d,]+ each · 6 available$/.test(state.texts[0]),
    state.texts[0] ?? 'missing',
  )

  await page.screenshot({
    path: `reports/inventory-stage1/stage3-browse-${label}.png`,
    fullPage: false,
  })
  await page.close()
}

await runBrowseInterceptCheck({ mobile: false })
await runBrowseInterceptCheck({ mobile: true })

// --- 3. Quantity>1 detail rendering (intercepted detail response) ---
async function runDetailInterceptCheck({ mobile }) {
  const page = await newPage({ mobile })

  // Find a slug first without interception.
  await page.goto(`${baseUrl}/browse`, { waitUntil: 'networkidle', timeout: 45000 })
  await page.waitForSelector('.listing-card a[href^="/listings/"]', { timeout: 15000 })
  const slug = await page.evaluate(() => {
    const link = document.querySelector('.listing-card a[href^="/listings/"]')
    return link ? new URL(link.href).pathname.split('/').pop() : null
  })

  const label = mobile ? 'mobile' : 'desktop'
  if (!slug) {
    check(`detail ${label}: quantity 6 availability block`, false, 'no slug found')
    await page.close()
    return
  }

  await page.route(/\/rest\/v1\/listings\?select=\*/, async (route) => {
    const response = await route.fetch()
    const body = await response.json()
    if (Array.isArray(body) && body.length > 0 && body[0]?.slug === slug) {
      body[0] = { ...body[0], quantity_available: 6, quantity_total: 6 }
    }
    await route.fulfill({ response, json: body })
  })

  await page.goto(`${baseUrl}/listings/${slug}`, { waitUntil: 'networkidle', timeout: 45000 })
  await page.waitForSelector('.listing-summary', { timeout: 15000 })

  const state = await page.evaluate(() => {
    const block = document.querySelector('.listing-summary__quantity')
    const selectedInput = block?.querySelector('.listing-summary__quantity-input')
    return {
      present: Boolean(block),
      selected: selectedInput?.value ?? selectedInput?.textContent?.trim(),
      available: block
        ?.querySelector('.listing-summary__quantity-available')
        ?.textContent.trim(),
      pricing: block
        ?.querySelector('.listing-summary__quantity-pricing')
        ?.textContent.replace(/\s+/g, ' ')
        .trim(),
    }
  })

  check(
    `detail ${label}: shows selector, unit price, subtotal and availability`,
    state.present
      && state.selected === '1'
      && state.available === '6 available'
      && /^£[\d,]+ per item\s*£[\d,]+ item subtotal$/.test(state.pricing ?? ''),
    JSON.stringify(state),
  )

  const increase = page.getByRole('button', { name: 'Increase selected quantity' })
  const decrease = page.getByRole('button', { name: 'Decrease selected quantity' })
  await increase.click()
  const afterIncrease = await page.locator('.listing-summary__quantity').evaluate((block) => {
    const selectedInput = block.querySelector('.listing-summary__quantity-input')
    return {
      selected: selectedInput?.value ?? selectedInput?.textContent?.trim(),
      pricing: block
        .querySelector('.listing-summary__quantity-pricing')
        ?.textContent.replace(/\s+/g, ' ')
        .trim(),
    }
  })
  check(
    `detail ${label}: increment recalculates subtotal`,
    afterIncrease.selected === '2' && /£[\d,]+ item subtotal$/.test(afterIncrease.pricing ?? ''),
    JSON.stringify(afterIncrease),
  )

  await decrease.click()
  check(
    `detail ${label}: minimum quantity is one`,
    (await page.locator('.listing-summary__quantity-input').inputValue()) === '1'
      && await decrease.isDisabled(),
  )

  for (let index = 0; index < 5; index += 1) {
    await increase.click()
  }
  check(
    `detail ${label}: maximum quantity is current availability`,
    (await page.locator('.listing-summary__quantity-input').inputValue()) === '6'
      && await increase.isDisabled(),
  )

  await page.screenshot({
    path: `reports/inventory-stage1/stage3-detail-${label}.png`,
    fullPage: false,
  })
  await page.close()
}

await runDetailInterceptCheck({ mobile: false })
await runDetailInterceptCheck({ mobile: true })

await browser.close()

console.log(failures === 0 ? '\nAll Stage 3 UI checks passed.' : `\n${failures} UI check(s) FAILED.`)
process.exitCode = failures === 0 ? 0 : 1
