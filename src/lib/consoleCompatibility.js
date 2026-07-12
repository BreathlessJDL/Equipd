/**
 * Shared console compatibility for product pages, valuation, and admin.
 *
 * Public policy:
 * - Selectable choices: factory + optional only.
 * - Fixed consoles: auto-applied, not selectable, but still returned for display.
 * - Retrofit: admin-only (unless includeRetrofit).
 * Never fall back to brand-wide console lists.
 *
 * "Hide selector" means hide the dropdown — not hide evidence of the fitted console.
 */

export const CONSOLE_COMPATIBILITY_TYPES = Object.freeze([
  'factory',
  'optional',
  'retrofit',
  'fixed',
])

export const PUBLIC_SELECTABLE_COMPATIBILITY_TYPES = Object.freeze([
  'factory',
  'optional',
])

export const CONSOLE_CONFIDENCE_LEVELS = Object.freeze(['high', 'medium', 'low'])

function normalizeKey(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim().toLowerCase()
}

function toYear(value) {
  if (value == null || value === '') return null
  const year = Number(value)
  return Number.isFinite(year) ? year : null
}

export function isWellnessTvConsoleOption(option) {
  const key = normalizeKey(option?.console_key).replace(/[^a-z0-9]/g, '')
  const name = normalizeKey(option?.console_name)
  return key.includes('wellnesstv') || /\bwellness\s*tv\b/.test(name)
}

/**
 * Normalize legacy product_console_options or joined compat rows into a common shape.
 */
export function normalizeConsoleCompatOption(row = {}) {
  const compatibilityType = CONSOLE_COMPATIBILITY_TYPES.includes(row.compatibility_type)
    ? row.compatibility_type
    : 'factory'

  const availableFrom = toYear(row.available_from_year ?? row.release_year)
  const availableTo = toYear(row.available_to_year ?? row.retired_year)

  return {
    id: row.id ?? null,
    product_id: row.product_id ?? null,
    console_id: row.console_id ?? null,
    console_key: row.console_key ?? null,
    console_name: row.console_name ?? null,
    alternative_names: row.alternative_names ?? [],
    available_from_year: availableFrom,
    available_to_year: availableTo,
    // Legacy aliases used by older helpers
    release_year: availableFrom,
    retired_year: availableTo,
    from_year_approximate: Boolean(row.from_year_approximate ?? row.start_year_approximate),
    to_year_approximate: Boolean(row.to_year_approximate ?? row.end_year_approximate),
    compatibility_type: compatibilityType,
    is_default: Boolean(row.is_default),
    sort_order: Number(row.display_order ?? row.sort_order ?? 0),
    display_order: Number(row.display_order ?? row.sort_order ?? 0),
    tier: row.tier ?? 'base',
    modifier_percent: row.modifier_percent == null || row.modifier_percent === ''
      ? null
      : Number(row.modifier_percent),
    image_url: row.image_url ?? null,
    image_storage_path: row.image_storage_path ?? null,
    source_url: row.source_url ?? null,
    notes: row.notes ?? null,
    confidence: CONSOLE_CONFIDENCE_LEVELS.includes(row.confidence) ? row.confidence : 'medium',
    is_active: row.is_active !== false,
    brand: row.brand ?? null,
  }
}

export function isCompatOptionAvailableForYear(option, manufactureYear) {
  const year = toYear(manufactureYear)
  const from = toYear(option?.available_from_year ?? option?.release_year)
  const to = option?.available_to_year != null || option?.retired_year != null
    ? toYear(option?.available_to_year ?? option?.retired_year)
    : null

  if (year == null || from == null) return false
  if (from > year) return false
  if (to != null && to < year) return false
  return true
}

function sortCompatOptions(options = []) {
  return [...options].sort((left, right) => {
    const defaultDiff = Number(Boolean(right.is_default)) - Number(Boolean(left.is_default))
    if (defaultDiff !== 0) return defaultDiff
    const orderDiff = Number(left.display_order ?? left.sort_order ?? 0)
      - Number(right.display_order ?? right.sort_order ?? 0)
    if (orderDiff !== 0) return orderDiff
    const yearDiff = Number(left.available_from_year ?? 0) - Number(right.available_from_year ?? 0)
    if (yearDiff !== 0) return yearDiff
    return String(left.console_name ?? '').localeCompare(String(right.console_name ?? ''))
  })
}

function toSelectOption(option) {
  // Prefer stable console_key as the select value so valuation never depends on display labels.
  const value = option.console_key || option.console_name
  return {
    value,
    label: option.console_name,
    console_key: option.console_key,
    console_id: option.console_id ?? null,
    console_tier: option.tier ?? 'base',
    modifier_percent: Number(option.modifier_percent ?? 0),
    release_year: option.available_from_year,
    retired_year: option.available_to_year,
    available_from_year: option.available_from_year,
    available_to_year: option.available_to_year,
    compatibility_type: option.compatibility_type,
    image_url: option.image_url ?? null,
    confidence: option.confidence,
    is_default: Boolean(option.is_default),
    estimated: false,
  }
}

/**
 * Shared compatibility resolver for product + valuation pages.
 *
 * @param {object} args
 * @param {string|number|null} [args.productId] unused — reserved for call-site clarity
 * @param {string|number|null} args.manufactureYear
 * @param {object[]} [args.options] normalized or raw compat/legacy rows
 * @param {'public'|'admin'} [args.audience='public']
 * @param {boolean} [args.includeRetrofit=false]
 */
export function getCompatibleConsoleOptions({
  productId: _productId = null,
  manufactureYear,
  options = [],
  audience = 'public',
  includeRetrofit = false,
} = {}) {
  const year = toYear(manufactureYear)
  const normalized = (options ?? [])
    .map((row) => normalizeConsoleCompatOption(row))
    .filter((option) => option.is_active)
    .filter((option) => option.console_name)
    .filter((option) => !isWellnessTvConsoleOption(option))

  if (year == null) {
    return {
      options: [],
      selectableOptions: [],
      retrofitOptions: [],
      fixedOption: null,
      appliedOption: null,
      displayOptions: [],
      defaultConsoleName: '',
      defaultConsoleKey: '',
      showSelector: false,
      hasMapping: normalized.length > 0,
      missingMapping: normalized.length === 0,
      usesEstimatedFallback: false,
      fixedOnly: false,
    }
  }

  const yearMatched = sortCompatOptions(
    normalized.filter((option) => isCompatOptionAvailableForYear(option, year)),
  )

  const allowRetrofit = audience === 'admin' || includeRetrofit
  const selectableTypes = allowRetrofit
    ? [...PUBLIC_SELECTABLE_COMPATIBILITY_TYPES, 'retrofit']
    : [...PUBLIC_SELECTABLE_COMPATIBILITY_TYPES]

  const selectable = yearMatched.filter((option) => (
    selectableTypes.includes(option.compatibility_type)
  ))

  const fixedOptions = yearMatched.filter((option) => option.compatibility_type === 'fixed')
  const retrofitOptions = yearMatched.filter((option) => option.compatibility_type === 'retrofit')
  const fixedOption = fixedOptions[0] ?? null

  let applied = null
  if (selectable.length) {
    applied = selectable[0]
  } else if (fixedOption) {
    applied = fixedOption
  }

  const showSelector = audience === 'admin'
    ? yearMatched.length > 1
    : selectable.length > 1

  // Cards / read-only UI: all selectable choices when choosing, otherwise the applied console.
  const displaySource = showSelector
    ? selectable
    : (applied ? [applied] : [])

  return {
    options: selectable.map(toSelectOption),
    selectableOptions: selectable,
    retrofitOptions,
    fixedOption,
    appliedOption: applied,
    displayOptions: displaySource.map(toSelectOption),
    allYearMatched: yearMatched,
    defaultConsoleName: applied?.console_name ?? '',
    defaultConsoleKey: applied?.console_key || applied?.console_name || '',
    showSelector,
    hasMapping: yearMatched.length > 0,
    missingMapping: yearMatched.length === 0,
    usesEstimatedFallback: false,
    fixedOnly: selectable.length === 0 && Boolean(fixedOption),
  }
}

/** @deprecated Prefer getCompatibleConsoleOptions — kept for gradual migration. */
export function buildPublicConsoleSelectOptions({
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
    usesProductOptions: (productConsoleOptions ?? []).length > 0,
    showSelector: result.showSelector,
    defaultConsoleName: result.defaultConsoleName,
    defaultConsoleKey: result.defaultConsoleKey,
    fixedOnly: result.fixedOnly,
    fixedOption: result.fixedOption,
    appliedOption: result.appliedOption,
  }
}

export function getDefaultCompatibleConsoleName({
  productConsoleOptions = [],
  manufactureYear,
}) {
  const result = getCompatibleConsoleOptions({
    manufactureYear,
    options: productConsoleOptions,
    audience: 'public',
  })
  // Prefer stable key for select/valuation state; fall back to display name.
  return result.defaultConsoleKey || result.defaultConsoleName
}

export function isCompatibleConsoleValidForYear({
  productConsoleOptions = [],
  manufactureYear,
  consoleName,
  consoleKey = null,
}) {
  const selection = consoleKey || consoleName
  if (!selection) return true
  const result = getCompatibleConsoleOptions({
    manufactureYear,
    options: productConsoleOptions,
    audience: 'public',
  })
  const key = normalizeKey(selection)
  if (result.options.some((option) => (
    normalizeKey(option.value) === key
    || normalizeKey(option.console_key) === key
    || normalizeKey(option.label) === key
  ))) return true
  if (result.appliedOption) {
    const applied = result.appliedOption
    if (normalizeKey(applied.console_key) === key) return true
    if (normalizeKey(applied.console_name) === key) return true
  }
  if (result.fixedOnly && (
    normalizeKey(result.defaultConsoleKey) === key
    || normalizeKey(result.defaultConsoleName) === key
  )) return true
  return false
}

export function shouldShowConsoleSelector(compatResult) {
  return Boolean(compatResult?.showSelector)
}

/** True when a console should be visible (selector and/or read-only / cards). */
export function shouldShowConsoleEvidence(compatResult) {
  return Boolean(
    compatResult?.showSelector
    || compatResult?.appliedOption?.console_name
    || (compatResult?.displayOptions?.length ?? 0) > 0,
  )
}

/**
 * Detect overlapping year ranges for the same product + console + type.
 */
export function findOverlappingCompatMappings(options = []) {
  const normalized = (options ?? []).map((row) => normalizeConsoleCompatOption(row))
  const overlaps = []

  for (let i = 0; i < normalized.length; i += 1) {
    for (let j = i + 1; j < normalized.length; j += 1) {
      const left = normalized[i]
      const right = normalized[j]
      if (left.console_key !== right.console_key) continue
      if (left.compatibility_type !== right.compatibility_type) continue

      const leftTo = left.available_to_year ?? 9999
      const rightTo = right.available_to_year ?? 9999
      const overlapsYears = left.available_from_year <= rightTo
        && right.available_from_year <= leftTo
      if (!overlapsYears) continue

      overlaps.push({ left, right })
    }
  }

  return overlaps
}
