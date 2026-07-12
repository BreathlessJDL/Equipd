/**
 * Date-aware console availability for valuation and product pages.
 */

import { matchConsoleModifier } from './consoleModifierMatch.js'
import { getValidManufactureYearRange } from './equipmentValuation.js'
import { resolveProductConsoleModifier } from './productConsoleOptions.js'

export const ESTIMATED_CONSOLE_STANDARD_VALUE = '__estimated_standard__'
export const ESTIMATED_CONSOLE_PREMIUM_VALUE = '__estimated_premium__'

export const ESTIMATED_CONSOLE_FALLBACK_OPTIONS = [
  {
    value: ESTIMATED_CONSOLE_STANDARD_VALUE,
    label: 'Standard / unknown console (estimated)',
    console_tier: 'base',
    modifier_percent: 0,
    estimated: true,
  },
  {
    value: ESTIMATED_CONSOLE_PREMIUM_VALUE,
    label: 'Premium touchscreen / upgraded console (estimated)',
    console_tier: 'premium',
    modifier_percent: 20,
    estimated: true,
  },
]

function normalizeWhitespace(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim()
}

function normalizeKey(value) {
  return normalizeWhitespace(value).toLowerCase()
}

export function isEstimatedConsoleValue(value) {
  return value === ESTIMATED_CONSOLE_STANDARD_VALUE
    || value === ESTIMATED_CONSOLE_PREMIUM_VALUE
}

export function getProductManufactureYearRange(product, currentYear = new Date().getFullYear(), consoleCompatibility = []) {
  const range = getValidManufactureYearRange(product, consoleCompatibility, { currentYear })
  return {
    start: range.minYear,
    end: range.maxYear,
    maxYearSource: range.maxYearSource,
    maxYearConfirmed: range.maxYearConfirmed,
    needsConfirmedProductionEnd: range.needsConfirmedProductionEnd,
  }
}

export function isConsoleAvailableForYear(availability, manufactureYear) {
  const year = Number(manufactureYear)
  const releaseYear = Number(availability?.release_year)
  const retiredYear = availability?.retired_year != null
    ? Number(availability.retired_year)
    : null

  if (!Number.isFinite(year) || !Number.isFinite(releaseYear)) return false
  if (year < releaseYear) return false
  if (retiredYear != null && Number.isFinite(retiredYear) && year > retiredYear) return false
  return true
}

export function matchesConsoleCompatibility(availability, product) {
  const series = normalizeKey(product?.product_family)
  const equipmentType = normalizeKey(product?.equipment_type)

  const seriesFilters = (availability?.compatible_series ?? [])
    .map((entry) => normalizeKey(entry))
    .filter(Boolean)
  const typeFilters = (availability?.compatible_equipment_types ?? [])
    .map((entry) => normalizeKey(entry))
    .filter(Boolean)

  if (seriesFilters.length && series && !seriesFilters.includes(series)) {
    return false
  }

  if (typeFilters.length && equipmentType && !typeFilters.includes(equipmentType)) {
    return false
  }

  return true
}

export function filterConsoleAvailabilityForProductYear({
  availability = [],
  product,
  manufactureYear,
}) {
  const brandKey = normalizeKey(product?.brand)
  const year = Number(manufactureYear)
  if (!brandKey || !Number.isFinite(year)) return []

  return availability.filter((entry) => (
    normalizeKey(entry.brand) === brandKey
    && isConsoleAvailableForYear(entry, year)
    && matchesConsoleCompatibility(entry, product)
  ))
}

function dedupeConsoleOptions(options = []) {
  const seen = new Set()
  return options.filter((option) => {
    const key = normalizeKey(option.value)
    if (!key || seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function sortConsoleOptions(options = []) {
  const tierOrder = { base: 0, mid: 1, premium: 2 }
  return [...options].sort((left, right) => {
    const tierDiff = (tierOrder[left.console_tier] ?? 9) - (tierOrder[right.console_tier] ?? 9)
    if (tierDiff !== 0) return tierDiff
    return left.label.localeCompare(right.label)
  })
}

export function buildConsoleSelectOptionsForProductYear({
  product,
  manufactureYear,
  availability = [],
  modifiers = [],
  includeEstimatedFallback = true,
}) {
  const year = Number(manufactureYear)
  if (!product?.brand || !Number.isFinite(year)) {
    return { options: [], usesEstimatedFallback: false }
  }

  const brandKey = normalizeKey(product.brand)
  const brandAvailability = availability.filter((entry) => normalizeKey(entry.brand) === brandKey)
  const matched = filterConsoleAvailabilityForProductYear({
    availability,
    product,
    manufactureYear: year,
  })

  if (!brandAvailability.length) {
    if (!includeEstimatedFallback) {
      return { options: [], usesEstimatedFallback: false }
    }
    return {
      options: ESTIMATED_CONSOLE_FALLBACK_OPTIONS.map((option) => ({ ...option })),
      usesEstimatedFallback: true,
    }
  }

  if (!matched.length) {
    if (!includeEstimatedFallback) {
      return { options: [], usesEstimatedFallback: false }
    }
    return {
      options: ESTIMATED_CONSOLE_FALLBACK_OPTIONS.map((option) => ({ ...option })),
      usesEstimatedFallback: true,
    }
  }

  const options = sortConsoleOptions(dedupeConsoleOptions(matched.map((entry) => {
    const modifier = matchConsoleModifier(modifiers, entry.brand, entry.console_name)
    const modifierPercent = Number(entry.modifier_percent ?? modifier?.modifier_value ?? 0)
    return {
      value: entry.console_name,
      label: entry.console_name,
      console_tier: entry.console_tier ?? modifier?.console_tier ?? 'base',
      modifier_percent: modifierPercent,
      release_year: entry.release_year,
      retired_year: entry.retired_year ?? null,
      estimated: false,
    }
  })))

  return { options, usesEstimatedFallback: false }
}

export function isConsoleValidForProductYear({
  product,
  manufactureYear,
  consoleName,
  availability = [],
}) {
  if (!consoleName) return true
  if (isEstimatedConsoleValue(consoleName)) {
    return ESTIMATED_CONSOLE_FALLBACK_OPTIONS.some((option) => option.value === consoleName)
  }

  const year = Number(manufactureYear)
  if (!Number.isFinite(year)) return false

  const { options } = buildConsoleSelectOptionsForProductYear({
    product,
    manufactureYear: year,
    availability,
    includeEstimatedFallback: false,
  })

  return options.some((option) => option.value === consoleName)
}

export function resolveConsoleModifierForSelection({
  consoleName,
  consoleKey = null,
  consoleId = null,
  brand,
  availability = [],
  modifiers = [],
  productConsoleOptions = [],
}) {
  if (!consoleName && !consoleKey && !consoleId) {
    return {
      modifierPercent: 0,
      consoleTier: 'base',
      estimated: false,
      consoleName: null,
      consoleKey: null,
      consoleId: null,
      modifier: null,
    }
  }

  if (isEstimatedConsoleValue(consoleName) || isEstimatedConsoleValue(consoleKey)) {
    const estimated = ESTIMATED_CONSOLE_FALLBACK_OPTIONS.find((option) => (
      option.value === consoleName || option.value === consoleKey
    ))
    return {
      modifierPercent: Number(estimated?.modifier_percent ?? 0),
      consoleTier: estimated?.console_tier ?? 'base',
      estimated: true,
      consoleName: estimated?.label ?? consoleName,
      consoleKey: null,
      consoleId: null,
      modifier: null,
    }
  }

  if (productConsoleOptions.length) {
    return resolveProductConsoleModifier({
      productConsoleOptions,
      consoleName,
      consoleKey,
      consoleId,
      brand,
      modifiers,
    })
  }

  const selection = consoleKey || consoleName
  const brandKey = normalizeKey(brand)
  const availabilityEntry = availability.find((entry) => (
    normalizeKey(entry.brand) === brandKey
    && (
      (entry.console_key && normalizeKey(entry.console_key) === normalizeKey(selection))
      || normalizeKey(entry.console_name) === normalizeKey(consoleName || selection)
    )
  ))
  const modifier = matchConsoleModifier(modifiers, brand, selection)
    || matchConsoleModifier(modifiers, brand, consoleName)

  return {
    modifierPercent: Number(
      modifier?.modifier_value
      ?? availabilityEntry?.modifier_percent
      ?? 0,
    ),
    consoleTier: modifier?.console_tier ?? availabilityEntry?.console_tier ?? 'base',
    estimated: false,
    consoleName: availabilityEntry?.console_name ?? consoleName,
    consoleKey: availabilityEntry?.console_key ?? consoleKey ?? null,
    consoleId: null,
    modifier,
  }
}
