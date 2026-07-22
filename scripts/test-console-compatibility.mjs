#!/usr/bin/env node
/**
 * Unit tests for getCompatibleConsoleOptions and Concept2 matrix.
 */

import assert from 'node:assert/strict'
import {
  getCompatibleConsoleOptions,
  findOverlappingCompatMappings,
  shouldShowConsoleEvidence,
} from '../src/lib/consoleCompatibility.js'
import { CONCEPT2_COMPAT_BY_PRODUCT_KEY } from '../src/lib/concept2ConsoleCompat.js'
import { WATTBIKE_COMPAT_BY_PRODUCT_KEY } from '../src/lib/wattbikeConsoleCompat.js'
import { WOODWAY_COMPAT_BY_PRODUCT_KEY } from '../src/lib/woodwayConsoleCompat.js'
import { CYBEX_COMPAT_BY_PRODUCT_KEY } from '../src/lib/cybexConsoleCompat.js'
import {
  buildMatrixCompatByProductKey,
  buildMatrixBaseConsoleMappings,
  listMatrixHeldForReview,
  parseMatrixHistoricConsoleTier,
  parseMatrixDigitIdentity,
} from '../src/lib/matrixConsoleCompat.js'
import {
  LIFE_FITNESS_COMPAT_BY_PRODUCT_KEY,
  LIFE_FITNESS_EXPLICITLY_UNMAPPED,
  SILVER_LINE_KEYS,
  buildElevationMappings,
  buildIntegrityMappings,
} from '../src/lib/lifeFitnessConsoleCompat.js'
import {
  buildExciteModularMappings,
  classifyTechnogymConsoleProduct,
} from '../src/lib/technogymConsoleCompat.js'

function expandProductOptions(productKey) {
  return (CONCEPT2_COMPAT_BY_PRODUCT_KEY[productKey] ?? []).map((row) => ({
    ...row,
    console_name: row.console_key.toUpperCase().replace('PM2_PLUS', 'PM2+').replace('PM', 'PM'),
    console_key: row.console_key,
    is_active: true,
  })).map((row) => {
    const names = {
      pm1: 'PM1',
      pm2: 'PM2',
      pm2_plus: 'PM2+',
      pm3: 'PM3',
      pm4: 'PM4',
      pm5: 'PM5',
    }
    return { ...row, console_name: names[row.console_key] ?? row.console_key }
  })
}

function labels(result) {
  return result.options.map((option) => option.label)
}

function displayLabels(result) {
  return (result.displayOptions ?? []).map((option) => option.label)
}

// Model C 1993–1994: unresolved — no public factory/optional options
{
  const result = getCompatibleConsoleOptions({
    manufactureYear: 1994,
    options: expandProductOptions('concept2-rowers-rowerg-model-c'),
  })
  assert.deepEqual(labels(result), [])
  assert.equal(result.showSelector, false)
  assert.equal(result.defaultConsoleName, '')
}

// Model C 1996: PM2 only
{
  const result = getCompatibleConsoleOptions({
    manufactureYear: 1996,
    options: expandProductOptions('concept2-rowers-rowerg-model-c'),
  })
  assert.deepEqual(labels(result), ['PM2'])
  assert.equal(result.showSelector, false)
  assert.equal(result.defaultConsoleName, 'PM2')
}

// Model C 2000: PM2 factory + PM2+ optional; no PM5 public
{
  const result = getCompatibleConsoleOptions({
    manufactureYear: 2000,
    options: expandProductOptions('concept2-rowers-rowerg-model-c'),
  })
  assert.deepEqual(labels(result).sort(), ['PM2', 'PM2+'].sort())
  assert.equal(result.showSelector, true)
  assert.equal(result.defaultConsoleName, 'PM2')
}

// Model C: retrofit PM5 not public
{
  const admin = getCompatibleConsoleOptions({
    manufactureYear: 2000,
    options: expandProductOptions('concept2-rowers-rowerg-model-c'),
    audience: 'admin',
  })
  assert.ok(admin.allYearMatched.some((row) => row.console_key === 'pm5' && row.compatibility_type === 'retrofit'))
  const pub = getCompatibleConsoleOptions({
    manufactureYear: 2000,
    options: expandProductOptions('concept2-rowers-rowerg-model-c'),
  })
  assert.ok(!labels(pub).includes('PM5'))
}

// Model D 2010: PM3 + optional PM4; not PM5 factory
{
  const result = getCompatibleConsoleOptions({
    manufactureYear: 2010,
    options: expandProductOptions('concept2-rowers-rowerg-model-d'),
  })
  assert.deepEqual(labels(result).sort(), ['PM3', 'PM4'].sort())
  assert.equal(result.defaultConsoleName, 'PM3')
}

// Model D 2014: PM4 optional still valid + PM5 factory
{
  const result = getCompatibleConsoleOptions({
    manufactureYear: 2014,
    options: expandProductOptions('concept2-rowers-rowerg-model-d'),
  })
  assert.ok(labels(result).includes('PM5'))
  assert.ok(labels(result).includes('PM4'))
  assert.equal(result.defaultConsoleName, 'PM5')
}

// Model D 2015: PM5 only
{
  const result = getCompatibleConsoleOptions({
    manufactureYear: 2015,
    options: expandProductOptions('concept2-rowers-rowerg-model-d'),
  })
  assert.deepEqual(labels(result), ['PM5'])
  assert.equal(result.showSelector, false)
}

// Model E 2008: PM4 only publicly
{
  const result = getCompatibleConsoleOptions({
    manufactureYear: 2008,
    options: expandProductOptions('concept2-rowers-rowerg-model-e'),
  })
  assert.deepEqual(labels(result), ['PM4'])
  assert.equal(result.showSelector, false)
}

// BikeErg: fixed PM5, hide selector
{
  const result = getCompatibleConsoleOptions({
    manufactureYear: 2020,
    options: expandProductOptions('concept2-exercise-bike-bikeerg'),
  })
  assert.equal(result.fixedOnly, true)
  assert.equal(result.showSelector, false)
  assert.equal(result.defaultConsoleName, 'PM5')
  assert.deepEqual(labels(result), [])
  assert.equal(result.fixedOption?.console_name, 'PM5')
  assert.deepEqual(displayLabels(result), ['PM5'])
  assert.equal(shouldShowConsoleEvidence(result), true)
}

// Year change invalidates previous console
{
  const options = expandProductOptions('concept2-rowers-rowerg-model-d')
  const early = getCompatibleConsoleOptions({ manufactureYear: 2010, options })
  assert.equal(early.defaultConsoleName, 'PM3')
  const late = getCompatibleConsoleOptions({ manufactureYear: 2016, options })
  assert.equal(late.defaultConsoleName, 'PM5')
  assert.ok(!labels(late).includes('PM3'))
}

// No brand-wide fallback: empty options => empty
{
  const result = getCompatibleConsoleOptions({
    manufactureYear: 2015,
    options: [],
  })
  assert.equal(result.missingMapping, true)
  assert.equal(result.showSelector, false)
  assert.deepEqual(result.options, [])
}

// Overlap detector
{
  const overlaps = findOverlappingCompatMappings([
    {
      console_key: 'pm3',
      compatibility_type: 'factory',
      available_from_year: 2003,
      available_to_year: 2014,
    },
    {
      console_key: 'pm3',
      compatibility_type: 'factory',
      available_from_year: 2010,
      available_to_year: 2016,
    },
  ])
  assert.equal(overlaps.length, 1)
}

console.log('test-console-compatibility: concept2 ok')

function expandWattbikeOptions(productKey) {
  const names = {
    model_a: 'Model A Monitor',
    model_b: 'Model B Monitor',
    pts: 'Performance Touchscreen',
  }
  return (WATTBIKE_COMPAT_BY_PRODUCT_KEY[productKey] ?? []).map((row) => ({
    ...row,
    console_name: names[row.console_key] ?? row.console_key,
    is_active: true,
  }))
}

// Pro 2012: Model A only
{
  const result = getCompatibleConsoleOptions({
    manufactureYear: 2012,
    options: expandWattbikeOptions('wattbike-exercise-bike-pro-pro'),
  })
  assert.deepEqual(labels(result), ['Model A Monitor'])
  assert.equal(result.showSelector, false)
  assert.deepEqual(displayLabels(result), ['Model A Monitor'])
  assert.equal(result.appliedOption?.console_name, 'Model A Monitor')
  assert.equal(shouldShowConsoleEvidence(result), true)
}

// Pro 2009: Model A (catalogue-era approximate)
{
  const result = getCompatibleConsoleOptions({
    manufactureYear: 2009,
    options: expandWattbikeOptions('wattbike-exercise-bike-pro-pro'),
  })
  assert.deepEqual(labels(result), ['Model A Monitor'])
}

// Pro 2015: Model B only
{
  const result = getCompatibleConsoleOptions({
    manufactureYear: 2015,
    options: expandWattbikeOptions('wattbike-exercise-bike-pro-pro'),
  })
  assert.deepEqual(labels(result), ['Model B Monitor'])
  assert.equal(result.showSelector, false)
}

// Pro 2013: both Model A and Model B (overlap year)
{
  const result = getCompatibleConsoleOptions({
    manufactureYear: 2013,
    options: expandWattbikeOptions('wattbike-exercise-bike-pro-pro'),
  })
  assert.equal(result.showSelector, true)
  assert.ok(labels(result).includes('Model A Monitor'))
  assert.ok(labels(result).includes('Model B Monitor'))
}

// AtomX: fixed PTS, hide selector
{
  const result = getCompatibleConsoleOptions({
    manufactureYear: 2021,
    options: expandWattbikeOptions('wattbike-exercise-bike-atom-atomx'),
  })
  assert.equal(result.fixedOnly, true)
  assert.equal(result.showSelector, false)
  assert.equal(result.defaultConsoleName, 'Performance Touchscreen')
  assert.equal(result.fixedOption?.console_name, 'Performance Touchscreen')
  assert.deepEqual(displayLabels(result), ['Performance Touchscreen'])
  assert.equal(shouldShowConsoleEvidence(result), true)
}

// Atom: no mappings
{
  const result = getCompatibleConsoleOptions({
    manufactureYear: 2018,
    options: expandWattbikeOptions('wattbike-exercise-bike-atom-atom'),
  })
  assert.equal(result.missingMapping, true)
  assert.deepEqual(result.options, [])
  assert.deepEqual(displayLabels(result), [])
  assert.equal(result.fixedOption, null)
  assert.equal(shouldShowConsoleEvidence(result), false)
}

console.log('test-console-compatibility: wattbike ok')

function expandWoodwayOptions(productKey) {
  const names = {
    quick_set: 'Quick Set',
    personal_trainer: 'Personal Trainer',
    prosmart: 'ProSmart',
    curve_led: 'Curve LED Display',
    curve_ftg_standard: 'Curve FTG Standard Display',
  }
  return (WOODWAY_COMPAT_BY_PRODUCT_KEY[productKey] ?? []).map((row) => ({
    ...row,
    console_name: names[row.console_key] ?? row.console_key,
    is_active: true,
  }))
}

// 4Front 2012: Quick Set + PT, no ProSmart
{
  const result = getCompatibleConsoleOptions({
    manufactureYear: 2012,
    options: expandWoodwayOptions('woodway-treadmill-4front-4front'),
  })
  assert.deepEqual(labels(result).sort(), ['Personal Trainer', 'Quick Set'].sort())
  assert.equal(result.defaultConsoleName, 'Quick Set')
  assert.equal(result.showSelector, true)
  assert.ok(!labels(result).includes('ProSmart'))
}

// 4Front 2018: includes ProSmart
{
  const result = getCompatibleConsoleOptions({
    manufactureYear: 2018,
    options: expandWoodwayOptions('woodway-treadmill-4front-4front'),
  })
  assert.ok(labels(result).includes('ProSmart'))
  assert.ok(labels(result).includes('Quick Set'))
  assert.ok(labels(result).includes('Personal Trainer'))
}

// Curve 2010: LED only (ProSmart not yet)
{
  const result = getCompatibleConsoleOptions({
    manufactureYear: 2010,
    options: expandWoodwayOptions('woodway-non-motorised-treadmill-curve-curve'),
  })
  assert.deepEqual(labels(result), ['Curve LED Display'])
  assert.equal(result.showSelector, false)
}

// Curve 2020: LED + ProSmart optional
{
  const result = getCompatibleConsoleOptions({
    manufactureYear: 2020,
    options: expandWoodwayOptions('woodway-non-motorised-treadmill-curve-curve'),
  })
  assert.equal(result.showSelector, true)
  assert.ok(labels(result).includes('ProSmart'))
}

// Curve XL: fixed LED
{
  const result = getCompatibleConsoleOptions({
    manufactureYear: 2015,
    options: expandWoodwayOptions('woodway-non-motorised-treadmill-curve-xl-curve-xl'),
  })
  assert.equal(result.fixedOnly, true)
  assert.equal(result.showSelector, false)
  assert.equal(result.defaultConsoleName, 'Curve LED Display')
}

// Curve FTG: standard + ProSmart
{
  const result = getCompatibleConsoleOptions({
    manufactureYear: 2019,
    options: expandWoodwayOptions('woodway-non-motorised-treadmill-curve-ftg-curve-ftg'),
  })
  assert.equal(result.showSelector, true)
  assert.ok(labels(result).includes('Curve FTG Standard Display'))
  assert.ok(labels(result).includes('ProSmart'))
}

console.log('test-console-compatibility: woodway ok')

function expandCybexOptions(productKey) {
  const names = {
    led: 'LED',
    e3_view: 'E3 View',
    cybex_go: 'Cybex GO',
    '50l': '50L',
    '70t': '70T',
  }
  return (CYBEX_COMPAT_BY_PRODUCT_KEY[productKey] ?? []).map((row) => ({
    ...row,
    console_name: names[row.console_key] ?? row.console_key,
    is_active: true,
  }))
}

// 530T: fixed LED only — no brand dump of 50L/70T
{
  const result = getCompatibleConsoleOptions({
    manufactureYear: 2010,
    options: expandCybexOptions('cybex-treadmill-530t-treadmill'),
  })
  assert.equal(result.fixedOnly, true)
  assert.equal(result.defaultConsoleName, 'LED')
  assert.ok(!labels(result).includes('70T'))
  assert.ok(!labels(result).includes('50L'))
}

// 770T 2013: LED + E3, no GO yet
{
  const result = getCompatibleConsoleOptions({
    manufactureYear: 2013,
    options: expandCybexOptions('cybex-treadmill-770t-treadmill'),
  })
  assert.deepEqual(labels(result).sort(), ['E3 View', 'LED'].sort())
  assert.ok(!labels(result).includes('Cybex GO'))
  assert.equal(result.defaultConsoleName, 'LED')
}

// 770T 2015: LED + E3 + GO
{
  const result = getCompatibleConsoleOptions({
    manufactureYear: 2015,
    options: expandCybexOptions('cybex-treadmill-770t-treadmill'),
  })
  assert.ok(labels(result).includes('Cybex GO'))
  assert.ok(labels(result).includes('E3 View'))
  assert.ok(labels(result).includes('LED'))
}

// 772 2016: includes Cybex GO
{
  const result = getCompatibleConsoleOptions({
    manufactureYear: 2016,
    options: expandCybexOptions('cybex-cross-trainer-772at-lower-body-arc-trainer'),
  })
  assert.ok(labels(result).includes('Cybex GO'))
}

// No product options => empty (no brand fallback)
{
  const result = getCompatibleConsoleOptions({
    manufactureYear: 2015,
    options: [],
  })
  assert.equal(result.missingMapping, true)
  assert.deepEqual(result.options, [])
}

console.log('test-console-compatibility: cybex ok')

function expandMatrixOptions(mappings) {
  const names = {
    led_1x: 'LED',
    led_3x: 'LED',
    led_5x: 'LED',
    led_7x: 'LED',
    xe: 'XE',
    '7xe': '7XE',
    '7xi': '7XI',
    led: 'LED',
    premium_led: 'Premium LED',
    touch: 'Touch',
    touch_xl: 'Touch XL',
  }
  return (mappings ?? []).map((row) => ({
    ...row,
    console_name: names[row.console_key] ?? row.console_key,
    is_active: true,
  }))
}

// Historic named SKU parsing
{
  assert.equal(parseMatrixHistoricConsoleTier({ product_family: 'T3x' })?.console_key, 'led_3x')
  assert.equal(parseMatrixHistoricConsoleTier({ product_family: 'T3xe' })?.console_key, 'xe')
  assert.equal(parseMatrixHistoricConsoleTier({ product_family: 'T7xe' })?.console_key, '7xe')
  assert.equal(parseMatrixDigitIdentity({ product_family: 'T1' })?.base, 'T1')
  assert.equal(parseMatrixHistoricConsoleTier({ product_family: 'S-drive' }), null)
}

// Matrix T3 base: LED + XE factory; year 2012 shows both; no modern Touch
{
  const mappings = buildMatrixBaseConsoleMappings('T3')
  const result = getCompatibleConsoleOptions({
    manufactureYear: 2012,
    options: expandMatrixOptions(mappings),
  })
  assert.equal(result.showSelector, true)
  assert.deepEqual(labels(result).sort(), ['LED', 'XE'].sort())
  assert.ok(!result.allYearMatched.some((row) => ['touch', 'touch_xl', 'xr', 'led'].includes(row.console_key)))
}

// Matrix T3 year 2018: XE expired → LED only (read-only)
{
  const result = getCompatibleConsoleOptions({
    manufactureYear: 2018,
    options: expandMatrixOptions(buildMatrixBaseConsoleMappings('T3')),
  })
  assert.equal(result.showSelector, false)
  assert.equal(result.defaultConsoleName, 'LED')
  assert.deepEqual(displayLabels(result), ['LED'])
}

// Matrix T3 year 2022: timeline ended → no consoles
{
  const result = getCompatibleConsoleOptions({
    manufactureYear: 2022,
    options: expandMatrixOptions(buildMatrixBaseConsoleMappings('T3')),
  })
  assert.equal(result.missingMapping, true)
  assert.deepEqual(result.options, [])
  assert.equal(shouldShowConsoleEvidence(result), false)
}

// Matrix T7: LED + 7XE + 7XI; no Touch XL
{
  const result = getCompatibleConsoleOptions({
    manufactureYear: 2014,
    options: expandMatrixOptions(buildMatrixBaseConsoleMappings('T7')),
  })
  assert.ok(labels(result).includes('LED'))
  assert.ok(labels(result).includes('7XE'))
  assert.ok(labels(result).includes('7XI'))
  assert.ok(!result.allYearMatched.some((row) => row.console_key === 'touch_xl'))
}

// Matrix T5: LED only (*5xe held — not in base mappings)
{
  const mappings = buildMatrixBaseConsoleMappings('T5')
  assert.deepEqual(mappings.map((row) => row.console_key), ['led_5x'])
  const result = getCompatibleConsoleOptions({
    manufactureYear: 2012,
    options: expandMatrixOptions(mappings),
  })
  assert.equal(result.showSelector, false)
  assert.equal(result.defaultConsoleName, 'LED')
  assert.equal(shouldShowConsoleEvidence(result), true)
}

// *5xe held for review — not auto-approved into compat
{
  const products = [
    {
      canonical_product_key: 'matrix-fitness-treadmill-t5xe-treadmill',
      canonical_product_name: 'Matrix Fitness T5xe Treadmill',
      product_family: 'T5xe',
      model: 'Treadmill',
    },
  ]
  const compat = buildMatrixCompatByProductKey(products)
  assert.equal(compat['matrix-fitness-treadmill-t5xe-treadmill'], undefined)
  const held = listMatrixHeldForReview(products)
  assert.equal(held.length, 1)
  assert.equal(held[0].suggested_console_key, '7xe')
}

// Base product key mapping after consolidation shape
{
  const compat = buildMatrixCompatByProductKey([
    {
      canonical_product_key: 'matrix-fitness-treadmill-t1-treadmill',
      canonical_product_name: 'Matrix T1 Treadmill',
      product_family: 'T1',
      model: 'Treadmill',
    },
  ])
  const result = getCompatibleConsoleOptions({
    manufactureYear: 2010,
    options: expandMatrixOptions(compat['matrix-fitness-treadmill-t1-treadmill']),
  })
  assert.deepEqual(labels(result).sort(), ['LED', 'XE'].sort())
}

// Modern modular: Touch XL on treadmill, not on bike; LED default selector
{
  const compat = buildMatrixCompatByProductKey([
    {
      canonical_product_key: 'matrix-fitness-treadmill-lifestyle-series-lifestyle-treadmill',
      canonical_product_name: 'Matrix Lifestyle Series Treadmill',
      product_family: 'Lifestyle Series',
      equipment_type: 'Treadmill',
      model: 'Lifestyle Treadmill',
    },
    {
      canonical_product_key: 'matrix-fitness-upright-bike-lifestyle-series-lifestyle-upright-cycle',
      canonical_product_name: 'Matrix Lifestyle Series Upright Cycle',
      product_family: 'Lifestyle Series',
      equipment_type: 'Upright Bike',
      model: 'Lifestyle Upright Cycle',
    },
    {
      canonical_product_key: 'matrix-fitness-hybrid-bike-performance-series-performance-hybrid-cycle',
      canonical_product_name: 'Matrix Performance Series Hybrid Cycle',
      product_family: 'Performance Series',
      equipment_type: 'Hybrid Bike',
      model: 'Performance Hybrid Cycle',
    },
  ])
  assert.deepEqual(
    compat['matrix-fitness-treadmill-lifestyle-series-lifestyle-treadmill'].map((row) => row.console_key),
    ['led', 'premium_led', 'touch', 'touch_xl'],
  )
  assert.deepEqual(
    compat['matrix-fitness-upright-bike-lifestyle-series-lifestyle-upright-cycle'].map((row) => row.console_key),
    ['led', 'premium_led', 'touch'],
  )
  assert.ok(
    compat['matrix-fitness-hybrid-bike-performance-series-performance-hybrid-cycle']
      .every((row) => row.confidence === 'medium'),
  )
  const treadmillPublic = getCompatibleConsoleOptions({
    manufactureYear: 2022,
    options: expandNamed(
      compat['matrix-fitness-treadmill-lifestyle-series-lifestyle-treadmill'],
      { led: 'LED', premium_led: 'Premium LED', touch: 'Touch', touch_xl: 'Touch XL' },
    ),
  })
  assert.equal(treadmillPublic.showSelector, true)
  assert.equal(treadmillPublic.defaultConsoleName, 'LED')
  assert.deepEqual(labels(treadmillPublic).sort(), ['LED', 'Premium LED', 'Touch', 'Touch XL'].sort())
}

// Onyx: fixed console, no modular, hide selector
{
  const compat = buildMatrixCompatByProductKey([
    {
      canonical_product_key: 'matrix-fitness-treadmill-onyx-collection-onyx-treadmill',
      canonical_product_name: 'Matrix Onyx Treadmill',
      product_family: 'Onyx Collection',
      equipment_type: 'Treadmill',
      model: 'Onyx Treadmill',
    },
    {
      canonical_product_key: 'matrix-fitness-climbmill-onyx-collection-onyx-climbmill',
      canonical_product_name: 'Matrix Onyx ClimbMill',
      product_family: 'Onyx Collection',
      equipment_type: 'ClimbMill',
      model: 'Onyx ClimbMill',
    },
  ])
  assert.deepEqual(
    compat['matrix-fitness-treadmill-onyx-collection-onyx-treadmill'].map((row) => row.console_key),
    ['onyx_32'],
  )
  assert.equal(
    compat['matrix-fitness-treadmill-onyx-collection-onyx-treadmill'][0].compatibility_type,
    'fixed',
  )
  assert.deepEqual(
    compat['matrix-fitness-climbmill-onyx-collection-onyx-climbmill'].map((row) => row.console_key),
    ['onyx_22'],
  )
  const onyxPublic = getCompatibleConsoleOptions({
    manufactureYear: 2024,
    options: expandNamed(
      compat['matrix-fitness-treadmill-onyx-collection-onyx-treadmill'],
      { onyx_32: 'Onyx 32" Touchscreen' },
    ),
  })
  assert.equal(onyxPublic.showSelector, false)
  assert.equal(onyxPublic.fixedOnly, true)
  assert.equal(onyxPublic.defaultConsoleName, 'Onyx 32" Touchscreen')
  assert.deepEqual(labels(onyxPublic), [])
  assert.equal(onyxPublic.displayOptions[0]?.label, 'Onyx 32" Touchscreen')
}

console.log('test-console-compatibility: matrix ok')

function expandNamed(mappings, names) {
  return (mappings ?? []).map((row) => ({
    ...row,
    console_name: names[row.console_key] ?? row.console_key,
    is_active: true,
  }))
}

const LF_NAMES = {
  achieve: 'Achieve',
  engage: 'Engage',
  inspire: 'Inspire',
  discover_si: 'Discover SI',
  discover_se: 'Discover SE',
  discover_se3: 'Discover SE3',
  discover_se3hd: 'Discover SE3HD',
  st: 'Discover ST',
  integrity_c: 'Integrity C',
  integrity_x: 'Integrity X',
  integrity_sl: 'Integrity SL',
  discover_se4: 'Discover SE4',
  led: 'LED',
}

// Elevation 2009: Achieve factory selectable; no Discover SE3HD yet
{
  const result = getCompatibleConsoleOptions({
    manufactureYear: 2009,
    options: expandNamed(buildElevationMappings(), LF_NAMES),
  })
  assert.ok(labels(result).includes('Achieve'))
  assert.ok(!labels(result).includes('Discover SE3HD'))
  assert.equal(result.defaultConsoleName, 'Achieve')
}

// Elevation 2018: Discover options present; Achieve retired
{
  const result = getCompatibleConsoleOptions({
    manufactureYear: 2018,
    options: expandNamed(buildElevationMappings(), LF_NAMES),
  })
  assert.ok(labels(result).includes('Discover SI'))
  assert.ok(labels(result).includes('Discover SE3HD'))
  assert.ok(!labels(result).includes('Achieve'))
}

// Integrity 2018: C factory + optional X/ST/SE3HD; no SL/SE4 yet
{
  const result = getCompatibleConsoleOptions({
    manufactureYear: 2018,
    options: expandNamed(buildIntegrityMappings(), LF_NAMES),
  })
  assert.equal(result.defaultConsoleName, 'Integrity C')
  assert.ok(labels(result).includes('Integrity X'))
  assert.ok(!labels(result).includes('Integrity SL'))
  assert.ok(!labels(result).includes('Discover SE4'))
}

// Integrity 2022: SL factory + SE4 optional
{
  const result = getCompatibleConsoleOptions({
    manufactureYear: 2022,
    options: expandNamed(buildIntegrityMappings(), LF_NAMES),
  })
  assert.equal(result.defaultConsoleName, 'Integrity SL')
  assert.ok(labels(result).includes('Discover SE4'))
  assert.ok(!labels(result).includes('Integrity C'))
}

// Silver Line — no console selector or modifier (explicitly unmapped)
{
  assert.equal(SILVER_LINE_KEYS.length, 12, 'Silver Line catalogue key count')
  for (const key of SILVER_LINE_KEYS) {
    assert.equal(
      LIFE_FITNESS_COMPAT_BY_PRODUCT_KEY[key],
      undefined,
      `Silver Line key must stay unmapped: ${key}`,
    )
    assert.ok(
      LIFE_FITNESS_EXPLICITLY_UNMAPPED.some((entry) => entry.key === key),
      `Silver Line key must be explicitly unmapped: ${key}`,
    )
  }

  const result = getCompatibleConsoleOptions({
    manufactureYear: 2010,
    options: [],
  })
  assert.equal(result.showSelector, false, 'unmapped Silver Line has no selector')
  assert.equal(result.options.length, 0, 'unmapped Silver Line has no console options')
  assert.equal(result.defaultConsoleName, '')
}

console.log('test-console-compatibility: life-fitness ok')

const TG_NAMES = {
  led: 'LED',
  visio: 'Visio',
  visio_web: 'VisioWeb',
  unity: 'UNITY',
  unity_3_0: 'UNITY 3.0',
  connect: 'Connect',
  live: 'LIVE',
  live_10: 'LIVE 10',
}

// Excite 2006: LED + Visio; no UNITY/LIVE (TV / Digital TV removed)
{
  const result = getCompatibleConsoleOptions({
    manufactureYear: 2006,
    options: expandNamed(buildExciteModularMappings(), TG_NAMES),
  })
  assert.ok(labels(result).includes('LED'))
  assert.ok(labels(result).includes('Visio'))
  assert.ok(!labels(result).includes('TV'))
  assert.ok(!labels(result).includes('Digital TV'))
  assert.ok(!labels(result).includes('UNITY'))
  assert.ok(!labels(result).includes('LIVE'))
  assert.equal(result.defaultConsoleName, 'LED')
}

// Excite 2015: VisioWeb gone; UNITY available; no LIVE yet
{
  const result = getCompatibleConsoleOptions({
    manufactureYear: 2015,
    options: expandNamed(buildExciteModularMappings(), TG_NAMES),
  })
  assert.ok(labels(result).includes('UNITY'))
  assert.ok(!labels(result).includes('VisioWeb'))
  assert.ok(!labels(result).includes('LIVE'))
}

// Excite 2021: LIVE + Connect available
{
  const result = getCompatibleConsoleOptions({
    manufactureYear: 2021,
    options: expandNamed(buildExciteModularMappings(), TG_NAMES),
  })
  assert.ok(labels(result).includes('LIVE'))
  assert.ok(labels(result).includes('Connect'))
}

// Named VisioWeb SKU → fixed
{
  const classified = classifyTechnogymConsoleProduct({
    canonical_product_key: 'technogym-upright-bike-excite-new-bike-new-bike-excite-700-visio-web-ifi',
    canonical_product_name: 'Technogym Excite New Bike 700 Visio Web IFI',
    product_family: 'Excite + New Bike',
    model: 'NEW BIKE EXCITE 700 VISIO WEB IFI',
  })
  assert.equal(classified.kind, 'fixed')
  assert.equal(classified.console_key, 'visio_web')
}

// Group Cycle → unmapped
{
  const classified = classifyTechnogymConsoleProduct({
    canonical_product_key: 'technogym-exercise-bike-group-cycle-group-cycle',
    canonical_product_name: 'Technogym Group Cycle',
    product_family: 'Group Cycle',
    model: 'Group Cycle',
  })
  assert.equal(classified.kind, 'unmapped')
}

console.log('test-console-compatibility: technogym ok')
console.log('test-console-compatibility: ok')

