#!/usr/bin/env node
/**
 * Bulk-approve existing equipment product hero images.
 *
 * Schema note:
 * - Product images live on equipment_products (one hero image per product).
 * - Status values: missing | suggested | approved | rejected | failed
 * - Public pages require image_status === 'approved' and image_url or image_storage_path.
 * - Console images (equipment_consoles) and listing photos are out of scope.
 *
 * Usage:
 *   node scripts/approve-all-product-images.mjs --dry-run
 *   node scripts/approve-all-product-images.mjs --apply
 *   node scripts/approve-all-product-images.mjs --apply --repair-primary
 *   node scripts/approve-all-product-images.mjs --coverage-only
 */

import { createClient } from '@supabase/supabase-js'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  EQUIPMENT_PRODUCT_IMAGE_STATUS,
  productHasDisplayableImage,
} from '../src/lib/equipmentProductImages.js'

const PRODUCT_FIELDS = [
  'id',
  'brand',
  'product_family',
  'model',
  'equipment_type',
  'canonical_product_name',
  'canonical_product_key',
  'status',
  'image_url',
  'image_storage_path',
  'image_source_url',
  'image_source_domain',
  'image_confidence',
  'image_status',
  'image_failure_reason',
  'image_updated_at',
].join(', ')

const APPROVABLE_STATUSES = new Set([
  EQUIPMENT_PRODUCT_IMAGE_STATUS.SUGGESTED,
])

const SKIP_STATUSES = new Set([
  EQUIPMENT_PRODUCT_IMAGE_STATUS.REJECTED,
  EQUIPMENT_PRODUCT_IMAGE_STATUS.FAILED,
  EQUIPMENT_PRODUCT_IMAGE_STATUS.MISSING,
  EQUIPMENT_PRODUCT_IMAGE_STATUS.APPROVED,
])

const PUBLIC_PRODUCT_STATUSES = new Set(['approved'])

function loadEnv() {
  const text = readFileSync(join(process.cwd(), '.env.local'), 'utf8')
  const env = {}
  for (const line of text.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const idx = trimmed.indexOf('=')
    if (idx === -1) continue
    let value = trimmed.slice(idx + 1)
    if (
      (value.startsWith('"') && value.endsWith('"'))
      || (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    env[trimmed.slice(0, idx)] = value
  }
  return env
}

function parseArgs(argv) {
  const args = {
    dryRun: true,
    apply: false,
    repairPrimary: false,
    coverageOnly: false,
  }
  for (let index = 2; index < argv.length; index += 1) {
    const token = argv[index]
    if (token === '--apply') {
      args.apply = true
      args.dryRun = false
    } else if (token === '--dry-run') {
      args.dryRun = true
      args.apply = false
    } else if (token === '--repair-primary') {
      args.repairPrimary = true
    } else if (token === '--coverage-only') {
      args.coverageOnly = true
    }
  }
  return args
}

function hasUsableImageAsset(product) {
  return Boolean(
    String(product?.image_url ?? '').trim()
    || String(product?.image_storage_path ?? '').trim(),
  )
}

function classifyProduct(product) {
  const status = String(product?.image_status ?? EQUIPMENT_PRODUCT_IMAGE_STATUS.MISSING)
  const usable = hasUsableImageAsset(product)

  if (status === EQUIPMENT_PRODUCT_IMAGE_STATUS.APPROVED && usable) {
    return { action: 'already_approved', reason: null }
  }
  if (status === EQUIPMENT_PRODUCT_IMAGE_STATUS.APPROVED && !usable) {
    return { action: 'skip', reason: 'approved_without_asset' }
  }
  if (status === EQUIPMENT_PRODUCT_IMAGE_STATUS.REJECTED) {
    return { action: 'skip', reason: 'rejected' }
  }
  if (status === EQUIPMENT_PRODUCT_IMAGE_STATUS.FAILED) {
    return { action: 'skip', reason: 'failed' }
  }
  if (status === EQUIPMENT_PRODUCT_IMAGE_STATUS.MISSING) {
    return { action: 'skip', reason: 'missing_no_image' }
  }
  if (APPROVABLE_STATUSES.has(status) && usable) {
    return { action: 'approve', reason: null }
  }
  if (APPROVABLE_STATUSES.has(status) && !usable) {
    return { action: 'skip', reason: 'suggested_without_asset' }
  }
  if (usable && status !== EQUIPMENT_PRODUCT_IMAGE_STATUS.APPROVED) {
    // Unknown/legacy review-like status with a usable asset — approve.
    return { action: 'approve', reason: `legacy_status:${status}` }
  }
  return { action: 'skip', reason: `unhandled_status:${status}` }
}

async function fetchAllProducts(supabase) {
  const pageSize = 1000
  const rows = []
  for (let from = 0; ; from += pageSize) {
    const to = from + pageSize - 1
    const { data, error } = await supabase
      .from('equipment_products')
      .select(PRODUCT_FIELDS)
      .order('brand')
      .order('canonical_product_name')
      .range(from, to)
    if (error) throw error
    rows.push(...(data ?? []))
    if (!data?.length || data.length < pageSize) break
  }
  return rows
}

function countBy(items, keyFn) {
  const counts = {}
  for (const item of items) {
    const key = keyFn(item) || '(none)'
    counts[key] = (counts[key] || 0) + 1
  }
  return Object.fromEntries(Object.entries(counts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])))
}

function escapeCsv(value) {
  const text = value == null ? '' : String(value)
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`
  return text
}

function buildCoverage(products) {
  const publicProducts = products.filter((product) => PUBLIC_PRODUCT_STATUSES.has(product.status))
  const rows = publicProducts.map((product) => {
    const hasApproved = productHasDisplayableImage(product)
    const usable = hasUsableImageAsset(product)
    let missingReason = null
    if (!hasApproved) {
      if (!usable) missingReason = 'no_usable_image_asset'
      else if (product.image_status === EQUIPMENT_PRODUCT_IMAGE_STATUS.SUGGESTED) {
        missingReason = 'image_not_approved_suggested'
      } else if (product.image_status === EQUIPMENT_PRODUCT_IMAGE_STATUS.REJECTED) {
        missingReason = 'image_rejected'
      } else if (product.image_status === EQUIPMENT_PRODUCT_IMAGE_STATUS.FAILED) {
        missingReason = 'image_failed'
      } else if (product.image_status === EQUIPMENT_PRODUCT_IMAGE_STATUS.MISSING) {
        missingReason = 'image_status_missing'
      } else {
        missingReason = `image_status_${product.image_status || 'unknown'}`
      }
    }

    return {
      product_id: product.id,
      brand: product.brand,
      series: product.product_family,
      model: product.model,
      equipment_type: product.equipment_type,
      canonical_product_name: product.canonical_product_name,
      canonical_product_key: product.canonical_product_key,
      product_status: product.status,
      image_status: product.image_status,
      approved_image_count: hasApproved ? 1 : 0,
      primary_approved_image_url: hasApproved ? (product.image_url || null) : null,
      primary_approved_image_storage_path: hasApproved ? (product.image_storage_path || null) : null,
      has_approved_image: hasApproved,
      missing_reason: missingReason,
      has_unapproved_candidate: Boolean(usable && !hasApproved),
    }
  })

  const withImage = rows.filter((row) => row.has_approved_image)
  const withoutImage = rows.filter((row) => !row.has_approved_image)
  const coveragePct = rows.length
    ? Math.round((withImage.length / rows.length) * 1000) / 10
    : 0

  return {
    generated_at: new Date().toISOString(),
    scope: 'approved_canonical_products_public',
    totals: {
      total_canonical_products: rows.length,
      products_with_approved_image: withImage.length,
      products_without_approved_image: withoutImage.length,
      coverage_percent: coveragePct,
      products_with_image_but_no_primary: 0,
      note: 'One hero image per equipment_products row; primary is implicit when approved.',
    },
    missing_by_brand: countBy(withoutImage, (row) => row.brand),
    missing_by_category: countBy(withoutImage, (row) => row.equipment_type),
    missing_by_reason: countBy(withoutImage, (row) => row.missing_reason),
    all_products_by_image_status: countBy(products, (row) => row.image_status),
    products: rows,
    missing_products: withoutImage,
  }
}

function writeCoverageReports(coverage) {
  mkdirSync(join(process.cwd(), 'reports'), { recursive: true })
  const jsonPath = join(process.cwd(), 'reports', 'product-image-coverage.json')
  const csvPath = join(process.cwd(), 'reports', 'product-image-coverage.csv')

  writeFileSync(jsonPath, JSON.stringify(coverage, null, 2))

  const columns = [
    'product_id',
    'brand',
    'series',
    'model',
    'equipment_type',
    'canonical_product_name',
    'canonical_product_key',
    'product_status',
    'image_status',
    'approved_image_count',
    'primary_approved_image_url',
    'primary_approved_image_storage_path',
    'has_approved_image',
    'missing_reason',
    'has_unapproved_candidate',
  ]
  const lines = [columns.join(',')]
  for (const row of coverage.products) {
    lines.push(columns.map((column) => escapeCsv(row[column])).join(','))
  }
  writeFileSync(csvPath, `${lines.join('\n')}\n`)

  return { jsonPath, csvPath }
}

async function main() {
  const args = parseArgs(process.argv)
  const env = loadEnv()
  const supabase = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

  console.log(`Product image approval (${args.coverageOnly ? 'coverage-only' : args.apply ? 'APPLY' : 'dry-run'})`)

  const products = await fetchAllProducts(supabase)
  const beforeCounts = countBy(products, (row) => row.image_status)

  const classified = products.map((product) => {
    const decision = classifyProduct(product)
    return { product, ...decision }
  })

  const toApprove = classified.filter((row) => row.action === 'approve')
  const alreadyApproved = classified.filter((row) => row.action === 'already_approved')
  const skipped = classified.filter((row) => row.action === 'skip')
  const skippedByReason = countBy(skipped, (row) => row.reason)

  const repairCandidates = products.filter((product) => (
    product.image_status === EQUIPMENT_PRODUCT_IMAGE_STATUS.APPROVED
    && String(product.image_storage_path ?? '').trim()
    && !String(product.image_url ?? '').trim()
  ))

  const dryRunSummary = {
    generated_at: new Date().toISOString(),
    schema: {
      table: 'equipment_products',
      status_column: 'image_status',
      status_values: ['missing', 'suggested', 'approved', 'rejected', 'failed'],
      public_approved_status: 'approved',
      link: 'image fields live on equipment_products (one hero image per product)',
      primary_image: 'implicit — the product hero image_url / image_storage_path',
      out_of_scope: [
        'equipment_consoles.image_*',
        'listing / marketplace seller photos',
        'brand logos',
        'equipment_intelligence-only images',
      ],
    },
    totals: {
      total_image_records: products.length,
      already_approved: alreadyApproved.length,
      will_change_to_approved: toApprove.length,
      skipped: skipped.length,
      by_current_status: beforeCounts,
      skipped_by_reason: skippedByReason,
      products_with_multiple_images: 0,
      duplicate_image_mappings: 0,
      images_not_linked_to_canonical_product: 0,
      repair_primary_candidates: repairCandidates.length,
      note: 'No separate product_images table; one hero image column set per product.',
    },
    examples_to_update: toApprove.slice(0, 15).map((row) => ({
      id: row.product.id,
      name: row.product.canonical_product_name,
      brand: row.product.brand,
      from_status: row.product.image_status,
      to_status: EQUIPMENT_PRODUCT_IMAGE_STATUS.APPROVED,
      image_url: row.product.image_url,
      image_storage_path: row.product.image_storage_path,
      legacy_reason: row.reason,
    })),
  }

  console.log(JSON.stringify(dryRunSummary.totals, null, 2))

  mkdirSync(join(process.cwd(), 'reports'), { recursive: true })
  const dryRunPath = join(process.cwd(), 'reports', 'approve-all-product-images-dry-run.json')
  writeFileSync(dryRunPath, JSON.stringify(dryRunSummary, null, 2))
  console.log(`Wrote ${dryRunPath}`)

  if (args.coverageOnly) {
    const coverage = buildCoverage(products)
    const paths = writeCoverageReports(coverage)
    console.log(JSON.stringify(coverage.totals, null, 2))
    console.log(`Wrote ${paths.jsonPath}`)
    console.log(`Wrote ${paths.csvPath}`)
    return
  }

  if (!args.apply) {
    console.log('Dry-run complete. Re-run with --apply to write.')
    const coverage = buildCoverage(products)
    const paths = writeCoverageReports(coverage)
    console.log('Pre-apply coverage:', JSON.stringify(coverage.totals, null, 2))
    console.log(`Wrote ${paths.jsonPath}`)
    return
  }

  let updated = 0
  const batchSize = 50
  for (let index = 0; index < toApprove.length; index += batchSize) {
    const batch = toApprove.slice(index, index + batchSize)
    await Promise.all(batch.map(async (row) => {
      const { error } = await supabase
        .from('equipment_products')
        .update({
          image_status: EQUIPMENT_PRODUCT_IMAGE_STATUS.APPROVED,
          image_failure_reason: null,
          image_updated_at: new Date().toISOString(),
        })
        .eq('id', row.product.id)
        .eq('image_status', row.product.image_status)
      if (error) throw error
      updated += 1
    }))
    console.log(`Approved ${Math.min(index + batch.length, toApprove.length)} / ${toApprove.length}`)
  }

  let repairedPrimary = 0
  if (args.repairPrimary && repairCandidates.length) {
    for (const product of repairCandidates) {
      // Primary is implicit; only backfill public image_url from storage path when URL missing.
      const { data: publicUrlData } = supabase.storage
        .from('equipment-product-images')
        .getPublicUrl(product.image_storage_path)
      const publicUrl = publicUrlData?.publicUrl
      if (!publicUrl) continue
      const { error } = await supabase
        .from('equipment_products')
        .update({
          image_url: publicUrl,
          image_updated_at: new Date().toISOString(),
        })
        .eq('id', product.id)
        .is('image_url', null)
      if (error) throw error
      repairedPrimary += 1
    }
  }

  const afterProducts = await fetchAllProducts(supabase)
  const afterCounts = countBy(afterProducts, (row) => row.image_status)
  const coverage = buildCoverage(afterProducts)
  const paths = writeCoverageReports(coverage)

  const applyReport = {
    generated_at: new Date().toISOString(),
    mode: 'apply',
    updated,
    repaired_primary: repairedPrimary,
    before_status_counts: beforeCounts,
    after_status_counts: afterCounts,
    remaining_approvable: afterProducts.filter((product) => classifyProduct(product).action === 'approve').length,
    coverage: coverage.totals,
    missing_by_brand: coverage.missing_by_brand,
    missing_by_category: coverage.missing_by_category,
  }

  const applyPath = join(process.cwd(), 'reports', 'approve-all-product-images-apply.json')
  writeFileSync(applyPath, JSON.stringify(applyReport, null, 2))
  console.log(JSON.stringify(applyReport, null, 2))
  console.log(`Wrote ${applyPath}`)
  console.log(`Wrote ${paths.jsonPath}`)
  console.log(`Wrote ${paths.csvPath}`)
  console.log('Apply complete.')
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
