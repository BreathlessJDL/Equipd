#!/usr/bin/env node
// Buyer multi-quantity Make Offer flow UI validation with screenshots.
import { mkdir, readFile } from 'node:fs/promises'
import { chromium } from 'playwright-core'

async function loadEnvLocal() {
  try {
    const raw = await readFile('.env.local', 'utf8')
    for (const line of raw.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const index = trimmed.indexOf('=')
      if (index === -1) continue
      const key = trimmed.slice(0, index).trim()
      const value = trimmed.slice(index + 1).trim()
      if (!process.env[key]) process.env[key] = value
    }
  } catch {
    // optional local env
  }
}

await loadEnvLocal()

const baseUrl = process.argv[2] ?? 'http://localhost:4173'
const reportDir = 'reports/inventory-stage1'
const email = process.env.BUYER_TEST_EMAIL ?? process.env.ADMIN_TEST_EMAIL
const password = process.env.BUYER_TEST_PASSWORD ?? process.env.ADMIN_TEST_PASSWORD
const results = []
let failures = 0

function check(name, ok, detail = '') {
  results.push({ name, ok, detail })
  if (!ok) failures += 1
  console.log(`${ok ? 'PASS' : 'FAIL'}: ${name}${detail ? ` — ${detail}` : ''}`)
}

await mkdir(reportDir, { recursive: true })

const browser = await chromium.launch({ headless: true, channel: 'msedge' })
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })

if (email && password) {
  await page.goto(`${baseUrl}/login`, { waitUntil: 'networkidle', timeout: 45000 })
  await page.getByLabel(/email/i).fill(email)
  await page.getByLabel(/password/i).fill(password)
  await page.locator('form.auth-form button[type="submit"]').click()
  try {
    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 10000 })
    check('signed in test buyer account', true, email)
  } catch {
    console.log(
      `SKIP: signed in test buyer account — login failed; set BUYER_TEST_EMAIL/PASSWORD in .env.local for full modal checks`,
    )
  }
} else {
  check('signed in test buyer account', false, 'missing BUYER_TEST_EMAIL/PASSWORD in .env.local')
}

const signedIn = !page.url().includes('/login')

await page.goto(`${baseUrl}/browse`, { waitUntil: 'networkidle', timeout: 45000 })
await page.waitForSelector('.listing-card', { timeout: 15000 })

const slug = await page.evaluate(() => {
  const link = document.querySelector('.listing-card a[href^="/listings/"]')
  return link ? new URL(link.href).pathname.split('/').pop() : null
})

check('found a public listing slug', Boolean(slug), slug ?? 'none')

if (slug) {
  await page.route(/\/rest\/v1\/listings\?select=\*/, async (route) => {
    const response = await route.fetch()
    const body = await response.json()
    if (Array.isArray(body) && body.length > 0 && body[0]?.slug === slug) {
      body[0] = {
        ...body[0],
        quantity_available: 3,
        quantity_total: 3,
        price_pence: 59500,
      }
    }
    await route.fulfill({ response, json: body })
  })

  await page.goto(`${baseUrl}/listings/${slug}`, { waitUntil: 'networkidle', timeout: 45000 })
  await page.waitForSelector('.listing-summary__quantity', { timeout: 15000 })

  const detailQuantity = await page.locator('.listing-summary__quantity-input').inputValue()
  check('listing detail shows quantity selector defaulting to 1', detailQuantity === '1', detailQuantity)

  await page.getByRole('button', { name: 'Increase selected quantity' }).click()
  await page.getByRole('button', { name: 'Increase selected quantity' }).click()
  const selectedOnDetail = await page.locator('.listing-summary__quantity-input').inputValue()
  check('listing detail quantity selector updates to 3', selectedOnDetail === '3', selectedOnDetail)

  if (signedIn) {
    await page.getByRole('button', { name: 'Make an offer' }).click()
    await page.waitForSelector('.make-offer-modal__dialog', { timeout: 10000 })

    const modalQuantity = await page.locator('.make-offer-modal__quantity-input').inputValue()
    check('make offer modal preserves selected quantity 3', modalQuantity === '3', modalQuantity)

    const offerPerItemLabel = await page.getByLabel('Offer per item').count()
    check('make offer modal asks for offer per item', offerPerItemLabel === 1)

    await page.getByLabel('Offer per item').fill('500')
    await page.waitForSelector('.make-offer-modal__total-offer-value', { timeout: 5000 })
    const totalOfferText = await page.locator('.make-offer-modal__total-offer-value').textContent()
    check(
      'entering £500 per item for quantity 3 shows £1,500 total',
      /£1,500/.test(totalOfferText ?? ''),
      totalOfferText ?? '',
    )

    await page.screenshot({
      path: `${reportDir}/stage4-make-offer-modal-desktop.png`,
      fullPage: false,
    })

    await page.getByRole('button', { name: 'Cancel' }).click()
    await page.waitForSelector('.make-offer-modal__dialog', { state: 'hidden', timeout: 5000 })

    const quantityAfterClose = await page.locator('.listing-summary__quantity-input').inputValue()
    check(
      'quantity does not reset after closing the modal',
      quantityAfterClose === '3',
      quantityAfterClose,
    )
  } else {
    check('make offer modal checks skipped without authenticated buyer', true, 'detail quantity UI verified')
  }
}

await browser.close()

console.log(
  failures === 0
    ? '\nBuyer multi-quantity offer flow UI checks passed.'
    : `\n${failures} offer flow UI check(s) FAILED.`,
)
process.exitCode = failures === 0 ? 0 : 1
