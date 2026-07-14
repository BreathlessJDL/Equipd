#!/usr/bin/env node
/**
 * Apply canonical product duplicate-reduction workflow per brand.
 *
 * Does not modify equipment_intelligence rows.
 *
 * Operational note — plus-sign identity keys:
 * Existing commercial products whose source identity includes "+" (e.g. Technogym
 * Element+, Excite+) were originally keyed without a "plus" token. A later change
 * maps "+" → "plus" in slugifyCoreProductKey. Rebuilding or re-applying those
 * brands without a dedicated key-migration plan can insert duplicate rows instead
 * of updating existing ones. Do not run catalogue-wide --rebuild-names / --all
 * until that migration is planned.
 *
 * Usage:
 *   node scripts/apply-canonical-products-by-brand.mjs --brand "Technogym" --dry-run
 *   node scripts/apply-canonical-products-by-brand.mjs --brand "Technogym" --apply --approve-safe --repair
 *   node scripts/apply-canonical-products-by-brand.mjs --brand "Technogym" --apply --allow-manufacture-year-as-baseline
 *   node scripts/apply-canonical-products-by-brand.mjs --all --report
 *
 * --allow-manufacture-year-as-baseline (UNSAFE, disabled by default):
 * Copies generic equipment_intelligence.manufacture_year into canonical
 * baseline_manufacture_year when no verified baseline/start year exists.
 * Automatic CSV import never enables this. Use only for trusted brand-specific
 * historical imports where manufacture_year is known to mean earliest release.
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  applyCanonicalProductsForBrand,
  fetchEquipmentProductsForCanonicalApply,
  fetchIntelligenceRowsForCanonicalApply,
  INTELLIGENCE_CANONICAL_APPLY_FIELDS,
} from '../src/lib/applyCanonicalProductsByBrand.js'
import {
  buildBrandCanonicalWorkflowReport,
  buildCanonicalProductAuditReport,
  buildConsoleDuplicateRepairPlan,
  buildSafeApprovalCandidateIds,
  buildSingleSourceNeedsReviewCandidateIds,
  coalesceMergedCanonicalProductFields,
  deriveCanonicalProductFields,
  PRODUCT_STATUS,
  summarizeEquipmentProductCounts,
} from '../src/lib/intelligenceCanonicalProducts.js'
import { deriveCoreProductFields, isLifeFitnessBrand } from '../src/lib/intelligenceCoreProductGrouping.js'
import { isTechnogymBrand } from '../src/lib/technogymCoreProductGrouping.js'

const PRIORITY_BRANDS = [
  'Technogym',
  'Precor',
  'Cybex',
  'Star Trac',
  'Matrix Fitness',
]

const BRAND_ALIASES = {
  Matrix: 'Matrix Fitness',
  'Matrix Fitness': 'Matrix Fitness',
  'Star Trac': 'Star Trac',
}

const SKIP_ALL_BRANDS = new Set(['Life Fitness'])

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
    all: false,
    dryRun: true,
    apply: false,
    approveSafe: false,
    repair: false,
    report: false,
    rebuildNames: false,
    allowPlusKeyRisk: false,
    allowManufactureYearAsBaseline: false,
    out: null,
  }

  for (let index = 2; index < argv.length; index += 1) {
    const token = argv[index]
    if (token === '--dry-run') args.dryRun = true
    else if (token === '--apply') {
      args.apply = true
      args.dryRun = false
    } else if (token === '--approve-safe') args.approveSafe = true
    else if (token === '--repair') args.repair = true
    else if (token === '--rebuild-names') args.rebuildNames = true
    else if (token === '--allow-plus-key-risk') args.allowPlusKeyRisk = true
    else if (token === '--allow-manufacture-year-as-baseline') args.allowManufactureYearAsBaseline = true
    else if (token === '--report') args.report = true
    else if (token === '--all') args.all = true
    else if (token === '--brand') {
      args.brand = argv[index + 1] ?? null
      index += 1
    } else if (token === '--out') {
      args.out = argv[index + 1] ?? null
      index += 1
    }
  }

  if (args.apply || args.approveSafe || args.repair) {
    args.dryRun = false
  }

  return args
}

const fetchIntelligenceRows = fetchIntelligenceRowsForCanonicalApply
const fetchProducts = fetchEquipmentProductsForCanonicalApply

async function fetchDistinctBrands(supabase) {
  const pageSize = 1000
  let from = 0
  const brands = new Set()

  while (true) {
    const { data, error } = await supabase
      .from('equipment_intelligence')
      .select('brand')
      .order('brand')
      .range(from, from + pageSize - 1)

    if (error) throw error
    if (!data?.length) break

    for (const row of data) {
      if (row.brand) brands.add(row.brand)
    }

    if (data.length < pageSize) break
    from += pageSize
  }

  return [...brands].sort((left, right) => left.localeCompare(right))
}

function resolveBrandName(brand, availableBrands = []) {
  if (!brand) return brand
  if (BRAND_ALIASES[brand]) return BRAND_ALIASES[brand]
  const exact = availableBrands.find((entry) => entry.toLowerCase() === brand.toLowerCase())
  if (exact) return exact
  return brand
}

async function resolveBrands(supabase, args) {
  const allBrands = await fetchDistinctBrands(supabase)

  if (args.brand) {
    const resolved = resolveBrandName(args.brand, allBrands)
    if (!allBrands.includes(resolved)) {
      console.warn(`Warning: brand "${args.brand}" not found in equipment_intelligence (resolved: "${resolved}").`)
    }
    return [resolved]
  }

  if (!args.all) {
    throw new Error('Specify --brand "Brand Name" or --all')
  }

  const priority = PRIORITY_BRANDS
    .map((brand) => resolveBrandName(brand, allBrands))
    .filter((brand) => allBrands.includes(brand))
  const missingPriority = PRIORITY_BRANDS.filter((brand) => !allBrands.includes(resolveBrandName(brand, allBrands)))
  if (missingPriority.length) {
    console.warn(`Priority brands not in catalogue: ${missingPriority.join(', ')}`)
  }

  const remaining = allBrands.filter((brand) => (
    !priority.includes(brand) && !SKIP_ALL_BRANDS.has(brand)
  ))

  return [...priority, ...remaining]
}

function coalesceKeeperFields(keeper, duplicates, idealProduct = null) {
  return coalesceMergedCanonicalProductFields(keeper, duplicates, idealProduct)
}

async function approveSafeProducts(supabase, brand) {
  const products = await fetchProducts(supabase, brand)
  const intelligenceIds = [
    ...new Set(products.flatMap((product) => product.source_intelligence_row_ids ?? [])),
  ]

  const intelligenceRows = []
  const chunkSize = 200
  for (let index = 0; index < intelligenceIds.length; index += chunkSize) {
    const chunk = intelligenceIds.slice(index, index + chunkSize)
    const { data, error } = await supabase
      .from('equipment_intelligence')
      .select(INTELLIGENCE_CANONICAL_APPLY_FIELDS)
      .in('id', chunk)
    if (error) throw error
    intelligenceRows.push(...(data ?? []))
  }

  const intelligenceRowsById = new Map(intelligenceRows.map((row) => [row.id, row]))
  const safeIds = buildSafeApprovalCandidateIds(products, intelligenceRowsById)
  const singleSourceIds = buildSingleSourceNeedsReviewCandidateIds(products, intelligenceRowsById)
  const approveIds = [...new Set([...safeIds, ...singleSourceIds])]

  let approved = 0
  for (const productId of approveIds) {
    const product = products.find((entry) => entry.id === productId)
    if (!product) continue

    const { error } = await supabase
      .from('equipment_products')
      .update({ status: PRODUCT_STATUS.APPROVED })
      .eq('id', productId)
      .eq('status', product.status)

    if (error) throw error
    approved += 1
  }

  return {
    approved,
    safeIds: safeIds.length,
    singleSourceIds: singleSourceIds.length,
  }
}

async function repairConsoleDuplicates(supabase, brand, intelligenceRows) {
  const products = await fetchProducts(supabase, brand)
  const plan = buildConsoleDuplicateRepairPlan(products, intelligenceRows)

  let merged = 0
  let excluded = 0

  for (const merge of plan.merges) {
    const keeperFields = coalesceKeeperFields(
      merge.keeper,
      merge.duplicates,
      merge.idealProduct,
    )

    const { error: keeperError } = await supabase
      .from('equipment_products')
      .update({
        ...keeperFields,
        source_intelligence_row_ids: merge.mergedSourceIds,
        status: merge.keeper.status === PRODUCT_STATUS.EXCLUDED
          ? PRODUCT_STATUS.APPROVED
          : merge.keeper.status,
      })
      .eq('id', merge.keeper.id)

    if (keeperError) throw keeperError
    merged += 1

    for (const duplicate of merge.duplicates) {
      const { error: duplicateError } = await supabase
        .from('equipment_products')
        .update({
          status: PRODUCT_STATUS.EXCLUDED,
          review_notes: `Merged into ${merge.keeper.id} (${merge.idealProductName})`,
        })
        .eq('id', duplicate.id)

      if (duplicateError) throw duplicateError
      excluded += 1
    }
  }

  return { merged, excluded, ambiguous: plan.ambiguous.length }
}

async function rebuildCanonicalProductNames(supabase, brand, intelligenceRows, { dryRun = true } = {}) {
  const audit = buildCanonicalProductAuditReport(intelligenceRows, { brandFilter: brand })
  const idealByKey = new Map(audit.products.map((product) => [product.canonical_product_key, product]))
  const products = await fetchProducts(supabase, brand)

  const changes = []
  let unchanged = 0
  let missingIdeal = 0

  for (const product of products) {
    const ideal = idealByKey.get(product.canonical_product_key)
    if (!ideal?.canonical_product_name) {
      missingIdeal += 1
      continue
    }

    if (product.canonical_product_name === ideal.canonical_product_name) {
      unchanged += 1
      continue
    }

    changes.push({
      id: product.id,
      canonical_product_key: product.canonical_product_key,
      before: product.canonical_product_name,
      after: ideal.canonical_product_name,
    })
  }

  if (!dryRun) {
    for (const change of changes) {
      const { error } = await supabase
        .from('equipment_products')
        .update({ canonical_product_name: change.after })
        .eq('id', change.id)
      if (error) throw error
    }
  }

  return { updated: changes.length, unchanged, missingIdeal, changes }
}

function printCanonicalNameRebuildReport(brand, report) {
  console.log(`\nCanonical name rebuild for ${brand}`)
  console.log('='.repeat(60))
  console.log(`Products renamed:   ${report.updated}`)
  console.log(`Already correct:    ${report.unchanged}`)
  console.log(`Missing ideal name: ${report.missingIdeal}`)

  if (report.changes.length) {
    console.log('\nRename examples:')
    for (const change of report.changes.slice(0, 15)) {
      console.log(`  ${change.before}`)
      console.log(`    -> ${change.after}`)
    }
    if (report.changes.length > 15) {
      console.log(`  ...and ${report.changes.length - 15} more`)
    }
  }
}

function printWorkflowReport(brand, workflow, { mode = 'DRY-RUN' } = {}) {
  console.log(`\n${'='.repeat(60)}`)
  console.log(`Brand: ${brand}`)
  console.log(`Mode: ${mode}`)
  console.log(`${'='.repeat(60)}`)
  console.log(`Raw intelligence rows:        ${workflow.total_intelligence_rows}`)
  console.log(`Suggested canonical products: ${workflow.suggested_canonical_products}`)
  console.log(`Duplicates collapsed:         ${workflow.duplicate_rows_collapsed}`)
  console.log(`Needs review:                 ${workflow.products_needing_review}`)
  console.log(`Safe approvals:               ${workflow.safe_approvals}`)
  console.log(`Single-source approvals:      ${workflow.single_source_approvals}`)
  console.log(`Console-only groups:          ${workflow.console_only_groups}`)
  console.log(`Merge clusters:               ${workflow.merge_clusters}`)
  console.log(`Ambiguous products:           ${workflow.ambiguous_products}`)

  const examples = workflow.audit.examples_by_brand[brand] ?? []
  if (examples.length) {
    console.log('\nExamples:')
    for (const example of examples.slice(0, 5)) {
      console.log(`  ${example.canonical_product_name} (${example.source_row_count} rows, ${example.status})`)
      console.log(`    consoles: ${example.detected_consoles.join(', ') || 'base'}`)
      console.log(`    models: ${example.source_models.join(' · ')}`)
    }
  }
}

function printFinalCounts(brand, counts) {
  console.log(`\nFinal counts for ${brand}:`)
  console.log(`  approved:         ${counts.approved}`)
  console.log(`  pending:          ${counts.pending}`)
  console.log(`  needs_review:     ${counts.needs_review}`)
  console.log(`  excluded:         ${counts.excluded}`)
  console.log(`  complete:         ${counts.complete}`)
  console.log(`  missing price:    ${counts.missing_price}`)
  console.log(`  missing baseline: ${counts.missing_baseline}`)
  console.log(`  missing both:     ${counts.missing_both}`)
}

function buildTechnogymGroupingComparison(intelligenceRows) {
  const before = buildCanonicalProductAuditReport(intelligenceRows, {
    brandFilter: 'Technogym',
    technogymGroupingEnabled: false,
  })
  const after = buildCanonicalProductAuditReport(intelligenceRows, {
    brandFilter: 'Technogym',
    technogymGroupingEnabled: true,
  })

  const mergeExamples = []
  for (const row of intelligenceRows) {
    const beforeFields = deriveCanonicalProductFields(row, { technogymGroupingEnabled: false })
    const afterFields = deriveCanonicalProductFields(row, { technogymGroupingEnabled: true })
    if (beforeFields.canonical_product_key === afterFields.canonical_product_key) continue

    mergeExamples.push({
      model: row.model,
      series: row.series,
      equipment_type: row.equipment_type,
      before_key: beforeFields.canonical_product_key,
      after_key: afterFields.canonical_product_key,
      before_name: beforeFields.canonical_product_name,
      after_name: afterFields.canonical_product_name,
      variant_name: deriveCoreProductFields(row, { technogymGroupingEnabled: true }).variant_name,
    })
  }

  const packageExamples = mergeExamples.filter((example) => (
    /\b(1000|700|900|500|600)\s*(P|SP|CE|IFI)\b/i.test(example.model)
    || /\b(UNITY|VISIO|DIGITAL TV|LED|TV|CONNECT|LIVE)\b/i.test(example.model)
  ))

  const hardwareChecks = [
    ['SYNCHRO 700', 'SYNCHRO 1000'],
    ['RECLINE EXCITE 700', 'RECLINE EXCITE 1000 P'],
    ['RUN EXCITE 500', 'RUN EXCITE 700'],
    ['SYNCHRO EXCITE 700', 'SYNCHRO EXCITE 1000 P'],
  ]

  const hardwareTierPreserved = hardwareChecks.map(([leftModel, rightModel]) => {
    const leftRow = intelligenceRows.find((row) => row.model === leftModel)
    const rightRow = intelligenceRows.find((row) => row.model === rightModel)
    if (!leftRow || !rightRow) return null

    const left = deriveCoreProductFields(leftRow, { technogymGroupingEnabled: true })
    const right = deriveCoreProductFields(rightRow, { technogymGroupingEnabled: true })
    return {
      left_model: leftModel,
      right_model: rightModel,
      left_key: left.core_product_key,
      right_key: right.core_product_key,
      remain_separate: left.core_product_key !== right.core_product_key,
    }
  }).filter(Boolean)

  return {
    before: {
      suggested_canonical_products: before.suggested_canonical_products,
      duplicate_rows_collapsed: before.duplicate_rows_collapsed,
      products_needing_review: before.products_needing_review,
    },
    after: {
      suggested_canonical_products: after.suggested_canonical_products,
      duplicate_rows_collapsed: after.duplicate_rows_collapsed,
      products_needing_review: after.products_needing_review,
    },
    delta: {
      canonical_products: after.suggested_canonical_products - before.suggested_canonical_products,
      duplicates_collapsed: after.duplicate_rows_collapsed - before.duplicate_rows_collapsed,
      needs_review: after.products_needing_review - before.products_needing_review,
    },
    merge_examples: packageExamples.slice(0, 40),
    hardware_tier_preserved: hardwareTierPreserved,
  }
}

function printTechnogymGroupingComparison(comparison) {
  console.log('\nTechnogym grouping comparison (previous rules vs updated rules)')
  console.log('===============================================================')
  console.log(`Previous canonical products:  ${comparison.before.suggested_canonical_products}`)
  console.log(`New canonical products:       ${comparison.after.suggested_canonical_products}`)
  console.log(`Canonical product delta:      ${comparison.delta.canonical_products}`)
  console.log(`Previous duplicates collapsed: ${comparison.before.duplicate_rows_collapsed}`)
  console.log(`New duplicates collapsed:      ${comparison.after.duplicate_rows_collapsed}`)
  console.log(`Additional duplicates collapsed: ${comparison.delta.duplicates_collapsed}`)
  console.log(`Previous needs_review:        ${comparison.before.products_needing_review}`)
  console.log(`New needs_review:             ${comparison.after.products_needing_review}`)
  console.log(`Needs_review delta:           ${comparison.delta.needs_review}`)

  if (comparison.merge_examples.length) {
    console.log('\nP / SP / CE / IFI / console merge examples:')
    for (const example of comparison.merge_examples.slice(0, 15)) {
      console.log(`  ${example.model}`)
      console.log(`    -> ${example.after_name}`)
      console.log(`    variant: ${example.variant_name || '—'}`)
    }
    if (comparison.merge_examples.length > 15) {
      console.log(`  ...and ${comparison.merge_examples.length - 15} more`)
    }
  }

  if (comparison.hardware_tier_preserved.length) {
    console.log('\nHardware tier separation checks:')
    for (const check of comparison.hardware_tier_preserved) {
      console.log(`  ${check.left_model} vs ${check.right_model}: ${check.remain_separate ? 'REMAIN SEPARATE' : 'WARNING — same key'}`)
    }
  }
}

function printLifeFitnessDateSuffixPreview(audit, repairPlan) {
  const collapsed = audit.products.filter((product) => (
    product.source_row_count > 1
    && (product.lifecycle_notes?.length || product.source_rows.some((row) => /\(\s*\d{2,4}/.test(row.model ?? '')))
  ))

  const dateSuffixMerges = repairPlan.merges.filter((merge) => (
    [merge.keeper, ...merge.duplicates].some((product) => (
      /\(\s*\d{2,4}/.test(product.canonical_product_name ?? '')
    ))
  ))

  console.log('\nLife Fitness date-suffix duplicate preview')
  console.log('========================================')
  console.log(`Intelligence rows collapsing by date marker: ${collapsed.length}`)
  console.log(`equipment_products merge clusters (date suffix): ${dateSuffixMerges.length}`)

  if (collapsed.length) {
    console.log('\nCollapsed canonical examples (from intelligence audit):')
    for (const product of collapsed.slice(0, 12)) {
      console.log(`  ${product.canonical_product_name} (${product.source_row_count} rows)`)
      console.log(`    models: ${product.source_rows.map((row) => row.model).join(' · ')}`)
      if (product.lifecycle_notes?.length) {
        console.log(`    lifecycle: ${product.lifecycle_notes.join(', ')}`)
      }
    }
    if (collapsed.length > 12) {
      console.log(`  ...and ${collapsed.length - 12} more`)
    }
  }

  if (dateSuffixMerges.length) {
    console.log('\nMerge candidates (existing equipment_products):')
    for (const merge of dateSuffixMerges) {
      console.log(`  -> ${merge.idealProductName}`)
      console.log(`     keeper: ${merge.keeper.canonical_product_name}`)
      for (const duplicate of merge.duplicates) {
        console.log(`     duplicate: ${duplicate.canonical_product_name}`)
      }
    }
  }
}

async function processBrand(supabase, brand, args) {
  const intelligenceRows = await fetchIntelligenceRows(supabase, brand)
  const equipmentProducts = await fetchProducts(supabase, brand)

  if (isTechnogymBrand(brand) && args.dryRun && !args.apply) {
    const comparison = buildTechnogymGroupingComparison(intelligenceRows)
    printTechnogymGroupingComparison(comparison)
  }

  const audit = buildCanonicalProductAuditReport(intelligenceRows, { brandFilter: brand })
  const workflow = buildBrandCanonicalWorkflowReport(audit, {
    equipmentProducts,
    intelligenceRows,
  })

  if (isLifeFitnessBrand(brand) && args.dryRun && !args.apply) {
    printLifeFitnessDateSuffixPreview(audit, workflow.repairPlan)
  }

  const mode = args.dryRun && !args.apply && !args.approveSafe && !args.repair
    ? 'DRY-RUN'
    : 'APPLY'

  printWorkflowReport(brand, workflow, { mode })

  if (args.rebuildNames) {
    const rebuild = await rebuildCanonicalProductNames(
      supabase,
      brand,
      intelligenceRows,
      { dryRun: args.dryRun && !args.apply },
    )
    printCanonicalNameRebuildReport(brand, rebuild)
    if (!args.apply && !args.approveSafe && !args.repair && !args.report) {
      const finalProducts = await fetchProducts(supabase, brand)
      const counts = summarizeEquipmentProductCounts(finalProducts)
      printFinalCounts(brand, counts)
      return { brand, workflow, counts, rebuild }
    }
  }

  if (args.report) {
    const counts = summarizeEquipmentProductCounts(equipmentProducts)
    printFinalCounts(brand, counts)
    return { brand, workflow, counts }
  }

  if (args.apply) {
    const applyResult = await applyCanonicalProductsForBrand(supabase, brand, {
      apply: true,
      allowPlusKeyRisk: Boolean(args.allowPlusKeyRisk),
      allowManufactureYearAsBaseline: Boolean(args.allowManufactureYearAsBaseline),
    })
    if (args.allowManufactureYearAsBaseline) {
      console.warn(
        '\nWARNING: --allow-manufacture-year-as-baseline is enabled.\n'
        + 'Generic manufacture_year may be copied into baseline_manufacture_year for this brand only.\n'
        + 'Use only for trusted historical imports where manufacture_year means earliest release.',
      )
    }
    if (applyResult.skipped) {
      console.warn(`\nSkipped apply for ${brand} (legacy plus-key risk).`)
      for (const warning of applyResult.warnings ?? []) {
        console.warn(`  ${warning}`)
      }
      console.warn('Re-run with --allow-plus-key-risk only after a dedicated key migration plan.')
    } else if (applyResult.productsFailed) {
      console.error(`\nApply completed with ${applyResult.productsFailed} failure(s).`)
      for (const error of applyResult.errors ?? []) {
        console.error(`  ${error.key}: ${error.message}`)
      }
    } else {
      console.log(
        `\nApplied canonical products for ${brand}: ${applyResult.productsInserted} inserted, ${applyResult.productsUpdated} updated.`,
      )
    }
    if (applyResult.countNote) {
      console.log(`Count note: ${applyResult.countNote}`)
    }
  }

  if (args.approveSafe) {
    const approval = await approveSafeProducts(supabase, brand)
    console.log(`\nApproved ${approval.approved} safe product(s) (${approval.safeIds} safe + ${approval.singleSourceIds} single-source needs_review).`)
  }

  if (args.repair) {
    const repair = await repairConsoleDuplicates(supabase, brand, intelligenceRows)
    console.log(`\nRepaired ${repair.merged} merge cluster(s), excluded ${repair.excluded} duplicate row(s).`)
    console.log(`Ambiguous products left untouched: ${repair.ambiguous}`)
  }

  const finalProducts = await fetchProducts(supabase, brand)
  const counts = summarizeEquipmentProductCounts(finalProducts)
  printFinalCounts(brand, counts)

  return { brand, workflow, counts }
}

async function main() {
  const args = parseArgs(process.argv)
  const env = loadEnv()
  const supabase = createClient(
    env.VITE_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY || env.VITE_SUPABASE_ANON_KEY,
  )

  const brands = await resolveBrands(supabase, args)
  console.log(`Canonical product workflow`)
  console.log(`Brands: ${brands.join(', ')}`)
  console.log(`Flags: apply=${args.apply} approve-safe=${args.approveSafe} repair=${args.repair} rebuild-names=${args.rebuildNames} allow-plus-key-risk=${args.allowPlusKeyRisk} allow-manufacture-year-as-baseline=${args.allowManufactureYearAsBaseline} report=${args.report}`)

  const results = []
  for (const brand of brands) {
    results.push(await processBrand(supabase, brand, args))
  }

  if (brands.length > 1) {
    console.log(`\n${'='.repeat(60)}`)
    console.log('All brands summary')
    console.log(`${'='.repeat(60)}`)
    for (const result of results) {
      printFinalCounts(result.brand, result.counts)
    }
  }

  if (args.dryRun && !args.apply && !args.approveSafe && !args.repair) {
    console.log('\nDry-run only — no database changes made.')
    console.log('Re-run with --apply [--approve-safe] [--repair] to write changes.')
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
