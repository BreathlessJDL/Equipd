#!/usr/bin/env node
/**
 * Remove near-white backgrounds from Hub sidebar menu PNG icons.
 * Usage: node scripts/make-hub-menu-icons-transparent.mjs
 */

import fs from 'node:fs'
import path from 'node:path'
import { PNG } from 'pngjs'

const ROOT = path.resolve('.')
const ICON_DIR = path.join(ROOT, 'public/design-reference')

const ICON_FILES = [
  'summary icon menu.png',
  'buying icon menu.png',
  'selling icon menu.png',
  'listing icon menu.png',
  'my offers icon menu.png',
  'orders icon menu.png',
  'saved icon menu.png',
  'reviews icon menu.png',
  'settings icon menu.png',
]

function readPng(filePath) {
  return PNG.sync.read(fs.readFileSync(filePath))
}

function writePng(filePath, png) {
  fs.writeFileSync(filePath, PNG.sync.write(png))
}

function makeNearWhiteTransparent(png, { threshold = 248, edgeThreshold = 235 } = {}) {
  for (let i = 0; i < png.data.length; i += 4) {
    const r = png.data[i]
    const g = png.data[i + 1]
    const b = png.data[i + 2]
    const a = png.data[i + 3]

    if (a === 0) continue

    const minChannel = Math.min(r, g, b)
    const maxChannel = Math.max(r, g, b)

    if (r >= threshold && g >= threshold && b >= threshold) {
      png.data[i + 3] = 0
      continue
    }

    if (maxChannel >= edgeThreshold && maxChannel - minChannel <= 18) {
      const fade = Math.min(1, (maxChannel - edgeThreshold) / (threshold - edgeThreshold))
      png.data[i + 3] = Math.round(a * fade)
    }
  }

  return png
}

for (const filename of ICON_FILES) {
  const filePath = path.join(ICON_DIR, filename)
  const png = readPng(filePath)
  makeNearWhiteTransparent(png)
  writePng(filePath, png)
  console.log(`Updated ${filename}`)
}

console.log('Hub menu icons now use transparent backgrounds.')
