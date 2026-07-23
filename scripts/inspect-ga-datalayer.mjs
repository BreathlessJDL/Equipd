/**
 * Dump exact runtime dataLayer / gtag command sequence on production.
 * Run: node scripts/inspect-ga-datalayer.mjs [baseUrl]
 */

import { chromium } from 'playwright-core'

const baseUrl = (process.argv[2] ?? 'https://www.equipd.co.uk').replace(/\/$/, '')

const browser = await chromium.launch({ headless: true, channel: 'msedge' })
const page = await browser.newPage()

await page.addInitScript(() => {
  window.__equipdDataLayerLog = []

  function serializeEntry(entry) {
    try {
      return Array.from(entry).map((value) => {
        if (value instanceof Date) return { __date: value.toISOString() }
        if (value && typeof value === 'object') return JSON.parse(JSON.stringify(value))
        return value
      })
    } catch {
      return String(entry)
    }
  }

  window.dataLayer = window.dataLayer || []
  const originalPush = window.dataLayer.push.bind(window.dataLayer)
  window.dataLayer.push = function patchedPush(...args) {
    for (const arg of args) {
      const serialized = serializeEntry(arg)
      window.__equipdDataLayerLog.push({
        phase: 'dataLayer.push',
        at: new Date().toISOString(),
        serialized,
        json: JSON.stringify(serialized),
      })
    }
    return originalPush(...args)
  }
})

await page.goto(baseUrl + '/', { waitUntil: 'networkidle', timeout: 60000 })
await page.waitForTimeout(500)

const banner = page.locator('.cookie-banner')
await banner.waitFor({ timeout: 10000 })
await banner.getByRole('button', { name: 'Cookie settings' }).click()
await page.locator('.cookie-settings-modal').getByRole('button', { name: 'Accept all' }).click()
await page.waitForTimeout(3500)

const result = await page.evaluate(() => {
  function serializeEntry(entry) {
    try {
      return Array.from(entry).map((value) => {
        if (value instanceof Date) return { __date: value.toISOString() }
        if (value && typeof value === 'object') return JSON.parse(JSON.stringify(value))
        return value
      })
    } catch (error) {
      return { error: String(error), rawType: typeof entry }
    }
  }

  const fromLog = window.__equipdDataLayerLog || []
  const liveLayer = (window.dataLayer || []).map((entry, index) => {
    const serialized = serializeEntry(entry)
    return {
      index,
      serialized,
      json: JSON.stringify(serialized),
    }
  })

  const configs = liveLayer.filter((e) => Array.isArray(e.serialized) && e.serialized[0] === 'config')
  const pageViews = liveLayer.filter(
    (e) => Array.isArray(e.serialized) && e.serialized[0] === 'event' && e.serialized[1] === 'page_view',
  )
  const jsCmds = liveLayer.filter((e) => Array.isArray(e.serialized) && e.serialized[0] === 'js')

  return {
    liveLayer,
    fromLog,
    summary: {
      totalEntries: liveLayer.length,
      jsCommands: jsCmds.map((e) => e.json),
      configTargets: configs.map((e) => e.serialized[1]),
      configExact: configs.map((e) => e.json),
      pageViewCount: pageViews.length,
      pageViewsExact: pageViews.map((e) => e.json),
      hasConfigGT: configs.some((e) => e.serialized[1] === 'GT-MK48KZH9'),
      hasConfigGA4: configs.some((e) => e.serialized[1] === 'G-M5767NZQ85'),
      scriptSrc: [...document.querySelectorAll('script')]
        .map((s) => s.src)
        .find((s) => s.includes('googletagmanager.com/gtag/js')),
    },
  }
})

console.log('=== SUMMARY ===')
console.log(JSON.stringify(result.summary, null, 2))

console.log('\n=== EXACT LIVE window.dataLayer SEQUENCE ===')
for (const entry of result.liveLayer) {
  console.log('#' + entry.index + ': ' + entry.json)
}

console.log('\n=== CAPTURED dataLayer.push LOG (runtime order) ===')
for (let i = 0; i < result.fromLog.length; i += 1) {
  const entry = result.fromLog[i]
  console.log('log#' + i + ' [' + entry.phase + ']: ' + entry.json)
}

await browser.close()
