/**
 * Write the IndexNow verification key file into public/ at build time.
 *
 * Architecture (hardened Option A):
 * - Production Vercel builds (VERCEL_ENV=production) REQUIRE INDEXNOW_KEY and write
 *   public/{KEY}.txt with exact UTF-8 body (no newline).
 * - Preview / local builds skip generation so they never claim the production key
 *   location and still succeed without INDEXNOW_KEY.
 * - Optional INDEXNOW_WRITE_KEY_FILE=1 forces a write (e.g. local verification).
 * - Generated files are gitignored; never commit the key file.
 *
 * Rotation: set a new INDEXNOW_KEY in Vercel + Supabase Edge secrets, redeploy
 * production (new file appears; old filename stops being served), then update
 * any Bing Webmaster key registration if required.
 *
 * Usage: node scripts/write-indexnow-key-file.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { isValidIndexNowKeyFormat } from '../src/lib/indexNowCore.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const publicDir = path.join(root, 'public')

const key = String(process.env.INDEXNOW_KEY ?? '').trim()
const vercelEnv = String(process.env.VERCEL_ENV ?? '').trim().toLowerCase()
const forceWrite = ['1', 'true', 'yes'].includes(
  String(process.env.INDEXNOW_WRITE_KEY_FILE ?? '').trim().toLowerCase(),
)
const isProductionBuild = vercelEnv === 'production'

function removeGeneratedKeyFiles() {
  if (!fs.existsSync(publicDir)) return
  for (const name of fs.readdirSync(publicDir)) {
    if (!name.endsWith('.txt') || name === 'robots.txt') continue
    if (!isValidIndexNowKeyFormat(name.slice(0, -4))) continue
    fs.unlinkSync(path.join(publicDir, name))
  }
}

if (!isProductionBuild && !forceWrite) {
  // Avoid leaving a previously generated production key file in public/ for preview/local.
  removeGeneratedKeyFiles()
  console.log(
    `[indexnow] skipping key file generation (VERCEL_ENV=${vercelEnv || 'unset'}; preview/local)`,
  )
  process.exit(0)
}

if (!key) {
  console.error('[indexnow] INDEXNOW_KEY is required for production key-file generation')
  process.exit(1)
}

if (!isValidIndexNowKeyFormat(key)) {
  console.error('[indexnow] INDEXNOW_KEY has invalid format (8-128 chars of [a-zA-Z0-9-])')
  process.exit(1)
}

fs.mkdirSync(publicDir, { recursive: true })
removeGeneratedKeyFiles()

const filePath = path.join(publicDir, `${key}.txt`)
fs.writeFileSync(filePath, key, { encoding: 'utf8' })

const written = fs.readFileSync(filePath, 'utf8')
if (written !== key) {
  console.error('[indexnow] key file contents do not exactly match INDEXNOW_KEY')
  process.exit(1)
}
if (/\r|\n/.test(written)) {
  console.error('[indexnow] key file must not contain newlines')
  process.exit(1)
}

console.log(
  `[indexnow] wrote public/{key}.txt (${key.length} chars, exact match, production=${isProductionBuild})`,
)
