/**
 * Commercial cardio product console option tests.
 */

import {
  buildConsoleOptionsForProduct,
  classifyCommercialCardioConsoleGroup,
  COMMERCIAL_CARDIO_CONSOLE_TEMPLATES,
  resolveLifeFitnessConsoleImageUrl,
  resolveMatrixConsoleImageUrl,
  resolveTechnogymConsoleImageUrl,
} from '../src/lib/commercialCardioConsoleCompat.js'
import { isSpinBikeIndoorCycleProduct, supportsProductConsoleOptions } from '../src/lib/equipmentCardio.js'
import {
  buildProductConsoleSelectOptions,
  buildProductConsoleVariantNames,
  filterActiveProductConsoleOptions,
  getDefaultConsoleNameForProductYear,
  isProductConsoleOptionAvailableForYear,
  isWellnessTvConsoleOption,
} from '../src/lib/productConsoleOptions.js'
import { getDefaultProductManufactureYear } from '../src/lib/equipmentValuation.js'

function assert(condition, label) {
  if (!condition) throw new Error(label)
}

function assertSameList(actual, expected, label) {
  const left = [...actual].sort()
  const right = [...expected].sort()
  assert(JSON.stringify(left) === JSON.stringify(right), `${label}: expected ${right.join(', ')} got ${left.join(', ')}`)
}

function optionNamesForProduct(product, year) {
  const { options } = buildConsoleOptionsForProduct(product)
  const dropdown = buildProductConsoleSelectOptions({
    productConsoleOptions: options,
    manufactureYear: year,
  }).options.map((option) => option.label)
  const cards = buildProductConsoleVariantNames({
    productConsoleOptions: options,
    manufactureYear: year,
  })
  assert(JSON.stringify(dropdown) === JSON.stringify(cards), 'dropdown and cards must match')
  return dropdown
}

function consoleModifierForProduct(product, consoleName) {
  const option = buildConsoleOptionsForProduct(product).options
    .find((entry) => entry.console_name === consoleName)
  return option?.modifier_percent ?? null
}

const elevationProduct = {
  brand: 'Life Fitness',
  product_family: 'Elevation Series',
  model: 'Elevation Series PowerMill',
  canonical_product_name: 'Life Fitness Elevation Series PowerMill',
  equipment_type: 'Stepper',
  baseline_manufacture_year: 2010,
}

const integrityProduct = {
  brand: 'Life Fitness',
  product_family: 'Integrity Series',
  model: 'Integrity Series Treadmill',
  canonical_product_name: 'Life Fitness Integrity Series Treadmill',
  equipment_type: 'Treadmill',
  baseline_manufacture_year: 2017,
}

const silverlineProduct = {
  brand: 'Life Fitness',
  product_family: 'Lifecycle',
  model: '95T Treadmill',
  canonical_product_name: 'Life Fitness 95T Treadmill',
  equipment_type: 'Treadmill',
  baseline_manufacture_year: 2008,
}

const technogymArtisProduct = {
  brand: 'Technogym',
  product_family: 'Artis',
  model: 'Artis Treadmill',
  canonical_product_name: 'Technogym Artis Treadmill',
  equipment_type: 'Treadmill',
  baseline_manufacture_year: 2016,
}

const technogymExciteBike1000 = {
  brand: 'Technogym',
  product_family: 'Excite',
  model: 'Excite Bike 1000',
  canonical_product_name: 'Technogym Excite Bike 1000',
  equipment_type: 'Exercise Bike',
  baseline_manufacture_year: 2018,
}

const technogymOlderExciteProduct = {
  brand: 'Technogym',
  product_family: 'Excite',
  model: 'Excite Run 700',
  canonical_product_name: 'Technogym Excite Run 700',
  equipment_type: 'Treadmill',
  baseline_manufacture_year: 2018,
}

const technogymSkillrunProduct = {
  brand: 'Technogym',
  product_family: 'Skillrun',
  model: 'Skillrun',
  canonical_product_name: 'Technogym Skillrun',
  equipment_type: 'Treadmill',
  baseline_manufacture_year: 2019,
}

const matrixProduct = {
  brand: 'Matrix Fitness',
  product_family: 'Performance',
  model: 'Treadmill',
  canonical_product_name: 'Matrix Fitness Treadmill',
  equipment_type: 'Treadmill',
  baseline_manufacture_year: 2016,
}

const spinBikeProduct = {
  brand: 'Life Fitness',
  product_family: 'IC Series',
  model: 'IC7 Indoor Cycle',
  canonical_product_name: 'Life Fitness IC7 Indoor Cycle',
  equipment_type: 'Indoor Cycle',
  baseline_manufacture_year: 2018,
}

const groupCycleProduct = {
  brand: 'Matrix Fitness',
  model: 'Group Cycle',
  canonical_product_name: 'Matrix Fitness Group Cycle',
  equipment_type: 'Bike',
  baseline_manufacture_year: 2016,
}

assert(
  getDefaultProductManufactureYear({ baseline_manufacture_year: 2017, production_start_year: 2015 })
    === '2017',
  'default manufacture year uses baseline year',
)
assert(
  getDefaultProductManufactureYear({ production_start_year: 2012 })
    === '2012',
  'default manufacture year falls back to production start year',
)
assert(
  getDefaultProductManufactureYear({}) === '',
  'default manufacture year is unknown when no baseline/start year exists',
)

assert(isSpinBikeIndoorCycleProduct(spinBikeProduct), 'IC7 indoor cycle detected as spin bike')
assert(isSpinBikeIndoorCycleProduct(groupCycleProduct), 'group cycle detected as spin bike')
assert(!supportsProductConsoleOptions(spinBikeProduct), 'spin bikes do not support console options')
assert(classifyCommercialCardioConsoleGroup(spinBikeProduct) === null, 'spin bikes have no console group')
assert(buildConsoleOptionsForProduct(spinBikeProduct).options.length === 0, 'spin bike returns empty console list')
assert(optionNamesForProduct(spinBikeProduct, 2018).length === 0, 'spin bike dropdown is empty')

assert(
  classifyCommercialCardioConsoleGroup(elevationProduct) === 'life_fitness_elevation',
  'elevation product classified correctly',
)
assert(
  classifyCommercialCardioConsoleGroup(integrityProduct) === 'life_fitness_integrity',
  'integrity product classified correctly',
)
assert(
  classifyCommercialCardioConsoleGroup(silverlineProduct) === 'life_fitness_silverline',
  'silverline product classified correctly',
)
assert(
  classifyCommercialCardioConsoleGroup(technogymExciteBike1000) === 'technogym_newer_excite',
  'Excite Bike 1000 classified as newer Excite',
)
assert(
  classifyCommercialCardioConsoleGroup(technogymOlderExciteProduct) === 'technogym_newer_excite',
  'Excite Run 700 with 2018 baseline still uses newer Excite mapping bucket',
)

const allTemplateConsoleNames = Object.values(COMMERCIAL_CARDIO_CONSOLE_TEMPLATES)
  .flat()
  .map((option) => option.console_name)
assert(
  !allTemplateConsoleNames.some((name) => /wellness\s*tv/i.test(name)),
  'Wellness TV is never present in console templates',
)
assert(
  isWellnessTvConsoleOption({ console_key: 'wellness_tv', console_name: 'Wellness TV' }),
  'Wellness TV detector matches legacy rows',
)

const wellnessFiltered = filterActiveProductConsoleOptions([
  { console_name: 'LED', console_key: 'led', release_year: 2010, is_active: true },
  { console_name: 'Wellness TV', console_key: 'wellness_tv', release_year: 2010, is_active: true },
], 2018)
assert(!wellnessFiltered.some((option) => /wellness/i.test(option.console_name)), 'Wellness TV filtered from active options')

const elevation2018 = optionNamesForProduct(elevationProduct, 2018)
assertSameList(
  elevation2018,
  ['Discover SI', 'Discover SE', 'Discover SE3', 'Discover SE3HD', 'ST'],
  'Life Fitness Elevation Series at 2018',
)
assert(!elevation2018.includes('Discover SE4'), 'Elevation should not include SE4')
assert(
  getDefaultConsoleNameForProductYear({
    productConsoleOptions: buildConsoleOptionsForProduct(elevationProduct).options,
    manufactureYear: 2018,
  }) === 'discover_si',
  'default console prefers stable key for first available option (discover_si)',
)
assert(
  getDefaultConsoleNameForProductYear({
    productConsoleOptions: [],
    manufactureYear: 2018,
  }) === '',
  'default console is empty when product has no console options',
)

const elevationOptions = buildConsoleOptionsForProduct(elevationProduct).options
const discoverSe3Hd = elevationOptions.find((option) => option.console_name === 'Discover SE3HD')
assert(
  discoverSe3Hd?.image_url === '/equipment-console-images/life-fitness/normalized/LF%20SE3HD.webp',
  'Discover SE3HD image mapped for Life Fitness elevation consoles',
)
const elevationLed = elevationOptions.find((option) => option.console_name === 'LED')
assert(!elevationLed, 'Elevation templates do not include LED')

const integrityOptions = buildConsoleOptionsForProduct(integrityProduct).options
const integrityX = integrityOptions.find((option) => option.console_name === 'Integrity X')
assert(
  integrityX?.image_url === '/equipment-console-images/life-fitness/normalized/LF%20Integrity%20X%20console.png',
  'Integrity X image mapped for Life Fitness integrity consoles',
)
assert(
  resolveLifeFitnessConsoleImageUrl('Integrity X Console')
    === '/equipment-console-images/life-fitness/normalized/LF%20Integrity%20X%20console.png',
  'Integrity X Console alias resolves to Integrity X image',
)
assert(
  resolveLifeFitnessConsoleImageUrl('SE3 HD')
    === '/equipment-console-images/life-fitness/normalized/LF%20SE3HD.webp',
  'SE3 HD alias resolves to SE3HD image',
)

const elevation2015 = optionNamesForProduct(elevationProduct, 2015)
assert(!elevation2015.includes('Discover SE3'), 'Elevation 2015 should not include SE3 before 2016')
assert(!elevation2015.includes('Discover SE3HD'), 'Elevation 2015 should not include SE3HD')
assert(!elevation2015.includes('ST'), 'Elevation 2015 should not include ST before 2017')

const elevation2016 = optionNamesForProduct(elevationProduct, 2016)
assert(elevation2016.includes('Discover SE3'), 'Elevation 2016 should include SE3 from release year')
assert(!elevation2016.includes('ST'), 'Elevation 2016 should not include ST before 2017')

const elevation2017 = optionNamesForProduct(elevationProduct, 2017)
assert(elevation2017.includes('ST'), 'Elevation 2017 should include ST from release year')

const integrity2022 = optionNamesForProduct(integrityProduct, 2022)
assertSameList(
  integrity2022,
  ['Integrity SL', 'Integrity C', 'Integrity X', 'Discover SE3HD', 'Discover SE4', 'ST'],
  'Life Fitness Integrity Series at 2022',
)

const integrity2016 = optionNamesForProduct(integrityProduct, 2016)
assertSameList(integrity2016, [], 'Integrity 2016 has no factory consoles before 2017 templates')

const integrity2017 = optionNamesForProduct(integrityProduct, 2017)
assertSameList(
  integrity2017,
  ['Integrity C', 'Integrity X', 'ST', 'Discover SE3HD'],
  'Life Fitness Integrity Series at 2017',
)
assert(!integrity2017.includes('Integrity SL'), 'Integrity 2017 should not include SL before 2021')
assert(!integrity2017.includes('Discover SE4'), 'Integrity 2017 should not include SE4')

const integrity2018 = optionNamesForProduct(integrityProduct, 2018)
assert(integrity2018.includes('ST'), 'Integrity 2018 should include ST')
assert(integrity2018.includes('Integrity X'), 'Integrity 2018 should include Integrity X')
assert(!integrity2018.includes('Integrity SL'), 'Integrity 2018 should not include SL before 2021')

const integrity2021 = optionNamesForProduct(integrityProduct, 2021)
assert(integrity2021.includes('Integrity SL'), 'Integrity 2021 should include SL from release year')

const silverline2013 = optionNamesForProduct(silverlineProduct, 2013)
assertSameList(
  silverline2013,
  ['LED', 'Engage', 'Inspire', 'Achieve'],
  'Life Fitness Silverline at 2013',
)

const artis2020 = optionNamesForProduct(technogymArtisProduct, 2020)
assertSameList(artis2020, ['UNITY 3.0', 'LIVE', 'LIVE 10'], 'Technogym Artis consoles')

const artisOptions = buildConsoleOptionsForProduct(technogymArtisProduct).options
const unity30 = artisOptions.find((option) => option.console_name === 'UNITY 3.0')
assert(
  unity30?.image_url === '/equipment-console-images/technogym/normalized/TG%20Unity%203.0.webp',
  'Technogym UNITY 3.0 image mapped',
)
assert(
  resolveTechnogymConsoleImageUrl('Visio') === '/equipment-console-images/technogym/normalized/TG%20Visio%20Web.png',
  'Visio alias resolves to Visio Web image',
)
assert(
  resolveTechnogymConsoleImageUrl('UNITY 2.0') === '/equipment-console-images/technogym/normalized/TG%20Unity.jpg',
  'UNITY 2.0 alias resolves to UNITY image',
)

const excite1000_2018 = optionNamesForProduct(technogymExciteBike1000, 2018)
assertSameList(excite1000_2018, ['LED', 'UNITY'], 'Technogym Excite Bike 1000 consoles at 2018')
const exciteOptions = buildConsoleOptionsForProduct(technogymExciteBike1000).options
const exciteLed = exciteOptions.find((option) => option.console_name === 'LED')
assert(
  exciteLed?.image_url === '/equipment-console-images/technogym/normalized/TG%20LED.jpg',
  'Technogym LED image mapped',
)
assert(!excite1000_2018.includes('Wellness TV'), 'Excite Bike 1000 must not show Wellness TV')
assert(!excite1000_2018.includes('Visio / Visioweb'), 'Excite Bike 1000 must not show Visio / Visioweb at 2018')
assert(!excite1000_2018.includes('LIVE'), 'Excite Bike 1000 must not show LIVE')
assert(!excite1000_2018.includes('LIVE 10'), 'Excite Bike 1000 must not show LIVE 10')

const olderExcite2010 = optionNamesForProduct(technogymOlderExciteProduct, 2010)
assertSameList(olderExcite2010, ['LED', 'Visio / Visioweb'], 'Technogym Excite at selected year 2010')
assert(!olderExcite2010.includes('Wellness TV'), 'older Excite must not show Wellness TV')
assert(!olderExcite2010.includes('UNITY'), 'older Excite at 2010 must not show UNITY')

const olderExcite2015 = optionNamesForProduct(technogymOlderExciteProduct, 2015)
assertSameList(olderExcite2015, ['LED', 'UNITY'], 'Technogym Excite at selected year 2015')
assert(!olderExcite2015.includes('Visio / Visioweb'), 'Excite at 2015 must not show Visio / Visioweb')
assert(!olderExcite2015.includes('Wellness TV'), 'Excite at 2015 must not show Wellness TV')

const yearChange2010 = optionNamesForProduct(technogymOlderExciteProduct, 2010)
const yearChange2015 = optionNamesForProduct(technogymOlderExciteProduct, 2015)
assert(yearChange2010.includes('Visio / Visioweb'), 'year 2010 includes Visio / Visioweb')
assert(!yearChange2015.includes('Visio / Visioweb'), 'changing to 2015 removes Visio / Visioweb')

const skillrun2020 = optionNamesForProduct(technogymSkillrunProduct, 2020)
assertSameList(skillrun2020, ['UNITY', 'LIVE', 'LIVE 10'], 'Technogym Skill commercial consoles')

const matrix2019 = optionNamesForProduct(matrixProduct, 2019)
assertSameList(matrix2019, ['LED', 'Touch', 'Touch XL'], 'Matrix commercial cardio')

const matrixOptions = buildConsoleOptionsForProduct(matrixProduct).options
const matrixTouch = matrixOptions.find((option) => option.console_name === 'Touch')
assert(
  matrixTouch?.image_url === '/equipment-console-images/matrix-fitness/normalized/Matrix%20Touch.png',
  'Matrix Touch image mapped',
)
assert(
  resolveMatrixConsoleImageUrl('Matrix Touch Console')
    === '/equipment-console-images/matrix-fitness/normalized/Matrix%20Touch.png',
  'Matrix Touch Console alias resolves to Touch image',
)

const matrix2016 = optionNamesForProduct(matrixProduct, 2016)
assert(matrix2016.includes('LED'), 'Matrix 2016 should include LED')
assert(matrix2016.includes('Touch'), 'Matrix 2016 should include Touch')
assert(!matrix2016.includes('Touch XL'), 'Matrix 2016 should not include Touch XL')

const integrityModifiers = buildConsoleOptionsForProduct(integrityProduct).options
const se4 = integrityModifiers.find((option) => option.console_name === 'Discover SE4')
const se3hdIntegrity = integrityModifiers.find((option) => option.console_name === 'Discover SE3HD')
const integrityXMod = integrityModifiers.find((option) => option.console_name === 'Integrity X')
const integrityC = integrityModifiers.find((option) => option.console_name === 'Integrity C')
const integritySl = integrityModifiers.find((option) => option.console_name === 'Integrity SL')
assert((se4?.modifier_percent ?? 0) > (se3hdIntegrity?.modifier_percent ?? 0), 'Life Fitness SE4 modifier > SE3HD')
assert((integrityXMod?.modifier_percent ?? 0) > (integrityC?.modifier_percent ?? 0), 'Integrity X > Integrity C')
assert(
  (integrityC?.modifier_percent ?? 0) === (integritySl?.modifier_percent ?? 0),
  'Integrity C and Integrity SL share the base modifier',
)

const elevationModifiers = buildConsoleOptionsForProduct(elevationProduct).options
const se3hdElevation = elevationModifiers.find((option) => option.console_name === 'Discover SE3HD')
const se3 = elevationModifiers.find((option) => option.console_name === 'Discover SE3')
assert((se3hdElevation?.modifier_percent ?? 0) > (se3?.modifier_percent ?? 0), 'SE3HD > SE3')

const matrixLed = consoleModifierForProduct(matrixProduct, 'LED')
const matrixTouchMod = consoleModifierForProduct(matrixProduct, 'Touch')
const matrixTouchXl = consoleModifierForProduct(matrixProduct, 'Touch XL')
assert((matrixTouchXl ?? 0) > (matrixTouchMod ?? 0), 'Matrix Touch XL > Touch')
assert((matrixTouchMod ?? 0) > (matrixLed ?? 0), 'Matrix Touch > LED')

const tgLed = consoleModifierForProduct(technogymExciteBike1000, 'LED')
const tgVisio = consoleModifierForProduct(technogymOlderExciteProduct, 'Visio / Visioweb')
const tgUnity = consoleModifierForProduct(technogymExciteBike1000, 'UNITY')
const tgUnity30 = consoleModifierForProduct(technogymArtisProduct, 'UNITY 3.0')
const tgLive = consoleModifierForProduct(technogymArtisProduct, 'LIVE')
const tgLive10 = consoleModifierForProduct(technogymArtisProduct, 'LIVE 10')
assert((tgLive10 ?? 0) > (tgLive ?? 0), 'Technogym LIVE 10 > LIVE')
assert((tgLive ?? 0) > (tgUnity30 ?? 0), 'Technogym LIVE > UNITY 3.0')
assert((tgUnity30 ?? 0) > (tgUnity ?? 0), 'Technogym UNITY 3.0 > UNITY')
assert((tgUnity ?? 0) > (tgVisio ?? 0), 'Technogym UNITY > Visio / Visioweb')
assert((tgVisio ?? 0) > (tgLed ?? 0), 'Technogym Visio / Visioweb > LED')

assert(
  isProductConsoleOptionAvailableForYear(
    { release_year: 2017, retired_year: 2021 },
    2022,
  ) === false,
  'retired console unavailable after retired_year',
)
assert(
  isProductConsoleOptionAvailableForYear(
    { release_year: 2003, retired_year: 2013 },
    2010,
  ) === true,
  'Visio / Visioweb available in 2010',
)
assert(
  isProductConsoleOptionAvailableForYear(
    { release_year: 2003, retired_year: 2013 },
    2015,
  ) === false,
  'Visio / Visioweb unavailable in 2015',
)

console.log('commercial cardio console option tests passed')
