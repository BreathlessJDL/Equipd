#!/usr/bin/env node
/**
 * Post-build SEO prerender for public catalogue routes.
 *
 * Writes route-specific HTML under dist/ so Vercel serves filesystem HTML
 * (title, meta, canonical, body content, breadcrumbs, links, JSON-LD)
 * before the SPA rewrite to index.html. React still hydrates via createRoot.
 *
 * Usage:
 *   node scripts/prerender-seo-catalogue.mjs
 *   node scripts/prerender-seo-catalogue.mjs --dist dist
 *   node scripts/prerender-seo-catalogue.mjs --limit 5
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { createClient } from '@supabase/supabase-js'
import {
  buildBrandDirectoryFromProducts,
  isPublicBrandCatalogueProduct,
} from '../src/lib/brandCatalogueCore.js'
import { supportsProductConsoleOptions } from '../src/lib/equipmentCardio.js'
import { getApprovedEquipmentImage } from '../src/lib/equipmentPageSeo.js'
import {
  buildBrandPageSeoDocument,
  buildBrandsIndexSeoDocument,
  buildEquipmentPageSeoDocument,
  buildBrandPayloadFromProducts,
  buildSeoRouteList,
  injectSeoIntoHtml,
} from '../src/lib/seoCataloguePrerender.js'
import { getSupabaseEnv, loadLocalEnv } from './lib/loadLocalEnv.mjs'

const PRODUCT_SELECT = [
  'id',
  'brand',
  'product_family',
  'model',
  'equipment_type',
  'canonical_product_name',
  'canonical_product_key',
  'baseline_manufacture_year',
  'production_start_year',
  'production_end_year',
  'original_base_price',
  'original_base_price_currency',
  'status',
  'updated_at',
  'created_at',
  'image_url',
  'image_status',
].join(', ')

const CONTENT_SELECT = [
  'equipment_product_id',
  'overview_text',
  'seo_title',
  'seo_meta_description',
  'generation_status',
].join(', ')

function parseArgs(argv) {
  const args = { dist: 'dist', limit: null, dryRun: false }
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--dist') args.dist = argv[++i]
    else if (arg === '--limit') args.limit = Number(argv[++i])
    else if (arg === '--dry-run') args.dryRun = true
  }
  return args
}

function routePathToDistFile(routePath, distDir) {
  const clean = String(routePath || '')
    .split('?')[0]
    .split('#')[0]
    .replace(/\/+$/, '') || '/'

  const segments = clean === '/'
    ? []
    : clean
      .replace(/^\//, '')
      .split('/')
      .map((segment) => {
        try {
          return decodeURIComponent(segment)
        } catch {
          return segment
        }
      })

  return join(distDir, ...segments, 'index.html')
}

async function fetchAllRows(supabase, table, select, {
  filter = null,
  order = null,
  pageSize = 1000,
} = {}) {
  const rows = []
  let from = 0
  while (true) {
    let query = supabase.from(table).select(select).range(from, from + pageSize - 1)
    if (filter) query = filter(query)
    if (order) query = order(query)
    const { data, error } = await query
    if (error) throw error
    if (!data?.length) break
    rows.push(...data)
    if (data.length < pageSize) break
    from += pageSize
  }
  return rows
}

function writeHtmlFile(filePath, html) {
  mkdirSync(dirname(filePath), { recursive: true })
  writeFileSync(filePath, html, 'utf8')
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  loadLocalEnv()

  const { url, key } = getSupabaseEnv()
  if (!url || !key) {
    throw new Error(
      'Missing Supabase env (VITE_SUPABASE_URL / SUPABASE_URL and anon or service role key).',
    )
  }

  const distDir = join(process.cwd(), args.dist)
  const templatePath = join(distDir, 'index.html')
  let templateHtml
  try {
    templateHtml = readFileSync(templatePath, 'utf8')
  } catch {
    throw new Error(
      `Missing ${templatePath}. Run "vite build" before prerender, or pass --dist.`,
    )
  }

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  console.log('[prerender] Fetching approved equipment products…')
  const products = await fetchAllRows(
    supabase,
    'equipment_products',
    PRODUCT_SELECT,
    {
      filter: (query) => query.eq('status', 'approved'),
      order: (query) => query.order('brand').order('canonical_product_name'),
    },
  )

  const publicProducts = products.filter(isPublicBrandCatalogueProduct)
  const directory = buildBrandDirectoryFromProducts(publicProducts)

  console.log('[prerender] Fetching approved product content…')
  let contentRows = []
  try {
    contentRows = await fetchAllRows(
      supabase,
      'equipment_product_content',
      CONTENT_SELECT,
      {
        filter: (query) => query.eq('generation_status', 'approved'),
      },
    )
  } catch (error) {
    console.warn('[prerender] Product content fetch failed; continuing without content.', error.message)
  }

  const contentByProductId = new Map(
    contentRows.map((row) => [row.equipment_product_id, row]),
  )

  console.log('[prerender] Fetching products with console options…')
  let productIdsWithConsoles = new Set()
  try {
    const [compatRows, legacyRows] = await Promise.all([
      fetchAllRows(supabase, 'product_console_compat', 'product_id', { pageSize: 1000 }),
      fetchAllRows(supabase, 'product_console_options', 'product_id', { pageSize: 1000 }).catch(() => []),
    ])
    productIdsWithConsoles = new Set(
      [...compatRows, ...legacyRows].map((row) => row.product_id).filter(Boolean),
    )
  } catch (error) {
    console.warn('[prerender] Console options fetch failed; cardio console mentions may be approximate.', error.message)
  }

  const listingCountsByKey = Object.fromEntries(
    directory.brands.map((brand) => [brand.key, brand.listingCount || 0]),
  )

  let routes = buildSeoRouteList({
    brands: directory.brands,
    products: publicProducts,
  })

  if (args.limit != null && Number.isFinite(args.limit)) {
    routes = routes.slice(0, Math.max(0, args.limit))
  }

  console.log(
    `[prerender] Rendering ${routes.length} routes `
    + `(${directory.brands.length} brands, ${publicProducts.length} products)…`,
  )

  const brandPayloadCache = new Map()
  const written = []
  const errors = []

  for (const route of routes) {
    try {
      let document = null

      if (route.type === 'brands-index') {
        document = buildBrandsIndexSeoDocument({ brands: directory.brands })
      } else if (route.type === 'brand') {
        if (!brandPayloadCache.has(route.brandSlug)) {
          brandPayloadCache.set(
            route.brandSlug,
            buildBrandPayloadFromProducts(
              route.brandSlug,
              publicProducts,
              listingCountsByKey[
                directory.brands.find((brand) => brand.slug === route.brandSlug)?.key
              ] || 0,
            ),
          )
        }
        const payload = brandPayloadCache.get(route.brandSlug)
        if (!payload) {
          throw new Error(`No brand payload for ${route.brandSlug}`)
        }
        document = buildBrandPageSeoDocument(payload)
      } else if (route.type === 'equipment') {
        const product = publicProducts.find(
          (row) => row.canonical_product_key === route.canonicalProductKey,
        )
        if (!product) {
          throw new Error(`Missing product ${route.canonicalProductKey}`)
        }
        document = buildEquipmentPageSeoDocument({
          product,
          content: contentByProductId.get(product.id) || null,
          hasConsoleOptions: supportsProductConsoleOptions(product)
            && productIdsWithConsoles.has(product.id),
          imageUrl: getApprovedEquipmentImage(product),
        })
      }

      if (!document) {
        throw new Error(`No SEO document for ${route.path}`)
      }

      const html = injectSeoIntoHtml(templateHtml, document)
      const outPath = routePathToDistFile(document.path, distDir)

      if (!args.dryRun) {
        writeHtmlFile(outPath, html)
      }

      written.push({
        path: document.path,
        type: route.type,
        file: outPath,
        title: document.title,
      })
    } catch (error) {
      errors.push({ path: route.path, message: error.message })
      console.error(`[prerender] Failed ${route.path}:`, error.message)
    }
  }

  const manifest = {
    generatedAt: new Date().toISOString(),
    routeCount: written.length,
    brandCount: directory.brands.length,
    productCount: publicProducts.length,
    errorCount: errors.length,
    dryRun: args.dryRun,
    routes: written,
    errors,
  }

  const manifestPath = join(distDir, 'seo-prerender-manifest.json')
  if (!args.dryRun) {
    writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')
  }

  console.log(`[prerender] Wrote ${written.length} HTML files${args.dryRun ? ' (dry-run)' : ''}`)
  if (errors.length) {
    console.error(`[prerender] ${errors.length} errors`)
    process.exitCode = 1
  }
}

main().catch((error) => {
  console.error('[prerender] Fatal:', error)
  process.exit(1)
})
