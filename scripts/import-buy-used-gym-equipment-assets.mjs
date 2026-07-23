/**
 * Import approved buyer landing artwork into public/.
 * Journey steps: same 1536×1024 contain canvas as sell journey.
 * Hero: keep aspect, write PNG + WebP; regenerate OG preview.
 *
 *   node scripts/import-buy-used-gym-equipment-assets.mjs
 */
import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const downloads = join(process.env.USERPROFILE || process.env.HOME, 'Downloads')
const journeyDir = join(root, 'public', 'images', 'buy')
const heroDir = join(root, 'public', 'buy-used-gym-equipment')

mkdirSync(journeyDir, { recursive: true })
mkdirSync(heroDir, { recursive: true })

const CANVAS_W = 1536
const CANVAS_H = 1024
const CONTENT_PAD = 40
const WHITE_THRESHOLD = 248

const steps = [
  { n: 1, src: join(downloads, 'step 1 buyer.png') },
  { n: 2, src: join(downloads, 'Step 2 buyer.png') },
  { n: 3, src: join(downloads, 'step 3 buyer.png') },
  { n: 4, src: join(downloads, 'step 4 buyer.png') },
]

const heroSrc = join(downloads, 'Buy hero image.png')

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

async function writeJourneyStep(n, src) {
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

  await sharp(fitted).toFile(join(journeyDir, `step-${n}.png`))
  await sharp(fitted)
    .webp({ quality: 92, alphaQuality: 100, effort: 6 })
    .toFile(join(journeyDir, `step-${n}.webp`))

  const mobile = await sharp(fitted)
    .resize(800, 533, { fit: 'fill' })
    .png({ compressionLevel: 9 })
    .toBuffer()
  await sharp(mobile).toFile(join(journeyDir, `step-${n}-800.png`))
  await sharp(mobile)
    .webp({ quality: 90, alphaQuality: 100, effort: 6 })
    .toFile(join(journeyDir, `step-${n}-800.webp`))

  console.log(`step-${n}: trimmed ${bounds.width}x${bounds.height} → ${CANVAS_W}x${CANVAS_H}`)
}

async function writeHero() {
  const meta = await sharp(heroSrc).metadata()
  const outPng = join(heroDir, 'buy-used-gym-equipment-marketplace.png')
  const outWebp = join(heroDir, 'buy-used-gym-equipment-marketplace.webp')

  // Preserve supplied artwork; only normalise orientation / encode.
  await sharp(heroSrc).rotate().png({ compressionLevel: 9 }).toFile(outPng)
  await sharp(heroSrc)
    .rotate()
    .webp({ quality: 90, alphaQuality: 100, effort: 6 })
    .toFile(outWebp)

  const written = await sharp(outPng).metadata()
  console.log(`hero: ${meta.width}x${meta.height} → ${written.width}x${written.height}`)
  return { width: written.width, height: written.height, outPng }
}

async function writeOg(heroPngPath) {
  const width = 1200
  const height = 630
  const outputPath = join(heroDir, 'buy-used-gym-equipment-og.png')
  const logoPath = join(root, 'public', 'email', 'equipd-full-logo.png')

  const background = Buffer.from(`
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#ffffff"/>
      <stop offset="1" stop-color="#fff8f1"/>
    </linearGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="160%">
      <feDropShadow dx="0" dy="16" stdDeviation="18" flood-color="#1c2638" flood-opacity=".14"/>
    </filter>
  </defs>
  <rect width="${width}" height="${height}" fill="url(#bg)"/>
  <circle cx="1120" cy="72" r="180" fill="#ff7a1a" opacity=".09"/>
  <circle cx="1030" cy="590" r="250" fill="#ff7a1a" opacity=".06"/>
  <rect x="610" y="120" width="530" height="400" rx="26" fill="#ffffff" filter="url(#shadow)"/>
  <rect x="610" y="120" width="530" height="400" rx="26" fill="none" stroke="#f0e2d5" stroke-width="2"/>
  <rect x="68" y="514" width="244" height="7" rx="3.5" fill="#f47721"/>
</svg>`)

  const text = Buffer.from(`
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  <style>
    .headline { font: 800 56px Inter, Arial, sans-serif; fill: #172033; letter-spacing: -1.8px; }
    .support { font: 500 26px Inter, Arial, sans-serif; fill: #4b5565; }
    .label { font: 700 19px Inter, Arial, sans-serif; fill: #d85609; letter-spacing: .3px; }
  </style>
  <text x="68" y="214" class="label">THE UK FITNESS EQUIPMENT MARKETPLACE</text>
  <text x="68" y="294" class="headline">Buy Used Gym</text>
  <text x="68" y="362" class="headline">Equipment</text>
  <text x="68" y="426" class="support">Browse listings and pay securely</text>
  <text x="68" y="464" class="support">with Buyer Protection</text>
</svg>`)

  const logo = await sharp(logoPath)
    .resize({ width: 250, height: 70, fit: 'inside', withoutEnlargement: true })
    .png()
    .toBuffer()

  const collage = await sharp(heroPngPath)
    .resize({ width: 494, height: 340, fit: 'contain', background: { r: 255, g: 248, b: 243, alpha: 1 } })
    .png()
    .toBuffer()

  await sharp(background)
    .composite([
      { input: logo, left: 68, top: 54 },
      { input: collage, left: 628, top: 150 },
      { input: text, left: 0, top: 0 },
    ])
    .png()
    .toFile(outputPath)

  console.log(`og: ${outputPath}`)
}

for (const step of steps) {
  await writeJourneyStep(step.n, step.src)
}
const hero = await writeHero()
await writeOg(hero.outPng)
console.log(JSON.stringify({ heroWidth: hero.width, heroHeight: hero.height }))
