#!/usr/bin/env node
/**
 * Generate public/sitemap.xml including brands and approved canonical products.
 * Uses the same public catalogue filter + route list as SEO prerender.
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

  // Sitemap index once product volume warrants splitting (50k URL soft limit).
  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...entries,
    '</urlset>',
    '',
  ].join('\n')

  const outPath = join(process.cwd(), 'public', 'sitemap.xml')
  writeFileSync(outPath, xml, 'utf8')
  console.log(
    `Wrote ${outPath} with ${entries.length} URLs `
    + `(${directory.brands.length} brands, ${publicProducts.length} products)`,
  )
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
