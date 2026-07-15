#!/usr/bin/env node
/**
 * Replace equipment product images sourced from known high-risk dealer domains.
 *
 * Usage:
 *   node scripts/replace-high-risk-product-images.mjs --dry-run
 *   node scripts/replace-high-risk-product-images.mjs --brand "Life Fitness" --debug
 *   node scripts/replace-high-risk-product-images.mjs --brand "Life Fitness" --name-contains "Pro" --debug
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  assessEquipmentProductImageRisk,
  IMAGE_AUDIT_RISK,
} from '../src/lib/equipmentProductImageAudit.js'
import {
  buildEquipmentProductImageSearchQuery,
  buildEquipmentProductImageStoragePath,
  buildHighRiskReplacementManualReviewMetadata,
  buildReplacementImageImportMetadata,
  downloadFirstAvailableImageCandidate,
  EQUIPMENT_PRODUCT_IMAGES_BUCKET,
  analyzeHighRiskImageReplacement,
  filterHighRiskImageReplacementProducts,
  getHighRiskReplacementExcludedDomains,
  rankReplacementImageCandidates,
  resolveProductImageSourceDomain,
  summarizeImageCandidateFailures,
} from '../src/lib/equipmentProductImages.js'

const PRODUCT_FIELDS = [
  'id',
  'brand',
  'model',
  'canonical_product_name',
  'canonical_product_key',
  'baseline_manufacture_year',
  'original_base_price',
  'original_base_price_currency',
  'status',
  'image_url',
  'image_storage_path',
  'image_source_url',
  'image_source_domain',
  'image_confidence',
  'image_status',
  'image_failure_reason',
  'review_notes',
].join(', ')

function loadEnv() {
  const path = join(process.cwd(), '.env.local')
  const text = readFileSync(path, 'utf8')
  const env = {}
  for (const line of text.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const idx = trimmed.indexOf('=')
    if (idx === -1) continue
    env[trimmed.slice(0, idx)] = trimmed.slice(idx + 1)
  }
  return env
}

function parseArgs(argv) {
  const args = {
    brand: null,
    nameContains: null,
    dryRun: true,
    debug: false,
  }

  for (let index = 2; index < argv.length; index += 1) {
    const token = argv[index]
    if (token === '--apply') args.dryRun = false
    else if (token === '--dry-run') args.dryRun = true
    else if (token === '--debug') args.debug = true
    else if (token === '--brand') {
      args.brand = argv[index + 1] ?? null
      index += 1
    } else if (token === '--name-contains') {
      args.nameContains = argv[index + 1] ?? null
      index += 1
    }
  }

  return args
}

async function fetchProducts(supabase, { brandFilter, nameContains }) {
  let query = supabase
    .from('equipment_products')
    .select(PRODUCT_FIELDS)
    .order('brand')
    .order('canonical_product_name')

  if (brandFilter) {
    query = query.ilike('brand', brandFilter)
  }
  if (nameContains) {
    query = query.ilike('canonical_product_name', `%${nameContains}%`)
  }

  const { data, error } = await query
  if (error) throw error
  return data ?? []
}

async function searchImageCandidates(query, serpApiKey) {
  const url = new URL('https://serpapi.com/search.json')
  url.searchParams.set('engine', 'google_images')
  url.searchParams.set('q', query)
  url.searchParams.set('ijn', '0')
  url.searchParams.set('api_key', serpApiKey)

  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`SerpAPI image search failed (${response.status})`)
  }

  const payload = await response.json()
  return (payload.images_results ?? []).map((result) => ({
    title: result.title,
    sourceUrl: result.link,
    imageUrl: result.original,
    thumbnail: result.thumbnail,
    source: result.source,
    width: result.original_width,
    height: result.original_height,
  }))
}

async function deleteStoredImage(supabase, storagePath) {
  if (!storagePath) return
  const { error } = await supabase.storage
    .from(EQUIPMENT_PRODUCT_IMAGES_BUCKET)
    .remove([storagePath])
  if (error) throw error
}

async function uploadImage(supabase, product, buffer, contentType, extension) {
  const storagePath = buildEquipmentProductImageStoragePath(product, extension)
  const { error } = await supabase.storage
    .from(EQUIPMENT_PRODUCT_IMAGES_BUCKET)
    .upload(storagePath, buffer, {
      contentType,
      upsert: true,
    })

  if (error) throw error

  const { data } = supabase.storage
    .from(EQUIPMENT_PRODUCT_IMAGES_BUCKET)
    .getPublicUrl(storagePath)

  return {
    storagePath,
    publicUrl: data?.publicUrl ?? null,
  }
}

async function saveImageMetadata(supabase, productId, metadata) {
  const { error } = await supabase
    .from('equipment_products')
    .update({
      ...metadata,
      updated_at: new Date().toISOString(),
    })
    .eq('id', productId)

  if (error) throw error
}

function logCandidateFailure(productName, failure) {
  console.warn([
    `  candidate failed | ${productName}`,
    failure.imageUrl ?? 'unknown',
    failure.reason,
  ].join(' | '))
}

async function planReplacement(product, { serpApiKey }) {
  const currentDomain = resolveProductImageSourceDomain(product)
  const excludedDomains = getHighRiskReplacementExcludedDomains(product)
  const query = buildEquipmentProductImageSearchQuery(product)
  const candidates = await searchImageCandidates(query, serpApiKey)
  const ranked = rankReplacementImageCandidates(candidates, product, {
    excludedDomains,
  })

  if (!ranked.length) {
    return {
      product,
      currentDomain,
      replacementDomain: '—',
      willReplace: 'No',
      reason: 'No replacement candidate from manufacturer or allowlisted retailers',
      ranked: [],
    }
  }

  const best = ranked[0]
  return {
    product,
    currentDomain,
    replacementDomain: best.domain ?? '—',
    willReplace: 'Yes',
    reason: `Replacement from ${best.tier ?? 'allowlisted source'} (score ${best.score})`,
    ranked,
    best,
  }
}

async function applyReplacement(product, { supabase, serpApiKey }) {
  const pricingSnapshot = {
    original_base_price: product.original_base_price,
    baseline_manufacture_year: product.baseline_manufacture_year,
  }
  const currentDomain = resolveProductImageSourceDomain(product)
  const excludedDomains = getHighRiskReplacementExcludedDomains(product)

  if (product.image_storage_path) {
    await deleteStoredImage(supabase, product.image_storage_path)
  }

  const query = buildEquipmentProductImageSearchQuery(product)
  const candidates = await searchImageCandidates(query, serpApiKey)
  const ranked = rankReplacementImageCandidates(candidates, product, {
    excludedDomains,
  })
  const best = ranked[0] ?? null

  if (!best) {
    const metadata = buildHighRiskReplacementManualReviewMetadata(product)
    await saveImageMetadata(supabase, product.id, metadata)
    return { status: 'manual_review', metadata }
  }

  const downloadResult = await downloadFirstAvailableImageCandidate(ranked, {
    onCandidateFailure: (failure) => logCandidateFailure(product.canonical_product_name, failure),
  })

  if (!downloadResult.downloaded || !downloadResult.entry) {
    const metadata = buildHighRiskReplacementManualReviewMetadata(
      product,
      summarizeImageCandidateFailures(downloadResult.failures),
    )
    await saveImageMetadata(supabase, product.id, metadata)
    return { status: 'manual_review', metadata, failures: downloadResult.failures }
  }

  const { entry, downloaded } = downloadResult
  const uploaded = await uploadImage(
    supabase,
    product,
    downloaded.buffer,
    downloaded.contentType,
    downloaded.extension,
  )

  const metadata = buildReplacementImageImportMetadata({
    imageUrl: uploaded.publicUrl,
    storagePath: uploaded.storagePath,
    sourceUrl: entry.candidate.sourceUrl ?? entry.candidate.imageUrl,
    confidence: entry.score,
  })

  await saveImageMetadata(supabase, product.id, metadata)

  if (
    pricingSnapshot.original_base_price !== product.original_base_price
    || pricingSnapshot.baseline_manufacture_year !== product.baseline_manufacture_year
  ) {
    throw new Error('Pricing fields changed unexpectedly during image replacement')
  }

  return {
    status: 'replaced',
    metadata,
    candidate: {
      domain: metadata.image_source_domain,
      tier: entry.tier,
      score: entry.score,
    },
  }
}

function printPlanRow(plan) {
  console.log([
    plan.product.canonical_product_name,
    plan.currentDomain ?? '—',
    plan.replacementDomain ?? '—',
    plan.willReplace,
    plan.reason,
  ].join(' | '))
}

function printDebugSkippedProduct(product, analysis) {
  const audit = assessEquipmentProductImageRisk(product)
  const riskLevel = audit.riskLevel ?? analysis.riskClassification
  console.log([
    product.canonical_product_name,
    product.image_status ?? '—',
    product.image_source_domain ?? '—',
    product.image_source_url ?? '—',
    product.image_url ?? '—',
    riskLevel,
    analysis.skipReason ?? '—',
  ].join(' | '))
  if (analysis.signals?.length) {
    console.log(`  signals: ${analysis.signals.map((signal) => `${signal.field}:${signal.type}:${signal.detail}`).join('; ')}`)
  }
}

function printDealerAuditRow(product, analysis) {
  const audit = assessEquipmentProductImageRisk(product)
  const isDealer = audit.riskLevel === IMAGE_AUDIT_RISK.BLOCKED
    || audit.riskLevel === IMAGE_AUDIT_RISK.REVIEW
    || analysis.riskClassification !== 'clean'
  if (!isDealer) return false

  console.log([
    product.canonical_product_name,
    product.image_status ?? '—',
    product.image_source_domain ?? '—',
    product.image_source_url ?? '—',
    audit.riskLevel ?? analysis.riskClassification,
    analysis.eligible ? 'eligible' : `skipped:${analysis.skipReason}`,
  ].join(' | '))
  if (analysis.signals?.length) {
    console.log(`  signals: ${analysis.signals.map((signal) => `${signal.field}:${signal.type}:${signal.detail}`).join('; ')}`)
  }
  return true
}

async function main() {
  const args = parseArgs(process.argv)
  const env = loadEnv()
  const supabaseUrl = env.VITE_SUPABASE_URL ?? env.SUPABASE_URL
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY
  const serpApiKey = env.SERPAPI_API_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing VITE_SUPABASE_URL/SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  }
  if (!serpApiKey) {
    throw new Error('Missing SERPAPI_API_KEY in .env.local')
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const products = await fetchProducts(supabase, {
    brandFilter: args.brand,
    nameContains: args.nameContains,
  })
  const targets = filterHighRiskImageReplacementProducts(products)

  console.log(`Mode: ${args.dryRun ? 'dry-run' : 'apply'}${args.debug ? ' (debug)' : ''}`)
  if (args.brand) console.log(`Brand filter: ${args.brand}`)
  if (args.nameContains) console.log(`Name contains: ${args.nameContains}`)
  console.log(`Loaded ${products.length} products, ${targets.length} high-risk image targets`)

  if (args.debug) {
    const skipped = products
      .map((product) => ({ product, analysis: analyzeHighRiskImageReplacement(product) }))
      .filter(({ product, analysis }) => (
        Boolean(product.image_url || product.image_storage_path || product.image_source_url)
        && !analysis.eligible
      ))

    console.log('')
    console.log(`Debug skipped images: ${skipped.length}`)
    console.log(['Product', 'image_status', 'image_source_domain', 'image_source_url', 'image_url', 'risk classification', 'skip reason'].join(' | '))
    for (const { product, analysis } of skipped) {
      printDebugSkippedProduct(product, analysis)
    }

    const dealerProducts = products
      .map((product) => ({ product, analysis: analyzeHighRiskImageReplacement(product) }))
      .filter(({ product }) => Boolean(product.image_url || product.image_source_url))

    console.log('')
    console.log('Dealer/watermark audit:')
    console.log(['Product', 'image_status', 'image_source_domain', 'image_source_url', 'risk', 'replacement status'].join(' | '))
    let dealerCount = 0
    for (const { product, analysis } of dealerProducts) {
      if (printDealerAuditRow(product, analysis)) dealerCount += 1
    }
    console.log(`Dealer/watermark products found: ${dealerCount}`)
    console.log('')
  }

  if (targets.length > 0) {
    console.log('')
    console.log(['Product', 'Current domain', 'Replacement domain', 'Will replace', 'Reason'].join(' | '))
  } else if (!args.debug) {
    console.log('')
    console.log('No eligible replacement targets in current filter.')
  }

  const summary = {
    productsChecked: 0,
    imagesReplaced: 0,
    stillMissing: 0,
    manualReviewRequired: 0,
  }

  for (const product of targets) {
    summary.productsChecked += 1
    try {
      const plan = await planReplacement(product, { serpApiKey })
      printPlanRow(plan)

      if (args.dryRun) {
        if (plan.willReplace === 'Yes') summary.imagesReplaced += 1
        else {
          summary.stillMissing += 1
          summary.manualReviewRequired += 1
        }
        continue
      }

      const result = await applyReplacement(product, { supabase, serpApiKey })
      if (result.status === 'replaced') {
        summary.imagesReplaced += 1
      } else {
        summary.stillMissing += 1
        summary.manualReviewRequired += 1
      }
    } catch (error) {
      summary.stillMissing += 1
      summary.manualReviewRequired += 1
      console.error(`FAILED ${product.canonical_product_name}: ${error.message}`)
      if (!args.dryRun) {
        const metadata = buildHighRiskReplacementManualReviewMetadata(product, error.message)
        await saveImageMetadata(supabase, product.id, metadata)
      }
    }
  }

  console.log('')
  console.log('Summary:')
  console.log(`Products checked: ${summary.productsChecked}`)
  console.log(`Images replaced: ${summary.imagesReplaced}`)
  console.log(`Still missing: ${summary.stillMissing}`)
  console.log(`Manual review required: ${summary.manualReviewRequired}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
