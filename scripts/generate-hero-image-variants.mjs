#!/usr/bin/env node
/**
 * Produces AVIF/WebP siblings for the homepage hero PNGs.
 *
 * The source PNGs stay in place as the <picture> fallback; only the encoding
 * changes, so the composition and crops are untouched.
 *
 * Usage:
 *   node scripts/generate-hero-image-variants.mjs
 */

import { readFileSync, statSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import sharp from 'sharp'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SOURCE_DIR = join(ROOT, 'public', 'design-reference')

const SOURCES = [
  'New main hero banner main.png',
  'second-hero-banner-mobile.png',
]

function kb(bytes) {
  return `${(bytes / 1024).toFixed(0)} kB`
}

async function main() {
  for (const filename of SOURCES) {
    const sourcePath = join(SOURCE_DIR, filename)
    const original = readFileSync(sourcePath)
    const base = filename.replace(/\.png$/i, '')

    const webpPath = join(SOURCE_DIR, `${base}.webp`)
    const avifPath = join(SOURCE_DIR, `${base}.avif`)

    const webp = await sharp(original).webp({ quality: 82, effort: 6 }).toBuffer()
    const avif = await sharp(original).avif({ quality: 55, effort: 6 }).toBuffer()

    writeFileSync(webpPath, webp)
    writeFileSync(avifPath, avif)

    console.log(`${filename}`)
    console.log(`  png  ${kb(statSync(sourcePath).size).padStart(8)}`)
    console.log(`  webp ${kb(webp.length).padStart(8)}  (${((1 - webp.length / original.length) * 100).toFixed(0)}% smaller)`)
    console.log(`  avif ${kb(avif.length).padStart(8)}  (${((1 - avif.length / original.length) * 100).toFixed(0)}% smaller)`)
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
