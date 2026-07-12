#!/usr/bin/env node
/**
 * Regression: console selection must change adjusted original price via stable keys.
 */

import assert from 'node:assert/strict'
import { calculateEquipmentValuation } from '../src/lib/equipmentValuation.js'
import { resolveProductConsoleModifier } from '../src/lib/productConsoleOptions.js'
import { matchConsoleModifier, brandsMatch } from '../src/lib/consoleModifierMatch.js'
import { getCompatibleConsoleOptions } from '../src/lib/consoleCompatibility.js'
import {
  LIFE_FITNESS_CONSOLE_MODIFIER_BY_KEY,
  buildElevationMappings,
} from '../src/lib/lifeFitnessConsoleCompat.js'

assert.equal(brandsMatch('Matrix', 'Matrix Fitness'), true)

const modifiers = [
  { brand: 'Matrix', console_key: 'led', console_name: 'LED', modifier_value: 0, console_tier: 'base' },
  { brand: 'Matrix', console_key: 'premium_led', console_name: 'Premium LED', modifier_value: 8, console_tier: 'mid' },
  { brand: 'Matrix', console_key: 'touch', console_name: 'Touch', modifier_value: 15, console_tier: 'mid' },
  { brand: 'Matrix', console_key: 'touch_xl', console_name: 'Touch XL', modifier_value: 25, console_tier: 'premium' },
  { brand: 'Matrix', console_key: 'led_3x', console_name: 'LED', modifier_value: 0, console_tier: 'base' },
  { brand: 'Matrix', console_key: 'xe', console_name: 'XE', modifier_value: 10, console_tier: 'mid' },
]

const productOptions = [
  {
    console_id: 'c1',
    console_key: 'led',
    console_name: 'LED',
    modifier_percent: 0,
    tier: 'base',
    compatibility_type: 'factory',
    available_from_year: 2020,
    is_active: true,
    is_default: true,
    display_order: 10,
  },
  {
    console_id: 'c2',
    console_key: 'touch',
    console_name: 'Touch',
    // omit modifier_percent — must resolve via modifiers by key
    tier: 'base',
    compatibility_type: 'factory',
    available_from_year: 2020,
    is_active: true,
    display_order: 30,
  },
  {
    console_id: 'c3',
    console_key: 'touch_xl',
    console_name: 'Touch XL',
    // omit modifier_percent — must resolve via modifiers by key
    tier: 'base',
    compatibility_type: 'factory',
    available_from_year: 2020,
    is_active: true,
    display_order: 40,
  },
]

// Key match beats display-name collision (LED vs led_3x)
assert.equal(matchConsoleModifier(modifiers, 'Matrix Fitness', 'touch')?.modifier_value, 15)
assert.equal(matchConsoleModifier(modifiers, 'Matrix Fitness', 'led_3x')?.console_key, 'led_3x')
assert.equal(matchConsoleModifier(modifiers, 'Matrix Fitness', 'LED')?.console_key, 'led')

const touchResolved = resolveProductConsoleModifier({
  productConsoleOptions: productOptions,
  consoleKey: 'touch',
  brand: 'Matrix Fitness',
  modifiers,
})
assert.equal(touchResolved.modifierPercent, 15)
assert.equal(touchResolved.consoleKey, 'touch')
assert.equal(touchResolved.consoleName, 'Touch')

const ledValuation = calculateEquipmentValuation({
  original_base_price: 10000,
  baseline_manufacture_year: 2020,
  brand: 'Matrix Fitness',
  console_key: 'led',
  console_name: 'led',
  modifiers,
  product_console_options: productOptions,
  current_year: 2026,
  condition: 'Good',
})
const touchValuation = calculateEquipmentValuation({
  original_base_price: 10000,
  baseline_manufacture_year: 2020,
  brand: 'Matrix Fitness',
  console_key: 'touch',
  console_name: 'touch',
  modifiers,
  product_console_options: productOptions,
  current_year: 2026,
  condition: 'Good',
})
const touchXlValuation = calculateEquipmentValuation({
  original_base_price: 10000,
  baseline_manufacture_year: 2020,
  brand: 'Matrix Fitness',
  console_key: 'touch_xl',
  console_name: 'touch_xl',
  modifiers,
  product_console_options: productOptions,
  current_year: 2026,
  condition: 'Good',
})

assert.equal(ledValuation.ok, true)
assert.equal(ledValuation.adjusted_original_price, 10000)
assert.equal(touchValuation.adjusted_original_price, 11500)
assert.equal(touchXlValuation.adjusted_original_price, 12500)
assert.ok(touchXlValuation.estimated_mid > touchValuation.estimated_mid)
assert.ok(touchValuation.estimated_mid > ledValuation.estimated_mid)

const publicOptions = getCompatibleConsoleOptions({
  manufactureYear: 2022,
  options: productOptions,
  audience: 'public',
})
assert.equal(publicOptions.showSelector, true)
assert.deepEqual(publicOptions.options.map((row) => row.value), ['led', 'touch', 'touch_xl'])
assert.deepEqual(publicOptions.options.map((row) => row.label), ['LED', 'Touch', 'Touch XL'])
assert.equal(publicOptions.defaultConsoleKey, 'led')

// Life Fitness hierarchy: SI < SE < ST < SE3 < SE3HD < SE4
const lfOrder = ['discover_si', 'discover_se', 'st', 'discover_se3', 'discover_se3hd', 'discover_se4']
for (let i = 1; i < lfOrder.length; i += 1) {
  const prev = LIFE_FITNESS_CONSOLE_MODIFIER_BY_KEY[lfOrder[i - 1]].modifier_percent
  const next = LIFE_FITNESS_CONSOLE_MODIFIER_BY_KEY[lfOrder[i]].modifier_percent
  assert.ok(next > prev, `${lfOrder[i]} (${next}) must be > ${lfOrder[i - 1]} (${prev})`)
}

const lfModifiers = [
  { brand: 'Life Fitness', console_key: 'st_alias', console_name: 'ST', modifier_value: 0, console_tier: 'base' },
  { brand: 'Life Fitness', console_key: 'se', console_name: 'SE', modifier_value: 17, console_tier: 'mid' },
  { brand: 'Life Fitness', console_key: 'se3', console_name: 'SE3', modifier_value: 17, console_tier: 'mid' },
  { brand: 'Life Fitness', console_key: 'discover_si', console_name: 'Discover SI', modifier_value: 10, console_tier: 'mid' },
  { brand: 'Life Fitness', console_key: 'discover_se', console_name: 'Discover SE', modifier_value: 15, console_tier: 'mid' },
  { brand: 'Life Fitness', console_key: 'st', console_name: 'Discover ST', modifier_value: 18, console_tier: 'mid' },
  { brand: 'Life Fitness', console_key: 'discover_se3', console_name: 'Discover SE3', modifier_value: 22, console_tier: 'mid' },
  { brand: 'Life Fitness', console_key: 'discover_se3hd', console_name: 'Discover SE3HD', modifier_value: 26, console_tier: 'premium' },
]

// Short seed "ST"@0% must NOT win over Discover ST via contains
assert.equal(matchConsoleModifier(lfModifiers, 'Life Fitness', 'Discover ST')?.modifier_value, 18)
assert.equal(matchConsoleModifier(lfModifiers, 'Life Fitness', 'Discover SE3')?.modifier_value, 22)
assert.notEqual(matchConsoleModifier(lfModifiers, 'Life Fitness', 'Discover SE3')?.modifier_value, 17)

const elevation = buildElevationMappings()
const byKey = Object.fromEntries(elevation.map((row) => [row.console_key, row.modifier_percent]))
assert.ok(byKey.discover_si < byKey.discover_se)
assert.ok(byKey.discover_se < byKey.st)
assert.ok(byKey.st < byKey.discover_se3)
assert.ok(byKey.discover_se3 < byKey.discover_se3hd)

const lfOptions = elevation.map((row, index) => ({
  console_id: `lf${index}`,
  console_key: row.console_key,
  console_name: row.console_key,
  modifier_percent: row.modifier_percent,
  tier: row.tier,
  compatibility_type: row.compatibility_type,
  available_from_year: row.available_from_year,
  available_to_year: row.available_to_year,
  is_active: true,
  is_default: row.is_default,
  display_order: row.display_order,
}))

// Prefer curated product compat percents over stale short seed aliases
function lfResolved(consoleKey) {
  return resolveProductConsoleModifier({
    productConsoleOptions: lfOptions,
    consoleKey,
    brand: 'Life Fitness',
    modifiers: [
      // Correct keyed rows (as after sync)
      { brand: 'Life Fitness', console_key: consoleKey, console_name: consoleKey, modifier_value: byKey[consoleKey], console_tier: 'mid' },
    ],
  })
}

assert.ok(lfResolved('discover_si').modifierPercent < lfResolved('discover_se').modifierPercent, 'SI < SE')
assert.ok(lfResolved('discover_se').modifierPercent < lfResolved('st').modifierPercent, 'SE < ST')
assert.ok(lfResolved('st').modifierPercent < lfResolved('discover_se3').modifierPercent, 'ST < SE3')
assert.ok(lfResolved('discover_se3').modifierPercent < lfResolved('discover_se3hd').modifierPercent, 'SE3 < SE3HD')

console.log('test-console-modifier-valuation: ok')
