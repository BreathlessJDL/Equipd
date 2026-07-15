#!/usr/bin/env node
/**
 * Report brand logo assets expected by the registry vs files on disk.
 */
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { listBrandLogoAssetPaths } from '../src/lib/brandCatalogueCore.js'

const assets = listBrandLogoAssetPaths()
const missing = []
const present = []

for (const asset of assets) {
  const absolute = join(process.cwd(), 'public', asset.logoPath.replace(/^\//, ''))
  if (existsSync(absolute)) present.push(asset)
  else missing.push({ ...asset, absolute })
}

console.log(`Brand logos expected: ${assets.length}`)
console.log(`Present: ${present.length}`)
console.log(`Missing: ${missing.length}`)
if (missing.length) {
  console.log('\nMissing logo paths:')
  for (const item of missing) {
    console.log(`- ${item.logoPath} (${item.displayName})`)
  }
  process.exitCode = 1
}
