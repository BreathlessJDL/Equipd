/**
 * Technogym-only grouping: strip package/console suffixes from model identity.
 * Hardware tiers (500/600/700/900/1000) remain separate canonical products.
 */

import { parseTechnogymModel } from './technogymModelVariantAudit.js'

function formatTechnogymVariantLabel(raw) {
  const parts = normalizeWhitespace(raw).split(/\s+/).filter(Boolean)
  return parts.map((part) => {
    const upper = part.toUpperCase()
    if (['P', 'SP', 'CE', 'IFI', 'LED', 'TV', 'XR', 'XER', 'XIR', 'XUR'].includes(upper)) return upper
    if (/^LIVE\s+\d+$/i.test(part)) return `Live ${part.split(/\s+/)[1]}`
    return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()
  }).join(' ')
}

const TECHNOGYM_HARDWARE_TIERS = new Set(['500', '600', '700', '900', '1000'])

const TECHNOGYM_TRAILING_VARIANTS = [
  { pattern: /\s+DIGITAL\s+TV\s*$/i, label: 'Digital TV', requiresHardwareTier: true, allowPackageContext: true },
  { pattern: /\s+VISIO\s+WEB\s*$/i, label: 'Visio Web', requiresHardwareTier: true, allowPackageContext: true },
  { pattern: /\s+LIVE\s+22\s*$/i, label: 'Live 22', requiresHardwareTier: true, allowPackageContext: true },
  { pattern: /\s+LIVE\s+19\s*$/i, label: 'Live 19', requiresHardwareTier: true, allowPackageContext: true },
  { pattern: /\s+LIVE\s+16\s*$/i, label: 'Live 16', requiresHardwareTier: true, allowPackageContext: true },
  { pattern: /\s+LIVE\s+15\s*$/i, label: 'Live 15', requiresHardwareTier: true, allowPackageContext: true },
  { pattern: /\s+LIVE\s+12\s*$/i, label: 'Live 12', requiresHardwareTier: true, allowPackageContext: true },
  { pattern: /\s+LIVE\s+10\s*$/i, label: 'Live 10', requiresHardwareTier: true, allowPackageContext: true },
  { pattern: /\s+UNITY\s*$/i, label: 'Unity', requiresHardwareTier: true, allowPackageContext: true },
  { pattern: /\s+CONNECT\s*$/i, label: 'Connect', requiresHardwareTier: true, allowPackageContext: true },
  { pattern: /\s+VISIO\s*$/i, label: 'Visio', requiresHardwareTier: true, allowPackageContext: true },
  { pattern: /\s+SP\s*$/i, label: 'SP', requiresHardwareTier: true, allowPackageContext: false },
  { pattern: /\s+CE\s*$/i, label: 'CE', requiresHardwareTier: true, allowPackageContext: false },
  { pattern: /\s+IFI\s*$/i, label: 'IFI', requiresHardwareTier: true, allowPackageContext: false },
  { pattern: /\s+LED\s*$/i, label: 'LED', requiresHardwareTier: true, allowPackageContext: true },
  { pattern: /\s+TV\s*$/i, label: 'TV', requiresHardwareTier: true, allowPackageContext: true },
  { pattern: /\s+P\s*$/i, label: 'P', requiresHardwareTier: true, allowPackageContext: false },
]

function normalizeWhitespace(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim()
}

function stripModelYearRange(model) {
  return normalizeWhitespace(
    String(model ?? '').replace(/\(\s*\d{4}\s*[-–]\d{4}\s*\)/gi, ''),
  )
}

export function isTechnogymBrand(brand) {
  return normalizeWhitespace(brand).toLowerCase() === 'technogym'
}

function hasTrailingHardwareTier(modelText) {
  return /\b(500|600|700|900|1000)(?:I)?\s*$/i.test(normalizeWhitespace(modelText))
}

function hasTechnogymConsoleStripContext(modelText) {
  return /\b(500|600|700|900|1000)(?:I)?(?:\s+(?:P|SP|CE|IFI))?\s*$/i.test(normalizeWhitespace(modelText))
}

function stripParentheticalTechnogymVariants(modelUpper) {
  const consoles = []
  const remainder = modelUpper.replace(/\s*\(([^)]+)\)/g, (match, inner) => {
    const normalized = normalizeWhitespace(inner).toUpperCase()
    const mapped = normalized === 'OLD TV VERSION' ? 'TV' : normalized
    if (/^(LED|TV|UNITY|CONNECT|VISIO|IFI|WEB|DIGITAL TV)$/i.test(mapped)) {
      consoles.push(formatTechnogymVariantLabel(mapped))
      return ''
    }
    return match
  })
  return { remainder: normalizeWhitespace(remainder), consoles }
}

function normalizeGluedTechnogymPackageTokens(modelText) {
  return normalizeWhitespace(
    modelText
      .replace(/\b(\d{3,4})SP\b/gi, '$1 SP')
      .replace(/\b(\d{3,4})P\b/gi, '$1 P')
      .replace(/\b(\d{3,4})CE\b/gi, '$1 CE'),
  )
}

export function stripTechnogymNonPricingVariants(
  modelText,
  { existingVariantName = null } = {},
) {
  let model = normalizeGluedTechnogymPackageTokens(stripModelYearRange(modelText))
  const detectedParts = []

  const parenthetical = stripParentheticalTechnogymVariants(model.toUpperCase())
  model = parenthetical.remainder
  detectedParts.push(...parenthetical.consoles)

  let changed = true
  while (changed && model) {
    changed = false
    for (const entry of TECHNOGYM_TRAILING_VARIANTS) {
      if (!entry.pattern.test(model)) continue

      const stripped = normalizeWhitespace(model.replace(entry.pattern, ''))
      if (!stripped) continue

      if (entry.requiresHardwareTier) {
        const contextOk = entry.allowPackageContext
          ? hasTechnogymConsoleStripContext(stripped)
          : hasTrailingHardwareTier(stripped)
        if (!contextOk) continue
      }

      model = stripped
      detectedParts.unshift(entry.label)
      changed = true
      break
    }
  }

  const variantParts = [
    ...(existingVariantName ? [existingVariantName] : []),
    ...detectedParts,
  ]

  const variantName = variantParts.length > 0
    ? formatTechnogymVariantLabel(variantParts.join(' '))
    : null

  return {
    coreModel: model || stripModelYearRange(modelText),
    variantType: variantName ? 'console' : null,
    variantName,
    variantSource: variantName ? 'model' : null,
    strippedVariants: detectedParts,
  }
}

export function extractTechnogymHardwareTier(modelText) {
  const match = normalizeWhitespace(modelText).match(/\b(500|600|700|900|1000)(?:I)?\b/i)
  return match ? match[1] : null
}

export function isTechnogymHardwareTierToken(token) {
  return TECHNOGYM_HARDWARE_TIERS.has(String(token ?? ''))
}

const TECHNOGYM_SERIES_LABELS = [
  { pattern: /^ELEMENT\s*\+/i, label: 'Element+' },
  { pattern: /^PURE\s+STRENGTH/i, label: 'Pure Strength' },
  { pattern: /^EXCITE\s*\+/i, label: 'Excite' },
  { pattern: /^EXCITE/i, label: 'Excite' },
  { pattern: /^ARTIS/i, label: 'Artis' },
  { pattern: /^PERSONAL/i, label: 'Personal' },
  { pattern: /^STRENGTH/i, label: 'Strength' },
  { pattern: /^DUMBBELL/i, label: 'Dumbbells' },
  { pattern: /^SKILL\s*LINE/i, label: 'Skill Line' },
  { pattern: /^FORMA/i, label: 'Forma' },
  { pattern: /^UNITY/i, label: 'Unity' },
]

function titleCaseWords(value) {
  return normalizeWhitespace(value)
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ')
}

function stripSeriesYear(value) {
  return normalizeWhitespace(
    String(value ?? '')
      .replace(/\(\s*\d{4}[^)]*\)/g, '')
      .replace(/\b20\d{2}\b/g, ''),
  )
}

export function extractTechnogymSeriesLabel(seriesField, modelLine = null) {
  const raw = stripSeriesYear(seriesField)
  if (raw) {
    for (const entry of TECHNOGYM_SERIES_LABELS) {
      if (entry.pattern.test(raw)) return entry.label
    }

    const beforePlus = raw.split('+')[0].trim()
    if (beforePlus) return titleCaseWords(beforePlus)
  }

  if (modelLine) {
    if (modelLine.toUpperCase() === 'EXCITE') return 'Excite'
    return titleCaseWords(modelLine)
  }

  return null
}

function extractTechnogymMachineLabel(parsed) {
  if (parsed?.parseConfidence !== 'low' && parsed?.machineType) {
    const knownMachine = normalizeWhitespace(parsed.machineType)
    if (knownMachine && knownMachine.toUpperCase() !== 'OTHER') {
      return titleCaseWords(knownMachine)
    }
  }

  let suffix = normalizeWhitespace(parsed?.modelSuffix)
  if (!suffix || suffix === '—') return null

  suffix = suffix
    .replace(/\bEXCITE\b/gi, '')
    .replace(/\b(500|600|700|900|1000)i?\b/gi, '')
    .replace(/\b(P|SP|CE|IFI|UL)\b/gi, '')
    .replace(/\b(UNITY|CONNECT|VISIO(?:\s+WEB)?|DIGITAL\s+TV|LED|TV|LIVE(?:\s+\d+)?|UNITY\s+MINI)\b/gi, '')
    .replace(/\s*\([^)]*\)/g, '')
    .trim()

  return suffix ? titleCaseWords(suffix) : null
}

export function extractTechnogymHardwareTierForName(modelText) {
  const match = normalizeWhitespace(modelText).match(/\b(500|600|700|900|1000)(i)?\b/i)
  if (!match) return null
  return match[2] ? `${match[1]}i` : match[1]
}

/**
 * Parse a Technogym row into series, machine, hardware tier, and variant slots.
 * Variant is excluded from the canonical product name.
 */
export function parseTechnogymCanonicalIdentity({
  series = null,
  model = null,
  coreModel = null,
  equipmentType = null,
} = {}) {
  const modelForParse = coreModel || model
  const parsed = parseTechnogymModel({
    series,
    model: modelForParse,
    equipment_type: equipmentType,
  })

  return {
    series: extractTechnogymSeriesLabel(series ?? parsed.seriesField, parsed.modelLine),
    machine: extractTechnogymMachineLabel(parsed),
    hardwareTier: extractTechnogymHardwareTierForName(modelForParse),
    modelLine: parsed.modelLine,
    rawModel: parsed.rawModel,
  }
}

/**
 * Brand + Series + Machine + Hardware Tier (variants excluded).
 */
export function buildTechnogymCanonicalProductName(brand, input = {}) {
  const identity = input.series !== undefined && input.machine !== undefined
    ? input
    : parseTechnogymCanonicalIdentity(input)

  if (!identity.series || !identity.machine) return null

  return [
    normalizeWhitespace(brand),
    identity.series,
    identity.machine,
    identity.hardwareTier,
  ].filter(Boolean).join(' ')
}
