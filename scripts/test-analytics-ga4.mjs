/**
 * GA4 consent-gated loader behaviour.
 * Run: node scripts/test-analytics-ga4.mjs
 */

import assert from 'node:assert/strict'
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const analyticsSource = readFileSync(join(root, 'src/lib/analytics.js'), 'utf8')
const appSource = readFileSync(join(root, 'src/App.jsx'), 'utf8')
const tmpDir = join(root, 'scripts', '.tmp-analytics-tests')

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

check('Measurement ID G-M5767NZQ85 is present', () => {
  if (!analyticsSource.includes('G-M5767NZQ85')) {
    throw new Error('Missing measurement ID G-M5767NZQ85')
  }
})

check('send_page_view disabled on config', () => {
  if (!/send_page_view:\s*false/.test(analyticsSource)) {
    throw new Error('GA config must set send_page_view: false')
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
      if (selector.includes('data-ga-measurement-id')) {
        return scripts.find((script) => script.dataset?.gaMeasurementId) ?? null
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
  assert.equal(document.querySelector('script[data-ga-measurement-id="G-M5767NZQ85"]'), null)
})

await checkAsync('Accept all / analytics granted: initialises once and sends one page view', async () => {
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
  assert.match(scripts[0].src, /googletagmanager\.com\/gtag\/js\?id=G-M5767NZQ85/)

  const entries = layerEntries()
  const pageViews = entries.filter((entry) => entry[0] === 'event' && entry[1] === 'page_view')
  assert.equal(pageViews.length, 1)

  const configs = entries.filter((entry) => entry[0] === 'config')
  assert.equal(configs.length, 1)
  assert.equal(configs[0][1], 'G-M5767NZQ85')
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
  assert.equal(document.querySelector('script[data-ga-measurement-id="G-M5767NZQ85"]'), null)
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
