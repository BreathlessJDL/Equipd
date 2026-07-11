import {
  isLifeFitnessBrand,
  slugifyCoreProductKey,
} from './intelligenceCoreProductGrouping.js'
import { buildSeriesBaselineReviewNote } from './lifeFitnessSeriesBaselines.js'

export const ELEVATION_SERIES_LABEL = 'Elevation Series'
export const INTEGRITY_SERIES_LABEL = 'Integrity Series'
export const ELEVATION_SERIES_BASELINE_YEAR = 2010
export const INTEGRITY_SERIES_BASELINE_YEAR = 2017

const CARDIO_EQUIPMENT_TYPES = new Set([
  'treadmill',
  'cross trainer',
  'exercise bike',
  'recumbent bike',
  'stepper',
  'stepper/stair climber',
  'elliptical',
  'upright bike',
])

const CARDIO_MODEL_KEYS = new Set([
  'crosstrainer',
  'treadmill',
  'powermill',
  'flexstrider',
  'summittrainer',
  'recumbent',
  'recumbentbike',
  'uprightbike',
  'stepper',
  'bike',
])

const IMAGE_FIELDS = [
  'image_url',
  'image_storage_path',
  'image_source_url',
  'image_source_domain',
  'image_confidence',
  'image_status',
  'image_failure_reason',
  'image_updated_at',
]

function normalizeText(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim()
}

function normalizeKey(value) {
  return normalizeText(value).toLowerCase().replace(/[^a-z0-9]/g, '')
}

function stripLifecycleSuffix(value) {
  return normalizeText(value).replace(/\s*\(\s*\d{4}[^)]*\)\s*$/i, '').trim()
}

export function normalizeCardioModelKey(product) {
  const model = stripLifecycleSuffix(product?.model)
  const key = normalizeKey(model)
  if (key === 'recumbent') return 'recumbentbike'
  if (key === 'bike' && normalizeKey(product?.equipment_type) === 'exercisebike') return 'uprightbike'
  return key
}

export function isLifeFitnessCardioProduct(product) {
  if (!isLifeFitnessBrand(product?.brand)) return false

  const equipmentType = normalizeKey(product?.equipment_type)
  if (equipmentType && CARDIO_EQUIPMENT_TYPES.has(equipmentType)) return true

  const modelKey = normalizeCardioModelKey(product)
  return CARDIO_MODEL_KEYS.has(modelKey)
}

export function isDiscoverSeriesCardioProduct(product) {
  if (!isLifeFitnessCardioProduct(product)) return false

  const family = normalizeKey(product?.product_family)
  if (family === 'discover' || family === 'discoverseries') return true

  const name = normalizeText(product?.canonical_product_name)
  return /^life fitness discover\b/i.test(name)
}

export function isElevationSeriesCardioProduct(product) {
  if (!isLifeFitnessCardioProduct(product)) return false

  const family = normalizeText(product?.product_family).toLowerCase()
  if (family === 'elevation series' || family === 'elevation') return true
  if (family.startsWith('elevation -')) return false
  return /\blife fitness elevation\b/i.test(product?.canonical_product_name ?? '')
    && !/\bdiscover\b/i.test(product?.canonical_product_name ?? '')
}

export function isIntegritySeriesCardioProduct(product) {
  if (!isLifeFitnessCardioProduct(product)) return false

  const family = normalizeText(product?.product_family).toLowerCase()
  if (family === 'integrity series' || family === 'integrity') return true
  return /\bintegrity series\b/i.test(product?.canonical_product_name ?? '')
}

export function isElevationConsoleSplitProduct(product) {
  const family = normalizeText(product?.product_family).toLowerCase()
  return family.startsWith('elevation -')
}

export function isLifecycleDuplicateProduct(product) {
  return /\(\s*\d{4}/.test(product?.canonical_product_name ?? '')
    || /\(\s*\d{4}/.test(product?.model ?? '')
}

function hasUsableImage(product) {
  const status = normalizeKey(product?.image_status)
  if (status === 'approved') return true
  return status === 'suggested' && Boolean(product?.image_url)
}

function keeperNeedsImage(keeper) {
  return !hasUsableImage(keeper)
}

export function buildImageTransferPatch(keeper, donor) {
  if (!keeperNeedsImage(keeper) || !hasUsableImage(donor)) return null

  const patch = {}
  for (const field of IMAGE_FIELDS) {
    if (donor?.[field] != null && donor[field] !== '') {
      patch[field] = donor[field]
    }
  }
  return Object.keys(patch).length ? patch : null
}

export function coalescePriceFields(keeper, donor) {
  if (keeper?.original_base_price == null && donor?.original_base_price != null) {
    return {
      original_base_price: donor.original_base_price,
      original_base_price_currency: donor.original_base_price_currency ?? keeper?.original_base_price_currency ?? 'GBP',
      original_price_confidence: donor.original_price_confidence ?? keeper?.original_price_confidence ?? null,
      original_price_source: donor.original_price_source ?? keeper?.original_price_source ?? null,
    }
  }

  if (
    keeper?.original_base_price != null
    && donor?.original_base_price != null
    && keeper.original_base_price !== donor.original_base_price
  ) {
    const keeperConfidence = Number(keeper.original_price_confidence ?? 0)
    const donorConfidence = Number(donor.original_price_confidence ?? 0)
    if (donorConfidence > keeperConfidence) {
      return {
        original_base_price: donor.original_base_price,
        original_base_price_currency: donor.original_base_price_currency ?? keeper.original_base_price_currency ?? 'GBP',
        original_price_confidence: donor.original_price_confidence ?? null,
        original_price_source: donor.original_price_source ?? keeper.original_price_source ?? null,
      }
    }
  }

  return {}
}

export function buildElevationSeriesIdentity(product) {
  const model = stripLifecycleSuffix(product?.model)
  const equipmentType = product?.equipment_type ?? null
  const canonicalProductName = `Life Fitness ${ELEVATION_SERIES_LABEL} ${model}`

  return {
    product_family: ELEVATION_SERIES_LABEL,
    model,
    canonical_product_name: canonicalProductName,
    canonical_product_key: slugifyCoreProductKey(
      product?.brand ?? 'Life Fitness',
      equipmentType,
      ELEVATION_SERIES_LABEL,
      model,
    ),
  }
}

export function buildElevationSeriesStandardization(product) {
  const model = stripLifecycleSuffix(product?.model)
  let canonicalProductName = normalizeText(product?.canonical_product_name)
  if (!/\belevation series\b/i.test(canonicalProductName)) {
    canonicalProductName = canonicalProductName.replace(
      /\bLife Fitness Elevation\b/i,
      `Life Fitness ${ELEVATION_SERIES_LABEL}`,
    )
  }

  return {
    product_family: ELEVATION_SERIES_LABEL,
    model,
    canonical_product_name: canonicalProductName,
  }
}

function pickKeeper(products = []) {
  return [...products].sort((left, right) => {
    if (left.status === 'approved' && right.status !== 'approved') return -1
    if (right.status === 'approved' && left.status !== 'approved') return 1
    if (isLifecycleDuplicateProduct(left) && !isLifecycleDuplicateProduct(right)) return 1
    if (isLifecycleDuplicateProduct(right) && !isLifecycleDuplicateProduct(left)) return -1
    const leftSources = left.source_intelligence_row_ids?.length ?? 0
    const rightSources = right.source_intelligence_row_ids?.length ?? 0
    if (leftSources !== rightSources) return rightSources - leftSources
    if (hasUsableImage(left) && !hasUsableImage(right)) return -1
    if (hasUsableImage(right) && !hasUsableImage(left)) return 1
    if (left.original_base_price != null && right.original_base_price == null) return -1
    if (right.original_base_price != null && left.original_base_price == null) return 1
    return String(left.canonical_product_name).localeCompare(String(right.canonical_product_name))
  })[0]
}

function uniqueIds(ids = []) {
  return [...new Set(ids.filter(Boolean))]
}

function appendReviewNote(existingNotes, note) {
  const text = normalizeText(existingNotes)
  if (!text) return note
  if (text.includes(note)) return text
  return `${text}\n${note}`
}

function buildArchiveNote(targetName, targetId) {
  return `Obsolete Discover Series cardio row merged into ${targetName} (${targetId}).`
}

function groupByModelKey(products = []) {
  const map = new Map()
  for (const product of products) {
    const modelKey = normalizeCardioModelKey(product)
    if (!map.has(modelKey)) map.set(modelKey, [])
    map.get(modelKey).push(product)
  }
  return map
}

function buildClusterMerge(cluster, { notePrefix }) {
  if (cluster.length <= 1) return null

  const keeper = pickKeeper(cluster)
  const duplicates = cluster.filter((product) => product.id !== keeper.id)
  if (!duplicates.length) return null

  const imageDonor = duplicates.find((product) => hasUsableImage(product))
  const imagePatch = imageDonor ? buildImageTransferPatch(keeper, imageDonor) : null
  const priceDonor = duplicates.find((product) => product.original_base_price != null)
  const pricePatch = priceDonor ? coalescePriceFields(keeper, priceDonor) : {}
  const mergedSourceIds = uniqueIds(cluster.flatMap((product) => product.source_intelligence_row_ids ?? []))

  return {
    action: 'merge',
    keeper,
    duplicate: duplicates[0],
    duplicates,
    modelKey: normalizeCardioModelKey(keeper),
    mergedSourceIds,
    imagePatch,
    keeperUpdate: {
      ...pricePatch,
      ...imagePatch,
      model: stripLifecycleSuffix(keeper.model),
      source_intelligence_row_ids: mergedSourceIds,
      review_notes: appendReviewNote(
        keeper.review_notes,
        `${notePrefix} ${duplicates.map((product) => product.canonical_product_name).join(', ')}.`,
      ),
    },
    duplicateUpdate: {
      status: 'excluded',
      review_notes: buildArchiveNote(keeper.canonical_product_name, keeper.id),
    },
  }
}

function buildBaselineUpdate(product, seriesLabel, proposedBaseline) {
  if (product.baseline_manufacture_year === proposedBaseline) return null
  return {
    product,
    seriesLabel,
    currentBaseline: product.baseline_manufacture_year ?? null,
    proposedBaseline,
    update: {
      baseline_manufacture_year: proposedBaseline,
      review_notes: appendReviewNote(
        product.review_notes,
        buildSeriesBaselineReviewNote(seriesLabel, proposedBaseline),
      ),
    },
  }
}

export function buildLifeFitnessCardioSeriesFixPlan(products = []) {
  const discoverRows = products.filter(isDiscoverSeriesCardioProduct)
  const elevationRows = products.filter(isElevationSeriesCardioProduct)
  const integrityRows = products.filter(isIntegritySeriesCardioProduct)
  const elevationConsoleSplits = products.filter(isElevationConsoleSplitProduct)

  const merges = []
  const renames = []
  const archives = []
  const baselineUpdates = []
  const imagePreservations = []
  const standardizations = []
  const archivedIds = new Set()

  const elevationByModel = groupByModelKey(elevationRows)

  for (const discover of discoverRows) {
    const modelKey = normalizeCardioModelKey(discover)
    const elevationCandidates = (elevationByModel.get(modelKey) ?? [])
      .filter((product) => product.status !== 'excluded')

    if (elevationCandidates.length) {
      const keeper = pickKeeper(elevationCandidates)
      const imagePatch = buildImageTransferPatch(keeper, discover)
      const pricePatch = coalescePriceFields(keeper, discover)
      const mergedSourceIds = uniqueIds([
        ...(keeper.source_intelligence_row_ids ?? []),
        ...(discover.source_intelligence_row_ids ?? []),
      ])

      if (imagePatch) {
        imagePreservations.push({
          fromId: discover.id,
          fromName: discover.canonical_product_name,
          toId: keeper.id,
          toName: keeper.canonical_product_name,
          fields: Object.keys(imagePatch),
        })
      }

      merges.push({
        action: 'merge',
        keeper,
        duplicate: discover,
        duplicates: [discover],
        modelKey,
        mergedSourceIds,
        imagePatch,
        keeperUpdate: {
          ...buildElevationSeriesStandardization(keeper),
          ...pricePatch,
          ...imagePatch,
          source_intelligence_row_ids: mergedSourceIds,
          review_notes: appendReviewNote(
            keeper.review_notes,
            `Merged Discover Series cardio duplicate ${discover.canonical_product_name} (${discover.id}).`,
          ),
        },
        duplicateUpdate: {
          status: 'excluded',
          review_notes: buildArchiveNote(keeper.canonical_product_name, keeper.id),
        },
      })

      archives.push({
        action: 'archive',
        product: discover,
        reason: 'discover_series_duplicate',
        targetId: keeper.id,
        targetName: keeper.canonical_product_name,
      })
      archivedIds.add(discover.id)
      continue
    }

    const target = buildElevationSeriesIdentity(discover)
    renames.push({
      action: 'rename',
      product: discover,
      modelKey,
      target,
      update: {
        ...target,
        review_notes: appendReviewNote(
          discover.review_notes,
          'Renamed from Discover Series cardio row to Elevation Series equipment line.',
        ),
      },
    })

    const baselineUpdate = buildBaselineUpdate(
      { ...discover, ...target, id: discover.id },
      ELEVATION_SERIES_LABEL,
      ELEVATION_SERIES_BASELINE_YEAR,
    )
    if (baselineUpdate) baselineUpdates.push(baselineUpdate)
  }

  for (const cluster of elevationByModel.values()) {
    const activeCluster = cluster.filter((product) => !archivedIds.has(product.id))
    const merge = buildClusterMerge(activeCluster, { notePrefix: 'Merged elevation duplicate' })
    if (!merge) continue
    if (merge.duplicates.every((product) => archivedIds.has(product.id))) continue

    merges.push(merge)
    for (const duplicate of merge.duplicates) {
      archives.push({
        action: 'archive',
        product: duplicate,
        reason: 'elevation_lifecycle_duplicate',
        targetId: merge.keeper.id,
        targetName: merge.keeper.canonical_product_name,
      })
      archivedIds.add(duplicate.id)
    }
    if (merge.imagePatch) {
      imagePreservations.push({
        fromId: merge.duplicates.find((product) => hasUsableImage(product))?.id,
        fromName: merge.duplicates.find((product) => hasUsableImage(product))?.canonical_product_name,
        toId: merge.keeper.id,
        toName: merge.keeper.canonical_product_name,
        fields: Object.keys(merge.imagePatch),
      })
    }
  }

  for (const cluster of groupByModelKey(integrityRows).values()) {
    const merge = buildClusterMerge(cluster, { notePrefix: 'Merged integrity lifecycle duplicate' })
    if (!merge) continue

    merges.push(merge)
    for (const duplicate of merge.duplicates) {
      archives.push({
        action: 'archive',
        product: duplicate,
        reason: 'integrity_lifecycle_duplicate',
        targetId: merge.keeper.id,
        targetName: merge.keeper.canonical_product_name,
      })
      archivedIds.add(duplicate.id)
    }
    if (merge.imagePatch) {
      const donor = merge.duplicates.find((product) => hasUsableImage(product))
      imagePreservations.push({
        fromId: donor?.id,
        fromName: donor?.canonical_product_name,
        toId: merge.keeper.id,
        toName: merge.keeper.canonical_product_name,
        fields: Object.keys(merge.imagePatch),
      })
    }
  }

  for (const product of elevationRows) {
    if (archivedIds.has(product.id)) continue
    const standardization = buildElevationSeriesStandardization(product)
    const needsStandardization = (
      product.product_family !== standardization.product_family
      || product.canonical_product_name !== standardization.canonical_product_name
      || product.model !== standardization.model
    )
    if (needsStandardization) {
      standardizations.push({
        action: 'standardize',
        product,
        update: standardization,
      })
    }
  }

  for (const split of elevationConsoleSplits) {
    if (split.status === 'excluded') continue
    archives.push({
      action: 'archive',
      product: split,
      reason: 'elevation_console_split_not_equipment_series',
      targetId: null,
      targetName: null,
    })
  }

  const baselineSeen = new Set(baselineUpdates.map((entry) => entry.product.id))

  for (const product of products) {
    if (archivedIds.has(product.id)) continue
    if (product.status === 'excluded') continue
    if (isDiscoverSeriesCardioProduct(product)) continue
    if (isElevationConsoleSplitProduct(product)) continue

    if (isElevationSeriesCardioProduct(product)) {
      const update = buildBaselineUpdate(product, ELEVATION_SERIES_LABEL, ELEVATION_SERIES_BASELINE_YEAR)
      if (update && !baselineSeen.has(product.id)) {
        baselineUpdates.push(update)
        baselineSeen.add(product.id)
      }
      continue
    }

    if (isIntegritySeriesCardioProduct(product)) {
      const update = buildBaselineUpdate(product, INTEGRITY_SERIES_LABEL, INTEGRITY_SERIES_BASELINE_YEAR)
      if (update && !baselineSeen.has(product.id)) {
        baselineUpdates.push(update)
        baselineSeen.add(product.id)
      }
    }
  }

  return {
    discoverRowsFound: discoverRows,
    elevationRowsFound: elevationRows,
    integrityRowsFound: integrityRows,
    merges,
    renames,
    archives,
    standardizations,
    baselineUpdates,
    imagePreservations,
    elevationConsoleSplits,
    summary: {
      discoverCount: discoverRows.length,
      elevationCount: elevationRows.length,
      integrityCount: integrityRows.length,
      mergeCount: merges.length,
      renameCount: renames.length,
      archiveCount: archives.length,
      standardizationCount: standardizations.length,
      baselineUpdateCount: baselineUpdates.length,
      imagePreservationCount: imagePreservations.length,
    },
  }
}
