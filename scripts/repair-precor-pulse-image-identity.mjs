#!/usr/bin/env node
/**
 * Clear Precor approved images that fail strict identity / source checks.
 * Keeps official Precor product pages that match Discovery/Experience/etc.
 *
 * Usage:
 *   node scripts/repair-precor-pulse-image-identity.mjs --brand Precor --dry-run
 *   node scripts/repair-precor-pulse-image-identity.mjs --brand Precor --apply
 */
import { createClient } from '@supabase/supabase-js'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { compareProductIdentity, identityTokenPresent } from '../src/lib/equipmentProductImageIdentity.js'
import { EQUIPMENT_PRODUCT_IMAGE_STATUS } from '../src/lib/equipmentProductImages.js'

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
  const args = { dryRun: true, apply: false, brand: 'Precor' }
  for (let i = 2; i < argv.length; i += 1) {
    if (argv[i] === '--apply') {
      args.apply = true
      args.dryRun = false
    } else if (argv[i] === '--dry-run') {
      args.dryRun = true
      args.apply = false
    } else if (argv[i] === '--brand') {
      args.brand = argv[i + 1]
      i += 1
    }
  }
  return args
}

function isOfficialPrecorProductPage(url) {
  return /precor\.com\/[^?\s]*\/products\/([A-Z]{2,4}\d{2,4}i?)\b/i.test(String(url || ''))
}

function isOfficialPulseProductPage(url) {
  return /pulsefitness\.com\/product\//i.test(String(url || ''))
}

function isCategoryOrCampaignPage(url) {
  const value = String(url || '')
  return /precor\.com\/[^?\s]*\/(strength|selectorized|plate-loaded|glutebuilder|core-and-stretching|cardio\/ellipticals|commercial-club|season-of-strength)(\/|$|\?)/i
    .test(value)
    || /\/ellipticals\/\d+-line(\/|$|\?)/i.test(value)
    || /\/products\/?$/i.test(value)
}

/** Discovery/Vitality/Resolute official SKU pages where product name has line prefix but not full SKU. */
function strengthSkuPrefixMatches(product, sourceUrl) {
  const name = [
    product.canonical_product_name,
    product.product_family,
    product.model,
  ].filter(Boolean).join(' ')
  const match = String(sourceUrl || '').match(/\/products\/((?:DBR|DPL|DSL|VBR|VSL|RSL)\d{3,4})\b/i)
  if (!match) return false
  const prefix = match[1].slice(0, 3).toUpperCase()
  if (/\bdbr\b/i.test(name) && prefix === 'DBR') return true
  if (/\bdpl\b/i.test(name) && prefix === 'DPL') return true
  if (/\bdsl\b/i.test(name) && prefix === 'DSL') return true
  if (/\b(vitality|s-line|s line)\b/i.test(name) && (prefix === 'VBR' || prefix === 'VSL')) return true
  if (/\bresolute\b/i.test(name) && prefix === 'RSL') return true
  return false
}

async function main() {
  const args = parseArgs(process.argv)
  const env = loadEnv()
  const supabase = createClient(
    env.VITE_SUPABASE_URL || env.SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )

  const products = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from('equipment_products')
      .select('id, brand, product_family, model, equipment_type, canonical_product_name, image_url, image_source_url, image_source_domain, image_status')
      .ilike('brand', args.brand)
      .eq('status', 'approved')
      .eq('image_status', 'approved')
      .range(from, from + 999)
    if (error) throw error
    products.push(...(data ?? []))
    if ((data ?? []).length < 1000) break
  }

  const toClear = []
  const toKeep = []

  for (const product of products) {
    // Never use our stored image_url/filename as identity evidence — it echoes the
    // product name and falsely "proves" exact matches against wrong source pages.
    const sourceHaystack = [product.image_source_url, product.image_source_domain]
      .filter(Boolean)
      .join(' ')
    const candidate = {
      title: sourceHaystack,
      sourceUrl: product.image_source_url,
    }
    const identity = compareProductIdentity(product, candidate)
    const hasSeriesMatch = (identity.matched || []).some((entry) => entry.type === 'family')
    const hasModelCodeMatch = (identity.matched || []).some((entry) => entry.type === 'model_code')
    const officialProduct = isOfficialPrecorProductPage(product.image_source_url)
      || isOfficialPulseProductPage(product.image_source_url)
    const wrongBrand = identity.hasConflict
      && (identity.conflicts || []).some((entry) => entry.type === 'brand')
    const categoryPage = isCategoryOrCampaignPage(product.image_source_url)
    const seriesBound = (identity.target?.precorSeries || []).length
      || (identity.target?.pulseSeries || []).length

    let reason = null
    const source = String(product.image_source_url || '')
    if (/rotary\s*hip/i.test(product.canonical_product_name) && /lat[\s\-]*pull/i.test(source)) {
      reason = 'wrong_product_lat_pulldown_for_rotary_hip'
    } else if (/hip\s*adductor/i.test(product.canonical_product_name) && /\babductor\b/i.test(source) && !/\badductor\b/i.test(source)) {
      reason = 'wrong_product_abductor_for_adductor'
    } else if (/\bdip\b/i.test(product.canonical_product_name)
      && /chin|assist/i.test(product.canonical_product_name)
      && /pec[\s\-]*fly|rear[\s\-]*delt/i.test(source)
      && !/\bdip\b|\bchin\b|\bassist\b/i.test(source)) {
      reason = 'wrong_product_pec_fly_for_dip_assist'
    } else if (/power\s*rack/i.test(product.canonical_product_name) && /DBR0611/i.test(source)) {
      reason = 'wrong_sku_half_rack_for_power_rack'
    } else if (/weight\s*tree/i.test(product.canonical_product_name) && /DBR0816/i.test(source)) {
      reason = 'wrong_sku_barbell_rack_for_weight_tree'
    } else if (/barbell\s*rack/i.test(product.canonical_product_name) && /weight\s*tree/i.test(source)) {
      reason = 'wrong_sku_weight_tree_for_barbell_rack'
    }

    if (!reason && (wrongBrand || /\b(lifefitness|matrixfitness|hammer-strength|hammer\s*strength)\b/i.test(sourceHaystack))) {
      reason = 'wrong_brand_source'
    } else if (!reason && identity.hasConflict) {
      const onlyBenignTypeConflict = (identity.conflicts || []).every((entry) => (
        entry.type === 'equipment_type'
        && /bench/i.test(String(entry.token || ''))
        && /bench/i.test(product.canonical_product_name || '')
      ))
      if (!onlyBenignTypeConflict) {
        reason = `conflict:${(identity.conflicts || []).map((entry) => `${entry.type}:${entry.token}`).join(',')}`
      }
    } else if (!reason && categoryPage) {
      reason = 'category_landing_page'
    } else if (!reason && (identity.target?.modelCodes || []).length && !hasModelCodeMatch) {
      reason = 'missing_model_code_match'
    } else if (!reason && officialProduct && (
      hasModelCodeMatch
      || strengthSkuPrefixMatches(product, source)
    )) {
      // Official Precor product SKU pages kept when model code or strength line prefix matches.
      toKeep.push({
        id: product.id,
        name: product.canonical_product_name,
        source: product.image_source_url,
      })
      continue
    } else if (!reason && hasModelCodeMatch && !identity.hasConflict) {
      // Exact model/SKU match is sufficient even when the source omits the series word.
      toKeep.push({
        id: product.id,
        name: product.canonical_product_name,
        source: product.image_source_url,
      })
      continue
    } else if (!reason && seriesBound && !hasSeriesMatch) {
      reason = 'missing_series_match'
    } else if (!reason && identity.evidenceLevel === 'family' && hasSeriesMatch) {
      const model = String(product.model || '').trim()
      const name = String(product.canonical_product_name || '').trim()
      if ((model && identityTokenPresent(source, model))
        || (name && identityTokenPresent(source, name))) {
        toKeep.push({
          id: product.id,
          name: product.canonical_product_name,
          source: product.image_source_url,
        })
        continue
      }
      // Keep series-matched retailer pages that include a distinctive exercise token.
      const exerciseTokens = model
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter((token) => token.length >= 4 && !['precor', 'press', 'machine', 'series', 'strength', 'pulse'].includes(token))
      const matchedTokens = exerciseTokens.filter((token) => source.toLowerCase().includes(token))
      if (matchedTokens.length >= 1 && exerciseTokens.length <= 2
        || matchedTokens.length >= 2
        || (matchedTokens.length >= 1 && matchedTokens.some((token) => token.length >= 6))) {
        toKeep.push({
          id: product.id,
          name: product.canonical_product_name,
          source: product.image_source_url,
        })
        continue
      }
      reason = `weak_identity:${identity.evidenceLevel}`
    } else if (!reason && identity.evidenceLevel !== 'exact') {
      reason = `weak_identity:${identity.evidenceLevel}`
    } else if (!reason && /c-line/i.test(product.canonical_product_name) && !/c[-\s]?line/i.test(source)) {
      reason = 'c_line_without_c_line_source'
    } else if (!reason && /c-line/i.test(product.canonical_product_name)
      && /\b(infinity|competition|vitality|discovery|icarian|resolute|s-line)\b/i.test(source)
      && !/c[-\s]?line/i.test(source)) {
      reason = 'c_line_wrong_series_source'
    } else if (!reason && /\/collections\//i.test(source)) {
      reason = 'collection_landing_page'
    } else if (!reason && /\/cardio\/precor-bikes(\/|$|\?)/i.test(source)) {
      reason = 'category_landing_page'
    } else if (!reason && /all-about-glutebuilder|glutebuilder/i.test(source) && !/\/products\//i.test(source)) {
      reason = 'category_landing_page'
    } else if (!reason && /icarian/i.test(product.canonical_product_name)
      && /\b(competition|infinity|vitality|discovery|c-line|resolute)\b/i.test(source)
      && !/\bicarian\b/i.test(source)) {
      reason = 'icarian_wrong_series_source'
    } else if (!reason && /triceps?\s*extension/i.test(product.canonical_product_name)
      && /back\s*extension/i.test(source)
      && !/triceps?/i.test(source)) {
      reason = 'wrong_product_back_extension_for_triceps'
    }

    if (reason) {
      toClear.push({
        id: product.id,
        name: product.canonical_product_name,
        source: product.image_source_url,
        reason,
      })
    } else {
      toKeep.push({
        id: product.id,
        name: product.canonical_product_name,
        source: product.image_source_url,
      })
    }
  }

  mkdirSync(join(process.cwd(), 'reports'), { recursive: true })
  writeFileSync(
    join(process.cwd(), 'reports', 'repair-precor-pulse-image-identity.json'),
    `${JSON.stringify({
      mode: args.dryRun ? 'dry-run' : 'apply',
      brand: args.brand,
      checked: products.length,
      clear: toClear.length,
      keep: toKeep.length,
      toClear,
      toKeep,
    }, null, 2)}\n`,
  )

  console.log(`Mode: ${args.dryRun ? 'dry-run' : 'apply'}`)
  console.log(`Checked: ${products.length} | keep: ${toKeep.length} | clear: ${toClear.length}`)
  console.log('KEEP:')
  for (const row of toKeep) console.log(`  ${row.name} | ${row.source}`)
  console.log('CLEAR:')
  for (const row of toClear) console.log(`  ${row.name} | ${row.reason} | ${row.source}`)

  if (args.dryRun) {
    console.log('Dry-run only. Pass --apply to clear.')
    return
  }

  for (const row of toClear) {
    const { error } = await supabase
      .from('equipment_products')
      .update({
        image_url: null,
        image_storage_path: null,
        image_source_url: null,
        image_source_domain: null,
        image_confidence: null,
        image_status: EQUIPMENT_PRODUCT_IMAGE_STATUS.MISSING,
        image_failure_reason: `identity_repair:${row.reason}`,
        image_updated_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', row.id)
    if (error) throw error
  }
  console.log(`Cleared ${toClear.length} images.`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
