#!/usr/bin/env node
/**
 * Unit tests for Life Fitness + Matrix home console timeline mappings.
 */

import assert from 'node:assert/strict'
import { getCompatibleConsoleOptions } from '../src/lib/consoleCompatibility.js'
import { calculateOriginalPriceWithConsole } from '../src/lib/consoleModifierValuation.js'
import {
  LIFE_FITNESS_CONSOLE_MODIFIER_BY_KEY,
  buildLifeFitnessHomeConsoleMappings,
  buildLifeFitnessHomeConsolePlan,
  parseLifeFitnessHomeIdentity,
} from '../src/lib/lifeFitnessConsoleCompat.js'
import {
  MATRIX_CONSOLE_MODIFIER_BY_KEY,
  buildMatrixHomeConsoleMappings,
  buildMatrixHomeConsolePlan,
  parseMatrixDigitIdentity,
  parseMatrixHomeIdentity,
} from '../src/lib/matrixConsoleCompat.js'

function keysForYear(mappings, year) {
  const result = getCompatibleConsoleOptions({
    manufactureYear: year,
    options: mappings.map((row) => ({
      ...row,
      console_name: row.console_key,
      is_active: true,
    })),
  })
  return {
    keys: result.options.map((row) => row.console_key).sort(),
    showSelector: result.showSelector,
  }
}

// --- Life Fitness home identity ---

assert.equal(
  parseLifeFitnessHomeIdentity({
    brand: 'Matrix',
    model: 'C1',
    product_family: 'C1',
    canonical_product_name: 'Matrix C1 Climbmill',
  }),
  null,
  'Matrix commercial C1 must not parse as Life Fitness home',
)

assert.deepEqual(
  parseLifeFitnessHomeIdentity({
    brand: 'Life Fitness',
    model: 'T3',
    product_family: 'T3',
    canonical_product_name: 'Life Fitness T3 Treadmill',
  }),
  { kind: 'interchangeable', base: 'T3' },
)

assert.equal(
  parseLifeFitnessHomeIdentity({
    brand: 'Life Fitness',
    model: 'Treadmill',
    product_family: 'Integrity Series',
    canonical_product_name: 'Life Fitness Integrity Series Treadmill',
    canonical_product_key: 'life-fitness-treadmill-integrity-series-treadmill',
  }),
  null,
  'Integrity commercial must not parse as home T3',
)

assert.deepEqual(
  parseLifeFitnessHomeIdentity({
    brand: 'Life Fitness',
    model: 'Row HX',
    product_family: 'Row HX',
    canonical_product_name: 'Life Fitness Row HX',
  }),
  { kind: 'fixed', base: 'Row HX' },
)

assert.deepEqual(
  parseLifeFitnessHomeIdentity({
    brand: 'Life Fitness',
    model: 'G2',
    canonical_product_name: 'Life Fitness G2',
  }),
  { kind: 'no_console', base: 'G2' },
)

assert.deepEqual(
  parseLifeFitnessHomeIdentity({
    brand: 'Life Fitness',
    model: 'X3',
    canonical_product_name: 'Life Fitness X3',
  }),
  { kind: 'legacy', base: 'X3' },
)

const lfHomeMappings = buildLifeFitnessHomeConsoleMappings()

{
  const early = keysForYear(lfHomeMappings, 2008)
  assert.deepEqual(early.keys, [])
  assert.equal(early.showSelector, false, 'T3 2008: no selector, base valuation')
}

{
  const mid = keysForYear(lfHomeMappings, 2012)
  assert.deepEqual(mid.keys, ['go', 'track'])
  assert.equal(mid.showSelector, true, 'T3 2012: GO + TRACK')
}

{
  const late = keysForYear(lfHomeMappings, 2019)
  assert.deepEqual(late.keys, ['go', 'track_connect'])
  assert.equal(late.showSelector, true, 'T3 2019: GO + TRACK CONNECT')
}

{
  const current = keysForYear(lfHomeMappings, 2024)
  assert.deepEqual(current.keys, ['go', 'track_connect_2'])
  assert.equal(current.showSelector, true, 'T3 2024: GO + TRACK CONNECT 2.0')
}

{
  const plan = buildLifeFitnessHomeConsolePlan([
    {
      status: 'approved',
      canonical_product_key: 'life-fitness-treadmill-t3-treadmill',
      canonical_product_name: 'Life Fitness T3 Treadmill',
      model: 'T3',
      product_family: 'T3',
      equipment_type: 'Treadmill',
    },
    {
      status: 'approved',
      canonical_product_key: 'life-fitness-row-machine-row-hx',
      canonical_product_name: 'Life Fitness Row HX',
      model: 'Row HX',
      product_family: 'Row HX',
      equipment_type: 'Rower',
    },
  ])
  assert.equal(plan.mapped.length, 1)
  assert.equal(plan.skipped.length, 1)
  assert.equal(plan.skipped[0].kind, 'fixed')
  const rowHx = getCompatibleConsoleOptions({
    manufactureYear: 2020,
    options: [],
  })
  assert.equal(rowHx.showSelector, false, 'Row HX has no console selector')
}

// --- Matrix home identity ---

assert.deepEqual(
  parseMatrixHomeIdentity({
    brand: 'Matrix Fitness',
    model: 'T30',
    product_family: 'T30',
    canonical_product_name: 'Matrix T30 Treadmill',
  }),
  { kind: 'entry', base: 'T30' },
)

assert.deepEqual(
  parseMatrixHomeIdentity({
    brand: 'Matrix Fitness',
    model: 'T50',
    product_family: 'T50',
    canonical_product_name: 'Matrix T50 Treadmill',
  }),
  { kind: 'premium_full', base: 'T50' },
)

assert.deepEqual(
  parseMatrixHomeIdentity({
    brand: 'Matrix Fitness',
    model: 'T75',
    product_family: 'T75',
    canonical_product_name: 'Matrix T75 Treadmill',
  }),
  { kind: 'premium_no_xr', base: 'T75' },
)

assert.deepEqual(
  parseMatrixHomeIdentity({
    brand: 'Matrix Fitness',
    model: 'ICR50',
    product_family: 'ICR50',
    canonical_product_name: 'Matrix ICR50',
  }),
  { kind: 'fixed', base: 'ICR50' },
)

  assert.deepEqual(
    parseMatrixHomeIdentity({
      brand: 'Matrix',
      model: 'Functional Trainer',
      product_family: 'Home Strength',
      canonical_product_name: 'Matrix Functional Trainer Home Strength Functional Trainer',
      canonical_product_key: 'matrix-functional-trainer-home-strength-functional-trainer',
    }),
    { kind: 'strength', base: 'Home Functional Trainer' },
  )

  assert.deepEqual(
    parseMatrixHomeIdentity({
      brand: 'Matrix',
      model: 'Rower',
      product_family: 'Home',
      canonical_product_name: 'Matrix Home Rower',
      canonical_product_key: 'matrix-rowing-machine-home-rower',
    }),
    { kind: 'rower', base: 'Matrix Home Rower' },
  )

  assert.equal(
    parseMatrixHomeIdentity({
      brand: 'Matrix Fitness',
      model: 'Functional Trainer',
      product_family: 'G3 Strength (aura - Multi Stations)',
      canonical_product_name: 'Matrix Fitness G3 Strength Functional Trainer',
      canonical_product_key: 'matrix-fitness-cable-machine-g3-strength-aura-multi-stations-functional-trainer',
    }),
    null,
    'Commercial G3 functional trainer must not parse as home',
  )

assert.equal(
  parseMatrixHomeIdentity({
    brand: 'Matrix Fitness',
    model: 'T3',
    product_family: 'T3',
    canonical_product_name: 'Matrix T3 Treadmill',
  }),
  null,
  'Commercial digit T3 must not parse as home',
)

assert.deepEqual(
  parseMatrixDigitIdentity({
    model: 'T3',
    product_family: 'T3',
    canonical_product_name: 'Matrix T3 Treadmill',
  })?.base,
  'T3',
)

assert.equal(
  parseMatrixDigitIdentity({
    model: 'T30',
    product_family: 'T30',
    canonical_product_name: 'Matrix T30 Treadmill',
  }),
  null,
  'Home T30 must not parse as commercial digit T3',
)

{
  const t30 = buildMatrixHomeConsoleMappings({ kind: 'entry', base: 'T30' })
  const keys = t30.map((row) => row.console_key).sort()
  assert.deepEqual(keys, ['xer', 'xr'])
  assert.ok(!keys.includes('xir'), 'Matrix T30 never shows XIR')
  const year = keysForYear(t30, 2020)
  assert.deepEqual(year.keys, ['xer', 'xr'])
  assert.equal(year.showSelector, true)
}

{
  const t50 = buildMatrixHomeConsoleMappings({ kind: 'premium_full', base: 'T50' })
  assert.deepEqual(t50.map((row) => row.console_key).sort(), ['xer', 'xir', 'xr'])
  const year = keysForYear(t50, 2020)
  assert.deepEqual(year.keys, ['xer', 'xir', 'xr'])
}

{
  const t75 = buildMatrixHomeConsoleMappings({ kind: 'premium_no_xr', base: 'T75' })
  assert.deepEqual(t75.map((row) => row.console_key).sort(), ['xer', 'xir'])
}

{
  const plan = buildMatrixHomeConsolePlan([
    {
      status: 'approved',
      canonical_product_key: 'matrix-fitness-treadmill-t30-treadmill',
      canonical_product_name: 'Matrix T30 Treadmill',
      model: 'T30',
      product_family: 'T30',
    },
    {
      status: 'approved',
      canonical_product_key: 'matrix-fitness-exercise-bike-icr50',
      canonical_product_name: 'Matrix ICR50',
      model: 'ICR50',
      product_family: 'ICR50',
    },
    {
      status: 'approved',
      canonical_product_key: 'matrix-fitness-home-functional-trainer',
      canonical_product_name: 'Matrix Home Functional Trainer',
      model: 'Home Functional Trainer',
      product_family: 'Home Functional Trainer',
    },
  ])
  assert.equal(plan.mapped.length, 1)
  assert.equal(plan.skipped.length, 2)
  assert.ok(plan.skipped.some((row) => row.kind === 'fixed'))
  assert.ok(plan.skipped.some((row) => row.kind === 'strength'))

  const icr = getCompatibleConsoleOptions({ manufactureYear: 2020, options: [] })
  assert.equal(icr.showSelector, false, 'ICR50 has no console selector')

  const strength = getCompatibleConsoleOptions({ manufactureYear: 2020, options: [] })
  assert.equal(strength.showSelector, false, 'Home Functional Trainer has no console selector')
}

// --- Home modifier valuation ---

assert.equal(LIFE_FITNESS_CONSOLE_MODIFIER_BY_KEY.go.modifier_percent, 0)
assert.equal(LIFE_FITNESS_CONSOLE_MODIFIER_BY_KEY.track.modifier_percent, 6)
assert.equal(LIFE_FITNESS_CONSOLE_MODIFIER_BY_KEY.track_connect.modifier_percent, 12)
assert.equal(LIFE_FITNESS_CONSOLE_MODIFIER_BY_KEY.track_connect_2.modifier_percent, 15)
assert.equal(LIFE_FITNESS_CONSOLE_MODIFIER_BY_KEY.discover_se4.modifier_percent, 30, 'commercial LF SE4 unchanged')
assert.equal(LIFE_FITNESS_CONSOLE_MODIFIER_BY_KEY.integrity_x.modifier_percent, 10, 'commercial LF Integrity X unchanged')

assert.equal(MATRIX_CONSOLE_MODIFIER_BY_KEY.xr.modifier_percent, 0)
assert.equal(MATRIX_CONSOLE_MODIFIER_BY_KEY.xer.modifier_percent, 8)
assert.equal(MATRIX_CONSOLE_MODIFIER_BY_KEY.xir.modifier_percent, 15)
assert.equal(MATRIX_CONSOLE_MODIFIER_BY_KEY.touch_xl.modifier_percent, 25, 'commercial Matrix Touch XL unchanged')
assert.equal(MATRIX_CONSOLE_MODIFIER_BY_KEY['7xi'].modifier_percent, 25, 'commercial Matrix 7xi unchanged')

{
  const base = 2000
  const lfHome = buildLifeFitnessHomeConsoleMappings()
  const byKey = Object.fromEntries(lfHome.map((row) => [row.console_key, row]))
  assert.equal(byKey.go.modifier_percent, 0)
  assert.equal(byKey.track.modifier_percent, 6)
  assert.equal(byKey.track_connect.modifier_percent, 12)
  assert.equal(byKey.track_connect_2.modifier_percent, 15)

  const go = calculateOriginalPriceWithConsole({
    originalBasePrice: base,
    consoleKey: 'go',
    consoleName: 'GO',
    brand: 'Life Fitness',
    productConsoleOptions: lfHome,
  })
  const track = calculateOriginalPriceWithConsole({
    originalBasePrice: base,
    consoleKey: 'track',
    consoleName: 'TRACK',
    brand: 'Life Fitness',
    productConsoleOptions: lfHome,
  })
  const trackConnect = calculateOriginalPriceWithConsole({
    originalBasePrice: base,
    consoleKey: 'track_connect',
    consoleName: 'TRACK CONNECT',
    brand: 'Life Fitness',
    productConsoleOptions: lfHome,
  })
  const trackConnect2 = calculateOriginalPriceWithConsole({
    originalBasePrice: base,
    consoleKey: 'track_connect_2',
    consoleName: 'TRACK CONNECT 2.0',
    brand: 'Life Fitness',
    productConsoleOptions: lfHome,
  })

  assert.equal(go.adjustedPrice, 2000)
  assert.equal(track.adjustedPrice, 2120)
  assert.equal(trackConnect.adjustedPrice, 2240)
  assert.equal(trackConnect2.adjustedPrice, 2300)
  assert.ok(
    go.adjustedPrice < track.adjustedPrice
    && track.adjustedPrice < trackConnect.adjustedPrice
    && trackConnect.adjustedPrice < trackConnect2.adjustedPrice,
    'LF T3 valuation rises GO < TRACK < TRACK CONNECT < TRACK CONNECT 2.0',
  )
}

{
  const base = 3000
  const t50 = buildMatrixHomeConsoleMappings({ kind: 'premium_full', base: 'T50' })
  const t30 = buildMatrixHomeConsoleMappings({ kind: 'entry', base: 'T30' })
  assert.deepEqual(t30.map((row) => row.console_key).sort(), ['xer', 'xr'])
  assert.ok(!t30.some((row) => row.console_key === 'xir'))

  const xr = calculateOriginalPriceWithConsole({
    originalBasePrice: base,
    consoleKey: 'xr',
    consoleName: 'XR',
    brand: 'Matrix Fitness',
    productConsoleOptions: t50,
  })
  const xer = calculateOriginalPriceWithConsole({
    originalBasePrice: base,
    consoleKey: 'xer',
    consoleName: 'XER',
    brand: 'Matrix Fitness',
    productConsoleOptions: t50,
  })
  const xir = calculateOriginalPriceWithConsole({
    originalBasePrice: base,
    consoleKey: 'xir',
    consoleName: 'XIR',
    brand: 'Matrix Fitness',
    productConsoleOptions: t50,
  })

  assert.equal(xr.adjustedPrice, 3000)
  assert.equal(xer.adjustedPrice, 3240)
  assert.equal(xir.adjustedPrice, 3450)
  assert.ok(
    xr.adjustedPrice < xer.adjustedPrice && xer.adjustedPrice < xir.adjustedPrice,
    'Matrix T50 valuation rises XR < XER < XIR',
  )
}

console.log('home console timeline tests passed')
