/**
 * GA4 consent-gated loader behaviour.
 * Run: node scripts/test-analytics-ga4.mjs
 *
 * Distinguishes:
 * - script-loading Google tag ID: GT-MK48KZH9
 * - connected GA4 destination ID: G-M5767NZQ85
 */

import assert from 'node:assert/strict'
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const analyticsSource = readFileSync(join(root, 'src/lib/analytics.js'), 'utf8')
const appSource = readFileSync(join(root, 'src/App.jsx'), 'utf8')
const tmpDir = join(root, 'scripts', '.tmp-analytics-tests')

const GOOGLE_TAG_ID = 'GT-MK48KZH9'
const GA4_MEASUREMENT_ID = 'G-M5767NZQ85'

const checks = []

function check(name, fn) {
  try {
    fn()
    checks.push({ name, ok: true })
  } catch (error) {
    checks.push({ name, ok: false, error: error.message })
  }
}

async function checkAsync(name, fn) {
  try {
    await fn()
    checks.push({ name, ok: true })
  } catch (error) {
    checks.push({ name, ok: false, error: error.message })
  }
}

check('gtag stub pushes arguments (not rest Array)', () => {
  if (!/dataLayer\.push\(arguments\)/.test(analyticsSource)) {
    throw new Error('ensureGtag must use dataLayer.push(arguments)')
  }
  if (/dataLayer\.push\(args\)/.test(analyticsSource)) {
    throw new Error('ensureGtag must not push a rest-parameter Array')
  }
})

check('separates Google tag ID from GA4 destination ID', () => {
  if (!analyticsSource.includes(`GOOGLE_TAG_ID = '${GOOGLE_TAG_ID}'`)) {
    throw new Error(`Missing GOOGLE_TAG_ID constant ${GOOGLE_TAG_ID}`)
  }
  if (!analyticsSource.includes(`GA4_MEASUREMENT_ID = '${GA4_MEASUREMENT_ID}'`)) {
    throw new Error(`Missing GA4_MEASUREMENT_ID constant ${GA4_MEASUREMENT_ID}`)
  }
  if (/gtag\/js\?id=\$\{.*[Gg]a4|gtag\/js\?id=\$\{.*[Mm]easurement/.test(analyticsSource)) {
    // soft: ensure inject uses googleTagId param name
  }
  if (!/gtag\/js\?id=\$\{googleTagId\}/.test(analyticsSource)) {
    throw new Error('gtag.js script URL must use googleTagId, not the GA4 destination')
  }
  if (/gtag\('config',\s*measurementId/.test(analyticsSource) || /gtag\('config',\s*getGa4/.test(analyticsSource)) {
    throw new Error('gtag config must target the Google tag ID, not the GA4 destination')
  }
})

check('send_page_view disabled on config', () => {
  if (!/send_page_view:\s*false/.test(analyticsSource)) {
    throw new Error('GA config must set send_page_view: false')
  }
})

check('does not config GA4 destination separately (avoids duplicate events)', () => {
  if (new RegExp(`gtag\\(['"]config['"],\\s*['"]${GA4_MEASUREMENT_ID}['"]`).test(analyticsSource)) {
    throw new Error('Must not gtag config the GA4 destination ID directly')
  }
})

check('App mounts AnalyticsPageViews for all users', () => {
  if (!appSource.includes('AnalyticsPageViews')) {
    throw new Error('App.jsx must mount AnalyticsPageViews')
  }
  if (!appSource.includes('CookieConsentProvider')) {
    throw new Error('Analytics must sit under CookieConsentProvider')
  }
  const analyticsIdx = appSource.indexOf('<AnalyticsPageViews')
  const routesIdx = appSource.indexOf('<Routes>')
  if (analyticsIdx < 0 || routesIdx < 0 || analyticsIdx > routesIdx) {
    throw new Error('AnalyticsPageViews should mount alongside public shell, before Routes')
  }
})

function installDomStub() {
  const cookies = new Map()
  const scripts = []

  globalThis.window = {
    location: {
      hostname: 'www.equipd.co.uk',
      origin: 'https://www.equipd.co.uk',
      pathname: '/',
      search: '',
    },
    dataLayer: [],
  }

  globalThis.document = {
    title: 'Equipd',
    head: {
      appendChild(node) {
        scripts.push(node)
        return node
      },
    },
    querySelector(selector) {
      if (selector.includes('data-google-tag-id')) {
        return scripts.find((script) => script.dataset?.googleTagId) ?? null
      }
      return null
    },
    createElement(tag) {
      if (tag !== 'script') return {}
      return {
        async: false,
        src: '',
        dataset: {},
      }
    },
  }

  Object.defineProperty(globalThis.document, 'cookie', {
    configurable: true,
    get() {
      return [...cookies.entries()].map(([k, v]) => `${k}=${v}`).join('; ')
    },
    set(value) {
      const [pair] = String(value).split(';')
      const [name, ...rest] = pair.split('=')
      const cookieValue = rest.join('=')
      if (String(value).toLowerCase().includes('expires=thu, 01 jan 1970')) {
        cookies.delete(name.trim())
      } else {
        cookies.set(name.trim(), cookieValue)
      }
    },
  })

  return { scripts, cookies }
}

async function loadAnalyticsModule({ prod = true, enableAnalytics = false } = {}) {
  mkdirSync(tmpDir, { recursive: true })
  const outfile = join(tmpDir, `analytics-${prod ? 'prod' : 'dev'}-${enableAnalytics}.mjs`)

  const envLiteral = JSON.stringify({
    PROD: prod,
    DEV: !prod,
    MODE: prod ? 'production' : 'development',
    VITE_ENABLE_ANALYTICS: enableAnalytics ? 'true' : '',
    VITE_GOOGLE_TAG_ID: '',
    VITE_GA_MEASUREMENT_ID: '',
  })

  const rewritten = analyticsSource.replace(
    /const viteEnv = import\.meta\.env \?\? \{\}/,
    `const viteEnv = ${envLiteral}`,
  )

  if (rewritten === analyticsSource) {
    throw new Error('Failed to rewrite import.meta.env for analytics test harness')
  }

  writeFileSync(outfile, rewritten, 'utf8')
  return import(`${pathToFileURL(outfile).href}?t=${Date.now()}-${Math.random()}`)
}

function layerEntries() {
  return window.dataLayer.map((entry) => Array.from(entry))
}

await checkAsync('first visit: analytics not loaded without consent', async () => {
  installDomStub()
  const analytics = await loadAnalyticsModule({ prod: true })
  analytics.resetAnalyticsProvidersForTesting()
  analytics.applyConsentedAnalytics(null)
  assert.equal(analytics.isGoogleAnalyticsReady(), false)
  assert.equal(document.querySelector(`script[data-google-tag-id="${GOOGLE_TAG_ID}"]`), null)
})

await checkAsync('Accept all: loads GT tag once, configs GT once, one page_view', async () => {
  const { scripts } = installDomStub()
  const analytics = await loadAnalyticsModule({ prod: true })
  analytics.resetAnalyticsProvidersForTesting()

  const consent = {
    categories: { necessary: true, analytics: true, marketing: true, preferences: true },
  }
  analytics.applyConsentedAnalytics(consent)
  analytics.applyConsentedAnalytics(consent)

  assert.equal(analytics.isGoogleAnalyticsReady(), true)
  assert.equal(scripts.length, 1)
  assert.equal(scripts[0].src, `https://www.googletagmanager.com/gtag/js?id=${GOOGLE_TAG_ID}`)
  assert.equal(scripts[0].dataset.googleTagId, GOOGLE_TAG_ID)

  const entries = layerEntries()
  const pageViews = entries.filter((entry) => entry[0] === 'event' && entry[1] === 'page_view')
  assert.equal(pageViews.length, 1)

  const configs = entries.filter((entry) => entry[0] === 'config')
  assert.equal(configs.length, 1)
  assert.equal(configs[0][1], GOOGLE_TAG_ID)
  assert.notEqual(configs[0][1], GA4_MEASUREMENT_ID)
  assert.equal(configs[0][2].send_page_view, false)
})

await checkAsync('Reject / denied: events blocked and scripts not inserted', async () => {
  installDomStub()
  const analytics = await loadAnalyticsModule({ prod: true })
  analytics.resetAnalyticsProvidersForTesting()
  analytics.applyConsentedAnalytics({
    categories: { necessary: true, analytics: false, marketing: false, preferences: false },
  })
  assert.equal(analytics.isGoogleAnalyticsReady(), false)
  assert.equal(analytics.trackEvent('test_event'), false)
  assert.equal(analytics.trackPageView('/browse'), false)
  assert.equal(document.querySelector(`script[data-google-tag-id="${GOOGLE_TAG_ID}"]`), null)
})

await checkAsync('route page views send once while granted', async () => {
  installDomStub()
  const analytics = await loadAnalyticsModule({ prod: true })
  analytics.resetAnalyticsProvidersForTesting()
  analytics.applyConsentedAnalytics({
    categories: { necessary: true, analytics: true },
  })
  const before = layerEntries().filter((e) => e[0] === 'event' && e[1] === 'page_view').length
  assert.equal(analytics.trackPageView('/browse'), true)
  assert.equal(analytics.trackPageView('/brands'), true)
  const after = layerEntries().filter((e) => e[0] === 'event' && e[1] === 'page_view').length
  assert.equal(after - before, 2)
})

await checkAsync('revoking analytics disables events and clears GA cookies', async () => {
  const { cookies } = installDomStub()
  document.cookie = '_ga=GA1.1.123'
  document.cookie = '_ga_M5767NZQ85=GS1.1.456'

  const analytics = await loadAnalyticsModule({ prod: true })
  analytics.resetAnalyticsProvidersForTesting()
  analytics.applyConsentedAnalytics({
    categories: { necessary: true, analytics: true },
  })
  assert.equal(analytics.isGoogleAnalyticsReady(), true)

  analytics.applyConsentedAnalytics({
    categories: { necessary: true, analytics: false },
  })
  assert.equal(analytics.isGoogleAnalyticsReady(), false)
  assert.equal(analytics.trackEvent('after_revoke'), false)
  assert.equal(cookies.has('_ga'), false)
  assert.equal(cookies.has('_ga_M5767NZQ85'), false)
  assert.equal(window[`ga-disable-${GOOGLE_TAG_ID}`], true)
})

await checkAsync('re-grant after revoke initialises again without duplicate scripts', async () => {
  const { scripts } = installDomStub()
  const analytics = await loadAnalyticsModule({ prod: true })
  analytics.resetAnalyticsProvidersForTesting()

  analytics.applyConsentedAnalytics({
    categories: { necessary: true, analytics: true },
  })
  analytics.applyConsentedAnalytics({
    categories: { necessary: true, analytics: false },
  })
  analytics.applyConsentedAnalytics({
    categories: { necessary: true, analytics: true },
  })

  assert.equal(analytics.isGoogleAnalyticsReady(), true)
  assert.equal(scripts.length, 1)

  const configs = layerEntries().filter((entry) => entry[0] === 'config')
  // config once on first grant; re-grant after revoke configs again (allowed) but not duplicated while granted
  assert.ok(configs.length >= 1)
  assert.ok(configs.every((entry) => entry[1] === GOOGLE_TAG_ID))
})

await checkAsync('local development does not send unless explicitly enabled', async () => {
  installDomStub()
  const analytics = await loadAnalyticsModule({ prod: false, enableAnalytics: false })
  analytics.resetAnalyticsProvidersForTesting()
  analytics.applyConsentedAnalytics({
    categories: { necessary: true, analytics: true },
  })
  assert.equal(analytics.isGoogleAnalyticsReady(), false)
})

try {
  rmSync(tmpDir, { recursive: true, force: true })
} catch {
  // ignore cleanup errors
}

console.log('Analytics GA4 consent checks\n')
for (const entry of checks) {
  console.log(entry.ok ? `  ✓ ${entry.name}` : `  ✗ ${entry.name}: ${entry.error}`)
}

const failed = checks.filter((entry) => !entry.ok)
if (failed.length) {
  console.error(`\n${failed.length} check(s) failed.`)
  process.exit(1)
}

console.log(`\nAll ${checks.length} checks passed.`)
