/**
 * Shared canonical product display-name builder.
 *
 * Assembles Brand + optional Series + Model while suppressing duplicate
 * brand/series prefixes and adjacent repeated phrases.
 *
 * Does not change canonical_product_key / slugs — display only (and CSV name gen).
 */

function normalizeWhitespace(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim()
}

/** Split CamelCase / digit boundaries for comparison only. */
export function expandDisplayNameBoundaries(value) {
  return String(value ?? '')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/([A-Za-z])(\d)/g, '$1 $2')
    .replace(/(\d)([A-Za-z])/g, '$1 $2')
}

/**
 * Comparison normalizer: lowercase, strip punctuation/hyphens, collapse spaces,
 * expand CamelCase. Does not alter stored casing used in the returned name.
 */
export function normalizeDisplayNameText(value) {
  return expandDisplayNameBoundaries(value)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function compactDisplayNameText(value) {
  return normalizeDisplayNameText(value).replace(/\s+/g, '')
}

function tokenizeDisplayName(value) {
  const trimmed = normalizeWhitespace(value)
  return trimmed ? trimmed.split(/\s+/).filter(Boolean) : []
}

function tokensMatch(left, right) {
  return normalizeDisplayNameText(left) === normalizeDisplayNameText(right)
}

/**
 * True when `text` equals `phrase` or begins with the full phrase as a prefix
 * (token/phrase aware, CamelCase-equivalent).
 */
export function displayNameStartsWithPhrase(text, phrase) {
  const normalizedText = normalizeDisplayNameText(text)
  const normalizedPhrase = normalizeDisplayNameText(phrase)
  if (!normalizedText || !normalizedPhrase) return false
  if (normalizedText === normalizedPhrase) return true
  return normalizedText.startsWith(`${normalizedPhrase} `)
}

/**
 * Remove a leading phrase from text when present (comparison-normalized).
 * Preserves the remainder's original casing/spacing tokens as much as possible.
 */
export function stripLeadingDisplayPhrase(text, phrase) {
  const original = normalizeWhitespace(text)
  const phraseText = normalizeWhitespace(phrase)
  if (!original || !phraseText) return original
  if (!displayNameStartsWithPhrase(original, phraseText)) return original

  const originalTokens = tokenizeDisplayName(original)
  const phraseTokenCount = tokenizeDisplayName(normalizeDisplayNameText(phraseText)).length
    || tokenizeDisplayName(phraseText).length

  // Align by normalized token walk: consume phrase-equivalent prefix tokens.
  const phraseNormTokens = normalizeDisplayNameText(phraseText).split(' ').filter(Boolean)
  let consumed = 0
  let matched = 0
  while (consumed < originalTokens.length && matched < phraseNormTokens.length) {
    const next = normalizeDisplayNameText(originalTokens[consumed])
    const target = phraseNormTokens[matched]
    if (next === target) {
      consumed += 1
      matched += 1
      continue
    }
    // Allow compact token equality (F-85 vs F85) for a single original token.
    if (compactDisplayNameText(originalTokens[consumed]) === compactDisplayNameText(phraseNormTokens.slice(matched).join(' '))) {
      consumed += 1
      matched = phraseNormTokens.length
      break
    }
    // Multi-token original matching one compact phrase chunk
    let combined = ''
    let look = consumed
    let progressed = false
    while (look < originalTokens.length && matched < phraseNormTokens.length) {
      combined = `${combined} ${originalTokens[look]}`.trim()
      look += 1
      if (normalizeDisplayNameText(combined) === phraseNormTokens[matched]) {
        consumed = look
        matched += 1
        progressed = true
        break
      }
      if (!phraseNormTokens[matched].startsWith(normalizeDisplayNameText(combined))) break
    }
    if (!progressed) break
  }

  if (matched < phraseNormTokens.length) {
    // Fallback: phraseTokenCount heuristic
    if (originalTokens.length <= phraseTokenCount) return ''
    return originalTokens.slice(phraseTokenCount).join(' ')
  }

  return originalTokens.slice(consumed).join(' ')
}

/**
 * Remove adjacent repeated words and adjacent repeated multi-word phrases.
 * Keeps the first occurrence's casing.
 *
 * HIIT HIIT Bike → HIIT Bike
 * Tour de France Tour de France 5.0 → Tour de France 5.0
 */
export function removeAdjacentRepeatedDisplayPhrases(text) {
  let tokens = tokenizeDisplayName(text)
  if (tokens.length < 2) return normalizeWhitespace(text)

  let changed = true
  while (changed) {
    changed = false
    outer: for (let phraseLen = Math.floor(tokens.length / 2); phraseLen >= 1; phraseLen -= 1) {
      for (let index = 0; index + (phraseLen * 2) <= tokens.length; index += 1) {
        const left = tokens.slice(index, index + phraseLen)
        const right = tokens.slice(index + phraseLen, index + (phraseLen * 2))
        const leftKey = left.map((token) => normalizeDisplayNameText(token)).join(' ')
        const rightKey = right.map((token) => normalizeDisplayNameText(token)).join(' ')
        if (!leftKey || leftKey !== rightKey) continue
        tokens = [
          ...tokens.slice(0, index + phraseLen),
          ...tokens.slice(index + (phraseLen * 2)),
        ]
        changed = true
        break outer
      }
    }
  }

  return tokens.join(' ')
}

/**
 * Build a clean display name from brand / series / model parts.
 *
 * @param {{ brand?: string|null, series?: string|null, model?: string|null }} parts
 * @returns {string}
 */
export function buildCanonicalProductDisplayName({
  brand = null,
  series = null,
  model = null,
} = {}) {
  let brandText = normalizeWhitespace(brand)
  let seriesText = normalizeWhitespace(series)
  let modelText = normalizeWhitespace(model)

  if (seriesText && brandText) {
    seriesText = stripLeadingDisplayPhrase(seriesText, brandText)
  }
  if (modelText && brandText) {
    modelText = stripLeadingDisplayPhrase(modelText, brandText)
  }

  // Model already begins with / equals series → omit series.
  if (seriesText && modelText && displayNameStartsWithPhrase(modelText, seriesText)) {
    seriesText = ''
  }

  // Identical series and model after stripping → keep one.
  if (seriesText && modelText && normalizeDisplayNameText(seriesText) === normalizeDisplayNameText(modelText)) {
    seriesText = ''
  }

  const joined = [brandText, seriesText, modelText].filter(Boolean).join(' ')
  return removeAdjacentRepeatedDisplayPhrases(joined)
}

/**
 * Build from a product-like object (uses product_family or series).
 *
 * Prefer a cleaned stored canonical_product_name when it is a curated longer
 * title (e.g. model field is a generic "BIKE"). Rebuild from brand/series/model
 * when that removes series/model duplication the stored name still has.
 */
export function buildCanonicalProductDisplayNameFromProduct(product) {
  if (!product || typeof product !== 'object') return ''
  const brand = product.brand ?? null
  const series = product.product_family ?? product.series ?? null
  const model = product.model ?? null
  const storedRaw = normalizeWhitespace(product.canonical_product_name)
  const storedClean = cleanCanonicalProductDisplayName(storedRaw, { brand, series })
  const rebuilt = buildCanonicalProductDisplayName({ brand, series, model })

  if (storedClean && rebuilt) {
    const storedNorm = normalizeDisplayNameText(storedClean)
    const rebuiltNorm = normalizeDisplayNameText(rebuilt)
    if (storedNorm === rebuiltNorm) return rebuilt

    const modelWithoutBrand = brand
      ? (stripLeadingDisplayPhrase(normalizeWhitespace(model), brand) || normalizeWhitespace(model))
      : normalizeWhitespace(model)
    const seriesDuplicatedInModel = Boolean(
      series
      && modelWithoutBrand
      && displayNameStartsWithPhrase(modelWithoutBrand, series),
    )

    if (
      seriesDuplicatedInModel
      && tokenizeDisplayName(rebuilt).length <= tokenizeDisplayName(storedClean).length
    ) {
      return rebuilt
    }

    if (tokenizeDisplayName(storedClean).length > tokenizeDisplayName(rebuilt).length) {
      return storedClean
    }

    return rebuilt
  }

  return storedClean || rebuilt || ''
}

/**
 * Clean an already-assembled canonical name (stored or pasted).
 * Uses brand/series when available for semantic prefix stripping, then
 * adjacent phrase dedupe. Does not invent missing brand/series/model.
 */
export function cleanCanonicalProductDisplayName(name, {
  brand = null,
  series = null,
} = {}) {
  let text = normalizeWhitespace(name)
  if (!text) return ''

  const brandText = normalizeWhitespace(brand)
  const seriesText = normalizeWhitespace(series)

  // Collapse brand brand … at the start (and anywhere adjacent via phrase pass).
  if (brandText && displayNameStartsWithPhrase(text, `${brandText} ${brandText}`)) {
    text = stripLeadingDisplayPhrase(text, brandText)
  }

  // If name is brand + series + series + … collapse via phrase dedupe after
  // optional brand-aware pass.
  text = removeAdjacentRepeatedDisplayPhrases(text)

  // brand + series + (series already in remainder) — if text is brand+series+model
  // and model portion repeats series, phrase dedupe handles adjacent cases.
  if (brandText && seriesText) {
    const withoutBrand = stripLeadingDisplayPhrase(text, brandText)
    if (displayNameStartsWithPhrase(withoutBrand, `${seriesText} ${seriesText}`)) {
      const rest = stripLeadingDisplayPhrase(withoutBrand, seriesText)
      text = [brandText, seriesText, rest].filter(Boolean).join(' ')
      text = removeAdjacentRepeatedDisplayPhrases(text)
    }
  }

  return normalizeWhitespace(text)
}

/**
 * Reasons series would be omitted from a rebuilt display name.
 */
export function getCanonicalDisplayNameSeriesWarning({ brand, series, model } = {}) {
  const seriesText = normalizeWhitespace(series)
  const modelText = normalizeWhitespace(model)
  if (!seriesText || !modelText) return null

  let modelWithoutBrand = modelText
  const brandText = normalizeWhitespace(brand)
  if (brandText) {
    modelWithoutBrand = stripLeadingDisplayPhrase(modelText, brandText) || modelText
  }

  if (displayNameStartsWithPhrase(modelWithoutBrand, seriesText)
    || normalizeDisplayNameText(modelWithoutBrand) === normalizeDisplayNameText(seriesText)) {
    return 'Series is already present in model; duplicate wording will be removed from the display name.'
  }
  return null
}

/**
 * Compare a stored name to the rebuilt clean name.
 */
export function evaluateCanonicalProductDisplayName(product) {
  const brand = product?.brand ?? null
  const series = product?.product_family ?? product?.series ?? null
  const model = product?.model ?? null
  const current = normalizeWhitespace(product?.canonical_product_name)
  const proposed = buildCanonicalProductDisplayName({ brand, series, model })
    || cleanCanonicalProductDisplayName(current, { brand, series })
  const currentCleaned = cleanCanonicalProductDisplayName(current, { brand, series })

  const reasons = []
  if (current && proposed && normalizeDisplayNameText(current) !== normalizeDisplayNameText(proposed)) {
    if (brand && displayNameStartsWithPhrase(current, `${brand} ${brand}`)) {
      reasons.push('brand_repeated')
    }
    if (series && model && displayNameStartsWithPhrase(model, series)) {
      reasons.push('series_contained_in_model')
    }
    if (normalizeDisplayNameText(current) !== normalizeDisplayNameText(currentCleaned)) {
      reasons.push('adjacent_phrase_repeated')
    }
    if (!reasons.length) reasons.push('differs_from_rebuilt_name')
  }

  const safeToUpdate = Boolean(
    current
    && proposed
    && reasons.length > 0
    && normalizeDisplayNameText(current) !== normalizeDisplayNameText(proposed)
    // Safe when rebuild is a strict "subset" cleanup of the stored name
    // (same tokens after dedupe), not a wholesale rename.
    && (
      normalizeDisplayNameText(currentCleaned) === normalizeDisplayNameText(proposed)
      || normalizeDisplayNameText(removeAdjacentRepeatedDisplayPhrases(current)) === normalizeDisplayNameText(proposed)
    ),
  )

  return {
    current,
    proposed,
    reasons,
    safeToUpdate,
    changed: Boolean(current && proposed && normalizeDisplayNameText(current) !== normalizeDisplayNameText(proposed)),
  }
}

export {
  tokensMatch,
  normalizeWhitespace as normalizeCanonicalDisplayWhitespace,
}
