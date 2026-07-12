/**
 * Apply brand console modifier rules on top of canonical base original price.
 */

import { resolveConsoleModifierForSelection } from './consoleAvailability.js'
import {
  brandsMatch,
  matchConsoleModifier,
  normalizeBrandKey,
  normalizeConsoleKey,
} from './consoleModifierMatch.js'

export {
  brandsMatch,
  matchConsoleModifier,
  normalizeBrandKey,
  normalizeConsoleKey,
}

function normalizeWhitespace(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim()
}

/** Technogym consoles shown in valuation UI, least → most valuable. */
export const TECHNOGYM_CONSOLE_SELECT_OPTIONS = [
  { value: 'LED', label: 'LED' },
  { value: 'Visio', label: 'Visio' },
  { value: 'VisioWeb', label: 'VisioWeb' },
  { value: 'Connect', label: 'Connect' },
  { value: 'Unity', label: 'Unity' },
  { value: 'Live 10', label: 'Live 10"' },
  { value: 'Live 16', label: 'Live 16"' },
  { value: 'Live 19', label: 'Live 19"' },
]

const TECHNOGYM_EXCLUDED_LIVE_CONSOLE_PATTERN = /^live\s+(11|12|13|14|15|20|21|22)$/i

export function isTechnogymBrand(brand) {
  return normalizeBrandKey(brand) === 'technogym'
}

function isExcludedTechnogymConsole(name) {
  return TECHNOGYM_EXCLUDED_LIVE_CONSOLE_PATTERN.test(normalizeWhitespace(name))
}

function matchesConsoleOption(variantKey, optionValue) {
  const optionKey = normalizeConsoleKey(optionValue)
  if (!variantKey || !optionKey) return false
  return variantKey === optionKey || variantKey.includes(optionKey) || optionKey.includes(variantKey)
}

export function buildBrandConsoleSelectOptions(brand, modifiers = []) {
  if (isTechnogymBrand(brand)) {
    return TECHNOGYM_CONSOLE_SELECT_OPTIONS
  }

  const seen = new Set()

  return modifiers
    .filter((entry) => brandsMatch(entry.brand, brand))
    .map((entry) => entry.console_name)
    .filter(Boolean)
    .filter((name) => {
      if (seen.has(name)) return false
      seen.add(name)
      return true
    })
    .sort((left, right) => left.localeCompare(right))
    .map((name) => ({ value: name, label: name }))
}

export function filterAndOrderKnownConsoleVariants(brand, variants = []) {
  if (!isTechnogymBrand(brand)) {
    return [...variants]
      .filter(Boolean)
      .sort((left, right) => left.localeCompare(right))
  }

  const normalizedVariants = variants
    .filter(Boolean)
    .filter((name) => !isExcludedTechnogymConsole(name))
    .map((name) => normalizeConsoleKey(name))

  return TECHNOGYM_CONSOLE_SELECT_OPTIONS
    .filter((option) => normalizedVariants.some((key) => matchesConsoleOption(key, option.value)))
    .map((option) => option.label)
}

/**
 * @deprecated Prefer importing matchConsoleModifier from consoleModifierMatch.js
 * Kept as re-export for existing callers.
 */

export function calculateOriginalPriceWithConsole({
  originalBasePrice,
  brand,
  consoleName,
  consoleKey = null,
  consoleId = null,
  consoleModifier = null,
  modifiers = [],
  availability = [],
  productConsoleOptions = [],
  currency = 'GBP',
}) {
  const basePrice = Number(originalBasePrice)
  if (!Number.isFinite(basePrice) || basePrice <= 0) {
    return {
      basePrice: null,
      adjustedPrice: null,
      currency,
      modifier: null,
      modifierPercent: 0,
      explanation: 'No base original price available.',
    }
  }

  const resolved = consoleModifier && Number.isFinite(Number(consoleModifier.modifierPercent))
    ? {
        modifierPercent: Number(consoleModifier.modifierPercent),
        consoleTier: consoleModifier.consoleTier ?? 'base',
        estimated: Boolean(consoleModifier.estimated),
        consoleName: consoleModifier.consoleName ?? consoleName ?? null,
        consoleKey: consoleModifier.consoleKey ?? consoleKey ?? null,
        consoleId: consoleModifier.consoleId ?? consoleId ?? null,
        modifier: consoleModifier.modifier ?? null,
      }
    : resolveConsoleModifierForSelection({
        consoleName,
        consoleKey,
        consoleId,
        brand,
        availability,
        modifiers,
        productConsoleOptions,
      })

  const modifier = resolved.modifier
    ?? matchConsoleModifier(modifiers, brand, consoleKey || consoleName)
  const modifierPercent = Number(resolved.modifierPercent ?? 0)
  const adjustedPrice = Math.round(basePrice * (1 + modifierPercent / 100))

  const formattedBase = new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(basePrice)

  const formattedAdjusted = new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(adjustedPrice)

  let explanation
  const consoleLabel = resolved.consoleName || consoleName || 'base console'
  if (!(consoleKey || consoleName) || modifierPercent === 0) {
    explanation = `Base RRP ${formattedBase} (no console modifier applied for ${consoleLabel}).`
  } else if (resolved.estimated) {
    explanation = `Base RRP ${formattedBase} + estimated ${consoleLabel} modifier ${modifierPercent}% = ${formattedAdjusted}`
  } else {
    explanation = `Base RRP ${formattedBase} + ${consoleLabel} console modifier ${modifierPercent}% = ${formattedAdjusted}`
  }

  return {
    basePrice,
    adjustedPrice,
    currency,
    modifier,
    modifierPercent,
    consoleName: consoleLabel,
    consoleKey: resolved.consoleKey ?? consoleKey ?? null,
    consoleId: resolved.consoleId ?? consoleId ?? null,
    consoleTier: resolved.consoleTier ?? modifier?.console_tier ?? 'base',
    estimatedConsole: resolved.estimated,
    explanation,
  }
}
