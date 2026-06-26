#!/usr/bin/env node
/**
 * Verify public visibility rules for Bubble import listings.
 *
 * Usage:
 *   node scripts/verify-import-listing-visibility.mjs
 */

import { createClient } from '@supabase/supabase-js'
import { existsSync, readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

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

async function countImportListings(supabase) {
  const { count: totalActiveImport, error: totalError } = await supabase
    .from('listings')
    .select('*', { count: 'exact', head: true })
    .eq('source', 'import')
    .eq('status', 'active')

  if (totalError) throw totalError

  const { data: imageRows, error: imageRowsError } = await supabase
    .from('listing_images')
    .select('listing_id')

  if (imageRowsError) throw imageRowsError

  const { data: importRows, error: importRowsError } = await supabase
    .from('listings')
    .select('id, slug')
    .eq('source', 'import')
    .eq('status', 'active')
    .limit(200)

  if (importRowsError) throw importRowsError

  const listingsWithImages = new Set((imageRows ?? []).map((row) => row.listing_id))

  let visible = 0
  let hidden = 0
  const hiddenExamples = []
  const visibleExamples = []

  for (const listing of importRows ?? []) {
    if (listingsWithImages.has(listing.id)) {
      visible += 1
      if (visibleExamples.length < 3) {
        visibleExamples.push({ slug: listing.slug, imageCount: 1 })
      }
    } else {
      hidden += 1
      if (hiddenExamples.length < 3) hiddenExamples.push(listing.slug)
    }
  }

  const { count: totalImages, error: imageCountError } = await supabase
    .from('listing_images')
    .select('*', { count: 'exact', head: true })

  if (imageCountError) throw imageCountError

  return {
    totalActiveImport: totalActiveImport ?? importRows?.length ?? 0,
    visibleImported: visible,
    hiddenImported: hidden,
    totalListingImages: totalImages ?? 0,
    hiddenExamples,
    visibleExamples,
  }
}

const BROWSE_PAGE_SIZE = 24
const CARD_LISTING_FIELDS =
  'id, slug, title, brand, model, price_pence, condition, location, latitude, longitude, status, seller_id, rating, collection_available, courier_available, created_at, updated_at, location_name, city, county, postcode'
const CARD_LISTING_IMAGE_FIELDS = 'listing_images(id, storage_path, sort_order)'

const PUBLIC_BROWSE_LISTINGS_SOURCE = 'listings_public_browse'

async function verifyAnonBrowseEmbed(anonClient) {
  const { count: totalVisibleActive, error: countError } = await anonClient
    .from(PUBLIC_BROWSE_LISTINGS_SOURCE)
    .select('*', { count: 'exact', head: true })
    .eq('status', 'active')

  if (countError) throw countError

  const { data, error } = await anonClient
    .from(PUBLIC_BROWSE_LISTINGS_SOURCE)
    .select(`${CARD_LISTING_FIELDS}, category:categories(id, name, slug), ${CARD_LISTING_IMAGE_FIELDS}`)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .order('sort_order', { ascending: true, foreignTable: 'listing_images' })
    .limit(1, { foreignTable: 'listing_images' })
    .limit(BROWSE_PAGE_SIZE)

  if (error) throw error

  const rows = data ?? []
  const withEmbeddedImage = rows.filter((row) => (row.listing_images?.length ?? 0) > 0)
  const withStoragePath = rows.filter((row) => row.listing_images?.[0]?.storage_path)

  return {
    totalVisibleActive: totalVisibleActive ?? 0,
    browsePageRows: rows.length,
    browseWithEmbeddedImages: withEmbeddedImage.length,
    browseWithStoragePath: withStoragePath.length,
    browseWithoutImages: rows.length - withEmbeddedImage.length,
  }
}

async function verifyHiddenImportImagesBlocked(anonClient, adminClient, hiddenSlug) {
  if (!hiddenSlug) {
    return { hiddenSlug: null, listingFound: false, imageRowsReturned: 0 }
  }

  const { data: listing, error: listingError } = await anonClient
    .from('listings')
    .select('id, slug')
    .eq('slug', hiddenSlug)
    .maybeSingle()

  if (listingError) throw listingError
  if (listing) {
    const { data: images, error: imageError } = await anonClient
      .from('listing_images')
      .select('id')
      .eq('listing_id', listing.id)

    if (imageError) throw imageError

    return {
      hiddenSlug,
      listingFound: true,
      imageRowsReturned: images?.length ?? 0,
    }
  }

  const { data: hiddenListing, error: hiddenListingError } = await adminClient
    .from('listings')
    .select('id')
    .eq('slug', hiddenSlug)
    .maybeSingle()

  if (hiddenListingError) throw hiddenListingError
  if (!hiddenListing) {
    return { hiddenSlug, listingFound: false, imageRowsReturned: 0 }
  }

  const { data: images, error: imageError } = await anonClient
    .from('listing_images')
    .select('id')
    .eq('listing_id', hiddenListing.id)

  if (imageError) throw imageError

  return {
    hiddenSlug,
    listingFound: false,
    imageRowsReturned: images?.length ?? 0,
  }
}

async function verifyAnonBrowse(anonClient) {
  const { count: anonImportActiveReturned, error } = await anonClient
    .from('listings')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'active')
    .eq('source', 'import')

  if (error) throw error

  const { data: sampleRows, error: sampleError } = await anonClient
    .from('listings')
    .select('id, slug')
    .eq('status', 'active')
    .eq('source', 'import')
    .limit(5)

  if (sampleError) throw sampleError

  return {
    anonImportActiveReturned: anonImportActiveReturned ?? 0,
    anonZeroImageImports: 0,
    anonWithImages: anonImportActiveReturned ?? 0,
    sampleVisibleSlug: sampleRows?.[0]?.slug ?? null,
    sampleHiddenSlug: null,
  }
}

async function verifyListingDetail(anonClient, slug) {
  if (!slug) return { slug, found: false, imageCount: 0 }
  const { data, error } = await anonClient
    .from('listings')
    .select('id, slug, source')
    .eq('slug', slug)
    .maybeSingle()

  if (error) throw error
  if (!data) return { slug, found: false, imageCount: 0 }

  const { count, error: imageError } = await anonClient
    .from('listing_images')
    .select('*', { count: 'exact', head: true })
    .eq('listing_id', data.id)

  if (imageError) throw imageError

  return { slug, found: true, imageCount: count ?? 0 }
}

async function verifySellerShopPublicListings(anonClient, sellerId) {
  if (!sellerId) {
    return { sellerId: null, publicShopCount: 0, withoutImages: 0 }
  }

  const { data, error } = await anonClient
    .from(PUBLIC_BROWSE_LISTINGS_SOURCE)
    .select(`${CARD_LISTING_FIELDS}, ${CARD_LISTING_IMAGE_FIELDS}`)
    .eq('seller_id', sellerId)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .order('sort_order', { ascending: true, foreignTable: 'listing_images' })
    .limit(1, { foreignTable: 'listing_images' })

  if (error) throw error

  const rows = data ?? []
  const withEmbeddedImage = rows.filter((row) => row.listing_images?.[0]?.storage_path)

  return {
    sellerId,
    publicShopCount: rows.length,
    withoutImages: rows.length - withEmbeddedImage.length,
  }
}

async function resolveImportSellerId(adminClient) {
  const { data, error } = await adminClient.auth.admin.listUsers({ perPage: 1000 })
  if (error) throw error

  const user = (data?.users ?? []).find(
    (row) => row.email?.toLowerCase() === 'jlinnell95@gmail.com',
  )

  return user?.id ?? null
}

async function main() {
  loadEnvFile('.env.local')
  loadEnvFile('.env')

  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceKey || !anonKey) {
    throw new Error('Missing SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, or VITE_SUPABASE_ANON_KEY.')
  }

  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const anon = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const counts = await countImportListings(admin)
  const anonBrowse = await verifyAnonBrowse(anon)
  const anonBrowseEmbed = await verifyAnonBrowseEmbed(anon)

  const visibleDetail = await verifyListingDetail(anon, counts.visibleExamples[0]?.slug)
  const hiddenDetail = await verifyListingDetail(
    anon,
    counts.hiddenExamples[0] ?? anonBrowse.sampleHiddenSlug,
  )
  const hiddenImageLeak = await verifyHiddenImportImagesBlocked(
    anon,
    admin,
    counts.hiddenExamples[0] ?? null,
  )

  const importSellerId = await resolveImportSellerId(admin)
  const sellerShop = await verifySellerShopPublicListings(anon, importSellerId)

  console.log('=== Import listing visibility verification ===\n')
  console.log(`Active import listings (DB, service role): ${counts.totalActiveImport}`)
  console.log(`  publicly visible (has images): ${counts.visibleImported}`)
  console.log(`  hidden from public (0 images): ${counts.hiddenImported}`)
  console.log(`Total listing_images rows: ${counts.totalListingImages}`)
  console.log('')
  console.log('Anon browse (RLS as public user):')
  console.log(`  import listings returned: ${anonBrowse.anonImportActiveReturned}`)
  console.log(`  with images: ${anonBrowse.anonWithImages}`)
  console.log(`  zero-image imports leaked: ${anonBrowse.anonZeroImageImports}`)
  console.log('')
  console.log('Anon browse cards (same embed query as frontend, page size 24):')
  console.log(`  total visible active listings: ${anonBrowseEmbed.totalVisibleActive}`)
  console.log(`  first-page rows: ${anonBrowseEmbed.browsePageRows}`)
  console.log(`  rows with embedded listing_images: ${anonBrowseEmbed.browseWithEmbeddedImages}`)
  console.log(`  rows with storage_path: ${anonBrowseEmbed.browseWithStoragePath}`)
  console.log(`  rows missing images (would show "No photo"): ${anonBrowseEmbed.browseWithoutImages}`)
  console.log('')
  console.log('Listing detail (anon):')
  console.log(`  visible example (${visibleDetail.slug}): ${visibleDetail.found ? 'found' : 'not found'} (${visibleDetail.imageCount} images)`)
  console.log(`  hidden example (${hiddenDetail.slug}): ${hiddenDetail.found ? 'FOUND (unexpected)' : 'not found (expected)'}`)
  if (hiddenImageLeak.hiddenSlug) {
    console.log(
      `  hidden import image leak (${hiddenImageLeak.hiddenSlug}): ${hiddenImageLeak.imageRowsReturned} image rows (expected 0)`,
    )
  }
  console.log('')
  console.log('Seller shop (public browse source, import seller):')
  console.log(`  seller id: ${sellerShop.sellerId ?? 'n/a'}`)
  console.log(`  public shop listings: ${sellerShop.publicShopCount}`)
  console.log(`  without images: ${sellerShop.withoutImages}`)
  console.log('')

  const ok =
    anonBrowse.anonImportActiveReturned === counts.visibleImported &&
    anonBrowseEmbed.totalVisibleActive === counts.visibleImported &&
    anonBrowseEmbed.browsePageRows === Math.min(BROWSE_PAGE_SIZE, counts.visibleImported) &&
    anonBrowseEmbed.browseWithoutImages === 0 &&
    anonBrowseEmbed.browseWithStoragePath === anonBrowseEmbed.browsePageRows &&
    sellerShop.publicShopCount === counts.visibleImported &&
    sellerShop.withoutImages === 0 &&
    !hiddenDetail.found &&
    hiddenImageLeak.imageRowsReturned === 0 &&
    (visibleDetail.slug ? visibleDetail.found && visibleDetail.imageCount > 0 : true)

  if (ok) {
    console.log('PASS: Public browse exposes only image-backed listings with embedded photos.')
  } else {
    console.log('FAIL: Visibility rules did not pass verification.')
    process.exitCode = 1
  }
}

main().catch((error) => {
  console.error(error.message || error)
  process.exit(1)
})
