/**
 * Per-product console option filtering for product pages and valuation.
 * Prefer getCompatibleConsoleOptions from consoleCompatibility.js for new call sites.
 */

import {
  getCompatibleConsoleOptions,
  getDefaultCompatibleConsoleName,
  isCompatibleConsoleValidForYear,
  isWellnessTvConsoleOption,
  normalizeConsoleCompatOption,
} from './consoleCompatibility.js'
import { resolveEquipmentConsoleImageUrl } from './equipmentConsoleImages.js'
import { matchConsoleModifier, normalizeConsoleKey } from './consoleModifierMatch.js'

export { isWellnessTvConsoleOption }

function normalizeKey(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim().toLowerCase()
}

export function isProductConsoleOptionAvailableForYear(option, manufactureYear) {
  const year = Number(manufactureYear)
  const fromRaw = option?.available_from_year ?? option?.release_year
  const toRaw = option?.available_to_year ?? option?.retired_year
  const releaseYear = fromRaw == null || fromRaw === '' ? NaN : Number(fromRaw)
  const retiredYear = toRaw == null || toRaw === '' ? null : Number(toRaw)

  if (!Number.isFinite(year) || !Number.isFinite(releaseYear)) return false
  if (releaseYear > year) return false
  if (retiredYear != null && Number.isFinite(retiredYear) && retiredYear < year) return false
  return true
}

export function filterActiveProductConsoleOptions(options = [], manufactureYear = null) {
  const result = getCompatibleConsoleOptions({
    manufactureYear: manufactureYear == null || manufactureYear === '' ? null : manufactureYear,
    options,
    audience: 'public',
  })
  if (result.selectableOptions.length) return result.selectableOptions
  if (result.fixedOnly && result.appliedOption) return [result.appliedOption]
  return []
}

export function buildProductConsoleSelectOptions({
  productConsoleOptions = [],
  manufactureYear,
}) {
  const result = getCompatibleConsoleOptions({
    manufactureYear,
    options: productConsoleOptions,
    audience: 'public',
  })
  return {
    options: result.options,
    displayOptions: result.displayOptions,
    usesProductOptions: productConsoleOptions.length > 0,
    showSelector: result.showSelector,
    defaultConsoleName: result.defaultConsoleName,
    defaultConsoleKey: result.defaultConsoleKey,
    fixedOnly: result.fixedOnly,
    fixedOption: result.fixedOption,
    appliedOption: result.appliedOption,
  }
}

/** First available per-product console for a manufacture year, or empty string when none. */
export function getDefaultConsoleNameForProductYear({
  productConsoleOptions = [],
  manufactureYear,
}) {
  return getDefaultCompatibleConsoleName({
    productConsoleOptions,
    manufactureYear,
  })
}

export function buildProductConsoleVariantNames({
  productConsoleOptions = [],
  manufactureYear,
}) {
  const result = buildProductConsoleSelectOptions({
    productConsoleOptions,
    manufactureYear,
  })
  return (result.displayOptions ?? result.options).map((option) => option.label)
}

export function buildProductConsoleImageMap(productConsoleOptions = []) {
  const map = {}
  for (const option of productConsoleOptions) {
    const normalized = normalizeConsoleCompatOption(option)
    if (!normalized.console_name) continue
    const resolvedUrl = resolveEquipmentConsoleImageUrl({
      image_url: normalized.image_url,
      image_storage_path: normalized.image_storage_path,
    })
    if (resolvedUrl) {
      map[normalized.console_name] = resolvedUrl
    }
  }
  return map
}

export function isProductConsoleValidForYear({
  productConsoleOptions = [],
  manufactureYear,
  consoleName,
  consoleKey = null,
}) {
  return isCompatibleConsoleValidForYear({
    productConsoleOptions,
    manufactureYear,
    consoleName,
    consoleKey,
  })
}

/**
 * Find a product console compat option by stable key/id first, then display name.
 */
export function findProductConsoleOption({
  productConsoleOptions = [],
  consoleKey = null,
  consoleId = null,
  consoleName = null,
}) {
  const normalized = (productConsoleOptions ?? []).map((entry) => normalizeConsoleCompatOption(entry))
  const selection = normalizeConsoleKey(consoleKey || consoleName)

  if (consoleId) {
    const byId = normalized.find((entry) => entry.console_id === consoleId || entry.id === consoleId)
    if (byId) return byId
  }

  if (selection) {
    const byKey = normalized.find((entry) => normalizeConsoleKey(entry.console_key) === selection)
    if (byKey) return byKey
  }

  if (consoleName || consoleKey) {
    const nameKey = normalizeKey(consoleName || consoleKey)
    const byName = normalized.find((entry) => normalizeKey(entry.console_name) === nameKey)
    if (byName) return byName
  }

  return null
}

/**
 * Resolve modifier for a selected console.
 * Prefer stable console_key → equipment_console_modifiers, not public labels.
 */
export function resolveProductConsoleModifier({
  productConsoleOptions = [],
  consoleName = null,
  consoleKey = null,
  consoleId = null,
  brand = null,
  modifiers = [],
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

  const option = findProductConsoleOption({
    productConsoleOptions,
    consoleKey,
    consoleId,
    consoleName,
  })

  const resolvedKey = option?.console_key || consoleKey || null
  const resolvedName = option?.console_name || consoleName || null
  const resolvedId = option?.console_id || consoleId || null

  const modifier = matchConsoleModifier(
    modifiers,
    brand || option?.brand,
    resolvedKey || resolvedName,
  )
    || matchConsoleModifier(modifiers, brand || option?.brand, resolvedName)

  // Product console compat is the curated per-product source of truth when present.
  // Brand-wide equipment_console_modifiers fill gaps for legacy / brand selectors.
  const optionPercent = option?.modifier_percent
  const modifierPercent = Number(
    optionPercent != null && Number.isFinite(Number(optionPercent))
      ? optionPercent
      : (modifier?.modifier_value ?? 0),
  )

  return {
    modifierPercent,
    consoleTier: modifier?.console_tier ?? option?.tier ?? 'base',
    estimated: false,
    consoleName: resolvedName,
    consoleKey: resolvedKey,
    consoleId: resolvedId,
    modifier,
  }
}

export function mapProductConsoleOptionsToAvailability(product, productConsoleOptions = []) {
  const brand = product?.brand
  if (!brand) return []

  return (productConsoleOptions ?? []).map((option) => {
    const normalized = normalizeConsoleCompatOption(option)
    return {
      brand,
      console_name: normalized.console_name,
      console_key: normalized.console_key,
      release_year: normalized.available_from_year,
      retired_year: normalized.available_to_year ?? null,
      console_tier: normalized.tier ?? 'base',
      modifier_percent: Number(normalized.modifier_percent ?? 0),
    }
  })
}
