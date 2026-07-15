/**
 * Normalize brand logo assets to transparent backgrounds.
 * Chroma-keys the corner backdrop, then darkens light grayscale wordmarks
 * so logos stay readable on white Equipment Values / brand cards.
 *
 * Usage: node scripts/normalize-brand-logo-backgrounds.mjs
 */
import { readdir, unlink } from 'node:fs/promises'
import { extname, join } from 'node:path'
import sharp from 'sharp'

const DIR = join(process.cwd(), 'public', 'brand-logos')
const INPUT_EXTS = new Set(['.png', '.jpg', '.jpeg', '.webp'])

function luminance(r, g, b) {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function chroma(r, g, b) {
  return Math.max(r, g, b) - Math.min(r, g, b)
}

function colorDistance(r, g, b, br, bg, bb) {
  const dr = r - br
  const dg = g - bg
  const db = b - bb
  return Math.sqrt(dr * dr + dg * dg + db * db)
}

function sampleBackground(data, width, height, channels) {
  const points = []
  const insetX = Math.max(1, Math.floor(width * 0.02))
  const insetY = Math.max(1, Math.floor(height * 0.02))
  for (const y of [insetY, height - 1 - insetY]) {
    for (let x = insetX; x < width - insetX; x += Math.max(1, Math.floor(width / 24))) {
      points.push([x, y])
    }
  }
  for (const x of [insetX, width - 1 - insetX]) {
    for (let y = insetY; y < height - insetY; y += Math.max(1, Math.floor(height / 24))) {
      points.push([x, y])
    }
  }

  let rSum = 0
  let gSum = 0
  let bSum = 0
  let count = 0
  let transparent = 0
  for (const [x, y] of points) {
    const i = (y * width + x) * channels
    const a = channels === 4 ? data[i + 3] : 255
    if (a < 160) {
      transparent += 1
      continue
    }
    rSum += data[i]
    gSum += data[i + 1]
    bSum += data[i + 2]
    count += 1
  }

  if (count < 8) {
    return {
      alreadyTransparent: true,
      r: 0,
      g: 0,
      b: 0,
      luma: 0,
      edgeTransparentRatio: transparent / (points.length || 1),
    }
  }

  return {
    alreadyTransparent: false,
    r: rSum / count,
    g: gSum / count,
    b: bSum / count,
    luma: luminance(rSum / count, gSum / count, bSum / count),
    edgeTransparentRatio: transparent / (points.length || 1),
  }
}

function processPixels(data, width, height, channels) {
  const out = Buffer.alloc(width * height * 4)
  const bg = sampleBackground(data, width, height, channels)
  const darkBg = !bg.alreadyTransparent && bg.luma < 110
  const keyThreshold = darkBg ? 56 : 44

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * channels
      const o = (y * width + x) * 4
      let r = data[i]
      let g = data[i + 1]
      let b = data[i + 2]
      let a = channels === 4 ? data[i + 3] : 255
      if (a === 0) {
        out[o] = out[o + 1] = out[o + 2] = out[o + 3] = 0
        continue
      }

      const luma = luminance(r, g, b)
      const sat = chroma(r, g, b)

      if (!bg.alreadyTransparent) {
        const dist = colorDistance(r, g, b, bg.r, bg.g, bg.b)
        if (dist <= keyThreshold) {
          a = 0
        } else if (dist <= keyThreshold * 1.55) {
          const t = (dist - keyThreshold) / (keyThreshold * 0.55)
          a = Math.round(Math.max(0, Math.min(1, t)) * a)
        }
      }

      if (a > 0 && darkBg && sat < 32 && luma >= 130) {
        const tone = Math.max(12, Math.min(40, Math.round(255 - luma)))
        r = g = b = tone
        a = 255
      } else if (a > 0 && darkBg && sat < 24 && luma >= 55 && luma < 130) {
        const tone = Math.max(12, Math.min(36, Math.round(luma * 0.28)))
        r = g = b = tone
        a = Math.max(a, 220)
      } else if (a > 0 && sat < 14 && luma >= 185) {
        // Ghost watermark / pale gradient leftovers.
        a = 0
      }

      if (a === 0) {
        out[o] = out[o + 1] = out[o + 2] = out[o + 3] = 0
      } else {
        out[o] = r
        out[o + 1] = g
        out[o + 2] = b
        out[o + 3] = a
      }
    }
  }

  return {
    out,
    darkBg,
    bgLuma: bg.luma,
    alreadyTransparent: bg.alreadyTransparent,
  }
}

function clearNearBlackEdgePixels(data, width, height, maxLuma = 48) {
  let cleared = 0
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const edge = x <= 1 || y <= 1 || x >= width - 2 || y >= height - 2
      if (!edge) continue
      const i = (y * width + x) * 4
      if (!data[i + 3]) continue
      const sat = chroma(data[i], data[i + 1], data[i + 2])
      const luma = luminance(data[i], data[i + 1], data[i + 2])
      if (sat < 20 && luma <= maxLuma) {
        data[i] = data[i + 1] = data[i + 2] = data[i + 3] = 0
        cleared += 1
      }
    }
  }
  return cleared
}

async function normalizeFile(filename) {
  const inputPath = join(DIR, filename)
  const base = filename.replace(/\.[^.]+$/, '')
  const outputPath = join(DIR, `${base}.png`)

  const { data, info } = await sharp(inputPath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })

  const { out, darkBg, bgLuma, alreadyTransparent } = processPixels(
    data,
    info.width,
    info.height,
    info.channels,
  )
  clearNearBlackEdgePixels(out, info.width, info.height)

  await sharp(out, {
    raw: {
      width: info.width,
      height: info.height,
      channels: 4,
    },
  })
    .png({ compressionLevel: 9 })
    .toFile(outputPath)

  if (outputPath !== inputPath) {
    try {
      await unlink(inputPath)
    } catch (error) {
      return {
        filename,
        output: `${base}.png`,
        mode: alreadyTransparent ? 'passthrough' : darkBg ? 'dark-knockout' : 'light-knockout',
        bgLuma: Math.round(bgLuma),
        leftoverOriginal: filename,
        unlinkError: error.code || error.message,
      }
    }
  }

  return {
    filename,
    output: `${base}.png`,
    mode: alreadyTransparent ? 'passthrough' : darkBg ? 'dark-knockout' : 'light-knockout',
    bgLuma: Math.round(bgLuma),
  }
}

// Prefer source raster formats over previously processed PNGs.
const allFiles = (await readdir(DIR)).filter((name) => INPUT_EXTS.has(extname(name).toLowerCase()))
const byBase = new Map()
for (const file of allFiles) {
  const base = file.replace(/\.[^.]+$/, '')
  const ext = extname(file).toLowerCase()
  const rank = ext === '.png' ? 2 : 1
  const existing = byBase.get(base)
  if (!existing || rank < existing.rank) {
    byBase.set(base, { file, rank })
  }
}

const files = [...byBase.values()]
  .map((entry) => entry.file)
  .sort((a, b) => a.localeCompare(b))

const results = []
for (const file of files) {
  results.push(await normalizeFile(file))
}

console.log('Normalized brand logos:')
for (const row of results) {
  const note = row.leftoverOriginal ? ` [left ${row.leftoverOriginal}: ${row.unlinkError}]` : ''
  console.log(`- ${row.filename} → ${row.output} (${row.mode}, bg luma ${row.bgLuma})${note}`)
}

for (const row of results.filter((entry) => entry.leftoverOriginal)) {
  try {
    await unlink(join(DIR, row.leftoverOriginal))
    console.log(`Removed leftover ${row.leftoverOriginal}`)
  } catch {
    console.warn(`Could not remove leftover ${row.leftoverOriginal}`)
  }
}
