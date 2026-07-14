#!/usr/bin/env node
/**
 * Build the final conservative safe-apply set from second-pass dry-run highs.
 * Writes the review table; does not save images.
 */
import { createClient } from '@supabase/supabase-js'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  isBlockedImageSourceDomain,
  isBlockedImageSourceUrl,
  isManufacturerImageSourceDomain,
  isSuggestedRetailerImageSourceDomain,
  isConditionalRetailerImageDomain,
  getImageSourceDomainFromCandidate,
} from '../src/lib/equipmentProductImageDomains.js'
import {
  evaluateHardenedImageCandidate,
  collectSharedImageCollisions,
  normalizeSharedImageKey,
  rejectGenericOrUnsuitableImageCandidate,
} from '../src/lib/equipmentProductImageHardening.js'
import { isHammerStrengthBrand } from '../src/lib/hammerStrengthProductImageSearch.js'

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

const BLOCKED_RE = /instagram|facebook|fbcdn|youtube|youtu\.be|ebay|usedgym|equip4gyms|uzed|gumtree|marketplace|lookaside/i
const WATERMARK_RE = /watermark|dealer[-_]?logo|company[-_]?logo/i

function sourceTier(domain, url) {
  const hay = `${domain || ''} ${url || ''}`.toLowerCase()
  if (
    isManufacturerImageSourceDomain(domain)
    || /technogym\.com|pulsefitness\.com|lifefitness\.com|hammerstrength\.com|ctfassets\.net/i.test(hay)
  ) {
    return 1
  }
  if (/johnsonfitness|johnsonhealthtech/i.test(hay)) return 2
  if (isSuggestedRetailerImageSourceDomain(domain) || isConditionalRetailerImageDomain(domain)) return 4
  return 9
}

function familyGenerationMismatch(productName, haystack) {
  const name = String(productName || '').toLowerCase()
  const hay = String(haystack || '').toLowerCase()
  const rules = [
    [/selection\s+pro/, /pure[\s-]?strength|biostrength|selection[\s-]?personal|selection[\s-]?(700|900)|selection[\s-]?line(?!\s*pro)/],
    [/selection\s+personal/, /pure[\s-]?strength|biostrength|selection[\s-]?pro|selection[\s-]?(700|900)|selection[\s-]?line(?!\s*personal)/],
    [/selection\s+line/, /pure[\s-]?strength|biostrength|selection[\s-]?pro|selection[\s-]?personal|selection[\s-]?(700|900)/],
    [/pure\s+strength/, /biostrength|\bselection\b/],
    [/biostrength/, /pure[\s-]?strength|\bselection\b/],
  ]
  return rules.some(([prodRe, badRe]) => prodRe.test(name) && badRe.test(hay))
}

const env = loadEnv()
const supabase = createClient(
  env.VITE_SUPABASE_URL || env.SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
)

const report = JSON.parse(
  readFileSync(join(process.cwd(), 'reports/second-pass-missing-product-images-report.json'), 'utf8'),
)

const highRaw = (report.queues.high || []).filter((row) => row.candidate_image_url)
const allFound = [...(report.queues.high || []), ...(report.queues.medium || [])]
  .filter((row) => row.candidate_image_url)
const collisions = collectSharedImageCollisions(allFound)
const collisionUrls = new Set(collisions.map((entry) => entry.image_url))

// Clean high = not blocked/low-trust domain
const cleanHigh = highRaw.filter((row) => {
  const domain = row.candidate_domain
    || getImageSourceDomainFromCandidate({
      sourceUrl: row.candidate_source_url,
      imageUrl: row.candidate_image_url,
    })
  const hay = `${domain || ''} ${row.candidate_source_url || ''} ${row.candidate_image_url || ''}`
  if (BLOCKED_RE.test(hay)) return false
  if (isBlockedImageSourceDomain(domain)) return false
  if (isBlockedImageSourceUrl(row.candidate_source_url) || isBlockedImageSourceUrl(row.candidate_image_url)) {
    return false
  }
  return true
})

const ids = [...new Set(cleanHigh.map((row) => row.product_id))]
const productsById = new Map()
for (let i = 0; i < ids.length; i += 100) {
  const batch = ids.slice(i, i + 100)
  const { data, error } = await supabase
    .from('equipment_products')
    .select('id, brand, product_family, model, equipment_type, canonical_product_name, canonical_product_key, image_status, image_url, image_storage_path')
    .in('id', batch)
  if (error) throw error
  for (const row of data || []) productsById.set(row.id, row)
}

const reviewed = []
for (const row of cleanHigh) {
  const product = productsById.get(row.product_id)
  const domain = row.candidate_domain
    || getImageSourceDomainFromCandidate({
      sourceUrl: row.candidate_source_url,
      imageUrl: row.candidate_image_url,
    })
  const imageKey = normalizeSharedImageKey(row.candidate_image_url)
  const candidate = {
    title: row.candidate_title,
    sourceUrl: row.candidate_source_url,
    imageUrl: row.candidate_image_url,
  }
  const reasons = []

  if (!product) reasons.push('product_not_found')
  if (collisionUrls.has(imageKey)) reasons.push('shared_image_collision')
  if (BLOCKED_RE.test(`${domain || ''} ${row.candidate_source_url || ''} ${row.candidate_image_url || ''}`)) {
    reasons.push('blocked_or_low_trust_domain')
  }
  if (isBlockedImageSourceDomain(domain) || isBlockedImageSourceUrl(row.candidate_source_url)) {
    reasons.push('blocked_domain')
  }

  const unsuitable = rejectGenericOrUnsuitableImageCandidate(candidate)
  if (unsuitable.reject) reasons.push(unsuitable.reason)

  if (WATERMARK_RE.test([row.candidate_title, row.candidate_source_url, row.candidate_image_url].join(' '))) {
    reasons.push('watermark_signal')
  }

  const evidence = row.identity_evidence || {}
  if (evidence.evidenceLevel === 'brand_type_only') reasons.push('brand_type_only')
  if (evidence.evidenceLevel !== 'exact') reasons.push('not_exact_identity')
  if (evidence.modelTokenOverlap === false) reasons.push('weak_model_token_evidence')
  if ((evidence.conflicts || []).length) reasons.push('family_or_generation_conflict')

  if (product) {
    const gate = evaluateHardenedImageCandidate(product, candidate, {
      hammerMode: isHammerStrengthBrand(product.brand),
    })
    if (!gate.eligible) reasons.push(gate.reason || 'failed_hardened_gate')
    if (!gate.pendingEligible) reasons.push(gate.reason || 'not_pending_eligible')
    if (gate.identityEvidence?.evidenceLevel && gate.identityEvidence.evidenceLevel !== 'exact') {
      reasons.push('hardened_not_exact')
    }
  }

  const hay = [row.candidate_source_url, row.candidate_title, row.candidate_image_url].join(' ')
  if (familyGenerationMismatch(row.canonical_product_name, hay)) {
    reasons.push('family_generation_mismatch_in_source')
  }

  const name = String(row.canonical_product_name || '').toLowerCase()
  if (/g[\s-]?range/i.test(name) && /h[\s-]?range|classic|premium|club\s*line/i.test(hay) && !/g[\s-]?range/i.test(hay)) {
    reasons.push('pulse_g_h_mix')
  }
  if (/h[\s-]?range/i.test(name) && /g[\s-]?range/i.test(hay)) reasons.push('pulse_g_h_mix')

  const tier = sourceTier(domain, row.candidate_source_url)
  if (tier >= 9) reasons.push('source_quality_too_low')

  if (isHammerStrengthBrand(row.brand)) {
    if (!/fitkituk\.com|fitkit\.co\.uk|lifefitness\.com|hammerstrength\.com|johnsonfitness|johnsonhealthtech/i.test(String(domain || ''))) {
      reasons.push('hammer_non_preferred_source')
    }
  }

  // FitKit / dealer product pages must look like a specific product SKU page, not a category listing.
  const sourceUrl = String(row.candidate_source_url || '')
  if (/powerhouse-fitness\.co\.uk/i.test(sourceUrl)
    && !/\/p\d+|\/product\//i.test(sourceUrl)
    && /strength-packages|shoulder-machines|single-station/i.test(sourceUrl)) {
    reasons.push('dealer_category_page_not_product')
  }
  // Pulse G-range must not save against M-series / other line pages.
  if (/g[\s-]?range/i.test(String(row.canonical_product_name || ''))
    && /pulse-fitness-m\d+|\/m\d+\//i.test(sourceUrl)
    && !/g[\s-]?range|g-range|\bg\b/i.test(sourceUrl)) {
    reasons.push('pulse_line_mismatch_m_series')
  }

  // Prefer manufacturer / FitKit; dealer ok only with exact evidence already required.
  const uniqueReasons = [...new Set(reasons.filter(Boolean))]
  reviewed.push({
    product_id: row.product_id,
    product: row.canonical_product_name,
    brand: row.brand,
    family: product?.product_family || (evidence.matched || []).filter((m) => m.type === 'family').map((m) => m.token).join(', ') || '',
    model: product?.model || '',
    source_domain: domain,
    candidate_url: row.candidate_source_url,
    candidate_image_url: row.candidate_image_url,
    confidence: 'high',
    model_evidence: evidence.modelTokenOverlap ? 'model_token_overlap' : (evidence.evidenceLevel || 'unknown'),
    family_evidence: (evidence.matched || []).filter((m) => m.type === 'family').map((m) => m.token).join('|') || evidence.evidenceLevel || '',
    collision_status: collisionUrls.has(imageKey) ? 'collision' : 'clear',
    source_tier: tier,
    identity_evidence_level: evidence.evidenceLevel,
    save: uniqueReasons.length === 0 ? 'YES' : 'NO',
    removal_reasons: uniqueReasons,
  })
}

// Intra-batch image URL dedupe across distinct products
const byImg = new Map()
for (const row of reviewed.filter((entry) => entry.save === 'YES')) {
  const key = normalizeSharedImageKey(row.candidate_image_url)
  if (!byImg.has(key)) byImg.set(key, [])
  byImg.get(key).push(row)
}
for (const rows of byImg.values()) {
  const distinct = new Set(rows.map((row) => row.product_id))
  if (distinct.size > 1) {
    for (const row of rows) {
      row.save = 'NO'
      row.removal_reasons = [...new Set([...(row.removal_reasons || []), 'intra_apply_shared_image'])]
      row.collision_status = 'collision'
    }
  }
}

const eligible = reviewed.filter((row) => row.save === 'YES')
const summary = {
  original_clean_high_count: cleanHigh.length,
  clean_high_reviewed: reviewed.length,
  removed_collisions: reviewed.filter((row) => (
    row.removal_reasons.includes('shared_image_collision')
    || row.removal_reasons.includes('intra_apply_shared_image')
  )).length,
  removed_family_generation: reviewed.filter((row) => (
    row.removal_reasons.some((reason) => /family|generation|conflict/i.test(reason))
  )).length,
  removed_weak_model: reviewed.filter((row) => (
    row.removal_reasons.some((reason) => /model|brand_type|not_exact|weak|pending_eligible|hardened_not_exact/i.test(reason))
  )).length,
  removed_source_quality: reviewed.filter((row) => (
    row.removal_reasons.some((reason) => /blocked|source_quality|watermark|generic|gym_floor|spare|marketplace|social|non_preferred|too_low/i.test(reason))
  )).length,
  final_eligible: eligible.length,
  by_brand: eligible.reduce((acc, row) => {
    acc[row.brand] = (acc[row.brand] || 0) + 1
    return acc
  }, {}),
}

mkdirSync(join(process.cwd(), 'reports'), { recursive: true })
writeFileSync(
  join(process.cwd(), 'reports/second-pass-safe-apply-eligibility.json'),
  `${JSON.stringify({
    generated_at: new Date().toISOString(),
    summary,
    eligible,
    reviewed,
    removals: reviewed.filter((row) => row.save === 'NO'),
    collision_groups_touching_clean_high: collisions.filter((group) => (
      cleanHigh.some((row) => normalizeSharedImageKey(row.candidate_image_url) === group.image_url)
    )),
  }, null, 2)}\n`,
)

const lines = [
  '# Second-pass safe apply eligibility table',
  '',
  'Generated **before** any save. Auto-approve: false.',
  '',
  '## Summary',
  '',
  '| Metric | Count |',
  '| --- | ---: |',
  `| Original clean high candidates | ${summary.original_clean_high_count} |`,
  `| Clean high reviewed | ${summary.clean_high_reviewed} |`,
  `| Removed for collisions | ${summary.removed_collisions} |`,
  `| Removed for family/generation conflict | ${summary.removed_family_generation} |`,
  `| Removed for weak model evidence | ${summary.removed_weak_model} |`,
  `| Removed for source quality | ${summary.removed_source_quality} |`,
  `| Final candidates eligible to save | ${summary.final_eligible} |`,
  '',
  '### By brand (eligible)',
  '',
  ...Object.entries(summary.by_brand).map(([brand, count]) => `- ${brand}: ${count}`),
  '',
  '## Final table',
  '',
  '| Product | Brand | Family | Model | Source domain | Candidate URL | Confidence | Model evidence | Family evidence | Collision status | Save? |',
  '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |',
]

for (const row of reviewed) {
  lines.push(`| ${[
    row.product,
    row.brand,
    row.family,
    row.model,
    row.source_domain,
    row.candidate_url,
    row.confidence,
    row.model_evidence,
    row.family_evidence,
    row.collision_status,
    row.save,
  ].map((cell) => String(cell ?? '').replaceAll('|', '/')).join(' | ')} |`)
}

lines.push('', '## Removals and reasons', '')
for (const row of reviewed.filter((entry) => entry.save === 'NO')) {
  lines.push(`- **${row.product}**: ${row.removal_reasons.join(', ')}`)
}
lines.push('')

writeFileSync(join(process.cwd(), 'reports/second-pass-safe-apply-eligibility.md'), `${lines.join('\n')}\n`)
console.log(JSON.stringify(summary, null, 2))
console.log(`Eligible: ${eligible.length}`)
for (const row of eligible.slice(0, 40)) {
  console.log(`YES | ${row.brand} | ${row.product} | ${row.source_domain}`)
}
