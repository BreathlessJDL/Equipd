#!/usr/bin/env node
/**
 * Import/replace specific console images with white-background normalization.
 *
 * Usage:
 *   node scripts/import-specific-console-images.mjs --dry-run
 *   node scripts/import-specific-console-images.mjs --apply
 */
import { createClient } from '@supabase/supabase-js'
import { copyFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs'
import { basename, extname, join } from 'node:path'
import sharp from 'sharp'

const SOURCE_DIR = join(process.cwd(), 'public', 'design-reference')
const PUBLIC_ROOT = join(process.cwd(), 'public', 'equipment-console-images')

const CANVAS_WIDTH = 400
const CANVAS_HEIGHT = 260
const MAX_CONTENT_WIDTH = 360
const MAX_CONTENT_HEIGHT = 220
const TRIM_THRESHOLD = 12

const IMPORTS = [
  {
    filename: 'matrix onyx 22.png',
    brand: 'Matrix Fitness',
    console_key: 'onyx_22',
    dest_basename: 'onyx-22.png',
  },
  {
    filename: 'matrix onyx 32.png',
    brand: 'Matrix Fitness',
    console_key: 'onyx_32',
    dest_basename: 'onyx-32.png',
  },
  {
    filename: 'wattbike performance touch .png',
    brand: 'Wattbike',
    console_key: 'pts',
    dest_basename: 'pts.png',
  },
]

function loadEnv() {
  const text = readFileSync(join(process.cwd(), '.env.local'), 'utf8')
  const env = {}
  for (const line of text.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const idx = trimmed.indexOf('=')
    if (idx === -1) continue
    let value = trimmed.slice(idx + 1)
    if (
      (value.startsWith('"') && value.endsWith('"'))
      || (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    env[trimmed.slice(0, idx)] = value
  }
  return env
}

function brandSlug(brand) {
  return String(brand)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

async function normalizeWhiteBackground(sourcePath, outputPath) {
  const extension = extname(outputPath).toLowerCase()
  const metadata = await sharp(sourcePath, { failOn: 'none' }).metadata()
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

  let pipeline = sharp({
    create: {
      width: CANVAS_WIDTH,
      height: CANVAS_HEIGHT,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    },
  }).composite([{ input: resized.data, gravity: 'center' }])

  if (extension === '.png') {
    pipeline = pipeline.flatten({ background: '#ffffff' }).png({
      compressionLevel: 9,
      adaptiveFiltering: true,
    })
  } else if (extension === '.webp') {
    pipeline = hasAlpha
      ? pipeline.webp({ quality: 92, alphaQuality: 100 })
      : pipeline.flatten({ background: '#ffffff' }).webp({ quality: 92 })
  } else {
    pipeline = pipeline.flatten({ background: '#ffffff' }).jpeg({ quality: 92, mozjpeg: true })
  }

  await pipeline.toFile(outputPath)
}

async function main() {
  const apply = process.argv.includes('--apply')
  const env = loadEnv()
  const supabase = createClient(
    env.VITE_SUPABASE_URL || env.SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )

  const plan = []
  for (const entry of IMPORTS) {
    const sourcePath = join(SOURCE_DIR, entry.filename)
    if (!existsSync(sourcePath)) {
      plan.push({ ...entry, error: 'source_missing', sourcePath })
      continue
    }

    const { data, error } = await supabase
      .from('equipment_consoles')
      .select('id, brand, console_key, console_name, image_url, image_status')
      .ilike('brand', entry.brand)
      .eq('console_key', entry.console_key)
      .limit(1)
    if (error) throw error
    const consoleRow = data?.[0]
    if (!consoleRow) {
      plan.push({ ...entry, error: 'console_not_found', sourcePath })
      continue
    }

    const brand = brandSlug(entry.brand)
    const brandDir = join(PUBLIC_ROOT, brand)
    const rawDest = join(brandDir, entry.dest_basename)
    const normalizedDest = join(brandDir, 'normalized', entry.dest_basename)
    const imageUrl = `/equipment-console-images/${brand}/normalized/${entry.dest_basename}`
    const imageStoragePath = `equipment-console-images/${brand}/normalized/${entry.dest_basename}`

    plan.push({
      filename: entry.filename,
      sourcePath,
      console_id: consoleRow.id,
      brand: consoleRow.brand,
      console_key: consoleRow.console_key,
      console_name: consoleRow.console_name,
      previous_image_url: consoleRow.image_url,
      image_url: imageUrl,
      image_storage_path: imageStoragePath,
      rawDest,
      normalizedDest,
    })
  }

  console.log(`Mode: ${apply ? 'apply' : 'dry-run'}`)
  for (const row of plan) {
    if (row.error) {
      console.log(`FAIL ${row.filename}: ${row.error}`)
      continue
    }
    console.log(`${row.filename}`)
    console.log(`  → ${row.brand} / ${row.console_name} (${row.console_key})`)
    console.log(`  → ${row.console_id}`)
    console.log(`  → ${row.previous_image_url || '(none)'} => ${row.image_url}`)
  }

  if (!apply) {
    console.log('Dry-run only. Pass --apply to write.')
    return
  }

  for (const row of plan) {
    if (row.error) throw new Error(`${row.filename}: ${row.error}`)
    mkdirSync(join(row.normalizedDest, '..'), { recursive: true })
    copyFileSync(row.sourcePath, row.rawDest)
    await normalizeWhiteBackground(row.sourcePath, row.normalizedDest)

    const { error } = await supabase
      .from('equipment_consoles')
      .update({
        image_url: row.image_url,
        image_storage_path: row.image_storage_path,
        image_status: 'approved',
        updated_at: new Date().toISOString(),
      })
      .eq('id', row.console_id)
    if (error) throw error
  }

  console.log(`Updated ${plan.filter((row) => !row.error).length} consoles.`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
