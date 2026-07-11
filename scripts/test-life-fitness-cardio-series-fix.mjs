/**
 * Life Fitness cardio series fix plan tests.
 */

import {
  buildLifeFitnessCardioSeriesFixPlan,
  buildImageTransferPatch,
  ELEVATION_SERIES_BASELINE_YEAR,
  isDiscoverSeriesCardioProduct,
} from '../src/lib/lifeFitnessCardioSeriesFix.js'

function assert(condition, label) {
  if (!condition) throw new Error(label)
}

const discoverPowermill = {
  id: 'discover-pm',
  brand: 'Life Fitness',
  product_family: 'Discover',
  model: 'PowerMill',
  equipment_type: null,
  canonical_product_name: 'Life Fitness Discover PowerMill',
  canonical_product_key: 'life-fitness-discover-powermill',
  baseline_manufacture_year: 2019,
  original_base_price: 14550,
  image_status: 'approved',
  image_url: 'https://example.com/pm.png',
  status: 'approved',
  source_intelligence_row_ids: ['src-pm'],
}

const elevationCrosstrainer = {
  id: 'elevation-cross',
  brand: 'Life Fitness',
  product_family: 'Elevation',
  model: 'Crosstrainer',
  equipment_type: 'Cross Trainer',
  canonical_product_name: 'Life Fitness Elevation Crosstrainer',
  canonical_product_key: 'life-fitness-cross-trainer-elevation-crosstrainer',
  baseline_manufacture_year: 2008,
  original_base_price: 14695,
  image_status: 'missing',
  status: 'approved',
  source_intelligence_row_ids: ['src-cross'],
}

const discoverCrosstrainer = {
  id: 'discover-cross',
  brand: 'Life Fitness',
  product_family: 'Discover',
  model: 'Crosstrainer',
  equipment_type: 'Cross Trainer',
  canonical_product_name: 'Life Fitness Discover Crosstrainer',
  canonical_product_key: 'life-fitness-cross-trainer-discover-crosstrainer',
  baseline_manufacture_year: 2012,
  original_base_price: 14695,
  image_status: 'approved',
  image_url: 'https://example.com/cross.png',
  status: 'approved',
  source_intelligence_row_ids: ['src-discover-cross'],
}

assert(isDiscoverSeriesCardioProduct(discoverPowermill), 'Discover PowerMill is Discover Series cardio')

const imagePatch = buildImageTransferPatch(elevationCrosstrainer, discoverCrosstrainer)
assert(imagePatch?.image_url === discoverCrosstrainer.image_url, 'approved Discover image transfers to Elevation keeper')

const plan = buildLifeFitnessCardioSeriesFixPlan([
  discoverPowermill,
  discoverCrosstrainer,
  elevationCrosstrainer,
  {
    id: 'integrity-treadmill',
    brand: 'Life Fitness',
    product_family: 'Integrity Series',
    model: 'Treadmill',
    equipment_type: 'Treadmill',
    canonical_product_name: 'Life Fitness Integrity Series Treadmill',
    canonical_product_key: 'life-fitness-treadmill-integrity-series-treadmill',
    baseline_manufacture_year: 2017,
    status: 'approved',
    source_intelligence_row_ids: ['src-int-tread'],
  },
  {
    id: 'integrity-treadmill-dup',
    brand: 'Life Fitness',
    product_family: 'Integrity Series',
    model: 'Treadmill (2018>)',
    equipment_type: 'Treadmill',
    canonical_product_name: 'Life Fitness Integrity Series Treadmill (2018>)',
    canonical_product_key: 'life-fitness-treadmill-integrity-series-treadmill-2018',
    baseline_manufacture_year: 2017,
    status: 'excluded',
    source_intelligence_row_ids: ['src-int-tread-dup'],
  },
])

assert(plan.renames.length === 1, 'orphan Discover PowerMill renames to Elevation Series')
assert(
  plan.renames[0].target.canonical_product_name === 'Life Fitness Elevation Series PowerMill',
  'Discover PowerMill becomes Elevation Series PowerMill',
)

const discoverMerge = plan.merges.find((merge) => merge.duplicate.id === 'discover-cross')
assert(discoverMerge, 'Discover Crosstrainer merges into Elevation Crosstrainer')
assert(discoverMerge.keeper.id === 'elevation-cross', 'Elevation Crosstrainer is merge keeper')
assert(plan.imagePreservations.length >= 1, 'image preservation planned for merge')

const powermillBaseline = plan.baselineUpdates.find((entry) => entry.product.id === 'discover-pm')
assert(powermillBaseline?.proposedBaseline === ELEVATION_SERIES_BASELINE_YEAR, 'renamed PowerMill gets 2010 baseline')

const elevationBaseline = plan.baselineUpdates.find((entry) => entry.product.id === 'elevation-cross')
assert(elevationBaseline?.proposedBaseline === ELEVATION_SERIES_BASELINE_YEAR, 'Elevation Crosstrainer baseline moves to 2010')

const integrityDupArchive = plan.archives.find((archive) => archive.product.id === 'integrity-treadmill-dup')
assert(integrityDupArchive, 'Integrity lifecycle duplicate archived')

console.log('life-fitness-cardio-series-fix: all tests passed')
