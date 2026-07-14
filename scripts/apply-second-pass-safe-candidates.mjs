#!/usr/bin/env node
/**
 * Conservative apply of final second-pass safe candidates.
 * Saves as suggested/pending only. Never auto-approves.
 */
import { createClient } from '@supabase/supabase-js'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  buildEquipmentProductImageStoragePath,
  buildSuggestedImageMetadata,
  downloadFirstAvailableImageCandidate,
  EQUIPMENT_PRODUCT_IMAGE_STATUS,
  EQUIPMENT_PRODUCT_IMAGES_BUCKET,
  imageMetadataPreservesPricingFields,
  productHasDisplayableImage,
  scoreImageSearchCandidate,
} from '../src/lib/equipmentProductImages.js'
import { evaluateHardenedImageCandidate } from '../src/lib/equipmentProductImageHardening.js'
import { isHammerStrengthBrand } from '../src/lib/hammerStrengthProductImageSearch.js'
import { normalizeSharedImageKey } from '../src/lib/equipmentProductImageHardening.js'

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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

const MAX_UPLOAD_BYTES = 4.5 * 1024 * 1024
const MAX_IMAGE_EDGE = 1800

async function prepareImageForUpload(buffer, contentType, extension) {
  let outputBuffer = buffer
  let outputType = contentType
  let outputExt = extension
  try {
    const sharp = (await import('sharp')).default
    let pipeline = sharp(buffer, { failOn: 'none' }).rotate()
    const meta = await pipeline.metadata()
    const widest = Math.max(meta.width || 0, meta.height || 0)
    if (widest > MAX_IMAGE_EDGE) {
      pipeline = pipeline.resize({
        width: MAX_IMAGE_EDGE,
        height: MAX_IMAGE_EDGE,
        fit: 'inside',
        withoutEnlargement: true,
      })
    }
    outputBuffer = await pipeline.jpeg({ quality: 82, mozjpeg: true }).toBuffer()
    outputType = 'image/jpeg'
    outputExt = 'jpg'
  } catch (error) {
    if (buffer.length > MAX_UPLOAD_BYTES) throw error
  }
  if (outputBuffer.length > MAX_UPLOAD_BYTES) {
    const sharp = (await import('sharp')).default
    outputBuffer = await sharp(outputBuffer, { failOn: 'none' })
      .resize({ width: 1400, height: 1400, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 72, mozjpeg: true })
      .toBuffer()
    outputType = 'image/jpeg'
    outputExt = 'jpg'
  }
  return { buffer: outputBuffer, contentType: outputType, extension: outputExt }
}

async function uploadImage(supabase, product, buffer, contentType, extension) {
  const prepared = await prepareImageForUpload(buffer, contentType, extension)
  const storagePath = buildEquipmentProductImageStoragePath(product, prepared.extension)
  const { error } = await supabase.storage
    .from(EQUIPMENT_PRODUCT_IMAGES_BUCKET)
    .upload(storagePath, prepared.buffer, {
      contentType: prepared.contentType,
      upsert: true,
    })
  if (error) throw error
  const { data } = supabase.storage
    .from(EQUIPMENT_PRODUCT_IMAGES_BUCKET)
    .getPublicUrl(storagePath)
  return { storagePath, publicUrl: data?.publicUrl ?? null }
}

const env = loadEnv()
const eligibility = JSON.parse(
  readFileSync(join(process.cwd(), 'reports/second-pass-safe-apply-eligibility.json'), 'utf8'),
)
const secondPass = JSON.parse(
  readFileSync(join(process.cwd(), 'reports/second-pass-missing-product-images-report.json'), 'utf8'),
)

const supabase = createClient(
  env.VITE_SUPABASE_URL || env.SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
)

const queue = eligibility.eligible || []
const usedSourceImages = new Map()
const results = []
const summary = {
  attempted: queue.length,
  saved: 0,
  skipped_approved: 0,
  skipped_existing_pending: 0,
  skipped_duplicate_source: 0,
  failed_download: 0,
  failed_upload: 0,
  failed_mapping: 0,
  failed_gate: 0,
  by_brand: {},
}

console.log(`Applying ${queue.length} final safe candidates as pending suggestions`)

for (const row of queue) {
  const { data: product, error } = await supabase
    .from('equipment_products')
    .select('id, brand, model, product_family, equipment_type, canonical_product_name, canonical_product_key, status, image_status, image_url, image_storage_path, image_source_url, original_base_price, baseline_manufacture_year')
    .eq('id', row.product_id)
    .maybeSingle()
  if (error) throw error
  if (!product) {
    results.push({ ...row, apply_outcome: 'product_not_found' })
    continue
  }

  if (productHasDisplayableImage(product)) {
    summary.skipped_approved += 1
    results.push({
      product_id: product.id,
      product: product.canonical_product_name,
      brand: product.brand,
      apply_outcome: 'skipped_approved',
    })
    console.log(`skipped_approved | ${product.canonical_product_name}`)
    continue
  }

  // Do not overwrite an existing good pending suggestion.
  if (
    product.image_status === EQUIPMENT_PRODUCT_IMAGE_STATUS.SUGGESTED
    && product.image_url
  ) {
    summary.skipped_existing_pending += 1
    results.push({
      product_id: product.id,
      product: product.canonical_product_name,
      brand: product.brand,
      apply_outcome: 'skipped_existing_pending',
    })
    console.log(`skipped_existing_pending | ${product.canonical_product_name}`)
    continue
  }

  const imageKey = normalizeSharedImageKey(row.candidate_image_url)
  if (imageKey && usedSourceImages.has(imageKey)) {
    summary.skipped_duplicate_source += 1
    results.push({
      product_id: product.id,
      product: product.canonical_product_name,
      brand: product.brand,
      apply_outcome: 'skipped_duplicate_source',
      rejection_reason: `same_as_${usedSourceImages.get(imageKey)}`,
    })
    console.log(`skipped_duplicate_source | ${product.canonical_product_name}`)
    continue
  }

  const candidate = {
    title: null,
    sourceUrl: row.candidate_url,
    imageUrl: row.candidate_image_url,
  }
  // Pull title from second-pass row if present
  const sourceRow = (secondPass.results || []).find((entry) => entry.product_id === row.product_id)
  if (sourceRow?.candidate_title) candidate.title = sourceRow.candidate_title

  const gate = evaluateHardenedImageCandidate(product, candidate, {
    hammerMode: isHammerStrengthBrand(product.brand),
  })
  if (!gate.eligible || !gate.pendingEligible || gate.identityEvidence?.evidenceLevel !== 'exact') {
    summary.failed_gate += 1
    results.push({
      product_id: product.id,
      product: product.canonical_product_name,
      brand: product.brand,
      apply_outcome: 'failed_gate',
      rejection_reason: gate.reason || 'not_exact_pending_eligible',
    })
    console.log(`failed_gate | ${product.canonical_product_name} | ${gate.reason}`)
    continue
  }

  const scored = scoreImageSearchCandidate(candidate, product)
  const ranked = [{ candidate, ...scored, ...gate }]

  let downloadResult
  try {
    downloadResult = await downloadFirstAvailableImageCandidate(ranked)
  } catch (err) {
    summary.failed_download += 1
    results.push({
      product_id: product.id,
      product: product.canonical_product_name,
      brand: product.brand,
      apply_outcome: 'failed_download',
      rejection_reason: err.message,
    })
    console.log(`failed_download | ${product.canonical_product_name} | ${err.message}`)
    await sleep(750)
    continue
  }

  if (!downloadResult.downloaded || !downloadResult.entry) {
    summary.failed_download += 1
    results.push({
      product_id: product.id,
      product: product.canonical_product_name,
      brand: product.brand,
      apply_outcome: 'failed_download',
      rejection_reason: 'download_unavailable',
    })
    console.log(`failed_download | ${product.canonical_product_name}`)
    await sleep(750)
    continue
  }

  let uploaded
  try {
    uploaded = await uploadImage(
      supabase,
      product,
      downloadResult.downloaded.buffer,
      downloadResult.downloaded.contentType,
      downloadResult.downloaded.extension,
    )
  } catch (err) {
    summary.failed_upload += 1
    results.push({
      product_id: product.id,
      product: product.canonical_product_name,
      brand: product.brand,
      apply_outcome: 'failed_upload',
      rejection_reason: err.message,
    })
    console.log(`failed_upload | ${product.canonical_product_name} | ${err.message}`)
    await sleep(750)
    continue
  }

  const metadata = buildSuggestedImageMetadata({
    imageUrl: uploaded.publicUrl,
    storagePath: uploaded.storagePath,
    sourceUrl: row.candidate_url || row.candidate_image_url,
    confidence: downloadResult.entry.score ?? 90,
    product,
    scoreResult: downloadResult.entry,
    failureReason: 'pending_manual_image_review',
  })
  metadata.image_status = EQUIPMENT_PRODUCT_IMAGE_STATUS.SUGGESTED
  metadata.image_failure_reason = metadata.image_failure_reason || 'pending_manual_image_review'
  metadata.updated_at = new Date().toISOString()

  if (!imageMetadataPreservesPricingFields(metadata)) {
    throw new Error('Refusing non-image field write')
  }

  const { error: updateError } = await supabase
    .from('equipment_products')
    .update(metadata)
    .eq('id', product.id)
    .neq('image_status', EQUIPMENT_PRODUCT_IMAGE_STATUS.APPROVED)

  if (updateError) {
    summary.failed_mapping += 1
    results.push({
      product_id: product.id,
      product: product.canonical_product_name,
      brand: product.brand,
      apply_outcome: 'failed_mapping',
      rejection_reason: updateError.message,
    })
    console.log(`failed_mapping | ${product.canonical_product_name}`)
    await sleep(750)
    continue
  }

  if (imageKey) usedSourceImages.set(imageKey, product.canonical_product_name)
  summary.saved += 1
  summary.by_brand[product.brand] = (summary.by_brand[product.brand] || 0) + 1
  results.push({
    product_id: product.id,
    product: product.canonical_product_name,
    brand: product.brand,
    family: product.product_family,
    model: product.model,
    apply_outcome: 'saved_pending',
    image_status: EQUIPMENT_PRODUCT_IMAGE_STATUS.SUGGESTED,
    storage_path: uploaded.storagePath,
    image_url: uploaded.publicUrl,
    source_url: row.candidate_url,
    source_domain: row.source_domain,
    confidence: downloadResult.entry.score,
  })
  console.log(`saved_pending | ${product.canonical_product_name}`)
  await sleep(750)
}

mkdirSync(join(process.cwd(), 'reports'), { recursive: true })
const out = {
  generated_at: new Date().toISOString(),
  mode: 'second_pass_conservative_apply',
  auto_approve: false,
  eligibility_summary: eligibility.summary,
  summary,
  results,
  medium_left_report_only: (secondPass.queues?.medium || []).length,
  collision_groups_excluded: (eligibility.collision_groups_touching_clean_high || []).length,
}
writeFileSync(
  join(process.cwd(), 'reports/second-pass-safe-apply-report.json'),
  `${JSON.stringify(out, null, 2)}\n`,
)
writeFileSync(
  join(process.cwd(), 'reports/second-pass-safe-apply-report.md'),
  [
    '# Second-pass conservative apply report',
    '',
    `- Generated: ${out.generated_at}`,
    '- Auto-approve: false',
    '',
    '## Summary',
    '',
    `| Metric | Count |`,
    `| --- | ---: |`,
    `| Attempted | ${summary.attempted} |`,
    `| Saved pending | ${summary.saved} |`,
    `| Skipped approved | ${summary.skipped_approved} |`,
    `| Skipped existing pending | ${summary.skipped_existing_pending} |`,
    `| Skipped duplicate source | ${summary.skipped_duplicate_source} |`,
    `| Failed download | ${summary.failed_download} |`,
    `| Failed upload | ${summary.failed_upload} |`,
    `| Failed mapping | ${summary.failed_mapping} |`,
    `| Failed gate | ${summary.failed_gate} |`,
    '',
    '## By brand saved',
    '',
    ...Object.entries(summary.by_brand).map(([brand, count]) => `- ${brand}: ${count}`),
    '',
    '## Saved candidates',
    '',
    ...results.filter((row) => row.apply_outcome === 'saved_pending').map((row) => (
      `- **${row.product}** (${row.brand}) — ${row.source_domain} — ${row.source_url}`
    )),
    '',
  ].join('\n'),
)

console.log(JSON.stringify(summary, null, 2))
console.log('Wrote reports/second-pass-safe-apply-report.json')
console.log('Wrote reports/second-pass-safe-apply-report.md')
