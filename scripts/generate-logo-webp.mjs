/**
 * Generate WebP versions of Equipd logo assets used in the header/footer.
 * Run: node scripts/generate-logo-webp.mjs
 */
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import sharp from 'sharp'

const assets = [
  {
    png: 'public/design-reference/Full logo 1.png',
    webp: 'public/brand-logos/equipd-full-logo.webp',
    width: 400,
  },
  {
    png: 'public/design-reference/Equipd logo mobile header grey.png',
    webp: 'public/brand-logos/equipd-logo-mobile-header-grey.webp',
    width: 200,
  },
]

for (const asset of assets) {
  const input = join(process.cwd(), asset.png)
  const output = join(process.cwd(), asset.webp)
  const meta = await sharp(input).metadata()
  let pipeline = sharp(input)
  if (asset.width) pipeline = pipeline.resize({ width: asset.width, withoutEnlargement: true })
  const out = await pipeline.webp({ quality: 90, alphaQuality: 100 }).toBuffer()
  writeFileSync(output, out)
  const outMeta = await sharp(out).metadata()
  console.log(
    `${asset.webp}: ${meta.width}x${meta.height} -> ${outMeta.width}x${outMeta.height} (${out.length} bytes)`,
  )
}
