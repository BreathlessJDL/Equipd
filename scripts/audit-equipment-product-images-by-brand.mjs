#!/usr/bin/env node
/**
 * Brand-level audit for approved equipment product images.
 *
 * Usage:
 *   node scripts/audit-equipment-product-images-by-brand.mjs
 *   node scripts/audit-equipment-product-images-by-brand.mjs --brand "Life Fitness" --brand "Technogym"
 *   node scripts/audit-equipment-product-images-by-brand.mjs --image-status all
 *   node scripts/audit-equipment-product-images-by-brand.mjs --repair
 *   node scripts/audit-equipment-product-images-by-brand.mjs --repair --approve-working-hosted
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import {
  EQUIPMENT_PRODUCT_IMAGE_STATUS,
  EQUIPMENT_PRODUCT_IMAGES_BUCKET,
  extractEquipmentProductImageStoragePathFromPublicUrl,
  inferEquipmentProductImageStoragePath,
  isBrowserLoadableImageUrl,
  isSupabaseEquipmentProductImagePublicUrl,
  MISSING_STORAGE_OBJECT_FAILURE_REASON,
  normalizeEquipmentProductImageStoragePath,
  resolveEquipmentProductImageUrl,
} from '../src/lib/equipmentProductImages.js'

const FOCUS_BRANDS = [
  'Life Fitness',
  'Technogym',
  'Matrix Fitness',
  'Precor',
  'Cybex',
]

const PRODUCT_FIELDS = [
  'id',
  'brand',
  'canonical_product_name',
  'canonical_product_key',
  'image_status',
  'image_url',
  'image_storage_path',
  'image_source_domain',
  'image_failure_reason',
  'status',
].join(', ')

function loadEnv() {
  const env = {}
  try {
    const text = readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    for (const line of text.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const idx = trimmed.indexOf('=')
      if (idx === -1) continue
      env[trimmed.slice(0, idx).trim()] = trimmed.slice(idx + 1).trim()
    }
  } catch {
    // optional
  }
  return env
}

function parseArgs(argv) {
  const args = {
    brands: [],
    repair: false,
    approveWorkingHosted: false,
    imageStatus: 'approved',
    jsonOut: null,
    limit: null,
  }

  for (let index = 2; index < argv.length; index += 1) {
    const token = argv[index]
    if (token === '--brand') {
      const value = argv[index + 1]
      if (value) args.brands.push(value)
      index += 1
    } else if (token === '--repair') {
      args.repair = true
    } else if (token === '--approve-working-hosted') {
      args.approveWorkingHosted = true
    } else if (token === '--image-status') {
      args.imageStatus = argv[index + 1] ?? 'approved'
      index += 1
    } else if (token === '--json-out') {
      args.jsonOut = argv[index + 1] ?? null
      index += 1
    } else if (token === '--limit') {
      args.limit = Number(argv[index + 1])
      index += 1
    }
  }

  return args
}

function createClients(env) {
  const supabaseUrl = env.VITE_SUPABASE_URL?.replace(/\/+$/, '').replace(/\/rest\/v1$/i, '')
  const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env.local')
  }

  return {
    supabaseUrl,
    anonClient: createClient(supabaseUrl, supabaseAnonKey),
    adminClient: serviceRoleKey ? createClient(supabaseUrl, serviceRoleKey) : null,
  }
}

async function fetchProducts(client, { brands = [], imageStatus = 'approved', limit = null } = {}) {
  let query = client
    .from('equipment_products')
    .select(PRODUCT_FIELDS)
    .eq('status', 'approved')
    .order('brand')
    .order('canonical_product_name')

  if (imageStatus !== 'all') {
    query = query.eq('image_status', imageStatus)
  } else {
    query = query.neq('image_status', 'missing')
  }

  if (brands.length === 1) {
    query = query.eq('brand', brands[0])
  }

  const { data, error } = await query
  if (error) throw error

  let products = data ?? []
  if (brands.length > 1) {
    const brandSet = new Set(brands.map((brand) => brand.toLowerCase()))
    products = products.filter((product) => brandSet.has(String(product.brand ?? '').toLowerCase()))
  }

  if (Number.isFinite(limit) && limit > 0) {
    products = products.slice(0, limit)
  }

  return products
}

async function fetchBrandImageStatusBreakdown(client, brands) {
  let query = client
    .from('equipment_products')
    .select('brand, image_status')
    .eq('status', 'approved')

  if (brands.length === 1) {
    query = query.eq('brand', brands[0])
  }

  const { data, error } = await query
  if (error) throw error

  const rows = (data ?? []).filter((row) => (
    !brands.length || brands.some((brand) => brand.toLowerCase() === String(row.brand ?? '').toLowerCase())
  ))

  const byBrand = new Map()
  for (const row of rows) {
    const brand = row.brand || 'Unknown'
    if (!byBrand.has(brand)) byBrand.set(brand, { total: 0, byStatus: {} })
    const entry = byBrand.get(brand)
    entry.total += 1
    entry.byStatus[row.image_status] = (entry.byStatus[row.image_status] ?? 0) + 1
  }

  return [...byBrand.entries()]
    .map(([brand, summary]) => ({ brand, ...summary }))
    .sort((left, right) => left.brand.localeCompare(right.brand))
}

function hasImageAsset(product) {
  const imageUrl = String(product?.image_url ?? '').trim()
  const storagePath = normalizeEquipmentProductImageStoragePath(product?.image_storage_path)
  return Boolean(imageUrl || storagePath)
}

function resolveAuditableImageUrl(product, supabase) {
  if (product?.image_status === EQUIPMENT_PRODUCT_IMAGE_STATUS.APPROVED) {
    return resolveEquipmentProductImageUrl(product, supabase)
  }

  if (!hasImageAsset(product)) return null

  return resolveEquipmentProductImageUrl(
    { ...product, image_status: EQUIPMENT_PRODUCT_IMAGE_STATUS.APPROVED },
    supabase,
  )
}

async function headResolvedUrl(url) {
  try {
    const response = await fetch(url, {
      method: 'HEAD',
      redirect: 'follow',
      signal: AbortSignal.timeout(15_000),
    })

    return {
      ok: response.ok,
      status: response.status,
      contentType: response.headers.get('content-type'),
    }
  } catch (error) {
    return {
      ok: false,
      status: null,
      contentType: null,
      error: error?.message ?? 'head_failed',
    }
  }
}

async function storageObjectExists(adminClient, storagePath) {
  if (!adminClient || !storagePath) return null

  const normalizedPath = normalizeEquipmentProductImageStoragePath(storagePath)
  const slashIndex = normalizedPath.lastIndexOf('/')
  const folder = slashIndex === -1 ? '' : normalizedPath.slice(0, slashIndex)
  const fileName = slashIndex === -1 ? normalizedPath : normalizedPath.slice(slashIndex + 1)

  const { data, error } = await adminClient.storage
    .from(EQUIPMENT_PRODUCT_IMAGES_BUCKET)
    .list(folder, {
      limit: 1000,
      search: fileName,
    })

  if (error) {
    return { exists: null, error: error.message }
  }

  const exists = (data ?? []).some((entry) => entry.name === fileName)
  return { exists, error: null }
}

function createBrandSummary(brand) {
  return {
    brand,
    totalProducts: 0,
    totalApprovedImages: 0,
    resolvedUrlCount: 0,
    head200Count: 0,
    head404Count: 0,
    headOtherCount: 0,
    nonImageContentTypeCount: 0,
    unresolvedUrlCount: 0,
    storageObjectMissingCount: 0,
    externalUrlCount: 0,
    supabaseUrlCount: 0,
    suggestedWorkingHostedCount: 0,
    failures: [],
  }
}

function classifyHeadResult(head) {
  if (head.status === 200) return 'head_200'
  if (head.status === 404) return 'head_404'
  if (head.status == null) return 'head_error'
  return 'head_other'
}

async function auditProduct(product, { anonClient, adminClient }) {
  const resolvedUrl = resolveAuditableImageUrl(product, anonClient)
  const inferredStoragePath = inferEquipmentProductImageStoragePath(product)
  const isSupabaseUrl = resolvedUrl ? isSupabaseEquipmentProductImagePublicUrl(resolvedUrl) : false

  const result = {
    id: product.id,
    brand: product.brand,
    name: product.canonical_product_name,
    key: product.canonical_product_key,
    image_status: product.image_status,
    image_url: product.image_url,
    image_storage_path: product.image_storage_path,
    inferred_storage_path: inferredStoragePath,
    resolvedUrl,
    head: null,
    headClass: resolvedUrl ? null : 'unresolved_url',
    storageExists: null,
    wouldDisplayIfApproved: false,
    repairActions: [],
  }

  if (!resolvedUrl) {
    return result
  }

  result.head = await headResolvedUrl(resolvedUrl)
  result.headClass = classifyHeadResult(result.head)

  if (result.head.status === 200 && result.head.contentType && !result.head.contentType.startsWith('image/')) {
    result.headClass = 'non_image_content_type'
  }

  if (isSupabaseUrl && inferredStoragePath && adminClient) {
    const storageCheck = await storageObjectExists(adminClient, inferredStoragePath)
    result.storageExists = storageCheck?.exists ?? null
    if (storageCheck?.exists === false) {
      result.headClass = 'storage_object_missing'
    }
  }

  if (result.headClass === 'head_200' && isSupabaseUrl && result.storageExists !== false) {
    result.wouldDisplayIfApproved = true
  }

  return result
}

function updateBrandSummary(summary, audit) {
  summary.totalProducts += 1

  if (audit.image_status === EQUIPMENT_PRODUCT_IMAGE_STATUS.APPROVED) {
    summary.totalApprovedImages += 1
  }

  if (audit.wouldDisplayIfApproved && audit.image_status !== EQUIPMENT_PRODUCT_IMAGE_STATUS.APPROVED) {
    summary.suggestedWorkingHostedCount += 1
  }

  if (!audit.resolvedUrl) {
    if (audit.image_status === EQUIPMENT_PRODUCT_IMAGE_STATUS.APPROVED) {
      summary.unresolvedUrlCount += 1
      if (summary.failures.length < 5) {
        summary.failures.push({
          kind: 'unresolved_url',
          image_status: audit.image_status,
          key: audit.key,
          name: audit.name,
          image_url: audit.image_url,
          image_storage_path: audit.image_storage_path,
        })
      }
    }
    return
  }

  summary.resolvedUrlCount += 1

  if (isSupabaseEquipmentProductImagePublicUrl(audit.resolvedUrl)) {
    summary.supabaseUrlCount += 1
  } else {
    summary.externalUrlCount += 1
  }

  if (audit.headClass === 'head_200') {
    summary.head200Count += 1
    if (audit.head?.contentType && !audit.head.contentType.startsWith('image/')) {
      summary.nonImageContentTypeCount += 1
    }
    return
  }

  if (audit.headClass === 'head_404') summary.head404Count += 1
  else if (audit.headClass === 'non_image_content_type') summary.nonImageContentTypeCount += 1
  else if (audit.headClass === 'storage_object_missing') summary.storageObjectMissingCount += 1
  else summary.headOtherCount += 1

  const shouldReportFailure = audit.image_status === EQUIPMENT_PRODUCT_IMAGE_STATUS.APPROVED
    || audit.headClass === 'head_404'
    || audit.headClass === 'storage_object_missing'

  if (shouldReportFailure && summary.failures.length < 8) {
    summary.failures.push({
      kind: audit.headClass,
      image_status: audit.image_status,
      key: audit.key,
      name: audit.name,
      resolvedUrl: audit.resolvedUrl,
      status: audit.head?.status ?? null,
      contentType: audit.head?.contentType ?? null,
      image_url: audit.image_url,
      image_storage_path: audit.image_storage_path,
      inferred_storage_path: audit.inferred_storage_path,
      storageExists: audit.storageExists,
    })
  }
}

function buildRepairPlan(audit, { approveWorkingHosted = false } = {}) {
  const actions = []
  const inferredPath = audit.inferred_storage_path
  const hasStoragePath = Boolean(normalizeEquipmentProductImageStoragePath(audit.image_storage_path))
  const supabaseUrl = audit.resolvedUrl && isSupabaseEquipmentProductImagePublicUrl(audit.resolvedUrl)
    ? audit.resolvedUrl
    : null
  const pathFromUrl = audit.image_url
    ? extractEquipmentProductImageStoragePathFromPublicUrl(audit.image_url)
    : null

  if (!hasStoragePath && pathFromUrl) {
    actions.push({
      type: 'backfill_storage_path',
      image_storage_path: pathFromUrl,
    })
  } else if (!hasStoragePath && inferredPath && supabaseUrl) {
    actions.push({
      type: 'backfill_storage_path',
      image_storage_path: inferredPath,
    })
  }

  const brokenApproved = audit.image_status === EQUIPMENT_PRODUCT_IMAGE_STATUS.APPROVED && (
    audit.headClass === 'head_404'
    || audit.headClass === 'storage_object_missing'
    || audit.headClass === 'unresolved_url'
  )

  if (brokenApproved) {
    actions.push({
      type: 'demote_missing_object',
      image_status: EQUIPMENT_PRODUCT_IMAGE_STATUS.FAILED,
      image_failure_reason: MISSING_STORAGE_OBJECT_FAILURE_REASON,
    })
  }

  if (
    approveWorkingHosted
    && audit.image_status === EQUIPMENT_PRODUCT_IMAGE_STATUS.SUGGESTED
    && audit.wouldDisplayIfApproved
  ) {
    actions.push({
      type: 'approve_working_hosted',
      image_status: EQUIPMENT_PRODUCT_IMAGE_STATUS.APPROVED,
      image_failure_reason: null,
    })
  }

  return actions
}

async function applyRepair(adminClient, product, actions, dryRun) {
  if (!actions.length) return { applied: false, updates: null }

  const updates = {
    updated_at: new Date().toISOString(),
    image_updated_at: new Date().toISOString(),
  }

  for (const action of actions) {
    if (action.type === 'backfill_storage_path') {
      updates.image_storage_path = action.image_storage_path
    }
    if (action.type === 'demote_missing_object') {
      updates.image_status = action.image_status
      updates.image_failure_reason = action.image_failure_reason
    }
    if (action.type === 'approve_working_hosted') {
      updates.image_status = action.image_status
      updates.image_failure_reason = action.image_failure_reason
    }
  }

  if (dryRun) {
    return { applied: false, updates, dryRun: true }
  }

  const { error } = await adminClient
    .from('equipment_products')
    .update(updates)
    .eq('id', product.id)

  if (error) throw error
  return { applied: true, updates, dryRun: false }
}

function printBrandSummary(summary) {
  console.log(`\n${summary.brand}`)
  console.log(`  products audited: ${summary.totalProducts}`)
  console.log(`  approved image_status count: ${summary.totalApprovedImages}`)
  console.log(`  suggested working hosted (hidden on public page): ${summary.suggestedWorkingHostedCount}`)
  console.log(`  resolved URL count: ${summary.resolvedUrlCount}`)
  console.log(`  HEAD 200 count: ${summary.head200Count}`)
  console.log(`  HEAD 404 count: ${summary.head404Count}`)
  console.log(`  HEAD other/error count: ${summary.headOtherCount}`)
  console.log(`  non-image content-type count: ${summary.nonImageContentTypeCount}`)
  console.log(`  unresolved URL count: ${summary.unresolvedUrlCount}`)
  console.log(`  storage object missing count: ${summary.storageObjectMissingCount}`)
  console.log(`  Supabase URL count: ${summary.supabaseUrlCount}`)
  console.log(`  external URL count: ${summary.externalUrlCount}`)

  if (summary.failures.length) {
    console.log('  failure examples:')
    for (const failure of summary.failures) {
      console.log(`    - [${failure.kind}] ${failure.key}`)
      if (failure.resolvedUrl) console.log(`      resolved: ${failure.resolvedUrl}`)
      if (failure.status != null) console.log(`      HEAD: ${failure.status} ${failure.contentType ?? ''}`.trim())
      if (failure.inferred_storage_path) console.log(`      inferred path: ${failure.inferred_storage_path}`)
      if (failure.storageExists === false) console.log('      storage list: object not found')
      if (failure.image_url) console.log(`      image_url: ${failure.image_url}`)
      if (failure.image_storage_path) console.log(`      image_storage_path: ${failure.image_storage_path}`)
    }
  }
}

async function main() {
  const args = parseArgs(process.argv)
  const env = { ...loadEnv(), ...process.env }
  const { anonClient, adminClient } = createClients(env)
  const brands = args.brands.length ? args.brands : FOCUS_BRANDS
  const dryRun = !args.repair

  if (args.repair && !adminClient) {
    throw new Error('--repair requires SUPABASE_SERVICE_ROLE_KEY in .env.local')
  }

  console.log(`Mode: ${dryRun ? 'dry-run' : 'repair'}`)
  console.log(`Brands: ${brands.join(', ')}`)
  console.log(`Image status filter: ${args.imageStatus}`)
  if (args.approveWorkingHosted) {
    console.log('Repair will approve suggested images with working hosted storage URLs')
  }

  const statusBreakdown = await fetchBrandImageStatusBreakdown(adminClient ?? anonClient, brands)
  console.log('\nImage status breakdown (approved products)')
  for (const entry of statusBreakdown) {
    console.log(`  ${entry.brand}: total ${entry.total}`)
    for (const [status, count] of Object.entries(entry.byStatus).sort()) {
      console.log(`    ${status}: ${count}`)
    }
  }

  const products = await fetchProducts(adminClient ?? anonClient, {
    brands,
    imageStatus: args.imageStatus,
    limit: args.limit,
  })

  console.log(`\nLoaded ${products.length} product(s) for audit.`)

  const byBrand = new Map()
  const audits = []
  const repairSummary = {
    inspected: 0,
    repairable: 0,
    backfillStoragePath: 0,
    demotedMissingObject: 0,
    approvedWorkingHosted: 0,
    applied: 0,
  }

  for (const product of products) {
    const audit = await auditProduct(product, { anonClient, adminClient })
    audits.push(audit)

    const brand = product.brand || 'Unknown'
    if (!byBrand.has(brand)) byBrand.set(brand, createBrandSummary(brand))
    updateBrandSummary(byBrand.get(brand), audit)

    const repairActions = buildRepairPlan(audit, {
      approveWorkingHosted: args.approveWorkingHosted,
    })
    audit.repairActions = repairActions

    if (repairActions.length) {
      repairSummary.repairable += 1
      if (repairActions.some((action) => action.type === 'backfill_storage_path')) {
        repairSummary.backfillStoragePath += 1
      }
      if (repairActions.some((action) => action.type === 'demote_missing_object')) {
        repairSummary.demotedMissingObject += 1
      }
      if (repairActions.some((action) => action.type === 'approve_working_hosted')) {
        repairSummary.approvedWorkingHosted += 1
      }

      if (adminClient) {
        const repairResult = await applyRepair(adminClient, product, repairActions, dryRun)
        if (repairResult.applied) repairSummary.applied += 1
        audit.repairResult = repairResult
      }
    }

    repairSummary.inspected += 1
  }

  const orderedBrands = [...byBrand.values()].sort((left, right) => left.brand.localeCompare(right.brand))
  for (const summary of orderedBrands) {
    printBrandSummary(summary)
  }

  const totals = orderedBrands.reduce((acc, summary) => {
    acc.totalApprovedImages += summary.totalApprovedImages
    acc.suggestedWorkingHostedCount += summary.suggestedWorkingHostedCount
    acc.resolvedUrlCount += summary.resolvedUrlCount
    acc.head200Count += summary.head200Count
    acc.head404Count += summary.head404Count
    acc.headOtherCount += summary.headOtherCount
    acc.nonImageContentTypeCount += summary.nonImageContentTypeCount
    acc.unresolvedUrlCount += summary.unresolvedUrlCount
    acc.storageObjectMissingCount += summary.storageObjectMissingCount
    return acc
  }, {
    totalApprovedImages: 0,
    suggestedWorkingHostedCount: 0,
    resolvedUrlCount: 0,
    head200Count: 0,
    head404Count: 0,
    headOtherCount: 0,
    nonImageContentTypeCount: 0,
    unresolvedUrlCount: 0,
    storageObjectMissingCount: 0,
  })

  console.log('\nTotals')
  console.log(`  products audited: ${orderedBrands.reduce((sum, entry) => sum + entry.totalProducts, 0)}`)
  console.log(`  approved image_status count: ${totals.totalApprovedImages}`)
  console.log(`  suggested working hosted (hidden on public page): ${totals.suggestedWorkingHostedCount}`)
  console.log(`  resolved URL count: ${totals.resolvedUrlCount}`)
  console.log(`  HEAD 200 count: ${totals.head200Count}`)
  console.log(`  HEAD 404 count: ${totals.head404Count}`)
  console.log(`  HEAD other/error count: ${totals.headOtherCount}`)
  console.log(`  non-image content-type count: ${totals.nonImageContentTypeCount}`)
  console.log(`  unresolved URL count: ${totals.unresolvedUrlCount}`)
  console.log(`  storage object missing count: ${totals.storageObjectMissingCount}`)

  console.log('\nRepair summary')
  console.log(`  inspected: ${repairSummary.inspected}`)
  console.log(`  repairable: ${repairSummary.repairable}`)
  console.log(`  would backfill storage path: ${repairSummary.backfillStoragePath}`)
  console.log(`  would demote missing object: ${repairSummary.demotedMissingObject}`)
  console.log(`  would approve working hosted: ${repairSummary.approvedWorkingHosted}`)
  console.log(`  applied updates: ${repairSummary.applied}`)
  if (dryRun && repairSummary.repairable > 0) {
    console.log('  re-run with --repair to apply fixes')
    if (repairSummary.approvedWorkingHosted > 0) {
      console.log('  add --approve-working-hosted to approve suggested images with working hosted storage')
    }
  }

  const payload = {
    mode: dryRun ? 'dry-run' : 'repair',
    brands,
    imageStatus: args.imageStatus,
    statusBreakdown,
    totals,
    byBrand: orderedBrands,
    audits,
    repairSummary,
  }

  if (args.jsonOut) {
    writeFileSync(args.jsonOut, `${JSON.stringify(payload, null, 2)}\n`)
    console.log(`\nWrote JSON report: ${args.jsonOut}`)
  }
}

main().catch((error) => {
  console.error(error?.message || error)
  process.exit(1)
})
