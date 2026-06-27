#!/usr/bin/env node
/**
 * Generate favicon assets from the mobile header logo PNG (orange squircle + white E).
 *
 * Uses the design-reference source directly — does not redraw the logo.
 *
 * Usage: node scripts/generate-favicons.mjs
 */

import fs from 'node:fs'
import path from 'node:path'
import { PNG } from 'pngjs'

const ROOT = path.resolve('.')
const SOURCE = path.join(
  ROOT,
  'public/design-reference/Equipd logo mobile header grey.png',
)
const OUT_DIR = path.join(ROOT, 'public')

function findOpaqueBounds(png, alphaThreshold = 8) {
  let minX = png.width
  let minY = png.height
  let maxX = 0
  let maxY = 0
  let found = false

  for (let y = 0; y < png.height; y += 1) {
    for (let x = 0; x < png.width; x += 1) {
      const alpha = png.data[(png.width * y + x) * 4 + 3]
      if (alpha <= alphaThreshold) continue

      found = true
      if (x < minX) minX = x
      if (y < minY) minY = y
      if (x > maxX) maxX = x
      if (y > maxY) maxY = y
    }
  }

  if (!found) {
    throw new Error('No opaque logo pixels found in source image.')
  }

  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
  }
}

/** Centre the logo in a square crop so the squircle is not stretched. */
function toSquareCrop(bounds) {
  const size = Math.max(bounds.width, bounds.height)
  const centerX = (bounds.minX + bounds.maxX) / 2
  const centerY = (bounds.minY + bounds.maxY) / 2

  return {
    minX: Math.round(centerX - (size - 1) / 2),
    minY: Math.round(centerY - (size - 1) / 2),
    width: size,
    height: size,
  }
}

function cropPng(png, crop) {
  const out = new PNG({ width: crop.width, height: crop.height })

  for (let y = 0; y < crop.height; y += 1) {
    for (let x = 0; x < crop.width; x += 1) {
      const srcX = crop.minX + x
      const srcY = crop.minY + y
      const srcIdx = (png.width * srcY + srcX) << 2
      const dstIdx = (crop.width * y + x) << 2

      if (srcX < 0 || srcY < 0 || srcX >= png.width || srcY >= png.height) {
        out.data[dstIdx + 3] = 0
        continue
      }

      out.data[dstIdx] = png.data[srcIdx]
      out.data[dstIdx + 1] = png.data[srcIdx + 1]
      out.data[dstIdx + 2] = png.data[srcIdx + 2]
      out.data[dstIdx + 3] = png.data[srcIdx + 3]
    }
  }

  return out
}

function samplePixel(png, x, y) {
  const clampedX = Math.max(0, Math.min(png.width - 1, x))
  const clampedY = Math.max(0, Math.min(png.height - 1, y))
  const idx = (png.width * clampedY + clampedX) << 2

  return [
    png.data[idx],
    png.data[idx + 1],
    png.data[idx + 2],
    png.data[idx + 3],
  ]
}

function sampleBilinear(png, x, y) {
  const x0 = Math.floor(x)
  const y0 = Math.floor(y)
  const x1 = Math.min(x0 + 1, png.width - 1)
  const y1 = Math.min(y0 + 1, png.height - 1)
  const tx = x - x0
  const ty = y - y0

  const c00 = samplePixel(png, x0, y0)
  const c10 = samplePixel(png, x1, y0)
  const c01 = samplePixel(png, x0, y1)
  const c11 = samplePixel(png, x1, y1)

  const out = [0, 0, 0, 0]

  for (let channel = 0; channel < 4; channel += 1) {
    const top = c00[channel] * (1 - tx) + c10[channel] * tx
    const bottom = c01[channel] * (1 - tx) + c11[channel] * tx
    out[channel] = Math.round(top * (1 - ty) + bottom * ty)
  }

  return out
}

function resizePng(source, size) {
  const target = new PNG({ width: size, height: size })

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const srcX = ((x + 0.5) / size) * source.width - 0.5
      const srcY = ((y + 0.5) / size) * source.height - 0.5
      const [r, g, b, a] = sampleBilinear(source, srcX, srcY)
      const dstIdx = (size * y + x) << 2

      target.data[dstIdx] = r
      target.data[dstIdx + 1] = g
      target.data[dstIdx + 2] = b
      target.data[dstIdx + 3] = a
    }
  }

  return target
}

function countBrightLetterPixels(png) {
  let count = 0

  for (let i = 0; i < png.data.length; i += 4) {
    const r = png.data[i]
    const g = png.data[i + 1]
    const b = png.data[i + 2]
    const a = png.data[i + 3]

    if (a > 128 && r > 210 && g > 210 && b > 210) {
      count += 1
    }
  }

  return count
}

function createIcoFromPngs(entries) {
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(entries.length, 4)

  let offset = 6 + entries.length * 16
  const dirEntries = []
  const imageBuffers = []

  for (const { size, pngBuffer } of entries) {
    const entry = Buffer.alloc(16)
    entry.writeUInt8(size >= 256 ? 0 : size, 0)
    entry.writeUInt8(size >= 256 ? 0 : size, 1)
    entry.writeUInt8(0, 2)
    entry.writeUInt8(0, 3)
    entry.writeUInt16LE(1, 4)
    entry.writeUInt16LE(32, 6)
    entry.writeUInt32LE(pngBuffer.length, 8)
    entry.writeUInt32LE(offset, 12)

    dirEntries.push(entry)
    imageBuffers.push(pngBuffer)
    offset += pngBuffer.length
  }

  return Buffer.concat([header, ...dirEntries, ...imageBuffers])
}

if (!fs.existsSync(SOURCE)) {
  throw new Error(`Source logo not found: ${SOURCE}`)
}

const source = PNG.sync.read(fs.readFileSync(SOURCE))
const bounds = findOpaqueBounds(source)
const crop = toSquareCrop(bounds)
const cropped = cropPng(source, crop)

console.log(`Source: ${SOURCE}`)
console.log(`Logo bounds: ${bounds.width}x${bounds.height} → square crop ${crop.width}x${crop.height}`)

const pngOutputs = [
  ['favicon-16x16.png', 16],
  ['favicon-32x32.png', 32],
  ['apple-touch-icon.png', 180],
]

const icoEntries = []

for (const [filename, size] of pngOutputs) {
  const resized = resizePng(cropped, size)
  const pngBuffer = PNG.sync.write(resized)
  const outPath = path.join(OUT_DIR, filename)

  fs.writeFileSync(outPath, pngBuffer)
  console.log(`Wrote ${filename} (${size}x${size})`)

  if (size === 16 || size === 32) {
    icoEntries.push({ size, pngBuffer })
  }

  if (size === 16) {
    const whitePixels = countBrightLetterPixels(resized)
    if (whitePixels < 8) {
      throw new Error(
        `16x16 favicon has only ${whitePixels} bright letter pixels — white "E" may not be visible.`,
      )
    }
    console.log(`Verified ${filename}: ${whitePixels} white "E" pixels at 16x16`)
  }
}

icoEntries.sort((a, b) => b.size - a.size)
const icoPath = path.join(OUT_DIR, 'favicon.ico')
fs.writeFileSync(icoPath, createIcoFromPngs(icoEntries))
console.log(`Wrote favicon.ico (${icoEntries.map((entry) => entry.size).join(' + ')} px PNG)`)

console.log('Favicon generation complete.')
