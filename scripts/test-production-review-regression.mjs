#!/usr/bin/env node
/**
 * Focused regression checks for the Jul 2026 production review fixes.
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import assert from 'node:assert/strict'
import {
  deriveLegacyPlusKeyCandidates,
  detectLegacyPlusKeyRisk,
  resolvePlusAwareExistingProduct,
} from '../src/lib/applyCanonicalProductsByBrand.js'
import { slugifyCoreProductKey } from '../src/lib/intelligenceCoreProductGrouping.js'
import {
  formatPublicCanonicalProductDisplayName,
  normalizePublicSeriesDisplayLabel,
  getProductSeriesLabel,
} from '../src/lib/brandCatalogueCore.js'
import {
  resolveContentEquipmentIdentityFamily,
  findCategoryIncompatibleTerms,
  validateCategoryIncompatibleTerminology,
  resolveProductContentCategory,
  PRODUCT_CONTENT_CATEGORIES,
} from '../src/lib/equipmentProductContent.js'
import { DEFAULT_PAGE_DESCRIPTION, DEFAULT_PAGE_TITLE } from '../src/lib/pageTitles.js'
import { EQUIPD_ORGANIZATION_DESCRIPTION } from '../src/lib/siteStructuredData.js'

const root = process.cwd()

function read(rel) {
  return readFileSync(join(root, rel), 'utf8')
}

// --- 1. Buyer Protection modal viewport fit ---
{
  const css = read('src/components/BuyerProtectionModal.css')
  const jsx = read('src/components/BuyerProtectionModal.jsx')
  assert.match(css, /max-height:\s*min\(100%,\s*calc\(100dvh\s*-\s*2rem\)\)/, 'dialog max-height fits padded overlay')
  assert.match(css, /\.buyer-protection-modal__body[\s\S]*overflow-y:\s*auto/, 'body scrolls internally')
  assert.match(css, /\.buyer-protection-modal__header[\s\S]*flex-shrink:\s*0/, 'header stays pinned')
  assert.match(css, /\.buyer-protection-modal__footer[\s\S]*flex-shrink:\s*0/, 'footer stays pinned')
  assert.match(css, /align-items:\s*safe center/, 'safe vertical centring')
  assert.match(css, /min-height:\s*0/, 'flex min-height allows shrink')
  assert.match(css, /z-index:\s*1100/, 'modal stacks above listing chrome')
  assert.match(jsx, /createPortal/, 'modal portals to document.body to avoid ancestor clipping')
  assert.match(jsx, /document\.body/, 'portal target is document.body')
}

// --- 2. Element+ duplicate prevention ---
{
  const plusKey = slugifyCoreProductKey('Technogym', 'Elliptical', 'Element+', null)
  assert.ok(plusKey.includes('plus'), 'Element+ keys contain plus')
  const legacy = deriveLegacyPlusKeyCandidates(plusKey)
  assert.ok(legacy.length > 0, 'legacy candidates exist')

  const map = new Map([
    [legacy[0], {
      id: 'legacy',
      canonical_product_key: legacy[0],
      canonical_product_name: 'Technogym Element+',
      model: 'Element+',
      product_family: 'Element+',
    }],
  ])
  const resolved = resolvePlusAwareExistingProduct(
    { canonical_product_key: plusKey },
    map,
  )
  assert.equal(resolved.viaLegacy, true, 'plus maps onto legacy')
  assert.equal(resolved.upsertKey, legacy[0], 'upsert uses legacy key')

  const bikeKey = slugifyCoreProductKey('Peloton', 'Exercise Bike', null, 'Bike+')
  const bikeLegacy = deriveLegacyPlusKeyCandidates(bikeKey)[0]
  const bikeMap = new Map([
    [bikeLegacy, {
      id: 'bike',
      canonical_product_key: bikeLegacy,
      canonical_product_name: 'Peloton Bike',
      model: 'Bike',
    }],
  ])
  const bikeResolved = resolvePlusAwareExistingProduct(
    { canonical_product_key: bikeKey, canonical_product_name: 'Peloton Bike+' },
    bikeMap,
  )
  assert.equal(bikeResolved.viaLegacy, false, 'Bike+ must not remap onto Bike')

  const parallelRisk = detectLegacyPlusKeyRisk({
    auditProducts: [{ canonical_product_key: plusKey, canonical_product_name: 'Technogym Element+' }],
    existingProducts: [
      {
        canonical_product_key: plusKey,
        canonical_product_name: 'Technogym Element+',
        model: 'Element+',
        product_family: 'Element+',
      },
      {
        canonical_product_key: legacy[0],
        canonical_product_name: 'Technogym Element+',
        model: 'Element+',
        product_family: 'Element+',
      },
    ],
  })
  assert.equal(parallelRisk.hasRisk, true, 'parallel rows remain a hard risk')
}

// --- 3. Brand-page listing images ---
{
  const brandCatalogue = read('src/lib/brandCatalogue.js')
  assert.match(brandCatalogue, /listing_images\(id, storage_path, sort_order\)/, 'selects listing_images')
  assert.match(brandCatalogue, /enrichListingWithImages/, 'enriches like browse')
  assert.match(brandCatalogue, /foreignTable:\s*'listing_images'/, 'orders/limits primary image')
}

// --- 4. Precor Discovery display ---
{
  assert.equal(
    normalizePublicSeriesDisplayLabel('Precor', 'Discovery - Dbr'),
    'Discovery',
  )
  assert.equal(
    formatPublicCanonicalProductDisplayName({
      brand: 'Precor',
      canonical_product_name: 'Precor Discovery Series Chest Press',
    }),
    'Precor Discovery Chest Press',
  )
  assert.equal(
    getProductSeriesLabel({ brand: 'Precor', product_family: 'Discovery Series' }),
    'Discovery',
  )
  assert.equal(
    formatPublicCanonicalProductDisplayName({
      brand: 'Life Fitness',
      canonical_product_name: 'Life Fitness Discovery Series Foo',
    }),
    'Life Fitness Discovery Series Foo',
    'non-Precor Discovery Series unchanged',
  )
}

// --- 5. Brand-card value wording ---
{
  const card = read('src/components/EquipmentValueGuideCard.jsx')
  assert.match(card, /Estimated used value by year/, 'clear estimate label')
  assert.match(card, /based on \{product\.yearLabel\}/, 'ties amount to year')
}

// --- 6. Technogym Stepper cardio routing ---
{
  const stepperPayload = {
    brand: 'Technogym',
    equipment_type: 'Stepper',
    model: 'Excite Step',
    canonical_product_name: 'Technogym Excite Step',
    product_family: 'Excite+',
  }
  assert.equal(
    resolveContentEquipmentIdentityFamily(stepperPayload),
    'stepper',
  )
  assert.equal(
    resolveProductContentCategory(stepperPayload),
    PRODUCT_CONTENT_CATEGORIES.CARDIO,
  )
  assert.equal(
    resolveProductContentCategory({
      brand: 'Technogym',
      equipment_type: null,
      model: 'Excite Step 700',
      canonical_product_name: 'Technogym Excite Step 700',
      product_family: 'Excite + Step',
    }),
    PRODUCT_CONTENT_CATEGORIES.CARDIO,
    'null-type Excite Step routes to cardio',
  )
  assert.notEqual(
    resolveProductContentCategory({
      brand: 'Technogym',
      equipment_type: null,
      model: 'Kinesis Step/Squat',
      canonical_product_name: 'Technogym Kinesis Step',
      product_family: 'Kinesis',
    }),
    PRODUCT_CONTENT_CATEGORIES.CARDIO,
    'Kinesis Step/Squat stays strength',
  )
  const bad = 'The Technogym Excite Step is a selectorised strength stair machine with a weight stack.'
  assert.ok(findCategoryIncompatibleTerms(bad, stepperPayload).length > 0)
  assert.throws(
    () => validateCategoryIncompatibleTerminology(bad, stepperPayload),
    /stepper|selectori/i,
  )
}

// --- 7. Marketplace-first SEO ---
{
  assert.equal(
    DEFAULT_PAGE_TITLE,
    'Buy, Sell & Value Used Gym Equipment | Equipd Marketplace',
    'homepage title is marketplace-first',
  )
  assert.match(DEFAULT_PAGE_TITLE, /Buy, Sell & Value/i)
  assert.match(DEFAULT_PAGE_TITLE, /Equipd Marketplace/i)
  assert.equal(
    DEFAULT_PAGE_DESCRIPTION,
    "The UK's marketplace for used gym equipment. Buy and sell commercial and home gym equipment, browse thousands of listings and value your equipment instantly using original RRP, manufacture year and UK market data.",
    'homepage meta description exact',
  )
  assert.ok(!/primarily a valuation/i.test(DEFAULT_PAGE_DESCRIPTION))
  assert.ok(!/^value /i.test(DEFAULT_PAGE_TITLE), 'title is not valuation-only')

  assert.match(
    EQUIPD_ORGANIZATION_DESCRIPTION,
    /^The UK's marketplace for buying, selling and valuing used gym equipment/,
  )

  const indexHtml = read('index.html')
  assert.match(indexHtml, /Buy, Sell &amp; Value Used Gym Equipment \| Equipd Marketplace/)
  assert.match(indexHtml, /browse thousands of listings and value your equipment instantly/)
  assert.match(indexHtml, /property="og:title" content="Buy, Sell &amp; Value Used Gym Equipment \| Equipd Marketplace"/)
  assert.match(indexHtml, /property="og:description"[\s\S]*browse thousands of listings/)
  assert.match(indexHtml, /rel="canonical" href="https:\/\/www\.equipd\.co\.uk\/"/)

  const hero = read('src/components/home/HomeHero.jsx')
  assert.match(hero, /<h1[^>]*>[\s\S]*Buy, sell & value used gym equipment/, 'homepage H1 marketplace messaging')
  assert.match(hero, /Equipd Marketplace/, 'hero signals marketplace brand')
  assert.match(hero, /valuation tool/, 'hero includes integrated valuation')
}

console.log('production-review-regression tests passed')
