/**
 * Stable console-key / brand matching for modifier lookup.
 * Kept dependency-free to avoid circular imports with valuation helpers.
 */

function normalizeWhitespace(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim()
}

export function normalizeConsoleKey(value) {
  return normalizeWhitespace(value).toLowerCase().replace(/[^a-z0-9]+/g, '')
}

/** Collapse brand aliases so "Matrix" matches "Matrix Fitness". */
export function normalizeBrandKey(brand) {
  const key = normalizeConsoleKey(brand)
  if (!key) return ''
  if (key === 'matrix' || key === 'matrixfitness') return 'matrixfitness'
  if (key === 'lifefitness') return 'lifefitness'
  if (key === 'technogym') return 'technogym'
  return key
}

export function brandsMatch(left, right) {
  const a = normalizeBrandKey(left)
  const b = normalizeBrandKey(right)
  return Boolean(a && b && a === b)
}

/**
 * Match a brand modifier row using stable console_key first, then console_name.
 * Never rely on public display labels alone when a key is available.
 *
 * Short codes (SE, ST, SI, SL, C, X, LED) must only match exactly — contains
 * matching caused Discover ST → seed ST@0% and flattened SE/SE3 hierarchies.
 */
export function matchConsoleModifier(modifiers = [], brand, consoleRef) {
  const consoleKey = normalizeConsoleKey(consoleRef)
  if (!consoleKey || !normalizeBrandKey(brand)) return null

  const brandModifiers = modifiers.filter((entry) => brandsMatch(entry.brand, brand))

  let best = null
  for (const entry of brandModifiers) {
    const entryKey = normalizeConsoleKey(entry.console_key)
    const entryName = normalizeConsoleKey(entry.console_name)
    if (!entryKey && !entryName) continue

    const exactKey = Boolean(entryKey) && consoleKey === entryKey
    const exactName = Boolean(entryName) && consoleKey === entryName
    // Allow contains only for longer tokens (SE3, SE3HD, Touch XL, VisioWeb, …).
    // Short 1–2 char codes must be exact to avoid ST matching inside Discover ST
    // with the wrong seed row, or SE matching Discover SE3.
    const contains = Boolean(entryName)
      && entryName.length >= 3
      && (
        consoleKey.includes(entryName) || entryName.includes(consoleKey)
      )

    if (!exactKey && !exactName && !contains) continue

    const specificity = exactKey
      ? 1000 + entryKey.length
      : exactName
        ? 500 + entryName.length
        : entryName.length

    if (
      !best
      || specificity > best.specificity
      || (exactKey && !best.exactKey)
      || (exactName && !best.exactKey && !best.exact)
    ) {
      best = {
        ...entry,
        specificity,
        exact: exactKey || exactName,
        exactKey,
      }
    }
  }

  return best
}
