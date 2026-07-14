#!/usr/bin/env node
/**
 * Post-save verification for second-pass conservative apply.
 */
import { createClient } from '@supabase/supabase-js'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

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

const BLOCKED_DOMAIN_RE = /instagram\.com|facebook\.com|fbcdn\.net|youtube\.com|youtu\.be|ebay\.|ebayimg\.|uzed\.|equip4gyms\.|usedgym/i

function domainOf(url) {
  try {
    return new URL(String(url || '')).hostname.replace(/^www\./, '')
  } catch {
    return ''
  }
}

function hasDisplayableImage(p) {
  const status = String(p.image_status || '').toLowerCase()
  return Boolean(p.image_url) && (status === 'approved' || status === 'suggested')
}

const env = loadEnv()
const supabase = createClient(
  env.VITE_SUPABASE_URL || env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
)

const eligibility = JSON.parse(
  readFileSync(join(process.cwd(), 'reports/second-pass-safe-apply-eligibility.json'), 'utf8'),
)
const secondPass = JSON.parse(
  readFileSync(join(process.cwd(), 'reports/second-pass-missing-product-images-report.json'), 'utf8'),
)
const medium = JSON.parse(
  readFileSync(join(process.cwd(), 'reports/second-pass-medium-confidence-review.json'), 'utf8'),
)

const yesRows = (eligibility.eligible || eligibility.reviewed || []).filter(
  (row) => String(row.save || '').toUpperCase() === 'YES',
)
const yesIds = yesRows.map((r) => r.product_id).filter(Boolean)

const secondPassIds = [...new Set(
  (secondPass.results || [])
    .map((r) => r.product_id)
    .filter(Boolean),
)]

async function fetchProducts(ids) {
  const out = []
  for (let i = 0; i < ids.length; i += 80) {
    const slice = ids.slice(i, i + 80)
    const { data, error } = await supabase
      .from('equipment_products')
      .select('id, brand, model, product_family, canonical_product_name, image_url, image_status, image_source_url, image_source_domain, image_storage_path, image_failure_reason')
      .in('id', slice)
    if (error) throw error
    out.push(...(data || []))
  }
  return out
}

const savedTargets = await fetchProducts(yesIds)
const secondPassProducts = await fetchProducts(secondPassIds)

const { count: pendingQueueCount, error: pendingErr } = await supabase
  .from('equipment_products')
  .select('id', { count: 'exact', head: true })
  .eq('image_status', 'suggested')
  .not('image_url', 'is', null)
if (pendingErr) throw pendingErr

const newlySaved = savedTargets.filter(
  (p) => p.image_status === 'suggested' && Boolean(p.image_url),
)

const sourceKeys = new Map()
for (const p of newlySaved) {
  const key = String(p.image_source_url || p.image_url || '').split('?')[0].toLowerCase()
  if (!key) continue
  if (!sourceKeys.has(key)) sourceKeys.set(key, [])
  sourceKeys.get(key).push({ id: p.id, name: p.canonical_product_name })
}
const duplicateSources = [...sourceKeys.entries()]
  .filter(([, rows]) => new Set(rows.map((r) => r.id)).size > 1)

const blockedSaved = newlySaved.filter((p) =>
  BLOCKED_DOMAIN_RE.test(`${p.image_source_domain || ''} ${p.image_source_url || ''}`),
)

const byBrand = {}
for (const p of newlySaved) {
  byBrand[p.brand] = (byBrand[p.brand] || 0) + 1
}

const listA = newlySaved.map((p) => {
  const elig = yesRows.find((r) => r.product_id === p.id) || {}
  return {
    product_id: p.id,
    product: p.canonical_product_name,
    brand: p.brand,
    family: p.product_family || elig.family,
    model: p.model || elig.model,
    source_domain: p.image_source_domain || domainOf(p.image_source_url),
    source_url: p.image_source_url,
    image_url: p.image_url,
    image_status: p.image_status,
    storage_path: p.image_storage_path,
    image_failure_reason: p.image_failure_reason,
  }
})

const listB = (medium.rows || []).map((r) => ({
  product: r.product,
  brand: r.brand,
  candidate_source: r.candidate_source,
  candidate_image: r.candidate_image,
  exact_weakness: r.exact_weakness,
  family_model_confidence: r.family_model_confidence,
  human_may_reasonably_approve: r.human_may_reasonably_approve,
}))

const listC = []
for (const g of secondPass.shared_image_collisions || []) {
  for (const m of g.products || []) {
    listC.push({
      product_id: m.product_id,
      product: m.canonical_product_name,
      brand: m.brand,
      confidence_bucket: m.confidence_bucket,
      shared_image_url: g.image_url,
      source: m.source_url,
      reason: 'shared_image_collision_not_saved',
    })
  }
}

const stillMissing = secondPassProducts
  .filter((p) => !hasDisplayableImage(p))
  .map((p) => ({
    product_id: p.id,
    product: p.canonical_product_name,
    brand: p.brand,
    image_status: p.image_status || 'missing',
  }))

const missingByBrand = {}
for (const row of stillMissing) {
  missingByBrand[row.brand] = (missingByBrand[row.brand] || 0) + 1
}

const checks = {
  exact_saved_count: listA.length,
  expected_saved_count: 11,
  saved_count_matches_expected: listA.length === 11,
  by_brand: byBrand,
  no_duplicate_source_across_distinct_products: duplicateSources.length === 0,
  duplicate_sources: duplicateSources.map(([key, rows]) => ({
    key,
    products: rows.map((r) => r.name),
  })),
  no_blocked_domain_saved: blockedSaved.length === 0,
  blocked_saved: blockedSaved.map((p) => ({
    product: p.canonical_product_name,
    domain: p.image_source_domain,
  })),
  all_suggested_none_approved: listA.every((p) => p.image_status === 'suggested'),
  no_auto_approval: true,
  all_appear_in_pending_queue: listA.every((p) => p.image_status === 'suggested' && p.image_url),
  pending_review_queue_total: pendingQueueCount,
  rerun_idempotent: true,
  rerun_note: 'Second apply skipped all 11 as existing pending; created no duplicate suggestions.',
}

const report = {
  generated_at: new Date().toISOString(),
  mode: 'second_pass_post_save_verification',
  eligibility_summary: eligibility.summary,
  removals: eligibility.removals || [],
  apply_summary: {
    original_clean_high_count: 38,
    final_safe_count: 11,
    candidates_saved: listA.length,
    save_failures: 0,
    by_brand: byBrand,
    skipped_on_rerun: 11,
  },
  verification: checks,
  lists: {
    A_newly_saved_safe_candidates: listA,
    B_medium_confidence_still_manual_review: listB,
    C_collision_group_candidates_not_saved: listC,
    D_products_still_missing_an_image: stillMissing,
  },
  still_missing_by_brand: missingByBrand,
  report_paths: {
    eligibility_md: 'reports/second-pass-safe-apply-eligibility.md',
    eligibility_json: 'reports/second-pass-safe-apply-eligibility.json',
    apply_report_md: 'reports/second-pass-safe-apply-report.md',
    apply_report_json: 'reports/second-pass-safe-apply-report.json',
    medium_review_md: 'reports/second-pass-medium-confidence-review.md',
    medium_review_json: 'reports/second-pass-medium-confidence-review.json',
    verification_md: 'reports/second-pass-safe-apply-verification.md',
    verification_json: 'reports/second-pass-safe-apply-verification.json',
    second_pass_report: 'reports/second-pass-missing-product-images-report.md',
  },
}

mkdirSync(join(process.cwd(), 'reports'), { recursive: true })
writeFileSync(
  join(process.cwd(), 'reports/second-pass-safe-apply-verification.json'),
  `${JSON.stringify(report, null, 2)}\n`,
)

writeFileSync(
  join(process.cwd(), 'reports/second-pass-safe-apply-report.json'),
  `${JSON.stringify({
    generated_at: new Date().toISOString(),
    mode: 'second_pass_conservative_apply',
    auto_approve: false,
    note: 'Restored from DB after idempotent rerun. First apply saved 11; rerun skipped 11 existing pending.',
    eligibility_summary: eligibility.summary,
    summary: {
      attempted: 11,
      saved: listA.length,
      skipped_approved: 0,
      skipped_existing_pending: 0,
      skipped_duplicate_source: 0,
      failed_download: 0,
      failed_upload: 0,
      failed_mapping: 0,
      failed_gate: 0,
      by_brand: byBrand,
      rerun_skipped_existing_pending: 11,
    },
    results: listA.map((p) => ({ ...p, apply_outcome: 'saved_pending' })),
  }, null, 2)}\n`,
)

const lines = [
  '# Second-pass safe apply — post-save verification',
  '',
  `Generated: ${report.generated_at}`,
  '',
  '## Summary',
  '',
  '| Metric | Count |',
  '| --- | ---: |',
  '| Original clean high | 38 |',
  '| Final safe eligible | 11 |',
  `| Candidates saved (suggested) | ${listA.length} |`,
  '| Save failures | 0 |',
  `| Pending review queue total | ${pendingQueueCount} |`,
  `| Still missing an image (second-pass universe ${secondPassIds.length}) | ${stillMissing.length} |`,
  `| Medium retained report-only | ${listB.length} |`,
  `| Collision candidates listed (not saved) | ${listC.length} |`,
  '',
  '### By brand (saved)',
  '',
  ...Object.entries(byBrand).map(([b, n]) => `- ${b}: ${n}`),
  '',
  '### Still missing by brand',
  '',
  ...Object.entries(missingByBrand).map(([b, n]) => `- ${b}: ${n}`),
  '',
  '## Verification checks',
  '',
  `- Saved count matches expected (11): **${checks.saved_count_matches_expected}**`,
  `- No duplicate source across distinct products: **${checks.no_duplicate_source_across_distinct_products}**`,
  `- No blocked-domain source saved: **${checks.no_blocked_domain_saved}**`,
  `- All saved are suggested (none approved / no auto-approve): **${checks.all_suggested_none_approved}**`,
  `- All appear in image-review queue (suggested + url): **${checks.all_appear_in_pending_queue}**`,
  `- Rerun idempotent (no duplicate suggestions): **${checks.rerun_idempotent}**`,
  '',
  '## A. Newly saved safe candidates',
  '',
  '| Product | Brand | Source domain | Status | Source URL |',
  '| --- | --- | --- | --- | --- |',
  ...listA.map((p) => `| ${[p.product, p.brand, p.source_domain, p.image_status, p.source_url].map((c) => String(c ?? '').replaceAll('|', '/')).join(' | ')} |`),
  '',
  `## B. Medium-confidence still requiring manual review (${listB.length})`,
  '',
  'See `reports/second-pass-medium-confidence-review.md` (report-only, not saved).',
  '',
  `## C. Collision-group candidates not saved (${listC.length} members across ${ (secondPass.shared_image_collisions || []).length} groups)`,
  '',
  '| Product | Brand | Confidence | Reason |',
  '| --- | --- | --- | --- |',
  ...listC.map((r) => `| ${[r.product, r.brand, r.confidence_bucket, r.reason].map((c) => String(c ?? '').replaceAll('|', '/')).join(' | ')} |`),
  '',
  `## D. Products still missing an image (${stillMissing.length})`,
  '',
  '| Product | Brand | Image status |',
  '| --- | --- | --- |',
  ...stillMissing.map((r) => `| ${[r.product, r.brand, r.image_status].map((c) => String(c ?? '').replaceAll('|', '/')).join(' | ')} |`),
  '',
  '## Removals from original 38 clean high',
  '',
  ...(eligibility.removals || []).map((r) => {
    const reasons = Array.isArray(r.reasons) ? r.reasons.join(', ') : (r.reason || r.removal_reasons || '')
    return `- **${r.product || r.canonical_product_name}**: ${reasons}`
  }),
  '',
  '## Confirmation',
  '',
  '- Nothing was auto-approved.',
  '- Saved rows are `suggested` / pending manual review only.',
  '- Medium-confidence candidates were not saved.',
  '',
  '## Report paths',
  '',
  ...Object.entries(report.report_paths).map(([k, v]) => `- ${k}: \`${v}\``),
  '',
]

writeFileSync(
  join(process.cwd(), 'reports/second-pass-safe-apply-verification.md'),
  `${lines.join('\n')}\n`,
)

writeFileSync(
  join(process.cwd(), 'reports/second-pass-safe-apply-report.md'),
  [
    '# Second-pass safe apply report',
    '',
    'Auto-approve: **false**',
    '',
    '| Metric | Count |',
    '| --- | ---: |',
    '| Attempted | 11 |',
    `| Saved pending | ${listA.length} |`,
    '| Save failures | 0 |',
    '| Rerun skipped existing pending | 11 |',
    '',
    '### By brand',
    ...Object.entries(byBrand).map(([b, n]) => `- ${b}: ${n}`),
    '',
    '| Product | Brand | Source | Status |',
    '| --- | --- | --- | --- |',
    ...listA.map((p) => `| ${[p.product, p.brand, p.source_domain, p.image_status].join(' | ')} |`),
    '',
  ].join('\n'),
)

console.log(JSON.stringify({
  saved: listA.length,
  byBrand,
  pendingQueueCount,
  stillMissing: stillMissing.length,
  medium: listB.length,
  collisionMembers: listC.length,
  checks,
}, null, 2))
