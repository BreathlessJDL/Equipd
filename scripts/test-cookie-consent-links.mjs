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

check('Cookie policy does not claim GA is active', () => {
  const articleMatch = helpSource.match(/slug: 'cookie-policy'[\s\S]*?},\n  \]/)
  const articleText = articleMatch?.[0] ?? helpSource
  const falseClaims = [
    /Google Analytics is (currently )?active/i,
    /we use Google Analytics/i,
    /Meta Pixel is (currently )?active/i,
    /Microsoft Clarity is (currently )?active/i,
  ]
  for (const pattern of falseClaims) {
    if (pattern.test(articleText)) {
      throw new Error(`Cookie policy may falsely claim active tracking: ${pattern}`)
    }
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
