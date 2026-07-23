/**
 * Tests for canonical product display-name deduplication.
 */

import {
  buildCanonicalProductDisplayName,
  cleanCanonicalProductDisplayName,
  getCanonicalDisplayNameSeriesWarning,
  normalizeDisplayNameText,
  removeAdjacentRepeatedDisplayPhrases,
} from '../src/lib/canonicalProductDisplayName.js'
import { buildCanonicalProductName } from '../src/lib/canonicalProductCsvImport.js'
import { buildCoreProductName } from '../src/lib/intelligenceCoreProductGrouping.js'
import { getEquipmentProductDisplayName } from '../src/lib/equipmentValuation.js'
import { getEquipmentProductPublicName } from '../src/lib/equipmentPageSeo.js'
import { formatPublicCanonicalProductDisplayName } from '../src/lib/brandCatalogueCore.js'

function assert(condition, label) {
  if (!condition) throw new Error(label)
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`)
  }
}

assertEqual(
  buildCanonicalProductDisplayName({
    brand: 'ProForm',
    series: 'Carbon',
    model: 'Carbon Pro 9000',
  }),
  'ProForm Carbon Pro 9000',
  'ProForm Carbon + Carbon Pro 9000',
)

assertEqual(
  buildCanonicalProductDisplayName({
    brand: 'StairMaster',
    series: 'HIIT',
    model: 'HIIT Bike',
  }),
  'StairMaster HIIT Bike',
  'StairMaster HIIT + HIIT Bike',
)

assertEqual(
  buildCanonicalProductDisplayName({
    brand: 'NordicTrack',
    series: 'Commercial',
    model: 'Commercial 1750',
  }),
  'NordicTrack Commercial 1750',
  'NordicTrack Commercial + Commercial 1750',
)

assertEqual(
  buildCanonicalProductDisplayName({
    brand: 'Schwinn',
    series: 'Airdyne',
    model: 'AD7',
  }),
  'Schwinn Airdyne AD7',
  'Schwinn Airdyne + AD7',
)

assertEqual(
  buildCanonicalProductDisplayName({
    brand: 'Schwinn',
    series: 'Airdyne',
    model: 'Airdyne AD7',
  }),
  'Schwinn Airdyne AD7',
  'Schwinn Airdyne + Airdyne AD7',
)

assertEqual(
  buildCanonicalProductDisplayName({
    brand: 'WaterRower',
    series: 'Original',
    model: 'Original',
  }),
  'WaterRower Original',
  'WaterRower Original + Original',
)

assertEqual(
  buildCanonicalProductDisplayName({
    brand: 'ProForm',
    series: 'Pro Series',
    model: 'Pro 9000',
  }),
  'ProForm Pro Series Pro 9000',
  'ProForm Pro Series + Pro 9000 keeps series',
)

assertEqual(
  buildCanonicalProductDisplayName({
    brand: 'Concept2',
    series: 'Indoor Rower',
    model: 'Model D',
  }),
  'Concept2 Indoor Rower Model D',
  'Concept2 Indoor Rower Model D',
)

assertEqual(
  buildCanonicalProductDisplayName({
    brand: 'Life Fitness',
    series: '95 Series',
    model: '95Ti',
  }),
  'Life Fitness 95 Series 95Ti',
  'Life Fitness 95 Series 95Ti',
)

assertEqual(
  removeAdjacentRepeatedDisplayPhrases('Tour de France Tour de France 5.0'),
  'Tour de France 5.0',
  'phrase-level Tour de France dedupe',
)

assertEqual(
  removeAdjacentRepeatedDisplayPhrases('Studio Bike Studio Bike Pro 22'),
  'Studio Bike Pro 22',
  'phrase-level Studio Bike dedupe',
)

assertEqual(
  cleanCanonicalProductDisplayName('StairMaster StairMaster HIIT HIIT Bike', {
    brand: 'StairMaster',
    series: 'HIIT',
  }),
  'StairMaster HIIT Bike',
  'clean stored StairMaster double brand/series',
)

assertEqual(
  cleanCanonicalProductDisplayName('ProForm Carbon Carbon Pro 9000'),
  'ProForm Carbon Pro 9000',
  'clean stored ProForm Carbon Carbon',
)

assertEqual(
  buildCanonicalProductDisplayName({
    brand: 'Life Fitness',
    series: null,
    model: 'LifeCycle',
  }),
  'Life Fitness LifeCycle',
  'Life Fitness LifeCycle preserved',
)

assertEqual(
  buildCanonicalProductDisplayName({
    brand: 'Matrix',
    series: null,
    model: 'Matrix ClimbMill',
  }),
  'Matrix ClimbMill',
  'Matrix brand stripped from model prefix',
)

assertEqual(
  buildCanonicalProductDisplayName({
    brand: 'REP',
    series: null,
    model: 'PR-5000 Power Rack',
  }),
  'REP PR-5000 Power Rack',
  'REP PR-5000 Power Rack unchanged',
)

assertEqual(
  buildCanonicalProductDisplayName({
    brand: 'ProForm',
    series: null,
    model: 'Pro 9000',
  }),
  'ProForm Pro 9000',
  'ProForm Pro 9000 unchanged',
)

assert(
  normalizeDisplayNameText('StairMaster') === normalizeDisplayNameText('Stair Master'),
  'StairMaster ~ Stair Master',
)
assert(
  normalizeDisplayNameText('WaterRower') === normalizeDisplayNameText('Water Rower'),
  'WaterRower ~ Water Rower',
)
assert(
  normalizeDisplayNameText('F-85') === normalizeDisplayNameText('F85'),
  'F-85 ~ F85 for comparison',
)

assertEqual(
  buildCanonicalProductName({
    brand: 'NordicTrack',
    series: 'Commercial',
    model: 'Commercial 1750',
  }),
  'NordicTrack Commercial 1750',
  'CSV builder uses shared helper',
)

assertEqual(
  buildCoreProductName('Schwinn', 'Airdyne', 'Airdyne AD7'),
  'Schwinn Airdyne AD7',
  'core product name uses shared helper',
)

const warning = getCanonicalDisplayNameSeriesWarning({
  brand: 'ProForm',
  series: 'Carbon',
  model: 'Carbon Pro 9000',
})
assert(Boolean(warning), 'series-in-model warning present')
assert(
  warning.includes('Series is already present in model'),
  'series-in-model warning text',
)

const product = {
  brand: 'StairMaster',
  product_family: 'HIIT',
  model: 'HIIT Bike',
  canonical_product_name: 'StairMaster HIIT HIIT Bike',
  canonical_product_key: 'stairmaster-hiit-bike',
}
assertEqual(getEquipmentProductDisplayName(product), 'StairMaster HIIT Bike', 'valuator display name')
assertEqual(getEquipmentProductPublicName(product), 'StairMaster HIIT Bike', 'SEO public name')
assertEqual(
  formatPublicCanonicalProductDisplayName(product),
  'StairMaster HIIT Bike',
  'public catalogue display name',
)
assertEqual(product.canonical_product_key, 'stairmaster-hiit-bike', 'canonical key unchanged')

console.log('canonical product display name tests passed')
