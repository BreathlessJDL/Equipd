#!/usr/bin/env node
/**
 * Delete dev-seed Storage files via Supabase Storage API.
 *
 * Supabase does not allow direct DELETE from storage.objects in SQL.
 * Run this before supabase/cleanup-dev-seed-data.sql (while dev orders still exist).
 *
 * Targets (explicit prefixes only — never deletes whole buckets):
 *   • listing-images/dev-seed/**
 *   • order-evidence/{dev-seed-order-uuid}/** (orders on dev-seed-% listings only)
 *
 * Preview (no deletes):
 *   node scripts/cleanup-dev-seed-storage.mjs
 *
 * Execute:
 *   PowerShell: $env:CLEANUP_DEV_STORAGE_ALLOW="true"; node scripts/cleanup-dev-seed-storage.mjs
 *   Bash:       CLEANUP_DEV_STORAGE_ALLOW=true node scripts/cleanup-dev-seed-storage.mjs
 *
 * Env (.env.local):
 *   VITE_SUPABASE_URL or SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   CLEANUP_DEV_STORAGE_ALLOW=true  (required to delete)
 */

import { createClient } from '@supabase/supabase-js'
import { existsSync, readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { DEV_SEED_PREFIX } from './seed-dev-data.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

const LISTING_IMAGES_BUCKET = 'listing-images'
const ORDER_EVIDENCE_BUCKET = 'order-evidence'
const LISTING_DEV_STORAGE_PREFIX = 'dev-seed'
const DELETE_BATCH_SIZE = 100
const PREVIEW_PATH_LIMIT = 25

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function loadEnvFile(relativePath) {
  const path = join(ROOT, relativePath)
  if (!existsSync(path)) return

  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const index = trimmed.indexOf('=')
    if (index === -1) continue
    const key = trimmed.slice(0, index).trim()
    const value = trimmed.slice(index + 1).trim().replace(/^['"]|['"]$/g, '')
    if (!process.env[key]) process.env[key] = value
  }
}

function assertEnv() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  if (!url) {
    throw new Error('Missing SUPABASE_URL or VITE_SUPABASE_URL in .env.local')
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY in .env.local')
  }

  if (/prod/i.test(url) && process.env.CLEANUP_DEV_IGNORE_PROD_URL !== 'true') {
    throw new Error(
      `Refusing cleanup: Supabase URL looks like production (${url}).\n` +
        'Set CLEANUP_DEV_IGNORE_PROD_URL=true only if you are certain this is a dev project.',
    )
  }

  return url
}

function isDeleteAllowed() {
  return process.env.CLEANUP_DEV_STORAGE_ALLOW === 'true'
}

function createAdminClient(url) {
  return createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

function assertListingImagesPrefix(prefix) {
  const normalized = prefix.replace(/\/$/, '')
  if (!normalized || normalized !== LISTING_DEV_STORAGE_PREFIX) {
    throw new Error(
      `Refusing listing-images list: prefix must be exactly "${LISTING_DEV_STORAGE_PREFIX}"`,
    )
  }
}

function assertOrderEvidencePrefix(prefix, allowedOrderIds) {
  const normalized = prefix.replace(/\/$/, '')
  if (!UUID_RE.test(normalized)) {
    throw new Error(`Refusing order-evidence list: invalid order id prefix "${prefix}"`)
  }
  if (!allowedOrderIds.has(normalized)) {
    throw new Error(
      `Refusing order-evidence list: ${normalized} is not a dev-seed order from the database`,
    )
  }
}

async function listFilesRecursive(supabase, bucket, rootPrefix, { assertPrefix }) {
  assertPrefix(rootPrefix)

  const files = []
  const queue = [rootPrefix.replace(/\/$/, '')]

  while (queue.length > 0) {
    const folder = queue.shift()
    let offset = 0

    while (true) {
      const { data, error } = await supabase.storage.from(bucket).list(folder, {
        limit: 1000,
        offset,
        sortBy: { column: 'name', order: 'asc' },
      })

      if (error) {
        throw new Error(`list ${bucket}/${folder}: ${error.message}`)
      }

      const entries = data ?? []
      if (entries.length === 0) break

      for (const entry of entries) {
        const path = folder ? `${folder}/${entry.name}` : entry.name

        if (entry.id == null) {
          queue.push(path)
        } else {
          files.push(path)
        }
      }

      if (entries.length < 1000) break
      offset += entries.length
    }
  }

  return files
}

async function fetchDevOrderIds(supabase) {
  const { data: listings, error: listingsError } = await supabase
    .from('listings')
    .select('id')
    .like('slug', `${DEV_SEED_PREFIX}%`)

  if (listingsError) {
    throw new Error(`Failed to load dev-seed listings: ${listingsError.message}`)
  }

  const listingIds = (listings ?? []).map((row) => row.id)
  if (!listingIds.length) {
    return []
  }

  const { data: orders, error: ordersError } = await supabase
    .from('orders')
    .select('id')
    .in('listing_id', listingIds)

  if (ordersError) {
    throw new Error(`Failed to load dev-seed orders: ${ordersError.message}`)
  }

  return (orders ?? []).map((row) => row.id).filter((id) => UUID_RE.test(id))
}

async function collectTargets(supabase) {
  const devOrderIds = await fetchDevOrderIds(supabase)
  const allowedOrderIds = new Set(devOrderIds)

  const listingImagePaths = await listFilesRecursive(
    supabase,
    LISTING_IMAGES_BUCKET,
    LISTING_DEV_STORAGE_PREFIX,
    {
      assertPrefix: assertListingImagesPrefix,
    },
  )

  const orderEvidencePaths = []

  for (const orderId of devOrderIds) {
    const paths = await listFilesRecursive(supabase, ORDER_EVIDENCE_BUCKET, orderId, {
      assertPrefix: (prefix) => assertOrderEvidencePrefix(prefix, allowedOrderIds),
    })
    orderEvidencePaths.push(...paths)
  }

  return {
    devOrderIds,
    listingImagePaths,
    orderEvidencePaths,
  }
}

function printPreview({ devOrderIds, listingImagePaths, orderEvidencePaths }) {
  console.log('\n=== Dev seed storage preview ===\n')
  console.log(`Dev-seed orders in database: ${devOrderIds.length}`)
  console.log(`listing-images/${LISTING_DEV_STORAGE_PREFIX}/**: ${listingImagePaths.length} file(s)`)
  console.log(`order-evidence/{dev-order-id}/**: ${orderEvidencePaths.length} file(s)`)
  console.log(`Total files to delete: ${listingImagePaths.length + orderEvidencePaths.length}`)

  if (listingImagePaths.length) {
    console.log(`\nSample listing-images paths (max ${PREVIEW_PATH_LIMIT}):`)
    for (const path of listingImagePaths.slice(0, PREVIEW_PATH_LIMIT)) {
      console.log(`  ${LISTING_IMAGES_BUCKET}/${path}`)
    }
    if (listingImagePaths.length > PREVIEW_PATH_LIMIT) {
      console.log(`  … and ${listingImagePaths.length - PREVIEW_PATH_LIMIT} more`)
    }
  }

  if (orderEvidencePaths.length) {
    console.log(`\nSample order-evidence paths (max ${PREVIEW_PATH_LIMIT}):`)
    for (const path of orderEvidencePaths.slice(0, PREVIEW_PATH_LIMIT)) {
      console.log(`  ${ORDER_EVIDENCE_BUCKET}/${path}`)
    }
    if (orderEvidencePaths.length > PREVIEW_PATH_LIMIT) {
      console.log(`  … and ${orderEvidencePaths.length - PREVIEW_PATH_LIMIT} more`)
    }
  }

  if (devOrderIds.length && !orderEvidencePaths.length) {
    console.log('\n(No order-evidence files found for dev-seed orders.)')
  }
}

async function deletePaths(supabase, bucket, paths) {
  let deleted = 0
  const failures = []

  for (let index = 0; index < paths.length; index += DELETE_BATCH_SIZE) {
    const batch = paths.slice(index, index + DELETE_BATCH_SIZE)
    const { data, error } = await supabase.storage.from(bucket).remove(batch)

    if (error) {
      failures.push({ batch, message: error.message })
      continue
    }

    const removed = Array.isArray(data) ? data.length : batch.length
    deleted += removed
  }

  return { deleted, failures }
}

async function main() {
  loadEnvFile('.env.local')
  const url = assertEnv()
  const supabase = createAdminClient(url)

  const targets = await collectTargets(supabase)
  printPreview(targets)

  if (!isDeleteAllowed()) {
    console.log(
      '\nPreview only — no files deleted.\n' +
        'To delete, set CLEANUP_DEV_STORAGE_ALLOW=true:\n' +
        '  PowerShell: $env:CLEANUP_DEV_STORAGE_ALLOW="true"; node scripts/cleanup-dev-seed-storage.mjs\n' +
        '  Bash:       CLEANUP_DEV_STORAGE_ALLOW=true node scripts/cleanup-dev-seed-storage.mjs',
    )
    return
  }

  console.log('\n=== Deleting dev seed storage files ===\n')

  const listingResult = await deletePaths(
    supabase,
    LISTING_IMAGES_BUCKET,
    targets.listingImagePaths,
  )
  const evidenceResult = await deletePaths(
    supabase,
    ORDER_EVIDENCE_BUCKET,
    targets.orderEvidencePaths,
  )

  const totalDeleted = listingResult.deleted + evidenceResult.deleted
  const allFailures = [
    ...listingResult.failures.map((entry) => ({ bucket: LISTING_IMAGES_BUCKET, ...entry })),
    ...evidenceResult.failures.map((entry) => ({ bucket: ORDER_EVIDENCE_BUCKET, ...entry })),
  ]

  console.log(`Deleted ${listingResult.deleted}/${targets.listingImagePaths.length} listing-images file(s)`)
  console.log(
    `Deleted ${evidenceResult.deleted}/${targets.orderEvidencePaths.length} order-evidence file(s)`,
  )
  console.log(`Total deleted: ${totalDeleted}`)

  if (allFailures.length) {
    console.error(`\n${allFailures.length} batch failure(s):`)
    for (const failure of allFailures) {
      console.error(`  ${failure.bucket}: ${failure.message} (${failure.batch.length} paths)`)
    }
    process.exit(1)
  }

  console.log('\nDev seed storage cleanup complete.')
}

main().catch((error) => {
  console.error(`\nFAILED: ${error.message}`)
  process.exit(1)
})
