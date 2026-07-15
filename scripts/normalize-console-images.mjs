#!/usr/bin/env node
/**
 * Normalize console images by trimming padding and centring on a fixed canvas.
 *
 * Usage:
 *   node scripts/normalize-console-images.mjs
 *   node scripts/normalize-console-images.mjs --brand life-fitness
 *   node scripts/normalize-console-images.mjs --brand technogym
 *   node scripts/normalize-console-images.mjs --brand matrix-fitness
 *   node scripts/normalize-console-images.mjs --dir public/equipment-console-images/life-fitness
 */

import { mkdir, readdir, stat } from 'node:fs/promises'
import { join, extname, basename } from 'node:path'
import sharp from 'sharp'

const CONSOLE_IMAGE_BRAND_DIRS = {
  'life-fitness': 'public/equipment-console-images/life-fitness',
  technogym: 'public/equipment-console-images/technogym',
  'matrix-fitness': 'public/equipment-console-images/matrix-fitness',
}

const DEFAULT_BRAND = 'life-fitness'
const NORMALIZED_DIR_NAME = 'normalized'
const CANVAS_WIDTH = 400
const CANVAS_HEIGHT = 260
const MAX_CONTENT_WIDTH = 360
const MAX_CONTENT_HEIGHT = 220
const TRIM_THRESHOLD = 12

const SUPPORTED_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp'])

function parseArgs(argv) {
  const args = { dir: null, brands: null }
  for (let index = 2; index < argv.length; index += 1) {
    const token = argv[index]
    if (token === '--dir') {
      args.dir = argv[index + 1] ?? null
      index += 1
    } else if (token === '--brand') {
      const brand = argv[index + 1] ?? DEFAULT_BRAND
      args.brands = brand === 'all'
        ? Object.keys(CONSOLE_IMAGE_BRAND_DIRS)
        : [brand]
      index += 1
    }
  }
  return args
}

function resolveSourceDirs(args) {
  if (args.dir) return [args.dir]

  const brands = args.brands ?? [DEFAULT_BRAND]
  const dirs = brands.map((brand) => {
    const dir = CONSOLE_IMAGE_BRAND_DIRS[brand]
    if (!dir) {
      throw new Error(`Unknown brand "${brand}". Expected one of: ${Object.keys(CONSOLE_IMAGE_BRAND_DIRS).join(', ')}, all`)
    }
    return dir
  })

  return [...new Set(dirs)]
}

function isImageFile(name) {
  return SUPPORTED_EXTENSIONS.has(extname(name).toLowerCase())
}

async function listSourceImages(sourceDir) {
  const entries = await readdir(sourceDir)
  const files = []

  for (const entry of entries) {
    if (entry === NORMALIZED_DIR_NAME) continue
    if (!isImageFile(entry)) continue
    files.push(join(sourceDir, entry))
  }

  return files.sort()
}

function outputPathFor(sourcePath, outputDir) {
  return join(outputDir, basename(sourcePath))
}

async function normalizeConsoleImage(sourcePath, outputPath) {
  const extension = extname(sourcePath).toLowerCase()
  const input = sharp(sourcePath, { failOn: 'none' })
  const metadata = await input.metadata()
  const hasAlpha = Boolean(metadata.hasAlpha)

  const trimmed = await sharp(sourcePath, { failOn: 'none' })
    .trim({ threshold: TRIM_THRESHOLD })
    .toBuffer({ resolveWithObject: true })

  const resized = await sharp(trimmed.data, { failOn: 'none' })
    .resize(MAX_CONTENT_WIDTH, MAX_CONTENT_HEIGHT, {
      fit: 'inside',
      withoutEnlargement: false,
    })
    .toBuffer({ resolveWithObject: true })

  const background = hasAlpha
    ? { r: 255, g: 255, b: 255, alpha: 0 }
    : { r: 255, g: 255, b: 255, alpha: 1 }

  let pipeline = sharp({
    create: {
      width: CANVAS_WIDTH,
      height: CANVAS_HEIGHT,
      channels: 4,
      background,
    },
  }).composite([{
    input: resized.data,
    gravity: 'center',
  }])

  if (extension === '.jpg' || extension === '.jpeg') {
    pipeline = pipeline.flatten({ background: '#ffffff' }).jpeg({ quality: 92, mozjpeg: true })
  } else if (extension === '.webp') {
    pipeline = hasAlpha
      ? pipeline.webp({ quality: 92, alphaQuality: 100 })
      : pipeline.flatten({ background: '#ffffff' }).webp({ quality: 92 })
  } else {
    pipeline = pipeline.png({ compressionLevel: 9, adaptiveFiltering: true })
  }

  await pipeline.toFile(outputPath)

  const outputMeta = await sharp(outputPath).metadata()
  return {
    source: basename(sourcePath),
    output: basename(outputPath),
    inputSize: `${metadata.width ?? 0}x${metadata.height ?? 0}`,
    trimmedSize: `${trimmed.info.width}x${trimmed.info.height}`,
    outputSize: `${outputMeta.width}x${outputMeta.height}`,
    hasAlpha,
  }
}

async function normalizeBrandDirectory(sourceDir) {
  const outputDir = join(sourceDir, NORMALIZED_DIR_NAME)

  const sourceStat = await stat(sourceDir).catch(() => null)
  if (!sourceStat?.isDirectory()) {
    throw new Error(`Source directory not found: ${sourceDir}`)
  }

  await mkdir(outputDir, { recursive: true })

  const sourceImages = await listSourceImages(sourceDir)
  if (!sourceImages.length) {
    console.log(`No console images found in ${sourceDir}`)
    return []
  }

  console.log(`Normalizing ${sourceImages.length} console image(s)`)
  console.log(`Source: ${sourceDir}`)
  console.log(`Output: ${outputDir}`)
  console.log(`Canvas: ${CANVAS_WIDTH}x${CANVAS_HEIGHT}`)
  console.log('')

  const results = []
  for (const sourcePath of sourceImages) {
    const outputPath = outputPathFor(sourcePath, outputDir)
    const result = await normalizeConsoleImage(sourcePath, outputPath)
    results.push(result)
    console.log(
      `${result.source} -> ${result.output} `
      + `(${result.inputSize} trim ${result.trimmedSize} => ${result.outputSize})`,
    )
  }

  console.log('')
  console.log(`Wrote ${results.length} normalized image(s) for ${sourceDir}. Originals left unchanged.`)
  console.log('')

  return results
}

async function main() {
  const args = parseArgs(process.argv)
  const sourceDirs = resolveSourceDirs(args)

  for (const sourceDir of sourceDirs) {
    await normalizeBrandDirectory(sourceDir)
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
