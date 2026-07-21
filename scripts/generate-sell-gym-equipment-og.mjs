/**
 * Generate the static 1200×630 search/social preview for /sell-gym-equipment.
 * Uses existing Equipd brand and seller-journey assets; no runtime dependency.
 */
import { mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outputPath = join(root, 'public', 'sell-gym-equipment', 'sell-gym-equipment-og.png')
const logoPath = join(root, 'public', 'email', 'equipd-full-logo.png')
const listingScreenPath = join(root, 'public', 'images', 'sell', 'step-1.png')

const width = 1200
const height = 630

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
  <rect x="610" y="151" width="530" height="370" rx="26" fill="#ffffff" filter="url(#shadow)"/>
  <rect x="610" y="151" width="530" height="370" rx="26" fill="none" stroke="#f0e2d5" stroke-width="2"/>
  <rect x="68" y="514" width="244" height="7" rx="3.5" fill="#f47721"/>
</svg>`)

const text = Buffer.from(`
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  <style>
    .headline { font: 800 60px Inter, Arial, sans-serif; fill: #172033; letter-spacing: -1.8px; }
    .support { font: 500 27px Inter, Arial, sans-serif; fill: #4b5565; }
    .label { font: 700 19px Inter, Arial, sans-serif; fill: #d85609; letter-spacing: .3px; }
  </style>
  <text x="68" y="214" class="label">THE UK FITNESS EQUIPMENT MARKETPLACE</text>
  <text x="68" y="294" class="headline">Sell Your Gym</text>
  <text x="68" y="362" class="headline">Equipment</text>
  <text x="68" y="426" class="support">List in minutes and reach buyers</text>
  <text x="68" y="464" class="support">across the UK</text>
</svg>`)

async function main() {
  await mkdir(dirname(outputPath), { recursive: true })

  const logo = await sharp(logoPath)
    .resize({ width: 250, height: 70, fit: 'inside', withoutEnlargement: true })
    .png()
    .toBuffer()

  const listingScreen = await sharp(listingScreenPath)
    .resize({ width: 494, height: 278, fit: 'cover', position: 'top' })
    .png()
    .toBuffer()

  await sharp(background)
    .composite([
      { input: logo, left: 68, top: 54 },
      { input: listingScreen, left: 628, top: 174 },
      {
        input: Buffer.from(`
          <svg width="494" height="54" xmlns="http://www.w3.org/2000/svg">
            <rect width="494" height="54" fill="#172033"/>
            <text x="247" y="35" text-anchor="middle"
              font-family="Inter, Arial, sans-serif" font-size="20" font-weight="700" fill="#ffffff">
              Create a listing directly
            </text>
          </svg>`),
        left: 628,
        top: 447,
      },
      { input: text, left: 0, top: 0 },
    ])
    .png({ compressionLevel: 9, palette: false })
    .toFile(outputPath)

  const metadata = await sharp(outputPath).metadata()
  if (metadata.width !== width || metadata.height !== height) {
    throw new Error(`Expected ${width}x${height}, got ${metadata.width}x${metadata.height}`)
  }
  console.log(`Generated ${outputPath} (${metadata.width}x${metadata.height})`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
