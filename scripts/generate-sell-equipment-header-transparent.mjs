/**
 * Generate a transparent presentation asset from Sell equipment header.png.
 * Removes only the outer pale/warm canvas via edge-connected flood fill,
 * protecting Equipd UI whites, shadows and orange annotations.
 */
import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const sourcePath = join(root, 'reports', 'sell-gym-equipment-page', 'Sell equipment header.png')
const outDir = join(root, 'public', 'sell-gym-equipment')
const outPng = join(outDir, 'sell-gym-equipment-marketplace.png')
const outWebp = join(outDir, 'sell-gym-equipment-marketplace.webp')
// Keep legacy aliases in sync for any older references during transition
const outPngLegacy = join(outDir, 'sell-equipment-header-transparent.png')
const outWebpLegacy = join(outDir, 'sell-equipment-header-transparent.webp')

const FEATHER_PX = 2.25
const PROTECT_DILATE = 1
const BG_DILATE = 2

function isUiWhite(r, g, b) {
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  // Neutral near-white only (Equipd panels). Warm canvas fails the delta check.
  return min >= 250 && max - min <= 3 && r - b <= 2 && g - b <= 2
}

function isOrangeInk(r, g, b) {
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const sat = max === 0 ? 0 : (max - min) / max
  return r > 165 && g < 155 && b < 120 && sat > 0.18 && r > g + 20
}

function isBackgroundCandidate(r, g, b, a, loose = false) {
  if (a < 8) return true
  if (isUiWhite(r, g, b)) return false
  if (isOrangeInk(r, g, b)) return false

  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const lum = (r + g + b) / 3
  const sat = max === 0 ? 0 : (max - min) / max
  const warmDelta = r - b
  const warm = warmDelta >= 3 || (g - b >= 2 && warmDelta >= 2)

  // Dark / mid tones: UI chrome, photo content, card shadows
  if (lum < (loose ? 218 : 222)) return false
  // Saturated non-orange accents (greens, etc.)
  if (sat > 0.22 && !(r > g && g >= b)) return false

  // Soft peach glow / warm cream canvas
  if (warm && sat <= 0.22 && lum >= (loose ? 224 : 228)) return true
  if (warm && sat <= 0.14 && lum >= 236) return true
  // Near-white with slight warmth (common canvas)
  if (lum >= 246 && warmDelta >= 2 && sat <= 0.08) return true

  return false
}

function dilateMask(mask, width, height, radius) {
  if (radius <= 0) return mask
  const out = new Uint8Array(mask)
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (!mask[y * width + x]) continue
      for (let dy = -radius; dy <= radius; dy += 1) {
        for (let dx = -radius; dx <= radius; dx += 1) {
          if (dx * dx + dy * dy > radius * radius + 0.5) continue
          const nx = x + dx
          const ny = y + dy
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue
          out[ny * width + nx] = 1
        }
      }
    }
  }
  return out
}

function buildProtectedMask(width, height, rgba) {
  const protect = new Uint8Array(width * height)
  for (let i = 0; i < width * height; i += 1) {
    const o = i * 4
    const r = rgba[o]
    const g = rgba[o + 1]
    const b = rgba[o + 2]
    const lum = (r + g + b) / 3
    // Protect UI surfaces, ink and true dark content — not soft peach glow
    if (isUiWhite(r, g, b) || isOrangeInk(r, g, b) || lum < 185) {
      protect[i] = 1
    }
  }
  return dilateMask(protect, width, height, PROTECT_DILATE)
}

function buildHardContentMask(width, height, rgba) {
  const hard = new Uint8Array(width * height)
  for (let i = 0; i < width * height; i += 1) {
    const o = i * 4
    const r = rgba[o]
    const g = rgba[o + 1]
    const b = rgba[o + 2]
    const lum = (r + g + b) / 3
    if (isUiWhite(r, g, b) || isOrangeInk(r, g, b) || lum < 185) {
      hard[i] = 1
    }
  }
  return hard
}

/** Approx distance (capped) to nearest hard content pixel. */
function distanceToHard(hard, width, height, maxDist) {
  const dist = new Float32Array(width * height)
  dist.fill(maxDist + 1)
  const queue = new Int32Array(width * height)
  let qh = 0
  let qt = 0
  for (let i = 0; i < hard.length; i += 1) {
    if (!hard[i]) continue
    dist[i] = 0
    queue[qt++] = i
  }
  while (qh < qt) {
    const i = queue[qh++]
    const d = dist[i]
    if (d >= maxDist) continue
    const x = i % width
    const y = (i - x) / width
    const neighbors = [
      x > 0 ? i - 1 : -1,
      x + 1 < width ? i + 1 : -1,
      y > 0 ? i - width : -1,
      y + 1 < height ? i + width : -1,
    ]
    for (const n of neighbors) {
      if (n < 0) continue
      const nd = d + 1
      if (nd < dist[n]) {
        dist[n] = nd
        queue[qt++] = n
      }
    }
  }
  return dist
}

function floodBackgroundMask(width, height, rgba, protect) {
  const total = width * height
  const bg = new Uint8Array(total)
  const visited = new Uint8Array(total)
  const queue = new Int32Array(total)
  let qh = 0
  let qt = 0

  const enqueue = (i, loose) => {
    if (visited[i] || protect[i]) return
    const o = i * 4
    if (!isBackgroundCandidate(rgba[o], rgba[o + 1], rgba[o + 2], rgba[o + 3], loose)) return
    visited[i] = 1
    bg[i] = 1
    queue[qt++] = i
  }

  for (let x = 0; x < width; x += 1) {
    enqueue(x, false)
    enqueue((height - 1) * width + x, false)
  }
  for (let y = 0; y < height; y += 1) {
    enqueue(y * width, false)
    enqueue(y * width + (width - 1), false)
  }

  while (qh < qt) {
    const i = queue[qh++]
    const x = i % width
    const y = (i - x) / width
    const neighbors = [
      x > 0 ? i - 1 : -1,
      x + 1 < width ? i + 1 : -1,
      y > 0 ? i - width : -1,
      y + 1 < height ? i + width : -1,
    ]
    for (const n of neighbors) {
      if (n < 0) continue
      enqueue(n, false)
    }
  }

  // Grow into soft glow adjacent to removed canvas
  qh = 0
  qt = 0
  for (let i = 0; i < total; i += 1) {
    if (bg[i]) queue[qt++] = i
  }
  while (qh < qt) {
    const i = queue[qh++]
    const x = i % width
    const y = (i - x) / width
    const neighbors = [
      x > 0 ? i - 1 : -1,
      x + 1 < width ? i + 1 : -1,
      y > 0 ? i - width : -1,
      y + 1 < height ? i + width : -1,
    ]
    for (const n of neighbors) {
      if (n < 0 || visited[n] || protect[n]) continue
      const o = n * 4
      if (!isBackgroundCandidate(rgba[o], rgba[o + 1], rgba[o + 2], rgba[o + 3], true)) continue
      visited[n] = 1
      bg[n] = 1
      queue[qt++] = n
    }
  }

  // Remove warm canvas islands far from real artwork (bypasses soft-shadow barriers)
  const hard = buildHardContentMask(width, height, rgba)
  const dist = distanceToHard(hard, width, height, 28)
  for (let i = 0; i < total; i += 1) {
    if (protect[i] || bg[i]) continue
    const o = i * 4
    const r = rgba[o]
    const g = rgba[o + 1]
    const b = rgba[o + 2]
    const a = rgba[o + 3]
    if (!isBackgroundCandidate(r, g, b, a, true)) continue
    const lum = (r + g + b) / 3
    const warmDelta = r - b
    // Strong canvas / soft peach field — keep only a tight halo beside hard content
    const strongCanvas = lum >= 238 && warmDelta >= 4
    const threshold = strongCanvas ? 3 : 7
    if (dist[i] > threshold) bg[i] = 1
  }

  // Outer margin: force-remove remaining warm canvas (never contains UI panels)
  const margin = 18
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (x >= margin && y >= margin && x < width - margin && y < height - margin) continue
      const i = y * width + x
      if (protect[i]) continue
      const o = i * 4
      if (isBackgroundCandidate(rgba[o], rgba[o + 1], rgba[o + 2], rgba[o + 3], true)) {
        bg[i] = 1
      }
    }
  }

  const dilated = dilateMask(bg, width, height, BG_DILATE)
  for (let i = 0; i < total; i += 1) {
    if (protect[i]) dilated[i] = 0
  }
  return dilated
}

async function featherAlpha(width, height, bgMask, featherPx) {
  const keep = Buffer.alloc(width * height)
  for (let i = 0; i < keep.length; i += 1) keep[i] = bgMask[i] ? 0 : 255

  const { data, info } = await sharp(keep, { raw: { width, height, channels: 1 } })
    .blur(featherPx)
    .toColourspace('b-w')
    .raw()
    .toBuffer({ resolveWithObject: true })

  if (info.channels !== 1 || data.length !== width * height) {
    throw new Error(`featherAlpha expected ${width * height} mono bytes, got ${data.length} (${info.channels}ch)`)
  }
  return data
}

async function main() {
  mkdirSync(outDir, { recursive: true })

  const { data, info } = await sharp(sourcePath).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const { width, height } = info
  const rgba = Buffer.from(data)

  const protect = buildProtectedMask(width, height, rgba)
  const bgMask = floodBackgroundMask(width, height, rgba, protect)
  const removed = bgMask.reduce((n, v) => n + v, 0)
  const alpha = await featherAlpha(width, height, bgMask, FEATHER_PX)

  for (let i = 0; i < width * height; i += 1) {
    const o = i * 4
    let a = alpha[i]
    if (protect[i] && !bgMask[i]) a = 255
    if (bgMask[i] && !protect[i]) {
      // Soft edge from feather; crush near-opaque warm leftovers to clear
      if (a < 40) a = 0
      else if (a > 250) a = 0
    }
    rgba[o + 3] = a
  }

  const transparent = sharp(rgba, { raw: { width, height, channels: 4 } })

  await transparent.clone().png({ compressionLevel: 9 }).toFile(outPng)
  await transparent.clone().webp({ quality: 90, alphaQuality: 100, effort: 6 }).toFile(outWebp)
  await transparent.clone().png({ compressionLevel: 9 }).toFile(outPngLegacy)
  await transparent.clone().webp({ quality: 90, alphaQuality: 100, effort: 6 }).toFile(outWebpLegacy)

  const pngStat = await import('node:fs').then((fs) => fs.promises.stat(outPng))
  const webpStat = await import('node:fs').then((fs) => fs.promises.stat(outWebp))

  const { data: outData } = await sharp(outPng).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const sample = (x, y) => {
    const i = (y * width + x) * 4
    return [outData[i], outData[i + 1], outData[i + 2], outData[i + 3]]
  }

  console.log(
    JSON.stringify(
      {
        size: `${width}x${height}`,
        removedPixels: removed,
        removedPct: Math.round((removed / (width * height)) * 1000) / 10,
        pngKB: Math.round(pngStat.size / 1024),
        webpKB: Math.round(webpStat.size / 1024),
        cornerTL: sample(2, 2)[3],
        cornerBL: sample(2, height - 3)[3],
        cornerBR: sample(width - 3, height - 3)[3],
        uiSampleAlpha: sample(620, 300)[3],
        bottomGlow: sample(500, 700)[3],
      },
      null,
      2,
    ),
  )
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
