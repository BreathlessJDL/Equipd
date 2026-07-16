/**
 * Token-aware equipment product search tests.
 */

import {
  parseEquipmentProductSearchQuery,
  productMatchesEquipmentIntent,
  searchEquipmentProductCatalog,
} from '../src/lib/equipmentProductSearch.js'
import { searchEquipmentProducts, shouldClearSelectedValuationProduct } from '../src/lib/equipmentValuation.js'

function assert(condition, label) {
  if (!condition) throw new Error(label)
}

function assertFirstModel(matches, modelNeedle, label) {
  assert(matches.length > 0, `${label}: expected matches`)
  const first = matches[0]
  const haystack = [
    first.model,
    first.canonical_product_name,
    first.canonical_product_key,
  ].join(' ').toLowerCase()
  assert(haystack.includes(String(modelNeedle).toLowerCase()), label)
}

function assertBrandPresent(matches, brandNeedle, label) {
  assert(
    matches.some((product) => String(product.brand || '').toLowerCase().includes(String(brandNeedle).toLowerCase())),
    label,
  )
}

const precorCatalog = [
  {
    id: 'precor-abdominal',
    brand: 'Precor',
    model: 'Abdominal Crunch',
    canonical_product_name: 'Precor Icarian Abdominal Crunch',
    canonical_product_key: 'precor-treadmill-icarian-abdominal-crunch',
    equipment_type: 'Abdominal Machine',
  },
  {
    id: 'precor-956i',
    brand: 'Precor',
    model: '956i',
    canonical_product_name: 'Precor Experience 956i',
    canonical_product_key: 'precor-treadmill-experience-956i',
    equipment_type: 'Treadmill',
  },
  {
    id: 'precor-efx',
    brand: 'Precor',
    model: 'EFX546 Lower Body Crosstrainer',
    canonical_product_name: 'Precor Experience EFX546 Lower Body Crosstrainer',
    canonical_product_key: 'precor-cross-trainer-experience-efx546-lower-body-crosstrainer',
    equipment_type: 'Cross Trainer',
  },
  {
    id: 'precor-rbk',
    brand: 'Precor',
    model: 'Precor RBK615 Recumbent Bike',
    canonical_product_name: 'Precor Experience Precor RBK615 Recumbent Bike',
    canonical_product_key: 'precor-exercise-bike-experience-precor-rbk615-recumbent-bike',
    equipment_type: 'Recumbent Bike',
  },
  {
    id: 'precor-trm',
    brand: 'Precor',
    model: 'Precor TRM811',
    canonical_product_name: 'Precor Experience Precor TRM811',
    canonical_product_key: 'precor-treadmill-experience-precor-trm811',
    equipment_type: 'Treadmill',
  },
]

const precorTreadmillSearch = searchEquipmentProductCatalog(precorCatalog, 'precor treadmill')
const precorTreadmSearch = searchEquipmentProductCatalog(precorCatalog, 'precor treadm')
assert(
  !precorTreadmillSearch.matches.some((product) => product.canonical_product_name.includes('Abdominal')),
  'precor treadmill does not return abdominal crunch',
)
assert(
  !precorTreadmSearch.matches.some((product) => product.canonical_product_name.includes('Abdominal')),
  'precor treadm does not return abdominal crunch',
)
assert(
  precorTreadmillSearch.matches.some((product) => product.canonical_product_name.includes('956i')),
  'precor treadmill returns Precor Experience 956i',
)
assert(
  precorTreadmSearch.matches.some((product) => product.canonical_product_name.includes('956i')),
  'precor treadm returns Precor Experience 956i',
)
assert(
  parseEquipmentProductSearchQuery('precor treadm').equipmentIntent?.id === 'treadmill',
  'precor treadm infers treadmill intent',
)

assert(
  shouldClearSelectedValuationProduct(precorCatalog[0], precorCatalog, 'precor treadmill'),
  'stale abdominal selection is cleared for precor treadmill query',
)
assert(
  !shouldClearSelectedValuationProduct(precorCatalog[1], precorCatalog, 'precor treadmill'),
  'matching treadmill selection is kept for precor treadmill query',
)
assert(
  !shouldClearSelectedValuationProduct(precorCatalog[1], [], 'precor treadmill'),
  'empty catalogue must not clear a valid selection (homepage prefill race)',
)

const valuationMatches = searchEquipmentProducts(precorCatalog, 'precor treadmill').matches
const catalogMatches = searchEquipmentProductCatalog(precorCatalog, 'precor treadmill').matches
assert(
  valuationMatches.map((product) => product.canonical_product_key).join('|')
    === catalogMatches.map((product) => product.canonical_product_key).join('|'),
  'valuation search order matches equipmentProductSearch output',
)

const precorAbdominalSearch = searchEquipmentProductCatalog(precorCatalog, 'precor abdominal')
assert(
  precorAbdominalSearch.matches.some((product) => product.canonical_product_name.includes('Abdominal Crunch')),
  'precor abdominal returns abdominal crunch',
)
assert(
  !precorAbdominalSearch.matches.some((product) => product.equipment_type === 'Treadmill'),
  'precor abdominal does not return treadmills',
)

const precor956iSearch = searchEquipmentProductCatalog(precorCatalog, 'precor 956i')
assert(
  precor956iSearch.matches.some((product) => product.canonical_product_name.includes('956i')),
  'precor 956i returns Precor Experience 956i',
)
assert(
  precor956iSearch.matches.length === 1,
  'precor 956i returns only the 956i model',
)

const precorEfxSearch = searchEquipmentProductCatalog(precorCatalog, 'precor efx')
assert(
  precorEfxSearch.matches.some((product) => product.canonical_product_name.includes('EFX')),
  'precor efx returns EFX cross trainers',
)
assert(
  !precorEfxSearch.matches.some((product) => product.equipment_type === 'Treadmill'),
  'precor efx does not return treadmills',
)

const precorRbkSearch = searchEquipmentProductCatalog(precorCatalog, 'precor rbk')
assert(
  precorRbkSearch.matches.some((product) => product.equipment_type === 'Recumbent Bike'),
  'precor rbk returns recumbent bikes',
)
assert(
  !precorRbkSearch.matches.some((product) => product.equipment_type === 'Treadmill'),
  'precor rbk does not return treadmills',
)

assert(
  parseEquipmentProductSearchQuery('precor efx').equipmentIntent?.id === 'cross_trainer',
  'precor efx infers cross trainer intent',
)
assert(
  parseEquipmentProductSearchQuery('precor rbk').equipmentIntent?.id === 'recumbent_bike',
  'precor rbk infers recumbent bike intent',
)
assert(
  parseEquipmentProductSearchQuery('precor 956i').equipmentIntent?.id === 'treadmill',
  'precor 956i infers treadmill intent from model code',
)

const matrixCatalog = [
  {
    brand: 'Matrix Fitness',
    model: 'Recumbent Bike',
    canonical_product_name: 'Matrix Fitness R3x Recumbent Bike',
    canonical_product_key: 'matrix-fitness-r3x-recumbent-bike',
    equipment_type: 'Recumbent Bike',
  },
  {
    brand: 'Matrix Fitness',
    model: 'Abdominal Crunch',
    canonical_product_name: 'Matrix Fitness G3 Abdominal Crunch',
    canonical_product_key: 'matrix-fitness-g3-abdominal-crunch',
    equipment_type: 'Abdominal Machine',
  },
]

const matrixRecumbentSearch = searchEquipmentProductCatalog(matrixCatalog, 'matrix recumbent')
assert(
  matrixRecumbentSearch.matches.some((product) => product.equipment_type === 'Recumbent Bike'),
  'matrix recumbent returns recumbent bike',
)

const lifeFitnessCatalog = [
  {
    brand: 'Life Fitness',
    model: 'Chest Press',
    canonical_product_name: 'Life Fitness Insignia Chest Press',
    canonical_product_key: 'life-fitness-insignia-chest-press',
    equipment_type: 'Chest Press',
  },
  {
    brand: 'Life Fitness',
    model: 'Treadmill',
    canonical_product_name: 'Life Fitness 95T Treadmill',
    canonical_product_key: 'life-fitness-95t-treadmill',
    equipment_type: 'Treadmill',
  },
]

const lifeFitnessChestPressSearch = searchEquipmentProductCatalog(lifeFitnessCatalog, 'life fitness chest press')
assert(
  lifeFitnessChestPressSearch.matches.some((product) => product.equipment_type === 'Chest Press'),
  'life fitness chest press returns chest press',
)
assert(
  !lifeFitnessChestPressSearch.matches.some((product) => product.equipment_type === 'Treadmill'),
  'life fitness chest press does not return treadmills',
)

const technogymRunSearch = searchEquipmentProducts([
  {
    brand: 'Technogym',
    model: 'Run 700',
    canonical_product_name: 'Technogym Excite Run 700',
    canonical_product_key: 'technogym-excite-run-700',
    equipment_type: 'Treadmill',
  },
], 'technogym run')
assert(technogymRunSearch.matches.length === 1, 'technogym run returns treadmill product')

const technogymCatalog = [
  {
    brand: 'Technogym',
    model: 'Excite Run 700',
    product_family: 'Excite',
    canonical_product_name: 'Technogym Excite Run 700',
    canonical_product_key: 'technogym-excite-run-700',
    equipment_type: 'Treadmill',
  },
  {
    brand: 'Technogym',
    model: 'Excite Bike 1000',
    product_family: 'Excite',
    canonical_product_name: 'Technogym Excite Bike 1000',
    canonical_product_key: 'technogym-excite-bike-1000',
    equipment_type: 'Exercise Bike',
  },
  {
    brand: 'Technogym',
    model: 'Excite Jog',
    product_family: 'Excite',
    canonical_product_name: 'Technogym Excite Jog',
    canonical_product_key: 'technogym-excite-jog',
    equipment_type: 'Treadmill',
  },
  {
    brand: 'Technogym',
    model: 'Kinesis One',
    product_family: 'Kinesis',
    canonical_product_name: 'Technogym Kinesis One',
    canonical_product_key: 'technogym-kinesis-one',
    equipment_type: 'Functional Trainer',
  },
]

const technogymExciteSearch = searchEquipmentProductCatalog(technogymCatalog, 'Technogym Excite')
assert(technogymExciteSearch.matches.length === 3, 'Technogym Excite returns all Excite products')
assert(
  !technogymExciteSearch.matches.some((product) => product.canonical_product_name.includes('Kinesis')),
  'Technogym Excite does not return Kinesis products',
)

const technogymExciteRunSearch = searchEquipmentProductCatalog(technogymCatalog, 'Technogym Excite Run')
assert(
  technogymExciteRunSearch.matches.length === 1
  && technogymExciteRunSearch.matches[0].canonical_product_key === 'technogym-excite-run-700',
  'Technogym Excite Run narrows to Run models',
)

const technogymPartialSearch = searchEquipmentProductCatalog(technogymCatalog, 'Technogym Ex')
assert(technogymPartialSearch.matches.length === 3, 'Technogym Ex partially matches Excite products')

const lifeFitnessSeriesCatalog = [
  {
    brand: 'Life Fitness',
    model: 'Integrity Series Treadmill',
    product_family: 'Integrity Series',
    canonical_product_name: 'Life Fitness Integrity Series Treadmill',
    equipment_type: 'Treadmill',
  },
  {
    brand: 'Life Fitness',
    model: 'Elevation Series PowerMill',
    product_family: 'Elevation Series',
    canonical_product_name: 'Life Fitness Elevation Series PowerMill',
    equipment_type: 'Stepper',
  },
]

const lifeFitSearch = searchEquipmentProductCatalog(lifeFitnessSeriesCatalog, 'Life Fit')
assert(lifeFitSearch.matches.length === 2, 'Life Fit prefix matches Life Fitness products')

const matrixClimbSearch = searchEquipmentProductCatalog([
  {
    brand: 'Matrix Fitness',
    model: 'C3x Climbmill',
    product_family: 'Ascent',
    canonical_product_name: 'Matrix Fitness C3x Climbmill',
    equipment_type: 'Stepper',
  },
], 'Matrix Climb')
assert(matrixClimbSearch.matches.length === 1, 'Matrix Climb matches climbmill products')

const parsed = parseEquipmentProductSearchQuery('precor treadmill')
assert(parsed.brand === 'Precor', 'parses precor brand')
assert(parsed.equipmentIntent?.id === 'treadmill', 'parses treadmill intent')
assert(parsed.requireBrandAndIntent, 'requires brand and intent for combined query')

const abdominalIntent = parseEquipmentProductSearchQuery('precor abdominal').equipmentIntent
assert(
  productMatchesEquipmentIntent(precorCatalog[0], abdominalIntent),
  'abdominal product matches abdominal intent',
)
assert(
  !productMatchesEquipmentIntent(precorCatalog[0], parsed.equipmentIntent),
  'abdominal product does not match treadmill intent',
)

// --- Redesigned ranking / brand coverage ---

const soleCatalog = [
  {
    brand: 'Sole Fitness',
    model: 'F80',
    product_family: 'F Series',
    canonical_product_name: 'Sole F80 Treadmill',
    canonical_product_key: 'sole-f80-treadmill',
    equipment_type: 'Treadmill',
  },
  {
    brand: 'Sole Fitness',
    model: 'F60',
    product_family: 'F Series',
    canonical_product_name: 'Sole F60 Treadmill',
    canonical_product_key: 'sole-f60-treadmill',
    equipment_type: 'Treadmill',
  },
  {
    brand: 'Sole Fitness',
    model: 'F63',
    product_family: 'F Series',
    canonical_product_name: 'Sole F63 Treadmill',
    canonical_product_key: 'sole-f63-treadmill',
    equipment_type: 'Treadmill',
  },
  {
    brand: 'Sole Fitness',
    model: 'F85',
    product_family: 'F Series',
    canonical_product_name: 'Sole F85 Treadmill',
    canonical_product_key: 'sole-f85-treadmill',
    equipment_type: 'Treadmill',
  },
]

const soleF85 = searchEquipmentProductCatalog(soleCatalog, 'Sole F85')
assertFirstModel(soleF85.matches, 'F85', 'Sole F85 returns F85 first')

const f85Only = searchEquipmentProductCatalog(soleCatalog, 'F85')
assertFirstModel(f85Only.matches, 'F85', 'F85 returns F85 first')

const f8Prefix = searchEquipmentProductCatalog(soleCatalog, 'F8')
assert(
  f8Prefix.matches[0].model === 'F85' || f8Prefix.matches[0].model === 'F80',
  'F8 ranks an F8x model first',
)
assert(
  f8Prefix.matches.slice(0, 2).every((product) => ['F85', 'F80'].includes(product.model)),
  'F8 returns F85 and F80 above F63',
)
assert(
  !f8Prefix.matches.some((product) => product.model === 'F63')
    || f8Prefix.matches.findIndex((product) => product.model === 'F63')
      > f8Prefix.matches.findIndex((product) => product.model === 'F80'),
  'F63 ranks below F80 for F8',
)

const stairCatalog = [
  {
    brand: 'StairMaster',
    model: '8 Series',
    product_family: 'Gauntlet',
    canonical_product_name: 'StairMaster Gauntlet 8 Series',
    canonical_product_key: 'stairmaster-gauntlet-8-series',
    equipment_type: 'Stair Climber',
  },
  {
    brand: 'StairMaster',
    model: 'SM5',
    product_family: 'Stepper',
    canonical_product_name: 'StairMaster SM5',
    canonical_product_key: 'stairmaster-sm5',
    equipment_type: 'Stepper',
  },
  {
    brand: 'Life Fitness',
    model: 'PowerMill',
    product_family: 'Elevation Series',
    canonical_product_name: 'Life Fitness Elevation Series PowerMill',
    canonical_product_key: 'life-fitness-elevation-powermill',
    equipment_type: 'Stepper',
  },
]

for (const query of ['Stair', 'Stairm', 'Stairmaster', 'Stair Master', 'StairMaster']) {
  const result = searchEquipmentProductCatalog(stairCatalog, query)
  assertBrandPresent(result.matches, 'StairMaster', `${query} returns StairMaster`)
  assert(
    result.matches.every((product) => product.brand === 'StairMaster'),
    `${query} does not return other brands ahead of StairMaster brand filter`,
  )
}

const commercialCatalog = [
  {
    brand: 'NordicTrack',
    model: 'Commercial 1750',
    product_family: 'Commercial',
    canonical_product_name: 'NordicTrack Commercial 1750',
    canonical_product_key: 'nordictrack-commercial-1750',
    equipment_type: 'Treadmill',
  },
  {
    brand: 'NordicTrack',
    model: 'Commercial 2450',
    product_family: 'Commercial',
    canonical_product_name: 'NordicTrack Commercial 2450',
    canonical_product_key: 'nordictrack-commercial-2450',
    equipment_type: 'Treadmill',
  },
]

assertFirstModel(
  searchEquipmentProductCatalog(commercialCatalog, 'Commercial 1750').matches,
  '1750',
  'Commercial 1750 returns 1750 first',
)

const adCatalog = [
  {
    brand: 'Spirit Fitness',
    model: 'AD7',
    canonical_product_name: 'Spirit Fitness AD7',
    canonical_product_key: 'spirit-ad7',
    equipment_type: 'Elliptical',
  },
  {
    brand: 'Spirit Fitness',
    model: 'AD6',
    canonical_product_name: 'Spirit Fitness AD6',
    canonical_product_key: 'spirit-ad6',
    equipment_type: 'Elliptical',
  },
]

assertFirstModel(searchEquipmentProductCatalog(adCatalog, 'AD7').matches, 'AD7', 'AD7 returns AD7 first')

const brandAliasCatalog = [
  {
    brand: 'Concept2',
    model: 'RowErg',
    canonical_product_name: 'Concept2 RowErg',
    canonical_product_key: 'concept2-rowerg',
    equipment_type: 'Rower',
  },
  {
    brand: 'WaterRower',
    model: 'A1',
    canonical_product_name: 'WaterRower A1',
    canonical_product_key: 'waterrower-a1',
    equipment_type: 'Rower',
  },
  {
    brand: 'York Fitness',
    model: 'Barbell',
    canonical_product_name: 'York Fitness Barbell',
    canonical_product_key: 'york-fitness-barbell',
    equipment_type: 'Free Weights',
  },
  {
    brand: 'REP',
    model: 'Fitness Bench',
    canonical_product_name: 'REP Fitness Bench',
    canonical_product_key: 'rep-fitness-bench',
    equipment_type: 'Bench',
  },
  {
    brand: 'Powertec',
    model: 'Leverage Squat',
    canonical_product_name: 'Powertec Leverage Squat',
    canonical_product_key: 'powertec-leverage-squat',
    equipment_type: 'Strength',
  },
  {
    brand: 'Technogym',
    model: 'Run',
    canonical_product_name: 'Technogym Run',
    canonical_product_key: 'technogym-run',
    equipment_type: 'Treadmill',
  },
  {
    brand: 'Life Fitness',
    model: '95T',
    canonical_product_name: 'Life Fitness 95T',
    canonical_product_key: 'life-fitness-95t',
    equipment_type: 'Treadmill',
  },
  {
    brand: 'NordicTrack',
    model: 'Commercial 1750',
    canonical_product_name: 'NordicTrack Commercial 1750',
    canonical_product_key: 'nordictrack-commercial-1750',
    equipment_type: 'Treadmill',
  },
]

assertBrandPresent(searchEquipmentProductCatalog(brandAliasCatalog, 'Concept2').matches, 'Concept2', 'Concept2 returns Concept2')
assertBrandPresent(searchEquipmentProductCatalog(brandAliasCatalog, 'Concept 2').matches, 'Concept2', 'Concept 2 returns Concept2')
assertBrandPresent(searchEquipmentProductCatalog(brandAliasCatalog, 'WaterRower').matches, 'WaterRower', 'WaterRower returns WaterRower')
assertBrandPresent(searchEquipmentProductCatalog(brandAliasCatalog, 'Water Rower').matches, 'WaterRower', 'Water Rower returns WaterRower')
assertBrandPresent(searchEquipmentProductCatalog(brandAliasCatalog, 'York').matches, 'York', 'York returns York Fitness')
assertBrandPresent(searchEquipmentProductCatalog(brandAliasCatalog, 'REP').matches, 'REP', 'REP returns REP')
assertBrandPresent(searchEquipmentProductCatalog(brandAliasCatalog, 'Powertec').matches, 'Powertec', 'Powertec returns Powertec')
assertBrandPresent(searchEquipmentProductCatalog(brandAliasCatalog, 'Techno').matches, 'Technogym', 'Techno returns Technogym')
assertBrandPresent(searchEquipmentProductCatalog(brandAliasCatalog, 'Life').matches, 'Life Fitness', 'Life returns Life Fitness')
assertBrandPresent(searchEquipmentProductCatalog(brandAliasCatalog, 'Nordic').matches, 'NordicTrack', 'Nordic returns NordicTrack')

assert(parseEquipmentProductSearchQuery('Stair').brand === 'StairMaster', 'Stair parses as StairMaster brand')
assert(parseEquipmentProductSearchQuery('Sole F85').brand === 'Sole Fitness', 'Sole F85 parses Sole brand')
assert(parseEquipmentProductSearchQuery('Techno').brand === 'Technogym', 'Techno parses Technogym')

console.log('equipment product search tests passed')
