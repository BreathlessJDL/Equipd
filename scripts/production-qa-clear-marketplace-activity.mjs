#!/usr/bin/env node
/**
 * Production QA cleanup: remove test marketplace activity, keep listings/users.
 *
 * Dry run (safe, read-only counts):
 *   node scripts/production-qa-clear-marketplace-activity.mjs --dry-run
 *
 * Execute (destructive — requires explicit confirmation):
 *   PRODUCTION_QA_CLEANUP_CONFIRM=true node scripts/production-qa-clear-marketplace-activity.mjs --execute
 *
 * Uses linked Supabase project via `supabase db query --linked`.
 */

import { execFileSync } from 'child_process'
import { readFileSync, writeFileSync, unlinkSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const SQL_PATH = join(ROOT, 'supabase', 'production-qa-clear-marketplace-activity.sql')
const STOP_MARKER = '-- STOP HERE FOR DRY-RUN ONLY'
const CONFIRM_ENV = 'PRODUCTION_QA_CLEANUP_CONFIRM'

function getExecuteCommandHint() {
  if (process.platform === 'win32') {
    return `$env:${CONFIRM_ENV}="true"\nnode scripts/production-qa-clear-marketplace-activity.mjs --execute`
  }
  return `${CONFIRM_ENV}=true node scripts/production-qa-clear-marketplace-activity.mjs --execute`
}

const args = new Set(process.argv.slice(2))
const execute = args.has('--execute')

if (args.has('--dry-run') && execute) {
  console.error('Use either --dry-run or --execute, not both.')
  process.exit(1)
}

if (args.has('--help') || args.has('-h')) {
  console.log('Usage:')
  console.log('  node scripts/production-qa-clear-marketplace-activity.mjs --dry-run')
  console.log(
    `  ${CONFIRM_ENV}=true node scripts/production-qa-clear-marketplace-activity.mjs --execute`,
  )
  process.exit(0)
}

const source = readFileSync(SQL_PATH, 'utf8')
const stopIndex = source.indexOf(STOP_MARKER)

if (stopIndex === -1) {
  throw new Error(`Could not find stop marker in ${SQL_PATH}`)
}

let sql

if (!execute) {
  sql = source.slice(0, stopIndex)
  console.log('Running production QA marketplace cleanup DRY RUN (read-only counts)...\n')
} else {
  if (process.env[CONFIRM_ENV] !== 'true') {
    console.error(
      `Refusing to execute: set ${CONFIRM_ENV}=true to confirm destructive cleanup.`,
    )
    process.exit(1)
  }

  sql = source.slice(stopIndex)
  sql = sql.replace('confirmed boolean := false;', 'confirmed boolean := true;')
  console.log('Running production QA marketplace cleanup EXECUTE (destructive)...\n')
  console.log('Keeps: users, profiles, listings, listing_images, categories/brands.')
  console.log('Deletes: offers, orders, payments, conversations, marketplace notifications.\n')
}

const tempPath = join(ROOT, 'supabase', '.production-qa-clear-marketplace-activity.tmp.sql')
writeFileSync(tempPath, sql, 'utf8')

try {
  execFileSync(
    `npx supabase db query --linked -f "${tempPath}" -o json`,
    {
      cwd: ROOT,
      stdio: 'inherit',
      encoding: 'utf8',
      shell: true,
    },
  )

  if (!execute) {
    console.log('\nDry run complete. No marketplace data was deleted.')
    console.log('To execute:')
    console.log(getExecuteCommandHint())
  } else {
    console.log('\nCleanup committed successfully.')
  }
} finally {
  try {
    unlinkSync(tempPath)
  } catch {
    // ignore
  }
}
