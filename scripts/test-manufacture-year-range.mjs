#!/usr/bin/env node
/**
 * Unit tests for getValidManufactureYearRange / manufacture year dropdown capping.
 */

import assert from 'node:assert/strict'
import {
  buildManufactureYearDropdownOptions,
  formatProductProductionYears,
  getDefaultProductManufactureYear,
  getValidManufactureYearRange,
  resolveManufactureYearSelectValue,
} from '../src/lib/equipmentValuation.js'
import { getCompatibleConsoleOptions } from '../src/lib/consoleCompatibility.js'
import { buildMatrixBaseConsoleMappings } from '../src/lib/matrixConsoleCompat.js'

function expandMatrix(mappings) {
  const names = {
    led_1x: 'LED',
    led_3x: 'LED',
    led_5x: 'LED',
    led_7x: 'LED',
    xe: 'XE',
    '7xe': '7XE',
    '7xi': '7XI',
  }
  return (mappings ?? []).map((row) => ({
    ...row,
    console_name: names[row.console_key] ?? row.console_key,
    is_active: true,
  }))
}

// Confirmed production end wins over current year
{
  const range = getValidManufactureYearRange({
    baseline_manufacture_year: 2009,
    production_end_year: 2018,
  }, [], { currentYear: 2026 })
  assert.equal(range.minYear, 2009)
  assert.equal(range.maxYear, 2018)
  assert.equal(range.maxYearSource, 'production_end')
  assert.equal(range.maxYearConfirmed, true)
}

// Console fallback when production end missing (Matrix T3 pattern)
{
  const options = expandMatrix(buildMatrixBaseConsoleMappings('T3'))
  const range = getValidManufactureYearRange({
    baseline_manufacture_year: 2010,
    production_start_year: null,
    production_end_year: null,
  }, options, { currentYear: 2026 })
  assert.equal(range.minYear, 2010)
  assert.equal(range.maxYear, 2018)
  assert.equal(range.maxYearSource, 'console_compat')
  assert.equal(range.maxYearConfirmed, false)
  assert.equal(range.needsConfirmedProductionEnd, true)

  const years = buildManufactureYearDropdownOptions({
    baseline_manufacture_year: 2010,
    console_compatibility: options,
    current_year: 2026,
  }).map((row) => Number(row.value))
  assert.equal(years[0], 2010)
  assert.equal(years.at(-1), 2018)
  assert.ok(!years.includes(2019))
  assert.ok(!years.includes(2022))
}

// Matrix T5/T7 console fallback ends ~2018/2019
{
  const t5 = getValidManufactureYearRange(
    { baseline_manufacture_year: 2011 },
    expandMatrix(buildMatrixBaseConsoleMappings('T5')),
    { currentYear: 2026 },
  )
  assert.equal(t5.maxYear, 2018)

  const t7 = getValidManufactureYearRange(
    { baseline_manufacture_year: 2012 },
    expandMatrix(buildMatrixBaseConsoleMappings('T7')),
    { currentYear: 2026 },
  )
  assert.equal(t7.maxYear, 2019)
}

// Open-ended console mappings keep current year (modern modular)
{
  const range = getValidManufactureYearRange(
    { baseline_manufacture_year: 2020 },
    [{
      console_key: 'touch',
      compatibility_type: 'factory',
      available_from_year: 2020,
      available_to_year: null,
      is_active: true,
    }],
    { currentYear: 2026 },
  )
  assert.equal(range.maxYear, 2026)
  assert.equal(range.maxYearSource, 'current_year')
}

// Invalid selected year resets to baseline
{
  const product = {
    baseline_manufacture_year: 2010,
    production_end_year: 2018,
  }
  assert.equal(
    resolveManufactureYearSelectValue(product, '2022', { current_year: 2026 }),
    '2010',
  )
  assert.equal(getDefaultProductManufactureYear(product), '2010')
}

// Every selectable Matrix T3 year resolves a console
{
  const options = expandMatrix(buildMatrixBaseConsoleMappings('T3'))
  const years = buildManufactureYearDropdownOptions({
    baseline_manufacture_year: 2010,
    production_end_year: 2018,
    console_compatibility: options,
    current_year: 2026,
  }).map((row) => Number(row.value))

  for (const year of years) {
    const result = getCompatibleConsoleOptions({
      manufactureYear: year,
      options,
      audience: 'public',
    })
    assert.ok(result.options.length > 0, `T3 year ${year} should have consoles`)
  }
}

// Production years label uses baseline when start missing
{
  assert.equal(
    formatProductProductionYears({
      baseline_manufacture_year: 2009,
      production_end_year: 2018,
    }),
    '2009–2018',
  )
  assert.equal(
    formatProductProductionYears({
      baseline_manufacture_year: 2009,
    }),
    null,
  )
}

console.log('test-manufacture-year-range: ok')
