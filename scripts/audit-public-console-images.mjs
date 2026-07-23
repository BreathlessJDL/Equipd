#!/usr/bin/env node
/**
 * Audit console images used by public product compatibility mappings.
 *
 * Uses the same URL helper as the public site (resolveEquipmentConsoleImageUrl).
 * Groups duplicate failures so one broken console is reported once.
 *
 * Usage:
 *   node scripts/audit-public-console-images.mjs
 *   node scripts/audit-public-console-images.mjs --brand "Life Fitness"
 *   node scripts/audit-public-console-images.mjs --require-git-tracked
 *   node scripts/audit-public-console-images.mjs --verify-http --base-url https://www.equipd.co.uk
 *   node scripts/audit-public-console-images.mjs --fail-on-error
 */

import { createClient } from '@supabase/supabase-js'
import { execSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { PRODUCT_STATUS } from '../src/lib/intelligenceCanonicalProducts.js'
import { resolveEquipmentConsoleImageUrl } from '../src/lib/equipmentConsoleImages.js'

const REPORTS_DIR = join(process.cwd(), 'reports')
const JSON_PATH = join(REPORTS_DIR, 'public-console-image-audit.json')
const CSV_PATH = join(REPORTS_DIR, 'public-console-image-audit.csv')

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
    brand: null,
    requireGitTracked: false,
    verifyHttp: false,
    baseUrl: 'https://www.equipd.co.uk',
    failOnError: false,
    failOnDeployBlockers: false,
  }
  for (let index = 2; index < argv.length; index += 1) {
    const token = argv[index]
    if (token === '--require-git-tracked') args.requireGitTracked = true
    else if (token === '--verify-http') args.verifyHttp = true
    else if (token === '--fail-on-error') args.failOnError = true
    else if (token === '--fail-on-deploy-blockers') args.failOnDeployBlockers = true
    else if (token === '--brand') {
      args.brand = argv[index + 1] ?? null
      index += 1
    } else if (token === '--base-url') {
      args.baseUrl = String(argv[index + 1] ?? args.baseUrl).replace(/\/$/, '')
      index += 1
    }
  }
  return args
}

function normalizeWhitespace(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim()
}

function csvEscape(value) {
  const text = String(value ?? '')
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`
  return text
}

function writeCsv(path, headers, rows) {
  const lines = [headers.join(',')]
  for (const row of rows) {
    lines.push(headers.map((header) => csvEscape(row[header])).join(','))
  }
  writeFileSync(path, `${lines.join('\n')}\n`)
}

function localPathFromResolvedUrl(resolvedUrl) {
  const text = String(resolvedUrl ?? '').trim()
  if (!text.startsWith('/equipment-console-images/')) return null
  let relative = text.slice(1)
  try {
    relative = decodeURIComponent(relative)
  } catch {
    // keep encoded relative
  }
  return join(process.cwd(), 'public', relative)
}

function isGitTracked(relativeFromRepoRoot) {
  try {
    execSync(`git ls-files --error-unmatch -- "${relativeFromRepoRoot.replace(/\\/g, '/')}"`, {
      stdio: ['ignore', 'pipe', 'ignore'],
    })
    return true
  } catch {
    return false
  }
}

async function fetchAll(supabase, table, select, extra = (query) => query) {
  const pageSize = 1000
  const rows = []
  for (let from = 0; ; from += pageSize) {
    let query = supabase.from(table).select(select).range(from, from + pageSize - 1)
    query = extra(query)
    const { data, error } = await query
    if (error) throw error
    const batch = data ?? []
    rows.push(...batch)
    if (batch.length < pageSize) break
  }
  return rows
}

async function httpStatus(url) {
  try {
    const response = await fetch(url, { method: 'HEAD', redirect: 'follow' })
    if (response.ok || response.status === 405) {
      if (response.status === 405) {
        const getResponse = await fetch(url, { method: 'GET', redirect: 'follow' })
        return getResponse.status
      }
      return response.status
    }
    // Some hosts reject HEAD; retry GET without downloading body fully when possible.
    if (response.status === 404 || response.status === 403) return response.status
    const getResponse = await fetch(url, { method: 'GET', redirect: 'follow' })
    return getResponse.status
  } catch (error) {
    return `ERR:${error?.message || 'fetch_failed'}`
  }
}

async function main() {
  const args = parseArgs(process.argv)
  const env = loadEnv()
  const supabase = createClient(
    env.VITE_SUPABASE_URL || env.SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )

  const consoles = await fetchAll(
    supabase,
    'equipment_consoles',
    'id, brand, console_key, console_name, image_url, image_storage_path, image_status, active',
    (query) => {
      let next = query.eq('active', true).order('brand').order('console_name')
      if (args.brand) next = next.ilike('brand', args.brand)
      return next
    },
  )

  const products = await fetchAll(
    supabase,
    'equipment_products',
    'id, brand, canonical_product_name, status',
    (query) => query.eq('status', PRODUCT_STATUS.APPROVED),
  )
  const publicProductIds = new Set(products.map((row) => row.id))

  const compatRows = await fetchAll(
    supabase,
    'product_console_compat',
    'id, product_id, console_id',
  )

  const linkedProductIdsByConsole = new Map()
  for (const row of compatRows) {
    if (!publicProductIds.has(row.product_id)) continue
    if (!linkedProductIdsByConsole.has(row.console_id)) {
      linkedProductIdsByConsole.set(row.console_id, new Set())
    }
    linkedProductIdsByConsole.get(row.console_id).add(row.product_id)
  }

  const audited = []
  for (const consoleRow of consoles) {
    const linkedProductIds = linkedProductIdsByConsole.get(consoleRow.id)
    if (!linkedProductIds || linkedProductIds.size === 0) continue

    const storedPath = normalizeWhitespace(consoleRow.image_url)
      || normalizeWhitespace(consoleRow.image_storage_path)
      || null
    const resolvedUrl = resolveEquipmentConsoleImageUrl(consoleRow)
    const localPath = resolvedUrl ? localPathFromResolvedUrl(resolvedUrl) : null
    const localExists = localPath ? existsSync(localPath) : false
    const relativePublicPath = localPath
      ? localPath.slice(join(process.cwd()).length + 1).replace(/\\/g, '/')
      : null
    const gitTracked = relativePublicPath && localExists
      ? isGitTracked(relativePublicPath)
      : false

    let httpResult = null
    if (args.verifyHttp && resolvedUrl?.startsWith('/')) {
      httpResult = await httpStatus(`${args.baseUrl}${resolvedUrl}`)
    }

    const reasons = []
    if (!storedPath) reasons.push('no_image_path')
    else if (!resolvedUrl) reasons.push('unresolvable_path')
    if (resolvedUrl?.startsWith('/equipment-console-images/')) {
      if (!localExists) reasons.push('local_file_missing')
      else if (args.requireGitTracked && !gitTracked) reasons.push('not_git_tracked')
    }
    if (args.verifyHttp && httpResult != null && httpResult !== 200) {
      reasons.push(`http_${httpResult}`)
    }

    audited.push({
      brand: consoleRow.brand,
      console_name: consoleRow.console_name,
      console_key: consoleRow.console_key,
      console_id: consoleRow.id,
      image_status: consoleRow.image_status,
      stored_image_path: storedPath,
      resolved_public_url: resolvedUrl,
      local_path: relativePublicPath,
      local_exists: localExists,
      git_tracked: gitTracked,
      http_status: httpResult,
      compatible_public_products: linkedProductIds.size,
      ok: reasons.length === 0,
      failure_reasons: reasons,
    })
  }

  const failures = audited.filter((row) => !row.ok)
  const byBrand = {}
  for (const row of failures) {
    byBrand[row.brand] = (byBrand[row.brand] || 0) + 1
  }

  const summary = {
    total_console_options_audited: audited.length,
    broken_image_references: failures.length,
    ok_count: audited.length - failures.length,
    missing_by_brand: byBrand,
    require_git_tracked: args.requireGitTracked,
    verify_http: args.verifyHttp,
    base_url: args.verifyHttp ? args.baseUrl : null,
    canonical_resolver: 'src/lib/equipmentConsoleImages.js#resolveEquipmentConsoleImageUrl',
    canonical_path_format: '/equipment-console-images/{brand-slug}/normalized/{filename}',
  }

  mkdirSync(REPORTS_DIR, { recursive: true })
  writeFileSync(JSON_PATH, `${JSON.stringify({
    generated_at: new Date().toISOString(),
    read_only: true,
    args,
    summary,
    failures,
    audited,
  }, null, 2)}\n`)

  writeCsv(
    CSV_PATH,
    [
      'brand',
      'console_name',
      'console_key',
      'console_id',
      'stored_image_path',
      'resolved_public_url',
      'local_exists',
      'git_tracked',
      'http_status',
      'compatible_public_products',
      'ok',
      'failure_reasons',
    ],
    audited.map((row) => ({
      ...row,
      failure_reasons: row.failure_reasons.join('|'),
    })),
  )

  console.log('Public console image audit')
  console.log(summary)
  if (failures.length) {
    console.log('\nBroken references (deduped by console):')
    for (const row of failures) {
      console.log([
        row.brand,
        row.console_name,
        row.console_key,
        `products=${row.compatible_public_products}`,
        row.failure_reasons.join('|'),
        row.stored_image_path || '(none)',
        row.resolved_public_url || '(unresolved)',
      ].join(' | '))
    }
  }
  console.log(`Wrote ${JSON_PATH}`)
  console.log(`Wrote ${CSV_PATH}`)

  const deployBlockerReasons = new Set([
    'local_file_missing',
    'not_git_tracked',
    'unresolvable_path',
  ])
  const deployBlockers = failures.filter((row) => (
    row.failure_reasons.some((reason) => (
      deployBlockerReasons.has(reason) || reason.startsWith('http_')
    ))
  ))

  if (args.failOnDeployBlockers && deployBlockers.length) {
    console.error(`Deploy blockers: ${deployBlockers.length}`)
    process.exitCode = 1
  } else if (args.failOnError && failures.length) {
    process.exitCode = 1
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
