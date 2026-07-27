#!/usr/bin/env node
/**
 * Regression: Equipd Intelligence must never appear above seller listing content.
 *
 * Covers:
 * - DOM source structure (gallery → summary → description → intelligence)
 * - Mobile CSS no longer uses display:contents + incomplete order
 * - Live mobile/desktop order for matched and unmatched listings
 * - Panel rendered at most once
 *
 *   node scripts/test-listing-intelligence-order.mjs [baseUrl]
 */
import assert from 'node:assert/strict'
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { chromium } from 'playwright-core'

const baseUrl = (process.argv[2] ?? 'http://127.0.0.1:5173').replace(/\/$/, '')
const outDir = join(process.cwd(), 'reports', 'listing-intelligence-order')
mkdirSync(outDir, { recursive: true })

function read(rel) {
  return readFileSync(join(process.cwd(), rel), 'utf8')
}

const pageSrc = read('src/pages/ListingDetailPage.jsx')
const detailCss = read('src/components/ListingDetail.css')
const intelligenceSrc = read('src/components/listing/ListingEquipmentIntelligence.jsx')

// Source-of-truth: one intelligence component usage on the detail page.
const intelligenceUsages = pageSrc.match(/<ListingEquipmentIntelligence\b/g) ?? []
assert.equal(intelligenceUsages.length, 1, 'ListingEquipmentIntelligence must render once in JSX')

// DOM order in source: media → summary → primary(description + intelligence)
const mediaIdx = pageSrc.indexOf('className="listing-detail__media"')
const summaryIdx = pageSrc.indexOf('<ListingItemSummary')
const primaryIdx = pageSrc.indexOf('className="listing-detail__primary"')
const descriptionIdx = pageSrc.indexOf('<ListingSellerDescription')
const intelligenceIdx = pageSrc.indexOf('<ListingEquipmentIntelligence')
assert.ok(mediaIdx > 0 && summaryIdx > mediaIdx, 'media before summary in JSX')
assert.ok(primaryIdx > summaryIdx, 'primary (details) after summary in JSX')
assert.ok(descriptionIdx > primaryIdx, 'seller description inside primary after summary')
assert.ok(intelligenceIdx > descriptionIdx, 'intelligence after seller description in JSX')

assert.match(
  detailCss,
  /grid-template-areas:\s*[\s\S]*'media summary'[\s\S]*'details summary'/,
  'desktop grid areas keep summary beside media/details',
)

const mobileBlock = detailCss.match(/@media \(max-width:\s*767px\)\s*\{[\s\S]*?(?=@media|$)/)?.[0] ?? ''
assert.ok(mobileBlock.length > 0, 'mobile breakpoint present')
assert.doesNotMatch(mobileBlock, /display:\s*contents/, 'mobile must not flatten primary with display:contents')
assert.doesNotMatch(mobileBlock, /\.listing-detail__media\s*\{[^}]*order:/, 'media must not rely on CSS order')
assert.doesNotMatch(mobileBlock, /\.listing-summary\s*\{[^}]*order:/, 'summary must not rely on CSS order')
assert.doesNotMatch(
  mobileBlock,
  /\.listing-detail__seller-description\s*\{[^}]*order:/,
  'description must not rely on CSS order',
)

assert.match(intelligenceSrc, /About this equipment/, 'intelligence heading preserved')
assert.match(intelligenceSrc, /Equipd Intelligence/, 'intelligence eyebrow preserved')

async function dismissCookies(page) {
  const accept = page.getByRole('button', { name: /Accept all|Accept necessary/i }).first()
  if (await accept.count()) {
    await accept.click({ timeout: 2500 }).catch(() => {})
  }
}

async function measureOrder(page, slug) {
  await page.goto(`${baseUrl}/listings/${slug}`, { waitUntil: 'networkidle', timeout: 90000 })
  await dismissCookies(page)
  await page.waitForSelector('.listing-summary__title, .listing-detail__message', { timeout: 45000 })

  return page.evaluate(() => {
    const media = document.querySelector('.listing-detail__media')
    const summary = document.querySelector('.listing-summary')
    const title = document.querySelector('.listing-summary__title')
    const price =
      document.querySelector('.listing-summary__purchase') ||
      document.querySelector('.buyer-protection-price')
    const description = document.querySelector('.listing-detail__seller-description')
    const panels = [...document.querySelectorAll('.listing-equipment-intelligence')]
    const panel = panels[0] ?? null

    const top = (el) => (el ? Math.round(el.getBoundingClientRect().top + window.scrollY) : null)

    return {
      title: title?.textContent?.trim() || '',
      panelCount: panels.length,
      hasPanel: Boolean(panel),
      tops: {
        media: top(media),
        summary: top(summary),
        title: top(title),
        price: top(price),
        description: top(description),
        intelligence: top(panel),
      },
      heroChildren: [...(document.querySelector('.listing-detail__hero')?.children ?? [])].map(
        (el) => el.className,
      ),
      panelLinks: panel
        ? [...panel.querySelectorAll('a')].map((a) => ({
            text: a.textContent?.trim(),
            href: a.getAttribute('href'),
          }))
        : [],
      aboutHeading: panel?.querySelector('#listing-equipment-intelligence-title')?.textContent?.trim() || null,
      panelText: panel?.textContent?.replace(/\s+/g, ' ').trim() || '',
      hasEstimatedValue: /Estimated|market value/i.test(panel?.textContent || ''),
    }
  })
}

function assertSellerBeforeIntelligence(state, label) {
  const { tops } = state
  assert.ok(tops.media != null, `${label}: gallery present`)
  assert.ok(tops.summary != null, `${label}: summary present`)
  assert.ok(tops.title != null, `${label}: title present`)
  assert.ok(tops.price != null, `${label}: price/actions present`)

  if (!state.hasPanel) return

  assert.equal(state.panelCount, 1, `${label}: intelligence rendered once`)
  assert.ok(tops.intelligence != null, `${label}: intelligence present`)
  assert.ok(tops.media < tops.intelligence, `${label}: gallery before intelligence`)
  assert.ok(tops.title < tops.intelligence, `${label}: title before intelligence`)
  assert.ok(tops.price < tops.intelligence, `${label}: price/actions before intelligence`)
  if (tops.description != null) {
    assert.ok(tops.description < tops.intelligence, `${label}: description before intelligence`)
  }
  assert.equal(state.aboutHeading, 'About this equipment', `${label}: heading preserved`)
}

const MATCHED_ACTIVE = 'precor-experience-precor-trm835-f31f072c'
const MATCHED_ACTIVE_2 = 'proform-carbon-tl-e3d7d0d0'
const UNMATCHED_ACTIVE = 'life-fitness-crosstrainers-alderley-edge'
const SOLD_UNMATCHED = 'qa-carousel-seed-01-technogym-skillmill'

const browser = await chromium.launch({ headless: true, channel: 'msedge' })
const results = {}

for (const viewport of [
  { name: 'mobile-390', width: 390, height: 844 },
  { name: 'mobile-430', width: 430, height: 932 },
  { name: 'desktop-1024', width: 1024, height: 900 },
  { name: 'desktop-1440', width: 1440, height: 900 },
]) {
  const page = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height } })

  const matched = await measureOrder(page, MATCHED_ACTIVE)
  assertSellerBeforeIntelligence(matched, `${viewport.name}/matched`)
  assert.equal(matched.hasPanel, true, `${viewport.name}: matched listing shows intelligence`)
  assert.ok(
    matched.panelLinks.some((link) => link.href),
    `${viewport.name}: intelligence links present`,
  )
  assert.equal(
    matched.hasEstimatedValue,
    true,
    `${viewport.name}: matched listing includes estimated market value`,
  )

  const unmatched = await measureOrder(page, UNMATCHED_ACTIVE)
  assertSellerBeforeIntelligence(unmatched, `${viewport.name}/unmatched`)
  assert.equal(unmatched.hasPanel, false, `${viewport.name}: unmatched listing has no intelligence panel`)
  assert.equal(unmatched.panelCount, 0, `${viewport.name}: unmatched panel count is 0`)

  // Second matched listing (partial/full intelligence still after seller content).
  const matched2 = await measureOrder(page, MATCHED_ACTIVE_2)
  assertSellerBeforeIntelligence(matched2, `${viewport.name}/matched2`)

  const sold = await measureOrder(page, SOLD_UNMATCHED)
  assertSellerBeforeIntelligence(sold, `${viewport.name}/sold`)
  assert.equal(sold.hasPanel, false, `${viewport.name}: sold unmatched has no intelligence panel`)
  assert.ok(sold.tops.media < sold.tops.title, `${viewport.name}: sold gallery before title`)

  if (viewport.name === 'mobile-390') {
    await page.goto(`${baseUrl}/listings/${MATCHED_ACTIVE}`, {
      waitUntil: 'networkidle',
      timeout: 90000,
    })
    await dismissCookies(page)
    await page.waitForSelector('.listing-summary__title', { timeout: 45000 })
    await page.screenshot({
      path: join(outDir, 'mobile-390-matched-full.png'),
      fullPage: true,
    })
  }

  if (viewport.name === 'desktop-1440') {
    await page.goto(`${baseUrl}/listings/${MATCHED_ACTIVE}`, {
      waitUntil: 'networkidle',
      timeout: 90000,
    })
    await dismissCookies(page)
    await page.waitForSelector('.listing-summary__title', { timeout: 45000 })
    await page.screenshot({
      path: join(outDir, 'desktop-1440-matched-full.png'),
      fullPage: true,
    })
  }

  results[viewport.name] = {
    matched: {
      title: matched.title,
      panelCount: matched.panelCount,
      tops: matched.tops,
      heroChildren: matched.heroChildren,
      panelLinks: matched.panelLinks,
    },
    unmatched: {
      title: unmatched.title,
      panelCount: unmatched.panelCount,
      tops: unmatched.tops,
    },
    matched2: {
      title: matched2.title,
      panelCount: matched2.panelCount,
      tops: matched2.tops,
    },
    sold: {
      title: sold.title,
      panelCount: sold.panelCount,
      tops: sold.tops,
    },
  }

  await page.close()
}

await browser.close()
writeFileSync(join(outDir, 'results.json'), JSON.stringify({ baseUrl, results }, null, 2))

console.log(JSON.stringify({ outDir, results }, null, 2))
console.log('PASS: listing intelligence order')
