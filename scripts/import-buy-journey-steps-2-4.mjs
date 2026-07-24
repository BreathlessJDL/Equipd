/**
 * Replace Buy page journey steps 2–4 from Downloads (no trim/redraw of masters).
 *
 * Sources:
 *   Step 2 → Downloads/Step 2 updates.png
 *   Step 3 → Downloads/Step 3 updated.png
 *   Step 4 → Downloads/step 4 updated.png
 *
 * Writes buyer-specific names under public/images/buy/:
 *   buy-journey-step-{n}.png|.webp
 *   buy-journey-step-{n}-800.png|.webp  (high-quality downscale for mobile only)
 *
 * Step 1 is not touched. Seller assets are not touched.
 *
 *   node scripts/import-buy-journey-steps-2-4.mjs
 */
import { copyFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const downloads = join(process.env.USERPROFILE || process.env.HOME, 'Downloads')
const outDir = join(root, 'public', 'images', 'buy')

mkdirSync(outDir, { recursive: true })

const steps = [
  { n: 2, src: join(downloads, 'Step 2 updates.png') },
  { n: 3, src: join(downloads, 'Step 3 updated.png') },
  { n: 4, src: join(downloads, 'step 4 updated.png') },
]

for (const { n, src } of steps) {
  const meta = await sharp(src).metadata()
  if (!meta.width || !meta.height) {
    throw new Error(`Missing dimensions for ${src}`)
  }

  const base = `buy-journey-step-${n}`
  const pngOut = join(outDir, `${base}.png`)
  const webpOut = join(outDir, `${base}.webp`)
  const png800 = join(outDir, `${base}-800.png`)
  const webp800 = join(outDir, `${base}-800.webp`)

  // Master PNG: byte-for-byte copy of the supplied file (no redraw / crop / canvas).
  copyFileSync(src, pngOut)

  // Desktop WebP: same pixel dimensions, high quality (UI text stays sharp).
  await sharp(src)
    .rotate()
    .webp({ quality: 95, alphaQuality: 100, effort: 6, smartSubsample: true })
    .toFile(webpOut)

  // Mobile: preserve aspect ratio; avoid soft aggressive compression.
  const mobileW = Math.min(800, meta.width)
  const mobile = sharp(src).rotate().resize({
    width: mobileW,
    fit: 'inside',
    withoutEnlargement: true,
  })

  await mobile
    .clone()
    .png({ compressionLevel: 6, palette: false })
    .toFile(png800)

  await mobile
    .clone()
    .webp({ quality: 94, alphaQuality: 100, effort: 6, smartSubsample: true })
    .toFile(webp800)

  const outMeta = await sharp(pngOut).metadata()
  const m800 = await sharp(png800).metadata()
  console.log(
    JSON.stringify({
      step: n,
      source: src,
      master: `${outMeta.width}x${outMeta.height}`,
      mobile: `${m800.width}x${m800.height}`,
      files: [pngOut, webpOut, png800, webp800].map((p) => p.replace(root + '\\', '').replace(root + '/', '')),
    }),
  )
}

console.log('Imported buy journey steps 2–4 (step 1 untouched).')
