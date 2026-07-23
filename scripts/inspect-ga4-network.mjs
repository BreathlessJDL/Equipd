/**
 * Verbose network + dataLayer dump after analytics consent.
 * Run: node scripts/inspect-ga4-network.mjs [baseUrl]
 */

import { chromium } from 'playwright-core'

const baseUrl = (process.argv[2] ?? 'http://127.0.0.1:4173').replace(/\/$/, '')

const browser = await chromium.launch({ headless: true, channel: 'msedge' })
const context = await browser.newContext()
const page = await context.newPage()

const network = []
page.on('request', (req) => {
  const url = req.url()
  if (
    url.includes('google') ||
    url.includes('doubleclick') ||
    url.includes('g/collect') ||
    url.includes('gtag')
  ) {
    network.push({ type: 'req', method: req.method(), url })
  }
})
page.on('response', (res) => {
  const url = res.url()
  if (
    url.includes('google') ||
    url.includes('doubleclick') ||
    url.includes('g/collect') ||
    url.includes('gtag')
  ) {
    network.push({ type: 'res', status: res.status(), url })
  }
})

await page.goto(baseUrl + '/', { waitUntil: 'domcontentloaded', timeout: 60000 })
await page.locator('.cookie-banner').getByRole('button', { name: 'Cookie settings' }).click()
await page.locator('.cookie-settings-modal').getByRole('button', { name: 'Accept all' }).click()
await page.waitForTimeout(5000)

const state = await page.evaluate(() => {
  const layer = (window.dataLayer || []).map((e) => {
    try {
      return Array.from(e)
    } catch {
      return e
    }
  })
  return {
    layer: layer.map((e) => JSON.stringify(e)),
    script: [...document.querySelectorAll('script')].map((s) => s.src).filter((s) => s.includes('gtag')),
    disable: window['ga-disable-G-M5767NZQ85'],
  }
})

console.log('STATE', JSON.stringify(state, null, 2))
console.log('NETWORK')
for (const entry of network) {
  console.log(JSON.stringify(entry))
}

await browser.close()
