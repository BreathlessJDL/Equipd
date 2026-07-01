#!/usr/bin/env node
/**
 * Copy the approved email logo into public/email (no image processing).
 *
 * Usage:
 *   node scripts/generate-email-logo-assets.mjs
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const SOURCE = path.join(ROOT, 'debug-screenshots/Full_logo-removebg-preview.png')
const OUT_DIR = path.join(ROOT, 'public/email')
const TARGET = path.join(OUT_DIR, 'equipd-full-logo.png')

function main() {
  if (!fs.existsSync(SOURCE)) {
    console.error(`Missing approved logo: ${SOURCE}`)
    process.exit(1)
  }

  fs.mkdirSync(OUT_DIR, { recursive: true })
  fs.copyFileSync(SOURCE, TARGET)
  console.log(`Copied ${path.relative(ROOT, SOURCE)} -> ${path.relative(ROOT, TARGET)}`)
}

main()
