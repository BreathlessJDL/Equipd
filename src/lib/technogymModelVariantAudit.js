/**
 * Technogym model variant audit — analysis only.
 * Splits catalogue models into series, machine type, suffix, and console tokens.
 */

const MACHINE_TYPE_PHRASES = [
  'NEW RECLINE',
  'NEW BIKE',
  'CROSSOVER',
  'SKILLMILL',
  'SYNCHRO',
  'RECLINE',
  'VARIO',
  'CLIMB',
  'CROSS',
  'STEP',
  'BIKE',
  'JOG',
  'RUN',
  'TOP',
  'WAVE',
  'UPPER',
]

const PRODUCT_LINE_TOKENS = [
  'EXCITE',
  'FORMA',
  'ARTIS',
  'PERSONAL',
  'NOW',
  'ELEMENT',
  'SKILLMILL',
]

const CONSOLE_PACKAGE_TOKENS = [
  'VISIO WEB',
  'DIGITAL TV',
  'LIVE 22',
  'LIVE 19',
  'LIVE 16',
  'LIVE 15',
  'LIVE 12',
  'LIVE 10',
  'UNITY MINI',
  'CONNECT',
  'UNITY',
  'VISIO',
  'TV',
  'LED',
  'IFI',
  'WEB',
]

const CONSOLE_IN_SUFFIX_PATTERN = /\b(UNITY|CONNECT|LIVE(?:\s+\d+)?|VISIO(?:\s+WEB)?|DIGITAL\s+TV|LED|TV|IFI)\b/i

const PACKAGE_SUFFIX_PATTERN = /^(?:\d{3,4})(?:\s*(?:SP|P|CE|UL|I))?$/i
const NUMERIC_SUFFIX_PATTERN = /^(\d{3,4})(I)?$/i

function normalizeWhitespace(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim()
}

function normalizeUpper(value) {
  return normalizeWhitespace(value).toUpperCase()
}

function titleCase(value) {
  return normalizeWhitespace(value)
    .split(' ')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ')
}

export function normalizeTechnogymSeriesFamily(seriesField, modelLine = null) {
  const raw = normalizeWhitespace(seriesField)
  if (raw) {
    const cleaned = raw
      .replace(/\s*\+\s*/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()

    const exciteYear = cleaned.match(/^EXCITE(?:\s+(\d{4}))?/i)
    if (exciteYear) {
      return exciteYear[1] ? `Excite ${exciteYear[1]}` : 'Excite'
    }

    if (/^EXCITE\s/i.test(cleaned) || /\bEXCITE\b/i.test(cleaned)) {
      const year = cleaned.match(/\b(20\d{2})\b/)
      return year ? `Excite ${year[1]}` : 'Excite'
    }

    if (/^ARTIS/i.test(cleaned)) return 'Artis'
    if (/NEW\s+FORMA/i.test(cleaned)) return 'Forma (new)'
    if (/OLD\s+FORMA/i.test(cleaned)) return 'Forma (old)'
    if (/FORMA/i.test(cleaned)) return 'Forma'
    if (/PERSONAL/i.test(cleaned)) return 'Personal'
    if (/ELEMENT/i.test(cleaned)) return 'Element'
    if (/STRENGTH/i.test(cleaned)) return 'Strength'
    if (/DUMBBELL/i.test(cleaned)) return 'Dumbbells'

    return titleCase(cleaned)
  }

  if (modelLine) return titleCase(modelLine)
  return 'Unknown'
}

function extractMachineType(modelUpper) {
  for (const phrase of MACHINE_TYPE_PHRASES) {
    const pattern = new RegExp(`^${phrase.replace(/\s+/g, '\\s+')}\\b`)
    if (pattern.test(modelUpper)) {
      return phrase.replace(/\s+/g, ' ')
    }
  }
  return null
}

function extractProductLine(modelUpper) {
  for (const token of PRODUCT_LINE_TOKENS) {
    if (new RegExp(`\\b${token}\\b`).test(modelUpper)) return token
  }
  return null
}

function stripFromStart(text, phrase) {
  const pattern = new RegExp(`^${phrase.replace(/\s+/g, '\\s+')}\\s*`, 'i')
  return normalizeWhitespace(text.replace(pattern, ''))
}

function stripTokenFromEnd(text, token) {
  const pattern = new RegExp(`\\s+${token.replace(/\s+/g, '\\s+')}$`, 'i')
  if (!pattern.test(text)) return { text, removed: null }
  return {
    text: normalizeWhitespace(text.replace(pattern, '')),
    removed: token,
  }
}

function extractParentheticalConsoleTokens(modelUpper) {
  let remainder = modelUpper
  const consoles = []
  const pattern = /\s*\(([^)]+)\)/g

  remainder = remainder.replace(pattern, (match, inner) => {
    const normalized = normalizeUpper(inner)
    const mapped = normalized
      .replace(/^OLD TV VERSION$/i, 'TV')
      .replace(/^DIGITAL TV$/i, 'DIGITAL TV')

    if (
      CONSOLE_PACKAGE_TOKENS.includes(mapped)
      || /^(LED|TV|UNITY|CONNECT|VISIO|IFI|WEB)$/i.test(mapped)
      || /^OLD TV/i.test(normalized)
    ) {
      consoles.push(mapped)
      return ''
    }
    return match
  })

  return { remainder: normalizeWhitespace(remainder), consoles }
}

function extractTrailingConsoleTokens(modelUpper) {
  const parenthetical = extractParentheticalConsoleTokens(modelUpper)
  let remainder = parenthetical.remainder
  const consoles = [...parenthetical.consoles]

  let changed = true
  while (changed) {
    changed = false
    for (const token of CONSOLE_PACKAGE_TOKENS) {
      const result = stripTokenFromEnd(remainder, token)
      if (result.removed) {
        remainder = result.text
        consoles.unshift(token)
        changed = true
        break
      }
    }
  }

  return { remainder, consoles }
}

export function parseTechnogymModel(row) {
  const brand = 'Technogym'
  const rawModel = normalizeWhitespace(row?.model)
  const modelUpper = normalizeUpper(rawModel)
  const equipmentType = normalizeWhitespace(row?.equipment_type) || null
  const seriesField = normalizeWhitespace(row?.series) || null

  const machineType = extractMachineType(modelUpper)
  let working = modelUpper

  if (machineType) {
    working = stripFromStart(working, machineType)
  }

  const modelLine = extractProductLine(working)
  if (modelLine) {
    working = normalizeWhitespace(working.replace(new RegExp(`\\b${modelLine}\\b`), ''))
  }

  const { remainder, consoles } = extractTrailingConsoleTokens(working)
  let modelSuffix = normalizeWhitespace(remainder) || rawModel || '—'

  if (!machineType) {
    return {
      brand,
      seriesFamily: normalizeTechnogymSeriesFamily(seriesField, modelLine),
      machineType: equipmentType || 'Other',
      modelSuffix: rawModel || '—',
      consoleTokens: consoles,
      modelLine,
      rawModel,
      seriesField,
      equipmentType,
      parseConfidence: 'low',
    }
  }

  return {
    brand,
    seriesFamily: normalizeTechnogymSeriesFamily(seriesField, modelLine),
    machineType,
    modelSuffix,
    consoleTokens: consoles,
    modelLine,
    rawModel,
    seriesField,
    equipmentType,
    parseConfidence: modelSuffix && modelSuffix !== '—' ? 'high' : 'medium',
  }
}

function consoleFlagsFromRow(parsed) {
  const tokens = new Set([
    ...parsed.consoleTokens.map((token) => normalizeUpper(token)),
    ...((parsed.modelSuffix.match(CONSOLE_IN_SUFFIX_PATTERN) || [])),
  ])

  const joined = `${parsed.modelSuffix} ${parsed.consoleTokens.join(' ')}`.toUpperCase()

  return {
    withUnity: /\bUNITY\b/.test(joined),
    withLive: /\bLIVE(?:\s+\d+)?\b/.test(joined),
    withConnect: /\bCONNECT\b/.test(joined),
    withLed: /\bLED\b/.test(joined),
    withTv: /\bTV\b/.test(joined) && !/\bDIGITAL TV\b/.test(joined),
    withVisio: /\bVISIO\b/.test(joined),
    withIfi: /\bIFI\b/.test(joined),
    withDigitalTv: /\bDIGITAL TV\b/.test(joined),
    consoleTypes: [
      /\bUNITY\b/.test(joined) ? 'Unity' : null,
      /\bCONNECT\b/.test(joined) ? 'Connect' : null,
      /\bLIVE(?:\s+\d+)?\b/.test(joined) ? 'Live' : null,
      /\bVISIO(?:\s+WEB)?\b/.test(joined) ? 'Visio' : null,
      /\bDIGITAL TV\b/.test(joined) ? 'Digital TV' : null,
      /\bLED\b/.test(joined) ? 'LED' : null,
      /\bTV\b/.test(joined) && !/\bDIGITAL TV\b/.test(joined) ? 'TV' : null,
      /\bIFI\b/.test(joined) ? 'IFI' : null,
    ].filter(Boolean),
  }
}

function suffixBaseNumber(suffix) {
  const match = normalizeUpper(suffix).match(/^(\d{3,4})/)
  return match ? match[1] : null
}

function normalizeSuffixKey(suffix) {
  return normalizeWhitespace(suffix) || '—'
}

function buildSuffixStats(rows) {
  const stats = {
    occurrences: rows.length,
    rowIds: rows.map((row) => row.id),
    sampleModels: [...new Set(rows.map((row) => row.parsed.rawModel))].slice(0, 8),
    equipmentTypes: [...new Set(rows.map((row) => row.parsed.equipmentType).filter(Boolean))],
    families: [...new Set(rows.map((row) => row.parsed.seriesFamily))],
    withUnity: 0,
    withLive: 0,
    withConnect: 0,
    withLed: 0,
    withTv: 0,
    withVisio: 0,
    withIfi: 0,
    withDigitalTv: 0,
    multipleConsoleTypes: 0,
    consoleTypeSets: [],
  }

  for (const row of rows) {
    const flags = consoleFlagsFromRow(row.parsed)
    if (flags.withUnity) stats.withUnity += 1
    if (flags.withLive) stats.withLive += 1
    if (flags.withConnect) stats.withConnect += 1
    if (flags.withLed) stats.withLed += 1
    if (flags.withTv) stats.withTv += 1
    if (flags.withVisio) stats.withVisio += 1
    if (flags.withIfi) stats.withIfi += 1
    if (flags.withDigitalTv) stats.withDigitalTv += 1

    const uniqueConsoles = [...new Set(flags.consoleTypes)]
    stats.consoleTypeSets.push(uniqueConsoles)
    if (uniqueConsoles.length > 1) stats.multipleConsoleTypes += 1
  }

  stats.distinctConsoleCombinations = [...new Set(
    stats.consoleTypeSets.map((set) => set.sort().join('|')),
  )]

  stats.sameEquipmentType = stats.equipmentTypes.length <= 1
  stats.sameFamily = stats.families.length <= 1

  return stats
}

function classifySuffix(suffix, group) {
  const stats = group.suffixes[suffix]
  const allSuffixes = Object.keys(group.suffixes)
  const upper = normalizeUpper(suffix)
  const baseNum = suffixBaseNumber(suffix)
  const reasons = []
  let classification = 'unknown'
  let confidence = 'low'

  const consoleInSuffix = CONSOLE_IN_SUFFIX_PATTERN.test(upper)
  const numericOnly = NUMERIC_SUFFIX_PATTERN.test(upper)
  const packageTier = /\b(SP|P|CE|UL)\b$/i.test(upper) || /^\d{3,4}P$/i.test(upper)

  const siblingSuffixes = baseNum
    ? allSuffixes.filter((entry) => entry !== suffix && entry.startsWith(baseNum))
    : []

  const baseNumericExists = baseNum && allSuffixes.includes(baseNum)
  const shorterBaseExists = baseNum && allSuffixes.some((entry) => (
    entry !== suffix
    && suffixBaseNumber(entry) === baseNum
    && entry.length < suffix.length
  ))

  if (consoleInSuffix && (baseNumericExists || shorterBaseExists)) {
    classification = 'likely_console_package'
    confidence = 'high'
    reasons.push(`Console term in suffix while shorter base "${baseNum}" exists in same group`)
  } else if (consoleInSuffix) {
    classification = 'likely_console_package'
    confidence = 'medium'
    reasons.push('Suffix embeds a console name (Unity/Connect/Live/Visio/etc.)')
  } else if (numericOnly && stats.distinctConsoleCombinations.length >= 2) {
    classification = 'likely_hardware_revision'
    confidence = 'high'
    reasons.push(`Numeric tier appears with ${stats.distinctConsoleCombinations.length} console combinations`)
  } else if (packageTier && siblingSuffixes.length >= 1) {
    classification = 'likely_hardware_revision'
    confidence = 'medium'
    reasons.push(`Package tier (${suffix}) coexists with ${siblingSuffixes.join(', ')} in same series+machine`)
  } else if (packageTier && stats.occurrences >= 3) {
    classification = 'likely_hardware_revision'
    confidence = 'medium'
    reasons.push('Package suffix (P/SP/CE) with multiple catalogue rows')
  } else if (stats.occurrences >= 3 && stats.sameEquipmentType && stats.sameFamily) {
    classification = 'likely_physical_model'
    confidence = 'medium'
    reasons.push('Stable suffix across rows with consistent family and equipment type')
  } else if (stats.occurrences < 3) {
    classification = 'unknown'
    confidence = 'low'
    reasons.push('Insufficient occurrences for confident classification')
  } else {
    classification = 'unknown'
    confidence = 'low'
    reasons.push('Pattern does not match known console or hardware tier rules')
  }

  const consoleCoverage = stats.occurrences > 0
    ? {
      unity: stats.withUnity / stats.occurrences,
      live: stats.withLive / stats.occurrences,
      connect: stats.withConnect / stats.occurrences,
      led: stats.withLed / stats.occurrences,
      tv: stats.withTv / stats.occurrences,
      visio: stats.withVisio / stats.occurrences,
    }
    : null

  return {
    suffix,
    classification,
    confidence,
    reasons,
    stats: {
      occurrences: stats.occurrences,
      withUnity: stats.withUnity,
      withLive: stats.withLive,
      withConnect: stats.withConnect,
      withLed: stats.withLed,
      withTv: stats.withTv,
      withVisio: stats.withVisio,
      withIfi: stats.withIfi,
      withDigitalTv: stats.withDigitalTv,
      multipleConsoleTypes: stats.multipleConsoleTypes,
      sameEquipmentType: stats.sameEquipmentType,
      sameFamily: stats.sameFamily,
      equipmentTypes: stats.equipmentTypes,
      distinctConsoleCombinations: stats.distinctConsoleCombinations,
      consoleCoverage,
      sampleModels: stats.sampleModels,
    },
  }
}

function detectPairingPatterns(group) {
  const suffixes = Object.keys(group.suffixes)
  const patterns = []

  for (let leftIndex = 0; leftIndex < suffixes.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < suffixes.length; rightIndex += 1) {
      const left = suffixes[leftIndex]
      const right = suffixes[rightIndex]
      const leftBase = suffixBaseNumber(left)
      const rightBase = suffixBaseNumber(right)

      if (leftBase && leftBase === rightBase) {
        const leftNorm = normalizeUpper(left).replace(/\s+/g, '')
        const rightNorm = normalizeUpper(right).replace(/\s+/g, '')

        if (
          (leftNorm === `${leftBase}P` && rightNorm === `${leftBase}SP`)
          || (leftNorm === `${leftBase}SP` && rightNorm === `${leftBase}P`)
          || (leftNorm === `${leftBase} P` && rightNorm.includes(`${leftBase}SP`))
          || (leftNorm.includes(`${leftBase}SP`) && rightNorm === `${leftBase} P`)
        ) {
          patterns.push({
            pattern: `${left} alongside ${right}`,
            type: 'package_tier_pair',
            seriesFamily: group.seriesFamily,
            machineType: group.machineType,
            leftSuffix: left,
            rightSuffix: right,
            leftRows: group.suffixes[left].occurrences,
            rightRows: group.suffixes[right].occurrences,
            note: 'Both package tiers appear in the same series+machine group — likely hardware/package variants, not consoles',
          })
        }

        if (
          (/\bUNITY\b/i.test(left) && !/\bUNITY\b/i.test(right))
          || (/\bUNITY\b/i.test(right) && !/\bUNITY\b/i.test(left))
        ) {
          const withUnity = /\bUNITY\b/i.test(left) ? left : right
          const withoutUnity = /\bUNITY\b/i.test(left) ? right : left
          if (suffixBaseNumber(withUnity) === suffixBaseNumber(withoutUnity)) {
            patterns.push({
              pattern: `${withUnity} alongside ${withoutUnity}`,
              type: 'console_named_suffix_pair',
              seriesFamily: group.seriesFamily,
              machineType: group.machineType,
              leftSuffix: withUnity,
              rightSuffix: withoutUnity,
              leftRows: group.suffixes[withUnity].occurrences,
              rightRows: group.suffixes[withoutUnity].occurrences,
              note: 'Unity appears in suffix while base tier also exists — Unity likely console naming, not separate hardware',
            })
          }
        }
      }
    }
  }

  return patterns
}

export function buildTechnogymModelVariantAudit(rows = []) {
  const parsedRows = rows.map((row) => ({
    id: row.id,
    slug: row.slug ?? null,
    parsed: parseTechnogymModel(row),
  }))

  const groupsMap = new Map()

  for (const row of parsedRows) {
    const { seriesFamily, machineType } = row.parsed
    const groupKey = `${seriesFamily}|||${machineType}`

    if (!groupsMap.has(groupKey)) {
      groupsMap.set(groupKey, {
        seriesFamily,
        machineType,
        rows: [],
        suffixes: {},
      })
    }

    const group = groupsMap.get(groupKey)
    group.rows.push(row)

    const suffix = normalizeSuffixKey(row.parsed.modelSuffix)
    if (!group.suffixes[suffix]) {
      group.suffixes[suffix] = []
    }
    group.suffixes[suffix].push(row)
  }

  const groups = []

  for (const group of groupsMap.values()) {
    const suffixStats = {}
    for (const [suffix, suffixRows] of Object.entries(group.suffixes)) {
      suffixStats[suffix] = buildSuffixStats(suffixRows)
    }

    const classifiedSuffixes = Object.keys(suffixStats)
      .sort((left, right) => suffixStats[right].occurrences - suffixStats[left].occurrences)
      .map((suffix) => classifySuffix(suffix, { ...group, suffixes: suffixStats }))

    const pairingPatterns = detectPairingPatterns({ ...group, suffixes: suffixStats })

    groups.push({
      seriesFamily: group.seriesFamily,
      machineType: group.machineType,
      rowCount: group.rows.length,
      suffixes: classifiedSuffixes,
      pairingPatterns,
    })
  }

  groups.sort((left, right) => right.rowCount - left.rowCount)

  const allClassified = groups.flatMap((group) => group.suffixes)
  const summary = {
    total_rows: parsedRows.length,
    total_groups: groups.length,
    distinct_suffixes: allClassified.length,
    likely_console_package: allClassified.filter((item) => item.classification === 'likely_console_package').length,
    likely_hardware_revision: allClassified.filter((item) => item.classification === 'likely_hardware_revision').length,
    likely_physical_model: allClassified.filter((item) => item.classification === 'likely_physical_model').length,
    unknown: allClassified.filter((item) => item.classification === 'unknown').length,
    pairing_patterns: groups.reduce((sum, group) => sum + group.pairingPatterns.length, 0),
  }

  const recommendations = buildRecommendations(groups, summary)

  return {
    generated_at: new Date().toISOString(),
    summary,
    recommendations,
    groups,
    rows: parsedRows.map((row) => ({
      id: row.id,
      slug: row.slug,
      ...row.parsed,
    })),
  }
}

function buildRecommendations(groups, summary) {
  const possibleConsoleSuffixes = []
  const possibleHardwareSuffixes = []
  const groupingChanges = []

  for (const group of groups) {
    for (const suffix of group.suffixes) {
      if (suffix.classification === 'likely_console_package') {
        possibleConsoleSuffixes.push({
          seriesFamily: group.seriesFamily,
          machineType: group.machineType,
          suffix: suffix.suffix,
          confidence: suffix.confidence,
          occurrences: suffix.stats.occurrences,
          reason: suffix.reasons[0] ?? null,
        })
      }
      if (suffix.classification === 'likely_hardware_revision') {
        possibleHardwareSuffixes.push({
          seriesFamily: group.seriesFamily,
          machineType: group.machineType,
          suffix: suffix.suffix,
          confidence: suffix.confidence,
          occurrences: suffix.stats.occurrences,
          reason: suffix.reasons[0] ?? null,
        })
      }
    }

    const hardwareBases = new Set(
      group.suffixes
        .filter((item) => item.classification === 'likely_hardware_revision')
        .map((item) => suffixBaseNumber(item.suffix))
        .filter(Boolean),
    )

    if (hardwareBases.size >= 2 && group.rowCount >= 10) {
      groupingChanges.push({
        seriesFamily: group.seriesFamily,
        machineType: group.machineType,
        recommendation: 'Keep hardware tiers separate; collapse console tokens only',
        hardwareTiers: [...hardwareBases].sort(),
        confidence: 'medium',
        rowCount: group.rowCount,
      })
    }

    const consoleSuffixes = group.suffixes.filter((item) => item.classification === 'likely_console_package')
    if (consoleSuffixes.length >= 2 && group.rowCount >= 8) {
      groupingChanges.push({
        seriesFamily: group.seriesFamily,
        machineType: group.machineType,
        recommendation: 'Collapse console-named suffixes into base hardware tier',
        suffixes: consoleSuffixes.map((item) => item.suffix),
        confidence: 'medium',
        rowCount: group.rowCount,
      })
    }
  }

  return {
    possible_console_suffixes: possibleConsoleSuffixes
      .sort((left, right) => right.occurrences - left.occurrences)
      .slice(0, 100),
    possible_hardware_suffixes: possibleHardwareSuffixes
      .sort((left, right) => right.occurrences - left.occurrences)
      .slice(0, 100),
    recommended_grouping_changes: groupingChanges
      .sort((left, right) => right.rowCount - left.rowCount)
      .slice(0, 50),
    notes: [
      'Unity/Connect/Live/Visio/LED/TV tokens in suffix or trailing position are likely console variants when a shorter numeric base exists in the same series+machine group.',
      'P/SP/CE package tiers (e.g. 1000 P vs 1000 SP) likely represent hardware/package revisions — keep separate until dealer documentation confirms.',
      'Do not merge different numeric bases (500/700/1000/900) without additional evidence.',
      summary.pairing_patterns > 0
        ? `${summary.pairing_patterns} pairing patterns detected — review pairingPatterns in each group.`
        : 'No strong pairing patterns detected.',
    ],
  }
}

export function renderTechnogymModelVariantReport(audit) {
  const lines = []

  lines.push('# Technogym Model Variant Audit')
  lines.push('')
  lines.push(`Generated: ${audit.generated_at}`)
  lines.push('')
  lines.push('## Summary')
  lines.push('')
  lines.push(`| Metric | Count |`)
  lines.push(`| --- | ---: |`)
  lines.push(`| Total Technogym rows | ${audit.summary.total_rows} |`)
  lines.push(`| Series + machine groups | ${audit.summary.total_groups} |`)
  lines.push(`| Distinct suffixes | ${audit.summary.distinct_suffixes} |`)
  lines.push(`| Likely console/package | ${audit.summary.likely_console_package} |`)
  lines.push(`| Likely hardware revision | ${audit.summary.likely_hardware_revision} |`)
  lines.push(`| Likely physical model | ${audit.summary.likely_physical_model} |`)
  lines.push(`| Unknown | ${audit.summary.unknown} |`)
  lines.push(`| Pairing patterns | ${audit.summary.pairing_patterns} |`)
  lines.push('')

  lines.push('## Possible Console Suffixes')
  lines.push('')
  if (!audit.recommendations.possible_console_suffixes.length) {
    lines.push('_None identified with confidence._')
  } else {
    for (const item of audit.recommendations.possible_console_suffixes.slice(0, 30)) {
      lines.push(`- **${item.seriesFamily} / ${item.machineType} / ${item.suffix}** (${item.occurrences} rows, ${item.confidence}) — ${item.reason}`)
    }
  }
  lines.push('')

  lines.push('## Possible Hardware Suffixes')
  lines.push('')
  if (!audit.recommendations.possible_hardware_suffixes.length) {
    lines.push('_None identified with confidence._')
  } else {
    for (const item of audit.recommendations.possible_hardware_suffixes.slice(0, 30)) {
      lines.push(`- **${item.seriesFamily} / ${item.machineType} / ${item.suffix}** (${item.occurrences} rows, ${item.confidence}) — ${item.reason}`)
    }
  }
  lines.push('')

  lines.push('## Recommended Grouping Changes (evidence only — not applied)')
  lines.push('')
  for (const item of audit.recommendations.recommended_grouping_changes.slice(0, 20)) {
    lines.push(`### ${item.seriesFamily} — ${item.machineType}`)
    lines.push(`- ${item.recommendation}`)
    lines.push(`- Confidence: ${item.confidence}`)
    lines.push(`- Rows in group: ${item.rowCount}`)
    if (item.hardwareTiers) lines.push(`- Hardware tiers: ${item.hardwareTiers.join(', ')}`)
    if (item.suffixes) lines.push(`- Console suffixes: ${item.suffixes.join(', ')}`)
    lines.push('')
  }

  lines.push('## Notes')
  lines.push('')
  for (const note of audit.recommendations.notes) {
    lines.push(`- ${note}`)
  }
  lines.push('')

  lines.push('## Groups (series + machine type)')
  lines.push('')

  for (const group of audit.groups.slice(0, 40)) {
    lines.push(`### ${group.seriesFamily}`)
    lines.push(`**${group.machineType}**`)
    lines.push('')
    lines.push(`Rows: ${group.rowCount}`)
    lines.push('')
    lines.push('Suffixes:')
    lines.push('')
    for (const suffix of group.suffixes) {
      lines.push(`- \`${suffix.suffix}\` — ${suffix.stats.occurrences} rows — **${suffix.classification}** (${suffix.confidence})`)
      lines.push(`  - Unity: ${suffix.stats.withUnity}, Live: ${suffix.stats.withLive}, Connect: ${suffix.stats.withConnect}, LED: ${suffix.stats.withLed}, TV: ${suffix.stats.withTv}, Visio: ${suffix.stats.withVisio}`)
      if (suffix.reasons.length) lines.push(`  - ${suffix.reasons.join('; ')}`)
    }
    lines.push('')

    if (group.pairingPatterns.length) {
      lines.push('Pairing patterns:')
      for (const pattern of group.pairingPatterns) {
        lines.push(`- ${pattern.pattern}: ${pattern.note}`)
      }
      lines.push('')
    }
  }

  if (audit.groups.length > 40) {
    lines.push(`_…and ${audit.groups.length - 40} more groups in JSON output._`)
  }

  return `${lines.join('\n')}\n`
}
