/**
 * Verifies Cookie Consent Phase 2 legal routes and help article slugs.
 * Run: node scripts/test-cookie-consent-links.mjs
 */

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

function readSource(relativePath) {
  return readFileSync(join(root, relativePath), 'utf8')
}

const helpSource = readSource('src/data/helpArticles.js')
const cookieConsentSource = readSource('src/lib/cookieConsent.js')
const footerSource = readSource('src/components/layout/SiteFooter.jsx')
const settingsSource = readSource('src/pages/SettingsPage.jsx')
const bannerSource = readSource('src/components/cookies/CookieBanner.jsx')
const modalSource = readSource('src/components/cookies/CookieSettingsModal.jsx')

const paths = {
  cookiePolicy: '/help/cookie-policy',
  privacyPolicy: '/help/privacy-policy',
  terms: '/help/terms-and-conditions',
}

function extractSlug(path) {
  return path.replace('/help/', '')
}

function assertArticleExists(slug, label) {
  const pattern = new RegExp(`slug:\\s*['"]${slug}['"]`)
  if (!pattern.test(helpSource)) {
    throw new Error(`Missing help article slug for ${label}: ${slug}`)
  }
}

function assertPathOrConstantInSource(path, constantName, label, ...sources) {
  const hasPath = sources.some((source) => source.includes(path))
  const hasConstant = sources.some((source) => source.includes(constantName))
  if (!hasPath && !hasConstant) {
    throw new Error(
      `${label} missing path (${path}) or constant (${constantName}) in expected source files`,
    )
  }
}

function assertConstantMatches(label, constantName, expectedPath) {
  const match = cookieConsentSource.match(
    new RegExp(`export const ${constantName}\\s*=\\s*['"]([^'"]+)['"]`),
  )
  if (!match) {
    throw new Error(`Constant ${constantName} not found in cookieConsent.js`)
  }
  if (match[1] !== expectedPath) {
    throw new Error(`${constantName} is ${match[1]}, expected ${expectedPath}`)
  }
}

const checks = []

function check(name, fn) {
  try {
    fn()
    checks.push({ name, ok: true })
  } catch (error) {
    checks.push({ name, ok: false, error: error.message })
  }
}

check('COOKIE_POLICY_PATH constant', () =>
  assertConstantMatches('Cookie Policy', 'COOKIE_POLICY_PATH', paths.cookiePolicy),
)
check('PRIVACY_POLICY_PATH constant', () =>
  assertConstantMatches('Privacy Policy', 'PRIVACY_POLICY_PATH', paths.privacyPolicy),
)
check('TERMS_PATH constant', () => assertConstantMatches('Terms', 'TERMS_PATH', paths.terms))

for (const [label, path] of Object.entries(paths)) {
  check(`Help article exists: ${label}`, () => assertArticleExists(extractSlug(path), label))
}

check('Footer Cookie Policy link', () =>
  assertPathOrConstantInSource(
    paths.cookiePolicy,
    'COOKIE_POLICY_PATH',
    'Cookie Policy',
    footerSource,
  ),
)
check('Footer Privacy Policy link', () =>
  assertPathOrConstantInSource(
    paths.privacyPolicy,
    'PRIVACY_POLICY_PATH',
    'Privacy Policy',
    footerSource,
  ),
)
check('Footer Terms link', () =>
  assertPathOrConstantInSource(paths.terms, 'TERMS_PATH', 'Terms', footerSource),
)
check('Footer Cookie Settings handler', () => {
  if (!footerSource.includes('openCookieSettings')) {
    throw new Error('SiteFooter missing openCookieSettings')
  }
})

check('Settings Cookie Policy link', () =>
  assertPathOrConstantInSource(
    paths.cookiePolicy,
    'COOKIE_POLICY_PATH',
    'Cookie Policy',
    settingsSource,
  ),
)
check('Settings Privacy Policy link', () =>
  assertPathOrConstantInSource(
    paths.privacyPolicy,
    'PRIVACY_POLICY_PATH',
    'Privacy Policy',
    settingsSource,
  ),
)
check('Settings Terms link', () =>
  assertPathOrConstantInSource(paths.terms, 'TERMS_PATH', 'Terms', settingsSource),
)
check('Settings Cookie settings button', () => {
  if (!settingsSource.includes('openCookieSettings')) {
    throw new Error('SettingsPage missing openCookieSettings')
  }
})

check('Banner Cookie Policy link', () =>
  assertPathOrConstantInSource(
    paths.cookiePolicy,
    'COOKIE_POLICY_PATH',
    'Cookie Policy',
    bannerSource,
  ),
)
check('Modal Cookie Policy link', () =>
  assertPathOrConstantInSource(
    paths.cookiePolicy,
    'COOKIE_POLICY_PATH',
    'Cookie Policy',
    modalSource,
  ),
)

check('App help route', () => {
  const appSource = readSource('src/App.jsx')
  if (!appSource.includes('help/:slug')) {
    throw new Error('App.jsx missing help/:slug route')
  }
})

check('Cookie policy mentions consent storage key', () => {
  if (!helpSource.includes('equipd_cookie_consent')) {
    throw new Error('Cookie policy article should mention equipd_cookie_consent')
  }
})

check('Cookie policy describes consent-gated Google Analytics', () => {
  const articleMatch = helpSource.match(/slug: 'cookie-policy'[\s\S]*?},\n  \{/)
  const articleText = articleMatch?.[0] ?? helpSource
  if (!/Google Analytics 4/i.test(articleText)) {
    throw new Error('Cookie policy should mention Google Analytics 4')
  }
  if (
    !/only (loaded|run) if you (consent|opt in)/i.test(articleText) &&
    !/after you opt in/i.test(articleText)
  ) {
    throw new Error('Cookie policy should state GA only runs after consent')
  }
  if (/Meta Pixel is (currently )?active/i.test(articleText)) {
    throw new Error('Cookie policy should not claim Meta Pixel is active')
  }
  if (/Microsoft Clarity is (currently )?active/i.test(articleText)) {
    throw new Error('Cookie policy should not claim Microsoft Clarity is active')
  }
})

check('Cookie settings shows Analytics with Google Analytics copy', () => {
  if (!modalSource.includes('getVisibleOptionalCookieCategories')) {
    throw new Error('CookieSettingsModal should use getVisibleOptionalCookieCategories')
  }
  if (!cookieConsentSource.includes('Google Analytics is only loaded')) {
    throw new Error('Analytics category description should mention Google Analytics gating')
  }
  if (!cookieConsentSource.includes('uiVisible: false')) {
    throw new Error(
      'Inactive marketing/preferences categories should be hidden from Cookie Settings UI',
    )
  }
})

check('Banner mentions Analytics cookies and Cookie settings', () => {
  if (!bannerSource.includes('Accept all')) {
    throw new Error('Banner should offer Accept all')
  }
  if (!bannerSource.includes('Reject non-essential')) {
    throw new Error('Banner should offer Reject non-essential')
  }
  if (!bannerSource.includes('Cookie settings')) {
    throw new Error('Banner should offer Cookie settings')
  }
  if (!bannerSource.includes('Google Analytics')) {
    throw new Error('Banner should mention Google Analytics')
  }
})

check('App mounts AnalyticsPageViews inside CookieConsentProvider', () => {
  const appSource = readSource('src/App.jsx')
  if (!appSource.includes('AnalyticsPageViews')) {
    throw new Error('App.jsx missing AnalyticsPageViews')
  }
  if (!appSource.includes('CookieConsentProvider')) {
    throw new Error('App.jsx missing CookieConsentProvider')
  }
  if (!appSource.includes('CookieConsentShell')) {
    throw new Error('App.jsx missing CookieConsentShell')
  }
})

const failed = checks.filter((entry) => !entry.ok)

console.log('Cookie consent link verification\n')
for (const entry of checks) {
  console.log(entry.ok ? `  ✓ ${entry.name}` : `  ✗ ${entry.name}: ${entry.error}`)
}

if (failed.length) {
  console.error(`\n${failed.length} check(s) failed.`)
  process.exit(1)
}

console.log(`\nAll ${checks.length} checks passed.`)
