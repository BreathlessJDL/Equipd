#!/usr/bin/env node
/**
 * Regression: listing-detail column order.
 *
 * Covers:
 * - DOM source structure (gallery → description → summary → intelligence)
 * - Desktop: description sits in the left column under the gallery, not below the sidebar
 * - Mobile: natural order gallery → description → summary → intelligence
 * - Mobile CSS no longer uses display:contents + incomplete order
 * - Equipd Intelligence never appears above seller listing title/price
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

// DOM order: media → description → summary → intelligence (mobile-natural; desktop via grid areas)
const heroIdx = pageSrc.indexOf('className="listing-detail__hero"')
const mediaIdx = pageSrc.indexOf('className="listing-detail__media"')
const summaryIdx = pageSrc.indexOf('<ListingItemSummary')
const descriptionIdx = pageSrc.indexOf('<ListingSellerDescription')
const intelligenceIdx = pageSrc.indexOf('<ListingEquipmentIntelligence')
assert.ok(heroIdx > 0 && mediaIdx > heroIdx, 'media inside hero')
assert.ok(descriptionIdx > mediaIdx, 'seller description after gallery block')
assert.ok(summaryIdx > descriptionIdx, 'summary after seller description in JSX')
assert.ok(intelligenceIdx > summaryIdx, 'intelligence after summary in JSX')
assert.match(
  detailCss,
  /grid-template-areas:\s*[\s\S]*'media summary'[\s\S]*'description summary'/,
  'desktop grid keeps description in the left column beside the sidebar',
)
assert.doesNotMatch(pageSrc, /listing-detail__primary/, 'description is not parked in a below-grid wrapper')

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

    const box = (el) => {
      if (!el) return null
      const rect = el.getBoundingClientRect()
      return {
        top: Math.round(rect.top + window.scrollY),
        bottom: Math.round(rect.bottom + window.scrollY),
        left: Math.round(rect.left),
        width: Math.round(rect.width),
      }
    }

    return {
      title: title?.textContent?.trim() || '',
      panelCount: panels.length,
      hasPanel: Boolean(panel),
      viewportWidth: window.innerWidth,
      descriptionInHero: Boolean(document.querySelector('.listing-detail__hero .listing-detail__seller-description')),
      descriptionInMedia: Boolean(document.querySelector('.listing-detail__media .listing-detail__seller-description')),
      descriptionText: description?.textContent?.replace(/\s+/g, ' ').trim() || '',
      boxes: {
        media: box(media),
        summary: box(summary),
        title: box(title),
        price: box(price),
        description: box(description),
        intelligence: box(panel),
      },
      tops: {
        media: box(media)?.top ?? null,
        summary: box(summary)?.top ?? null,
        title: box(title)?.top ?? null,
        price: box(price)?.top ?? null,
        description: box(description)?.top ?? null,
        intelligence: box(panel)?.top ?? null,
      },
      bottoms: {
        media: box(media)?.bottom ?? null,
        summary: box(summary)?.bottom ?? null,
        hero: box(document.querySelector('.listing-detail__hero'))?.bottom ?? null,
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
  const { tops, bottoms, boxes } = state
  const desktop = state.viewportWidth >= 768
  assert.ok(tops.media != null, `${label}: gallery present`)
  assert.ok(tops.summary != null, `${label}: summary present`)
  assert.ok(tops.title != null, `${label}: title present`)
  assert.ok(tops.price != null, `${label}: price/actions present`)
  assert.ok(tops.description != null, `${label}: seller description present in HTML`)
  assert.equal(state.descriptionInHero, true, `${label}: description stays in the listing hero`)
  assert.equal(state.descriptionInMedia, false, `${label}: description is a left-column sibling of the gallery`)
  assert.ok(state.descriptionText.includes("Seller's description"), `${label}: description heading crawlable`)
  assert.ok(tops.description >= bottoms.media - 2, `${label}: description follows the gallery/notice`)
  assert.ok(
    tops.description <= bottoms.media + 48,
    `${label}: description follows the gallery with normal section spacing (${tops.description - bottoms.media}px)`,
  )

  if (desktop) {
    assert.ok(
      Math.abs(boxes.description.left - boxes.media.left) <= 2,
      `${label}: description aligns with gallery left edge`,
    )
    assert.ok(
      Math.abs(boxes.description.width - boxes.media.width) <= 2,
      `${label}: description matches gallery column width`,
    )
    if (bottoms.summary > bottoms.media + 80) {
      assert.ok(
        tops.description < bottoms.summary - 40,
        `${label}: description does not wait for the sidebar to finish`,
      )
    }
  } else {
    assert.ok(tops.description < tops.summary, `${label}: mobile description comes before listing summary`)
  }

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
