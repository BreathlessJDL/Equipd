#!/usr/bin/env node
/**
 * Unit tests for public console image URL resolution and mapping.
 *
 * Local static-path validation (no network):
 *   node scripts/test-equipment-console-images.mjs
 *
 * Optional live HTTP checks (explicit):
 *   node scripts/test-equipment-console-images.mjs --verify-http
 */

import { existsSync } from 'node:fs'
import { join } from 'node:path'
import {
  encodeEquipmentConsolePublicPath,
  resolveEquipmentConsoleImageUrl,
  validateEquipmentConsoleImagePath,
} from '../src/lib/equipmentConsoleImages.js'
import { buildProductConsoleImageMap } from '../src/lib/productConsoleOptions.js'
import {
  resolveLifeFitnessConsoleImageUrl,
  resolveMatrixConsoleImageUrl,
} from '../src/lib/commercialCardioConsoleCompat.js'

function assert(condition, label) {
  if (!condition) throw new Error(label)
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`)
  }
}

const GO_URL = '/equipment-console-images/life-fitness/normalized/go.jpg'
const TRACK_CONNECT_2_URL = '/equipment-console-images/life-fitness/normalized/track-connect-2.png'

// --- resolver basics ---
assertEqual(resolveEquipmentConsoleImageUrl(null), null, 'null input')
assertEqual(resolveEquipmentConsoleImageUrl(''), null, 'empty string')
assertEqual(resolveEquipmentConsoleImageUrl('   '), null, 'whitespace')
assertEqual(resolveEquipmentConsoleImageUrl({}), null, 'empty object')
assertEqual(
  resolveEquipmentConsoleImageUrl({ image_url: null, image_storage_path: null }),
  null,
  'empty fields',
)

assertEqual(
  resolveEquipmentConsoleImageUrl(GO_URL),
  GO_URL,
  'relative public path',
)
assertEqual(
  resolveEquipmentConsoleImageUrl('equipment-console-images/life-fitness/normalized/go.jpg'),
  GO_URL,
  'storage-style path without leading slash',
)
assertEqual(
  resolveEquipmentConsoleImageUrl({
    image_url: null,
    image_storage_path: 'equipment-console-images/life-fitness/normalized/go.jpg',
  }),
  GO_URL,
  'storage_path fallback',
)

assertEqual(
  resolveEquipmentConsoleImageUrl('https://cdn.example.com/consoles/go.jpg'),
  'https://cdn.example.com/consoles/go.jpg',
  'absolute URL passthrough',
)

assertEqual(
  resolveEquipmentConsoleImageUrl(
    'https://www.equipd.co.uk/equipment-console-images/life-fitness/normalized/go.jpg',
  ),
  GO_URL,
  'absolute URL pointing at static convention normalises to site-relative',
)

assertEqual(
  resolveEquipmentConsoleImageUrl('/equipment-console-images/life-fitness/normalized/LF SE3HD.webp'),
  '/equipment-console-images/life-fitness/normalized/LF%20SE3HD.webp',
  'encodes spaces once',
)
assertEqual(
  resolveEquipmentConsoleImageUrl('/equipment-console-images/life-fitness/normalized/LF%20SE3HD.webp'),
  '/equipment-console-images/life-fitness/normalized/LF%20SE3HD.webp',
  'does not double-encode',
)
assertEqual(
  encodeEquipmentConsolePublicPath('/equipment-console-images/life-fitness/normalized/LF SE3HD.webp'),
  '/equipment-console-images/life-fitness/normalized/LF%20SE3HD.webp',
  'encode helper',
)

assertEqual(
  resolveEquipmentConsoleImageUrl('not a path'),
  null,
  'malformed path rejection',
)
assertEqual(
  resolveEquipmentConsoleImageUrl('ftp://example.com/x.jpg'),
  null,
  'unsupported protocol rejection',
)

// Prefer image_url over storage path when both present.
assertEqual(
  resolveEquipmentConsoleImageUrl({
    image_url: GO_URL,
    image_storage_path: 'equipment-console-images/life-fitness/normalized/track.jpg',
  }),
  GO_URL,
  'image_url wins over storage_path',
)

// --- Life Fitness GO / TRACK CONNECT 2.0 ---
assertEqual(
  resolveLifeFitnessConsoleImageUrl('GO'),
  GO_URL,
  'GO template resolver',
)
assertEqual(
  resolveLifeFitnessConsoleImageUrl('TRACK CONNECT 2.0'),
  TRACK_CONNECT_2_URL,
  'TRACK CONNECT 2.0 template resolver',
)
assertEqual(
  resolveEquipmentConsoleImageUrl(GO_URL),
  GO_URL,
  'GO canonical public URL',
)
assertEqual(
  resolveEquipmentConsoleImageUrl(TRACK_CONNECT_2_URL),
  TRACK_CONNECT_2_URL,
  'TRACK CONNECT 2.0 canonical public URL',
)

assert(
  existsSync(join(process.cwd(), 'public', GO_URL.slice(1))),
  'GO local asset exists',
)
assert(
  existsSync(join(process.cwd(), 'public', TRACK_CONNECT_2_URL.slice(1))),
  'TRACK CONNECT 2.0 local asset exists',
)

assertEqual(
  resolveMatrixConsoleImageUrl('XR'),
  '/equipment-console-images/matrix-fitness/normalized/xr.jpg',
  'Matrix XR template resolver',
)

// --- image map (public product cards) ---
const imageMap = buildProductConsoleImageMap([
  {
    console_name: 'GO',
    image_url: GO_URL,
  },
  {
    console_name: 'TRACK CONNECT 2.0',
    image_url: null,
    image_storage_path: 'equipment-console-images/life-fitness/normalized/track-connect-2.png',
  },
  {
    console_name: 'Broken',
    image_url: 'not-valid',
  },
  {
    console_name: 'Missing',
    image_url: null,
  },
])

assertEqual(imageMap.GO, GO_URL, 'image map GO')
assertEqual(imageMap['TRACK CONNECT 2.0'], TRACK_CONNECT_2_URL, 'image map TRACK CONNECT 2.0')
assertEqual(imageMap.Broken, undefined, 'image map omits malformed')
assertEqual(imageMap.Missing, undefined, 'image map omits empty')

// Duplicate resolution is pure / deterministic (no refetch side effects).
const first = resolveEquipmentConsoleImageUrl(GO_URL)
const second = resolveEquipmentConsoleImageUrl(GO_URL)
assertEqual(first, second, 'duplicate resolution is stable')
assertEqual(
  buildProductConsoleImageMap([{ console_name: 'GO', image_url: GO_URL }]).GO,
  buildProductConsoleImageMap([{ console_name: 'GO', image_url: GO_URL }]).GO,
  'duplicate map builds are stable',
)

// --- admin validation ---
assertEqual(validateEquipmentConsoleImagePath('').ok, true, 'empty path allowed')
assertEqual(validateEquipmentConsoleImagePath(GO_URL).ok, true, 'valid relative path')
assertEqual(validateEquipmentConsoleImagePath(GO_URL).resolvedUrl, GO_URL, 'valid resolved')
assertEqual(validateEquipmentConsoleImagePath('bad').ok, false, 'invalid path rejected')
assert(
  String(validateEquipmentConsoleImagePath('bad').error || '').length > 0,
  'invalid path has error message',
)

// Console option remains selectable when image is missing: image map simply
// omits the URL; variant cards still render the console name (UI contract).
const selectableWithoutImage = buildProductConsoleImageMap([
  { console_name: 'LED', image_url: null },
])
assertEqual(selectableWithoutImage.LED, undefined, 'missing image does not invent a URL')

if (process.argv.includes('--verify-http')) {
  const base = 'https://www.equipd.co.uk'
  for (const path of [GO_URL, TRACK_CONNECT_2_URL]) {
    const response = await fetch(`${base}${path}`, { method: 'GET', redirect: 'follow' })
    assertEqual(response.status, 200, `live HTTP ${path}`)
  }
  console.log('Live HTTP checks passed.')
}

console.log('equipment-console-images tests passed')
