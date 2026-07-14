/**
 * Integrity tests for brand logo assets committed under public/.
 * Ensures registry paths cannot silently break on Git-based production deploys.
 * Run: node scripts/test-brand-logo-assets.mjs
 */
import { existsSync, readdirSync } from 'node:fs'
import { extname, join } from 'node:path'
import {
  BRAND_REGISTRY,
  FEATURED_BRAND_SLUGS,
  listBrandLogoAssetPaths,
  resolveBrandRegistryEntry,
} from '../src/lib/brandCatalogueCore.js'

function assert(condition, label) {
  if (!condition) throw new Error(label)
}

const publicRoot = join(process.cwd(), 'public')
const logosDir = join(publicRoot, 'brand-logos')

const assets = listBrandLogoAssetPaths()
assert(assets.length >= 13, `expected at least 13 logo assets, got ${assets.length}`)

for (const asset of assets) {
  assert(asset.logoPath.startsWith('/brand-logos/'), `${asset.slug} path under /brand-logos/`)
  assert(asset.logoPath.endsWith('.png'), `${asset.slug} logo must be transparent PNG`)
  const absolute = join(publicRoot, asset.logoPath.replace(/^\//, ''))
  assert(existsSync(absolute), `missing logo file for ${asset.slug}: ${asset.logoPath}`)
}

for (const slug of FEATURED_BRAND_SLUGS) {
  const entry = resolveBrandRegistryEntry(slug)
  assert(entry, `featured slug missing from BRAND_REGISTRY: ${slug}`)
  assert(entry.featured === true, `featured slug not marked featured: ${slug}`)
  assert(entry.logoPath, `featured brand missing logoPath: ${slug}`)
  const absolute = join(publicRoot, entry.logoPath.replace(/^\//, ''))
  assert(existsSync(absolute), `featured logo file missing: ${entry.logoPath}`)
}

for (const brand of ['Peloton', 'NordicTrack', 'BowFlex', 'Bowflex']) {
  const entry = resolveBrandRegistryEntry(brand)
  assert(entry, `${brand} must be registered`)
  assert(FEATURED_BRAND_SLUGS.includes(entry.slug), `${brand} must be featured`)
  assert(entry.logoPath && existsSync(join(publicRoot, entry.logoPath.replace(/^\//, ''))), `${brand} logo file missing`)
}

assert(
  FEATURED_BRAND_SLUGS.includes('peloton')
    && FEATURED_BRAND_SLUGS.includes('nordictrack')
    && FEATURED_BRAND_SLUGS.includes('bowflex'),
  'home-use brands in FEATURED_BRAND_SLUGS',
)

// No duplicate tracked extensions for the same brand stem (png+jpg etc.)
const stems = new Map()
for (const name of readdirSync(logosDir)) {
  const ext = extname(name).toLowerCase()
  if (!['.png', '.jpg', '.jpeg', '.webp'].includes(ext)) continue
  const stem = name.slice(0, -ext.length).toLowerCase()
  if (!stems.has(stem)) stems.set(stem, [])
  stems.get(stem).push(ext)
}
for (const [stem, exts] of stems.entries()) {
  assert(exts.length === 1, `duplicate logo formats for ${stem}: ${exts.join(', ')}`)
}

// Registry must not retain plate backgrounds.
for (const entry of BRAND_REGISTRY) {
  assert(!('logoBackground' in entry) || entry.logoBackground == null, `${entry.slug} must not set logoBackground`)
}

console.log(`brand-logo-assets: ok (${assets.length} registry logos verified on disk)`)
