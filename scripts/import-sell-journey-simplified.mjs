/**
 * Import simplified journey illustrations into public/images/sell.
 * Trims near-white margins, then centers each on a shared 3:2 canvas
 * so the UI mockups fill journey cards without uneven letterboxing.
 *
 * Optional: SELL_JOURNEY_STEP=4 to import a single step.
 */
import { copyFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import sharp from 'sharp'

const downloads = join(process.env.USERPROFILE || process.env.HOME, 'Downloads')
const outDir = join(process.cwd(), 'public', 'images', 'sell')
const backupDir = join(outDir, '_pre-simplified-backup')
mkdirSync(backupDir, { recursive: true })

const CANVAS_W = 1536
const CANVAS_H = 1024
const CONTENT_PAD = 40
const WHITE_THRESHOLD = 248

const steps = [
  { n: 1, src: join(downloads, 'Step 1 new.png') },
  { n: 2, src: join(downloads, 'Step 2 new.png') },
  { n: 3, src: join(downloads, 'Step 3 new.png') },
  {
    n: 4,
    src: join(process.cwd(), 'public', 'design-reference', 'Step 4 new new.png'),
  },
]

async function findContentBounds(sourcePath) {
  const { data, info } = await sharp(sourcePath).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const { width: w, height: h, channels: c } = info
  let minX = w
  let minY = h
  let maxX = 0
  let maxY = 0
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const i = (y * w + x) * c
      const r = data[i]
      const g = data[i + 1]
      const b = data[i + 2]
      const a = data[i + 3]
      if (a > 10 && (r < WHITE_THRESHOLD || g < WHITE_THRESHOLD || b < WHITE_THRESHOLD)) {
        if (x < minX) minX = x
        if (y < minY) minY = y
        if (x > maxX) maxX = x
        if (y > maxY) maxY = y
      }
    }
  }
  return {
    left: Math.max(0, minX - CONTENT_PAD),
    top: Math.max(0, minY - CONTENT_PAD),
    width: Math.min(w, maxX + CONTENT_PAD + 1) - Math.max(0, minX - CONTENT_PAD),
    height: Math.min(h, maxY + CONTENT_PAD + 1) - Math.max(0, minY - CONTENT_PAD),
  }
}

const onlyStep = Number(process.env.SELL_JOURNEY_STEP || 0)
const selected = onlyStep ? steps.filter((step) => step.n === onlyStep) : steps

for (const { n, src } of selected) {
  for (const suffix of ['.png', '.webp', '-800.png', '-800.webp']) {
    const existing = join(outDir, `step-${n}${suffix}`)
    try {
      copyFileSync(existing, join(backupDir, `step-${n}${suffix}`))
    } catch {
      // missing previous asset is fine
    }
  }

  const bounds = await findContentBounds(src)
  const trimmed = await sharp(src).rotate().extract(bounds).png().toBuffer()

  const fitted = await sharp(trimmed)
    .resize(CANVAS_W, CANVAS_H, {
      fit: 'contain',
      background: { r: 255, g: 255, b: 255, alpha: 1 },
      withoutEnlargement: false,
    })
    .png({ compressionLevel: 9 })
    .toBuffer()

  await sharp(fitted).toFile(join(outDir, `step-${n}.png`))
  await sharp(fitted)
    .webp({ quality: 92, alphaQuality: 100, effort: 6 })
    .toFile(join(outDir, `step-${n}.webp`))

  const mobile = await sharp(fitted)
    .resize(800, 533, { fit: 'fill' })
    .png({ compressionLevel: 9 })
    .toBuffer()
  await sharp(mobile).toFile(join(outDir, `step-${n}-800.png`))
  await sharp(mobile)
    .webp({ quality: 90, alphaQuality: 100, effort: 6 })
    .toFile(join(outDir, `step-${n}-800.webp`))

  const outMeta = await sharp(join(outDir, `step-${n}.png`)).metadata()
  console.log(
    `step-${n}: ${src}\n  trimmed ${bounds.width}x${bounds.height} → canvas ${outMeta.width}x${outMeta.height}`,
  )
}

console.log('done')
