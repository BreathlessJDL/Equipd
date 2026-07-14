#!/usr/bin/env node
/**
 * Medium-confidence second-pass candidates — report only, never saved.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

const secondPass = JSON.parse(
  readFileSync(join(process.cwd(), 'reports/second-pass-missing-product-images-report.json'), 'utf8'),
)
const medium = secondPass.queues?.medium || []

const rows = medium.map((row) => {
  const evidence = row.identity_evidence || {}
  const weaknesses = []
  if (evidence.evidenceLevel === 'family') weaknesses.push('family_only_not_exact')
  if (evidence.evidenceLevel === 'brand_type_only') weaknesses.push('brand_type_only')
  if (evidence.modelTokenOverlap === false) weaknesses.push('weak_model_tokens')
  if ((evidence.conflicts || []).length) weaknesses.push('has_conflicts')
  if (row.outcome === 'shared_image_collision_needs_review') weaknesses.push('shared_image_collision')
  if (/instagram|facebook|youtube|ebay|uzed|equip4gyms|usedgym/i.test(`${row.candidate_domain} ${row.candidate_source_url}`)) {
    weaknesses.push('low_trust_or_blocked_domain')
  }
  if (/\/collections?\/|\/category|art-collection|unity-mini\/?$/i.test(String(row.candidate_source_url || ''))) {
    weaknesses.push('generic_or_category_page')
  }

  let humanMayApprove = 'unlikely'
  if (
    evidence.evidenceLevel === 'family'
    && evidence.modelTokenOverlap
    && !weaknesses.includes('low_trust_or_blocked_domain')
    && !weaknesses.includes('shared_image_collision')
    && !weaknesses.includes('generic_or_category_page')
  ) {
    humanMayApprove = 'possible_with_visual_check'
  }
  if (evidence.evidenceLevel === 'exact' && weaknesses.includes('shared_image_collision')) {
    humanMayApprove = 'only_if_same_physical_product_proven'
  }

  return {
    product: row.canonical_product_name,
    brand: row.brand,
    family_model_confidence: evidence.evidenceLevel || row.confidence_bucket,
    source_domain: row.candidate_domain,
    candidate_source: row.candidate_source_url,
    candidate_image: row.candidate_image_url,
    exact_weakness: weaknesses.join(', ') || 'medium_band_needs_review',
    human_may_reasonably_approve: humanMayApprove,
  }
})

mkdirSync(join(process.cwd(), 'reports'), { recursive: true })
writeFileSync(
  join(process.cwd(), 'reports/second-pass-medium-confidence-review.json'),
  `${JSON.stringify({
    generated_at: new Date().toISOString(),
    count: rows.length,
    note: 'Report-only. Not saved. Not auto-approved.',
    rows,
  }, null, 2)}\n`,
)

const lines = [
  '# Second-pass medium-confidence review (report only)',
  '',
  `Count: ${rows.length}`,
  'These candidates were **not** saved.',
  '',
  '| Product | Brand | Confidence | Source domain | Weakness | Human may approve? | Source |',
  '| --- | --- | --- | --- | --- | --- | --- |',
]
for (const row of rows) {
  lines.push(`| ${[
    row.product,
    row.brand,
    row.family_model_confidence,
    row.source_domain,
    row.exact_weakness,
    row.human_may_reasonably_approve,
    row.candidate_source,
  ].map((cell) => String(cell ?? '').replaceAll('|', '/')).join(' | ')} |`)
}
lines.push('')
writeFileSync(join(process.cwd(), 'reports/second-pass-medium-confidence-review.md'), `${lines.join('\n')}\n`)
console.log(`Wrote medium review for ${rows.length} candidates`)
