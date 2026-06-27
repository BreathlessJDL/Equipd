#!/usr/bin/env node
/**
 * Phase 3: browse scroll + mobile search navigation.
 *
 *   node scripts/test-phase3-navigation.mjs [baseUrl]
 */
import { chromium } from 'playwright-core'
import {
  buildBrowseSearchPath,
  shouldNavigateToBrowseOnMobileSearch,
} from '../src/lib/browseSearchNavigation.js'
import { BROWSE_FILTERS_ANCHOR_ID } from '../src/lib/scrollToBrowseAnchor.js'

const baseUrl = process.argv[2] ?? 'http://localhost:5173'

let failures = 0

function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`)
    failures += 1
    return false
  }
  console.log(`PASS: ${message}`)
  return true
}

assert(buildBrowseSearchPath('spin bike') === '/browse?search=spin%20bike', 'Browse search path encodes query')
assert(buildBrowseSearchPath('  ') === '/browse', 'Empty search opens browse')
assert(shouldNavigateToBrowseOnMobileSearch('/') === true, 'Homepage uses mobile search redirect')
assert(shouldNavigateToBrowseOnMobileSearch('/browse') === false, 'Browse page keeps in-page search')

async function browseAnchorState(page) {
  return page.evaluate((anchorId) => {
    const header = document.querySelector('.global-site-header')
    const anchor = document.getElementById(anchorId)
    const headerBottom = header ? Math.round(header.getBoundingClientRect().bottom) : 0
    const anchorTop = anchor ? Math.round(anchor.getBoundingClientRect().top) : null
    return {
      anchorTop,
      headerBottom,
      pathname: window.location.pathname,
      search: window.location.search,
    }
  }, BROWSE_FILTERS_ANCHOR_ID)
}

const browser = await chromium.launch({ headless: true, channel: 'msedge' })

try {
  const desktop = await browser.newPage({ viewport: { width: 1280, height: 900 } })
  await desktop.goto(`${baseUrl}/`, { waitUntil: 'networkidle', timeout: 45000 })
  await desktop.waitForSelector('.category-text-nav__link', { timeout: 15000 })
  await desktop.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
  await desktop.waitForTimeout(300)

  await desktop.locator('.category-text-nav__link', { hasText: 'Treadmills' }).first().click()
  await desktop.waitForFunction(() => {
    const header = document.querySelector('.global-site-header')
    const anchor = document.getElementById('browse-filters-anchor')
    if (!header || !anchor) return false
    const offset = anchor.getBoundingClientRect().top - header.getBoundingClientRect().bottom
    return Math.abs(offset) <= 24
  }, null, { timeout: 5000 })

  const desktopCategory = await browseAnchorState(desktop)
  assert(
    desktopCategory.anchorTop !== null &&
      desktopCategory.anchorTop >= desktopCategory.headerBottom - 4 &&
      desktopCategory.anchorTop <= desktopCategory.headerBottom + 24,
    'Desktop category nav scrolls filters below sticky header',
  )

  await desktop.locator('#browse-filters-anchor .browse-filter-pill__trigger', { hasText: 'Brand' }).click()
  await desktop.locator('.browse-filter-option-list__option', { hasText: 'Life Fitness' }).first().click()
  await desktop.waitForTimeout(700)

  const desktopBrand = await browseAnchorState(desktop)
  assert(
    desktopBrand.anchorTop !== null &&
      desktopBrand.anchorTop >= desktopBrand.headerBottom - 4 &&
      desktopBrand.anchorTop <= desktopBrand.headerBottom + 24,
    'Desktop brand filter scrolls filters below sticky header',
  )

  await desktop.close()

  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } })
  await mobile.goto(`${baseUrl}/`, { waitUntil: 'networkidle', timeout: 45000 })
  await mobile.waitForSelector('#home-search', { timeout: 15000 })

  await mobile.fill('#home-search', 'rogue rack')
  await mobile.locator('.home-header__search-button').click()
  await mobile.waitForURL(/\/browse/, { timeout: 10000 })

  const mobileSearch = await browseAnchorState(mobile)
  assert(mobileSearch.pathname === '/browse', 'Mobile homepage search navigates to browse')
  assert(mobileSearch.search.includes('rogue'), 'Mobile homepage search preserves query in URL')

  await mobile.close()
} catch (error) {
  failures += 1
  console.error('FAIL: Playwright checks threw', error.message)
} finally {
  await browser.close()
}

if (failures > 0) {
  console.error(`\n${failures} check(s) failed`)
  process.exitCode = 1
} else {
  console.log('\nAll phase 3 navigation checks passed')
}
