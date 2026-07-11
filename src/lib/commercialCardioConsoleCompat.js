import { isCardioEquipmentProduct, isSpinBikeIndoorCycleProduct } from './equipmentCardio.js'
import {
  isElevationSeriesCardioProduct,
  isIntegritySeriesCardioProduct,
} from './lifeFitnessCardioSeriesFix.js'

export const LIFE_FITNESS_CONSOLE_IMAGE_BASE = '/equipment-console-images/life-fitness/normalized'

export const LIFE_FITNESS_CONSOLE_IMAGE_FILES = {
  integrityx: 'LF Integrity X console.png',
  discoverse3: 'LF SE3.png',
  integrityc: 'LF Integrity C console.png',
  integritysl: 'LF SL.png',
  discoverse4: 'LF SE4.png',
  discoverse3hd: 'LF SE3HD.webp',
  discoverse: 'LF SE.jpg',
  st: 'LF ST.jpg',
  discoversi: 'LF SI.webp',
  explore: 'LF Explore.jpg',
  achieve: 'achieve.jpg',
  engage: 'engage.jpg',
  inspire: 'inspire.jpg',
}

const LIFE_FITNESS_CONSOLE_IMAGE_ALIASES = {
  se3hd: 'discoverse3hd',
  integrityxconsole: 'integrityx',
  integritycconsole: 'integrityc',
  sl: 'integritysl',
}

export const TECHNOGYM_CONSOLE_IMAGE_BASE = '/equipment-console-images/technogym/normalized'

export const TECHNOGYM_CONSOLE_IMAGE_FILES = {
  led: 'TG LED.jpg',
  lednew: 'TG LED new.jpg',
  visiovisioweb: 'TG Visio Web.png',
  unity: 'TG Unity.jpg',
  unity30: 'TG Unity 3.0.webp',
  artisunity: 'TG Unity Old.jpg',
  live: 'TG Live.webp',
  live10: 'TG Live 10.webp',
  connect: 'TG Connect.png',
}

const TECHNOGYM_CONSOLE_IMAGE_ALIASES = {
  visio: 'visiovisioweb',
  visioweb: 'visiovisioweb',
  unity20: 'unity',
  unity3: 'unity30',
  technogymlive: 'live',
}

export const MATRIX_CONSOLE_IMAGE_BASE = '/equipment-console-images/matrix-fitness/normalized'

export const MATRIX_CONSOLE_IMAGE_FILES = {
  led: 'Matrix LED.webp',
  touch: 'Matrix Touch.png',
  touchxl: 'Matrix Touch XL.png',
}

const MATRIX_CONSOLE_IMAGE_ALIASES = {
  matrixled: 'led',
  matrixtouchconsole: 'touch',
  matrixtouchxlconsole: 'touchxl',
}

export const COMMERCIAL_CARDIO_CONSOLE_GROUPS = {
  life_fitness_elevation: 'Life Fitness Elevation Series',
  life_fitness_integrity: 'Life Fitness Integrity Series',
  life_fitness_silverline: 'Life Fitness Silverline / legacy cardio',
  technogym_older_excite: 'Technogym Excite / Excite+ (2003–2013)',
  technogym_artis: 'Technogym Artis',
  technogym_newer_excite: 'Technogym Excite (2014+)',
  technogym_skill: 'Technogym Skill commercial',
  matrix_commercial: 'Matrix commercial cardio',
}

export const COMMERCIAL_CARDIO_CONSOLE_TEMPLATES = {
  life_fitness_elevation: [
    { console_key: 'discover_si', console_name: 'Discover SI', release_year: 2010, tier: 'mid', modifier_percent: 10, sort_order: 10 },
    { console_key: 'discover_se', console_name: 'Discover SE', release_year: 2012, tier: 'mid', modifier_percent: 15, sort_order: 20 },
    { console_key: 'st', console_name: 'ST', release_year: 2017, retired_year: null, tier: 'mid', modifier_percent: 18, sort_order: 30 },
    { console_key: 'discover_se3', console_name: 'Discover SE3', release_year: 2016, tier: 'mid', modifier_percent: 22, sort_order: 40 },
    { console_key: 'discover_se3hd', console_name: 'Discover SE3HD', release_year: 2017, tier: 'premium', modifier_percent: 26, sort_order: 50 },
    { console_key: 'discover_se4', console_name: 'Discover SE4', release_year: 2022, tier: 'premium', modifier_percent: 30, sort_order: 60 },
  ],
  life_fitness_integrity: [
    { console_key: 'integrity_c', console_name: 'Integrity C', release_year: 2017, tier: 'base', modifier_percent: 0, sort_order: 10 },
    { console_key: 'integrity_sl', console_name: 'Integrity SL', release_year: 2021, tier: 'base', modifier_percent: 0, sort_order: 20 },
    { console_key: 'integrity_x', console_name: 'Integrity X', release_year: 2017, tier: 'mid', modifier_percent: 10, sort_order: 30 },
    { console_key: 'st', console_name: 'ST', release_year: 2017, tier: 'mid', modifier_percent: 18, sort_order: 40 },
    { console_key: 'discover_se3hd', console_name: 'Discover SE3HD', release_year: 2017, tier: 'premium', modifier_percent: 26, sort_order: 50 },
    { console_key: 'discover_se4', console_name: 'Discover SE4', release_year: 2022, tier: 'premium', modifier_percent: 30, sort_order: 60 },
  ],
  life_fitness_silverline: [
    { console_key: 'led', console_name: 'LED', release_year: 2005, tier: 'base', modifier_percent: 0, sort_order: 10 },
    { console_key: 'achieve', console_name: 'Achieve', release_year: 2008, tier: 'base', modifier_percent: 0, sort_order: 20 },
    { console_key: 'inspire', console_name: 'Inspire', release_year: 2008, tier: 'mid', modifier_percent: 6, sort_order: 30 },
    { console_key: 'engage', console_name: 'Engage', release_year: 2008, tier: 'mid', modifier_percent: 10, sort_order: 40 },
  ],
  technogym_older_excite: [
    { console_key: 'led', console_name: 'LED', release_year: 2003, retired_year: null, tier: 'base', modifier_percent: 0, sort_order: 10 },
    { console_key: 'visio_visioweb', console_name: 'Visio / Visioweb', release_year: 2003, retired_year: 2013, tier: 'mid', modifier_percent: 8, sort_order: 20 },
  ],
  technogym_artis: [
    { console_key: 'unity_3_0', console_name: 'UNITY 3.0', release_year: 2014, tier: 'premium', modifier_percent: 20, sort_order: 10 },
    { console_key: 'live', console_name: 'LIVE', release_year: 2019, tier: 'premium', modifier_percent: 24, sort_order: 20 },
    { console_key: 'live_10', console_name: 'LIVE 10', release_year: 2019, tier: 'premium', modifier_percent: 26, sort_order: 30 },
  ],
  technogym_newer_excite: [
    { console_key: 'led', console_name: 'LED', release_year: 2003, retired_year: null, tier: 'base', modifier_percent: 0, sort_order: 10 },
    { console_key: 'unity', console_name: 'UNITY', release_year: 2014, retired_year: null, tier: 'mid', modifier_percent: 15, sort_order: 20 },
  ],
  technogym_skill: [
    { console_key: 'unity', console_name: 'UNITY', release_year: 2016, tier: 'mid', modifier_percent: 15, sort_order: 10 },
    { console_key: 'live', console_name: 'LIVE', release_year: 2019, tier: 'premium', modifier_percent: 24, sort_order: 20 },
    { console_key: 'live_10', console_name: 'LIVE 10', release_year: 2019, tier: 'premium', modifier_percent: 26, sort_order: 30 },
  ],
  matrix_commercial: [
    { console_key: 'led', console_name: 'LED', release_year: 2010, tier: 'base', modifier_percent: 0, sort_order: 10 },
    { console_key: 'touch', console_name: 'Touch', release_year: 2016, tier: 'premium', modifier_percent: 22, sort_order: 20 },
    { console_key: 'touch_xl', console_name: 'Touch XL', release_year: 2019, tier: 'premium', modifier_percent: 28, sort_order: 30 },
  ],
}

function normalizeText(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim()
}

function normalizeKey(value) {
  return normalizeText(value).toLowerCase().replace(/[^a-z0-9]/g, '')
}

export function normalizeCommercialCardioBrandKey(brand) {
  const key = normalizeKey(brand)
  if (key === 'matrixfitness') return 'matrix'
  if (key === 'lifefitness') return 'lifefitness'
  if (key === 'technogym') return 'technogym'
  return key
}

export function isCommercialCardioBrand(brand) {
  const key = normalizeCommercialCardioBrandKey(brand)
  return key === 'lifefitness' || key === 'technogym' || key === 'matrix'
}

function productHaystack(product) {
  return [
    product?.product_family,
    product?.model,
    product?.canonical_product_name,
  ].map(normalizeText).filter(Boolean).join(' ')
}

function matchesPattern(haystack, pattern) {
  return pattern.test(haystack)
}

export function isTechnogymResidentialProduct(product) {
  const haystack = productHaystack(product).toLowerCase()
  return /\b(personal|forma|home gym|myrun)\b/i.test(haystack)
    || /\belement\s*\+\b/i.test(haystack)
}

export function isTechnogymArtisProduct(product) {
  const haystack = productHaystack(product)
  return /\bartis\b/i.test(haystack)
}

export function isTechnogymSkillCommercialProduct(product) {
  const haystack = productHaystack(product)
  if (/\bskill\s*line\b/i.test(haystack) && /\bstrength\b/i.test(haystack)) return false
  return /\bskill(?:run|mill|row|bike|line|strength)?\b/i.test(haystack)
    || /\bskill\b/i.test(haystack)
}

export function isTechnogymOlderExciteProduct(product) {
  const haystack = productHaystack(product)
  return /\bexcite\s*\+\b/i.test(haystack) || /\bexcite\b/i.test(haystack)
}

export function getTechnogymProductEraYear(product) {
  const baseline = Number(product?.baseline_manufacture_year)
  if (Number.isFinite(baseline)) return baseline

  const start = Number(product?.production_start_year)
  if (Number.isFinite(start)) return start

  return null
}

export function isTechnogymNewerExciteProduct(product) {
  if (!isTechnogymOlderExciteProduct(product)) return false
  const eraYear = getTechnogymProductEraYear(product)
  if (eraYear == null) return true
  return eraYear > 2013
}

export function classifyCommercialCardioConsoleGroup(product) {
  if (!product || !isCommercialCardioBrand(product.brand)) return null
  if (!isCardioEquipmentProduct(product)) return null
  if (isSpinBikeIndoorCycleProduct(product)) return null

  const brandKey = normalizeCommercialCardioBrandKey(product.brand)

  if (brandKey === 'lifefitness') {
    if (isElevationSeriesCardioProduct(product)) return 'life_fitness_elevation'
    if (isIntegritySeriesCardioProduct(product)) return 'life_fitness_integrity'
    return 'life_fitness_silverline'
  }

  if (brandKey === 'technogym') {
    if (isTechnogymResidentialProduct(product)) return null
    if (isTechnogymArtisProduct(product)) return 'technogym_artis'
    if (isTechnogymSkillCommercialProduct(product)) return 'technogym_skill'
    if (isTechnogymOlderExciteProduct(product)) {
      return isTechnogymNewerExciteProduct(product)
        ? 'technogym_newer_excite'
        : 'technogym_older_excite'
    }

    const eraYear = getTechnogymProductEraYear(product)
    if (eraYear != null && eraYear > 2013) return 'technogym_newer_excite'
    return 'technogym_older_excite'
  }

  if (brandKey === 'matrix') return 'matrix_commercial'

  return null
}

function normalizeConsoleImageKey(value) {
  return normalizeKey(value).replace(/[^a-z0-9]/g, '')
}

export function resolveLifeFitnessConsoleImageUrl(consoleName) {
  const normalized = normalizeConsoleImageKey(consoleName)
  const mappedKey = LIFE_FITNESS_CONSOLE_IMAGE_ALIASES[normalized] ?? normalized
  const filename = LIFE_FITNESS_CONSOLE_IMAGE_FILES[mappedKey]
  if (!filename) return null
  return `${LIFE_FITNESS_CONSOLE_IMAGE_BASE}/${encodeURI(filename)}`
}

export function resolveTechnogymConsoleImageUrl(consoleName) {
  const normalized = normalizeConsoleImageKey(consoleName)
  const mappedKey = TECHNOGYM_CONSOLE_IMAGE_ALIASES[normalized] ?? normalized
  const filename = TECHNOGYM_CONSOLE_IMAGE_FILES[mappedKey]
  if (!filename) return null
  return `${TECHNOGYM_CONSOLE_IMAGE_BASE}/${encodeURI(filename)}`
}

export function resolveMatrixConsoleImageUrl(consoleName) {
  const normalized = normalizeConsoleImageKey(consoleName)
  const mappedKey = MATRIX_CONSOLE_IMAGE_ALIASES[normalized] ?? normalized
  const filename = MATRIX_CONSOLE_IMAGE_FILES[mappedKey]
  if (!filename) return null
  return `${MATRIX_CONSOLE_IMAGE_BASE}/${encodeURI(filename)}`
}

function isLifeFitnessConsoleGroup(groupKey) {
  return String(groupKey ?? '').startsWith('life_fitness_')
}

function isTechnogymConsoleGroup(groupKey) {
  return String(groupKey ?? '').startsWith('technogym_')
}

function isMatrixConsoleGroup(groupKey) {
  return groupKey === 'matrix_commercial'
}

function resolveConsoleTemplateImageUrl(groupKey, template) {
  if (template.image_url) return template.image_url
  if (isLifeFitnessConsoleGroup(groupKey)) {
    return resolveLifeFitnessConsoleImageUrl(template.console_name)
  }
  if (isTechnogymConsoleGroup(groupKey)) {
    return resolveTechnogymConsoleImageUrl(template.console_name)
  }
  if (isMatrixConsoleGroup(groupKey)) {
    return resolveMatrixConsoleImageUrl(template.console_name)
  }
  return null
}

export function buildConsoleOptionsForGroup(groupKey) {
  const templates = COMMERCIAL_CARDIO_CONSOLE_TEMPLATES[groupKey] ?? []
  return templates.map((template) => ({
    ...template,
    retired_year: template.retired_year ?? null,
    image_url: resolveConsoleTemplateImageUrl(groupKey, template),
    is_active: true,
  }))
}

export function buildTechnogymExciteConsoleOptions() {
  const merged = new Map()
  for (const template of [
    ...COMMERCIAL_CARDIO_CONSOLE_TEMPLATES.technogym_older_excite,
    ...COMMERCIAL_CARDIO_CONSOLE_TEMPLATES.technogym_newer_excite,
  ]) {
    if (!merged.has(template.console_key)) {
      merged.set(template.console_key, template)
    }
  }

  return [...merged.values()]
    .sort((left, right) => Number(left.sort_order ?? 0) - Number(right.sort_order ?? 0))
    .map((template) => ({
      ...template,
      retired_year: template.retired_year ?? null,
      image_url: resolveTechnogymConsoleImageUrl(template.console_name),
      is_active: true,
    }))
}

export function buildConsoleOptionsForProduct(product) {
  if (isSpinBikeIndoorCycleProduct(product)) {
    return { groupKey: null, options: [] }
  }

  const groupKey = classifyCommercialCardioConsoleGroup(product)
  if (!groupKey) return { groupKey: null, options: [] }

  const options = groupKey === 'technogym_older_excite' || groupKey === 'technogym_newer_excite'
    ? buildTechnogymExciteConsoleOptions()
    : buildConsoleOptionsForGroup(groupKey)

  return {
    groupKey,
    groupLabel: COMMERCIAL_CARDIO_CONSOLE_GROUPS[groupKey],
    options,
  }
}

export function buildProductConsoleOptionRows(product) {
  const { groupKey, options } = buildConsoleOptionsForProduct(product)
  if (!product?.id || !groupKey || !options.length) return []

  return options.map((option) => ({
    product_id: product.id,
    console_key: option.console_key,
    console_name: option.console_name,
    release_year: option.release_year,
    retired_year: option.retired_year,
    tier: option.tier,
    modifier_percent: option.modifier_percent,
    image_url: option.image_url,
    sort_order: option.sort_order,
    is_active: option.is_active,
  }))
}
