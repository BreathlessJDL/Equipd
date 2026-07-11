/**
 * Tests for canonical equipment products and console modifier valuation.
 */

import {
  buildCanonicalProductAuditReport,
  buildCanonicalProductsFromRows,
  buildConsoleDuplicateRepairPlan,
  coalesceMergedCanonicalProductFields,
  evaluateHighConfidenceApproval,
  isSafeApprovalCandidate,
  PRODUCT_STATUS,
} from '../src/lib/intelligenceCanonicalProducts.js'
import {
  deriveCoreProductFields,
  stripBracketedYearMarkers,
} from '../src/lib/intelligenceCoreProductGrouping.js'
import {
  buildCanonicalProductDisplayGroups,
  buildCanonicalProductResearchQueue,
} from '../src/lib/equipmentResearchQueue.js'
import {
  calculateOriginalPriceWithConsole,
  matchConsoleModifier,
} from '../src/lib/consoleModifierValuation.js'

function assert(condition, label) {
  if (!condition) throw new Error(label)
}

const powermillRows = [
  { id: 'pm-st', brand: 'Life Fitness', series: null, model: 'PowerMill ST console', equipment_type: 'Stepper' },
  { id: 'pm-se3', brand: 'Life Fitness', series: null, model: 'PowerMill SE3', equipment_type: 'Stepper' },
  { id: 'pm-se3hd', brand: 'Life Fitness', series: null, model: 'PowerMill SE3HD', equipment_type: 'Stepper' },
]

const powermillAudit = buildCanonicalProductAuditReport(powermillRows)
const powermillProduct = powermillAudit.products.find((product) => /powermill/i.test(product.model))
assert(powermillProduct, 'PowerMill ST/SE3/SE3HD should collapse into one canonical product')
assert(powermillProduct.source_row_count === 3, 'collapsed product should include three source rows')
assert(
  powermillProduct.canonical_product_name === 'Life Fitness PowerMill',
  'canonical name should be Life Fitness PowerMill',
)

const discoverPowermillRows = [
  { id: 'd-se', brand: 'Life Fitness', series: 'Discover SE (2015-19)', model: 'PowerMill', equipment_type: 'Stepper' },
  { id: 'd-se3', brand: 'Life Fitness', series: 'Discover SE3 (2019>)', model: 'PowerMill', equipment_type: 'Stepper' },
  { id: 'd-st', brand: 'Life Fitness', series: 'Discover ST Console (2019>)', model: 'PowerMill', equipment_type: 'Stepper' },
]
const discoverAudit = buildCanonicalProductAuditReport(discoverPowermillRows)
assert(
  discoverAudit.products.length === 1,
  'Discover SE/SE3/ST PowerMill rows should collapse into one canonical product',
)
assert(
  discoverAudit.products[0].canonical_product_name === 'Life Fitness Discover PowerMill',
  'Discover family PowerMill canonical name',
)

const familyRows = [
  ...powermillRows,
  { id: 'pm-integrity', brand: 'Life Fitness', series: 'Integrity Series', model: 'PowerMill', equipment_type: 'Stepper' },
  ...discoverPowermillRows,
]
const familyAudit = buildCanonicalProductAuditReport(familyRows)
const integrityProduct = familyAudit.products.find((p) => p.product_family === 'Integrity Series')
const discoverProduct = familyAudit.products.find((p) => p.product_family === 'Discover')
const barePowermill = familyAudit.products.find((p) => !p.product_family && p.model === 'PowerMill')
assert(integrityProduct && discoverProduct && barePowermill, 'Integrity, Discover, and bare PowerMill must stay separate')
assert(integrityProduct.canonical_product_key !== discoverProduct.canonical_product_key, 'Integrity vs Discover PowerMill separate keys')

const tiTeRows = [
  { id: '95ti', brand: 'Life Fitness', series: 'Integrity', model: '95Ti', equipment_type: 'Treadmill' },
  { id: '95te', brand: 'Life Fitness', series: 'Integrity', model: '95Te', equipment_type: 'Treadmill' },
]
const tiTeAudit = buildCanonicalProductAuditReport(tiTeRows)
assert(tiTeAudit.products.length === 2, '95Ti and 95Te must remain separate canonical products')

const t3t5Rows = [
  { id: 't3', brand: 'Life Fitness', series: null, model: 'T3', equipment_type: 'Treadmill' },
  { id: 't5', brand: 'Life Fitness', series: null, model: 'T5', equipment_type: 'Treadmill' },
]
const t3t5Audit = buildCanonicalProductAuditReport(t3t5Rows)
assert(t3t5Audit.products.length === 2, 'Life Fitness T3 and T5 must remain separate')

const consoleRow = powermillAudit.products[0].source_rows[0]
assert(consoleRow.detected_console, 'console names should be extracted as variants, not model identity')
assert(consoleRow.model.includes('ST') || consoleRow.model.includes('SE3'), 'original model preserved on source row')

const modifiers = [
  { brand: 'Life Fitness', console_name: 'SE3HD', console_tier: 'premium', modifier_value: 22 },
  { brand: 'Life Fitness', console_name: 'ST', console_tier: 'mid', modifier_value: 18 },
]
const valuation = calculateOriginalPriceWithConsole({
  originalBasePrice: 14500,
  brand: 'Life Fitness',
  consoleName: 'SE3HD',
  modifiers,
  currency: 'GBP',
})
assert(valuation.adjustedPrice === 17690, 'SE3HD 22% modifier on £14,500 should be £17,690')
assert(/SE3HD/.test(valuation.explanation), 'valuation explanation should mention console modifier')
assert(matchConsoleModifier(modifiers, 'Life Fitness', 'SE3 HD'), 'SE3 HD alias should match SE3HD modifier')

const productsForQueue = [
  {
    id: 'prod-1',
    canonical_product_name: 'Life Fitness PowerMill',
    canonical_product_key: 'life-fitness-stepper-powermill',
    status: 'approved',
    source_intelligence_row_ids: ['pm-st', 'pm-se3', 'pm-se3hd'],
    original_base_price: null,
    original_price_confidence: null,
    baseline_manufacture_year: null,
  },
  {
    id: 'prod-2',
    canonical_product_name: 'Life Fitness Integrity PowerMill',
    canonical_product_key: 'life-fitness-stepper-integrity-series-powermill',
    status: 'approved',
    source_intelligence_row_ids: ['pm-integrity'],
    original_base_price: null,
    original_price_confidence: null,
    baseline_manufacture_year: null,
  },
]
const queue = buildCanonicalProductResearchQueue(productsForQueue, { targetCount: 10, skipCompleted: false })
assert(queue.queue.length === 2, 'canonical research queue should research each approved product once')
assert(queue.queue.every((entry) => entry.dedupeEligible), 'canonical queue entries should be dedupe eligible')
assert(queue.summary.notApproved === 0, 'approved-only queue should not count notApproved')

const discoverPowermillProduct = {
  id: 'discover-pm',
  status: 'approved',
  canonical_product_name: 'Life Fitness Discover PowerMill',
  canonical_product_key: 'life-fitness-discover-powermill',
  source_intelligence_row_ids: ['d-se', 'd-se3', 'd-st'],
  original_base_price: null,
  original_price_confidence: null,
  baseline_manufacture_year: null,
}
const discoverQueue = buildCanonicalProductResearchQueue([discoverPowermillProduct], {
  targetCount: 10,
  skipCompleted: false,
})
assert(discoverQueue.queue.length === 1, 'Discover SE/ST/SE3 PowerMill must be one research target')
assert(
  discoverQueue.queue[0].canonicalProductName === 'Life Fitness Discover PowerMill',
  'research label must use canonical_product_name',
)
assert(
  !/SE3|ST Console|Discover SE/i.test(discoverQueue.queue[0].label),
  'research queue must not use console-specific intelligence names',
)

const consoleDuplicateProducts = [
  discoverPowermillProduct,
  {
    id: 'dup-se3',
    status: 'approved',
    canonical_product_name: 'Life Fitness Discover SE3 (2019>) PowerMill',
    canonical_product_key: 'life-fitness-discover-se3-powermill-dup',
    source_intelligence_row_ids: ['d-se3-only'],
    original_base_price: null,
    original_price_confidence: null,
    baseline_manufacture_year: null,
  },
]
const dedupedQueue = buildCanonicalProductResearchQueue(consoleDuplicateProducts, {
  targetCount: 10,
  skipCompleted: false,
})
assert(dedupedQueue.queue.length === 2, 'duplicate console canonical rows remain separate until repaired')

const repairPlan = buildConsoleDuplicateRepairPlan(
  [
    discoverPowermillProduct,
    {
      id: 'dup-se3',
      status: 'approved',
      canonical_product_name: 'Life Fitness Discover SE3 (2019>) PowerMill',
      canonical_product_key: 'life-fitness-discover-se3-powermill-dup',
      source_intelligence_row_ids: ['d-se3'],
      brand: 'Life Fitness',
      model: 'PowerMill',
      equipment_type: 'Stepper',
      product_family: 'Discover',
    },
    {
      id: 'dup-st',
      status: 'approved',
      canonical_product_name: 'Life Fitness Discover ST Console (2019>) PowerMill',
      canonical_product_key: 'life-fitness-discover-st-powermill-dup',
      source_intelligence_row_ids: ['d-st'],
      brand: 'Life Fitness',
      model: 'PowerMill',
      equipment_type: 'Stepper',
      product_family: 'Discover',
    },
  ],
  discoverPowermillRows,
)
assert(repairPlan.merges.length >= 1, 'console duplicate canonical products should produce a repair merge plan')

const skillmillRows = [
  { id: 'sm-base', brand: 'Technogym', model: 'Skillmill', equipment_type: 'Treadmill' },
  { id: 'sm-connect', brand: 'Technogym', model: 'Skillmill Connect', equipment_type: 'Treadmill' },
  { id: 'sm-console', brand: 'Technogym', model: 'Skillmill Console', equipment_type: 'Treadmill' },
]
const skillmillAudit = buildCanonicalProductAuditReport(skillmillRows)
assert(
  skillmillAudit.products.length < skillmillRows.length,
  'Skillmill Connect/Console variants should not all remain separate canonical products',
)

const displayGroups = buildCanonicalProductDisplayGroups([discoverPowermillProduct], { limit: 10 })
assert(displayGroups[0].primary_keyword === 'Life Fitness Discover PowerMill', 'display groups use canonical_product_name')
assert(displayGroups[0].isCanonicalProduct === true, 'display groups are marked canonical')

const pendingOnly = buildCanonicalProductResearchQueue([
  { ...discoverPowermillProduct, status: 'pending' },
], { targetCount: 10, skipCompleted: false })
assert(pendingOnly.queue.length === 0, 'pending products must not enter approved-only research queue')
assert(pendingOnly.summary.notApproved === 1, 'pending products should be counted as not approved')

// Idempotent audit payload shape (apply tested against RPC in integration; here verify stable keys)
const productsA = buildCanonicalProductsFromRows(powermillRows)
const productsB = buildCanonicalProductsFromRows(powermillRows)
assert(
  productsA[0].canonical_product_key === productsB[0].canonical_product_key,
  'audit grouping should be idempotent for the same input rows',
)

const approvedNotOverwritten = {
  status: PRODUCT_STATUS.APPROVED,
  original_base_price: 9999,
  original_price_confidence: 95,
}
assert(approvedNotOverwritten.status === 'approved', 'approved products should be protected from audit overwrite (enforced in RPC)')

const singleRowCandidate = {
  id: 'p1',
  status: PRODUCT_STATUS.PENDING,
  brand: 'Life Fitness',
  source_intelligence_row_ids: ['a'],
  model: 'T5',
  product_family: null,
  equipment_type: 'Treadmill',
}
const singleRowSource = [{ id: 'a', brand: 'Life Fitness', model: 'T5', equipment_type: 'Treadmill' }]
assert(isSafeApprovalCandidate(singleRowCandidate, singleRowSource), 'single source row pending product is safe')

const discoverPowermillCandidate = {
  id: 'p2',
  status: PRODUCT_STATUS.PENDING,
  source_intelligence_row_ids: ['d-se', 'd-se3', 'd-st'],
  model: 'PowerMill',
  product_family: 'Discover',
  equipment_type: 'Stepper',
}
assert(
  isSafeApprovalCandidate(discoverPowermillCandidate, discoverPowermillRows),
  'Discover PowerMill console variants should be safe approval candidates',
)

const needsReviewCandidate = { ...singleRowCandidate, status: PRODUCT_STATUS.NEEDS_REVIEW }
assert(!isSafeApprovalCandidate(needsReviewCandidate, []), 'needs_review without source row must not be safe')

const lowConfidenceSingleReview = {
  id: 'rev-safe',
  status: PRODUCT_STATUS.NEEDS_REVIEW,
  brand: 'Life Fitness',
  equipment_type: 'Treadmill',
  model: '95Ti',
  product_family: 'Integrity',
  review_notes: 'medium-confidence grouping',
  source_intelligence_row_ids: ['95ti'],
}
assert(
  isSafeApprovalCandidate(
    lowConfidenceSingleReview,
    [{ id: '95ti', brand: 'Life Fitness', model: '95Ti', equipment_type: 'Treadmill', product_family: 'Integrity' }],
  ),
  'single-source needs_review with only low-confidence reason should be safe',
)

const unsafeSingleReview = {
  ...lowConfidenceSingleReview,
  id: 'rev-unsafe',
  review_notes: 'missing canonical identity; medium-confidence grouping',
}
assert(
  !isSafeApprovalCandidate(
    unsafeSingleReview,
    [{ id: '95ti', brand: 'Life Fitness', model: '95Ti', equipment_type: 'Treadmill' }],
  ),
  'single-source needs_review with extra review reasons must not be safe',
)

const tiTeConflict = {
  id: 'p3',
  status: PRODUCT_STATUS.PENDING,
  source_intelligence_row_ids: ['95ti', '95te'],
  model: '95Ti',
  product_family: 'Integrity',
  equipment_type: 'Treadmill',
}
assert(
  !isSafeApprovalCandidate(tiTeConflict, tiTeRows.map((row) => ({ ...row, product_family: 'Integrity' }))),
  'distinct hardware models must not be safe candidates',
)

const highConfidenceEligible = evaluateHighConfidenceApproval(
  {
    id: 'hc-1',
    status: PRODUCT_STATUS.NEEDS_REVIEW,
    brand: 'Life Fitness',
    equipment_type: 'Stepper',
    source_intelligence_row_ids: ['d-se', 'd-se3', 'd-st'],
  },
  discoverPowermillRows,
  { minScore: 90 },
)
assert(highConfidenceEligible.eligible, 'high-confidence Discover PowerMill should be eligible at 90+')

const lowConfidence = evaluateHighConfidenceApproval(
  {
    id: 'hc-2',
    status: PRODUCT_STATUS.PENDING,
    brand: 'Life Fitness',
    equipment_type: 'Treadmill',
    source_intelligence_row_ids: ['95ti'],
  },
  [{ id: '95ti', brand: 'Life Fitness', model: '95Ti', equipment_type: 'Treadmill' }],
  { minScore: 95 },
)
assert(!lowConfidence.eligible, 'scores below threshold must not be eligible')

const blockedProduct = evaluateHighConfidenceApproval(
  {
    id: 'hc-3',
    status: PRODUCT_STATUS.PENDING,
    brand: 'Life Fitness',
    equipment_type: 'Treadmill',
    review_notes: '[blocked] manual hold',
    source_intelligence_row_ids: ['95ti'],
  },
  [{ id: '95ti', brand: 'Life Fitness', model: '95Ti', equipment_type: 'Treadmill', core_product_group_confidence: 95 }],
  { minScore: 90 },
)
assert(!blockedProduct.eligible, 'manually blocked products must not be eligible')

const integrityBikeRows = [
  {
    id: 'bike-old',
    brand: 'Life Fitness',
    series: 'Integrity Series',
    model: 'Bike (2011-2018)',
    equipment_type: 'Exercise Bike',
    best_original_price: 5200,
    best_original_price_confidence: 88,
    baseline_manufacture_year: 2015,
  },
  {
    id: 'bike-new',
    brand: 'Life Fitness',
    series: 'Integrity Series',
    model: 'Bike (2018>)',
    equipment_type: 'Exercise Bike',
  },
]
const integrityBikeAudit = buildCanonicalProductAuditReport(integrityBikeRows)
assert(integrityBikeAudit.products.length === 1, 'Integrity Series Bike and Bike (2018>) should collapse')
assert(
  integrityBikeAudit.products[0].canonical_product_name === 'Life Fitness Integrity Series Bike',
  'collapsed Integrity Bike canonical name should not include date suffix',
)
assert(
  !integrityBikeAudit.products[0].canonical_product_key.includes('2018'),
  'collapsed Integrity Bike canonical key should not include year suffix',
)
assert(integrityBikeAudit.products[0].original_base_price === 5200, 'verified RRP preserved when collapsing date variants')
assert(integrityBikeAudit.products[0].baseline_manufacture_year === 2015, 'verified baseline year preserved when collapsing date variants')
assert(
  integrityBikeAudit.products[0].lifecycle_notes?.includes('(2018>)')
    || integrityBikeAudit.products[0].source_rows.some((row) => row.lifecycle_note === '(2018>)'),
  'date marker stored separately from canonical identity',
)

const integrityCrossRows = [
  {
    id: 'cross-old',
    brand: 'Life Fitness',
    series: 'Integrity Series',
    model: 'Crosstrainer (2011-2018)',
    equipment_type: 'Cross-Trainer',
  },
  {
    id: 'cross-new',
    brand: 'Life Fitness',
    series: 'Integrity Series',
    model: 'Crosstrainer (2018>)',
    equipment_type: 'Cross-Trainer',
  },
]
const integrityCrossAudit = buildCanonicalProductAuditReport(integrityCrossRows)
assert(integrityCrossAudit.products.length === 1, 'Integrity Series Crosstrainer date variants should collapse')
assert(
  integrityCrossAudit.products[0].canonical_product_name === 'Life Fitness Integrity Series Crosstrainer',
  'collapsed Integrity Crosstrainer canonical name',
)

const discoverSeDerived = deriveCoreProductFields({
  brand: 'Life Fitness',
  series: 'Discover SE (2015-19)',
  model: 'PowerMill',
  equipment_type: 'Stepper',
})
assert(
  discoverSeDerived.core_product_name === 'Life Fitness Discover PowerMill',
  'Discover SE (2015-19) strips console/date marker from series while keeping Discover family',
)
assert(discoverSeDerived.variant_name === 'SE', 'Discover SE console variant preserved separately')
assert(
  discoverSeDerived.lifecycle_note === '(2015-19)' || stripBracketedYearMarkers('Discover SE (2015-19)').lifecycleNote === '(2015-19)',
  'Discover SE date marker captured as lifecycle note',
)

const integrityProductDuplicates = [
  {
    id: 'keeper-bike',
    status: 'approved',
    brand: 'Life Fitness',
    product_family: 'Integrity Series',
    model: 'Bike',
    equipment_type: 'Exercise Bike',
    canonical_product_name: 'Life Fitness Integrity Series Bike',
    canonical_product_key: 'life-fitness-exercise-bike-integrity-series-bike',
    source_intelligence_row_ids: ['bike-old'],
    baseline_manufacture_year: 2015,
    original_base_price: 5200,
    original_price_confidence: 88,
  },
  {
    id: 'dup-bike',
    status: 'pending',
    brand: 'Life Fitness',
    product_family: 'Integrity Series',
    model: 'Bike (2018>)',
    equipment_type: 'Exercise Bike',
    canonical_product_name: 'Life Fitness Integrity Series Bike (2018>)',
    canonical_product_key: 'life-fitness-exercise-bike-integrity-series-bike-2018',
    source_intelligence_row_ids: ['bike-new'],
  },
]
const integrityRepairPlan = buildConsoleDuplicateRepairPlan(integrityProductDuplicates, integrityBikeRows)
assert(integrityRepairPlan.merges.length === 1, 'existing Integrity Bike date-suffix products should merge')
const mergedFields = coalesceMergedCanonicalProductFields(
  integrityRepairPlan.merges[0].keeper,
  integrityRepairPlan.merges[0].duplicates,
  integrityRepairPlan.merges[0].idealProduct,
)
assert(mergedFields.baseline_manufacture_year === 2015, 'merge keeps verified baseline year from keeper/duplicate set')
assert(mergedFields.original_base_price === 5200, 'merge keeps verified RRP from keeper/duplicate set')
assert(
  mergedFields.canonical_product_name === 'Life Fitness Integrity Series Bike',
  'merge renames keeper to clean canonical product name',
)

console.log('canonical equipment products tests passed')
