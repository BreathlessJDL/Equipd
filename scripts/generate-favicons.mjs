#!/usr/bin/env node
/**
 * Generate transparent PNG favicons from the mobile header logo asset.
 * Usage: node scripts/generate-favicons.mjs
 */

import fs from 'node:fs'
import path from 'node:path'
import { PNG } from 'pngjs'

const ROOT = path.resolve('.')
const SOURCE = path.join(ROOT, 'public/header-icons/equipd-logo-mobile-header.png')
const OUT_DIR = path.join(ROOT, 'public')

function resizePng(source, size) {
  const target = new PNG({ width: size, height: size })

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const srcX = Math.floor((x / size) * source.width)
      const srcY = Math.floor((y / size) * source.height)
      const srcIdx = (source.width * srcY + srcX) << 2
      const dstIdx = (size * y + x) << 2

      target.data[dstIdx] = source.data[srcIdx]
      target.data[dstIdx + 1] = source.data[srcIdx + 1]
      target.data[dstIdx + 2] = source.data[srcIdx + 2]
      target.data[dstIdx + 3] = source.data[srcIdx + 3]
    }
  }

  return target
}

const source = PNG.sync.read(fs.readFileSync(SOURCE))

const outputs = [
  ['favicon-16x16.png', 16],
  ['favicon-32x32.png', 32],
  ['favicon-48x48.png', 48],
  ['apple-touch-icon.png', 180],
]

for (const [filename, size] of outputs) {
  const outPath = path.join(OUT_DIR, filename)
  fs.writeFileSync(outPath, PNG.sync.write(resizePng(source, size)))
  console.log(`Wrote ${filename} (${size}x${size})`)
}

console.log('Favicon generation complete.')
