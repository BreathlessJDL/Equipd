/**
 * Browser smoke for GA4 consent gating against a running preview/production URL.
 * Run: node scripts/test-analytics-ga4-smoke.mjs [baseUrl]
 */

import { chromium } from 'playwright-core'

const baseUrl = (process.argv[2] ?? 'http://127.0.0.1:4173').replace(/\/$/, '')
const measurementId = 'G-M5767NZQ85'

const browser = await chromium.launch({ headless: true, channel: 'msedge' })
const context = await browser.newContext()
const page = await context.newPage()

const gtagRequests = []
const collectRequests = []

page.on('request', (request) => {
  const url = request.url()
  if (url.includes('googletagmanager.com/gtag/js')) gtagRequests.push(url)
  if (
    url.includes('google-analytics.com') ||
    url.includes('/g/collect') ||
    url.includes('analytics.google.com')
  ) {
    collectRequests.push(url)
  }
})

function dataLayerPageViews() {
  return page.evaluate(() =>
    (window.dataLayer || [])
      .map((entry) => {
        try {
          return Array.from(entry)
        } catch {
          return null
        }
      })
      .filter((entry) => entry && entry[0] === 'event' && entry[1] === 'page_view'),
  )
}

await page.goto(baseUrl, { waitUntil: 'networkidle', timeout: 60000 })
await page.waitForTimeout(800)

const beforeConsent = await page.evaluate((id) => {
  const scripts = [
    ...document.querySelectorAll(`script[src*="googletagmanager.com/gtag/js?id=${id}"]`),
  ]
  return {
    scriptCount: scripts.length,
    hasGaCookie: document.cookie.split(';').some((part) => {
      const name = part.trim().split('=')[0]
      return name === '_ga' || name.startsWith('_ga_')
    }),
  }
}, measurementId)

if (beforeConsent.scriptCount !== 0 || beforeConsent.hasGaCookie || gtagRequests.length !== 0) {
  console.error('FAIL: GA loaded before consent', { beforeConsent, gtagRequests: gtagRequests.length })
  await browser.close()
  process.exit(1)
}

const banner = page.locator('.cookie-banner')
await banner.waitFor({ timeout: 10000 })
await banner.getByRole('button', { name: 'Cookie settings' }).click()

await page.getByRole('switch', { name: /Analytics cookies/i }).waitFor({ timeout: 5000 })
const marketingVisible = await page.getByRole('heading', { name: 'Marketing', exact: true }).count()
if (marketingVisible !== 0) {
  console.error('FAIL: Marketing category should be hidden from Cookie Settings')
  await browser.close()
  process.exit(1)
}

const analyticsCopy = await page.locator('.cookie-settings-modal').innerText()
if (!analyticsCopy.includes('Google Analytics')) {
  console.error('FAIL: Cookie Settings Analytics copy missing Google Analytics')
  await browser.close()
  process.exit(1)
}

await page.locator('.cookie-settings-modal').getByRole('button', { name: 'Accept all' }).click()
await page.locator('.cookie-settings-modal').waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {})
// Accept all does not always close the modal — close if still open.
if (await page.locator('.cookie-settings-modal').count()) {
  await page.locator('.cookie-settings-modal .auth-modal__close').click()
}
await page.waitForTimeout(1500)

const afterAccept = await page.evaluate((id) => {
  const scripts = [
    ...document.querySelectorAll(`script[src*="googletagmanager.com/gtag/js?id=${id}"]`),
  ]
  return {
    scriptCount: scripts.length,
    scriptSrc: scripts[0]?.src ?? null,
    dataLayerCommands: (window.dataLayer || []).map((entry) => {
      try {
        return Array.from(entry)
      } catch {
        return entry
      }
    }),
  }
}, measurementId)

const hasConfig = afterAccept.dataLayerCommands.some(
  (entry) => Array.isArray(entry) && entry[0] === 'config' && entry[1] === measurementId,
)
const initialPageViews = afterAccept.dataLayerCommands.filter(
  (entry) => Array.isArray(entry) && entry[0] === 'event' && entry[1] === 'page_view',
).length

// SPA navigations (not full reloads)
await page.locator('a[href="/browse"]').first().click()
await page.waitForURL('**/browse', { timeout: 15000 })
await page.waitForTimeout(500)
await page.locator('a[href="/brands"]').first().click()
await page.waitForURL('**/brands', { timeout: 15000 })
await page.waitForTimeout(500)

const afterNavPageViews = (await dataLayerPageViews()).length

// Revoke via footer Cookie Settings
await page.locator('footer').getByRole('button', { name: /Cookie Settings/i }).click()
const toggle = page.getByRole('switch', { name: /Analytics cookies/i })
await toggle.waitFor({ timeout: 5000 })
if ((await toggle.getAttribute('aria-checked')) === 'true') {
  await toggle.click()
}
await page.locator('.cookie-settings-modal').getByRole('button', { name: 'Save preferences' }).click()
await page.waitForTimeout(500)

const afterRevoke = await page.evaluate((id) => {
  const stored = JSON.parse(localStorage.getItem('equipd_cookie_consent') || 'null')
  return {
    analyticsCategory: stored?.categories?.analytics ?? null,
    disabled: Boolean(window[`ga-disable-${id}`]),
    trackEventBlocked: !(typeof window.gtag === 'function' && !window[`ga-disable-${id}`]),
    hasGaCookie: document.cookie.split(';').some((part) => {
      const name = part.trim().split('=')[0]
      return name === '_ga' || name.startsWith('_ga_')
    }),
  }
}, measurementId)

const collectBeforeRevokeNav = collectRequests.length
await page.locator('a[href="/help"]').first().click()
await page.waitForURL('**/help', { timeout: 15000 })
await page.waitForTimeout(800)
const collectAfterRevokeNav = collectRequests.length
const pageViewsAfterRevoke = (await dataLayerPageViews()).length

await browser.close()

const summary = {
  beforeConsent,
  afterAccept: {
    scriptCount: afterAccept.scriptCount,
    scriptSrc: afterAccept.scriptSrc,
    hasConfig,
    initialPageViews,
    gtagRequests: gtagRequests.length,
    collectRequests: collectBeforeRevokeNav,
  },
  afterNavPageViews,
  afterRevoke,
  pageViewsAfterRevoke,
  collectAfterRevokeNav,
}

console.log(JSON.stringify(summary, null, 2))

const failures = []
if (!hasConfig || afterAccept.scriptCount !== 1) failures.push('script/config after accept')
if (initialPageViews !== 1) failures.push(`expected 1 initial page_view, got ${initialPageViews}`)
if (afterNavPageViews < 3) failures.push(`expected >=3 page views after SPA nav, got ${afterNavPageViews}`)
if (afterRevoke.analyticsCategory !== false) failures.push('analytics category not false after revoke')
if (!afterRevoke.disabled) failures.push('ga-disable flag not set after revoke')
if (pageViewsAfterRevoke !== afterNavPageViews) {
  failures.push('page views continued after revoke')
}

if (failures.length) {
  console.error('FAIL:', failures.join('; '))
  process.exit(1)
}

console.log('PASS: GA4 consent smoke checks')
