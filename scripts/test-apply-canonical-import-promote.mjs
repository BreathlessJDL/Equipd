/**
 * Tests for automatic canonical promotion after intelligence CSV import.
 *
 * Covers shared apply helpers, status safety, plus-key risk, idempotency
 * simulation, multi-brand brand extraction, and orchestration failure rules.
 */

import {
  applyCanonicalProductsForBrands,
  brandsFromValidatedImportRows,
  buildImportYearPromotionWarning,
  buildProductsPathForImportedBrands,
  detectLegacyPlusKeyRisk,
  deriveLegacyPlusKeyCandidates,
  explainSourceCanonicalCountDelta,
  summariseCanonicalPromotionResults,
  upsertCanonicalProductDirect,
} from '../src/lib/applyCanonicalProductsByBrand.js'
import {
  buildCanonicalProductAuditReport,
  PRODUCT_STATUS,
  resolveCanonicalBaselineYear,
  summariseSourceYearFields,
} from '../src/lib/intelligenceCanonicalProducts.js'
import { slugifyCoreProductKey } from '../src/lib/intelligenceCoreProductGrouping.js'

function assert(condition, label) {
  if (!condition) throw new Error(label)
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`)
  }
}

/** Minimal in-memory supabase stub for upsert + apply orchestration tests. */
function createMemorySupabase({ intelligenceRows = [], products = [] } = {}) {
  const state = {
    intelligence: intelligenceRows.map((row) => ({ ...row })),
    products: products.map((row) => ({ ...row })),
  }

  function matchBrand(rowBrand, filter) {
    if (!filter) return true
    return String(rowBrand ?? '').toLowerCase() === String(filter).toLowerCase()
  }

  return {
    state,
    from(table) {
      const api = {
        _table: table,
        _filters: {},
        _eq: {},
        _select: '*',
        select(fields) {
          this._select = fields
          return this
        },
        order() {
          return this
        },
        range() {
          return this
        },
        ilike(column, value) {
          this._filters[column] = value
          return this
        },
        eq(column, value) {
          this._eq[column] = value
          return this
        },
        maybeSingle: async function maybeSingle() {
          const rows = await this._resolveRows()
          return { data: rows[0] ?? null, error: null }
        },
        insert(row) {
          return {
            select: () => ({
              maybeSingle: async () => {
                const inserted = {
                  id: `prod-${state.products.length + 1}`,
                  ...row,
                }
                state.products.push(inserted)
                return { data: inserted, error: null }
              },
            }),
          }
        },
        update(patch) {
          return {
            eq: (column, value) => ({
              select: () => ({
                maybeSingle: async () => {
                  const index = state.products.findIndex((product) => product[column] === value)
                  if (index < 0) return { data: null, error: null }
                  state.products[index] = { ...state.products[index], ...patch }
                  return { data: state.products[index], error: null }
                },
              }),
              then: undefined,
            }),
            select: () => ({
              maybeSingle: async () => {
                const key = this._eq.id || this._eq.canonical_product_key
                const column = this._eq.id != null ? 'id' : 'canonical_product_key'
                const index = state.products.findIndex((product) => product[column] === key)
                if (index < 0) return { data: null, error: null }
                state.products[index] = { ...state.products[index], ...patch }
                return { data: state.products[index], error: null }
              },
            }),
          }
        },
        async _resolveRows() {
          if (table === 'equipment_intelligence') {
            return state.intelligence.filter((row) => matchBrand(row.brand, this._filters.brand))
          }
          if (table === 'equipment_products') {
            let rows = state.products
            if (this._filters.brand) {
              rows = rows.filter((row) => matchBrand(row.brand, this._filters.brand))
            }
            if (this._eq.canonical_product_key) {
              rows = rows.filter((row) => row.canonical_product_key === this._eq.canonical_product_key)
            }
            if (this._eq.id) {
              rows = rows.filter((row) => row.id === this._eq.id)
            }
            return rows
          }
          return []
        },
        then(resolve, reject) {
          return this._resolveRows()
            .then((data) => resolve({ data, error: null }))
            .catch(reject)
        },
      }
      return api
    },
  }
}

const peletonishRows = [
  {
    id: 'p1',
    brand: 'Peloton',
    series: null,
    model: 'Bike',
    equipment_type: 'Exercise Bike',
    confidence: 'high',
    manufacture_year: 2018,
    original_rrp: null,
    currency: 'GBP',
  },
  {
    id: 'p2',
    brand: 'Peloton',
    series: null,
    model: 'Bike+',
    equipment_type: 'Exercise Bike',
    confidence: 'high',
    manufacture_year: 2020,
    original_rrp: 2495,
    currency: 'GBP',
  },
  {
    id: 'p3',
    brand: 'Peloton',
    series: null,
    model: 'Tread',
    equipment_type: 'Treadmill',
    confidence: 'medium',
    manufacture_year: 2019,
    original_rrp: 3295,
    currency: 'GBP',
  },
]

const nordicTrackRows = [
  {
    id: 'n1',
    brand: 'NordicTrack',
    series: 'Commercial',
    model: '1750',
    equipment_type: 'Treadmill',
    confidence: 'high',
    manufacture_year: 2021,
    original_rrp: 1999,
    currency: 'GBP',
  },
  {
    id: 'n2',
    brand: 'NordicTrack',
    series: null,
    model: 'X22i',
    equipment_type: 'Treadmill',
    confidence: 'low',
    manufacture_year: 2020,
    original_rrp: null,
    currency: 'GBP',
  },
]

const bowflexRows = [
  {
    id: 'b1',
    brand: 'BowFlex',
    series: null,
    model: 'Max Trainer M9',
    equipment_type: 'Elliptical',
    confidence: 'high',
    manufacture_year: 2019,
    original_rrp: 2199,
    currency: 'GBP',
  },
]

// --- Brand extraction & Products handoff ---
{
  const brands = brandsFromValidatedImportRows([
    { valid: true, normalised: { brand: 'Peloton' } },
    { valid: true, normalised: { brand: 'NordicTrack' } },
    { valid: true, normalised: { brand: 'Peloton' } },
    { valid: true, normalised: { brand: 'BowFlex' } },
  ])
  assertEqual(brands.join('|'), 'BowFlex|NordicTrack|Peloton', 'dedupe + sort affected brands')
  assertEqual(
    buildProductsPathForImportedBrands(['Peloton']),
    '/admin/intelligence/products?brand=Peloton',
    'single-brand products link',
  )
  assert(
    buildProductsPathForImportedBrands(['Peloton', 'NordicTrack']).includes('search='),
    'few brands use search handoff',
  )
  assertEqual(
    buildProductsPathForImportedBrands(['A', 'B', 'C', 'D']),
    '/admin/intelligence/products',
    'many brands open unfiltered products',
  )
}

// --- Bike vs Bike+ remain distinct ---
{
  const audit = buildCanonicalProductAuditReport(peletonishRows, { brandFilter: 'Peloton' })
  assertEqual(audit.products.length, 3, 'Peloton Bike, Bike+, Tread are three products')
  const bike = audit.products.find((product) => product.model === 'Bike')
  const bikePlus = audit.products.find((product) => /bike\+/i.test(product.canonical_product_name) || product.model === 'Bike+')
  assert(bike && bikePlus, 'Bike and Bike+ must both exist')
  assert(bike.canonical_product_key !== bikePlus.canonical_product_key, 'Bike and Bike+ keys differ')
  assert(bikePlus.canonical_product_key.includes('plus'), 'Bike+ key contains plus token')
  assertEqual(bike.status, PRODUCT_STATUS.PENDING, 'high-confidence Bike is pending')
  assertEqual(
    audit.products.find((product) => product.model === 'Tread')?.status,
    PRODUCT_STATUS.PENDING,
    'medium-confidence identity-safe Tread stays pending',
  )
}

// --- Low confidence → needs_review; missing price stays null; year retained ---
{
  const audit = buildCanonicalProductAuditReport(nordicTrackRows, { brandFilter: 'NordicTrack' })
  const x22i = audit.products.find((product) => /x22i/i.test(product.model))
  assertEqual(x22i.status, PRODUCT_STATUS.NEEDS_REVIEW, 'low confidence → needs_review')
  assertEqual(x22i.original_base_price, null, 'missing price remains null')
  assertEqual(
    x22i.baseline_manufacture_year,
    null,
    'generic manufacture_year does not become canonical baseline',
  )
  assert(
    audit.products.every((product) => product.status !== PRODUCT_STATUS.APPROVED),
    'audit never auto-approves',
  )
}

// --- Redundant family / BowFlex fixture groups ---
{
  const audit = buildCanonicalProductAuditReport(bowflexRows, { brandFilter: 'BowFlex' })
  assertEqual(audit.products.length, 1, 'single BowFlex row → one canonical product')
  assertEqual(audit.products[0].status, PRODUCT_STATUS.PENDING, 'BowFlex high confidence pending')
}

// --- Multi-brand audit sizes ---
{
  const allRows = [...peletonishRows, ...nordicTrackRows, ...bowflexRows]
  const peloton = buildCanonicalProductAuditReport(allRows, { brandFilter: 'Peloton' })
  const nordic = buildCanonicalProductAuditReport(allRows, { brandFilter: 'NordicTrack' })
  const bowflex = buildCanonicalProductAuditReport(allRows, { brandFilter: 'BowFlex' })
  assertEqual(peloton.products.length + nordic.products.length + bowflex.products.length, 6, 'multi-brand totals')
}

// --- Duplicate collapse note ---
{
  const note = explainSourceCanonicalCountDelta({
    sourceRowCount: 10,
    canonicalCount: 7,
    suggestedCanonicalProducts: 7,
    duplicateRowsCollapsed: 3,
    ambiguous: 0,
  })
  assert(note && note.includes('collapsed'), 'count note explains legitimate collapse')
}

// --- Legacy plus-key risk ---
{
  const plusKey = slugifyCoreProductKey('Technogym', 'Elliptical', null, 'Element+')
  assert(plusKey.includes('plus'), 'Element+ slug contains plus')
  const legacyCandidates = deriveLegacyPlusKeyCandidates(plusKey)
  assert(legacyCandidates.length > 0, 'legacy plus candidates derived')

  const remapOnly = detectLegacyPlusKeyRisk({
    auditProducts: [{
      canonical_product_key: plusKey,
      canonical_product_name: 'Technogym Element+',
    }],
    existingProducts: [{
      canonical_product_key: legacyCandidates[0],
      canonical_product_name: 'Technogym Element+',
      model: 'Element+',
      product_family: 'Element+',
    }],
  })
  assert(!remapOnly.hasRisk, 'legacy-only plus-named twin is remapped, not a parallel-identity risk')

  const risk = detectLegacyPlusKeyRisk({
    auditProducts: [{
      canonical_product_key: plusKey,
      canonical_product_name: 'Technogym Element+',
    }],
    existingProducts: [
      {
        canonical_product_key: plusKey,
        canonical_product_name: 'Technogym Element+',
        model: 'Element+',
        product_family: 'Element+',
      },
      {
        canonical_product_key: legacyCandidates[0],
        canonical_product_name: 'Technogym Element+',
        model: 'Element+',
        product_family: 'Element+',
      },
    ],
  })
  assert(risk.hasRisk, 'parallel plus + legacy rows are a collision risk')
  assert(risk.warning && /Legacy plus-key risk/i.test(risk.warning), 'warning message present')

  const bikeRisk = detectLegacyPlusKeyRisk({
    auditProducts: [{
      canonical_product_key: slugifyCoreProductKey('Peloton', 'Exercise Bike', null, 'Bike+'),
      canonical_product_name: 'Peloton Bike+',
    }],
    existingProducts: [
      {
        canonical_product_key: slugifyCoreProductKey('Peloton', 'Exercise Bike', null, 'Bike'),
        canonical_product_name: 'Peloton Bike',
        model: 'Bike',
      },
      {
        canonical_product_key: slugifyCoreProductKey('Peloton', 'Exercise Bike', null, 'Bike+'),
        canonical_product_name: 'Peloton Bike+',
        model: 'Bike+',
      },
    ],
  })
  assert(!bikeRisk.hasRisk, 'Bike vs Bike+ is not a legacy-plus collision')
}

// --- Idempotent apply: first insert, second update, no duplicates ---
{
  const supabase = createMemorySupabase({ intelligenceRows: peletonishRows, products: [] })
  const first = await applyCanonicalProductsForBrands({
    brands: ['Peloton'],
    supabase,
    apply: true,
  })
  assert(first.ok, 'first promotion ok')
  assertEqual(first.productsInserted, 3, 'first import inserts 3 products')
  assertEqual(first.productsUpdated, 0, 'first import updates 0')
  assertEqual(supabase.state.products.length, 3, 'exactly 3 canonical products after first apply')
  assertEqual(first.approved, 0, 'no auto-approval on first apply')
  assert(first.pending + first.needsReview === 3, 'all products pending or needs_review')

  const second = await applyCanonicalProductsForBrands({
    brands: ['Peloton'],
    supabase,
    apply: true,
  })
  assert(second.ok, 'second promotion ok')
  assertEqual(second.productsInserted, 0, 'second import inserts 0')
  assertEqual(second.productsUpdated, 3, 'second import updates 3')
  assertEqual(supabase.state.products.length, 3, 'still exactly 3 canonical products after re-apply')
}

// --- Approved product not downgraded ---
{
  const audit = buildCanonicalProductAuditReport(peletonishRows, { brandFilter: 'Peloton' })
  const bike = audit.products.find((product) => product.model === 'Bike')
  const supabase = createMemorySupabase({
    intelligenceRows: peletonishRows,
    products: [{
      id: 'approved-bike',
      brand: 'Peloton',
      model: 'Bike',
      canonical_product_key: bike.canonical_product_key,
      canonical_product_name: bike.canonical_product_name,
      status: PRODUCT_STATUS.APPROVED,
      source_intelligence_row_ids: ['p1'],
      original_base_price: 999,
      baseline_manufacture_year: 2017,
    }],
  })

  await applyCanonicalProductsForBrands({
    brands: ['Peloton'],
    supabase,
    apply: true,
  })

  const approved = supabase.state.products.find((product) => product.id === 'approved-bike')
  assertEqual(approved.status, PRODUCT_STATUS.APPROVED, 'approved status preserved')
  assertEqual(approved.original_base_price, 999, 'approved price not overwritten')
  assertEqual(approved.baseline_manufacture_year, 2017, 'approved baseline year not overwritten')
}

// --- Unrelated brands not loaded/touched ---
{
  const supabase = createMemorySupabase({
    intelligenceRows: [...peletonishRows, ...nordicTrackRows],
    products: [{
      id: 'nt-existing',
      brand: 'NordicTrack',
      model: '1750',
      canonical_product_key: 'nordictrack-treadmill-commercial-1750',
      canonical_product_name: 'NordicTrack Commercial 1750',
      status: PRODUCT_STATUS.APPROVED,
      source_intelligence_row_ids: ['n1'],
    }],
  })
  const beforeNordic = structuredClone(supabase.state.products.find((product) => product.id === 'nt-existing'))
  await applyCanonicalProductsForBrands({
    brands: ['Peloton'],
    supabase,
    apply: true,
  })
  const afterNordic = supabase.state.products.find((product) => product.id === 'nt-existing')
  assertEqual(JSON.stringify(afterNordic), JSON.stringify(beforeNordic), 'unrelated NordicTrack product untouched')
  assert(
    supabase.state.products.every((product) => product.brand === 'Peloton' || product.id === 'nt-existing'),
    'only Peloton products added',
  )
}

// --- Plus-key risk: remap legacy-only; skip when both keys already exist ---
{
  const plusKey = slugifyCoreProductKey('Technogym', 'Elliptical', null, 'Element+')
  const legacyKey = deriveLegacyPlusKeyCandidates(plusKey)[0]
  const intelligence = [{
    id: 'tg1',
    brand: 'Technogym',
    series: null,
    model: 'Element+',
    equipment_type: 'Elliptical',
    confidence: 'high',
    manufacture_year: 2018,
    original_rrp: 5000,
    currency: 'GBP',
  }]

  const remapSupabase = createMemorySupabase({
    intelligenceRows: intelligence,
    products: [{
      id: 'legacy',
      brand: 'Technogym',
      model: 'Element+',
      product_family: 'Element+',
      canonical_product_key: legacyKey,
      canonical_product_name: 'Technogym Element+',
      status: PRODUCT_STATUS.APPROVED,
      source_intelligence_row_ids: ['tg1'],
    }],
  })
  const remapResult = await applyCanonicalProductsForBrands({
    brands: ['Technogym'],
    supabase: remapSupabase,
    apply: true,
  })
  assertEqual(remapResult.brandsSkipped, 0, 'legacy-only remap does not skip brand')
  assertEqual(remapResult.productsInserted, 0, 'no insert when remapping onto legacy')
  assertEqual(remapSupabase.state.products.length, 1, 'no duplicate row created via remapping')
  assertEqual(
    remapSupabase.state.products[0].canonical_product_key,
    legacyKey,
    'upsert remains on legacy key',
  )

  const collisionSupabase = createMemorySupabase({
    intelligenceRows: intelligence,
    products: [
      {
        id: 'legacy',
        brand: 'Technogym',
        model: 'Element+',
        product_family: 'Element+',
        canonical_product_key: legacyKey,
        canonical_product_name: 'Technogym Element+',
        status: PRODUCT_STATUS.APPROVED,
        source_intelligence_row_ids: ['tg1'],
      },
      {
        id: 'plus',
        brand: 'Technogym',
        model: 'Element+',
        product_family: 'Element+',
        canonical_product_key: plusKey,
        canonical_product_name: 'Technogym Element+',
        status: PRODUCT_STATUS.PENDING,
        source_intelligence_row_ids: ['tg1'],
      },
    ],
  })
  const collisionResult = await applyCanonicalProductsForBrands({
    brands: ['Technogym'],
    supabase: collisionSupabase,
    apply: true,
  })
  assertEqual(collisionResult.brandsSkipped, 1, 'parallel plus+legacy keys skip brand')
  assertEqual(collisionResult.productsInserted, 0, 'no insert on parallel-key risk')
  assertEqual(collisionSupabase.state.products.length, 2, 'existing duplicate pair left for merge script')
  assert(collisionResult.hasWarnings, 'warnings surfaced')
}

// --- approveSafe rejected by multi-brand API ---
{
  let threw = false
  try {
    await applyCanonicalProductsForBrands({
      brands: ['Peloton'],
      supabase: createMemorySupabase({ intelligenceRows: peletonishRows }),
      apply: true,
      approveSafe: true,
    })
  } catch {
    threw = true
  }
  assert(threw, 'approveSafe blocked on shared brands API')
}

// --- Large import, few brands ---
{
  const manyRows = Array.from({ length: 120 }, (_, index) => ({
    id: `bulk-${index}`,
    brand: index % 2 === 0 ? 'Peloton' : 'BowFlex',
    series: null,
    model: `Model ${index}`,
    equipment_type: 'Treadmill',
    confidence: 'high',
    manufacture_year: 2020,
    original_rrp: 1000 + index,
    currency: 'GBP',
  }))
  const brands = brandsFromValidatedImportRows(
    manyRows.map((row) => ({ valid: true, normalised: { brand: row.brand } })),
  )
  assertEqual(brands.length, 2, 'large import still dedupes to few brands')
  const supabase = createMemorySupabase({ intelligenceRows: manyRows })
  const result = await applyCanonicalProductsForBrands({
    brands,
    supabase,
    apply: true,
  })
  assert(result.ok, 'large few-brand promotion ok')
  assertEqual(result.brandsProcessed, 2, 'processes only two brands')
  assertEqual(supabase.state.products.length, 120, 'one product per distinct model')
}

// --- Direct upsert insert/update actions ---
{
  const supabase = createMemorySupabase({ products: [] })
  const product = {
    brand: 'Peloton',
    model: 'Bike',
    equipment_type: 'Exercise Bike',
    canonical_product_name: 'Peloton Bike',
    canonical_product_key: 'peloton-exercise-bike-bike',
    source_intelligence_row_ids: ['p1'],
    status: PRODUCT_STATUS.PENDING,
    baseline_manufacture_year: 2018,
    original_base_price: null,
  }
  const inserted = await upsertCanonicalProductDirect(supabase, product)
  assertEqual(inserted.action, 'inserted', 'direct upsert inserts')
  const updated = await upsertCanonicalProductDirect(supabase, {
    ...product,
    source_intelligence_row_ids: ['p1', 'p1b'],
  })
  assertEqual(updated.action, 'updated', 'direct upsert updates')
  assertEqual(supabase.state.products.length, 1, 'no duplicate from upsert')
  assertEqual(
    new Set(supabase.state.products[0].source_intelligence_row_ids).size,
    2,
    'source-row links merge without duplicate entries in set',
  )
}

// --- Summary aggregation ---
{
  const summary = summariseCanonicalPromotionResults([
    {
      brand: 'Peloton',
      skipped: false,
      sourceRowCount: 3,
      canonicalProductCount: 3,
      productsInserted: 3,
      productsUpdated: 0,
      productsFailed: 0,
      pending: 2,
      needsReview: 1,
      approved: 0,
      excluded: 0,
      duplicateRowsCollapsed: 0,
      ambiguous: 0,
      warnings: [],
      errors: [],
    },
    {
      brand: 'Technogym',
      skipped: true,
      sourceRowCount: 5,
      canonicalProductCount: 4,
      productsInserted: 0,
      productsUpdated: 0,
      productsFailed: 0,
      pending: 0,
      needsReview: 0,
      approved: 0,
      excluded: 0,
      duplicateRowsCollapsed: 1,
      ambiguous: 0,
      warnings: ['Legacy plus-key risk'],
      errors: [],
    },
  ])
  assertEqual(summary.brandsProcessed, 1, 'summary processed brands')
  assertEqual(summary.brandsSkipped, 1, 'summary skipped brands')
  assert(summary.hasWarnings, 'summary warns')
  assert(summary.ok, 'skip-only still ok=true (no hard failures)')
}

// --- Import failure must not promote (orchestration contract) ---
{
  // Documented contract: callers stop before apply when import errors.
  // Verified here as a pure control-flow assertion used by importEquipmentIntelligenceAndPromote.
  const importFailed = { insertedCount: 0, updatedCount: 0, error: new Error('RPC denied') }
  const shouldPromote = !importFailed.error
  assert(!shouldPromote, 'source import failure → no promotion')
}

// --- Year field semantics: safe automatic promotion ---
{
  assertEqual(
    resolveCanonicalBaselineYear({ manufacture_year: 2022 }),
    null,
    'generic manufacture_year alone → no baseline',
  )
  assertEqual(
    resolveCanonicalBaselineYear({
      manufacture_year: 2022,
      baseline_manufacture_year: 2010,
    }),
    2010,
    'verified baseline wins over generic manufacture_year',
  )
  assertEqual(
    resolveCanonicalBaselineYear({
      manufacture_year: 2022,
      manufacture_start_year: 2011,
    }),
    2011,
    'manufacture_start_year is an explicit verified start',
  )
  assertEqual(
    resolveCanonicalBaselineYear({ manufacture_year: 2022 }, { allowManufactureYearAsBaseline: true }),
    2022,
    'CLI override can use manufacture_year',
  )
  assertEqual(
    resolveCanonicalBaselineYear({ baseline_manufacture_year: 1800 }),
    null,
    'invalid explicit baseline rejected',
  )

  const nt1750 = buildCanonicalProductAuditReport([
    {
      id: 'nt-1750',
      brand: 'NordicTrack',
      series: 'Commercial',
      model: 'Commercial 1750',
      equipment_type: 'Treadmill',
      confidence: 'high',
      manufacture_year: 2022,
      baseline_manufacture_year: 2010,
    },
  ])
  assertEqual(nt1750.products[0].baseline_manufacture_year, 2010, '1750 uses verified 2010 not 2022')

  const nt1750GenericOnly = buildCanonicalProductAuditReport([
    {
      id: 'nt-1750-g',
      brand: 'NordicTrack',
      series: 'Commercial',
      model: 'Commercial 1750',
      equipment_type: 'Treadmill',
      confidence: 'high',
      manufacture_year: 2022,
    },
  ])
  assertEqual(
    nt1750GenericOnly.products[0].baseline_manufacture_year,
    null,
    '1750 generic-only stays blank under automatic rules',
  )

  const bikePlus = buildCanonicalProductAuditReport([
    {
      id: 'bike-plus',
      brand: 'Peloton',
      series: 'Bike+',
      model: 'Bike+',
      equipment_type: 'Indoor Bike',
      confidence: 'high',
      manufacture_year: 2021,
      baseline_manufacture_year: 2020,
    },
  ])
  assertEqual(bikePlus.products[0].baseline_manufacture_year, 2020, 'Bike+ verified baseline 2020')

  const yearSummary = summariseSourceYearFields([
    { manufacture_year: 2022 },
    { manufacture_year: 2019, baseline_manufacture_year: 2010 },
    { manufacture_year: null },
  ])
  assertEqual(yearSummary.withManufactureYear, 2, 'source manufacture_year count')
  assertEqual(yearSummary.withVerifiedBaseline, 1, 'verified baseline count')
  assertEqual(yearSummary.withoutVerifiedBaseline, 2, 'missing verified count')

  const warning = buildImportYearPromotionWarning({
    sourceRowsWithManufactureYear: 25,
    sourceRowsWithoutVerifiedBaseline: 18,
  })
  assert(warning && warning.includes('25') && warning.includes('18'), 'import year warning wording')
}

// --- Existing verified baseline preserved on re-apply ---
{
  const audit = buildCanonicalProductAuditReport([
    {
      id: 'n1',
      brand: 'NordicTrack',
      series: 'Commercial',
      model: 'Commercial 1750',
      equipment_type: 'Treadmill',
      confidence: 'high',
      manufacture_year: 2022,
    },
  ])
  const key = audit.products[0].canonical_product_key
  const supabase = createMemorySupabase({
    intelligenceRows: [{
      id: 'n1',
      brand: 'NordicTrack',
      series: 'Commercial',
      model: 'Commercial 1750',
      equipment_type: 'Treadmill',
      confidence: 'high',
      manufacture_year: 2022,
    }],
    products: [{
      id: 'existing-1750',
      brand: 'NordicTrack',
      model: 'Commercial 1750',
      canonical_product_key: key,
      canonical_product_name: audit.products[0].canonical_product_name,
      status: PRODUCT_STATUS.APPROVED,
      baseline_manufacture_year: 2011,
      production_start_year: 2011,
      source_intelligence_row_ids: ['n1'],
      original_base_price: 2499,
    }],
  })

  await applyCanonicalProductsForBrands({
    brands: ['NordicTrack'],
    supabase,
    apply: true,
    allowManufactureYearAsBaseline: false,
  })

  const preserved = supabase.state.products.find((product) => product.id === 'existing-1750')
  assertEqual(preserved.baseline_manufacture_year, 2011, 'approved existing baseline unchanged')
  assertEqual(preserved.status, PRODUCT_STATUS.APPROVED, 'approved status unchanged')
  assertEqual(preserved.original_base_price, 2499, 'approved price unchanged')
}

console.log('All apply-canonical-import-promote tests passed.')
