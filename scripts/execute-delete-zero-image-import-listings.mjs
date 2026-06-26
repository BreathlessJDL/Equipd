#!/usr/bin/env node
/**
 * Execute zero-image import listing cleanup (requires confirmed guard in SQL).
 *
 * Usage:
 *   node scripts/execute-delete-zero-image-import-listings.mjs
 */

import { execFileSync } from 'child_process'
import { readFileSync, writeFileSync, unlinkSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const sourcePath = join(ROOT, 'supabase', 'delete-zero-image-import-listings.sql')
const tempPath = join(ROOT, 'supabase', '.delete-zero-image-import-listings.execute.tmp.sql')

const source = readFileSync(sourcePath, 'utf8')
const marker = '-- STOP HERE FOR DRY-RUN ONLY'
const startIndex = source.indexOf(marker)

if (startIndex === -1) {
  throw new Error('Could not find dry-run stop marker in SQL file.')
}

let executeSql = source.slice(startIndex)
executeSql = executeSql.replace(
  'confirmed boolean := false;',
  'confirmed boolean := true;',
)

writeFileSync(tempPath, executeSql, 'utf8')

try {
  execFileSync('npx', ['supabase', 'db', 'query', '--linked', '-f', tempPath], {
    cwd: ROOT,
    stdio: 'inherit',
    encoding: 'utf8',
  })
} finally {
  try {
    unlinkSync(tempPath)
  } catch {
    // ignore
  }
}
