#!/usr/bin/env node
/**
 * Batch-regenerate approved content for multiple home-use brands.
 *
 * Usage:
 *   node scripts/regenerate-home-brand-product-content.mjs --dry-run
 *   node scripts/regenerate-home-brand-product-content.mjs --apply
 *   node scripts/regenerate-home-brand-product-content.mjs --apply --limit-per-brand 5
 */

import { spawn } from 'node:child_process'
import { join } from 'node:path'

const HOME_BRANDS = [
  'ProForm',
  'Sole',
  'Horizon Fitness',
  'York Fitness',
  'Reebok',
  'Schwinn',
  'WaterRower',
  'BH Fitness',
  'Powertec',
  'REP',
  'Spirit',
]

function parseArgs(argv) {
  const args = {
    apply: false,
    dryRun: true,
    limitPerBrand: null,
    delayMs: 200,
  }
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index]
    if (token === '--apply') {
      args.apply = true
      args.dryRun = false
    } else if (token === '--dry-run') {
      args.dryRun = true
      args.apply = false
    } else if (token === '--limit-per-brand') {
      args.limitPerBrand = Number(argv[index + 1])
      index += 1
    } else if (token === '--delay-ms') {
      args.delayMs = Number(argv[index + 1] ?? 200)
      index += 1
    }
  }
  return args
}

function runBrand(brand, args) {
  return new Promise((resolve, reject) => {
    const script = join(process.cwd(), 'scripts', 'regenerate-approved-product-content-by-brand.mjs')
    const childArgs = [script, '--brand', brand, `--delay-ms`, String(args.delayMs)]
    if (args.apply) childArgs.push('--apply')
    else childArgs.push('--dry-run')
    if (Number.isFinite(args.limitPerBrand) && args.limitPerBrand > 0) {
      childArgs.push('--limit', String(args.limitPerBrand))
    }

    const child = spawn(process.execPath, childArgs, {
      cwd: process.cwd(),
      stdio: ['ignore', 'pipe', 'pipe'],
      env: process.env,
    })

    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (chunk) => {
      const text = chunk.toString()
      stdout += text
      process.stdout.write(text)
    })
    child.stderr.on('data', (chunk) => {
      const text = chunk.toString()
      stderr += text
      process.stderr.write(text)
    })
    child.on('error', reject)
    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`${brand} exited ${code}: ${stderr || stdout.slice(-500)}`))
        return
      }
      resolve(stdout)
    })
  })
}

function extractReport(stdout) {
  const marker = '=== regeneration report ==='
  const index = stdout.lastIndexOf(marker)
  if (index < 0) return null
  const jsonText = stdout.slice(index + marker.length).trim()
  try {
    return JSON.parse(jsonText)
  } catch {
    return null
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const combined = {
    mode: args.apply ? 'apply' : 'dry-run',
    brands: [],
    rows_updated: 0,
    rows_failed: 0,
    validation_failures: [],
    before_after: [],
  }

  for (const brand of HOME_BRANDS) {
    console.log(`\n######## ${brand} ########`)
    const stdout = await runBrand(brand, args)
    const report = extractReport(stdout)
    if (!report) {
      combined.brands.push({ brand, note: 'no approved content or no report' })
      continue
    }
    combined.brands.push({
      brand: report.brand,
      considered: report.considered,
      updated: report.updated,
      failed: report.failed,
    })
    combined.rows_updated += report.updated || 0
    combined.rows_failed += report.failed || 0
    for (const failure of report.validation_failures || []) {
      combined.validation_failures.push(failure)
    }
    for (const example of report.before_after || []) {
      if (combined.before_after.length < 12) combined.before_after.push(example)
    }
  }

  console.log('\n======== COMBINED HOME-BRAND REGENERATION REPORT ========')
  console.log(JSON.stringify(combined, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
