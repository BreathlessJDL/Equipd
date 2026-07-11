/**
 * Tests for canonical product dedupe by approved core groups and display identity.
 */

import {
  analyzeCanonicalProductDedupe,
  buildCanonicalProductDisplayIdentityKey,
  dedupeCanonicalProductsByApprovedCoreGroups,
  dedupeCanonicalProductsByDisplayIdentity,
  dedupeCanonicalProductsForWorkflow,
} from '../src/lib/canonicalProductDedupe.js'
import { buildCanonicalProductDisplayGroups } from '../src/lib/equipmentResearchQueue.js'

function assert(condition, label) {
  if (!condition) throw new Error(label)
}

const intelligenceRowsById = new Map([
  ['row-led', {
    id: 'row-led',
    core_product_key: 'technogym-treadmill-excite-top-700',
    core_product_group_status: 'approved',
    is_base_product: true,
  }],
  ['row-unity', {
    id: 'row-unity',
    core_product_key: 'technogym-treadmill-excite-top-700',
    core_product_group_status: 'approved',
    is_base_product: false,
  }],
])

const coreGroupProducts = [
  {
    id: 'prod-top-led',
    status: 'approved',
    brand: 'Technogym',
    equipment_type: 'Treadmill',
    canonical_product_name: 'Technogym Excite Top 700',
    canonical_product_key: 'technogym-treadmill-excite-top-700-led',
    source_intelligence_row_ids: ['row-led'],
  },
  {
    id: 'prod-top-unity',
    status: 'approved',
    brand: 'Technogym',
    equipment_type: 'Treadmill',
    canonical_product_name: 'Technogym Excite Top 700',
    canonical_product_key: 'technogym-treadmill-excite-top-700-unity',
    source_intelligence_row_ids: ['row-unity'],
  },
]

const liveStyleProducts = [
  {
    id: 'prod-top-sp',
    status: 'approved',
    brand: 'Technogym',
    equipment_type: 'Upper Body Ergometer',
    canonical_product_name: 'Technogym Excite Top 700',
    canonical_product_key: 'technogym-upper-body-ergometer-excite-top-top-excite-700-sp-without-seat-ifi',
    source_intelligence_row_ids: ['intel-sp-1', 'intel-sp-2'],
  },
  {
    id: 'prod-top-digital',
    status: 'approved',
    brand: 'Technogym',
    equipment_type: 'Upper Body Ergometer',
    canonical_product_name: 'Technogym Excite Top 700',
    canonical_product_key: 'technogym-upper-body-ergometer-excite-top-top-excite-700-digital-tv-without-seat',
    source_intelligence_row_ids: ['intel-digital-1'],
  },
  {
    id: 'prod-top-base',
    status: 'approved',
    brand: 'Technogym',
    equipment_type: 'Upper Body Ergometer',
    canonical_product_name: 'Technogym Excite Top 700',
    canonical_product_key: 'technogym-upper-body-ergometer-excite-top-700',
    source_intelligence_row_ids: ['intel-base-1', 'intel-base-2', 'intel-base-3', 'intel-base-4', 'intel-base-5', 'intel-base-6'],
  },
  {
    id: 'prod-bike-main',
    status: 'approved',
    brand: 'Technogym',
    equipment_type: 'Upright Bike',
    canonical_product_name: 'Technogym Excite New Bike 700',
    canonical_product_key: 'technogym-upright-bike-excite-new-bike-new-bike-excite-700',
    source_intelligence_row_ids: Array.from({ length: 41 }, (_, index) => `bike-${index}`),
  },
  {
    id: 'prod-bike-digital',
    status: 'approved',
    brand: 'Technogym',
    equipment_type: 'Upright Bike',
    canonical_product_name: 'Technogym Excite New Bike 700',
    canonical_product_key: 'technogym-upright-bike-excite-new-bike-new-bike-excite-700-digital',
    source_intelligence_row_ids: Array.from({ length: 10 }, (_, index) => `bike-digital-${index}`),
  },
]

const liveStyleIntelligence = new Map([
  ['intel-base-1', { id: 'intel-base-1', is_base_product: true }],
  ['intel-sp-1', { id: 'intel-sp-1', is_base_product: true }],
])

const afterCore = dedupeCanonicalProductsByApprovedCoreGroups(coreGroupProducts, intelligenceRowsById)
assert(afterCore.length === 1, 'core-group dedupe should collapse cross-product variants with shared approved core key')

const afterDisplay = dedupeCanonicalProductsByDisplayIdentity(liveStyleProducts, liveStyleIntelligence)
assert(afterDisplay.length === 2, 'display identity dedupe should collapse same-name Technogym products per model')
assert(
  afterDisplay.find((product) => product.canonical_product_name === 'Technogym Excite Top 700')?.id === 'prod-top-base',
  'representative should prefer the product with the most linked source rows',
)
assert(
  afterDisplay.find((product) => product.canonical_product_name === 'Technogym Excite New Bike 700')?.id === 'prod-bike-main',
  'New Bike 700 representative should be the highest-source product',
)

const workflow = dedupeCanonicalProductsForWorkflow(liveStyleProducts, liveStyleIntelligence)
const analysis = analyzeCanonicalProductDedupe(liveStyleProducts, liveStyleIntelligence)
assert(analysis.rawApproved === 5, 'analysis should count raw approved products')
assert(analysis.afterDisplayIdentity === 2, 'analysis should report display identity collapse')
assert(workflow.length === 2, 'workflow dedupe should output one row per display identity')

const top100 = buildCanonicalProductDisplayGroups(workflow, { limit: 100 })
assert(
  top100.filter((group) => group.primary_keyword === 'Technogym Excite Top 700').length === 1,
  'Top 100 should contain one Technogym Excite Top 700 row',
)
assert(
  top100.find((group) => group.primary_keyword === 'Technogym Excite Top 700')?.member_count === 9,
  'Top 100 row should aggregate source counts from collapsed variants',
)

assert(
  buildCanonicalProductDisplayIdentityKey(liveStyleProducts[0])
  === buildCanonicalProductDisplayIdentityKey(liveStyleProducts[2]),
  'display identity key should match for same brand/type/name',
)

console.log('canonical product dedupe tests passed')
