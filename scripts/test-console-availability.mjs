/**
 * Date-aware console availability tests.
 */

import {
  buildConsoleSelectOptionsForProductYear,
  isConsoleAvailableForYear,
} from '../src/lib/consoleAvailability.js'
import { buildManufactureYearDropdownOptions } from '../src/lib/equipmentValuation.js'

function assert(condition, label) {
  if (!condition) throw new Error(label)
}

const availability = [
  { brand: 'Life Fitness', console_name: 'LED', release_year: 2010, retired_year: null, console_tier: 'base', modifier_percent: 0 },
  { brand: 'Life Fitness', console_name: 'SE3HD', release_year: 2017, retired_year: null, console_tier: 'premium', modifier_percent: 22 },
  { brand: 'Life Fitness', console_name: 'SE4', release_year: 2022, retired_year: null, console_tier: 'premium', modifier_percent: 28 },
  { brand: 'Life Fitness', console_name: 'ST', release_year: 2017, retired_year: null, console_tier: 'mid', modifier_percent: 18 },
  { brand: 'Cybex', console_name: '50L', release_year: 2010, retired_year: null, console_tier: 'base', modifier_percent: 0 },
  { brand: 'Cybex', console_name: '70T', release_year: 2017, retired_year: null, console_tier: 'premium', modifier_percent: 25 },
  { brand: 'Precor', console_name: 'P31 LED', release_year: 2010, retired_year: null, console_tier: 'base', modifier_percent: 0 },
  { brand: 'Precor', console_name: 'P62', release_year: 2016, retired_year: null, console_tier: 'mid', modifier_percent: 15 },
  { brand: 'Precor', console_name: 'P82', release_year: 2019, retired_year: null, console_tier: 'premium', modifier_percent: 25 },
]

const lifeFitnessProduct = {
  brand: 'Life Fitness',
  equipment_type: 'Treadmill',
  product_family: 'Integrity',
  baseline_manufacture_year: 2010,
  production_start_year: 2010,
  production_end_year: null,
}

const cybexProduct = {
  brand: 'Cybex',
  equipment_type: 'Treadmill',
  product_family: 'VR3',
  baseline_manufacture_year: 2010,
  production_start_year: 2010,
  production_end_year: null,
}

const precorProduct = {
  brand: 'Precor',
  equipment_type: 'Treadmill',
  product_family: 'TRM',
  baseline_manufacture_year: 2010,
  production_start_year: 2010,
  production_end_year: null,
}

function optionValues(product, year) {
  return buildConsoleSelectOptionsForProductYear({
    product,
    manufactureYear: year,
    availability,
    includeEstimatedFallback: false,
  }).options.map((option) => option.value)
}

assert(
  !isConsoleAvailableForYear(
    availability.find((entry) => entry.console_name === 'SE3HD'),
    2016,
  ),
  'SE3HD is not available in 2016',
)
assert(
  !isConsoleAvailableForYear(
    availability.find((entry) => entry.console_name === 'SE4'),
    2016,
  ),
  'SE4 is not available in 2016',
)

const lf2016 = optionValues(lifeFitnessProduct, 2016)
assert(!lf2016.includes('SE3HD'), '2016 Life Fitness should not show SE3HD')
assert(!lf2016.includes('SE4'), '2016 Life Fitness should not show SE4')
assert(!lf2016.includes('ST'), '2016 Life Fitness should not show ST before 2017')

const lf2017 = optionValues(lifeFitnessProduct, 2017)
assert(lf2017.includes('ST'), '2017 Life Fitness should show ST from release year')

const lf2018 = optionValues(lifeFitnessProduct, 2018)
assert(lf2018.includes('SE3HD'), '2018 Life Fitness should show SE3HD')
assert(!lf2018.includes('SE4'), '2018 Life Fitness should not show SE4')
assert(lf2018.includes('ST'), '2018 Life Fitness should show ST')

const lf2022 = optionValues(lifeFitnessProduct, 2022)
assert(lf2022.includes('SE4'), '2022 Life Fitness should show SE4')

const cybex2019 = optionValues(cybexProduct, 2019)
assert(cybex2019.includes('50L'), '2019 Cybex should show 50L')
assert(cybex2019.includes('70T'), '2019 Cybex should show 70T')

const precor2015 = optionValues(precorProduct, 2015)
assert(!precor2015.includes('P62'), '2015 Precor should not show P62 before release year')
assert(!precor2015.includes('P82'), '2015 Precor should not show P82 before release year')

const precor2017 = optionValues(precorProduct, 2017)
assert(precor2017.includes('P62'), '2017 Precor should show P62')
assert(!precor2017.includes('P82'), '2017 Precor should not show P82 before release year')

const precor2019 = optionValues(precorProduct, 2019)
assert(precor2019.includes('P82'), '2019 Precor should show P82')

const manufactureYears = buildManufactureYearDropdownOptions({
  baseline_manufacture_year: 2010,
  production_start_year: 2012,
  production_end_year: 2016,
  current_year: 2026,
}).map((option) => Number(option.value))

assert(manufactureYears[0] === 2010, 'manufacture year dropdown includes baseline year even when production starts later')
assert(manufactureYears.includes(2012), 'manufacture year dropdown includes production start year')
assert(manufactureYears[manufactureYears.length - 1] === 2016, 'manufacture year dropdown ends at production_end_year')
assert(!manufactureYears.some((year) => !Number.isFinite(year)), 'manufacture year dropdown has no blank unknown option')

const openEndedYears = buildManufactureYearDropdownOptions({
  baseline_manufacture_year: 2018,
  production_start_year: 2018,
  production_end_year: null,
  current_year: 2020,
}).filter((option) => option.value).map((option) => Number(option.value))

assert(openEndedYears[openEndedYears.length - 1] === 2020, 'open-ended production uses current year')

console.log('console availability tests passed')
