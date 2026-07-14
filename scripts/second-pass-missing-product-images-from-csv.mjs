#!/usr/bin/env node
/**
 * Second-pass CSV image search dry-run with hardened identity matching.
 *
 * Scope: remaining Technogym + all missing Hammer Strength + remaining Pulse
 * from the completed research CSV. Does NOT save candidates.
 *
 * Usage:
 *   node scripts/second-pass-missing-product-images-from-csv.mjs \
 *     --csv "C:/Users/jlinn/Downloads/equipd-product-research-import-ready-2026-07-14 (1).csv" \
 *     --delay-ms 1000
 */

import { createClient } from '@supabase/supabase-js'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import {
  buildEquipmentProductImageSearchQueries,
  EQUIPMENT_PRODUCT_IMAGE_STATUS,
  normalizeImageSourceDomain,
  productHasDisplayableImage,
} from '../src/lib/equipmentProductImages.js'
import {
  isManufacturerImageSourceDomain,
  isConditionalRetailerImageDomain,
  MANUFACTURER_IMAGE_SOURCE_DOMAINS,
  SUGGESTED_RETAILER_IMAGE_SOURCE_DOMAINS,
  CONDITIONAL_RETAILER_IMAGE_DOMAINS,
} from '../src/lib/equipmentProductImageDomains.js'
import {
  evaluateHardenedImageCandidate,
  collectSharedImageCollisions,
  filterRowsForSharedImageCollisions,
  normalizeSharedImageKey,
} from '../src/lib/equipmentProductImageHardening.js'
import {
  isHammerStrengthBrand,
  partitionHammerStrengthQueries,
  rankHammerStrengthImageCandidates,
} from '../src/lib/hammerStrengthProductImageSearch.js'
import { parseResearchCsv } from '../src/lib/equipmentProductResearchCsv.js'

const REPORTS_DIR = join(process.cwd(), 'reports')
const REPORT_JSON = join(REPORTS_DIR, 'second-pass-missing-product-images-report.json')
const REPORT_MD = join(REPORTS_DIR, 'second-pass-missing-product-images-report.md')

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
].join(', ')

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
    csv: null,
    delayMs: 1000,
    maxQueries: 5,
    limit: null,
  }
  for (let i = 2; i < argv.length; i += 1) {
    const token = argv[i]
    if (token === '--csv') {
      args.csv = argv[++i]
    } else if (token === '--delay-ms') {
      args.delayMs = Number(argv[++i] ?? 1000)
    } else if (token === '--max-queries') {
      args.maxQueries = Number(argv[++i] ?? 5)
    } else if (token === '--limit') {
      args.limit = Number(argv[++i] ?? NaN)
    }
  }
  if (!args.csv) throw new Error('--csv is required')
  return args
}

function sleep(ms) {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, ms))
}

function brandInScope(brand) {
  const text = String(brand || '').toLowerCase()
  return text.includes('technogym') || text.includes('hammer') || text.includes('pulse')
}

function needsSecondPass(product) {
  if (productHasDisplayableImage(product)) return false
  const status = String(product?.image_status || '').toLowerCase()
  // Keep existing good pending suggestions untouched; search only missing/rejected/failed.
  if (status === EQUIPMENT_PRODUCT_IMAGE_STATUS.SUGGESTED && product?.image_url) return false
  return true
}

async function fetchProductsByIds(supabase, ids) {
  const unique = [...new Set(ids)]
  const rows = []
  for (let i = 0; i < unique.length; i += 100) {
    const batch = unique.slice(i, i + 100)
    const { data, error } = await supabase
      .from('equipment_products')
      .select(PRODUCT_FIELDS)
      .in('id', batch)
    if (error) throw error
    rows.push(...(data || []))
  }
  return new Map(rows.map((row) => [row.id, row]))
}

async function searchImageCandidates(query, serpApiKey) {
  const url = new URL('https://serpapi.com/search.json')
  url.searchParams.set('engine', 'google_images')
  url.searchParams.set('q', query)
  url.searchParams.set('ijn', '0')
  url.searchParams.set('api_key', serpApiKey)
  const response = await fetch(url)
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    const message = payload?.error || `SerpAPI image search failed (${response.status})`
    const error = new Error(message)
    error.quotaExhausted = /quota|credit|limit|exhausted|billing/i.test(String(message))
      || response.status === 429
      || response.status === 402
    throw error
  }
  if (payload?.error) {
    const error = new Error(payload.error)
    error.quotaExhausted = /quota|credit|limit|exhausted|billing/i.test(String(payload.error))
    throw error
  }
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

function manufacturerSiteForBrand(brand) {
  const key = String(brand || '').trim().toLowerCase()
  const map = {
    technogym: 'technogym.com',
    'pulse fitness': 'pulsefitness.com',
    pulse: 'pulsefitness.com',
    'hammer strength': 'lifefitness.com',
  }
  return map[key] ?? null
}

function partitionGenericQueries(product, maxQueries) {
  const queries = buildEquipmentProductImageSearchQueries(product)
  const site = manufacturerSiteForBrand(product?.brand)
  const manufacturer = []
  const dealer = []
  for (const query of queries) {
    if (/\bsite:/i.test(query) || (site && String(query).toLowerCase().includes(site))) {
      manufacturer.push(query)
    } else {
      dealer.push(query)
    }
  }
  if (!manufacturer.length && queries[0]) manufacturer.push(queries[0])
  for (const domain of [...SUGGESTED_RETAILER_IMAGE_SOURCE_DOMAINS, ...CONDITIONAL_RETAILER_IMAGE_DOMAINS].slice(0, 4)) {
    const needle = product?.model || product?.canonical_product_name
    if (needle) dealer.push(`site:${domain} "${needle}"`)
  }
  return {
    manufacturerQueries: manufacturer.slice(0, Math.max(2, Math.ceil(maxQueries / 2))),
    dealerQueries: dealer.slice(0, Math.max(2, maxQueries)),
  }
}

function hardenAndRank(candidates, product, { hammerMode = false } = {}) {
  const scored = candidates.map((candidate) => {
    const gate = evaluateHardenedImageCandidate(product, candidate, { hammerMode })
    return {
      candidate,
      score: gate.eligible
        ? (gate.identityResult?.evidenceLevel === 'exact' ? 90 : 65)
        : 0,
      rejection: gate.eligible ? null : { reject: true, reason: gate.reason },
      confidenceBand: gate.status === 'high_confidence'
        ? 'high_confidence'
        : gate.status === 'medium_confidence'
          ? 'suggested'
          : gate.eligible
            ? 'needs_review'
            : 'rejected',
      domain: gate.domain || normalizeImageSourceDomain(candidate.sourceUrl),
      identity: gate.identityResult,
      identityEvidence: gate.identityEvidence,
      channelScores: gate.channelScores,
      pendingEligible: gate.pendingEligible,
      hardenedStatus: gate.status,
      hardenedReason: gate.reason,
    }
  })

  return scored
    .filter((entry) => entry.score > 0 && !entry.rejection?.reject)
    .sort((a, b) => b.score - a.score)
}

async function searchProduct(product, serpApiKey, maxQueries) {
  const hammerMode = isHammerStrengthBrand(product?.brand)
  const byImageUrl = new Map()
  const usedQueries = []
  let serpApiCalls = 0
  let phaseUsed = null
  const rejectedFamily = []

  const phases = hammerMode
    ? (() => {
      const parts = partitionHammerStrengthQueries(product, maxQueries)
      return [
        { name: 'manufacturer', queries: parts.manufacturerQueries },
        { name: 'archive', queries: parts.archiveQueries },
        { name: 'dealer', queries: parts.dealerQueries },
      ]
    })()
    : (() => {
      const parts = partitionGenericQueries(product, maxQueries)
      return [
        { name: 'manufacturer', queries: parts.manufacturerQueries },
        { name: 'dealer', queries: parts.dealerQueries },
      ]
    })()

  for (const phase of phases) {
    for (const query of phase.queries) {
      usedQueries.push(query)
      serpApiCalls += 1
      const candidates = await searchImageCandidates(query, serpApiKey)
      for (const candidate of candidates) {
        const key = candidate.imageUrl || candidate.sourceUrl
        if (!key || byImageUrl.has(key)) continue
        byImageUrl.set(key, { ...candidate, searchQuery: query, searchPhase: phase.name })
      }

      // Collect family-conflict rejects for reporting.
      for (const candidate of candidates) {
        const gate = evaluateHardenedImageCandidate(product, candidate, { hammerMode })
        if (gate.reason === 'conflicting_product_family_or_identity') {
          rejectedFamily.push({
            title: candidate.title,
            source_url: candidate.sourceUrl,
            image_url: candidate.imageUrl,
            domain: gate.domain,
            conflicts: gate.identityEvidence?.conflicts || [],
            reason: gate.reason,
          })
        }
      }

      const ranked = hammerMode
        ? rankHammerStrengthImageCandidates([...byImageUrl.values()], product)
        : hardenAndRank([...byImageUrl.values()], product, { hammerMode })

      const phaseFiltered = ranked.filter((entry) => {
        if (phase.name === 'manufacturer') {
          return isManufacturerImageSourceDomain(entry.domain)
            || MANUFACTURER_IMAGE_SOURCE_DOMAINS.some((d) => String(entry.domain || '').endsWith(d))
        }
        if (phase.name === 'dealer') {
          return isConditionalRetailerImageDomain(entry.domain)
            || !isManufacturerImageSourceDomain(entry.domain)
        }
        return true
      })

      const usable = (phaseFiltered.length ? phaseFiltered : (phase.name === 'manufacturer' ? [] : ranked))
        .filter((entry) => entry.pendingEligible || entry.confidenceBand === 'suggested')

      if (usable.length) {
        phaseUsed = phase.name
        return {
          queries: usedQueries,
          serpApiCalls,
          phaseUsed,
          ranked: usable,
          rejectedFamily,
          candidates: [...byImageUrl.values()],
        }
      }
    }
  }

  // Fall back to any hardened-eligible (even needs_review) for reporting medium buckets.
  const rankedAll = hammerMode
    ? rankHammerStrengthImageCandidates([...byImageUrl.values()], product)
    : hardenAndRank([...byImageUrl.values()], product, { hammerMode })

  return {
    queries: usedQueries,
    serpApiCalls,
    phaseUsed,
    ranked: rankedAll,
    rejectedFamily,
    candidates: [...byImageUrl.values()],
  }
}

function bucketForEntry(entry) {
  if (entry.pendingEligible && entry.identity?.evidenceLevel === 'exact') return 'high'
  if (entry.confidenceBand === 'high_confidence') return 'high'
  if (entry.pendingEligible || entry.confidenceBand === 'suggested' || entry.identity?.evidenceLevel === 'family') {
    return 'medium'
  }
  return 'low'
}

function buildMarkdown(report) {
  const s = report.summary
  const lines = [
    '# Second-pass missing product images (dry-run, no save)',
    '',
    `- Generated: ${report.generated_at}`,
    `- CSV: \`${report.csv}\``,
    `- Auto-approve: false`,
    `- Saved candidates: 0 (dry-run only)`,
    '',
    '## Summary',
    '',
    `| Metric | Count |`,
    `| --- | ---: |`,
    `| Products queued | ${s.queued} |`,
    `| Searched | ${s.searched} |`,
    `| Exact high-confidence | ${s.high_confidence} |`,
    `| Medium-confidence | ${s.medium_confidence} |`,
    `| Rejected family conflicts (rows with conflict sample) | ${s.family_conflict_rows} |`,
    `| Shared-image collision groups | ${s.shared_image_collision_groups} |`,
    `| Still without candidates | ${s.still_without_candidates} |`,
    `| Failed searches | ${s.failed_searches} |`,
    `| SerpAPI calls | ${s.serp_api_calls} |`,
    '',
    '## By brand',
    '',
  ]
  for (const [brand, counts] of Object.entries(s.by_brand || {})) {
    lines.push(`- **${brand}**: searched ${counts.searched}, high ${counts.high}, medium ${counts.medium}, none ${counts.none}, failed ${counts.failed}`)
  }

  lines.push('', '## Exact high-confidence candidates', '')
  for (const row of report.queues.high.slice(0, 40)) {
    lines.push(`### ${row.canonical_product_name}`)
    lines.push(`- Query: \`${(row.search_queries || [])[0] || ''}\``)
    lines.push(`- Phase: ${row.search_phase}`)
    lines.push(`- Domain: ${row.candidate_domain}`)
    lines.push(`- Source: ${row.candidate_source_url}`)
    lines.push(`- Image: ${row.candidate_image_url}`)
    lines.push(`- Evidence: ${JSON.stringify(row.identity_evidence)}`)
    lines.push('')
  }

  lines.push('## Medium-confidence candidates', '')
  for (const row of report.queues.medium.slice(0, 40)) {
    lines.push(`- **${row.canonical_product_name}** | ${row.candidate_domain} | ${row.candidate_source_url}`)
  }

  lines.push('', '## Rejected family conflicts (sample)', '')
  for (const row of report.queues.family_conflicts.slice(0, 40)) {
    lines.push(`- **${row.canonical_product_name}**: ${row.conflict_sample?.source_url || ''} (${JSON.stringify(row.conflict_sample?.conflicts || [])})`)
  }

  lines.push('', '## Shared-image collision groups', '')
  if (!report.shared_image_collisions.length) lines.push('_None_')
  for (const group of report.shared_image_collisions.slice(0, 30)) {
    lines.push(`- \`${group.image_url}\` → ${group.products.map((p) => p.canonical_product_name).join(' | ')}`)
  }

  lines.push('', '## Still without candidates', '')
  for (const row of report.queues.still_without_candidates.slice(0, 80)) {
    lines.push(`- ${row.brand} | ${row.canonical_product_name} | ${row.outcome}${row.rejection_reason ? ` (${row.rejection_reason})` : ''}`)
  }
  lines.push('')
  return `${lines.join('\n')}\n`
}

async function main() {
  const args = parseArgs(process.argv)
  const env = loadEnv()
  const csvPath = resolve(process.cwd(), args.csv)
  if (!existsSync(csvPath)) throw new Error(`CSV not found: ${csvPath}`)
  if (!env.SERPAPI_API_KEY) throw new Error('Missing SERPAPI_API_KEY')

  const supabase = createClient(
    env.VITE_SUPABASE_URL || env.SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )

  const parsed = parseResearchCsv(readFileSync(csvPath, 'utf8'))
  if (parsed.error) throw parsed.error
  const ids = parsed.rows.map((row) => String(row.product_id || '').trim()).filter(Boolean)
  const productsById = await fetchProductsByIds(supabase, ids)

  let queue = []
  for (const id of [...new Set(ids)]) {
    const product = productsById.get(id)
    if (!product) continue
    if (!brandInScope(product.brand)) continue
    if (!needsSecondPass(product)) continue
    queue.push(product)
  }
  if (args.limit) queue = queue.slice(0, args.limit)

  console.log(`Second-pass queue: ${queue.length}`)
  console.log('Mode: dry-run only (no saves)')

  const results = []
  const summary = {
    queued: queue.length,
    searched: 0,
    high_confidence: 0,
    medium_confidence: 0,
    family_conflict_rows: 0,
    shared_image_collision_groups: 0,
    still_without_candidates: 0,
    failed_searches: 0,
    serp_api_calls: 0,
    by_brand: {},
  }

  for (const product of queue) {
    const brand = product.brand || '(none)'
    if (!summary.by_brand[brand]) {
      summary.by_brand[brand] = { searched: 0, high: 0, medium: 0, none: 0, failed: 0 }
    }

    let search
    try {
      search = await searchProduct(product, env.SERPAPI_API_KEY, args.maxQueries)
    } catch (error) {
      if (error.quotaExhausted) {
        console.error(`Quota exhausted at ${product.canonical_product_name}`)
        break
      }
      summary.failed_searches += 1
      summary.by_brand[brand].failed += 1
      summary.searched += 1
      summary.by_brand[brand].searched += 1
      summary.serp_api_calls += 1
      results.push({
        product_id: product.id,
        brand: product.brand,
        canonical_product_name: product.canonical_product_name,
        equipment_type: product.equipment_type,
        outcome: 'failed_search',
        rejection_reason: error.message,
      })
      console.log(`failed_search | ${product.canonical_product_name}`)
      if (args.delayMs) await sleep(args.delayMs)
      continue
    }

    summary.searched += 1
    summary.by_brand[brand].searched += 1
    summary.serp_api_calls += search.serpApiCalls

    const best = search.ranked[0]
    const familySample = search.rejectedFamily[0] || null
    if (familySample) summary.family_conflict_rows += 1

    if (!best) {
      summary.still_without_candidates += 1
      summary.by_brand[brand].none += 1
      results.push({
        product_id: product.id,
        brand: product.brand,
        canonical_product_name: product.canonical_product_name,
        equipment_type: product.equipment_type,
        outcome: 'no_suitable_candidate',
        search_queries: search.queries,
        search_phase: search.phaseUsed,
        serp_api_calls: search.serpApiCalls,
        conflict_sample: familySample,
        rejection_reason: 'no_hardened_candidate',
      })
      console.log(`no_suitable_candidate | ${product.canonical_product_name}`)
      if (args.delayMs) await sleep(args.delayMs)
      continue
    }

    const bucket = bucketForEntry(best)
    if (bucket === 'high') {
      summary.high_confidence += 1
      summary.by_brand[brand].high += 1
    } else if (bucket === 'medium') {
      summary.medium_confidence += 1
      summary.by_brand[brand].medium += 1
    } else {
      summary.still_without_candidates += 1
      summary.by_brand[brand].none += 1
    }

    results.push({
      product_id: product.id,
      brand: product.brand,
      canonical_product_name: product.canonical_product_name,
      equipment_type: product.equipment_type,
      outcome: bucket === 'high'
        ? 'exact_high_confidence'
        : bucket === 'medium'
          ? 'medium_confidence'
          : 'insufficient_after_hardening',
      confidence_bucket: bucket,
      search_phase: search.phaseUsed,
      search_queries: search.queries,
      serp_api_calls: search.serpApiCalls,
      candidate_title: best.candidate?.title,
      candidate_source_url: best.candidate?.sourceUrl,
      candidate_image_url: best.candidate?.imageUrl,
      candidate_domain: best.domain,
      candidate_score: best.score,
      identity_evidence: best.identityEvidence,
      channel_scores: best.channelScores,
      pending_eligible: best.pendingEligible,
      conflict_sample: familySample,
      hammer_mode: isHammerStrengthBrand(product.brand),
      dry_run: true,
      would_save: false,
    })

    console.log(`${bucket} | ${product.canonical_product_name} | ${best.domain || ''}`)
    if (args.delayMs) await sleep(args.delayMs)
  }

  const foundRows = results.filter((row) => row.candidate_image_url)
  const collisionReview = filterRowsForSharedImageCollisions(foundRows)
  summary.shared_image_collision_groups = collisionReview.collisions.length

  // Downgrade collision members out of high queue for the report.
  const blocked = new Set(
    collisionReview.rejected.map((row) => `${row.product_id}::${normalizeSharedImageKey(row.candidate_image_url)}`),
  )
  for (const row of results) {
    const key = `${row.product_id}::${normalizeSharedImageKey(row.candidate_image_url)}`
    if (blocked.has(key) && row.confidence_bucket === 'high') {
      row.confidence_bucket = 'medium'
      row.outcome = 'shared_image_collision_needs_review'
      row.rejection_reason = 'same_source_image_assigned_to_distinct_canonical_models'
      summary.high_confidence = Math.max(0, summary.high_confidence - 1)
      summary.medium_confidence += 1
    }
  }

  const report = {
    generated_at: new Date().toISOString(),
    mode: 'second_pass_dry_run',
    csv: csvPath,
    auto_approve: false,
    saves_candidates: false,
    summary,
    shared_image_collisions: collectSharedImageCollisions(foundRows),
    queues: {
      high: results.filter((row) => row.confidence_bucket === 'high'),
      medium: results.filter((row) => row.confidence_bucket === 'medium' || row.outcome === 'shared_image_collision_needs_review'),
      family_conflicts: results.filter((row) => row.conflict_sample),
      still_without_candidates: results.filter((row) => (
        row.outcome === 'no_suitable_candidate'
        || row.outcome === 'failed_search'
        || row.outcome === 'insufficient_after_hardening'
      )),
    },
    results,
  }

  mkdirSync(REPORTS_DIR, { recursive: true })
  writeFileSync(REPORT_JSON, `${JSON.stringify(report, null, 2)}\n`)
  writeFileSync(REPORT_MD, buildMarkdown(report))

  console.log('')
  console.log('Summary')
  console.log(`  queued: ${summary.queued}`)
  console.log(`  high: ${summary.high_confidence}`)
  console.log(`  medium: ${summary.medium_confidence}`)
  console.log(`  family-conflict rows: ${summary.family_conflict_rows}`)
  console.log(`  shared-image groups: ${summary.shared_image_collision_groups}`)
  console.log(`  still without candidates: ${summary.still_without_candidates}`)
  console.log(`Wrote ${REPORT_JSON}`)
  console.log(`Wrote ${REPORT_MD}`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
