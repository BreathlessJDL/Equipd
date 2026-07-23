#!/usr/bin/env node
/**
 * Generate public/sitemap.xml including brands, approved canonical products,
 * and publicly visible active marketplace listings.
 *
 * Uses the same public catalogue filter + route list as SEO prerender, and
 * listings_public_browse for marketplace visibility (same predicate as browse).
 *
 * Usage:
 *   node scripts/generate-sitemap.mjs
 */

import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { createClient } from '@supabase/supabase-js'
import {
  buildBrandDirectoryFromProducts,
  EQUIPD_SITE_ORIGIN,
  isPublicBrandCatalogueProduct,
} from '../src/lib/brandCatalogueCore.js'
import { buildSeoRouteList } from '../src/lib/seoCataloguePrerender.js'
import {
  buildListingSitemapEntries,
  shouldSplitSitemap,
  summarizeSitemapEntries,
} from '../src/lib/listingSitemap.js'
import { getSupabaseEnv, loadLocalEnv } from './lib/loadLocalEnv.mjs'

function xmlEscape(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function toLastmod(value) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString().slice(0, 10)
}

function urlEntry(loc, lastmod = null) {
  const lines = [
    '  <url>',
    `    <loc>${xmlEscape(loc)}</loc>`,
  ]
  if (lastmod) lines.push(`    <lastmod>${lastmod}</lastmod>`)
  lines.push('  </url>')
  return lines.join('\n')
}

async function fetchApprovedProducts(supabase) {
  const products = []
  const pageSize = 1000
  let from = 0
  while (true) {
    const { data, error } = await supabase
      .from('equipment_products')
      .select('brand, status, equipment_type, canonical_product_name, canonical_product_key, updated_at, created_at')
      .eq('status', 'approved')
      .order('brand')
      .range(from, from + pageSize - 1)
    if (error) throw error
    if (!data?.length) break
    products.push(...data)
    if (data.length < pageSize) break
    from += pageSize
  }
  return products
}

/**
 * Public active listings via listings_public_browse (canonical visibility predicate).
 * Eligible sold listings via listings table (readability + sold_at); browse stays active-only.
 */
async function fetchPublicActiveListingsForSitemap(supabase) {
  const listings = []
  const pageSize = 1000
  let from = 0

  while (true) {
    const { data, error } = await supabase
      .from('listings_public_browse')
      .select('id, slug, status, updated_at, published_at, created_at, quantity_available, is_test_data')
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .range(from, from + pageSize - 1)

    if (error) throw error
    if (!data?.length) break
    listings.push(...data)
    if (data.length < pageSize) break
    from += pageSize
  }

  return listings
}

async function fetchEligibleSoldListingsForSitemap(supabase) {
  const listings = []
  const pageSize = 1000
  let from = 0
  // Fetch sold rows with publication proof; archive window applied in JS helpers.
  const cutoff = new Date()
  cutoff.setUTCFullYear(cutoff.getUTCFullYear() - 2)

  while (true) {
    const { data, error } = await supabase
      .from('listings')
      .select('id, slug, status, updated_at, published_at, created_at, sold_at, is_test_data, source')
      .eq('status', 'sold')
      .eq('is_test_data', false)
      .not('published_at', 'is', null)
      .not('sold_at', 'is', null)
      .gte('sold_at', cutoff.toISOString())
      .order('sold_at', { ascending: false })
      .range(from, from + pageSize - 1)

    if (error) throw error
    if (!data?.length) break
    listings.push(...data)
    if (data.length < pageSize) break
    from += pageSize
  }

  return listings
}

async function main() {
  loadLocalEnv()
  const { url, key } = getSupabaseEnv()
  if (!url || !key) {
    throw new Error('Missing Supabase env for sitemap generation.')
  }

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const products = await fetchApprovedProducts(supabase)
  const publicProducts = products.filter(isPublicBrandCatalogueProduct)
  const directory = buildBrandDirectoryFromProducts(publicProducts)
  const publicListings = await fetchPublicActiveListingsForSitemap(supabase)
  const soldListings = await fetchEligibleSoldListingsForSitemap(supabase)
  const listingEntries = buildListingSitemapEntries([...publicListings, ...soldListings])
  const activeListingCount = buildListingSitemapEntries(publicListings).length
  const soldListingCount = listingEntries.length - activeListingCount

  const brandLastmod = new Map()
  for (const product of publicProducts) {
    const match = directory.brands.find((brand) => brand.sampleBrandValues.includes(product.brand))
    if (!match) continue
    const stamp = toLastmod(product.updated_at || product.created_at)
    if (!stamp) continue
    const current = brandLastmod.get(match.slug)
    if (!current || stamp > current) brandLastmod.set(match.slug, stamp)
  }

  const productLastmod = new Map(
    publicProducts.map((product) => [
      product.canonical_product_key,
      toLastmod(product.updated_at || product.created_at),
    ]),
  )

  const catalogueRoutes = buildSeoRouteList({
    brands: directory.brands,
    products: publicProducts,
  })

  const entries = []
  entries.push(urlEntry(`${EQUIPD_SITE_ORIGIN}/`))
  entries.push(urlEntry(`${EQUIPD_SITE_ORIGIN}/browse`))
  entries.push(urlEntry(`${EQUIPD_SITE_ORIGIN}/valuation`))
  entries.push(urlEntry(`${EQUIPD_SITE_ORIGIN}/about`))
  entries.push(urlEntry(`${EQUIPD_SITE_ORIGIN}/help`))
  entries.push(urlEntry(`${EQUIPD_SITE_ORIGIN}/sell-gym-equipment`))

  for (const route of catalogueRoutes) {
    if (route.type === 'brands-index') {
      entries.push(urlEntry(`${EQUIPD_SITE_ORIGIN}/brands`))
    } else if (route.type === 'brand') {
      entries.push(urlEntry(
        `${EQUIPD_SITE_ORIGIN}${route.path}`,
        brandLastmod.get(route.brandSlug) || null,
      ))
    } else if (route.type === 'equipment') {
      entries.push(urlEntry(
        `${EQUIPD_SITE_ORIGIN}${route.path}`,
        productLastmod.get(route.canonicalProductKey) || null,
      ))
    }
  }

  for (const listingEntry of listingEntries) {
    entries.push(urlEntry(listingEntry.loc, listingEntry.lastmod))
  }

  // Keep a single urlset while comfortably under soft limits.
  // Split into a sitemap index only if shouldSplitSitemap() trips (~45k URLs / ~45MB).
  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...entries,
    '</urlset>',
    '',
  ].join('\n')

  const splitNeeded = shouldSplitSitemap({
    urlCount: entries.length,
    byteLength: Buffer.byteLength(xml, 'utf8'),
  })

  if (splitNeeded) {
    console.warn(
      '[sitemap] Soft split threshold exceeded — consider a sitemap index '
      + '(static / brands / equipment / listings). Keeping a single file for this run.',
    )
  }

  const outPath = join(process.cwd(), 'public', 'sitemap.xml')
  writeFileSync(outPath, xml, 'utf8')

  const summary = summarizeSitemapEntries(
    entries.map((block) => {
      const match = block.match(/<loc>([^<]+)<\/loc>/)
      return match ? { loc: match[1].replace(/&amp;/g, '&') } : null
    }).filter(Boolean),
  )

  console.log(
    `Wrote ${outPath} with ${entries.length} URLs `
    + `(${directory.brands.length} brands, ${publicProducts.length} products, `
    + `${listingEntries.length} listings [${activeListingCount} active + ${soldListingCount} sold]; `
    + `${Buffer.byteLength(xml, 'utf8')} bytes)`,
  )
  console.log(
    `[sitemap] breakdown home=${summary.home} browse=${summary.browse} `
    + `static=${summary.static + summary.valuation} brands=${summary.brandsIndex + summary.brands} `
    + `equipment=${summary.equipment} listings=${summary.listings}`,
  )
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
