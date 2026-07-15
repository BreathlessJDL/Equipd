/**
 * Verify approved equipment product image resolution (storage path + public URL).
 * Usage: node scripts/verify-equipment-product-image-resolution.mjs [canonical_product_key]
 */

import { readFileSync } from 'fs'
import { createClient } from '@supabase/supabase-js'
import {
  EQUIPMENT_PRODUCT_IMAGES_BUCKET,
  isBrowserLoadableImageUrl,
  productHasDisplayableImage,
  resolveEquipmentProductImageUrl,
} from '../src/lib/equipmentProductImages.js'

function loadEnvLocal() {
  try {
    const raw = readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    for (const line of raw.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eq = trimmed.indexOf('=')
      if (eq === -1) continue
      const key = trimmed.slice(0, eq).trim()
      const value = trimmed.slice(eq + 1).trim()
      if (!process.env[key]) process.env[key] = value
    }
  } catch {
    // optional
  }
}

function assert(condition, label) {
  if (!condition) throw new Error(label)
}

loadEnvLocal()

const supabaseUrl = process.env.VITE_SUPABASE_URL?.replace(/\/+$/, '').replace(/\/rest\/v1$/i, '')
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env.local')
}

const anonClient = createClient(supabaseUrl, supabaseAnonKey)
const adminClient = serviceRoleKey ? createClient(supabaseUrl, serviceRoleKey) : null

const requestedKey = process.argv[2]?.trim() || null

async function applyMigration() {
  if (!adminClient) {
    console.warn('SUPABASE_SERVICE_ROLE_KEY not set — skipping migration apply')
    return
  }

  const migrationSql = readFileSync(
    new URL('../supabase/migrations/20260707200000_equipment_product_image_approve_storage_path.sql', import.meta.url),
    'utf8',
  )

  const { error } = await adminClient.rpc('exec_sql', { query: migrationSql })
  if (error?.message?.includes('exec_sql')) {
    const { error: directError } = await adminClient.from('equipment_products').select('id').limit(1)
    if (directError) throw directError
    console.log('Migration RPC unavailable — apply 20260707200000_equipment_product_image_approve_storage_path.sql manually if needed')
    return
  }
  if (error) throw error
  console.log('Migration applied: equipment_product_image_approve_storage_path')
}

async function findStorageOnlyApprovedProduct() {
  const client = adminClient ?? anonClient
  const { data, error } = await client
    .from('equipment_products')
    .select('canonical_product_key, image_url, image_storage_path, image_status, status')
    .eq('status', 'approved')
    .eq('image_status', 'approved')
    .is('image_url', null)
    .not('image_storage_path', 'is', null)
    .limit(5)

  if (error) throw error
  return data ?? []
}

async function fetchProductByKey(key) {
  const { data, error } = await anonClient
    .from('equipment_products')
    .select('canonical_product_key, image_url, image_storage_path, image_status, status')
    .eq('canonical_product_key', key)
    .eq('status', 'approved')
    .maybeSingle()

  if (error) throw error
  return data
}

async function verifyStorageObject(publicUrl) {
  const response = await fetch(publicUrl, { method: 'HEAD' })
  return {
    ok: response.ok,
    status: response.status,
    contentType: response.headers.get('content-type'),
  }
}

async function verifyProduct(product) {
  console.log('\nProduct:', product.canonical_product_key)
  console.log('  image_status:', product.image_status)
  console.log('  image_url:', product.image_url)
  console.log('  image_storage_path:', product.image_storage_path)
  console.log('  hasDisplayableImage:', productHasDisplayableImage(product))

  const resolvedUrl = resolveEquipmentProductImageUrl(product, anonClient, { warn: true })
  console.log('  resolvedImageUrl:', resolvedUrl)

  assert(productHasDisplayableImage(product), 'product should be displayable (approved + asset)')
  assert(resolvedUrl, 'resolved image URL should not be null')
  assert(isBrowserLoadableImageUrl(resolvedUrl), 'resolved URL should be browser-loadable https URL')
  assert(
    resolvedUrl.startsWith('http') && resolvedUrl.includes('/storage/v1/object/public/'),
    'resolved URL should be a Supabase public URL, not a raw storage path',
  )
  assert(
    resolvedUrl.includes(`/storage/v1/object/public/${EQUIPMENT_PRODUCT_IMAGES_BUCKET}/`),
    `resolved URL should use bucket ${EQUIPMENT_PRODUCT_IMAGES_BUCKET}`,
  )

  const objectCheck = await verifyStorageObject(resolvedUrl)
  console.log('  storage HEAD:', objectCheck)
  assert(objectCheck.ok, `storage object should be reachable (HTTP ${objectCheck.status})`)
  assert(
    objectCheck.contentType?.startsWith('image/'),
    `storage object should be an image (got ${objectCheck.contentType})`,
  )

  console.log('  OK — image resolves and object exists in storage')
  return product.canonical_product_key
}

async function main() {
  try {
    await applyMigration()
  } catch (error) {
    console.warn('Migration apply skipped/failed:', error.message)
  }

  let product = null

  if (requestedKey) {
    product = await fetchProductByKey(requestedKey)
    if (!product) throw new Error(`No approved product found for key: ${requestedKey}`)
  } else {
    const candidates = await findStorageOnlyApprovedProduct()
    if (!candidates.length) {
      const { data: fallback } = await (adminClient ?? anonClient)
        .from('equipment_products')
        .select('canonical_product_key, image_url, image_storage_path, image_status, status')
        .eq('status', 'approved')
        .eq('image_status', 'approved')
        .not('image_storage_path', 'is', null)
        .limit(1)

      if (!fallback?.length) {
        throw new Error('No approved products with image_storage_path found')
      }
      product = fallback[0]
      console.log('No storage-only approved product found; using product with both fields:', product.canonical_product_key)
    } else {
      product = candidates[0]
      console.log(`Found ${candidates.length} storage-only approved product(s); verifying:`, product.canonical_product_key)
    }
  }

  const key = await verifyProduct(product)

  if (!product.image_url) {
    console.log('\nVerified as storage-only approved product.')
  } else {
    const storageOnly = { ...product, image_url: null }
    console.log('\nSimulating storage-only resolution (clearing image_url):')
    await verifyProduct(storageOnly)
  }

  console.log(`\nLocal page: http://localhost:5173/equipment/${encodeURIComponent(key)}`)
  console.log('Open in dev and confirm [EquipmentModelPage] product image fields in console.')
}

main().catch((error) => {
  console.error(error.message || error)
  process.exit(1)
})
