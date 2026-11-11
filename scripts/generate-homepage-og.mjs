/**
 * Generate the static 1200×630 homepage social preview.
 * Buyer-first marketplace card using Equipd navy / orange / white.
 */
import { mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outputPath = join(root, 'public', 'homepage', 'equipd-homepage-og.png')
const logoPath = join(root, 'public', 'email', 'equipd-full-logo.png')
const marketplacePath = join(
  root,
  'public',
  'buy-used-gym-equipment',
  'buy-used-gym-equipment-marketplace.png',
)

const width = 1200
const height = 630

const background = Buffer.from(`
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#172033"/>
      <stop offset="1" stop-color="#24324a"/>
    </linearGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="160%">
      <feDropShadow dx="0" dy="16" stdDeviation="18" flood-color="#0b1220" flood-opacity=".35"/>
    </filter>
  </defs>
  <rect width="${width}" height="${height}" fill="url(#bg)"/>
  <circle cx="1080" cy="80" r="190" fill="#f47721" opacity=".18"/>
  <circle cx="980" cy="600" r="240" fill="#f47721" opacity=".10"/>
  <rect x="602" y="138" width="530" height="370" rx="26" fill="#ffffff" filter="url(#shadow)"/>
  <rect x="68" y="514" width="244" height="7" rx="3.5" fill="#f47721"/>
</svg>`)

const text = Buffer.from(`
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  <style>
    .headline { font: 800 52px Inter, Arial, sans-serif; fill: #ffffff; letter-spacing: -1.6px; }
    .support { font: 500 26px Inter, Arial, sans-serif; fill: #d7deea; }
    .label { font: 700 18px Inter, Arial, sans-serif; fill: #f47721; letter-spacing: .35px; }
  </style>
  <text x="68" y="214" class="label">THE UK FITNESS EQUIPMENT MARKETPLACE</text>
  <text x="68" y="292" class="headline">Buy &amp; Sell Used</text>
  <text x="68" y="356" class="headline">Gym Equipment</text>
  <text x="68" y="426" class="support">Home &amp; Commercial Equipment</text>
  <text x="68" y="464" class="support">Across the UK</text>
</svg>`)

async function main() {
  await mkdir(dirname(outputPath), { recursive: true })

  const logo = await sharp(logoPath)
    .resize({ width: 250, height: 70, fit: 'inside', withoutEnlargement: true })
    .png()
    .toBuffer()

  const marketplace = await sharp(marketplacePath)
    .resize({ width: 494, height: 278, fit: 'cover', position: 'top' })
    .png()
    .toBuffer()

  await sharp(background)
    .composite([
      { input: logo, left: 68, top: 54 },
      { input: marketplace, left: 620, top: 162 },
      {
        input: Buffer.from(`
          <svg width="494" height="54" xmlns="http://www.w3.org/2000/svg">
            <rect width="494" height="54" fill="#f47721"/>
            <text x="247" y="35" text-anchor="middle"
              font-family="Inter, Arial, sans-serif" font-size="20" font-weight="700" fill="#ffffff">
              Browse used gym equipment
            </text>
          </svg>`),
        left: 620,
        top: 440,
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
